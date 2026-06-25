import { NextResponse } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { canPublishPaidProducts } from "@/lib/billing";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { completeAdminCheckoutRelational, startCustomerCheckoutRelational } from "@/lib/stores/billing-store";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { mapProduct } from "@/lib/stores/prisma-mappers";
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
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      connect: true,
      products: { include: { prices: true } }
    }
  });
  if (!site) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }
  if (!body.customerId || !body.priceId) {
    return NextResponse.json({ error: "missing_customer_or_price" }, { status: 400 });
  }
  const guard = await requireCustomerMutation(request, siteId, body.customerId, { rateLimit: RATE_LIMITS.checkout, key: `${siteId}:${body.customerId}:checkout` });
  if (!guard.ok) return guard.response;
  const price = await prisma.price.findFirst({
    where: { siteId, id: body.priceId },
    select: { id: true, interval: true, stripePriceId: true }
  }).catch(() => null);
  if (!price) {
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

  const allowed = canPublishPaidProducts(Boolean(site.connect?.chargesEnabled), site.products.map(mapProduct));
  if (!allowed.ok) {
    return NextResponse.json({ error: "connect_not_ready", checkoutStatus: "payment_provider_not_ready", message: allowed.reason }, { status: 409 });
  }

  let checkout;
  try {
    checkout = await startCustomerCheckoutRelational({
      siteId,
      customerId: body.customerId,
      priceId: body.priceId,
      intentId: body.intentId
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "checkout_start_failed" }, { status });
  }

  return NextResponse.json({
    ok: false,
    checkoutStatus: "payment_required",
    error: "payment_provider_not_enabled_for_customer",
    checkoutUrl: `https://checkout.stripe.com/c/demo_${checkout.order.id}`,
    stripeAccount: site.connect?.stripeAccountId,
    mode: price.interval === "month" ? "subscription" : "payment",
    price: checkout.price,
    order: checkout.order,
    metadata: {
      ...checkout.metadata,
      stripePriceId: price.stripePriceId ?? checkout.price.stripePriceId
    },
    note: "Checkout is contract-shaped in dev. Credits are only granted by webhook, not by this response."
  });
}
