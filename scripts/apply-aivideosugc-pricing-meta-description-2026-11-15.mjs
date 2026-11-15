#!/usr/bin/env node
// AIVideosUGC pricing meta description fix — 2026-11-15.
// /pricing contentJson.seo.description and the matching twitterDescription
// carry 203 characters since the 2026-11-12 pricing apply; the release SEO
// contract bounds meta descriptions to 140-160, so the full-contract deploy
// gate fails on /pricing. This manifest rewrites both fields in place to the
// 145-character reviewed copy against the exact expected current value
// (compare-and-set). Every other seo field and all page copy stay untouched.
//
//   dry run:  node scripts/apply-aivideosugc-pricing-meta-description-2026-11-15.mjs
//   apply:    node scripts/apply-aivideosugc-pricing-meta-description-2026-11-15.mjs --apply --confirm=aivideosugc-pricing-meta-description-2026-11-15
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-pricing-meta-description-2026-11-15";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-pricing-meta-description-2026-11-15.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const baseHash = argumentValue("--base-hash");
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

const { slug, expectedCurrentDescription, description } = manifest.pricing;
assert.equal(manifest.pricing.descriptionLength, description.length, "Manifest description length is stale.");
assert.equal(manifest.pricing.expectedCurrentDescriptionLength, expectedCurrentDescription.length, "Manifest expected-current length is stale.");

const db = new PrismaClient();
try {
  const row = await db.livePage.findUnique({
    where: { siteId_slug: { siteId, slug } },
    select: { id: true, siteId: true, slug: true, contentJson: true, updatedAt: true }
  });
  assert(row, `LivePage ${slug} does not exist on ${target}.`);
  if (baseHash) assert.equal(hash(row.contentJson), baseHash, `${slug} contentJson changed since the reviewed dry run; refusing to apply.`);

  const contentJson = JSON.parse(JSON.stringify(row.contentJson));
  const seo = contentJson.seo;
  assert(seo && typeof seo === "object", "Pricing seo shape changed.");

  function seoRestHash(value) {
    const rest = { ...value };
    delete rest.description;
    delete rest.twitterDescription;
    return hash(rest);
  }

  if (seo.description === description && seo.twitterDescription === description) {
    // Already applied: verify the recorded post-apply baseline instead of writing.
    const restHash = seoRestHash(seo);
    assert.equal(restHash, manifest.pricing.postApplySeoRestHash, "Applied seo rest fields no longer match the recorded post-apply baseline.");
    console.log(JSON.stringify({ ok: true, slug, noop: true, descriptionLength: description.length, restHash }));
  } else {
    assert.equal(seo.description, expectedCurrentDescription, `${slug} seo.description is not the reviewed 203-character value; refusing to apply.`);
    const seoRestBefore = seoRestHash(seo);
    const twitterBefore = seo.twitterDescription;
    seo.description = description;
    seo.twitterDescription = description;
    const updated = await db.livePage.update({
      where: { id: row.id },
      data: { contentJson },
      select: { id: true, slug: true, updatedAt: true }
    });
    const reread = await db.livePage.findUnique({
      where: { id: row.id },
      select: { contentJson: true }
    });
    assert.equal(reread.contentJson.seo.description, description, "Readback mismatch on seo.description.");
    assert.equal(reread.contentJson.seo.twitterDescription, description, "Readback mismatch on seo.twitterDescription.");
    // The remaining seo fields must be untouched.
    assert.equal(seoRestHash(reread.contentJson.seo), seoRestBefore, "Other seo fields changed; refusing to report success.");
    console.log(JSON.stringify({
      ok: true,
      slug,
      applied: true,
      updatedAt: updated.updatedAt,
      descriptionLength: description.length,
      previousDescriptionLength: expectedCurrentDescription.length,
      twitterDescriptionWasDescription: twitterBefore === expectedCurrentDescription
    }));
  }
} finally {
  await db.$disconnect();
}
