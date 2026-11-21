import "server-only";

import crypto from "node:crypto";
import { access, mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

/**
 * Web playback copies for generated videos.
 *
 * The library plays a 720p / ~3 Mbps copy while downloads keep the untouched
 * original render. A copy is generated once per source file, cached next to
 * the original, and invalidated when the source changes. Only two ffmpeg runs
 * are allowed at a time so a burst of card clicks cannot starve generation.
 */

const execFileAsync = promisify(execFile);
const inflight = new Map<string, Promise<{ filePath: string; size: number }>>();
const MAX_CONCURRENT_TRANSCODES = 2;
let activeTranscodes = 0;
const waitingTranscodes: Array<() => void> = [];

function fileKey(filePath: string): string {
  return crypto.createHash("sha256").update(filePath).digest("hex").slice(0, 16);
}

/**
 * Preview artifacts (720p copy + card poster) live in their own directory so
 * nginx can read them without opening the private render tree. The directory
 * is created world-readable; the originals stay owner-only.
 */
export function previewRoot(): string {
  const configured = process.env.AIVIDEOSUGC_PREVIEW_ROOT?.trim();
  if (configured) return path.resolve(configured);
  if (process.env.NODE_ENV === "production" && process.cwd().includes(`${path.sep}releases${path.sep}`)) {
    return path.resolve(process.cwd(), "..", "..", "data", "aidreamcapes-workspace-preview");
  }
  return path.join(process.cwd(), "data", "aidreamcapes-workspace-preview");
}

export function webVideoPathFor(filePath: string): string {
  return path.join(previewRoot(), `${fileKey(filePath)}.web.mp4`);
}

export function webPosterPathFor(filePath: string): string {
  return path.join(previewRoot(), `${fileKey(filePath)}.poster.jpg`);
}

/** Internal nginx path for a preview file, when the prefix is configured. */
export function previewXAccelPathFor(filePath: string | undefined): string | undefined {
  const configured = process.env.AIVIDEOSUGC_PREVIEW_X_ACCEL_PREFIX?.trim();
  if (!configured || !filePath) return undefined;
  const root = previewRoot();
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  const prefix = configured.endsWith("/") ? configured : `${configured}/`;
  return `${prefix}${relative.split(path.sep).map(encodeURIComponent).join("/")}`;
}

async function acquireTranscodeSlot(): Promise<() => void> {
  if (activeTranscodes < MAX_CONCURRENT_TRANSCODES) {
    activeTranscodes += 1;
    return release;
  }
  await new Promise<void>((resolve) => waitingTranscodes.push(resolve));
  activeTranscodes += 1;
  return release;
}

function release(): void {
  activeTranscodes = Math.max(0, activeTranscodes - 1);
  const next = waitingTranscodes.shift();
  if (next) next();
}

async function ffmpegExecutableCandidates(): Promise<string[]> {
  const candidates = [
    process.env.CUSTOMER_ASSET_FFMPEG_BIN?.trim() ?? "",
    process.env.AIVIDEOSUGC_FFMPEG_BIN?.trim() ?? "",
    typeof ffmpegPath === "string" && ffmpegPath ? ffmpegPath : "",
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "ffmpeg"
  ].filter(Boolean);
  const available: string[] = [];
  for (const candidate of Array.from(new Set(candidates))) {
    if (!path.isAbsolute(candidate)) {
      available.push(candidate);
      continue;
    }
    try {
      await access(candidate);
      available.push(candidate);
    } catch {
      // Try the next location. A bundled ffmpeg can move between builds.
    }
  }
  if (available.length) return available;
  throw new Error("ffmpeg_static_unavailable");
}

async function runFfmpeg(args: string[], timeout: number): Promise<void> {
  const candidates = await ffmpegExecutableCandidates();
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, args, { timeout, maxBuffer: 1024 * 1024 });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ffmpeg_static_unavailable");
}

async function freshSidecar(sourcePath: string, sidecarPath: string): Promise<{ filePath: string; size: number } | null> {
  const [source, sidecar] = await Promise.all([stat(sourcePath), stat(sidecarPath).catch(() => null)]);
  if (!sidecar?.isFile() || sidecar.size === 0 || sidecar.mtimeMs < source.mtimeMs) return null;
  return { filePath: sidecarPath, size: sidecar.size };
}

/**
 * Cached 720p copy used by in-app playback. The original render stays the only
 * download source.
 */
export async function resolveWebVideo(sourcePath: string): Promise<{ filePath: string; size: number }> {
  const cached = await freshSidecar(sourcePath, webVideoPathFor(sourcePath));
  if (cached) return cached;
  const target = webVideoPathFor(sourcePath);
  const pending = inflight.get(target);
  if (pending) return pending;
  const promise = (async () => {
    const releaseSlot = await acquireTranscodeSlot();
    try {
      const tmpPath = `${target}.${process.pid}.${Date.now()}.tmp.mp4`;
      await mkdir(path.dirname(target), { recursive: true, mode: 0o755 });
      try {
        await runFfmpeg([
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          sourcePath,
          "-map",
          "0:v:0",
          "-map",
          "0:a?",
          "-c:v",
          "libx264",
          "-preset",
          process.env.AIVIDEOSUGC_WEB_VIDEO_PRESET?.trim() || "veryfast",
          "-crf",
          process.env.AIVIDEOSUGC_WEB_VIDEO_CRF?.trim() || "25",
          "-maxrate",
          process.env.AIVIDEOSUGC_WEB_VIDEO_MAXRATE?.trim() || "3000k",
          "-bufsize",
          process.env.AIVIDEOSUGC_WEB_VIDEO_BUFSIZE?.trim() || "6000k",
          "-vf",
          process.env.AIVIDEOSUGC_WEB_VIDEO_FILTER?.trim() || "scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          process.env.AIVIDEOSUGC_WEB_VIDEO_AUDIO_BITRATE?.trim() || "128k",
          "-ac",
          "2",
          "-movflags",
          "+faststart",
          tmpPath
        ], 180_000);
        await rename(tmpPath, target);
      } catch (error) {
        await unlink(tmpPath).catch(() => {});
        throw error;
      }
      const result = await stat(target);
      if (!result.isFile() || result.size === 0) throw new Error("web_transcode_empty");
      return { filePath: target, size: result.size };
    } finally {
      releaseSlot();
    }
  })();
  inflight.set(target, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(target);
  }
}

/** Cached first-frame JPEG for video cards; shared naming with the asset route. */
export async function resolveVideoPosterFile(sourcePath: string): Promise<{ filePath: string; size: number }> {
  const cached = await freshSidecar(sourcePath, webPosterPathFor(sourcePath));
  if (cached) return cached;
  const target = webPosterPathFor(sourcePath);
  const pending = inflight.get(target);
  if (pending) return pending;
  const promise = (async () => {
    const releaseSlot = await acquireTranscodeSlot();
    try {
      const tmpPath = `${target}.${process.pid}.${Date.now()}.tmp.jpg`;
      await mkdir(path.dirname(target), { recursive: true, mode: 0o755 });
      try {
        await runFfmpeg([
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-ss",
          "0.1",
          "-i",
          sourcePath,
          "-frames:v",
          "1",
          "-vf",
          "scale=720:-2:force_original_aspect_ratio=decrease",
          "-q:v",
          "4",
          tmpPath
        ], 30_000);
        await rename(tmpPath, target);
      } catch (error) {
        await unlink(tmpPath).catch(() => {});
        throw error;
      }
      const result = await stat(target);
      if (!result.isFile() || result.size === 0) throw new Error("poster_empty");
      return { filePath: target, size: result.size };
    } finally {
      releaseSlot();
    }
  })();
  inflight.set(target, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(target);
  }
}

/** Retention and delete flows remove the generated sidecars with the source. */
export async function removeVideoSidecars(sourcePath: string): Promise<void> {
  await Promise.all([
    unlink(webVideoPathFor(sourcePath)).catch(() => {}),
    unlink(webPosterPathFor(sourcePath)).catch(() => {})
  ]);
}
