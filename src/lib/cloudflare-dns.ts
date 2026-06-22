import "server-only";
import type { PlatformCloudflareAccount } from "@/lib/types";

export type CloudflareDnsRecordInput = {
  type: "TXT" | "MX" | "CNAME";
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
};

export type CloudflareZone = {
  id: string;
  name: string;
  status?: string;
};

export type CloudflareDnsChange = CloudflareDnsRecordInput & {
  id?: string;
  created: boolean;
  skipped: boolean;
};

function smokeMockEnabled(): boolean {
  return process.env.SMOKE_PROVIDER_MOCK === "1" || process.env.SMOKE_CLOUDFLARE_DNS === "1";
}

export function maskCloudflareToken(token?: string): string {
  const value = token?.trim() ?? "";
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

export function cloudflareAccountStatus(account?: PlatformCloudflareAccount) {
  return {
    configured: Boolean(account?.accountId?.trim() && account?.apiToken?.trim()),
    accountIdConfigured: Boolean(account?.accountId?.trim()),
    apiTokenConfigured: Boolean(account?.apiToken?.trim()),
    apiTokenPreview: maskCloudflareToken(account?.apiToken),
    label: account?.label ?? "",
    email: account?.email ?? "",
    accountId: account?.accountId ?? "",
    updatedAt: account?.updatedAt,
    updatedBy: account?.updatedBy
  };
}

function requireCloudflareAccount(account?: PlatformCloudflareAccount): PlatformCloudflareAccount {
  if (!account?.apiToken?.trim()) throw new Error("missing_cloudflare_api_token");
  if (!account.accountId?.trim()) throw new Error("missing_cloudflare_account_id");
  return account;
}

async function cloudflareFetch<T>(account: PlatformCloudflareAccount, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${account.apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => ({}))) as { success?: boolean; result?: T; errors?: Array<{ code?: number; message?: string }> };
  if (!response.ok || payload.success === false) {
    if (response.status === 429) throw new Error("cloudflare_rate_limited");
    throw new Error(payload.errors?.[0]?.message || "cloudflare_api_failed");
  }
  return payload.result as T;
}

function zoneCandidates(domain: string): string[] {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  const candidates: string[] = [];
  for (let index = 0; index < labels.length - 1; index += 1) {
    candidates.push(labels.slice(index).join("."));
  }
  return candidates;
}

export async function findCloudflareZoneForDomain(params: {
  account?: PlatformCloudflareAccount;
  domain: string;
}): Promise<CloudflareZone> {
  const account = requireCloudflareAccount(params.account);
  if (smokeMockEnabled()) {
    const name = zoneCandidates(params.domain).at(-1) || params.domain;
    return { id: "smoke_cf_zone", name, status: "active" };
  }
  for (const candidate of zoneCandidates(params.domain)) {
    const result = await cloudflareFetch<CloudflareZone[]>(account, `/zones?account.id=${encodeURIComponent(account.accountId)}&name=${encodeURIComponent(candidate)}&per_page=1`);
    const zone = result[0];
    if (zone) return zone;
  }
  throw new Error("cloudflare_zone_not_found");
}

function normalizeRecordName(name: string, zoneName: string): string {
  const clean = name.trim().replace(/\.$/, "").toLowerCase();
  const zone = zoneName.trim().replace(/\.$/, "").toLowerCase();
  if (clean === "@" || clean === zone) return zone;
  if (clean.endsWith(`.${zone}`)) return clean;
  return `${clean}.${zone}`;
}

export async function upsertCloudflareDnsRecord(params: {
  account?: PlatformCloudflareAccount;
  zone: CloudflareZone;
  record: CloudflareDnsRecordInput;
}): Promise<CloudflareDnsChange> {
  const account = requireCloudflareAccount(params.account);
  const name = normalizeRecordName(params.record.name, params.zone.name);
  const record = {
    ...params.record,
    name,
    ttl: params.record.ttl ?? 1,
    proxied: false
  };
  if (smokeMockEnabled()) {
    return { ...record, id: `smoke_${record.type.toLowerCase()}_${name}`, created: true, skipped: false };
  }
  const existing = await cloudflareFetch<Array<{ id: string; type: string; name: string; content: string }>>(
    account,
    `/zones/${params.zone.id}/dns_records?type=${encodeURIComponent(record.type)}&name=${encodeURIComponent(name)}&per_page=100`
  );
  const exact = existing.find((item) => item.content === record.content);
  if (exact) return { ...record, id: exact.id, created: false, skipped: true };
  const created = await cloudflareFetch<{ id: string }>(account, `/zones/${params.zone.id}/dns_records`, {
    method: "POST",
    body: JSON.stringify(record)
  });
  return { ...record, id: created.id, created: true, skipped: false };
}

export async function publishDnsRecordsToCloudflare(params: {
  account?: PlatformCloudflareAccount;
  domain: string;
  records: CloudflareDnsRecordInput[];
}): Promise<{ zone: CloudflareZone; changes: CloudflareDnsChange[] }> {
  const zone = await findCloudflareZoneForDomain({ account: params.account, domain: params.domain });
  const changes = [];
  for (const record of params.records) {
    changes.push(await upsertCloudflareDnsRecord({ account: params.account, zone, record }));
  }
  return { zone, changes };
}
