export const TOKENGO_IMAGE_PROVIDER_CURRENCY = "CNY" as const;
export const IMAGE_PROVIDER_ASPECT_RATIOS = ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "21:9", "9:21"] as const;
export const IMAGE_PROVIDER_RESOLUTIONS = ["1K", "2K", "4K"] as const;
export const IMAGE_PROVIDER_QUALITIES = ["auto", "low", "medium", "high"] as const;
export const IMAGE_PROVIDER_OUTPUT_FORMATS = ["png", "jpeg"] as const;

export type ImageProviderAspectRatio = typeof IMAGE_PROVIDER_ASPECT_RATIOS[number];
export type ImageProviderResolution = typeof IMAGE_PROVIDER_RESOLUTIONS[number];
export type ImageProviderQuality = typeof IMAGE_PROVIDER_QUALITIES[number];
export type ImageProviderOutputFormat = typeof IMAGE_PROVIDER_OUTPUT_FORMATS[number];

function normalizedChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T, upperCase = false): T {
  const normalized = typeof value === "string" ? (upperCase ? value.trim().toUpperCase() : value.trim().toLowerCase()) : "";
  return (choices as readonly string[]).includes(normalized) ? normalized as T : fallback;
}

export function normalizeImageProviderAspectRatio(value: unknown, fallback: ImageProviderAspectRatio = "auto"): ImageProviderAspectRatio {
  return normalizedChoice(value, IMAGE_PROVIDER_ASPECT_RATIOS, fallback);
}

export function normalizeImageProviderResolution(value: unknown, fallback: ImageProviderResolution = "1K"): ImageProviderResolution {
  return normalizedChoice(value, IMAGE_PROVIDER_RESOLUTIONS, fallback, true);
}

export function normalizeImageProviderQuality(value: unknown, fallback: ImageProviderQuality = "low"): ImageProviderQuality {
  return normalizedChoice(value, IMAGE_PROVIDER_QUALITIES, fallback);
}

export function normalizeImageProviderOutputFormat(value: unknown, fallback: ImageProviderOutputFormat = "png"): ImageProviderOutputFormat {
  return normalizedChoice(value, IMAGE_PROVIDER_OUTPUT_FORMATS, fallback);
}

type JsonRecord = Record<string, unknown>;

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function findStringByKeys(value: unknown, keys: string[], depth = 0): string | undefined {
  if (depth > 5 || !value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKeys(item, keys, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as JsonRecord;
  for (const key of keys) {
    const found = stringValue(record[key]);
    if (found) return found;
  }
  for (const child of Object.values(record)) {
    const found = findStringByKeys(child, keys, depth + 1);
    if (found) return found;
  }
  return undefined;
}

function findBooleanByKeys(value: unknown, keys: string[], depth = 0): boolean | undefined {
  if (depth > 5 || !value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBooleanByKeys(item, keys, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = value as JsonRecord;
  for (const key of keys) {
    const found = booleanValue(record[key]);
    if (found !== undefined) return found;
  }
  for (const child of Object.values(record)) {
    const found = findBooleanByKeys(child, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function findNumberByKeys(value: unknown, keys: string[], depth = 0): number | undefined {
  if (depth > 5 || !value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNumberByKeys(item, keys, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = value as JsonRecord;
  for (const key of keys) {
    const raw = record[key];
    const found = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(found)) return found;
  }
  for (const child of Object.values(record)) {
    const found = findNumberByKeys(child, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function isTokengoImageBaseUrl(value: string): boolean {
  try {
    return new URL(value).hostname.toLowerCase() === "buming001.token6688.com";
  } catch {
    return false;
  }
}

export function normalizeTokengoImageBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}

export function tokengoImageGenerationsUrl(baseUrl: string): string {
  return `${normalizeTokengoImageBaseUrl(baseUrl)}/v1/images/generations`;
}

export function tokengoImageRuntimeInvokeUrl(baseUrl: string): string {
  return `${normalizeTokengoImageBaseUrl(baseUrl)}/api/v1/model-runtime/invoke`;
}

export function tokengoImageRuntimeTaskUrl(baseUrl: string, taskId: string): string {
  return `${normalizeTokengoImageBaseUrl(baseUrl)}/api/v1/model-runtime/tasks/${encodeURIComponent(taskId)}`;
}

export function tokengoImageFilesUrl(baseUrl: string): string {
  return `${normalizeTokengoImageBaseUrl(baseUrl)}/v1/files`;
}

export type TokengoImageGenerationParams = {
  model: string;
  prompt: string;
  count: number;
  size: string;
  quality: string;
};

export function tokengoImageGenerationBody(params: TokengoImageGenerationParams) {
  return {
    model: params.model,
    n: Math.max(1, Math.trunc(params.count)),
    prompt: params.prompt,
    quality: params.quality,
    response_format: "b64_json",
    size: params.size
  };
}

export type TokengoImageRuntimeParams = {
  model: string;
  prompt: string;
  count: number;
  mode: "text-to-image" | "image-edit" | "multi-reference";
  aspectRatio: string;
  resolution: string;
  quality: string;
  outputFormat: "png" | "jpeg";
  images?: string[];
};

export function tokengoImageRuntimeBody(params: TokengoImageRuntimeParams) {
  return {
    modality: "image",
    model_id: params.model,
    operation: "generate",
    params: {
      aspect_ratio: params.aspectRatio,
      count: Math.max(1, Math.trunc(params.count)),
      mode: params.mode,
      output_format: params.outputFormat,
      prompt: params.prompt,
      quality: params.quality,
      resolution: params.resolution,
      ...(params.images?.length ? { images: params.images } : {})
    }
  };
}

export function tokengoImageUrlFromBody(body: unknown): string | undefined {
  return findStringByKeys(body, ["original_url", "url"]);
}

export function tokengoImageFileUrlFromBody(body: unknown): string | undefined {
  return tokengoImageUrlFromBody(body);
}

export function tokengoImageResultUrlFromBody(body: unknown): string | undefined {
  return findStringByKeys(body, ["original_url", "result_url", "output_url", "url"]);
}

export function tokengoImageBase64FromBody(body: unknown): string | undefined {
  return findStringByKeys(body, ["b64_json", "image_base64"]);
}

export function tokengoImageTaskIdFromBody(body: unknown): string | undefined {
  return findStringByKeys(body, ["task_id", "taskId", "creation_task_id"]);
}

export function tokengoImageTaskStatusFromBody(body: unknown): string | undefined {
  return findStringByKeys(body, ["status", "state", "task_status"]);
}

export function tokengoImageTaskIsFinal(body: unknown): boolean | undefined {
  return findBooleanByKeys(body, ["is_final", "isFinal"]);
}

export function tokengoImageTaskProgressFromBody(body: unknown): number | undefined {
  return findNumberByKeys(body, ["progress", "progress_percent"]);
}

export function tokengoImageTaskErrorFromBody(body: unknown): string | undefined {
  return findStringByKeys(body, ["error", "message"]);
}

export function tokengoImageCostRmbFromBody(body: unknown): number | undefined {
  return findNumberByKeys(body, ["cost_rmb", "cost"]);
}

export function tokengoImageResponseRequestId(response: Response): string | undefined {
  return response.headers.get("x-request-id")?.trim() || undefined;
}
