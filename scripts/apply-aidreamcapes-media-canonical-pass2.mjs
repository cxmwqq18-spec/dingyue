#!/usr/bin/env node
// Field-level CAS apply for the reviewed Aidreamcapes media-canonicalization
// manifest (see scripts/plan-aidreamcapes-media-canonical.mjs).
//
// This script:
//   1. verifies the manifest hash, site, target, and confirmation;
//   2. re-reads every affected LivePage row and verifies its base hash;
//   3. verifies every reviewed card still carries the reviewed before state;
//   4. removes only the reviewed `publicSlug` fields (no other field, no
//      publicAliases, no card body changes);
//   5. verifies post-state invariants over the whole site inside the
//      transaction (one detail page per product, one owner per slug);
//   6. reads every row back, advances the derived-state revision once per
//      page, and verifies MyDreamShoots public content did not change.
//
// Dry-run is the default. Apply requires the reviewed plan hash and the
// explicit confirmation phrase:
//   node --env-file=.env.production scripts/apply-aidreamcapes-media-canonical.mjs --target=production
//   node --env-file=.env.production scripts/apply-aidreamcapes-media-canonical.mjs --target=production --apply \
//     --confirm=site_aidreamcapes-media-canonical-pass2-production --base-hash=<planHash>
//
// This script never writes publications, snapshots, navigation, or MyDreamShoots
// rows, and never creates or deletes LivePage rows.
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
const CONTRACT = "aidreamcapes-media-canonical-pass2-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const expectedConfirmation = target === "production"
  ? "site_aidreamcapes-media-canonical-pass2-production"
  : "site_aidreamcapes-media-canonical-pass2";
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
    || `scripts/manifests/aidreamcapes-media-canonical-pass2-${target}-2026-10-30.json`
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
    image: record(card?.image) ?? null,
    prompt: typeof card?.prompt === "string" ? card.prompt.trim() : "",
    href: text(card?.href),
    sceneSlug: text(card?.sceneSlug),
    sceneId: text(card?.sceneId) || null,
    publicSlug: publicSlugOf(card),
    detailAliasOf: text(card?.detailAliasOf) || null,
    publicAliases: Array.isArray(card?.publicAliases) ? card.publicAliases : []
  };
}
function cardHash(card) {
  return hash(cardSnapshot(card));
}
function same(a, b) {
  return stable(a) === stable(b);
}
async function protectedMyDreamShootsHash(client) {
  // Hash on the database server. Reading every MyDreamShoots contentJson row
  // through the production tunnel can take minutes (or drop mid-transfer),
  // while one md5(string_agg()) round trip proves the same thing: no row,
  // revision or JSON byte changed.
  const [pages, settings, profile] = await Promise.all([
    client.$queryRaw`
      SELECT md5(string_agg(md5("id" || '|' || "contentJson"::text || '|' || "updatedAt"::text), '' ORDER BY "id")) AS hash
      FROM "LivePage"
      WHERE "siteId" = 'site_dreamshoot'
    `,
    client.$queryRaw`
      SELECT md5("draftJson"::text || '|' || "publishedJson"::text) AS hash
      FROM "ThemeSettings"
      WHERE "siteId" = 'site_dreamshoot'
    `,
    client.$queryRaw`
      SELECT md5(COALESCE("publishedJson"::text, '')) AS hash
      FROM "StorefrontProfile"
      WHERE "siteId" = 'site_dreamshoot'
    `
  ]);
  return hash({
    pages: pages[0]?.hash,
    settings: settings[0]?.hash,
    profile: profile[0]?.hash
  });
}

assert.equal(process.env.DATABASE_TARGET, target, `DATABASE_TARGET=${process.env.DATABASE_TARGET} does not match --target=${target}`);
assert.equal(process.env.DINGYUE_ENV, target, `DINGYUE_ENV=${process.env.DINGYUE_ENV} does not match --target=${target}`);
if (apply && target === "production") {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
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
if (apply) {
  assert(baseHash, "Apply requires --base-hash=<planHash>.");
  assert.equal(baseHash, manifest.planHash, "The reviewed plan hash does not match the manifest; re-run the plan and review it again.");
}

const db = new PrismaClient({ errorFormat: "minimal" });
// Large single-shot findMany calls (every contentJson row) die through the
// production SSH tunnel ("Server has closed the connection"), so rows are
// loaded in small cursor batches with per-batch retries.
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
        if (operation.remove) {
          assert(["publicSlug", "sceneSlug"].includes(operation.field), `Refusing unsupported removal field ${operation.field}.`);
          assert.equal(text(targetCard[operation.field]), operation.from, `Field ${operation.field} on ${cardPlan.jsonPath} no longer holds its planned value.`);
          delete targetCard[operation.field];
        } else {
          assert.equal(operation.field, "href", `Refusing unsupported set field ${operation.field}.`);
          assert.equal(text(targetCard.href), operation.from, `href on ${cardPlan.jsonPath} no longer holds its planned value.`);
          targetCard.href = operation.to;
        }
      }
      assert.equal(publicSlugOf(targetCard), "", "publicSlug must be absent after the operation.");
      assert.deepEqual(targetCard.publicAliases ?? [], cardPlan.before.publicAliases ?? [], "publicAliases must not change.");
      assert.equal(cardHash(targetCard), cardPlan.afterHash, `Planned card ${cardPlan.jsonPath} did not reach its after hash.`);
      writes.push({ cardPlan, targetCard });
    }
    planned.push({ row, page, nextContentJson, writes });
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
        || `scripts/manifests/aidreamcapes-media-canonical-pass2-${target}-2026-10-30-apply-report.json`
    );
    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
        || `scripts/manifests/aidreamcapes-media-canonical-pass2-${target}-2026-10-30-rollback.json`
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
          cards: entry.writes.map((write) => write.cardPlan.jsonPath)
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
          assert.equal(publicSlugOf(card), "", `Card ${cardPlan.jsonPath} still carries publicSlug after the write.`);
          assert.equal(cardHash(card), cardPlan.afterHash, `Card ${cardPlan.jsonPath} did not read back at its after hash.`);
        }
        readback.push({ page: entry.page.slug, pageHash: pageHash(row) });
      }
      // Post-state invariants over the whole site: every (image, prompt)
      // video cluster owns at most one detail slug, and every slug is
      // published by exactly one page.
      const [invariant] = await tx.$queryRaw`
        WITH cards AS (
          SELECT p.slug AS owner_slug, jsonb_path_query(p."contentJson", '$.sections.*.settings.data.visual.picker.cards[*]') AS card
            FROM "LivePage" p WHERE p."siteId" = ${SITE_ID}
          UNION ALL
          SELECT p.slug, jsonb_path_query(p."contentJson", '$.sections.*.settings.data.workspaceCases[*]')
            FROM "LivePage" p WHERE p."siteId" = ${SITE_ID}
          UNION ALL
          SELECT p.slug, jsonb_path_query(p."contentJson", '$.sections.*.settings.data.examples.groups[*].items[*]')
            FROM "LivePage" p WHERE p."siteId" = ${SITE_ID}
          UNION ALL
          SELECT p.slug, jsonb_path_query(p."contentJson", '$.sections.*.settings.data.templateDefinition.card')
            FROM "LivePage" p WHERE p."siteId" = ${SITE_ID}
        ),
        valid AS (
          SELECT c.owner_slug, c.card->>'publicSlug' AS public_slug,
            c.card->>'kind' AS kind,
            c.card->'image'->>'src' AS img,
            md5(COALESCE(c.card->>'prompt','')) AS phash
          FROM cards c
          WHERE c.card IS NOT NULL
            AND c.card->>'publicSlug' ~ '^[a-z0-9][a-z0-9-]{0,119}$'
            AND c.card->>'kind' IN ('video','clip','scene')
            AND COALESCE(c.card->'image'->>'src','') <> ''
            AND COALESCE(c.card->>'label', c.card->>'title','') <> ''
        )
        SELECT
          (SELECT count(*) FROM (
            SELECT img, phash FROM valid GROUP BY img, phash HAVING count(DISTINCT public_slug) > 1
          ) d) AS video_clusters_with_multiple_slugs,
          (SELECT count(*) FROM (
            SELECT public_slug FROM valid GROUP BY public_slug HAVING count(DISTINCT owner_slug) > 1
          ) m) AS slugs_with_multiple_owners
      `;
      assert.equal(Number(invariant.video_clusters_with_multiple_slugs), 0, "A video (image, prompt) cluster still owns multiple detail slugs after the apply.");
      assert.equal(Number(invariant.slugs_with_multiple_owners), 0, "A slug is still owned by multiple pages after the apply.");
      const invariants = {
        video_clusters_with_multiple_slugs: Number(invariant.video_clusters_with_multiple_slugs),
        slugs_with_multiple_owners: Number(invariant.slugs_with_multiple_owners)
      };
      const revisionAfter = await readRevision();
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(planned.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${planned.length}.`
      );
      const protectedAfter = await protectedMyDreamShootsHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the media-canonical apply.");

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
        invariants,
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
        operations: cardPlan.operations.map((operation) => operation.remove
          ? { field: operation.field, from: "", to: operation.from, remove: false }
          : { field: operation.field, from: operation.to, to: operation.from, remove: false })
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
        cards: rollbackPages.reduce((total, page) => total + page.cards.length, 0)
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
