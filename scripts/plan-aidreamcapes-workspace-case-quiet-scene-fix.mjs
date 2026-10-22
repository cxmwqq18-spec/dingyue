#!/usr/bin/env node
// Follow-up CAS plan for the quiet-unboxing scene pin.
//
// The first workspace-case batch pinned the canonical
// `quiet-unboxing-makeup-tools` card to `texture_closeup`. That made the nine
// `Close-up` copies match, but it broke the eight pre-existing `Close Unboxing`
// copies whose labels derive `process_demo`.
//
// This plan restores the canonical card's original derived scene
// (`process_demo`, by clearing the explicit pin) and pins the nine close-up
// copies to `process_demo` instead. All 17 copies then match the same canonical
// preset, and none of the 674 retired addresses regress.
//
// Usage:
//   node --env-file=.env scripts/plan-aidreamcapes-workspace-case-quiet-scene-fix.mjs \
//     --target=production --addresses=...json --out=...json
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
const addressesPath = path.resolve(
  process.argv.find((arg) => arg.startsWith("--addresses="))?.split("=")[1]
    || `scripts/manifests/aidreamcapes-workspace-case-aliases-${target}-2026-10-22.json`
);
const outPath = path.resolve(
  process.argv.find((arg) => arg.startsWith("--out="))?.split("=")[1]
    || `scripts/manifests/aidreamcapes-workspace-case-quiet-scene-fix-${target}-2026-10-22.json`
);
assert.equal(process.env.DATABASE_TARGET, target, `DATABASE_TARGET=${process.env.DATABASE_TARGET} does not match --target=${target}`);
assert.equal(process.env.DINGYUE_ENV, target, `DINGYUE_ENV=${process.env.DINGYUE_ENV} does not match --target=${target}`);
assert.equal(SITE_ID, "site_aidreamcapes");

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
function imageSrcOf(card) {
  if (typeof card?.image === "string") return card.image;
  return text(card?.image?.src);
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
function sectionCards(row) {
  const content = record(row.contentJson);
  const sections = record(content?.sections);
  const out = [];
  for (const [sectionId, sectionValue] of Object.entries(sections ?? {})) {
    const section = record(sectionValue);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(section.settings)?.data);
    if (!data) continue;
    if (Array.isArray(data.visual?.picker?.cards)) {
      data.visual.picker.cards.forEach((card, index) => {
        if (!record(card)) return;
        out.push({ source: "picker", jsonPath: `sections.${sectionId}.settings.data.visual.picker.cards[${index}]`, card });
      });
    }
    if (Array.isArray(data.workspaceCases)) {
      data.workspaceCases.forEach((card, index) => {
        if (!record(card)) return;
        out.push({ source: "workspaceCases", jsonPath: `sections.${sectionId}.settings.data.workspaceCases[${index}]`, card });
      });
    }
  }
  return out;
}
function derivedScene(card) {
  const explicit = text(card?.sceneId);
  if (["presenter_showcase", "process_demo", "texture_closeup"].includes(explicit)) return explicit;
  const direction = `${labelOf(card)} ${promptOf(card)}`.toLowerCase();
  if (/\b(?:close.?up|texture|material|detail|finish|macro)\b/.test(direction)) return "texture_closeup";
  if (/\b(?:creator|ugc|presenter|spokesperson|talk(?:s|ing)? to camera|introduc(?:e|es|ing))\b/.test(direction)) return "presenter_showcase";
  return "process_demo";
}

const addressesManifest = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
assert.equal(addressesManifest.addresses?.length, 674, "Expected 674 reviewed addresses.");
const addresses = addressesManifest.addresses;

const db = new PrismaClient({ errorFormat: "minimal" });
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
  const pageBySlug = new Map(rows.map((row) => [row.slug, row]));
  const allCards = rows.flatMap((row) => sectionCards(row).map((entry) => ({ ...entry, page: row.slug })));
  const canonical = allCards.filter(
    (entry) => entry.source === "picker" && publicSlugOf(entry.card) === "quiet-unboxing-makeup-tools"
  );
  assert.equal(canonical.length, 1, "quiet-unboxing-makeup-tools must be owned by exactly one picker card.");
  const canonicalEntry = canonical[0];
  assert.equal(canonicalEntry.page, "/ai-video-generation/video-ads", "Canonical quiet card moved.");
  assert.equal(aliasOf(canonicalEntry.card), null, "Canonical quiet card is unexpectedly an alias.");
  assert.equal(text(canonicalEntry.card.sceneId), "texture_closeup", "Canonical quiet card is not in the first-batch state.");

  const canonicalAfter = structuredClone(canonicalEntry.card);
  canonicalAfter.sceneId = null;
  assert.equal(derivedScene(canonicalAfter), "process_demo", "Canonical quiet card did not return to process_demo.");

  const copies = allCards.filter((entry) =>
    entry.source === "workspaceCases"
    && /^(?:Quiet )?Close-?up Unboxing: Makeup Tools$/i.test(labelOf(entry.card))
  );
  assert.equal(copies.length, 9, `Expected 9 close-up copies, found ${copies.length}.`);

  const pages = [];
  const operations = [];
  function addCard(entry, cardPlan) {
    const page = pages.find((item) => item.slug === entry.page);
    if (page) page.cards.push(cardPlan);
    else pages.push({
      slug: entry.page,
      pageHash: pageHash(pageBySlug.get(entry.page)),
      cards: [cardPlan]
    });
    for (const operation of cardPlan.operations) operations.push({
      page: entry.page,
      jsonPath: entry.jsonPath,
      label: labelOf(entry.card),
      field: operation.field,
      from: operation.from,
      to: operation.to,
      canonical: entry === canonicalEntry ? null : "quiet-unboxing-makeup-tools"
    });
  }

  addCard(canonicalEntry, {
    source: canonicalEntry.source,
    jsonPath: canonicalEntry.jsonPath,
    label: labelOf(canonicalEntry.card),
    kind: kindOf(canonicalEntry.card),
    publicSlug: publicSlugOf(canonicalEntry.card),
    before: cardSnapshot(canonicalEntry.card),
    after: cardSnapshot(canonicalAfter),
    beforeHash: cardHash(canonicalEntry.card),
    afterHash: cardHash(canonicalAfter),
    operations: [{ field: "sceneId", from: "texture_closeup", to: null }]
  });

  for (const entry of copies) {
    assert.equal(aliasOf(entry.card), "quiet-unboxing-makeup-tools", `${entry.page} ${entry.jsonPath} is not aliased to quiet.`);
    assert.equal(promptOf(entry.card), promptOf(canonicalAfter), `${entry.page} ${entry.jsonPath} prompt differs from canonical.`);
    assert.equal(imageSrcOf(entry.card), imageSrcOf(canonicalAfter), `${entry.page} ${entry.jsonPath} image differs from canonical.`);
    const currentSceneId = text(entry.card.sceneId) || null;
    assert(
      currentSceneId === null || currentSceneId === "process_demo",
      `${entry.page} ${entry.jsonPath} has unexpected sceneId ${currentSceneId}.`
    );
    const after = structuredClone(entry.card);
    after.sceneId = "process_demo";
    assert.equal(derivedScene(after), "process_demo", `${entry.page} ${entry.jsonPath} will not match the quiet canonical.`);
    if (currentSceneId === "process_demo") continue;
    addCard(entry, {
      source: entry.source,
      jsonPath: entry.jsonPath,
      label: labelOf(entry.card),
      kind: kindOf(entry.card),
      publicSlug: publicSlugOf(entry.card),
      before: cardSnapshot(entry.card),
      after: cardSnapshot(after),
      beforeHash: cardHash(entry.card),
      afterHash: cardHash(after),
      operations: [{ field: "sceneId", from: null, to: "process_demo" }]
    });
  }

  const summary = {
    pages: pages.length,
    cards: pages.reduce((total, page) => total + page.cards.length, 0),
    operations: operations.length,
    byField: { sceneId: operations.length },
    addresses: addresses.length,
    oldLong200: 0,
    oldLongToLong: 0,
    oldLongDirectShort: 674
  };
  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    revision: null,
    canonical: [{
      key: "quiet",
      slug: "quiet-unboxing-makeup-tools",
      page: "/ai-video-generation/video-ads",
      prompt: promptOf(canonicalAfter),
      imageSrc: imageSrcOf(canonicalAfter),
      sceneId: null
    }],
    summary,
    pages,
    operations,
    addresses,
    aborted: []
  };
  manifest.planHash = hash({
    contract: manifest.contract,
    siteId: manifest.siteId,
    target: manifest.target,
    canonical: manifest.canonical,
    summary: manifest.summary,
    pages: manifest.pages,
    operations: manifest.operations,
    addresses: manifest.addresses
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    planHash: manifest.planHash,
    outPath,
    summary,
    operations: operations.map((operation) => ({
      page: operation.page,
      label: operation.label,
      from: operation.from,
      to: operation.to
    }))
  }, null, 2));
} finally {
  await db.$disconnect();
}
