import crypto from "crypto";
import { getPlatformAiProviderFallbackQueue } from "@/lib/server-store";
import type { GenerationJob, SiteAiApp } from "./types";

export interface WorkerPayload {
  jobId: string;
  siteId: string;
  customerId: string;
  aiApp: string;
  inputAssets: Array<{ assetId: string; signedUrl: string }>;
  params: Record<string, unknown>;
  aiProviderFallback: {
    strategy: "preferred_then_priority";
    providers: Array<{
      id: string;
      label: string;
      aiUrl: string;
      modelType: string;
      priority: number;
      preferred: boolean;
    }>;
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
  status: "succeeded" | "failed";
  outputs?: Array<{ storageKey: string; mimeType?: string }>;
  providerTrace?: Array<{ provider: string; attempts: number }>;
  costTrace?: { estimatedCostUsd?: number };
  error?: string;
}

export function signWorkerPayload(unsigned: Omit<WorkerPayload, "signature">, secret: string): string {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(unsigned)).digest("hex");
}

export function buildWorkerPayload(params: {
  job: GenerationJob;
  siteAiApp: SiteAiApp;
  baseUrl: string;
  secret?: string;
}): WorkerPayload {
  const requestId = `req_${params.job.id}`;
  const unsigned: Omit<WorkerPayload, "signature"> = {
    jobId: params.job.id,
    siteId: params.job.siteId,
    customerId: params.job.customerId,
    aiApp: params.siteAiApp.aiApp.slug,
    inputAssets: [{ assetId: "asset_demo", signedUrl: `${params.baseUrl}/api/demo-assets/input.jpg` }],
    params: params.job.requestJson,
    aiProviderFallback: {
      strategy: "preferred_then_priority",
      providers: getPlatformAiProviderFallbackQueue()
    },
    callbackUrl: `${params.baseUrl}/api/internal/ai-worker/jobs/${params.job.id}/result`,
    statusCallbackUrl: `${params.baseUrl}/api/internal/ai-worker/jobs/${params.job.id}/status`,
    requestId
  };
  return {
    ...unsigned,
    signature: signWorkerPayload(unsigned, params.secret ?? "dev-worker-secret")
  };
}
