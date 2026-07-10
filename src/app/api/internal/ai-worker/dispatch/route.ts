import { NextResponse } from "next/server";
import {
  customerAssetStorageKey,
  extensionForCustomerAssetMime,
  prepareCompressedCustomerImage,
  writeCustomerAssetFileShared
} from "@/lib/customer-asset-storage";
import { getPlatformAiProviderRelational } from "@/lib/stores/platform-store";
import {
  signWorkerCallback,
  verifyWorkerPayloadSignature,
  type WorkerOutputSlot,
  type WorkerPayload
} from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SharpFactory = (input: Buffer) => {
  rotate: () => {
    resize: (options: { width: number; height: number; fit: "inside"; withoutEnlargement: boolean }) => {
      jpeg: (options: { quality: number; mozjpeg: boolean }) => {
        toBuffer: () => Promise<Buffer>;
      };
    };
  };
};

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

type VideoGenerateResponse = {
  code?: number;
  data?: { task_id?: string | number };
  task_id?: string | number;
  msg?: string;
  error?: unknown;
};

type VideoStatusResponse = {
  task_id?: string | number;
  state?: string;
  status?: string;
  status_group?: string;
  is_final?: boolean;
  progress?: string;
  result_url?: string;
  result_type?: string;
  error?: string;
  cost?: number;
};

type WorkerImageProvider = WorkerPayload["aiProviderFallback"]["providers"][number];
type GeneratedOutput = {
  storageKey: string;
  mimeType: string;
  providerLabel: string;
  index: number;
  estimatedCostUsd?: number;
};

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
    textValue(payload.params.outputType),
    textValue(fields?.outputType),
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

function videoProviderTimeoutMs() {
  return Math.max(60_000, Number(process.env.LOCAL_AI_WORKER_VIDEO_TIMEOUT_MS ?? "900000") || 900_000);
}

function videoProviderPollIntervalMs() {
  return Math.max(1_000, Math.min(Number(process.env.LOCAL_AI_WORKER_VIDEO_POLL_INTERVAL_MS ?? "5000") || 5_000, 15_000));
}

function providerAttempts() {
  return Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_PROVIDER_ATTEMPTS ?? "2") || 2, 4));
}

function videoProviderAttempts() {
  return Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_VIDEO_PROVIDER_ATTEMPTS ?? "1") || 1, 3));
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "local_worker_generation_failed";
  const cause = error.cause instanceof Error ? ` cause:${error.cause.message}` : "";
  return `${error.message}${cause}`;
}

function isRetryableProviderError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes("fetch failed") || message.includes("timeout") || message.includes("socket") || message.includes("econnreset") || message.includes("terminated");
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

function providerReferenceRolePriority(role: string) {
  if (role === "partner") return 0;
  if (role === "primary") return 1;
  return 2;
}

function providerInputAssets(payload: WorkerPayload): ImageInputAsset[] {
  const roles = referenceRoles(payload);
  return inputAssets(payload)
    .slice(0, 4)
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

function buildVideoPrompt(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields);
  const promptParts = [
    promptText(payload.prompt),
    promptText(payload.params.prompt),
    textValue(fields?.prompt),
    textValue(payload.params.style) ? `Style: ${textValue(payload.params.style)}` : "",
    textValue(fields?.toolPresetTitle) ? `Tool: ${textValue(fields?.toolPresetTitle)}` : "",
    subjectCompositionInstruction(payload),
    "Animate the uploaded first frame into a short realistic video. Preserve the first-frame composition, subject continuity, clothing cues, and scene direction while adding natural motion and cinematic camera movement.",
    "Return one polished video clip with no text overlay, no watermark, and no UI."
  ].filter(Boolean);
  return promptParts.join("\n\n");
}

function inputAssets(payload: WorkerPayload): ImageInputAsset[] {
  return payload.inputAssets.filter((asset) => asset.assetId !== "asset_demo" && asset.signedUrl.trim());
}

function firstFrameAsset(payload: WorkerPayload): ImageInputAsset | undefined {
  return inputAssets(payload)[0];
}

function providerReachableAssetUrl(asset: ImageInputAsset) {
  return textValue(asset.publicUrl) || asset.signedUrl;
}

function isLoopbackUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]";
  } catch {
    return true;
  }
}

const videoAspectRatios = new Set(["16:9", "9:16", "1:1", "3:2", "2:3"]);
const videoResolutions = new Set(["720p", "480p"]);
const videoDurations = new Set(Array.from({ length: 15 }, (_, index) => String(index + 1)));

function videoProviderParams(payload: WorkerPayload) {
  const fields = recordValue(payload.params.fields);
  const rawAspectRatio = textValue(payload.params.aspect_ratio) || textValue(payload.params.aspectRatio) || textValue(fields?.aspect_ratio) || textValue(fields?.aspectRatio);
  const rawResolution = textValue(payload.params.resolution) || textValue(fields?.resolution);
  const rawDuration = textValue(payload.params.duration) || textValue(payload.params.videoDuration) || textValue(fields?.duration) || textValue(fields?.videoDuration);
  const aspect_ratio = videoAspectRatios.has(rawAspectRatio) ? rawAspectRatio : "16:9";
  const resolution = videoResolutions.has(rawResolution) ? rawResolution : "720p";
  const duration = videoDurations.has(rawDuration) ? rawDuration : "6";
  return { aspect_ratio, resolution, duration };
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "png";
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

function blobPartFromBytes(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function fetchWithTimeout(resource: string, init: RequestInit, timeoutMs: number, timeoutError: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(resource, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(timeoutError);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
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

  const assets = providerInputAssets(params.payload);
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
    form.append(imageFieldName, new Blob([prepared.bytes], { type: prepared.mimeType }), `reference-${index + 1}-${roleLabel}-${asset.assetId}.${extensionForMime(prepared.mimeType)}`);
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
  await fetch(payload.statusCallbackUrl, {
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
  await fetch(payload.statusCallbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, signature: signWorkerCallback(body) }),
    cache: "no-store"
  }).catch(() => null);
}

async function postWorkerResult(
  payload: WorkerPayload,
  body: {
    status: "succeeded" | "failed";
    outputs?: Array<{ storageKey: string; mimeType?: string }>;
    providerTrace?: Array<{ provider: string; attempts: number }>;
    costTrace?: { estimatedCostUsd?: number; providerErrors?: Array<{ provider: string; error: string }> };
    error?: string;
  }
) {
  const resultBody = {
    jobId: payload.jobId,
    siteId: payload.siteId,
    requestId: payload.requestId,
    ...body
  };
  const response = await fetch(payload.callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...resultBody, signature: signWorkerCallback(resultBody) }),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`worker_result_callback_failed_${response.status}`);
  }
}

function videoTaskId(body: VideoGenerateResponse) {
  const taskId = body.data?.task_id ?? body.task_id;
  return typeof taskId === "number" || typeof taskId === "string" ? String(taskId) : "";
}

function normalizedVideoMimeType(value: string) {
  const mimeType = value.split(";")[0]?.trim().toLowerCase() || "";
  if (mimeType.startsWith("video/")) return mimeType;
  return "video/mp4";
}

async function createVideoTask(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  imageUrl: string;
  videoParams: { aspect_ratio: string; resolution: string; duration: string };
  timeoutMs: number;
}) {
  const response = await fetchWithTimeout(`${params.baseUrl}/v1/media/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      params: {
        ...params.videoParams,
        images: [params.imageUrl]
      },
      prompt: params.prompt
    }),
    cache: "no-store"
  }, Math.min(params.timeoutMs, 60_000), `ai_provider_video_create_timeout_${Math.min(params.timeoutMs, 60_000)}`);
  const body = (await response.json().catch(() => ({}))) as VideoGenerateResponse;
  const taskId = videoTaskId(body);
  if (!response.ok || !taskId) {
    throw new Error(`ai_provider_video_create_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
  }
  return taskId;
}

async function pollVideoTask(params: {
  payload: WorkerPayload;
  baseUrl: string;
  apiKey: string;
  taskId: string;
  timeoutMs: number;
}) {
  const startedAt = Date.now();
  const pollIntervalMs = videoProviderPollIntervalMs();
  let lastStatus = "";
  while (Date.now() - startedAt < params.timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const url = new URL(`${params.baseUrl}/v1/media/status`);
    url.searchParams.set("task_id", params.taskId);
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
    if (body.is_final === true) {
      if (body.state === "success" && textValue(body.result_url)) return body;
      throw new Error(`ai_provider_video_failed_${body.state || "unknown"}_${textValue(body.error) || textValue(body.status) || "no_result"}`);
    }
  }
  throw new Error(`ai_provider_video_timeout_${params.timeoutMs}_${lastStatus || "no_status"}`);
}

async function downloadVideoResult(params: {
  resultUrl: string;
  timeoutMs: number;
}) {
  const response = await fetchWithTimeout(params.resultUrl, {
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
  const requestedModel = requestedModelOverride(params.payload);
  const model = requestedModel && isVideoGenerationModel(requestedModel) ? requestedModel : provider.modelType;
  if (!isVideoGenerationModel(model)) {
    throw new Error(`ai_provider_not_video_model_${provider.label || provider.id}_${model}`);
  }
  const referenceAsset = firstFrameAsset(params.payload);
  if (!referenceAsset) throw new Error("ai_provider_video_first_frame_required");
  const imageUrl = providerReachableAssetUrl(referenceAsset);
  if (!imageUrl || isLoopbackUrl(imageUrl)) {
    throw new Error("ai_provider_video_first_frame_public_url_required");
  }

  const baseUrl = normalizeBaseUrl(provider.aiUrl);
  const timeoutMs = videoProviderTimeoutMs();
  const prompt = buildVideoPrompt(params.payload);
  const videoParams = videoProviderParams(params.payload);
  await postWorkerStatus(params.payload, "running", "source_images_ready");
  await postWorkerStatus(params.payload, "running", "video_provider_request_started");
  await postWorkerSlotStatus(params.payload, "running", "video_provider_request_started", {
    index: 1,
    status: "running",
    stage: "video_provider_request_started",
    error: "",
    updatedAt: new Date().toISOString()
  });

  const taskId = await createVideoTask({
    baseUrl,
    apiKey: provider.apiKey,
    model,
    prompt,
    imageUrl,
    videoParams,
    timeoutMs
  });
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
    apiKey: provider.apiKey,
    taskId,
    timeoutMs
  });
  const resultUrl = textValue(status.result_url);
  if (!resultUrl) throw new Error("ai_provider_video_empty_result_url");
  const video = await downloadVideoResult({ resultUrl, timeoutMs });
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
    updatedAt: new Date().toISOString()
  });
  return {
    storageKey,
    mimeType: video.mimeType,
    providerLabel: provider.label,
    index: 1,
    estimatedCostUsd: typeof status.cost === "number" ? status.cost : undefined
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
            costTrace: { estimatedCostUsd: output.estimatedCostUsd ?? 0 }
          });
          return;
        } catch (error) {
          lastError = errorMessage(error);
          if (!isRetryableProviderError(error) || attempt >= maxAttempts) break;
          await new Promise((resolve) => setTimeout(resolve, 1_500 * attempt));
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
