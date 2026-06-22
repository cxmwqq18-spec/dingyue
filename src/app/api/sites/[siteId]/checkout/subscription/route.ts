import { NextResponse } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { buildCheckoutMetadata, canPublishPaidProducts } from "@/lib/billing";
import { getSiteProductsFromState, readPlatformState } from "@/lib/server-store";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const body = (await request.json().catch(() => ({}))) as { customerId?: string; priceId?: string };
  const state = readPlatformState();
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }
  const allowed = canPublishPaidProducts(site.connect.chargesEnabled, getSiteProductsFromState(state, site.id));
  if (!allowed.ok) {
    return NextResponse.json({ error: "connect_not_ready", message: allowed.reason }, { status: 409 });
  }
  if (!body.customerId || !body.priceId) {
    return NextResponse.json({ error: "missing_customer_or_price" }, { status: 400 });
  }
  const guard = await requireCustomerMutation(request, siteId, body.customerId, { rateLimit: RATE_LIMITS.checkout, key: `${siteId}:${body.customerId}:checkout` });
  if (!guard.ok) return guard.response;
  const customer = state.customers.find((item) => item.siteId === siteId && item.id === body.customerId);
  const price = state.products.flatMap((product) => product.prices).find((item) => item.siteId === siteId && item.id === body.priceId);
  if (!customer || !price) {
    return NextResponse.json({ error: "customer_or_price_not_found_for_site" }, { status: 404 });
  }
  return NextResponse.json({
    checkoutUrl: `https://checkout.stripe.com/c/demo_${body.priceId}`,
    stripeAccount: site.connect.stripeAccountId,
    mode: price.interval === "month" ? "subscription" : "payment",
    metadata: buildCheckoutMetadata(site.id, body.customerId, body.priceId),
    note: "Checkout is contract-shaped in dev. Credits are only granted by webhook, not by this response."
  });
}
