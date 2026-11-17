import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";
import ffmpegPath from "ffmpeg-static";
import { publishCustomerJobEvent, publishCustomerJobEventForJob } from "@/lib/customer-job-events";
import { prisma } from "@/lib/prisma";
import {
  contentTypeForCustomerAssetPath,
  customerAssetStorageKey,
  customerAssetFilePath,
  extensionForCustomerAssetMime,
  prepareCompressedCustomerImage,
  writeCustomerAssetFileShared
} from "@/lib/customer-asset-storage";
import { releaseStaleActiveGenerationJobRelational, replaceSettledGenerationOutputStorageKeyRelational, settleGenerationJobRelational, updateGenerationJobStatusRelational } from "@/lib/stores/job-store";
import { getPlatformAiProviderRelational } from "@/lib/stores/platform-store";
import {
  HUITU_OPENAPI_PROVIDER_CURRENCY,
  createHuituOpenApiVideoTask,
  downloadHuituOpenApiVideoTaskFile,
  fetchHuituOpenApiVideoTask
} from "@/lib/huitu-openapi-video";
import {
  createTokengoMediaVideoTask,
  fetchTokengoMediaVideoTask,
  normalizeTokengoMediaBaseUrl,
  resolveTokengoMediaResultUrl
} from "@/lib/tokengo-media-video";
import {
  TOKENGO_IMAGE_PROVIDER_CURRENCY,
  isTokengoImageBaseUrl,
  tokengoImageBase64FromBody,
  tokengoImageCostRmbFromBody,
  tokengoImageFileUrlFromBody,
  tokengoImageFilesUrl,
  tokengoImageResponseRequestId,
  tokengoImageResultUrlFromBody,
  tokengoImageRuntimeBody,
  tokengoImageRuntimeInvokeUrl,
  tokengoImageRuntimeTaskUrl,
  tokengoImageTaskErrorFromBody,
  tokengoImageTaskIdFromBody,
  tokengoImageTaskIsFinal,
  tokengoImageTaskStatusFromBody
} from "@/lib/tokengo-image";
import {
  signWorkerLocalAssetDownload,
  signWorkerCallback,
  getCachedWorkerProviderSecret,
  verifyWorkerPayloadSignature,
  type WorkerOutputSlot,
  type WorkerPayload
} from "@/lib/worker";
import {
  abortLocalWorkerProcesses,
  isLocalWorkerAbortError,
  registerLocalWorkerProcess,
  sleepWithLocalWorkerAbort,
  throwIfLocalWorkerAborted
} from "@/lib/local-worker-abort-registry";
import { MAX_MULTI_REFERENCE_VIDEO_FRAME_LIMIT, VIDEO_RESOLUTIONS, normalizeVideoDurationSeconds, normalizeVideoFrameLimit, normalizeVideoModelPreference, normalizeVideoResolution, type VideoModelFamily, type VideoModelPreference } from "@/lib/video-frame-config";
import { orderAiProviderFallbackCandidates, orderSelectableAiProviderFallbackCandidates, shouldTryNextPaidVideoProvider } from "@/lib/video-provider-fallback";
import { isTokengoMediaBaseUrl, isYinglingApiBaseUrl, videoProviderMatchesModelPreference, videoProviderModelFamilyForProvider, videoProviderProtocolForBaseUrl, type VideoProviderProtocol } from "@/lib/video-provider-family";
import { isVideoProviderModel } from "@/lib/video-provider-limits";
import { PROVIDER_JSON_BODY_MAX_BYTES, PROVIDER_REFERENCE_BODY_MAX_BYTES, PROVIDER_RESULT_BODY_MAX_BYTES, readBodyWithDeadline, readJsonWithDeadline } from "@/lib/provider-body-read";
import { videoProviderAvailabilityReason } from "@/lib/video-provider-availability";
import {
  attachVideoProviderFailure,
  normalizeVideoProviderFailure,
  videoProviderFailureFromError,
  type VideoProviderFailure
} from "@/lib/video-provider-policy";
import {
  buildMinimalVideoProviderPromptText,
  videoProviderThemePrompt,
  videoProviderUserPrompt
} from "@/lib/video-provider-prompt";
import {
  videoProviderCreateTimeoutMs as configuredVideoProviderCreateTimeoutMs,
  videoProviderWorkerTimeoutMs
} from "@/lib/video-provider-timeouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SharpResizeOptions = {
  width?: number;
  height?: number;
  fit?: "cover" | "inside";
  position?: "attention" | "centre" | "center";
  withoutEnlargement?: boolean;
};
type SharpCompositeOptions = {
  input: Buffer;
  gravity?: "center" | "centre";
};
type SharpInstance = {
  rotate: () => SharpInstance;
  resize: (options: SharpResizeOptions) => SharpInstance;
  blur: (radius?: number) => SharpInstance;
  modulate: (options: { brightness?: number; saturation?: number }) => SharpInstance;
  composite: (overlays: SharpCompositeOptions[]) => SharpInstance;
  jpeg: (options: { quality: number; mozjpeg: boolean }) => SharpInstance;
  toBuffer: () => Promise<Buffer>;
};
type SharpFactory = (input: Buffer) => SharpInstance;

const execFileAsync = promisify(execFile);

function ffmpegExecutablePath() {
  const explicit = process.env.FFMPEG_PATH?.trim() || process.env.FFMPEG_BINARY?.trim() || process.env.FFMPEG_BIN?.trim();
  if (explicit) return explicit;
  const bundledPath = typeof ffmpegPath === "string" ? ffmpegPath : "";
  const bundledInsideNextBuild = bundledPath.includes(`${path.sep}.next${path.sep}`) || bundledPath.includes(`${path.sep}.next-build${path.sep}`);
  if (bundledPath && !bundledInsideNextBuild) return bundledPath;
  return path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

async function loadSharp(): Promise<SharpFactory | undefined> {
  try {
    const moduleName = "sharp";
    const mod = await import(/* webpackIgnore: true */ moduleName);
    return (mod.default ?? mod) as SharpFactory;
  } catch {
    return undefined;
  }
}

function shouldUseSharpForWorkerImages() {
  const explicit = process.env.LOCAL_AI_WORKER_USE_SHARP?.trim();
  if (explicit === "1") return true;
  if (explicit === "0" || process.env.LOCAL_AI_WORKER_DISABLE_SHARP === "1") return false;
  return process.env.NODE_ENV !== "production";
}

function shouldUseSharpForVideoReferenceImages() {
  const explicit = process.env.LOCAL_AI_WORKER_VIDEO_REFERENCE_USE_SHARP?.trim();
  if (explicit === "1") return true;
  if (explicit === "0" || process.env.LOCAL_AI_WORKER_DISABLE_SHARP === "1") return false;
  return process.env.NODE_ENV !== "production";
}

type ImageGenerationResponse = {
  data?: Array<{ b64_json?: string; image_base64?: string; url?: string; original_url?: string }>;
  output?: Array<{ b64_json?: string; image_base64?: string; url?: string; original_url?: string }>;
  image_base64?: string;
  error?: unknown;
};

type ImageInputAsset = {
  assetId: string;
  signedUrl: string;
  publicUrl?: string;
  storageKey?: string;
  mimeType?: string;
};

type FetchInitWithDispatcher = RequestInit & { dispatcher?: unknown };

type VideoGenerateResponse = {
  code?: number;
  data?: {
    id?: string | number;
    request_id?: string | number;
    task_id?: string | number;
    taskId?: string | number;
    task?: { id?: string | number };
  };
  id?: string | number;
  request_id?: string | number;
  task_id?: string | number;
  taskId?: string | number;
  msg?: string;
  error?: unknown;
};

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
  result_type?: string;
  video?: { url?: string; duration?: number };
  media?: Array<{ id?: string; kind?: string; role?: string; url?: string; src?: string; name?: string }>;
  fail_reason?: unknown;
  result?: { url?: string; result_url?: string; video_url?: string; videos?: Array<{ url?: string; result_url?: string; video_url?: string }>; images?: Array<{ url?: string; result_url?: string }> };
  output?: { url?: string; result_url?: string; video_url?: string } | Array<{ url?: string; result_url?: string; video_url?: string }>;
  error?: unknown;
  message?: string;
  cost?: number;
  creditCost?: number;
};

type WorkerImageProvider = WorkerPayload["aiProviderFallback"]["providers"][number];
type GeneratedOutput = {
  storageKey: string;
  mimeType: string;
  providerLabel: string;
  index: number;
  providerTaskId?: string;
  estimatedCostUsd?: number;
  providerCreditCost?: number;
  providerCurrency?: string;
  referenceFrameCount?: number;
  requestedReferenceFrameCount?: number;
  providerReferenceLimit?: number;
  timing?: Record<string, string>;
  asyncVideoOptimization?: () => Promise<void>;
};
type VideoSceneReference = {
  storageKey: string;
  mimeType: string;
  providerLabel: string;
  asset: ImageInputAsset;
};
type VideoSceneReferenceGetter = (params: {
  payload: WorkerPayload;
  requestedReferenceAssets: ImageInputAsset[];
}) => Promise<VideoSceneReference>;

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}

function imageBase64(body: ImageGenerationResponse) {
  return body.data?.[0]?.b64_json ??
    body.data?.[0]?.image_base64 ??
    body.output?.[0]?.b64_json ??
    body.output?.[0]?.image_base64 ??
    body.image_base64;
}

function imageBase64List(body: ImageGenerationResponse): string[] {
  const values = [
    ...(body.data ?? []).map((item) => item.b64_json ?? item.image_base64),
    ...(body.output ?? []).map((item) => item.b64_json ?? item.image_base64),
    body.image_base64
  ].filter((item): item is string => typeof item === "string" && item.length > 0);
  return values.length ? values : imageBase64(body) ? [imageBase64(body)!] : [];
}

/** 中转平台可能只返回图片 URL（不回传 base64），这里提取可下载的地址。 */
function imageResultUrls(body: ImageGenerationResponse): string[] {
  const values = [
    ...(body.data ?? []).map((item) => item.url ?? item.original_url),
    ...(body.output ?? []).map((item) => item.url ?? item.original_url)
  ].filter((item): item is string => typeof item === "string" && item.length > 0);
  return Array.from(new Set(values));
}

/** 通道级图片参数（分辨率/质量）映射到 OpenAI 兼容的 size / quality。 */
function imageProviderRequestSize(provider: WorkerImageProvider) {
  const ratio = (provider.imageAspectRatio ?? "auto").trim().toLowerCase();
  if (ratio === "auto" || !ratio) return process.env.LOCAL_AI_WORKER_IMAGE_SIZE ?? "1024x1024";
  const shortEdge = provider.imageResolution === "2K" ? 2048 : provider.imageResolution === "4K" ? 4096 : 1024;
  const [ratioWidth, ratioHeight] = ratio.split(":").map((part) => Number(part));
  if (!Number.isFinite(ratioWidth) || !Number.isFinite(ratioHeight) || ratioWidth <= 0 || ratioHeight <= 0) {
    return `${shortEdge}x${shortEdge}`;
  }
  const ratioValue = ratioWidth / ratioHeight;
  if (ratioValue >= 1) return `${Math.round(shortEdge * ratioValue)}x${shortEdge}`;
  return `${shortEdge}x${Math.round(shortEdge / ratioValue)}`;
}

function imageProviderRequestQuality(provider: WorkerImageProvider) {
  const quality = (provider.imageQuality ?? "low").trim().toLowerCase();
  if (quality === "auto" || quality === "low" || quality === "medium" || quality === "high") return quality;
  return "low";
}

async function downloadImageResultUrl(url: string, provider: WorkerImageProvider, apiKey: string | undefined, timeoutMs: number) {
  const sameProviderOrigin = (() => {
    try {
      return new URL(url).origin === new URL(normalizeBaseUrl(provider.aiUrl)).origin;
    } catch {
      return false;
    }
  })();
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: sameProviderOrigin && apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    cache: "no-store"
  }, timeoutMs, "ai_provider_image_download_timeout");
  if (!response.ok) throw new Error(`ai_provider_image_download_failed_${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("ai_provider_image_empty_payload");
  return { bytes, mimeType: imageMimeTypeFromBytes(bytes, "image/png") };
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function promptText(value: unknown) {
  if (typeof value === "string") return value.trim();
  const record = recordValue(value);
  return textValue(record?.rendered) || textValue(record?.template);
}

function safeImagePrompt(value: string) {
  return value
    .replace(/create a coherent \d+[- ]image package[^.]*\./gi, "Create one standalone image for this package slot.")
    .replace(/create a coherent [a-z]+[- ]image package[^.]*\./gi, "Create one standalone image for this package slot.")
    .replace(/\b\d+[- ]image package\b/gi, "single-image package slot")
    .replace(/\bfull set\b/gi, "single package slot")
    .replace(/varied poses, camera distances, and compositions/gi, "one clear pose, one camera distance, and one composition")
    .replace(/keeps? the subject recognizable[^.]*\./gi, "Keeps the reference's broad visual direction without matching or verifying a real person's identity.")
    .replace(/key facial features/gi, "general portrait traits")
    .replace(/overall identity/gi, "overall mood")
    .replace(/identity consistency/gi, "style consistency")
    .replace(/recognizable identity/gi, "coherent styling");
}

function isVideoGenerationModel(model: string) {
  const normalized = model.trim().toLowerCase();
  return isVideoProviderModel(normalized);
}

function normalizeVideoGenerationModel(model: string) {
  return model.trim();
}

function isImageToVideoModel(model: string) {
  const normalized = model.trim().toLowerCase();
  return normalized.includes("grok-imagine") || normalized.includes("grok-video-") || normalized.includes("image-to-video") || normalized.includes("i2v") || normalized.startsWith("veo-");
}

function isSmartPickLidBaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname.toLowerCase().includes("smartpicklid");
  } catch {
    return false;
  }
}

function isMagic666BaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname.toLowerCase().includes("magic666");
  } catch {
    return false;
  }
}

function is2KenBaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname.toLowerCase() === "apis.2ken.com";
  } catch {
    return false;
  }
}

function envFlag(name: string): boolean | undefined {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
  if (value === "0" || value === "false" || value === "no" || value === "off") return false;
  return undefined;
}

function shouldAllowMagic666VideoProvider() {
  return envFlag("AI_WORKER_ALLOW_MAGIC666_UNVERIFIED_VIDEO") === true;
}

function shouldAllowSmartPickLidVideoProvider() {
  return envFlag("AI_WORKER_ALLOW_SMARTPICKLID_UNVERIFIED_VIDEO") ?? true;
}

function usesProxyOpenAiVideoEndpoint(baseUrl: string) {
  return isSmartPickLidBaseUrl(baseUrl) || isMagic666BaseUrl(baseUrl) || is2KenBaseUrl(baseUrl);
}

function proxyOpenAiVideoBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return usesProxyOpenAiVideoEndpoint(trimmed) ? trimmed.replace(/\/v1$/, "") : trimmed;
}

function openAiVideoCreateEndpoint(baseUrl: string, options?: { yinglingOpenAiVideos?: boolean }) {
  const endpointBaseUrl = proxyOpenAiVideoBaseUrl(baseUrl);
  if (isYinglingApiBaseUrl(endpointBaseUrl)) {
    // Yingling's updated third-party API transports reference audio only on
    // the OpenAI-compatible /v1/videos endpoint; the legacy
    // /v1/video/generations task format silently drops audio fields.
    return options?.yinglingOpenAiVideos ? `${endpointBaseUrl}/v1/videos` : `${endpointBaseUrl}/v1/video/generations`;
  }
  return `${endpointBaseUrl}${usesProxyOpenAiVideoEndpoint(endpointBaseUrl) ? "/v1/videos" : "/v1/videos/generations"}`;
}

function openAiVideoStatusEndpoint(baseUrl: string, taskId: string, options?: { yinglingOpenAiVideos?: boolean }) {
  if (isYinglingApiBaseUrl(baseUrl)) return `${proxyOpenAiVideoBaseUrl(baseUrl)}/v1/${options?.yinglingOpenAiVideos ? "videos" : "video/generations"}/${encodeURIComponent(taskId)}`;
  return `${proxyOpenAiVideoBaseUrl(baseUrl)}/v1/videos/${encodeURIComponent(taskId)}`;
}

function openAiVideoContentEndpoint(baseUrl: string, taskId: string, options?: { yinglingOpenAiVideos?: boolean }) {
  return `${openAiVideoStatusEndpoint(baseUrl, taskId, options)}/content`;
}

// Jobs that carry reference audio must run against yingling's OpenAI-compatible
// /v1/videos endpoint (`audio_refs` JSON URL list); the legacy platform task
// format accepts no audio fields at all.
function yinglingJobUsesOpenAiVideos(baseUrl: string, audioUrlCount: number) {
  return isYinglingApiBaseUrl(baseUrl) && audioUrlCount > 0;
}

function isGrokImagineVideoModel(model: string) {
  return model.trim().toLowerCase().includes("grok-imagine-video");
}

function isSmartPickLidJsonVideoModel(model: string) {
  const normalized = model.trim().toLowerCase();
  return isGrokImagineVideoModel(normalized) || normalized.includes("grok-imagine-1.5") || normalized.startsWith("veo-");
}

function videoProviderModelCandidates(model: string, params?: { protocol?: VideoProviderProtocol; referenceAssetCount?: number; baseUrl?: string }) {
  const normalizedModel = normalizeVideoGenerationModel(model);
  const protocol = params?.protocol;
  const referenceAssetCount = Math.max(0, Math.trunc(Number(params?.referenceAssetCount ?? 0) || 0));
  if (protocol === "openai-videos" && isYinglingApiBaseUrl(params?.baseUrl ?? "")) return [normalizedModel];
  if (protocol === "tokengo-media") return [normalizedModel];
  if (protocol === "huitu-openapi") return [normalizedModel];
  if (protocol === "openai-videos" && isSmartPickLidBaseUrl(params?.baseUrl ?? "")) {
    const smartPickLidReferenceCandidates = [
      "grok-imagine-video",
      normalizedModel,
      "grok-imagine-video-special",
      "grok-imagine-1.5-special",
      "grok-imagine-1.5",
      "grok-video-3-pro",
      "grok-video-3-max"
    ];
    const smartPickLidTextCandidates = [
      "grok-imagine-video",
      normalizedModel,
      "grok-imagine-video-special",
      "grok-imagine-1.5-special",
      "grok-imagine-1.5"
    ];
    const referenceCandidates = referenceAssetCount > 0
      ? smartPickLidReferenceCandidates
      : smartPickLidTextCandidates;
    return Array.from(new Set([
      ...referenceCandidates
    ].filter(Boolean)));
  }
  if (protocol === "openai-videos" && referenceAssetCount > 1) {
    return Array.from(new Set([
      isGrokImagineVideoModel(normalizedModel) && !normalizedModel.includes("1.5") ? normalizedModel : "",
      "grok-imagine-video"
    ].filter(Boolean)));
  }
  if (protocol === "lk888-media") {
    const lk888Candidates = referenceAssetCount > 0
      ? [
          normalizedModel,
          "grok-imagine-video-1.5-preview",
          "grok-imagine-video-1.5",
          "grok-imagine-video",
          "grok-video-3.5-1015",
          "grok-video-3"
        ]
      : [
          normalizedModel,
          "grok-video-3",
          "grok-video-3.5-1015",
          "grok-imagine-video-1.5-preview",
          "grok-imagine-video-1.5",
          "grok-imagine-video"
        ];
    return Array.from(new Set(lk888Candidates.filter(Boolean)));
  }
  const shouldPreferSmartPickLidJsonModel = protocol === "openai-videos" && isSmartPickLidBaseUrl(params?.baseUrl ?? "");
  const imageToVideoCandidates = [
    ...(isImageToVideoModel(normalizedModel) ? [normalizedModel] : []),
    "grok-imagine-video-1.5-preview",
    "grok-imagine-video-1.5",
    "grok-imagine-video"
  ];
  if (protocol === "openai-videos" && (referenceAssetCount > 0 || shouldPreferSmartPickLidJsonModel)) {
    return Array.from(new Set(imageToVideoCandidates.filter(Boolean)));
  }
  const ordered = [
    normalizedModel,
    "grok-video-3-pro",
    "grok-video-3-max",
    "grok-video-1.5-pro",
    "grok-video-1.5-max",
    ...imageToVideoCandidates
  ];
  return Array.from(new Set(ordered.filter(Boolean)));
}

function isVideoModelUnavailableError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return message.includes("model_not_found") || message.includes("no available channel for model") || message.includes("no access to model");
}

function shouldTryNextVideoModel(error: unknown) {
  if (process.env.LOCAL_AI_WORKER_ALLOW_PAID_VIDEO_RETRIES !== "1") return false;
  if (isVideoModelUnavailableError(error)) return true;
  const message = errorMessage(error).toLowerCase();
  if (message.includes("first_frame_required") || message.includes("reference image required") || message.includes("images required") || message.includes("input_reference")) return true;
  return message.includes("ai_provider_video_create_failed_502_") ||
    message.includes("ai_provider_video_create_failed_404_") ||
    message.includes("ai_provider_video_create_failed_503_") ||
    message.includes("ai_provider_video_create_failed_504_") ||
    message.includes("ai_provider_video_create_failed_524_") ||
    message.includes("upstream_error") ||
    message.includes("服务暂时不可用");
}

function isImageGenerationModel(model: string) {
  const normalized = model.trim().toLowerCase();
  return !isVideoGenerationModel(normalized) && (normalized.startsWith("gpt-image") || normalized.includes("image"));
}

/**
 * 图片通道判定以平台配置的能力类型为准，模型名只作为兜底。
 * 中转平台同步进来的图片模型（如 nano-banana、flux-*）模型名里没有 "image"，
 * 只靠模型名会把这些通道整批过滤掉。
 */
function isImageProviderModel(provider: { providerType?: string | null; modelType?: string | null }) {
  const providerType = (provider.providerType ?? "").trim().toLowerCase();
  if (providerType === "video") return false;
  if (providerType === "image") return true;
  return isImageGenerationModel(provider.modelType ?? "");
}

function requestedModelOverride(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields);
  return textValue(payload.params.modelOverride) || textValue(fields?.modelOverride);
}

function requestedVideoModelPreference(payload: WorkerPayload): VideoModelPreference {
  const fields = recordValue(payload.params.fields);
  const selection = recordValue(payload.providerSelection) ?? {};
  return normalizeVideoModelPreference(
    textValue(payload.params.videoModelFamily) ||
    textValue(payload.params.modelFamily) ||
    textValue(fields?.videoModelFamily) ||
    textValue(fields?.modelFamily) ||
    textValue(selection?.videoModelFamily),
    "auto"
  );
}

function isVideoGenerationRequest(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields);
  const requestedModel = requestedModelOverride(payload);
  if (requestedModel && isVideoGenerationModel(requestedModel)) return true;
  const requestSignals = [
    payload.aiApp,
    payload.routeKey,
    textValue(payload.params.mode),
    textValue(payload.params.outputType),
    textValue(payload.params.videoThemeId),
    textValue(fields?.outputType),
    textValue(fields?.mode),
    textValue(fields?.videoThemeId),
    textValue(fields?.videoThemeName),
    textValue(fields?.toolPresetId),
    textValue(fields?.toolPresetTitle),
    textValue(fields?.toolPresetSlug)
  ].join(" ").toLowerCase();
  return /\b(video|clip|motion|image-to-video|profile-clip)\b/.test(requestSignals);
}

function orderedImageProviders(payload: WorkerPayload): WorkerImageProvider[] {
  const imageProviders = payload.aiProviderFallback.providers.filter((provider) => provider.id && provider.enabled !== false && isImageProviderModel(provider));
  const selection = recordValue(payload.providerSelection) ?? {};
  const selectedProviderId = textValue(selection?.providerId);
  const forcedSelectedProvider = selectedProviderId
    ? imageProviders.find((provider) => provider.id === selectedProviderId)
    : undefined;

  if (selection?.mode === "fixed_provider") return forcedSelectedProvider ? [forcedSelectedProvider] : [];
  if (selection?.mode === "preferred_provider" && selection.fallbackEnabled === false && forcedSelectedProvider) return [forcedSelectedProvider];

  const requiresImageEdit = inputAssets(payload).length > 0;
  const editCapableProviders = imageProviders.filter((provider) => provider.supportsEditN);
  const candidateProviders = requiresImageEdit && editCapableProviders.length ? editCapableProviders : imageProviders;
  const selectedProvider = selectedProviderId
    ? candidateProviders.find((provider) => provider.id === selectedProviderId)
    : undefined;
  const orderedProviders = orderAiProviderFallbackCandidates(candidateProviders);
  return selectedProvider
    ? [selectedProvider, ...orderedProviders.filter((provider) => provider.id !== selectedProvider.id)]
    : orderedProviders;
}

function isTokengoGrokImagine15VideoProvider(provider: WorkerImageProvider) {
  return isTokengoMediaBaseUrl(normalizeBaseUrl(provider.aiUrl ?? "")) &&
    provider.modelType?.trim().toLowerCase() === "grok-imagine-1.5";
}

function videoProviderSupportsCurrentRequest(provider: WorkerImageProvider, referenceAssetCount: number) {
  return !videoProviderAvailabilityReason({ ...provider, apiKey: "configured" }, { referenceAssetCount });
}

function orderedVideoProviders(payload: WorkerPayload): WorkerImageProvider[] {
  const selectedModelPreference = requestedVideoModelPreference(payload);
  const referenceAssetCount = videoFrameAssets(payload).length;
  const videoProviders = payload.aiProviderFallback.providers.filter((provider) =>
    provider.id &&
    provider.enabled !== false &&
    provider.providerType !== "image" &&
    (provider.providerType === "video" || isVideoGenerationModel(provider.modelType)) &&
    videoProviderMatchesModelPreference(provider, selectedModelPreference) &&
    videoProviderSupportsCurrentRequest(provider, referenceAssetCount)
  );
  const ordered = orderSelectableAiProviderFallbackCandidates(videoProviders, payload.providerSelection);
  const selection = recordValue(payload.providerSelection) ?? {};
  if (selection.mode === "fixed_provider" || selection.mode === "preferred_provider") return ordered;
  if (selectedModelPreference === "auto") return ordered;
  const hasAtMostOneReference = referenceAssetCount <= 1;
  const tokengoSingleReferenceProviders = ordered.filter(isTokengoGrokImagine15VideoProvider);
  const otherVideoProviders = ordered.filter((provider) => !isTokengoGrokImagine15VideoProvider(provider));
  return hasAtMostOneReference
    ? [...tokengoSingleReferenceProviders, ...otherVideoProviders]
    : [...otherVideoProviders, ...tokengoSingleReferenceProviders];
}

function orderedVideoSceneImageProviders(payload: WorkerPayload): WorkerImageProvider[] {
  const imageProviders = payload.aiProviderFallback.providers.filter((provider) => provider.id && provider.enabled !== false && isImageProviderModel(provider));
  const editCapableProviders = imageProviders.filter((provider) => provider.supportsEditN);
  const candidateProviders = editCapableProviders.length ? editCapableProviders : imageProviders;
  const fields = recordValue(payload.params.fields);
  const selectedProviderId = textValue(payload.params.sceneImageProviderId) || textValue(fields?.sceneImageProviderId) || textValue(payload.params.imageProviderId) || textValue(fields?.imageProviderId);
  const selectedProvider = selectedProviderId
    ? imageProviders.find((provider) => provider.id === selectedProviderId)
    : undefined;
  const preferredProviders = Array.from(new Map([
    ...(selectedProvider ? [[selectedProvider.id, selectedProvider] as const] : []),
    ...candidateProviders.filter((provider) => provider.preferred).map((provider) => [provider.id, provider] as const)
  ]).values());
  const preferredIds = new Set(preferredProviders.map((provider) => provider.id));
  const fallbackProviders = candidateProviders.filter((provider) => !preferredIds.has(provider.id));
  return [...preferredProviders, ...fallbackProviders];
}

function outputCount(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields);
  const raw =
    typeof payload.params.outputCount === "number"
      ? payload.params.outputCount
      : Number(payload.params.outputCount ?? fields?.outputCount);
  const requested = Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1;
  const limit = Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_OUTPUT_LIMIT ?? requested) || requested, 20));
  return Math.min(requested, limit);
}

function providerTimeoutMs() {
  return Math.max(10_000, Number(process.env.LOCAL_AI_WORKER_PROVIDER_TIMEOUT_MS ?? "300000") || 300_000);
}

function videoSceneImageProviderAttempts() {
  return Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_VIDEO_SCENE_IMAGE_ATTEMPTS ?? "3") || 3, 4));
}

function videoProviderTimeoutMs() {
  return videoProviderWorkerTimeoutMs();
}

function videoProviderCreateTimeoutMs(timeoutMs: number) {
  return Math.min(configuredVideoProviderCreateTimeoutMs(), timeoutMs);
}

function videoCreateOrphanWatchdogMs() {
  return videoProviderCreateTimeoutMs(videoProviderTimeoutMs()) + 2 * 60_000 + 10_000;
}

function videoProviderPollIntervalMs(elapsedMs = 0) {
  const configured = process.env.LOCAL_AI_WORKER_VIDEO_POLL_INTERVAL_MS?.trim();
  const fallback = elapsedMs < 90_000 ? 2_000 : 5_000;
  return Math.max(1_000, Math.min(Number(configured || fallback) || fallback, 15_000));
}

function providerAttempts() {
  return Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_PROVIDER_ATTEMPTS ?? "1") || 1, 4));
}

function videoProviderAttempts() {
  if (process.env.LOCAL_AI_WORKER_ALLOW_PAID_VIDEO_RETRIES !== "1") return 1;
  return Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_VIDEO_PROVIDER_ATTEMPTS ?? "1") || 1, 2));
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "local_worker_generation_failed";
  const cause = error.cause instanceof Error ? ` cause:${error.cause.message}` : "";
  return `${error.message}${cause}`;
}

function isRetryableProviderError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  if (isVideoModelUnavailableError(error) || message.includes("invalid request")) return false;
  if (message.includes("failed_429") || message.includes("failed_500") || message.includes("failed_502") || message.includes("failed_503") || message.includes("failed_504") || message.includes("failed_524")) return true;
  return message.includes("fetch failed") || message.includes("timeout") || message.includes("socket") || message.includes("econnreset") || message.includes("terminated");
}

function shouldTryNextSceneImageProvider(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  if (message.includes("invalid request")) return false;
  return isRetryableProviderError(error) ||
    message.includes("failed_404") ||
    message.includes("failed_401") ||
    message.includes("failed_403") ||
    message.includes("insufficient_balance") ||
    message.includes("insufficient account balance") ||
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("credit");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function referenceRoles(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields) ?? {};
  const primaryAssetIds = new Set(stringArray(fields.primaryAssetIds ?? payload.params.primaryAssetIds));
  const partnerAssetIds = new Set(stringArray(fields.partnerAssetIds ?? payload.params.partnerAssetIds));
  return {
    primaryAssetIds,
    partnerAssetIds,
    roleFor(assetId: string) {
      if (primaryAssetIds.has(assetId)) return "primary";
      if (partnerAssetIds.has(assetId)) return "partner";
      return "source";
    }
  };
}

function referenceRoleLabel(role: string) {
  if (role === "primary") return "PRIMARY_PERSON_REFERENCE";
  if (role === "partner") return "PARTNER_PERSON_REFERENCE";
  return "GENERAL_SOURCE_REFERENCE";
}

function videoFrameReferenceFileLabel(payload: WorkerPayload, assetId: string, fallback: string) {
  const fields = recordValue(payload.params.fields);
  const frameIds = stringArray(fields?.frameAssetIds);
  const frameIndex = frameIds.indexOf(assetId);
  if (frameIndex < 0) return fallback;
  const characterLabel = frameIndex === 0 ? "character-a" : frameIndex === 1 ? "character-b" : `character-${frameIndex + 1}`;
  return `video-frame-${frameIndex + 1}-${characterLabel}`;
}

function providerReferenceRolePriority(role: string) {
  if (role === "partner") return 0;
  if (role === "primary") return 1;
  return 2;
}

function providerImageReferenceLimit() {
  const configured = Number(process.env.LOCAL_AI_WORKER_IMAGE_REFERENCE_LIMIT ?? "16");
  if (!Number.isFinite(configured) || configured <= 0) return 16;
  return Math.max(1, Math.min(Math.trunc(configured), 16));
}

function providerInputAssets(payload: WorkerPayload): ImageInputAsset[] {
  const roles = referenceRoles(payload);
  return inputAssets(payload)
    .slice(0, providerImageReferenceLimit())
    .map((asset, originalIndex) => ({ asset, originalIndex, role: roles.roleFor(asset.assetId) }))
    .sort((left, right) => {
      const roleDelta = providerReferenceRolePriority(left.role) - providerReferenceRolePriority(right.role);
      return roleDelta || left.originalIndex - right.originalIndex;
    })
    .map((item) => item.asset);
}

function referenceManifest(payload: WorkerPayload) {
  const roles = referenceRoles(payload);
  const assets = providerInputAssets(payload);
  if (!assets.length) return "";
  return [
    "Provider reference manifest:",
    ...assets.map((asset, index) => {
      const role = roles.roleFor(asset.assetId);
      return `REFERENCE_${index + 1}: role=${referenceRoleLabel(role)} assetId=${asset.assetId}`;
    })
  ].join("\n");
}

function balancedReferenceInstruction(payload: WorkerPayload) {
  const roles = referenceRoles(payload);
  if (!roles.partnerAssetIds.size) {
    return "Use the provided customer source image or images as visual references when available: keep broad subject, color, and non-sensitive styling cues while producing an original themed result.";
  }
  return [
    "Use the provided customer source images as balanced person references, not as one copied composition.",
    "Do not let PRIMARY_PERSON_REFERENCE dominate the result or cause PARTNER_PERSON_REFERENCE people to be omitted.",
    "For multi-person outputs, visibly borrow cues from PARTNER_PERSON_REFERENCE images, including hair, clothing color, posture, and visible context where useful.",
    "Do not discard clear additional people visible in PRIMARY_PERSON_REFERENCE images.",
    "Keep the final scene original and themed instead of copying the primary reference photo's selfie composition."
  ].join(" ");
}

function referenceRoleInstruction(payload: WorkerPayload) {
  const assets = providerInputAssets(payload);
  if (!assets.length) return "";
  const roles = referenceRoles(payload);
  const roleLines = assets.map((asset, index) => `${index + 1}. ${referenceRoleLabel(roles.roleFor(asset.assetId))}`).join("\n");
  if (!roles.partnerAssetIds.size) {
    return `Reference image role map:\n${roleLines}\nUse the listed reference image or images for the requested subject only.`;
  }
  return [
    `Reference image role map:\n${roleLines}`,
    "Binding rules: every clear adult person visible in PRIMARY_PERSON_REFERENCE images should remain represented, and every clear adult person visible in PARTNER_PERSON_REFERENCE images should also remain represented.",
    "Use visible cues from both the primary and partner reference groups. Do not let one uploaded image supply the whole final group.",
    "When multiple reference images contain different people, combine them into one natural travel group instead of choosing only one reference image.",
    "If the primary reference shows two clear people and the partner reference shows one clear person, the final travel photo should show three adults together."
  ].join("\n");
}

function subjectCompositionInstruction(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields) ?? {};
  const packageAudience = textValue(fields.packageAudience ?? payload.params.packageAudience).toLowerCase();
  const trainingMode = textValue(fields.trainingMode ?? payload.params.trainingMode).toLowerCase();
  const primaryAssetIds = stringArray(fields.primaryAssetIds ?? payload.params.primaryAssetIds);
  const partnerAssetIds = stringArray(fields.partnerAssetIds ?? payload.params.partnerAssetIds);
  const wantsTwoPeople =
    packageAudience === "both" ||
    packageAudience.includes("both") ||
    trainingMode === "couple" ||
    partnerAssetIds.length > 0;

  if (wantsTwoPeople) {
    const subjectSource = primaryAssetIds.length && partnerAssetIds.length
      ? "Use the primary reference photos and partner reference photos as separate source groups. Preserve every clear adult person visible across those groups instead of limiting the output to one person per group."
      : "Use the source photos as references for a natural group when multiple clear people are visible.";
    return [
      "Final composition requirement: show all clear adult people from the selected source photos together in one realistic scene.",
      subjectSource,
      "Keep both reference groups represented in the final image, with each visible source person included as a distinct final person.",
      "Style them as a travel group or paired subjects, all clearly visible from head and upper body or full body.",
      "Do not copy the arrangement from the primary reference when a partner reference is provided.",
      "Do not generate a solo portrait, do not crop one person out, and do not create a collage, split panel, contact sheet, or multiple unrelated portraits."
    ].join(" ");
  }

  if (packageAudience === "partner") {
    return "Final composition requirement: focus on the partner subject from the partner photos when available. Do not add extra people unless requested.";
  }

  return "Final composition requirement: create one final portrait of the primary subject. Do not create a collage, split panel, contact sheet, or multiple unrelated portraits.";
}

function buildPrompt(payload: WorkerPayload) {
  const promptParts = [
    safeImagePrompt(promptText(payload.prompt)),
    safeImagePrompt(promptText(payload.params.prompt)),
    textValue(payload.params.style) ? `Style: ${textValue(payload.params.style)}` : "",
    "Create exactly one standalone image for this output slot.",
    subjectCompositionInstruction(payload),
    referenceRoleInstruction(payload),
    referenceManifest(payload),
    "Do not create a collage, grid, contact sheet, split panel, moodboard, storyboard, or multiple avatars inside the same image.",
    balancedReferenceInstruction(payload),
    "Stylized editorial image, tasteful composition, no text, no watermark, no UI."
  ].filter(Boolean);
  return promptParts.join("\n\n");
}

function promptForOutputSlot(prompt: string, slotIndex: number, totalCount: number) {
  if (totalCount <= 1) return prompt;
  return [
    prompt,
    `Variation requirement: this is output slot ${slotIndex} of ${totalCount}. Create a distinct image from the other slots with a different pose, framing, lighting balance, background detail, and micro-expression while preserving the same package theme and subject requirements.`,
    `Do not duplicate the composition from any other output slot. Variation seed: ${slotIndex}-${totalCount}.`
  ].join("\n\n");
}

function buildVideoSkillPackQualityPrompt(params: {
  aspectRatio: string;
  duration: string;
  frameCount: number;
  modelFamily: VideoModelFamily;
  resolution: string;
}) {
  return [
    "Latest installed AI video skill-pack quality layer: treat short customer notes as drafts and upgrade them into production-ready video direction while preserving the user's intent.",
    "Hook and beat logic: the first 0-3 seconds must have a clear hook or story function. Every visible beat must advance action, prove a selling point, change emotion, or increase pressure.",
    "Renderable detail rule: each beat needs one environmental pressure, one physical micro-action, and one sound or visual motif. Replace vague style words with concrete visible facts.",
    "Camera and final image: use one motivated primary camera move, smooth acceleration and deceleration, readable scene geometry, and a clear final frame.",
    params.frameCount > 0
      ? `Reference continuity: use all ${params.frameCount} ordered reference frame${params.frameCount === 1 ? "" : "s"} as binding visual evidence.`
      : `Text-to-video continuity: create one ${params.duration}-second ${params.aspectRatio} ${params.resolution.toUpperCase()} clip from the written direction without inventing unrelated preset scenes.`,
    params.modelFamily === "grok"
      ? "Grok adapter: write the supplier prompt in plain natural English, keep duration/aspect/resolution as request settings, describe reference images by role, and do not use Seedance @Image/@Video syntax."
      : "Gemini adapter: keep frame references explicit, concise, and policy-safe. Use concrete visual actions and avoid unsupported real-person reference wording when the selected provider cannot use it."
  ].join("\n");
}

function _buildVideoQualitySystemPrompt(params: {
  aspectRatio: string;
  duration: string;
  frameCount: number;
  modelFamily: VideoModelFamily;
  resolution: string;
}) {
  const providerContract = params.frameCount > 0
    ? `Provider contract: create exactly one ${params.duration}-second image-to-video MP4 at ${params.aspectRatio} ${params.resolution.toUpperCase()} from the ordered input reference image${params.frameCount === 1 ? "" : "s"}.`
    : `Provider contract: create exactly one ${params.duration}-second text-to-video MP4 at ${params.aspectRatio} ${params.resolution.toUpperCase()} from the written customer direction.`;
  return [
    "Internal video quality system: these rules are mandatory and have higher priority than the user direction when quality, identity, anatomy, continuity, or output cleanliness would otherwise degrade.",
    buildVideoSkillPackQualityPrompt(params),
    providerContract,
    "Prompt hierarchy: ordered frame images and subject identity first; then continuity, anatomy, motion, and camera rules; then user direction; then theme style. If a user direction conflicts with identity preservation, natural anatomy, or clean output, keep the closest realistic interpretation instead.",
    params.frameCount > 0
      ? "Reference lock: uploaded frame images are binding visual evidence. The video must visibly derive from those images; if motion is difficult, simplify the action instead of replacing the subjects, setting, or requested interaction."
      : "Text-to-video mode: no frame image was uploaded. Follow the written customer direction as the source of truth and do not borrow unrelated preset scenes.",
    "Shot plan: generate one coherent continuous scene with a clear beginning, middle, and end beat. Use visible subject or environmental movement. Do not output a slideshow, static pan, or frozen still.",
    "Reference discipline: preserve the people, faces, body proportions, hair, wardrobe, products, props, scene geometry, and lighting cues from the reference frames. Do not swap identities, change facial structure, invent extra people, duplicate subjects, or alter important product shapes.",
    "Anatomy and motion guardrails: keep hands, eyes, limbs, shoulders, necks, and posture believable. Avoid melted faces, extra fingers, warped eyes, rubber limbs, jitter, floating objects, sudden teleporting, over-fast zooms, or physically impossible bends.",
    params.frameCount > 1
      ? "Multi-frame rule: use every ordered frame as an intentional reference beat in order. Transition smoothly between beats without abrupt morphing, identity resets, scene cuts, or ignoring later frames."
      : "Single-frame rule: infer plausible preceding and following motion from pose, scene geometry, objects, wardrobe, lighting, and user direction while keeping the opening visual identity stable.",
    "Composition and format: respect the selected aspect ratio, keep the main subject within safe margins, avoid unwanted cropping, and maintain coherent lighting and focus throughout the clip.",
    "Clean output: no subtitles, captions, prompt text, watermarks, logos, UI, split screens, contact sheets, storyboard panels, collages, or multiple unrelated scenes.",
    "Final quality checklist: stable identity, natural body proportions, smooth continuous motion, coherent camera movement, sharp focal subject, consistent lighting, no freeze frames, no looped stills, no ignored frames, no visible artifacts."
  ].join("\n");
}

function _buildVideoReferenceContractPrompt(params: {
  frameAssets: ImageInputAsset[];
  userNote: string;
}) {
  if (!params.frameAssets.length) return "";
  return [
    "Video reference contract: the selected frame images are binding source resources, not loose inspiration and not a generic style prompt.",
    "Resource priority: frame image content defines visible source subjects and scene facts; explicit user direction wins over theme direction for action, relationship, subject interaction, pose, camera transition, and story beat.",
    "If wording conflicts with what is visible in the frames for identity, wardrobe, props, or physical scene facts, follow the frames.",
    params.frameAssets.length > 1
      ? "Cast continuity is mandatory: treat the ordered frames as the cast list. Frame 1 subject is Character A, Frame 2 subject is Character B, and additional frames provide additional cast or scene cues. Keep those uploaded people as the visible people in the video; do not recast them as different-looking actors."
      : "Cast continuity is mandatory: the main visible person or product must remain the uploaded subject, not a newly cast lookalike.",
    "Preserve visible subject count, primary person or product, face shape, apparent age range, skin tone, hair color and hairstyle, wardrobe colors, props, background cues, lighting direction, camera angle, and orientation from the frame images.",
    "Do not replace the source subject with a generic actor, change defining visible traits, change blonde hair to brunette, invent a couple or extra people, duplicate subjects, or move the result into an unrelated holiday, wedding, travel, studio, or lifestyle template unless the source frames show it or the user explicitly asks for it.",
    "If the provider cannot complete the exact requested action from the references, keep the uploaded subjects and simplify the motion. Never solve a difficult request by ignoring the reference images.",
    "Theme direction may add motion texture, mood, camera behavior, and small scene dynamics only after the frame resources and explicit user direction are satisfied.",
    params.userNote ? `Mandatory user direction inside this reference contract: ${params.userNote}` : ""
  ].filter(Boolean).join("\n");
}

function buildExplicitUserDirectionPrompt(userNote: string, frameCount: number) {
  if (!userNote) return "";
  return [
    `Highest priority user direction: ${userNote}`,
    "Follow the explicit requested subject count, relationship, action, pose, camera transition, and story beat before any video theme wording.",
    frameCount > 1
      ? "When the user asks for a couple, kiss, embrace, side-profile interaction, conversation, handoff, group shot, or other relationship/action scene, combine the selected people from the ordered frames into one coherent scene. Do not output only one person."
      : "",
    "Do not replace the requested action with walking, generic portrait motion, holiday posing, or unrelated lifestyle action unless the user asked for it."
  ].filter(Boolean).join("\n");
}

function userRequestsOpeningPortraitSequence(userNote: string) {
  const normalized = userNote.trim().toLowerCase();
  if (!normalized) return false;
  const hasOpeningCue = /start|begin|opening|first|initial|at the beginning|首帧|开头|开始|起始|一开始|先|首先|第一/.test(normalized);
  const hasPortraitCue = /portrait|front[-\s]?facing|frontal|face[-\s]?forward|faces? visible|正面|肖像|人物肖像|头像|面向镜头|看向镜头/.test(normalized);
  const hasTransitionCue = /then|after|transition|turn|later|kiss|embrace|interaction|然后|随后|再|之后|转向|转身|接吻|亲吻|拥抱/.test(normalized);
  return hasOpeningCue && hasPortraitCue && hasTransitionCue;
}

function buildOpeningPortraitStarterScenePrompt(userNote: string, frameCount: number) {
  if (!userRequestsOpeningPortraitSequence(userNote)) return "";
  return [
    "Opening-beat lock for the starter scene: this starter image represents only the first visible moment requested by the user, not a summary of the full sequence.",
    frameCount > 1
      ? "Show the selected people together with both faces portrait-readable and front-facing enough to identify Character A and Character B."
      : "Show the selected subject in a portrait-readable and front-facing opening pose.",
    "Do not depict the later interaction in the starter image. If the note says they later turn, kiss, embrace, or interact, stage them before that action starts, with natural spacing and pose cues that can animate into it."
  ].join("\n");
}

function _buildOpeningPortraitVideoPrompt(userNote: string) {
  if (!userRequestsOpeningPortraitSequence(userNote)) return "";
  return [
    "Opening sequence lock: begin with the opening portrait beat requested by the user. The first visible moments should show clear portrait-readable and front-facing faces before any turn, kiss, embrace, or side-profile interaction.",
    "Treat the turn, kiss, embrace, or interaction as the later motion beat, not as the first frame."
  ].join("\n");
}

function isDirectWorkspaceVideo(payload: WorkerPayload) {
  const params = recordValue(payload.params);
  return recordValue(params?.workspace)?.direct === true;
}

function buildMinimalVideoProviderPrompt(
  payload: WorkerPayload,
  referenceAssets = videoFrameAssets(payload),
  videoParams?: { aspect_ratio?: string; duration?: string; resolution?: string }
) {
  // A direct workspace job carries the customer's complete prompt. Do not add
  // theme direction, reference instructions, format sentences or constraints.
  if (isDirectWorkspaceVideo(payload)) return videoProviderUserPrompt(payload);
  return buildMinimalVideoProviderPromptText({
    aspectRatio: videoParams?.aspect_ratio,
    duration: videoParams?.duration,
    resolution: videoParams?.resolution,
    themePrompt: videoProviderThemePrompt(payload),
    userPrompt: videoProviderUserPrompt(payload),
    referenceCount: referenceAssets.length
  });
}

function buildVideoPrompt(payload: WorkerPayload, referenceAssets = videoFrameAssets(payload), videoParams?: { aspect_ratio?: string; duration?: string; resolution?: string }) {
  return buildMinimalVideoProviderPrompt(payload, referenceAssets, videoParams);
}

function buildLk888MediaVideoPrompt(payload: WorkerPayload, referenceAssets = videoFrameAssets(payload), videoParams?: { aspect_ratio?: string; duration?: string; resolution?: string }) {
  return buildMinimalVideoProviderPrompt(payload, referenceAssets, videoParams);
}

function buildSingleReferenceDirectJsonVideoPrompt(payload: WorkerPayload, referenceAssets = videoFrameAssets(payload), videoParams?: { aspect_ratio?: string; duration?: string; resolution?: string }) {
  return buildMinimalVideoProviderPrompt(payload, referenceAssets, videoParams);
}

function buildDirectJsonVideoPrompt(payload: WorkerPayload, referenceAssets = videoFrameAssets(payload), videoParams?: { aspect_ratio?: string; duration?: string; resolution?: string }) {
  return buildMinimalVideoProviderPrompt(payload, referenceAssets, videoParams);
}

function buildOpenAiJsonVideoPrompt(payload: WorkerPayload, referenceAssets = videoFrameAssets(payload), videoParams?: { aspect_ratio?: string; duration?: string; resolution?: string }) {
  return referenceAssets.length === 1
    ? buildSingleReferenceDirectJsonVideoPrompt(payload, referenceAssets, videoParams)
    : buildDirectJsonVideoPrompt(payload, referenceAssets, videoParams);
}

function buildTextToVideoPrompt(payload: WorkerPayload, videoParams?: { aspect_ratio?: string; duration?: string; resolution?: string }) {
  return buildMinimalVideoProviderPrompt(payload, [], videoParams);
}

function buildVideoSceneImagePrompt(payload: WorkerPayload, frameAssets: ImageInputAsset[]) {
  const fields = recordValue(payload.params.fields);
  const videoParams = videoProviderParams(payload);
  const themeName = textValue(fields?.videoThemeName) || textValue(fields?.toolPresetTitle);
  const themePrompt = textValue(fields?.videoThemePrompt);
  const userNote = textValue(fields?.promptNote) || textValue(fields?.prompt);
  const frameManifest = frameAssets.length
    ? [
        `Selected source frame order (${frameAssets.length} total):`,
        ...frameAssets.map((asset, index) => `Frame ${index + 1}: assetId=${asset.assetId}. ${index === 0 ? "Use as the opening visual anchor." : "Represent its important subject, wardrobe, prop, scene, and lighting cues inside the new starter scene."}`)
      ].join("\n")
    : "";
  return [
    "Internal video scene compositor: create exactly one new photorealistic starter scene image that will be used as the only upstream image-to-video reference.",
    "Skill-pack starter quality: compose a first-frame hook with environmental pressure, physical micro-action cues, a sound or visual motif, and a clear final frame the video can animate toward.",
    buildOpeningPortraitStarterScenePrompt(userNote, frameAssets.length),
    buildExplicitUserDirectionPrompt(userNote, frameAssets.length),
    "Identity preservation is the highest requirement for this starter image. Use the uploaded frame images as binding character references, not as loose mood references.",
    "Combine the selected user-uploaded frame images and the user direction into one coherent camera-ready scene. Use the internal theme direction only as a low-priority style fallback.",
    "This must be a single finished scene image, not a collage, contact sheet, storyboard, split panel, grid, before/after layout, poster with text, UI, or watermark.",
    `Target video format: ${videoParams.aspect_ratio} ${videoParams.resolution.toUpperCase()}, ${videoParams.duration} seconds. Compose the still so it can naturally animate as one continuous clip.`,
    userNote ? `User direction: ${userNote}` : "",
    themeName ? `Internal fallback video preset: ${themeName}` : "",
    themePrompt ? `Optional preset style, ignore if it conflicts with the user direction or selected frames: ${themePrompt}` : "",
    frameManifest,
    "Preserve the important visible people, face and body cues, apparent age range, skin tone, hair, wardrobe colors, products, props, lighting direction, camera angle, and background cues from the source frames.",
    frameAssets.length > 1 ? "Cast continuity is mandatory: Frame 1 subject is Character A, Frame 2 subject is Character B. Keep those uploaded people as the people in the composed starter scene; do not recast them as different-looking actors." : "",
    frameAssets.length > 1 ? "Do not average the two faces, swap genders, change hair color, change hairstyle, change apparent ethnicity, change apparent age range, or replace either character with a generic couple model." : "",
    frameAssets.length > 1 ? "If the requested action is difficult, simplify the action while preserving the uploaded character identities. Identity preservation beats dramatic kissing pose, background, wardrobe changes, and preset style." : "",
    "Starter scene must match the requested opening beat. If the user asks to begin with clear portraits and then transition to a side-profile interaction, compose a clear portrait-ready scene with the selected subjects present and staged for that transition.",
    "When multiple frames show different people or objects, arrange them naturally in one believable scene when the selected frames or user direction imply they should coexist. Do not output only one person when the user requested a two-person scene.",
    "If some frames represent later visual beats, blend those cues into the scene as environmental, pose, wardrobe, prop, or motion-ready details without creating multiple panels.",
    "Do not replace the requested action with walking, generic portrait posing, holiday posing, or unrelated lifestyle action unless the user asked for it.",
    "Create a clean starter frame with stable anatomy, natural hands, realistic face structure, sharp focal subject, coherent depth, and safe margins for the selected aspect ratio."
  ].filter(Boolean).join("\n\n").slice(0, 4300);
}

function inputAssets(payload: WorkerPayload): ImageInputAsset[] {
  return payload.inputAssets.filter((asset) => asset.assetId !== "asset_demo" && asset.signedUrl.trim());
}

function isAudioReferenceAsset(asset: { mimeType?: string | null }): boolean {
  return String(asset.mimeType ?? "").toLowerCase().startsWith("audio/");
}

// Audio references ride along with video jobs but must never enter the image
// frame pipeline (frame limits, URI preparation, and resizing assume images).
function videoAudioAssets(payload: WorkerPayload): ImageInputAsset[] {
  return inputAssets(payload).filter((asset) => isAudioReferenceAsset(asset));
}

function videoFrameAssets(payload: WorkerPayload): ImageInputAsset[] {
  const fields = recordValue(payload.params.fields);
  const maxFrames = normalizeVideoFrameLimit(fields?.maxFrames ?? payload.params.maxFrames);
  return inputAssets(payload).filter((asset) => !isAudioReferenceAsset(asset)).slice(0, maxFrames);
}

// Reads the provider task persisted by a previous run of this job so a
// re-dispatch (boot recovery after a release restart) can resume polling the
// still-executing upstream task instead of paying for a second one.
async function videoProviderTaskIdForResume(payload: WorkerPayload): Promise<string> {
  const job = await prisma.generationJob.findUnique({ where: { id: payload.jobId }, select: { resultJson: true } });
  const result = job?.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson)
    ? job.resultJson as Record<string, unknown>
    : {};
  if (typeof result.providerTaskId === "string" && result.providerTaskId.trim()) return result.providerTaskId.trim();
  const slots = Array.isArray(result.outputSlots) ? result.outputSlots : [];
  for (const slot of slots) {
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue;
    const slotTaskId = (slot as Record<string, unknown>).providerTaskId;
    if (typeof slotTaskId === "string" && slotTaskId.trim()) return slotTaskId.trim();
  }
  return "";
}

function providerReachableAssetUrl(asset: ImageInputAsset) {
  return textValue(asset.publicUrl) || asset.signedUrl;
}

function shouldUseVideoFrameDataUriFallback() {
  const explicit = process.env.AI_WORKER_VIDEO_FRAME_DATA_URLS?.trim();
  if (explicit === "1") return true;
  if (explicit === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function shouldForceVideoFrameDataUris() {
  return process.env.AI_WORKER_VIDEO_FRAME_DATA_URLS?.trim() === "1";
}

function videoFrameDataUriMaxBytes() {
  const configured = Number(process.env.AI_WORKER_VIDEO_FRAME_DATA_URI_MAX_BYTES ?? "");
  return Number.isFinite(configured) && configured > 0 ? configured : 8 * 1024 * 1024;
}

async function isProviderFrameUrlReadable(url: string, timeoutMs: number, signal?: AbortSignal) {
  try {
    const response = await fetchWithTimeout(url, { method: "HEAD", cache: "no-store", signal }, Math.min(timeoutMs, 10_000), "ai_provider_video_frame_probe_timeout");
    return response.ok;
  } catch {
    return false;
  }
}

async function readVideoFrameAssetBytes(asset: ImageInputAsset, timeoutMs: number, signal?: AbortSignal) {
  throwIfLocalWorkerAborted(signal);
  const storageKey = textValue(asset.storageKey);
  if (storageKey) {
    try {
      const filePath = customerAssetFilePath(storageKey);
      const bytes = Buffer.from(await readFile(filePath));
      if (bytes.length) {
        return {
          bytes,
          mimeType: textValue(asset.mimeType) || contentTypeForCustomerAssetPath(filePath)
        };
      }
    } catch {
      // Fall back to the signed download URL when the local shared file is not present.
    }
  }
  const response = await fetchWithTimeout(
    asset.signedUrl,
    { cache: "no-store", signal },
    Math.min(timeoutMs, 30_000),
    `ai_provider_video_frame_data_uri_timeout_${asset.assetId}`
  );
  if (!response.ok) throw new Error(`ai_provider_video_frame_data_uri_source_failed_${asset.assetId}_${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`ai_provider_video_frame_data_uri_empty_${asset.assetId}`);
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || textValue(asset.mimeType) || "image/png";
  return { bytes, mimeType };
}

async function videoFrameDataUri(asset: ImageInputAsset, timeoutMs: number, signal?: AbortSignal) {
  const { bytes, mimeType } = await readVideoFrameAssetBytes(asset, timeoutMs, signal);
  const maxBytes = videoFrameDataUriMaxBytes();
  let prepared = originalVideoReferenceImage(bytes, imageMimeTypeFromBytes(bytes, mimeType));
  let preparedBytes = Buffer.from(prepared.bytes);
  if (preparedBytes.length > maxBytes) {
    prepared = await prepareVideoReferenceImage(bytes, mimeType, undefined, { forceCompression: true, fallbackToOriginal: false });
    preparedBytes = Buffer.from(prepared.bytes);
  }
  if (preparedBytes.length > maxBytes) throw new Error(`ai_provider_video_frame_data_uri_too_large_${asset.assetId}_${preparedBytes.length}_${maxBytes}`);
  return `data:${prepared.mimeType};base64,${preparedBytes.toString("base64")}`;
}

async function videoFramePreparedDataUri(asset: ImageInputAsset, timeoutMs: number, targetSize: string, signal?: AbortSignal) {
  const { bytes, mimeType } = await readVideoFrameAssetBytes(asset, timeoutMs, signal);
  const maxBytes = videoFrameDataUriMaxBytes();
  let prepared = await prepareVideoReferenceImage(bytes, mimeType, targetSize);
  let preparedBytes = Buffer.from(prepared.bytes);
  if (preparedBytes.length > maxBytes && !shouldCompressVideoReferenceImages()) {
    prepared = await prepareVideoReferenceImage(bytes, mimeType, targetSize, { forceCompression: true, fallbackToOriginal: false });
    preparedBytes = Buffer.from(prepared.bytes);
  }
  if (preparedBytes.length > maxBytes) throw new Error(`ai_provider_video_frame_data_uri_too_large_${asset.assetId}_${preparedBytes.length}_${maxBytes}`);
  return `data:${prepared.mimeType};base64,${preparedBytes.toString("base64")}`;
}

async function videoProviderFrameUrls(params: {
  referenceAssets: ImageInputAsset[];
  allowDataUriFallback?: boolean;
  signal?: AbortSignal;
  timeoutMs: number;
  targetSize?: string;
}) {
  throwIfLocalWorkerAborted(params.signal);
  const urls = params.referenceAssets.map(providerReachableAssetUrl).filter(Boolean);
  if (urls.length !== params.referenceAssets.length) return urls;
  if (params.allowDataUriFallback === false || !shouldUseVideoFrameDataUriFallback()) return urls;
  if (shouldForceVideoFrameDataUris()) {
    return Promise.all(params.referenceAssets.map((asset) => params.targetSize
      ? videoFramePreparedDataUri(asset, params.timeoutMs, params.targetSize, params.signal)
      : videoFrameDataUri(asset, params.timeoutMs, params.signal)));
  }
  const readableChecks = await Promise.all(urls.map((url) => isProviderFrameUrlReadable(url, params.timeoutMs, params.signal)));
  if (readableChecks.every(Boolean)) return urls;
  return Promise.all(params.referenceAssets.map((asset) => params.targetSize
    ? videoFramePreparedDataUri(asset, params.timeoutMs, params.targetSize, params.signal)
    : videoFrameDataUri(asset, params.timeoutMs, params.signal)));
}

function videoProviderPreparedDataUriFrameUrls(params: {
  referenceAssets: ImageInputAsset[];
  signal?: AbortSignal;
  timeoutMs: number;
  targetSize: string;
}) {
  throwIfLocalWorkerAborted(params.signal);
  return Promise.all(params.referenceAssets.map((asset) => videoFramePreparedDataUri(asset, params.timeoutMs, params.targetSize, params.signal)));
}

function isDataUri(value: string) {
  return value.startsWith("data:");
}

function shouldRetryVideoTaskWithDataUriFrames(params: {
  error: unknown;
  imageUrls: string[];
  protocol: VideoProviderProtocol;
}) {
  if (process.env.LOCAL_AI_WORKER_ALLOW_PAID_VIDEO_RETRIES !== "1") return false;
  if (params.protocol === "openai-videos") return false;
  if (!params.imageUrls.length || params.imageUrls.every(isDataUri)) return false;
  if (process.env.AI_WORKER_VIDEO_FRAME_DATA_URLS?.trim() === "0") return false;

  const message = errorMessage(params.error).toLowerCase();
  return message.includes("ai_provider_video_failed") ||
    message.includes("ai_provider_video_create_failed") ||
    message.includes("fetch failed") ||
    message.includes("could not read") ||
    message.includes("read the selected frame") ||
    message.includes("public asset url") ||
    (message.includes("image") && (message.includes("url") || message.includes("read") || message.includes("fetch")));
}

function isLoopbackUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]";
  } catch {
    return true;
  }
}

function shouldRejectLoopbackVideoFrameUrls() {
  if (process.env.ALLOW_LOOPBACK_VIDEO_FRAME_URLS === "1") return false;
  if (process.env.REQUIRE_PUBLIC_VIDEO_FRAME_URLS === "1") return true;
  return process.env.NODE_ENV === "production";
}

function assertTokengoMediaPublicFrameUrls(protocol: VideoProviderProtocol, imageUrls: string[]) {
  if (protocol !== "tokengo-media" || !imageUrls.length) return;
  if (imageUrls.some((url) => isDataUri(url) || isLoopbackUrl(url))) {
    throw new Error("video_public_asset_url_required_tokengo_media");
  }
}

const videoAspectRatios = new Set(["16:9", "4:3", "1:1", "3:4", "9:16", "3:2", "2:3"]);
const videoResolutions = new Set(VIDEO_RESOLUTIONS);

function videoSizeForParams(aspectRatio: string, resolution: string) {
  const shortEdge = Number(normalizeVideoResolution(resolution).replace("p", ""));
  const longEdge = Math.round(shortEdge * 16 / 9);
  if (aspectRatio === "4:3") return `${Math.round(shortEdge * 4 / 3)}x${shortEdge}`;
  if (aspectRatio === "3:4") return `${shortEdge}x${Math.round(shortEdge * 4 / 3)}`;
  if (aspectRatio === "9:16" || aspectRatio === "2:3") return `${shortEdge}x${longEdge}`;
  if (aspectRatio === "1:1") return `${shortEdge}x${shortEdge}`;
  return `${longEdge}x${shortEdge}`;
}

function openAiVideoProviderSize(params: { aspect_ratio: string; resolution: string; size: string }) {
  const supportedExactSizes = new Set(["720x1280", "1280x720", "1024x1792", "1792x1024"]);
  if (supportedExactSizes.has(params.size)) return params.size;
  return params.resolution;
}

function smartPickLidJsonVideoResolution(resolution: string) {
  return normalizeVideoResolution(resolution);
}

function lk888MediaVideoResolution(resolution: string) {
  return normalizeVideoResolution(resolution);
}

function lk888MediaVideoAspectRatio(aspectRatio: string) {
  if (aspectRatio === "4:3") return "3:2";
  if (aspectRatio === "3:4") return "2:3";
  return new Set(["16:9", "9:16", "1:1", "3:2", "2:3"]).has(aspectRatio) ? aspectRatio : "16:9";
}

function lk888MediaImagesPayload(imageUrls: string[]) {
  if (imageUrls.length <= 1) return imageUrls[0] ?? "";
  return imageUrls;
}

function lk888MediaVideoParams(videoParams: { aspect_ratio: string; resolution: string; duration: string }, imageUrls: string[]) {
  return {
    ...(imageUrls.length ? { images: lk888MediaImagesPayload(imageUrls) } : {}),
    aspect_ratio: lk888MediaVideoAspectRatio(videoParams.aspect_ratio),
    resolution: lk888MediaVideoResolution(videoParams.resolution),
    duration: videoParams.duration
  };
}

function openAiVideoRequestSize(params: { aspect_ratio: string; resolution: string; size: string }, options?: { smartPickLidJson?: boolean }) {
  return options?.smartPickLidJson ? params.size : openAiVideoProviderSize(params);
}

function openAiVideoReferenceTargetSize(params: { aspect_ratio: string; resolution: string; size: string }, options?: { smartPickLidJson?: boolean }) {
  const requestSize = openAiVideoRequestSize(params, options);
  return parseVideoPixelSize(requestSize) ? requestSize : params.size;
}

function parseVideoPixelSize(value: string) {
  const match = /^(\d{2,5})x(\d{2,5})$/.exec(value.trim());
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
  return { width, height };
}

function videoProviderParams(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields);
  const modelPreference = requestedVideoModelPreference(payload);
  const rawAspectRatio = textValue(payload.params.aspect_ratio) || textValue(payload.params.aspectRatio) || textValue(fields?.aspect_ratio) || textValue(fields?.aspectRatio);
  const rawResolution = textValue(payload.params.resolution) || textValue(fields?.resolution);
  const rawDuration = textValue(payload.params.durationSeconds) || textValue(payload.params.videoDurationSeconds) || textValue(payload.params.duration) || textValue(payload.params.videoDuration) || textValue(fields?.durationSeconds) || textValue(fields?.videoDurationSeconds) || textValue(fields?.duration) || textValue(fields?.videoDuration);
  const aspect_ratio = videoAspectRatios.has(rawAspectRatio) ? rawAspectRatio : "16:9";
  const resolution = videoResolutions.has(rawResolution as typeof VIDEO_RESOLUTIONS[number])
    ? rawResolution as typeof VIDEO_RESOLUTIONS[number]
    : normalizeVideoResolution(rawResolution);
  // A direct workspace job may use a provider tier above the shared 15s cap
  // (the Aidreamcapes provider declares 15 and 30). Pass that tier through.
  const directWorkspaceJob = recordValue(payload.params.workspace)?.direct === true;
  const requestedDuration = Number(rawDuration);
  const duration = String(directWorkspaceJob && [15, 30].includes(requestedDuration)
    ? requestedDuration
    : normalizeVideoDurationSeconds(rawDuration, undefined, modelPreference));
  return { aspect_ratio, resolution, duration, size: videoSizeForParams(aspect_ratio, resolution) };
}

function explicitVideoEndImageUrl(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields);
  return textValue(payload.params.end_image_url) ||
    textValue(payload.params.endImageUrl) ||
    textValue(fields?.end_image_url) ||
    textValue(fields?.endImageUrl);
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "png";
}

function imageMimeTypeFromBytes(bytes: Uint8Array, fallbackMimeType: string) {
  const fallback = fallbackMimeType.split(";")[0]?.trim().toLowerCase() || "";
  if (fallback.startsWith("image/") && fallback !== "image/svg+xml") return fallback;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) return "image/webp";
  return "image/png";
}

async function prepareProviderImage(bytes: Uint8Array, mimeType: string) {
  if (mimeType.includes("gif")) return { bytes: blobPartFromBytes(Buffer.from(bytes)), mimeType };
  if (!shouldUseSharpForWorkerImages()) return { bytes: blobPartFromBytes(Buffer.from(bytes)), mimeType };
  const maxDimension = Math.max(512, Number(process.env.LOCAL_AI_WORKER_REFERENCE_MAX_DIMENSION ?? "1600") || 1600);
  const quality = Math.max(60, Math.min(Number(process.env.LOCAL_AI_WORKER_REFERENCE_QUALITY ?? "82") || 82, 95));
  try {
    const sharp = await loadSharp();
    if (!sharp) throw new Error("sharp_unavailable");
    const resized = await sharp(Buffer.from(bytes))
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return { bytes: blobPartFromBytes(resized), mimeType: "image/jpeg" };
  } catch {
    return { bytes: blobPartFromBytes(Buffer.from(bytes)), mimeType };
  }
}

function shouldCompressVideoReferenceImages() {
  const explicit = process.env.LOCAL_AI_WORKER_VIDEO_REFERENCE_COMPRESSION?.trim();
  return explicit === "1";
}

function shouldAllowUnresizedVideoReferenceFallback() {
  return process.env.LOCAL_AI_WORKER_VIDEO_REFERENCE_REQUIRE_RESIZE?.trim() !== "1";
}

function shouldFallbackUnresizedVideoReferenceImage(_error: unknown) {
  return shouldAllowUnresizedVideoReferenceFallback();
}

function originalVideoReferenceImage(bytes: Uint8Array, mimeType: string) {
  return {
    bytes: blobPartFromBytes(Buffer.from(bytes)),
    mimeType
  };
}

async function resizeVideoReferenceToTargetCanvas(
  sharp: SharpFactory,
  bytes: Buffer,
  target: { width: number; height: number },
  quality: number
) {
  const jpegOptions = { quality, mozjpeg: true };
  const background = await sharp(bytes)
    .rotate()
    .resize({ width: target.width, height: target.height, fit: "cover", position: "attention" })
    .blur(24)
    .modulate({ brightness: 0.72, saturation: 0.82 })
    .jpeg(jpegOptions)
    .toBuffer();
  const foreground = await sharp(bytes)
    .rotate()
    .resize({ width: target.width, height: target.height, fit: "inside" })
    .jpeg(jpegOptions)
    .toBuffer();
  return sharp(background)
    .composite([{ input: foreground, gravity: "center" }])
    .jpeg(jpegOptions)
    .toBuffer();
}

async function resizeVideoReferenceToTargetCanvasWithFfmpeg(
  bytes: Buffer,
  mimeType: string,
  target: { width: number; height: number },
  quality: number
) {
  const ffmpegExecutable = ffmpegExecutablePath();
  if (!ffmpegExecutable) throw new Error("ffmpeg_unavailable");
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "mydreamshoots-video-reference-"));
  try {
    const inputPath = path.join(tmpDir, `input.${extensionForMime(mimeType)}`);
    const outputPath = path.join(tmpDir, "output.jpg");
    const qscale = String(Math.max(2, Math.min(8, Math.round((100 - quality) / 5))));
    const filter = `[0:v]scale=${target.width}:${target.height}:force_original_aspect_ratio=increase,crop=${target.width}:${target.height},boxblur=24:1,eq=brightness=-0.08:saturation=0.82[bg];[0:v]scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuvj420p`;
    await writeFile(inputPath, bytes);
    await execFileAsync(
      ffmpegExecutable,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-filter_complex",
        filter,
        "-frames:v",
        "1",
        "-q:v",
        qscale,
        outputPath
      ],
      { timeout: Math.max(5_000, Number(process.env.LOCAL_AI_WORKER_VIDEO_REFERENCE_FFMPEG_TIMEOUT_MS ?? "15000") || 15_000) }
    );
    return await readFile(outputPath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function prepareVideoReferenceImage(
  bytes: Uint8Array,
  mimeType: string,
  targetSize?: string,
  options: { forceCompression?: boolean; fallbackToOriginal?: boolean } = {}
) {
  const sourceMimeType = imageMimeTypeFromBytes(bytes, mimeType);
  const target = targetSize ? parseVideoPixelSize(targetSize) : undefined;
  const shouldPrepare = options.forceCompression === true || Boolean(target) || shouldCompressVideoReferenceImages();
  if (!shouldPrepare) {
    return originalVideoReferenceImage(bytes, sourceMimeType);
  }
  const maxDimension = Math.max(512, Number(process.env.LOCAL_AI_WORKER_VIDEO_REFERENCE_MAX_DIMENSION ?? "1280") || 1280);
  const quality = Math.max(60, Math.min(Number(process.env.LOCAL_AI_WORKER_VIDEO_REFERENCE_QUALITY ?? "80") || 80, 95));
  try {
    const sharp = shouldUseSharpForVideoReferenceImages() ? await loadSharp() : undefined;
    if (!sharp) throw new Error("sharp_unavailable");
    const sourceBytes = Buffer.from(bytes);
    const resized = target
      ? await resizeVideoReferenceToTargetCanvas(sharp, sourceBytes, target, quality)
      : await sharp(sourceBytes)
        .rotate()
        .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
    if (!resized.length) throw new Error("empty_video_reference_image");
    return { bytes: blobPartFromBytes(resized), mimeType: "image/jpeg" };
  } catch (error) {
    if (target) {
      try {
        const resized = await resizeVideoReferenceToTargetCanvasWithFfmpeg(Buffer.from(bytes), sourceMimeType, target, quality);
        if (!resized.length) throw new Error("empty_video_reference_image");
        return { bytes: blobPartFromBytes(resized), mimeType: "image/jpeg" };
      } catch (fallbackError) {
        console.warn("video_reference_resize_ffmpeg_fallback_failed", {
          targetSize: `${target.width}x${target.height}`,
          sharpError: errorMessage(error).slice(0, 160),
          error: errorMessage(fallbackError).slice(0, 160)
        });
      }
      if (options.fallbackToOriginal === true && shouldFallbackUnresizedVideoReferenceImage(error)) {
        console.warn("video_reference_resize_fallback", {
          targetSize: `${target.width}x${target.height}`,
          error: errorMessage(error).slice(0, 160)
        });
        return originalVideoReferenceImage(bytes, sourceMimeType);
      }
      throw error instanceof Error ? new Error(`ai_provider_video_reference_resize_failed_${target.width}x${target.height}_${error.message}`) : new Error(`ai_provider_video_reference_resize_failed_${target.width}x${target.height}`);
    }
    if (options.fallbackToOriginal === false) {
      throw error instanceof Error ? new Error(`ai_provider_video_reference_compression_failed_${error.message}`) : new Error("ai_provider_video_reference_compression_failed");
    }
    return originalVideoReferenceImage(bytes, sourceMimeType);
  }
}

function blobPartFromBytes(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

let providerProxyDispatcher:
  | {
    proxyUrl: string;
    dispatcher: unknown;
  }
  | undefined;
let providerProxyAvailability:
  | {
    proxyUrl: string;
    checkedAt: number;
    reachable: boolean;
  }
  | undefined;

function providerProxyUrl() {
  return (
    process.env.AI_WORKER_HTTP_PROXY ||
    process.env.AI_WORKER_HTTPS_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    ""
  ).trim();
}

function shouldProxyFetch(resource: string, proxyUrl = providerProxyUrl()) {
  if (!proxyUrl) return false;
  try {
    const url = new URL(resource);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function getProviderProxyDispatcher() {
  const proxyUrl = providerProxyUrl();
  if (!proxyUrl) return undefined;
  if (providerProxyDispatcher?.proxyUrl === proxyUrl) return providerProxyDispatcher.dispatcher;
  const moduleName = "undici";
  const { ProxyAgent } = (await import(/* webpackIgnore: true */ moduleName)) as typeof import("undici");
  const dispatcher = new ProxyAgent(proxyUrl);
  providerProxyDispatcher = { proxyUrl, dispatcher };
  return dispatcher;
}

function loopbackProxyHost(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");
    if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) return undefined;
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    return Number.isFinite(port) && port > 0 ? { hostname, port } : undefined;
  } catch {
    return undefined;
  }
}

function isLoopbackProxyUrl(value: string) {
  return Boolean(loopbackProxyHost(value));
}

async function isConfiguredLoopbackProxyReachable(proxyUrl: string) {
  const target = loopbackProxyHost(proxyUrl);
  if (!target) return true;
  const now = Date.now();
  const cacheMs = Math.max(1_000, Math.min(Number(process.env.AI_WORKER_PROXY_PROBE_CACHE_MS ?? "10000") || 10_000, 60_000));
  if (providerProxyAvailability?.proxyUrl === proxyUrl && now - providerProxyAvailability.checkedAt < cacheMs) {
    return providerProxyAvailability.reachable;
  }
  const timeoutMs = Math.max(50, Math.min(Number(process.env.AI_WORKER_PROXY_PROBE_TIMEOUT_MS ?? "250") || 250, 2_000));
  const { connect } = await import("node:net");
  const reachable = await new Promise<boolean>((resolve) => {
    const socket = connect({ host: target.hostname, port: target.port });
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
  providerProxyAvailability = { proxyUrl, checkedAt: now, reachable };
  return reachable;
}

function isCreateLikeFetch(init: RequestInit) {
  const method = (init.method ?? "GET").trim().toUpperCase();
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function shouldRetryProviderFetchWithoutProxy(error: unknown, proxyUrl: string, init: RequestInit) {
  if (process.env.AI_WORKER_DISABLE_PROXY_FALLBACK === "1" || !isLoopbackProxyUrl(proxyUrl)) return false;
  if (isCreateLikeFetch(init) && process.env.AI_WORKER_ALLOW_PAID_CREATE_PROXY_FALLBACK !== "1") return false;
  let proxy: URL;
  try {
    proxy = new URL(proxyUrl);
  } catch {
    return false;
  }
  const message = errorMessage(error).toLowerCase();
  const proxyHost = proxy.hostname.toLowerCase();
  const proxyPort = proxy.port;
  const pointsAtProxy = message.includes(proxyHost) || Boolean(proxyPort && message.includes(proxyPort));
  const connectionInterrupted = message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("socket") ||
    message.includes("terminated") ||
    message.includes("socket hang up") ||
    message.includes("read reset") ||
    message.includes("connection reset");
  return connectionInterrupted && (pointsAtProxy || isLoopbackProxyUrl(proxyUrl));
}

async function fetchWithTimeout(resource: string, init: RequestInit, timeoutMs: number, timeoutError: string) {
  throwIfLocalWorkerAborted(init.signal ?? undefined);
  const controller = new AbortController();
  const externalSignal = init.signal ?? undefined;
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  const proxyUrl = providerProxyUrl();
  const runFetch = async (dispatcher?: unknown) => {
    const fetchInit: FetchInitWithDispatcher = {
      ...init,
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {})
    };
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fetch(resource, fetchInit),
        new Promise<Response>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error(timeoutError));
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
  try {
    const dispatcher = shouldProxyFetch(resource, proxyUrl) && await isConfiguredLoopbackProxyReachable(proxyUrl)
      ? await getProviderProxyDispatcher()
      : undefined;
    try {
      return await runFetch(dispatcher);
    } catch (error) {
      throwIfLocalWorkerAborted(externalSignal);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(timeoutError);
      }
      if (dispatcher && shouldRetryProviderFetchWithoutProxy(error, proxyUrl, init)) {
        throwIfLocalWorkerAborted(externalSignal);
        return await runFetch();
      }
      throw error;
    }
  } catch (error) {
    throwIfLocalWorkerAborted(externalSignal);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(timeoutError);
    }
    throw error;
  } finally {
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

function imageEditFormFieldName(_totalAssets: number) {
  const mode = process.env.LOCAL_AI_WORKER_IMAGE_FIELD_MODE?.trim();
  if (mode === "repeated-image") return "image";
  if (mode === "image-array") return "image[]";
  return "image";
}

async function buildImageEditForm(params: {
  payload: WorkerPayload;
  model: string;
  prompt: string;
  signal?: AbortSignal;
  timeoutMs: number;
  outputCount?: number;
  assets?: ImageInputAsset[];
}) {
  throwIfLocalWorkerAborted(params.signal);
  const form = new FormData();
  form.append("model", params.model);
  form.append("prompt", params.prompt);
  form.append("size", process.env.LOCAL_AI_WORKER_IMAGE_SIZE ?? "1024x1024");
  form.append("quality", process.env.LOCAL_AI_WORKER_IMAGE_QUALITY ?? "low");
  form.append("response_format", "b64_json");
  if (params.outputCount && params.outputCount > 1) {
    form.append("n", String(params.outputCount));
  }

  const assets = params.assets ?? providerInputAssets(params.payload);
  if (!assets.length) return undefined;
  const imageFieldName = imageEditFormFieldName(assets.length);
  const roles = referenceRoles(params.payload);

  for (const [index, asset] of assets.entries()) {
    const role = roles.roleFor(asset.assetId);
    const response = await fetchWithTimeout(
      asset.signedUrl,
      { cache: "no-store", signal: params.signal },
      Math.min(params.timeoutMs, 30_000),
      `ai_provider_source_image_timeout_${asset.assetId}`
    );
    if (!response.ok) {
      throw new Error(`ai_provider_source_image_failed_${asset.assetId}_${response.status}`);
    }
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const bytes = new Uint8Array(await response.arrayBuffer());
    const prepared = await prepareProviderImage(bytes, mimeType);
    const roleLabel = referenceRoleLabel(role).toLowerCase();
    const fileLabel = videoFrameReferenceFileLabel(params.payload, asset.assetId, roleLabel);
    form.append(imageFieldName, new Blob([prepared.bytes], { type: prepared.mimeType }), `reference-${index + 1}-${fileLabel}-${asset.assetId}.${extensionForMime(prepared.mimeType)}`);
  }
  return form;
}

type GeneratedImageResult = {
  bytes: Buffer;
  mimeType: string;
  providerTaskId?: string;
  providerCreditCost?: number;
  providerCurrency?: string;
};

function isTokengoImageProvider(provider: WorkerImageProvider | undefined) {
  return Boolean(provider?.providerType === "image" && isTokengoImageBaseUrl(normalizeBaseUrl(provider.aiUrl ?? "")));
}

function tokengoImageAspectRatioForSize(size: string) {
  const match = /^(\d+)x(\d+)$/.exec(size.trim());
  if (!match) return "1:1";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return "1:1";
  const ratio = width / height;
  const candidates: Array<[string, number]> = [
    ["1:1", 1], ["16:9", 16 / 9], ["9:16", 9 / 16], ["4:3", 4 / 3], ["3:4", 3 / 4],
    ["3:2", 3 / 2], ["2:3", 2 / 3], ["4:5", 4 / 5], ["5:4", 5 / 4], ["21:9", 21 / 9], ["9:21", 9 / 21]
  ];
  return candidates.sort((left, right) => Math.abs(left[1] - ratio) - Math.abs(right[1] - ratio))[0][0];
}

function tokengoImageRequestParams(payload: WorkerPayload, referenceCount: number, provider: WorkerImageProvider) {
  const fields = recordValue(payload.params.fields) ?? {};
  const configuredSize = textValue(payload.params.size) || textValue(fields.size) || process.env.LOCAL_AI_WORKER_IMAGE_SIZE || "1024x1024";
  const configuredAspectRatio = textValue(payload.params.aspect_ratio) || textValue(payload.params.aspectRatio) || textValue(fields.aspect_ratio) || textValue(fields.aspectRatio) || textValue(provider.imageAspectRatio) || process.env.LOCAL_AI_WORKER_IMAGE_ASPECT_RATIO || "";
  const supportedAspectRatios = new Set(["1:1", "auto", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "21:9", "9:21"]);
  const aspectRatio = supportedAspectRatios.has(configuredAspectRatio) ? configuredAspectRatio : tokengoImageAspectRatioForSize(configuredSize);
  const configuredResolution = textValue(payload.params.resolution) || textValue(fields.resolution) || textValue(provider.imageResolution) || process.env.LOCAL_AI_WORKER_IMAGE_RESOLUTION || "1K";
  const resolution = new Set(["1K", "2K", "4K"]).has(configuredResolution.toUpperCase()) ? configuredResolution.toUpperCase() : "1K";
  const configuredQuality = textValue(payload.params.quality) || textValue(fields.quality) || textValue(provider.imageQuality) || process.env.LOCAL_AI_WORKER_IMAGE_QUALITY || "low";
  const quality = new Set(["auto", "high", "medium", "low"]).has(configuredQuality.toLowerCase()) ? configuredQuality.toLowerCase() : "low";
  const configuredOutputFormat = textValue(payload.params.output_format) || textValue(payload.params.outputFormat) || textValue(fields.output_format) || textValue(fields.outputFormat) || textValue(provider.imageOutputFormat) || process.env.LOCAL_AI_WORKER_IMAGE_OUTPUT_FORMAT || "png";
  const outputFormat = configuredOutputFormat.toLowerCase() === "jpeg" ? "jpeg" as const : "png" as const;
  const mode = referenceCount > 1 ? "multi-reference" as const : referenceCount === 1 ? "image-edit" as const : "text-to-image" as const;
  return { aspectRatio, configuredSize, resolution, quality, outputFormat, mode };
}

function jsonPreview(value: unknown) {
  try {
    return JSON.stringify(value).slice(0, 240);
  } catch {
    return "{}";
  }
}

async function downloadTokengoImageResult(params: {
  url: string;
  signal?: AbortSignal;
  timeoutMs: number;
  providerTaskId?: string;
  providerCreditCost?: number;
}): Promise<GeneratedImageResult> {
  let parsed: URL;
  try {
    parsed = new URL(params.url);
  } catch {
    throw new Error("ai_provider_tokengo_image_result_url_invalid");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("ai_provider_tokengo_image_result_url_invalid");
  }
  const response = await fetchWithTimeout(params.url, { method: "GET", cache: "no-store", signal: params.signal }, params.timeoutMs, `ai_provider_tokengo_image_result_timeout_${params.timeoutMs}`);
  if (!response.ok) throw new Error(`ai_provider_tokengo_image_result_failed_${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    mimeType: imageMimeTypeFromBytes(bytes, response.headers.get("content-type") || "image/png"),
    providerTaskId: params.providerTaskId,
    providerCreditCost: params.providerCreditCost,
    providerCurrency: TOKENGO_IMAGE_PROVIDER_CURRENCY
  };
}

async function generatedTokengoImageFromBody(params: {
  body: unknown;
  response?: Response;
  signal?: AbortSignal;
  timeoutMs: number;
  providerTaskId?: string;
  providerCreditCost?: number;
}): Promise<GeneratedImageResult> {
  const b64 = tokengoImageBase64FromBody(params.body);
  const providerCreditCost = params.providerCreditCost ?? tokengoImageCostRmbFromBody(params.body);
  const providerTaskId = params.providerTaskId || tokengoImageTaskIdFromBody(params.body) || (params.response ? tokengoImageResponseRequestId(params.response) : undefined);
  if (b64) {
    const bytes = Buffer.from(b64, "base64");
    return { bytes, mimeType: imageMimeTypeFromBytes(bytes, "image/png"), providerTaskId, providerCreditCost, providerCurrency: TOKENGO_IMAGE_PROVIDER_CURRENCY };
  }
  const url = tokengoImageResultUrlFromBody(params.body);
  if (!url) throw new Error(`ai_provider_tokengo_image_empty_result_${jsonPreview(params.body)}`);
  return downloadTokengoImageResult({ url, signal: params.signal, timeoutMs: params.timeoutMs, providerTaskId, providerCreditCost });
}

async function uploadTokengoImageReferences(params: {
  baseUrl: string;
  apiKey: string;
  payload: WorkerPayload;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<string[]> {
  const assets = providerInputAssets(params.payload);
  const urls: string[] = [];
  for (const [index, asset] of assets.entries()) {
    throwIfLocalWorkerAborted(params.signal);
    const response = await fetchWithTimeout(asset.signedUrl, { method: "GET", cache: "no-store", signal: params.signal }, Math.min(params.timeoutMs, 30_000), `ai_provider_source_image_timeout_${asset.assetId}`);
    if (!response.ok) throw new Error(`ai_provider_source_image_failed_${asset.assetId}_${response.status}`);
    const sourceMimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || asset.mimeType || "image/png";
    const prepared = await prepareProviderImage(new Uint8Array(await response.arrayBuffer()), sourceMimeType);
    const form = new FormData();
    const fileName = `reference-${index + 1}-${asset.assetId.replace(/[^a-zA-Z0-9_-]/g, "-")}.${extensionForMime(prepared.mimeType)}`;
    form.append("file", new Blob([prepared.bytes], { type: prepared.mimeType }), fileName);
    const uploadResponse = await fetchWithTimeout(tokengoImageFilesUrl(params.baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${params.apiKey}` },
      body: form,
      cache: "no-store",
      signal: params.signal
    }, params.timeoutMs, `ai_provider_tokengo_image_file_upload_timeout_${params.timeoutMs}`);
    const body = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) throw new Error(`ai_provider_tokengo_image_file_upload_failed_${uploadResponse.status}_${jsonPreview(body)}`);
    const url = tokengoImageFileUrlFromBody(body);
    if (!url) throw new Error(`ai_provider_tokengo_image_file_url_missing_${jsonPreview(body)}`);
    urls.push(url);
  }
  return urls;
}

function tokengoImageTaskFailed(status: string | undefined) {
  return Boolean(status && ["failed", "error", "cancelled", "canceled", "rejected"].includes(status.toLowerCase()));
}

async function waitForTokengoImageTask(params: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  providerCreditCost?: number;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<GeneratedImageResult> {
  const startedAt = Date.now();
  const pollIntervalMs = Math.max(1_000, Math.min(Number(process.env.LOCAL_AI_WORKER_TOKENGO_IMAGE_POLL_INTERVAL_MS ?? "3000") || 3_000, 10_000));
  let lastBody: unknown = {};
  while (Date.now() - startedAt < params.timeoutMs) {
    throwIfLocalWorkerAborted(params.signal);
    const response = await fetchWithTimeout(tokengoImageRuntimeTaskUrl(params.baseUrl, params.taskId), {
      method: "GET",
      headers: { Authorization: `Bearer ${params.apiKey}` },
      cache: "no-store",
      signal: params.signal
    }, Math.min(params.timeoutMs, 30_000), `ai_provider_tokengo_image_poll_timeout_${params.timeoutMs}`);
    lastBody = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`ai_provider_tokengo_image_poll_failed_${response.status}_${jsonPreview(lastBody)}`);
    const status = tokengoImageTaskStatusFromBody(lastBody);
    if (tokengoImageTaskFailed(status)) {
      throw new Error(`ai_provider_tokengo_image_task_failed_${tokengoImageTaskErrorFromBody(lastBody) || status}`);
    }
    const resultUrl = tokengoImageResultUrlFromBody(lastBody);
    const b64 = tokengoImageBase64FromBody(lastBody);
    if (resultUrl || b64 || tokengoImageTaskIsFinal(lastBody) === true) {
      return generatedTokengoImageFromBody({ body: lastBody, signal: params.signal, timeoutMs: params.timeoutMs, providerTaskId: params.taskId, providerCreditCost: params.providerCreditCost });
    }
    await sleepWithLocalWorkerAbort(pollIntervalMs, params.signal);
  }
  throw new Error(`ai_provider_tokengo_image_timeout_${params.timeoutMs}_${tokengoImageTaskStatusFromBody(lastBody) || "unknown"}`);
}

async function generateTokengoImage(params: {
  payload: WorkerPayload;
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  slotIndex: number;
  provider: WorkerImageProvider;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<GeneratedImageResult> {
  const referenceCount = providerInputAssets(params.payload).length;
  const imageParams = tokengoImageRequestParams(params.payload, referenceCount, params.provider);
  const images = referenceCount
    ? await uploadTokengoImageReferences({ baseUrl: params.baseUrl, apiKey: params.apiKey, payload: params.payload, signal: params.signal, timeoutMs: params.timeoutMs })
    : undefined;
  const idempotencyKey = `${params.payload.requestId}:image:${params.slotIndex}`;
  const response = await fetchWithTimeout(tokengoImageRuntimeInvokeUrl(params.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
      "Idempotency-Key": idempotencyKey,
      "X-Client-Request-Id": idempotencyKey
    },
    body: JSON.stringify(tokengoImageRuntimeBody({
      model: params.model,
      prompt: params.prompt,
      count: 1,
      mode: imageParams.mode,
      aspectRatio: imageParams.aspectRatio,
      resolution: imageParams.resolution,
      quality: imageParams.quality,
      outputFormat: imageParams.outputFormat,
      images
    })),
    cache: "no-store",
    signal: params.signal
  }, Math.min(params.timeoutMs, 30_000), `ai_provider_tokengo_image_runtime_invoke_timeout_${params.timeoutMs}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`ai_provider_tokengo_image_runtime_invoke_failed_${response.status}_${jsonPreview(body)}`);
  const taskId = tokengoImageTaskIdFromBody(body);
  if (!taskId) {
    return generatedTokengoImageFromBody({ body, response, signal: params.signal, timeoutMs: params.timeoutMs });
  }
  if (tokengoImageResultUrlFromBody(body) || tokengoImageBase64FromBody(body)) {
    return generatedTokengoImageFromBody({ body, response, signal: params.signal, timeoutMs: params.timeoutMs, providerTaskId: taskId });
  }
  return waitForTokengoImageTask({ baseUrl: params.baseUrl, apiKey: params.apiKey, taskId, signal: params.signal, timeoutMs: params.timeoutMs, providerCreditCost: tokengoImageCostRmbFromBody(body) });
}

function originFromUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function workerCallbackOrigin(payload: WorkerPayload): string {
  return originFromUrl(payload.callbackUrl) || originFromUrl(payload.statusCallbackUrl);
}

function isLoopbackCallbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function shouldUseDirectWorkerCallbacks(payload: WorkerPayload): boolean {
  const configured = process.env.LOCAL_AI_WORKER_DIRECT_DB_CALLBACKS?.trim();
  if (configured === "1") return true;
  if (configured === "0") return false;
  return process.env.NODE_ENV !== "production" &&
    isLoopbackCallbackUrl(payload.callbackUrl) &&
    isLoopbackCallbackUrl(payload.statusCallbackUrl);
}

function workerPublicOrigin(payload: WorkerPayload, sourceAssets: ImageInputAsset[]): string {
  return sourceAssets.map((asset) => originFromUrl(asset.publicUrl)).find(Boolean) || workerCallbackOrigin(payload);
}

function signedLocalAssetUrl(origin: string, storageKey: string, expiresAt: string): string {
  const normalizedStorageKey = storageKey.replace(/^\/+/, "");
  const signature = signWorkerLocalAssetDownload({ storageKey: normalizedStorageKey, expiresAt });
  return `${origin.replace(/\/$/, "")}/api/local-assets/${normalizedStorageKey}?worker=1&expiresAt=${encodeURIComponent(expiresAt)}&signature=${signature}`;
}

async function saveVideoSceneReference(params: {
  payload: WorkerPayload;
  requestedReferenceAssets: ImageInputAsset[];
  b64: string;
  providerLabel: string;
  mimeType?: string;
}): Promise<VideoSceneReference> {
  const mimeType = params.mimeType ?? "image/png";
  const preparedScene = prepareCompressedCustomerImage({
    bytes: Buffer.from(params.b64, "base64"),
    mimeType,
    fileName: `${params.payload.jobId}-video-scene-reference.${extensionForMime(mimeType)}`,
    purpose: "input"
  });
  const storageKey = customerAssetStorageKey({
    siteId: params.payload.siteId,
    customerId: params.payload.customerId,
    fileName: `${params.payload.jobId}-video-scene-reference.${extensionForCustomerAssetMime(preparedScene.mimeType)}`
  });
  await writeCustomerAssetFileShared({
    storageKey,
    bytes: preparedScene.bytes,
    mimeType: preparedScene.mimeType,
    purpose: "input"
  });
  await postWorkerSlotStatus(params.payload, "running", "video_scene_reference_ready", {
    index: 1,
    status: "running",
    stage: "video_scene_reference_ready",
    storageKey,
    mimeType: preparedScene.mimeType,
    error: "",
    referenceFrameCount: 1,
    requestedReferenceFrameCount: params.requestedReferenceAssets.length,
    providerReferenceLimit: 1,
    updatedAt: new Date().toISOString()
  });
  const callbackOrigin = workerCallbackOrigin(params.payload);
  const publicOrigin = workerPublicOrigin(params.payload, params.requestedReferenceAssets);
  const signedUrlExpiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  return {
    storageKey,
    mimeType: preparedScene.mimeType,
    providerLabel: params.providerLabel,
    asset: {
      assetId: `video_scene_reference:${params.payload.jobId}`,
      signedUrl: signedLocalAssetUrl(callbackOrigin, storageKey, signedUrlExpiresAt),
      publicUrl: signedLocalAssetUrl(publicOrigin, storageKey, signedUrlExpiresAt)
    } satisfies ImageInputAsset
  };
}

async function generateVideoSceneImageWithEdit(params: {
  payload: WorkerPayload;
  model: string;
  prompt: string;
  signal?: AbortSignal;
  timeoutMs: number;
  sceneInputAssets: ImageInputAsset[];
  baseUrl: string;
  apiKey: string;
}) {
  const form = await buildImageEditForm({
    payload: params.payload,
    model: params.model,
    prompt: params.prompt,
    signal: params.signal,
    timeoutMs: params.timeoutMs,
    assets: params.sceneInputAssets
  });
  if (!form) throw new Error("ai_provider_video_scene_image_edit_missing_input");
  const response = await fetchWithTimeout(
    `${params.baseUrl}/v1/images/edits`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`
      },
      body: form,
      cache: "no-store",
      signal: params.signal
    },
    params.timeoutMs,
    `ai_provider_video_scene_image_edit_timeout_${params.timeoutMs}`
  );
  const body = await readJsonWithDeadline<ImageGenerationResponse>(response, {
    maxBytes: PROVIDER_JSON_BODY_MAX_BYTES,
    timeoutMs: params.timeoutMs,
    timeoutError: `ai_provider_video_scene_image_edit_body_timeout_${params.timeoutMs}`,
    signal: params.signal
  });
  if (!response.ok) {
    throw new Error(`ai_provider_video_scene_image_edit_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
  }
  const [b64] = imageBase64List(body);
  if (!b64) throw new Error("ai_provider_video_scene_image_edit_empty_payload");
  return b64;
}

async function composeVideoSceneReference(params: {
  payload: WorkerPayload;
  requestedReferenceAssets: ImageInputAsset[];
  signal?: AbortSignal;
}) {
  throwIfLocalWorkerAborted(params.signal);
  const sceneProviders = orderedVideoSceneImageProviders(params.payload);
  if (!sceneProviders.length) throw new Error("ai_provider_video_scene_image_provider_missing");
  const timeoutMs = providerTimeoutMs();
  const sceneInputAssets = params.requestedReferenceAssets.slice(0, providerImageReferenceLimit());
  const prompt = buildVideoSceneImagePrompt(params.payload, sceneInputAssets);
  await postWorkerStatus(params.payload, "running", "video_scene_composition_started");
  await postWorkerSlotStatus(params.payload, "running", "video_scene_composition_started", {
    index: 1,
    status: "running",
    stage: "video_scene_composition_started",
    error: "",
    requestedReferenceFrameCount: params.requestedReferenceAssets.length,
    providerReferenceLimit: 1,
    updatedAt: new Date().toISOString()
  });

  let lastError: unknown;
  for (const provider of sceneProviders) {
    const record = await getPlatformAiProviderRelational(provider.id);
    if (record?.enabled === false) {
      lastError = new Error("ai_provider_disabled");
      continue;
    }
    if (!record?.apiKey?.trim()) {
      lastError = new Error("ai_provider_api_key_missing");
      continue;
    }
    const requestedModel = textValue(params.payload.params.sceneImageModelOverride) || textValue(params.payload.params.imageModelOverride);
    const model = requestedModel && isImageGenerationModel(requestedModel) ? requestedModel : record.modelType;
    if (!isImageGenerationModel(model)) {
      lastError = new Error(`ai_provider_not_image_model_${record.label || record.id}_${model}`);
      continue;
    }
    const baseUrl = normalizeBaseUrl(record.aiUrl);
    const maxAttempts = videoSceneImageProviderAttempts();
    for (const attempt of Array.from({ length: maxAttempts }, (_, attemptIndex) => attemptIndex + 1)) {
      try {
        const b64 = await generateVideoSceneImageWithEdit({
          payload: params.payload,
          model,
          prompt,
          signal: params.signal,
          timeoutMs,
          sceneInputAssets,
          baseUrl,
          apiKey: record.apiKey
        });
        return await saveVideoSceneReference({
          payload: params.payload,
          requestedReferenceAssets: params.requestedReferenceAssets,
          b64,
          providerLabel: record.label
        });
      } catch (error) {
        lastError = error;
        if (!isRetryableProviderError(error) || attempt >= maxAttempts) break;
        await sleepWithLocalWorkerAbort(2_500 * attempt, params.signal);
      }
    }
    if (!shouldTryNextSceneImageProvider(lastError)) break;
  }
  throw lastError instanceof Error ? lastError : new Error("ai_provider_video_scene_image_failed");
}

function _createSharedVideoSceneReferenceGetter(): VideoSceneReferenceGetter {
  let referencePromise: Promise<VideoSceneReference> | undefined;
  return (params) => {
    referencePromise ??= composeVideoSceneReference(params);
    return referencePromise;
  };
}

async function buildVideoReferenceForm(params: {
  referenceAssets: ImageInputAsset[];
  model: string;
  prompt: string;
  videoParams: { aspect_ratio: string; resolution: string; duration: string; size: string };
  signal?: AbortSignal;
  timeoutMs: number;
  smartPickLid?: boolean;
}) {
  throwIfLocalWorkerAborted(params.signal);
  const form = new FormData();
  form.append("model", params.model);
  form.append("prompt", params.prompt);
  form.append("seconds", params.videoParams.duration);
  if (params.smartPickLid) {
    form.append("aspect_ratio", params.videoParams.aspect_ratio);
    form.append("resolution", smartPickLidJsonVideoResolution(params.videoParams.resolution));
  } else {
    form.append("size", openAiVideoRequestSize(params.videoParams));
  }
  const referenceAssets = params.referenceAssets.length ? params.referenceAssets : [];
  if (!referenceAssets.length) throw new Error("ai_provider_video_first_frame_required");
  for (const [index, asset] of referenceAssets.entries()) {
    const response = await fetchWithTimeout(
      asset.signedUrl,
      { cache: "no-store", signal: params.signal },
      Math.min(params.timeoutMs, 30_000),
      `ai_provider_video_reference_image_timeout_${asset.assetId}`
    );
    if (!response.ok) throw new Error(`ai_provider_video_reference_image_failed_${asset.assetId}_${response.status}`);
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const bytes = new Uint8Array(await readBodyWithDeadline(response, {
      maxBytes: PROVIDER_REFERENCE_BODY_MAX_BYTES,
      timeoutMs: Math.min(params.timeoutMs, 60_000),
      timeoutError: `ai_provider_video_reference_body_timeout_${asset.assetId}`,
      signal: params.signal
    }));
    const prepared = await prepareVideoReferenceImage(bytes, mimeType, params.videoParams.size);
    form.append("input_reference", new Blob([prepared.bytes], { type: prepared.mimeType }), `input-reference-${index + 1}-${asset.assetId}.${extensionForMime(prepared.mimeType)}`);
  }
  return form;
}

type WorkerStatusPostOptions = {
  timing?: Record<string, string>;
  eventKind?: "progress" | "final";
  nonBlocking?: boolean;
  forceWrite?: boolean;
  progressWrite?: boolean;
  error?: string;
  outputSlots?: WorkerOutputSlot[];
  progress?: number;
  updatedAt?: string;
  customerEvent?: boolean;
};

const workerProgressWriteState = new Map<string, { lastWrittenAt: number; lastProgress?: number }>();

function normalizedWorkerProgress(value: unknown): number | undefined {
  if (!Number.isFinite(Number(value))) return undefined;
  return Math.max(0, Math.min(100, Number(value)));
}

function workerProgressWriteKey(payload: WorkerPayload, slotIndex: number) {
  return `${payload.siteId}:${payload.customerId}:${payload.jobId}:${payload.requestId}:${slotIndex}`;
}

function markWorkerProgressWritten(payload: WorkerPayload, slot: WorkerOutputSlot, progress: number | undefined, now = Date.now()) {
  workerProgressWriteState.set(workerProgressWriteKey(payload, slot.index), { lastWrittenAt: now, lastProgress: progress });
}

function shouldWriteProgressStatus(payload: WorkerPayload, slot: WorkerOutputSlot, options: WorkerStatusPostOptions = {}) {
  if (options.forceWrite) return true;
  if (!options.progressWrite) return true;
  const now = Date.now();
  const progress = normalizedWorkerProgress(slot.progress);
  const previous = workerProgressWriteState.get(workerProgressWriteKey(payload, slot.index));
  if (!previous) {
    markWorkerProgressWritten(payload, slot, progress, now);
    return true;
  }
  if (progress !== undefined && (previous.lastProgress === undefined || Math.abs(progress - previous.lastProgress) >= 10)) {
    markWorkerProgressWritten(payload, slot, progress, now);
    return true;
  }
  if (now - previous.lastWrittenAt >= 15_000) {
    markWorkerProgressWritten(payload, slot, progress, now);
    return true;
  }
  return false;
}

function clearWorkerProgressWrites(payload: WorkerPayload) {
  const prefix = `${payload.siteId}:${payload.customerId}:${payload.jobId}:${payload.requestId}:`;
  for (const key of workerProgressWriteState.keys()) {
    if (key.startsWith(prefix)) workerProgressWriteState.delete(key);
  }
}

function publishLocalWorkerStatusEvent(
  payload: WorkerPayload,
  status: "running" | "failed" | "succeeded",
  stage: string | undefined,
  options: WorkerStatusPostOptions = {}
) {
  if (options.customerEvent === false) return;
  publishCustomerJobEvent({
    type: status === "succeeded" ? "result" : "status",
    siteId: payload.siteId,
    customerId: payload.customerId,
    jobId: payload.jobId,
    status,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    ...(stage ? { stage } : {}),
    ...(Number.isFinite(Number(options.progress)) ? { progress: normalizedWorkerProgress(options.progress) } : {}),
    ...(options.outputSlots ? { outputSlots: options.outputSlots } : {}),
    ...(options.error ? { error: options.error } : {}),
    ...(options.timing ? { timing: options.timing } : {}),
    eventKind: options.eventKind ?? (status === "failed" || status === "succeeded" ? "final" : "progress")
  });
}

function timingFromResultJson(value: unknown, fallback?: Record<string, string>): Record<string, string> | undefined {
  const result = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const previousTiming = result.timing && typeof result.timing === "object" && !Array.isArray(result.timing)
    ? result.timing as Record<string, unknown>
    : {};
  const timing: Record<string, string> = {};
  for (const [key, entry] of Object.entries(previousTiming)) {
    if (typeof entry === "string" && entry) timing[key] = entry;
  }
  for (const [key, entry] of Object.entries(fallback ?? {})) {
    if (typeof entry === "string" && entry) timing[key] = entry;
  }
  return Object.keys(timing).length ? timing : undefined;
}

async function postWorkerStatus(payload: WorkerPayload, status: "running" | "failed", stage: string, options: WorkerStatusPostOptions = {}): Promise<{ alreadyFinal?: boolean }> {
  const body = {
    jobId: payload.jobId,
    siteId: payload.siteId,
    requestId: payload.requestId,
    status,
    stage,
    ...(options.timing ? { timing: options.timing } : {})
  };
  if (shouldUseDirectWorkerCallbacks(payload)) {
    if (options.nonBlocking) {
      publishLocalWorkerStatusEvent(payload, status, stage, options);
      void updateGenerationJobStatusRelational(body).catch(() => null);
      return {};
    }
    const result = await updateGenerationJobStatusRelational(body).catch(() => null);
    if (result) publishCustomerJobEventForJob("status", result.job, {
      stage,
      eventKind: options.eventKind ?? (status === "failed" ? "final" : "progress"),
      error: options.error,
      timing: timingFromResultJson(result.job.resultJson, options.timing)
    });
    return { alreadyFinal: result?.alreadyFinal };
  }
  const request = fetchWorkerCallbackWithTimeout(payload.statusCallbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, signature: signWorkerCallback(body) }),
    cache: "no-store"
  }).catch(() => null);
  if (options.nonBlocking) {
    publishLocalWorkerStatusEvent(payload, status, stage, options);
    void request;
    return {};
  }
  const response = await request;
  const result = (await response?.json().catch(() => ({}))) as { alreadyFinal?: boolean };
  return { alreadyFinal: result.alreadyFinal === true };
}

async function postWorkerSlotStatus(payload: WorkerPayload, status: "running" | "failed", stage: string, slot: WorkerOutputSlot, options: WorkerStatusPostOptions = {}) {
  const progress = normalizedWorkerProgress(slot.progress);
  const body = {
    jobId: payload.jobId,
    siteId: payload.siteId,
    requestId: payload.requestId,
    status,
    stage,
    ...(progress !== undefined ? { progress } : {}),
    outputSlots: [slot],
    ...(options.timing ? { timing: options.timing } : {})
  };
  const eventOptions = {
    ...options,
    outputSlots: [slot],
    progress,
    error: slot.error || options.error,
    eventKind: options.eventKind ?? (status === "failed" ? "final" : "progress"),
    updatedAt: slot.updatedAt
  } satisfies WorkerStatusPostOptions;
  const shouldWrite = shouldWriteProgressStatus(payload, slot, options);
  if (shouldUseDirectWorkerCallbacks(payload)) {
    if (options.nonBlocking) publishLocalWorkerStatusEvent(payload, status, stage, eventOptions);
    if (!shouldWrite) return;
    const write = updateGenerationJobStatusRelational(body).catch(() => null);
    if (options.nonBlocking) {
      void write;
      return;
    }
    const result = await write;
    if (result) {
      publishCustomerJobEventForJob("status", result.job, {
        stage,
        progress,
        outputSlots: [slot],
        error: slot.error || undefined,
        timing: timingFromResultJson(result.job.resultJson, options.timing),
        eventKind: eventOptions.eventKind
      });
    }
    return;
  }
  if (options.nonBlocking) publishLocalWorkerStatusEvent(payload, status, stage, eventOptions);
  if (!shouldWrite) return;
  const request = fetchWorkerCallbackWithTimeout(payload.statusCallbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, signature: signWorkerCallback(body) }),
    cache: "no-store"
  }).catch(() => null);
  if (options.nonBlocking) {
    void request;
    return;
  }
  await request;
}

function workerCallbackRetryAttempts() {
  return Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_CALLBACK_RETRY_ATTEMPTS ?? "4") || 4, 8));
}

function workerCallbackRetryDelayMs(attempt: number) {
  return Math.max(500, Math.min(1_500 * attempt, 10_000));
}

function workerCallbackTimeoutMs() {
  const configured = Number(process.env.LOCAL_AI_WORKER_CALLBACK_TIMEOUT_MS ?? "30000");
  if (!Number.isFinite(configured) || configured <= 0) return 30_000;
  return Math.max(1_000, Math.min(Math.trunc(configured), 120_000));
}

async function fetchWorkerCallbackWithTimeout(resource: string, init: RequestInit) {
  const timeoutMs = workerCallbackTimeoutMs();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(resource, { ...init, signal: controller.signal }),
      new Promise<Response>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`worker_callback_timeout_${timeoutMs}`));
        }, timeoutMs);
      })
    ]);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`worker_callback_timeout_${timeoutMs}`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function shouldRetryWorkerCallbackStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function postWorkerResult(
  payload: WorkerPayload,
  body: {
    status: "succeeded" | "failed";
    outputs?: Array<{ storageKey: string; mimeType?: string; providerTaskId?: string }>;
    providerTrace?: Array<{ provider: string; attempts: number }>;
    costTrace?: { estimatedCostUsd?: number; providerCreditCost?: number; providerCurrency?: string; providerErrors?: Array<{ provider: string; error: string }>; providerFailure?: VideoProviderFailure; referenceFrameCount?: number; requestedReferenceFrameCount?: number; providerReferenceLimit?: number };
    providerFailure?: VideoProviderFailure;
    error?: string;
    timing?: Record<string, string>;
  }
) {
  const resultBody = {
    jobId: payload.jobId,
    siteId: payload.siteId,
    requestId: payload.requestId,
    ...body
  };
  if (shouldUseDirectWorkerCallbacks(payload)) {
    const result = await settleGenerationJobRelational(resultBody);
    clearWorkerProgressWrites(payload);
    publishCustomerJobEventForJob("result", result.job, {
      alreadyProcessed: result.alreadyProcessed,
      eventKind: "final",
      error: body.error,
      timing: timingFromResultJson(result.job.resultJson, body.timing)
    });
    return;
  }
  const signedBody = JSON.stringify({ ...resultBody, signature: signWorkerCallback(resultBody) });
  let lastStatus = 0;
  let lastError = "";
  const attempts = workerCallbackRetryAttempts();
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWorkerCallbackWithTimeout(payload.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: signedBody,
        cache: "no-store"
      });
      if (response.ok) {
        clearWorkerProgressWrites(payload);
        return;
      }
      lastStatus = response.status;
      lastError = (await response.text().catch(() => "")).slice(0, 240);
      if (!shouldRetryWorkerCallbackStatus(response.status) || attempt >= attempts) break;
    } catch (error) {
      lastStatus = 0;
      lastError = errorMessage(error).slice(0, 240);
      if (attempt >= attempts) break;
    }
    console.warn("worker_result_callback_retry", { attempt, lastStatus: lastStatus || "network", error: lastError });
    await new Promise((resolve) => setTimeout(resolve, workerCallbackRetryDelayMs(attempt)));
  }
  // The worker already finished. If its callback endpoint stays unavailable,
  // settle from this process so a failed generation does not hold credits
  // until the stale-job watchdog runs.
  try {
    const result = await settleGenerationJobRelational(resultBody);
    clearWorkerProgressWrites(payload);
    publishCustomerJobEventForJob("result", result.job, {
      alreadyProcessed: result.alreadyProcessed,
      eventKind: "final",
      error: body.error,
      timing: timingFromResultJson(result.job.resultJson, body.timing)
    });
    console.warn("worker_result_callback_fallback_settled", {
      jobId: payload.jobId,
      siteId: payload.siteId,
      lastStatus: lastStatus || "network",
      error: body.error
    });
    return;
  } catch (fallbackError) {
    throw new Error(`worker_result_callback_failed_${lastStatus || "network"}${lastError ? `_${lastError}` : ""}; fallback_settle_failed_${errorMessage(fallbackError)}`);
  }
}

function videoTaskId(body: VideoGenerateResponse) {
  const data = recordValue(body.data);
  const task = recordValue(data?.task);
  const taskId = body.request_id ??
    data?.request_id ??
    data?.task_id ??
    data?.taskId ??
    data?.id ??
    task?.id ??
    body.task_id ??
    body.taskId ??
    body.id;
  return typeof taskId === "number" || typeof taskId === "string" ? String(taskId) : "";
}

function videoProgressPercent(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeVideoStatusResponse(body: VideoStatusResponse): VideoStatusResponse {
  const data = recordValue(body.data);
  if (!data) return body;
  const merged = {
    ...body,
    ...data,
    error: body.error ?? data.error,
    message: body.message ?? (typeof data.message === "string" ? data.message : undefined)
  } as VideoStatusResponse;
  // Yingling/new-api returns upper-case states and percentage strings; normalise
  // them once so every consumer sees a lower-case state and numeric progress.
  const status = textValue(merged.status).trim().toLowerCase();
  const state = textValue(merged.state).trim().toLowerCase();
  return {
    ...merged,
    ...(status ? { status } : {}),
    ...(state ? { state } : {}),
    progress: videoProgressPercent(merged.progress),
    // new-api reports the provider failure message in `fail_reason`.
    error: textValue(merged.error) || textValue(recordValue(data)?.fail_reason) || body.error
  } as VideoStatusResponse;
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
  // Yingling/new-api nests the finished media list under `data.media`.
  const nestedData = recordValue(status.data) ?? {};
  const nestedMedia = Array.isArray(nestedData.media) ? nestedData.media.map((item) => recordValue(item) ?? {}) : [];
  const nestedVideo = nestedMedia.find((item) => textValue(item.kind).toLowerCase() === "video" || textValue(item.type).toLowerCase() === "video");
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
    textValue(output?.video_url) ||
    textValue(nestedVideo?.url) ||
    textValue(nestedVideo?.src) ||
    textValue(nestedData.url) ||
    textValue(nestedData.video_url) ||
    textValue(nestedData.result_url);
}

function normalizedVideoMimeType(value: string) {
  const mimeType = value.split(";")[0]?.trim().toLowerCase() || "";
  if (mimeType.startsWith("video/")) return mimeType;
  return "video/mp4";
}

type GeneratedVideoOptimizeMode = "async" | "sync" | "off";

function generatedVideoOptimizeMode(): GeneratedVideoOptimizeMode {
  const configured = process.env.AI_WORKER_VIDEO_OPTIMIZE_MODE?.trim().toLowerCase();
  if (configured === "async" || configured === "sync" || configured === "off") return configured;
  if (process.env.AI_WORKER_OPTIMIZE_VIDEO_OUTPUTS?.trim() === "0") return "off";
  return "async";
}

function shouldOptimizeGeneratedVideoOutputs(mode = generatedVideoOptimizeMode()) {
  return mode !== "off";
}

function generatedVideoOptimizeMinBytes() {
  const configured = Number(process.env.AI_WORKER_VIDEO_OPTIMIZE_MIN_BYTES ?? "1200000");
  if (!Number.isFinite(configured) || configured < 0) return 1_200_000;
  return Math.trunc(configured);
}

function generatedVideoOptimizeSavingsRatio() {
  const configured = Number(process.env.AI_WORKER_VIDEO_OPTIMIZE_SAVINGS_RATIO ?? "0.92");
  if (!Number.isFinite(configured) || configured <= 0 || configured >= 1) return 0.92;
  return configured;
}

function generatedVideoOptimizeTimeoutMs() {
  const configured = Number(process.env.AI_WORKER_VIDEO_OPTIMIZE_TIMEOUT_MS ?? "120000");
  if (!Number.isFinite(configured) || configured <= 0) return 120_000;
  return Math.max(30_000, Math.trunc(configured));
}

function generatedVideoOptimizeCrf() {
  const configured = Number(process.env.AI_WORKER_VIDEO_OPTIMIZE_CRF ?? "28");
  if (!Number.isFinite(configured)) return "28";
  return String(Math.max(20, Math.min(34, Math.trunc(configured))));
}

function generatedVideoOptimizeMaxrate() {
  return process.env.AI_WORKER_VIDEO_OPTIMIZE_MAXRATE?.trim() || "2200k";
}

function generatedVideoOptimizeBufsize() {
  return process.env.AI_WORKER_VIDEO_OPTIMIZE_BUFSIZE?.trim() || "4400k";
}

async function optimizeGeneratedVideoForPlayback(video: { bytes: Buffer; mimeType: string }, mode = generatedVideoOptimizeMode()) {
  if (!shouldOptimizeGeneratedVideoOutputs(mode)) return video;
  if (!video.mimeType.startsWith("video/")) return video;
  if (video.bytes.length < generatedVideoOptimizeMinBytes()) return video;
  const ffmpegExecutable = ffmpegExecutablePath();
  if (!ffmpegExecutable) return video;

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "mydreamshoots-video-"));
  try {
    const inputPath = path.join(tmpDir, "input");
    const outputPath = path.join(tmpDir, "output.mp4");
    await writeFile(inputPath, video.bytes);
    await execFileAsync(
      ffmpegExecutable,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        generatedVideoOptimizeCrf(),
        "-maxrate",
        generatedVideoOptimizeMaxrate(),
        "-bufsize",
        generatedVideoOptimizeBufsize(),
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-movflags",
        "+faststart",
        outputPath
      ],
      { timeout: generatedVideoOptimizeTimeoutMs(), maxBuffer: 1024 * 1024 }
    );
    const optimizedBytes = Buffer.from(await readFile(outputPath));
    if (!optimizedBytes.length || optimizedBytes.length >= video.bytes.length * generatedVideoOptimizeSavingsRatio()) {
      return video;
    }
    return { bytes: optimizedBytes, mimeType: "video/mp4" };
  } catch {
    return video;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function videoProviderProtocol(baseUrl: string, configured?: unknown): VideoProviderProtocol {
  return videoProviderProtocolForBaseUrl(baseUrl, configured);
}

function lk888MediaStatusUrls(baseUrl: string, taskId: string) {
  const primary = new URL(`${baseUrl}/v1/skills/task-status`);
  primary.searchParams.set("task_id", taskId);
  const legacy = new URL(`${baseUrl}/v1/media/status`);
  legacy.searchParams.set("task_id", taskId);
  return [primary, legacy];
}

function shouldUseOpenAiVideoJsonReference(params: {
  baseUrl: string;
  model: string;
  protocol: VideoProviderProtocol;
}) {
  if (params.protocol !== "openai-videos" || !isGrokImagineVideoModel(params.model)) return false;
  const explicitMode = process.env.AI_WORKER_GROK_IMAGINE_VIDEO_REFERENCE_MODE?.trim().toLowerCase();
  if (explicitMode === "multipart" || explicitMode === "form") return false;
  return true;
}

function shouldUseSmartPickLidJsonVideoRequest(params: {
  baseUrl: string;
  model: string;
  protocol: VideoProviderProtocol;
}) {
  const explicitMode = process.env.AI_WORKER_GROK_IMAGINE_VIDEO_REFERENCE_MODE?.trim().toLowerCase();
  if (explicitMode === "multipart" || explicitMode === "form") return false;
  return params.protocol === "openai-videos" &&
    usesProxyOpenAiVideoEndpoint(params.baseUrl) &&
    isSmartPickLidJsonVideoModel(params.model);
}

function shouldBlockSmartPickLidReferenceVideo(params: {
  baseUrl: string;
  protocol: VideoProviderProtocol;
  referenceAssetCount: number;
}) {
  if ((envFlag("AI_WORKER_ALLOW_SMARTPICKLID_REFERENCE_VIDEO") ?? true) === true) return false;
  return params.referenceAssetCount > 0 &&
    params.protocol === "openai-videos" &&
    isSmartPickLidBaseUrl(params.baseUrl);
}

function shouldPreferOpenAiJsonVideoRequest(params: {
  baseUrl: string;
  model: string;
  protocol: VideoProviderProtocol;
}) {
  if (params.protocol !== "openai-videos") return false;
  const explicitMode = process.env.AI_WORKER_GROK_IMAGINE_VIDEO_REFERENCE_MODE?.trim().toLowerCase();
  if (explicitMode === "multipart" || explicitMode === "form") return false;
  // 影灵（New API 兼容）走原生 JSON 字段（image/ratio/resolution），
  // 不套用 smartpicklid 的 JSON 参考图分支；参考图由 createVideoTask 的
  // yingling 载荷按上传顺序写入 image。
  if (isYinglingApiBaseUrl(params.baseUrl)) return false;
  return isGrokImagineVideoModel(params.model) || isSmartPickLidBaseUrl(params.baseUrl);
}

function shouldPreferDirectOpenAiJsonVideoReferences(params: {
  baseUrl: string;
  model: string;
  protocol: VideoProviderProtocol;
  referenceAssetCount: number;
}) {
  if (params.referenceAssetCount <= 1) return false;
  return shouldPreferOpenAiJsonVideoRequest(params);
}

function openAiJsonVideoReferenceLimit() {
  const configured = Number(process.env.AI_WORKER_GROK_IMAGINE_VIDEO_REFERENCE_LIMIT ?? String(MAX_MULTI_REFERENCE_VIDEO_FRAME_LIMIT));
  if (!Number.isFinite(configured) || configured <= 0) return MAX_MULTI_REFERENCE_VIDEO_FRAME_LIMIT;
  return Math.max(1, Math.min(Math.trunc(configured), MAX_MULTI_REFERENCE_VIDEO_FRAME_LIMIT));
}

function openAiJsonVideoReferencePayload(urls: string[], fallbackImageUrl?: string, options?: { proxyStringReferences?: boolean }) {
  if (options?.proxyStringReferences) {
    const imageUrls = urls.length ? urls : fallbackImageUrl ? [fallbackImageUrl] : [];
    if (imageUrls.length > 1) return { images: imageUrls };
    return imageUrls.length ? { image: imageUrls[0] } : {};
  }
  if (urls.length > 1) {
    return { reference_images: urls.map((url) => ({ url })) };
  }
  const imageUrl = urls[0] ?? fallbackImageUrl;
  if (!imageUrl) return {};
  return { image: { url: imageUrl } };
}

async function createVideoTask(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  imageUrls: string[];
  audioUrls: string[];
  referenceAssets: ImageInputAsset[];
  videoParams: { aspect_ratio: string; resolution: string; duration: string; size: string };
  protocol: VideoProviderProtocol;
  clientRequestId: string;
  endImageUrl?: string;
  signal?: AbortSignal;
  timeoutMs: number;
  onProviderCreateStarted?: () => Promise<void>;
}) {
  throwIfLocalWorkerAborted(params.signal);
  const firstImageUrl = params.imageUrls[0];
  if (params.protocol === "huitu-openapi") {
    const createTimeoutMs = videoProviderCreateTimeoutMs(params.timeoutMs);
    await params.onProviderCreateStarted?.();
    const task = await createHuituOpenApiVideoTask({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      prompt: params.prompt,
      imageUrls: params.imageUrls,
      duration: params.videoParams.duration,
      ratio: params.videoParams.aspect_ratio,
      clientRequestId: params.clientRequestId,
      fetchWithTimeout: (resource, init, timeout, timeoutError) =>
        fetchWithTimeout(resource, { ...init, signal: params.signal }, timeout, timeoutError),
      timeoutMs: createTimeoutMs
    });
    return task.id;
  }
  if (params.protocol === "tokengo-media") {
    const createTimeoutMs = videoProviderCreateTimeoutMs(params.timeoutMs);
    await params.onProviderCreateStarted?.();
    const task = await createTokengoMediaVideoTask({
      baseUrl: normalizeTokengoMediaBaseUrl(params.baseUrl),
      apiKey: params.apiKey,
      model: params.model,
      prompt: params.prompt,
      imageUrls: params.imageUrls,
      endImageUrl: params.endImageUrl,
      videoParams: params.videoParams,
      fetchWithTimeout: (resource, init, timeout, timeoutError) =>
        fetchWithTimeout(resource, { ...init, signal: params.signal }, timeout, timeoutError),
      timeoutMs: createTimeoutMs
    });
    return task.id;
  }
  const mediaBaseUrl = params.protocol === "lk888-media" ? params.baseUrl.replace(/\/api$/, "") : params.baseUrl;
  const yinglingOpenAiVideos = yinglingJobUsesOpenAiVideos(params.baseUrl, params.audioUrls.length);
  const endpoint = params.protocol === "openai-videos"
    ? openAiVideoCreateEndpoint(params.baseUrl, { yinglingOpenAiVideos })
    : `${mediaBaseUrl}/v1/media/generate`;
  const useSmartPickLidJsonRequest = shouldUseSmartPickLidJsonVideoRequest({
    baseUrl: params.baseUrl,
    model: params.model,
    protocol: params.protocol
  });
  const useOpenAiJsonReference = shouldUseOpenAiVideoJsonReference(params) && !useSmartPickLidJsonRequest;
  const useJsonReference = useSmartPickLidJsonRequest || useOpenAiJsonReference;
  const useProxyStringReferences = usesProxyOpenAiVideoEndpoint(params.baseUrl);
  const providerRequestSize = openAiVideoRequestSize(params.videoParams, { smartPickLidJson: useSmartPickLidJsonRequest });
  const providerReferenceTargetSize = openAiVideoReferenceTargetSize(params.videoParams, { smartPickLidJson: useSmartPickLidJsonRequest });
  const openAiJsonImageUrls = useJsonReference
    ? await videoProviderPreparedDataUriFrameUrls({
        referenceAssets: params.referenceAssets,
        signal: params.signal,
        timeoutMs: params.timeoutMs,
        targetSize: providerReferenceTargetSize
      })
    : [];
  const openAiJsonReferencePayload = useJsonReference
    ? openAiJsonVideoReferencePayload(openAiJsonImageUrls, firstImageUrl, { proxyStringReferences: useProxyStringReferences })
    : {};
  const yinglingApi = isYinglingApiBaseUrl(params.baseUrl);
  const openAiVideosForm = params.protocol === "openai-videos" && !yinglingApi && !useJsonReference && params.referenceAssets.length
    ? await buildVideoReferenceForm({
        referenceAssets: params.referenceAssets,
        model: params.model,
        prompt: params.prompt,
        videoParams: params.videoParams,
        signal: params.signal,
        timeoutMs: params.timeoutMs,
        smartPickLid: isSmartPickLidBaseUrl(params.baseUrl)
      })
    : undefined;
  const yinglingSize = params.videoParams.aspect_ratio;
  // The relay's task plugin reads the upload list from `image`: a string for a
  // single upload and an array for multiple uploads, kept in upload order. It
  // does not forward `metadata.input.media` (the task is accepted and then runs
  // as text-to-video), `images` trips its usage hook, and an image request that
  // also carries `resolution` is rejected upstream. Send `ratio` only for image
  // requests; the provider default (1080P) is the selected workspace
  // resolution.
  const yinglingResolution = String(params.videoParams.resolution || "").toUpperCase();
  const yinglingParameters = {
    ...(params.imageUrls.length === 0 && yinglingResolution ? { resolution: yinglingResolution } : {}),
    ...(yinglingSize ? { ratio: yinglingSize } : {})
  };
  const yinglingImage = params.imageUrls.length > 1 ? params.imageUrls : firstImageUrl;
  const payload = yinglingOpenAiVideos
    ? {
        // Yingling /v1/videos (OpenAI-compatible): JSON URL reference lists.
        // The gateway downloads each URL and re-uploads it as the adapter's
        // input_reference/input_audio file; audio must answer with an audio/*
        // Content-Type (served by the local-assets route).
        model: params.model,
        prompt: params.prompt,
        seconds: Number(params.videoParams.duration),
        ...(params.imageUrls.length ? { images: params.imageUrls } : {}),
        ...(params.audioUrls.length ? { audio_refs: params.audioUrls } : {}),
        ...(params.videoParams.aspect_ratio ? { ratio: params.videoParams.aspect_ratio } : {})
      }
    : yinglingApi
    ? {
        model: params.model,
        prompt: params.prompt,
        duration: Number(params.videoParams.duration),
        ...yinglingParameters,
        ...(yinglingImage ? { image: yinglingImage } : {}),
        // The relay's wan task plugin reads `audio_url` as a reference audio
        // (voice tone) for wan2.7/wan3.0-class models; older i2v mappings
        // ignore it. Only the first audio is transported per request.
        ...(params.audioUrls.length ? { audio_url: params.audioUrls[0] } : {})
      }
    : params.protocol === "openai-videos"
    ? {
        model: params.model,
        prompt: params.prompt,
        ...(useSmartPickLidJsonRequest
          ? {
              seconds: params.videoParams.duration,
              aspect_ratio: params.videoParams.aspect_ratio,
              resolution: smartPickLidJsonVideoResolution(params.videoParams.resolution),
              ...openAiJsonReferencePayload
            }
          : useOpenAiJsonReference
          ? {
              duration: Number(params.videoParams.duration),
              aspect_ratio: params.videoParams.aspect_ratio,
              resolution: smartPickLidJsonVideoResolution(params.videoParams.resolution),
              ...openAiJsonReferencePayload
            }
          : {
              duration: Number(params.videoParams.duration),
              size: providerRequestSize,
              ...(params.imageUrls.length > 1
                ? { reference_images: params.imageUrls }
                : { image: firstImageUrl })
            })
      }
    : {
        model: params.model,
        params: lk888MediaVideoParams(params.videoParams, params.imageUrls),
        prompt: params.prompt
  };
  const createTimeoutMs = videoProviderCreateTimeoutMs(params.timeoutMs);
  await params.onProviderCreateStarted?.();
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: openAiVideosForm
      ? { Authorization: `Bearer ${params.apiKey}` }
      : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`
    },
    body: openAiVideosForm ?? JSON.stringify(payload),
    cache: "no-store",
    signal: params.signal
  }, createTimeoutMs, `ai_provider_video_create_timeout_${createTimeoutMs}`);
  const body = await readJsonWithDeadline<VideoGenerateResponse>(response, {
    maxBytes: PROVIDER_JSON_BODY_MAX_BYTES,
    timeoutMs: createTimeoutMs,
    timeoutError: `ai_provider_video_create_body_timeout_${createTimeoutMs}`,
    signal: params.signal
  });
  const taskId = videoTaskId(body);
  if (!response.ok || !taskId) {
    const referenceCount = params.protocol === "openai-videos" ? params.referenceAssets.length : params.imageUrls.length;
    const multiFrameHint = referenceCount > 1 ? "multi_frame_payload_rejected_" : "";
    const requestSummary = {
      model: params.model,
      protocol: params.protocol,
      endpoint: new URL(endpoint).pathname,
      duration: params.videoParams.duration,
      size: useSmartPickLidJsonRequest || useOpenAiJsonReference ? `${params.videoParams.aspect_ratio}/${smartPickLidJsonVideoResolution(params.videoParams.resolution)}` : params.protocol === "openai-videos" ? providerRequestSize : `${lk888MediaVideoAspectRatio(params.videoParams.aspect_ratio)}/${lk888MediaVideoResolution(params.videoParams.resolution)}`,
      imageCount: referenceCount,
      imageKind: useSmartPickLidJsonRequest ? (referenceCount > 1 ? "smartpicklid_json_data_uri_images" : "smartpicklid_json_data_uri_image") : useOpenAiJsonReference ? (referenceCount > 1 ? "json_reference_images" : "json_image") : params.protocol === "openai-videos" ? "multipart_input_reference" : referenceCount > 1 ? "lk888_media_images_array" : firstImageUrl?.startsWith("data:") ? "lk888_media_images_data_uri" : "lk888_media_images_url",
      promptLength: params.prompt.length
    };
    throw new Error(`ai_provider_video_create_failed_${multiFrameHint}${response.status}_${JSON.stringify(body).slice(0, 240)}_request_${JSON.stringify(requestSummary)}`);
  }
  return taskId;
}

async function pollVideoTask(params: {
  payload: WorkerPayload;
  baseUrl: string;
  apiKey: string;
  taskId: string;
  protocol: VideoProviderProtocol;
  providerFamily: VideoModelFamily;
  signal?: AbortSignal;
  timeoutMs: number;
  timing?: Record<string, string>;
}) {
  throwIfLocalWorkerAborted(params.signal);
  const startedAt = Date.now();
  let lastStatus = "";
  let firstPoll = true;
  const yinglingOpenAiVideos = yinglingJobUsesOpenAiVideos(params.baseUrl, videoAudioAssets(params.payload).length);
  let providerFirstProgressAt = params.timing?.providerFirstProgressAt;
  const providerProgressTiming = (progress: unknown): Record<string, string> | undefined => {
    if (!Number.isFinite(Number(progress))) return undefined;
    const providerLastProgressAt = new Date().toISOString();
    if (!providerFirstProgressAt) providerFirstProgressAt = providerLastProgressAt;
    if (params.timing) {
      params.timing.providerFirstProgressAt = providerFirstProgressAt;
      params.timing.providerLastProgressAt = providerLastProgressAt;
    }
    return {
      providerFirstProgressAt,
      providerLastProgressAt
    };
  };
  while (Date.now() - startedAt < params.timeoutMs) {
    throwIfLocalWorkerAborted(params.signal);
    const elapsedMs = Date.now() - startedAt;
    if (!firstPoll) {
      await sleepWithLocalWorkerAbort(videoProviderPollIntervalMs(elapsedMs), params.signal);
    }
    firstPoll = false;
    try {
      if (params.protocol === "huitu-openapi") {
        const task = await fetchHuituOpenApiVideoTask({
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          taskId: params.taskId,
          fetchWithTimeout: (resource, init, timeout, timeoutError) =>
            fetchWithTimeout(resource, { ...init, signal: params.signal }, timeout, timeoutError),
          timeoutMs: Math.min(45_000, params.timeoutMs)
        });
        const body: VideoStatusResponse = {
          id: task.id,
          status: task.status,
          progress: task.progress,
          error: task.error,
          videoUrl: task.videoUrl ?? undefined,
          creditCost: task.creditCost
        };
        lastStatus = [body.status, body.progress].filter(Boolean).join("_");
        const progressTiming = providerProgressTiming(body.progress);
        await postWorkerSlotStatus(params.payload, "running", "video_provider_running", {
          index: 1,
          status: "running",
          stage: `video_provider_running${body.progress ? `_${body.progress}` : ""}`,
          progress: Number.isFinite(Number(body.progress))
            ? Math.max(0, Math.min(100, Number(body.progress)))
            : undefined,
          error: "",
          updatedAt: new Date().toISOString()
        }, { nonBlocking: true, progressWrite: true, ...(progressTiming ? { timing: progressTiming } : {}) });
        if (body.status === "success" && body.videoUrl) return body;
        if (body.status === "failed" || body.status === "cancelled" || body.status === "canceled") {
          const rawFailure = textValue(body.error) || textValue(body.message) || "no_result";
          throw attachVideoProviderFailure(
            new Error(`ai_provider_video_failed_${body.status}_${rawFailure}`),
            normalizeVideoProviderFailure({
              error: rawFailure,
              providerFamily: params.providerFamily,
              providerProtocol: params.protocol
            })
          );
        }
        continue;
      }
      if (params.protocol === "tokengo-media") {
        const task = await fetchTokengoMediaVideoTask({
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          taskId: params.taskId,
          fetchWithTimeout: (resource, init, timeout, timeoutError) =>
            fetchWithTimeout(resource, { ...init, signal: params.signal }, timeout, timeoutError),
          timeoutMs: Math.min(45_000, params.timeoutMs)
        });
        const body: VideoStatusResponse = {
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
        };
        lastStatus = [body.state, body.progress, body.status].filter(Boolean).join("_");
        const progressTiming = providerProgressTiming(body.progress);
        await postWorkerSlotStatus(params.payload, "running", "video_provider_running", {
          index: 1,
          status: "running",
          stage: `video_provider_running${body.progress ? `_${body.progress}` : ""}`,
          progress: Number.isFinite(Number(body.progress))
            ? Math.max(0, Math.min(100, Number(body.progress)))
            : undefined,
          error: "",
          updatedAt: new Date().toISOString()
        }, { nonBlocking: true, progressWrite: true, ...(progressTiming ? { timing: progressTiming } : {}) });
        if (body.is_final === true) {
          if (body.state === "success" && videoStatusResultUrl(body)) return body;
          const rawFailure = textValue(body.error) || textValue(body.message) || textValue(body.status) || "no_result";
          throw attachVideoProviderFailure(
            new Error(`ai_provider_video_failed_${body.state || "unknown"}_${rawFailure}`),
            normalizeVideoProviderFailure({
              error: rawFailure,
              providerFamily: params.providerFamily,
              providerProtocol: params.protocol
            })
          );
        }
        continue;
      }
      const mediaBaseUrl = params.protocol === "lk888-media" ? params.baseUrl.replace(/\/api$/, "") : params.baseUrl;
      const urls = params.protocol === "openai-videos"
          ? [new URL(openAiVideoStatusEndpoint(params.baseUrl, params.taskId, { yinglingOpenAiVideos }))]
          : lk888MediaStatusUrls(mediaBaseUrl, params.taskId);
      let response: Response | undefined;
      let body: VideoStatusResponse = {};
      for (const [index, url] of urls.entries()) {
        response = await fetchWithTimeout(url.toString(), {
          headers: { Authorization: `Bearer ${params.apiKey}` },
          cache: "no-store",
          signal: params.signal
        }, Math.min(45_000, params.timeoutMs), "ai_provider_video_status_timeout");
        body = normalizeVideoStatusResponse((await response.json().catch(() => ({}))) as VideoStatusResponse);
        if (response.ok || params.protocol === "openai-videos" || index === urls.length - 1 || (response.status !== 404 && response.status !== 405)) break;
      }
      if (!response) throw new Error("ai_provider_video_status_empty_response");
      if (!response.ok) {
        throw new Error(`ai_provider_video_status_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
      }
      lastStatus = [body.state, body.progress, body.status].filter(Boolean).join("_");
      const progressTiming = providerProgressTiming(body.progress);
      await postWorkerSlotStatus(params.payload, "running", "video_provider_running", {
        index: 1,
        status: "running",
        stage: `video_provider_running${body.progress ? `_${body.progress}` : ""}`,
        progress: Number.isFinite(Number(body.progress))
          ? Math.max(0, Math.min(100, Number(body.progress)))
          : undefined,
        error: "",
        updatedAt: new Date().toISOString()
      }, { nonBlocking: true, progressWrite: true, ...(progressTiming ? { timing: progressTiming } : {}) });
      if (params.protocol === "openai-videos") {
        if (body.status === "completed" || body.status === "succeeded" || body.status === "success" || body.status === "done") {
          // Yingling /v1/videos responses carry no inline result URL; the file
          // is fetched from /v1/videos/{task_id}/content after completion.
          if (videoStatusResultUrl(body) || yinglingOpenAiVideos) return body;
          continue;
        }
        if (body.status === "failed" || body.status === "failure" || body.status === "cancelled" || body.status === "canceled") {
          const rawFailure = textValue(body.error) || textValue(body.message) || "no_result";
          throw attachVideoProviderFailure(
            new Error(`ai_provider_video_failed_failed_${rawFailure}`),
            normalizeVideoProviderFailure({
              error: rawFailure,
              providerFamily: params.providerFamily,
              providerProtocol: params.protocol
            })
          );
        }
        continue;
      }
      if (body.is_final === true) {
        if (body.state === "success" && videoStatusResultUrl(body)) return body;
        const rawFailure = textValue(body.error) || textValue(body.status) || "no_result";
        throw attachVideoProviderFailure(
          new Error(`ai_provider_video_failed_${body.state || "unknown"}_${rawFailure}`),
          normalizeVideoProviderFailure({
            error: rawFailure,
            providerFamily: params.providerFamily,
            providerProtocol: params.protocol
          })
        );
      }
    } catch (error) {
      if (!isRetryableProviderError(error)) throw error;
      const retryError = errorMessage(error).slice(0, 240);
      lastStatus = `poll_error_${retryError}`;
      await postWorkerSlotStatus(params.payload, "running", "video_provider_poll_retry", {
        index: 1,
        status: "running",
        stage: "video_provider_poll_retry",
        error: retryError,
        updatedAt: new Date().toISOString()
      }, { nonBlocking: true, progressWrite: true }).catch(() => undefined);
    }
  }
  throw new Error(`ai_provider_video_timeout_${params.timeoutMs}_${lastStatus || "no_status"}`);
}

function videoProviderReadRetryAttempts() {
  return Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_VIDEO_READ_RETRY_ATTEMPTS ?? "3") || 3, 5));
}

async function withVideoProviderReadRetries<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const maxAttempts = videoProviderReadRetryAttempts();
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    throwIfLocalWorkerAborted(signal);
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (!isRetryableProviderError(error) || attempt >= maxAttempts) throw error;
      console.warn("video_provider_download_retry", {
        attempt,
        maxAttempts,
        error: errorMessage(error).slice(0, 240)
      });
      await sleepWithLocalWorkerAbort(Math.min(5_000, 1_000 * attempt), signal);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ai_provider_video_download_failed");
}

async function downloadVideoResult(params: {
  resultUrl?: string;
  baseUrl?: string;
  apiKey?: string;
  taskId?: string;
  protocol: VideoProviderProtocol;
  yinglingOpenAiVideos?: boolean;
  signal?: AbortSignal;
  timeoutMs: number;
}) {
  throwIfLocalWorkerAborted(params.signal);
  if (params.protocol === "huitu-openapi") {
    return withVideoProviderReadRetries(async () => {
      throwIfLocalWorkerAborted(params.signal);
      const response = await downloadHuituOpenApiVideoTaskFile({
        baseUrl: params.baseUrl ?? "",
        apiKey: params.apiKey ?? "",
        taskId: params.taskId ?? "",
        resultUrl: params.resultUrl,
        fetchWithTimeout: (resource, init, timeout, timeoutError) =>
          fetchWithTimeout(resource, { ...init, signal: params.signal }, timeout, timeoutError),
        timeoutMs: Math.min(params.timeoutMs, 120_000)
      });
      if (!response.ok) throw new Error(`ai_provider_video_download_failed_${response.status}`);
      const mimeType = normalizedVideoMimeType(response.headers.get("content-type") ?? "video/mp4");
      const bytes = await readBodyWithDeadline(response, {
        maxBytes: PROVIDER_RESULT_BODY_MAX_BYTES,
        timeoutMs: Math.min(params.timeoutMs, 300_000),
        timeoutError: "ai_provider_video_download_body_timeout",
        signal: params.signal
      });
      if (!bytes.length) throw new Error("ai_provider_video_empty_payload");
      return { bytes, mimeType };
    }, params.signal);
  }
  const rawResultUrl = params.protocol === "openai-videos"
    ? params.resultUrl || (isYinglingApiBaseUrl(params.baseUrl ?? "") && !params.yinglingOpenAiVideos ? "" : openAiVideoContentEndpoint(params.baseUrl ?? "", params.taskId ?? "", { yinglingOpenAiVideos: params.yinglingOpenAiVideos }))
    : params.resultUrl;
  const resultUrl = params.protocol === "tokengo-media"
    ? resolveTokengoMediaResultUrl(params.baseUrl ?? "", rawResultUrl)
    : rawResultUrl;
  if (!resultUrl) throw new Error("ai_provider_video_empty_result_url");
  const sameProviderOrigin = params.baseUrl
    ? (() => {
        try {
          return new URL(resultUrl).origin === new URL(params.baseUrl).origin;
        } catch {
          return false;
        }
      })()
    : false;
  const headers = params.apiKey && (
    (params.protocol === "openai-videos" && (params.yinglingOpenAiVideos || !isYinglingApiBaseUrl(params.baseUrl ?? "") || sameProviderOrigin)) ||
    (params.protocol === "tokengo-media" && sameProviderOrigin)
  )
    ? { Authorization: `Bearer ${params.apiKey}` }
    : undefined;
  return withVideoProviderReadRetries(async () => {
    throwIfLocalWorkerAborted(params.signal);
    const response = await fetchWithTimeout(resultUrl, {
      ...(headers ? { headers } : {}),
      cache: "no-store",
      signal: params.signal
    }, Math.min(params.timeoutMs, 120_000), "ai_provider_video_download_timeout");
    if (!response.ok) throw new Error(`ai_provider_video_download_failed_${response.status}`);
    const mimeType = normalizedVideoMimeType(response.headers.get("content-type") ?? "video/mp4");
    const bytes = await readBodyWithDeadline(response, {
      maxBytes: PROVIDER_RESULT_BODY_MAX_BYTES,
      timeoutMs: Math.min(params.timeoutMs, 300_000),
      timeoutError: "ai_provider_video_download_body_timeout",
      signal: params.signal
    });
    if (!bytes.length) throw new Error("ai_provider_video_empty_payload");
    return { bytes, mimeType };
  }, params.signal);
}

async function generateVideoWithProvider(params: {
  payload: WorkerPayload;
  providerId: string;
  signal?: AbortSignal;
  timing?: Record<string, string>;
}) {
  throwIfLocalWorkerAborted(params.signal);
  const timing = params.timing ?? {};
  const markTiming = (key: string) => {
    const value = new Date().toISOString();
    timing[key] = value;
    return value;
  };
  const provider = getCachedWorkerProviderSecret(params.payload.requestId, params.providerId) ??
    await getPlatformAiProviderRelational(params.providerId);
  if (provider?.enabled === false) {
    throw new Error("ai_provider_disabled");
  }
  if (!provider?.apiKey?.trim()) {
    throw new Error("ai_provider_api_key_missing");
  }
  const providerApiKey = provider.apiKey;
  const requestedModel = requestedModelOverride(params.payload);
  const model = normalizeVideoGenerationModel(requestedModel && isVideoGenerationModel(requestedModel) ? requestedModel : provider.modelType);
  if (provider.providerType !== "video" && !isVideoGenerationModel(model)) {
    throw new Error(`ai_provider_not_video_model_${provider.label || provider.id}_${model}`);
  }
  const requestedReferenceAssets = videoFrameAssets(params.payload);
  const baseUrl = normalizeBaseUrl(provider.aiUrl);
  const protocol = videoProviderProtocol(baseUrl, provider.apiProtocol);
  if (isSmartPickLidBaseUrl(baseUrl) && !shouldAllowSmartPickLidVideoProvider()) {
    throw new Error("ai_provider_video_content_unverified_smartpicklid");
  }
  if (isMagic666BaseUrl(baseUrl) && !shouldAllowMagic666VideoProvider()) {
    throw new Error("ai_provider_video_content_unverified_magic666");
  }
  if (shouldBlockSmartPickLidReferenceVideo({
    baseUrl,
    protocol,
    referenceAssetCount: requestedReferenceAssets.length
  })) {
    throw new Error("ai_provider_video_reference_channel_unreliable_smartpicklid");
  }
  const configuredProviderReferenceLimit = Math.max(1, Math.trunc(provider.maxImagesPerRequest || 1));
  const preferJsonVideoRequest = shouldPreferOpenAiJsonVideoRequest({ baseUrl, model, protocol });
  const directJsonReferences = shouldPreferDirectOpenAiJsonVideoReferences({
    baseUrl,
    model,
    protocol,
    referenceAssetCount: requestedReferenceAssets.length
  });
  const providerReferenceLimit = directJsonReferences ? openAiJsonVideoReferenceLimit() : configuredProviderReferenceLimit;
  const referenceAssets = requestedReferenceAssets.slice(0, providerReferenceLimit);
  // Reference audio (voice tone) travels to the provider alongside the frames;
  // yingling-class relays consume it via the `audio_url` request field. The
  // provider downloads these URLs itself, so they must be publicly reachable:
  // prefer the public origin over the loopback callback origin (relays reject
  // non-standard ports such as the local :3013 callback).
  const audioAssetUrls = videoAudioAssets(params.payload)
    .map((asset) => providerReachableAssetUrl(asset).trim())
    .filter((url) => /^https?:\/\//i.test(url));
  if (params.payload.siteId === "site_aidreamcapes") {
    console.warn("local_ai_worker_video_audio_attached", { jobId: params.payload.jobId, audioCount: audioAssetUrls.length });
  }

  const timeoutMs = videoProviderTimeoutMs();
  const videoParams = videoProviderParams(params.payload);
  const useProviderFrameUrls = protocol !== "openai-videos" || !preferJsonVideoRequest;
  const usePreparedProviderDataUris = protocol === "lk888-media";
  const endImageUrl = explicitVideoEndImageUrl(params.payload);
  const imageUrls = useProviderFrameUrls
    ? usePreparedProviderDataUris
      ? await videoProviderPreparedDataUriFrameUrls({ referenceAssets, signal: params.signal, timeoutMs, targetSize: videoParams.size })
      : await videoProviderFrameUrls({ referenceAssets, allowDataUriFallback: protocol !== "tokengo-media", signal: params.signal, timeoutMs, targetSize: videoParams.size })
    : [];
  if (protocol === "lk888-media" && isGrokImagineVideoModel(model) && !referenceAssets.length) {
    throw new Error("ai_provider_video_first_frame_required_lk888_media");
  }
  if (useProviderFrameUrls && (imageUrls.length !== referenceAssets.length || (shouldRejectLoopbackVideoFrameUrls() && imageUrls.some(isLoopbackUrl)))) {
    throw new Error("ai_provider_video_frame_public_urls_required");
  }
  assertTokengoMediaPublicFrameUrls(protocol, imageUrls);
  const videoPromptForReferenceAssets = (assets: ImageInputAsset[]) => !assets.length
      ? buildTextToVideoPrompt(params.payload, videoParams)
      : protocol === "lk888-media"
      ? buildLk888MediaVideoPrompt(params.payload, assets, videoParams)
      : preferJsonVideoRequest
      ? buildOpenAiJsonVideoPrompt(params.payload, assets, videoParams)
      : buildVideoPrompt(params.payload, assets, videoParams);
  const prompt = videoPromptForReferenceAssets(referenceAssets);
  const providerPromptAuditTiming = {
    providerUserPromptLength: String(videoProviderUserPrompt(params.payload).length),
    providerPromptLength: String(prompt.length),
    providerPromptSource: isDirectWorkspaceVideo(params.payload) ? "workspace_direct_user_prompt" : "user_prompt_plus_reference_fidelity_format_and_output_constraint"
  };
  const referencePreparedAt = markTiming("referencePreparedAt");
  await postWorkerSlotStatus(params.payload, "running", "video_reference_format_ready", {
    index: 1,
    status: "running",
    stage: "video_reference_format_ready",
    error: "",
    referenceFrameCount: referenceAssets.length,
    requestedReferenceFrameCount: requestedReferenceAssets.length,
    providerReferenceLimit,
    providerReferenceSize: videoParams.size,
    updatedAt: new Date().toISOString()
  }, { forceWrite: true, timing: { referencePreparedAt } });
  await postWorkerStatus(params.payload, "running", "source_images_ready", { timing: { referencePreparedAt } });
  await postWorkerStatus(params.payload, "running", "video_provider_request_started", {
    timing: { referencePreparedAt, ...providerPromptAuditTiming }
  });
  await postWorkerSlotStatus(params.payload, "running", "video_provider_request_started", {
    index: 1,
    status: "running",
    stage: "video_provider_request_started",
    error: "",
    referenceFrameCount: referenceAssets.length,
    requestedReferenceFrameCount: requestedReferenceAssets.length,
    providerReferenceLimit,
    updatedAt: new Date().toISOString()
  }, { forceWrite: true, timing: { referencePreparedAt } });

  const runVideoProviderTask = async (frameImageUrls: string[], taskReferenceAssets = referenceAssets, taskPrompt = prompt) => {
    let taskId = "";
    let createError: unknown;
    for (const modelCandidate of videoProviderModelCandidates(model, { protocol, referenceAssetCount: taskReferenceAssets.length, baseUrl })) {
      throwIfLocalWorkerAborted(params.signal);
      try {
        if (params.payload.siteId === "site_aidreamcapes") console.warn("local_ai_worker_video_create_started", { jobId: params.payload.jobId, provider: provider.label || provider.id, model: modelCandidate, protocol });
        taskId = await createVideoTask({
          baseUrl,
          apiKey: providerApiKey,
          model: modelCandidate,
          prompt: taskPrompt,
          imageUrls: frameImageUrls,
          audioUrls: audioAssetUrls,
          referenceAssets: taskReferenceAssets,
          videoParams,
          protocol,
          clientRequestId: `${params.payload.jobId}_${params.payload.requestId}`,
          endImageUrl,
          signal: params.signal,
          timeoutMs,
          onProviderCreateStarted: async () => {
            const providerCreateStartedAt = markTiming("providerCreateStartedAt");
            await postWorkerSlotStatus(params.payload, "running", "video_provider_create_started", {
              index: 1,
              status: "running",
              stage: "video_provider_create_started",
              error: "",
              referenceFrameCount: taskReferenceAssets.length,
              requestedReferenceFrameCount: requestedReferenceAssets.length,
              providerReferenceLimit,
              updatedAt: providerCreateStartedAt
            }, { forceWrite: true, timing: { providerCreateStartedAt } });
          }
        });
        break;
      } catch (error) {
        createError = error;
        if (!shouldTryNextVideoModel(error)) break;
      }
    }
    if (!taskId) throw createError instanceof Error ? createError : new Error("ai_provider_video_create_failed");
    const providerTaskCreatedAt = markTiming("providerTaskCreatedAt");
    if (params.payload.siteId === "site_aidreamcapes") console.warn("local_ai_worker_video_task_created", { jobId: params.payload.jobId, provider: provider.label || provider.id, providerTaskId: taskId });
    await postWorkerSlotStatus(params.payload, "running", "video_task_created", {
      index: 1,
      status: "running",
      stage: "video_task_created",
      providerTaskId: taskId,
      error: "",
      updatedAt: new Date().toISOString()
    }, { forceWrite: true, timing: { providerTaskCreatedAt } });
    const status = await pollVideoTask({
      payload: params.payload,
      baseUrl,
      apiKey: providerApiKey,
      taskId,
      protocol,
      providerFamily: videoProviderModelFamilyForProvider(provider),
      timing,
      signal: params.signal,
      timeoutMs
    });
    const providerCompletedAt = markTiming("providerCompletedAt");
    await postWorkerSlotStatus(params.payload, "running", "video_provider_completed", {
      index: 1,
      status: "running",
      stage: "video_provider_completed",
      providerTaskId: taskId,
      progress: 100,
      error: "",
      updatedAt: providerCompletedAt
    }, { forceWrite: true, timing: { providerCompletedAt } });
    return { status, taskId, referenceFrameCount: taskReferenceAssets.length };
  };

  let status: VideoStatusResponse | undefined;
  let taskId = "";
  let usedReferenceFrameCount = referenceAssets.length;
  const resumedTaskId = await videoProviderTaskIdForResume(params.payload);
  try {
    if (resumedTaskId) {
      taskId = resumedTaskId;
      const providerResumedAt = markTiming("providerTaskResumedAt");
      await postWorkerSlotStatus(params.payload, "running", "video_provider_task_resumed", {
        index: 1,
        status: "running",
        stage: "video_provider_task_resumed",
        providerTaskId: taskId,
        error: "",
        updatedAt: providerResumedAt
      }, { forceWrite: true, timing: { providerResumedAt } });
      status = await pollVideoTask({
        payload: params.payload,
        baseUrl,
        apiKey: providerApiKey,
        taskId,
        protocol,
        providerFamily: videoProviderModelFamilyForProvider(provider),
        timing,
        signal: params.signal,
        timeoutMs
      });
    } else {
      const result = await runVideoProviderTask(imageUrls);
      status = result.status;
      taskId = result.taskId;
      usedReferenceFrameCount = result.referenceFrameCount;
    }
  } catch (error) {
    if (resumedTaskId) throw error;
    if (!shouldRetryVideoTaskWithDataUriFrames({ error, imageUrls, protocol })) throw error;
    await postWorkerSlotStatus(params.payload, "running", "video_provider_retry_data_uri_frames", {
      index: 1,
      status: "running",
      stage: "video_provider_retry_data_uri_frames",
      error: errorMessage(error).slice(0, 240),
      updatedAt: new Date().toISOString()
    });
    const dataUriImageUrls = await videoProviderPreparedDataUriFrameUrls({
      referenceAssets,
      signal: params.signal,
      timeoutMs,
      targetSize: videoParams.size
    });
    const result = await runVideoProviderTask(dataUriImageUrls);
    status = result.status;
    taskId = result.taskId;
    usedReferenceFrameCount = result.referenceFrameCount;
  }
  if (!status) throw new Error("ai_provider_video_empty_status");
  const resultUrl = videoStatusResultUrl(status);
  if ((protocol === "lk888-media" || protocol === "tokengo-media") && !resultUrl) throw new Error("ai_provider_video_empty_result_url");
  const downloadedVideo = await downloadVideoResult({
    resultUrl,
    baseUrl,
    apiKey: providerApiKey,
    taskId,
    protocol,
    yinglingOpenAiVideos: yinglingJobUsesOpenAiVideos(baseUrl, audioAssetUrls.length),
    signal: params.signal,
    timeoutMs
  });
  const downloadedAt = markTiming("downloadedAt");
  throwIfLocalWorkerAborted(params.signal);
  const optimizeMode = generatedVideoOptimizeMode();
  const video = optimizeMode === "sync"
    ? await optimizeGeneratedVideoForPlayback(downloadedVideo, optimizeMode)
    : downloadedVideo;
  throwIfLocalWorkerAborted(params.signal);
  const storageKey = customerAssetStorageKey({
    siteId: params.payload.siteId,
    customerId: params.payload.customerId,
    fileName: `${params.payload.jobId}-video-1.${extensionForCustomerAssetMime(video.mimeType)}`
  });
  await writeCustomerAssetFileShared({
    storageKey,
    bytes: video.bytes,
    mimeType: video.mimeType,
    purpose: "output"
  });
  const storedAt = markTiming("storedAt");
  await postWorkerSlotStatus(params.payload, "running", "video_result_received", {
    index: 1,
    status: "succeeded",
    stage: "video_result_received",
    storageKey,
    mimeType: video.mimeType,
    error: "",
    referenceFrameCount: usedReferenceFrameCount,
    requestedReferenceFrameCount: requestedReferenceAssets.length,
    providerReferenceLimit,
    updatedAt: new Date().toISOString()
  }, { forceWrite: true, timing: { downloadedAt, storedAt } });
  const asyncVideoOptimization = optimizeMode === "async" ? async () => {
    const optimized = await optimizeGeneratedVideoForPlayback(downloadedVideo, optimizeMode);
    if (optimized.bytes === downloadedVideo.bytes && optimized.mimeType === downloadedVideo.mimeType) return;
    const optimizedStorageKey = customerAssetStorageKey({
      siteId: params.payload.siteId,
      customerId: params.payload.customerId,
      fileName: `${params.payload.jobId}-video-1-optimized.${extensionForCustomerAssetMime(optimized.mimeType)}`
    });
    await writeCustomerAssetFileShared({
      storageKey: optimizedStorageKey,
      bytes: optimized.bytes,
      mimeType: optimized.mimeType,
      purpose: "output"
    });
    const optimizedStoredAt = new Date().toISOString();
    const result = await replaceSettledGenerationOutputStorageKeyRelational({
      jobId: params.payload.jobId,
      siteId: params.payload.siteId,
      customerId: params.payload.customerId,
      originalStorageKey: storageKey,
      storageKey: optimizedStorageKey,
      mimeType: optimized.mimeType,
      timing: { optimizedStoredAt }
    });
    if (result.updated && result.job) {
      publishCustomerJobEventForJob("result", result.job, { eventKind: "final", timing: timingFromResultJson(result.job.resultJson, { optimizedStoredAt }) });
    }
  } : undefined;
  return {
    storageKey,
    mimeType: video.mimeType,
    providerLabel: provider.label,
    index: 1,
    estimatedCostUsd: typeof status.cost === "number" ? status.cost : undefined,
    providerCreditCost: typeof status.creditCost === "number" ? status.creditCost : undefined,
    providerCurrency: protocol === "huitu-openapi" && typeof status.creditCost === "number" ? HUITU_OPENAPI_PROVIDER_CURRENCY : undefined,
    referenceFrameCount: usedReferenceFrameCount,
    requestedReferenceFrameCount: requestedReferenceAssets.length,
    providerReferenceLimit,
    timing,
    asyncVideoOptimization
  };
}

async function generateWithProvider(params: {
  payload: WorkerPayload;
  providerId: string;
  signal?: AbortSignal;
  slotIndexes: number[];
  totalCount: number;
}) {
  throwIfLocalWorkerAborted(params.signal);
  const provider = await getPlatformAiProviderRelational(params.providerId);
  if (!provider) {
    throw new Error("ai_provider_not_found");
  }
  if (provider?.enabled === false) {
    throw new Error("ai_provider_disabled");
  }
  if (!provider?.apiKey?.trim()) {
    throw new Error("ai_provider_api_key_missing");
  }
  const selectedProvider = provider;
  const requestedModel = textValue(params.payload.params.modelOverride);
  const model = requestedModel && isImageGenerationModel(requestedModel) ? requestedModel : provider.modelType;
  if (!isImageGenerationModel(model)) {
    throw new Error(`ai_provider_not_image_model_${provider.label || provider.id}_${model}`);
  }
  const baseUrl = normalizeBaseUrl(provider.aiUrl);
  const providerApiKey = provider.apiKey;
  const providerLabel = provider.label;
  const timeoutMs = providerTimeoutMs();
  const prompt = buildPrompt(params.payload);
  const hasInputImages = inputAssets(params.payload).length > 0;
  await postWorkerStatus(params.payload, "running", "source_images_ready");
  await postWorkerStatus(params.payload, "running", "provider_request_started");

  async function generateSlot(slotIndex: number) {
    throwIfLocalWorkerAborted(params.signal);
    const promptForSlot = promptForOutputSlot(prompt, slotIndex, params.totalCount);
    await postWorkerSlotStatus(params.payload, "running", "provider_request_started", {
      index: slotIndex,
      status: "running",
      stage: "provider_request_started",
      error: "",
      updatedAt: new Date().toISOString()
    });
    try {
      const generated = isTokengoImageProvider(selectedProvider)
        ? await generateTokengoImage({
          payload: params.payload,
          baseUrl,
          apiKey: providerApiKey,
          model,
          prompt: promptForSlot,
          slotIndex,
          provider: selectedProvider,
          signal: params.signal,
          timeoutMs
        })
        : await (async (): Promise<GeneratedImageResult> => {
          const response = hasInputImages
            ? await (async () => {
              const form = await buildImageEditForm({ payload: params.payload, model, prompt: promptForSlot, signal: params.signal, timeoutMs });
              if (!form) throw new Error("ai_provider_image_edit_missing_input");
              return fetchWithTimeout(
                `${baseUrl}/v1/images/edits`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${providerApiKey}`
                  },
                  body: form,
                  cache: "no-store",
                  signal: params.signal
                },
                timeoutMs,
                `ai_provider_image_edit_timeout_${timeoutMs}`
              );
            })()
            : await fetchWithTimeout(`${baseUrl}/v1/images/generations`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${providerApiKey}`
              },
              body: JSON.stringify({
                model,
                prompt: promptForSlot,
                size: imageProviderRequestSize(selectedProvider),
                quality: imageProviderRequestQuality(selectedProvider),
                response_format: "b64_json"
              }),
              cache: "no-store",
              signal: params.signal
            }, timeoutMs, `ai_provider_generation_timeout_${timeoutMs}`);
          const body = await readJsonWithDeadline<ImageGenerationResponse>(response, {
            maxBytes: PROVIDER_JSON_BODY_MAX_BYTES,
            timeoutMs,
            timeoutError: `ai_provider_generation_body_timeout_${timeoutMs}`,
            signal: params.signal
          });
          if (!response.ok) {
            const mode = hasInputImages ? "image_edit" : "generation";
            throw new Error(`ai_provider_${mode}_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
          }
          const [b64] = imageBase64List(body);
          if (b64) {
            const bytes = Buffer.from(b64, "base64");
            return { bytes, mimeType: imageMimeTypeFromBytes(bytes, "image/png") };
          }
          const [resultUrl] = imageResultUrls(body);
          if (!resultUrl) throw new Error("ai_provider_empty_image_payload");
          return downloadImageResultUrl(resultUrl, selectedProvider, providerApiKey, timeoutMs);
        })();
      throwIfLocalWorkerAborted(params.signal);
      const preparedOutput = prepareCompressedCustomerImage({
        bytes: generated.bytes,
        mimeType: generated.mimeType,
        fileName: `${params.payload.jobId}-output-${slotIndex}.png`,
        purpose: "output"
      });
      const storageKey = customerAssetStorageKey({
        siteId: params.payload.siteId,
        customerId: params.payload.customerId,
        fileName: `${params.payload.jobId}-output-${slotIndex}.${extensionForCustomerAssetMime(preparedOutput.mimeType)}`
      });
      await writeCustomerAssetFileShared({
        storageKey,
        bytes: preparedOutput.bytes,
        mimeType: preparedOutput.mimeType,
        purpose: "output"
      });
      throwIfLocalWorkerAborted(params.signal);
      await postWorkerSlotStatus(params.payload, "running", "provider_response_received", {
        index: slotIndex,
        status: "succeeded",
        stage: "provider_response_received",
        storageKey,
        mimeType: preparedOutput.mimeType,
        ...(generated.providerTaskId ? { providerTaskId: generated.providerTaskId } : {}),
        error: "",
        updatedAt: new Date().toISOString()
      });
      return {
        storageKey,
        mimeType: preparedOutput.mimeType,
        providerLabel,
        index: slotIndex,
        ...(generated.providerTaskId ? { providerTaskId: generated.providerTaskId } : {}),
        ...(generated.providerCreditCost !== undefined ? { providerCreditCost: generated.providerCreditCost } : {}),
        ...(generated.providerCurrency ? { providerCurrency: generated.providerCurrency } : {})
      };
    } catch (error) {
      await postWorkerSlotStatus(params.payload, "running", "provider_slot_failed", {
        index: slotIndex,
        status: "failed",
        stage: "provider_slot_failed",
        error: errorMessage(error).slice(0, 240),
        updatedAt: new Date().toISOString()
      });
      throw error;
    }
  }

  const slots = await Promise.allSettled(
    params.slotIndexes.map((slotIndex) => generateSlot(slotIndex))
  );
  const outputs = slots
    .filter((slot): slot is PromiseFulfilledResult<GeneratedOutput> => slot.status === "fulfilled")
    .map((slot) => slot.value)
    .sort((left, right) => left.index - right.index);
  const firstError = slots.find((slot): slot is PromiseRejectedResult => slot.status === "rejected")?.reason;
  return { outputs, error: firstError };
}

function imageProviderCostTrace(outputs: GeneratedOutput[]) {
  const estimatedCostUsd = outputs.reduce((total, output) => total + (output.estimatedCostUsd ?? 0), 0);
  const providerCostOutputs = outputs.filter((output) => output.providerCreditCost !== undefined);
  const providerCreditCost = providerCostOutputs.reduce((total, output) => total + (output.providerCreditCost ?? 0), 0);
  return {
    estimatedCostUsd,
    ...(providerCostOutputs.length ? { providerCreditCost, providerCurrency: providerCostOutputs[0].providerCurrency } : {})
  };
}

function videoProviderFailureContext(provider: WorkerImageProvider): { providerFamily: VideoModelFamily; providerProtocol: VideoProviderProtocol } {
  return {
    providerFamily: videoProviderModelFamilyForProvider(provider),
    providerProtocol: videoProviderProtocol(normalizeBaseUrl(provider.aiUrl ?? ""), provider.apiProtocol)
  };
}

async function runLocalVideoWorker(payload: WorkerPayload, signal?: AbortSignal) {
  throwIfLocalWorkerAborted(signal);
  const workerAcceptedAt = new Date().toISOString();
  const workerTiming = { workerAcceptedAt };
  const providers = orderedVideoProviders(payload);
  if (!providers.length) {
    await postWorkerResult(payload, { status: "failed", error: "no_video_ai_provider_configured", timing: workerTiming });
    return;
  }

  const started = await postWorkerStatus(payload, "running", "local_video_worker_started", { timing: workerTiming });
  if (started.alreadyFinal) return;
  if (payload.siteId === "site_aidreamcapes") console.warn("local_ai_worker_video_started", { jobId: payload.jobId, requestId: payload.requestId, providers: providers.map((provider) => provider.label || provider.id) });
  const providerTrace: Array<{ provider: string; attempts: number }> = [];
  const providerErrors: Array<{ provider: string; error: string }> = [];
  let lastError = "";
  let lastProviderFailure: VideoProviderFailure | undefined;
  let lastProviderTiming: Record<string, string> | undefined;

  for (const provider of providers) {
    throwIfLocalWorkerAborted(signal);
    const trace = { provider: provider.label || provider.id, attempts: 0 };
    providerTrace.push(trace);
    const failureContext = videoProviderFailureContext(provider);
    const maxAttempts = videoProviderAttempts();
    try {
      for (const attempt of Array.from({ length: maxAttempts }, (_, attemptIndex) => attemptIndex + 1)) {
        throwIfLocalWorkerAborted(signal);
        trace.attempts += 1;
        const attemptTiming: Record<string, string> = {};
        try {
          const output = await generateVideoWithProvider({ payload, providerId: provider.id, signal, timing: attemptTiming });
          lastProviderTiming = { ...attemptTiming, ...output.timing };
          await postWorkerResult(payload, {
            status: "succeeded",
            outputs: [{ storageKey: output.storageKey, mimeType: output.mimeType }],
            providerTrace,
            costTrace: {
              estimatedCostUsd: output.estimatedCostUsd ?? 0,
              providerCreditCost: output.providerCreditCost,
              providerCurrency: output.providerCurrency,
              referenceFrameCount: output.referenceFrameCount,
              requestedReferenceFrameCount: output.requestedReferenceFrameCount,
              providerReferenceLimit: output.providerReferenceLimit
            },
            timing: { ...workerTiming, ...output.timing }
          });
          if (output.asyncVideoOptimization) {
            void output.asyncVideoOptimization().catch((error) => {
              console.warn("worker_async_video_optimization_failed", {
                jobId: payload.jobId,
                error: errorMessage(error).slice(0, 240)
              });
            });
          }
          return;
        } catch (error) {
          if (Object.keys(attemptTiming).length) lastProviderTiming = { ...attemptTiming };
          lastError = errorMessage(error);
          lastProviderFailure = videoProviderFailureFromError(error, failureContext);
          if (!isRetryableProviderError(error) || attempt >= maxAttempts) break;
          await sleepWithLocalWorkerAbort(10_000 * attempt, signal);
        }
      }
      throw new Error(lastError || "local_video_worker_generation_failed");
    } catch (error) {
      lastError = errorMessage(error);
      lastProviderFailure = videoProviderFailureFromError(error, failureContext);
      providerErrors.push({ provider: provider.label || provider.id, error: lastError });
      await postWorkerSlotStatus(payload, "running", "video_provider_failed", {
        index: 1,
        status: "failed",
        stage: "video_provider_failed",
        error: lastError.slice(0, 240),
        ...(lastProviderFailure ? { providerFailure: lastProviderFailure } : {}),
        updatedAt: new Date().toISOString()
      }, lastProviderTiming ? { timing: lastProviderTiming } : {});
      if (!shouldTryNextPaidVideoProvider(error, lastProviderTiming)) break;
    }
  }

  const firstProviderError = providerErrors[0]?.error || "";
  const finalError = lastError.toLowerCase().includes("invalid token") || lastError.toLowerCase().includes("no access to model")
    ? firstProviderError || lastError
    : lastError;
  await postWorkerResult(payload, {
    status: "failed",
    providerTrace,
    error: finalError || "local_video_worker_generation_failed",
    ...(lastProviderFailure ? { providerFailure: lastProviderFailure } : {}),
    costTrace: { providerErrors, ...(lastProviderFailure ? { providerFailure: lastProviderFailure } : {}) },
    timing: { ...workerTiming, ...(lastProviderTiming ?? {}) }
  });
}

async function runLocalImageWorker(payload: WorkerPayload, signal?: AbortSignal) {
  throwIfLocalWorkerAborted(signal);
  const providers = orderedImageProviders(payload);
  if (!providers.length) {
    await postWorkerResult(payload, { status: "failed", error: "no_image_ai_provider_configured" });
    return;
  }

  const started = await postWorkerStatus(payload, "running", "local_worker_started");
  if (started.alreadyFinal) return;
  const providerTrace: Array<{ provider: string; attempts: number }> = [];
  const totalCount = outputCount(payload);
  const successfulOutputsByIndex = new Map<number, GeneratedOutput>();
  let lastError = "";
  const providerErrors: Array<{ provider: string; error: string }> = [];

  for (const provider of providers) {
    throwIfLocalWorkerAborted(signal);
    const trace = { provider: provider.label || provider.id, attempts: 0 };
    providerTrace.push(trace);
    try {
      let outputError: unknown;
      for (const attempt of Array.from({ length: providerAttempts() }, (_, attemptIndex) => attemptIndex + 1)) {
        throwIfLocalWorkerAborted(signal);
        const missingSlotIndexes = Array.from({ length: totalCount }, (_, index) => index + 1)
          .filter((slotIndex) => !successfulOutputsByIndex.has(slotIndex));
        if (!missingSlotIndexes.length) break;
        trace.attempts += 1;
        try {
          const result = await generateWithProvider({
            payload,
            providerId: provider.id,
            signal,
            slotIndexes: missingSlotIndexes,
            totalCount
          });
          for (const output of result.outputs) {
            successfulOutputsByIndex.set(output.index, output);
          }
          outputError = result.error;
          if (!result.error || successfulOutputsByIndex.size >= totalCount) break;
          if (!isRetryableProviderError(result.error) || attempt >= providerAttempts()) break;
          await sleepWithLocalWorkerAbort(900 * attempt, signal);
        } catch (error) {
          outputError = error;
          if (!isRetryableProviderError(error) || attempt >= providerAttempts()) break;
          await sleepWithLocalWorkerAbort(900 * attempt, signal);
        }
      }
      if (successfulOutputsByIndex.size < totalCount) {
        const missingCount = totalCount - successfulOutputsByIndex.size;
        throw outputError instanceof Error ? outputError : new Error(`local_worker_missing_${missingCount}_outputs`);
      }
      const outputs = Array.from(successfulOutputsByIndex.values())
        .sort((left, right) => left.index - right.index)
        .map((output) => ({ storageKey: output.storageKey, mimeType: output.mimeType, ...(output.providerTaskId ? { providerTaskId: output.providerTaskId } : {}) }));
      await postWorkerResult(payload, {
        status: "succeeded",
        outputs,
        providerTrace,
        costTrace: imageProviderCostTrace(Array.from(successfulOutputsByIndex.values()))
      });
      return;
    } catch (error) {
      lastError = errorMessage(error);
      providerErrors.push({ provider: provider.label || provider.id, error: lastError });
      if (isTokengoImageProvider(provider) && process.env.LOCAL_AI_WORKER_ALLOW_PAID_TOKENGO_IMAGE_FALLBACK !== "1") break;
    }
  }

  const partialOutputs = Array.from(successfulOutputsByIndex.values())
    .sort((left, right) => left.index - right.index)
    .map((output) => ({ storageKey: output.storageKey, mimeType: output.mimeType, ...(output.providerTaskId ? { providerTaskId: output.providerTaskId } : {}) }));
  if (partialOutputs.length) {
    await postWorkerResult(payload, {
      status: "succeeded",
      outputs: partialOutputs,
      providerTrace,
      error: lastError || "local_worker_partial_generation_failed",
      costTrace: { ...imageProviderCostTrace(Array.from(successfulOutputsByIndex.values())), providerErrors }
    });
    return;
  }

  await postWorkerResult(payload, {
    status: "failed",
    providerTrace,
    error: lastError || "local_worker_generation_failed",
    costTrace: { providerErrors }
  });
}

async function runLocalWorker(payload: WorkerPayload, signal?: AbortSignal) {
  throwIfLocalWorkerAborted(signal);
  if (isVideoGenerationRequest(payload)) {
    await runLocalVideoWorker(payload, signal);
    return;
  }
  await runLocalImageWorker(payload, signal);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as WorkerPayload;
  if (!payload.jobId || !payload.siteId || !payload.customerId || !payload.callbackUrl || !payload.requestId) {
    return NextResponse.json({ error: "invalid_worker_payload" }, { status: 400 });
  }
  if (!verifyWorkerPayloadSignature(payload)) {
    return NextResponse.json({ error: "invalid_worker_payload_signature" }, { status: 401 });
  }

  const workerRegistration = registerLocalWorkerProcess({
    siteId: payload.siteId,
    jobId: payload.jobId,
    requestId: payload.requestId
  });
  const createOrphanWatchdogMs = isVideoGenerationRequest(payload) ? videoCreateOrphanWatchdogMs() : 0;
  const createOrphanWatchdog = createOrphanWatchdogMs > 0
    ? setTimeout(() => {
        void releaseStaleActiveGenerationJobRelational({
          siteId: payload.siteId,
          customerId: payload.customerId,
          jobId: payload.jobId,
          forceVideoCreateTimeout: true
        }).then((released) => {
          if (!released) return;
          const abortResult = abortLocalWorkerProcesses({
            siteId: payload.siteId,
            jobId: payload.jobId,
            requestId: payload.requestId,
            reason: "local_worker_aborted"
          });
          console.warn("local_ai_worker_watchdog_released_stale_video_job", {
            jobId: payload.jobId,
            requestId: payload.requestId,
            aborted: abortResult.aborted,
            abortCount: abortResult.count
          });
        }).catch((error) => {
          console.error("local_ai_worker_watchdog_release_failed", error);
        });
      }, createOrphanWatchdogMs)
    : undefined;
  createOrphanWatchdog?.unref?.();
  void runLocalWorker(payload, workerRegistration.signal).catch((error) => {
    if (workerRegistration.signal.aborted || isLocalWorkerAbortError(error)) return;
    console.error("local_ai_worker_dispatch_failed", error);
    void postWorkerResult(payload, {
      status: "failed",
      error: errorMessage(error).slice(0, 500)
    }).catch((callbackError) => {
      console.error("local_ai_worker_dispatch_failure_settlement_failed", callbackError);
    });
  }).finally(() => {
    if (createOrphanWatchdog) clearTimeout(createOrphanWatchdog);
    workerRegistration.unregister();
  });
  return NextResponse.json({ ok: true, status: "accepted", jobId: payload.jobId }, { status: 202 });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "POST,OPTIONS" }
  });
}
