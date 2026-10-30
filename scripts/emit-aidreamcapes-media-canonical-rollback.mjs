#!/usr/bin/env node
// Reconstruct the apply report and the field-level rollback manifest for the
// media-canonicalization contract after a successful apply whose artifact
// write failed (e.g. a BigInt serialization crash after commit).
//
// It re-reads the current rows, verifies every reviewed card is at its
// reviewed after state, and emits:
//   - the apply report (mode "apply", reconstructed: true)
//   - the rollback manifest (inverse field-level operations, CAS on the
//     current post-apply page hash)
//
//   node --env-file=.env.production scripts/emit-aidreamcapes-media-canonical-rollback.mjs \
//     --target=production --manifest=scripts/manifests/aidreamcapes-media-canonical-production-2026-10-30.json
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
const CONTRACT = "aidreamcapes-media-canonical-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
    || `scripts/manifests/aidreamcapes-media-canonical-${target}-2026-10-30.json`
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
assert(fs.existsSync(manifestPath), `Manifest not found: ${manifestPath}.`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.contract, CONTRACT, `Unsupported contract: ${manifest.contract}.`);
assert.equal(manifest.ok, true, "Manifest is not an ok plan.");

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
      if (!String(error?.message ?? "").includes("closed the connection")) throw error;
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
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const applied = [];
  const rollbackPages = [];
  for (const page of manifest.pages) {
    const row = bySlug.get(page.slug);
    assert(row, `LivePage ${page.slug} is missing.`);
    const pageRollbackCards = [];
    for (const cardPlan of page.cards) {
      const card = resolveCard(row.contentJson, cardPlan.jsonPath);
      assert(card, `Card ${cardPlan.jsonPath} is missing on ${page.slug}.`);
      assert(
        same(cardSnapshot(card), cardPlan.after) || publicSlugOf(card) === "" && same(cardSnapshot(card), { ...cardPlan.after, publicSlug: "" }),
        `Card ${cardPlan.jsonPath} on ${page.slug} is not at the reviewed after state (publicSlug="${publicSlugOf(card)}").`
      );
      pageRollbackCards.push({
        source: cardPlan.source,
        jsonPath: cardPlan.jsonPath,
        label: cardPlan.label,
        kind: cardPlan.kind,
        publicSlug: cardPlan.publicSlug,
        before: cardPlan.after,
        after: cardPlan.before,
        beforeHash: cardHash(card),
        afterHash: cardPlan.beforeHash,
        operations: cardPlan.operations.map((operation) => ({
          field: "publicSlug",
          from: "",
          to: cardPlan.publicSlug,
          remove: false
        }))
      });
    }
    applied.push({
      page: page.slug,
      cards: page.cards.map((card) => card.jsonPath),
      pageHashAfter: pageHash(row)
    });
    rollbackPages.push({
      slug: page.slug,
      pageHash: pageHash(row),
      cards: pageRollbackCards
    });
  }

  const protectedHash = await protectedMyDreamShootsHash(db);
  const [revision] = await db.$queryRaw`
    SELECT "revision"::text AS revision
    FROM "SiteContentRevision"
    WHERE "siteId" = ${SITE_ID}
    LIMIT 1
  `;

  const reportPath = path.resolve(
    process.cwd(),
    process.argv.find((arg) => arg.startsWith("--report="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-media-canonical-${target}-2026-10-30-apply-report.json`
  );
  const rollbackPath = path.resolve(
    process.cwd(),
    process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-media-canonical-${target}-2026-10-30-rollback.json`
  );

  const report = {
    ok: true,
    mode: "apply",
    reconstructed: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    planHash: manifest.planHash,
    revisionAfter: revision?.revision ?? null,
    pagesApplied: applied.length,
    cardsApplied: applied.reduce((total, entry) => total + entry.cards.length, 0),
    summary: manifest.summary,
    protectedMyDreamShootsHash: protectedHash,
    applied,
    readback: applied.map((entry) => ({ page: entry.page, pageHash: entry.pageHashAfter }))
  };
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
    ok: true,
    mode: "reconstruct-report",
    reportPath,
    rollbackPath,
    pages: applied.length,
    cards: report.cardsApplied,
    revisionAfter: report.revisionAfter
  }, null, 2));
} finally {
  await db.$disconnect();
}
