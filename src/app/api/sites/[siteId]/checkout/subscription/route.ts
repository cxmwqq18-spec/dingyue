import { NextResponse } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { canPublishPaidProducts } from "@/lib/billing";
import { completeAdminCheckoutRelational, startCustomerCheckoutRelational } from "@/lib/stores/billing-store";
import { firstVideoOfferPurchaseEligibility } from "@/lib/stores/first-video-offer-store";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { mapProduct } from "@/lib/stores/prisma-mappers";
import { createStripeCheckoutSession, stripeCheckoutReadiness } from "@/lib/stripe-checkout";
import { isPublicPriceFact } from "@/lib/storefront-context";
import type { NextRequest } from "next/server";

const CHECKOUT_RETRY_RATE_LIMIT = { windowMs: 60000, maxRequests: 12, keyPrefix: "checkout" };

function checkoutModeForInterval(interval: string): "subscription" | "payment" {
  return interval === "one_time" ? "payment" : "subscription";
}

/** The $1 first-video offer is keyed on the product row, never on a client hint. */
function isFirstVideoTrialProduct(metadata: unknown): boolean {
  return (metadata as { kind?: string } | null)?.kind === "first_video_trial";
}

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
  const checkoutRateKey = body.intentId
    ? `${siteId}:${body.customerId}:checkout:${body.intentId.trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 120)}`
    : `${siteId}:${body.customerId}:checkout`;
  const guard = await requireCustomerMutation(request, siteId, body.customerId, { rateLimit: CHECKOUT_RETRY_RATE_LIMIT, key: checkoutRateKey });
  if (!guard.ok) return guard.response;
  const price = await prisma.price.findFirst({
    where: { siteId, id: body.priceId },
    select: { id: true, interval: true, stripePriceId: true, status: true, amountCents: true, currency: true, effectiveFrom: true, effectiveTo: true, providerVerifiedAt: true, providerFingerprint: true, product: { select: { metadata: true } } }
  }).catch(() => null);
  if (!price) {
    return NextResponse.json({ error: "price_not_found_for_site" }, { status: 404 });
  }
  const now = Date.now();
  if (!isPublicPriceFact(price, new Date(now), site.currency)) {
    return NextResponse.json({ error: "price_not_public" }, { status: 409 });
  }
  const firstVideoTrial = isFirstVideoTrialProduct(price.product?.metadata);
  if (firstVideoTrial) {
    const eligibility = await firstVideoOfferPurchaseEligibility(siteId, body.customerId);
    if (!eligibility.eligible) {
      return NextResponse.json({ error: "first_video_offer_ineligible", reason: eligibility.reason }, { status: 403 });
    }
  }
  const checkoutMode = checkoutModeForInterval(price.interval);

  const customerEmail = guard.current.customer.email.trim().toLowerCase();
  const admin = await prisma.siteAdmin.findFirst({
    where: {
      siteId,
      email: customerEmail,
      role: { in: ["owner", "admin"] }
    },
    select: { id: true, email: true, role: true }
  }).catch(() => null);

  // Admin comp cannot fulfill the trial: the FirstVideoOffer row is created by
  // the Stripe webhook, so this product always goes through real payment.
  if (admin && !firstVideoTrial) {
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

  const preflightStripeReady = stripeCheckoutReadiness({
    stripeAccountId: site.connect?.stripeAccountId,
    stripePriceId: price.stripePriceId
  });
  if (!preflightStripeReady.ok || !site.connect?.stripeAccountId) {
    return NextResponse.json({
      ok: false,
      checkoutStatus: "payment_provider_not_ready",
      error: "payment_provider_not_enabled_for_customer",
      checkoutUrl: undefined,
      stripeAccount: site.connect?.stripeAccountId,
      mode: checkoutMode,
      metadata: {
        siteId,
        customerId: body.customerId,
        priceId: price.id,
        stripePriceId: price.stripePriceId ?? ""
      },
      note: `${preflightStripeReady.ok ? "Stripe checkout is ready." : preflightStripeReady.reason} Credits are granted by webhook after payment.`
    }, { status: 409 });
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

  try {
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const session = await createStripeCheckoutSession({
      siteId,
      siteSlug: site.slug,
      customer: checkout.customer,
      price: checkout.price,
      order: checkout.order,
      stripeAccountId: site.connect.stripeAccountId,
      origin,
      mode: checkoutMode,
      metadata: {
        ...checkout.metadata,
        ...(firstVideoTrial ? { kind: "first_video_trial" } : {}),
        stripePriceId: checkout.price.stripePriceId ?? price.stripePriceId ?? ""
      },
      ...(firstVideoTrial ? {
        successUrl: `${origin}/site/${site.slug}/app/create/starter-offer?checkout=success&order=${checkout.order.id}`,
        cancelUrl: `${origin}/site/${site.slug}/app/create/starter-offer?checkout=cancelled`
      } : {})
    });
    return NextResponse.json({
      ok: true,
      checkoutStatus: "payment_required",
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
      stripeAccount: site.connect.stripeAccountId,
      mode: checkoutMode,
      price: checkout.price,
      order: checkout.order,
      metadata: {
        ...checkout.metadata,
        stripePriceId: checkout.price.stripePriceId ?? price.stripePriceId
      },
      note: "Stripe Checkout Session created. Credits are granted by webhook after payment."
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      checkoutStatus: "payment_provider_error",
      error: error instanceof Error ? error.message : "stripe_checkout_session_failed",
      order: checkout.order
    }, { status: 502 });
  }
}
