#!/usr/bin/env node
// AIVideosUGC blog price-sync patch — 2026-11-12.
// The credit reprice (524f8b5a7) and the sitewide stale-price migration
// (acf1ccb83) rewrote the blog rows numerically but left four families of
// semantic breakage behind. This patch fixes them as exact string fragments,
// same pattern as the migration itself:
//
//   1. "20 or 20 credits" for 15/30s  -> "20 or 40 credits"   (30s = 40)
//   2. "the closer look has room at 30 — 20 credits" -> 40    (30s = 40)
//   3. "the closer look at 30 (20 credits)"          -> (40 credits)
//   4. "Videos cost 20 or 20 credits" (index FAQ)    -> "20 or 40 credits"
//   5. "A 15-second ad costs the same as 20 product photos" — the analogy
//      stopped making sense once a photo dropped to 1 credit; rewritten.
//   6. related/relatedLinks Pricing cards still say "monthly plans"  -> the
//      one-time packages wording.
//
//   dry run:  node scripts/patch-aivideosugc-blog-price-sync-2026-11-12.mjs --target=local
//   apply:    node scripts/patch-aivideosugc-blog-price-sync-2026-11-12.mjs --target=local --apply
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-blog-price-sync-2026-11-12";
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);

const SLUGS = [
  "/blog/ai-ugc-video-ads-guide",
  "/blog/ai-product-photography-guide",
  "/blog/unboxing-videos-for-launches",
  "/blog/ai-video-review-checklist",
  "/blog/model-photos-without-a-photoshoot",
  "/blog"
];

// [from, to] exact fragments applied to every string inside contentJson.
const FRAGMENTS = [
  ["Clips run 15 or 30 seconds — 20 or 20 credits", "Clips run 15 or 30 seconds — 20 or 40 credits"],
  ["A 15-second ad costs the same as 20 product photos, which is why most shops test two or three openings before scaling the winner.",
   "A 15-second ad runs 20 credits, so most shops test two or three openings before scaling the winner."],
  ["the closer look has room at 30 — 20 credits", "the closer look has room at 30 — 40 credits"],
  ["the closer look at 30 (20 credits)", "the closer look at 30 (40 credits)"],
  ["Videos cost 20 or 20 credits for 15 or 30 seconds.", "Videos cost 20 or 40 credits for 15 or 30 seconds."],
  ["Credits per job, monthly plans, and automatic refunds.", "One-time packages and credit packs, with automatic refunds on failed jobs."]
];

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

// Walk every string; apply fragments; count per-fragment hits.
function rewrite(node, hits) {
  if (typeof node === "string") {
    let out = node;
    FRAGMENTS.forEach(([from, to], index) => {
      if (out.includes(from)) {
        out = out.split(from).join(to);
        hits[index] = (hits[index] || 0) + 1;
      }
    });
    return out;
  }
  if (Array.isArray(node)) return node.map((item) => rewrite(item, hits));
  if (node && typeof node === "object") {
    const out = {};
    for (const [key, value] of Object.entries(node)) out[key] = rewrite(value, hits);
    return out;
  }
  return node;
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId, slug: { in: SLUGS } },
    select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true, updatedAt: true }
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  for (const slug of SLUGS) assert(bySlug.has(slug), `LivePage ${slug} does not exist on ${target}.`);

  const plans = [];
  for (const slug of SLUGS) {
    const row = bySlug.get(slug);
    const hits = {};
    const nextContentJson = rewrite(structuredClone(row.contentJson), hits);
    plans.push({ slug, row, nextContentJson, hits, changed: stable(row.contentJson) !== stable(nextContentJson) });
  }

  const baseHash = hash(plans.map((plan) => ({ slug: plan.slug, hash: hash(plan.row) })).sort((a, b) => (a.slug < b.slug ? -1 : 1)));
  const expectedHash = argumentValue("--base-hash");
  if (apply) assert.equal(expectedHash, baseHash, "The blog rows changed since the reviewed dry run; rerun the dry run and apply the new base hash.");

  let writes = 0;
  if (apply) {
    for (const plan of plans) {
      if (!plan.changed) continue;
      const update = await db.livePage.updateMany({
        where: { id: plan.row.id, siteId, slug: plan.slug, updatedAt: plan.row.updatedAt },
        data: { contentJson: plan.nextContentJson }
      });
      assert.equal(update.count, 1, `Row changed during apply: ${plan.slug}.`);
      writes += update.count;
    }
    const readback = await db.livePage.findMany({ where: { siteId, slug: { in: SLUGS } }, select: { slug: true, contentJson: true, updatedAt: true } });
    for (const plan of plans) {
      const row = readback.find((candidate) => candidate.slug === plan.slug);
      if (!plan.changed) continue;
      assert(row && stable(row.contentJson) === stable(plan.nextContentJson), `Readback mismatch on ${plan.slug}.`);
    }
  }

  const manifestPath = new URL(`./manifests/aivideosugc-blog-price-sync-${APPLY_SAFE_DATE()}.json`, import.meta.url);
  function APPLY_SAFE_DATE() { return "2026-11-12"; }
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    date: APPLY_SAFE_DATE(), siteId, target, mode: apply ? "applied" : "plan", baseHash, slugs: SLUGS,
    note: "Post-reprice semantic fixes on the blog rows; string fragments only, no URLs or structure changes."
  }, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    baseHash,
    writes,
    manifest: manifestPath.pathname,
    pages: plans.map((plan) => ({ slug: plan.slug, changed: plan.changed, fragmentHits: plan.hits }))
  }, null, 2));
} finally {
  await db.$disconnect();
}
