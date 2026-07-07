import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getPlatformAiProviderRelational } from "@/lib/stores/platform-store";
import {
  signWorkerCallback,
  verifyWorkerPayloadSignature,
  type WorkerOutputSlot,
  type WorkerPayload
} from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImageGenerationResponse = {
  data?: Array<{ b64_json?: string; image_base64?: string }>;
  output?: Array<{ b64_json?: string; image_base64?: string }>;
  image_base64?: string;
  error?: unknown;
};

type ImageInputAsset = {
  assetId: string;
  signedUrl: string;
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

function isImageGenerationModel(model: string) {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith("gpt-image") || normalized.includes("image");
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

function providerAttempts() {
  return Math.max(1, Math.min(Number(process.env.LOCAL_AI_WORKER_PROVIDER_ATTEMPTS ?? "2") || 2, 4));
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
      ? "Use the primary reference photos for person A and the partner reference photos for person B. Person B must come from the partner reference photos, not from an invented face."
      : "Use the source photos as references for two distinct people.";
    return [
      "Final composition requirement: show exactly two visible adult people together in one realistic scene.",
      subjectSource,
      "Keep both reference subjects represented as the two people in the final image, with the primary subject and partner subject both visible.",
      "The two people should be styled as a couple or paired subjects, both clearly visible from head and upper body or full body.",
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
    "Do not create a collage, grid, contact sheet, split panel, moodboard, storyboard, or multiple avatars inside the same image.",
    "Use the provided customer source image or images as visual references when available: keep broad subject, pose, color, composition, and non-sensitive styling cues while producing an original themed result.",
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

function inputAssets(payload: WorkerPayload): ImageInputAsset[] {
  return payload.inputAssets.filter((asset) => asset.assetId !== "asset_demo" && asset.signedUrl.trim());
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "png";
}

async function prepareProviderImage(bytes: Uint8Array, mimeType: string) {
  if (mimeType.includes("gif")) return { bytes: blobPartFromBytes(Buffer.from(bytes)), mimeType };
  const maxDimension = Math.max(512, Number(process.env.LOCAL_AI_WORKER_REFERENCE_MAX_DIMENSION ?? "1600") || 1600);
  const quality = Math.max(60, Math.min(Number(process.env.LOCAL_AI_WORKER_REFERENCE_QUALITY ?? "82") || 82, 95));
  try {
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

  const assets = inputAssets(params.payload).slice(0, 4);
  if (!assets.length) return undefined;

  for (const [index, asset] of assets.entries()) {
    const roles = referenceRoles(params.payload);
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
    form.append(index === 0 ? "image" : "image[]", new Blob([prepared.bytes], { type: prepared.mimeType }), `${role}-reference-${index + 1}-${asset.assetId}.${extensionForMime(prepared.mimeType)}`);
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

async function generateWithProvider(params: {
  payload: WorkerPayload;
  providerId: string;
  count: number;
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
    const promptForSlot = promptForOutputSlot(prompt, slotIndex, params.count);
    await postWorkerSlotStatus(params.payload, "running", "provider_request_started", {
      index: slotIndex,
      status: "running",
      stage: "provider_request_started",
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
      const storageKey = `sites/${params.payload.siteId}/customers/${params.payload.customerId}/assets/${params.payload.jobId}-output-${slotIndex}.png`;
      const filePath = path.join(process.cwd(), "data", "customer-assets", storageKey);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, Buffer.from(b64, "base64"));
      await postWorkerSlotStatus(params.payload, "running", "provider_response_received", {
        index: slotIndex,
        status: "succeeded",
        stage: "provider_response_received",
        storageKey,
        mimeType: "image/png",
        updatedAt: new Date().toISOString()
      });
      return { storageKey, mimeType: "image/png", providerLabel, index: slotIndex };
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
    Array.from({ length: params.count }, (_, index) => generateSlot(index + 1))
  );
  const outputs = slots
    .filter((slot): slot is PromiseFulfilledResult<{ storageKey: string; mimeType: string; providerLabel: string; index: number }> => slot.status === "fulfilled")
    .map((slot) => slot.value)
    .sort((left, right) => left.index - right.index);
  if (!outputs.length) {
    const firstError = slots.find((slot): slot is PromiseRejectedResult => slot.status === "rejected")?.reason;
    throw firstError instanceof Error ? firstError : new Error("ai_provider_empty_image_payload");
  }
  return outputs;
}

async function runLocalWorker(payload: WorkerPayload) {
  const imageProviders = payload.aiProviderFallback.providers.filter((provider) => provider.id && isImageGenerationModel(provider.modelType));
  const preferredImageProviders = imageProviders.filter((provider) => provider.preferred);
  const providers = preferredImageProviders.length ? preferredImageProviders : imageProviders;
  if (!providers.length) {
    await postWorkerResult(payload, { status: "failed", error: "no_image_ai_provider_configured" });
    return;
  }

  await postWorkerStatus(payload, "running", "local_worker_started");
  const providerTrace: Array<{ provider: string; attempts: number }> = [];
  let lastError = "";
  const providerErrors: Array<{ provider: string; error: string }> = [];

  for (const provider of providers) {
    const trace = { provider: provider.label || provider.id, attempts: 0 };
    providerTrace.push(trace);
    try {
      let outputs: Array<{ storageKey: string; mimeType: string }> | undefined;
      let outputError: unknown;
      for (const attempt of Array.from({ length: providerAttempts() }, (_, attemptIndex) => attemptIndex + 1)) {
        trace.attempts += 1;
        try {
          outputs = (await generateWithProvider({ payload, providerId: provider.id, count: outputCount(payload) }))
            .map((output) => ({ storageKey: output.storageKey, mimeType: output.mimeType }));
          break;
        } catch (error) {
          outputError = error;
          if (!isRetryableProviderError(error) || attempt >= providerAttempts()) break;
          await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
        }
      }
      if (!outputs?.length) throw outputError instanceof Error ? outputError : new Error("local_worker_generation_failed");
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

  await postWorkerResult(payload, {
    status: "failed",
    providerTrace,
    error: lastError || "local_worker_generation_failed",
    costTrace: { providerErrors }
  });
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
