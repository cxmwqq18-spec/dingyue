import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { adjustCustomerCredits, StoreError, toPublicCustomer } from "@/lib/server-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string; customerId: string }> }
) {
  const { siteId, customerId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    amount?: number;
    reason?: string;
    actor?: string;
  };

  try {
    const result = adjustCustomerCredits({
      siteId,
      customerId,
      amount: Number(body.amount),
      reason: body.reason ?? "",
      actor: body.actor
    });
    return NextResponse.json({ ok: true, customer: toPublicCustomer(result.customer), ledgerAction: result.ledger });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "credit_adjustment_failed" }, { status });
  }
}
