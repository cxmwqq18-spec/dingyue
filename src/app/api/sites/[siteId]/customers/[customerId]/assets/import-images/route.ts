import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { AIDREAMCAPES_CREATE_INTENT_SITE_ID } from "@/lib/aidreamcapes-create-intent";
import { customerAssetStorageKey, deleteCustomerAssetFileShared, writeCustomerAssetFileShared } from "@/lib/customer-asset-storage";
import { importImageFromUrl, ProductUrlImportError } from "@/lib/product-url-import";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createAssetUploadRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";

export const runtime = "nodejs";

const MAX_IMAGES = 8;

/**
 * Aidreamcapes "URL to Video": import several already-discovered product photo
 * URLs at once. The product page preview lists up to eight candidate photos;
 * the customer picks which ones become input assets instead of forcing the
 * main photo only. Each URL goes through the same public-only fetch, MIME and
 * byte checks as the single-photo importer.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  if (siteId !== AIDREAMCAPES_CREATE_INTENT_SITE_ID) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const guard = await requireCustomerMutation(request, siteId, customerId, { rateLimit: RATE_LIMITS.upload, key: `${siteId}:${customerId}:assets-import-images` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { urls?: unknown; label?: unknown };
  const urls = Array.isArray(body.urls)
    ? body.urls.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, MAX_IMAGES)
    : [];
  if (!urls.length) {
    return NextResponse.json({ ok: false, error: "product_url_invalid" }, { status: 400 });
  }
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 120) : "Product photo";

  const assets: ReturnType<typeof toThemeRuntimeAssetRelational>[] = [];
  const failed: Array<{ url: string; error: string }> = [];
  for (const url of urls) {
    let writtenStorageKey: string | undefined;
    try {
      const image = await importImageFromUrl(url);
      const extension = image.mimeType === "image/png" ? "png" : "jpg";
      const storageKey = customerAssetStorageKey({ siteId, customerId, fileName: `${crypto.randomUUID()}-product-link.${extension}` });
      await writeCustomerAssetFileShared({ storageKey, bytes: image.bytes, mimeType: image.mimeType, purpose: "input" });
      writtenStorageKey = storageKey;
      const result = await createAssetUploadRelational({
        siteId,
        customerId,
        label,
        mimeType: image.mimeType,
        role: "input",
        subjectRole: "video_frame",
        storageKey
      });
      assets.push(toThemeRuntimeAssetRelational(result.asset));
    } catch (error) {
      if (writtenStorageKey) void deleteCustomerAssetFileShared(writtenStorageKey).catch(() => undefined);
      failed.push({ url, error: error instanceof ProductUrlImportError ? error.code : "product_url_import_failed" });
    }
  }

  if (!assets.length) {
    return NextResponse.json(
      { ok: false, error: failed[0]?.error ?? "product_url_import_failed", failed },
      { status: 422 }
    );
  }
  return NextResponse.json({ ok: true, assets, failed }, { status: 201 });
}
