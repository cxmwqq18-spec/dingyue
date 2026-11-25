#!/usr/bin/env node
// AIVideosUGC video-tool pages — retire the video catalogs (2026-11-25).
//
//   dry run: node scripts/apply-aivideosugc-tools-hub-rework-2026-11-25.mjs --target=local
//   apply:   node scripts/apply-aivideosugc-tools-hub-rework-2026-11-25.mjs --target=local --apply
//   rollback: add --rollback (restores the values captured on apply)
//
// The eight video-tool pages stop being video catalogs: the filter chips are
// cleared, each tool page renders a curated example list (whatever exists
// today; the owner adds more later), and /ai-video-generation becomes the
// eight-tool overview. Paginated listing URLs retire with a 308 to their base
// page (the renderer stops producing pages, so the existing clamp redirect
// answers the old addresses). Content-only change: no route or canonical move.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-tools-hub-rework-2026-11-25";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-tools-hub-rework-2026-11-25.json", import.meta.url);
const ROLLBACK_PATH = new URL("./manifests/aivideosugc-tools-hub-rework-2026-11-25.rollback.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const rollback = hasArgument("--rollback");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);

const prisma = new PrismaClient();

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function setPath(root, path, value) {
  let cursor = root;
  for (const key of path.slice(0, -1)) {
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = value;
}

function getPath(root, path) {
  let cursor = root;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

function sectionData(contentJson) {
  const sections = contentJson?.sections ?? {};
  for (const [id, section] of Object.entries(sections)) {
    if (section?.type === "aidreamcapes_v2_page" && section?.settings?.data) {
      return { id, section, data: section.settings.data };
    }
  }
  return undefined;
}

function planPage(page, contentJson) {
  const located = sectionData(contentJson);
  if (!located) return { skip: "no v2 section" };
  const next = JSON.parse(JSON.stringify(contentJson));
  const target = sectionData(next);
  const data = target.data;
  const pickerPath = ["visual", "picker"];
  const hasPicker = Boolean(getPath(data, pickerPath));
  const before = {
    toolsOnly: data.toolsOnly,
    hasPicker,
    chips: hasPicker ? getPath(data, [...pickerPath, "chips"]) : undefined,
    featuredSlugs: hasPicker ? getPath(data, [...pickerPath, "featuredSlugs"]) : undefined
  };
  if (page.toolsOnly) data.toolsOnly = true;
  if (page.clearChips && hasPicker) setPath(data, [...pickerPath, "chips"], []);
  if (Array.isArray(page.featuredSlugs) && hasPicker) setPath(data, [...pickerPath, "featuredSlugs"], page.featuredSlugs);
  return { next, before, skip: undefined };
}

async function loadPage(slug) {
  const row = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId, slug } }, select: { contentJson: true, updatedAt: true } });
  assert(row, `${slug} is not a LivePage row for ${siteId}`);
  return row;
}

const planned = [];
const beforeHashes = [];
for (const page of manifest.pages) {
  const row = await loadPage(page.slug);
  beforeHashes.push(`${page.slug}:${hash(row.contentJson)}`);
  const plan = planPage(page, row.contentJson);
  if (plan.skip) {
    console.log(`[tools-hub] ${page.slug}: skipped (${plan.skip})`);
    continue;
  }
  planned.push({ page, row, ...plan });
  console.log(`[tools-hub] ${page.slug}: chips=${plan.before.hasPicker ? JSON.stringify(plan.before.chips) : "n/a"} featured=${plan.before.featuredSlugs?.length ?? "n/a"} toolsOnly=${Boolean(plan.before.toolsOnly)}`);
}

const combinedBefore = hash(beforeHashes.sort().join("\n"));
console.log(`[tools-hub] target: ${target}; pages planned: ${planned.length}`);
console.log(`[tools-hub] base hash: ${combinedBefore}`);
const expectedBase = argumentValue("--base-hash");
if (expectedBase) assert.equal(combinedBefore, expectedBase, "Content changed since the reviewed dry run; refusing to apply.");

if (rollback) {
  assert(fs.existsSync(ROLLBACK_PATH), "No rollback manifest; nothing to restore.");
  const stored = JSON.parse(fs.readFileSync(ROLLBACK_PATH, "utf8"));
  for (const entry of stored.pages) {
    const row = await loadPage(entry.slug);
    const next = JSON.parse(JSON.stringify(row.contentJson));
    const located = sectionData(next);
    if (!located) continue;
    const data = located.data;
    if (entry.before.toolsOnly === undefined) delete data.toolsOnly;
    else data.toolsOnly = entry.before.toolsOnly;
    if (entry.before.hasPicker) {
      if (entry.before.chips !== undefined) setPath(data, ["visual", "picker", "chips"], entry.before.chips);
      if (entry.before.featuredSlugs === undefined) delete getPath(data, ["visual", "picker"])?.featuredSlugs;
      else setPath(data, ["visual", "picker", "featuredSlugs"], entry.before.featuredSlugs);
    }
    if (apply) {
      await prisma.livePage.update({ where: { siteId_slug: { siteId, slug: entry.slug } }, data: { contentJson: next, updatedAt: new Date() } });
      console.log(`[tools-hub] rolled back ${entry.slug}`);
    } else {
      console.log(`[tools-hub] would roll back ${entry.slug}`);
    }
  }
  await prisma.$disconnect();
  process.exit(0);
}

if (!apply) {
  console.log("[tools-hub] dry run only. Re-run with --apply --confirm=" + CONFIRM_NAME);
  await prisma.$disconnect();
  process.exit(0);
}

const rollbackManifest = { date: manifest.date, siteId, target, mode: "applied", pages: planned.map(({ page, before }) => ({ slug: page.slug, before })) };
for (const { page, row, next } of planned) {
  const expected = hash(row.contentJson);
  const current = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId, slug: page.slug } }, select: { contentJson: true } });
  assert(current && hash(current.contentJson) === expected, `${page.slug} changed during the run; aborting.`);
  await prisma.livePage.update({ where: { siteId_slug: { siteId, slug: page.slug } }, data: { contentJson: next, updatedAt: new Date() } });
  console.log(`[tools-hub] wrote ${page.slug}`);
}
fs.writeFileSync(ROLLBACK_PATH, `${JSON.stringify(rollbackManifest, null, 2)}\n`);
console.log(`[tools-hub] rollback manifest: ${ROLLBACK_PATH.pathname}`);
await prisma.$disconnect();
