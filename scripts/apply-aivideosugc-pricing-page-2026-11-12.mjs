#!/usr/bin/env node
// AIVideosUGC pricing page apply — 2026-11-12.
// Restructures the /pricing page content to the one-time package + credit-pack
// model (design draft design/pricing-page-redesign-v3.html, approved for
// frontend rollout). Field-level update on the /pricing LivePage row's
// sections.v2_main.settings.data only: adds the package tiers (1/6/12 month
// terms), credit packs, the tier x term pack-discount matrix, the usage
// explainer and terms copy, rewrites the two subscription-worded FAQ entries,
// and removes the legacy subscription `plans` field. The h1, canonical URL,
// costs table and credits paragraphs stay exactly as published — no URL, media
// or SEO-contract changes. The renderer falls back to the previous layout when
// `tiers` is absent, so the code deploy alone is safe before this apply runs.
//
//   dry run:  node scripts/apply-aivideosugc-pricing-page-2026-11-12.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-pricing-page-2026-11-12.mjs --target=local --apply
//   production apply additionally requires the combined --base-hash printed
//   by the reviewed dry run and the explicit confirm name.
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-pricing-page-2026-11-12";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-pricing-page-2026-11-12.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const SLUG = manifest.slug;
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const baseHashArg = argumentValue("--base-hash");
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
  const row = await db.livePage.findFirst({
    where: { siteId, slug: SLUG },
    select: { id: true, siteId: true, pageType: true, slug: true, contentJson: true, updatedAt: true }
  });
  assert(row, `LivePage ${SLUG} does not exist on ${target}.`);
  assert(row.siteId === siteId, "Row site mismatch.");
  assert(row.contentJson?.sections?.v2_main?.settings?.data, "Pricing page data shape changed.");

  const contentJson = row.contentJson;
  const data = contentJson.sections.v2_main.settings.data;
  const currentHash = hash(contentJson);
  if (baseHashArg) {
    assert.equal(currentHash, baseHashArg, "Live contentJson changed since the reviewed dry run; refusing to apply.");
  }

  // Guardrails: the fields this apply must never touch.
  assert(data.h1, "Missing h1.");
  const costsBefore = stable(data.costs);
  const creditsBefore = stable(data.credits);
  const h1Before = data.h1;

  const faq = Array.isArray(data.faq) ? data.faq.map((item) => ({ ...item })) : [];
  for (const update of manifest.faqUpdates) {
    const index = faq.findIndex((item) => (item.q ?? item.question) === update.matchQuestion);
    if (index < 0) {
      // Idempotent re-run: the entry may already carry the rewritten question.
      assert(faq.some((item) => (item.q ?? item.question) === update.question), `FAQ entry not found: ${update.matchQuestion}`);
      continue;
    }
    faq[index] = { ...faq[index], q: update.question, question: update.question, a: update.answer, answer: update.answer };
  }

  // The page's FAQPage schema is stored statically in seo.jsonLd and renders
  // verbatim; keep it in lockstep with the rewritten FAQ entries.
  const nextContentJson = JSON.parse(JSON.stringify(contentJson));
  const graph = nextContentJson.seo?.jsonLd?.["@graph"];
  let faqSchemaNodes = 0;
  if (Array.isArray(graph)) {
    for (const node of graph) {
      if (node?.["@type"] !== "FAQPage" || !Array.isArray(node.mainEntity)) continue;
      faqSchemaNodes += node.mainEntity.length;
      for (const entity of node.mainEntity) {
        const update = manifest.faqUpdates.find((u) => u.matchQuestion === entity.name);
        if (!update) continue;
        entity.name = update.question;
        if (entity.acceptedAnswer && typeof entity.acceptedAnswer === "object") {
          entity.acceptedAnswer.text = update.answer;
          if (typeof entity.acceptedAnswer.name === "string") entity.acceptedAnswer.name = update.answer;
        } else if (typeof entity.acceptedAnswer === "string") {
          entity.acceptedAnswer = update.answer;
        }
      }
    }
    assert(faqSchemaNodes > 0, "seo.jsonLd has no FAQPage mainEntity entries.");
  } else {
    assert.fail("seo.jsonLd.@graph missing; FAQ schema would go stale.");
  }
  nextContentJson.sections.v2_main.settings.data = {
    ...data,
    tiers: manifest.tiers,
    packs: manifest.packs,
    packDiscounts: manifest.packDiscounts,
    steps: manifest.steps,
    pricingTerms: manifest.pricingTerms,
    pricingSectionHead: manifest.pricingSectionHead,
    creditSchedule: manifest.creditSchedule,
    faq,
    teams: manifest.teams,
    ctaLead: manifest.ctaLead
  };
  delete nextContentJson.sections.v2_main.settings.data.plans; // Legacy subscription cards; renderer has its own fallback when tiers is absent.
  const nextData = nextContentJson.sections.v2_main.settings.data;

  // Guardrail assertions on the patched result.
  assert.equal(nextData.h1, h1Before, "h1 changed; not allowed.");
  assert.equal(stable(nextData.costs), costsBefore, "costs table changed; not allowed by this manifest.");
  assert.equal(stable(nextData.credits), creditsBefore, "credits paragraphs changed; not allowed by this manifest.");
  assert.equal(nextData.tiers.length, 3, "Expected exactly three package tiers.");
  assert(nextData.packs.length >= 2, "Expected at least two credit packs.");
  assert(!("plans" in nextData), "Legacy plans field must be removed.");
  for (const update of manifest.faqUpdates) {
    assert(faq.some((item) => (item.q ?? item.question) === update.question), `FAQ missing rewritten question: ${update.question}`);
  }
  for (const tier of nextData.tiers) {
    assert(tier.terms["1"]?.price, `Tier ${tier.id} lacks a 1-month price.`);
    assert(tier.terms["6"]?.perMonth && tier.terms["12"]?.perMonth, `Tier ${tier.id} lacks discounted per-month prices.`);
  }

  console.log(`[pricing-page-apply] target=${target} slug=${SLUG}`);
  console.log(`[pricing-page-apply] base-hash=${currentHash}`);
  console.log(`[pricing-page-apply] next-hash=${hash(nextContentJson)}`);
  if (!apply) {
    console.log("[pricing-page-apply] dry run — no writes. Production apply:");
    console.log(`[pricing-page-apply]   --apply --base-hash=${currentHash} --confirm=${CONFIRM_NAME}`);
  } else {
    await db.livePage.update({
      where: { id: row.id },
      data: { contentJson: nextContentJson }
    });
    const readback = await db.livePage.findUnique({
      where: { id: row.id },
      select: { contentJson: true, updatedAt: true }
    });
    assert.equal(hash(readback.contentJson), hash(nextContentJson), "Readback hash mismatch after write.");
    const readbackData = readback.contentJson.sections.v2_main.settings.data;
    assert.equal(readbackData.tiers.length, 3, "Readback tier count mismatch.");
    assert.equal(readbackData.h1, h1Before, "Readback h1 mismatch.");
    assert.equal(stable(readbackData.costs), costsBefore, "Readback costs mismatch.");
    assert(!("plans" in readbackData), "Readback still carries the legacy plans field.");
    for (const update of manifest.faqUpdates) {
      const graph = readback.contentJson.seo?.jsonLd?.["@graph"] ?? [];
      const synced = graph.some((node) => node?.["@type"] === "FAQPage" && Array.isArray(node.mainEntity) && node.mainEntity.some((entity) => entity.name === update.question && entity.acceptedAnswer?.text === update.answer));
      assert(synced, `Readback FAQPage schema not synced: ${update.question}`);
    }
    console.log(`[pricing-page-apply] applied; readback verified; updatedAt=${readback.updatedAt.toISOString()}`);
  }
} finally {
  await db.$disconnect();
}
