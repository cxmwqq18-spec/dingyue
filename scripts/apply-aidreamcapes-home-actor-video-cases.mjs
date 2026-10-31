#!/usr/bin/env node
// Insert 20 spokesperson actor video cases into the homepage picker module
// ("Choose a Scene for Your Product Video", maxCards=20). The cards are
// intentionally SLUGLESS: they link through `href` to the actor detail pages
// owned by /ai-video-generation/spokesperson-video, so the homepage never
// becomes a second owner of those detail slugs (single-owner rule).
// Manifest: scripts/manifests/aidreamcapes-home-actor-video-cases-production-2026-11-01.json
// Dry run by default. Apply with:
//   DATABASE_TARGET=production node scripts/apply-aidreamcapes-home-actor-video-cases.mjs \
//     --apply --confirm=site_aidreamcapes-home-actor-video-cases --base-hash=<hash from dry run>
// Remove again with --remove (uses the same manifest).
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
const remove = hasArgument("--remove");
const confirmed = hasArgument("--confirm=site_aidreamcapes-home-actor-video-cases");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});
if (apply) assert(confirmed, "Production update requires the explicit home-actor-video-cases confirmation.");
assert(!apply || !remove, "Choose either --apply or --remove.");

const manifestPath = new URL("./manifests/aidreamcapes-home-actor-video-cases-production-2026-11-01.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.siteId, siteId);
assert.equal(manifest.slug, "/");
assert.equal(manifest.inserted.length, 20, "Manifest must carry exactly 20 inserted cards.");
const insertHrefs = new Set(manifest.inserted.map((c) => c.card.href));

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
  let inserted = 0, removedCount = 0, already = 0;
  const fail = (message) => { throw new assert.AssertionError({ message }); };
  const sections = next.sections ?? {};
  for (const sectionId of next.sectionsOrder ?? []) {
    const section = sections[sectionId];
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = section.settings?.data;
    if (!data?.visual?.picker?.cards) continue;
    const cards = data.visual.picker.cards;
    if (!remove) {
      for (const entry of manifest.inserted) {
        if (cards.some((c) => c?.href === entry.card.href)) { already++; continue; }
        assert(!cards.some((c) => (c?.publicSlug ?? c?.slug) === entry.card.href.replace("/ai-video-generation/", "")),
          `Slug ownership conflict for ${entry.card.href}`);
        cards.push(entry.card);
        inserted++;
      }
    } else {
      for (let i = cards.length - 1; i >= 0; i--) {
        if (cards[i]?.href && insertHrefs.has(cards[i].href)) { cards.splice(i, 1); removedCount++; }
      }
    }
  }
  if (!remove) assert.equal(inserted + already, 20, `Expected 20 inserted/already cards, got ${inserted} + ${already}.`);

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? (remove ? "apply-remove" : "apply") : "dry-run",
    slug: manifest.slug,
    baseHash,
    nextHash: hash({ ...current, contentJson: next }),
    inserted, removedCount, already
  }, null, 2));

  if (!apply) {
    console.log("Dry run only. Review the plan, then apply with --apply --confirm=site_aidreamcapes-home-actor-video-cases --base-hash=" + baseHash);
  } else {
    await db.livePage.update({
      where: { siteId_slug: { siteId, slug: manifest.slug } },
      data: { contentJson: next }
    });
    console.log("Applied. The storefront serves the updated page on the next request (restart clears the process cache).");
  }
} finally {
  await db.$disconnect();
}
