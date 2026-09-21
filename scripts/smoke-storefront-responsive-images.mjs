#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(".");
const PUBLIC_ROOT = path.join(ROOT, "public");
const MANIFEST_PATH = path.join(ROOT, "src/lib/storefront-responsive-image-manifest.json");
const RENDERER_PATH = path.join(ROOT, "src/components/theme-renderer.tsx");
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const renderer = fs.readFileSync(RENDERER_PATH, "utf8");
const failures = [];

function localPath(url) {
  const clean = String(url || "").split(/[?#]/)[0];
  if (!clean.startsWith("/assets/")) return undefined;
  const filePath = path.resolve(PUBLIC_ROOT, clean.slice(1));
  if (filePath !== PUBLIC_ROOT && !filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) return undefined;
  return filePath;
}

function fail(kind, detail) {
  failures.push({ kind, ...detail });
}

async function inspect(url, context) {
  const filePath = localPath(url);
  if (!filePath || !fs.existsSync(filePath)) {
    fail("missing-file", { ...context, url });
    return undefined;
  }
  try {
    const metadata = await sharp(filePath).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) {
      fail("invalid-image-metadata", { ...context, url, metadata });
      return undefined;
    }
    return metadata;
  } catch (error) {
    fail("decode-error", { ...context, url, error: error instanceof Error ? error.message : String(error) });
    return undefined;
  }
}

async function runWithConcurrency(tasks, limit = 8) {
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
}

const entries = Object.entries(manifest);
if (!entries.length) fail("empty-manifest", { path: MANIFEST_PATH });
if (!renderer.includes("<picture>") || !renderer.includes("storefrontResponsiveImageSet") || !renderer.includes("srcSet=")) {
  fail("renderer-not-wired", { path: RENDERER_PATH });
}

const siteCounts = {};
const tasks = [];
for (const [originalUrl, entry] of entries) {
  siteCounts[entry.site] = (siteCounts[entry.site] || 0) + 1;
  tasks.push(async () => {
    const original = await inspect(originalUrl, { originalUrl, role: "original" });
    if (!original) return;
    if (original.width !== entry.width || original.height !== entry.height) {
      fail("original-dimensions-mismatch", { originalUrl, expected: [entry.width, entry.height], actual: [original.width, original.height] });
    }
    const originalRatio = entry.width / entry.height;
    for (const variant of entry.variants || []) {
      for (const format of ["avif", "webp"]) {
        const url = variant[format];
        if (!url) continue;
        const metadata = await inspect(url, { originalUrl, role: format, width: variant.width });
        if (!metadata) continue;
        const formatMatches = format === "avif" ? metadata.format === "heif" || metadata.format === "avif" : metadata.format === format;
        if (!formatMatches) {
          fail("variant-format-mismatch", { originalUrl, url, expected: format, actual: metadata.format });
        }
        if (metadata.width > entry.width || metadata.height > entry.height || metadata.width > variant.width) {
          fail("variant-upscales-source", { originalUrl, url, source: [entry.width, entry.height], variant: [metadata.width, metadata.height], declaredWidth: variant.width });
        }
        if (Math.abs(metadata.width / metadata.height - originalRatio) > 0.02) {
          fail("variant-aspect-ratio-mismatch", { originalUrl, url, sourceRatio: originalRatio, variantRatio: metadata.width / metadata.height });
        }
      }
    }
  });
}

await runWithConcurrency(tasks);

const result = {
  ok: failures.length === 0,
  manifest: MANIFEST_PATH,
  entries: entries.length,
  variants: entries.reduce((sum, [, entry]) => sum + (entry.variants || []).reduce((count, variant) => count + (variant.avif ? 1 : 0) + (variant.webp ? 1 : 0), 0), 0),
  siteCounts,
  failures
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
