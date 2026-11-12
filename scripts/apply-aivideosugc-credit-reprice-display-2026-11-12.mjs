#!/usr/bin/env node
// AIVideosUGC credit reprice — display pass, 2026-11-12.
// Field-level updates on two rows of site_aidreamcapes:
//   /pricing — costs table (photo 1 credit, 15s 20, 30s 40; dead 6s/10s rows
//     removed), credits copy, conversion creditSchedule, and Product/Offer
//     JSON-LD nodes appended to seo.jsonLd @graph (GEO batch).
//   / — homepage conversion creditSchedule and the GEO meta description with
//     the quotable differentiators (no subscription / all included /
//     watermark-free).
// Runtime companion: apply-aivideosugc-credit-reprice-2026-11-12.mjs (the
// dedicated priced channel + creditCost rows) must be applied alongside; the
// display must never contradict what the workspace actually charges.
//   dry run:  node scripts/apply-aivideosugc-credit-reprice-display-2026-11-12.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-credit-reprice-display-2026-11-12.mjs --target=local --apply
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-credit-reprice-display-2026-11-12";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-credit-reprice-display-2026-11-12.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId ?? "site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const baseHashes = {};
for (const part of ["pricing", "home"]) {
  const value = argumentValue(`--base-hash-${part}`);
  if (value) baseHashes[part] = value;
}
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`) });
if (apply && target === "production") assert(hasArgument(`--confirm=${CONFIRM_NAME}`), `Production update requires --confirm=${CONFIRM_NAME}`);

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
    select: { id: true, slug: true, contentJson: true, updatedAt: true }
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  for (const slug of slugs) assert(bySlug.has(slug), `LivePage ${slug} does not exist on ${target}.`);
  const plans = {};

  // --- /pricing: costs table, credits copy, creditSchedule, Product JSON-LD ---
  {
    const row = bySlug.get(manifest.pricing.slug);
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const data = contentJson.sections?.v2_main?.settings?.data;
    assert(data, "Pricing data shape changed.");
    if (baseHashes.pricing) assert.equal(hash(row.contentJson), baseHashes.pricing, "/pricing contentJson changed since the reviewed dry run; refusing to apply.");

    // Idempotency anchors: the current costs table must be the pre-reprice or
    // already-repriced state.
    const costsKey = stable(data.costs);
    const preReprice = stable([["Product photo", "24 credits"], ["Video, 6 seconds", "24 credits"], ["Video, 10 seconds", "40 credits"], ["Video, 15 seconds", "60 credits"], ["Video, 30 seconds", "120 credits"]]);
    const postReprice = stable(manifest.pricing.costs);
    assert(costsKey === preReprice || costsKey === postReprice, "costs table is in an unexpected state; manifest targets the wrong page state.");

    const h1Before = data.h1;
    const tiersBefore = stable(data.tiers);
    const packsBefore = stable(data.packs);
    const faqBefore = stable(data.faq);
    const discountsBefore = stable(data.packDiscounts);
    const stepsBefore = stable(data.steps);
    const termsBefore = stable(data.pricingTerms);

    data.costs = manifest.pricing.costs;
    // Credits paragraphs 1 and 3 carry the consumption numbers; paragraph 2 stays.
    assert(Array.isArray(data.credits) && data.credits.length === 3, "Credits paragraphs shape changed.");
    assert(data.credits[0].includes("24 credits") || data.credits[0].includes("uses 1 credit"), "Credits paragraph 1 is in an unexpected state.");
    assert(data.credits[2].includes("Starter is $24"), "Credits paragraph 3 lost the package copy.");
    data.credits = manifest.pricing.credits;
    data.creditSchedule = manifest.pricing.creditSchedule;

    // Product/Offer JSON-LD for the three packages (GEO batch).
    const graph = Array.isArray(contentJson.seo?.jsonLd?.["@graph"]) ? contentJson.seo.jsonLd["@graph"] : [];
    assert(graph.some((node) => node?.["@type"] === "FAQPage"), "Pricing graph lost its FAQPage node.");
    const packageIds = new Set(manifest.pricing.packages.map((p) => p.id));
    contentJson.seo.jsonLd["@graph"] = [
      ...graph.filter((node) => !(node?.["@type"] === "Product" && typeof node["@id"] === "string" && packageIds.has(node["@id"].split("package-")[1]))),
      ...manifest.pricing.packages.map((p) => ({
        "@type": "Product",
        "@id": `https://www.aivideosugc.com/pricing#package-${p.id}`,
        name: p.name,
        description: p.description,
        brand: { "@type": "Brand", name: "AIVideosUGC" },
        offers: {
          "@type": "Offer",
          price: p.price,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          url: "https://www.aivideosugc.com/pricing"
        }
      }))
    ];

    assert.equal(data.h1, h1Before, "h1 changed; not allowed.");
    assert.equal(stable(data.tiers), tiersBefore, "Package tiers changed; not allowed by this manifest.");
    assert.equal(stable(data.packs), packsBefore, "Credit packs changed; not allowed by this manifest.");
    assert.equal(stable(data.faq), faqBefore, "FAQ changed; not allowed by this manifest.");
    assert.equal(stable(data.packDiscounts), discountsBefore, "Pack discounts changed; not allowed by this manifest.");
    assert.equal(stable(data.steps), stepsBefore, "Steps changed; not allowed by this manifest.");
    assert.equal(stable(data.pricingTerms), termsBefore, "Pricing terms changed; not allowed by this manifest.");
    assert(!data.costs.flat().join(" ").includes("24 credits"), "Stale 24-credits consumption copy still present in the costs table.");
    assert(!data.credits.join(" ").includes("24 credits") && !data.credits.join(" ").includes("120"), "Stale consumption numbers still present in the credits copy.");
    assert(data.creditSchedule.photoCredits === 1 && data.creditSchedule.fifteenSecondVideoCredits === 20, "creditSchedule must be {1, 20}.");
    plans[manifest.pricing.slug] = contentJson;
  }

  // --- /: homepage creditSchedule + GEO meta description ---
  {
    const row = bySlug.get(manifest.home.slug);
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const settings = contentJson.sections?.v2_main?.settings;
    assert(settings?.data?.pricingPackages?.tiers?.length === 3, "Homepage pricingPackages missing; run the homepage pricing apply first.");
    if (baseHashes.home) assert.equal(hash(row.contentJson), baseHashes.home, "/ contentJson changed since the reviewed dry run; refusing to apply.");
    const tiersBefore = stable(settings.data.pricingPackages.tiers);
    const h1Before = settings.data.h1;

    settings.data.pricingPackages.creditSchedule = manifest.home.creditSchedule;
    assert(typeof contentJson.seo?.description === "string" && contentJson.seo.description.includes("Turn product"), "Homepage seo.description is in an unexpected state.");
    contentJson.seo.description = manifest.home.seoDescription;
    if (typeof contentJson.seo.twitterDescription === "string") contentJson.seo.twitterDescription = manifest.home.seoDescription;

    assert.equal(stable(settings.data.pricingPackages.tiers), tiersBefore, "Homepage package tiers changed; not allowed.");
    assert.equal(settings.data.h1, h1Before, "Homepage h1 changed; not allowed.");
    assert(settings.data.pricingPackages.creditSchedule.photoCredits === 1, "Homepage creditSchedule must use photoCredits 1.");
    assert(!contentJson.seo.description.includes("Turn product URL"), "Homepage meta description still stale.");
    plans[manifest.home.slug] = contentJson;
  }

  console.log(`[credit-reprice-display] target=${target}`);
  for (const [slug, contentJson] of Object.entries(plans)) {
    console.log(`[credit-reprice-display] ${slug} base-hash=${hash(bySlug.get(slug).contentJson)} next-hash=${hash(contentJson)}`);
  }
  if (!apply) {
    console.log("[credit-reprice-display] dry run — no writes.");
  } else {
    for (const [slug, contentJson] of Object.entries(plans)) {
      const row = bySlug.get(slug);
      await db.livePage.update({ where: { id: row.id }, data: { contentJson } });
      const readback = await db.livePage.findUnique({ where: { id: row.id }, select: { contentJson: true, updatedAt: true } });
      assert.equal(hash(readback.contentJson), hash(contentJson), `Readback hash mismatch on ${slug}.`);
      console.log(`[credit-reprice-display] applied ${slug}; readback verified; updatedAt=${readback.updatedAt.toISOString()}`);
    }
    const pricingData = (await db.livePage.findFirst({ where: { siteId, slug: manifest.pricing.slug }, select: { contentJson: true } })).contentJson;
    assert(pricingData.sections.v2_main.settings.data.costs.flat().includes("1 credit"), "Readback costs table missing the 1-credit photo row.");
    const products = (pricingData.seo.jsonLd["@graph"] ?? []).filter((node) => node["@type"] === "Product");
    assert.equal(products.length, 3, "Readback graph must carry three Product nodes.");
    const homeData = (await db.livePage.findFirst({ where: { siteId, slug: manifest.home.slug }, select: { contentJson: true } })).contentJson;
    assert(homeData.seo.description.includes("no subscription"), "Readback homepage meta description missing the differentiator.");
    assert.equal(homeData.sections.v2_main.settings.data.pricingPackages.creditSchedule.photoCredits, 1, "Readback homepage creditSchedule wrong.");
  }
} finally {
  await db.$disconnect();
}
