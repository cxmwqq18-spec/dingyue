import crypto from "crypto";
import { platformProviderTypeForAppType, type PlatformAiProviderType } from "@/lib/ai-provider-type";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { getPlatformAiProviderFallbackQueueRelational, getPlatformAiProviderRelational, type PlatformAiProviderFallbackQueue } from "@/lib/stores/platform-store";
import { getCustomerAssetRelational } from "@/lib/stores/asset-store";
import type { VideoProviderFailure } from "@/lib/video-provider-policy";
import type { GenerationJob, SiteAiApp } from "./types";

export interface WorkerPayload {
  jobId: string;
  siteId: string;
  customerId: string;
  aiApp: string;
  routeKey: string;
  workflow?: unknown;
  prompt?: unknown;
  inputAssets: Array<{ assetId: string; signedUrl: string; publicUrl?: string; storageKey?: string; mimeType?: string }>;
  params: Record<string, unknown>;
  providerSelection?: unknown;
  aiProviderFallback: {
    strategy: "priority_then_preferred";
    providerType: PlatformAiProviderType;
    providers: PlatformAiProviderFallbackQueue;
  };
  callbackUrl: string;
  statusCallbackUrl: string;
  requestId: string;
  signature: string;
}

export interface WorkerDispatchResult {
  status: "skipped" | "sent" | "failed";
  endpoint?: string;
  statusCode?: number;
  error?: string;
}

export type WorkerBaseUrls = {
  publicBaseUrl: string;
  callbackBaseUrl?: string;
};

export interface WorkerResultPayload {
  jobId: string;
  siteId: string;
  requestId: string;
  signature?: string;
  status: "succeeded" | "failed";
  outputs?: Array<{ storageKey: string; mimeType?: string; providerTaskId?: string }>;
  providerTrace?: Array<{ provider: string; attempts: number }>;
  costTrace?: { estimatedCostUsd?: number; providerCreditCost?: number; providerCurrency?: string; providerErrors?: Array<{ provider: string; error: string }>; providerFailure?: VideoProviderFailure; referenceFrameCount?: number; requestedReferenceFrameCount?: number; providerReferenceLimit?: number };
  providerFailure?: VideoProviderFailure;
  error?: string;
  timing?: Record<string, string>;
}

type WorkerProviderSecret = PlatformAiProviderFallbackQueue[number] & { apiKey?: string };
const workerProviderSecretCache = new Map<string, { expiresAt: number; providers: Map<string, WorkerProviderSecret> }>();

function pruneWorkerProviderSecretCache(now = Date.now()) {
  for (const [requestId, entry] of workerProviderSecretCache) {
    if (entry.expiresAt <= now) workerProviderSecretCache.delete(requestId);
  }
}

export function getCachedWorkerProviderSecret(requestId: string, providerId: string): WorkerProviderSecret | undefined {
  pruneWorkerProviderSecretCache();
  return workerProviderSecretCache.get(requestId)?.providers.get(providerId);
}

async function cacheWorkerProviderSecrets(requestId: string, providerQueue: PlatformAiProviderFallbackQueue) {
  const providers = await Promise.all(providerQueue.map(async (provider) => {
    const full = await getPlatformAiProviderRelational(provider.id);
    return full ? { ...provider, apiKey: full.apiKey } : provider;
  }));
  workerProviderSecretCache.set(requestId, {
    expiresAt: Date.now() + 1000 * 60 * 60,
    providers: new Map(providers.map((provider) => [provider.id, provider]))
  });
  pruneWorkerProviderSecretCache();
}

export type WorkerOutputSlotStatus = "queued" | "running" | "succeeded" | "failed";

export interface WorkerOutputSlot {
  index: number;
  status: WorkerOutputSlotStatus;
  stage?: string;
  progress?: number;
  storageKey?: string;
  mimeType?: string;
  error?: string;
  providerTaskId?: string;
  referenceFrameCount?: number;
  requestedReferenceFrameCount?: number;
  providerReferenceLimit?: number;
  providerReferenceSize?: string;
  providerFailure?: VideoProviderFailure;
  updatedAt?: string;
}

export function signWorkerPayload(unsigned: Omit<WorkerPayload, "signature">, secret: string): string {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(unsigned)).digest("hex");
}

export function verifyWorkerPayloadSignature(payload: WorkerPayload, secret = process.env.AI_WORKER_SECRET ?? "dev-worker-secret"): boolean {
  if (!payload.signature) return false;
  const unsigned = { ...payload };
  delete (unsigned as Partial<WorkerPayload>).signature;
  const expected = signWorkerPayload(unsigned as Omit<WorkerPayload, "signature">, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function signWorkerCallback(payload: Record<string, unknown>, secret = process.env.AI_WORKER_SECRET ?? "dev-worker-secret"): string {
  const unsigned = { ...payload };
  delete unsigned.signature;
  return crypto.createHmac("sha256", secret).update(JSON.stringify(unsigned)).digest("hex");
}

export function signWorkerAssetDownload(params: {
  siteId: string;
  customerId: string;
  assetId: string;
  expiresAt: string;
  secret?: string;
}): string {
  const secret = params.secret ?? process.env.AI_WORKER_SECRET ?? "dev-worker-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${params.siteId}:${params.customerId}:${params.assetId}:${params.expiresAt}`)
    .digest("hex");
}

export function signWorkerLocalAssetDownload(params: {
  storageKey: string;
  expiresAt: string;
  secret?: string;
}): string {
  const secret = params.secret ?? process.env.AI_WORKER_SECRET ?? "dev-worker-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${params.storageKey}:${params.expiresAt}`)
    .digest("hex");
}

export function verifyWorkerLocalAssetDownload(params: {
  storageKey: string;
  expiresAt: string;
  signature: string;
  secret?: string;
}): boolean {
  const expiresAtMs = Date.parse(params.expiresAt);
  if (!params.expiresAt || !params.signature || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;
  const expected = signWorkerLocalAssetDownload({
    storageKey: params.storageKey,
    expiresAt: params.expiresAt,
    secret: params.secret
  });
  try {
    return crypto.timingSafeEqual(Buffer.from(params.signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function verifyWorkerCallbackSignature(payload: Record<string, unknown>, secret = process.env.AI_WORKER_SECRET ?? "dev-worker-secret"): boolean {
  if (typeof payload.signature !== "string") return process.env.AI_WORKER_REQUIRE_SIGNATURE !== "1";
  const expected = signWorkerCallback(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function hasExplicitWorkerSecret() {
  const secret = process.env.AI_WORKER_SECRET?.trim();
  return Boolean(secret && secret !== "dev-worker-secret");
}

function shouldUseLocalWorkerDispatch() {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.LOCAL_AI_WORKER_ENABLED === "1" && hasExplicitWorkerSecret();
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export function isLoopbackBaseUrl(value: string): boolean {
  try {
    return isLoopbackHost(new URL(value).hostname);
  } catch {
    return true;
  }
}

function normalizedOrigin(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return "";
  try {
    return new URL(candidate).origin.replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function configuredWorkerPublicBaseUrl(): string {
  return normalizedOrigin(
    process.env.AI_WORKER_PUBLIC_BASE_URL ||
      process.env.PUBLIC_ASSET_BASE_URL ||
      process.env.CUSTOMER_ASSET_PUBLIC_BASE_URL ||
      process.env.CUSTOMER_ASSET_READ_BASE_URL ||
      process.env.NEXT_PUBLIC_CUSTOMER_ASSET_READ_BASE_URL ||
      process.env.CUSTOMER_ASSET_SHARED_BASE_URL ||
      process.env.NEXT_PUBLIC_CUSTOMER_ASSET_SHARED_BASE_URL ||
      process.env.APP_PUBLIC_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL
  );
}

export function resolveWorkerDispatchEndpoint(payload: Pick<WorkerPayload, "callbackUrl">): string {
  const configuredEndpoint = process.env.AI_WORKER_DISPATCH_URL?.trim();
  if (configuredEndpoint) return configuredEndpoint;
  return shouldUseLocalWorkerDispatch()
    ? new URL("/api/internal/ai-worker/dispatch", payload.callbackUrl).toString()
    : "";
}

export function resolveWorkerBaseUrls(publicBaseUrl: string): WorkerBaseUrls {
  const requestBaseUrl = publicBaseUrl.replace(/\/$/, "");
  const normalizedPublicBaseUrl = configuredWorkerPublicBaseUrl() || publicBaseUrl.replace(/\/$/, "");
  const configuredEndpoint = process.env.AI_WORKER_DISPATCH_URL?.trim();
  if (!configuredEndpoint) return { publicBaseUrl: normalizedPublicBaseUrl, callbackBaseUrl: requestBaseUrl };
  try {
    const endpoint = new URL(configuredEndpoint);
    if (isLoopbackHost(endpoint.hostname)) {
      return {
        publicBaseUrl: normalizedPublicBaseUrl,
        callbackBaseUrl: endpoint.origin
      };
    }
  } catch {
    return { publicBaseUrl: normalizedPublicBaseUrl, callbackBaseUrl: requestBaseUrl };
  }
  return { publicBaseUrl: normalizedPublicBaseUrl };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function isVideoWorkerJob(job: GenerationJob): boolean {
  const fields = recordValue(job.requestJson.fields);
  return job.requestJson.mode === "video" ||
    job.requestJson.outputType === "video" ||
    typeof job.requestJson.videoThemeId === "string" ||
    fields.mode === "video" ||
    fields.outputType === "video" ||
    typeof fields.videoThemeId === "string";
}

function requestedAssetIds(job: GenerationJob): string[] {
  const fields = recordValue(job.requestJson.fields);
  return Array.from(new Set([
    ...stringArray(job.requestJson.assetIds),
    ...(isVideoWorkerJob(job) ? stringArray(fields.frameAssetIds) : [])
  ]));
}

async function buildInputAssets(params: {
  job: GenerationJob;
  assetBaseUrl: string;
  publicAssetBaseUrl?: string;
}): Promise<Array<{ assetId: string; signedUrl: string; publicUrl?: string; storageKey?: string; mimeType?: string }>> {
  const assetBaseUrl = params.assetBaseUrl.replace(/\/$/, "");
  const publicAssetBaseUrl = params.publicAssetBaseUrl?.replace(/\/$/, "") || assetBaseUrl;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  const assets = await Promise.all(
    requestedAssetIds(params.job).map(async (assetId) => {
      const result = await getCustomerAssetRelational({
        siteId: params.job.siteId,
        customerId: params.job.customerId,
        assetId
      });
      const signature = signWorkerAssetDownload({
        siteId: params.job.siteId,
        customerId: params.job.customerId,
        assetId: result.asset.id,
        expiresAt
      });
      const path = `/api/sites/${params.job.siteId}/customers/${params.job.customerId}/assets/${result.asset.id}/download?worker=1&expiresAt=${encodeURIComponent(expiresAt)}&signature=${signature}`;
      return {
        assetId: result.asset.id,
        signedUrl: `${assetBaseUrl}${path}`,
        publicUrl: `${publicAssetBaseUrl}${path}`,
        storageKey: result.asset.storageKey,
        mimeType: result.asset.mimeType
      };
    })
  );
  if (assets.length) return assets;
  if (isVideoWorkerJob(params.job)) return [];
  return [{
    assetId: "asset_demo",
    signedUrl: `${assetBaseUrl}/api/demo-assets/input.jpg`,
    publicUrl: `${publicAssetBaseUrl}/api/demo-assets/input.jpg`
  }];
}

export async function buildWorkerPayload(params: {
  job: GenerationJob;
  siteAiApp: SiteAiApp;
  baseUrl?: string;
  baseUrls?: WorkerBaseUrls;
  secret?: string;
}): Promise<WorkerPayload> {
  const requestId = `req_${params.job.id}`;
  const secret = params.secret ?? process.env.AI_WORKER_SECRET ?? "dev-worker-secret";
  const baseUrls = params.baseUrls ?? resolveWorkerBaseUrls(params.baseUrl ?? "");
  const publicBaseUrl = baseUrls.publicBaseUrl.replace(/\/$/, "");
  const callbackBaseUrl = (baseUrls.callbackBaseUrl ?? baseUrls.publicBaseUrl).replace(/\/$/, "");
  const inputAssets = await buildInputAssets({
    job: params.job,
    assetBaseUrl: callbackBaseUrl,
    publicAssetBaseUrl: publicBaseUrl
  });
  const providerType = isVideoWorkerJob(params.job)
    ? "video"
    : platformProviderTypeForAppType(params.siteAiApp.aiApp.appType);
  const providerQueue = await getPlatformAiProviderFallbackQueueRelational(providerType);
  await cacheWorkerProviderSecrets(requestId, providerQueue);
  const unsigned: Omit<WorkerPayload, "signature"> = {
    jobId: params.job.id,
    siteId: params.job.siteId,
    customerId: params.job.customerId,
    aiApp: params.siteAiApp.aiApp.slug,
    routeKey: params.siteAiApp.routeKey,
    workflow: params.job.requestJson.flowSnapshot,
    prompt: params.job.requestJson.prompt,
    inputAssets,
    params: params.job.requestJson,
    providerSelection: params.job.requestJson.providerSelection,
    aiProviderFallback: {
      strategy: "priority_then_preferred",
      providerType,
      providers: providerQueue
    },
    callbackUrl: `${callbackBaseUrl}/api/internal/ai-worker/jobs/${params.job.id}/result`,
    statusCallbackUrl: `${callbackBaseUrl}/api/internal/ai-worker/jobs/${params.job.id}/status`,
    requestId
  };
  return {
    ...unsigned,
    signature: signWorkerPayload(unsigned, secret)
  };
}

export async function dispatchWorkerPayload(payload: WorkerPayload): Promise<WorkerDispatchResult> {
  const endpoint = resolveWorkerDispatchEndpoint(payload);
  if (!endpoint) return { status: "skipped", error: "worker_dispatch_not_configured" };
  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AI-Worker-Signature": payload.signature,
        "X-AI-Worker-Request-Id": payload.requestId
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      timeoutMs: Number(process.env.AI_WORKER_DISPATCH_TIMEOUT_MS ?? 10_000)
    });
    return {
      status: response.ok ? "sent" : "failed",
      endpoint,
      statusCode: response.status,
      error: response.ok ? undefined : (await response.text().catch(() => "")).slice(0, 300) || "worker_dispatch_failed"
    };
  } catch (error) {
    return {
      status: "failed",
      endpoint,
      error: error instanceof Error ? error.message : "worker_dispatch_failed"
    };
  }
}
