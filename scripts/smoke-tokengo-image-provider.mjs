import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dispatch = fs.readFileSync(path.join(root, "src/app/api/internal/ai-worker/dispatch/route.ts"), "utf8");
const providerConfig = fs.readFileSync(path.join(root, "src/lib/ai-provider-config.ts"), "utf8");
const providerType = fs.readFileSync(path.join(root, "src/lib/ai-provider-type.ts"), "utf8");
const providerPanel = fs.readFileSync(path.join(root, "src/components/platform/platform-ai-provider-panel.tsx"), "utf8");
const providerRoute = fs.readFileSync(path.join(root, "src/app/api/platform/ai-providers/route.ts"), "utf8");
const providerStore = fs.readFileSync(path.join(root, "src/lib/stores/platform-store.ts"), "utf8");

assert.match(dispatch, /isTokengoImageProvider/);
assert.match(dispatch, /tokengoImageRuntimeInvokeUrl/);
assert.match(dispatch, /tokengoImageRuntimeTaskUrl/);
assert.match(dispatch, /tokengoImageFilesUrl/);
assert.match(dispatch, /provider\.imageResolution/);
assert.match(dispatch, /provider\.imageQuality/);
assert.match(dispatch, /provider\.imageOutputFormat/);
assert.match(dispatch, /provider\.imageAspectRatio/);
assert.match(dispatch, /Idempotency-Key/);
assert.match(dispatch, /providerAttempts\(\) \{\n  return .*\?\? "1"/);
assert.match(dispatch, /LOCAL_AI_WORKER_ALLOW_PAID_TOKENGO_IMAGE_FALLBACK/);
assert.match(providerConfig, /return "tokengo-image"/);
assert.match(providerType, /buming001\.token6688\.com/);
assert.match(providerPanel, /tokengo-image/);
assert.match(providerPanel, /图片清晰度 \/ 分辨率/);
assert.match(providerPanel, /IMAGE_PROVIDER_OUTPUT_FORMATS/);
assert.match(providerRoute, /imageResolution: provider\.imageResolution/);
assert.match(providerStore, /imageQuality: normalizeImageProviderQuality/);

const adapter = await import("../src/lib/tokengo-image.ts");

assert.equal(adapter.isTokengoImageBaseUrl("https://buming001.token6688.com"), true);
assert.equal(adapter.isTokengoImageBaseUrl("https://buming.token6688.com"), false);
assert.deepEqual(adapter.IMAGE_PROVIDER_RESOLUTIONS, ["1K", "2K", "4K"]);
assert.deepEqual(adapter.IMAGE_PROVIDER_QUALITIES, ["auto", "low", "medium", "high"]);
assert.deepEqual(adapter.IMAGE_PROVIDER_OUTPUT_FORMATS, ["png", "jpeg"]);
assert.equal(adapter.normalizeImageProviderResolution("4k"), "4K");
assert.equal(adapter.normalizeImageProviderQuality("invalid"), "low");
assert.equal(adapter.normalizeImageProviderOutputFormat("JPEG"), "jpeg");
assert.equal(adapter.normalizeTokengoImageBaseUrl("https://buming001.token6688.com/v1/"), "https://buming001.token6688.com");
assert.equal(adapter.tokengoImageGenerationsUrl("https://buming001.token6688.com"), "https://buming001.token6688.com/v1/images/generations");
assert.equal(adapter.tokengoImageRuntimeInvokeUrl("https://buming001.token6688.com"), "https://buming001.token6688.com/api/v1/model-runtime/invoke");
assert.equal(adapter.tokengoImageRuntimeTaskUrl("https://buming001.token6688.com", "task/1"), "https://buming001.token6688.com/api/v1/model-runtime/tasks/task%2F1");
assert.equal(adapter.tokengoImageFilesUrl("https://buming001.token6688.com"), "https://buming001.token6688.com/v1/files");

assert.deepEqual(adapter.tokengoImageGenerationBody({
  model: "gpt-image-2",
  prompt: "a clean editorial portrait",
  count: 1,
  size: "1024x1024",
  quality: "low"
}), {
  model: "gpt-image-2",
  n: 1,
  prompt: "a clean editorial portrait",
  quality: "low",
  response_format: "b64_json",
  size: "1024x1024"
});

assert.deepEqual(adapter.tokengoImageRuntimeBody({
  model: "gpt-image-2",
  prompt: "combine the supplied references",
  count: 1,
  mode: "multi-reference",
  aspectRatio: "16:9",
  resolution: "1K",
  quality: "low",
  outputFormat: "png",
  images: ["https://cdn.example/reference.png"]
}), {
  modality: "image",
  model_id: "gpt-image-2",
  operation: "generate",
  params: {
    aspect_ratio: "16:9",
    count: 1,
    mode: "multi-reference",
    output_format: "png",
    prompt: "combine the supplied references",
    quality: "low",
    resolution: "1K",
    images: ["https://cdn.example/reference.png"]
  }
});

const syncBody = {
  created: 1,
  data: [{ creation_task_id: "sync-task#0", url: "https://cdn.example/compressed.jpg", original_url: "https://cdn.example/original.png" }],
  usage: { cost_rmb: 0.065 }
};
assert.equal(adapter.tokengoImageResultUrlFromBody(syncBody), "https://cdn.example/original.png");
assert.equal(adapter.tokengoImageTaskIdFromBody(syncBody), "sync-task#0");
assert.equal(adapter.tokengoImageCostRmbFromBody(syncBody), 0.065);

const asyncBody = {
  data: {
    task_id: "runtime-task",
    status: "completed",
    is_final: true,
    result: { images: [{ result_url: "https://cdn.example/result.png" }] }
  }
};
assert.equal(adapter.tokengoImageTaskIdFromBody(asyncBody), "runtime-task");
assert.equal(adapter.tokengoImageTaskStatusFromBody(asyncBody), "completed");
assert.equal(adapter.tokengoImageTaskIsFinal(asyncBody), true);
assert.equal(adapter.tokengoImageResultUrlFromBody(asyncBody), "https://cdn.example/result.png");

console.log("smoke-tokengo-image-provider: ok");
