#!/usr/bin/env node
// AIVideosUGC checkout CTA apply — 2026-11-19.
// Field-level update on the /pricing and / LivePage rows for site_aidreamcapes
// only: every package card button (data.tiers[*].ctaHref) and credit-pack
// button (data.packs[*].href) on /pricing, plus the homepage package buttons
// (settings.data.pricingPackages.tiers[*].ctaHref), now point at the
// /checkout plan-confirmation page that carries the chosen plan in the
// address. Terms stay selectable on the checkout page itself; nothing else on
// either row changes.
//   dry run:  node scripts/apply-aivideosugc-checkout-cta-2026-11-19.mjs --target=local
//   apply:   node scripts/apply-aivideosugc-checkout-cta-2026-11-19.mjs --target=local --apply
//   production apply additionally requires the explicit confirm name and the
//   base hashes from a fresh production dry run.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-checkout-cta-2026-11-19";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-checkout-cta-2026-11-19.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") {
  assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);
}

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

const expectedTierIds = Object.keys(manifest.pricing.tierCtaHrefs);
const expectedPackIds = Object.keys(manifest.pricing.packHrefs);
const previousWorkspaceEntry = (value) => typeof value === "string" && value.startsWith("/app/create");

const db = new PrismaClient();
try {
  const slugs = [manifest.pricing.slug, manifest.home.slug];
  const rows = await db.livePage.findMany({
    where: { siteId, slug: { in: slugs } },
    select: { id: true, siteId: true, slug: true, contentJson: true, updatedAt: true }
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  for (const slug of slugs) assert(bySlug.has(slug), `LivePage ${slug} does not exist on ${target}.`);

  const plans = {};

  {
    const row = bySlug.get(manifest.pricing.slug);
    if (argumentValue("--base-hash-pricing")) {
      assert.equal(hash(row.contentJson), argumentValue("--base-hash-pricing"), `/pricing contentJson changed since the reviewed dry run; refusing to apply.`);
    }
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const data = contentJson.sections?.v2_main?.settings?.data;
    assert(data, "Pricing data shape changed.");
    assert(Array.isArray(data.tiers) && data.tiers.length === 3, "Pricing tiers missing; run the base pricing apply first.");
    assert(Array.isArray(data.packs) && data.packs.length === 3, "Pricing packs missing.");
    const before = { h1: data.h1, costs: stable(data.costs), tiersShape: data.tiers.map((tier) => [tier.id, Object.keys(tier.terms ?? {})].join("|")).join(";") };

    for (const tier of data.tiers) {
      assert(expectedTierIds.includes(tier.id), `Unexpected tier id ${tier.id}.`);
      assert(previousWorkspaceEntry(tier.ctaHref), `Tier ${tier.id} ctaHref is ${JSON.stringify(tier.ctaHref)}; expected an /app/create workspace entry. Re-run the dry run against this target.`);
      tier.ctaHref = manifest.pricing.tierCtaHrefs[tier.id];
    }
    for (const pack of data.packs) {
      assert(expectedPackIds.includes(pack.id), `Unexpected pack id ${pack.id}.`);
      assert(previousWorkspaceEntry(pack.href), `Pack ${pack.id} href is ${JSON.stringify(pack.href)}; expected an /app/create workspace entry. Re-run the dry run against this target.`);
      pack.href = manifest.pricing.packHrefs[pack.id];
    }

    assert.equal(data.h1, before.h1, "h1 changed; not allowed.");
    assert.equal(stable(data.costs), before.costs, "costs table changed; not allowed by this manifest.");
    assert.equal(data.tiers.map((tier) => [tier.id, Object.keys(tier.terms ?? {})].join("|")).join(";"), before.tiersShape, "Tier term shapes changed; not allowed.");
    assert(data.tiers.every((tier) => tier.ctaHref.startsWith("/checkout?plan=")), "Every tier ctaHref must carry the plan in the address.");
    assert(data.packs.every((pack) => pack.href.startsWith("/checkout?pack=")), "Every pack href must carry the pack in the address.");
    plans[manifest.pricing.slug] = contentJson;
  }

  {
    const row = bySlug.get(manifest.home.slug);
    if (argumentValue("--base-hash-home")) {
      assert.equal(hash(row.contentJson), argumentValue("--base-hash-home"), `/ contentJson changed since the reviewed dry run; refusing to apply.`);
    }
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const settings = contentJson.sections?.v2_main?.settings;
    assert(settings?.data, "Homepage data shape changed.");
    const tiers = settings.data.pricingPackages?.tiers;
    assert(Array.isArray(tiers) && tiers.length === 3, "Homepage pricingPackages tiers missing; run the base pricing apply first.");
    const before = { h1: settings.data.h1, blockOrder: stable(settings.data.blockOrder), hero: stable(settings.data.hero) };

    for (const tier of tiers) {
      assert(expectedTierIds.includes(tier.id), `Unexpected homepage tier id ${tier.id}.`);
      assert(previousWorkspaceEntry(tier.ctaHref), `Homepage tier ${tier.id} ctaHref is ${JSON.stringify(tier.ctaHref)}; expected an /app/create workspace entry. Re-run the dry run against this target.`);
      tier.ctaHref = manifest.home.tierCtaHrefs[tier.id];
    }

    assert.equal(settings.data.h1, before.h1, "Homepage h1 changed; not allowed.");
    assert.equal(stable(settings.data.blockOrder), before.blockOrder, "Homepage blockOrder changed; not allowed.");
    assert.equal(stable(settings.data.hero), before.hero, "Homepage hero changed; not allowed.");
    assert(tiers.every((tier) => tier.ctaHref.startsWith("/checkout?plan=")), "Every homepage tier ctaHref must carry the plan in the address.");
    plans[manifest.home.slug] = contentJson;
  }

  console.log(`[checkout-cta-apply] target=${target} site=${siteId}`);
  for (const [slug, contentJson] of Object.entries(plans)) {
    console.log(`[checkout-cta-apply] ${slug} base-hash=${hash(bySlug.get(slug).contentJson)} next-hash=${hash(contentJson)}`);
  }
  if (!apply) {
    console.log("[checkout-cta-apply] dry run — no writes.");
    console.log("[checkout-cta-apply] production apply:");
    console.log(`[checkout-cta-apply]   --apply --confirm=${CONFIRM_NAME} --base-hash-pricing=<hash> --base-hash-home=<hash>`);
  } else {
    for (const [slug, contentJson] of Object.entries(plans)) {
      const row = bySlug.get(slug);
      await db.livePage.update({ where: { id: row.id }, data: { contentJson } });
      const readback = await db.livePage.findUnique({ where: { id: row.id }, select: { contentJson: true, updatedAt: true } });
      assert.equal(hash(readback.contentJson), hash(contentJson), `Readback hash mismatch on ${slug}.`);
      console.log(`[checkout-cta-apply] applied ${slug}; readback verified; updatedAt=${readback.updatedAt.toISOString()}`);
    }
    const pricingData = (await db.livePage.findFirst({ where: { siteId, slug: manifest.pricing.slug }, select: { contentJson: true } })).contentJson.sections.v2_main.settings.data;
    assert(pricingData.tiers.every((tier) => tier.ctaHref.startsWith("/checkout?plan=")), "Readback: a pricing tier still points at the workspace.");
    assert(pricingData.packs.every((pack) => pack.href.startsWith("/checkout?pack=")), "Readback: a pack still points at the workspace.");
    const homeData = (await db.livePage.findFirst({ where: { siteId, slug: manifest.home.slug }, select: { contentJson: true } })).contentJson.sections.v2_main.settings.data;
    assert(homeData.pricingPackages.tiers.every((tier) => tier.ctaHref.startsWith("/checkout?plan=")), "Readback: a homepage tier still points at the workspace.");
    console.log("[checkout-cta-apply] readback verified on both rows.");
  }
} finally {
  await db.$disconnect();
}
