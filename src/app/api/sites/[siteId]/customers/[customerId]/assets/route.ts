import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import { hasCustomerSession, requireCustomerMutation } from "@/lib/api-auth";
import { customerAssetRolesForSurface } from "@/lib/customer-asset-resource-agent";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { StoreError, writeCustomerAssetFile } from "@/lib/server-store";
import { createAssetUploadRelational, getCustomerAssetsRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
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
  return fileName.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "upload";
}

function normalizedImageFileName(fileName: string, mimeType: string): string {
  if (mimeType === "image/jpeg") {
    const baseName = fileName.replace(/\.[^.]+$/, "");
    return `${baseName || "upload"}.jpg`;
  }
  return fileName;
}

async function prepareUploadedImage(file: File): Promise<{ bytes: Buffer; mimeType: string; fileName: string }> {
  const bytes = Buffer.from(await file.arrayBuffer());
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

function removeWrittenAssetFile(filePath: string | undefined) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Best-effort cleanup after DB write failure; callers still receive the DB error.
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
      if (!body.file.type.startsWith("image/")) {
        return NextResponse.json({ ok: false, error: "asset_file_must_be_image" }, { status: 400 });
      }
      if (body.file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: "asset_file_too_large" }, { status: 413 });
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
    }

    const preparedFile = body.file ? await prepareUploadedImage(body.file) : undefined;
    if (preparedFile) body.mimeType = preparedFile.mimeType;
    const storageKey = body.file && preparedFile
      ? `customer-assets/sites/${siteId}/customers/${customerId}/assets/${crypto.randomUUID()}-${cleanUploadedFileName(preparedFile.fileName)}`
      : undefined;
    let writtenFilePath: string | undefined;
    if (preparedFile && storageKey) {
      writtenFilePath = writeCustomerAssetFile({ storageKey, bytes: preparedFile.bytes }).path;
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
      removeWrittenAssetFile(writtenFilePath);
      throw error;
    }

    return NextResponse.json({ ok: true, asset: toThemeRuntimeAssetRelational(result.asset) });
  } catch (error) {
    return assetErrorResponse(error);
  }
}
