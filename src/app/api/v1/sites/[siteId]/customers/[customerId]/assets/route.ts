import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  cleanCustomerAssetFileName,
  customerAssetStorageKey,
  deleteCustomerAssetFileShared,
  extensionForCustomerAssetMime,
  prepareCompressedCustomerImage,
  writeCustomerAssetFileShared
} from "@/lib/customer-asset-storage";
import { RATE_LIMITS, checkRateLimitOrResponse } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";
import { requireSiteApiKey } from "@/lib/site-api-keys";
import { createAssetUploadRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";

const defaultMaxUploadBytes = 32 * 1024 * 1024;

function maxCustomerUploadBytes(): number {
  const configured = Number(process.env.CUSTOMER_UPLOAD_MAX_BYTES ?? "");
  return Number.isFinite(configured) && configured > 0 ? Math.trunc(configured) : defaultMaxUploadBytes;
}

function removeWrittenAssetFile(storageKey: string | undefined) {
  if (!storageKey) return;
  void deleteCustomerAssetFileShared(storageKey).catch(() => undefined);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  const auth = await requireSiteApiKey(request, { siteId, scope: "assets:write" });
  if ("response" in auth) return auth.response;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.upload, `${siteId}:external:${auth.apiKey.id}:assets`);
  if (!limited.allowed) return limited.response;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "multipart_form_data_required" }, { status: 415 });
  }

  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) return NextResponse.json({ error: "asset_file_required" }, { status: 400 });
    if (!fileValue.type.startsWith("image/")) return NextResponse.json({ error: "asset_file_must_be_image" }, { status: 400 });
    const maxUploadBytes = maxCustomerUploadBytes();
    if (fileValue.size > maxUploadBytes) {
      return NextResponse.json({ error: "asset_file_too_large", maxBytes: maxUploadBytes }, { status: 413 });
    }

    const bytes = Buffer.from(await fileValue.arrayBuffer());
    const label = String(formData.get("label") ?? "").trim() || fileValue.name.replace(/\.[^.]+$/, "") || "upload";
    const subjectRole = String(formData.get("subjectRole") ?? "").trim() || undefined;
    const compressed = prepareCompressedCustomerImage({
      bytes,
      mimeType: fileValue.type || "image/jpeg",
      fileName: fileValue.name || "upload",
      purpose: "input"
    });
    const storageKey = customerAssetStorageKey({
      siteId,
      customerId,
      fileName: `${crypto.randomUUID()}-${cleanCustomerAssetFileName(compressed.fileName).replace(/\.[^.]+$/, "")}.${extensionForCustomerAssetMime(compressed.mimeType)}`
    });
    await writeCustomerAssetFileShared({
      storageKey,
      bytes: compressed.bytes,
      mimeType: compressed.mimeType,
      purpose: "input"
    });

    try {
      const result = await createAssetUploadRelational({
        siteId,
        customerId,
        label,
        mimeType: compressed.mimeType,
        role: "input",
        subjectRole,
        storageKey
      });
      return NextResponse.json({ ok: true, asset: toThemeRuntimeAssetRelational(result.asset) });
    } catch (error) {
      removeWrittenAssetFile(storageKey);
      throw error;
    }
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "external_asset_create_failed" }, { status });
  }
}
