import crypto from "crypto";
import { execFile } from "child_process";
import { access, mkdir, open, readFile, rename, stat, unlink } from "fs/promises";
import path from "path";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import { NextResponse } from "next/server";
import { hasCustomerSession, hasSiteAdminSession } from "@/lib/api-auth";
import {
  contentTypeForCustomerAssetPath,
  customerAssetRoot,
  customerAssetFilePathFromSegments,
  hasRemoteCustomerAssetReadSource,
  readCustomerAssetFileRemote,
  writeCustomerAssetFile
} from "@/lib/customer-asset-storage";
import { customerSessionCookie, siteAdminSessionCookie } from "@/lib/session";
import { verifyWorkerLocalAssetDownload } from "@/lib/worker";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const missingAssetPlaceholder = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" role="img" aria-label="Loading preview">
  <rect width="320" height="320" rx="28" fill="#071018"/>
  <rect x="24" y="24" width="272" height="272" rx="24" fill="#0d1722" stroke="#1f3344" stroke-width="2"/>
  <circle cx="160" cy="128" r="36" fill="none" stroke="#173348" stroke-width="10"/>
  <circle cx="160" cy="128" r="36" fill="none" stroke="#31d4ff" stroke-linecap="round" stroke-width="10" stroke-dasharray="82 226">
    <animateTransform attributeName="transform" dur="0.9s" from="0 160 128" repeatCount="indefinite" to="360 160 128" type="rotate"/>
  </circle>
  <text x="160" y="194" fill="#e8f8ff" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" text-anchor="middle">Loading preview</text>
  <text x="160" y="222" fill="#8aa2b4" font-family="Arial, Helvetica, sans-serif" font-size="13" text-anchor="middle">Preparing your upload</text>
</svg>`
);

type ResolvedAsset = {
  filePath?: string;
  size: number;
  contentType: string;
  bytes?: Buffer;
  placeholder?: boolean;
};

const remoteAssetInflight = new Map<string, Promise<ResolvedAsset>>();
const videoPosterInflight = new Map<string, Promise<{ filePath: string; size: number }>>();
const videoPreviewInflight = new Map<string, Promise<{ filePath: string; size: number }>>();
const assetAccessCache = new Map<string, { ok: boolean; expiresAt: number }>();
const assetAccessCacheTtlMs = 30_000;
const assetCacheControl = "private, max-age=86400, immutable";
const videoPosterCacheControl = "private, max-age=86400, immutable";

function customerAssetXAccelPrefix(): string {
  const configured = process.env.CUSTOMER_ASSET_X_ACCEL_PREFIX?.trim();
  if (!configured) return "";
  return configured.endsWith("/") ? configured : `${configured}/`;
}

function cachedAssetAccess(cacheKey: string): boolean | undefined {
  const cached = assetAccessCache.get(cacheKey);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    assetAccessCache.delete(cacheKey);
    return undefined;
  }
  return cached.ok;
}

function setCachedAssetAccess(cacheKey: string, ok: boolean): void {
  const now = Date.now();
  assetAccessCache.set(cacheKey, { ok, expiresAt: now + assetAccessCacheTtlMs });
  if (assetAccessCache.size <= 500) return;
  for (const [key, entry] of assetAccessCache) {
    if (entry.expiresAt <= now || assetAccessCache.size > 500) assetAccessCache.delete(key);
  }
}

function cookieValue(request: Request, name: string): string {
  const cookies = request.headers.get("cookie") ?? "";
  const prefix = `${name}=`;
  return cookies
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) ?? "";
}

async function hasCachedCustomerAssetAccess(request: Request, siteId: string, customerId: string, workerSignatureValid: boolean): Promise<boolean> {
  if (workerSignatureValid) return true;
  const sessionId = cookieValue(request, customerSessionCookie(siteId));
  if (!sessionId) return false;
  const cacheKey = `customer:${siteId}:${customerId}:${sessionId}`;
  const cached = cachedAssetAccess(cacheKey);
  if (cached !== undefined) return cached;
  const ok = await hasCustomerSession(siteId, customerId);
  setCachedAssetAccess(cacheKey, ok);
  return ok;
}

async function hasCachedSiteAdminAssetAccess(request: Request, siteId: string): Promise<boolean> {
  const sessionId = cookieValue(request, siteAdminSessionCookie(siteId));
  if (!sessionId) return false;
  const cacheKey = `site-admin:${siteId}:${sessionId}`;
  const cached = cachedAssetAccess(cacheKey);
  if (cached !== undefined) return cached;
  const ok = await hasSiteAdminSession(siteId);
  setCachedAssetAccess(cacheKey, ok);
  return ok;
}

function parseByteRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | undefined {
  if (!header?.startsWith("bytes=") || size <= 0) return undefined;
  const range = header.slice("bytes=".length).split(",")[0]?.trim();
  if (!range || !range.includes("-")) return undefined;
  const [startValue, endValue] = range.split("-", 2);
  if (!startValue) {
    const suffixLength = Number(endValue);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "unsatisfiable";
    const start = Math.max(size - Math.trunc(suffixLength), 0);
    return { start, end: size - 1 };
  }
  const start = Number(startValue);
  const end = endValue ? Number(endValue) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "unsatisfiable";
  const normalizedStart = Math.trunc(start);
  const normalizedEnd = Math.min(Math.trunc(end), size - 1);
  if (normalizedStart < 0 || normalizedStart >= size || normalizedEnd < normalizedStart) return "unsatisfiable";
  return { start: normalizedStart, end: normalizedEnd };
}

function assetHeaders(asset: ResolvedAsset, contentLength: number, extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": asset.contentType,
    "Content-Length": String(contentLength),
    "Accept-Ranges": "bytes",
    "Cache-Control": asset.placeholder ? "private, no-store" : assetCacheControl,
    ...(asset.placeholder ? { "X-Asset-Placeholder": "loading" } : {}),
    ...extra
  };
}

function videoPosterHeaders(contentLength: number): HeadersInit {
  return {
    "Content-Type": "image/jpeg",
    "Content-Length": String(contentLength),
    "Cache-Control": videoPosterCacheControl
  };
}

function xAccelRedirectPathForFile(filePath: string | undefined): string | undefined {
  const prefix = customerAssetXAccelPrefix();
  if (!prefix || !filePath) return undefined;
  const root = customerAssetRoot();
  const relativePath = path.relative(root, filePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) return undefined;
  return `${prefix}${relativePath.split(path.sep).map(encodeURIComponent).join("/")}`;
}

function xAccelAssetResponse(asset: ResolvedAsset, extra?: HeadersInit): Response | undefined {
  if (asset.placeholder || asset.bytes) return undefined;
  const redirectPath = xAccelRedirectPathForFile(asset.filePath);
  if (!redirectPath) return undefined;
  return new Response(null, {
    headers: {
      "Content-Type": asset.contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": assetCacheControl,
      "X-Accel-Redirect": redirectPath,
      ...extra
    }
  });
}

function xAccelPosterResponse(poster: { filePath: string; size: number }): Response | undefined {
  const redirectPath = xAccelRedirectPathForFile(poster.filePath);
  if (!redirectPath) return undefined;
  return new Response(null, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": videoPosterCacheControl,
      "X-Accel-Redirect": redirectPath
    }
  });
}

function wantsVideoPoster(request: Request): boolean {
  return new URL(request.url).searchParams.get("poster") === "1";
}

function wantsVideoPreview(request: Request): boolean {
  return new URL(request.url).searchParams.get("preview") === "1";
}

function videoPosterPathFor(filePath: string): string {
  const fileKey = crypto.createHash("sha256").update(filePath).digest("hex").slice(0, 16);
  return `${filePath}.${fileKey}.poster.jpg`;
}

function videoPreviewPathFor(filePath: string): string {
  const fileKey = crypto.createHash("sha256").update(filePath).digest("hex").slice(0, 16);
  return `${filePath}.${fileKey}.preview.mp4`;
}

async function ffmpegExecutableCandidates(): Promise<string[]> {
  const candidates = [
    process.env.CUSTOMER_ASSET_FFMPEG_BIN?.trim() ?? "",
    typeof ffmpegPath === "string" && ffmpegPath ? ffmpegPath : "",
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "ffmpeg"
  ].filter(Boolean);
  const uniqueCandidates = Array.from(new Set(candidates));
  const available: string[] = [];
  for (const candidate of uniqueCandidates) {
    if (!path.isAbsolute(candidate)) {
      available.push(candidate);
      continue;
    }
    try {
      await access(candidate);
      available.push(candidate);
    } catch {
      // Try the next location. Next production builds can rewrite ffmpeg-static to a non-copied route chunk path.
    }
  }
  if (available.length) return available;
  throw new Error("ffmpeg_static_unavailable");
}

async function generateVideoPoster(sourcePath: string, posterPath: string): Promise<void> {
  const candidates = await ffmpegExecutableCandidates();
  let lastError: unknown;
  await mkdir(path.dirname(posterPath), { recursive: true });
  for (const candidate of candidates) {
    const tmpPath = `${posterPath}.${process.pid}.${Date.now()}.${crypto.createHash("sha1").update(candidate).digest("hex").slice(0, 8)}.tmp.jpg`;
    try {
      await execFileAsync(
        candidate,
        [
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
          "scale=960:-2:force_original_aspect_ratio=decrease",
          "-q:v",
          "4",
          tmpPath
        ],
        { timeout: 20_000, maxBuffer: 1024 * 1024 }
      );
      await rename(tmpPath, posterPath);
      return;
    } catch (error) {
      lastError = error;
      await unlink(tmpPath).catch(() => {});
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ffmpeg_static_unavailable");
}

async function generateVideoPreview(sourcePath: string, previewPath: string): Promise<void> {
  const candidates = await ffmpegExecutableCandidates();
  let lastError: unknown;
  await mkdir(path.dirname(previewPath), { recursive: true });
  for (const candidate of candidates) {
    const tmpPath = `${previewPath}.${process.pid}.${Date.now()}.${crypto.createHash("sha1").update(candidate).digest("hex").slice(0, 8)}.tmp.mp4`;
    try {
      await execFileAsync(
        candidate,
        [
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
          "veryfast",
          "-crf",
          process.env.CUSTOMER_ASSET_VIDEO_PREVIEW_CRF?.trim() || "38",
          "-maxrate",
          process.env.CUSTOMER_ASSET_VIDEO_PREVIEW_MAXRATE?.trim() || "260k",
          "-bufsize",
          process.env.CUSTOMER_ASSET_VIDEO_PREVIEW_BUFSIZE?.trim() || "520k",
          "-vf",
          process.env.CUSTOMER_ASSET_VIDEO_PREVIEW_FILTER?.trim() || "scale=640:360:force_original_aspect_ratio=decrease:force_divisible_by=2",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          process.env.CUSTOMER_ASSET_VIDEO_PREVIEW_AUDIO_BITRATE?.trim() || "32k",
          "-movflags",
          "+faststart",
          tmpPath
        ],
        { timeout: 120_000, maxBuffer: 1024 * 1024 }
      );
      await rename(tmpPath, previewPath);
      return;
    } catch (error) {
      lastError = error;
      await unlink(tmpPath).catch(() => {});
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ffmpeg_static_unavailable");
}

async function resolveVideoPoster(asset: ResolvedAsset): Promise<{ filePath: string; size: number }> {
  if (!asset.contentType.startsWith("video/")) throw new Error("asset_is_not_video");
  if (!asset.filePath) throw new Error("video_asset_file_missing");
  const sourceStat = await stat(asset.filePath);
  const posterPath = videoPosterPathFor(asset.filePath);
  const existingPoster = await stat(posterPath).catch(() => null);
  if (existingPoster?.isFile() && existingPoster.size > 0 && existingPoster.mtimeMs >= sourceStat.mtimeMs) {
    return { filePath: posterPath, size: existingPoster.size };
  }
  const existing = videoPosterInflight.get(posterPath);
  if (existing) return existing;
  const promise = (async () => {
    await generateVideoPoster(asset.filePath!, posterPath);
    const posterStat = await stat(posterPath);
    return { filePath: posterPath, size: posterStat.size };
  })();
  videoPosterInflight.set(posterPath, promise);
  try {
    return await promise;
  } finally {
    videoPosterInflight.delete(posterPath);
  }
}

async function resolveVideoPreview(asset: ResolvedAsset): Promise<{ filePath: string; size: number }> {
  if (!asset.contentType.startsWith("video/")) throw new Error("asset_is_not_video");
  if (!asset.filePath) throw new Error("video_asset_file_missing");
  const sourceStat = await stat(asset.filePath);
  const previewPath = videoPreviewPathFor(asset.filePath);
  const existingPreview = await stat(previewPath).catch(() => null);
  if (existingPreview?.isFile() && existingPreview.size > 0 && existingPreview.mtimeMs >= sourceStat.mtimeMs) {
    return { filePath: previewPath, size: existingPreview.size };
  }
  const existing = videoPreviewInflight.get(previewPath);
  if (existing) return existing;
  const promise = (async () => {
    await generateVideoPreview(asset.filePath!, previewPath);
    const previewStat = await stat(previewPath);
    return { filePath: previewPath, size: previewStat.size };
  })();
  videoPreviewInflight.set(previewPath, promise);
  try {
    return await promise;
  } finally {
    videoPreviewInflight.delete(previewPath);
  }
}

async function readAssetBytes(asset: ResolvedAsset, range?: { start: number; end: number }) {
  if ("bytes" in asset && asset.bytes) {
    const bytes = new Uint8Array(asset.bytes);
    return range ? bytes.subarray(range.start, range.end + 1) : bytes;
  }
  if (!asset.filePath) throw new Error("asset_file_missing");
  if (!range) return new Uint8Array(await readFile(asset.filePath));
  const length = range.end - range.start + 1;
  const handle = await open(asset.filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(length);
    const { bytesRead } = await handle.read(buffer, 0, length, range.start);
    return new Uint8Array(buffer.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

async function readRemoteAssetIntoLocalCache(storageKey: string, filePath: string): Promise<ResolvedAsset> {
  const existing = remoteAssetInflight.get(storageKey);
  if (existing) return existing;
  const promise = (async () => {
    const remote = await readCustomerAssetFileRemote({ storageKey });
    try {
      writeCustomerAssetFile({ storageKey, bytes: remote.bytes });
      const fileStat = await stat(filePath).catch(() => null);
      if (fileStat?.isFile()) {
        return {
          filePath,
          size: fileStat.size,
          contentType: contentTypeForCustomerAssetPath(filePath)
        };
      }
    } catch {
      // Keep serving the verified remote bytes even if the local cache write fails.
    }
    return {
      filePath: undefined,
      size: remote.bytes.length,
      contentType: remote.mimeType,
      bytes: remote.bytes
    };
  })();
  remoteAssetInflight.set(storageKey, promise);
  try {
    return await promise;
  } finally {
    remoteAssetInflight.delete(storageKey);
  }
}

async function resolveAsset(request: Request, params: Promise<{ path: string[] }>) {
  const { path: segments } = await params;
  const safeSegments = segments.filter((segment) => segment && segment !== ".." && !segment.includes("\\"));
  if (safeSegments.length !== segments.length) {
    return { error: "unsafe_asset_path", status: 400 as const };
  }
  let filePath = "";
  try {
    filePath = customerAssetFilePathFromSegments(safeSegments);
  } catch {
    return { error: "asset_not_found", status: 404 as const };
  }
  const siteIndex = safeSegments.indexOf("sites");
  const customerIndex = safeSegments.indexOf("customers");
  if (siteIndex >= 0 && customerIndex >= 0) {
    const siteId = safeSegments[siteIndex + 1];
    const customerId = safeSegments[customerIndex + 1];
    const storageKey = safeSegments.join("/");
    const url = new URL(request.url);
    const workerSignatureValid = url.searchParams.get("worker") === "1" && verifyWorkerLocalAssetDownload({
      storageKey,
      expiresAt: url.searchParams.get("expiresAt") ?? "",
      signature: url.searchParams.get("signature") ?? ""
    });
    const hasAccess = siteId && customerId
      ? (await hasCachedCustomerAssetAccess(request, siteId, customerId, workerSignatureValid)) || (await hasCachedSiteAdminAssetAccess(request, siteId))
      : false;
    if (!hasAccess) {
      return { error: "customer_login_required", status: 401 as const };
    }
  }
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    if (siteIndex >= 0 && customerIndex >= 0) {
      if (hasRemoteCustomerAssetReadSource()) {
        try {
          return await readRemoteAssetIntoLocalCache(safeSegments.join("/"), filePath);
        } catch {
          // Fall through to the placeholder so broken remote assets do not crash the workspace.
        }
      }
      return {
        filePath: undefined,
        size: missingAssetPlaceholder.length,
        contentType: "image/svg+xml",
        bytes: missingAssetPlaceholder,
        placeholder: true
      };
    }
    return { error: "asset_not_found", status: 404 as const };
  }
  return {
    filePath,
    size: fileStat.size,
    contentType: contentTypeForCustomerAssetPath(filePath)
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const asset = await resolveAsset(_request, params);
    if ("error" in asset) {
      const headers = asset.status === 404 ? { "Cache-Control": "private, max-age=30" } : undefined;
      return NextResponse.json({ error: asset.error }, { status: asset.status, headers });
    }
    if (wantsVideoPoster(_request)) {
      const poster = await resolveVideoPoster(asset);
      const accelResponse = xAccelPosterResponse(poster);
      if (accelResponse) return accelResponse;
      const bytes = await readFile(poster.filePath);
      return new Response(new Uint8Array(bytes), {
        headers: videoPosterHeaders(poster.size)
      });
    }
    const servedAsset = wantsVideoPreview(_request)
      ? {
          ...(await resolveVideoPreview(asset)),
          contentType: "video/mp4"
        }
      : asset;
    const range = parseByteRange(_request.headers.get("range"), servedAsset.size);
    if (range === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${servedAsset.size}`,
          "Accept-Ranges": "bytes"
        }
      });
    }
    if (range) {
      const accelResponse = xAccelAssetResponse(servedAsset);
      if (accelResponse) return accelResponse;
      const chunk = await readAssetBytes(servedAsset, range);
      return new Response(chunk, {
        status: 206,
        headers: assetHeaders(servedAsset, chunk.byteLength, {
          "Content-Range": `bytes ${range.start}-${range.end}/${servedAsset.size}`
        })
      });
    }
    const accelResponse = xAccelAssetResponse(servedAsset);
    if (accelResponse) return accelResponse;
    const bytes = await readAssetBytes(servedAsset);
    return new Response(bytes, {
      headers: assetHeaders(servedAsset, servedAsset.size)
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "asset_read_failed" },
      { status: 500 }
    );
  }
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const asset = await resolveAsset(_request, params);
    if ("error" in asset) {
      const headers = asset.status === 404 ? { "Cache-Control": "private, max-age=30" } : undefined;
      return new Response(null, { status: asset.status, headers });
    }
    if (wantsVideoPoster(_request)) {
      const poster = await resolveVideoPoster(asset);
      const accelResponse = xAccelPosterResponse(poster);
      if (accelResponse) return accelResponse;
      return new Response(null, {
        headers: videoPosterHeaders(poster.size)
      });
    }
    const servedAsset = wantsVideoPreview(_request)
      ? {
          ...(await resolveVideoPreview(asset)),
          contentType: "video/mp4"
        }
      : asset;
    const accelResponse = xAccelAssetResponse(servedAsset);
    if (accelResponse) return accelResponse;
    return new Response(null, {
      headers: assetHeaders(servedAsset, servedAsset.size)
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET,HEAD,OPTIONS" }
  });
}
