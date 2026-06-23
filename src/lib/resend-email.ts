import "server-only";
import type { PlatformEmailConfig, Site } from "@/lib/types";

type CloudflareDnsRecordInput = {
  type: "MX" | "TXT" | "CNAME";
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
};

type PlatformEmailSettings = {
  provider: "resend";
  apiKey?: string;
  fromEmail?: string;
  replyTo?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type ResendSettingsContext = {
  platformEmailSettings?: PlatformEmailSettings;
  platformEmailConfigs?: PlatformEmailConfig[];
  siteEmailConfigAssignments?: Array<{ siteId: string; configId: string }>;
};

type ResendErrorPayload = {
  message?: string;
  error?: string;
  name?: string;
};

export class ResendProviderError extends Error {
  code: string;
  status: number;
  providerMessage: string;
  providerName?: string;

  constructor(params: { code: string; status: number; providerMessage?: string; providerName?: string }) {
    super(params.code);
    this.name = "ResendProviderError";
    this.code = params.code;
    this.status = params.status;
    this.providerMessage = params.providerMessage ?? "";
    this.providerName = params.providerName;
  }
}

export interface SendVerificationEmailParams {
  to: string;
  code: string;
  purpose: "register" | "password_reset";
  site: Pick<Site, "id" | "name" | "branding">;
  settings?: PlatformEmailSettings;
  settingsContext?: ResendSettingsContext;
}

export type ResendDnsRecord = {
  record?: string;
  type: "MX" | "TXT" | "CNAME";
  name: string;
  value?: string;
  content?: string;
  ttl?: string | number;
  priority?: number;
  status?: string;
};

export type ResendDomainDetail = {
  id?: string;
  name?: string;
  status?: string;
  region?: string;
  records?: ResendDnsRecord[];
};

export function normalizeResendApiKey(value?: string | null): string | undefined {
  const key = value?.trim();
  if (!key) return undefined;
  if (!key.startsWith("re_")) return undefined;
  if (key.includes("...")) return undefined;
  if (key.length < 30) return undefined;
  return key;
}

export function normalizePlatformEmailConfig(config: Partial<PlatformEmailConfig> & { id?: string }, fallback?: PlatformEmailSettings): PlatformEmailConfig {
  const id = config.id?.trim() || "resend_default";
  return {
    id,
    label: config.label?.trim() || (id === "resend_default" ? "Default Resend" : id),
    provider: "resend",
    apiKey: normalizeResendApiKey(config.apiKey) ?? normalizeResendApiKey(fallback?.apiKey),
    fromEmail: config.fromEmail?.trim() || fallback?.fromEmail?.trim() || undefined,
    replyTo: config.replyTo?.trim() || fallback?.replyTo?.trim() || undefined,
    isDefault: Boolean(config.isDefault),
    updatedAt: config.updatedAt ?? fallback?.updatedAt,
    updatedBy: config.updatedBy ?? fallback?.updatedBy
  };
}

export function resolvePlatformEmailConfigs(context?: ResendSettingsContext | PlatformEmailSettings): PlatformEmailConfig[] {
  const maybeContext = context as ResendSettingsContext | undefined;
  const hasContextShape = Boolean(maybeContext && ("platformEmailSettings" in maybeContext || "platformEmailConfigs" in maybeContext || "siteEmailConfigAssignments" in maybeContext));
  const legacy = hasContextShape ? maybeContext?.platformEmailSettings : (context as PlatformEmailSettings | undefined);
  const rawConfigs = hasContextShape ? maybeContext?.platformEmailConfigs ?? [] : [];
  const configs = rawConfigs.map((config) => normalizePlatformEmailConfig(config, legacy));
  if (!configs.length) {
    configs.push(normalizePlatformEmailConfig({ id: "resend_default", label: "Default Resend", isDefault: true }, legacy));
  }
  if (!configs.some((config) => config.isDefault)) configs[0].isDefault = true;
  return configs;
}

export function resolveResendSettingsForSite(context?: ResendSettingsContext | PlatformEmailSettings, siteId?: string): PlatformEmailConfig {
  const configs = resolvePlatformEmailConfigs(context);
  const maybeContext = context as ResendSettingsContext | undefined;
  const assignment = siteId && maybeContext && "siteEmailConfigAssignments" in maybeContext
    ? maybeContext.siteEmailConfigAssignments?.find((item) => item.siteId === siteId)
    : undefined;
  return configs.find((config) => config.id === assignment?.configId) ?? configs.find((config) => config.isDefault) ?? configs[0];
}

function effectiveResendSettings(settings?: PlatformEmailSettings): Required<Pick<PlatformEmailSettings, "provider">> & Pick<PlatformEmailSettings, "apiKey" | "fromEmail" | "replyTo" | "updatedAt" | "updatedBy"> {
  return {
    provider: "resend",
    apiKey: normalizeResendApiKey(settings?.apiKey) || normalizeResendApiKey(process.env.RESEND_API_KEY),
    fromEmail: settings?.fromEmail?.trim() || process.env.RESEND_FROM_EMAIL?.trim() || undefined,
    replyTo: settings?.replyTo?.trim() || process.env.RESEND_REPLY_TO?.trim() || undefined,
    updatedAt: settings?.updatedAt,
    updatedBy: settings?.updatedBy
  };
}

function maskApiKey(apiKey: string): string {
  return apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : "";
}

function providerErrorCode(status: number, message: string): string {
  const normalized = message.toLowerCase();
  if (status === 401 || normalized.includes("api key")) return "resend_invalid_api_key";
  if (status === 429) return "resend_rate_limited";
  if (normalized.includes("only send testing emails to your own email address")) return "resend_domain_not_verified";
  if (normalized.includes("domain is not verified") || normalized.includes("verify a domain")) return "resend_domain_not_verified";
  if (normalized.includes("from") || normalized.includes("sender")) return "resend_invalid_from_email";
  return "email_send_failed";
}

function providerMessageFromPayload(payload: ResendErrorPayload): string {
  return payload.message || payload.error || payload.name || "";
}

function resendProviderError(status: number, payload: ResendErrorPayload, fallbackCode = "email_send_failed"): ResendProviderError {
  const providerMessage = providerMessageFromPayload(payload);
  const code = providerErrorCode(status, providerMessage);
  return new ResendProviderError({
    code: code === "email_send_failed" ? fallbackCode : code,
    status,
    providerMessage,
    providerName: payload.name
  });
}

function smokeResendMockEnabled(): boolean {
  return process.env.SMOKE_PROVIDER_MOCK === "1" || process.env.SMOKE_RESEND_DOMAINS === "1";
}

function requireResendApiKey(settings?: PlatformEmailSettings): string {
  const apiKey = effectiveResendSettings(settings).apiKey;
  if (!apiKey) throw new Error("missing_resend_api_key");
  return apiKey;
}

async function resendFetch<T>(settings: PlatformEmailSettings | undefined, path: string, init?: RequestInit): Promise<T> {
  const apiKey = requireResendApiKey(settings);
  const response = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => ({}))) as T & ResendErrorPayload;
  if (!response.ok) {
    if (response.status === 404) throw new ResendProviderError({ code: "resend_domain_not_found", status: response.status, providerMessage: providerMessageFromPayload(payload), providerName: payload.name });
    if (response.status === 429) throw new ResendProviderError({ code: "resend_rate_limited", status: response.status, providerMessage: providerMessageFromPayload(payload), providerName: payload.name });
    throw resendProviderError(response.status, payload, "resend_domain_api_failed");
  }
  return payload;
}

export async function sendVerificationEmail(params: SendVerificationEmailParams): Promise<{ messageId?: string }> {
  const selected = params.settingsContext ? resolveResendSettingsForSite(params.settingsContext, params.site.id) : params.settings;
  const settings = effectiveResendSettings(selected);
  const apiKey = settings.apiKey;
  const from = settings.fromEmail;
  if (!apiKey || !from) {
    throw new Error("email_provider_not_configured");
  }

  const replyTo = settings.replyTo;
  const siteName = params.site.branding.logoText || params.site.name;
  const action = params.purpose === "register" ? "complete your account registration" : "reset your password";
  const subject = params.purpose === "register" ? `${siteName} verification code` : `${siteName} password reset code`;
  const escapedCode = escapeHtml(params.code);
  const escapedSiteName = escapeHtml(siteName);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      ...(replyTo ? { reply_to: replyTo } : {}),
      text: `Your ${siteName} verification code is ${params.code}. It expires in 10 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h1 style="font-size:20px;margin:0 0 12px">${escapedSiteName} verification code</h1>
          <p>Use this code to ${escapeHtml(action)}. It expires in 10 minutes.</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:24px 0">${escapedCode}</p>
          <p>If you did not request this code, you can safely ignore this email.</p>
        </div>
      `
    })
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string } & ResendErrorPayload;
  if (!response.ok) {
    throw resendProviderError(response.status, payload);
  }
  return { messageId: payload.id };
}

export function resendEmailConfigStatus(): {
  apiKeyConfigured: boolean;
  apiKeyPreview: string;
  fromConfigured: boolean;
  fromEmail: string;
  fromDomain: string;
  replyToConfigured: boolean;
  replyTo: string;
  usingTestingSender: boolean;
  source: "platform" | "env" | "missing";
  updatedAt?: string;
  updatedBy?: string;
} {
  const settings = effectiveResendSettings();
  const apiKey = settings.apiKey ?? "";
  const from = settings.fromEmail ?? "";
  const replyTo = settings.replyTo ?? "";
  return {
    apiKeyConfigured: Boolean(apiKey),
    apiKeyPreview: maskApiKey(apiKey),
    fromConfigured: Boolean(from),
    fromEmail: from,
    fromDomain: domainFromEmail(from),
    replyToConfigured: Boolean(replyTo),
    replyTo,
    usingTestingSender: from.includes("onboarding@resend.dev"),
    source: "env"
  };
}

export function resendEmailConfigStatusForSettings(settings?: PlatformEmailSettings): ReturnType<typeof resendEmailConfigStatus> {
  const effective = effectiveResendSettings(settings);
  const apiKey = effective.apiKey ?? "";
  const from = effective.fromEmail ?? "";
  const replyTo = effective.replyTo ?? "";
  const source = settings?.apiKey || settings?.fromEmail || settings?.replyTo ? "platform" : apiKey || from || replyTo ? "env" : "missing";
  return {
    apiKeyConfigured: Boolean(apiKey),
    apiKeyPreview: maskApiKey(apiKey),
    fromConfigured: Boolean(from),
    fromEmail: from,
    fromDomain: domainFromEmail(from),
    replyToConfigured: Boolean(replyTo),
    replyTo,
    usingTestingSender: from.includes("onboarding@resend.dev"),
    source,
    updatedAt: settings?.updatedAt,
    updatedBy: settings?.updatedBy
  };
}

export function resendEmailConfigStatusForSite(context?: ResendSettingsContext | PlatformEmailSettings, siteId?: string): ReturnType<typeof resendEmailConfigStatus> & {
  configId?: string;
  configLabel?: string;
} {
  const selected = resolveResendSettingsForSite(context, siteId);
  return {
    ...resendEmailConfigStatusForSettings(selected),
    configId: selected.id,
    configLabel: selected.label
  };
}

export function domainFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const angleMatch = normalized.match(/<[^@\s<>]+@([^@\s<>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1];
  const plainMatch = normalized.match(/^[^@\s<>]+@([^@\s<>]+)$/);
  if (plainMatch?.[1]) return plainMatch[1];
  const [, domain = ""] = normalized.split("@");
  return domain.replace(/[>\s].*$/, "");
}

export function resendDomainMatchesSender(domainName: string | undefined, fromDomain: string): boolean {
  const normalizedDomain = (domainName ?? "").trim().toLowerCase();
  const normalizedFromDomain = fromDomain.trim().toLowerCase();
  return Boolean(normalizedDomain && normalizedFromDomain && normalizedDomain === normalizedFromDomain);
}

export async function listResendDomains(settings?: PlatformEmailSettings): Promise<Array<{ id?: string; name?: string; status?: string; region?: string; created_at?: string }>> {
  const apiKey = effectiveResendSettings(settings).apiKey;
  if (!apiKey) return [];
  if (smokeResendMockEnabled()) {
    return [
      { id: "resend_domain_lumen", name: "lumen.localhost", status: "pending", region: "us-east-1" },
      { id: "resend_domain_smoke", name: "smoke.example.com", status: "verified", region: "us-east-1" }
    ];
  }
  const response = await fetch("https://api.resend.com/domains", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: Array<{ id?: string; name?: string; status?: string; region?: string; created_at?: string }>;
  } & ResendErrorPayload;
  if (!response.ok) {
    if (response.status === 404) throw new ResendProviderError({ code: "resend_domain_not_found", status: response.status, providerMessage: providerMessageFromPayload(payload), providerName: payload.name });
    throw resendProviderError(response.status, payload, "resend_domain_api_failed");
  }
  return payload.data ?? [];
}

export async function createResendDomain(params: {
  domain: string;
  settings?: PlatformEmailSettings;
  region?: string;
}): Promise<ResendDomainDetail> {
  if (smokeResendMockEnabled()) return smokeResendDomain(params.domain, "pending");
  return resendFetch<ResendDomainDetail>(params.settings, "/domains", {
    method: "POST",
    body: JSON.stringify({
      name: params.domain,
      ...(params.region ? { region: params.region } : {})
    })
  });
}

export async function getResendDomain(params: {
  domainId: string;
  settings?: PlatformEmailSettings;
}): Promise<ResendDomainDetail> {
  if (smokeResendMockEnabled()) return smokeResendDomain("lumen.localhost", "pending", params.domainId);
  return resendFetch<ResendDomainDetail>(params.settings, `/domains/${encodeURIComponent(params.domainId)}`);
}

export async function findResendDomainByName(params: {
  domain: string;
  settings?: PlatformEmailSettings;
}): Promise<ResendDomainDetail | undefined> {
  const domains = await listResendDomains(params.settings);
  const domain = domains.find((item) => item.name?.toLowerCase() === params.domain.toLowerCase());
  if (!domain?.id) return undefined;
  return getResendDomain({ domainId: domain.id, settings: params.settings });
}

export async function ensureResendDomain(params: {
  domain: string;
  settings?: PlatformEmailSettings;
}): Promise<{ domain: ResendDomainDetail; created: boolean }> {
  const existing = await findResendDomainByName(params);
  if (existing) return { domain: existing, created: false };
  return { domain: await createResendDomain(params), created: true };
}

export async function verifyResendDomain(params: {
  domainId: string;
  settings?: PlatformEmailSettings;
}): Promise<ResendDomainDetail> {
  if (smokeResendMockEnabled()) return smokeResendDomain("lumen.localhost", "verified", params.domainId);
  return resendFetch<ResendDomainDetail>(params.settings, `/domains/${encodeURIComponent(params.domainId)}/verify`, {
    method: "POST"
  });
}

export function resendRecordsToCloudflare(records: ResendDnsRecord[] | undefined): CloudflareDnsRecordInput[] {
  return (records ?? []).reduce<CloudflareDnsRecordInput[]>((items, record) => {
    const content = record.value ?? record.content ?? "";
    if (!record.name || !record.type || !content) return items;
    items.push({
      type: record.type,
      name: record.name,
      content,
      ttl: typeof record.ttl === "number" ? record.ttl : 1,
      priority: record.priority,
      proxied: false
    });
    return items;
  }, []);
}

function smokeResendDomain(domain: string, status: string, id = `resend_domain_${domain.replace(/[^a-z0-9]/gi, "_")}`): ResendDomainDetail {
  return {
    id,
    name: domain,
    status,
    region: "us-east-1",
    records: [
      { type: "TXT", name: domain, value: "v=spf1 include:amazonses.com ~all", status: "pending" },
      { type: "CNAME", name: `resend._domainkey.${domain}`, value: "resend-dkim.example.net", status: "pending" },
      { type: "MX", name: `bounce.${domain}`, value: "feedback-smtp.us-east-1.amazonses.com", priority: 10, status: "pending" }
    ]
  };
}

export async function sendEmailProviderTest(params: {
  to: string;
  site: Pick<Site, "id" | "name" | "branding">;
  settings?: PlatformEmailSettings;
  settingsContext?: ResendSettingsContext;
}): Promise<{ messageId?: string }> {
  const code = "123456";
  return sendVerificationEmail({
    to: params.to,
    code,
    purpose: "register",
    site: params.site,
    settings: params.settings,
    settingsContext: params.settingsContext
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}
