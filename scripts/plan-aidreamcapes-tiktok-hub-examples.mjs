#!/usr/bin/env node
// Field-level plan (v3) for the AIVideosUGC / site_aidreamcapes TikTok case
// cards (2026-10-28 import, 45 items): surface the 45 videos on the
// `/ai-video-generation` video hub.
//
// The hub already renders `data.examples` (blockOrder contains "examples"),
// but its gallery only holds 5 single-photo examples — the 45 TikTok case
// videos are only reachable one level deeper on their tool/template pages.
// v3 plans one operation on the hub page:
//
//   * `examplesEnsure` — append a single gallery group (label
//     "TikTok Shop case studies") holding all 45 video items. Items are
//     derived from the reviewed source manifest with the same shape the v2
//     run used for the template-page galleries, so every item keeps the same
//     `publicSlug` owner it already has elsewhere (the hub adds a second,
//     gallery-level reference; detail-page ownership is unchanged).
//
// This script only reads the relational row and writes the reviewable plan
// manifest. It never writes the database. Run
// `scripts/apply-aidreamcapes-tiktok-case-cards.mjs` to apply with
// compare-and-set.
//
// Usage:
//   node scripts/plan-aidreamcapes-tiktok-hub-examples.mjs --target=local
//   node scripts/plan-aidreamcapes-tiktok-hub-examples.mjs --target=production
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
const GROUP_LABEL = "TikTok Shop case studies";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MEDIA_RE = /^\/(ai-image-generation|ai-video-generation)\/[a-z0-9][a-z0-9.-]*\.(?:mp4|webp)$/;

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
assert(new Set(["local", "production"]).has(target), "Use --target=local or --target=production.");
assertDatabaseTarget({ expectedTarget: target });
const manifestPath = path.join(here, "manifests", `aidreamcapes-tiktok-hub-examples-${target}-2026-10-29.json`);

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
assert.equal(source.contract, "aidreamcapes-tiktok-case-cards-2026-10-28-v1", "Source manifest contract mismatch.");
assert.equal(source.siteId, SITE_ID, "Source manifest is scoped to site_aidreamcapes only.");
assert.equal(assertAllowedSite(source.siteId), SITE_ID);
assert(Array.isArray(source.items) && source.items.length === 45, "Source manifest must list exactly 45 items.");

const seenSlugs = new Set();
for (const item of source.items) {
  assert(Number.isInteger(item.rank), `item rank must be an integer`);
  assert(SLUG_RE.test(item.slug) && !seenSlugs.has(item.slug), `invalid or duplicate slug ${item.slug}`);
  seenSlugs.add(item.slug);
  assert(MEDIA_RE.test(item.videoSrc) && item.videoSrc.endsWith(`${item.slug}.mp4`), `invalid videoSrc for ${item.slug}`);
  assert(MEDIA_RE.test(item.posterSrc) && item.posterSrc.endsWith(`${item.slug}-640.webp`), `invalid posterSrc for ${item.slug}`);
}

/** Example-gallery item shape (V2Example), identical to the v2 galleries. */
function exampleItemFor(item) {
  return {
    key: `tiktok45-${item.rank}`,
    href: `/ai-video-generation/${item.slug}`,
    kind: "clip",
    title: item.label,
    image: { src: item.posterSrc, alt: item.alt, width: item.posterWidth, height: item.posterHeight, w: item.posterWidth, h: item.posterHeight },
    prompt: item.prompt,
    line: item.line,
    aspect: item.aspect,
    duration: item.duration,
    publicSlug: item.slug,
    video: { src: item.videoSrc, name: item.alt, poster: { src: item.posterSrc, alt: item.alt }, width: item.videoWidth, height: item.videoHeight },
    referenceImages: [{ src: item.posterSrc, alt: item.alt }],
    placement: [...item.placement].sort()
  };
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

const items = source.items.map(exampleItemFor);

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const row = await db.livePage.findFirst({
    where: { siteId: SITE_ID, slug: HUB_SLUG },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert(row, `No LivePage row for ${HUB_SLUG}.`);
  assert.equal(row.siteId, SITE_ID);
  const data = sectionData(row.contentJson);
  assert(data, "Hub v2_main section data is missing.");
  assert(Array.isArray(data.blockOrder) && data.blockOrder.includes("examples"), "Hub blockOrder must contain the examples block.");
  const examples = record(data.examples);
  const existingGroups = Array.isArray(examples?.groups) ? examples.groups : [];
  const existingSlugs = new Set(existingGroups.flatMap((group) => Array.isArray(group?.items) ? group.items.map((item) => item?.publicSlug) : []));
  for (const item of items) assert(!existingSlugs.has(item.publicSlug), `${item.publicSlug} is already in the hub examples gallery.`);
  const hubH2 = typeof examples?.h2 === "string" && examples.h2.trim() ? examples.h2 : "Examples";
  const baseHash = pageHash(row);

  const pages = [{
    id: row.id,
    slug: row.slug,
    baseHash,
    ops: [{ op: "examplesEnsure", h2: hubH2, groupLabel: GROUP_LABEL, items }]
  }];
  const sourceHash = hash(JSON.parse(fs.readFileSync(sourcePath, "utf8")));
  const planHash = hash({ contract: CONTRACT, siteId: SITE_ID, target, sourceHash, pages: pages.map(({ id, slug, baseHash: pageBaseHash, ops }) => ({ id, slug, baseHash: pageBaseHash, ops })) });
  const manifest = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    createdAt: new Date().toISOString(),
    sourceFile: path.basename(sourcePath),
    sourceHash,
    planHash,
    summary: { [row.slug]: { ops: ["examplesEnsure"], groupLabel: GROUP_LABEL, items: items.length } },
    pages
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(JSON.stringify({
    ok: true,
    target,
    manifest: manifestPath,
    planHash,
    baseHash,
    hub: { id: row.id, slug: row.slug, existingGroups: existingGroups.length },
    items: items.length,
    groupLabel: GROUP_LABEL
  }, null, 1));
} finally {
  await db.$disconnect();
}
