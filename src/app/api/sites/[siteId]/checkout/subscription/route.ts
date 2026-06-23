import { NextResponse } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { buildCheckoutMetadata, canPublishPaidProducts } from "@/lib/billing";
import { getSiteProductsFromState, readPlatformState } from "@/lib/server-store";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { completeAdminCheckoutRelational } from "@/lib/stores/billing-store";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import type { NextRequest } from "next/server";

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "HEAD,POST,OPTIONS" }
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const body = (await request.json().catch(() => ({}))) as { customerId?: string; priceId?: string; intentId?: string };
  const state = readPlatformState();
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }
  if (!body.customerId || !body.priceId) {
    return NextResponse.json({ error: "missing_customer_or_price" }, { status: 400 });
  }
  const guard = await requireCustomerMutation(request, siteId, body.customerId, { rateLimit: RATE_LIMITS.checkout, key: `${siteId}:${body.customerId}:checkout` });
  if (!guard.ok) return guard.response;
  const statePrice = state.products.flatMap((product) => product.prices).find((item) => item.siteId === siteId && item.id === body.priceId);
  const relationalPrice = statePrice
    ? undefined
    : await prisma.price.findFirst({
        where: { siteId, id: body.priceId },
        select: { id: true, interval: true }
      }).catch(() => null);
  if (!statePrice && !relationalPrice) {
    return NextResponse.json({ error: "price_not_found_for_site" }, { status: 404 });
  }

  const customerEmail = guard.current.customer.email.trim().toLowerCase();
  const admin = await prisma.siteAdmin.findFirst({
    where: {
      siteId,
      email: customerEmail,
      role: { in: ["owner", "admin"] }
    },
    select: { id: true, email: true, role: true }
  }).catch(() => null);

  if (admin) {
    try {
      const result = await completeAdminCheckoutRelational({
        siteId,
        customerId: body.customerId,
        priceId: body.priceId,
        actor: `site_admin:${admin.id}`,
        intentId: body.intentId
      });
      return NextResponse.json({
        ok: true,
        mode: "admin_comp_checkout",
        checkoutStatus: "fulfilled",
        customer: result.customer,
        order: result.order,
        ledgerAction: result.ledger,
        subscription: result.subscription,
        grantedCredits: result.grantedCredits,
        note: "Site admin customer completed checkout without online payment. Credits were granted through the real ledger."
      });
    } catch (error) {
      const status = error instanceof StoreError ? error.status : 500;
      return NextResponse.json({ error: error instanceof Error ? error.message : "admin_checkout_failed" }, { status });
    }
  }

  const allowed = canPublishPaidProducts(site.connect.chargesEnabled, getSiteProductsFromState(state, site.id));
  if (!allowed.ok) {
    return NextResponse.json({ error: "connect_not_ready", checkoutStatus: "payment_provider_not_ready", message: allowed.reason }, { status: 409 });
  }

  return NextResponse.json({
    ok: false,
    checkoutStatus: "payment_required",
    error: "payment_provider_not_enabled_for_customer",
    checkoutUrl: `https://checkout.stripe.com/c/demo_${body.priceId}`,
    stripeAccount: site.connect.stripeAccountId,
    mode: (statePrice?.interval ?? relationalPrice?.interval) === "month" ? "subscription" : "payment",
    metadata: buildCheckoutMetadata(site.id, body.customerId, body.priceId),
    note: "Checkout is contract-shaped in dev. Credits are only granted by webhook, not by this response."
  });
}
