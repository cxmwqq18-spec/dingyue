import { NextResponse } from "next/server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { readCreditEntryDetail } from "@/lib/stores/credit-ledger-context";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ siteId: string; entryId: string }> };

/**
 * The credit entry detail sheet: the generation a ledger movement paid for,
 * its prompt and shot outline, and the finished video.
 */
export async function GET(_request: NextRequest, { params }: Context) {
  const { entryId, siteId } = await params;
  const current = await getCurrentCustomerForSite(siteId);
  if (!current) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(entryId)) {
    return NextResponse.json({ error: "credit_entry_invalid" }, { status: 400 });
  }
  const detail = await readCreditEntryDetail({ customerId: current.customer.id, entryId, siteId });
  if (!detail) {
    return NextResponse.json({ error: "credit_entry_not_found" }, { status: 404 });
  }
  const { entry: _entry, ...generation } = detail;
  return NextResponse.json({ generation }, { headers: { "Cache-Control": "private, no-store" } });
}
