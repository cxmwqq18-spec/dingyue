import crypto from "crypto";
import { getPlatformAiProviderFallbackQueueRelational, type PlatformAiProviderFallbackQueue } from "@/lib/stores/platform-store";
import { getCustomerAssetRelational } from "@/lib/stores/asset-store";
import type { GenerationJob, SiteAiApp } from "./types";

export interface WorkerPayload {
  jobId: string;
  siteId: string;
  customerId: string;
  aiApp: string;
  routeKey: string;
  workflow?: unknown;
  prompt?: unknown;
  inputAssets: Array<{ assetId: string; signedUrl: string }>;
  params: Record<string, unknown>;
  providerSelection?: unknown;
  aiProviderFallback: {
    strategy: "preferred_then_priority";
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
  outputs?: Array<{ storageKey: string; mimeType?: string }>;
  providerTrace?: Array<{ provider: string; attempts: number }>;
  costTrace?: { estimatedCostUsd?: number; providerErrors?: Array<{ provider: string; error: string }> };
  error?: string;
}

export type WorkerOutputSlotStatus = "queued" | "running" | "succeeded" | "failed";

export interface WorkerOutputSlot {
  index: number;
  status: WorkerOutputSlotStatus;
  stage?: string;
  storageKey?: string;
  mimeType?: string;
  error?: string;
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

export function resolveWorkerDispatchEndpoint(payload: Pick<WorkerPayload, "callbackUrl">): string {
  const configuredEndpoint = process.env.AI_WORKER_DISPATCH_URL?.trim();
  if (configuredEndpoint) return configuredEndpoint;
  return shouldUseLocalWorkerDispatch()
    ? new URL("/api/internal/ai-worker/dispatch", payload.callbackUrl).toString()
    : "";
}

export function resolveWorkerBaseUrls(publicBaseUrl: string): WorkerBaseUrls {
  const normalizedPublicBaseUrl = publicBaseUrl.replace(/\/$/, "");
  const configuredEndpoint = process.env.AI_WORKER_DISPATCH_URL?.trim();
  if (!configuredEndpoint) return { publicBaseUrl: normalizedPublicBaseUrl };
  try {
    const endpoint = new URL(configuredEndpoint);
    if (isLoopbackHost(endpoint.hostname)) {
      return {
        publicBaseUrl: normalizedPublicBaseUrl,
        callbackBaseUrl: endpoint.origin
      };
    }
  } catch {
    return { publicBaseUrl: normalizedPublicBaseUrl };
  }
  return { publicBaseUrl: normalizedPublicBaseUrl };
}

function requestedAssetIds(job: GenerationJob): string[] {
  const value = job.requestJson.assetIds;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

async function buildInputAssets(params: { job: GenerationJob; assetBaseUrl: string }): Promise<Array<{ assetId: string; signedUrl: string }>> {
  const assetBaseUrl = params.assetBaseUrl.replace(/\/$/, "");
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
      return {
        assetId: result.asset.id,
        signedUrl: `${assetBaseUrl}/api/sites/${params.job.siteId}/customers/${params.job.customerId}/assets/${result.asset.id}/download?worker=1&expiresAt=${encodeURIComponent(expiresAt)}&signature=${signature}`
      };
    })
  );
  return assets.length ? assets : [{ assetId: "asset_demo", signedUrl: `${assetBaseUrl}/api/demo-assets/input.jpg` }];
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
  const callbackBaseUrl = (baseUrls.callbackBaseUrl ?? baseUrls.publicBaseUrl).replace(/\/$/, "");
  const inputAssets = await buildInputAssets({ job: params.job, assetBaseUrl: callbackBaseUrl });
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
      strategy: "preferred_then_priority",
      providers: await getPlatformAiProviderFallbackQueueRelational()
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
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AI-Worker-Signature": payload.signature,
        "X-AI-Worker-Request-Id": payload.requestId
      },
      body: JSON.stringify(payload),
      cache: "no-store"
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
