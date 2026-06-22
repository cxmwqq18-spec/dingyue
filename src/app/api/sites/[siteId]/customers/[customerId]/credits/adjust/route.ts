import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { adjustCustomerCredits, StoreError, toPublicCustomer } from "@/lib/server-store";
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
