import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError } from "./types";

export const WEBHOOK_EVENTS = ["task.created"] as const;
export type WebhookEvent = typeof WEBHOOK_EVENTS[number];
export const MAX_WEBHOOK_ATTEMPTS = 5;
const WEBHOOK_DELIVERY_FEATURE_FLAG = "AIDREAMCAPES_WEBHOOK_DELIVERY_ENABLED";

export interface ResolvedWebhookTarget {
  url: URL;
  addresses: { address: string; family: number }[];
}
export type WebhookDnsResolver = (hostname: string) => Promise<{ address: string; family: number }[]>;
export type WebhookTransport = (target: ResolvedWebhookTarget, body: string, headers: Record<string, string>) => Promise<{ status: number }>;

type SubscriptionRow = {
  id: string;
  siteId: string;
  customerId: string;
  endpointUrl: string;
  events: unknown;
  createdAt: Date;
  updatedAt: Date;
  disabledAt: Date | null;
};
type DeliveryRow = {
  id: string;
  siteId: string;
  customerId: string;
  subscriptionId: string;
  eventKey: string;
  eventType: string;
  payload: unknown;
  attemptCount: number;
  endpointUrl: string;
  secretCiphertext: string;
};

export function normalizeWebhookUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length > 2048) throw new WorkspaceError("webhook_target_invalid");
  let url: URL;
  try { url = new URL(value); } catch { throw new WorkspaceError("webhook_target_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port && url.port !== "443" || !url.hostname || url.hostname.endsWith(".") || url.hostname.includes("%")) {
    throw new WorkspaceError("webhook_target_invalid");
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local")) throw new WorkspaceError("webhook_target_private", 400);
  const family = isIP(url.hostname.replace(/^\[|\]$/g, ""));
  if (family && !isPublicIpAddress(url.hostname.replace(/^\[|\]$/g, ""))) throw new WorkspaceError("webhook_target_private", 400);
  return url;
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split(".").map(Number);
    const [a, b, c] = parts;
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 168 || (b === 0 && c <= 2) || (b === 88 && c === 99))) ||
        (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)) || (a === 203 && b === 0 && c === 113)) ||
        (a === 100 && b >= 64 && b <= 127)) return false;
    return true;
  }
  if (family !== 6) return false;
  const normalized = address.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) return isPublicIpAddress(mapped[1]);
  const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16);
  // Restrict IPv6 delivery to global unicast space and exclude known transition/documentation ranges.
  if (firstHextet < 0x2000 || firstHextet > 0x3fff || normalized.startsWith("2001:db8:") || normalized.startsWith("2001:0:") || normalized.startsWith("2002:")) return false;
  return true;
}

const defaultWebhookDnsResolver: WebhookDnsResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family }));
};

export async function resolvePublicWebhookTarget(value: unknown, resolver: WebhookDnsResolver = defaultWebhookDnsResolver): Promise<ResolvedWebhookTarget> {
  const url = normalizeWebhookUrl(value);
  const literalAddress = url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(literalAddress);
  const addresses = literalFamily ? [{ address: literalAddress, family: literalFamily }] : await resolver(url.hostname);
  if (!addresses.length || addresses.some((entry) => !isPublicIpAddress(entry.address))) throw new WorkspaceError("webhook_target_private", 400);
  return { url, addresses: addresses.map((entry) => ({ address: entry.address, family: entry.family })) };
}

function encryptionKey(masterKey = process.env.AIDREAMCAPES_WEBHOOK_ENCRYPTION_KEY): Buffer {
  if (typeof masterKey !== "string" || Buffer.byteLength(masterKey) < 32) throw new WorkspaceError("webhook_encryption_not_configured", 503);
  return createHash("sha256").update(`aidreamcapes-webhook-secret-v1\0${masterKey}`).digest();
}

export function encryptWebhookSecret(secret: string, masterKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(masterKey), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptWebhookSecret(ciphertext: string, masterKey?: string): string {
  const [ivValue, tagValue, dataValue] = ciphertext.split(".");
  if (!ivValue || !tagValue || !dataValue) throw new WorkspaceError("webhook_secret_unavailable", 503);
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(masterKey), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new WorkspaceError("webhook_secret_unavailable", 503);
  }
}

export function createWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function signedWebhookRequest(args: { secret: string; eventType: string; deliveryId: string; body: string; timestamp?: number }) {
  const timestamp = Math.floor((args.timestamp ?? Date.now()) / 1000);
  const signature = createHmac("sha256", args.secret).update(`${timestamp}.${args.body}`).digest("hex");
  return {
    body: args.body,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Aidreamcapes-Webhooks/1",
      "X-Aidreamcapes-Event": args.eventType,
      "X-Aidreamcapes-Delivery": args.deliveryId,
      "X-Aidreamcapes-Timestamp": String(timestamp),
      "X-Aidreamcapes-Signature": `t=${timestamp},v1=${signature}`
    }
  };
}

export function webhookRetryDelayMs(nextAttempt: number): number {
  return [30_000, 120_000, 600_000, 1_800_000][nextAttempt - 1] ?? 0;
}

export async function createWebhookSubscription(siteId: string, customerId: string, endpointValue: unknown, eventValue: unknown) {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
  if (!Array.isArray(eventValue) || eventValue.length < 1 || eventValue.some((event) => !WEBHOOK_EVENTS.includes(event as WebhookEvent))) {
    throw new WorkspaceError("webhook_events_invalid");
  }
  const events = [...new Set(eventValue as WebhookEvent[])];
  const target = await resolvePublicWebhookTarget(endpointValue);
  const endpointUrl = target.url.toString();
  const oneTimeSecret = createWebhookSecret();
  const secretCiphertext = encryptWebhookSecret(oneTimeSecret);
  const id = randomUUID();
  const rows = await prisma.$queryRaw<SubscriptionRow[]>`
    INSERT INTO "AidreamcapesWebhookSubscription" ("id", "siteId", "customerId", "endpointUrl", "events", "secretCiphertext")
    SELECT ${id}, ${AIVIDEOSUGC_SITE_ID}, ${customerId}, ${endpointUrl}, ${JSON.stringify(events)}::jsonb, ${secretCiphertext}
    FROM "Customer" WHERE "id" = ${customerId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID}
    RETURNING "id", "siteId", "customerId", "endpointUrl", "events", "createdAt", "updatedAt", "disabledAt"
  `;
  if (!rows[0]) throw new WorkspaceError("customer_site_mismatch", 403);
  return { subscription: rows[0], oneTimeSecret };
}

export async function listWebhookSubscriptions(siteId: string, customerId: string) {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
  return prisma.$queryRaw<Omit<SubscriptionRow, "siteId" | "customerId">[]>`
    SELECT "id", "endpointUrl", "events", "createdAt", "updatedAt", "disabledAt"
    FROM "AidreamcapesWebhookSubscription"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}
    ORDER BY "createdAt" DESC LIMIT 100
  `;
}

export async function disableWebhookSubscription(siteId: string, customerId: string, subscriptionId: string) {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
  const count = await prisma.$executeRaw`
    UPDATE "AidreamcapesWebhookSubscription" SET "disabledAt" = now(), "updatedAt" = now()
    WHERE "id" = ${subscriptionId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "disabledAt" IS NULL
  `;
  if (!count) throw new WorkspaceError("webhook_subscription_not_found", 404);
}

export async function enqueueTaskCreatedWebhook(siteId: string, customerId: string, task: { taskId: string; title: string; status: string; revision: number; createdAt: string }) {
  if (siteId !== AIVIDEOSUGC_SITE_ID || task.status !== "draft") throw new WorkspaceError("workspace_site_not_found", 404);
  const subscriptions = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "AidreamcapesWebhookSubscription"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "disabledAt" IS NULL AND "events" @> '["task.created"]'::jsonb
    ORDER BY "createdAt" ASC LIMIT 100
  `;
  const eventKey = `task:${task.taskId}:created`;
  const payload = { id: `evt_${createHash("sha256").update(`${siteId}:${customerId}:${eventKey}`).digest("hex")}`, type: "task.created", createdAt: task.createdAt,
    data: { taskId: task.taskId, title: task.title, status: task.status, revision: task.revision } };
  for (const subscription of subscriptions) {
    await prisma.$executeRaw`
      INSERT INTO "AidreamcapesWebhookDelivery" ("id", "siteId", "customerId", "subscriptionId", "eventKey", "eventType", "payload")
      SELECT ${randomUUID()}, ${AIVIDEOSUGC_SITE_ID}, ${customerId}, s."id", ${eventKey}, 'task.created', ${JSON.stringify(payload)}::jsonb
      FROM "AidreamcapesWebhookSubscription" s
      JOIN "Customer" c ON c."id" = s."customerId" AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
      WHERE s."id" = ${subscription.id} AND s."siteId" = ${AIVIDEOSUGC_SITE_ID} AND s."customerId" = ${customerId} AND s."disabledAt" IS NULL
      ON CONFLICT ("subscriptionId", "eventKey") DO NOTHING
    `;
  }
}

async function productionWebhookTransport(target: ResolvedWebhookTarget, body: string, headers: Record<string, string>) {
  if (Buffer.byteLength(body) > 64 * 1024) throw new WorkspaceError("webhook_payload_too_large", 413);
  const pinned = target.addresses[0];
  return new Promise<{ status: number }>((resolve, reject) => {
    const request = httpsRequest(target.url, {
      method: "POST",
      headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) },
      timeout: 5_000,
      maxHeaderSize: 8 * 1024,
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family)
    }, (response) => {
      const status = response.statusCode ?? 0;
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 4096) response.destroy();
      });
      response.on("end", () => resolve({ status }));
      response.on("close", () => resolve({ status }));
      response.on("error", () => resolve({ status }));
      response.resume();
    });
    request.on("timeout", () => request.destroy(new Error("webhook_timeout")));
    request.on("error", reject);
    request.end(body);
  });
}

function deliveryFailureCode(error: unknown): string {
  if (error instanceof WorkspaceError) return error.code;
  return "webhook_transport_failed";
}

export async function deliverWebhookAttempt(args: {
  endpointUrl: string;
  secret: string;
  eventType: string;
  deliveryId: string;
  payload: unknown;
  transport: WebhookTransport;
  resolveDns?: WebhookDnsResolver;
  now?: number;
}): Promise<{ status: number }> {
  if (!WEBHOOK_EVENTS.includes(args.eventType as WebhookEvent)) throw new WorkspaceError("webhook_event_invalid");
  const target = await resolvePublicWebhookTarget(args.endpointUrl, args.resolveDns);
  const signed = signedWebhookRequest({ secret: args.secret, eventType: args.eventType, deliveryId: args.deliveryId, body: JSON.stringify(args.payload), timestamp: args.now });
  return args.transport(target, signed.body, signed.headers);
}

export async function processDueWebhookDeliveries(siteId: string, customerId: string, options: {
  transport?: WebhookTransport;
  resolveDns?: WebhookDnsResolver;
  now?: Date;
  limit?: number;
} = {}) {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
  if (!options.transport && process.env[WEBHOOK_DELIVERY_FEATURE_FLAG] !== "true") return { processed: 0, delivered: 0, retried: 0, failed: 0, disabled: true };
  const transport = options.transport ?? productionWebhookTransport;
  const now = options.now ?? new Date();
  const rows = await prisma.$queryRaw<DeliveryRow[]>`
    SELECT d."id", d."siteId", d."customerId", d."subscriptionId", d."eventKey", d."eventType", d."payload", d."attemptCount", s."endpointUrl", s."secretCiphertext"
    FROM "AidreamcapesWebhookDelivery" d
    JOIN "AidreamcapesWebhookSubscription" s ON s."id" = d."subscriptionId" AND s."siteId" = d."siteId" AND s."customerId" = d."customerId"
    JOIN "Customer" c ON c."id" = d."customerId" AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE d."siteId" = ${AIVIDEOSUGC_SITE_ID} AND d."customerId" = ${customerId} AND d."status" = 'pending'
      AND d."nextAttemptAt" <= ${now} AND s."disabledAt" IS NULL
    ORDER BY d."nextAttemptAt" ASC LIMIT ${Math.min(20, Math.max(1, options.limit ?? 10))}
  `;
  let delivered = 0, retried = 0, failed = 0;
  for (const row of rows) {
    const nextAttempt = row.attemptCount + 1;
    let statusCode: number | null = null;
    let errorCode: string | null = null;
    let success = false;
    let retryable = true;
    try {
      const result = await deliverWebhookAttempt({ endpointUrl: row.endpointUrl, secret: decryptWebhookSecret(row.secretCiphertext), eventType: row.eventType,
        deliveryId: row.id, payload: row.payload, transport, resolveDns: options.resolveDns, now: now.getTime() });
      statusCode = result.status;
      success = statusCode >= 200 && statusCode < 300;
      retryable = statusCode === 429 || statusCode >= 500;
      if (!success) errorCode = statusCode >= 300 && statusCode < 400 ? "webhook_redirect_rejected" : "webhook_response_not_success";
    } catch (error) {
      errorCode = deliveryFailureCode(error);
      retryable = !(error instanceof WorkspaceError && ["webhook_target_invalid", "webhook_target_private", "webhook_event_invalid", "webhook_secret_unavailable"].includes(error.code));
    }
    const exhausted = !success && (!retryable || nextAttempt >= MAX_WEBHOOK_ATTEMPTS);
    const state = success ? "delivered" : exhausted ? "failed" : "pending";
    const nextAttemptAt = state === "pending" ? new Date(now.getTime() + webhookRetryDelayMs(nextAttempt)) : now;
    const deliveredAt = success ? now : null;
    const count = await prisma.$executeRaw`
      UPDATE "AidreamcapesWebhookDelivery" SET "attemptCount" = ${nextAttempt}, "status" = ${state}, "nextAttemptAt" = ${nextAttemptAt},
        "lastStatusCode" = ${statusCode}, "lastError" = ${errorCode}, "deliveredAt" = ${deliveredAt}
      WHERE "id" = ${row.id} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "subscriptionId" = ${row.subscriptionId}
        AND "status" = 'pending' AND "attemptCount" = ${row.attemptCount}
    `;
    if (count) {
      if (success) delivered += 1;
      else if (state === "failed") failed += 1;
      else retried += 1;
    }
  }
  return { processed: delivered + retried + failed, delivered, retried, failed, disabled: false };
}
