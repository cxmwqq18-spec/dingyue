#!/usr/bin/env node
// Apply the reviewed AIVideosUGC / site_aidreamcapes example-media slug manifest
// with compare-and-set.
//
// The manifest is produced by
// `scripts/plan-aidreamcapes-example-media-slugs.mjs` and reviewed as a file in
// `scripts/manifests/`. This script writes exactly one field per card —
// `publicSlug` — into `LivePage.contentJson` of `site_aidreamcapes` rows and
// nothing else. It never writes `SitePublishedState`, a publication, a
// snapshot, or another site.
//
// Safety rules:
//   * `--target=local --apply --confirm=site_aidreamcapes-example-media-slugs
//     --base-hash=<manifest planHash>` is required for any write. The flag value
//     is the manifest `planHash`, so only the reviewed artifact can be applied.
//   * Without `--apply` the script only prints the diff.
//   * Every page must still match its reviewed `baseHash`, unless the page is
//     already in the applied state (all of its cards carry the planned slug).
//   * Every card must still carry the reviewed label + image.src fingerprint.
//   * A card that already has a different `publicSlug` aborts the run; an equal
//     one is skipped. Online edits win; a non-empty value is never overwritten —
//     the only exception is the exact value a previous revision of this same
//     manifest wrote (`supersedes` on the card, local only), which a corrected
//     plan may replace.
//   * The whole plan is validated (hashes, fingerprints, slug uniqueness)
//     before the first write, so a dirty plan writes nothing.
//   * Each page update is guarded by `updatedAt`, so a concurrent edit is
//     detected instead of overwritten.
//
// Usage:
//   node scripts/apply-aidreamcapes-example-media-slugs.mjs --target=local
//   node scripts/apply-aidreamcapes-example-media-slugs.mjs --target=local --apply \
//     --confirm=site_aidreamcapes-example-media-slugs --base-hash=<planHash>
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(here, "manifests", "aidreamcapes-example-media-slugs-2026-10-21.json");
const CONTRACT = "aidreamcapes-example-media-slugs-2026-10-21-v1";
const CONFIRM = "site_aidreamcapes-example-media-slugs";
const SITE_ID = "site_aidreamcapes";
const SLUG_MAX = 80;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROOTS = new Set(["ai-image-generation", "ai-video-generation"]);

assert(fs.existsSync(manifestPath), `Manifest not found: ${manifestPath}. Run the plan script first.`);
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
  assert(target === "local", "This manifest is reviewed for the local database only; refusing another write target.");
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
function detailPath(kind, slug) {
  return `/${kind === "video" ? "ai-video-generation" : "ai-image-generation"}/${slug}`;
}

/** Splits `sections.v2_main.settings.data.visual.picker.cards[3]` into steps. */
function parseJsonPath(jsonPath) {
  const steps = [];
  for (const part of String(jsonPath).split(".")) {
    const match = part.match(/^([^[\]]+)((?:\[\d+\])*)$/);
    assert(match, `Unsupported manifest jsonPath segment "${part}" in ${jsonPath}.`);
    steps.push(match[1]);
    for (const index of match[2].matchAll(/\[(\d+)\]/g)) steps.push(Number(index[1]));
  }
  return steps;
}
function resolveOwner(contentJson, jsonPath) {
  const steps = parseJsonPath(jsonPath);
  const last = steps.pop();
  let node = contentJson;
  for (const step of steps) {
    if (node === null || node === undefined) return undefined;
    if (typeof step === "number") {
      if (!Array.isArray(node)) return undefined;
    } else if (typeof node !== "object" || Array.isArray(node)) {
      return undefined;
    }
    node = node[step];
  }
  if (!node || typeof node !== "object") return undefined;
  const value = node[last];
  return record(value) ? { container: node, key: last, value } : undefined;
}
/** The rendered card label: picker cards use `label`, example items use `title`. */
function labelOf(card) {
  return typeof card.label === "string" ? card.label : typeof card.title === "string" ? card.title : "";
}
/** The group label that owns an example item (`...groups[<g>].items[<i>]`). */
function resolveGroupLabel(contentJson, jsonPath) {
  const steps = parseJsonPath(jsonPath);
  if (steps.length < 3) return undefined;
  const groupSteps = steps.slice(0, -2);
  let node = contentJson;
  for (const step of groupSteps) {
    if (node === null || node === undefined) return undefined;
    node = node[step];
  }
  const label = record(node)?.label;
  return typeof label === "string" ? label.trim() : undefined;
}
function kindOf(card, source) {
  if (source === "picker") return card.kind;
  return card.kind === "clip" ? "video" : "photo";
}
function collectCardSlugs(value, into = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((child) => collectCardSlugs(child, into));
    return into;
  }
  if (!value || typeof value !== "object") return into;
  for (const [key, child] of Object.entries(value)) {
    if (key === "publicSlug" && typeof child === "string" && child.trim()) into.add(child.trim());
    else collectCardSlugs(child, into);
  }
  return into;
}

const db = new PrismaClient({ errorFormat: "minimal" });
const aborted = [];
const corrections = [];
const plan = [];
let cardsWritten = 0;
let cardsSkipped = 0;

try {
  const rows = await db.livePage.findMany({
    where: { siteId },
    select: {
      id: true,
      siteId: true,
      slug: true,
      title: true,
      pageType: true,
      templateKey: true,
      contentJson: true,
      updatedAt: true
    }
  });
  assert(rows.length > 0, `No LivePage rows for ${siteId}.`);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const livePageSlugs = new Set(rows.map((row) => row.slug));
  const existingCardSlugs = new Set();
  for (const row of rows) collectCardSlugs(row.contentJson, existingCardSlugs);

  // ---- Phase 1: validate the whole plan before any write -------------------
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
    const currentHash = pageHash(row);
    const hashMatches = currentHash === page.baseHash;
    const nextContentJson = structuredClone(row.contentJson ?? {});
    const writes = [];
    const appliedHere = [];
    for (const card of page.cards ?? []) {
      const located = resolveOwner(nextContentJson, card.jsonPath);
      if (!located) {
        aborted.push({ page: scope, card: card.jsonPath, reason: "card path is missing" });
        continue;
      }
      const value = located.value;
      const label = labelOf(value);
      if (label !== (card.storedLabel ?? card.label)) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `card label changed from "${card.storedLabel ?? card.label}" to "${label}"` });
        continue;
      }
      if (card.labelSource === "group") {
        // The video hub shows the group name on the card; the slug follows it,
        // so the group label is part of the reviewed fingerprint.
        const groupLabel = resolveGroupLabel(nextContentJson, card.jsonPath);
        if (groupLabel !== card.label) {
          aborted.push({ page: scope, card: card.jsonPath, reason: `card group label changed from "${card.label}" to "${String(groupLabel)}"` });
          continue;
        }
      }
      const imageSrc = record(value.image)?.src;
      if (imageSrc !== card.imageSrc) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `card image changed from ${card.imageSrc} to ${String(imageSrc)}` });
        continue;
      }
      const kind = kindOf(value, card.source);
      if (kind !== card.kind) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `card kind is ${String(kind)}, planned ${card.kind}` });
        continue;
      }
      if (!SLUG_RE.test(card.publicSlug ?? "") || card.publicSlug.length > SLUG_MAX) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `planned slug ${String(card.publicSlug)} is not a valid public slug` });
        continue;
      }
      const existing = typeof value.publicSlug === "string" ? value.publicSlug.trim() : "";
      if (existing) {
        if (existing === card.publicSlug) {
          cardsSkipped += 1;
          appliedHere.push(card.jsonPath);
          continue;
        }
        if (card.supersedes && existing === card.supersedes) {
          // A corrected plan may replace the exact value this manifest planned
          // earlier (same review artifact, local only). Nothing else.
          corrections.push({ page: scope, card: card.jsonPath, from: existing, to: card.publicSlug });
          writes.push({ card, target: located });
          continue;
        }
        aborted.push({ page: scope, card: card.jsonPath, reason: `card already carries publicSlug "${existing}"; online edit wins, refusing to overwrite` });
        continue;
      }
      writes.push({ card, target: located });
    }

    if (!hashMatches) {
      // The reviewed row hash no longer matches. That is expected after this
      // manifest has been applied (the row now carries the planned slugs), so a
      // page whose cards all match the plan is simply skipped. Any card still
      // missing its slug means someone else edited the row: abort instead.
      if (writes.length) {
        aborted.push({ page: scope, reason: "LivePage changed since the reviewed plan (baseHash mismatch)" });
        continue;
      }
    }

    // Uniqueness is asserted against the whole current inventory, ignoring the
    // values this plan is about to create (they are empty right now).
    for (const { card } of writes) {
      if (existingCardSlugs.has(card.publicSlug)) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `slug ${card.publicSlug} already exists on another card` });
      }
      const detail = detailPath(card.kind, card.publicSlug);
      if (livePageSlugs.has(detail)) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `slug ${card.publicSlug} collides with the LivePage path ${detail}` });
      }
    }
    plan.push({ row, page, nextContentJson, writes });
  }

  const uniquePlanned = new Set();
  for (const entry of plan) {
    for (const { card } of entry.writes) {
      if (uniquePlanned.has(card.publicSlug)) {
        aborted.push({ page: entry.page.slug, card: card.jsonPath, reason: `slug ${card.publicSlug} is planned twice` });
      }
      uniquePlanned.add(card.publicSlug);
    }
  }

  const diff = plan.map((entry) => ({
    page: entry.page.slug,
    cards: entry.writes.length,
    skipped: (entry.page.cards ?? []).length - entry.writes.length,
    changes: entry.writes.map(({ card }) => ({ jsonPath: card.jsonPath, publicSlug: card.publicSlug, detailPath: card.detailPath ?? detailPath(card.kind, card.publicSlug) }))
  }));
  const plannedWrites = diff.reduce((total, entry) => total + entry.cards, 0);

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
    cardsInManifest: (manifest.pages ?? []).reduce((total, page) => total + (page.cards ?? []).length, 0),
    cardsPlanned: plannedWrites,
    cardsSkipped,
    cardsCorrected: corrections.length,
    corrections,
    abortedReasons: aborted,
    derivedCache: "not written; public SSR reads the relational LivePage directly"
  };

  if (!apply || aborted.length) {
    result.pagesTouched = 0;
    result.cardsWritten = 0;
    result.writes = 0;
    result.diff = diff.filter((entry) => entry.cards);
    console.log(JSON.stringify(result, null, 2));
    if (aborted.length) process.exitCode = 1;
  } else {
    // ---- Phase 2: guarded writes ------------------------------------------
    const touched = [];
    let stopped;
    for (const entry of plan) {
      if (!entry.writes.length) continue;
      const { row, page, nextContentJson } = entry;
      for (const { card, target: located } of entry.writes) {
        located.container[located.key] = { ...located.value, publicSlug: card.publicSlug };
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
        select: {
          id: true,
          siteId: true,
          slug: true,
          title: true,
          pageType: true,
          templateKey: true,
          contentJson: true,
          updatedAt: true
        }
      });
      assert(readback, `LivePage ${row.id} readback is missing.`);
      assert.equal(readback.title, row.title, `LivePage ${page.slug} title changed during apply.`);
      assert.equal(stable(readback.contentJson), stable(nextContentJson), `LivePage ${page.slug} readback did not match the planned content.`);
      for (const { card } of entry.writes) {
        const after = resolveOwner(readback.contentJson, card.jsonPath);
        assert(after && after.value.publicSlug === card.publicSlug, `LivePage ${page.slug} did not persist ${card.publicSlug}.`);
        cardsWritten += 1;
      }
      touched.push({ page: page.slug, cards: entry.writes.length, updatedAt: readback.updatedAt });
    }
    if (stopped) {
      aborted.push(stopped);
      result.ok = false;
      process.exitCode = 1;
    }
    result.mode = "applied";
    result.pagesTouched = touched.length;
    result.cardsWritten = cardsWritten;
    result.writes = touched.length;
    result.readback = touched;
    result.abortedReasons = aborted;
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, siteId, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
