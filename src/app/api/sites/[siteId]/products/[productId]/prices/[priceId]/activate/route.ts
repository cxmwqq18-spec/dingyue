import { NextResponse } from "next/server";

import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { activateProductPriceRelational } from "@/lib/stores/billing-store";
import { FakeStripePriceAdapter } from "@/lib/stripe-price-verification";
import type { Price } from "@/lib/types";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; productId: string; priceId: string }> }
) {
  const { siteId, productId, priceId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:price-activate:${priceId}` });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => ({})) as { providerSnapshot?: { id: string; amountCents: number; currency: string; interval: Price["interval"]; active?: boolean } };
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "stripe_read_adapter_not_configured" }, { status: 503 });
  if (!body.providerSnapshot) return NextResponse.json({ error: "fake_provider_snapshot_required" }, { status: 400 });
  try {
    const result = await activateProductPriceRelational({
      siteId,
      productId,
      priceId,
      adapter: new FakeStripePriceAdapter(body.providerSnapshot ? [body.providerSnapshot] : [])
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 409;
    return NextResponse.json({ error: error instanceof Error ? error.message : "price_activation_failed" }, { status });
  }
}
