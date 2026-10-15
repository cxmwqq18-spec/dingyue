import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCustomerAssetsRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError, type SceneId, type TaskInput } from "./types";
import { defaultTaskInput, sceneSchema } from "./catalogs";
import { validateTaskInput } from "./pipeline";

export const DEVELOPER_SCOPES = ["read", "write"] as const;
export type DeveloperScope = typeof DEVELOPER_SCOPES[number];
export const DEVELOPER_KEY_PREFIX = "adk_live_";
// The window counter lives on the Aidreamcapes key row and advances atomically in SQL across app instances.
const KEY_RATE_WINDOW_MS = 60_000;
const KEY_RATE_MAX = 120;

type DeveloperKeyRow = {
  id: string;
  siteId: string;
  customerId: string;
  name: string;
  scopes: unknown;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
};

export function hashDeveloperSecret(secret: string): string {
  return createHash("sha256").update(`aidreamcapes-developer-key-v1\0${secret}`).digest("hex");
}

export function createDeveloperSecret() {
  const secret = `${DEVELOPER_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { secret, secretHash: hashDeveloperSecret(secret) };
}

export function normalizeDeveloperScopes(value: unknown): DeveloperScope[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > DEVELOPER_SCOPES.length ||
      value.some((scope) => !DEVELOPER_SCOPES.includes(scope as DeveloperScope))) {
    throw new WorkspaceError("developer_key_scopes_invalid");
  }
  return [...new Set(value as DeveloperScope[])].sort();
}

export function assertDeveloperScope(scopes: unknown, required: DeveloperScope): void {
  if (!Array.isArray(scopes) || !scopes.includes(required)) throw new WorkspaceError("developer_key_scope_required", 403);
}

export function isDeveloperKeyActive(row: { expiresAt?: Date | string | null; revokedAt?: Date | string | null }, now = Date.now()): boolean {
  if (row.revokedAt) return false;
  if (row.expiresAt && Date.parse(String(row.expiresAt)) <= now) return false;
  return true;
}

export function assertAidreamcapesOwner(siteId: string, customerSiteId: string): void {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
  if (customerSiteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("customer_site_mismatch", 403);
}

export function parseDeveloperKeyExpiry(value: unknown, now = Date.now()): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new WorkspaceError("developer_key_expiry_invalid");
  const expiresAt = new Date(value);
  const timestamp = expiresAt.getTime();
  if (!Number.isFinite(timestamp) || timestamp <= now || timestamp > now + 366 * 24 * 60 * 60 * 1000) {
    throw new WorkspaceError("developer_key_expiry_invalid");
  }
  return expiresAt;
}

export function developerIdempotencyKey(apiKeyId: string, value: string): string {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(value)) throw new WorkspaceError("idempotency_key_required");
  return `developer:${apiKeyId}:${value}`;
}

export function parseDeveloperTaskInput(sceneId: SceneId, value: unknown): TaskInput {
  if (value === undefined) return defaultTaskInput(sceneId);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkspaceError("invalid_input");
  const raw = value as Record<string, unknown>;
  if (!raw.images || typeof raw.images !== "object" || Array.isArray(raw.images) || !raw.fields || typeof raw.fields !== "object" || Array.isArray(raw.fields) || !raw.options || typeof raw.options !== "object" || Array.isArray(raw.options)) {
    throw new WorkspaceError("invalid_input");
  }
  const images: TaskInput["images"] = {};
  for (const [key, urls] of Object.entries(raw.images)) {
    if (!Array.isArray(urls) || urls.length > 8 || urls.some((url) => typeof url !== "string" || url.length > 2048)) throw new WorkspaceError("invalid_images");
    images[key] = urls as string[];
  }
  const fields: TaskInput["fields"] = {};
  for (const [key, field] of Object.entries(raw.fields)) {
    if (typeof field === "string" && field.length <= 4000) fields[key] = field;
    else if (Array.isArray(field) && field.length <= 30 && field.every((item) => typeof item === "string" && item.length <= 200)) fields[key] = field as string[];
    else throw new WorkspaceError("invalid_field");
  }
  const options = raw.options as Record<string, unknown>;
  const input: TaskInput = {
    images, fields,
    options: {
      duration: options.duration as TaskInput["options"]["duration"],
      aspect: options.aspect as TaskInput["options"]["aspect"],
      style: typeof options.style === "string" ? options.style : "",
      language: options.language as TaskInput["options"]["language"],
      subtitle: options.subtitle as boolean,
      subtitleStyle: options.subtitleStyle as TaskInput["options"]["subtitleStyle"]
    }
  };
  if (options.subtitleStyle === undefined) input.options.subtitleStyle = "classic";
  for (const field of ["actorId", "modelId"] as const) {
    if (raw[field] !== undefined) {
      if (typeof raw[field] !== "string" || raw[field].length > 2048) throw new WorkspaceError("invalid_input");
      input[field] = raw[field];
    }
  }
  if (raw.musicUrl !== undefined) {
    if (typeof raw.musicUrl !== "string" || raw.musicUrl.length > 2048) throw new WorkspaceError("invalid_music_url");
    input.musicUrl = raw.musicUrl;
  }
  if (input.actorId) throw new WorkspaceError("developer_api_actor_selection_unsupported", 400);
  const schema = sceneSchema(sceneId);
  validateTaskInput(schema.id, input, [], false);
  return input;
}

export async function assertDeveloperDraftAssets(siteId: string, customerId: string, input: TaskInput): Promise<void> {
  assertAidreamcapesOwner(siteId, AIVIDEOSUGC_SITE_ID);
  const { assets } = await getCustomerAssetsRelational({ siteId: AIVIDEOSUGC_SITE_ID, customerId });
  const allowedImageUrls = new Set(assets.map((asset) => toThemeRuntimeAssetRelational(asset).previewUrl));
  const imageUrls = Object.values(input.images).flat();
  if (imageUrls.some((url) => !allowedImageUrls.has(url))) throw new WorkspaceError("asset_not_owned", 403);
  if (input.musicUrl) {
    const match = new RegExp(`^/api/sites/${AIVIDEOSUGC_SITE_ID}/customers/${customerId}/assets/([a-zA-Z0-9_-]+)/download(?:\\?.*)?$`).exec(input.musicUrl);
    const asset = match ? assets.find((entry) => entry.id === match[1]) : undefined;
    if (!asset || asset.subjectRole !== "aivideosugc_music" || !["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"].includes(asset.mimeType)) {
      throw new WorkspaceError("music_asset_not_owned", 403);
    }
  }
}

export async function createDeveloperKey(siteId: string, customerId: string, nameValue: unknown, scopeValue: unknown, expiryValue?: unknown) {
  assertAidreamcapesOwner(siteId, AIVIDEOSUGC_SITE_ID);
  if (typeof nameValue !== "string" || !nameValue.trim() || nameValue.trim().length > 80) throw new WorkspaceError("developer_key_name_invalid");
  const name = nameValue.trim();
  const scopes = normalizeDeveloperScopes(scopeValue);
  const expiresAt = parseDeveloperKeyExpiry(expiryValue);
  const { secret, secretHash } = createDeveloperSecret();
  const id = randomUUID();
  const rows = await prisma.$queryRaw<DeveloperKeyRow[]>`
    INSERT INTO "AidreamcapesDeveloperApiKey" ("id", "siteId", "customerId", "name", "secretHash", "scopes", "expiresAt")
    SELECT ${id}, ${AIVIDEOSUGC_SITE_ID}, ${customerId}, ${name}, ${secretHash}, ${JSON.stringify(scopes)}::jsonb, ${expiresAt}
    FROM "Customer" WHERE "id" = ${customerId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID}
    RETURNING "id", "siteId", "customerId", "name", "scopes", "createdAt", "expiresAt", "revokedAt", "lastUsedAt"
  `;
  if (!rows[0]) throw new WorkspaceError("customer_site_mismatch", 403);
  return { key: rows[0], oneTimeSecret: secret };
}

export async function listDeveloperKeys(siteId: string, customerId: string) {
  assertAidreamcapesOwner(siteId, AIVIDEOSUGC_SITE_ID);
  return prisma.$queryRaw<Omit<DeveloperKeyRow, "siteId" | "customerId">[]>`
    SELECT "id", "name", "scopes", "createdAt", "expiresAt", "revokedAt", "lastUsedAt"
    FROM "AidreamcapesDeveloperApiKey"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}
    ORDER BY "createdAt" DESC LIMIT 100
  `;
}

export async function revokeDeveloperKey(siteId: string, customerId: string, keyId: string): Promise<void> {
  assertAidreamcapesOwner(siteId, AIVIDEOSUGC_SITE_ID);
  const count = await prisma.$executeRaw`
    UPDATE "AidreamcapesDeveloperApiKey" SET "revokedAt" = now()
    WHERE "id" = ${keyId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "revokedAt" IS NULL
  `;
  if (!count) throw new WorkspaceError("developer_key_not_found", 404);
}

export async function authenticateDeveloperKey(request: Request, siteId: string, requiredScope: DeveloperScope) {
  assertAidreamcapesOwner(siteId, AIVIDEOSUGC_SITE_ID);
  const match = /^Bearer\s+(adk_live_[A-Za-z0-9_-]{43})$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) throw new WorkspaceError("developer_key_invalid", 401);
  const hash = hashDeveloperSecret(match[1]);
  const rows = await prisma.$queryRaw<(DeveloperKeyRow & { ownerSiteId: string })[]>`
    SELECT k."id", k."siteId", k."customerId", k."name", k."scopes", k."createdAt", k."expiresAt", k."revokedAt", k."lastUsedAt", c."siteId" AS "ownerSiteId"
    FROM "AidreamcapesDeveloperApiKey" k
    JOIN "Customer" c ON c."id" = k."customerId" AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE k."siteId" = ${AIVIDEOSUGC_SITE_ID} AND k."secretHash" = ${hash}
    LIMIT 1
  `;
  const key = rows[0];
  if (!key || !isDeveloperKeyActive(key)) throw new WorkspaceError("developer_key_invalid", 401);
  assertAidreamcapesOwner(siteId, key.ownerSiteId);
  assertDeveloperScope(key.scopes, requiredScope);
  const usage = await prisma.$queryRaw<{ rateLimitCount: number; rateLimitWindowAt: Date }[]>`
    UPDATE "AidreamcapesDeveloperApiKey"
    SET "lastUsedAt" = now(),
      "rateLimitWindowAt" = CASE WHEN "rateLimitWindowAt" IS NULL OR "rateLimitWindowAt" <= now() - interval '60 seconds' THEN now() ELSE "rateLimitWindowAt" END,
      "rateLimitCount" = CASE WHEN "rateLimitWindowAt" IS NULL OR "rateLimitWindowAt" <= now() - interval '60 seconds' THEN 1 ELSE "rateLimitCount" + 1 END
    WHERE "id" = ${key.id} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${key.customerId} AND "revokedAt" IS NULL
      AND ("expiresAt" IS NULL OR "expiresAt" > now())
    RETURNING "rateLimitCount", "rateLimitWindowAt"
  `;
  const usageRow = usage[0];
  if (!usageRow) throw new WorkspaceError("developer_key_invalid", 401);
  if (usageRow.rateLimitCount > KEY_RATE_MAX) {
    const retryAfterMs = Math.max(1, new Date(usageRow.rateLimitWindowAt).getTime() + KEY_RATE_WINDOW_MS - Date.now());
    throw new WorkspaceError("developer_key_rate_limited", 429, { retryAfterMs, limit: KEY_RATE_MAX, windowMs: KEY_RATE_WINDOW_MS });
  }
  return { id: key.id, siteId: AIVIDEOSUGC_SITE_ID, customerId: key.customerId, scopes: key.scopes as DeveloperScope[] };
}
