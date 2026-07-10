import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const files = {
  dispatch: fs.readFileSync(path.join(root, "src/app/api/internal/ai-worker/dispatch/route.ts"), "utf8"),
  worker: fs.readFileSync(path.join(root, "src/lib/worker.ts"), "utf8"),
  storage: fs.readFileSync(path.join(root, "src/lib/customer-asset-storage.ts"), "utf8"),
  providers: fs.readFileSync(path.join(root, "src/app/api/platform/ai-providers/route.ts"), "utf8")
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
    label: "video provider sends exactly one first-frame reference image",
    pass: files.dispatch.includes("images: [params.imageUrl]") &&
      files.dispatch.includes("ai_provider_video_first_frame_required")
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
    pass: files.providers.includes("grok-imagine-video-1.5-preview")
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
