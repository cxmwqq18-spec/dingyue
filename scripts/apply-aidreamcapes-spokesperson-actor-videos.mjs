#!/usr/bin/env node
// Field-level content update: attach the 53 spokesperson actor videos (EN
// subtitled, 720x1280) to the per-actor cards on the
// /ai-video-generation/spokesperson-video page. Cards already carry label,
// prompt, aspect and the actor portrait; the only missing field is `video`.
// Video files are served from shared/sites/public-media/video/<publicSlug>.mp4
// (uploaded out of band; this script only edits the LivePage content).
// Manifest: scripts/manifests/aidreamcapes-spokesperson-actor-videos-production-2026-11-01.json
// Dry run by default. Apply with:
//   DATABASE_TARGET=production node scripts/apply-aidreamcapes-spokesperson-actor-videos.mjs \
//     --apply --confirm=site_aidreamcapes-spokesperson-actor-videos --base-hash=<hash from dry run>
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
const confirmed = hasArgument("--confirm=site_aidreamcapes-spokesperson-actor-videos");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});
if (apply) assert(confirmed, "Production update requires the explicit spokesperson-actor-videos confirmation.");

const manifestPath = new URL("./manifests/aidreamcapes-spokesperson-actor-videos-production-2026-11-01.json", import.meta.url);
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
  const attached = [];
  let alreadyHad = 0;
  const fail = (message) => { throw new assert.AssertionError({ message }); };

  // Match cards by publicSlug anywhere in the page content; assert the poster
  // is unchanged and no video is clobbered.
  const cardBySlug = new Map();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const item of node) visit(item); return; }
    if (typeof node.publicSlug === "string" && node.image && typeof node.image === "object") cardBySlug.set(node.publicSlug, node);
    for (const value of Object.values(node)) visit(value);
  };
  visit(next);
  for (const change of manifest.changes) {
    const card = cardBySlug.get(change.publicSlug);
    if (!card) fail(`Card ${change.publicSlug} not found on the page.`);
    if (card.image.src !== change.posterSrc) fail(`Card ${change.publicSlug}: poster changed since the manifest was written (${card.image.src}).`);
    if (card.video) {
      const expected = `/ai-video-generation/${change.publicSlug}.mp4`;
      if (card.video.src !== expected) fail(`Card ${change.publicSlug}: unexpected existing video (${card.video.src}).`);
      attached.push(change.publicSlug);
      alreadyHad++;
      continue; // already applied; keep idempotent
    }
    card.video = {
      src: `/ai-video-generation/${change.publicSlug}.mp4`,
      width: 720,
      height: 1280,
      poster: { src: card.image.src, alt: card.image.alt ?? change.label, kind: "video" }
    };
    attached.push(change.publicSlug);
  }

  // mediaManifest mirrors images only (verified against live video pages that
  // carry zero mp4 manifest entries), so it is intentionally left untouched.
  const str = JSON.stringify(next);
  for (const change of manifest.changes) {
    if (!str.includes(`/ai-video-generation/${change.publicSlug}.mp4`)) fail(`Video src missing for ${change.publicSlug} after the update.`);
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "apply" : "dry-run",
    slug: manifest.slug,
    baseHash,
    nextHash: hash({ ...current, contentJson: next }),
    attached: attached.length,
    alreadyHad,
    sample: manifest.changes.slice(0, 3).map((change) => ({ publicSlug: change.publicSlug, videoSrc: `/ai-video-generation/${change.publicSlug}.mp4` }))
  }, null, 2));

  if (!apply) {
    console.log("Dry run only. Review the plan, then apply with --apply --confirm=site_aidreamcapes-spokesperson-actor-videos --base-hash=" + baseHash);
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
