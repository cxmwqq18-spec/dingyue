import "server-only";
import { getCurrentSiteAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import type { CustomerAdminAccess, PublicCustomer } from "@/lib/types";

type SiteAdminRole = NonNullable<CustomerAdminAccess["role"]>;

function normalizeEmail(email: string | undefined): string | undefined {
  const normalized = email?.trim().toLowerCase();
  return normalized || undefined;
}

function siteAdminRole(value: string): SiteAdminRole {
  return value === "owner" || value === "support" ? value : "admin";
}

export async function getCustomerAdminAccessForSite({
  customer,
  siteId
}: {
  customer?: Pick<PublicCustomer, "email">;
  siteId: string;
}): Promise<CustomerAdminAccess> {
  const customerEmail = normalizeEmail(customer?.email);
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

  const siteAdmin = await prisma.siteAdmin.findFirst({
    where: {
      siteId,
      email: { equals: customerEmail, mode: "insensitive" }
    },
    select: {
      id: true,
      displayName: true,
      role: true
    }
  });
  if (!siteAdmin) return { canBypassBilling: false };

  return {
    canBypassBilling: true,
    siteAdminId: siteAdmin.id,
    role: siteAdminRole(siteAdmin.role),
    displayName: siteAdmin.displayName,
    source: "site_admin_email"
  };
}
