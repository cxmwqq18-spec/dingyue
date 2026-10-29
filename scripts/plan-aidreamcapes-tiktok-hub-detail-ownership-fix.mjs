#!/usr/bin/env node
// Field-level plan (v4, incident fix) for the AIVideosUGC / site_aidreamcapes
// TikTok case cards: the v3 hub gallery items carried `publicSlug`, which gave
// all 45 slugs a second detail owner. `resolveMediaDetail` requires exactly one
// owner per slug, so every one of the 45 detail pages started returning 404.
//
// v4 plans one operation on the hub page:
//
//   * `examplesDetachPublicSlug` — strip `publicSlug` from the 45 hub gallery
//     items. The hub keeps rendering the videos and its links keep resolving
//     (the items keep their `href`), but the hub stops owning the detail
//     slugs. Detail ownership returns to the single tool/template page.
//
// This script only reads the relational row and writes the reviewable plan
// manifest. It never writes the database. Apply with
// `scripts/apply-aidreamcapes-tiktok-case-cards.mjs --apply --confirm=...`.
//
// Usage:
//   node scripts/plan-aidreamcapes-tiktok-hub-detail-ownership-fix.mjs --target=local
//   node scripts/plan-aidreamcapes-tiktok-hub-detail-ownership-fix.mjs --target=production
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget } from "./lib/database-target.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, "manifests", "aidreamcapes-tiktok-case-cards-source-2026-10-28.json");
const CONTRACT = "aidreamcapes-tiktok-case-cards-2026-10-28-v2";
const SITE_ID = "site_aidreamcapes";
const HUB_SLUG = "/ai-video-generation";

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
assert(new Set(["local", "production"]).has(target), "Use --target=local or --target=production.");
assertDatabaseTarget({ expectedTarget: target });
const manifestPath = path.join(here, "manifests", `aidreamcapes-tiktok-hub-detail-ownership-fix-${target}-2026-10-29.json`);

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
assert.equal(source.contract, "aidreamcapes-tiktok-case-cards-2026-10-28-v1", "Source manifest contract mismatch.");
assert.equal(source.siteId, SITE_ID);
assert.equal(assertAllowedSite(source.siteId), SITE_ID);
assert(Array.isArray(source.items) && source.items.length === 45, "Source manifest must list exactly 45 items.");
const slugs = source.items.map((item) => item.slug);

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function sectionData(contentJson) {
  return record(record(contentJson)?.sections?.v2_main?.settings?.data);
}
function pageHash(row) {
  return hash({
    id: row.id,
    siteId: row.siteId,
    slug: row.slug,
    title: row.title,
    pageType: row.pageType,
    templateKey: row.templateKey,
    contentJson: row.contentJson,
    updatedAt: row.updatedAt
  });
}

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const row = await db.livePage.findFirst({
    where: { siteId: SITE_ID, slug: HUB_SLUG },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert(row, `No LivePage row for ${HUB_SLUG}.`);
  const data = sectionData(row.contentJson);
  assert(data, "Hub v2_main section data is missing.");
  const examples = record(data.examples);
  const items = (Array.isArray(examples?.groups) ? examples.groups : []).flatMap((group) => Array.isArray(group?.items) ? group.items : []);
  const owned = items.filter((item) => typeof item?.publicSlug === "string" && slugs.includes(item.publicSlug));
  const caseGroup = (Array.isArray(examples?.groups) ? examples.groups : []).find((group) => group?.label === "TikTok Shop case studies");
  assert(caseGroup, "Hub examples must hold the 'TikTok Shop case studies' group.");
  assert.equal(caseGroup.items?.length, 45, "The case-studies group must hold 45 items.");
  // Every slug must keep exactly one owner elsewhere (its tool/template page).
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { not: HUB_SLUG } },
    select: { slug: true, contentJson: true }
  });
  const otherOwners = new Map();
  for (const other of rows) {
    const text = JSON.stringify(other.contentJson ?? {});
    for (const slug of slugs) {
      if (text.includes(`"${slug}"`)) otherOwners.set(slug, (otherOwners.get(slug) ?? 0) + 1);
    }
  }
  const orphaned = slugs.filter((slug) => !otherOwners.has(slug));
  assert.equal(orphaned.length, 0, `Slugs without another owner, refusing to detach: ${orphaned.join(", ")}`);

  const pages = [{
    id: row.id,
    slug: row.slug,
    baseHash: pageHash(row),
    ops: [{ op: "examplesDetachPublicSlug", slugs, remainingCount: items.length }]
  }];
  const sourceHash = hash(JSON.parse(fs.readFileSync(sourcePath, "utf8")));
  const planHash = hash({ contract: CONTRACT, siteId: SITE_ID, target, sourceHash, pages: pages.map(({ id, slug, baseHash, ops }) => ({ id, slug, baseHash, ops })) });
  const manifest = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    createdAt: new Date().toISOString(),
    sourceFile: path.basename(sourcePath),
    sourceHash,
    planHash,
    summary: { [row.slug]: { ops: ["examplesDetachPublicSlug"], slugs: slugs.length, ownedOnHub: owned.length } },
    pages
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(JSON.stringify({
    ok: true,
    target,
    manifest: manifestPath,
    planHash,
    hubItems: items.length,
    slugsStillOwnedOnHub: owned.length,
    orphanCheck: "every slug keeps exactly one owner outside the hub"
  }, null, 1));
} finally {
  await db.$disconnect();
}
