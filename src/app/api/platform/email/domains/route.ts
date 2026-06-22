import { NextRequest, NextResponse } from "next/server";
import { requirePlatformMutation } from "@/lib/api-auth";
import { publishDnsRecordsToCloudflare } from "@/lib/cloudflare-dns";
import {
  ensureResendDomain,
  resendRecordsToCloudflare,
  verifyResendDomain
} from "@/lib/resend-email";
import { readPlatformState } from "@/lib/server-store";

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
    autoDns?: boolean;
    verify?: boolean;
  };
  const state = readPlatformState();
  const site = body.siteId ? state.sites.find((item) => item.id === body.siteId) : undefined;
  const domain = normalizeDomain(body.domain || site?.primaryDomain);
  if (!domain) return NextResponse.json({ error: "missing_domain" }, { status: 400 });
  if (!domain.includes(".") || isLocalDomain(domain)) {
    return NextResponse.json({ error: "local_domain_not_verifiable" }, { status: 400 });
  }
  const cfAccount = (state.platformCloudflareAccounts ?? []).find((account) => account.id === state.currentCloudflareAccountId);
  try {
    const resend = await ensureResendDomain({ domain, settings: state.platformEmailSettings });
    const dnsRecords = resendRecordsToCloudflare(resend.domain.records);
    if (!dnsRecords.length) return NextResponse.json({ error: "resend_domain_records_missing" }, { status: 502 });
    const cloudflare = body.autoDns === false
      ? undefined
      : await publishDnsRecordsToCloudflare({
          account: cfAccount,
          domain,
          records: dnsRecords
        });
    const verified = body.verify === false || !resend.domain.id
      ? undefined
      : await verifyResendDomain({ domainId: resend.domain.id, settings: state.platformEmailSettings });
    return NextResponse.json({
      ok: true,
      domain,
      resend: {
        domain: resend.domain,
        created: resend.created,
        verificationStatus: verified?.status ?? resend.domain.status
      },
      dnsRecords,
      cloudflare,
      verified
    });
  } catch (error) {
    const code = providerErrorCode(error);
    const status =
      code === "missing_resend_api_key" ||
      code === "missing_cloudflare_api_token" ||
      code === "missing_cloudflare_account_id"
        ? 400
        : code === "cloudflare_zone_not_found" || code === "resend_domain_not_found"
          ? 404
          : code === "cloudflare_rate_limited" || code === "resend_rate_limited"
            ? 429
            : 502;
    return NextResponse.json({ error: code }, { status });
  }
}
