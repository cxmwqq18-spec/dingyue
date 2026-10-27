import "server-only";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export class CustomerAssetStorageError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "CustomerAssetStorageError";
    this.status = status;
  }
}

export type CustomerAssetWatermarkMarker = {
  version: string;
  text: string;
};

const assetMimeByExtension: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".webp": "image/webp",
  // Reference audio must be served with a real audio/* Content-Type: relay
  // gateways (yingling wan adapters) reject audio uploads that arrive as
  // application/octet-stream.
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac"
};

export function customerAssetRoot(): string {
  const configured = process.env.CUSTOMER_ASSET_STORAGE_ROOT?.trim();
  if (configured) return path.resolve(configured);
  const productionAppRoot = process.env.CUSTOMER_ASSET_APP_ROOT?.trim();
  if (productionAppRoot && process.env.NODE_ENV === "production") {
    return path.join(path.resolve(productionAppRoot), "shared", "customer-assets");
  }
  if (process.env.NODE_ENV === "production" && process.cwd().includes(`${path.sep}releases${path.sep}`)) {
    return path.resolve(process.cwd(), "..", "..", "shared", "customer-assets");
  }
  if (process.env.NODE_ENV === "production" && process.cwd().startsWith(`${path.sep}www${path.sep}wwwroot${path.sep}mydreamshoots.com${path.sep}`)) {
    return `${path.sep}www${path.sep}wwwroot${path.sep}mydreamshoots.com${path.sep}shared${path.sep}customer-assets`;
  }
  return path.join(process.cwd(), "data", "customer-assets");
}

function normalizeBaseUrl(value: string | undefined): string {
  const baseUrl = value?.trim();
  if (!baseUrl) return "";
  try {
    const url = new URL(baseUrl);
    return url.origin;
  } catch {
    return "";
  }
}

export function customerAssetReadBaseUrl(): string {
  return normalizeBaseUrl(
    process.env.CUSTOMER_ASSET_READ_BASE_URL ||
      process.env.NEXT_PUBLIC_CUSTOMER_ASSET_READ_BASE_URL ||
      process.env.CUSTOMER_ASSET_SHARED_BASE_URL ||
      process.env.NEXT_PUBLIC_CUSTOMER_ASSET_SHARED_BASE_URL
  );
}

export function customerAssetWriteBaseUrl(): string {
  return normalizeBaseUrl(process.env.CUSTOMER_ASSET_WRITE_BASE_URL || process.env.CUSTOMER_ASSET_SHARED_BASE_URL);
}

export function hasRemoteCustomerAssetReadSource(): boolean {
  return Boolean(customerAssetReadBaseUrl() || customerAssetWriteBaseUrl());
}

export function shouldAssumeRemoteCustomerAssetsReadable(): boolean {
  return hasRemoteCustomerAssetReadSource() && (
    process.env.NODE_ENV !== "production" ||
    process.env.CUSTOMER_ASSET_ASSUME_REMOTE_READABLE === "1"
  );
}

export function normalizeCustomerAssetStorageKey(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^customer-assets\//, "");
  if (
    !normalized ||
    normalized.includes("..") ||
    path.isAbsolute(normalized) ||
    normalized.split("/").some((part) => part === "." || part === "")
  ) {
    throw new CustomerAssetStorageError("unsafe_asset_storage_key", 400);
  }
  return normalized;
}

export function customerAssetFilePath(storageKey: string): string {
  const root = customerAssetRoot();
  const filePath = path.join(root, normalizeCustomerAssetStorageKey(storageKey));
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    throw new CustomerAssetStorageError("unsafe_asset_storage_key", 400);
  }
  return filePath;
}

export function customerAssetFilePathFromSegments(segments: string[]): string {
  const root = customerAssetRoot();
  const filePath = path.join(root, ...segments);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    throw new CustomerAssetStorageError("unsafe_asset_storage_key", 400);
  }
  return filePath;
}

export function customerAssetFileExists(storageKey: string): boolean {
  try {
    return fs.existsSync(customerAssetFilePath(storageKey));
  } catch {
    return false;
  }
}

export function contentTypeForCustomerAssetPath(filePath: string): string {
  return assetMimeByExtension[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export function writeCustomerAssetFile(params: { storageKey: string; bytes: Buffer }): { path: string; size: number } {
  const filePath = customerAssetFilePath(params.storageKey);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, params.bytes);
  return { path: filePath, size: params.bytes.length };
}

function customerAssetWatermarkMarkerPath(storageKey: string): string {
  return `${customerAssetFilePath(storageKey)}.watermark.json`;
}

export function readCustomerAssetWatermarkMarker(storageKey: string): CustomerAssetWatermarkMarker | undefined {
  try {
    const value = JSON.parse(fs.readFileSync(customerAssetWatermarkMarkerPath(storageKey), "utf8")) as Partial<CustomerAssetWatermarkMarker>;
    if (typeof value.version === "string" && typeof value.text === "string") {
      return { version: value.version, text: value.text };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function writeCustomerAssetWatermarkMarker(storageKey: string, marker: CustomerAssetWatermarkMarker): void {
  const markerPath = customerAssetWatermarkMarkerPath(storageKey);
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, `${JSON.stringify({
    ...marker,
    writtenAt: new Date().toISOString()
  }, null, 2)}\n`);
}

export async function readCustomerAssetFileRemote(params: {
  storageKey: string;
  baseUrl?: string;
  secret?: string;
}): Promise<{ storageKey: string; bytes: Buffer; mimeType: string; watermark?: CustomerAssetWatermarkMarker }> {
  const baseUrls = Array.from(new Set([
    normalizeBaseUrl(params.baseUrl || customerAssetReadBaseUrl()),
    normalizeBaseUrl(customerAssetWriteBaseUrl())
  ].filter(Boolean)));
  if (!baseUrls.length) throw new CustomerAssetStorageError("customer_asset_read_base_url_required", 500);
  const secret = params.secret ?? process.env.CUSTOMER_ASSET_TRANSFER_SECRET ?? process.env.AI_WORKER_SECRET;
  if (!secret || secret === "dev-worker-secret") {
    throw new CustomerAssetStorageError("customer_asset_transfer_secret_required", 500);
  }
  const storageKey = normalizeCustomerAssetStorageKey(params.storageKey);
  let lastError: unknown;
  for (const baseUrl of baseUrls) {
    try {
      const url = new URL("/api/internal/customer-assets", baseUrl);
      url.searchParams.set("storageKey", storageKey);
      const response = await fetch(url, {
        headers: {
          "X-Customer-Asset-Transfer-Secret": secret
        },
        cache: "no-store"
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        lastError = new CustomerAssetStorageError(result.error || `customer_asset_remote_read_failed_${response.status}`, response.status || 500);
        continue;
      }
      return {
        storageKey,
        bytes: Buffer.from(await response.arrayBuffer()),
        mimeType: response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream",
        watermark: watermarkMarkerFromHeaders(response.headers)
      };
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof CustomerAssetStorageError) throw lastError;
  throw new CustomerAssetStorageError("customer_asset_remote_read_failed", 500);
}

function watermarkMarkerFromHeaders(headers: Headers): CustomerAssetWatermarkMarker | undefined {
  const version = headers.get("x-customer-asset-watermark-version")?.trim();
  const text = headers.get("x-customer-asset-watermark-text")?.trim();
  return version && text ? { version, text } : undefined;
}

export async function writeCustomerAssetFileRemote(params: {
  storageKey: string;
  bytes: Buffer;
  mimeType: string;
  baseUrl?: string;
  secret?: string;
  purpose?: "input" | "output";
  watermark?: CustomerAssetWatermarkMarker;
}): Promise<{ storageKey: string; size: number; url?: string }> {
  const baseUrl = normalizeBaseUrl(params.baseUrl || customerAssetWriteBaseUrl());
  if (!baseUrl) throw new CustomerAssetStorageError("customer_asset_write_base_url_required", 500);
  const secret = params.secret ?? process.env.CUSTOMER_ASSET_TRANSFER_SECRET ?? process.env.AI_WORKER_SECRET;
  if (!secret || secret === "dev-worker-secret") {
    throw new CustomerAssetStorageError("customer_asset_transfer_secret_required", 500);
  }
  const storageKey = normalizeCustomerAssetStorageKey(params.storageKey);
  const preferBinaryUpload = params.purpose === "output" &&
    params.mimeType.toLowerCase().startsWith("video/") &&
    process.env.CUSTOMER_ASSET_REMOTE_VIDEO_UPLOAD_MODE?.trim().toLowerCase() !== "json";
  const url = new URL("/api/internal/customer-assets", baseUrl);
  if (preferBinaryUpload) {
    url.searchParams.set("storageKey", storageKey);
    url.searchParams.set("mimeType", params.mimeType);
    if (params.purpose) url.searchParams.set("purpose", params.purpose);
  }
  const response = await fetch(url.toString(), preferBinaryUpload
    ? {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Customer-Asset-Transfer-Secret": secret,
          "X-Customer-Asset-Storage-Key": storageKey,
          "X-Customer-Asset-Mime-Type": params.mimeType,
          ...(params.purpose ? { "X-Customer-Asset-Purpose": params.purpose } : {}),
          ...(params.watermark ? {
            "X-Customer-Asset-Watermark-Version": params.watermark.version,
            "X-Customer-Asset-Watermark-Text": params.watermark.text
          } : {})
        },
        body: new Blob([new Uint8Array(params.bytes)], { type: params.mimeType }),
        cache: "no-store"
      }
    : {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Customer-Asset-Transfer-Secret": secret
        },
        body: JSON.stringify({
          storageKey,
          mimeType: params.mimeType,
          purpose: params.purpose,
          watermarkVersion: params.watermark?.version,
          watermarkText: params.watermark?.text,
          dataBase64: params.bytes.toString("base64")
        }),
        cache: "no-store"
      });
  const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; url?: string; size?: number; maxBytes?: number };
  if (!response.ok || result.ok === false) {
    const sizeHint = result.error === "asset_data_too_large" && typeof result.size === "number" && typeof result.maxBytes === "number"
      ? `_${result.size}_${result.maxBytes}`
      : "";
    throw new CustomerAssetStorageError((result.error ? `${result.error}${sizeHint}` : "") || `customer_asset_remote_write_failed_${response.status}`, response.status || 500);
  }
  return { storageKey, size: Number(result.size ?? params.bytes.length), url: result.url };
}

export async function writeCustomerAssetFileShared(params: {
  storageKey: string;
  bytes: Buffer;
  mimeType: string;
  purpose?: "input" | "output";
  watermark?: CustomerAssetWatermarkMarker;
}): Promise<{ storageKey: string; size: number; path?: string; url?: string; remote: boolean }> {
  const storageKey = normalizeCustomerAssetStorageKey(params.storageKey);
  const remoteBaseUrl = customerAssetWriteBaseUrl();
  if (remoteBaseUrl && process.env.CUSTOMER_ASSET_FORCE_LOCAL_WRITE !== "1") {
    const written = await writeCustomerAssetFileRemote({
      storageKey,
      bytes: params.bytes,
      mimeType: params.mimeType,
      purpose: params.purpose,
      watermark: params.watermark,
      baseUrl: remoteBaseUrl
    });
    return { ...written, remote: true };
  }
  const written = writeCustomerAssetFile({ storageKey, bytes: params.bytes });
  if (params.watermark) writeCustomerAssetWatermarkMarker(storageKey, params.watermark);
  return { storageKey, size: written.size, path: written.path, remote: false };
}

export async function deleteCustomerAssetFileRemote(params: {
  storageKey: string;
  baseUrl?: string;
  secret?: string;
}): Promise<{ storageKey: string; deleted: boolean }> {
  const baseUrl = normalizeBaseUrl(params.baseUrl || customerAssetWriteBaseUrl());
  if (!baseUrl) throw new CustomerAssetStorageError("customer_asset_write_base_url_required", 500);
  const secret = params.secret ?? process.env.CUSTOMER_ASSET_TRANSFER_SECRET ?? process.env.AI_WORKER_SECRET;
  if (!secret || secret === "dev-worker-secret") {
    throw new CustomerAssetStorageError("customer_asset_transfer_secret_required", 500);
  }
  const storageKey = normalizeCustomerAssetStorageKey(params.storageKey);
  const response = await fetch(`${baseUrl}/api/internal/customer-assets`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-Customer-Asset-Transfer-Secret": secret
    },
    body: JSON.stringify({ storageKey }),
    cache: "no-store"
  });
  const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; deleted?: boolean };
  if (!response.ok || result.ok === false) {
    throw new CustomerAssetStorageError(result.error || `customer_asset_remote_delete_failed_${response.status}`, response.status || 500);
  }
  return { storageKey, deleted: Boolean(result.deleted) };
}

export function deleteCustomerAssetFile(storageKey: string): { deleted: boolean; path: string } {
  const filePath = customerAssetFilePath(storageKey);
  const existed = fs.existsSync(filePath);
  fs.rmSync(filePath, { force: true });
  fs.rmSync(customerAssetWatermarkMarkerPath(storageKey), { force: true });
  pruneEmptyAssetDirectories(path.dirname(filePath));
  return { deleted: existed, path: filePath };
}

export async function deleteCustomerAssetFileShared(storageKey: string): Promise<{ storageKey: string; deleted: boolean; path?: string; remote: boolean }> {
  const normalized = normalizeCustomerAssetStorageKey(storageKey);
  const remoteBaseUrl = customerAssetWriteBaseUrl();
  if (remoteBaseUrl && process.env.CUSTOMER_ASSET_FORCE_LOCAL_WRITE !== "1") {
    const result = await deleteCustomerAssetFileRemote({ storageKey: normalized, baseUrl: remoteBaseUrl });
    return { ...result, remote: true };
  }
  const result = deleteCustomerAssetFile(normalized);
  return { storageKey: normalized, deleted: result.deleted, path: result.path, remote: false };
}

function pruneEmptyAssetDirectories(startDir: string) {
  const root = customerAssetRoot();
  let current = startDir;
  while (current.startsWith(`${root}${path.sep}`) && current !== root) {
    try {
      fs.rmdirSync(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

export function extensionForCustomerAssetMime(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("mpeg")) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("png")) return "png";
  return "bin";
}

export function cleanCustomerAssetFileName(fileName: string): string {
  return fileName.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "asset";
}

export function customerAssetStorageKey(params: { siteId: string; customerId: string; fileName: string }): string {
  return `sites/${params.siteId}/customers/${params.customerId}/assets/${params.fileName}`;
}

export function customerAssetUrl(storageKey: string): string {
  const path = `/api/local-assets/${normalizeCustomerAssetStorageKey(storageKey)}`;
  const baseUrl = customerAssetReadBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

export function prepareCompressedCustomerImage(params: {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
  purpose: "input" | "output";
}): { bytes: Buffer; mimeType: string; fileName: string; compressed: boolean } {
  if (params.mimeType.includes("gif")) {
    return { ...params, compressed: false };
  }
  if (process.env.CUSTOMER_ASSET_DISABLE_WEBP_COMPRESSION === "1") {
    return { ...params, compressed: false };
  }
  const qualityEnv = params.purpose === "output" ? process.env.CUSTOMER_ASSET_OUTPUT_WEBP_QUALITY : process.env.CUSTOMER_ASSET_INPUT_WEBP_QUALITY;
  const quality = Math.max(50, Math.min(Number(qualityEnv ?? (params.purpose === "output" ? "86" : "82")) || 82, 95));
  const cwebpBin = process.env.CUSTOMER_ASSET_CWEBP_BIN?.trim() || "cwebp";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dreamshoot-asset-"));
  const inputPath = path.join(tempDir, `input.${extensionForCustomerAssetMime(params.mimeType)}`);
  const outputPath = path.join(tempDir, "output.webp");
  try {
    fs.writeFileSync(inputPath, params.bytes);
    execFileSync(cwebpBin, ["-quiet", "-q", String(quality), inputPath, "-o", outputPath], { stdio: "ignore" });
    const compressed = fs.readFileSync(outputPath);
    if (!compressed.length || compressed.length >= params.bytes.length) {
      return { ...params, compressed: false };
    }
    const baseName = cleanCustomerAssetFileName(params.fileName).replace(/\.[^.]+$/, "") || "asset";
    return {
      bytes: compressed,
      mimeType: "image/webp",
      fileName: `${baseName}.webp`,
      compressed: true
    };
  } catch {
    return { ...params, compressed: false };
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
}
