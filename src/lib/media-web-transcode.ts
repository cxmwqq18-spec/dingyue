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
 * The library card stage plays a 480p / ~1.2 Mbps preview copy; fullscreen and
 * the detail view stream the video at its generated quality — small originals
 * play untouched (1080p stays 1080p), oversized sources get one web-optimised
 * copy capped at 1080p. Downloads keep the untouched original render. Copies
 * are cached next to the original and invalidated when the source changes.
 * Completion-time prewarming (AIVIDEOSUGC_PREWARM_MEDIA=1) builds the preview
 * copy and poster when the video finishes so first playback never waits on
 * ffmpeg; only AIVIDEOSUGC_TRANSCODE_CONCURRENCY ffmpeg runs are allowed at a
 * time so a burst of card clicks cannot starve generation.
 */

const execFileAsync = promisify(execFile);
const inflight = new Map<string, Promise<{ filePath: string; size: number }>>();
const MAX_CONCURRENT_TRANSCODES = Math.max(1, Math.trunc(Number(process.env.AIVIDEOSUGC_TRANSCODE_CONCURRENCY?.trim()) || 2));
/** Sources at or under this size stream as-is for fullscreen/detail playback. */
const WEB_COPY_MAX_SOURCE_BYTES = Math.max(1, Math.trunc(Number(process.env.AIVIDEOSUGC_WEB_COPY_MAX_SOURCE_BYTES?.trim()) || 80 * 1024 * 1024));
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

/** Light 480p card-stage copy, cached next to the 720p one. */
export function previewVideoPathFor(filePath: string): string {
  return path.join(previewRoot(), `${fileKey(filePath)}.preview.mp4`);
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

/** Source dimensions via the stream info ffmpeg prints on a bare -i probe. */
async function sourceVideoDimensions(sourcePath: string): Promise<{ width: number; height: number } | null> {
  const candidates = await ffmpegExecutableCandidates();
  let lastError: unknown;
  for (const candidate of candidates) {
    if (!path.isAbsolute(candidate)) break;
    try {
      await execFileAsync(candidate, ["-hide_banner", "-i", sourcePath], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    } catch (error) {
      // A bare -i probe always exits nonzero after printing stream info.
      const stderrHolder = error as unknown as { stderr?: unknown };
      const stderr = typeof stderrHolder.stderr === "string" ? stderrHolder.stderr : "";
      const match = stderr.match(/Video:.*?, (\d{2,5})x(\d{2,5})/);
      if (match) {
        const width = Number(match[1]);
        const height = Number(match[2]);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      lastError = error;
      continue;
    }
    return null;
  }
  throw lastError instanceof Error ? lastError : new Error("ffmpeg_static_unavailable");
}

async function freshSidecar(sourcePath: string, sidecarPath: string): Promise<{ filePath: string; size: number } | null> {
  const [source, sidecar] = await Promise.all([stat(sourcePath), stat(sidecarPath).catch(() => null)]);
  if (!sidecar?.isFile() || sidecar.size === 0 || sidecar.mtimeMs < source.mtimeMs) return null;
  return { filePath: sidecarPath, size: sidecar.size };
}

/**
 * Fullscreen/detail playback copy. Small, well-formed originals stream
 * untouched so playback matches the generated resolution exactly (1080p stays
 * 1080p). Oversized sources get one web-optimised copy capped at 1080p on the
 * short side, cached next to the original. The original render always stays
 * the only download source.
 */
export async function resolveWebVideo(sourcePath: string): Promise<{ filePath: string; size: number }> {
  const source = await stat(sourcePath);
  if (source.isFile() && source.size <= WEB_COPY_MAX_SOURCE_BYTES && /\.mp4$/i.test(sourcePath)) {
    return { filePath: sourcePath, size: source.size };
  }
  const cached = await freshSidecar(sourcePath, webVideoPathFor(sourcePath));
  if (cached) return cached;
  const target = webVideoPathFor(sourcePath);
  const pending = inflight.get(target);
  if (pending) return pending;
  const promise = (async () => {
    const releaseSlot = await acquireTranscodeSlot();
    try {
      // Oversized sources: cap the short side at 1080p (portrait/landscape
      // aware) and scale the bitrate with the resolution.
      const dims = await sourceVideoDimensions(sourcePath).catch(() => null);
      const scaleDown = Boolean(dims && Math.min(dims.width, dims.height) > 1080);
      const hd = dims ? Math.min(dims.width, dims.height) > 720 : true;
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
          process.env.AIVIDEOSUGC_WEB_VIDEO_MAXRATE?.trim() || (hd ? "6000k" : "3000k"),
          "-bufsize",
          process.env.AIVIDEOSUGC_WEB_VIDEO_BUFSIZE?.trim() || (hd ? "12000k" : "6000k"),
          ...(scaleDown && dims ? ["-vf", dims.width >= dims.height ? "scale=-2:1080:force_divisible_by=2" : "scale=1080:-2:force_divisible_by=2"] : []),
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
        ], 600_000);
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

/**
 * Cached 480p copy used by the library card stage. Half the pixels and a
 * third of the bitrate of the 720p copy: the small card stage cannot tell the
 * difference, and cross-border first play starts on far fewer bytes.
 */
export async function resolvePreviewVideo(sourcePath: string): Promise<{ filePath: string; size: number }> {
  const cached = await freshSidecar(sourcePath, previewVideoPathFor(sourcePath));
  if (cached) return cached;
  const target = previewVideoPathFor(sourcePath);
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
          process.env.AIVIDEOSUGC_PREVIEW_VIDEO_CRF?.trim() || "27",
          "-maxrate",
          process.env.AIVIDEOSUGC_PREVIEW_VIDEO_MAXRATE?.trim() || "1200k",
          "-bufsize",
          process.env.AIVIDEOSUGC_PREVIEW_VIDEO_BUFSIZE?.trim() || "2400k",
          "-vf",
          process.env.AIVIDEOSUGC_PREVIEW_VIDEO_FILTER?.trim() || "scale=480:854:force_original_aspect_ratio=decrease:force_divisible_by=2",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          process.env.AIVIDEOSUGC_PREVIEW_VIDEO_AUDIO_BITRATE?.trim() || "96k",
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
      if (!result.isFile() || result.size === 0) throw new Error("preview_transcode_empty");
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

/**
 * Completion-time prewarm: build the 720p copy, the 480p card copy and the
 * poster the moment a video finishes, so the first play never waits on
 * ffmpeg. Enabled by AIVIDEOSUGC_PREWARM_MEDIA=1; without it this is a no-op
 * and first play keeps the lazy transcode path. Failures are logged and
 * swallowed — playback falls back to the lazy path automatically.
 */
export async function prewarmWorkspaceVideoArtifacts(sourcePath: string): Promise<void> {
  if (process.env.AIVIDEOSUGC_PREWARM_MEDIA?.trim() !== "1") return;
  const results = await Promise.allSettled([
    resolveWebVideo(sourcePath),
    resolvePreviewVideo(sourcePath),
    resolveVideoPosterFile(sourcePath)
  ]);
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      console.error(`[aivideosugc-workspace] prewarm artifact ${index} failed for ${sourcePath}`, result.reason);
    }
  }
}

/** Retention and delete flows remove the generated sidecars with the source. */
export async function removeVideoSidecars(sourcePath: string): Promise<void> {
  await Promise.all([
    unlink(webVideoPathFor(sourcePath)).catch(() => {}),
    unlink(previewVideoPathFor(sourcePath)).catch(() => {}),
    unlink(webPosterPathFor(sourcePath)).catch(() => {})
  ]);
}
