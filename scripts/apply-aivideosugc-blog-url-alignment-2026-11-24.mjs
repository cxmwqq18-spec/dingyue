#!/usr/bin/env node
// AIVideosUGC old blog URL alignment — 2026-11-24.
//
// Seven older articles kept legacy slugs that no longer describe their current
// titles. This migration prepares exact title slugs without a 404 window:
//
//   prepare: clone each old row to its new slug, update canonical/JSON-LD/self
//            links, and repoint every other LivePage link plus the /blog cards.
//            The old rows stay online until the redirect code is live.
//   retire:  after the 308s are verified, remove the old rows and keep a full
//            backup in the manifest.
//
//   dry run: node scripts/apply-aivideosugc-blog-url-alignment-2026-11-24.mjs --phase=prepare
//   apply:   node scripts/apply-aivideosugc-blog-url-alignment-2026-11-24.mjs --phase=prepare --target=production --apply --confirm=aivideosugc-blog-url-alignment-2026-11-24
//   retire:  node scripts/apply-aivideosugc-blog-url-alignment-2026-11-24.mjs --phase=retire --target=production --apply --confirm=aivideosugc-blog-url-alignment-2026-11-24
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-blog-url-alignment-2026-11-24";
const PREPARE_MANIFEST_PATH = new URL("./manifests/aivideosugc-blog-url-alignment-2026-11-24.prepare.json", import.meta.url);
const RETIRE_MANIFEST_PATH = new URL("./manifests/aivideosugc-blog-url-alignment-2026-11-24.retire.json", import.meta.url);
const RETIRE_BACKUP_PATH = new URL("./manifests/aivideosugc-blog-url-alignment-2026-11-24.removed.json", import.meta.url);
const BLOG_HUB_SLUG = "/blog";
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const phase = argumentValue("--phase") || "prepare";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);
assert(["prepare", "retire"].includes(phase), `Unknown --phase=${phase}; use prepare or retire.`);

const RENAMES = [
  ["/blog/ai-product-photography-guide", "/blog/ai-image-generator-tutorial-product-photos-from-one-shot"],
  ["/blog/ai-ugc-video-ads-guide", "/blog/ai-video-tutorial-write-product-ad-prompts-that-work"],
  ["/blog/ai-video-review-checklist", "/blog/text-to-video-tutorial-brief-the-ai-video-agent"],
  ["/blog/unboxing-videos-for-launches", "/blog/product-links-tutorial-from-a-url-to-a-finished-video"],
  ["/blog/model-photos-without-a-photoshoot", "/blog/ai-avatar-tutorial-presenters-voices-and-languages"],
  ["/blog/from-product-link-to-finished-ad", "/blog/from-product-link-to-finished-ad-in-minutes"],
  ["/blog/how-aivideosugc-works", "/blog/how-aivideosugc-works-ai-ugc-video-ads-explained-by-blydeys-cto"]
];

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const REPLACERS = RENAMES.map(([oldPath, newPath]) => ({
  oldPath,
  newPath,
  // A path boundary keeps `/finished-ad` from matching the already-aligned
  // `/finished-ad-in-minutes` when this script is re-run.
  pattern: new RegExp(`${escapeRegExp(oldPath)}(?![a-z0-9-])`, "g")
}));
function alignPaths(value) {
  if (typeof value === "string") {
    let next = value;
    for (const { pattern, newPath } of REPLACERS) next = next.replace(pattern, newPath);
    return next;
  }
  if (Array.isArray(value)) return value.map(alignPaths);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, alignPaths(item)]));
  }
  return value;
}
function containsAnyOldPath(value) {
  const text = JSON.stringify(value);
  return RENAMES.some(([oldPath]) => text.includes(oldPath));
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId },
    select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true, createdAt: true, updatedAt: true }
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  if (phase === "prepare") {
    const creates = [];
    for (const [oldPath, newPath] of RENAMES) {
      const oldRow = bySlug.get(oldPath);
      assert(oldRow, `Missing old row ${oldPath} on ${target}.`);
      const existingNew = bySlug.get(newPath);
      const nextContentJson = alignPaths(oldRow.contentJson);
      assert(JSON.stringify(nextContentJson).includes(newPath), `Aligned content for ${newPath} is missing its new path.`);
      if (existingNew) {
        assert.equal(hash(existingNew.contentJson), hash(nextContentJson), `Existing new row ${newPath} differs from the prepared content; investigate before applying.`);
        creates.push({ oldPath, newPath, rowId: existingNew.id, action: "unchanged", changed: false, baseHash: hash(existingNew.contentJson), nextHash: hash(nextContentJson) });
        continue;
      }
      const id = `${oldRow.id}_url_aligned_20261124`;
      assert(!rows.some((row) => row.id === id), `New row id already exists: ${id}`);
      creates.push({
        oldPath,
        newPath,
        rowId: id,
        action: "create",
        changed: true,
        baseHash: null,
        nextHash: hash(nextContentJson),
        title: oldRow.title,
        pageType: oldRow.pageType,
        templateKey: oldRow.templateKey,
        contentJson: nextContentJson
      });
    }

    const oldPaths = new Set(RENAMES.map(([oldPath]) => oldPath));
    const updates = [];
    for (const row of rows) {
      if (oldPaths.has(row.slug)) continue;
      if (!containsAnyOldPath(row.contentJson)) continue;
      const nextContentJson = alignPaths(row.contentJson);
      const nextHash = hash(nextContentJson);
      if (nextHash === hash(row.contentJson)) continue;
      updates.push({
        slug: row.slug,
        rowId: row.id,
        updatedAt: row.updatedAt,
        baseHash: hash(row.contentJson),
        nextHash,
        contentJson: nextContentJson
      });
    }
    const hubUpdate = updates.find((update) => update.slug === BLOG_HUB_SLUG);
    assert(hubUpdate, "The /blog hub did not contain any of the old card links; investigate before applying.");

    const report = {
      ok: true,
      phase,
      mode: apply ? "applied" : "plan",
      target,
      siteId,
      confirm: CONFIRM_NAME,
      mapping: RENAMES,
      creates: creates.map(({ contentJson: _contentJson, ...item }) => item),
      updates: updates.map(({ contentJson: _contentJson, ...item }) => item),
      hubChanged: Boolean(hubUpdate)
    };

    if (apply) {
      for (const create of creates) {
        if (create.action === "unchanged") continue;
        await db.livePage.create({
          data: {
            id: create.rowId,
            siteId,
            pageType: create.pageType,
            templateKey: create.templateKey,
            slug: create.newPath,
            title: create.title,
            contentJson: create.contentJson
          }
        });
      }
      for (const update of updates) {
        const result = await db.livePage.updateMany({
          where: { id: update.rowId, siteId, slug: update.slug, updatedAt: update.updatedAt },
          data: { contentJson: update.contentJson }
        });
        assert.equal(result.count, 1, `Row changed during prepare: ${update.slug}`);
      }
      const newSlugs = creates.map((create) => create.newPath);
      const readback = await db.livePage.findMany({
        where: { siteId, slug: { in: [...newSlugs, BLOG_HUB_SLUG] } },
        select: { slug: true, contentJson: true }
      });
      const readbackBySlug = new Map(readback.map((row) => [row.slug, row.contentJson]));
      for (const create of creates) assert.equal(hash(readbackBySlug.get(create.newPath)), create.nextHash, `Readback mismatch on ${create.newPath}`);
      assert.equal(hash(readbackBySlug.get(BLOG_HUB_SLUG)), hubUpdate.nextHash, "Readback mismatch on the blog hub.");
      report.applied = true;
    }

    fs.mkdirSync(new URL("./manifests/", import.meta.url), { recursive: true });
    fs.writeFileSync(PREPARE_MANIFEST_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ...report, manifest: PREPARE_MANIFEST_PATH.pathname }, null, 2));
  } else {
    const oldPaths = RENAMES.map(([oldPath]) => oldPath);
    const newPaths = RENAMES.map(([, newPath]) => newPath);
    const oldRows = rows.filter((row) => oldPaths.includes(row.slug));
    const newRows = rows.filter((row) => newPaths.includes(row.slug));
    assert.equal(oldRows.length, oldPaths.length, `Expected ${oldPaths.length} old rows on ${target}, found ${oldRows.length}.`);
    assert.equal(newRows.length, newPaths.length, `Expected ${newPaths.length} new rows on ${target}, found ${newRows.length}.`);

    const backup = oldRows.map((row) => ({
      ...row,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt
    }));
    const report = {
      ok: true,
      phase,
      mode: apply ? "applied" : "plan",
      target,
      siteId,
      confirm: CONFIRM_NAME,
      mapping: RENAMES,
      retired: oldRows.map((row) => ({ id: row.id, slug: row.slug, title: row.title })),
      backup: RETIRE_BACKUP_PATH.pathname
    };

    if (apply) {
      fs.mkdirSync(new URL("./manifests/", import.meta.url), { recursive: true });
      fs.writeFileSync(RETIRE_BACKUP_PATH, `${JSON.stringify({ date: "2026-11-24", siteId, rows: backup }, null, 2)}\n`);
      for (const row of oldRows) {
        const result = await db.livePage.deleteMany({
          where: { id: row.id, siteId, slug: row.slug, updatedAt: row.updatedAt }
        });
        assert.equal(result.count, 1, `Old row changed during retire: ${row.slug}`);
      }
      const remaining = await db.livePage.findMany({ where: { siteId, slug: { in: [...oldPaths, ...newPaths] } }, select: { slug: true } });
      assert.equal(remaining.filter((row) => oldPaths.includes(row.slug)).length, 0, "An old row survived retire.");
      assert.equal(remaining.filter((row) => newPaths.includes(row.slug)).length, newPaths.length, "A new row is missing after retire.");
      report.applied = true;
    }

    fs.writeFileSync(RETIRE_MANIFEST_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ...report, manifest: RETIRE_MANIFEST_PATH.pathname }, null, 2));
  }
} finally {
  await db.$disconnect();
}
