#!/usr/bin/env node
// AIVideosUGC listing intro repair — 2026-11-21.
// The first detail-copy apply wrote a serialized null into the intro arrays of
// the 36 /ai-actors scene and age-range listing rows (a manifest field
// mismatch: [undefined] became [null] in JSON), which crashes the category
// renderer with "Cannot read properties of null (reading 'matchAll')".
//
// This repair is a field-level compare-and-set against the EXACT broken state
// (intro = [originalParagraph, null]) and restores the reviewed paragraph as
// the second item. Everything else in each row is verified unchanged by rest
// hash, matching the inverse-manifest rollback contract.
//
//   dry run:  node scripts/repair-aivideosugc-listing-intro-2026-11-21.mjs --target production
//   apply:    node scripts/repair-aivideosugc-listing-intro-2026-11-21.mjs --target production --apply --confirm=aivideosugc-listing-intro-repair-2026-11-21
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-listing-intro-repair-2026-11-21";
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

for (const plan of manifest.listingRows) {
  assert.equal(plan.append.length, 1, `${plan.rowSlug}: repair expects exactly one appended paragraph.`);
  assert.equal(typeof plan.append[0], "string", `${plan.rowSlug}: appended paragraph must be a string.`);
  assert.equal(plan.append[0].trim().length >= 40, true, `${plan.rowSlug}: appended paragraph too short to be reviewed copy.`);
}

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex").slice(0, 16);
}

function pageDataEntries(contentJson) {
  const sections = contentJson?.sections ?? {};
  return Object.values(sections)
    .map((section) => section?.settings?.data)
    .filter((data) => data && typeof data === "object" && !Array.isArray(data));
}

const db = new PrismaClient();
try {
  const results = [];
  for (const plan of manifest.listingRows) {
    const row = await db.livePage.findUnique({
      where: { siteId_slug: { siteId, slug: plan.rowSlug } },
      select: { id: true, contentJson: true }
    });
    assert(row, `LivePage ${plan.rowSlug} does not exist.`);
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const data = pageDataEntries(contentJson).find((candidate) => Array.isArray(candidate.intro));
    assert(data, `${plan.rowSlug}: no page section with an intro array.`);
    const intro = data.intro;
    const expected = plan.expectedIntro;
    const corrected = [...expected, ...plan.append];
    if (stable(intro) === stable(corrected)) {
      results.push({ rowSlug: plan.rowSlug, noop: true });
      continue;
    }
    // Compare-and-set against the exact broken state this repair targets.
    const isBrokenState = Array.isArray(intro)
      && intro.length === expected.length + 1
      && intro[intro.length - 1] === null
      && stable(intro.slice(0, expected.length)) === stable(expected);
    assert(isBrokenState,
      `${plan.rowSlug}: intro is neither the corrected state nor the exact broken state recorded in the incident; refusing to touch this row.`);
    const restBefore = hash({ ...data, intro: undefined });
    if (!apply) {
      results.push({ rowSlug: plan.rowSlug, wouldRepair: true });
      continue;
    }
    data.intro = corrected;
    const updated = await db.livePage.update({
      where: { id: row.id },
      data: { contentJson },
      select: { id: true }
    });
    const reread = await db.livePage.findUnique({ where: { id: updated.id }, select: { contentJson: true } });
    const rereadData = pageDataEntries(JSON.parse(JSON.stringify(reread.contentJson))).find((candidate) => Array.isArray(candidate.intro));
    assert.equal(stable(rereadData.intro), stable(corrected), `${plan.rowSlug}: readback intro mismatch.`);
    assert.equal(hash({ ...rereadData, intro: undefined }), restBefore, `${plan.rowSlug}: fields outside intro changed during the repair.`);
    results.push({ rowSlug: plan.rowSlug, repaired: true, introLengthAfter: corrected.length });
  }
  console.log(JSON.stringify({
    ok: true,
    target,
    mode: apply ? "apply" : "dry-run",
    rows: results.length,
    repaired: results.filter((entry) => entry.repaired).length,
    noop: results.filter((entry) => entry.noop).length,
    detail: results
  }, null, 1));
} finally {
  await db.$disconnect();
}
