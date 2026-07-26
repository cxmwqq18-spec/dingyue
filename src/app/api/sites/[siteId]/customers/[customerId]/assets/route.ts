import { NextResponse } from "next/server";
import crypto from "crypto";
import { hasCustomerSession, requireCustomerMutation } from "@/lib/api-auth";
import {
  cleanCustomerAssetFileName,
  customerAssetStorageKey,
  deleteCustomerAssetFile,
  extensionForCustomerAssetMime,
  prepareCompressedCustomerImage,
  writeCustomerAssetFile
} from "@/lib/customer-asset-storage";
import { customerAssetRolesForSurface } from "@/lib/customer-asset-resource-agent";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";
import {
  createAssetUploadRelational,
  deleteAssetUploadsRelational,
  getCustomerAssetsRelational,
  pruneCustomerInputAssetsRelational,
  toThemeRuntimeAssetRelational
} from "@/lib/stores/asset-store";
import { geminiVideoFrameMimeTypeForUpload, isGeminiVideoFrameMimeType } from "@/lib/video-provider-policy";
import type { NextRequest } from "next/server";

type SharpFactory = (input: Buffer) => {
  rotate: () => {
    resize: (options: { width: number; height: number; fit: "inside"; withoutEnlargement: boolean }) => {
      jpeg: (options: { quality: number; mozjpeg: boolean }) => {
        toBuffer: () => Promise<Buffer>;
      };
    };
  };
};

const defaultMaxUploadBytes = 32 * 1024 * 1024;
const convertibleVideoFrameExtensionPattern = /\.(jpe?g|png|webp|heic|heif|bmp|tiff?)$/i;
const excludedVideoFrameMimeTypes = new Set(["image/gif", "image/svg+xml"]);

function maxCustomerUploadBytes(): number {
  const configured = Number(process.env.CUSTOMER_UPLOAD_MAX_BYTES ?? "");
  return Number.isFinite(configured) && configured > 0 ? Math.trunc(configured) : defaultMaxUploadBytes;
}

async function loadSharp(): Promise<SharpFactory | undefined> {
  try {
    const moduleName = "sharp";
    const mod = await import(/* webpackIgnore: true */ moduleName);
    return (mod.default ?? mod) as SharpFactory;
  } catch {
    return undefined;
  }
}

function assetErrorResponse(error: unknown, fallback = "asset_create_failed") {
  const status = error instanceof StoreError ? error.status : 500;
  const code = error instanceof Error && error.message ? error.message : fallback;
  return NextResponse.json({ ok: false, error: code }, { status });
}

function cleanUploadedFileName(fileName: string): string {
  return cleanCustomerAssetFileName(fileName);
}

function normalizedImageFileName(fileName: string, mimeType: string): string {
  if (mimeType === "image/jpeg") {
    const baseName = fileName.replace(/\.[^.]+$/, "");
    return `${baseName || "upload"}.jpg`;
  }
  return fileName;
}

function normalizedFileMimeType(file: File): string {
  return (file.type || "").split(";")[0]?.trim().toLowerCase() || "";
}

function looksLikeSupportedImageUpload(file: File): boolean {
  const mimeType = normalizedFileMimeType(file);
  return mimeType.startsWith("image/") || convertibleVideoFrameExtensionPattern.test(file.name);
}

function canTryConvertingVideoFrame(file: File): boolean {
  const mimeType = normalizedFileMimeType(file);
  if (excludedVideoFrameMimeTypes.has(mimeType)) return false;
  return looksLikeSupportedImageUpload(file);
}

async function prepareUploadedImage(file: File, options: { preserveOriginal?: boolean; mimeTypeOverride?: string } = {}): Promise<{ bytes: Buffer; mimeType: string; fileName: string }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  if (options.preserveOriginal) {
    return { bytes, mimeType: options.mimeTypeOverride || file.type || "application/octet-stream", fileName: file.name };
  }
  if (file.type.includes("gif")) return { bytes, mimeType: file.type || "image/gif", fileName: file.name };
  const maxDimension = Math.max(512, Number(process.env.CUSTOMER_UPLOAD_IMAGE_MAX_DIMENSION ?? "2000") || 2000);
  const quality = Math.max(60, Math.min(Number(process.env.CUSTOMER_UPLOAD_IMAGE_QUALITY ?? "84") || 84, 95));
  try {
    const sharp = await loadSharp();
    if (!sharp) throw new Error("sharp_unavailable");
    const prepared = await sharp(bytes)
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return { bytes: prepared, mimeType: "image/jpeg", fileName: normalizedImageFileName(file.name, "image/jpeg") };
  } catch {
    return { bytes, mimeType: file.type || "application/octet-stream", fileName: file.name };
  }
}

async function prepareVideoFrameImage(file: File): Promise<{ bytes: Buffer; mimeType: "image/jpeg" | "image/png"; fileName: string } | undefined> {
  const readyMimeType = geminiVideoFrameMimeTypeForUpload(file);
  if (readyMimeType) {
    const prepared = await prepareUploadedImage(file, { preserveOriginal: true, mimeTypeOverride: readyMimeType });
    return { bytes: prepared.bytes, mimeType: readyMimeType, fileName: normalizedImageFileName(prepared.fileName, readyMimeType) };
  }
  if (!canTryConvertingVideoFrame(file)) return undefined;
  const prepared = await prepareUploadedImage(file);
  if (prepared.mimeType === "image/jpeg") {
    return { bytes: prepared.bytes, mimeType: "image/jpeg", fileName: normalizedImageFileName(prepared.fileName, "image/jpeg") };
  }
  return undefined;
}

function removeWrittenAssetFile(storageKey: string | undefined) {
  if (!storageKey) return;
  try {
    deleteCustomerAssetFile(storageKey);
  } catch {
    // Keep the upload response focused on the metadata failure.
  }
}

function assetRolesFromParam(value: string | null): Array<"input" | "output" | "training_input"> | undefined {
  if (value === "workspace-gallery" || value === "source-picker" || value === "admin-review") return customerAssetRolesForSurface(value);
  if (!value || value === "all") return undefined;
  const roles = value
    .split(",")
    .map((role) => role.trim())
    .filter((role): role is "input" | "output" | "training_input" => role === "input" || role === "output" || role === "training_input");
  return roles.length ? roles : undefined;
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  if (!(await hasCustomerSession(siteId, customerId))) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  const url = new URL(_request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "100");
  const result = await getCustomerAssetsRelational({ siteId, customerId, roles: assetRolesFromParam(url.searchParams.get("role")), take: requestedLimit });
  return NextResponse.json({
    ok: true,
    assets: result.assets.map(toThemeRuntimeAssetRelational)
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  const guard = await requireCustomerMutation(request, siteId, customerId, { rateLimit: RATE_LIMITS.upload, key: `${siteId}:${customerId}:assets` });
  if (!guard.ok) return guard.response;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");
    let body: {
      label?: string;
      mimeType?: string;
      role?: "input" | "output";
      jobId?: string;
      subjectRole?: string;
      file?: File;
    } = {};

    if (isMultipart) {
      const formData = await request.formData();
      const fileValue = formData.get("file");
      body = {
        label: String(formData.get("label") ?? ""),
        role: formData.get("role") === "output" ? "output" : "input",
        jobId: typeof formData.get("jobId") === "string" ? String(formData.get("jobId")) : undefined,
        subjectRole: typeof formData.get("subjectRole") === "string" ? String(formData.get("subjectRole")) : undefined,
        file: fileValue instanceof File ? fileValue : undefined
      };
      if (!body.file) {
        return NextResponse.json({ ok: false, error: "asset_file_required" }, { status: 400 });
      }
      if (!looksLikeSupportedImageUpload(body.file)) {
        return NextResponse.json({ ok: false, error: "asset_file_must_be_image" }, { status: 400 });
      }
      const maxUploadBytes = maxCustomerUploadBytes();
      if (body.file.size > maxUploadBytes) {
        return NextResponse.json({ ok: false, error: "asset_file_too_large", maxBytes: maxUploadBytes }, { status: 413 });
      }
      body.label = body.label || body.file.name.replace(/\.[^.]+$/, "");
    } else {
      body = (await request.json().catch(() => ({}))) as {
        label?: string;
        mimeType?: string;
        role?: "input" | "output";
        jobId?: string;
        subjectRole?: string;
      };
      if (body.subjectRole === "video_frame" && body.mimeType && !isGeminiVideoFrameMimeType(body.mimeType)) {
        return NextResponse.json({ ok: false, error: "unsupported_video_frame_type" }, { status: 400 });
      }
    }

    const preserveOriginal = body.subjectRole === "video_frame";
    const preparedFile = body.file
      ? preserveOriginal
        ? await prepareVideoFrameImage(body.file)
        : await prepareUploadedImage(body.file)
      : undefined;
    if (body.subjectRole === "video_frame" && body.file && !preparedFile) {
      return NextResponse.json({ ok: false, error: "unsupported_video_frame_type" }, { status: 400 });
    }
    if (preparedFile) body.mimeType = preparedFile.mimeType;
    const compressedFile = preparedFile && !preserveOriginal
      ? prepareCompressedCustomerImage({
        bytes: preparedFile.bytes,
        mimeType: preparedFile.mimeType,
        fileName: preparedFile.fileName,
        purpose: "input"
      })
      : preparedFile;
    if (compressedFile) body.mimeType = compressedFile.mimeType;
    const storageKey = body.file && compressedFile
      ? customerAssetStorageKey({
        siteId,
        customerId,
        fileName: `${crypto.randomUUID()}-${cleanUploadedFileName(compressedFile.fileName).replace(/\.[^.]+$/, "")}.${extensionForCustomerAssetMime(compressedFile.mimeType)}`
      })
      : undefined;
    let writtenStorageKey: string | undefined;
    if (compressedFile && storageKey) {
      writeCustomerAssetFile({
        storageKey,
        bytes: compressedFile.bytes
      });
      writtenStorageKey = storageKey;
    }

    let result: Awaited<ReturnType<typeof createAssetUploadRelational>>;
    try {
      result = await createAssetUploadRelational({
        siteId,
        customerId,
        label: body.label ?? "",
        mimeType: body.mimeType ?? "image/jpeg",
        role: body.role ?? "input",
        jobId: body.jobId,
        subjectRole: body.subjectRole,
        storageKey
      });
    } catch (error) {
      removeWrittenAssetFile(writtenStorageKey);
      throw error;
    }

    return NextResponse.json({ ok: true, asset: toThemeRuntimeAssetRelational(result.asset) });
  } catch (error) {
    return assetErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  const guard = await requireCustomerMutation(request, siteId, customerId, { key: `${siteId}:${customerId}:assets-delete` });
  if (!guard.ok) return guard.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { assetIds?: unknown };
    const assetIds = Array.isArray(body.assetIds) ? body.assetIds.filter((item): item is string => typeof item === "string") : [];
    if (!assetIds.length) {
      return NextResponse.json({ ok: false, error: "asset_ids_required" }, { status: 400 });
    }
    const result = await deleteAssetUploadsRelational({ siteId, customerId, assetIds });
    return NextResponse.json({ ok: true, deletedCount: result.deletedCount, assets: result.assets.map(toThemeRuntimeAssetRelational) });
  } catch (error) {
    return assetErrorResponse(error, "asset_delete_failed");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  const guard = await requireCustomerMutation(request, siteId, customerId, { key: `${siteId}:${customerId}:assets-prune` });
  if (!guard.ok) return guard.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: unknown; keepAssetIds?: unknown };
    if (body.action !== "keep_current_samples") {
      return NextResponse.json({ ok: false, error: "unsupported_asset_patch_action" }, { status: 400 });
    }
    const keepAssetIds = Array.isArray(body.keepAssetIds) ? body.keepAssetIds.filter((item): item is string => typeof item === "string") : [];
    const result = await pruneCustomerInputAssetsRelational({ siteId, customerId, keepAssetIds });
    return NextResponse.json({ ok: true, deletedCount: result.deletedCount });
  } catch (error) {
    return assetErrorResponse(error, "asset_prune_failed");
  }
}
