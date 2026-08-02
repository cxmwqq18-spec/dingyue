import "server-only";
import { execFile } from "child_process";
import { accessSync, constants } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export const MEDIA_WATERMARK_VERSION = "20260802-subtle-watermark1";
export const DEFAULT_MEDIA_WATERMARK_OPACITY = 0.05;

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

function normalizedWatermarkOpacity(value: unknown): number {
  const parsed = Number(value);
  const opacity = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MEDIA_WATERMARK_OPACITY;
  return Number(clamped(opacity, 0.01, 0.12).toFixed(4));
}

async function sharpFactory(): Promise<typeof import("sharp") | undefined> {
  try {
    const moduleName = "sharp";
    const mod = await import(/* webpackIgnore: true */ moduleName);
    return (mod.default ?? mod) as typeof import("sharp");
  } catch {
    return undefined;
  }
}

function watermarkGeometry(params: { width: number; height: number }): {
  fontSize: number;
  marginX: number;
  marginY: number;
  shadowOffset: number;
} {
  const shortSide = Math.min(params.width, params.height);
  return {
    fontSize: Math.round(clamped(shortSide * 0.024, 10, 28)),
    marginX: Math.round(clamped(params.width * 0.022, 12, 36)),
    marginY: Math.round(clamped(params.height * 0.02, 10, 32)),
    shadowOffset: Math.round(clamped(shortSide * 0.002, 1, 2))
  };
}

function imageWatermarkSvg(params: { width: number; height: number; text: string; opacity?: number }): Buffer {
  const { fontSize, marginX, marginY, shadowOffset } = watermarkGeometry(params);
  const opacity = normalizedWatermarkOpacity(params.opacity);
  const shadowOpacity = Number(clamped(opacity * 0.75, 0.008, 0.08).toFixed(4));
  const x = params.width - marginX;
  const y = params.height - marginY;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}">
  <style>
    .wm { font-family: Arial, Helvetica, sans-serif; font-weight: 700; letter-spacing: 0; }
  </style>
  <text class="wm" x="${x + shadowOffset}" y="${y + shadowOffset}" text-anchor="end" dominant-baseline="text-after-edge"
    font-size="${fontSize}" fill="#000000" fill-opacity="${shadowOpacity}">${escapeXml(params.text)}</text>
  <text class="wm" x="${x}" y="${y}" text-anchor="end" dominant-baseline="text-after-edge"
    font-size="${fontSize}" fill="#ffffff" fill-opacity="${opacity}">${escapeXml(params.text)}</text>
</svg>`
  );
}

export async function watermarkImageBytes(params: {
  bytes: Buffer;
  mimeType: string;
  text: string;
  opacity?: number;
}): Promise<MediaWatermarkResult> {
  const sharp = await sharpFactory();
  if (!sharp) return watermarkImageBytesWithFfmpeg(params);
  const source = sharp(params.bytes, { animated: false }).rotate();
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) throw new Error("watermark_image_dimensions_unavailable");

  const pipeline = source.composite([{ input: imageWatermarkSvg({ width, height, text: params.text, opacity: params.opacity }), left: 0, top: 0 }]);
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

function assEscaped(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
}

function assAlphaForOpacity(opacity: number | undefined): string {
  return Math.round(255 * (1 - normalizedWatermarkOpacity(opacity))).toString(16).padStart(2, "0").toUpperCase();
}

function assColor(hexColor: string, opacity: number | undefined): string {
  const clean = hexColor.replace(/^#/, "").padStart(6, "0").slice(0, 6);
  const rr = clean.slice(0, 2);
  const gg = clean.slice(2, 4);
  const bb = clean.slice(4, 6);
  return `&H${assAlphaForOpacity(opacity)}${bb}${gg}${rr}`;
}

function watermarkAssText(params: { width: number; height: number; text: string; opacity?: number }): string {
  const { fontSize, marginX, marginY, shadowOffset } = watermarkGeometry(params);
  const opacity = normalizedWatermarkOpacity(params.opacity);
  const shadowOpacity = Number(clamped(opacity * 0.75, 0.008, 0.08).toFixed(4));
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${params.width}
PlayResY: ${params.height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Watermark,Arial,${fontSize},${assColor("#ffffff", opacity)},&H000000FF,${assColor("#000000", shadowOpacity)},${assColor("#000000", shadowOpacity)},-1,0,0,0,100,100,0,0,1,0,${shadowOffset},3,${marginX},${marginX},${marginY},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,9:59:59.00,Watermark,,0,0,0,,${assEscaped(params.text)}
`;
}

function ffmpegFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

async function writeWatermarkAssFile(tempDir: string, params: { width: number; height: number; text: string; opacity?: number }): Promise<string> {
  const assPath = path.join(tempDir, "watermark.ass");
  await writeFile(assPath, watermarkAssText(params));
  return assPath;
}

function imageExtensionForMimeType(mimeType: string): { ext: string; outputMimeType: string; codecArgs: string[] } {
  const clean = mimeType.split(";")[0]?.trim().toLowerCase() || "image/webp";
  if (clean.includes("png")) return { ext: ".png", outputMimeType: "image/png", codecArgs: [] };
  if (clean.includes("jpeg") || clean.includes("jpg")) return { ext: ".jpg", outputMimeType: "image/jpeg", codecArgs: ["-q:v", "2"] };
  if (clean.includes("avif")) return { ext: ".avif", outputMimeType: "image/avif", codecArgs: ["-c:v", "libaom-av1", "-still-picture", "1", "-crf", "24", "-b:v", "0"] };
  return { ext: ".webp", outputMimeType: "image/webp", codecArgs: ["-c:v", "libwebp", "-quality", "92", "-compression_level", "4"] };
}

async function watermarkImageBytesWithFfmpeg(params: {
  bytes: Buffer;
  mimeType: string;
  text: string;
  opacity?: number;
}): Promise<MediaWatermarkResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dreamshoot-image-watermark-"));
  const imageType = imageExtensionForMimeType(params.mimeType);
  const inputPath = path.join(tempDir, `input${imageType.ext}`);
  const outputPath = path.join(tempDir, `output${imageType.ext}`);
  try {
    await writeFile(inputPath, params.bytes);
    const dimensions = await probeVideoDimensions(inputPath);
    const assPath = await writeWatermarkAssFile(tempDir, { ...dimensions, text: params.text, opacity: params.opacity });
    await execFileAsync(
      ffmpegExecutablePath(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-vf",
        `subtitles=${ffmpegFilterPath(assPath)}`,
        "-frames:v",
        "1",
        ...imageType.codecArgs,
        outputPath
      ],
      { timeout: Number(process.env.CUSTOMER_ASSET_WATERMARK_IMAGE_TIMEOUT_MS ?? 120_000), maxBuffer: 1024 * 1024 }
    );
    return { bytes: await readFile(outputPath), mimeType: imageType.outputMimeType };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

export async function watermarkVideoBytes(params: {
  bytes: Buffer;
  mimeType: string;
  text: string;
  opacity?: number;
}): Promise<MediaWatermarkResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dreamshoot-video-watermark-"));
  const inputPath = path.join(tempDir, "input.mp4");
  const outputPath = path.join(tempDir, "output.mp4");
  try {
    await writeFile(inputPath, params.bytes);
    const dimensions = await probeVideoDimensions(inputPath);
    const assPath = await writeWatermarkAssFile(tempDir, { ...dimensions, text: params.text, opacity: params.opacity });
    await execFileAsync(
      ffmpegExecutablePath(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-filter_complex",
        `[0:v]subtitles=${ffmpegFilterPath(assPath)},format=yuv420p[v]`,
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
  opacity?: number;
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
