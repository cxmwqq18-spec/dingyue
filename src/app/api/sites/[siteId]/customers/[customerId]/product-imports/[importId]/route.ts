import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { AIDREAMCAPES_CREATE_INTENT_SITE_ID } from "@/lib/aidreamcapes-create-intent";
import { deleteProductImport } from "@/lib/aidreamcapes-workspace/product-imports";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";

export const runtime = "nodejs";

// Aidreamcapes "Product Links": remove one entry from the customer's import
// history. Soft delete keeps the audit trail; the same source URL can be
// re-imported later and revives the row with fresh details.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string; importId: string }> }) {
  const { siteId, customerId, importId } = await params;
  if (siteId !== AIDREAMCAPES_CREATE_INTENT_SITE_ID) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const guard = await requireCustomerMutation(request, siteId, customerId, { rateLimit: RATE_LIMITS.upload, key: `${siteId}:${customerId}:product-imports-delete` });
  if (!guard.ok) return guard.response;
  try {
    await deleteProductImport({ siteId, customerId, importId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof StoreError ? error.message : "product_import_delete_failed" }, { status });
  }
}
