export type HuituOpenApiTask = {
  id: string;
  status?: string;
  progress?: number;
  error?: string | null;
  videoUrl?: string | null;
  duration?: number;
  aspectRatio?: string;
  creditCost?: number;
};

export type HuituFetchWithTimeout = (
  resource: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutError: string
) => Promise<Response>;

export const HUITU_OPENAPI_PROVIDER_CURRENCY = "huitu_credit";

const huituOpenApiAspectRatios = new Set(["1:1", "3:4", "4:3", "9:16", "16:9", "21:9"]);

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function huituOpenApiVideoDuration(duration: unknown) {
  const normalized = Number(duration);
  return normalized === 6 || normalized === 10 || normalized === 15 ? String(normalized) : "6";
}

export function huituOpenApiVideoRatio(aspectRatio: unknown) {
  const normalized = typeof aspectRatio === "string" ? aspectRatio.trim() : "";
  return huituOpenApiAspectRatios.has(normalized) ? normalized : "9:16";
}

export function huituClientRequestId(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return normalized || `video_${Date.now().toString(36)}`;
}

export function resolveHuituVideoUrl(baseUrl: string, resultUrl?: string | null) {
  if (!resultUrl) return "";
  try {
    return new URL(resultUrl, baseUrl).toString();
  } catch {
    return resultUrl;
  }
}

export function huituVideoTaskFromBody(body: unknown): HuituOpenApiTask | undefined {
  const record = recordValue(body);
  if (!record) return undefined;
  const data = recordValue(record.data);
  const source = data ?? record;
  const id = textValue(source.id) || textValue(record.id);
  if (!id) return undefined;
  return {
    id,
    status: textValue(source.status) || undefined,
    progress: numberValue(source.progress),
    error: typeof source.error === "string" || source.error === null ? source.error : undefined,
    videoUrl: typeof source.videoUrl === "string" || source.videoUrl === null
      ? source.videoUrl
      : typeof source.video_url === "string" || source.video_url === null
        ? source.video_url
        : undefined,
    duration: numberValue(source.duration),
    aspectRatio: textValue(source.aspectRatio) || undefined,
    creditCost: numberValue(source.creditCost)
  };
}

export async function createHuituOpenApiVideoTask(params: {
  baseUrl: string;
  apiKey: string;
  prompt: string;
  imageUrls: string[];
  duration: string;
  ratio: string;
  clientRequestId: string;
  fetchWithTimeout: HuituFetchWithTimeout;
  timeoutMs: number;
}) {
  if (!params.imageUrls.length) throw new Error("ai_provider_video_reference_required_huitu");
  const endpoint = `${params.baseUrl}/openapi/v1/videos`;
  const form = new FormData();
  form.append("prompt", params.prompt);
  form.append("duration", huituOpenApiVideoDuration(params.duration));
  form.append("ratio", huituOpenApiVideoRatio(params.ratio));
  form.append("client_request_id", huituClientRequestId(params.clientRequestId));
  for (const imageUrl of params.imageUrls) {
    form.append(params.imageUrls.length > 1 ? "image_urls" : "image_url", imageUrl);
  }
  const response = await params.fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`
    },
    body: form,
    cache: "no-store"
  }, params.timeoutMs, `ai_provider_video_create_timeout_${params.timeoutMs}`);
  const body = (await response.json().catch(() => ({}))) as unknown;
  const task = huituVideoTaskFromBody(body);
  if (!response.ok || !task) {
    const errorPrefix = response.status === 402 ? "ai_provider_huitu_insufficient_credits" : "ai_provider_video_create_failed";
    throw new Error(`${errorPrefix}_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
  }
  return task;
}

export async function fetchHuituOpenApiVideoTask(params: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  fetchWithTimeout: HuituFetchWithTimeout;
  timeoutMs: number;
}) {
  const endpoint = `${params.baseUrl}/openapi/v1/videos/${encodeURIComponent(params.taskId)}`;
  const response = await params.fetchWithTimeout(endpoint, {
    headers: { Authorization: `Bearer ${params.apiKey}` },
    cache: "no-store"
  }, params.timeoutMs, "ai_provider_video_status_timeout");
  const body = (await response.json().catch(() => ({}))) as unknown;
  const task = huituVideoTaskFromBody(body);
  if (!response.ok || !task) {
    throw new Error(`ai_provider_video_status_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
  }
  return task;
}

export async function downloadHuituOpenApiVideoTaskFile(params: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  resultUrl?: string;
  fetchWithTimeout: HuituFetchWithTimeout;
  timeoutMs: number;
}) {
  const endpoint = resolveHuituVideoUrl(params.baseUrl, params.resultUrl) ||
    `${params.baseUrl}/openapi/v1/videos/${encodeURIComponent(params.taskId)}/file`;
  return params.fetchWithTimeout(endpoint, {
    headers: { Authorization: `Bearer ${params.apiKey}` },
    cache: "no-store"
  }, params.timeoutMs, "ai_provider_video_download_timeout");
}
