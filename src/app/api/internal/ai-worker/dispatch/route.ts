import { NextResponse } from "next/server";
import {
  customerAssetStorageKey,
  extensionForCustomerAssetMime,
  prepareCompressedCustomerImage,
  writeCustomerAssetFileShared
} from "@/lib/customer-asset-storage";
import { getPlatformAiProviderRelational } from "@/lib/stores/platform-store";
import {
  signWorkerLocalAssetDownload,
  signWorkerCallback,
  verifyWorkerPayloadSignature,
  type WorkerOutputSlot,
  type WorkerPayload
} from "@/lib/worker";
import { MAX_MULTI_REFERENCE_VIDEO_FRAME_LIMIT, normalizeVideoDurationSeconds, normalizeVideoFrameLimit } from "@/lib/video-frame-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SharpResizeOptions = {
  width?: number;
  height?: number;
  fit?: "cover" | "inside";
  position?: "attention" | "centre" | "center";
  withoutEnlargement?: boolean;
};
type SharpInstance = {
  rotate: () => SharpInstance;
  resize: (options: SharpResizeOptions) => SharpInstance;
  jpeg: (options: { quality: number; mozjpeg: boolean }) => SharpInstance;
  toBuffer: () => Promise<Buffer>;
};
type SharpFactory = (input: Buffer) => SharpInstance;

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

type ImageGenerationResponse = {
  data?: Array<{ b64_json?: string; image_base64?: string }>;
  output?: Array<{ b64_json?: string; image_base64?: string }>;
  image_base64?: string;
  error?: unknown;
};

type ImageInputAsset = {
  assetId: string;
  signedUrl: string;
  publicUrl?: string;
};

type FetchInitWithDispatcher = RequestInit & { dispatcher?: unknown };

type VideoGenerateResponse = {
  code?: number;
  data?: { task_id?: string | number };
  id?: string | number;
  request_id?: string | number;
  task_id?: string | number;
  msg?: string;
  error?: unknown;
};

type VideoStatusResponse = {
  id?: string | number;
  task_id?: string | number;
  state?: string;
  status?: string;
  status_group?: string;
  is_final?: boolean;
  progress?: string;
  result_url?: string;
  result_type?: string;
  video?: { url?: string; duration?: number };
  error?: unknown;
  message?: string;
  cost?: number;
};

type VideoProviderProtocol = "lk888-media" | "openai-videos";

type WorkerImageProvider = WorkerPayload["aiProviderFallback"]["providers"][number];
type GeneratedOutput = {
  storageKey: string;
  mimeType: string;
  providerLabel: string;
  index: number;
  estimatedCostUsd?: number;
  referenceFrameCount?: number;
  requestedReferenceFrameCount?: number;
  providerReferenceLimit?: number;
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
  return normalized.includes("video") || normalized.includes("grok-imagine-video");
}

function normalizeVideoGenerationModel(model: string) {
  return model.trim();
}

function isImageToVideoModel(model: string) {
  const normalized = model.trim().toLowerCase();
  return normalized.includes("grok-imagine-video") || normalized.includes("image-to-video") || normalized.includes("i2v");
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

function usesProxyOpenAiVideoEndpoint(baseUrl: string) {
  return isSmartPickLidBaseUrl(baseUrl) || isMagic666BaseUrl(baseUrl);
}

function openAiVideoCreateEndpoint(baseUrl: string) {
  return `${baseUrl}${usesProxyOpenAiVideoEndpoint(baseUrl) ? "/v1/videos" : "/v1/videos/generations"}`;
}

function isGrokImagineVideoModel(model: string) {
  return model.trim().toLowerCase().includes("grok-imagine-video");
}

function videoProviderModelCandidates(model: string, params?: { protocol?: VideoProviderProtocol; referenceAssetCount?: number; baseUrl?: string }) {
  const normalizedModel = normalizeVideoGenerationModel(model);
  const protocol = params?.protocol;
  const referenceAssetCount = Math.max(0, Math.trunc(Number(params?.referenceAssetCount ?? 0) || 0));
  if (protocol === "openai-videos" && referenceAssetCount > 1) {
    return Array.from(new Set([
      isGrokImagineVideoModel(normalizedModel) && !normalizedModel.includes("1.5") ? normalizedModel : "",
      "grok-imagine-video"
    ].filter(Boolean)));
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
  if (isVideoModelUnavailableError(error)) return true;
  const message = errorMessage(error).toLowerCase();
  return message.includes("ai_provider_video_create_failed_502_") ||
    message.includes("ai_provider_video_create_failed_503_") ||
    message.includes("ai_provider_video_create_failed_504_") ||
    message.includes("ai_provider_video_create_failed_524_") ||
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("socket") ||
    message.includes("terminated") ||
    message.includes("connection reset") ||
    message.includes("read reset");
}

function isImageGenerationModel(model: string) {
  const normalized = model.trim().toLowerCase();
  return !isVideoGenerationModel(normalized) && (normalized.startsWith("gpt-image") || normalized.includes("image"));
}

function requestedModelOverride(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields);
  return textValue(payload.params.modelOverride) || textValue(fields?.modelOverride);
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
  const imageProviders = payload.aiProviderFallback.providers.filter((provider) => provider.id && isImageGenerationModel(provider.modelType));
  const selection = recordValue(payload.providerSelection);
  const selectedProviderId = textValue(selection?.providerId);
  const selectedProvider = selectedProviderId
    ? imageProviders.find((provider) => provider.id === selectedProviderId)
    : undefined;

  if (selection?.mode === "fixed_provider") return selectedProvider ? [selectedProvider] : [];
  if (selection?.mode === "preferred_provider" && selection.fallbackEnabled === false) return selectedProvider ? [selectedProvider] : [];

  const preferredProviders = Array.from(new Map([
    ...(selectedProvider ? [[selectedProvider.id, selectedProvider] as const] : []),
    ...imageProviders.filter((provider) => provider.preferred).map((provider) => [provider.id, provider] as const)
  ]).values());
  const preferredIds = new Set(preferredProviders.map((provider) => provider.id));
  const fallbackProviders = imageProviders.filter((provider) => !preferredIds.has(provider.id));
  return [...preferredProviders, ...fallbackProviders];
}

function orderedVideoProviders(payload: WorkerPayload): WorkerImageProvider[] {
  const videoProviders = payload.aiProviderFallback.providers.filter((provider) => provider.id && isVideoGenerationModel(provider.modelType));
  const selection = recordValue(payload.providerSelection);
  const selectedProviderId = textValue(selection?.providerId);
  const selectedProvider = selectedProviderId
    ? videoProviders.find((provider) => provider.id === selectedProviderId)
    : undefined;

  if (selection?.mode === "fixed_provider") return selectedProvider ? [selectedProvider] : [];
  if (selection?.mode === "preferred_provider" && selection.fallbackEnabled === false) return selectedProvider ? [selectedProvider] : [];

  const preferredProviders = Array.from(new Map([
    ...(selectedProvider ? [[selectedProvider.id, selectedProvider] as const] : []),
    ...videoProviders.filter((provider) => provider.preferred).map((provider) => [provider.id, provider] as const)
  ]).values());
  const preferredIds = new Set(preferredProviders.map((provider) => provider.id));
  const fallbackProviders = videoProviders.filter((provider) => !preferredIds.has(provider.id));
  return [...preferredProviders, ...fallbackProviders];
}

function orderedVideoSceneImageProviders(payload: WorkerPayload): WorkerImageProvider[] {
  const imageProviders = payload.aiProviderFallback.providers.filter((provider) => provider.id && isImageGenerationModel(provider.modelType));
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
  return Math.max(60_000, Number(process.env.LOCAL_AI_WORKER_VIDEO_TIMEOUT_MS ?? "900000") || 900_000);
}

function videoProviderCreateTimeoutMs(timeoutMs: number) {
  const configured = Number(process.env.LOCAL_AI_WORKER_VIDEO_CREATE_TIMEOUT_MS ?? "180000") || 180_000;
  return Math.max(60_000, Math.min(configured, timeoutMs));
}

function videoProviderPollIntervalMs() {
  return Math.max(1_000, Math.min(Number(process.env.LOCAL_AI_WORKER_VIDEO_POLL_INTERVAL_MS ?? "5000") || 5_000, 15_000));
}

function providerAttempts() {
  return Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_PROVIDER_ATTEMPTS ?? "2") || 2, 4));
}

function videoProviderAttempts() {
  return Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_VIDEO_PROVIDER_ATTEMPTS ?? "2") || 2, 3));
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "local_worker_generation_failed";
  const cause = error.cause instanceof Error ? ` cause:${error.cause.message}` : "";
  return `${error.message}${cause}`;
}

function isRetryableProviderError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  if (isVideoModelUnavailableError(error) || message.includes("invalid request")) return false;
  if (message.includes("failed_429") || message.includes("failed_502") || message.includes("failed_503") || message.includes("failed_504") || message.includes("failed_524")) return true;
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
  const configured = Number(process.env.LOCAL_AI_WORKER_IMAGE_REFERENCE_LIMIT ?? "15");
  if (!Number.isFinite(configured) || configured <= 0) return 15;
  return Math.max(1, Math.min(Math.trunc(configured), 15));
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

function buildVideoQualitySystemPrompt(params: {
  aspectRatio: string;
  duration: string;
  frameCount: number;
  resolution: string;
}) {
  return [
    "Internal video quality system: these rules are mandatory and have higher priority than the user direction when quality, identity, anatomy, continuity, or output cleanliness would otherwise degrade.",
    `Provider contract: create exactly one ${params.duration}-second image-to-video MP4 at ${params.aspectRatio} ${params.resolution.toUpperCase()} from the ordered input reference image${params.frameCount === 1 ? "" : "s"}.`,
    "Prompt hierarchy: ordered frame images and subject identity first; then continuity, anatomy, motion, and camera rules; then user direction; then theme style. If a user direction conflicts with identity preservation, natural anatomy, or clean output, keep the closest realistic interpretation instead.",
    params.frameCount > 0
      ? "Reference lock: uploaded frame images are binding visual evidence. The video must visibly derive from those images; if motion is difficult, simplify the action instead of replacing the subjects, setting, or requested interaction."
      : "Text-to-video mode: no frame image was uploaded. Follow the written customer direction as the source of truth and do not borrow unrelated preset scenes.",
    "Shot plan: generate one coherent continuous scene with a clear beginning, middle, and end beat. Use a single believable camera plan, natural acceleration and deceleration, and visible subject or environmental movement. Do not output a slideshow, static pan, or frozen still.",
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

function buildVideoReferenceContractPrompt(params: {
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

function buildOpeningPortraitVideoPrompt(userNote: string) {
  if (!userRequestsOpeningPortraitSequence(userNote)) return "";
  return [
    "Opening sequence lock: begin with the opening portrait beat requested by the user. The first visible moments should show clear portrait-readable and front-facing faces before any turn, kiss, embrace, or side-profile interaction.",
    "Treat the turn, kiss, embrace, or interaction as the later motion beat, not as the first frame."
  ].join("\n");
}

function buildVideoPrompt(payload: WorkerPayload, referenceAssets = videoFrameAssets(payload)) {
  const fields = recordValue(payload.params.fields);
  const frameAssets = referenceAssets;
  const videoParams = videoProviderParams(payload);
  const themeName = textValue(fields?.videoThemeName) || textValue(fields?.toolPresetTitle);
  const themePrompt = textValue(fields?.videoThemePrompt);
  const userNote = textValue(fields?.promptNote) || textValue(fields?.prompt);
  const frameManifest = frameAssets.length
    ? [
        `Use ${frameAssets.length} ordered frame image${frameAssets.length === 1 ? "" : "s"} as visual anchors:`,
        ...frameAssets.map((asset, index) => `Frame ${index + 1}: assetId=${asset.assetId}. ${index === 0 ? "Use as the opening frame anchor." : "Use as a later reference beat and preserve important people, product, wardrobe, prop, and scene cues."}`)
      ].join("\n")
    : "";
  const promptParts = [
    buildVideoQualitySystemPrompt({
      aspectRatio: videoParams.aspect_ratio,
      duration: videoParams.duration,
      frameCount: frameAssets.length,
      resolution: videoParams.resolution
    }),
    buildExplicitUserDirectionPrompt(userNote, frameAssets.length),
    buildOpeningPortraitVideoPrompt(userNote),
    buildVideoReferenceContractPrompt({ frameAssets, userNote }),
    "Create one polished realistic image-to-video MP4 from the supplied frame image.",
    userNote ? `User direction: ${userNote}` : "",
    themeName ? `Internal fallback video preset: ${themeName}` : "",
    themePrompt ? `Optional preset style, ignore if it conflicts with the user direction or selected frames: ${themePrompt}` : "",
    textValue(payload.params.style) ? `Style: ${textValue(payload.params.style)}` : "",
    frameManifest,
    frameAssets.length > 1 ? "Direct reference rule: use the supplied original frame images as the identity and cast source. The video may change pose, angle, and motion, but the people must remain recognizably the uploaded subjects from their respective frames." : "",
    "Use the uploaded first frame as a visual anchor, not as a frozen still or slideshow source.",
    "Match the output orientation to the selected video aspect ratio and source frame. Keep a horizontal landscape frame for landscape source images.",
    "Preserve natural human body proportions, believable face and limb geometry, and sharp subject details. Do not stretch, squash, blur, or reshape the athlete.",
    "Infer plausible preceding and following action beats from the user note, video theme prompt, body pose, object trajectory, scene geometry, wardrobe, lighting, and camera context.",
    "Animate a complete continuous motion sequence with visible subject movement, object movement, acceleration, deceleration, and cinematic camera movement while preserving subject continuity, clothing cues, and scene direction.",
    "If more than one ordered frame is supplied, use every frame as an intentional visual reference. Do not silently ignore later frames or generate a clip that only reflects Frame 1.",
    "Avoid freeze frames, repeated still loops, contact sheets, storyboard panels, split screens, abrupt morphing, or static pan-only output.",
    "Return one polished video clip with no text overlay, no watermark, and no UI."
  ].filter(Boolean);
  return promptParts.join("\n\n").slice(0, 3600);
}

function buildDirectJsonVideoPrompt(payload: WorkerPayload, referenceAssets = videoFrameAssets(payload)) {
  const fields = recordValue(payload.params.fields);
  const videoParams = videoProviderParams(payload);
  const userNote = textValue(fields?.promptNote) || textValue(fields?.prompt);
  const frameManifest = referenceAssets.length
    ? [
        `Reference image count: ${referenceAssets.length}. Use every uploaded reference image as a mandatory visual source.`,
        ...referenceAssets.map((asset, index) => {
          const characterLabel = index === 0 ? "Character A" : index === 1 ? "Character B" : `Character ${index + 1}`;
          return `Reference image ${index + 1}: assetId=${asset.assetId}; ${characterLabel}. Preserve this uploaded subject's face shape, hair, skin tone, apparent age range, wardrobe cues, and visual identity.`;
        })
      ].join("\n")
    : "";
  const openingBeat = userRequestsOpeningPortraitSequence(userNote)
    ? "Opening beat: begin with the uploaded people portrait-readable and front-facing enough to identify them. Then animate the later requested motion naturally, such as turning toward each other, kissing, and looking at each other if requested."
    : "";
  return [
    `Image-to-video task: create exactly one ${videoParams.duration}-second realistic MP4 at ${videoParams.aspect_ratio} ${videoParams.resolution.toUpperCase()}.`,
    "The uploaded images are the source of truth. The video must feature the same uploaded people, not newly cast people and not an unrelated location or crowd scene.",
    referenceAssets.length > 1
      ? "Cast requirement: combine the uploaded people from the ordered reference images into one coherent scene. Keep exactly those selected people as the main visible subjects."
      : "Identity requirement: keep the uploaded subject as the main visible subject.",
    frameManifest,
    userNote ? `Customer direction, highest priority: ${userNote}` : "",
    openingBeat,
    "Use a simple close portrait or couple composition unless the customer explicitly requests a different location. Keep the camera focused on the uploaded subjects and their requested interaction.",
    "Make the action continuous and natural. Preserve recognizable faces, hair, wardrobe cues, body proportions, and lighting continuity throughout.",
    "Return only one clean video clip: no captions, no UI, no watermark, no split screen, no collage, no storyboard panels."
  ].filter(Boolean).join("\n\n").slice(0, 2200);
}

function buildTextToVideoPrompt(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields);
  const videoParams = videoProviderParams(payload);
  const userNote = textValue(fields?.promptNote) || textValue(fields?.prompt) || promptText(payload.prompt);
  return [
    `Text-to-video task: create exactly one ${videoParams.duration}-second realistic MP4 at ${videoParams.aspect_ratio} ${videoParams.resolution.toUpperCase()}.`,
    "No reference images were uploaded. Use the customer's written direction as the source of truth for subject, setting, style, action, camera motion, and story beat.",
    userNote ? `Customer direction, highest priority: ${userNote}` : "",
    "Create a coherent single scene with a clear beginning, middle, and end. Keep motion natural, physically plausible, and visually stable.",
    "Do not introduce unrelated preset scenes, random crowds, stock travel footage, captions, UI, watermarks, split screens, collages, or storyboard panels.",
    "Return one polished clean video clip."
  ].filter(Boolean).join("\n\n").slice(0, 1800);
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
  ].filter(Boolean).join("\n\n").slice(0, 3600);
}

function inputAssets(payload: WorkerPayload): ImageInputAsset[] {
  return payload.inputAssets.filter((asset) => asset.assetId !== "asset_demo" && asset.signedUrl.trim());
}

function videoFrameAssets(payload: WorkerPayload): ImageInputAsset[] {
  const fields = recordValue(payload.params.fields);
  const maxFrames = normalizeVideoFrameLimit(fields?.maxFrames ?? payload.params.maxFrames);
  return inputAssets(payload).slice(0, maxFrames);
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

async function isProviderFrameUrlReadable(url: string, timeoutMs: number) {
  try {
    const response = await fetchWithTimeout(url, { method: "HEAD", cache: "no-store" }, Math.min(timeoutMs, 10_000), "ai_provider_video_frame_probe_timeout");
    return response.ok;
  } catch {
    return false;
  }
}

async function videoFrameDataUri(asset: ImageInputAsset, timeoutMs: number) {
  const response = await fetchWithTimeout(
    asset.signedUrl,
    { cache: "no-store" },
    Math.min(timeoutMs, 30_000),
    `ai_provider_video_frame_data_uri_timeout_${asset.assetId}`
  );
  if (!response.ok) throw new Error(`ai_provider_video_frame_data_uri_source_failed_${asset.assetId}_${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`ai_provider_video_frame_data_uri_empty_${asset.assetId}`);
  const maxBytes = videoFrameDataUriMaxBytes();
  if (bytes.length > maxBytes) throw new Error(`ai_provider_video_frame_data_uri_too_large_${asset.assetId}_${bytes.length}_${maxBytes}`);
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function videoFramePreparedDataUri(asset: ImageInputAsset, timeoutMs: number, targetSize: string) {
  const response = await fetchWithTimeout(
    asset.signedUrl,
    { cache: "no-store" },
    Math.min(timeoutMs, 30_000),
    `ai_provider_video_frame_data_uri_timeout_${asset.assetId}`
  );
  if (!response.ok) throw new Error(`ai_provider_video_frame_data_uri_source_failed_${asset.assetId}_${response.status}`);
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`ai_provider_video_frame_data_uri_empty_${asset.assetId}`);
  const prepared = await prepareVideoReferenceImage(bytes, mimeType, targetSize);
  const preparedBytes = Buffer.from(prepared.bytes);
  const maxBytes = videoFrameDataUriMaxBytes();
  if (preparedBytes.length > maxBytes) throw new Error(`ai_provider_video_frame_data_uri_too_large_${asset.assetId}_${preparedBytes.length}_${maxBytes}`);
  return `data:${prepared.mimeType};base64,${preparedBytes.toString("base64")}`;
}

async function videoProviderFrameUrls(params: {
  referenceAssets: ImageInputAsset[];
  timeoutMs: number;
}) {
  const urls = params.referenceAssets.map(providerReachableAssetUrl).filter(Boolean);
  if (urls.length !== params.referenceAssets.length) return urls;
  if (!shouldUseVideoFrameDataUriFallback()) return urls;
  if (shouldForceVideoFrameDataUris()) {
    return Promise.all(params.referenceAssets.map((asset) => videoFrameDataUri(asset, params.timeoutMs)));
  }
  const readableChecks = await Promise.all(urls.map((url) => isProviderFrameUrlReadable(url, params.timeoutMs)));
  if (readableChecks.every(Boolean)) return urls;
  return Promise.all(params.referenceAssets.map((asset) => videoFrameDataUri(asset, params.timeoutMs)));
}

function videoProviderDataUriFrameUrls(params: {
  referenceAssets: ImageInputAsset[];
  timeoutMs: number;
}) {
  return Promise.all(params.referenceAssets.map((asset) => videoFrameDataUri(asset, params.timeoutMs)));
}

function videoProviderPreparedDataUriFrameUrls(params: {
  referenceAssets: ImageInputAsset[];
  timeoutMs: number;
  targetSize: string;
}) {
  return Promise.all(params.referenceAssets.map((asset) => videoFramePreparedDataUri(asset, params.timeoutMs, params.targetSize)));
}

function isDataUri(value: string) {
  return value.startsWith("data:");
}

function shouldRetryVideoTaskWithDataUriFrames(params: {
  error: unknown;
  imageUrls: string[];
  protocol: VideoProviderProtocol;
}) {
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

const videoAspectRatios = new Set(["16:9", "4:3", "1:1", "3:4", "9:16", "3:2", "2:3"]);
const videoResolutions = new Set(["720p", "480p"]);
const videoDurations = new Set(Array.from({ length: 15 }, (_, index) => String(index + 1)));

function videoSizeForParams(aspectRatio: string, resolution: string) {
  const longEdge = resolution === "480p" ? 854 : 1280;
  const shortEdge = resolution === "480p" ? 480 : 720;
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
  return resolution.trim().toUpperCase();
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
  const rawAspectRatio = textValue(payload.params.aspect_ratio) || textValue(payload.params.aspectRatio) || textValue(fields?.aspect_ratio) || textValue(fields?.aspectRatio);
  const rawResolution = textValue(payload.params.resolution) || textValue(fields?.resolution);
  const rawDuration = textValue(payload.params.durationSeconds) || textValue(payload.params.videoDurationSeconds) || textValue(payload.params.duration) || textValue(payload.params.videoDuration) || textValue(fields?.durationSeconds) || textValue(fields?.videoDurationSeconds) || textValue(fields?.duration) || textValue(fields?.videoDuration);
  const aspect_ratio = videoAspectRatios.has(rawAspectRatio) ? rawAspectRatio : "16:9";
  const resolution = videoResolutions.has(rawResolution) ? rawResolution : "720p";
  const duration = videoDurations.has(rawDuration) ? String(normalizeVideoDurationSeconds(rawDuration)) : String(normalizeVideoDurationSeconds(undefined));
  return { aspect_ratio, resolution, duration, size: videoSizeForParams(aspect_ratio, resolution) };
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
  if (explicit === "0") return false;
  return true;
}

function shouldAllowUnresizedVideoReferenceFallback() {
  return process.env.LOCAL_AI_WORKER_VIDEO_REFERENCE_REQUIRE_RESIZE?.trim() !== "1";
}

function originalVideoReferenceImage(bytes: Uint8Array, mimeType: string) {
  return {
    bytes: blobPartFromBytes(Buffer.from(bytes)),
    mimeType
  };
}

async function prepareVideoReferenceImage(bytes: Uint8Array, mimeType: string, targetSize?: string) {
  const sourceMimeType = imageMimeTypeFromBytes(bytes, mimeType);
  const target = targetSize ? parseVideoPixelSize(targetSize) : undefined;
  if (!target && (!shouldCompressVideoReferenceImages() || sourceMimeType.includes("gif"))) {
    return originalVideoReferenceImage(bytes, sourceMimeType);
  }
  const maxDimension = Math.max(512, Number(process.env.LOCAL_AI_WORKER_VIDEO_REFERENCE_MAX_DIMENSION ?? "1280") || 1280);
  const quality = Math.max(60, Math.min(Number(process.env.LOCAL_AI_WORKER_VIDEO_REFERENCE_QUALITY ?? "80") || 80, 95));
  try {
    const sharp = await loadSharp();
    if (!sharp) throw new Error("sharp_unavailable");
    const resized = await sharp(Buffer.from(bytes))
      .rotate()
      .resize(target
        ? { width: target.width, height: target.height, fit: "cover", position: "attention" }
        : { width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (!resized.length) throw new Error("empty_video_reference_image");
    return { bytes: blobPartFromBytes(resized), mimeType: "image/jpeg" };
  } catch (error) {
    if (target) {
      if (shouldAllowUnresizedVideoReferenceFallback() && errorMessage(error).includes("sharp_unavailable")) {
        return originalVideoReferenceImage(bytes, sourceMimeType);
      }
      throw error instanceof Error ? new Error(`ai_provider_video_reference_resize_failed_${target.width}x${target.height}_${error.message}`) : new Error(`ai_provider_video_reference_resize_failed_${target.width}x${target.height}`);
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

function shouldRetryProviderFetchWithoutProxy(error: unknown, proxyUrl: string) {
  if (process.env.AI_WORKER_DISABLE_PROXY_FALLBACK === "1" || !isLoopbackProxyUrl(proxyUrl)) return false;
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
  const controller = new AbortController();
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
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(timeoutError);
      }
      if (dispatcher && shouldRetryProviderFetchWithoutProxy(error, proxyUrl)) {
        return await runFetch();
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(timeoutError);
    }
    throw error;
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
  timeoutMs: number;
  outputCount?: number;
  assets?: ImageInputAsset[];
}) {
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
      { cache: "no-store" },
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
  timeoutMs: number;
  sceneInputAssets: ImageInputAsset[];
  baseUrl: string;
  apiKey: string;
}) {
  const form = await buildImageEditForm({
    payload: params.payload,
    model: params.model,
    prompt: params.prompt,
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
      cache: "no-store"
    },
    params.timeoutMs,
    `ai_provider_video_scene_image_edit_timeout_${params.timeoutMs}`
  );
  const body = (await response.json().catch(() => ({}))) as ImageGenerationResponse;
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
}) {
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
        await new Promise((resolve) => setTimeout(resolve, 2_500 * attempt));
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
  timeoutMs: number;
}) {
  const form = new FormData();
  form.append("model", params.model);
  form.append("prompt", params.prompt);
  form.append("seconds", params.videoParams.duration);
  form.append("size", openAiVideoRequestSize(params.videoParams));
  const referenceAssets = params.referenceAssets.length ? params.referenceAssets : [];
  if (!referenceAssets.length) throw new Error("ai_provider_video_first_frame_required");
  for (const [index, asset] of referenceAssets.entries()) {
    const response = await fetchWithTimeout(
      asset.signedUrl,
      { cache: "no-store" },
      Math.min(params.timeoutMs, 30_000),
      `ai_provider_video_reference_image_timeout_${asset.assetId}`
    );
    if (!response.ok) throw new Error(`ai_provider_video_reference_image_failed_${asset.assetId}_${response.status}`);
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const bytes = new Uint8Array(await response.arrayBuffer());
    const prepared = await prepareVideoReferenceImage(bytes, mimeType, params.videoParams.size);
    form.append("input_reference", new Blob([prepared.bytes], { type: prepared.mimeType }), `input-reference-${index + 1}-${asset.assetId}.${extensionForMime(prepared.mimeType)}`);
  }
  return form;
}

async function postWorkerStatus(payload: WorkerPayload, status: "running" | "failed", stage: string) {
  const body = {
    jobId: payload.jobId,
    siteId: payload.siteId,
    requestId: payload.requestId,
    status,
    stage
  };
  await fetchWorkerCallbackWithTimeout(payload.statusCallbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, signature: signWorkerCallback(body) }),
    cache: "no-store"
  }).catch(() => null);
}

async function postWorkerSlotStatus(payload: WorkerPayload, status: "running" | "failed", stage: string, slot: WorkerOutputSlot) {
  const body = {
    jobId: payload.jobId,
    siteId: payload.siteId,
    requestId: payload.requestId,
    status,
    stage,
    outputSlots: [slot]
  };
  await fetchWorkerCallbackWithTimeout(payload.statusCallbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, signature: signWorkerCallback(body) }),
    cache: "no-store"
  }).catch(() => null);
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
    outputs?: Array<{ storageKey: string; mimeType?: string }>;
    providerTrace?: Array<{ provider: string; attempts: number }>;
    costTrace?: { estimatedCostUsd?: number; providerErrors?: Array<{ provider: string; error: string }>; referenceFrameCount?: number; requestedReferenceFrameCount?: number; providerReferenceLimit?: number };
    error?: string;
  }
) {
  const resultBody = {
    jobId: payload.jobId,
    siteId: payload.siteId,
    requestId: payload.requestId,
    ...body
  };
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
      if (response.ok) return;
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
  throw new Error(`worker_result_callback_failed_${lastStatus || "network"}${lastError ? `_${lastError}` : ""}`);
}

function videoTaskId(body: VideoGenerateResponse) {
  const taskId = body.request_id ?? body.data?.task_id ?? body.task_id ?? body.id;
  return typeof taskId === "number" || typeof taskId === "string" ? String(taskId) : "";
}

function normalizedVideoMimeType(value: string) {
  const mimeType = value.split(";")[0]?.trim().toLowerCase() || "";
  if (mimeType.startsWith("video/")) return mimeType;
  return "video/mp4";
}

function videoProviderProtocol(baseUrl: string): VideoProviderProtocol {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (hostname.includes("smartpicklid") || hostname.includes("magic666")) return "openai-videos";
  } catch {
    return "lk888-media";
  }
  return "lk888-media";
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

function shouldPreferOpenAiJsonVideoRequest(params: {
  baseUrl: string;
  model: string;
  protocol: VideoProviderProtocol;
}) {
  if (params.protocol !== "openai-videos") return false;
  const explicitMode = process.env.AI_WORKER_GROK_IMAGINE_VIDEO_REFERENCE_MODE?.trim().toLowerCase();
  if (explicitMode === "multipart" || explicitMode === "form") return false;
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

function openAiJsonVideoReferencePayload(urls: string[], fallbackImageUrl?: string) {
  if (urls.length > 1) return { reference_images: urls.map((url) => ({ url })) };
  const imageUrl = urls[0] ?? fallbackImageUrl;
  return imageUrl ? { image: imageUrl } : {};
}

async function createVideoTask(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  imageUrls: string[];
  referenceAssets: ImageInputAsset[];
  videoParams: { aspect_ratio: string; resolution: string; duration: string; size: string };
  protocol: VideoProviderProtocol;
  timeoutMs: number;
}) {
  const firstImageUrl = params.imageUrls[0];
  const endpoint = params.protocol === "openai-videos"
    ? openAiVideoCreateEndpoint(params.baseUrl)
    : `${params.baseUrl}/v1/media/generate`;
  const useOpenAiJsonReference = shouldUseOpenAiVideoJsonReference(params);
  const providerRequestSize = openAiVideoRequestSize(params.videoParams, { smartPickLidJson: useOpenAiJsonReference });
  const providerReferenceTargetSize = openAiVideoReferenceTargetSize(params.videoParams, { smartPickLidJson: useOpenAiJsonReference });
  const openAiJsonImageUrls = useOpenAiJsonReference
    ? await videoProviderPreparedDataUriFrameUrls({
        referenceAssets: params.referenceAssets,
        timeoutMs: params.timeoutMs,
        targetSize: providerReferenceTargetSize
      })
    : [];
  const openAiJsonReferencePayload = useOpenAiJsonReference ? openAiJsonVideoReferencePayload(openAiJsonImageUrls, firstImageUrl) : {};
  const openAiVideosForm = params.protocol === "openai-videos" && !useOpenAiJsonReference && params.referenceAssets.length
    ? await buildVideoReferenceForm({
        referenceAssets: params.referenceAssets,
        model: params.model,
        prompt: params.prompt,
        videoParams: params.videoParams,
        timeoutMs: params.timeoutMs
      })
    : undefined;
  const payload = params.protocol === "openai-videos"
    ? {
        model: params.model,
        prompt: params.prompt,
        duration: Number(params.videoParams.duration),
        ...(useOpenAiJsonReference
          ? {
              aspect_ratio: params.videoParams.aspect_ratio,
              resolution: smartPickLidJsonVideoResolution(params.videoParams.resolution),
              ...openAiJsonReferencePayload
            }
          : {
              size: providerRequestSize,
              ...(params.imageUrls.length > 1
                ? { reference_images: params.imageUrls }
                : { image: firstImageUrl })
            })
      }
    : {
        model: params.model,
        params: {
          ...params.videoParams,
          images: params.imageUrls
        },
        prompt: params.prompt
      };
  const createTimeoutMs = videoProviderCreateTimeoutMs(params.timeoutMs);
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: openAiVideosForm
      ? { Authorization: `Bearer ${params.apiKey}` }
      : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`
    },
    body: openAiVideosForm ?? JSON.stringify(payload),
    cache: "no-store"
  }, createTimeoutMs, `ai_provider_video_create_timeout_${createTimeoutMs}`);
  const body = (await response.json().catch(() => ({}))) as VideoGenerateResponse;
  const taskId = videoTaskId(body);
  if (!response.ok || !taskId) {
    const referenceCount = params.protocol === "openai-videos" ? params.referenceAssets.length : params.imageUrls.length;
    const multiFrameHint = referenceCount > 1 ? "multi_frame_payload_rejected_" : "";
    const requestSummary = {
      model: params.model,
      protocol: params.protocol,
      endpoint: endpoint.replace(params.baseUrl, ""),
      duration: params.videoParams.duration,
      size: useOpenAiJsonReference ? `${params.videoParams.aspect_ratio}/${smartPickLidJsonVideoResolution(params.videoParams.resolution)}` : params.protocol === "openai-videos" ? providerRequestSize : params.videoParams.size,
      imageCount: referenceCount,
      imageKind: useOpenAiJsonReference ? (referenceCount > 1 ? "json_reference_images" : "json_image") : params.protocol === "openai-videos" ? "multipart_input_reference" : firstImageUrl?.startsWith("data:") ? "data_uri" : "url",
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
  timeoutMs: number;
}) {
  const startedAt = Date.now();
  const pollIntervalMs = videoProviderPollIntervalMs();
  let lastStatus = "";
  while (Date.now() - startedAt < params.timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const url = params.protocol === "openai-videos"
      ? new URL(`${params.baseUrl}/v1/videos/${encodeURIComponent(params.taskId)}`)
      : new URL(`${params.baseUrl}/v1/media/status`);
    if (params.protocol === "lk888-media") url.searchParams.set("task_id", params.taskId);
    const response = await fetchWithTimeout(url.toString(), {
      headers: { Authorization: `Bearer ${params.apiKey}` },
      cache: "no-store"
    }, Math.min(45_000, params.timeoutMs), "ai_provider_video_status_timeout");
    const body = (await response.json().catch(() => ({}))) as VideoStatusResponse;
    if (!response.ok) {
      throw new Error(`ai_provider_video_status_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
    }
    lastStatus = [body.state, body.progress, body.status].filter(Boolean).join("_");
    await postWorkerSlotStatus(params.payload, "running", "video_provider_running", {
      index: 1,
      status: "running",
      stage: `video_provider_running${body.progress ? `_${body.progress}` : ""}`,
      error: "",
      updatedAt: new Date().toISOString()
    });
    if (params.protocol === "openai-videos") {
      if (body.status === "completed" || body.status === "succeeded" || body.status === "done") return body;
      if (body.status === "failed") {
        throw new Error(`ai_provider_video_failed_failed_${textValue(body.error) || textValue(body.message) || "no_result"}`);
      }
      continue;
    }
    if (body.is_final === true) {
      if (body.state === "success" && textValue(body.result_url)) return body;
      throw new Error(`ai_provider_video_failed_${body.state || "unknown"}_${textValue(body.error) || textValue(body.status) || "no_result"}`);
    }
  }
  throw new Error(`ai_provider_video_timeout_${params.timeoutMs}_${lastStatus || "no_status"}`);
}

async function downloadVideoResult(params: {
  resultUrl?: string;
  baseUrl?: string;
  apiKey?: string;
  taskId?: string;
  protocol: VideoProviderProtocol;
  timeoutMs: number;
}) {
  const resultUrl = params.protocol === "openai-videos"
    ? params.resultUrl || `${params.baseUrl}/v1/videos/${encodeURIComponent(params.taskId ?? "")}/content`
    : params.resultUrl;
  if (!resultUrl) throw new Error("ai_provider_video_empty_result_url");
  const headers = params.protocol === "openai-videos" && params.apiKey
    ? { Authorization: `Bearer ${params.apiKey}` }
    : undefined;
  const response = await fetchWithTimeout(resultUrl, {
    ...(headers ? { headers } : {}),
    cache: "no-store"
  }, Math.min(params.timeoutMs, 120_000), "ai_provider_video_download_timeout");
  if (!response.ok) throw new Error(`ai_provider_video_download_failed_${response.status}`);
  const mimeType = normalizedVideoMimeType(response.headers.get("content-type") ?? "video/mp4");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("ai_provider_video_empty_payload");
  return { bytes, mimeType };
}

async function generateVideoWithProvider(params: {
  payload: WorkerPayload;
  providerId: string;
}) {
  const provider = await getPlatformAiProviderRelational(params.providerId);
  if (!provider?.apiKey?.trim()) {
    throw new Error("ai_provider_api_key_missing");
  }
  const providerApiKey = provider.apiKey;
  const requestedModel = requestedModelOverride(params.payload);
  const model = normalizeVideoGenerationModel(requestedModel && isVideoGenerationModel(requestedModel) ? requestedModel : provider.modelType);
  if (!isVideoGenerationModel(model)) {
    throw new Error(`ai_provider_not_video_model_${provider.label || provider.id}_${model}`);
  }
  const requestedReferenceAssets = videoFrameAssets(params.payload);
  const baseUrl = normalizeBaseUrl(provider.aiUrl);
  const protocol = videoProviderProtocol(baseUrl);
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

  const timeoutMs = videoProviderTimeoutMs();
  const imageUrls = protocol === "openai-videos"
    ? []
    : await videoProviderFrameUrls({ referenceAssets, timeoutMs });
  if (protocol !== "openai-videos" && (imageUrls.length !== referenceAssets.length || (shouldRejectLoopbackVideoFrameUrls() && imageUrls.some(isLoopbackUrl)))) {
    throw new Error("ai_provider_video_frame_public_urls_required");
  }
  const videoParams = videoProviderParams(params.payload);
  const videoPromptForReferenceAssets = (assets: ImageInputAsset[]) => !assets.length
      ? buildTextToVideoPrompt(params.payload)
      : preferJsonVideoRequest && assets.length > 1
      ? buildDirectJsonVideoPrompt(params.payload, assets)
      : buildVideoPrompt(params.payload, assets);
  const prompt = videoPromptForReferenceAssets(referenceAssets);
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
  });
  await postWorkerStatus(params.payload, "running", "source_images_ready");
  await postWorkerStatus(params.payload, "running", "video_provider_request_started");
  await postWorkerSlotStatus(params.payload, "running", "video_provider_request_started", {
    index: 1,
    status: "running",
    stage: "video_provider_request_started",
    error: "",
    referenceFrameCount: referenceAssets.length,
    requestedReferenceFrameCount: requestedReferenceAssets.length,
    providerReferenceLimit,
    updatedAt: new Date().toISOString()
  });

  const runVideoProviderTask = async (frameImageUrls: string[], taskReferenceAssets = referenceAssets, taskPrompt = prompt) => {
    let taskId = "";
    let createError: unknown;
    for (const modelCandidate of videoProviderModelCandidates(model, { protocol, referenceAssetCount: taskReferenceAssets.length, baseUrl })) {
      try {
        taskId = await createVideoTask({
          baseUrl,
          apiKey: providerApiKey,
          model: modelCandidate,
          prompt: taskPrompt,
          imageUrls: frameImageUrls,
          referenceAssets: taskReferenceAssets,
          videoParams,
          protocol,
          timeoutMs
        });
        break;
      } catch (error) {
        createError = error;
        if (!shouldTryNextVideoModel(error)) break;
      }
    }
    if (!taskId) throw createError instanceof Error ? createError : new Error("ai_provider_video_create_failed");
    await postWorkerSlotStatus(params.payload, "running", "video_task_created", {
      index: 1,
      status: "running",
      stage: "video_task_created",
      error: "",
      updatedAt: new Date().toISOString()
    });
    const status = await pollVideoTask({
      payload: params.payload,
      baseUrl,
      apiKey: providerApiKey,
      taskId,
      protocol,
      timeoutMs
    });
    return { status, taskId, referenceFrameCount: taskReferenceAssets.length };
  };

  let status: VideoStatusResponse | undefined;
  let taskId = "";
  let usedReferenceFrameCount = referenceAssets.length;
  try {
    const result = await runVideoProviderTask(imageUrls);
    status = result.status;
    taskId = result.taskId;
    usedReferenceFrameCount = result.referenceFrameCount;
  } catch (error) {
    if (!shouldRetryVideoTaskWithDataUriFrames({ error, imageUrls, protocol })) throw error;
    await postWorkerSlotStatus(params.payload, "running", "video_provider_retry_data_uri_frames", {
      index: 1,
      status: "running",
      stage: "video_provider_retry_data_uri_frames",
      error: errorMessage(error).slice(0, 240),
      updatedAt: new Date().toISOString()
    });
    const dataUriImageUrls = await videoProviderDataUriFrameUrls({ referenceAssets, timeoutMs });
    const result = await runVideoProviderTask(dataUriImageUrls);
    status = result.status;
    taskId = result.taskId;
    usedReferenceFrameCount = result.referenceFrameCount;
  }
  if (!status) throw new Error("ai_provider_video_empty_status");
  const statusVideo = recordValue(status.video) ?? {};
  const resultUrl = textValue(status.result_url) || textValue(statusVideo?.url);
  if (protocol === "lk888-media" && !resultUrl) throw new Error("ai_provider_video_empty_result_url");
  const video = await downloadVideoResult({
    resultUrl,
    baseUrl,
    apiKey: providerApiKey,
    taskId,
    protocol,
    timeoutMs
  });
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
  });
  return {
    storageKey,
    mimeType: video.mimeType,
    providerLabel: provider.label,
    index: 1,
    estimatedCostUsd: typeof status.cost === "number" ? status.cost : undefined,
    referenceFrameCount: usedReferenceFrameCount,
    requestedReferenceFrameCount: requestedReferenceAssets.length,
    providerReferenceLimit
  };
}

async function generateWithProvider(params: {
  payload: WorkerPayload;
  providerId: string;
  slotIndexes: number[];
  totalCount: number;
}) {
  const provider = await getPlatformAiProviderRelational(params.providerId);
  if (!provider?.apiKey?.trim()) {
    throw new Error("ai_provider_api_key_missing");
  }
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
    const promptForSlot = promptForOutputSlot(prompt, slotIndex, params.totalCount);
    await postWorkerSlotStatus(params.payload, "running", "provider_request_started", {
      index: slotIndex,
      status: "running",
      stage: "provider_request_started",
      error: "",
      updatedAt: new Date().toISOString()
    });
    try {
      const response = hasInputImages
        ? await (async () => {
          const form = await buildImageEditForm({ payload: params.payload, model, prompt: promptForSlot, timeoutMs });
          if (!form) throw new Error("ai_provider_image_edit_missing_input");
          return fetchWithTimeout(
            `${baseUrl}/v1/images/edits`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${providerApiKey}`
              },
              body: form,
              cache: "no-store"
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
            size: process.env.LOCAL_AI_WORKER_IMAGE_SIZE ?? "1024x1024",
            quality: process.env.LOCAL_AI_WORKER_IMAGE_QUALITY ?? "low",
            response_format: "b64_json"
          }),
          cache: "no-store"
        }, timeoutMs, `ai_provider_generation_timeout_${timeoutMs}`);
      const body = (await response.json().catch(() => ({}))) as ImageGenerationResponse;
      if (!response.ok) {
        const mode = hasInputImages ? "image_edit" : "generation";
        throw new Error(`ai_provider_${mode}_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
      }
      const [b64] = imageBase64List(body);
      if (!b64) throw new Error("ai_provider_empty_image_payload");
      const preparedOutput = prepareCompressedCustomerImage({
        bytes: Buffer.from(b64, "base64"),
        mimeType: "image/png",
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
      await postWorkerSlotStatus(params.payload, "running", "provider_response_received", {
        index: slotIndex,
        status: "succeeded",
        stage: "provider_response_received",
        storageKey,
        mimeType: preparedOutput.mimeType,
        error: "",
        updatedAt: new Date().toISOString()
      });
      return { storageKey, mimeType: preparedOutput.mimeType, providerLabel, index: slotIndex };
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

async function runLocalVideoWorker(payload: WorkerPayload) {
  const providers = orderedVideoProviders(payload);
  if (!providers.length) {
    await postWorkerResult(payload, { status: "failed", error: "no_video_ai_provider_configured" });
    return;
  }

  await postWorkerStatus(payload, "running", "local_video_worker_started");
  const providerTrace: Array<{ provider: string; attempts: number }> = [];
  const providerErrors: Array<{ provider: string; error: string }> = [];
  let lastError = "";

  for (const provider of providers) {
    const trace = { provider: provider.label || provider.id, attempts: 0 };
    providerTrace.push(trace);
    const maxAttempts = videoProviderAttempts();
    try {
      for (const attempt of Array.from({ length: maxAttempts }, (_, attemptIndex) => attemptIndex + 1)) {
        trace.attempts += 1;
        try {
          const output = await generateVideoWithProvider({ payload, providerId: provider.id });
          await postWorkerResult(payload, {
            status: "succeeded",
            outputs: [{ storageKey: output.storageKey, mimeType: output.mimeType }],
            providerTrace,
            costTrace: { estimatedCostUsd: output.estimatedCostUsd ?? 0, referenceFrameCount: output.referenceFrameCount, requestedReferenceFrameCount: output.requestedReferenceFrameCount, providerReferenceLimit: output.providerReferenceLimit }
          });
          return;
        } catch (error) {
          lastError = errorMessage(error);
          if (!isRetryableProviderError(error) || attempt >= maxAttempts) break;
          await new Promise((resolve) => setTimeout(resolve, 10_000 * attempt));
        }
      }
      throw new Error(lastError || "local_video_worker_generation_failed");
    } catch (error) {
      lastError = errorMessage(error);
      providerErrors.push({ provider: provider.label || provider.id, error: lastError });
      await postWorkerSlotStatus(payload, "running", "video_provider_failed", {
        index: 1,
        status: "failed",
        stage: "video_provider_failed",
        error: lastError.slice(0, 240),
        updatedAt: new Date().toISOString()
      });
    }
  }

  await postWorkerResult(payload, {
    status: "failed",
    providerTrace,
    error: lastError || "local_video_worker_generation_failed",
    costTrace: { providerErrors }
  });
}

async function runLocalImageWorker(payload: WorkerPayload) {
  const providers = orderedImageProviders(payload);
  if (!providers.length) {
    await postWorkerResult(payload, { status: "failed", error: "no_image_ai_provider_configured" });
    return;
  }

  await postWorkerStatus(payload, "running", "local_worker_started");
  const providerTrace: Array<{ provider: string; attempts: number }> = [];
  const totalCount = outputCount(payload);
  const successfulOutputsByIndex = new Map<number, GeneratedOutput>();
  let lastError = "";
  const providerErrors: Array<{ provider: string; error: string }> = [];

  for (const provider of providers) {
    const trace = { provider: provider.label || provider.id, attempts: 0 };
    providerTrace.push(trace);
    try {
      let outputError: unknown;
      for (const attempt of Array.from({ length: providerAttempts() }, (_, attemptIndex) => attemptIndex + 1)) {
        const missingSlotIndexes = Array.from({ length: totalCount }, (_, index) => index + 1)
          .filter((slotIndex) => !successfulOutputsByIndex.has(slotIndex));
        if (!missingSlotIndexes.length) break;
        trace.attempts += 1;
        try {
          const result = await generateWithProvider({
            payload,
            providerId: provider.id,
            slotIndexes: missingSlotIndexes,
            totalCount
          });
          for (const output of result.outputs) {
            successfulOutputsByIndex.set(output.index, output);
          }
          outputError = result.error;
          if (!result.error || successfulOutputsByIndex.size >= totalCount) break;
          if (!isRetryableProviderError(result.error) || attempt >= providerAttempts()) break;
          await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
        } catch (error) {
          outputError = error;
          if (!isRetryableProviderError(error) || attempt >= providerAttempts()) break;
          await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
        }
      }
      if (successfulOutputsByIndex.size < totalCount) {
        const missingCount = totalCount - successfulOutputsByIndex.size;
        throw outputError instanceof Error ? outputError : new Error(`local_worker_missing_${missingCount}_outputs`);
      }
      const outputs = Array.from(successfulOutputsByIndex.values())
        .sort((left, right) => left.index - right.index)
        .map((output) => ({ storageKey: output.storageKey, mimeType: output.mimeType }));
      await postWorkerResult(payload, {
        status: "succeeded",
        outputs,
        providerTrace,
        costTrace: { estimatedCostUsd: 0 }
      });
      return;
    } catch (error) {
      lastError = errorMessage(error);
      providerErrors.push({ provider: provider.label || provider.id, error: lastError });
    }
  }

  const partialOutputs = Array.from(successfulOutputsByIndex.values())
    .sort((left, right) => left.index - right.index)
    .map((output) => ({ storageKey: output.storageKey, mimeType: output.mimeType }));
  if (partialOutputs.length) {
    await postWorkerResult(payload, {
      status: "succeeded",
      outputs: partialOutputs,
      providerTrace,
      error: lastError || "local_worker_partial_generation_failed",
      costTrace: { estimatedCostUsd: 0, providerErrors }
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

async function runLocalWorker(payload: WorkerPayload) {
  if (isVideoGenerationRequest(payload)) {
    await runLocalVideoWorker(payload);
    return;
  }
  await runLocalImageWorker(payload);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as WorkerPayload;
  if (!payload.jobId || !payload.siteId || !payload.customerId || !payload.callbackUrl || !payload.requestId) {
    return NextResponse.json({ error: "invalid_worker_payload" }, { status: 400 });
  }
  if (!verifyWorkerPayloadSignature(payload)) {
    return NextResponse.json({ error: "invalid_worker_payload_signature" }, { status: 401 });
  }

  void runLocalWorker(payload).catch((error) => {
    console.error("local_ai_worker_dispatch_failed", error);
  });
  return NextResponse.json({ ok: true, status: "accepted", jobId: payload.jobId }, { status: 202 });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "POST,OPTIONS" }
  });
}
