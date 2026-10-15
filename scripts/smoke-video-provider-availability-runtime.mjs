import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const jiti = require("jiti")(path.join(root, "scripts", "smoke-video-provider-availability-runtime.mjs"), {
  alias: { "@": path.join(root, "src") },
  interopDefault: true
});

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

const source = fs.readFileSync(path.join(root, "src/lib/video-provider-availability.ts"), "utf8")
  .replace(/^import "server-only";\n/, "")
  .replace(
    'import { isVideoProviderModel } from "@/lib/video-provider-limits";',
    `function isVideoProviderModel(modelType) {
  if (typeof modelType !== "string") return false;
  const normalized = modelType.trim().toLowerCase();
  return normalized.includes("video") || normalized.includes("grok-imagine-video");
}`
  );

const availabilityModule = jiti.evalModule(source, {
  filename: path.join(root, "src/lib/video-provider-availability.ts"),
  ext: ".ts"
});
const providerFamilyModule = jiti(path.join(root, "src/lib/video-provider-family.ts"));

function withEnv(patch, callback) {
  const original = {};
  for (const key of Object.keys(patch)) {
    original[key] = process.env[key];
    if (patch[key] === undefined) delete process.env[key];
    else process.env[key] = patch[key];
  }
  try {
    callback();
  } finally {
    for (const key of Object.keys(patch)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

const smartPickLidProvider = {
  id: "provider_smartpicklid",
  label: "SmartPickLid Grok Video",
  aiUrl: "https://api.smartpicklid.com",
  apiKey: "redacted-test-key",
  modelType: "grok-imagine-video",
  enabled: true
};

const magic666Provider = {
  id: "provider_magic666",
  label: "Magic666 Grok Video",
  aiUrl: "https://magic666.top",
  apiKey: "redacted-test-key",
  modelType: "grok-imagine-video",
  enabled: true
};

const tokengoProvider = {
  id: "provider_tokengo",
  label: "Buming Veo",
  aiUrl: "https://buming.token6688.com",
  apiKey: "redacted-test-key",
  modelType: "veo3.1",
  providerType: "video",
  enabled: true
};

assert(
  providerFamilyModule.videoProviderProtocolForBaseUrl("https://api.smartpicklid.com") === "openai-videos" &&
    providerFamilyModule.videoProviderProtocolForBaseUrl("https://buming.token6688.com") === "tokengo-media" &&
    providerFamilyModule.videoProviderProtocolForBaseUrl("https://sd2.huitu.xyz") === "huitu-openapi",
  "automatic protocol selection retains existing SmartPickLid, Buming and Huitu adapters"
);
assert(
  providerFamilyModule.videoProviderProtocolForBaseUrl("https://new-video.example", "openai-videos") === "openai-videos",
  "an explicitly selected protocol works with a new provider domain"
);
assert(
  providerFamilyModule.videoProviderModelFamilyForProvider({
    aiUrl: "https://new-video.example",
    modelType: "grok-imagine-video",
    videoModelFamily: "gemini"
  }) === "gemini",
  "an explicitly configured model family takes precedence over model-name guessing"
);

withEnv({
  AI_WORKER_ALLOW_SMARTPICKLID_UNVERIFIED_VIDEO: undefined,
  AI_WORKER_ALLOW_SMARTPICKLID_REFERENCE_VIDEO: undefined,
  AI_WORKER_ALLOW_MAGIC666_UNVERIFIED_VIDEO: undefined
}, () => {
  const smartPickLidAvailability = availabilityModule.videoProviderAvailability([smartPickLidProvider], {
    referenceAssetCount: 1
  });
  assert(
    smartPickLidAvailability.ok === true,
    "enabled SmartPickLid video provider is runnable for image-to-video without hidden env flags"
  );

  const magicAvailability = availabilityModule.videoProviderAvailability([magic666Provider], {
    referenceAssetCount: 1
  });
  assert(
    magicAvailability.ok === false &&
    magicAvailability.blockedProviders[0]?.reason === "ai_provider_video_content_unverified_magic666",
    "Magic666 remains guarded unless explicitly allowed"
  );

  const tokengoAvailability = availabilityModule.videoProviderAvailability([tokengoProvider], {
    referenceAssetCount: 0
  });
  assert(
    tokengoAvailability.ok === true,
    "Buming/TokenGo video provider is runnable without a reference frame"
  );
});

withEnv({
  AI_WORKER_ALLOW_SMARTPICKLID_UNVERIFIED_VIDEO: "0",
  AI_WORKER_ALLOW_SMARTPICKLID_REFERENCE_VIDEO: undefined
}, () => {
  const availability = availabilityModule.videoProviderAvailability([smartPickLidProvider], {
    referenceAssetCount: 0
  });
  assert(
    availability.ok === false &&
    availability.blockedProviders[0]?.reason === "ai_provider_video_content_unverified_smartpicklid",
    "SmartPickLid video can still be explicitly disabled with AI_WORKER_ALLOW_SMARTPICKLID_UNVERIFIED_VIDEO=0"
  );
});

withEnv({
  AI_WORKER_ALLOW_SMARTPICKLID_UNVERIFIED_VIDEO: undefined,
  AI_WORKER_ALLOW_SMARTPICKLID_REFERENCE_VIDEO: "0"
}, () => {
  const availability = availabilityModule.videoProviderAvailability([smartPickLidProvider], {
    referenceAssetCount: 1
  });
  assert(
    availability.ok === false &&
    availability.blockedProviders[0]?.reason === "ai_provider_video_reference_channel_unreliable_smartpicklid",
    "SmartPickLid reference video can still be explicitly disabled with AI_WORKER_ALLOW_SMARTPICKLID_REFERENCE_VIDEO=0"
  );
});
