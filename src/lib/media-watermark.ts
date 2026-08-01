import "server-only";
import { execFile } from "child_process";
import { accessSync, constants } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export const MEDIA_WATERMARK_VERSION = "20260801-storefront-watermark1";

export type MediaWatermarkResult = {
  bytes: Buffer;
  mimeType: string;
};

export function storefrontWatermarkTextForSite(siteId: string | undefined): string | undefined {
  if (siteId === "site_dreamshoot") return "myDreamshoots.com";
  if (siteId === "site_aidreamcapes") return "Aidreamcapes.com";
  return undefined;
}

export function siteIdFromCustomerAssetStorageKey(storageKey: string): string | undefined {
  const parts = storageKey.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^customer-assets\//, "").split("/");
  return parts[0] === "sites" ? parts[1] : undefined;
}

export function storefrontWatermarkTextForCustomerAsset(storageKey: string): string | undefined {
  return storefrontWatermarkTextForSite(siteIdFromCustomerAssetStorageKey(storageKey));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clamped(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function sharpFactory() {
  const moduleName = "sharp";
  const mod = await import(/* webpackIgnore: true */ moduleName);
  return (mod.default ?? mod) as typeof import("sharp");
}

function imageWatermarkSvg(params: { width: number; height: number; text: string }): Buffer {
  const shortSide = Math.min(params.width, params.height);
  const fontSize = Math.round(clamped(shortSide * 0.045, 18, 54));
  const marginX = Math.round(clamped(params.width * 0.026, 18, 56));
  const marginY = Math.round(clamped(params.height * 0.024, 16, 48));
  const strokeWidth = Math.max(2, Math.round(fontSize * 0.08));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}">
  <style>
    .wm { font-family: Arial, Helvetica, sans-serif; font-weight: 700; letter-spacing: 0; }
  </style>
  <text class="wm" x="${params.width - marginX}" y="${params.height - marginY}" text-anchor="end" dominant-baseline="text-after-edge"
    font-size="${fontSize}" fill="#ffffff" fill-opacity="0.76" stroke="#000000" stroke-opacity="0.42" stroke-width="${strokeWidth}" paint-order="stroke">${escapeXml(params.text)}</text>
</svg>`
  );
}

export async function watermarkImageBytes(params: {
  bytes: Buffer;
  mimeType: string;
  text: string;
}): Promise<MediaWatermarkResult> {
  const sharp = await sharpFactory();
  const source = sharp(params.bytes, { animated: false }).rotate();
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) throw new Error("watermark_image_dimensions_unavailable");

  const pipeline = source.composite([{ input: imageWatermarkSvg({ width, height, text: params.text }), left: 0, top: 0 }]);
  const mimeType = params.mimeType.split(";")[0]?.trim().toLowerCase() || "image/webp";
  if (mimeType.includes("png")) {
    return { bytes: await pipeline.png().toBuffer(), mimeType: "image/png" };
  }
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return { bytes: await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer(), mimeType: "image/jpeg" };
  }
  if (mimeType.includes("avif")) {
    return { bytes: await pipeline.avif({ quality: 88 }).toBuffer(), mimeType: "image/avif" };
  }
  if (mimeType.includes("webp") || mimeType.startsWith("image/")) {
    return { bytes: await pipeline.webp({ quality: 92, smartSubsample: true }).toBuffer(), mimeType: "image/webp" };
  }
  throw new Error(`watermark_unsupported_image_mime_${mimeType || "unknown"}`);
}

function ffmpegExecutablePath(): string {
  const explicit = process.env.FFMPEG_PATH?.trim() || process.env.FFMPEG_BINARY?.trim() || process.env.FFMPEG_BIN?.trim() || process.env.CUSTOMER_ASSET_FFMPEG_BIN?.trim();
  if (explicit) return explicit;
  const candidates = [
    typeof ffmpegPath === "string" ? ffmpegPath : "",
    path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "ffmpeg"
  ].filter(Boolean);
  for (const candidate of Array.from(new Set(candidates))) {
    if (!path.isAbsolute(candidate)) return candidate;
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Next can rewrite ffmpeg-static to a non-copied route chunk path such as .next-dev/server/vendor-chunks/ffmpeg.
    }
  }
  return path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

async function probeVideoDimensions(inputPath: string): Promise<{ width: number; height: number }> {
  let output = "";
  try {
    await execFileAsync(ffmpegExecutablePath(), ["-hide_banner", "-i", inputPath], { timeout: 20_000, maxBuffer: 1024 * 1024 });
  } catch (error) {
    output = [
      typeof (error as { stdout?: unknown }).stdout === "string" ? (error as { stdout: string }).stdout : "",
      typeof (error as { stderr?: unknown }).stderr === "string" ? (error as { stderr: string }).stderr : ""
    ].join("\n");
  }
  const match = output.match(/Video:\s[^,\n]+(?:,[^,\n]+)*,\s*(\d{2,5})x(\d{2,5})[\s,]/);
  const width = Number(match?.[1] ?? 0);
  const height = Number(match?.[2] ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("watermark_video_dimensions_unavailable");
  }
  return { width, height };
}

async function videoOverlayPng(params: { width: number; height: number; text: string }): Promise<Buffer> {
  const sharp = await sharpFactory();
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

export async function watermarkVideoBytes(params: {
  bytes: Buffer;
  mimeType: string;
  text: string;
}): Promise<MediaWatermarkResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dreamshoot-video-watermark-"));
  const inputPath = path.join(tempDir, "input.mp4");
  const overlayPath = path.join(tempDir, "watermark.png");
  const outputPath = path.join(tempDir, "output.mp4");
  try {
    await writeFile(inputPath, params.bytes);
    const dimensions = await probeVideoDimensions(inputPath);
    await writeFile(overlayPath, await videoOverlayPng({ ...dimensions, text: params.text }));
    await execFileAsync(
      ffmpegExecutablePath(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
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
        process.env.CUSTOMER_ASSET_WATERMARK_VIDEO_PRESET?.trim() || "veryfast",
        "-crf",
        process.env.CUSTOMER_ASSET_WATERMARK_VIDEO_CRF?.trim() || "22",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        outputPath
      ],
      { timeout: Number(process.env.CUSTOMER_ASSET_WATERMARK_VIDEO_TIMEOUT_MS ?? 180_000), maxBuffer: 1024 * 1024 }
    );
    const bytes = await readFile(outputPath);
    if (!bytes.length) throw new Error("watermark_video_empty_output");
    return { bytes, mimeType: "video/mp4" };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

export async function watermarkMediaBytes(params: {
  bytes: Buffer;
  mimeType: string;
  text: string;
}): Promise<MediaWatermarkResult> {
  const mimeType = params.mimeType.split(";")[0]?.trim().toLowerCase() || "";
  if (mimeType.startsWith("image/")) return watermarkImageBytes(params);
  if (mimeType.startsWith("video/")) return watermarkVideoBytes(params);
  throw new Error(`watermark_unsupported_media_mime_${mimeType || "unknown"}`);
}

export async function generateVideoPosterBytes(params: {
  bytes: Buffer;
  text?: string;
}): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dreamshoot-video-poster-"));
  const inputPath = path.join(tempDir, "input.mp4");
  const posterPath = path.join(tempDir, "poster.jpg");
  try {
    await writeFile(inputPath, params.bytes);
    await execFileAsync(
      ffmpegExecutablePath(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        "0.1",
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        "scale=960:-2:force_original_aspect_ratio=decrease",
        "-q:v",
        "4",
        posterPath
      ],
      { timeout: 30_000, maxBuffer: 1024 * 1024 }
    );
    const poster = await readFile(posterPath);
    if (!params.text) return poster;
    return (await watermarkImageBytes({ bytes: poster, mimeType: "image/jpeg", text: params.text })).bytes;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

export const generateWatermarkedVideoPosterBytes = generateVideoPosterBytes;
