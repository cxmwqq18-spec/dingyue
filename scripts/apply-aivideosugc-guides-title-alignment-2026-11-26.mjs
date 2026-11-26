#!/usr/bin/env node
// AIVideosUGC field guides — align card label, H1 and URL (2026-11-26).
//
//   dry run: node scripts/apply-aivideosugc-guides-title-alignment-2026-11-26.mjs --target=local
//   apply:   node scripts/apply-aivideosugc-guides-title-alignment-2026-11-26.mjs --target=local --apply
//   rollback: add --rollback
//
// The five field-guide slugs stay exactly where they are; the short
// URL-derived title becomes the H1, card label and breadcrumb, and the long
// title moves to the subtitle. The previous long-tail SEO title is kept in
// seo.title so search snippets do not lose keywords. Content-only change: no
// route, canonical or sitemap move.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-guides-title-alignment-2026-11-26";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-guides-title-alignment-2026-11-26.json", import.meta.url);
const ROLLBACK_PATH = new URL("./manifests/aivideosugc-guides-title-alignment-2026-11-26.rollback.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const rollback = hasArgument("--rollback");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);

const prisma = new PrismaClient();
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function load(slug) {
  const row = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId, slug } }, select: { contentJson: true } });
  assert(row, `${slug} is not a LivePage row for ${siteId}`);
  return row.contentJson;
}

function pageData(contentJson) {
  for (const section of Object.values(contentJson?.sections ?? {})) {
    if (section?.type === "aidreamcapes_v2_page" && section?.settings?.data) return section.settings.data;
  }
  return undefined;
}

const planned = [];
const beforeHashes = [];
for (const page of manifest.pages) {
  const contentJson = await load(page.slug);
  beforeHashes.push(`${page.slug}:${hash(contentJson)}`);
  const next = JSON.parse(JSON.stringify(contentJson));
  const data = pageData(next);
  assert(data, `${page.slug} has no v2 data`);
  const before = { h1: data.h1, subtitle: data.subtitle, label: data.label, seoTitle: data.seo?.title };
  data.h1 = page.h1;
  data.subtitle = page.subtitle;
  data.label = page.h1;
  data.seo = { ...(data.seo ?? {}), title: page.seoTitle };
  planned.push({ slug: page.slug, next, before });
  console.log(`[guides-title] ${page.slug}: "${before.h1}" -> "${page.h1}" (subtitle: "${page.subtitle}")`);
}

const guidesContent = await load("/guides");
beforeHashes.push(`/guides:${hash(guidesContent)}`);
const guidesNext = JSON.parse(JSON.stringify(guidesContent));
const hub = pageData(guidesNext)?.hub;
assert(hub?.fieldGuides?.items, "/guides has no fieldGuides items");
const cardsBefore = [];
for (const card of manifest.guideCards) {
  const item = hub.fieldGuides.items.find((entry) => entry.href === card.href);
  assert(item, `/guides has no card for ${card.href}`);
  cardsBefore.push({ href: card.href, label: item.label });
  item.label = card.label;
  console.log(`[guides-title] card ${card.href}: "${cardsBefore[cardsBefore.length - 1].label}" -> "${card.label}"`);
}
planned.push({ slug: "/guides", next: guidesNext, before: { cards: cardsBefore } });

const combinedBefore = hash(beforeHashes.sort().join("\n"));
console.log(`[guides-title] target: ${target}; pages planned: ${planned.length}`);
console.log(`[guides-title] base hash: ${combinedBefore}`);
const expectedBase = argumentValue("--base-hash");
if (expectedBase) assert.equal(combinedBefore, expectedBase, "Content changed since the reviewed dry run; refusing to apply.");

if (rollback) {
  assert(fs.existsSync(ROLLBACK_PATH), "No rollback manifest; nothing to restore.");
  const stored = JSON.parse(fs.readFileSync(ROLLBACK_PATH, "utf8"));
  for (const entry of stored.entries) {
    const contentJson = await load(entry.slug);
    const next = JSON.parse(JSON.stringify(contentJson));
    const data = pageData(next);
    if (entry.before.cards) {
      for (const card of entry.before.cards) {
        const item = data.hub.fieldGuides.items.find((candidate) => candidate.href === card.href);
        if (item) item.label = card.label;
      }
    } else {
      data.h1 = entry.before.h1;
      data.subtitle = entry.before.subtitle;
      data.label = entry.before.label;
      if (entry.before.seoTitle === undefined) delete data.seo?.title;
      else data.seo = { ...(data.seo ?? {}), title: entry.before.seoTitle };
    }
    if (apply) {
      await prisma.livePage.update({ where: { siteId_slug: { siteId, slug: entry.slug } }, data: { contentJson: next, updatedAt: new Date() } });
      console.log(`[guides-title] rolled back ${entry.slug}`);
    } else {
      console.log(`[guides-title] would roll back ${entry.slug}`);
    }
  }
  await prisma.$disconnect();
  process.exit(0);
}

if (!apply) {
  console.log(`[guides-title] dry run only. Re-run with --apply --confirm=${CONFIRM_NAME}`);
  await prisma.$disconnect();
  process.exit(0);
}

fs.writeFileSync(ROLLBACK_PATH, `${JSON.stringify({ date: manifest.date, siteId, target, mode: "applied", entries: planned.map(({ slug, before }) => ({ slug, before })) }, null, 2)}\n`);
for (const entry of planned) {
  await prisma.livePage.update({ where: { siteId_slug: { siteId, slug: entry.slug } }, data: { contentJson: entry.next, updatedAt: new Date() } });
  console.log(`[guides-title] wrote ${entry.slug}`);
}
console.log(`[guides-title] rollback manifest: ${ROLLBACK_PATH.pathname}`);
await prisma.$disconnect();
