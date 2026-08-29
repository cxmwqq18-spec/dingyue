import type { VideoPromptPersonaId } from "@/lib/video-prompt-personas";
import type { VideoPromptOptimizationResult } from "@/lib/video-prompt-optimizer";

export type VideoPromptOptimizationRequestBody = {
  customerId: string;
  prompt: string;
  personaId: VideoPromptPersonaId;
  locale: "en" | "es";
  videoThemeId: string;
  frameAssetIds: string[];
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
};

type VideoPromptOptimizationJob = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result?: VideoPromptOptimizationResult;
  error?: { message?: string };
};

export class VideoPromptOptimizationClientError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status = 0, retryAfter?: number) {
    super(message);
    this.name = "VideoPromptOptimizationClientError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function isCsrfError(error: string | undefined, status: number) {
  return status === 403 && (error === "csrf_token_required" || error === "csrf_token_mismatch" || Boolean(error?.includes("csrf")));
}

function isOptimizationResult(value: unknown): value is VideoPromptOptimizationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<VideoPromptOptimizationResult>;
  return typeof result.optimizedPrompt === "string" && result.optimizedPrompt.trim().length > 0 &&
    (result.locale === "en" || result.locale === "es") &&
    typeof result.personaId === "string" &&
    typeof result.sourceHash === "string" &&
    typeof result.optimizerVersion === "string";
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function requestVideoPromptOptimization(params: {
  siteId: string;
  body: VideoPromptOptimizationRequestBody;
  idempotencyKey: string;
  headers: HeadersInit | (() => HeadersInit);
  refreshCsrf?: () => Promise<void>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<VideoPromptOptimizationResult> {
  const fetcher = params.fetcher ?? fetch;
  const timeoutMs = Math.max(1, params.timeoutMs ?? 30_000);
  const pollIntervalMs = Math.max(0, params.pollIntervalMs ?? 500);
  const deadline = Date.now() + timeoutMs;
  const url = `/api/sites/${params.siteId}/ai/video-prompt-optimizations`;
  const requestHeaders = () => {
    const headers = new Headers(typeof params.headers === "function" ? params.headers() : params.headers);
    headers.set("Idempotency-Key", params.idempotencyKey);
    return headers;
  };
  const requestSignal = () => AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline - Date.now())));
  const post = () => fetcher(url, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(params.body),
    signal: requestSignal()
  });
  const postWithNetworkRetry = async () => {
    try {
      return await post();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await delay(Math.min(250, Math.max(0, deadline - Date.now())));
      return post();
    }
  };

  let response = await postWithNetworkRetry();
  let payload = await response.json().catch(() => ({})) as {
    error?: string;
    retryAfter?: number;
    jobId?: string;
    job?: VideoPromptOptimizationJob;
  };
  if (isCsrfError(payload.error, response.status) && params.refreshCsrf) {
    await params.refreshCsrf();
    response = await postWithNetworkRetry();
    payload = await response.json().catch(() => ({})) as typeof payload;
  }
  if (!response.ok || !payload.jobId) {
    throw new VideoPromptOptimizationClientError(
      payload.error ?? "video_prompt_optimization_create_failed",
      response.status,
      payload.retryAfter
    );
  }

  let job = payload.job;
  while (Date.now() < deadline) {
    if (job?.status === "succeeded") {
      if (!isOptimizationResult(job.result) || job.result.locale !== params.body.locale || job.result.personaId !== params.body.personaId) {
        throw new VideoPromptOptimizationClientError("video_prompt_optimization_invalid_result");
      }
      return job.result;
    }
    if (job?.status === "failed") {
      throw new VideoPromptOptimizationClientError(job.error?.message ?? "video_prompt_optimization_failed");
    }
    await delay(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    if (Date.now() >= deadline) break;
    const pollResponse = await fetcher(`${url}/${payload.jobId}`, { cache: "no-store", signal: requestSignal() });
    const pollPayload = await pollResponse.json().catch(() => ({})) as { error?: string; job?: VideoPromptOptimizationJob };
    if (!pollResponse.ok || !pollPayload.job) {
      throw new VideoPromptOptimizationClientError(
        pollPayload.error ?? "video_prompt_optimization_poll_failed",
        pollResponse.status
      );
    }
    job = pollPayload.job;
  }
  throw new VideoPromptOptimizationClientError("video_prompt_optimization_timeout");
}
