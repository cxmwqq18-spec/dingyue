export type TokengoMediaVideoTask = {
  id: string;
  state?: string;
  status?: string;
  isFinal?: boolean;
  progress?: number;
  error?: string;
  message?: string;
  resultUrl?: string;
  cost?: number;
  creditCost?: number;
};

export type TokengoFetchWithTimeout = (
  resource: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutError: string
) => Promise<Response>;

type TokengoVideoParams = {
  aspect_ratio: string;
  duration: string;
  resolution?: string;
  count?: number;
};

type TokengoScheduleStrategy = "balanced" | "cost_first" | "reliability_first";

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

function boolValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function tokengoMediaScheduleStrategy(): TokengoScheduleStrategy {
  const configured = process.env.TOKENGO_MEDIA_SCHEDULE_STRATEGY?.trim();
  if (configured === "balanced" || configured === "cost_first" || configured === "reliability_first") return configured;
  return "reliability_first";
}

function tokengoMediaHeaders(apiKey: string, contentType?: string) {
  return {
    ...(contentType ? { "Content-Type": contentType } : {}),
    Authorization: `Bearer ${apiKey}`,
    "X-Schedule-Strategy": tokengoMediaScheduleStrategy()
  };
}

export function normalizeTokengoMediaBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}

export function tokengoMediaGenerateUrl(baseUrl: string) {
  return `${normalizeTokengoMediaBaseUrl(baseUrl)}/v1/media/generate`;
}

export function tokengoMediaTaskStatusUrl(baseUrl: string, taskId: string) {
  const url = new URL(`${normalizeTokengoMediaBaseUrl(baseUrl)}/v1/skills/task-status`);
  url.searchParams.set("task_id", taskId);
  return url.toString();
}

export function resolveTokengoMediaResultUrl(baseUrl: string, resultUrl?: string) {
  const value = resultUrl?.trim() ?? "";
  if (!value) return "";
  try {
    return new URL(value, `${normalizeTokengoMediaBaseUrl(baseUrl)}/`).toString();
  } catch {
    return value;
  }
}

export function tokengoMediaTaskIdFromBody(body: unknown) {
  const record = recordValue(body);
  const data = recordValue(record?.data);
  const task = recordValue(data?.task);
  const taskId = record?.task_id ??
    record?.taskId ??
    record?.request_id ??
    record?.id ??
    data?.task_id ??
    data?.taskId ??
    data?.request_id ??
    data?.id ??
    task?.id;
  return typeof taskId === "number" || typeof taskId === "string" ? String(taskId) : "";
}

export function tokengoMediaResultUrlFromBody(body: unknown): string {
  const record = recordValue(body);
  if (!record) return "";
  const data = recordValue(record.data);
  const source = data ? { ...record, ...data } : record;
  const video = recordValue(source.video);
  const result = recordValue(source.result);
  const output = Array.isArray(source.output)
    ? recordValue(source.output[0])
    : recordValue(source.output);
  const resultVideos = Array.isArray(result?.videos) ? result?.videos : undefined;
  const resultImages = Array.isArray(result?.images) ? result?.images : undefined;
  const firstResultVideo = resultVideos ? recordValue(resultVideos[0]) : undefined;
  const firstResultImage = resultImages ? recordValue(resultImages[0]) : undefined;
  return textValue(source.result_url) ||
    textValue(source.video_url) ||
    textValue(source.videoUrl) ||
    textValue(source.url) ||
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

function tokengoMediaModeForImages(imageUrls: string[], endImageUrl?: string) {
  if (endImageUrl?.trim()) return "first-last";
  if (imageUrls.length > 1) return "reference";
  if (imageUrls.length === 1) return "first-frame";
  return "text-to-video";
}

function tokengoMediaModelSupportsMode(model?: string) {
  const normalized = model?.trim().toLowerCase() ?? "";
  return normalized === "grok-imagine-video" ||
    normalized === "grok-imagine-video-special" ||
    normalized === "grok-video-3" ||
    normalized.startsWith("seedance-") ||
    normalized.startsWith("kling-") ||
    normalized.startsWith("pixverse-") ||
    normalized.startsWith("veo-");
}

function isTokengoMediaSeedanceSpecialModel(model?: string) {
  return model?.trim().toLowerCase() === "seedance-2-0-special";
}

function tokengoMediaModelSupportsResolution(model?: string) {
  return model?.trim().toLowerCase() === "grok-imagine-1.5";
}

export function tokengoMediaVideoParams(videoParams: TokengoVideoParams, imageUrls: string[], endImageUrl?: string, model?: string) {
  const seedanceSpecial = isTokengoMediaSeedanceSpecialModel(model);
  const duration = seedanceSpecial ? 15 : numberValue(videoParams.duration) ?? 6;
  return {
    aspect_ratio: videoParams.aspect_ratio,
    duration,
    ...(seedanceSpecial
      ? { resolution: "720p", quality: "标准", count: 1 }
      : {}),
    ...(!seedanceSpecial && tokengoMediaModelSupportsResolution(model) && videoParams.resolution
      ? { resolution: videoParams.resolution }
      : {}),
    ...(!seedanceSpecial && tokengoMediaModelSupportsResolution(model)
      ? { count: videoParams.count ?? 1 }
      : {}),
    ...(imageUrls.length ? { images: imageUrls } : {}),
    ...(endImageUrl?.trim() ? { end_image_url: endImageUrl.trim() } : {}),
    ...(tokengoMediaModelSupportsMode(model) ? { mode: tokengoMediaModeForImages(imageUrls, endImageUrl) } : {})
  };
}

function errorCodeFromBody(body: unknown) {
  const record = recordValue(body);
  const error = recordValue(record?.error);
  return [
    textValue(error?.code),
    textValue(error?.type),
    textValue(record?.code),
    textValue(record?.type)
  ].find(Boolean) ?? "";
}

function errorMessageFromBody(body: unknown) {
  const record = recordValue(body);
  const error = recordValue(record?.error);
  return [
    textValue(error?.message),
    textValue(record?.message),
    textValue(record?.msg),
    textValue(record?.status),
    textValue(record?.state)
  ].find(Boolean) ?? "";
}

function createErrorPrefix(status: number, body: unknown) {
  const code = errorCodeFromBody(body).toLowerCase();
  const message = errorMessageFromBody(body).toLowerCase();
  if (status === 402 || code.includes("insufficient_funds") || message.includes("余额不足") || message.includes("insufficient")) {
    return "ai_provider_tokengo_insufficient_funds";
  }
  return "ai_provider_video_create_failed";
}

export function tokengoMediaVideoTaskFromBody(body: unknown, fallbackId = ""): TokengoMediaVideoTask | undefined {
  const record = recordValue(body);
  if (!record) return undefined;
  const data = recordValue(record.data);
  const source = data ? { ...record, ...data } : record;
  const id = tokengoMediaTaskIdFromBody(source) || fallbackId.trim();
  if (!id) return undefined;
  const errorRecord = recordValue(source.error);
  return {
    id,
    state: textValue(source.state) || undefined,
    status: textValue(source.status) || undefined,
    isFinal: boolValue(source.is_final),
    progress: numberValue(source.progress),
    error: textValue(source.error) || textValue(errorRecord?.message) || textValue(errorRecord?.code) || undefined,
    message: textValue(source.message) || undefined,
    resultUrl: tokengoMediaResultUrlFromBody(source) || undefined,
    cost: numberValue(source.cost),
    creditCost: numberValue(source.creditCost)
  };
}

export async function createTokengoMediaVideoTask(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  imageUrls: string[];
  endImageUrl?: string;
  videoParams: TokengoVideoParams;
  fetchWithTimeout: TokengoFetchWithTimeout;
  timeoutMs: number;
}) {
  const response = await params.fetchWithTimeout(tokengoMediaGenerateUrl(params.baseUrl), {
    method: "POST",
    headers: tokengoMediaHeaders(params.apiKey, "application/json"),
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      params: tokengoMediaVideoParams(params.videoParams, params.imageUrls, params.endImageUrl, params.model)
    }),
    cache: "no-store"
  }, params.timeoutMs, `ai_provider_video_create_timeout_${params.timeoutMs}`);
  const body = (await response.json().catch(() => ({}))) as unknown;
  const taskId = tokengoMediaTaskIdFromBody(body);
  if (!response.ok || !taskId) {
    throw new Error(`${createErrorPrefix(response.status, body)}_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
  }
  return { id: taskId };
}

export async function fetchTokengoMediaVideoTask(params: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  fetchWithTimeout: TokengoFetchWithTimeout;
  timeoutMs: number;
}) {
  const response = await params.fetchWithTimeout(tokengoMediaTaskStatusUrl(params.baseUrl, params.taskId), {
    headers: tokengoMediaHeaders(params.apiKey),
    cache: "no-store"
  }, params.timeoutMs, "ai_provider_video_status_timeout");
  const body = (await response.json().catch(() => ({}))) as unknown;
  const task = tokengoMediaVideoTaskFromBody(body, params.taskId);
  if (!response.ok || !task || (
    Boolean(task.error) &&
    !task.state &&
    !task.status &&
    task.isFinal === undefined &&
    task.progress === undefined &&
    !task.resultUrl
  )) {
    throw new Error(`ai_provider_video_status_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
  }
  return task;
}
