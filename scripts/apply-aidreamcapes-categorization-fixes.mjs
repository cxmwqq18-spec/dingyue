#!/usr/bin/env node
// Field-level CAS apply for the reviewed Aidreamcapes video-detail categorization
// manifest (planned by scripts/plan-aidreamcapes-categorization-fixes.mjs).
//
// This script:
//   1. verifies the manifest hash, site, target, and confirmation;
//   2. re-reads every affected LivePage row and verifies its base page hash;
//   3. verifies every reviewed card still carries its reviewed before state
//      (picker arrays are matched by card identity, other shapes by jsonPath);
//      a copy already sitting at its reviewed after state counts as applied;
//   4. writes only the reviewed `placement` / `label` fields, removes only the
//      two reviewed hub alias cards, and appends only the 22 reviewed reference
//      cards (no other field, no card body change, no slug/owner change);
//   5. verifies post-state invariants inside the transaction (placement
//      pattern site-wide, removal/addition readback);
//   6. reads every row back, advances the derived-state revision exactly once
//      per page, and verifies MyDreamShoots public content did not change.
//
// Dry-run is the default:
//   node --env-file=.env.production scripts/apply-aidreamcapes-categorization-fixes.mjs --target=production
//   node --env-file=.env.production scripts/apply-aidreamcapes-categorization-fixes.mjs --target=production --apply \
//     --confirm=site_aidreamcapes-categorization-fixes-production --base-hash=<planHash>
//
// This script never writes publications or snapshots, never touches
// MyDreamShoots rows, and never creates or deletes LivePage rows.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { MEDIA_PLACEMENT_PATTERN } from "./lib/aidreamcapes-placement-vocabulary.mjs";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-categorization-fixes-${target}-2026-11-02.json`
);
const manifestStem = path.basename(manifestPath, ".json");

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
function publicSlugOf(card) {
  return text(card?.publicSlug);
}
function aliasOf(card) {
  return text(card?.detailAliasOf) || null;
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
function resolveContainer(contentJson, containerPath) {
  const node = resolveNode(contentJson, containerPath);
  return Array.isArray(node) ? node : undefined;
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
    kind: card?.kind === "photo" ? "photo"
      : (card?.kind === "video" || card?.kind === "clip" || card?.kind === "scene") ? "video"
        : typeof card?.kind === "string" ? card.kind : undefined,
    image: record(card?.image) ?? null,
    prompt: typeof card?.prompt === "string" ? card.prompt.trim() : "",
    href: text(card?.href),
    sceneSlug: text(card?.sceneSlug),
    publicSlug: publicSlugOf(card),
    detailAliasOf: aliasOf(card),
    chips: Array.isArray(card?.chips) ? card.chips.filter((chip) => typeof chip === "string" && chip.trim()) : [],
    placement: placementOf(card)
  };
}
function cardHash(card) {
  return hash(cardSnapshot(card));
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.ok, true, "Manifest is not marked ok; plan first.");
const CONTRACT = String(manifest.contract || "");
assert.ok(CONTRACT, "Manifest is missing its contract.");
const expectedConfirmation = String(manifest.confirmation || "");
assert.ok(expectedConfirmation, "Manifest is missing its confirmation string.");
assert.equal(manifest.siteId, SITE_ID, "Manifest site mismatch.");
assert.equal(manifest.target, target, "Manifest target mismatch.");
if (apply) {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert.equal(baseHash, manifest.planHash, "Apply requires --base-hash=<manifest planHash> (CAS).");
}

const db = new PrismaClient({ errorFormat: "minimal" });
const aborted = [];
const skipped = [];
const planned = [];
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    orderBy: { id: "asc" },
    select: {
      id: true, siteId: true, slug: true, title: true, pageType: true,
      templateKey: true, contentJson: true, updatedAt: true
    }
  });
  assert(rows.length > 0, `No LivePage rows for ${SITE_ID}.`);
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));

  // Identity match inside one picker container: the reviewed hash decides and
  // publicSlug/detailAliasOf must line up. Returns the single index or pushes
  // an abort reason and returns undefined.
  function pickerIndexAt(container, { publicSlug, detailAliasOf }, expectHash, page) {
    const hits = [];
    container.forEach((card, index) => {
      if (cardHash(card) !== expectHash) return;
      if (publicSlugOf(card) !== (publicSlug ?? "")) return;
      if (aliasOf(card) !== detailAliasOf) return;
      hits.push(index);
    });
    if (hits.length !== 1) {
      aborted.push({ page, expectHash, reason: `picker identity match found ${hits.length} cards (expected 1)` });
      return undefined;
    }
    return hits[0];
  }

  for (const page of manifest.pages) {
    const row = rowBySlug.get(page.slug);
    if (!row) {
      aborted.push({ page: page.slug, reason: "LivePage is missing" });
      continue;
    }
    if (pageHash(row) !== page.pageHash) {
      aborted.push({ page: page.slug, reason: "LivePage changed since the reviewed plan (pageHash CAS mismatch)" });
      continue;
    }

    const states = [];
    // Card writes: verify before state (jsonPath shapes) or identity (picker).
    for (const write of page.cardWrites ?? []) {
      if (write.shape === "picker") {
        const container = resolveContainer(row.contentJson, write.cardsContainer);
        if (!container) {
          aborted.push({ page: page.slug, card: write.cardsContainer, reason: "picker cards container missing" });
          continue;
        }
        const at = container.filter((card) => cardHash(card) === write.afterHash
          && publicSlugOf(card) === (write.publicSlug ?? "")
          && aliasOf(card) === write.detailAliasOf);
        if (at.length === 1) {
          states.push({ write, mode: "pickerWrite", alreadyApplied: true });
          continue;
        }
        const index = pickerIndexAt(container, write, write.beforeHash, page.slug);
        if (index === undefined) continue;
        states.push({ write, index, mode: "pickerWrite" });
      } else {
        const card = record(resolveNode(row.contentJson, write.jsonPath));
        if (!card) {
          aborted.push({ page: page.slug, card: write.jsonPath, reason: "card path is missing" });
          continue;
        }
        const state = cardHash(card) === write.afterHash
          ? "after"
          : cardHash(card) === write.beforeHash
            ? "before"
            : "conflict";
        if (state === "conflict") {
          aborted.push({
            page: page.slug,
            card: write.jsonPath,
            reason: "card differs from both the reviewed before and after state; online edit wins, refusing to overwrite"
          });
          continue;
        }
        states.push({ write, mode: "write", state });
      }
    }
    // Removals: the reviewed hub alias card must still sit at its before state.
    for (const removal of page.pickerRemovals ?? []) {
      const container = resolveContainer(row.contentJson, removal.cardsContainer);
      if (!container) {
        aborted.push({ page: page.slug, card: removal.cardsContainer, reason: "picker cards container missing" });
        continue;
      }
      const index = pickerIndexAt(container, removal, removal.beforeHash, page.slug);
      if (index === undefined) continue;
      states.push({ removal, index, mode: "pickerRemove" });
    }
    // Additions: the reviewed reference card must not be there yet.
    for (const addition of page.pickerAdditions ?? []) {
      const container = resolveContainer(row.contentJson, addition.cardsContainer);
      if (!container) {
        aborted.push({ page: page.slug, card: addition.cardsContainer, reason: "picker cards container missing" });
        continue;
      }
      const existing = container.filter((card) => cardHash(card) === addition.afterHash).length;
      if (existing > 1) {
        aborted.push({ page: page.slug, card: addition.detailAliasOf, reason: "reference card already present more than once" });
        continue;
      }
      states.push({ addition, mode: "pickerAdd", alreadyApplied: existing === 1 });
    }

    if (aborted.some((entry) => entry.page === page.slug)) continue;

    // Idempotence: every reviewed entry already at its after state.
    const allApplied = states.every((entry) =>
      entry.mode === "pickerAdd" || entry.mode === "pickerRemove"
        ? Boolean(entry.alreadyApplied ?? entry.state === "after")
        : entry.alreadyApplied === true || entry.state === "after");
    if (allApplied && states.length) {
      skipped.push({ page: page.slug, reason: "already applied" });
      continue;
    }
    // Mixed before/after inside one page refuses a partial rewrite.
    const pending = states.filter((entry) =>
      entry.mode === "pickerAdd" ? !entry.alreadyApplied
        : entry.mode === "pickerRemove" ? !entry.alreadyApplied
          : !(entry.alreadyApplied === true || entry.state === "after"));
    if (pending.length !== states.length) {
      aborted.push({ page: page.slug, reason: "reviewed entries are mixed between before and after; refusing a partial rewrite" });
      continue;
    }

    const nextContentJson = structuredClone(row.contentJson ?? {});
    const mutations = [];
    // Ordering: removals, then writes, then additions.
    for (const entry of states.filter((item) => item.mode === "pickerRemove")) {
      const container = resolveContainer(nextContentJson, entry.removal.cardsContainer);
      assert(container, `Container ${entry.removal.cardsContainer} disappeared while preparing ${page.slug}.`);
      const hit = pickerIndexAt(container, entry.removal, entry.removal.beforeHash, page.slug);
      assert(hit !== undefined && !aborted.some((item) => item.page === page.slug),
        `Reviewed removal copy for ${entry.removal.detailAliasOf} vanished while preparing ${page.slug}.`);
      const [removed] = container.splice(hit, 1);
      assert.equal(cardHash(removed), entry.removal.beforeHash, "Removed card drifted between verify and splice.");
      mutations.push({ mode: "remove", detailAliasOf: entry.removal.detailAliasOf });
    }
    const applyCardOperations = (targetCard, operations) => {
      for (const operation of operations) {
        if (operation.field === "placement") {
          for (const value of operation.set) {
            assert(MEDIA_PLACEMENT_PATTERN.test(value), `Refusing placement value "${value}" that violates the pattern.`);
          }
          targetCard.placement = [...new Set(operation.set)].sort();
        } else if (operation.field === "label") {
          // The rendered title comes from `label` (fallback `title`); retire the
          // legacy title key so the reviewed label is the only source.
          delete targetCard.title;
          targetCard.label = operation.set;
        } else {
          assert.fail(`Refusing unsupported field ${operation.field}.`);
        }
      }
    };
    for (const entry of states.filter((item) => item.mode === "pickerWrite")) {
      const container = resolveContainer(nextContentJson, entry.write.cardsContainer);
      assert(container, `Container ${entry.write.cardsContainer} disappeared while preparing ${page.slug}.`);
      const hit = pickerIndexAt(container, entry.write, entry.write.beforeHash, page.slug);
      assert(hit !== undefined && !aborted.some((item) => item.page === page.slug),
        `Reviewed card copy ${entry.write.publicSlug ?? entry.write.detailAliasOf} vanished while preparing ${page.slug}.`);
      const targetCard = container[hit];
      applyCardOperations(targetCard, entry.write.operations);
      assert.equal(cardHash(targetCard), entry.write.afterHash,
        `Planned card ${entry.write.publicSlug ?? entry.write.detailAliasOf} did not reach its after hash.`);
      mutations.push({ mode: "write", picker: true, label: entry.write.label, publicSlug: entry.write.publicSlug, detailAliasOf: entry.write.detailAliasOf });
    }
    for (const entry of states.filter((item) => item.mode === "write")) {
      const targetCard = record(resolveNode(nextContentJson, entry.write.jsonPath));
      assert(targetCard, `Card ${entry.write.jsonPath} disappeared while preparing ${page.slug}.`);
      applyCardOperations(targetCard, entry.write.operations);
      assert.equal(cardHash(targetCard), entry.write.afterHash, `Planned card ${entry.write.jsonPath} did not reach its after hash.`);
      mutations.push({ mode: "write", jsonPath: entry.write.jsonPath });
    }
    const additions = [];
    for (const entry of states.filter((item) => item.mode === "pickerAdd")) {
      const container = resolveContainer(nextContentJson, entry.addition.cardsContainer);
      assert(container, `Container ${entry.addition.cardsContainer} disappeared while preparing ${page.slug}.`);
      assert(!container.some((card) => cardHash(card) === entry.addition.afterHash), "Reference card already present.");
      container.push(structuredClone(entry.addition.card));
      const pushed = container[container.length - 1];
      assert.equal(cardHash(pushed), entry.addition.afterHash,
        `Reference card for ${entry.addition.detailAliasOf} did not reach its after hash.`);
      additions.push({ detailAliasOf: entry.addition.detailAliasOf });
      mutations.push({ mode: "add", detailAliasOf: entry.addition.detailAliasOf });
    }

    planned.push({ row, page, nextContentJson, mutations, additions });
  }

  const summary = {
    ok: aborted.length === 0,
    mode: apply ? "apply" : "dry-run",
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    planHash: manifest.planHash,
    manifestSummary: manifest.summary,
    pagesPlanned: planned.length,
    mutationsPlanned: planned.reduce((total, entry) => total + entry.mutations.length, 0),
    referenceCardsPlanned: planned.reduce((total, entry) => total + entry.additions.length, 0),
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
      || `scripts/manifests/${manifestStem}-apply-report.json`
    );
    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
      || `scripts/manifests/${manifestStem}-rollback.json`
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
          mutations: entry.mutations,
          referenceCards: entry.additions.map((item) => item.detailAliasOf)
        });
      }
      const readback = [];
      for (const entry of planned) {
        const row = await tx.livePage.findUniqueOrThrow({
          where: { id: entry.row.id },
          select: { slug: true, contentJson: true, updatedAt: true }
        });
        for (const write of entry.page.cardWrites ?? []) {
          if (write.shape === "picker") {
            const container = resolveContainer(row.contentJson, write.cardsContainer);
            assert(container, `Container ${write.cardsContainer} is missing after the write on ${entry.page.slug}.`);
            assert(container.some((card) => cardHash(card) === write.afterHash),
              `Reviewed picker writer for ${write.publicSlug ?? write.detailAliasOf} did not read back at its after hash.`);
          } else {
            const card = record(resolveNode(row.contentJson, write.jsonPath));
            assert(card, `Card ${write.jsonPath} is missing after the write on ${entry.page.slug}.`);
            assert.equal(cardHash(card), write.afterHash, `Card ${write.jsonPath} did not read back at its after hash.`);
          }
        }
        for (const removal of entry.page.pickerRemovals ?? []) {
          const container = resolveContainer(row.contentJson, removal.cardsContainer);
          assert(container, `Container ${removal.cardsContainer} is missing after the write on ${entry.page.slug}.`);
          assert(!container.some((card) => cardHash(card) === removal.beforeHash),
            `Removed hub card ${removal.detailAliasOf} is still present after the apply.`);
        }
        for (const addition of entry.page.pickerAdditions ?? []) {
          const container = resolveContainer(row.contentJson, addition.cardsContainer);
          assert(container, `Container ${addition.cardsContainer} is missing after the write on ${entry.page.slug}.`);
          const present = container.filter((card) => cardHash(card) === addition.afterHash).length;
          assert.equal(present, 1, `Reference card for ${addition.detailAliasOf} did not read back exactly once.`);
        }
        readback.push({ page: entry.page.slug, pageHash: pageHash(row) });
      }

      // Site-wide invariant: every card placement anywhere on the site still
      // matches the placement vocabulary.
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
            WHERE c.card IS NOT NULL AND pl !~ ${MEDIA_PLACEMENT_PATTERN.source}) AS invalid_placement_values
      `;
      assert.equal(Number(invariant.invalid_placement_values), 0, "An invalid placement value survived the apply.");
      const invariants = { invalid_placement_values: Number(invariant.invalid_placement_values) };

      const revisionAfter = await readRevision();
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(planned.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${planned.length}.`
      );
      const protectedAfter = await protectedMyDreamShootsHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the categorization apply.");

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
        mutationsApplied: applied.reduce((total, entry) => total + entry.mutations.length, 0),
        referenceCardsApplied: applied.reduce((total, entry) => total + entry.referenceCards.length, 0),
        invariants,
        applied,
        readback
      };
    }, { timeout: 180_000, maxWait: 15_000 });

    // Field-level inverse for a future rollback: same rows, same fields,
    // before/after swapped, current readback hash as the base.
    const rollbackPages = manifest.pages
      .filter((page) => report.readback.some((item) => item.page === page.slug))
      .map((page) => ({
        slug: page.slug,
        pageHash: report.readback.find((item) => item.page === page.slug)?.pageHash ?? null,
        cardWrites: (page.cardWrites ?? []).map((write) => ({
          ...write,
          before: write.after,
          after: write.before,
          beforeHash: write.afterHash,
          afterHash: write.beforeHash,
          operations: write.operations.map((operation) => ({
            field: operation.field,
            from: operation.set,
            set: operation.from
          }))
        })),
        pickerRemovals: (page.pickerAdditions ?? []).map((addition) => ({
          cardsContainer: addition.cardsContainer,
          label: addition.label,
          kind: addition.kind,
          detailAliasOf: addition.detailAliasOf,
          before: addition.after,
          after: null,
          beforeHash: addition.afterHash,
          afterHash: null,
          card: addition.card
        })),
        pickerAdditions: (page.pickerRemovals ?? []).map((removal) => ({
          cardsContainer: removal.cardsContainer,
          label: removal.label,
          kind: removal.kind,
          detailAliasOf: removal.detailAliasOf,
          before: null,
          after: removal.before,
          beforeHash: null,
          afterHash: removal.beforeHash,
          card: removal.card
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
        cardWrites: rollbackPages.reduce((total, page) => total + page.cardWrites.length, 0),
        pickerRemovals: rollbackPages.reduce((total, page) => total + page.pickerRemovals.length, 0),
        pickerAdditions: rollbackPages.reduce((total, page) => total + page.pickerAdditions.length, 0)
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
