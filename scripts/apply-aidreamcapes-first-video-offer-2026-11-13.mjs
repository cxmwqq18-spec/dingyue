#!/usr/bin/env node
// AIVideosUGC first-video trial offer apply — 2026-11-13.
// Creates the site-scoped one-time Product + Price behind the "new customer
// $1 first video" offer for site_aidreamcapes only: a $1 (amountCents 100)
// one_time price granting 8 credits, with product metadata.kind
// "first_video_trial" so the checkout route can branch on it and the Stripe
// webhook can mark the purchased FirstVideoOffer. The Stripe price_ id and the
// provider-verified checkout fields (stripePriceId, providerVerifiedAt,
// providerFingerprint) stay owned by the existing admin price-activation flow;
// this script never writes or clears them.
//   dry run:  node scripts/apply-aidreamcapes-first-video-offer-2026-11-13.mjs --target=local
//   apply:    node scripts/apply-aidreamcapes-first-video-offer-2026-11-13.mjs --target=local --apply
//   production apply additionally requires the explicit confirm name.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-first-video-offer-2026-11-13";
const MANIFEST_PATH = new URL("./manifests/aidreamcapes-first-video-offer-2026-11-13.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});
if (apply && target === "production") {
  assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);
}

const productManifest = manifest.product;
const priceManifest = manifest.price;
assert.equal(priceManifest.interval, "one_time", "The first-video offer must stay a one_time price.");
assert(priceManifest.amountCents > 0, "The first-video offer price must be paid (amountCents > 0).");
assert.equal(priceManifest.creditsGranted, 8, "The first-video offer grants exactly 8 credits.");
assert.equal(productManifest.metadata.kind, "first_video_trial", "Product metadata.kind must mark the first_video_trial offer.");

const db = new PrismaClient();
try {
  const site = await db.site.findUnique({ where: { id: siteId }, select: { id: true, currency: true } });
  assert(site, `Site ${siteId} does not exist on ${target}.`);
  if (site.currency) {
    assert.equal(priceManifest.currency, site.currency, `Site currency is ${site.currency}; refusing a ${priceManifest.currency} offer price.`);
  }

  const existingProduct = await db.product.findUnique({
    where: { id: productManifest.id },
    select: { id: true, siteId: true, name: true, type: true, status: true, metadata: true }
  });
  if (existingProduct) {
    assert.equal(existingProduct.siteId, siteId, "Existing product site mismatch.");
    assert.equal(existingProduct.type, productManifest.type, "Existing product type changed; investigate before updating.");
    console.log(`[first-video-offer] product ${productManifest.id} exists (name "${existingProduct.name}"); will update name/metadata.`);
  } else {
    console.log(`[first-video-offer] would create product ${productManifest.id} (name "${productManifest.name}", type ${productManifest.type}).`);
  }

  const existingPrice = await db.price.findUnique({
    where: { id: priceManifest.id },
    select: {
      id: true, siteId: true, productId: true, label: true, amountCents: true, currency: true,
      interval: true, creditsGranted: true, status: true, stripePriceId: true,
      providerVerifiedAt: true, providerFingerprint: true, effectiveFrom: true, effectiveTo: true
    }
  });
  if (existingPrice) {
    assert.equal(existingPrice.siteId, siteId, "Existing price site mismatch.");
    assert.equal(existingPrice.productId, productManifest.id, "Existing price belongs to another product.");
    assert.equal(existingPrice.interval, priceManifest.interval, "Existing price interval changed; investigate before updating.");
    if (existingPrice.stripePriceId) {
      console.log(`[first-video-offer] price ${priceManifest.id} already activated with Stripe price ${existingPrice.stripePriceId}; verified fields stay untouched.`);
    }
    console.log(`[first-video-offer] price ${priceManifest.id} exists (amount ${existingPrice.amountCents}, credits ${existingPrice.creditsGranted}); will align commercial fields.`);
  } else {
    console.log(`[first-video-offer] would create price ${priceManifest.id} (${priceManifest.amountCents} ${priceManifest.currency}, ${priceManifest.interval}, creditsGranted ${priceManifest.creditsGranted}).`);
  }

  const changes = [];
  if (!existingProduct) changes.push(`create product ${productManifest.id}`);
  else {
    if (existingProduct.name !== productManifest.name) changes.push(`product name "${existingProduct.name}" -> "${productManifest.name}"`);
    if (JSON.stringify(existingProduct.metadata ?? {}) !== JSON.stringify(productManifest.metadata)) changes.push("product metadata");
    if (existingProduct.status !== productManifest.status) changes.push(`product status ${existingProduct.status} -> ${productManifest.status}`);
  }
  if (!existingPrice) changes.push(`create price ${priceManifest.id}`);
  else {
    for (const field of ["label", "amountCents", "currency", "creditsGranted", "status"]) {
      if (existingPrice[field] !== priceManifest[field]) changes.push(`price ${field} ${JSON.stringify(existingPrice[field])} -> ${JSON.stringify(priceManifest[field])}`);
    }
  }
  console.log(`[first-video-offer] target=${target} site=${siteId}`);
  console.log(changes.length ? `[first-video-offer] pending changes: ${changes.join("; ")}` : "[first-video-offer] already in the desired shape; no changes.");

  if (!apply) {
    console.log("[first-video-offer] dry run — no writes. Production apply:");
    console.log(`[first-video-offer]   --apply --confirm=${CONFIRM_NAME}`);
  } else {
    await db.product.upsert({
      where: { id: productManifest.id },
      create: { ...productManifest, siteId },
      update: { name: productManifest.name, status: productManifest.status, metadata: productManifest.metadata }
    });
    // Never touch the provider-verified checkout fields on an existing price.
    const priceUpdate = {
      label: priceManifest.label,
      amountCents: priceManifest.amountCents,
      currency: priceManifest.currency,
      interval: priceManifest.interval,
      creditsGranted: priceManifest.creditsGranted,
      status: priceManifest.status
    };
    await db.price.upsert({
      where: { id: priceManifest.id },
      create: { ...priceManifest, siteId, productId: productManifest.id },
      update: priceUpdate
    });

    const productReadback = await db.product.findUnique({ where: { id: productManifest.id }, select: { siteId: true, name: true, type: true, status: true, metadata: true } });
    assert(productReadback && productReadback.siteId === siteId, "Product readback site mismatch.");
    assert.equal(productReadback.type, productManifest.type, "Product readback type mismatch.");
    assert.equal(productReadback.metadata?.kind, "first_video_trial", "Product readback metadata.kind mismatch.");
    const priceReadback = await db.price.findUnique({ where: { id: priceManifest.id }, select: { siteId: true, productId: true, amountCents: true, currency: true, interval: true, creditsGranted: true, status: true, stripePriceId: true } });
    assert(priceReadback && priceReadback.siteId === siteId && priceReadback.productId === productManifest.id, "Price readback mismatch.");
    assert.equal(priceReadback.amountCents, priceManifest.amountCents, "Price readback amountCents mismatch.");
    assert.equal(priceReadback.creditsGranted, priceManifest.creditsGranted, "Price readback creditsGranted mismatch.");
    assert.equal(priceReadback.interval, "one_time", "Price readback interval mismatch.");
    console.log(`[first-video-offer] applied; readback verified (stripePriceId ${priceReadback.stripePriceId ?? "pending admin activation"}).`);
  }
} finally {
  await db.$disconnect();
}
