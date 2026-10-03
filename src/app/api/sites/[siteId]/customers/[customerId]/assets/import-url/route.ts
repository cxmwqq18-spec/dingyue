import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { AIDREAMCAPES_CREATE_INTENT_SITE_ID } from "@/lib/aidreamcapes-create-intent";
import { customerAssetStorageKey, deleteCustomerAssetFileShared, writeCustomerAssetFileShared } from "@/lib/customer-asset-storage";
import { importProductFromUrl, ProductUrlImportError } from "@/lib/product-url-import";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";
import { createAssetUploadRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";

export const runtime = "nodejs";

// Aidreamcapes "URL to Video": saves the main product photo from a public product page
// as the customer's video reference image and returns the product name for the prompt.
export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  if (siteId !== AIDREAMCAPES_CREATE_INTENT_SITE_ID) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const guard = await requireCustomerMutation(request, siteId, customerId, { rateLimit: RATE_LIMITS.upload, key: `${siteId}:${customerId}:assets-import-url` });
  if (!guard.ok) return guard.response;

  let writtenStorageKey: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as { url?: unknown };
    const product = await importProductFromUrl(body.url);
    const extension = product.image.mimeType === "image/png" ? "png" : "jpg";
    const storageKey = customerAssetStorageKey({ siteId, customerId, fileName: `${crypto.randomUUID()}-product-link.${extension}` });
    await writeCustomerAssetFileShared({ storageKey, bytes: product.image.bytes, mimeType: product.image.mimeType, purpose: "input" });
    writtenStorageKey = storageKey;
    const result = await createAssetUploadRelational({
      siteId,
      customerId,
      label: product.title || "Product photo",
      mimeType: product.image.mimeType,
      role: "input",
      subjectRole: "video_frame",
      storageKey
    });
    return NextResponse.json({ ok: true, asset: toThemeRuntimeAssetRelational(result.asset), product: { title: product.title ?? null } });
  } catch (error) {
    if (writtenStorageKey) void deleteCustomerAssetFileShared(writtenStorageKey).catch(() => undefined);
    if (error instanceof ProductUrlImportError) return NextResponse.json({ ok: false, error: error.code }, { status: error.status });
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof StoreError ? error.message : "product_url_import_failed" }, { status });
  }
}
