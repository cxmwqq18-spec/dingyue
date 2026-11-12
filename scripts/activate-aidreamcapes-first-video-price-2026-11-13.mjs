#!/usr/bin/env node
// AIVideosUGC first-video offer — Stripe price activation, 2026-11-13.
// Completes what the seed intentionally leaves pending: a real Stripe price on
// the site's connected account plus the verification fields checkout requires
// (stripePriceId / providerVerifiedAt / providerFingerprint). Idempotent — a
// verified price is read back from Stripe and left untouched.
//
// Needs STRIPE_SECRET_KEY in the environment, so run it on the app server:
//   node scripts/activate-aidreamcapes-first-video-price-2026-11-13.mjs            (dry run)
//   node scripts/activate-aidreamcapes-first-video-price-2026-11-13.mjs --apply --confirm=aivideosugc-first-video-activation-2026-11-13
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-first-video-activation-2026-11-13";
const SITE_ID = "site_aidreamcapes";
const PRICE_ID = "price_aidreamcapes_first_video";
const STRIPE_PRODUCT_NAME = "First Video — $1";

const apply = hasArgument("--apply");
assert(hasArgument(`--confirm=${CONFIRM_NAME}`), `Writes require --confirm=${CONFIRM_NAME} (pass --apply to actually write).`);

const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
assert(stripeKey, "STRIPE_SECRET_KEY is required (run on the app server).");

const db = new PrismaClient();
const stripeHeaders = { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" };

async function stripeForm(path, form) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: form ? "POST" : "GET",
    headers: stripeKey ? { ...stripeHeaders } : {},
    body: form,
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `stripe ${form ? "POST" : "GET"} ${path} failed: ${payload.error?.message ?? response.status}`);
  return payload;
}

function fingerprintOf(priceSnapshot) {
  return crypto.createHash("sha256").update(JSON.stringify({
    id: priceSnapshot.id,
    amountCents: priceSnapshot.amountCents,
    currency: priceSnapshot.currency.toLowerCase(),
    interval: priceSnapshot.interval
  })).digest("hex");
}

try {
  const [site, price] = await Promise.all([
    db.site.findUnique({ where: { id: SITE_ID }, select: { connect: true, currency: true } }),
    db.price.findUnique({ where: { id: PRICE_ID }, select: { id: true, siteId: true, productId: true, amountCents: true, currency: true, interval: true, creditsGranted: true, status: true, stripePriceId: true, providerVerifiedAt: true, providerFingerprint: true, effectiveFrom: true, effectiveTo: true } })
  ]);
  assert(site, "site not found");
  assert(price && price.siteId === SITE_ID, `price ${PRICE_ID} missing — run the seed script first`);
  const accountId = site.connect?.stripeAccountId;
  assert(accountId?.startsWith("acct_"), "site has no connected Stripe account");

  const accountHeaders = { ...stripeHeaders, "Stripe-Account": accountId };

  if (price.stripePriceId && price.providerVerifiedAt && price.providerFingerprint) {
    const snapshot = await stripeForm(`prices/${price.stripePriceId}`, null);
    assert(snapshot.unit_amount === price.amountCents && snapshot.currency === price.currency && snapshot.active !== false, "existing stripe price drifted from DB row");
    console.log(`[first-video-activation] already active: ${price.stripePriceId} — nothing to do.`);
    process.exit(0);
  }

  // Find-or-create the Stripe product by metadata kind on the connected account.
  const productList = await stripeForm("products?active=true&limit=100", null);
  let stripeProductId = (productList.data ?? []).find((item) => item.metadata?.kind === "first_video_trial")?.id;
  if (!stripeProductId) {
    assert(apply, "dry run: would create Stripe product");
    const created = await stripeForm("products", new URLSearchParams({ name: STRIPE_PRODUCT_NAME, "metadata[kind]": "first_video_trial" }));
    stripeProductId = created.id;
    console.log(`[first-video-activation] created stripe product ${stripeProductId}`);
  } else {
    console.log(`[first-video-activation] reusing stripe product ${stripeProductId}`);
  }

  // Find-or-create the $1 one-time price under that product.
  const priceList = await stripeForm(`prices?product=${stripeProductId}&active=true&limit=100`, null);
  let stripePriceId = (priceList.data ?? []).find((item) => item.unit_amount === price.amountCents && item.currency === price.currency && !item.recurring)?.id;
  if (!stripePriceId) {
    assert(apply, "dry run: would create Stripe price (usd $1, one_time)");
    const created = await stripeForm("prices", new URLSearchParams({ product: stripeProductId, unit_amount: String(price.amountCents), currency: price.currency }));
    stripePriceId = created.id;
    console.log(`[first-video-activation] created stripe price ${stripePriceId}`);
  } else {
    console.log(`[first-video-activation] reusing stripe price ${stripePriceId}`);
  }

  const snapshot = await stripeForm(`prices/${stripePriceId}`, null);
  assert(snapshot.unit_amount === price.amountCents && snapshot.currency === price.currency && !snapshot.recurring && snapshot.active !== false, "stripe price mismatch after ensure");
  const fingerprint = fingerprintOf({ id: snapshot.id, amountCents: snapshot.unit_amount, currency: snapshot.currency, interval: price.interval });

  if (apply) {
    const now = new Date();
    const row = await db.price.update({
      where: { id: PRICE_ID },
      data: { stripePriceId, providerVerifiedAt: now, providerFingerprint: fingerprint, effectiveFrom: price.effectiveFrom ?? now, effectiveTo: null }
    });
    assert(row.stripePriceId === stripePriceId && row.providerVerifiedAt, "price activation write failed");
    console.log(`[first-video-activation] activated price_aidreamcapes_first_video -> ${stripePriceId}`);
  } else {
    console.log(`[first-video-activation] dry run: would activate price_aidreamcapes_first_video -> ${stripePriceId}`);
  }
} finally {
  await db.$disconnect();
}
