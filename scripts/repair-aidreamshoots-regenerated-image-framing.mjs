#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const batchId = "aidreamshoots-other-topics-20260914-v1";
const manifestPath = path.resolve(`.tmp/aidreamshoots-other-topic-regeneration/${batchId}/manifest.json`);
const confirmation = "aidreamshoots-image-framing-repair";
const alphaThreshold = 16;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function writeManifest(manifest) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function alphaBounds(filePath) {
  const metadata = await sharp(filePath).metadata();
  if (!metadata.hasAlpha || !metadata.width || !metadata.height) return null;
  const sampleWidth = 256;
  const sampleHeight = Math.max(1, Math.round(sampleWidth * metadata.height / metadata.width));
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .resize(sampleWidth, sampleHeight, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] > alphaThreshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0 || (minX === 0 && minY === 0 && maxX === info.width - 1 && maxY === info.height - 1)) return null;
  const left = Math.max(0, Math.floor(minX * metadata.width / info.width));
  const top = Math.max(0, Math.floor(minY * metadata.height / info.height));
  const right = Math.min(metadata.width, Math.ceil((maxX + 1) * metadata.width / info.width));
  const bottom = Math.min(metadata.height, Math.ceil((maxY + 1) * metadata.height / info.height));
  const width = right - left;
  const height = bottom - top;
  if (width < 256 || height < 256) return null;
  return { left, top, width, height, originalWidth: metadata.width, originalHeight: metadata.height };
}

async function repairFile(filePath) {
  const bounds = await alphaBounds(filePath);
  if (!bounds) return { changed: false, bounds: null };
  const tempPath = `${filePath}.framing-repair-${process.pid}.tmp`;
  await sharp(filePath)
    .extract(bounds)
    .webp({ quality: 92, alphaQuality: 100, smartSubsample: true })
    .toFile(tempPath);
  fs.renameSync(tempPath, filePath);
  return { changed: true, bounds };
}

async function main() {
  const args = new Map(process.argv.slice(2).map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }));
  const manifest = readManifest();
  assert.equal(manifest.mode, "applied", "The image batch must already be applied before framing repair.");
  assert.equal(args.get("confirm"), confirmation, `Repair requires --confirm=${confirmation}.`);

  const files = [...new Set(manifest.tasks.flatMap((task) => [task.stageFile, task.finalFile]))];
  const repaired = [];
  for (const filePath of files) {
    assert(fs.existsSync(filePath), `Missing regenerated image: ${filePath}`);
    const result = await repairFile(filePath);
    if (result.changed) repaired.push({ filePath, bounds: result.bounds });
  }
  for (const task of manifest.tasks) task.outputHash = sha256(fs.readFileSync(task.stageFile));
  manifest.framingRepair = {
    appliedAt: new Date().toISOString(),
    alphaThreshold,
    filesScanned: files.length,
    imagesRepaired: repaired.length / 2,
    transparentMarginRemoved: true,
    paidProviderCalls: 0,
    files: repaired.map(({ filePath, bounds }) => ({ filePath: path.relative(repoRoot, filePath), bounds }))
  };
  writeManifest(manifest);
  console.log(JSON.stringify({ ok: true, batchId, filesScanned: files.length, imagesRepaired: repaired.length / 2, paidProviderCalls: 0, manifestPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
