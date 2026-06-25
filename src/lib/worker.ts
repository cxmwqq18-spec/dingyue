import crypto from "crypto";
import { getPlatformAiProviderFallbackQueueRelational, type PlatformAiProviderFallbackQueue } from "@/lib/stores/platform-store";
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

export function verifyWorkerCallbackSignature(payload: Record<string, unknown>, secret = process.env.AI_WORKER_SECRET ?? "dev-worker-secret"): boolean {
  if (typeof payload.signature !== "string") return process.env.AI_WORKER_REQUIRE_SIGNATURE !== "1";
  const expected = signWorkerCallback(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function buildWorkerPayload(params: {
  job: GenerationJob;
  siteAiApp: SiteAiApp;
  baseUrl: string;
  secret?: string;
}): Promise<WorkerPayload> {
  const requestId = `req_${params.job.id}`;
  const secret = params.secret ?? process.env.AI_WORKER_SECRET ?? "dev-worker-secret";
  const unsigned: Omit<WorkerPayload, "signature"> = {
    jobId: params.job.id,
    siteId: params.job.siteId,
    customerId: params.job.customerId,
    aiApp: params.siteAiApp.aiApp.slug,
    routeKey: params.siteAiApp.routeKey,
    workflow: params.job.requestJson.flowSnapshot,
    prompt: params.job.requestJson.prompt,
    inputAssets: [{ assetId: "asset_demo", signedUrl: `${params.baseUrl}/api/demo-assets/input.jpg` }],
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
