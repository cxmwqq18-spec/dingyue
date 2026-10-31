#!/usr/bin/env node
// Field-level content fix for the 53 spokesperson actor cards:
//   duration 15 -> 30 (the attached videos are 30s) and attach the product
//   reference image so the detail page shows both references (model + product).
// Product images are served from /ai-image-generation/<publicSlug>-product.jpg
// (uploaded out of band to shared/sites/public-media/image/).
// Manifest: scripts/manifests/aidreamcapes-spokesperson-actor-card-fixes-production-2026-11-01.json
// Dry run by default. Apply with:
//   DATABASE_TARGET=production node scripts/apply-aidreamcapes-spokesperson-actor-card-fixes.mjs \
//     --apply --confirm=site_aidreamcapes-spokesperson-actor-card-fixes --base-hash=<hash from dry run>
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
const confirmed = hasArgument("--confirm=site_aidreamcapes-spokesperson-actor-card-fixes");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});
if (apply) assert(confirmed, "Production update requires the explicit spokesperson-actor-card-fixes confirmation.");

const manifestPath = new URL("./manifests/aidreamcapes-spokesperson-actor-card-fixes-production-2026-11-01.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.siteId, siteId);
assert.equal(manifest.slug, "/ai-video-generation/spokesperson-video");
assert.equal(manifest.changes.length, 53, "Manifest must carry exactly 53 card changes.");

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
  if (apply) assert.equal(expectedHash, baseHash, "Production spokesperson page changed since the dry run; rerun the dry run and review the new plan.");

  const next = structuredClone(current.contentJson ?? {});
  const fixed = [];
  let alreadyFixed = 0;
  const fail = (message) => { throw new assert.AssertionError({ message }); };
  const cardBySlug = new Map();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const item of node) visit(item); return; }
    if (typeof node.publicSlug === "string") cardBySlug.set(node.publicSlug, node);
    for (const value of Object.values(node)) visit(value);
  };
  visit(next);
  for (const change of manifest.changes) {
    const card = cardBySlug.get(change.publicSlug);
    if (!card) fail(`Card ${change.publicSlug} not found on the page.`);
    const expectedRef = [{ src: change.refImageSrc, alt: change.refImageAlt }];
    const refs = JSON.stringify(card.referenceImages ?? null);
    if (card.duration === change.newDuration && refs === JSON.stringify(expectedRef)) {
      alreadyFixed++;
      continue; // idempotent
    }
    if (card.duration !== change.oldDuration) fail(`Card ${change.publicSlug}: unexpected duration ${card.duration}.`);
    if (refs !== "null") fail(`Card ${change.publicSlug}: unexpected referenceImages (${refs}).`);
    card.duration = change.newDuration;
    card.referenceImages = expectedRef;
    fixed.push(change.publicSlug);
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "apply" : "dry-run",
    slug: manifest.slug,
    baseHash,
    nextHash: hash({ ...current, contentJson: next }),
    fixed: fixed.length,
    alreadyFixed,
    sample: manifest.changes.slice(0, 2).map((c) => ({ publicSlug: c.publicSlug, duration: c.newDuration, refImageSrc: c.refImageSrc }))
  }, null, 2));

  if (!apply) {
    console.log("Dry run only. Review the plan, then apply with --apply --confirm=site_aidreamcapes-spokesperson-actor-card-fixes --base-hash=" + baseHash);
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
