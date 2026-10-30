#!/usr/bin/env node
// Plan the Aidreamcapes media placement tagging + chips normalization.
//
// Two operation families, reviewed in one manifest and applied by
// scripts/apply-aidreamcapes-placement-tags.mjs:
//   1. set-placement — write the inferred `placement[]` (industry vocabulary
//      v2, see docs/aivideosugc-tagging-examples-rectification-plan.md §2.2)
//      onto every card copy that publishes a publicSlug;
//   2. chips normalization — replace synonym chip ids on every card
//      (apparel→clothing, accessories→jewelry-accessories, trending→viral)
//      and converge the tool-page CSS filter rows (picker.chips).
//
// Card bodies, prompts, hrefs, slugs, and MyDreamShoots rows are untouched.
//
//   node --env-file=.env.production scripts/plan-aidreamcapes-placement-tags.mjs --target=production
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { inferTags, MEDIA_PLACEMENT_PATTERN, CHIPS_REPLACE, PICKER_CHIP_PAGES, PICKER_CHIP_REMOVE_IDS, PICKER_CHIP_RENAME_IDS } from "./lib/aidreamcapes-placement-vocabulary.mjs";

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
assert.equal(target, process.env.DATABASE_TARGET, `DATABASE_TARGET=${process.env.DATABASE_TARGET} does not match --target=${target}`);
assert.equal(process.env.DINGYUE_ENV, target, `DINGYUE_ENV=${process.env.DINGYUE_ENV} does not match --target=${target}`);
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

const SHAPES = [
  ["picker", (data) => (Array.isArray(data?.visual?.picker?.cards) ? data.visual.picker.cards : [])],
  ["workspaceCases", (data) => (Array.isArray(data?.workspaceCases) ? data.workspaceCases : [])],
  ["exampleGallery", (data) => {
    // Concrete group indexes keep the jsonPath wildcard-free and resolvable.
    const groups = data?.examples?.groups;
    return Array.isArray(groups)
      ? groups.flatMap((group, groupIndex) => (Array.isArray(group?.items) ? group.items.map((item, itemIndex) => ({ item, groupIndex, itemIndex })) : []))
      : [];
  }],
  ["templateCard", (data) => [data?.templateDefinition?.card].filter((card) => card && typeof card === "object")]
];
const jsonPathFor = (shape, sectionKey, index, extra) =>
  shape === "templateCard"
    ? `sections.${sectionKey}.settings.data.templateDefinition.card`
    : shape === "exampleGallery"
      ? `sections.${sectionKey}.settings.data.examples.groups[${extra.groupIndex}].items[${extra.itemIndex}]`
      : shape === "picker"
        ? `sections.${sectionKey}.settings.data.visual.picker.cards[${index}]`
        : `sections.${sectionKey}.settings.data.workspaceCases[${index}]`;

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

  // Template facet inheritance map: template page slug -> { industries, platforms, occasions }.
  const templateFacets = new Map();
  for (const row of rows) {
    const sections = record(record(row.contentJson)?.sections);
    for (const sectionValue of Object.values(sections ?? {})) {
      const definition = record(record(record(sectionValue)?.settings)?.data)?.templateDefinition;
      if (!record(definition) || !text(definition.path)) continue;
      templateFacets.set(row.slug, {
        path: text(definition.path),
        industries: Array.isArray(definition.industries) ? definition.industries.filter((v) => typeof v === "string") : [],
        platforms: Array.isArray(definition.platforms) ? definition.platforms.filter((v) => typeof v === "string") : [],
        occasions: Array.isArray(definition.occasions) ? definition.occasions.filter((v) => typeof v === "string") : []
      });
    }
  }

  // Walk every card on every page; build inference basis rows and the edit set.
  const basisRows = [];
  const cardEdits = []; // { page, jsonPath, shape, slug, card, chipsAfter }
  const pickerChipEdits = []; // { page, jsonPath, before, after }
  for (const row of rows) {
    const sections = record(record(row.contentJson)?.sections);
    for (const [sectionKey, sectionValue] of Object.entries(sections ?? {})) {
      assert(/^[A-Za-z0-9_-]+$/.test(sectionKey), `Section key "${sectionKey}" on ${row.slug} is not jsonPath-safe.`);
      const data = record(record(record(sectionValue)?.settings)?.data);
      if (!data) continue;
      const facets = templateFacets.get(row.slug) ?? null;
      for (const [shape, cardsOf] of SHAPES) {
        cardsOf(data).forEach((entry, index) => {
          const card = shape === "exampleGallery" ? entry?.item : entry;
          const extra = shape === "exampleGallery" ? { groupIndex: entry?.groupIndex, itemIndex: entry?.itemIndex } : undefined;
          const recordCard = record(card);
          if (!recordCard) return;
          const slug = publicSlugOf(recordCard);
          const chips = chipsOf(recordCard);
          const chipsAfter = [...new Set(chips.map((chip) => CHIPS_REPLACE[chip] ?? chip))];
          if (slug) {
            assert(/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug), `Slug "${slug}" on ${row.slug} violates the public slug pattern.`);
            basisRows.push({
              slug,
              shape,
              owner_slug: row.slug,
              jsonPath: jsonPathFor(shape, sectionKey, index, extra),
              label: labelOf(recordCard),
              prompt: typeof recordCard.prompt === "string" ? recordCard.prompt : "",
              chips,
              placement: placementOf(recordCard),
              is_video: kindOf(recordCard) === "video",
              has_vsrc: text(recordCard?.video?.src) !== "",
              facets
            });
          }
          const chipsChanged = chipsAfter.some((chip, i) => chip !== chips[i]) || chipsAfter.length !== chips.length;
          if (chipsChanged) {
            cardEdits.push({
              page: row.slug,
              jsonPath: jsonPathFor(shape, sectionKey, index, extra),
              shape,
              slug,
              card: recordCard,
              chipsBefore: chips,
              chipsAfter
            });
          }
        });
      }
      // Tool-page CSS filter row convergence.
      const picker = record(data?.visual?.picker);
      if (record(picker) && Array.isArray(picker.chips)) {
        const jsonPath = `sections.${sectionKey}.settings.data.visual.picker.chips`;
        const before = picker.chips.filter((chip) => record(chip));
        const after = before
          .filter((chip) => !PICKER_CHIP_REMOVE_IDS.includes(text(chip.id)))
          .map((chip) => {
            const renamed = PICKER_CHIP_RENAME_IDS[text(chip.id)];
            return renamed ? { ...chip, id: renamed } : chip;
          });
        const changed = before.length !== after.length
          || before.some((chip, i) => text(chip.id) !== text(after[i]?.id));
        if (changed) pickerChipEdits.push({ page: row.slug, jsonPath, before, after });
      }
    }
  }

  // Inference over the canonical-slug basis.
  const report = inferTags(basisRows);
  const placementBySlug = new Map(report.map((item) => [item.slug, item]));

  // Group per page: card entries (placement set + chips replace) and picker chip edits.
  const pageMap = new Map();
  const pageEntryOf = (slug, row) => {
    const entry = pageMap.get(slug) ?? { slug, pageHash: pageHash(row), cards: [], pickerChips: [] };
    pageMap.set(slug, entry);
    return entry;
  };

  let placementCards = 0;
  for (const item of report) {
    const final = item.placement;
    for (const value of final) {
      assert(MEDIA_PLACEMENT_PATTERN.test(value), `Inferred placement "${value}" for ${item.slug} violates the placement pattern.`);
    }
    if (!final.length) continue;
    const owners = basisRows.filter((row) => row.slug === item.slug);
    for (const owner of owners) {
      const existing = owner.placement;
      if (JSON.stringify([...existing].sort()) === JSON.stringify(final)) continue;
      const row = rows.find((entry) => entry.slug === owner.owner_slug);
      assert(row, `Owner page ${owner.owner_slug} disappeared.`);
      const entryProbe = pageEntryOf(owner.owner_slug, row);
      if (entryProbe.cards.some((card) => card.jsonPath === owner.jsonPath)) continue; // same card copy already planned
      const card = record(resolveNode(row.contentJson, owner.jsonPath));
      assert(card, `Card ${owner.jsonPath} on ${owner.owner_slug} is missing.`);
      assert.equal(publicSlugOf(card), item.slug, `Card ${owner.jsonPath} on ${owner.owner_slug} no longer holds slug ${item.slug}.`);
      const entry = pageEntryOf(owner.owner_slug, row);
      const nextCard = structuredClone(card);
      nextCard.placement = final;
      if (CHIPS_REPLACE && chipsOf(nextCard).some((chip) => CHIPS_REPLACE[chip])) {
        nextCard.chips = [...new Set(chipsOf(nextCard).map((chip) => CHIPS_REPLACE[chip] ?? chip))];
      }
      const operations = [{ field: "placement", from: placementOf(card), set: final }];
      if (JSON.stringify(chipsOf(card)) !== JSON.stringify(nextCard.chips)) {
        operations.push({ field: "chips", from: chipsOf(card), set: nextCard.chips });
      }
      entry.cards.push({
        source: owner.shape,
        jsonPath: owner.jsonPath,
        label: labelOf(card),
        kind: kindOf(card),
        publicSlug: item.slug,
        before: cardSnapshot(card),
        after: cardSnapshot(nextCard),
        beforeHash: cardHash(card),
        afterHash: cardHash(nextCard),
        operations
      });
      placementCards += 1;
    }
  }

  // Chips-only card edits (cards without a placement change).
  for (const edit of cardEdits) {
    const row = rows.find((entry) => entry.slug === edit.page);
    assert(row, `Page ${edit.page} disappeared.`);
    const entry = pageEntryOf(edit.page, row);
    if (entry.cards.some((card) => card.jsonPath === edit.jsonPath)) continue; // already handled with placement
    const card = resolveNode(row.contentJson, edit.jsonPath);
    assert(record(card), `Card ${edit.jsonPath} on ${edit.page} is missing.`);
    const nextCard = structuredClone(card);
    nextCard.chips = edit.chipsAfter;
    entry.cards.push({
      source: edit.shape,
      jsonPath: edit.jsonPath,
      label: labelOf(card),
      kind: kindOf(card),
      publicSlug: publicSlugOf(card),
      before: cardSnapshot(card),
      after: cardSnapshot(nextCard),
      beforeHash: cardHash(card),
      afterHash: cardHash(nextCard),
      operations: [{ field: "chips", from: edit.chipsBefore, set: edit.chipsAfter }]
    });
  }

  for (const edit of pickerChipEdits) {
    const row = rows.find((entry) => entry.slug === edit.page);
    assert(row, `Page ${edit.page} disappeared.`);
    const entry = pageEntryOf(edit.page, row);
    entry.pickerChips.push({
      jsonPath: edit.jsonPath,
      before: edit.before,
      after: edit.after
    });
  }

  const pages = [...pageMap.values()]
    .filter((entry) => entry.cards.length || entry.pickerChips.length)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    rule: "write inferred placement[] (industry vocabulary v2 + other catch-all) onto every card copy publishing a publicSlug; normalize synonym chips on all cards; converge picker.chips filter rows",
    summary: {
      slugs: report.length,
      slugsTagged: report.filter((item) => item.placement.length).length,
      industryCoverage: report.filter((item) => item.placement.some((v) => v.startsWith("/industries/"))).length,
      placementCards,
      chipsOnlyCards: pages.reduce((total, entry) => total + entry.cards.filter((card) => card.operations.some((op) => op.field === "chips") && !card.operations.some((op) => op.field === "placement")).length, 0),
      pickerChipPages: pages.filter((entry) => entry.pickerChips.length).length,
      pages: pages.length
    },
    pages,
    operations: [],
    addresses: []
  };
  manifest.planHash = hash({
    contract: manifest.contract,
    siteId: manifest.siteId,
    target: manifest.target,
    summary: manifest.summary,
    pages: manifest.pages,
    operations: manifest.operations,
    addresses: manifest.addresses
  });

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    mode: "plan",
    contract: CONTRACT,
    target,
    manifestPath,
    planHash: manifest.planHash,
    summary: manifest.summary
  }, null, 2));
} finally {
  await db.$disconnect();
}
