#!/usr/bin/env node
// Field-level CAS apply for the reviewed Aidreamcapes workspace-case alias
// manifest.
//
// The reviewed manifest is the review artifact. This script:
//   1. verifies the manifest hash, site, target, and confirmation;
//   2. re-reads every affected LivePage row and verifies its base hash;
//   3. verifies every reviewed card still carries the reviewed before state;
//   4. writes only `prompt`, `image`, `sceneId`, and `detailAliasOf`;
//   5. reads every row back, advances the derived-state revision once per
//      page, and verifies MyDreamShoots public content did not change.
//
// Dry-run is the default. Apply requires the reviewed plan hash and the
// explicit confirmation phrase:
//   node --env-file=.env scripts/apply-aidreamcapes-workspace-case-aliases.mjs \
//     --target=production
//   node --env-file=.env scripts/apply-aidreamcapes-workspace-case-aliases.mjs \
//     --target=production --apply \
//     --confirm=site_aidreamcapes-workspace-case-aliases-production \
//     --base-hash=<planHash>
//
// This script never writes publicSlug, publicAliases, publications, snapshots,
// navigation, or MyDreamShoots rows.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-workspace-case-alias-normalization-2026-10-22-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const expectedConfirmation = target === "production"
  ? "site_aidreamcapes-workspace-case-aliases-production"
  : "site_aidreamcapes-workspace-case-aliases";
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
    || `scripts/manifests/aidreamcapes-workspace-case-aliases-${target}-2026-10-22.json`
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
function imageOf(card) {
  return record(card?.image);
}
function promptOf(card) {
  return typeof card?.prompt === "string" ? card.prompt.trim() : "";
}
function publicSlugOf(card) {
  return text(card?.publicSlug);
}
function aliasOf(card) {
  return text(card?.detailAliasOf) || null;
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
function resolveCard(contentJson, jsonPath) {
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
  return record(node) ? node : undefined;
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
    image: imageOf(card) ?? null,
    prompt: promptOf(card),
    href: text(card.href),
    sceneSlug: text(card.sceneSlug),
    sceneId: text(card.sceneId) || null,
    publicSlug: publicSlugOf(card),
    detailAliasOf: aliasOf(card),
    publicAliases: Array.isArray(card.publicAliases) ? card.publicAliases : []
  };
}
function cardHash(card) {
  return hash(cardSnapshot(card));
}
function same(a, b) {
  return stable(a) === stable(b);
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

function assertTarget() {
  const environment = String(process.env.DINGYUE_ENV || "").trim();
  const databaseTarget = String(process.env.DATABASE_TARGET || "").trim();
  assert.equal(databaseTarget, target, `DATABASE_TARGET=${databaseTarget} does not match --target=${target}`);
  assert.equal(environment, target, `DINGYUE_ENV=${environment} does not match --target=${target}`);
  if (target === "production" && apply) {
    assert.equal(
      confirmation,
      expectedConfirmation,
      `Apply requires --confirm=${expectedConfirmation}.`
    );
  }
}

assert(fs.existsSync(manifestPath), `Manifest not found: ${manifestPath}.`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.ok, true, "Manifest is not an ok plan.");
assert.equal(manifest.contract, CONTRACT, `Unsupported contract: ${manifest.contract}.`);
assert.equal(manifest.siteId, SITE_ID, "Manifest must be scoped to site_aidreamcapes.");
assert.equal(manifest.target, target, `Manifest target ${manifest.target} does not match requested target ${target}.`);
const recomputed = hash({
  contract: manifest.contract,
  siteId: manifest.siteId,
  target: manifest.target,
  canonical: manifest.canonical,
  summary: manifest.summary,
  pages: manifest.pages,
  operations: manifest.operations,
  addresses: manifest.addresses
});
assert.equal(recomputed, manifest.planHash, "Manifest content does not match its plan hash.");
assertTarget();
if (apply) {
  assert(baseHash, "Apply requires --base-hash=<planHash>.");
  assert.equal(baseHash, manifest.planHash, "The reviewed plan hash does not match the manifest; re-run the plan and review it again.");
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
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const ownedSlugs = new Map();
  const aliasOwners = new Map();
  for (const row of rows) {
    const sections = record(record(row.contentJson)?.sections);
    for (const section of Object.values(sections ?? {})) {
      const data = record(record(record(section)?.settings)?.data);
      if (!data) continue;
      const groups = [];
      if (record(data.templateDefinition?.card)) groups.push([record(data.templateDefinition.card)]);
      if (Array.isArray(data.visual?.picker?.cards)) groups.push(data.visual.picker.cards);
      if (Array.isArray(data.workspaceCases)) groups.push(data.workspaceCases);
      for (const group of groups) for (const card of group) {
        if (!record(card)) continue;
        const slug = publicSlugOf(card);
        if (slug) {
          const list = ownedSlugs.get(slug) ?? [];
          list.push({ page: row.slug, card });
          ownedSlugs.set(slug, list);
        }
        if (Array.isArray(card.publicAliases)) for (const alias of card.publicAliases) {
          if (!text(alias)) continue;
          const list = aliasOwners.get(text(alias)) ?? [];
          list.push({ page: row.slug, card });
          aliasOwners.set(text(alias), list);
        }
      }
    }
  }

  for (const page of manifest.pages) {
    const row = bySlug.get(page.slug);
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
      const card = resolveCard(row.contentJson, cardPlan.jsonPath);
      if (!card) {
        aborted.push({ page: page.slug, card: cardPlan.jsonPath, reason: "card path is missing" });
        continue;
      }
      const state = same(cardSnapshot(card), cardPlan.after)
        ? "after"
        : same(cardSnapshot(card), cardPlan.before)
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
    if (states.every((entry) => entry.state === "after")) {
      skipped.push({ page: page.slug, reason: "already applied" });
      continue;
    }
    if (!states.every((entry) => entry.state === "before")) {
      aborted.push({ page: page.slug, reason: "reviewed cards are mixed between before and after; refusing a partial rewrite" });
      continue;
    }

    const nextContentJson = structuredClone(row.contentJson ?? {});
    const writes = [];
    for (const { cardPlan } of states) {
      const targetCard = resolveCard(nextContentJson, cardPlan.jsonPath);
      assert(targetCard, `Card ${cardPlan.jsonPath} disappeared while preparing ${page.slug}.`);
      for (const operation of cardPlan.operations) {
        if (operation.field === "image") targetCard.image = structuredClone(operation.to);
        else targetCard[operation.field] = operation.to;
        assert(
          !["publicSlug", "publicAliases"].includes(operation.field),
          `Refusing unsupported field ${operation.field}.`
        );
      }
      assert.equal(publicSlugOf(targetCard), cardPlan.before.publicSlug, "Apply must not change publicSlug.");
      assert.deepEqual(targetCard.publicAliases ?? [], cardPlan.before.publicAliases ?? [], "Apply must not change publicAliases.");
      assert.equal(cardHash(targetCard), cardPlan.afterHash, `Planned card ${cardPlan.jsonPath} did not reach its after hash.`);
      writes.push({ cardPlan, targetCard });
    }
    planned.push({ row, page, nextContentJson, writes });
  }

  // Every address must now point at a terminal exact slug. This is the same
  // invariant the smoke gate verifies over HTTP.
  const finalAliases = new Map();
  for (const { page, writes } of planned) {
    for (const { targetCard } of writes) {
      finalAliases.set(`${page.slug}\u0000${targetCard.publicSlug}`, aliasOf(targetCard));
    }
  }
  for (const address of manifest.addresses) {
    const targetOwners = ownedSlugs.get(address.newSlug) ?? [];
    assert.equal(targetOwners.length, 1, `Address ${address.oldPath} target ${address.newSlug} is not owned exactly once.`);
    assert.equal(aliasOf(targetOwners[0].card), null, `Address ${address.oldPath} target ${address.newSlug} is itself an alias.`);
    const targetOwnersPages = new Set(targetOwners.map((owner) => owner.page));
    assert.equal(targetOwnersPages.size, 1, `Address ${address.oldPath} target ${address.newSlug} spans multiple pages.`);
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
    operationsPlanned: planned.reduce(
      (total, entry) => total + entry.writes.reduce((count, write) => count + write.cardPlan.operations.length, 0),
      0
    ),
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
        || `scripts/manifests/aidreamcapes-workspace-case-aliases-${target}-2026-10-22-apply-report.json`
    );
    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
        || `scripts/manifests/aidreamcapes-workspace-case-aliases-${target}-2026-10-22-rollback.json`
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
        const updated = await tx.livePage.updateMany({
          where: { id: entry.row.id, updatedAt: entry.row.updatedAt },
          data: { contentJson: entry.nextContentJson }
        });
        assert.equal(updated.count, 1, `LivePage ${entry.row.id} changed concurrently; refusing to overwrite.`);
        applied.push({
          page: entry.page.slug,
          cards: entry.writes.map((write) => write.cardPlan.jsonPath),
          operations: entry.writes.reduce((count, write) => count + write.cardPlan.operations.length, 0)
        });
      }
      const readback = [];
      for (const entry of planned) {
        const row = await tx.livePage.findUniqueOrThrow({
          where: { id: entry.row.id },
          select: { slug: true, contentJson: true, updatedAt: true }
        });
        for (const { cardPlan } of entry.writes) {
          const card = resolveCard(row.contentJson, cardPlan.jsonPath);
          assert(card, `Card ${cardPlan.jsonPath} is missing after the write on ${entry.page.slug}.`);
          assert.equal(cardHash(card), cardPlan.afterHash, `Card ${cardPlan.jsonPath} did not read back at its after hash.`);
          assert.equal(publicSlugOf(card), cardPlan.before.publicSlug, "publicSlug changed during apply.");
          assert.deepEqual(card.publicAliases ?? [], cardPlan.before.publicAliases ?? [], "publicAliases changed during apply.");
        }
        readback.push({ page: entry.page.slug, pageHash: pageHash(row) });
      }
      const revisionAfter = await readRevision();
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(planned.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${planned.length}.`
      );
      const protectedAfter = await protectedMyDreamShootsHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the workspace-case apply.");

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
        operationsApplied: applied.reduce((total, entry) => total + entry.operations, 0),
        applied,
        readback
      };
    });

    // A field-level inverse for a future rollback. It is intentionally not a
    // publication or snapshot: every operation targets the same current row
    // and field, with the current readback hash as the base.
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
          from: operation.to,
          to: operation.from
        }))
      }))
    }));
    const rollback = {
      ok: true,
      contract: CONTRACT,
      siteId: SITE_ID,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      summary: {
        pages: rollbackPages.length,
        cards: rollbackPages.reduce((total, page) => total + page.cards.length, 0),
        operations: rollbackPages.reduce(
          (total, page) => total + page.cards.reduce((count, card) => count + card.operations.length, 0),
          0
        )
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
      reportPath,
      rollbackPath
    }, null, 2));
  }
} finally {
  await db.$disconnect();
}
