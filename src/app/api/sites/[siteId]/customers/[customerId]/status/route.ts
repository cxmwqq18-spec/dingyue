import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { updateCustomerStatusRelational } from "@/lib/stores/customer-store";
import type { Customer } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; customerId: string }> }
) {
  const { siteId, customerId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { status?: Customer["status"] };
  if (!body.status) {
    return NextResponse.json({ error: "missing_customer_status" }, { status: 400 });
  }

  try {
    const result = await updateCustomerStatusRelational({ siteId, customerId, status: body.status });
    return NextResponse.json({ ok: true, customer: result.customer });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "customer_status_update_failed" }, { status });
  }
}
