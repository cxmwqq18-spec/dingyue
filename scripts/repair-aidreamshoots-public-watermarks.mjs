#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import {
  readWatermarkMarker,
  watermarkMediaFile
} from "./lib/storefront-watermark.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const targetRoot = path.resolve(repoRoot, "public/assets/sites/site_aidreamshoots");
const targetText = "Aidreamshoots.eu";
const expectedMarkerText = targetText;
const apply = process.argv.includes("--apply");
const confirmation = "--confirm=aidreamshoots-brand-isolation";
const reportArg = process.argv.find((arg) => arg.startsWith("--report="))?.slice("--report=".length);
const imageExtensions = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);
const videoExtensions = new Set([".m4v", ".mov", ".mp4", ".webm"]);

if (apply && !process.argv.includes(confirmation)) {
  throw new Error(`apply requires ${confirmation}`);
}

function isMediaFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return imageExtensions.has(extension) || videoExtensions.has(extension);
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

async function walkMediaFiles(root) {
  const result = [];
  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(filePath);
      } else if (entry.isFile() && isMediaFile(filePath) && !filePath.includes(`${path.sep}brand${path.sep}`)) {
        result.push(filePath);
      }
    }
  }
  await visit(root);
  return result.sort();
}

function outputPipeline(image, extension) {
  if (extension === ".png") return image.png();
  if (extension === ".jpg" || extension === ".jpeg") return image.jpeg({ quality: 92, mozjpeg: true });
  if (extension === ".avif") return image.avif({ quality: 88 });
  return image.webp({ quality: 92, smartSubsample: true });
}

async function redactLegacyImageWatermark(filePath, temporaryDirectory) {
  const extension = path.extname(filePath).toLowerCase();
  const source = sharp(filePath, { animated: false }).rotate();
  const metadata = await source.metadata();
  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  if (width <= 0 || height <= 0) throw new Error(`image_dimensions_unavailable:${filePath}`);

  // The legacy source watermark is anchored in the bottom-right corner. A
  // small bottom crop removes it before the target storefront watermark is
  // rendered; the storefront already uses object-fit cover for these cards.
  const cropHeight = Math.max(24, Math.round(height * 0.06));
  const output = await outputPipeline(
    source.extract({ left: 0, top: 0, width, height: height - cropHeight }).resize(width, height, { fit: "fill" }),
    extension
  ).toBuffer();
  const temporaryPath = path.join(temporaryDirectory, `${path.basename(filePath)}.redacted`);
  await fs.writeFile(temporaryPath, output);
  await fs.rename(temporaryPath, filePath);
  return { width, height, cropHeight };
}

async function redactLegacyVideoWatermark(filePath, temporaryDirectory) {
  if (!ffmpegPath) throw new Error("ffmpeg_unavailable");
  const temporaryPath = path.join(temporaryDirectory, `${path.basename(filePath)}.redacted${path.extname(filePath)}`);
  await execFileAsync(ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    filePath,
    "-vf",
    "crop=iw:trunc(ih*0.94/2)*2:0:0,scale=iw:trunc(ih/2)*2:flags=lanczos",
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    temporaryPath
  ], { timeout: 180_000, maxBuffer: 2 * 1024 * 1024 });
  await fs.rename(temporaryPath, filePath);
  return { cropRatio: 0.06 };
}

async function writeReport(report) {
  if (!reportArg) return report;
  const reportPath = path.resolve(repoRoot, reportArg);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify({ ...report, reportPath }, null, 2)}\n`, { mode: 0o600 });
  return { ...report, reportPath };
}

async function main() {
  if (!fsSync.existsSync(targetRoot)) throw new Error(`target_asset_root_missing:${targetRoot}`);
  const mediaFiles = await walkMediaFiles(targetRoot);
  const plan = mediaFiles.map((filePath) => {
    const marker = readWatermarkMarker(filePath);
    return {
      filePath,
      relativePath: relativePath(filePath),
      marker,
      legacyWatermark: Boolean(marker?.text && marker.text !== expectedMarkerText),
      needsWatermark: marker?.text !== expectedMarkerText
    };
  }).filter((item) => item.needsWatermark);

  const summary = {
    ok: true,
    mode: apply ? "applied" : "dry-run",
    targetRoot: relativePath(targetRoot),
    targetText,
    discovered: mediaFiles.length,
    planned: plan.length,
    legacyWatermarkFiles: plan.filter((item) => item.legacyWatermark).length,
    missingMarkerFiles: plan.filter((item) => !item.marker).length,
    redactedImages: 0,
    redactedVideos: 0,
    watermarked: 0,
    failures: [],
    files: plan.map(({ relativePath: filePath, marker, legacyWatermark }) => ({ filePath, marker, legacyWatermark }))
  };

  if (!apply) return writeReport(summary);

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "aidreamshoots-watermark-")).catch(() => null);
  if (!temporaryDirectory) throw new Error("temporary_directory_unavailable");
  try {
    for (const item of plan) {
      try {
        const extension = path.extname(item.filePath).toLowerCase();
        // Mirrored production media may be checked out read-only. This chmod
        // is limited to the explicit AIdreamshoots target namespace.
        await fs.chmod(item.filePath, 0o644);
        if (item.legacyWatermark) {
          if (videoExtensions.has(extension)) {
            await redactLegacyVideoWatermark(item.filePath, temporaryDirectory);
            summary.redactedVideos += 1;
          } else {
            await redactLegacyImageWatermark(item.filePath, temporaryDirectory);
            summary.redactedImages += 1;
          }
        }
        await watermarkMediaFile(item.filePath, targetText, { force: true });
        summary.watermarked += 1;
      } catch (error) {
        summary.ok = false;
        summary.failures.push({ filePath: item.relativePath, error: error instanceof Error ? error.message : String(error) });
      }
    }
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }

  return writeReport(summary);
}

main()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
