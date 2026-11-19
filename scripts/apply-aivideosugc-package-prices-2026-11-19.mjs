#!/usr/bin/env node
// AIVideosUGC package prices apply — 2026-11-19.
// Creates the site-scoped draft Product + Price rows behind the /checkout
// page for site_aidreamcapes only: the one-month terms of the Starter, Pro
// and Studio packages ($24/$59/$129, one_time, 200/500/1200 credits) and the
// three one-time credit packs ($14/$36/$99, 100/300/1000 credits). The
// Stripe price_ id and the provider-verified checkout fields (stripePriceId,
// providerVerifiedAt, providerFingerprint) stay owned by the existing admin
// price-activation flow; this script never writes or clears them. Until
// activation the rows are not public price facts and the checkout page shows
// its activation-pending state.
// Six- and twelve-month package terms are deliberately not created: their
// monthly-delivery billing shape (subscription cycles vs one-time grant) is
// decided when the owner activates the Stripe prices, and the checkout page
// states plainly that those terms are not live yet.
//   dry run:  node scripts/apply-aivideosugc-package-prices-2026-11-19.mjs --target=local
//   apply:   node scripts/apply-aivideosugc-package-prices-2026-11-19.mjs --target=local --apply
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-package-prices-2026-11-19";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-package-prices-2026-11-19.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") {
  assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);
}

assert(Array.isArray(manifest.products) && manifest.products.length === 6, "Expected exactly six product+price entries.");
for (const entry of manifest.products) {
  assert.equal(entry.price.interval, "one_time", `Price ${entry.price.id} must be one_time.`);
  assert(entry.price.amountCents > 0, `Price ${entry.price.id} must be paid.`);
  assert(entry.price.creditsGranted > 0, `Price ${entry.price.id} must grant credits.`);
  assert(entry.product.metadata.kind === "credit_package" || entry.product.metadata.kind === "credit_pack_purchase", `Product ${entry.product.id} metadata.kind is unexpected.`);
  if (entry.product.metadata.kind === "credit_package") {
    assert(entry.product.metadata.creditsPerMonth === entry.price.creditsGranted, `Package ${entry.product.id} creditsPerMonth must match the one-month grant.`);
    assert(/^price_aidreamcapes_pkg_[a-z]+_1m$/.test(entry.price.id), `Package price id ${entry.price.id} must encode the one-month term.`);
  } else {
    assert(/^price_aidreamcapes_pack_[0-9]+$/.test(entry.price.id), `Pack price id ${entry.price.id} must match the pack convention.`);
  }
}

const db = new PrismaClient();
try {
  const site = await db.site.findUnique({ where: { id: siteId }, select: { id: true, currency: true } });
  assert(site, `Site ${siteId} does not exist on ${target}.`);
  for (const entry of manifest.products) {
    if (site.currency) {
      assert.equal(entry.price.currency, site.currency, `Site currency is ${site.currency}; refusing a ${entry.price.currency} price on ${entry.price.id}.`);
    }
    const existingProduct = await db.product.findUnique({
      where: { id: entry.product.id },
      select: { id: true, siteId: true, name: true, type: true, status: true, metadata: true }
    });
    if (existingProduct) {
      assert.equal(existingProduct.siteId, siteId, `Existing product ${entry.product.id} site mismatch.`);
      assert.equal(existingProduct.type, entry.product.type, `Product ${entry.product.id} type changed; investigate before updating.`);
    }
    const existingPrice = await db.price.findUnique({
      where: { id: entry.price.id },
      select: { id: true, siteId: true, productId: true, label: true, amountCents: true, currency: true, interval: true, creditsGranted: true, status: true, stripePriceId: true }
    });
    if (existingPrice) {
      assert.equal(existingPrice.siteId, siteId, `Existing price ${entry.price.id} site mismatch.`);
      assert.equal(existingPrice.productId, entry.product.id, `Price ${entry.price.id} belongs to another product.`);
      assert.equal(existingPrice.interval, entry.price.interval, `Price ${entry.price.id} interval changed; investigate before updating.`);
      if (existingPrice.stripePriceId) {
        console.log(`[package-prices] price ${entry.price.id} already activated with Stripe price ${existingPrice.stripePriceId}; verified fields stay untouched.`);
      }
    }
  }

  const changes = [];
  for (const entry of manifest.products) {
    const existingProduct = await db.product.findUnique({ where: { id: entry.product.id }, select: { name: true, status: true, metadata: true } });
    if (!existingProduct) changes.push(`create product ${entry.product.id} + price ${entry.price.id}`);
    else changes.push(`align product ${entry.product.id} / price ${entry.price.id}`);
  }
  console.log(`[package-prices] target=${target} site=${siteId}`);
  console.log(`[package-prices] pending changes: ${changes.join("; ")}`);

  if (!apply) {
    console.log("[package-prices] dry run — no writes. Production apply:");
    console.log(`[package-prices]   --apply --confirm=${CONFIRM_NAME}`);
  } else {
    for (const entry of manifest.products) {
      await db.product.upsert({
        where: { id: entry.product.id },
        create: { ...entry.product, siteId },
        update: { name: entry.product.name, status: entry.product.status, metadata: entry.product.metadata }
      });
      // Never touch the provider-verified checkout fields on an existing price.
      const priceUpdate = {
        label: entry.price.label,
        amountCents: entry.price.amountCents,
        currency: entry.price.currency,
        interval: entry.price.interval,
        creditsGranted: entry.price.creditsGranted,
        status: entry.price.status
      };
      await db.price.upsert({
        where: { id: entry.price.id },
        create: { ...entry.price, siteId, productId: entry.product.id },
        update: priceUpdate
      });
    }
    for (const entry of manifest.products) {
      const price = await db.price.findUnique({ where: { id: entry.price.id }, select: { amountCents: true, creditsGranted: true, interval: true, status: true, stripePriceId: true } });
      assert(price && price.amountCents === entry.price.amountCents && price.creditsGranted === entry.price.creditsGranted, `Readback mismatch on ${entry.price.id}.`);
      console.log(`[package-prices] applied ${entry.price.id}: ${price.amountCents} cents, ${price.creditsGranted} credits, ${price.interval}${price.stripePriceId ? ", activated" : ", awaiting activation"}.`);
    }
    console.log("[package-prices] readback verified. Activate each price from the admin price flow (Stripe price id + verification) to make checkout live.");
  }
} finally {
  await db.$disconnect();
}
