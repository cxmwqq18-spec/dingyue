import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { mapSiteApiKey, relationalUid } from "@/lib/stores/prisma-mappers";
import type { SiteApiKey } from "@/lib/types";

export const defaultSiteApiKeyScopes = ["generation:create", "generation:read", "assets:write"];

function hashSiteApiKey(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function previewSiteApiKey(token: string) {
  return `${token.slice(0, 10)}...${token.slice(-4)}`;
}

function normalizeScopes(value: unknown): string[] {
  const allowed = new Set([...defaultSiteApiKeyScopes, "generation:provider_override"]);
  const scopes = Array.isArray(value) ? value : defaultSiteApiKeyScopes;
  return Array.from(new Set(scopes.filter((scope): scope is string => typeof scope === "string" && allowed.has(scope))));
}

function bearerToken(header: string | null): string {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function createSiteApiKey(params: {
  siteId: string;
  label: string;
  scopes?: unknown;
}): Promise<{ apiKey: SiteApiKey; token: string }> {
  const site = await prisma.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
  if (!site) throw new StoreError("site_not_found", 404);
  const label = params.label.trim();
  if (!label) throw new StoreError("site_api_key_label_required", 400);
  const token = `dsak_${crypto.randomBytes(32).toString("base64url")}`;
  const record = await prisma.siteApiKey.create({
    data: {
      id: relationalUid("sak"),
      siteId: params.siteId,
      label,
      keyHash: hashSiteApiKey(token),
      keyPreview: previewSiteApiKey(token),
      scopes: normalizeScopes(params.scopes),
      enabled: true
    }
  });
  return { apiKey: mapSiteApiKey(record), token };
}

export async function listSiteApiKeys(params: { siteId: string }): Promise<{ apiKeys: SiteApiKey[] }> {
  const records = await prisma.siteApiKey.findMany({
    where: { siteId: params.siteId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
  return { apiKeys: records.map(mapSiteApiKey) };
}

export async function setSiteApiKeyEnabled(params: {
  siteId: string;
  apiKeyId: string;
  enabled: boolean;
}): Promise<{ apiKey: SiteApiKey }> {
  const existing = await prisma.siteApiKey.findFirst({ where: { id: params.apiKeyId, siteId: params.siteId } });
  if (!existing) throw new StoreError("site_api_key_not_found", 404);
  const updated = await prisma.siteApiKey.update({
    where: { id: existing.id },
    data: { enabled: params.enabled }
  });
  return { apiKey: mapSiteApiKey(updated) };
}

export async function requireSiteApiKey(request: Request, params: {
  siteId: string;
  scope: string;
}): Promise<{ apiKey: SiteApiKey } | { response: Response }> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return { response: Response.json({ error: "site_api_key_required" }, { status: 401 }) };
  const keyHash = hashSiteApiKey(token);
  const record = await prisma.siteApiKey.findUnique({ where: { keyHash } });
  if (!record || record.siteId !== params.siteId || !record.enabled) {
    return { response: Response.json({ error: "site_api_key_invalid" }, { status: 401 }) };
  }
  if (!record.scopes.includes(params.scope)) {
    return { response: Response.json({ error: "site_api_key_forbidden" }, { status: 403 }) };
  }
  await prisma.siteApiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return { apiKey: mapSiteApiKey(record) };
}
