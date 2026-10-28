import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasCustomerSession, requireCustomerMutation } from "@/lib/api-auth";
import { AIDREAMCAPES_CREATE_INTENT_SITE_ID } from "@/lib/aidreamcapes-create-intent";
import { listProductImports, upsertProductImport } from "@/lib/aidreamcapes-workspace/product-imports";
import { normalizeProductPageUrl } from "@/lib/product-url-import";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";

export const runtime = "nodejs";

// Aidreamcapes "Product Links": persisted history of confirmed product page
// imports. GET returns the customer's library; POST records (or refreshes) one
// confirmed import after the asset has been created by assets/import-url.
export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  if (siteId !== AIDREAMCAPES_CREATE_INTENT_SITE_ID) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (!(await hasCustomerSession(siteId, customerId))) {
    return NextResponse.json({ ok: false, error: "customer_login_required" }, { status: 401 });
  }
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "20");
  try {
    const imports = await listProductImports({ siteId, customerId, limit: Number.isSafeInteger(limit) ? limit : 20 });
    return NextResponse.json({ ok: true, imports });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof StoreError ? error.message : "product_import_list_failed" }, { status });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  if (siteId !== AIDREAMCAPES_CREATE_INTENT_SITE_ID) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const guard = await requireCustomerMutation(request, siteId, customerId, { rateLimit: RATE_LIMITS.upload, key: `${siteId}:${customerId}:product-imports` });
  if (!guard.ok) return guard.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      assetId?: unknown;
      sourceUrl?: unknown;
      fetchedPageUrl?: unknown;
      title?: unknown;
      brief?: unknown;
    };
    let normalizedSourceUrl: URL;
    try {
      normalizedSourceUrl = normalizeProductPageUrl(body.sourceUrl);
    } catch {
      return NextResponse.json({ ok: false, error: "product_url_invalid" }, { status: 400 });
    }
    if (typeof body.assetId !== "string" || !body.assetId.trim() || body.assetId.length > 200) {
      return NextResponse.json({ ok: false, error: "product_import_request_invalid" }, { status: 400 });
    }
    if (typeof body.sourceUrl !== "string") {
      return NextResponse.json({ ok: false, error: "product_url_invalid" }, { status: 400 });
    }
    if (body.fetchedPageUrl !== undefined && body.fetchedPageUrl !== null && (typeof body.fetchedPageUrl !== "string" || body.fetchedPageUrl.length > 2048)) {
      return NextResponse.json({ ok: false, error: "product_import_request_invalid" }, { status: 400 });
    }
    if (body.title !== undefined && body.title !== null && (typeof body.title !== "string" || body.title.length > 300)) {
      return NextResponse.json({ ok: false, error: "product_import_request_invalid" }, { status: 400 });
    }
    const record = await upsertProductImport({
      siteId,
      customerId,
      assetId: body.assetId,
      sourceUrl: normalizedSourceUrl.toString(),
      fetchedPageUrl: typeof body.fetchedPageUrl === "string" ? body.fetchedPageUrl : null,
      title: typeof body.title === "string" ? body.title : null,
      brief: body.brief
    });
    return NextResponse.json({ ok: true, import: record }, { status: 201 });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof StoreError ? error.message : "product_import_failed" }, { status });
  }
}
