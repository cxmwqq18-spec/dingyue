#!/usr/bin/env node
// Ten-video pilot: pin the VideoObject uploadDate / sitemap publication_date to
// a stable per-card value instead of the owning LivePage row's updatedAt.
// The renderer and sitemap read video.publishedAt when present; all other
// videos keep the existing fallback until the pilot is reviewed.
//
//   dry run: node scripts/apply-aivideosugc-video-published-date-pilot-2026-11-26.mjs --target=production
//   apply:   node scripts/apply-aivideosugc-video-published-date-pilot-2026-11-26.mjs --target=production --apply --confirm=aivideosugc-video-published-date-pilot-2026-11-26
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM = "aivideosugc-video-published-date-pilot-2026-11-26";
const MANIFEST = new URL("./manifests/aivideosugc-video-published-date-pilot-2026-11-26.json", import.meta.url);
const PILOT = [
  "app-screen-walkthrough-ugc",
  "white-laceup-sneaker-styling",
  "headphone-creator-review",
  "chili-crisp-oil-rice-upgrade",
  "pink-serum-dropper-routine",
  "gym-protein-scoop-demo",
  "living-room-sofa-check-in",
  "kettlebell-powder-reveal-reel",
  "pet-dog-cuddle-chat",
  "finance-hook-phone-demo"
];
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM}`);

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
const hash = (value) => crypto.createHash("sha256").update(stable(value)).digest("hex");
function findCard(node, slug) {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const item of node) { const hit = findCard(item, slug); if (hit) return hit; }
    return undefined;
  }
  if (node.publicSlug === slug && node.video && typeof node.video.src === "string") return node;
  for (const item of Object.values(node)) { const hit = findCard(item, slug); if (hit) return hit; }
  return undefined;
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId },
    select: { id: true, slug: true, contentJson: true, updatedAt: true }
  });
  const plans = new Map();
  const matches = [];
  for (const slug of PILOT) {
    const owners = rows.filter((row) => Boolean(findCard(row.contentJson, slug)));
    assert.equal(owners.length, 1, `${slug}: expected one owner row with a video card, found ${owners.length}.`);
    const owner = owners[0];
    const card = findCard(owner.contentJson, slug);
    assert(card?.video?.src, `${slug}: video card not found in ${owner.slug}.`);
    if (!plans.has(owner.id)) {
      plans.set(owner.id, { owner, next: structuredClone(owner.contentJson), items: [] });
    }
    const plan = plans.get(owner.id);
    const nextCard = findCard(plan.next, slug);
    assert(nextCard?.video?.src, `${slug}: cloned card missing.`);
    nextCard.video.publishedAt = owner.updatedAt.toISOString();
    plan.items.push({ slug, publishedAt: owner.updatedAt.toISOString(), owner: owner.slug });
    matches.push({ slug, owner: owner.slug, publishedAt: owner.updatedAt.toISOString() });
  }
  const updates = [...plans.values()].map((plan) => ({
    ...plan,
    baseHash: hash(plan.owner.contentJson),
    nextHash: hash(plan.next)
  }));
  const report = {
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    confirm: CONFIRM,
    pilot: matches,
    updates: updates.map((u) => ({ owner: u.owner.slug, baseHash: u.baseHash, nextHash: u.nextHash, items: u.items }))
  };
  if (apply) {
    for (const update of updates) {
      const result = await db.livePage.updateMany({
        where: { id: update.owner.id, siteId, slug: update.owner.slug, updatedAt: update.owner.updatedAt },
        data: { contentJson: update.next }
      });
      assert.equal(result.count, 1, `Row changed during apply: ${update.owner.slug}`);
    }
    const readback = await db.livePage.findMany({ where: { id: { in: updates.map((u) => u.owner.id) } }, select: { slug: true, contentJson: true } });
    for (const update of updates) {
      const row = readback.find((item) => item.slug === update.owner.slug);
      assert.equal(hash(row?.contentJson), update.nextHash, `Readback mismatch: ${update.owner.slug}`);
    }
    report.applied = true;
  }
  fs.mkdirSync(new URL("./manifests/", import.meta.url), { recursive: true });
  fs.writeFileSync(MANIFEST, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, manifest: MANIFEST.pathname }, null, 2));
} finally {
  await db.$disconnect();
}
