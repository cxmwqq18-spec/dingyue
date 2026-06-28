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

export interface WorkerResultPayload {
  jobId: string;
  siteId: string;
  requestId: string;
  signature?: string;
  status: "succeeded" | "failed";
  outputs?: Array<{ storageKey: string; mimeType?: string }>;
  providerTrace?: Array<{ provider: string; attempts: number }>;
  costTrace?: { estimatedCostUsd?: number };
  error?: string;
}

export function signWorkerPayload(unsigned: Omit<WorkerPayload, "signature">, secret: string): string {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(unsigned)).digest("hex");
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

function requestedAssetIds(job: GenerationJob): string[] {
  const value = job.requestJson.assetIds;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

async function buildInputAssets(params: { job: GenerationJob; baseUrl: string }): Promise<Array<{ assetId: string; signedUrl: string }>> {
  const baseUrl = params.baseUrl.replace(/\/$/, "");
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
        signedUrl: `${baseUrl}/api/sites/${params.job.siteId}/customers/${params.job.customerId}/assets/${result.asset.id}/download?worker=1&expiresAt=${encodeURIComponent(expiresAt)}&signature=${signature}`
      };
    })
  );
  return assets.length ? assets : [{ assetId: "asset_demo", signedUrl: `${baseUrl}/api/demo-assets/input.jpg` }];
}

export async function buildWorkerPayload(params: {
  job: GenerationJob;
  siteAiApp: SiteAiApp;
  baseUrl: string;
  secret?: string;
}): Promise<WorkerPayload> {
  const requestId = `req_${params.job.id}`;
  const secret = params.secret ?? process.env.AI_WORKER_SECRET ?? "dev-worker-secret";
  const inputAssets = await buildInputAssets({ job: params.job, baseUrl: params.baseUrl });
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
    callbackUrl: `${params.baseUrl}/api/internal/ai-worker/jobs/${params.job.id}/result`,
    statusCallbackUrl: `${params.baseUrl}/api/internal/ai-worker/jobs/${params.job.id}/status`,
    requestId
  };
  return {
    ...unsigned,
    signature: signWorkerPayload(unsigned, secret)
  };
}

export async function dispatchWorkerPayload(payload: WorkerPayload): Promise<WorkerDispatchResult> {
  const endpoint = process.env.AI_WORKER_DISPATCH_URL?.trim();
  if (!endpoint) return { status: "skipped" };
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
