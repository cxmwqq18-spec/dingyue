#!/usr/bin/env node
// AIVideosUGC detail-page copy depth — 2026-11-21.
// The /ai-actors detail rows, the /ai-actors scene and age-range listing rows,
// and the /ai-image-generation photo cards carry almost no unique copy per
// page, which keeps those URLs in GSC's "Discovered / Crawled - currently not
// indexed". This manifest appends reviewed, end-user-facing intro paragraphs
// to each actor and listing row and sets a curated `line` on each photo card
// (the media detail page renders it as the lead paragraph and the meta
// description source).
//
// Every change is compare-and-set against the exact current values recorded in
// the manifest, and the rest of each row is verified byte-identical after the
// write. Committed LivePage updates are live on the next request.
//
//   dry run:  node scripts/apply-aivideosugc-detail-copy-2026-11-21.mjs --target local
//   apply:    node scripts/apply-aivideosugc-detail-copy-2026-11-21.mjs --target production --apply --confirm=aivideosugc-detail-copy-2026-11-21
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-detail-copy-2026-11-21";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-detail-copy-2026-11-21.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = manifest.siteId;
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});

function stable(value) {
  if (value === undefined) return "undefined";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex").slice(0, 16);
}

/** Sections of the row's page data that carry the fields this manifest edits. */
function pageDataEntries(contentJson) {
  const sections = contentJson?.sections ?? {};
  return Object.values(sections)
    .map((section) => section?.settings?.data)
    .filter((data) => data && typeof data === "object" && !Array.isArray(data));
}

function summary(list) {
  return list.join("\n  ");
}

const db = new PrismaClient();
try {
  const results = { actorRows: [], listingRows: [], cardOwners: [] };

  // ---- Actor detail rows and scene/age listing rows: append intro paragraphs.
  const introPlans = [
    ...manifest.actorRows.map((plan) => ({ ...plan, kind: "actorRows" })),
    ...manifest.listingRows.map((plan) => ({ ...plan, kind: "listingRows" }))
  ];
  for (const plan of introPlans) {
    assert(Array.isArray(plan.expectedIntro) && plan.expectedIntro.length > 0, `${plan.rowSlug}: manifest expectedIntro must be a non-empty array.`);
    assert(Array.isArray(plan.append) && plan.append.every((paragraph) => typeof paragraph === "string" && paragraph.trim().length >= 40),
      `${plan.rowSlug}: manifest append must be non-empty strings; refusing to write placeholder values.`);
  }
  for (const plan of introPlans) {
    const row = await db.livePage.findUnique({
      where: { siteId_slug: { siteId, slug: plan.rowSlug } },
      select: { id: true, slug: true, contentJson: true }
    });
    assert(row, `LivePage ${plan.rowSlug} does not exist on ${target}.`);
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const dataEntries = pageDataEntries(contentJson);
    // Actor detail rows carry the actor in the same section as the intro; pick
    // exactly the section the manifest snapshot was taken from.
    const data = plan.kind === "actorRows"
      ? dataEntries.find((candidate) => candidate.actor && Array.isArray(candidate.intro))
      : dataEntries.find((candidate) => Array.isArray(candidate.intro));
    assert(data, `${plan.rowSlug}: no page section with an intro array.`);
    assert.equal(
      stable(data.intro), stable(plan.expectedIntro),
      `${plan.rowSlug}: current intro differs from the manifest expectation; refusing to touch this row.`
    );
    const nextIntro = [...plan.expectedIntro, ...plan.append];
    if (stable(data.intro) === stable(nextIntro)) {
      // Already applied; report the row's rest identity for eyeball comparison.
      results[plan.kind].push({ rowSlug: plan.rowSlug, noop: true, restHash: hash({ ...data, intro: undefined }) });
      continue;
    }
    const restBefore = hash({ ...data, intro: undefined });
    if (!apply) {
      results[plan.kind].push({ rowSlug: plan.rowSlug, wouldAppend: plan.append.length, restHash: restBefore });
      continue;
    }
    data.intro = nextIntro;
    const updated = await db.livePage.update({
      where: { id: row.id },
      data: { contentJson },
      select: { id: true }
    });
    const reread = await db.livePage.findUnique({ where: { id: updated.id }, select: { contentJson: true } });
    const rereadData = pageDataEntries(JSON.parse(JSON.stringify(reread.contentJson))).find((candidate) => Array.isArray(candidate.intro));
    assert.equal(stable(rereadData.intro), stable(nextIntro), `${plan.rowSlug}: readback intro mismatch.`);
    assert.equal(
      hash({ ...rereadData, intro: undefined }), restBefore,
      `${plan.rowSlug}: fields outside intro changed during the write; refusing to report success.`
    );
    results[plan.kind].push({ rowSlug: plan.rowSlug, applied: true, introLengthAfter: nextIntro.length });
  }

  // ---- Photo cards: set the curated `line` on every matching card occurrence.
  for (const owner of manifest.cardOwners) {
    const row = await db.livePage.findUnique({
      where: { siteId_slug: { siteId, slug: owner.ownerSlug } },
      select: { id: true, slug: true, contentJson: true }
    });
    assert(row, `LivePage ${owner.ownerSlug} does not exist on ${target}.`);
    const original = JSON.parse(JSON.stringify(row.contentJson));
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const targets = new Map(owner.cards.map((card) => [card.publicSlug, card]));
    const touched = [];
    const walk = (value) => {
      if (Array.isArray(value)) { for (const item of value) walk(item); return; }
      if (!value || typeof value !== "object") return;
      const slug = typeof value.publicSlug === "string" ? value.publicSlug : undefined;
      if (slug && targets.has(slug)) {
        const card = targets.get(slug);
        if (value.line !== undefined && value.line !== null) {
          assert.equal(value.line, card.line, `${owner.ownerSlug}: card ${slug} already has a different line; refusing to touch this row.`);
        } else if (apply) {
          value.line = card.line;
        }
        touched.push(slug);
        return;
      }
      for (const child of Object.values(value)) walk(child);
    };
    walk(contentJson);
    const missing = [...targets.keys()].filter((slug) => !touched.includes(slug));
    assert.equal(missing.length, 0, `${owner.ownerSlug}: manifest cards not found in the row: ${missing.join(", ")}`);
    const restBefore = hash(stripLines(original, targets));
    if (!apply) {
      results.cardOwners.push({ ownerSlug: owner.ownerSlug, wouldSetLines: touched.length, restHash: restBefore });
      continue;
    }
    const updated = await db.livePage.update({
      where: { id: row.id },
      data: { contentJson },
      select: { id: true }
    });
    const rereadContent = JSON.parse(JSON.stringify((await db.livePage.findUnique({ where: { id: updated.id }, select: { contentJson: true } })).contentJson));
    assert.equal(
      hash(stripLines(rereadContent, targets)), restBefore,
      `${owner.ownerSlug}: fields outside the card lines changed during the write; refusing to report success.`
    );
    const readLines = new Map();
    walkRead(rereadContent, (slug, line) => { if (targets.has(slug)) readLines.set(slug, line); });
    for (const card of owner.cards) assert.equal(readLines.get(card.publicSlug), card.line, `${owner.ownerSlug}: readback line mismatch on ${card.publicSlug}.`);
    results.cardOwners.push({ ownerSlug: owner.ownerSlug, applied: true, linesSet: touched.length });
  }

  function stripLines(source, targets) {
    const clone = JSON.parse(JSON.stringify(source));
    walkRead(clone, (slug, _line, container) => { if (targets.has(slug)) delete container.line; });
    return clone;
  }
  function walkRead(value, visit, parent = null) {
    if (Array.isArray(value)) { for (const item of value) walkRead(item, visit, parent); return; }
    if (!value || typeof value !== "object") return;
    const slug = typeof value.publicSlug === "string" ? value.publicSlug : undefined;
    if (slug) visit(slug, value.line ?? null, value);
    for (const child of Object.values(value)) walkRead(child, visit, value);
  }

  const appliedCount = Object.values(results).flat().filter((entry) => entry.applied).length;
  const noopCount = Object.values(results).flat().filter((entry) => entry.noop).length;
  console.log(JSON.stringify({
    ok: true,
    target,
    mode: apply ? "apply" : "dry-run",
    actorRows: results.actorRows.length,
    listingRows: results.listingRows.length,
    cardOwners: results.cardOwners.length,
    applied: appliedCount,
    noop: noopCount,
    detail: results
  }, null, 1));
} finally {
  await db.$disconnect();
}
