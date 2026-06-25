import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { adjustCustomerCreditsRelational } from "@/lib/stores/billing-store";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; customerId: string }> }
) {
  const { siteId, customerId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:credits-adjust` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as {
    amount?: number;
    reason?: string;
    actor?: string;
  };
  const amount = Number(body.amount);
  const reason = body.reason?.trim() ?? "";
  if (!Number.isInteger(amount) || amount === 0) {
    return NextResponse.json({ error: "invalid_adjustment_amount" }, { status: 400 });
  }
  if (reason.length < 3) {
    return NextResponse.json({ error: "adjustment_reason_required" }, { status: 400 });
  }

  try {
    const result = await adjustCustomerCreditsRelational({
      siteId,
      customerId,
      amount,
      reason,
      actor: body.actor
    });
    return NextResponse.json({ ok: true, customer: result.customer, ledgerAction: result.ledger });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "credit_adjustment_failed" }, { status });
  }
}
