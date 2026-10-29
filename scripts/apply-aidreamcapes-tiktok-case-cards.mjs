#!/usr/bin/env node
// Apply the reviewed AIVideosUGC / site_aidreamcapes TikTok case-card plan (v2)
// with compare-and-set.
//
// The plan is produced by `scripts/plan-aidreamcapes-tiktok-case-cards.mjs`.
// Supported operations, per page, all field-level on `LivePage.contentJson` of
// `site_aidreamcapes` and nothing else:
//
//   * blockOrderInsert  — insert a block id after an anchor id.
//   * pickerRemoveSlugs — remove appended cards from `visual.picker.cards`
//     (the v1 picker appends on template pages, whose picker only ever shows
//     the page's own template card).
//   * examplesEnsure    — create `data.examples` (or reuse an empty one) and
//     append the planned example items to a single gallery group.
//   * examplesDetachPublicSlug — strip `publicSlug` from example items so a
//     reference gallery (e.g. the video hub case studies) stops owning the
//     detail slugs. Every slug must keep exactly one owner elsewhere; the
//     items keep their `href`, so gallery links still resolve.
//
// The script never writes `SitePublishedState`, a publication, a snapshot, or
// another site.
//
// Safety rules:
//   * `--target=local|production --apply
//     --confirm=site_aidreamcapes-tiktok-case-cards --base-hash=<planHash>`
//     is required for any write.
//   * Without `--apply` the script only prints the diff.
//   * Every page must still match its reviewed `baseHash` unless it is already
//     in the planned end state (all operations are already applied).
//   * The whole plan is validated before the first write, so a dirty plan
//     writes nothing.
//   * Each page update is guarded by `updatedAt`; every write is read back and
//     asserted against the planned content.
//
// Usage:
//   node scripts/apply-aidreamcapes-tiktok-case-cards.mjs --target=local
//   node scripts/apply-aidreamcapes-tiktok-case-cards.mjs --target=local --apply \
//     --confirm=site_aidreamcapes-tiktok-case-cards --base-hash=<planHash>
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT = "aidreamcapes-tiktok-case-cards-2026-10-28-v2";
const CONFIRM = "site_aidreamcapes-tiktok-case-cards";
const SITE_ID = "site_aidreamcapes";
const PICKER_PATH = ["sections", "v2_main", "settings", "data", "visual", "picker", "cards"];

const manifestPath = (() => {
  const requested = argumentValue("--manifest");
  if (!requested) throw new Error("Provide --manifest=<reviewed plan manifest path>.");
  return path.isAbsolute(requested) ? requested : path.resolve(process.cwd(), requested);
})();
assert(fs.existsSync(manifestPath), `Manifest not found: ${manifestPath}.`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.contract, CONTRACT, "Manifest contract does not match this apply script.");
const siteId = assertAllowedSite(manifest.siteId);
assert.equal(siteId, SITE_ID, "This manifest is scoped to site_aidreamcapes only.");

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
assert(new Set(["local", "production"]).has(target), "Use --target=local or --target=production.");
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM}`);
const expectedBaseHash = argumentValue("--base-hash");
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply && target === "production",
  productionConfirmed: confirmed
});
if (apply) {
  assert(confirmed, `Applying the manifest requires --confirm=${CONFIRM}.`);
  assert.equal(manifest.target, target, `This manifest was reviewed for ${manifest.target}; refusing to apply it to ${target}.`);
  assert(expectedBaseHash, "Applying the manifest requires --base-hash=<manifest planHash>.");
  assert.equal(expectedBaseHash, manifest.planHash, "The reviewed plan hash does not match the manifest; re-run the plan and review it again.");
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
function pickerCards(contentJson) {
  let node = contentJson;
  for (const step of PICKER_PATH) node = record(node)?.[step];
  return Array.isArray(node) ? node : undefined;
}
function sectionData(contentJson) {
  return record(record(contentJson)?.sections?.v2_main?.settings?.data);
}
function collectCardSlugs(value, into = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((child) => collectCardSlugs(child, into));
    return into;
  }
  if (!value || typeof value !== "object") return into;
  for (const [key, child] of Object.entries(value)) {
    if (key === "publicSlug" && typeof child === "string" && child.trim()) {
      into.set(child.trim(), (into.get(child.trim()) ?? 0) + 1);
    } else collectCardSlugs(child, into);
  }
  return into;
}

/** Already in the end state for this operation? */
function blockOrderInsertApplied(blockOrder, op) {
  const index = blockOrder.indexOf(op.value);
  if (index === -1) return false;
  if (blockOrder[index - 1] !== op.after) throw new Error(`blockOrder already contains "${op.value}" but not after "${op.after}"`);
  return true;
}
function examplesApplied(data, op) {
  const examples = record(data.examples);
  if (!examples) return false;
  const groups = Array.isArray(examples.groups) ? examples.groups : [];
  const items = groups.flatMap((group) => Array.isArray(group?.items) ? group.items : []);
  const bySlug = new Map(items.map((item) => [item?.publicSlug, item]));
  return op.items.every((item) => bySlug.get(item.publicSlug) !== undefined);
}

const db = new PrismaClient({ errorFormat: "minimal" });
const aborted = [];
const plan = [];
const touched = [];
let opsApplied = 0;

try {
  const rows = await db.livePage.findMany({
    where: { siteId },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert(rows.length > 0, `No LivePage rows for ${siteId}.`);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const slugOwnerCounts = new Map();
  for (const row of rows) {
    for (const [slug, count] of collectCardSlugs(row.contentJson)) {
      slugOwnerCounts.set(slug, (slugOwnerCounts.get(slug) ?? 0) + count);
    }
  }

  // ---- Phase 1: validate the whole plan before any write -------------------
  const plannedSlugs = new Set();
  for (const page of manifest.pages ?? []) {
    const scope = page.slug;
    const row = byId.get(page.id);
    if (!row) {
      aborted.push({ page: scope, reason: `LivePage ${page.id} no longer exists` });
      continue;
    }
    if (row.siteId !== siteId) {
      aborted.push({ page: scope, reason: `LivePage belongs to ${row.siteId}, not ${siteId}` });
      continue;
    }
    if (row.slug !== page.slug) {
      aborted.push({ page: scope, reason: `LivePage slug changed to ${row.slug}` });
      continue;
    }
    const data = sectionData(row.contentJson);
    if (!data) {
      aborted.push({ page: scope, reason: "v2_main section data is missing" });
      continue;
    }
    const blockOrder = Array.isArray(data.blockOrder) ? data.blockOrder.map(String) : [];
    const picker = pickerCards(row.contentJson) ?? [];
    const pendingOps = [];
    for (const op of page.ops ?? []) {
      try {
        if (op.op === "blockOrderInsert") {
          if (!blockOrderInsertApplied(blockOrder, op)) pendingOps.push(op);
        } else if (op.op === "pickerRemoveSlugs") {
          const present = op.slugs.filter((slug) => picker.some((card) => card?.publicSlug === slug));
          const alreadyRemoved = picker.length === op.remainingCount;
          if (present.length && alreadyRemoved) {
            aborted.push({ page: scope, reason: "picker still holds planned cards but is already at the remaining count" });
          } else if (present.length) {
            pendingOps.push(op);
          }
        } else if (op.op === "examplesEnsure") {
          for (const item of op.items) {
            if (!item.publicSlug || !item.title || item.kind !== "clip" || !record(item.video)?.src || !record(item.image)?.src) {
              aborted.push({ page: scope, item: item.publicSlug, reason: "planned example item shape is invalid" });
            }
            plannedSlugs.add(item.publicSlug);
          }
          if (!examplesApplied(data, op)) pendingOps.push(op);
        } else if (op.op === "examplesDetachPublicSlug") {
          const examples = record(data.examples);
          const items = (Array.isArray(examples?.groups) ? examples.groups : []).flatMap((group) => Array.isArray(group?.items) ? group.items : []);
          const present = items.filter((item) => typeof item?.publicSlug === "string" && op.slugs.includes(item.publicSlug));
          const alreadyDetached = present.length === 0;
          if (alreadyDetached && items.length !== op.remainingCount) {
            aborted.push({ page: scope, reason: "examples already detached but the gallery does not hold the expected item count" });
          } else if (present.length && present.length !== op.slugs.length) {
            aborted.push({ page: scope, reason: `examples hold ${present.length} of ${op.slugs.length} planned slugs; refusing a partial detach` });
          } else if (present.length) {
            pendingOps.push(op);
          }
        } else {
          aborted.push({ page: scope, reason: `unknown operation ${op.op}` });
        }
      } catch (error) {
        aborted.push({ page: scope, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    if (aborted.some((entry) => entry.page === scope)) continue;
    if (!pendingOps.length) continue; // already applied
    const currentHash = pageHash(row);
    if (currentHash !== page.baseHash) {
      aborted.push({ page: scope, reason: "LivePage changed since the reviewed plan (baseHash mismatch)" });
      continue;
    }
    plan.push({ row, page: { ...page, ops: pendingOps } });
  }

  // Slug-owner invariants across the whole site after the planned ops:
  //   * every planned example slug must occur exactly once per site,
  //   * picker removals must not orphan a slug (it re-appears in examples).
  const pickerRemovals = (manifest.pages ?? []).flatMap((page) => (page.ops ?? []).filter((op) => op.op === "pickerRemoveSlugs").flatMap((op) => op.slugs));
  for (const slug of plannedSlugs) {
    const count = slugOwnerCounts.get(slug) ?? 0;
    const isRemoved = pickerRemovals.includes(slug);
    if (isRemoved ? count !== 1 : count < 1) {
      aborted.push({ slug, reason: `unexpected site-wide occurrence count ${count} for ${slug}` });
    }
  }

  const diff = plan.map((entry) => ({
    page: entry.page.slug,
    ops: entry.page.ops.map((op) => op.op === "examplesEnsure"
      ? { op: op.op, h2: op.h2, items: op.items.map((item) => item.publicSlug) }
      : op.op === "pickerRemoveSlugs"
        ? { op: op.op, slugs: op.slugs }
        : op)
  }));
  const plannedWrites = diff.reduce((total, entry) => total + entry.ops.length, 0);

  const result = {
    ok: aborted.length === 0,
    mode: apply ? "apply" : "plan",
    target,
    siteId,
    contract: CONTRACT,
    liveDataOwner: "LivePage.contentJson",
    planHash: manifest.planHash,
    baseHash: expectedBaseHash ?? null,
    pagesInManifest: (manifest.pages ?? []).length,
    opsPlanned: plannedWrites,
    abortedReasons: aborted,
    derivedCache: "not written; public SSR reads the relational LivePage directly"
  };

  if (!apply || aborted.length) {
    result.pagesTouched = 0;
    result.opsWritten = 0;
    result.diff = diff;
    console.log(JSON.stringify(result, null, 2));
    if (aborted.length) process.exitCode = 1;
  } else {
    // ---- Phase 2: guarded writes ------------------------------------------
    let stopped;
    for (const entry of plan) {
      const { row, page } = entry;
      const nextContentJson = structuredClone(row.contentJson ?? {});
      const nextData = sectionData(nextContentJson);
      assert(nextData, `LivePage ${page.slug} lost its section data during apply.`);
      for (const op of page.ops) {
        if (op.op === "blockOrderInsert") {
          const index = nextData.blockOrder.indexOf(op.after);
          assert(index !== -1, `LivePage ${page.slug}: blockOrder anchor "${op.after}" is missing.`);
          nextData.blockOrder = [...nextData.blockOrder.slice(0, index + 1), op.value, ...nextData.blockOrder.slice(index + 1)];
        } else if (op.op === "pickerRemoveSlugs") {
          const picker = pickerCards(nextContentJson);
          assert(picker, `LivePage ${page.slug}: picker path is missing.`);
          const nextPicker = picker.filter((card) => !op.slugs.includes(card?.publicSlug));
          assert.equal(nextPicker.length, op.remainingCount, `LivePage ${page.slug}: picker removal left ${nextPicker.length} cards, expected ${op.remainingCount}.`);
          nextData.visual.picker.cards = nextPicker;
        } else if (op.op === "examplesEnsure") {
          const existing = record(nextData.examples);
          const examples = existing ?? { h2: op.h2, groups: [] };
          if (!existing) nextData.examples = examples;
          if (!Array.isArray(examples.groups)) examples.groups = [];
          let group = examples.groups.find((candidate) => candidate?.label === op.groupLabel);
          if (!group) {
            group = { label: op.groupLabel, items: [] };
            examples.groups.push(group);
          }
          if (!Array.isArray(group.items)) group.items = [];
          const known = new Set(group.items.map((item) => item?.publicSlug));
          for (const item of op.items) {
            if (!known.has(item.publicSlug)) group.items.push(structuredClone(item));
          }
          assert.equal(group.items.length, op.items.length, `LivePage ${page.slug}: examples group holds ${group.items.length} items, expected ${op.items.length}.`);
        } else if (op.op === "examplesDetachPublicSlug") {
          const examples = record(nextData.examples);
          assert(examples && Array.isArray(examples.groups), `LivePage ${page.slug}: examples gallery is missing.`);
          let stripped = 0;
          for (const group of examples.groups) {
            if (!Array.isArray(group?.items)) continue;
            for (const item of group.items) {
              if (typeof item?.publicSlug === "string" && op.slugs.includes(item.publicSlug)) {
                delete item.publicSlug;
                stripped += 1;
              }
            }
          }
          assert.equal(stripped, op.slugs.length, `LivePage ${page.slug}: detached ${stripped} slugs, expected ${op.slugs.length}.`);
        }
        opsApplied += 1;
      }
      const update = await db.livePage.updateMany({
        where: { id: row.id, siteId, slug: row.slug, updatedAt: row.updatedAt },
        data: { contentJson: nextContentJson }
      });
      if (update.count !== 1) {
        stopped = { page: page.slug, reason: "LivePage changed during apply; the guarded update matched no row" };
        break;
      }
      const readback = await db.livePage.findUnique({
        where: { id: row.id },
        select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
      });
      assert(readback, `LivePage ${row.id} readback is missing.`);
      assert.equal(readback.title, row.title, `LivePage ${page.slug} title changed during apply.`);
      assert.equal(stable(readback.contentJson), stable(nextContentJson), `LivePage ${page.slug} readback did not match the planned content.`);
      touched.push({
        page: page.slug,
        ops: page.ops.map((op) => op.op),
        blockOrder: sectionData(readback.contentJson)?.blockOrder,
        pickerCount: pickerCards(readback.contentJson)?.length,
        examplesItems: (record(sectionData(readback.contentJson)?.examples)?.groups ?? []).flatMap((group) => Array.isArray(group?.items) ? group.items : []).length,
        updatedAt: readback.updatedAt
      });
    }
    if (stopped) {
      aborted.push(stopped);
      result.ok = false;
      process.exitCode = 1;
    }
    result.mode = "applied";
    result.pagesTouched = touched.length;
    result.opsWritten = opsApplied;
    result.readback = touched;
    result.abortedReasons = aborted;
    const reportPath = manifestPath.replace(/\.json$/, "-apply-report.json");
    fs.writeFileSync(reportPath, `${JSON.stringify(result, null, 1)}\n`);
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, siteId, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
