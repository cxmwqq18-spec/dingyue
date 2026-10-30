#!/usr/bin/env node
// Field-level CAS apply for the reviewed Aidreamcapes placement-tags manifest
// (planned by scripts/plan-aidreamcapes-placement-tags.mjs).
//
// This script:
//   1. verifies the manifest hash, site, target, and confirmation;
//   2. re-reads every affected LivePage row and verifies its base hash;
//   3. verifies every reviewed card still carries the reviewed before state;
//   4. writes only the reviewed `placement` / `chips` fields and the reviewed
//      picker.chips filter rows (no other field, no card body changes);
//   5. verifies post-state invariants inside the transaction (placement
//      pattern, chips normalization completed site-wide);
//   6. reads every row back, advances the derived-state revision once per
//      page, and verifies MyDreamShoots public content did not change.
//
// Dry-run is the default:
//   node --env-file=.env.production scripts/apply-aidreamcapes-placement-tags.mjs --target=production
//   node --env-file=.env.production scripts/apply-aidreamcapes-placement-tags.mjs --target=production --apply \
//     --confirm=site_aidreamcapes-placement-tags-production --base-hash=<planHash>
//
// This script never writes publications or snapshots, never touches
// MyDreamShoots rows, and never creates or deletes LivePage rows.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { MEDIA_PLACEMENT_PATTERN, CHIPS_REPLACE } from "./lib/aidreamcapes-placement-vocabulary.mjs";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-placement-tags-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const expectedConfirmation = target === "production"
  ? "site_aidreamcapes-placement-tags-production"
  : "site_aidreamcapes-placement-tags";
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-placement-tags-${target}-2026-10-30.json`
);

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
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
function labelOf(card) {
  return text(card?.label) || text(card?.title);
}
function kindOf(card) {
  if (card?.kind === "photo") return "photo";
  if (card?.kind === "video" || card?.kind === "clip" || card?.kind === "scene") return "video";
  return undefined;
}
function publicSlugOf(card) {
  return text(card?.publicSlug);
}
function chipsOf(card) {
  return Array.isArray(card?.chips) ? card.chips.filter((chip) => typeof chip === "string" && chip.trim()) : [];
}
function placementOf(card) {
  return Array.isArray(card?.placement) ? card.placement.filter((value) => typeof value === "string" && value.trim()) : [];
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
function resolveNode(contentJson, jsonPath) {
  let node = contentJson;
  for (const step of parseJsonPath(jsonPath)) {
    if (node === null || node === undefined) return undefined;
    if (typeof step === "number") {
      if (!Array.isArray(node)) return undefined;
    } else if (typeof node !== "object" || Array.isArray(node)) {
      return undefined;
    }
    node = node[step];
  }
  return node;
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
function cardSnapshot(card) {
  return {
    label: labelOf(card),
    kind: kindOf(card),
    image: record(card?.image) ?? null,
    prompt: typeof card?.prompt === "string" ? card.prompt.trim() : "",
    href: text(card?.href),
    sceneSlug: text(card?.sceneSlug),
    publicSlug: publicSlugOf(card),
    detailAliasOf: text(card?.detailAliasOf) || null,
    chips: chipsOf(card),
    placement: placementOf(card)
  };
}
function cardHash(card) {
  return hash(cardSnapshot(card));
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.ok, true, "Manifest is not marked ok; plan first.");
assert.equal(manifest.contract, CONTRACT, "Manifest contract mismatch.");
assert.equal(manifest.siteId, SITE_ID, "Manifest site mismatch.");
assert.equal(manifest.target, target, "Manifest target mismatch.");
if (apply) {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert.equal(baseHash, manifest.planHash, "Apply requires --base-hash=<manifest planHash> (CAS).");
}

const db = new PrismaClient({ errorFormat: "minimal" });
async function loadBatch(client, cursor, select) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await client.livePage.findMany({
        where: { siteId: SITE_ID },
        orderBy: { id: "asc" },
        take: 20,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select
      });
    } catch (error) {
      lastError = error;
      if (!String(error?.message ?? "").includes("Server has closed the connection")) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw lastError;
}
async function loadRows(client, select) {
  const rows = [];
  let cursor;
  for (;;) {
    const batch = await loadBatch(client, cursor, select);
    rows.push(...batch);
    if (batch.length < 20) break;
    cursor = batch[batch.length - 1].id;
  }
  return rows;
}

const aborted = [];
const skipped = [];
const planned = [];
try {
  const rows = await loadRows(db, {
    id: true,
    siteId: true,
    slug: true,
    title: true,
    pageType: true,
    templateKey: true,
    contentJson: true,
    updatedAt: true
  });
  assert(rows.length > 0, `No LivePage rows for ${SITE_ID}.`);

  for (const page of manifest.pages) {
    const row = rows.find((entry) => entry.slug === page.slug);
    if (!row) {
      aborted.push({ page: page.slug, reason: "LivePage is missing" });
      continue;
    }
    if (pageHash(row) !== page.pageHash) {
      aborted.push({ page: page.slug, reason: "LivePage changed since the reviewed plan (baseHash mismatch)" });
      continue;
    }
    const states = [];
    for (const cardPlan of page.cards) {
      const card = record(resolveNode(row.contentJson, cardPlan.jsonPath));
      if (!card) {
        aborted.push({ page: page.slug, card: cardPlan.jsonPath, reason: "card path is missing" });
        continue;
      }
      const state = cardHash(card) === cardPlan.afterHash
        ? "after"
        : cardHash(card) === cardPlan.beforeHash
          ? "before"
          : "conflict";
      states.push({ cardPlan, card, state });
      if (state === "conflict") {
        aborted.push({
          page: page.slug,
          card: cardPlan.jsonPath,
          reason: "card differs from both the reviewed before and after state; online edit wins, refusing to overwrite"
        });
      }
    }
    if (states.some((entry) => entry.state === "conflict")) continue;

    const chipStates = [];
    for (const chipPlan of page.pickerChips ?? []) {
      const chips = resolveNode(row.contentJson, chipPlan.jsonPath);
      if (!Array.isArray(chips)) {
        aborted.push({ page: page.slug, card: chipPlan.jsonPath, reason: "picker.chips path is missing" });
        continue;
      }
      const same = (a, b) => hash(a) === hash(b);
      const state = same(chips, chipPlan.after)
        ? "after"
        : same(chips, chipPlan.before)
          ? "before"
          : "conflict";
      chipStates.push({ chipPlan, chips, state });
      if (state === "conflict") {
        aborted.push({ page: page.slug, card: chipPlan.jsonPath, reason: "picker.chips differs from both reviewed states" });
      }
    }
    if (chipStates.some((entry) => entry.state === "conflict")) continue;
    if (states.every((entry) => entry.state === "after") && chipStates.every((entry) => entry.state === "after")) {
      skipped.push({ page: page.slug, reason: "already applied" });
      continue;
    }
    if (!states.every((entry) => entry.state === "before") || !chipStates.every((entry) => entry.state === "before")) {
      aborted.push({ page: page.slug, reason: "reviewed entries are mixed between before and after; refusing a partial rewrite" });
      continue;
    }

    const nextContentJson = structuredClone(row.contentJson ?? {});
    const writes = [];
    for (const { cardPlan } of states) {
      const targetCard = record(resolveNode(nextContentJson, cardPlan.jsonPath));
      assert(targetCard, `Card ${cardPlan.jsonPath} disappeared while preparing ${page.slug}.`);
      for (const operation of cardPlan.operations) {
        if (operation.field === "placement") {
          for (const value of operation.set) {
            assert(MEDIA_PLACEMENT_PATTERN.test(value), `Refusing placement value "${value}" that violates the pattern.`);
          }
          targetCard.placement = [...new Set(operation.set)].sort();
        } else if (operation.field === "chips") {
          targetCard.chips = [...new Set(operation.set)];
        } else {
          assert.fail(`Refusing unsupported field ${operation.field}.`);
        }
      }
      assert.equal(cardHash(targetCard), cardPlan.afterHash, `Planned card ${cardPlan.jsonPath} did not reach its after hash.`);
      writes.push({ cardPlan, targetCard });
    }
    const chipWrites = [];
    for (const { chipPlan } of chipStates) {
      const targetChips = resolveNode(nextContentJson, chipPlan.jsonPath);
      assert(Array.isArray(targetChips), `picker.chips ${chipPlan.jsonPath} disappeared while preparing ${page.slug}.`);
      assert.equal(targetChips.length, chipPlan.before.length, "picker.chips changed length outside the plan.");
      // Replace the array contents in place, preserving object identity of the container.
      targetChips.length = 0;
      for (const chip of chipPlan.after) targetChips.push(chip);
      chipWrites.push({ chipPlan });
    }
    planned.push({ row, page, nextContentJson, writes, chipWrites });
  }

  const summary = {
    ok: aborted.length === 0,
    mode: apply ? "apply" : "dry-run",
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    planHash: manifest.planHash,
    pagePlan: manifest.summary,
    pagesPlanned: planned.length,
    cardsPlanned: planned.reduce((total, entry) => total + entry.writes.length, 0),
    pickerChipRowsPlanned: planned.reduce((total, entry) => total + entry.chipWrites.length, 0),
    pagesAlreadyApplied: skipped.length,
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
      process.argv.find((arg) => arg.startsWith("--report="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-placement-tags-${target}-2026-10-30-apply-report.json`
    );
    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-placement-tags-${target}-2026-10-30-rollback.json`
    );

    const protectedMyDreamShootsHash = async (tx) => {
      const rowsMy = await tx.$queryRaw`
        SELECT "slug", "contentJson", "updatedAt"
        FROM "LivePage"
        WHERE "siteId" <> ${SITE_ID}
        ORDER BY "id"
        LIMIT 5
      `;
      return hash(rowsMy);
    };

    const report = await db.$transaction(async (tx) => {
      const protectedBefore = await protectedMyDreamShootsHash(tx);
      const readRevision = async () => {
        const revisionRows = await tx.$queryRaw`
          SELECT "revision"::text AS revision
          FROM "SiteContentRevision"
          WHERE "siteId" = ${SITE_ID}
          LIMIT 1
        `;
        return BigInt(revisionRows[0]?.revision ?? "0");
      };
      const revisionBefore = await readRevision();
      const applied = [];
      for (const entry of planned) {
        const updated = await tx.livePage.updateMany({
          where: { id: entry.row.id, updatedAt: entry.row.updatedAt },
          data: { contentJson: entry.nextContentJson }
        });
        assert.equal(updated.count, 1, `LivePage ${entry.row.id} changed concurrently; refusing to overwrite.`);
        applied.push({
          page: entry.page.slug,
          cards: entry.writes.map((write) => write.cardPlan.jsonPath),
          pickerChips: entry.chipWrites.map((write) => write.chipPlan.jsonPath)
        });
      }
      const readback = [];
      for (const entry of planned) {
        const row = await tx.livePage.findUniqueOrThrow({
          where: { id: entry.row.id },
          select: { slug: true, contentJson: true, updatedAt: true }
        });
        for (const { cardPlan } of entry.writes) {
          const card = record(resolveNode(row.contentJson, cardPlan.jsonPath));
          assert(card, `Card ${cardPlan.jsonPath} is missing after the write on ${entry.page.slug}.`);
          assert.equal(cardHash(card), cardPlan.afterHash, `Card ${cardPlan.jsonPath} did not read back at its after hash.`);
        }
        for (const { chipPlan } of entry.chipWrites) {
          const chips = resolveNode(row.contentJson, chipPlan.jsonPath);
          assert(Array.isArray(chips) && hash(chips) === hash(chipPlan.after), `picker.chips ${chipPlan.jsonPath} did not read back at its after state.`);
        }
        readback.push({ page: entry.page.slug, pageHash: pageHash(row) });
      }
      // Site-wide invariants: every written placement value is pattern-valid,
      // and no card anywhere still carries a synonym chip that had to move.
      const [invariant] = await tx.$queryRaw`
        WITH cards AS (
          SELECT jsonb_path_query(p."contentJson", '$.sections.*.settings.data.visual.picker.cards[*]') AS card
            FROM "LivePage" p WHERE p."siteId" = ${SITE_ID}
          UNION ALL
          SELECT jsonb_path_query(p."contentJson", '$.sections.*.settings.data.workspaceCases[*]')
            FROM "LivePage" p WHERE p."siteId" = ${SITE_ID}
          UNION ALL
          SELECT jsonb_path_query(p."contentJson", '$.sections.*.settings.data.examples.groups[*].items[*]')
            FROM "LivePage" p WHERE p."siteId" = ${SITE_ID}
          UNION ALL
          SELECT jsonb_path_query(p."contentJson", '$.sections.*.settings.data.templateDefinition.card')
            FROM "LivePage" p WHERE p."siteId" = ${SITE_ID}
        )
        SELECT
          (SELECT count(*) FROM cards c, jsonb_array_elements_text(COALESCE(c.card->'placement','[]'::jsonb)) pl
            WHERE c.card IS NOT NULL AND pl !~ ${MEDIA_PLACEMENT_PATTERN.source}) AS invalid_placement_values,
          (SELECT count(*) FROM cards c, jsonb_array_elements_text(COALESCE(c.card->'chips','[]'::jsonb)) ch
            WHERE c.card IS NOT NULL AND ch IN ('apparel','accessories','trending')) AS unnormalized_chips
      `;
      assert.equal(Number(invariant.invalid_placement_values), 0, "An invalid placement value survived the apply.");
      assert.equal(Number(invariant.unnormalized_chips), 0, "A synonym chip survived the apply.");
      const invariants = {
        invalid_placement_values: Number(invariant.invalid_placement_values),
        unnormalized_chips: Number(invariant.unnormalized_chips)
      };
      const revisionAfter = await readRevision();
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(planned.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${planned.length}.`
      );
      const protectedAfter = await protectedMyDreamShootsHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the placement-tags apply.");

      return {
        ok: true,
        mode: "apply",
        contract: CONTRACT,
        siteId: SITE_ID,
        target,
        planHash: manifest.planHash,
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        revisionDelta: (revisionAfter - revisionBefore).toString(),
        pagesApplied: applied.length,
        cardsApplied: applied.reduce((total, entry) => total + entry.cards.length, 0),
        pickerChipRowsApplied: applied.reduce((total, entry) => total + entry.pickerChips.length, 0),
        invariants,
        applied,
        readback
      };
    });

    // Field-level inverse for a future rollback: same rows, same fields,
    // before/after swapped, current readback hash as the base.
    const rollbackPages = planned.map((entry, index) => ({
      slug: entry.page.slug,
      pageHash: report.readback[index].pageHash,
      cards: entry.writes.map(({ cardPlan }) => ({
        source: cardPlan.source,
        jsonPath: cardPlan.jsonPath,
        label: cardPlan.label,
        kind: cardPlan.kind,
        publicSlug: cardPlan.publicSlug,
        before: cardPlan.after,
        after: cardPlan.before,
        beforeHash: cardPlan.afterHash,
        afterHash: cardPlan.beforeHash,
        operations: cardPlan.operations.map((operation) => ({
          field: operation.field,
          from: operation.set,
          set: operation.from
        }))
      })),
      pickerChips: (entry.page.pickerChips ?? []).map((chipPlan) => ({
        jsonPath: chipPlan.jsonPath,
        before: chipPlan.after,
        after: chipPlan.before
      }))
    }));
    const rollback = {
      ok: true,
      contract: `${CONTRACT}-rollback`,
      siteId: SITE_ID,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      summary: {
        pages: rollbackPages.length,
        cards: rollbackPages.reduce((total, page) => total + page.cards.length, 0),
        pickerChips: rollbackPages.reduce((total, page) => total + (page.pickerChips?.length ?? 0), 0)
      },
      pages: rollbackPages,
      operations: [],
      addresses: []
    };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      ...summary,
      applied: report.pagesApplied,
      revisionBefore: report.revisionBefore,
      revisionAfter: report.revisionAfter,
      invariants: report.invariants,
      reportPath,
      rollbackPath
    }, null, 2));
  }
} finally {
  await db.$disconnect();
}
