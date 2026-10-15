import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routePath = path.resolve(__dirname, "../src/app/api/internal/ai-worker/dispatch/route.ts");
const source = fs.readFileSync(routePath, "utf8");
const platformStorePath = path.resolve(__dirname, "../src/lib/stores/platform-store.ts");
const platformStoreSource = fs.readFileSync(platformStorePath, "utf8");
const videoFallbackPath = path.resolve(__dirname, "../src/lib/video-provider-fallback.ts");
const videoFallbackSource = fs.readFileSync(videoFallbackPath, "utf8");
const orderedImageProvidersFunction = source.match(/function orderedImageProviders\([\s\S]*?\n}/)?.[0] ?? "";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(import.meta.url, { interopDefault: true });
const videoFallback = jiti(videoFallbackPath);

const checks = [
  {
    label: "worker builds an ordered image provider fallback queue",
    pass: orderedImageProvidersFunction.includes("function orderedImageProviders")
  },
  {
    label: "worker ignores non-runnable providers in fallback queues",
    pass: /provider\.enabled !== false/.test(source) &&
      /providers\.filter\(\(provider\) => aiProviderStatus\(provider\)\.runnable\)\.map/.test(platformStoreSource)
  },
  {
    label: "preferred providers do not exclude non-preferred fallback providers",
    pass: orderedImageProvidersFunction.includes("orderAiProviderFallbackCandidates(candidateProviders)") &&
      !orderedImageProvidersFunction.includes("preferredProviders.length ? preferredProviders : imageProviders")
  },
  {
    label: "image provider queue follows priority before preferred status",
    pass: orderedImageProvidersFunction.includes("orderAiProviderFallbackCandidates(candidateProviders)") &&
      orderedImageProvidersFunction.includes("return selectedProvider")
  },
  {
    label: "image edit requests prefer providers marked as edit-capable",
    pass: orderedImageProvidersFunction.includes("const requiresImageEdit = inputAssets(payload).length > 0") &&
      orderedImageProvidersFunction.includes("const editCapableProviders = imageProviders.filter((provider) => provider.supportsEditN)") &&
      orderedImageProvidersFunction.includes("const candidateProviders = requiresImageEdit && editCapableProviders.length ? editCapableProviders : imageProviders")
  },
  {
    label: "video worker prioritizes lower priority values before preferred badges",
    pass: source.includes("orderSelectableAiProviderFallbackCandidates(videoProviders, payload.providerSelection)") &&
      videoFallbackSource.includes("providerPriority(left.priority) - providerPriority(right.priority)") &&
      videoFallbackSource.includes("Number(Boolean(right.preferred)) - Number(Boolean(left.preferred))")
  },
  {
    label: "fixed provider mode can still restrict generation to one configured provider",
    pass: source.includes('selection?.mode === "fixed_provider"')
  },
  {
    label: "image edit uploads default to repeated image fields for provider compatibility",
    pass: /function imageEditFormFieldName\([^)]*\)\s*{[\s\S]*if \(mode === "image-array"\) return "image\[\]";[\s\S]*return "image";[\s\S]*}/.test(source) &&
      !source.includes('return totalAssets > 1 ? "image[]" : "image";')
  },
  {
    label: "worker preserves successful output slots while retrying missing slots",
    pass: source.includes("successfulOutputsByIndex") && source.includes("missingSlotIndexes")
  },
  {
    label: "single provider attempt cannot settle a partial multi-output package",
    pass: !/if \(!outputs\.length\)[\s\S]*return outputs;/.test(source)
  },
  {
    label: "exhausted provider retries keep any partial outputs for settlement",
    pass: source.includes("const partialOutputs = Array.from(successfulOutputsByIndex.values())") &&
      source.includes("if (partialOutputs.length)") &&
      source.includes('error: lastError || "local_worker_partial_generation_failed"')
  }
];

const orderedImageCandidates = videoFallback.orderAiProviderFallbackCandidates([
  { id: "preferred-p5", label: "Preferred P5", priority: 5, preferred: true },
  { id: "fallback-p0", label: "Fallback P0", priority: 0, preferred: false },
  { id: "fallback-p2", label: "Fallback P2", priority: 2, preferred: false }
]);
if (orderedImageCandidates.map((provider) => provider.id).join(",") !== "fallback-p0,fallback-p2,preferred-p5") {
  console.error("FAIL image provider priority order puts the lowest priority value first");
  process.exit(1);
}

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
console.log("PASS image provider priority order puts the lowest priority value first");
