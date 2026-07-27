import { NextResponse } from "next/server";
import { invalidateAdminCustomersPageCache } from "@/lib/admin-customers-page-cache";
import { clearCustomerSessionAuthCache, requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { updateCustomerPasswordRelational } from "@/lib/stores/customer-store";
import type { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; customerId: string }> }
) {
  const { siteId, customerId } = await params;
  const guard = await requireSiteMutation(request, siteId, {
    roles: ["owner", "admin"],
    key: `${siteId}:customer-password:${customerId}`
  });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!body.password?.trim()) {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }

  try {
    const result = await updateCustomerPasswordRelational({
      siteId,
      customerId,
      password: body.password
    });
    clearCustomerSessionAuthCache(siteId, customerId);
    invalidateAdminCustomersPageCache(siteId);
    return NextResponse.json({ ok: true, customer: result.customer });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "customer_password_update_failed" }, { status });
  }
}
