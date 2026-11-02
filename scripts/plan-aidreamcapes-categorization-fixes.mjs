#!/usr/bin/env node
// Plan the Aidreamcapes video-detail categorization fixes (2026-11-02).
//
// Reviewed in docs/video-detail-categorization-plan-20261101.md (rev4) and its
// assignments file; applied by scripts/apply-aidreamcapes-categorization-fixes.mjs.
//
// Operation families — one reviewed manifest:
//   1. set-placement  — reviewed placement[] on every card copy that publishes
//      the reviewed publicSlug or aliases it (detailAliasOf). The detail page
//      unions placement across copies of one media asset, so every copy moves.
//   2. set-label      — honest rendered labels for the 8 reviewed pages whose
//      slug text claims a product the picture does not show. Slugs and URLs
//      stay as they are.
//   3. picker-remove  — the two app demo alias cards on the /ai-video-generation
//      hub; the videos stay canonical on /ai-video-generation/video-ads.
//   4. picker-add     — alias reference cards (detailAliasOf, no publicSlug) for
//      the 22 template demo videos on /ai-video-generation/image-to-video, so
//      the single-owner rule that protects every detail URL is never broken.
//
// Card bodies, prompts, image/video sources, hrefs, slugs, owners, facet pages
// and MyDreamShoots rows are untouched.
//
//   node --env-file=.env.production scripts/plan-aidreamcapes-categorization-fixes.mjs --target=production
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { MEDIA_PLACEMENT_PATTERN } from "./lib/aidreamcapes-placement-vocabulary.mjs";
import {
  PLACEMENT_FIXES,
  LABEL_FIXES,
  TOOL_UNIQUENESS,
  TEMPLATE_REFERENCE_ADDITIONS
} from "./lib/aidreamcapes-categorization-fix-targets.mjs";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-categorization-fixes-2026-11-02-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
assert.equal(target, process.env.DATABASE_TARGET, `DATABASE_TARGET=${process.env.DATABASE_TARGET} does not match --target=${target}`);
assert.equal(process.env.DINGYUE_ENV, target, `DINGYUE_ENV=${process.env.DINGYUE_ENV} does not match --target=${target}`);
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-categorization-fixes-${target}-2026-11-02.json`
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
function aliasOf(card) {
  return text(card?.detailAliasOf) || null;
}
function chipsOf(card) {
  return Array.isArray(card?.chips) ? card.chips.filter((chip) => typeof chip === "string" && chip.trim()) : [];
}
function placementOf(card) {
  return Array.isArray(card?.placement) ? card.placement.filter((value) => typeof value === "string" && value.trim()) : [];
}
function imageSrcOf(card) {
  return text(card?.image?.src);
}
function videoSrcOf(card) {
  return text(card?.video?.src);
}
/**
 * Exact runtime product identity (media-placement.ts productIdentityOf): the
 * video source wins for video assets, otherwise the image/poster source.
 */
function identityKeyOf(card) {
  const videoSrc = videoSrcOf(card);
  const kind = kindOf(card) === "photo" ? "photo" : kindOf(card) ? "video" : "?";
  if (videoSrc) return `${kind}|video|${videoSrc}`;
  const imageSrc = imageSrcOf(card) || text(card?.video?.poster?.src);
  if (imageSrc) return `${kind}|image|${imageSrc}`;
  return undefined;
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
    detailAliasOf: aliasOf(card),
    chips: chipsOf(card),
    placement: placementOf(card)
  };
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

const SHAPES = [
  ["picker", (data) => (Array.isArray(data?.visual?.picker?.cards) ? data.visual.picker.cards : [])],
  ["workspaceCases", (data) => (Array.isArray(data?.workspaceCases) ? data.workspaceCases : [])],
  ["exampleGallery", (data) => {
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
      : shape === "workspaceCases"
        ? `sections.${sectionKey}.settings.data.workspaceCases[${index}]`
        : `sections.${sectionKey}.settings.data.visual.picker.cards[${index}]`;
const cardsContainerFor = (sectionKey) =>
  `sections.${sectionKey}.settings.data.visual.picker.cards`;

const db = new PrismaClient({ errorFormat: "minimal" });
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
  console.log(`rows loaded: ${rows.length}`);

  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));
  const pages = new Map();
  const pageEntryOf = (slug) => {
    const row = rowBySlug.get(slug);
    assert(row, `LivePage ${slug} disappeared.`);
    const entry = pages.get(slug) ?? {
      slug,
      pageHash: pageHash(row),
      cardWrites: [],
      pickerRemovals: [],
      pickerAdditions: []
    };
    pages.set(slug, entry);
    return entry;
  };

  // Walk every card on every page; keep the live state for the fix evaluation.
  const copies = []; // { page, sectionKey, shape, jsonPath, card }
  for (const row of rows) {
    const sections = record(record(row.contentJson)?.sections);
    for (const [sectionKey, sectionValue] of Object.entries(sections ?? {})) {
      assert(/^[A-Za-z0-9_-]+$/.test(sectionKey), `Section key "${sectionKey}" on ${row.slug} is not jsonPath-safe.`);
      const data = record(record(record(sectionValue)?.settings)?.data);
      if (!data) continue;
      for (const [shape, cardsOf] of SHAPES) {
        cardsOf(data).forEach((entry, index) => {
          const card = shape === "exampleGallery" ? entry?.item : entry;
          const extra = shape === "exampleGallery" ? { groupIndex: entry?.groupIndex, itemIndex: entry?.itemIndex } : undefined;
          const recordCard = record(card);
          if (!recordCard) return;
          copies.push({
            page: row.slug,
            sectionKey,
            shape,
            jsonPath: jsonPathFor(shape, sectionKey, index, extra),
            card: recordCard
          });
        });
      }
    }
  }
  console.log(`card copies walked: ${copies.length}`);

  const targetSlugs = new Set([...PLACEMENT_FIXES.keys(), ...LABEL_FIXES.keys()]);
  const copiesOf = (slug) =>
    copies.filter((copy) => publicSlugOf(copy.card) === slug || aliasOf(copy.card) === slug);
  for (const slug of targetSlugs) {
    assert(copiesOf(slug).length > 0, `Slug ${slug} has no card copy anywhere; refresh the plan data.`);
  }

  // ---------- identity union policing ----------
  // The detail page unions placement across every published copy of one media
  // asset. If an identity groups two publicSlugs where only one is in the fix
  // list, the unfixed copy keeps re-contributing its stale tags; that must be
  // extended in the reviewed plan instead of silently half-fixing an asset.
  const byIdentity = new Map();
  for (const copy of copies) {
    const card = copy.card;
    if (!publicSlugOf(card) || aliasOf(card)) continue;
    const key = identityKeyOf(card);
    if (!key) continue;
    const group = byIdentity.get(key) ?? [];
    group.push(copy);
    byIdentity.set(key, group);
  }
  const unionConflicts = [];
  for (const [, group] of byIdentity) {
    const slugs = new Set(group.map((copy) => publicSlugOf(copy.card)));
    if (slugs.size < 2) continue;
    const fixed = [...slugs].filter((slug) => PLACEMENT_FIXES.has(slug));
    if (!fixed.length) continue;
    for (const slug of slugs) {
      if (PLACEMENT_FIXES.has(slug)) continue;
      unionConflicts.push({ fixed, unfixedSlug: slug, owners: [...new Set(group.map((item) => item.page))] });
    }
  }
  if (unionConflicts.length) {
    console.error(JSON.stringify({ ok: false, unionConflicts }, null, 2));
    throw new Error("Placement identity union conflicts; extend the fix list instead of half-fixing an asset.");
  }

  // ---------- family 1 + 2: reviewed card writes, every copy of a slug ----------
  const placementTargetsCovered = new Set();
  const labelTargetsCovered = new Set();
  for (const slug of targetSlugs) {
    const group = copiesOf(slug);
    const fixedTarget = PLACEMENT_FIXES.get(slug);
    for (const copy of group) {
      const card = copy.card;
      const entry = pageEntryOf(copy.page);
      const nextCard = structuredClone(card);
      const operations = [];
      if (fixedTarget) {
        const final = [...new Set(fixedTarget)].sort();
        for (const value of final) {
          assert(MEDIA_PLACEMENT_PATTERN.test(value), `Refusing placement value "${value}" for ${slug}.`);
        }
        if (JSON.stringify([...placementOf(card)].sort()) !== JSON.stringify(final)) {
          operations.push({ field: "placement", from: placementOf(card), set: final });
        }
        nextCard.placement = final;
        placementTargetsCovered.add(slug);
      }
      if (LABEL_FIXES.has(slug)) {
        const reviewed = LABEL_FIXES.get(slug);
        assert.notEqual(labelOf(card), reviewed, `Reviewed label already present on ${slug}: refresh the plan.`);
        operations.push({ field: "label", from: text(card.label) ? card.label : null, set: reviewed });
        delete nextCard.title;
        nextCard.label = reviewed;
        labelTargetsCovered.add(slug);
      }
      if (!operations.length) continue;
      entry.cardWrites.push({
        shape: copy.shape,
        jsonPath: copy.shape === "picker" ? null : copy.jsonPath,
        cardsContainer: copy.shape === "picker" ? cardsContainerFor(copy.sectionKey) : null,
        // Picker arrays are matched by identity (sort-stable against removals);
        // other shapes keep their exact jsonPath.
        match: {
          publicSlug: publicSlugOf(card) || null,
          detailAliasOf: aliasOf(card),
          label: labelOf(card),
          beforeHash: hash(cardSnapshot(card))
        },
        label: labelOf(card),
        kind: kindOf(card),
        publicSlug: publicSlugOf(card) || null,
        detailAliasOf: aliasOf(card),
        before: cardSnapshot(card),
        after: cardSnapshot(nextCard),
        beforeHash: hash(cardSnapshot(card)),
        afterHash: hash(cardSnapshot(nextCard)),
        operations
      });
    }
  }
  assert.equal(
    [...placementTargetsCovered].sort().join(),
    [...PLACEMENT_FIXES.keys()].sort().join(),
    "Not every reviewed placement-fix slug reached a card copy."
  );
  assert.equal(
    [...labelTargetsCovered].sort().join(),
    [...LABEL_FIXES.keys()].sort().join(),
    "Not every reviewed label-fix slug reached a card copy."
  );

  // ---------- family 3: hub alias removals (tool uniqueness) ----------
  {
    const hubRemovals = [];
    const seen = new Set();
    for (const copy of copies) {
      if (copy.page !== TOOL_UNIQUENESS.hubPage || copy.shape !== "picker") continue;
      const card = copy.card;
      const alias = aliasOf(card);
      if (!alias || !TOOL_UNIQUENESS.aliasTargets.includes(alias)) continue;
      if (!videoSrcOf(card)) continue;
      assert(!seen.has(alias), `Duplicate reviewed removal copy for ${alias} on the hub.`);
      seen.add(alias);
      hubRemovals.push(copy);
    }
    assert.equal(
      [...seen].sort().join(),
      [...TOOL_UNIQUENESS.aliasTargets].sort().join(),
      "Expected the hub to hold exactly the two reviewed app demo alias videos."
    );
    const entry = pageEntryOf(TOOL_UNIQUENESS.hubPage);
    for (const copy of hubRemovals) {
      const card = copy.card;
      entry.pickerRemovals.push({
        cardsContainer: cardsContainerFor(copy.sectionKey),
        label: labelOf(card),
        kind: kindOf(card),
        detailAliasOf: aliasOf(card),
        before: cardSnapshot(card),
        beforeHash: hash(cardSnapshot(card))
      });
    }
  }

  // ---------- family 4: image-to-video alias reference additions ----------
  {
    const additions = TEMPLATE_REFERENCE_ADDITIONS;
    const targetRow = rowBySlug.get(additions.targetPage);
    assert(targetRow, `Reference target page ${additions.targetPage} missing.`);
    const targetSectionKey = copies.find(
      (copy) => copy.page === additions.targetPage && copy.shape === "picker"
    )?.sectionKey;
    assert(targetSectionKey, `No picker section found on ${additions.targetPage}.`);
    const entry = pageEntryOf(additions.targetPage);
    const newCards = [];
    for (const sourcePage of additions.sourcePages) {
      const seen = new Map();
      for (const copy of copies) {
        // The 22 template demo videos live in the example galleries of the
        // three demo pages, not in their pickers.
        if (copy.page !== sourcePage || copy.shape !== "exampleGallery") continue;
        const card = copy.card;
        const slug = publicSlugOf(card);
        if (!slug || aliasOf(card)) continue;
        if (!videoSrcOf(card) || kindOf(card) !== "video") continue;
        assert(!seen.has(slug), `Duplicate published video ${slug} on ${sourcePage}; refusing an ambiguous reference.`);
        seen.set(slug, copy);
      }
      console.log(`reference source ${sourcePage}: ${seen.size} videos`);
      for (const [slug, copy] of seen) {
        const card = copy.card;
        // The reference copy aliases the reviewed detail page; its placement
        // mirrors the reviewed post-fix set of that asset (inert for the
        // placement index but written so every copy of an asset agrees).
        const fixed = PLACEMENT_FIXES.get(slug);
        const shared = byIdentity.get(identityKeyOf(card)) ?? [];
        const unionNow = [...new Set(shared.flatMap((item) => placementOf(item.card)))].sort();
        const placement = fixed ? [...new Set(fixed)].sort() : unionNow;
        for (const value of placement) {
          assert(MEDIA_PLACEMENT_PATTERN.test(value), `Refusing placement value "${value}" on the reference card for ${slug}.`);
        }
        const next = {
          label: labelOf(card),
          kind: kindOf(card),
          image: record(structuredClone(card.image)),
          video: record(structuredClone(card.video)),
          prompt: text(card.prompt),
          href: `/ai-video-generation/${slug}`,
          chips: chipsOf(card),
          detailAliasOf: slug,
          placement
        };
        const aspect = text(card.aspect);
        if (aspect) next.aspect = aspect;
        if (card.duration !== undefined && card.duration !== null) next.duration = card.duration;
        if (Array.isArray(card.referenceImages) && card.referenceImages.length) {
          next.referenceImages = structuredClone(card.referenceImages);
        }
        assert(!publicSlugOf(next), "Reference cards must never publish a publicSlug (single-owner rule).");
        assert.equal(next.detailAliasOf, slug, "Reference cards must alias their reviewed detail page.");
        const existing = copies.some(
          (item) => item.page === additions.targetPage && item.shape === "picker"
            && hash(cardSnapshot(item.card)) === hash(cardSnapshot(next))
        );
        if (existing) continue;
        newCards.push({
          cardsContainer: cardsContainerFor(targetSectionKey),
          sourcePage,
          label: labelOf(next),
          kind: kindOf(next),
          detailAliasOf: slug,
          before: null,
          after: cardSnapshot(next),
          beforeHash: null,
          afterHash: hash(cardSnapshot(next)),
          card: next
        });
      }
    }
    assert.equal(newCards.length, 22, `Expected 22 reviewed reference cards, prepared ${newCards.length}.`);
    entry.pickerAdditions.push(...newCards);
  }

  const pageList = [...pages.values()]
    .filter((entry) => entry.cardWrites.length || entry.pickerRemovals.length || entry.pickerAdditions.length)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const summary = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    placementFixes: PLACEMENT_FIXES.size,
    labelFixes: LABEL_FIXES.size,
    pickerRemovals: pageList.reduce((total, entry) => total + entry.pickerRemovals.length, 0),
    pickerAdditions: pageList.reduce((total, entry) => total + entry.pickerAdditions.length, 0),
    cardWrites: pageList.reduce((total, entry) => total + entry.cardWrites.length, 0),
    pages: pageList.length
  };
  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    rule: "three-source reviewed video-detail categorization fixes: honest placement[], honest labels for 8 sale-wall pages, hub app alias removals, 22 image-to-video alias references",
    summary,
    pages: pageList,
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
    summary
  }, null, 2));
} finally {
  await db.$disconnect();
}
