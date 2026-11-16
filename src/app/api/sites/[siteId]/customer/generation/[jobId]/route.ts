import { NextResponse } from "next/server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { readGenerationDetail } from "@/lib/stores/credit-ledger-context";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ siteId: string; jobId: string }> };

/**
 * The generation detail sheet: the brief, shot outline, and finished media of
 * one account generation request.
 */
export async function GET(_request: NextRequest, { params }: Context) {
  const { jobId, siteId } = await params;
  const current = await getCurrentCustomerForSite(siteId);
  if (!current) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(jobId)) {
    return NextResponse.json({ error: "generation_invalid" }, { status: 400 });
  }
  const generation = await readGenerationDetail({ customerId: current.customer.id, jobId, siteId });
  if (!generation) {
    return NextResponse.json({ error: "generation_not_found" }, { status: 404 });
  }
  return NextResponse.json({ generation }, { headers: { "Cache-Control": "private, no-store" } });
}
