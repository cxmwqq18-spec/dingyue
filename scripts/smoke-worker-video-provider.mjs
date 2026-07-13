import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const files = {
  dispatch: fs.readFileSync(path.join(root, "src/app/api/internal/ai-worker/dispatch/route.ts"), "utf8"),
  worker: fs.readFileSync(path.join(root, "src/lib/worker.ts"), "utf8"),
  storage: fs.readFileSync(path.join(root, "src/lib/customer-asset-storage.ts"), "utf8"),
  providers: fs.readFileSync(path.join(root, "src/app/api/platform/ai-providers/route.ts"), "utf8"),
  providerPanel: fs.readFileSync(path.join(root, "src/components/platform/platform-ai-provider-panel.tsx"), "utf8"),
  multiframeScript: fs.readFileSync(path.join(root, "scripts/enable-video-provider-multiframe.mjs"), "utf8")
};

const checks = [
  {
    label: "worker can identify video generation models separately from image models",
    pass: files.dispatch.includes("function isVideoGenerationModel(") &&
      files.dispatch.includes("!isVideoGenerationModel(normalized)")
  },
  {
    label: "worker routes only explicit video-style requests to the video branch",
    pass: files.dispatch.includes("function isVideoGenerationRequest(") &&
      files.dispatch.includes("await runLocalVideoWorker(payload)")
  },
  {
    label: "video provider supports the LK888 media generate and status endpoints",
    pass: files.dispatch.includes("/v1/media/generate") &&
      files.dispatch.includes("/v1/media/status") &&
      files.dispatch.includes("is_final === true") &&
      files.dispatch.includes('body.state === "success"')
  },
  {
    label: "video provider supports SmartPickLid OpenAI-compatible video endpoints",
    pass: files.dispatch.includes('return "openai-videos"') &&
      files.dispatch.includes("/v1/videos") &&
      files.dispatch.includes("body.status === \"completed\"") &&
      files.dispatch.includes("/content")
  },
  {
    label: "video worker composes multi-frame uploads into one identity-preserved provider reference",
    pass: files.dispatch.includes("composeVideoSceneReference") &&
      files.dispatch.includes("buildVideoSceneImagePrompt") &&
      files.dispatch.includes("video_scene_composition_started") &&
      files.dispatch.includes("video_scene_reference_ready") &&
      files.dispatch.includes("const providerReferenceLimit = 1;") &&
      files.dispatch.includes("requestedReferenceAssets.length > providerReferenceLimit") &&
      files.dispatch.includes("composedScene ? [composedScene.asset]") &&
      files.dispatch.includes("Identity preservation is the highest requirement") &&
      files.dispatch.includes("generic couple model") &&
      files.dispatch.includes("videoFrameReferenceFileLabel") &&
      files.dispatch.includes("ai_provider_video_first_frame_required")
  },
  {
    label: "video scene image composition falls back when a provider has no balance",
    pass: files.dispatch.includes("function shouldTryNextSceneImageProvider(") &&
      files.dispatch.includes('message.includes("insufficient_balance")') &&
      files.dispatch.includes('message.includes("insufficient account balance")') &&
      files.dispatch.includes("if (!shouldTryNextSceneImageProvider(error)) break")
  },
  {
    label: "video provider compresses references and retries unstable multi-frame requests with the first frame",
    pass: files.dispatch.includes("shouldCompressVideoReferenceImages") &&
      files.dispatch.includes("LOCAL_AI_WORKER_VIDEO_REFERENCE_MAX_DIMENSION") &&
      files.dispatch.includes("shouldRetryOpenAiVideoTaskWithFirstFrame") &&
      files.dispatch.includes("video_provider_retry_first_frame")
  },
  {
    label: "video provider falls through to another model when a create channel returns a gateway error",
    pass: files.dispatch.includes("function shouldTryNextVideoModel(") &&
      files.dispatch.includes('message.includes("ai_provider_video_create_failed_502_")') &&
      files.dispatch.includes("if (!shouldTryNextVideoModel(error)) break")
  },
  {
    label: "video provider records configured capacity while dispatching one composed reference",
    pass: files.dispatch.includes("configuredProviderReferenceLimit") &&
      files.dispatch.includes("providerReferenceLimit = 1") &&
      files.dispatch.includes("Original selected frame count") &&
      files.dispatch.includes("buildVideoPrompt(params.payload, referenceAssets)")
  },
  {
    label: "video provider prompt keeps frame resources and explicit user direction ahead of theme wording",
    pass: files.dispatch.includes("buildVideoReferenceContractPrompt") &&
      files.dispatch.includes("Highest priority user direction") &&
      files.dispatch.includes("Resource priority: frame image content defines visible source subjects") &&
      files.dispatch.includes("Cast continuity is mandatory") &&
      files.dispatch.includes("Direct reference rule") &&
      files.dispatch.includes("Do not output only one person") &&
      files.dispatch.includes("Do not replace the requested action with walking") &&
      files.dispatch.includes("Do not replace the source subject with a generic actor")
  },
  {
    label: "worker payload preserves a public signed asset URL for external providers",
    pass: files.worker.includes("publicUrl?: string") &&
      files.worker.includes("publicAssetBaseUrl")
  },
  {
    label: "customer asset storage serves common video MIME types",
    pass: files.storage.includes('".mp4": "video/mp4"') &&
      files.storage.includes('".webm": "video/webm"') &&
      files.storage.includes("mimeType.includes(\"mp4\")")
  },
  {
    label: "platform provider model picker includes the Grok video model",
    pass: files.providers.includes("grok-video-3-pro") &&
      files.providers.includes("grok-imagine-video-1.5-preview")
  },
  {
    label: "platform provider UI labels the request image limit as reference images",
    pass: files.providerPanel.includes("单次最多参考图") &&
      files.providerPanel.includes("单次参考图")
  },
  {
    label: "video provider data script preserves the one-image upstream contract",
    pass: files.multiframeScript.includes("VIDEO_PROVIDER_MAX_IMAGES_PER_REQUEST") &&
      files.multiframeScript.includes('?? "1"') &&
      files.multiframeScript.includes("maxImagesPerRequest: targetLimit") &&
      files.multiframeScript.includes("modelType.trim().toLowerCase().includes(\"video\")")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  for (const check of failed) {
    console.error(`FAIL ${check.label}`);
  }
  process.exit(1);
}

for (const check of checks) {
  console.log(`PASS ${check.label}`);
}
