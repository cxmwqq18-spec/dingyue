#!/usr/bin/env node
// Isolate the 38 product demo cards from the homepage picker: the same
// products are now covered by the spokesperson actor videos, so the homepage
// module would duplicate them. Cards are REMOVED from the homepage
// LivePage picker only — the detail pages and their tool pages stay untouched.
// Restore: the removed cards are preserved in the manifest (`removed`), and
// re-applying this script with --restore puts them back in their original order.
// Manifest: scripts/manifests/aidreamcapes-home-isolate-product-demos-production-2026-11-01.json
// Dry run by default. Apply with:
//   DATABASE_TARGET=production node scripts/apply-aidreamcapes-home-isolate-product-demos.mjs \
//     --apply --confirm=site_aidreamcapes-home-isolate-product-demos --base-hash=<hash from dry run>
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
assert.equal(target, "production", "This content update is production-only.");
const apply = hasArgument("--apply");
const restore = hasArgument("--restore");
const confirmed = hasArgument("--confirm=site_aidreamcapes-home-isolate-product-demos");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});
if (apply) assert(confirmed, "Production update requires the explicit home-isolate-product-demos confirmation.");

const manifestPath = new URL("./manifests/aidreamcapes-home-isolate-product-demos-production-2026-11-01.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.siteId, siteId);
assert.equal(manifest.slug, "/");
assert.equal(manifest.removed.length, 38, "Manifest must carry exactly 38 removed cards.");
const removeSlugs = new Set(manifest.removed.map((c) => c.slug));

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
  const current = await db.livePage.findFirst({
    where: { siteId, slug: manifest.slug },
    select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true, updatedAt: true }
  });
  assert(current, `Production LivePage ${manifest.slug} does not exist.`);
  const baseHash = hash(current);
  const expectedHash = argumentValue("--base-hash");
  if (apply) assert.equal(expectedHash, baseHash, "Production homepage changed since the dry run; rerun the dry run and review the new plan.");

  const next = structuredClone(current.contentJson ?? {});
  let removed = 0, restored = 0, already = 0;
  const fail = (message) => { throw new assert.AssertionError({ message }); };
  const sections = next.sections ?? {};
  for (const sectionId of next.sectionsOrder ?? []) {
    const section = sections[sectionId];
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = section.settings?.data;
    if (!data) continue;
    const pickers = [];
    if (Array.isArray(data.visual?.picker?.cards)) pickers.push(data.visual.picker.cards);
    if (Array.isArray(data.workspaceCases)) pickers.push(data.workspaceCases);
    for (const cards of pickers) {
      if (!restore) {
        const before = cards.length;
        for (let i = cards.length - 1; i >= 0; i--) {
          const slug = cards[i]?.slug ?? cards[i]?.publicSlug;
          if (slug && removeSlugs.has(slug)) {
            cards.splice(i, 1);
            removed++;
          }
        }
        if (before === cards.length) already++;
      } else {
        // restore: re-insert the removed cards by slug if missing
        for (const removedCard of manifest.removed) {
          if (cards.some((c) => (c?.slug ?? c?.publicSlug) === removedCard.slug)) continue;
          if (removedCard.section !== sectionId) continue;
          const original = manifest.removed.find((c) => c.slug === removedCard.slug);
          if (!original?.card) fail(`Manifest card payload missing for ${removedCard.slug}.`);
          cards.push(original.card);
          restored++;
        }
      }
    }
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? (restore ? "apply-restore" : "apply") : "dry-run",
    slug: manifest.slug,
    baseHash,
    nextHash: hash({ ...current, contentJson: next }),
    removed, restored, already
  }, null, 2));

  if (!apply) {
    console.log("Dry run only. Review the plan, then apply with --apply --confirm=site_aidreamcapes-home-isolate-product-demos --base-hash=" + baseHash);
  } else {
    await db.livePage.update({
      where: { siteId_slug: { siteId, slug: manifest.slug } },
      data: { contentJson: next }
    });
    console.log("Applied. The storefront serves the updated page on the next request.");
  }
} finally {
  await db.$disconnect();
}
