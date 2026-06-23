import { NextRequest, NextResponse } from "next/server";
import { getCurrentSiteAdmin, requireSiteMutation } from "@/lib/api-auth";
import {
  domainFromEmail,
  ensureResendDomain,
  listResendDomains,
  normalizePlatformEmailConfig,
  normalizeResendApiKey,
  resendDomainMatchesSender,
  resendEmailConfigStatusForSettings,
  resendRecordsToCloudflare,
  resolveResendSettingsForSite,
  sendEmailProviderTest,
  verifyResendDomain
} from "@/lib/resend-email";
import { getPlatformOverviewRelational, updatePlatformEmailSettingsRelational } from "@/lib/stores/platform-store";

type ResendDomain = { id?: string; name?: string; status?: string; region?: string; created_at?: string };

function siteConfigId(siteId: string): string {
  return `site_${siteId}_resend`;
}

function normalizeEmail(value?: string): string {
  return value?.trim() ?? "";
}

function normalizeDomain(value?: string): string {
  return value?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") ?? "";
}

function isLocalDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized.endsWith(".localhost");
}

function senderLocalPart(email: string): string {
  const [local = "verify"] = email.split("@");
  return local.trim() || "verify";
}

function providerErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "email_provider_failed";
  return error.message || "email_provider_failed";
}

function fromDomainAllowed(fromEmail: string, allowedDomains: string[]): boolean {
  const fromDomain = domainFromEmail(fromEmail);
  return Boolean(fromDomain) && allowedDomains.some((domain) => domain === fromDomain || fromDomain.endsWith(`.${domain}`));
}

async function buildPayload(siteId: string, domainOverride?: ResendDomain[], dnsRecords?: Array<{ type?: string; name?: string; content?: string }>) {
  const overview = await getPlatformOverviewRelational();
  const site = overview.sites.find((item) => item.id === siteId);
  if (!site) return { error: "site_not_found" as const, status: 404 as const };
  const state = {
    platformEmailSettings: overview.platformEmailSettings,
    platformEmailConfigs: overview.platformEmailConfigs,
    siteEmailConfigAssignments: overview.siteEmailConfigAssignments
  };
  const selected = resolveResendSettingsForSite(state, site.id);
  const status = resendEmailConfigStatusForSettings(selected);
  const local = senderLocalPart(status.fromEmail || "verify@example.com");
  const candidateFromEmail = `${local}@${site.primaryDomain}`.toLowerCase();
  const candidateDomain = domainFromEmail(candidateFromEmail);
  let domains = domainOverride ?? [];
  if (!domainOverride && status.apiKeyConfigured) {
    try {
      domains = await listResendDomains(selected);
    } catch {
      domains = [];
    }
  }
  const resendDomain = domains.find((domain) => resendDomainMatchesSender(domain.name, candidateDomain));
  const verified = resendDomain?.status === "verified";
  const localDomain = isLocalDomain(candidateDomain);
  const blockingReasons = [
    !status.apiKeyConfigured ? "missing_resend_api_key" : "",
    !status.fromConfigured ? "missing_resend_from_email" : "",
    status.usingTestingSender ? "resend_testing_sender" : "",
    localDomain ? "local_domain_not_verifiable" : "",
    !localDomain && !resendDomain ? "sender_domain_not_found_in_resend" : "",
    resendDomain && !verified ? "sender_domain_not_verified" : ""
  ].filter(Boolean);

  return {
    config: {
      ...status,
      id: selected.id,
      label: selected.label
    },
    domainStatus: localDomain ? "local" : resendDomain?.status ?? "not_found",
    candidateFromEmail,
    candidateDomain,
    readyForProduction: status.apiKeyConfigured && !status.usingTestingSender && verified,
    blockingReasons,
    resendDomain,
    dnsRecords
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await getCurrentSiteAdmin(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const payload = await buildPayload(siteId);
  if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
  return NextResponse.json(payload);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:email-settings` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as {
    apiKey?: string;
    fromEmail?: string;
    replyTo?: string;
  };
  const overview = await getPlatformOverviewRelational();
  const site = overview.sites.find((item) => item.id === siteId);
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  const allowedDomains = [
    normalizeDomain(site.primaryDomain),
    ...overview.siteDomains.filter((domain) => domain.siteId === site.id).map((domain) => normalizeDomain(domain.domain))
  ].filter(Boolean);
  const apiKey = body.apiKey?.trim();
  const fromEmail = normalizeEmail(body.fromEmail);
  const replyTo = normalizeEmail(body.replyTo);
  if (apiKey && !normalizeResendApiKey(apiKey)) return NextResponse.json({ error: "invalid_resend_api_key_format" }, { status: 400 });
  if (fromEmail && !fromEmail.includes("@")) return NextResponse.json({ error: "invalid_from_email" }, { status: 400 });
  if (fromEmail && !fromDomainAllowed(fromEmail, allowedDomains)) return NextResponse.json({ error: "from_domain_not_allowed_for_site" }, { status: 400 });
  if (replyTo && !replyTo.includes("@")) return NextResponse.json({ error: "invalid_reply_to" }, { status: 400 });

  const configId = siteConfigId(site.id);
  const existing = overview.platformEmailConfigs.find((config) => config.id === configId);
  const nextConfig = normalizePlatformEmailConfig({
    ...(existing ?? { id: configId, label: `${site.name} Resend` }),
    apiKey: apiKey || existing?.apiKey,
    fromEmail: fromEmail || existing?.fromEmail || `verify@${site.primaryDomain}`,
    replyTo: replyTo || existing?.replyTo,
    updatedAt: new Date().toISOString(),
    updatedBy: guard.current.siteAdmin.id
  }, overview.platformEmailSettings);
  const nextAssignments = [
    ...overview.siteEmailConfigAssignments.filter((assignment) => assignment.siteId !== site.id),
    { siteId: site.id, configId }
  ];
  await updatePlatformEmailSettingsRelational({
    configId,
    label: nextConfig.label,
    apiKey: nextConfig.apiKey,
    fromEmail: nextConfig.fromEmail,
    replyTo: nextConfig.replyTo,
    isDefault: false,
    siteAssignments: nextAssignments,
    actor: guard.current.siteAdmin.id
  });
  const payload = await buildPayload(siteId);
  if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
  return NextResponse.json(payload);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:email-action` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "dns_check" | "send_test";
    to?: string;
  };
  const overview = await getPlatformOverviewRelational();
  const site = overview.sites.find((item) => item.id === siteId);
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  const state = {
    platformEmailSettings: overview.platformEmailSettings,
    platformEmailConfigs: overview.platformEmailConfigs,
    siteEmailConfigAssignments: overview.siteEmailConfigAssignments
  };
  const selected = resolveResendSettingsForSite(state, site.id);

  if (body.action === "send_test") {
    const to = body.to?.trim().toLowerCase();
    if (!to || !to.includes("@")) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    try {
      const result = await sendEmailProviderTest({ to, site, settings: selected });
      return NextResponse.json({ ...(await buildPayload(siteId)), messageId: result.messageId });
    } catch (error) {
      return NextResponse.json({ error: providerErrorCode(error) }, { status: 502 });
    }
  }

  const domain = normalizeDomain(site.primaryDomain);
  if (!domain || !domain.includes(".") || isLocalDomain(domain)) {
    return NextResponse.json({ error: "local_domain_not_verifiable" }, { status: 400 });
  }
  try {
    const resend = await ensureResendDomain({ domain, settings: selected });
    const dnsRecords = resendRecordsToCloudflare(resend.domain.records);
    const verified = resend.domain.id
      ? await verifyResendDomain({ domainId: resend.domain.id, settings: selected })
      : undefined;
    const payload = await buildPayload(siteId, [resend.domain], dnsRecords);
    if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: payload.status });
    return NextResponse.json({
      ...payload,
      resend: {
        domain: resend.domain,
        created: resend.created,
        verificationStatus: verified?.status ?? resend.domain.status
      }
    });
  } catch (error) {
    return NextResponse.json({ error: providerErrorCode(error) }, { status: 502 });
  }
}
