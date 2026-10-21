#!/usr/bin/env node
// Field-level apply for the Aidreamcapes media detail slug normalization.
//
// The reviewed manifest is the review artifact. This script:
//   1. verifies the manifest hash and the scoped target;
//   2. re-reads every affected LivePage row and verifies its base hash;
//   3. writes only two fields per card - `publicSlug` and `publicAliases`;
//   4. verifies each card still carries the reviewed label + image.src +
//      kind fingerprint and that the new slug is unique site-wide;
//   5. reads every row back, checks the SiteContentRevision trigger advanced
//      exactly once, and verifies MyDreamShoots public content did not change.
//
// Dry-run is the default. Apply requires the reviewed plan hash and the
// explicit confirmation phrase:
//   node scripts/apply-aidreamcapes-media-slug-alias.mjs --target=local
//   node scripts/apply-aidreamcapes-media-slug-alias.mjs --target=local --apply \
//     --confirm=site_aidreamcapes-media-slug-alias --base-hash=<planHash>
// Production additionally requires:
//   --target=production --confirm=site_aidreamcapes-media-slug-alias-production
//
// A card that already carries the planned slug and aliases is skipped, so an
// applied manifest can be replayed. A card that carries a different slug is
// never overwritten: the online edit wins and the run reports it.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import {
  argumentValue,
  assertAllowedSite,
  assertDatabaseTarget,
  hasArgument
} from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const CONTRACT = "aidreamcapes-media-slug-alias-2026-10-22-v1";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const confirmation = argumentValue("--confirm");
const baseHash = argumentValue("--base-hash");
const apply = hasArgument("--apply");
const expectedConfirmation = target === "production"
  ? "site_aidreamcapes-media-slug-alias-production"
  : "site_aidreamcapes-media-slug-alias";
const defaultManifestPath = path.resolve(
  process.cwd(),
  `scripts/manifests/aidreamcapes-media-slug-alias-${target}-2026-10-22.json`
);
const manifestPath = argumentValue("--manifest")
  ? path.resolve(process.cwd(), argumentValue("--manifest"))
  : defaultManifestPath;

function stable(value) {
  if (value === undefined) return '"<undefined>"';
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

/** Resolves `sections.<id>.settings.data.visual.picker.cards[N]` to its container. */
function resolveCard(contentJson, jsonPath) {
  const steps = parseJsonPath(jsonPath);
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
  return record(node) ? node : undefined;
}

function labelOf(card) {
  if (typeof card.label === "string") return card.label.trim();
  if (typeof card.title === "string") return card.title.trim();
  return "";
}

function kindOf(card) {
  if (card.kind === "photo") return "photo";
  if (card.kind === "video" || card.kind === "clip" || card.kind === "scene") return "video";
  return undefined;
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

async function protectedMyDreamShootsHash(client) {
  const [pages, settings, profile] = await Promise.all([
    client.livePage.findMany({
      where: { siteId: "site_dreamshoot" },
      orderBy: { id: "asc" },
      select: { id: true, contentJson: true, updatedAt: true }
    }),
    client.themeSettings.findUnique({
      where: { siteId: "site_dreamshoot" },
      select: { draftJson: true, publishedJson: true }
    }),
    client.storefrontProfile.findUnique({
      where: { siteId: "site_dreamshoot" },
      select: { publishedJson: true }
    })
  ]);
  return hash({ pages, settings, profile });
}

assert(fs.existsSync(manifestPath), `Manifest not found: ${manifestPath}. Run the plan script first.`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.ok, true, "Manifest is not an ok plan.");
assert.equal(manifest.contract, CONTRACT, `Manifest contract must be ${CONTRACT}.`);
assert.equal(manifest.siteId, SITE_ID, "Manifest must be scoped to site_aidreamcapes.");
assert.equal(manifest.target, target, `Manifest target ${manifest.target} does not match requested target ${target}.`);
const recomputed = hash({
  contract: manifest.contract,
  siteId: manifest.siteId,
  target: manifest.target,
  canonicalWall: manifest.canonicalWall,
  pages: manifest.pages,
  skipped: manifest.skipped,
  addresses: manifest.addresses
});
assert.equal(recomputed, manifest.planHash, "Manifest content does not match its plan hash.");

assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed: confirmation === expectedConfirmation
});
if (apply) {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert(baseHash, "Apply requires --base-hash=<manifest planHash>.");
  assert.equal(baseHash, manifest.planHash, "The reviewed plan hash does not match the manifest; re-run the plan and review it again.");
}

const db = new PrismaClient({ errorFormat: "minimal" });
const aborted = [];
const skipped = [];
const writes = [];
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    orderBy: { id: "asc" },
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
  assert(rows.length > 0, `No LivePage rows for ${SITE_ID}.`);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const livePageSlugs = new Set(rows.map((row) => row.slug));

  // The slugs this run introduces must not collide with another card's slug.
  const ownedSlugs = new Map();
  for (const row of rows) {
    const content = record(row.contentJson);
    const sections = record(content?.sections);
    const order = Array.isArray(content?.sectionsOrder) && content.sectionsOrder.length
      ? content.sectionsOrder
      : Object.keys(sections ?? {});
    for (const sectionId of order) {
      const section = record(sections?.[sectionId]);
      if (!section || section.type !== "aidreamcapes_v2_page") continue;
      const data = record(record(section.settings)?.data);
      const picker = record(record(data?.visual)?.picker);
      if (!Array.isArray(picker?.cards)) continue;
      picker.cards.forEach((value, index) => {
        const card = record(value);
        const slug = typeof card?.publicSlug === "string" ? card.publicSlug.trim() : "";
        if (!slug) return;
        const list = ownedSlugs.get(slug) ?? [];
        list.push({ page: row.slug, jsonPath: `sections.${sectionId}.settings.data.visual.picker.cards[${index}]` });
        ownedSlugs.set(slug, list);
      });
    }
  }

  // ---- Validate the whole manifest before the first write -----------------
  const planned = [];
  for (const page of manifest.pages ?? []) {
    const scope = page.slug;
    const row = byId.get(page.id);
    if (!row) {
      aborted.push({ page: scope, reason: `LivePage ${page.id} no longer exists` });
      continue;
    }
    if (row.siteId !== SITE_ID) {
      aborted.push({ page: scope, reason: `LivePage belongs to ${row.siteId}, not ${SITE_ID}` });
      continue;
    }
    if (row.slug !== page.slug) {
      aborted.push({ page: scope, reason: `LivePage slug changed to ${row.slug}` });
      continue;
    }
    const currentHash = pageHash(row);
    const nextContentJson = structuredClone(row.contentJson ?? {});
    const pageWrites = [];
    for (const card of page.cards ?? []) {
      const located = resolveCard(nextContentJson, card.jsonPath);
      if (!located) {
        aborted.push({ page: scope, card: card.jsonPath, reason: "card path is missing" });
        continue;
      }
      const value = located;
      const label = labelOf(value);
      if (label !== card.label) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `card label changed from "${card.label}" to "${label}"` });
        continue;
      }
      const imageSrc = record(value.image)?.src;
      if (imageSrc !== card.imageSrc) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `card image changed from ${card.imageSrc} to ${String(imageSrc)}` });
        continue;
      }
      const kind = kindOf(value);
      if (kind !== card.kind) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `card kind is ${String(kind)}, planned ${card.kind}` });
        continue;
      }
      const existing = typeof value.publicSlug === "string" ? value.publicSlug.trim() : "";
      const existingAliases = Array.isArray(value.publicAliases)
        ? value.publicAliases.filter((entry) => typeof entry === "string" && entry.trim())
        : [];
      const plannedAliases = card.afterAliases ?? [];
      if (existing === card.afterSlug && JSON.stringify(existingAliases) === JSON.stringify(plannedAliases)) {
        skipped.push({ page: scope, card: card.jsonPath, slug: card.afterSlug });
        continue;
      }
      if (existing !== card.beforeSlug) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `card already carries publicSlug "${existing}"; online edit wins, refusing to overwrite` });
        continue;
      }
      const plannedBefore = card.beforeAliases ?? null;
      const currentBefore = existingAliases.length ? existingAliases : null;
      if (JSON.stringify(currentBefore) !== JSON.stringify(plannedBefore)) {
        aborted.push({ page: scope, card: card.jsonPath, reason: "card aliases changed since the reviewed plan" });
        continue;
      }
      pageWrites.push({ card, value });
    }

    // A new slug may not be owned by a different card anywhere on the site.
    for (const { card } of pageWrites) {
      const holders = (ownedSlugs.get(card.afterSlug) ?? []).filter(
        (holder) => !(holder.page === scope && holder.jsonPath === card.jsonPath)
      );
      if (holders.length) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `slug ${card.afterSlug} is already owned by ${holders.map((h) => `${h.page}${h.jsonPath}`).join(", ")}` });
      }
      if (livePageSlugs.has(`/${card.kind === "photo" ? "ai-image-generation" : "ai-video-generation"}/${card.afterSlug}`)) {
        aborted.push({ page: scope, card: card.jsonPath, reason: `slug ${card.afterSlug} collides with a LivePage path` });
      }
    }

    if (pageWrites.length && currentHash !== page.baseHash) {
      aborted.push({ page: scope, reason: "LivePage changed since the reviewed plan (baseHash mismatch)" });
      continue;
    }
    if (pageWrites.length) planned.push({ row, page, nextContentJson, pageWrites });
  }

  const summary = {
    ok: aborted.length === 0,
    mode: apply ? "apply" : "dry-run",
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    planHash: manifest.planHash,
    manifest: path.relative(process.cwd(), manifestPath),
    pages: planned.length,
    cardsPlanned: planned.reduce((total, entry) => total + entry.pageWrites.length, 0),
    cardsAlreadyApplied: skipped.length,
    aborted,
    skipped
  };

  if (!apply || !planned.length) {
    console.log(JSON.stringify({ ...summary, noop: apply && !planned.length }, null, 2));
  } else {
    const [revisionRelation] = await db.$queryRaw`SELECT to_regclass('public."SiteContentRevision"')::text AS relation`;
    assert(revisionRelation?.relation, "SiteContentRevision table is missing; refusing to write without derived-state revision.");
    const [revisionTrigger] = await db.$queryRaw`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'public."LivePage"'::regclass
        AND tgname = 'SiteContentRevision_LivePage'
      LIMIT 1
    `;
    assert(revisionTrigger?.tgname, "SiteContentRevision_LivePage trigger is missing; refusing to write without derived-state revision.");

    const reportPath = path.resolve(
      process.cwd(),
      argumentValue("--report") || `scripts/manifests/aidreamcapes-media-slug-alias-${target}-2026-10-22-apply-report.json`
    );
    // The field-level inverse manifest: it restores the retired address of
    // every card this run rewrote, against the current relational rows.
    const rollbackPath = path.resolve(
      process.cwd(),
      argumentValue("--rollback") || `scripts/manifests/aidreamcapes-media-slug-alias-${target}-2026-10-22-rollback.json`
    );
    const report = await db.$transaction(async (tx) => {
      const protectedBefore = await protectedMyDreamShootsHash(tx);
      const readRevision = async () => {
        const rows = await tx.$queryRaw`
          SELECT "revision"::text AS revision
          FROM "SiteContentRevision"
          WHERE "siteId" = ${SITE_ID}
          LIMIT 1
        `;
        return BigInt(rows[0]?.revision ?? "0");
      };
      const revisionBefore = await readRevision();
      const applied = [];
      for (const entry of planned) {
        for (const { card, value } of entry.pageWrites) {
          value.publicSlug = card.afterSlug;
          value.publicAliases = card.afterAliases;
        }
        const updated = await tx.livePage.updateMany({
          where: { id: entry.row.id, updatedAt: entry.row.updatedAt },
          data: { contentJson: entry.nextContentJson }
        });
        assert.equal(updated.count, 1, `LivePage ${entry.row.id} changed concurrently; refusing to overwrite.`);
        applied.push({ page: entry.page.slug, cards: entry.pageWrites.map((write) => write.card.jsonPath) });
      }
      // Read every affected row back and verify the planned values.
      for (const entry of planned) {
        const readback = await tx.livePage.findUniqueOrThrow({
          where: { id: entry.row.id },
          select: { slug: true, contentJson: true, updatedAt: true }
        });
        for (const { card } of entry.pageWrites) {
          const value = resolveCard(readback.contentJson, card.jsonPath);
          assert(value, `Card ${card.jsonPath} is missing after the write on ${entry.page.slug}.`);
          assert.equal(value.publicSlug, card.afterSlug, `Card ${card.jsonPath} did not read back with the planned slug.`);
          assert.deepEqual(value.publicAliases, card.afterAliases, `Card ${card.jsonPath} did not read back with the planned aliases.`);
        }
        applied.find((entryApplied) => entryApplied.page === entry.page.slug);
      }
      const revisionAfter = await readRevision();
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(planned.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${planned.length}.`
      );
      const protectedAfter = await protectedMyDreamShootsHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the media slug alias apply.");
      const [derivedRelation] = await db.$queryRaw`
        SELECT to_regclass('public."SitePublishedState"')::text AS relation
      `;
      const derivedState = derivedRelation?.relation
        ? (await tx.$queryRaw`
            SELECT "revision"::text AS revision, "contentHash"
            FROM "SitePublishedState"
            WHERE "siteId" = ${SITE_ID}
            LIMIT 1
          `)[0] ?? null
        : null;
      return {
        ok: true,
        siteId: SITE_ID,
        target,
        planHash: manifest.planHash,
        owner: "LivePage.contentJson",
        applied,
        fieldsApplied: planned.reduce((total, entry) => total + entry.pageWrites.length * 2, 0),
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        revisionDelta: (revisionAfter - revisionBefore).toString(),
        protectedMyDreamShootsHashBefore: protectedBefore,
        protectedMyDreamShootsHashAfter: protectedAfter,
        myDreamShootsChanged: protectedAfter !== protectedBefore,
        derivedStateReadOnly: derivedState
          ? { revision: derivedState.revision.toString(), contentHash: derivedState.contentHash }
          : null,
        snapshotOrPublicationWritten: false,
        historicalStateActivated: false
      };
    }, { isolationLevel: "Serializable", timeout: 180000 });

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ ...summary, report }, null, 2)}\n`, "utf8");
    const rollback = {
      contract: `${CONTRACT}-rollback`,
      siteId: SITE_ID,
      target,
      planHash: manifest.planHash,
      generatedAt: new Date().toISOString(),
      owner: "LivePage.contentJson",
      note: "Field-level inverse of this apply. Each operation restores the retired publicSlug and publicAliases of one card.",
      operations: planned.flatMap((entry) => entry.pageWrites.map(({ card }) => ({
        siteId: SITE_ID,
        pageId: entry.row.id,
        ownerPath: entry.page.slug,
        cardPath: card.jsonPath,
        kind: card.kind,
        label: card.label,
        imageSrc: card.imageSrc,
        beforeSlug: card.beforeSlug,
        beforeAliases: card.beforeAliases,
        afterSlug: card.afterSlug,
        afterAliases: card.afterAliases,
        oldPath: card.oldPath,
        newPath: card.newPath
      })))
    };
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      ...summary,
      revisionBefore: report.revisionBefore,
      revisionAfter: report.revisionAfter,
      revisionDelta: report.revisionDelta,
      myDreamShootsChanged: report.myDreamShootsChanged,
      report: path.relative(process.cwd(), reportPath),
      rollback: path.relative(process.cwd(), rollbackPath)
    }, null, 2));
  }
  if (aborted.length) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: apply ? "apply" : "dry-run",
    target,
    siteId: SITE_ID,
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
