import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
sharp.cache(false);

export const STOREFRONT_WATERMARK_VERSION = "20260801-storefront-watermark1";

const imageExtensions = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);
const videoExtensions = new Set([".m4v", ".mov", ".mp4", ".webm"]);

export function isWatermarkableMediaPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return imageExtensions.has(ext) || videoExtensions.has(ext);
}

export function watermarkTextForPublicPath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("/public/assets/dreamshoot/brand/")) return "";
  if (normalized.includes("/public/assets/sites/site_aidreamcapes/brand/")) return "";
  if (normalized.includes("/public/assets/sites/site_aidreamcapes_eu/brand/")) return "";
  if (normalized.includes("/public/assets/sites/site_aidreamcapes_xby/brand/")) return "";
  if (normalized.includes("/public/assets/sites/site_aidreamshoots/brand/")) return "";
  if (normalized.includes("/public/assets/sites/site_mydreamshoots_xby/brand/")) return "";
  if (normalized.includes("/public/assets/dreamshoot/")) return "myDreamshoots.com";
  if (normalized.includes("/public/assets/sites/site_aidreamcapes/")) return "Aidreamcapes.com";
  if (normalized.includes("/public/assets/sites/site_aidreamcapes_eu/")) return "Aidreamcapes.eu";
  if (normalized.includes("/public/assets/sites/site_aidreamcapes_xby/")) return "Aidreamcapes.eu";
  if (normalized.includes("/public/assets/sites/site_aidreamshoots/")) return "Aidreamshoots.eu";
  if (normalized.includes("/public/assets/sites/site_mydreamshoots_xby/")) return "Aidreamshoots.eu";
  return "";
}

function markerPath(filePath) {
  return `${filePath}.watermark.json`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clamped(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function readWatermarkMarker(filePath) {
  try {
    const value = JSON.parse(fsSync.readFileSync(markerPath(filePath), "utf8"));
    if (typeof value.version === "string" && typeof value.text === "string") {
      return { version: value.version, text: value.text };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function writeWatermarkMarker(filePath, marker) {
  await fs.writeFile(markerPath(filePath), `${JSON.stringify({
    ...marker,
    writtenAt: new Date().toISOString()
  }, null, 2)}\n`);
}

function hasCurrentMarker(filePath, text) {
  const marker = readWatermarkMarker(filePath);
  return marker?.version === STOREFRONT_WATERMARK_VERSION && marker.text === text;
}

function imageWatermarkSvg({ width, height, text }) {
  const shortSide = Math.min(width, height);
  const fontSize = Math.round(clamped(shortSide * 0.045, 18, 54));
  const marginX = Math.round(clamped(width * 0.026, 18, 56));
  const marginY = Math.round(clamped(height * 0.024, 16, 48));
  const strokeWidth = Math.max(2, Math.round(fontSize * 0.08));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>.wm { font-family: Arial, Helvetica, sans-serif; font-weight: 700; letter-spacing: 0; }</style>
  <text class="wm" x="${width - marginX}" y="${height - marginY}" text-anchor="end" dominant-baseline="text-after-edge"
    font-size="${fontSize}" fill="#ffffff" fill-opacity="0.76" stroke="#000000" stroke-opacity="0.42" stroke-width="${strokeWidth}" paint-order="stroke">${escapeXml(text)}</text>
</svg>`
  );
}

export async function watermarkImageFile(filePath, text, options = {}) {
  if (!options.force && hasCurrentMarker(filePath, text)) return { changed: false, skipped: true, filePath };
  const ext = path.extname(filePath).toLowerCase();
  const source = sharp(filePath, { animated: false }).rotate();
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) throw new Error(`watermark_image_dimensions_unavailable:${filePath}`);
  const pipeline = source.composite([{ input: imageWatermarkSvg({ width, height, text }), left: 0, top: 0 }]);
  const output = ext === ".png"
    ? await pipeline.png().toBuffer()
    : ext === ".jpg" || ext === ".jpeg"
      ? await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer()
      : ext === ".avif"
        ? await pipeline.avif({ quality: 88 }).toBuffer()
        : await pipeline.webp({ quality: 92, smartSubsample: true }).toBuffer();
  if (!options.dryRun) {
    await fs.writeFile(filePath, output);
    await writeWatermarkMarker(filePath, { version: STOREFRONT_WATERMARK_VERSION, text });
  }
  return { changed: true, filePath, bytes: output.length, width, height };
}

function ffmpegExecutablePath() {
  const explicit = process.env.FFMPEG_PATH?.trim() || process.env.FFMPEG_BINARY?.trim() || process.env.FFMPEG_BIN?.trim();
  if (explicit) return explicit;
  return typeof ffmpegPath === "string" && ffmpegPath
    ? ffmpegPath
    : path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

async function probeVideoDimensions(inputPath) {
  let output = "";
  try {
    await execFileAsync(ffmpegExecutablePath(), ["-hide_banner", "-i", inputPath], { timeout: 20_000, maxBuffer: 1024 * 1024 });
  } catch (error) {
    output = [
      typeof error.stdout === "string" ? error.stdout : "",
      typeof error.stderr === "string" ? error.stderr : ""
    ].join("\n");
  }
  const match = output.match(/Video:\s[^,\n]+(?:,[^,\n]+)*,\s*(\d{2,5})x(\d{2,5})[\s,]/);
  const width = Number(match?.[1] ?? 0);
  const height = Number(match?.[2] ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`watermark_video_dimensions_unavailable:${inputPath}`);
  }
  return { width, height };
}

async function videoOverlayPng(params) {
  return sharp({
    create: {
      width: params.width,
      height: params.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .png()
    .composite([{ input: imageWatermarkSvg(params), left: 0, top: 0 }])
    .png()
    .toBuffer();
}

export async function watermarkVideoFile(filePath, text, options = {}) {
  if (!options.force && hasCurrentMarker(filePath, text)) return { changed: false, skipped: true, filePath };
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "storefront-video-watermark-"));
  const overlayPath = path.join(tempDir, "watermark.png");
  const outputPath = path.join(tempDir, "output.mp4");
  try {
    const dimensions = await probeVideoDimensions(filePath);
    await fs.writeFile(overlayPath, await videoOverlayPng({ ...dimensions, text }));
    await execFileAsync(
      ffmpegExecutablePath(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        filePath,
        "-i",
        overlayPath,
        "-filter_complex",
        "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]",
        "-map",
        "[v]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        process.env.STOREFRONT_WATERMARK_VIDEO_PRESET?.trim() || "veryfast",
        "-crf",
        process.env.STOREFRONT_WATERMARK_VIDEO_CRF?.trim() || "22",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        outputPath
      ],
      { timeout: Number(process.env.STOREFRONT_WATERMARK_VIDEO_TIMEOUT_MS ?? 180_000), maxBuffer: 1024 * 1024 }
    );
    if (!options.dryRun) {
      await fs.copyFile(outputPath, filePath);
      await writeWatermarkMarker(filePath, { version: STOREFRONT_WATERMARK_VERSION, text });
    }
    const stat = await fs.stat(outputPath);
    return { changed: true, filePath, bytes: stat.size, ...dimensions };
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

export async function watermarkMediaFile(filePath, text, options = {}) {
  const ext = path.extname(filePath).toLowerCase();
  if (imageExtensions.has(ext)) return watermarkImageFile(filePath, text, options);
  if (videoExtensions.has(ext)) return watermarkVideoFile(filePath, text, options);
  return { changed: false, skipped: true, filePath, reason: "unsupported_extension" };
}
