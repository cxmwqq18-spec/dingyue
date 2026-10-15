import { NextResponse } from "next/server";
import { invalidateAdminCustomersPageCache } from "@/lib/admin-customers-page-cache";
import { clearCustomerSessionAuthCache, requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { updateCustomerStatusRelational } from "@/lib/stores/customer-store";
import type { Customer } from "@/lib/types";
import type { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; customerId: string }> }
) {
  const { siteId, customerId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:customer-status:${customerId}` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { status?: Customer["status"] };
  if (!body.status) {
    return NextResponse.json({ error: "missing_customer_status" }, { status: 400 });
  }

  try {
    const result = await updateCustomerStatusRelational({ siteId, customerId, status: body.status });
    clearCustomerSessionAuthCache(siteId, customerId);
    invalidateAdminCustomersPageCache(siteId);
    return NextResponse.json({ ok: true, customer: result.customer });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "customer_status_update_failed" }, { status });
  }
}
