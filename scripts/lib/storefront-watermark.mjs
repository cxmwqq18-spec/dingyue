import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);
let sharpLoader;

export const STOREFRONT_WATERMARK_VERSION = "20260802-subtle-watermark30";
export const DEFAULT_STOREFRONT_WATERMARK_OPACITY = 0.3;
export const SAMPLE_STOREFRONT_WATERMARK_OPACITIES = [0.2, 0.3, 0.4];

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

export function normalizedStorefrontWatermarkOpacity(value) {
  const parsed = Number(value);
  const opacity = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STOREFRONT_WATERMARK_OPACITY;
  return Number(clamped(opacity, 0.01, 0.5).toFixed(4));
}

async function loadSharp() {
  if (process.env.STOREFRONT_WATERMARK_DISABLE_SHARP === "1") {
    sharpLoader = null;
    return sharpLoader;
  }
  if (sharpLoader !== undefined) return sharpLoader;
  try {
    const moduleName = "sharp";
    const mod = await import(moduleName);
    const sharp = mod.default ?? mod;
    sharp.cache(false);
    sharpLoader = await sharpCanRenderSvgTextComposite(sharp) ? sharp : null;
  } catch {
    sharpLoader = null;
  }
  return sharpLoader;
}

async function sharpCanRenderSvgTextComposite(sharp) {
  try {
    const width = 240;
    const height = 120;
    const base = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: "#182235"
      }
    }).png().toBuffer();
    const watermarked = await sharp(base)
      .composite([{ input: imageWatermarkSvg({ width, height, text: "WM", opacity: DEFAULT_STOREFRONT_WATERMARK_OPACITY }), left: 0, top: 0 }])
      .png()
      .toBuffer();
    const left = await sharp(base).removeAlpha().raw().toBuffer();
    const right = await sharp(watermarked).removeAlpha().raw().toBuffer();
    if (left.length !== right.length) return false;
    return left.some((value, index) => value !== right[index]);
  } catch {
    return false;
  }
}

export function readWatermarkMarker(filePath) {
  try {
    const value = JSON.parse(fsSync.readFileSync(markerPath(filePath), "utf8"));
    if (typeof value.version === "string" && typeof value.text === "string") {
      return {
        version: value.version,
        text: value.text,
        opacity: typeof value.opacity === "number" ? value.opacity : undefined
      };
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

function hasCurrentMarker(filePath, text, options = {}) {
  const marker = readWatermarkMarker(filePath);
  const opacity = normalizedStorefrontWatermarkOpacity(options.opacity);
  return marker?.version === STOREFRONT_WATERMARK_VERSION && marker.text === text && normalizedStorefrontWatermarkOpacity(marker.opacity) === opacity;
}

function watermarkGeometry({ width, height }) {
  const shortSide = Math.min(width, height);
  const fontSize = Math.round(clamped(shortSide * 0.024, 10, 28));
  const marginX = Math.round(clamped(width * 0.022, 12, 36));
  const marginY = Math.round(clamped(height * 0.02, 10, 32));
  const shadowOffset = Math.round(clamped(shortSide * 0.002, 1, 2));
  return { fontSize, marginX, marginY, shadowOffset };
}

function imageWatermarkSvg({ width, height, text, opacity }) {
  const { fontSize, marginX, marginY, shadowOffset } = watermarkGeometry({ width, height });
  const fillOpacity = normalizedStorefrontWatermarkOpacity(opacity);
  const shadowOpacity = Number(clamped(fillOpacity * 0.75, 0.008, 0.08).toFixed(4));
  const x = width - marginX;
  const y = height - marginY;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>.wm { font-family: Arial, Helvetica, sans-serif; font-weight: 700; letter-spacing: 0; }</style>
  <text class="wm" x="${x + shadowOffset}" y="${y + shadowOffset}" text-anchor="end" dominant-baseline="text-after-edge"
    font-size="${fontSize}" fill="#000000" fill-opacity="${shadowOpacity}">${escapeXml(text)}</text>
  <text class="wm" x="${x}" y="${y}" text-anchor="end" dominant-baseline="text-after-edge"
    font-size="${fontSize}" fill="#ffffff" fill-opacity="${fillOpacity}">${escapeXml(text)}</text>
</svg>`
  );
}

export async function watermarkImageFile(filePath, text, options = {}) {
  const opacity = normalizedStorefrontWatermarkOpacity(options.opacity);
  if (!options.force && hasCurrentMarker(filePath, text, { opacity })) return { changed: false, skipped: true, filePath };
  const sharp = await loadSharp();
  if (!sharp) return watermarkImageFileWithFfmpeg(filePath, text, { ...options, opacity });
  const ext = path.extname(filePath).toLowerCase();
  const source = sharp(filePath, { animated: false }).rotate();
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) throw new Error(`watermark_image_dimensions_unavailable:${filePath}`);
  const pipeline = source.composite([{ input: imageWatermarkSvg({ width, height, text, opacity }), left: 0, top: 0 }]);
  const output = ext === ".png"
    ? await pipeline.png().toBuffer()
    : ext === ".jpg" || ext === ".jpeg"
      ? await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer()
      : ext === ".avif"
        ? await pipeline.avif({ quality: 88 }).toBuffer()
        : await pipeline.webp({ quality: 92, smartSubsample: true }).toBuffer();
  if (!options.dryRun) {
    await fs.writeFile(filePath, output);
    await writeWatermarkMarker(filePath, { version: STOREFRONT_WATERMARK_VERSION, text, opacity });
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

function assEscaped(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}");
}

function assAlphaForOpacity(opacity) {
  return Math.round(255 * (1 - normalizedStorefrontWatermarkOpacity(opacity))).toString(16).padStart(2, "0").toUpperCase();
}

function assColor(hexColor, opacity) {
  const clean = hexColor.replace(/^#/, "").padStart(6, "0").slice(0, 6);
  const rr = clean.slice(0, 2);
  const gg = clean.slice(2, 4);
  const bb = clean.slice(4, 6);
  return `&H${assAlphaForOpacity(opacity)}${bb}${gg}${rr}`;
}

function watermarkAssText({ width, height, text, opacity }) {
  const { fontSize, marginX, marginY, shadowOffset } = watermarkGeometry({ width, height });
  const fillOpacity = normalizedStorefrontWatermarkOpacity(opacity);
  const shadowOpacity = Number(clamped(fillOpacity * 0.75, 0.008, 0.08).toFixed(4));
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Watermark,Arial,${fontSize},${assColor("#ffffff", fillOpacity)},&H000000FF,${assColor("#000000", shadowOpacity)},${assColor("#000000", shadowOpacity)},-1,0,0,0,100,100,0,0,1,0,${shadowOffset},3,${marginX},${marginX},${marginY},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,9:59:59.00,Watermark,,0,0,0,,${assEscaped(text)}
`;
}

function ffmpegFilterPath(filePath) {
  return filePath.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
}

async function writeWatermarkAssFile(tempDir, params) {
  const assPath = path.join(tempDir, "watermark.ass");
  await fs.writeFile(assPath, watermarkAssText(params));
  return assPath;
}

async function watermarkImageFileWithFfmpeg(filePath, text, options = {}) {
  const opacity = normalizedStorefrontWatermarkOpacity(options.opacity);
  const ext = path.extname(filePath).toLowerCase();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "storefront-image-watermark-"));
  const outputPath = path.join(tempDir, `output${ext}`);
  try {
    const dimensions = await probeVideoDimensions(filePath);
    const assPath = await writeWatermarkAssFile(tempDir, { ...dimensions, text, opacity });
    const codecArgs = ext === ".webp"
      ? ["-c:v", "libwebp", "-quality", "92", "-compression_level", "4"]
      : ext === ".jpg" || ext === ".jpeg"
        ? ["-q:v", "2"]
        : ext === ".avif"
          ? ["-c:v", "libaom-av1", "-still-picture", "1", "-crf", "24", "-b:v", "0"]
          : [];
    await execFileAsync(
      ffmpegExecutablePath(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        filePath,
        "-vf",
        `subtitles=${ffmpegFilterPath(assPath)}`,
        "-frames:v",
        "1",
        ...codecArgs,
        outputPath
      ],
      { timeout: Number(process.env.STOREFRONT_WATERMARK_IMAGE_TIMEOUT_MS ?? 120_000), maxBuffer: 1024 * 1024 }
    );
    if (!options.dryRun) {
      await fs.copyFile(outputPath, filePath);
      await writeWatermarkMarker(filePath, { version: STOREFRONT_WATERMARK_VERSION, text, opacity });
    }
    const stat = await fs.stat(outputPath);
    return { changed: true, filePath, bytes: stat.size, ...dimensions };
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

export async function watermarkVideoFile(filePath, text, options = {}) {
  const opacity = normalizedStorefrontWatermarkOpacity(options.opacity);
  if (!options.force && hasCurrentMarker(filePath, text, { opacity })) return { changed: false, skipped: true, filePath };
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "storefront-video-watermark-"));
  const outputPath = path.join(tempDir, "output.mp4");
  try {
    const dimensions = await probeVideoDimensions(filePath);
    const assPath = await writeWatermarkAssFile(tempDir, { ...dimensions, text, opacity });
    await execFileAsync(
      ffmpegExecutablePath(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        filePath,
        "-filter_complex",
        `[0:v]subtitles=${ffmpegFilterPath(assPath)},format=yuv420p[v]`,
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
      await writeWatermarkMarker(filePath, { version: STOREFRONT_WATERMARK_VERSION, text, opacity });
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
