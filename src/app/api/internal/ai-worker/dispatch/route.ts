import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getPlatformAiProviderRelational } from "@/lib/stores/platform-store";
import {
  signWorkerCallback,
  verifyWorkerPayloadSignature,
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

function buildPrompt(payload: WorkerPayload) {
  const promptParts = [
    safeImagePrompt(promptText(payload.prompt)),
    safeImagePrompt(promptText(payload.params.prompt)),
    textValue(payload.params.style) ? `Style: ${textValue(payload.params.style)}` : "",
    "Create exactly one standalone image for this output slot.",
    "One subject, one composition, one final portrait only.",
    "Do not create a collage, grid, contact sheet, split panel, moodboard, storyboard, or multiple avatars inside the same image.",
    "Use the provided customer source image as the visual reference when available: keep broad subject, pose, color, composition, and non-sensitive styling cues while producing an original themed result.",
    "Stylized editorial image, tasteful composition, no text, no watermark, no UI."
  ].filter(Boolean);
  return promptParts.join("\n\n");
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
}) {
  const form = new FormData();
  form.append("model", params.model);
  form.append("prompt", params.prompt);
  form.append("size", process.env.LOCAL_AI_WORKER_IMAGE_SIZE ?? "1024x1024");
  form.append("quality", process.env.LOCAL_AI_WORKER_IMAGE_QUALITY ?? "low");
  form.append("response_format", "b64_json");

  const assets = inputAssets(params.payload).slice(0, 4);
  if (!assets.length) return undefined;

  for (const [index, asset] of assets.entries()) {
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
    form.append(index === 0 ? "image" : "image[]", new Blob([bytes], { type: mimeType }), `${asset.assetId}.${extensionForMime(mimeType)}`);
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

async function postWorkerResult(
  payload: WorkerPayload,
  body: {
    status: "succeeded" | "failed";
    outputs?: Array<{ storageKey: string; mimeType?: string }>;
    providerTrace?: Array<{ provider: string; attempts: number }>;
    costTrace?: { estimatedCostUsd?: number };
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
  index: number;
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
  const timeoutMs = Math.max(10_000, Number(process.env.LOCAL_AI_WORKER_PROVIDER_TIMEOUT_MS ?? "90000") || 90_000);
  const prompt = buildPrompt(params.payload);
  const form = await buildImageEditForm({ payload: params.payload, model, prompt, timeoutMs });
  try {
    const response = form
      ? await fetchWithTimeout(
        `${baseUrl}/v1/images/edits`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`
          },
          body: form,
          cache: "no-store"
        },
        timeoutMs,
        `ai_provider_image_edit_timeout_${timeoutMs}`
      )
      : await fetchWithTimeout(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model,
        prompt,
        size: process.env.LOCAL_AI_WORKER_IMAGE_SIZE ?? "1024x1024",
        quality: process.env.LOCAL_AI_WORKER_IMAGE_QUALITY ?? "low",
        response_format: "b64_json"
      }),
      cache: "no-store"
    }, timeoutMs, `ai_provider_generation_timeout_${timeoutMs}`);
    const body = (await response.json().catch(() => ({}))) as ImageGenerationResponse;
    if (!response.ok) {
      const mode = form ? "image_edit" : "generation";
      throw new Error(`ai_provider_${mode}_failed_${response.status}_${JSON.stringify(body).slice(0, 240)}`);
    }
    const b64 = imageBase64(body);
    if (!b64) throw new Error("ai_provider_empty_image_payload");
    const storageKey = `sites/${params.payload.siteId}/customers/${params.payload.customerId}/assets/${params.payload.jobId}-output-${params.index + 1}.png`;
    const filePath = path.join(process.cwd(), "data", "customer-assets", storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from(b64, "base64"));
    return { storageKey, mimeType: "image/png", providerLabel: provider.label };
  } catch (error) {
    throw error;
  }
}

async function runLocalWorker(payload: WorkerPayload) {
  const providers = payload.aiProviderFallback.providers.filter((provider) => provider.id && isImageGenerationModel(provider.modelType));
  if (!providers.length) {
    await postWorkerResult(payload, { status: "failed", error: "no_image_ai_provider_configured" });
    return;
  }

  await postWorkerStatus(payload, "running", "local_worker_started");
  const providerTrace: Array<{ provider: string; attempts: number }> = [];
  let lastError = "";

  for (const provider of providers) {
    providerTrace.push({ provider: provider.label || provider.id, attempts: 1 });
    try {
      const outputs = await Promise.all(
        Array.from({ length: outputCount(payload) }, async (_, index) => {
          const output = await generateWithProvider({ payload, providerId: provider.id, index });
          return { storageKey: output.storageKey, mimeType: output.mimeType };
        })
      );
      await postWorkerResult(payload, {
        status: "succeeded",
        outputs,
        providerTrace,
        costTrace: { estimatedCostUsd: 0 }
      });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "local_worker_generation_failed";
    }
  }

  await postWorkerResult(payload, {
    status: "failed",
    providerTrace,
    error: lastError || "local_worker_generation_failed"
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
