import "server-only";
import { getCurrentPlatformAdmin, getCurrentSiteAdmin } from "@/lib/api-auth";
import { isTransientPrismaConnectionError, prisma, runPrismaReadWithReconnect } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import type { CustomerAdminAccess, PublicCustomer } from "@/lib/types";

type SiteAdminRole = NonNullable<CustomerAdminAccess["role"]>;
const customerAdminEmailAccessCache = createServerTtlCache(
  "customer-admin-email-access",
  Number(process.env.CUSTOMER_ADMIN_EMAIL_ACCESS_CACHE_TTL_MS ?? 30_000)
);

function normalizeEmail(email: string | undefined): string | undefined {
  const normalized = email?.trim().toLowerCase();
  return normalized || undefined;
}

function siteAdminRole(value: string): SiteAdminRole {
  return value === "owner" || value === "support" ? value : "admin";
}

async function getCustomerAdminAccessForSiteUnsafe({
  customer,
  siteId
}: {
  customer?: Pick<PublicCustomer, "email">;
  siteId: string;
}): Promise<CustomerAdminAccess> {
  const customerEmail = normalizeEmail(customer?.email);
  const currentPlatformAdmin = await getCurrentPlatformAdmin();
  if (currentPlatformAdmin) {
    return {
      canBypassBilling: true,
      displayName: currentPlatformAdmin.platformAdmin.displayName,
      source: "platform_admin_session"
    };
  }
  const currentSiteAdmin = await getCurrentSiteAdmin(siteId);
  if (currentSiteAdmin) {
    const adminEmail = normalizeEmail(currentSiteAdmin.siteAdmin.email);
    if (!customerEmail || adminEmail === customerEmail) {
      return {
        canBypassBilling: true,
        siteAdminId: currentSiteAdmin.siteAdmin.id,
        role: currentSiteAdmin.siteAdmin.role,
        displayName: currentSiteAdmin.siteAdmin.displayName,
        source: "site_admin_session"
      };
    }
  }

  if (!customerEmail) return { canBypassBilling: false };

  const siteAdmin = await customerAdminEmailAccessCache.get(
    `${siteId}:${customerEmail}`,
    () => runPrismaReadWithReconnect(
      () => prisma.siteAdmin.findFirst({
        where: {
          siteId,
          email: { equals: customerEmail, mode: "insensitive" }
        },
        select: {
          id: true,
          displayName: true,
          role: true
        }
      }),
      { label: "customer admin access site admin", retries: 2, timeoutMs: 10_000 }
    )
  );
  if (!siteAdmin) return { canBypassBilling: false };

  return {
    canBypassBilling: true,
    siteAdminId: siteAdmin.id,
    role: siteAdminRole(siteAdmin.role),
    displayName: siteAdmin.displayName,
    source: "site_admin_email"
  };
}

export async function getCustomerAdminAccessForSite(params: {
  customer?: Pick<PublicCustomer, "email">;
  siteId: string;
}): Promise<CustomerAdminAccess> {
  try {
    return await getCustomerAdminAccessForSiteUnsafe(params);
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) throw error;
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    console.warn("[customer-admin-access] transient DB lookup failed; continuing without admin bypass.", message);
    return { canBypassBilling: false };
  }
}
