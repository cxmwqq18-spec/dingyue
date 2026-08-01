#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  isWatermarkableMediaPath,
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
const limit = Number(args.get("limit") ?? Number.POSITIVE_INFINITY);
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

async function main() {
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

  let processed = 0;
  let changed = 0;
  let skipped = 0;
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
      const result = await watermarkMediaFile(filePath, text, { dryRun, force });
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
    discovered: mediaFiles.length,
    processed,
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
