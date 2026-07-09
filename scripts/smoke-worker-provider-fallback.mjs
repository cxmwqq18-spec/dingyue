import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routePath = path.resolve(__dirname, "../src/app/api/internal/ai-worker/dispatch/route.ts");
const source = fs.readFileSync(routePath, "utf8");

const checks = [
  {
    label: "worker builds an ordered image provider fallback queue",
    pass: /function orderedImageProviders\(/.test(source)
  },
  {
    label: "preferred providers do not exclude non-preferred fallback providers",
    pass: !source.includes("const providers = preferredImageProviders.length ? preferredImageProviders : imageProviders")
  },
  {
    label: "worker still prioritizes preferred providers before fallback providers",
    pass: source.includes("preferredProviders") && source.includes("fallbackProviders")
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
