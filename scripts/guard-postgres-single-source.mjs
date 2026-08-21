import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const runtimeRoots = ["src/app", "src/lib"];
const runtimeFiles = [
  "package.json",
  "scripts/cleanup-mydreamshoots-legacy-video-themes.mjs",
  "scripts/guard-mydreamshoots-page-copy-contract.mjs",
  "scripts/guard-storefront-launch-seo-contract.mjs",
  "scripts/smoke-mydreamshoots-media-seo-schema.mjs",
  "scripts/smoke-mydreamshoots-seo-indexing.mjs",
  "scripts/smoke-mydreamshoots-seo-ssr.mjs",
  "scripts/smoke-storefront-seo-fingerprint.mjs",
  "scripts/sync-mydreamshoots-video-category-hierarchy.mjs",
  "scripts/sync-mydreamshoots-video-topic-pages.mjs"
];
const runtimeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const failures = [];

function walk(relativeDirectory) {
  const absoluteDirectory = path.join(repoRoot, relativeDirectory);
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return walk(relativePath);
    return runtimeExtensions.has(path.extname(entry.name)) ? [relativePath] : [];
  });
}

const checkedRuntimeFiles = [...runtimeRoots.flatMap(walk), ...runtimeFiles];

for (const relativePath of checkedRuntimeFiles) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  if (/data[\\/]platform-state\.json/.test(source)) {
    failures.push({ file: relativePath, reason: "runtime references data/platform-state.json" });
  }
  if (/["'](?:local|json|legacy|file)-preview["']/.test(source)) {
    failures.push({ file: relativePath, reason: "runtime can select a JSON/local preview read mode" });
  }
  if (/readStorefrontPlatformStateFromLegacyJson|readLocalJsonPlatformState/.test(source)) {
    failures.push({ file: relativePath, reason: "runtime exposes a legacy JSON state reader" });
  }
  if (/PERSISTENCE_BACKEND\s*!==\s*["']postgres["']|PERSISTENCE_BACKEND\s*!==\s*`postgres`/.test(source)) {
    failures.push({ file: relativePath, reason: "runtime can select a non-PostgreSQL persistence branch" });
  }
  if (/data[\\/]async-jobs\.json|rate-limit-store\.json/.test(source)) {
    failures.push({ file: relativePath, reason: "runtime persists operational state in a JSON file" });
  }
}

const envExample = fs.readFileSync(path.join(repoRoot, ".env.example"), "utf8");
if (!/^PERSISTENCE_BACKEND=postgres$/m.test(envExample)) {
  failures.push({ file: ".env.example", reason: "PERSISTENCE_BACKEND must default to postgres" });
}
if (!/^STOREFRONT_PATH_MODE_READS=database$/m.test(envExample)) {
  failures.push({ file: ".env.example", reason: "storefront reads must default to database" });
}


const result = {
  ok: failures.length === 0,
  checkedFiles: checkedRuntimeFiles.length,
  failures
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
