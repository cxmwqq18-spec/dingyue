import { NextRequest, NextResponse } from "next/server";
import { requirePlatformMutation } from "@/lib/api-auth";
import {
  domainFromEmail,
  ensureResendDomain,
  resendRecordsToCloudflare,
  resolveResendSettingsForSite,
  verifyResendDomain
} from "@/lib/resend-email";
import { getPlatformEmailOverviewRelational } from "@/lib/stores/platform-store";

function isLocalDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized.endsWith(".localhost");
}

function normalizeDomain(value?: string): string {
  return value?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") ?? "";
}

function providerErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "email_domain_provision_failed";
  return error.message || "email_domain_provision_failed";
}

export async function POST(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:email-domain" });
  if (!permission.ok) return permission.response;
  const body = (await request.json().catch(() => ({}))) as {
    domain?: string;
    siteId?: string;
    configId?: string;
    resendConfigId?: string;
    verify?: boolean;
  };
  const overview = await getPlatformEmailOverviewRelational();
  const site = body.siteId ? overview.sites.find((item) => item.id === body.siteId) : undefined;
  const requestedConfigId = body.resendConfigId ?? body.configId;
  const settingsContext = {
    platformEmailSettings: overview.platformEmailSettings,
    platformEmailConfigs: overview.platformEmailConfigs,
    siteEmailConfigAssignments: requestedConfigId && body.siteId
      ? [{ siteId: body.siteId, configId: requestedConfigId }]
      : overview.siteEmailConfigAssignments
  };
  const settings = resolveResendSettingsForSite(settingsContext, body.siteId);
  const domain = normalizeDomain(domainFromEmail(settings.fromEmail ?? "") || body.domain || site?.primaryDomain);
  if (!domain) return NextResponse.json({ error: "missing_domain" }, { status: 400 });
  if (!domain.includes(".") || isLocalDomain(domain)) {
    return NextResponse.json({ error: "local_domain_not_verifiable" }, { status: 400 });
  }
  try {
    const resend = await ensureResendDomain({ domain, settings });
    const dnsRecords = resendRecordsToCloudflare(resend.domain.records);
    const verified = body.verify === false || !resend.domain.id
      ? undefined
      : await verifyResendDomain({ domainId: resend.domain.id, settings });
    return NextResponse.json({
      ok: true,
      domain,
      resend: {
        configId: settings.id,
        configLabel: settings.label,
        domain: resend.domain,
        created: resend.created,
        verificationStatus: verified?.status ?? resend.domain.status
      },
      dnsRecords,
      verified
    });
  } catch (error) {
    const code = providerErrorCode(error);
    const status =
      code === "missing_resend_api_key"
        ? 400
        : code === "resend_domain_not_found"
          ? 404
          : code === "resend_rate_limited"
            ? 429
            : 502;
    return NextResponse.json({ error: code }, { status });
  }
}
