import { NextRequest, NextResponse } from "next/server";
import { getCurrentPlatformAdmin, requirePlatformMutation } from "@/lib/api-auth";
import {
  domainFromEmail,
  listResendDomains,
  ResendProviderError,
  normalizeResendApiKey,
  resendDomainMatchesSender,
  resendEmailConfigStatusForSettings,
  sendEmailProviderTest
} from "@/lib/resend-email";
import { getPlatformOverviewRelational, updatePlatformEmailSettingsRelational } from "@/lib/stores/platform-store";
import type { PlatformEmailSettings, PlatformState, Site, SiteDomain } from "@/lib/types";

type ResendDomain = { id?: string; name?: string; status?: string; region?: string; created_at?: string };

function safeProviderMessage(message: string): string {
  return message.replace(/re_[A-Za-z0-9_-]+/g, "re_***").slice(0, 500);
}

function providerErrorDetails(error: unknown): {
  error: string;
  providerStatus?: number;
  providerMessage?: string;
} {
  if (!(error instanceof Error)) return { error: "email_send_failed" };
  if (error instanceof ResendProviderError) {
    return {
      error: error.code,
      providerStatus: error.status,
      providerMessage: error.providerMessage ? safeProviderMessage(error.providerMessage) : undefined
    };
  }
  return { error: error.message || "email_send_failed" };
}

function normalizeEmail(value?: string): string {
  return value?.trim() ?? "";
}

function senderLocalPart(email: string): string {
  const [local = "verify"] = email.split("@");
  return local.trim() || "verify";
}

function isLocalDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized.endsWith(".localhost");
}

function candidateFromForSite(site: Site, settings: PlatformEmailSettings | undefined): string {
  const config = resendEmailConfigStatusForSettings(settings);
  const local = senderLocalPart(config.fromEmail || "verify@example.com");
  return `${local}@${site.primaryDomain}`.toLowerCase();
}

function buildSiteEmailRows(
  state: Pick<PlatformState, "platformEmailSettings" | "sites"> & { siteDomains: SiteDomain[] },
  domains: ResendDomain[]
) {
  const settings = state.platformEmailSettings;
  const config = resendEmailConfigStatusForSettings(settings);
  return state.sites.map((site) => {
    const siteDomains = state.siteDomains.filter((domain) => domain.siteId === site.id);
    const candidateFromEmail = candidateFromForSite(site, settings);
    const candidateDomain = domainFromEmail(candidateFromEmail);
    const resendDomain = domains.find((domain) => resendDomainMatchesSender(domain.name, candidateDomain));
    const verified = resendDomain?.status === "verified";
    const localDomain = isLocalDomain(candidateDomain);
    const blockingReasons = [
      !config.apiKeyConfigured ? "missing_resend_api_key" : "",
      !config.fromConfigured ? "missing_resend_from_email" : "",
      config.usingTestingSender ? "resend_testing_sender" : "",
      localDomain ? "local_domain_not_verifiable" : "",
      !localDomain && !resendDomain ? "sender_domain_not_found_in_resend" : "",
      resendDomain && !verified ? "sender_domain_not_verified" : ""
    ].filter(Boolean);
    return {
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
        primaryDomain: site.primaryDomain,
        branding: site.branding
      },
      domains: siteDomains.map((domain) => ({
        id: domain.id,
        domain: domain.domain,
        isPrimary: domain.isPrimary,
        status: domain.status
      })),
      provider: "resend",
      candidateFromEmail,
      candidateDomain,
      resendDomain,
      domainStatus: localDomain ? "local" : resendDomain?.status ?? "not_found",
      readyForProduction: config.apiKeyConfigured && !config.usingTestingSender && verified,
      blockingReasons
    };
  });
}

async function platformEmailPayload() {
  const overview = await getPlatformOverviewRelational();
  const state = {
    sites: overview.sites,
    siteDomains: overview.siteDomains,
    platformEmailSettings: overview.platformEmailSettings
  };
  const settings = state.platformEmailSettings;
  const config = resendEmailConfigStatusForSettings(settings);
  let domainCheckError: ReturnType<typeof providerErrorDetails> | undefined;
  let domains: ResendDomain[] = [];
  try {
    domains = await listResendDomains(settings);
  } catch (error) {
    domainCheckError = providerErrorDetails(error);
  }
  const senderDomain = domains.find((domain) => resendDomainMatchesSender(domain.name, config.fromDomain));
  const senderDomainVerified = senderDomain?.status === "verified";
  const siteRows = buildSiteEmailRows(state, domains);
  const readySites = siteRows.filter((row) => row.readyForProduction).length;
  const blockingReasons = [
    !config.apiKeyConfigured ? "missing_resend_api_key" : "",
    !config.fromConfigured ? "missing_resend_from_email" : "",
    config.usingTestingSender ? "resend_testing_sender" : "",
    domainCheckError?.error ?? "",
    config.fromConfigured && !senderDomain ? "sender_domain_not_found_in_resend" : "",
    senderDomain && !senderDomainVerified ? "sender_domain_not_verified" : ""
  ].filter(Boolean);
  return {
    ok: true,
    config,
    domains,
    domainCheckError,
    senderDomain,
    blockingReasons,
    readyForProduction: config.apiKeyConfigured && config.fromConfigured && !config.usingTestingSender && senderDomainVerified,
    summary: {
      totalSites: siteRows.length,
      readySites,
      blockedSites: siteRows.length - readySites,
      verifiedDomains: domains.filter((domain) => domain.status === "verified").length
    },
    sites: siteRows,
    note: "一个 Resend API Key 可统一检测当前账号下多个 Domains；每个站点要用自己的域名发信时，该域名仍必须在 Resend 完成 DNS 验证。"
  };
}

export async function GET() {
  const current = await getCurrentPlatformAdmin();
  if (!current) return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  return NextResponse.json(await platformEmailPayload());
}

export async function PUT(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:email" });
  if (!permission.ok) return permission.response;
  const body = (await request.json().catch(() => ({}))) as {
    apiKey?: string;
    fromEmail?: string;
    replyTo?: string;
  };
  const apiKey = body.apiKey?.trim();
  const fromEmail = normalizeEmail(body.fromEmail);
  const replyTo = normalizeEmail(body.replyTo);
  if (fromEmail && !fromEmail.includes("@")) return NextResponse.json({ error: "invalid_from_email" }, { status: 400 });
  if (replyTo && !replyTo.includes("@")) return NextResponse.json({ error: "invalid_reply_to" }, { status: 400 });
  if (apiKey && !normalizeResendApiKey(apiKey)) return NextResponse.json({ error: "invalid_resend_api_key_format" }, { status: 400 });
  await updatePlatformEmailSettingsRelational({
    apiKey,
    fromEmail,
    replyTo,
    actor: permission.current.platformAdmin.id
  });
  return NextResponse.json(await platformEmailPayload());
}

export async function POST(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:email-test" });
  if (!permission.ok) return permission.response;
  const body = (await request.json().catch(() => ({}))) as { to?: string; siteId?: string };
  const to = body.to?.trim().toLowerCase();
  if (!to || !to.includes("@")) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const overview = await getPlatformOverviewRelational();
  const state = {
    sites: overview.sites,
    siteDomains: overview.siteDomains,
    platformEmailSettings: overview.platformEmailSettings
  };
  const site = state.sites.find((item) => item.id === body.siteId) ?? state.sites[0];
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  try {
    const result = await sendEmailProviderTest({ to, site, settings: state.platformEmailSettings });
    return NextResponse.json({ ok: true, messageId: result.messageId, siteId: site.id });
  } catch (error) {
    const details = providerErrorDetails(error);
    console.error("[platform-email-test] send failed", {
      code: details.error,
      providerStatus: details.providerStatus,
      providerMessage: details.providerMessage,
      siteId: site.id,
      toDomain: domainFromEmail(to),
      fromDomain: domainFromEmail(state.platformEmailSettings?.fromEmail ?? "")
    });
    return NextResponse.json(details, { status: 502 });
  }
}
