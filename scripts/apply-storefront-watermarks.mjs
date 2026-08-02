#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  SAMPLE_STOREFRONT_WATERMARK_OPACITIES,
  isWatermarkableMediaPath,
  normalizedStorefrontWatermarkOpacity,
  watermarkMediaFile,
  watermarkTextForPublicPath
} from "./lib/storefront-watermark.mjs";

const repoRoot = process.cwd();
const rawArgs = process.argv.slice(2);
const args = new Map();
const flags = new Set();

for (let index = 0; index < rawArgs.length; index += 1) {
  const raw = rawArgs[index];
  if (!raw.startsWith("--")) continue;
  const [key, ...rest] = raw.slice(2).split("=");
  if (rest.length) {
    args.set(key, rest.join("="));
    continue;
  }
  const next = rawArgs[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    index += 1;
  } else {
    flags.add(key);
  }
}

const dryRun = flags.has("dry-run");
const force = flags.has("force");
const sample = flags.has("sample");
const limit = Number(args.get("limit") ?? Number.POSITIVE_INFINITY);
const opacity = normalizedStorefrontWatermarkOpacity(args.get("opacity"));
const restoreFrom = String(args.get("restore-from") ?? "").trim();
const restoreFromRoots = restoreFrom
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const outputDirArg = String(args.get("output-dir") ?? "").trim();
const defaultTargets = [
  "public/assets/dreamshoot",
  "public/assets/sites/site_aidreamcapes/creative-packs",
  "public/assets/sites/site_aidreamcapes/fan-holiday-theme",
  "public/assets/sites/site_aidreamcapes/homepage-showcase",
  "public/assets/sites/site_aidreamcapes_eu",
  "public/assets/sites/site_aidreamcapes_xby",
  "public/assets/sites/site_aidreamshoots",
  "public/assets/sites/site_mydreamshoots_xby"
];
const targets = String(args.get("targets") ?? args.get("target") ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() || stat.isDirectory();
  } catch {
    return false;
  }
}

async function removeWatermarkMarker(filePath) {
  await fs.rm(`${filePath}.watermark.json`, { force: true });
}

async function walkMediaFiles(root) {
  const files = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(filePath);
        continue;
      }
      if (!entry.isFile() || !isWatermarkableMediaPath(filePath)) continue;
      files.push(filePath);
    }
  }
  await walk(root);
  return files;
}

function cleanSourcePathFor(filePath, restoreRoot) {
  const relative = path.relative(repoRoot, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return "";
  return path.resolve(restoreRoot, relative);
}

async function findCleanSource(filePath, restoreRoots) {
  for (const restoreRoot of restoreRoots) {
    const cleanPath = cleanSourcePathFor(filePath, restoreRoot);
    if (!cleanPath || !(await fileExists(cleanPath))) continue;
    if (await fileExists(`${cleanPath}.watermark.json`)) {
      return { ok: false, cleanPath, error: "clean_source_has_watermark_marker" };
    }
    return { ok: true, cleanPath };
  }
  return { ok: false, error: "clean_source_missing" };
}

async function restoreCleanSource(filePath, restoreRoots, dryRun) {
  if (!restoreRoots.length) return { ok: true, restored: false };
  const cleanSource = await findCleanSource(filePath, restoreRoots);
  if (!cleanSource.ok) return { ok: false, restored: false, error: cleanSource.error };
  if (!dryRun) {
    await fs.copyFile(cleanSource.cleanPath, filePath);
    await removeWatermarkMarker(filePath);
  }
  return { ok: true, restored: true, cleanPath: cleanSource.cleanPath };
}

async function makeSample(mediaFiles, restoreRoots) {
  if (!mediaFiles.length) throw new Error("sample_target_required");
  const target = mediaFiles[0];
  const text = watermarkTextForPublicPath(target);
  if (!text) throw new Error("sample_target_not_watermarkable");
  const cleanSource = restoreRoots.length ? await findCleanSource(target, restoreRoots) : { ok: true, cleanPath: target };
  if (!cleanSource.ok || !cleanSource.cleanPath) throw new Error(cleanSource.error === "clean_source_has_watermark_marker" ? "sample_clean_source_has_watermark_marker" : "sample_clean_source_missing");
  const sourcePath = cleanSource.cleanPath;

  const outputDir = outputDirArg
    ? path.resolve(repoRoot, outputDirArg)
    : await fs.mkdtemp(path.join(process.env.TMPDIR || "/tmp", "storefront-subtle-watermark-sample-"));
  await fs.mkdir(outputDir, { recursive: true });
  const ext = path.extname(target);
  const basename = path.basename(target, ext);
  const outputs = [];
  for (const sampleOpacity of SAMPLE_STOREFRONT_WATERMARK_OPACITIES) {
    const outputPath = path.join(outputDir, `${basename}-opacity-${Math.round(sampleOpacity * 100)}${ext}`);
    await fs.copyFile(sourcePath, outputPath);
    const result = await watermarkMediaFile(outputPath, text, {
      force: true,
      opacity: sampleOpacity
    });
    outputs.push({
      opacity: sampleOpacity,
      outputPath,
      bytes: result.bytes,
      width: result.width,
      height: result.height
    });
  }
  return {
    ok: true,
    sample: true,
    sourcePath,
    target,
    text,
    outputDir,
    outputs
  };
}

async function main() {
  const restoreRoots = restoreFromRoots.map((root) => path.resolve(repoRoot, root));
  const roots = (targets.length ? targets : defaultTargets)
    .map((target) => path.resolve(repoRoot, target));
  const mediaFiles = [];
  for (const root of roots) {
    if (!(await fileExists(root))) continue;
    const stat = await fs.stat(root);
    if (stat.isFile()) {
      if (isWatermarkableMediaPath(root)) mediaFiles.push(root);
      continue;
    }
    mediaFiles.push(...await walkMediaFiles(root));
  }

  if (sample) {
    console.log(JSON.stringify(await makeSample(mediaFiles, restoreRoots), null, 2));
    return;
  }

  let processed = 0;
  let changed = 0;
  let skipped = 0;
  let restored = 0;
  const failures = [];
  for (const filePath of mediaFiles) {
    if (processed >= limit) break;
    const text = watermarkTextForPublicPath(filePath);
    if (!text) {
      skipped += 1;
      continue;
    }
    processed += 1;
    try {
      const restoreResult = await restoreCleanSource(filePath, restoreRoots, dryRun);
      if (!restoreResult.ok) {
        failures.push({
          filePath: path.relative(repoRoot, filePath),
          error: restoreResult.error ?? "clean_source_restore_failed"
        });
        continue;
      }
      if (restoreResult.restored) restored += 1;
      const result = await watermarkMediaFile(filePath, text, { dryRun, force, opacity });
      if (result.changed) {
        changed += 1;
      } else {
        skipped += 1;
      }
      if (processed % 50 === 0) {
        console.log(`watermark progress: ${processed}/${mediaFiles.length} processed, ${changed} changed, ${skipped} skipped`);
      }
    } catch (error) {
      failures.push({
        filePath: path.relative(repoRoot, filePath),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const summary = {
    ok: failures.length === 0,
    dryRun,
    force,
    opacity,
    restoreFrom: restoreRoots.length ? restoreRoots : undefined,
    discovered: mediaFiles.length,
    processed,
    restored,
    changed,
    skipped,
    failures
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
