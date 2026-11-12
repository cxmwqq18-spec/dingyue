#!/usr/bin/env node
// AIVideosUGC pricing fixes apply — 2026-11-12 (second pass).
// 1. /pricing: rewrites the stale subscription paragraph in "How Credits Work"
//    ($24.50/$35/$63 → the one-time package numbers) and adds the /mo unit to
//    the six/twelve-month strike prices.
// 2. /: writes `pricingPackages` (same tiers) so the homepage pricing block
//    renders the one-time packages; the renderer keeps the legacy product-card
//    fallback when the field is absent.
// Field-level updates on the two rows' sections.v2_main.settings.data only;
// h1, canonical, costs table, packs, discounts, FAQ and JSON-LD stay as
// applied by apply-aivideosugc-pricing-page-2026-11-12.mjs.
//
//   dry run:  node scripts/apply-aivideosugc-pricing-page-fixes-2026-11-12.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-pricing-page-fixes-2026-11-12.mjs --target=local --apply
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-pricing-page-fixes-2026-11-12";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-pricing-page-fixes-2026-11-12.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const baseHashes = {};
for (const part of ["pricing", "home"]) {
  const value = argumentValue(`--base-hash-${part}`);
  if (value) baseHashes[part] = value;
}
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});
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

  // --- /pricing: credits paragraph rewrite + /mo strike units ---
  {
    const row = bySlug.get(manifest.pricing.slug);
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const data = contentJson.sections?.v2_main?.settings?.data;
    assert(data, "Pricing data shape changed.");
    if (baseHashes.pricing) assert.equal(hash(row.contentJson), baseHashes.pricing, `/pricing contentJson changed since the reviewed dry run; refusing to apply.`);
    assert(data.tiers?.length === 3, "Pricing tiers missing; run the base pricing apply first.");
    assert(!("plans" in data), "Legacy plans field reappeared.");
    assert(Array.isArray(data.credits) && data.credits.length === 3, "Credits paragraphs shape changed.");
    // Idempotent re-run: paragraph 3 may already carry the rewritten copy.
    assert(data.credits[2].includes("$35") || data.credits[2].includes("Starter is $24"), "Credits paragraph 3 is in an unexpected state.");

    const h1Before = data.h1;
    const costsBefore = stable(data.costs);
    data.credits = manifest.pricing.credits;
    data.tiers = manifest.pricing.tiers;
    // The meta/og/twitter description and the stored WebPage schema quote the
    // package prices; keep them in lockstep with the page copy.
    const seo = contentJson.seo;
    assert(typeof seo?.description === "string" && (seo.description.includes("24.50") || seo.description.includes("one-time credit packages")), "seo.description is in an unexpected state.");
    seo.description = manifest.pricing.seo.description;
    if (typeof seo.twitterDescription === "string") seo.twitterDescription = manifest.pricing.seo.description;
    // Bottom-of-page CTA band copy also quotes the retired $24.50 price.
    assert(typeof data.startNote === "string", "startNote missing.");
    data.startNote = manifest.pricing.startNote;
    data.ctaTitle = manifest.pricing.ctaTitle;
    const graph = Array.isArray(seo?.jsonLd?.["@graph"]) ? seo.jsonLd["@graph"] : [];
    let seoWebPageSynced = false;
    for (const node of graph) {
      if (node?.["@type"] !== "WebPage" || typeof node.description !== "string" || (!node.description.includes("24.50") && !node.description.includes("one-time credit packages"))) continue;
      node.description = manifest.pricing.seo.description;
      seoWebPageSynced = true;
    }

    assert.equal(data.h1, h1Before, "h1 changed; not allowed.");
    assert.equal(stable(data.costs), costsBefore, "costs table changed; not allowed by this manifest.");
    assert(!data.credits.join(" ").includes("$35"), "Stale subscription price still present in credits copy.");
    assert(!seo.description.includes("24.50") && !data.startNote.includes("24.50"), "Stale subscription price still present in seo description or startNote.");
    assert(data.tiers.every((tier) => tier.terms["6"].strike.endsWith("/mo") && tier.terms["12"].strike.endsWith("/mo")), "Strike prices must carry the /mo unit.");
    plans[manifest.pricing.slug] = contentJson;
  }

  // --- /: write pricingPackages (packages for the homepage pricing block) ---
  {
    const row = bySlug.get(manifest.home.slug);
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const settings = contentJson.sections?.v2_main?.settings;
    assert(settings?.data, "Homepage data shape changed.");
    if (baseHashes.home) assert.equal(hash(row.contentJson), baseHashes.home, `/ contentJson changed since the reviewed dry run; refusing to apply.`);
    const h1Before = settings.data.h1;
    const blockOrderBefore = stable(settings.data.blockOrder);
    const heroBefore = stable(settings.data.hero);
    settings.data.pricingPackages = manifest.home.pricingPackages;
    assert.equal(settings.data.h1, h1Before, "Homepage h1 changed; not allowed.");
    assert.equal(stable(settings.data.blockOrder), blockOrderBefore, "Homepage blockOrder changed; not allowed.");
    assert.equal(stable(settings.data.hero), heroBefore, "Homepage hero changed; not allowed.");
    assert(Array.isArray(settings.data.pricingPackages.tiers) && settings.data.pricingPackages.tiers.length === 3, "Homepage pricingPackages must carry three tiers.");
    plans[manifest.home.slug] = contentJson;
  }

  console.log(`[pricing-fixes-apply] target=${target}`);
  for (const [slug, contentJson] of Object.entries(plans)) {
    const current = bySlug.get(slug).contentJson;
    console.log(`[pricing-fixes-apply] ${slug} base-hash=${hash(current)} next-hash=${hash(contentJson)}`);
  }
  if (!apply) {
    console.log("[pricing-fixes-apply] dry run — no writes.");
  } else {
    for (const [slug, contentJson] of Object.entries(plans)) {
      const row = bySlug.get(slug);
      await db.livePage.update({ where: { id: row.id }, data: { contentJson } });
      const readback = await db.livePage.findUnique({ where: { id: row.id }, select: { contentJson: true, updatedAt: true } });
      assert.equal(hash(readback.contentJson), hash(contentJson), `Readback hash mismatch on ${slug}.`);
      console.log(`[pricing-fixes-apply] applied ${slug}; readback verified; updatedAt=${readback.updatedAt.toISOString()}`);
    }
    const pricingData = (await db.livePage.findFirst({ where: { siteId, slug: manifest.pricing.slug }, select: { contentJson: true } })).contentJson.sections.v2_main.settings.data;
    assert(!pricingData.credits.join(" ").includes("$35"), "Production readback still carries stale subscription copy.");
    const pricingSeo = (await db.livePage.findFirst({ where: { siteId, slug: manifest.pricing.slug }, select: { contentJson: true } })).contentJson.seo;
    assert(!pricingSeo.description.includes("24.50"), "Production readback seo.description still stale.");
    const homeData = (await db.livePage.findFirst({ where: { siteId, slug: manifest.home.slug }, select: { contentJson: true } })).contentJson.sections.v2_main.settings.data;
    assert(homeData.pricingPackages?.tiers?.length === 3, "Homepage readback missing pricingPackages tiers.");
  }
} finally {
  await db.$disconnect();
}
