import { NextRequest, NextResponse } from "next/server";
import { getCurrentPlatformAdmin, requirePlatformMutation } from "@/lib/api-auth";
import {
  domainFromEmail,
  ResendProviderError,
  normalizeResendApiKey,
  resendEmailConfigStatusForSite,
  resendDomainMatchesSender,
  resendEmailConfigStatusForSettings,
  resolveResendSettingsForSite,
  sendEmailProviderTest
} from "@/lib/resend-email";
import { getPlatformEmailOverviewRelational, updatePlatformEmailSettingsRelational, writePlatformEmailTestResultRelational } from "@/lib/stores/platform-store";
import type { PlatformEmailTestResult, PlatformState, Site, SiteDomain, SiteEmailConfigAssignment } from "@/lib/types";

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

function isLocalDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized.endsWith(".localhost");
}

type EmailState = Pick<PlatformState, "platformEmailSettings" | "sites" | "platformEmailConfigs" | "siteEmailConfigAssignments"> & { siteDomains: SiteDomain[] };

function candidateFromForSite(site: Site, state: EmailState): string {
  const config = resendEmailConfigStatusForSite(state, site.id);
  return (config.fromEmail || `verify@${site.primaryDomain}`).trim().toLowerCase();
}

function buildSiteEmailRows(
  state: EmailState,
  domains: ResendDomain[],
  domainsByConfigId: Record<string, ResendDomain[]>,
  testResults: Record<string, PlatformEmailTestResult>
) {
  const domainsBySiteId = new Map<string, SiteDomain[]>();
  for (const domain of state.siteDomains) {
    const siteDomains = domainsBySiteId.get(domain.siteId);
    if (siteDomains) siteDomains.push(domain);
    else domainsBySiteId.set(domain.siteId, [domain]);
  }
  return state.sites.map((site) => {
    const config = resendEmailConfigStatusForSite(state, site.id);
    const selectedSettings = resolveResendSettingsForSite(state, site.id);
    const configDomains = domainsByConfigId[selectedSettings.id] ?? domains;
    const siteDomains = domainsBySiteId.get(site.id) ?? [];
    const candidateFromEmail = candidateFromForSite(site, state);
    const candidateDomain = domainFromEmail(candidateFromEmail);
    const resendDomain = configDomains.find((domain) => resendDomainMatchesSender(domain.name, candidateDomain));
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
      emailConfigId: selectedSettings.id,
      emailConfigLabel: selectedSettings.label,
      candidateFromEmail,
      candidateDomain,
      resendDomain,
      domainStatus: localDomain ? "local" : resendDomain?.status ?? "not_found",
      readyForProduction: config.apiKeyConfigured && !config.usingTestingSender && verified,
      blockingReasons,
      testResult: testResults[site.id]
    };
  });
}

async function platformEmailPayload() {
  const snapshot = await getPlatformEmailOverviewRelational();
  const state = {
    sites: snapshot.sites,
    siteDomains: snapshot.siteDomains,
    platformEmailSettings: snapshot.platformEmailSettings,
    platformEmailConfigs: snapshot.platformEmailConfigs ?? [],
    siteEmailConfigAssignments: snapshot.siteEmailConfigAssignments ?? []
  };
  const settings = state.platformEmailSettings;
  const config = resendEmailConfigStatusForSettings(settings);
  const domains: ResendDomain[] = [];
  const domainsByConfigId: Record<string, ResendDomain[]> = {};
  const senderDomain = domains.find((domain) => resendDomainMatchesSender(domain.name, config.fromDomain));
  const siteRows = buildSiteEmailRows(state, domains, domainsByConfigId, snapshot.emailTestResults ?? {});
  const configured = config.apiKeyConfigured && config.fromConfigured && !config.usingTestingSender;
  const readySites = configured ? siteRows.length : 0;
  const blockingReasons = [
    !config.apiKeyConfigured ? "missing_resend_api_key" : "",
    !config.fromConfigured ? "missing_resend_from_email" : "",
    config.usingTestingSender ? "resend_testing_sender" : ""
  ].filter(Boolean);
  return {
    ok: true,
    config,
    configs: state.platformEmailConfigs.map((item) => ({
      ...resendEmailConfigStatusForSettings(item),
      id: item.id,
      label: item.label,
      isDefault: item.isDefault,
      domains: domainsByConfigId[item.id] ?? []
    })),
    siteEmailConfigAssignments: state.siteEmailConfigAssignments,
    domains,
    domainCheckError: undefined,
    senderDomain,
    blockingReasons,
    readyForProduction: configured,
    summary: {
      totalSites: siteRows.length,
      readySites,
      blockedSites: siteRows.length - readySites,
      verifiedDomains: domains.filter((domain) => domain.status === "verified").length
    },
    sites: siteRows,
    note: "当前列表为快照状态；发送测试或手动域名检测时才会请求 Resend，避免打开模块和刷新配置时长时间等待。"
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
    action?: "save_config" | "bind_site";
    configId?: string;
    resendConfigId?: string;
    siteId?: string;
    label?: string;
    apiKey?: string;
    fromEmail?: string;
    replyTo?: string;
    isDefault?: boolean;
    siteEmailConfigAssignments?: SiteEmailConfigAssignment[];
  };
  const snapshot = await getPlatformEmailOverviewRelational();
  if (body.action === "bind_site") {
    const configId = body.resendConfigId ?? body.configId;
    if (!body.siteId || !snapshot.sites.some((site) => site.id === body.siteId)) {
      return NextResponse.json({ error: "site_not_found" }, { status: 404 });
    }
    if (!configId || !(snapshot.platformEmailConfigs ?? []).some((config) => config.id === configId)) {
      return NextResponse.json({ error: "email_config_not_found" }, { status: 404 });
    }
    const nextAssignments = [
      ...(snapshot.siteEmailConfigAssignments ?? []).filter((assignment) => assignment.siteId !== body.siteId),
      { siteId: body.siteId, configId }
    ];
    await updatePlatformEmailSettingsRelational({
      configId,
      siteAssignments: nextAssignments,
      actor: permission.current.platformAdmin.id
    });
    return NextResponse.json(await platformEmailPayload());
  }
  const apiKey = body.apiKey?.trim();
  const fromEmail = normalizeEmail(body.fromEmail);
  const replyTo = normalizeEmail(body.replyTo);
  if (fromEmail && !fromEmail.includes("@")) return NextResponse.json({ error: "invalid_from_email" }, { status: 400 });
  if (replyTo && !replyTo.includes("@")) return NextResponse.json({ error: "invalid_reply_to" }, { status: 400 });
  if (apiKey && !normalizeResendApiKey(apiKey)) return NextResponse.json({ error: "invalid_resend_api_key_format" }, { status: 400 });
  await updatePlatformEmailSettingsRelational({
    configId: body.resendConfigId ?? body.configId,
    label: body.label,
    apiKey,
    fromEmail,
    replyTo,
    isDefault: body.isDefault,
    siteAssignments: body.siteEmailConfigAssignments,
    actor: permission.current.platformAdmin.id
  });
  return NextResponse.json(await platformEmailPayload());
}

export async function POST(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:email-test" });
  if (!permission.ok) return permission.response;
  const body = (await request.json().catch(() => ({}))) as { to?: string; siteId?: string; configId?: string; resendConfigId?: string };
  const to = body.to?.trim().toLowerCase();
  if (!to || !to.includes("@")) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const snapshot = await getPlatformEmailOverviewRelational();
  const state = {
    sites: snapshot.sites,
    siteDomains: snapshot.siteDomains,
    platformEmailSettings: snapshot.platformEmailSettings,
    platformEmailConfigs: snapshot.platformEmailConfigs ?? [],
    siteEmailConfigAssignments: (body.resendConfigId ?? body.configId) && body.siteId
      ? [{ siteId: body.siteId, configId: body.resendConfigId ?? body.configId ?? "" }]
      : snapshot.siteEmailConfigAssignments ?? []
  };
  const site = state.sites.find((item) => item.id === body.siteId) ?? state.sites[0];
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  const selectedSettings = resolveResendSettingsForSite(state, site.id);
  try {
    const result = await sendEmailProviderTest({ to, site, settingsContext: state });
    await writePlatformEmailTestResultRelational(site.id, {
      state: "passed",
      to,
      messageId: result.messageId,
      configId: selectedSettings.id,
      configLabel: selectedSettings.label,
      testedAt: new Date().toISOString(),
      testedBy: permission.current.platformAdmin.id
    });
    return NextResponse.json({ ok: true, messageId: result.messageId, siteId: site.id });
  } catch (error) {
    const details = providerErrorDetails(error);
    await writePlatformEmailTestResultRelational(site.id, {
      state: "failed",
      to,
      configId: selectedSettings.id,
      configLabel: selectedSettings.label,
      testedAt: new Date().toISOString(),
      testedBy: permission.current.platformAdmin.id,
      error: details.error,
      providerStatus: details.providerStatus,
      providerMessage: details.providerMessage
    });
    console.error("[platform-email-test] send failed", {
      code: details.error,
      providerStatus: details.providerStatus,
      providerMessage: details.providerMessage,
      siteId: site.id,
      toDomain: domainFromEmail(to),
      fromDomain: domainFromEmail(selectedSettings.fromEmail ?? "")
    });
    return NextResponse.json(details, { status: 502 });
  }
}
