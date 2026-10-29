#!/usr/bin/env node
// Field-level content repair: swap the /ai-video-generation/spokesperson-video
// scene demo card covers (and their mediaManifest twins) to the same actor
// portraits the /ai-actors directory shows. Cards are per-actor demos; their
// covers were generated in a separate batch and showed different people.
// Manifest: scripts/manifests/aidreamcapes-spokesperson-card-covers-production-2026-10-29.json
// Dry run by default. Apply with:
//   DATABASE_TARGET=production node scripts/apply-aidreamcapes-spokesperson-card-covers.mjs \
//     --apply --confirm=site_aidreamcapes-spokesperson-card-covers --base-hash=<hash from dry run>
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
const confirmed = hasArgument("--confirm=site_aidreamcapes-spokesperson-card-covers");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});
if (apply) assert(confirmed, "Production update requires the explicit spokesperson-card-covers confirmation.");

const manifestPath = new URL("./manifests/aidreamcapes-spokesperson-card-covers-production-2026-10-29.json", import.meta.url);
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
  const swapped = [];
  const fail = (message) => { throw new assert.AssertionError({ message }); };

  // 1) Card images: match by publicSlug, assert the old cover is unchanged.
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
    if (card.image.src !== change.oldImageSrc) fail(`Card ${change.publicSlug}: cover changed since the manifest was written (${card.image.src}).`);
    if (card.image.w !== change.width || card.image.h !== change.height) fail(`Card ${change.publicSlug}: unexpected cover dimensions (${card.image.w}x${card.image.h}).`);
    // Portrait dimensions are identical (640x1138); only the src and alt swap.
    card.image.src = change.newImageSrc;
    card.image.alt = change.newImageAlt;
    swapped.push(change.publicSlug);
  }

  // 2) mediaManifest twins: each old src must appear exactly once and must be
  // swapped to the same portrait so derived detail pages stay consistent.
  const mediaManifest = next.mediaManifest;
  assert(Array.isArray(mediaManifest), "contentJson.mediaManifest must be an array.");
  const bySrc = new Map(mediaManifest.map((entry, index) => [entry?.src, index]));
  for (const change of manifest.changes) {
    const index = bySrc.get(change.oldImageSrc);
    if (index === undefined) fail(`mediaManifest entry missing for ${change.oldImageSrc}.`);
    const entry = mediaManifest[index];
    if (entry.width !== change.width || entry.height !== change.height) fail(`mediaManifest ${change.oldImageSrc}: unexpected dimensions (${entry.width}x${entry.height}).`);
    entry.src = change.newImageSrc;
    entry.alt = change.newImageAlt;
  }
  const str = JSON.stringify(next);
  for (const change of manifest.changes) {
    if (str.includes(change.oldImageSrc)) fail(`Old cover ${change.oldImageSrc} still referenced after the swap.`);
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "apply" : "dry-run",
    slug: manifest.slug,
    baseHash,
    nextHash: hash({ ...current, contentJson: next }),
    swapped: swapped.length,
    sample: manifest.changes.slice(0, 3).map((change) => ({ publicSlug: change.publicSlug, actorId: change.actorId, newImageSrc: change.newImageSrc }))
  }, null, 2));

  if (!apply) {
    console.log("Dry run only. Review the plan, then apply with --apply --confirm=site_aidreamcapes-spokesperson-card-covers --base-hash=" + baseHash);
    return;
  }

  await db.livePage.update({
    where: { siteId_slug: { siteId, slug: manifest.slug } },
    data: { contentJson: next }
  });
  console.log("Applied. The storefront serves the updated page on the next request.");
} finally {
  await db.$disconnect();
}
