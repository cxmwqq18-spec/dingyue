#!/usr/bin/env node
// Read-only product grouping audit for AIVideosUGC / site_aidreamcapes.
//
// The public data currently stores one card per page context. The same product
// image is often copied into many pages with a different `publicSlug`. This
// audit groups those cards by their media identity so tags can be assigned to
// one product instead of being repeated (and drifting) across page-local cards.
//
// A product group is:
//   * `video.src` when the card carries a video source, otherwise
//   * `image.src` / poster source;
//   * plus the card kind, so a photo and a video using the same still are not
//     silently merged.
//
// It never writes the database. `--write` only saves the reviewed JSON report.
//
// Usage:
//   node scripts/audit-aidreamcapes-media-products.mjs --target=local
//   node scripts/audit-aidreamcapes-media-products.mjs --target=local --details
//   node scripts/audit-aidreamcapes-media-products.mjs --target=local --write
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { aidreamcapesAuditLoader } from "./lib/aidreamcapes-typescript-audit-loader.mjs";
import {
  argumentValue,
  assertAllowedSite,
  assertDatabaseTarget,
  databaseTargetSummary,
  hasArgument
} from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({ expectedTarget: target });
const details = hasArgument("--details");
const write = hasArgument("--write");
const limit = Math.max(1, Math.trunc(Number(argumentValue("--limit") ?? "10") || 10));
const reportPath = argumentValue("--out") || "docs/audits/aidreamcapes-media-product-groups-2026-10-21.json";
const PLACEMENT_PATTERN = /^\/(industries|platforms|occasions)\/[a-z0-9][a-z0-9-]*$/;
const SOURCE_RANK = { definition: 0, picker: 1, example: 2, workspaceCase: 3 };

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}

function mediaKind(value) {
  if (value === "photo") return "photo";
  if (value === "video" || value === "clip" || value === "scene") return "video";
  return undefined;
}

function normalizeMediaSrc(value) {
  const src = text(value);
  if (!src) return undefined;
  // Cache-busting query strings and fragments do not change the media identity.
  return src.split(/[?#]/, 1)[0];
}

function mediaOf(card) {
  const image = record(card.image);
  const video = record(card.video);
  const poster = record(video?.poster);
  const videoSrc = normalizeMediaSrc(video?.src);
  const imageSrc = normalizeMediaSrc(image?.src);
  const posterSrc = normalizeMediaSrc(poster?.src);
  if (videoSrc) return { type: "video", src: videoSrc, stillSrc: imageSrc ?? posterSrc };
  if (imageSrc) return { type: "image", src: imageSrc };
  if (posterSrc) return { type: "video", src: posterSrc };
  return undefined;
}

/** Mirrors src/lib/aidreamcapes-workspace/media-cards.server.ts. */
function cardsFromContent(contentJson) {
  const content = record(contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : [];
  const cards = [];
  for (const sectionId of order) {
    if (typeof sectionId !== "string") continue;
    const section = record(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(section.settings)?.data);
    const definition = record(data?.templateDefinition);
    if (record(definition?.card)) cards.push({ card: definition.card, source: "definition" });
    const picker = record(record(data?.visual)?.picker);
    if (picker && Array.isArray(picker.cards)) {
      for (const card of picker.cards) if (record(card)) cards.push({ card, source: "picker" });
    }
    if (Array.isArray(data?.workspaceCases)) {
      for (const card of data.workspaceCases) if (record(card)) cards.push({ card, source: "workspaceCase" });
    }
    const examples = record(data?.examples);
    if (examples && Array.isArray(examples.groups)) {
      for (const group of examples.groups) {
        const items = record(group)?.items;
        if (Array.isArray(items)) for (const card of items) if (record(card)) cards.push({ card, source: "example" });
      }
    }
  }
  return cards;
}

function templateCardSlug(contentJson) {
  const sections = record(record(contentJson)?.sections);
  for (const section of Object.values(sections ?? {})) {
    if (record(section)?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(record(section)?.settings)?.data);
    const definition = record(data?.templateDefinition);
    const card = record(definition?.card);
    const slug = text(card?.publicSlug);
    if (slug) return slug;
  }
  return undefined;
}

function stableProductKey(groupKey) {
  return `mp_${crypto.createHash("sha256").update(groupKey).digest("hex").slice(0, 12)}`;
}

function compareCards(left, right) {
  const rank = (card) => [
    card.templateRole ? 0 : 1,
    SOURCE_RANK[card.source] ?? 9,
    card.page === "/" ? 0 : card.page.startsWith("/templates") ? 1 : 2,
    card.publicSlug.length,
    card.publicSlug
  ];
  const a = rank(left);
  const b = rank(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}

function canonicalReason(card) {
  if (card.templateRole) return "template definition card";
  if (card.source === "picker" && card.page === "/") return "picker card on the home page";
  if (card.source === "picker") return "picker card";
  if (card.source === "example") return "example card";
  return "workspace case";
}

function labelVariants(cards) {
  const variants = new Map();
  for (const card of cards) {
    const label = text(card.label) ?? text(card.title) ?? "(missing label)";
    const entry = variants.get(label) ?? { label, count: 0, cards: [] };
    entry.count += 1;
    entry.cards.push(card);
    variants.set(label, entry);
  }
  return [...variants.values()]
    .map((entry) => ({
      label: entry.label,
      count: entry.count,
      publicSlugs: [...new Set(entry.cards.map((card) => card.publicSlug))].sort()
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function normalizedLabel(label) {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const db = new PrismaClient({ errorFormat: "minimal" });
const loadRuntime = aidreamcapesAuditLoader({ "@/lib/prisma": { prisma: db } });
const { presetFromCard, presetGenerationIdentity } = loadRuntime("src/lib/aidreamcapes-workspace/presets.server.ts");
try {
  const pages = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    select: { slug: true, title: true, contentJson: true, updatedAt: true }
  });
  const cards = [];
  let extractedCards = 0;
  let cardsWithoutPublicSlug = 0;
  let cardsWithoutMedia = 0;

  for (const page of pages) {
    const templateSlug = templateCardSlug(page.contentJson);
    for (const entry of cardsFromContent(page.contentJson)) {
      extractedCards += 1;
      const card = entry.card;
      const kind = mediaKind(card.kind);
      const publicSlug = text(card.publicSlug);
      const label = text(card.label) ?? text(card.title);
      const media = mediaOf(card);
      if (!publicSlug) {
        cardsWithoutPublicSlug += 1;
        continue;
      }
      if (!kind || !label || !media) {
        cardsWithoutMedia += 1;
        continue;
      }
      cards.push({
        page: page.slug,
        source: entry.source,
        templateRole: Boolean(templateSlug && templateSlug === publicSlug),
        kind,
        publicSlug,
        label,
        detailAliasOf: text(card.detailAliasOf),
        generationIdentity: presetGenerationIdentity(presetFromCard(page, page.slug, card)),
        media,
        chips: list(card.chips),
        placement: list(card.placement).filter((value) => PLACEMENT_PATTERN.test(value)),
        rawPlacement: Array.isArray(card.placement) ? card.placement : []
      });
    }
  }

  // Retained locators are not independent active details. Validate reference
  // intent against today's effective generation options before counting it.
  const cardsBySlug = new Map();
  for (const card of cards) {
    const key = `${card.kind}/${card.publicSlug}`, entries = cardsBySlug.get(key) ?? [];
    entries.push(card); cardsBySlug.set(key, entries);
  }
  for (const card of cards) {
    card.effectivePublicSlug = card.publicSlug;
    if (!card.detailAliasOf) continue;
    const targets = cardsBySlug.get(`${card.kind}/${card.detailAliasOf}`) ?? [];
    const targetCard = targets[0];
    if (targetCard && new Set(targets.map((target) => target.page)).size === 1 && !targetCard.detailAliasOf
      && card.generationIdentity && card.generationIdentity === targetCard.generationIdentity
      && card.media.type === targetCard.media.type && card.media.src === targetCard.media.src) {
      card.effectivePublicSlug = targetCard.publicSlug;
    }
  }

  const groups = new Map();
  for (const card of cards) {
    const groupKey = `${card.kind}|${card.media.type}|${card.media.src}`;
    const group = groups.get(groupKey) ?? {
      groupKey,
      productKey: stableProductKey(groupKey),
      kind: card.kind,
      mediaType: card.media.type,
      mediaSrc: card.media.src,
      cards: []
    };
    group.cards.push(card);
    groups.set(groupKey, group);
  }

  const products = [...groups.values()].map((group) => {
    const sortedCards = [...group.cards].sort(compareCards);
    const canonical = sortedCards[0];
    const uniquePages = [...new Set(group.cards.map((card) => card.page))].sort();
    const uniqueSlugs = [...new Set(group.cards.map((card) => card.publicSlug))].sort();
    const chips = new Map();
    for (const card of group.cards) {
      for (const chip of card.chips) chips.set(chip, (chips.get(chip) ?? 0) + 1);
    }
    const placements = new Map();
    for (const card of group.cards) {
      for (const placement of card.placement) placements.set(placement, (placements.get(placement) ?? 0) + 1);
    }
    const variants = labelVariants(group.cards);
    const normalizedVariants = new Set(variants.map((variant) => normalizedLabel(variant.label))).size;
    const sources = {};
    for (const card of group.cards) sources[card.source] = (sources[card.source] ?? 0) + 1;
    return {
      productKey: group.productKey,
      groupKey: group.groupKey,
      kind: group.kind,
      mediaType: group.mediaType,
      mediaSrc: group.mediaSrc,
      cardCount: group.cards.length,
      uniquePublicSlugs: uniqueSlugs.length,
      activeDetailSlugsByData: new Set(group.cards.map((card) => card.effectivePublicSlug)).size,
      equivalentAliasReferences: group.cards.filter((card) => card.effectivePublicSlug !== card.publicSlug).length,
      unmergedEquivalentVariants: [...new Set(group.cards.map((card) => card.generationIdentity).filter(Boolean))]
        .filter((identity) => new Set(group.cards.filter((card) => card.generationIdentity === identity)
          .map((card) => card.effectivePublicSlug)).size > 1).length,
      uniquePages: uniquePages.length,
      uniqueLabels: variants.length,
      normalizedLabelVariants: normalizedVariants,
      templateCards: group.cards.filter((card) => card.templateRole).length,
      sources,
      ownerPages: uniquePages,
      publicSlugs: uniqueSlugs,
      labelVariants: variants,
      chips: [...chips.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([chip, count]) => ({ chip, count })),
      placements: [...placements.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([placement, count]) => ({ placement, count })),
      recommended: {
        label: canonical.label,
        publicSlug: canonical.publicSlug,
        ownerPath: canonical.page,
        source: canonical.source,
        reason: canonicalReason(canonical)
      }
    };
  }).sort((left, right) => right.cardCount - left.cardCount || left.mediaSrc.localeCompare(right.mediaSrc));

  const duplicateSlugGroups = products.filter((product) => product.uniquePublicSlugs > 1);
  const labelConflictGroups = products.filter((product) => product.normalizedLabelVariants > 1);
  const templateMixedGroups = products.filter((product) => product.templateCards > 0 && product.templateCards < product.cardCount);
  const placementGroups = products.filter((product) => product.placements.length > 0);
  const placementConflictGroups = products.filter((product) => product.placements.length > 1);
  const maxCardsPerProduct = products.reduce((max, product) => Math.max(max, product.cardCount), 0);
  const cardsInMultiCardGroups = products.filter((product) => product.cardCount > 1).reduce((total, product) => total + product.cardCount, 0);

  const result = {
    ok: true,
    mode: "audit",
    target,
    database: databaseTargetSummary(),
    siteId: SITE_ID,
    liveDataOwner: "LivePage.contentJson",
    contract: "aidreamcapes-media-product-groups-v1",
    grouping: {
      key: "kind + video.src (fallback image.src/poster)",
      note: "One image/video asset is one product candidate. Page-local cards are references, not separate products."
    },
    summary: {
      pages: pages.length,
      extractedCards,
      validProductCards: cards.length,
      uniquePublicSlugs: new Set(cards.map((card) => card.publicSlug)).size,
      activeDetailSlugsByData: new Set(cards.map((card) => `${card.kind}/${card.effectivePublicSlug}`)).size,
      equivalentAliasReferences: cards.filter((card) => card.effectivePublicSlug !== card.publicSlug).length,
      staleAliasReferences: cards.filter((card) => card.detailAliasOf && card.effectivePublicSlug === card.publicSlug).length,
      unmergedEquivalentGroups: products.filter((product) => product.unmergedEquivalentVariants > 0).length,
      productGroups: products.length,
      cardsInMultiCardGroups,
      duplicateSlugGroups: duplicateSlugGroups.length,
      cardsInDuplicateSlugGroups: duplicateSlugGroups.reduce((total, product) => total + product.cardCount, 0),
      labelConflictGroups: labelConflictGroups.length,
      templateMixedGroups: templateMixedGroups.length,
      groupsWithPlacement: placementGroups.length,
      groupsWithConflictingPlacements: placementConflictGroups.length,
      maxCardsPerProduct,
      cardsWithoutPublicSlug,
      cardsWithoutMedia
    },
    products: details || write ? products : products.slice(0, limit),
    conflicts: {
      duplicatePublicSlugs: duplicateSlugGroups.map((product) => ({
        productKey: product.productKey,
        mediaSrc: product.mediaSrc,
        kind: product.kind,
        cardCount: product.cardCount,
        uniquePublicSlugs: product.uniquePublicSlugs,
        recommended: product.recommended,
        publicSlugs: product.publicSlugs,
        ownerPages: product.ownerPages
      })),
      labelVariants: labelConflictGroups.map((product) => ({
        productKey: product.productKey,
        mediaSrc: product.mediaSrc,
        kind: product.kind,
        cardCount: product.cardCount,
        recommended: product.recommended,
        variants: product.labelVariants
      })),
      templateMixed: templateMixedGroups.map((product) => ({
        productKey: product.productKey,
        mediaSrc: product.mediaSrc,
        cardCount: product.cardCount,
        templateCards: product.templateCards,
        recommended: product.recommended
      })),
      placementConflicts: placementConflictGroups.map((product) => ({
        productKey: product.productKey,
        mediaSrc: product.mediaSrc,
        placements: product.placements
      }))
    },
    notes: [
      "Read-only: no LivePage, publication, snapshot, or SiteContentRevision was written.",
      "Raw publicSlug/duplicate counts include retained compatibility locators. Active detail counts validate current generation equivalence; HTTP gates verify routing separately.",
      details || write ? "All product groups are included in the audit result." : `Only the first ${limit} product groups are included; pass --details or --write for the full list.`,
      ...(write ? [`Full report written to ${reportPath}.`] : [])
    ]
  };

  if (write) {
    const absolute = path.resolve(process.cwd(), reportPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  const printable = write && !details
    ? {
        ok: result.ok,
        mode: result.mode,
        target: result.target,
        database: result.database,
        siteId: result.siteId,
        contract: result.contract,
        summary: result.summary,
        notes: result.notes
      }
    : result;
  console.log(JSON.stringify(printable, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: "audit",
    target,
    siteId: SITE_ID,
    error: error instanceof Error ? error.stack : String(error)
  }, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
