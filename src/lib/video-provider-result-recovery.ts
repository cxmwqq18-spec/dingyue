import "server-only";
import {
  customerAssetStorageKey,
  extensionForCustomerAssetMime,
  writeCustomerAssetFileShared
} from "@/lib/customer-asset-storage";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import {
  HUITU_OPENAPI_PROVIDER_CURRENCY,
  downloadHuituOpenApiVideoTaskFile,
  fetchHuituOpenApiVideoTask
} from "@/lib/huitu-openapi-video";
import { fetchTokengoMediaVideoTask } from "@/lib/tokengo-media-video";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { settleGenerationJobRelational } from "@/lib/stores/job-store";
import { getPlatformAiProviderRelational, listPlatformAiProvidersRelational } from "@/lib/stores/platform-store";
import { isHuituOpenApiBaseUrl, isTokengoMediaBaseUrl, type VideoProviderProtocol } from "@/lib/video-provider-family";
import type { PlatformAiProvider } from "@/lib/types";

type VideoStatusResponse = {
  data?: VideoStatusResponse | null;
  id?: string | number;
  task_id?: string | number;
  state?: string;
  status?: string;
  status_group?: string;
  is_final?: boolean;
  progress?: string | number;
  result_url?: string;
  video_url?: string;
  videoUrl?: string;
  url?: string;
  video?: { url?: string; duration?: number };
  result?: { url?: string; result_url?: string; video_url?: string; videos?: Array<{ url?: string; result_url?: string; video_url?: string }>; images?: Array<{ url?: string; result_url?: string }> };
  output?: { url?: string; result_url?: string; video_url?: string } | Array<{ url?: string; result_url?: string; video_url?: string }>;
  error?: unknown;
  message?: string;
  cost?: number;
  creditCost?: number;
};

type RecoveryProvider = Pick<PlatformAiProvider, "id" | "label" | "aiUrl" | "apiKey" | "modelType">;

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}

function isLk888MediaBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "api.lk888.ai" || hostname === "api.lk666.ai" || hostname === "api.lingkeai.ai";
  } catch {
    return false;
  }
}

function isProxyOpenAiVideoBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname.includes("smartpicklid") || hostname.includes("magic666") || hostname === "apis.2ken.com";
  } catch {
    return false;
  }
}

function videoProviderProtocol(baseUrl: string): VideoProviderProtocol {
  if (isHuituOpenApiBaseUrl(baseUrl)) return "huitu-openapi";
  if (isTokengoMediaBaseUrl(baseUrl)) return "tokengo-media";
  if (isProxyOpenAiVideoBaseUrl(baseUrl)) return "openai-videos";
  if (isLk888MediaBaseUrl(baseUrl)) return "lk888-media";
  return "lk888-media";
}

function openAiVideoStatusEndpoint(baseUrl: string, taskId: string) {
  return `${normalizeBaseUrl(baseUrl)}/v1/videos/${encodeURIComponent(taskId)}`;
}

function openAiVideoContentEndpoint(baseUrl: string, taskId: string) {
  return `${openAiVideoStatusEndpoint(baseUrl, taskId)}/content`;
}

function lk888MediaStatusUrls(baseUrl: string, taskId: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl).replace(/\/api$/, "");
  const primary = new URL(`${normalizedBaseUrl}/v1/skills/task-status`);
  primary.searchParams.set("task_id", taskId);
  const legacy = new URL(`${normalizedBaseUrl}/v1/media/status`);
  legacy.searchParams.set("task_id", taskId);
  return [primary.toString(), legacy.toString()];
}

function normalizeVideoStatusResponse(body: VideoStatusResponse): VideoStatusResponse {
  const data = recordValue(body.data);
  if (!data) return body;
  return {
    ...body,
    ...data,
    error: body.error ?? data.error,
    message: body.message ?? (typeof data.message === "string" ? data.message : undefined)
  } as VideoStatusResponse;
}

function videoStatusText(status: VideoStatusResponse) {
  return [
    textValue(status.status),
    textValue(status.state),
    textValue(status.status_group)
  ].find(Boolean)?.toLowerCase() ?? "";
}

function videoStatusFailed(status: VideoStatusResponse) {
  const value = videoStatusText(status);
  return value === "failed" || value === "cancelled" || value === "canceled";
}

function videoStatusComplete(status: VideoStatusResponse) {
  const value = videoStatusText(status);
  return value === "completed" || value === "succeeded" || value === "done" || value === "success" || status.is_final === true;
}

function isTerminalRecoveryStatusError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.startsWith("video_recovery_task_failed_") ||
    error.message.startsWith("video_recovery_task_not_complete_");
}

function videoStatusResultUrl(status: VideoStatusResponse) {
  const video = recordValue(status.video);
  const result = recordValue(status.result);
  const output = Array.isArray(status.output)
    ? recordValue(status.output[0])
    : recordValue(status.output);
  const resultVideos = Array.isArray(result?.videos) ? result?.videos : undefined;
  const resultImages = Array.isArray(result?.images) ? result?.images : undefined;
  const firstResultVideo = resultVideos ? recordValue(resultVideos[0]) : undefined;
  const firstResultImage = resultImages ? recordValue(resultImages[0]) : undefined;
  return textValue(status.result_url) ||
    textValue(status.video_url) ||
    textValue(status.videoUrl) ||
    textValue(status.url) ||
    textValue(video?.url) ||
    textValue(result?.url) ||
    textValue(result?.result_url) ||
    textValue(result?.video_url) ||
    textValue(firstResultVideo?.url) ||
    textValue(firstResultVideo?.result_url) ||
    textValue(firstResultVideo?.video_url) ||
    textValue(firstResultImage?.url) ||
    textValue(firstResultImage?.result_url) ||
    textValue(output?.url) ||
    textValue(output?.result_url) ||
    textValue(output?.video_url);
}

function resolveProviderUrl(baseUrl: string | undefined, value: string) {
  if (!value) return "";
  try {
    return new URL(value).toString();
  } catch {
    if (!baseUrl) return "";
    return new URL(value, normalizeBaseUrl(baseUrl)).toString();
  }
}

function sanitizedRecoveryUrl(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.slice(0, 240);
  }
}

function mimeTypeFromUrl(url: string) {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".mov")) return "video/quicktime";
  if (path.endsWith(".m4v") || path.endsWith(".mp4")) return "video/mp4";
  return "";
}

function normalizedVideoMimeType(value: string, url: string) {
  const mimeType = value.split(";")[0]?.trim().toLowerCase() || "";
  if (mimeType.startsWith("video/")) return mimeType;
  return mimeTypeFromUrl(url) || "video/mp4";
}

function providerTraceLabel(resultJson: unknown) {
  const result = recordValue(resultJson);
  const trace = Array.isArray(result?.providerTrace) ? result.providerTrace : [];
  for (const entry of trace) {
    const provider = textValue(recordValue(entry)?.provider);
    if (provider) return provider;
  }
  return "";
}

function runnableVideoProvider(provider: PlatformAiProvider) {
  return provider.providerType === "video" &&
    provider.enabled !== false &&
    Boolean(provider.aiUrl?.trim()) &&
    Boolean(provider.apiKey?.trim());
}

async function resolveRecoveryProvider(params: {
  providerId?: string;
  resultJson?: unknown;
  required: boolean;
}): Promise<RecoveryProvider | undefined> {
  if (params.providerId) {
    const provider = await getPlatformAiProviderRelational(params.providerId);
    if (!provider) throw new StoreError("video_recovery_provider_not_found", 404);
    if (!provider.apiKey?.trim() || !provider.aiUrl?.trim()) throw new StoreError("video_recovery_provider_not_configured", 400);
    return provider;
  }
  const providers = await listPlatformAiProvidersRelational({ providerType: "video" });
  const traceLabel = providerTraceLabel(params.resultJson);
  const traced = traceLabel
    ? providers.find((provider) => runnableVideoProvider(provider) && (provider.id === traceLabel || provider.label === traceLabel))
    : undefined;
  const provider = traced ?? providers.find(runnableVideoProvider);
  if (!provider && params.required) throw new StoreError("video_recovery_provider_required", 400);
  return provider;
}

async function fetchOpenAiVideoStatus(params: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
}) {
  const response = await fetchWithTimeout(openAiVideoStatusEndpoint(params.baseUrl, params.taskId), {
    headers: { Authorization: `Bearer ${params.apiKey}` },
    cache: "no-store",
    timeoutMs: 45_000
  });
  const body = normalizeVideoStatusResponse((await response.json().catch(() => ({}))) as VideoStatusResponse);
  if (!response.ok) throw new StoreError(`video_recovery_status_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`, response.status || 500);
  return body;
}

async function fetchLk888VideoStatus(params: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
}) {
  let lastError: unknown;
  for (const url of lk888MediaStatusUrls(params.baseUrl, params.taskId)) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${params.apiKey}` },
        cache: "no-store",
        timeoutMs: 45_000
      });
      const body = normalizeVideoStatusResponse((await response.json().catch(() => ({}))) as VideoStatusResponse);
      if (response.ok) return body;
      lastError = new StoreError(`video_recovery_status_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`, response.status || 500);
      if (response.status !== 404 && response.status !== 405) break;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new StoreError("video_recovery_status_failed", 500);
}

async function fetchVideoTaskStatus(params: {
  provider: RecoveryProvider;
  protocol: VideoProviderProtocol;
  taskId: string;
}) {
  const baseUrl = normalizeBaseUrl(params.provider.aiUrl);
  const apiKey = params.provider.apiKey ?? "";
  if (params.protocol === "huitu-openapi") {
    const task = await fetchHuituOpenApiVideoTask({
      baseUrl,
      apiKey,
      taskId: params.taskId,
      fetchWithTimeout: (resource, init, timeoutMs) => fetchWithTimeout(resource, { ...init, timeoutMs }),
      timeoutMs: 45_000
    });
    return {
      id: task.id,
      status: task.status,
      progress: task.progress,
      error: task.error ?? undefined,
      videoUrl: task.videoUrl ?? undefined,
      creditCost: task.creditCost
    } satisfies VideoStatusResponse;
  }
  if (params.protocol === "tokengo-media") {
    const task = await fetchTokengoMediaVideoTask({
      baseUrl,
      apiKey,
      taskId: params.taskId,
      fetchWithTimeout: (resource, init, timeoutMs) => fetchWithTimeout(resource, { ...init, timeoutMs }),
      timeoutMs: 45_000
    });
    return {
      id: task.id,
      state: task.state,
      status: task.status,
      is_final: task.isFinal,
      progress: task.progress,
      error: task.error,
      message: task.message,
      result_url: task.resultUrl,
      cost: task.cost,
      creditCost: task.creditCost
    } satisfies VideoStatusResponse;
  }
  if (params.protocol === "openai-videos") {
    return fetchOpenAiVideoStatus({ baseUrl, apiKey, taskId: params.taskId });
  }
  return fetchLk888VideoStatus({ baseUrl, apiKey, taskId: params.taskId });
}

function shouldRetryDownloadWithoutAuth(url: string, provider?: RecoveryProvider) {
  if (!provider?.aiUrl) return false;
  try {
    return new URL(url).origin !== new URL(normalizeBaseUrl(provider.aiUrl)).origin;
  } catch {
    return false;
  }
}

async function downloadRecoveredVideo(params: {
  url: string;
  provider?: RecoveryProvider;
  protocol?: VideoProviderProtocol;
  taskId?: string;
}) {
  const rawAttempts: Array<Record<string, string> | undefined | null> = [
    params.provider?.apiKey ? { Authorization: `Bearer ${params.provider.apiKey}` } : undefined,
    shouldRetryDownloadWithoutAuth(params.url, params.provider) ? undefined : null
  ];
  const attempts = rawAttempts.filter((headers): headers is Record<string, string> | undefined => headers !== null);
  let lastError: unknown;
  for (const headers of attempts) {
    try {
      const response = await fetchWithTimeout(params.url, {
        ...(headers ? { headers } : {}),
        cache: "no-store",
        timeoutMs: 120_000
      });
      if (!response.ok) {
        lastError = new StoreError(`video_recovery_download_failed_${response.status}`, response.status || 500);
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new StoreError("video_recovery_download_empty", 502);
      const mimeType = normalizedVideoMimeType(response.headers.get("content-type") ?? "", params.url);
      if (!mimeType.startsWith("video/")) throw new StoreError(`video_recovery_download_not_video_${mimeType || "unknown"}`, 502);
      return { bytes, mimeType };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new StoreError("video_recovery_download_failed", 500);
}

function extractedTaskIdFromUrl(value: string) {
  const normalized = textValue(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    const videoPathMatch = url.pathname.match(/\/v1\/videos\/([^/]+)(?:\/content)?$/);
    if (videoPathMatch?.[1]) return decodeURIComponent(videoPathMatch[1]);
    const taskFileMatch = url.pathname.match(/(task_[a-zA-Z0-9_-]+)/);
    if (taskFileMatch?.[1]) return taskFileMatch[1];
  } catch {
    const taskFileMatch = normalized.match(/(task_[a-zA-Z0-9_-]+)/);
    if (taskFileMatch?.[1]) return taskFileMatch[1];
  }
  return "";
}

function existingOutputsFromResult(resultJson: unknown): Array<{ storageKey: string; mimeType?: string }> {
  const result = recordValue(resultJson);
  const outputs = Array.isArray(result?.outputs) ? result.outputs : [];
  return outputs
    .filter((output): output is Record<string, unknown> => Boolean(output) && typeof output === "object" && !Array.isArray(output))
    .map((output) => ({
      storageKey: textValue(output.storageKey),
      mimeType: textValue(output.mimeType) || undefined
    }))
    .filter((output) => output.storageKey);
}

function existingProviderTaskIdFromResult(resultJson: unknown) {
  const result = recordValue(resultJson) ?? {};
  const direct = textValue(result.providerTaskId);
  if (direct) return direct;
  const slots = Array.isArray(result.outputSlots)
    ? result.outputSlots.filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
    : [];
  for (const slot of slots) {
    const providerTaskId = textValue(slot.providerTaskId);
    if (providerTaskId) return providerTaskId;
  }
  return "";
}

export async function recoverVideoProviderOutput(params: {
  siteId: string;
  jobId: string;
  providerId?: string;
  providerTaskId?: string;
  videoUrl?: string;
}) {
  const siteId = textValue(params.siteId);
  const jobId = textValue(params.jobId);
  if (!siteId || !jobId) throw new StoreError("video_recovery_job_required", 400);
  const job = await prisma.generationJob.findFirst({ where: { id: jobId, siteId } });
  if (!job) throw new StoreError("job_not_found", 404);
  const existingOutputs = existingOutputsFromResult(job.resultJson);
  if (job.status === "succeeded" && existingOutputs.length) {
    const result = await settleGenerationJobRelational({
      jobId,
      siteId,
      requestId: `video-recovery:${jobId}`,
      status: "succeeded",
      outputs: existingOutputs
    });
    return {
      ...result,
      provider: null,
      providerTaskId: textValue(params.providerTaskId) || extractedTaskIdFromUrl(textValue(params.videoUrl)),
      storageKey: existingOutputs[0]?.storageKey,
      mimeType: existingOutputs[0]?.mimeType,
      downloadedBytes: 0,
      skipped: true
    };
  }

  const explicitVideoUrl = textValue(params.videoUrl);
  const providerTaskId = textValue(params.providerTaskId) || extractedTaskIdFromUrl(explicitVideoUrl) || existingProviderTaskIdFromResult(job.resultJson);
  if (!providerTaskId && !explicitVideoUrl) throw new StoreError("video_recovery_task_or_url_required", 400);

  const provider = await resolveRecoveryProvider({
    providerId: textValue(params.providerId) || undefined,
    resultJson: job.resultJson,
    required: Boolean(providerTaskId) || !explicitVideoUrl.startsWith("http")
  });
  const protocol = provider ? videoProviderProtocol(normalizeBaseUrl(provider.aiUrl)) : undefined;
  let status: VideoStatusResponse | undefined;
  let statusError: unknown;
  if (provider && protocol && providerTaskId) {
    try {
      status = await fetchVideoTaskStatus({ provider, protocol, taskId: providerTaskId });
      if (protocol === "tokengo-media") {
        if (status.is_final !== true) {
          throw new StoreError(`video_recovery_task_not_complete_${videoStatusText(status) || "unknown"}`, 409);
        }
        if (status.state !== "success") {
          const reason = textValue(status.error) || textValue(status.message) || videoStatusText(status) || "failed";
          throw new StoreError(`video_recovery_task_failed_${reason.slice(0, 160)}`, 409);
        }
      } else if (videoStatusFailed(status)) {
        const reason = textValue(status.error) || textValue(status.message) || videoStatusText(status) || "failed";
        throw new StoreError(`video_recovery_task_failed_${reason.slice(0, 160)}`, 409);
      } else if (!videoStatusComplete(status) && !videoStatusResultUrl(status) && !explicitVideoUrl) {
        throw new StoreError(`video_recovery_task_not_complete_${videoStatusText(status) || "unknown"}`, 409);
      }
    } catch (error) {
      statusError = error;
      if (isTerminalRecoveryStatusError(error)) throw error;
      if (!explicitVideoUrl && protocol !== "openai-videos") throw error;
    }
  }

  const baseUrl = provider ? normalizeBaseUrl(provider.aiUrl) : undefined;
  const statusResultUrl = status ? videoStatusResultUrl(status) : "";
  const providerContentUrl = provider && providerTaskId && protocol === "openai-videos"
    ? openAiVideoContentEndpoint(provider.aiUrl, providerTaskId)
    : "";
  const downloadUrl = resolveProviderUrl(baseUrl, explicitVideoUrl || providerContentUrl || statusResultUrl);
  if (!downloadUrl) throw new StoreError("video_recovery_download_url_required", 400);

  const downloaded = provider && protocol === "huitu-openapi" && providerTaskId && !explicitVideoUrl
    ? await (async () => {
        const response = await downloadHuituOpenApiVideoTaskFile({
          baseUrl: normalizeBaseUrl(provider.aiUrl),
          apiKey: provider.apiKey ?? "",
          taskId: providerTaskId,
          resultUrl: statusResultUrl,
          fetchWithTimeout: (resource, init, timeoutMs) => fetchWithTimeout(resource, { ...init, timeoutMs }),
          timeoutMs: 120_000
        });
        if (!response.ok) throw new StoreError(`video_recovery_download_failed_${response.status}`, response.status || 500);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length) throw new StoreError("video_recovery_download_empty", 502);
        return {
          bytes,
          mimeType: normalizedVideoMimeType(response.headers.get("content-type") ?? "", downloadUrl)
        };
      })()
    : await downloadRecoveredVideo({ url: downloadUrl, provider, protocol, taskId: providerTaskId });
  const storageKey = customerAssetStorageKey({
    siteId: job.siteId,
    customerId: job.customerId,
    fileName: `${job.id}-video-1.${extensionForCustomerAssetMime(downloaded.mimeType)}`
  });
  const stored = await writeCustomerAssetFileShared({
    storageKey,
    bytes: downloaded.bytes,
    mimeType: downloaded.mimeType,
    purpose: "output"
  });
  const recoveredAt = new Date().toISOString();
  const settled = await settleGenerationJobRelational({
    jobId,
    siteId,
    requestId: `video-recovery:${jobId}`,
    status: "succeeded",
    outputs: [{ storageKey, mimeType: downloaded.mimeType }],
    outputSlots: [{
      index: 1,
      status: "succeeded",
      stage: "video_result_received",
      progress: 100,
      storageKey,
      mimeType: downloaded.mimeType,
      error: "",
      providerTaskId: providerTaskId || undefined,
      updatedAt: recoveredAt
    }],
    providerTrace: provider ? [{ provider: provider.label || provider.id, attempts: 0 }] : [],
    costTrace: status ? {
      estimatedCostUsd: 0,
      providerCreditCost: typeof status.creditCost === "number" ? status.creditCost : undefined,
      providerCurrency: provider && protocol === "huitu-openapi" && typeof status.creditCost === "number" ? HUITU_OPENAPI_PROVIDER_CURRENCY : undefined
    } : { estimatedCostUsd: 0 },
    timing: {
      recoveredAt,
      downloadedAt: recoveredAt,
      storedAt: recoveredAt,
      ...(statusError instanceof Error ? { recoveryStatusError: statusError.message.slice(0, 240) } : {})
    },
    recovery: {
      source: "video_provider_result_recovery",
      providerTaskId: providerTaskId || undefined,
      resultUrl: sanitizedRecoveryUrl(downloadUrl),
      recoveredAt
    }
  });
  return {
    ...settled,
    provider: provider ? { id: provider.id, label: provider.label, protocol } : null,
    providerTaskId,
    storageKey,
    mimeType: downloaded.mimeType,
    downloadedBytes: downloaded.bytes.length,
    stored,
    skipped: false
  };
}
