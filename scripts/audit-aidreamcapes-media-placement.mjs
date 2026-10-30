#!/usr/bin/env node
// Read-only placement audit for AIVideosUGC / site_aidreamcapes media cards.
//
// A card's `placement` is a list of canonical facet page slugs
// (`/industries/...`, `/platforms/...`, `/occasions/...`). This audit answers:
//
//   * which cards carry a valid placement, and which are still unplaced;
//   * which placement targets currently exist as LivePage directories;
//   * which template cards are reachable from each directory (reverse index);
//   * whether any placement value is invalid, stale or ignored at runtime;
//   * whether two pages share one public media slug (the detail route 404s).
//
// It never writes. It never reads ThemePage/draftJson/publishedJson or any
// publication/snapshot table. There is no apply mode.
//
// Usage:
//   node scripts/audit-aidreamcapes-media-placement.mjs --target=local
//   node scripts/audit-aidreamcapes-media-placement.mjs --target=production --details
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
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
const PLACEMENT_PATTERN = /^\/(industries|platforms|occasions)\/[a-z0-9][a-z0-9-]*$/;
const FACET_KINDS = new Set(["industry", "platform", "occasion"]);
const SAMPLE_LIMIT = 5;

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

function placementOf(value) {
  const raw = Array.isArray(value) ? value : [];
  const valid = [];
  const invalid = [];
  for (const item of raw) {
    if (typeof item === "string" && PLACEMENT_PATTERN.test(item)) valid.push(item);
    else invalid.push(item);
  }
  return { raw, valid: [...new Set(valid)].sort(), invalid };
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

function templateDefinitionFrom(contentJson, ownerPath) {
  const sections = record(record(contentJson)?.sections);
  for (const section of Object.values(sections ?? {})) {
    if (record(section)?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(record(section)?.settings)?.data);
    const definition = record(data?.templateDefinition);
    if (!definition) continue;
    const card = record(definition.card);
    const image = record(card?.image);
    return {
      path: ownerPath,
      name: text(definition.name) ?? text(card?.label) ?? ownerPath,
      cardSlug: text(card?.publicSlug),
      description: text(definition.description),
      kind: text(definition.kind),
      cardImageSrc: text(image?.src),
      cardImageAlt: text(image?.alt),
      facets: [...new Set([
        ...list(definition.industries),
        ...list(definition.platforms),
        ...list(definition.occasions)
      ])].sort()
    };
  }
  return undefined;
}

function directoryData(contentJson) {
  const sections = record(record(contentJson)?.sections);
  for (const section of Object.values(sections ?? {})) {
    if (record(section)?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(record(section)?.settings)?.data);
    if (record(data?.templateDirectory)) return data;
  }
  return undefined;
}

function detailCard(value) {
  const image = record(value.image);
  const src = text(image?.src);
  const label = text(value.label) ?? text(value.title);
  const kind = mediaKind(value.kind);
  const publicSlug = text(value.publicSlug);
  if (!src || !label || !kind || !publicSlug) return undefined;
  return { src, label, kind, publicSlug };
}

function walkPlacementObjects(value, path = [], into = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => walkPlacementObjects(child, [...path, String(index)], into));
    return into;
  }
  if (!value || typeof value !== "object") return into;
  if (Object.hasOwn(value, "placement")) into.push({ value, path });
  for (const [key, child] of Object.entries(value)) walkPlacementObjects(child, [...path, key], into);
  return into;
}

const db = new PrismaClient({ errorFormat: "minimal" });
const issues = [];
const notes = [];
function addIssue(code, detail) {
  issues.push({ code, ...detail });
}

try {
  const pages = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    select: { slug: true, title: true, contentJson: true }
  });
  const pagesBySlug = new Map(pages.map((page) => [page.slug, page]));
  const facets = new Map();
  const catalogs = new Map();
  const definitions = [];

  for (const page of pages) {
    const data = directoryData(page.contentJson);
    if (data) {
      const directory = record(data.templateDirectory);
      const paths = list(directory.paths);
      const label = text(data.label) ?? text(page.title) ?? page.slug;
      const kind = text(data.kind);
      if (kind && FACET_KINDS.has(kind)) {
        if (!page.slug.startsWith(`/${kind === "industry" ? "industries" : kind === "platform" ? "platforms" : "occasions"}/`)) {
          addIssue("directoryKindPathMismatch", { page: page.slug, kind });
        }
        facets.set(page.slug, { slug: page.slug, kind, label, paths });
      } else if (["/templates", "/templates/photo", "/templates/video"].includes(page.slug)) {
        catalogs.set(page.slug, { slug: page.slug, kind: "catalog", label, paths });
      } else {
        addIssue("directoryWithoutFacetKind", { page: page.slug, kind: kind ?? null });
      }
      for (const path of paths) {
        if (!pagesBySlug.has(path)) addIssue("directoryPathPageMissing", { page: page.slug, path });
      }
    }
    const definition = templateDefinitionFrom(page.contentJson, page.slug);
    if (definition) definitions.push(definition);
  }

  const definitionByOwner = new Map(definitions.map((definition) => [definition.path, definition]));
  const uniqueCards = new Map();
  const unplacedByOwner = new Map();
  const sourceCounts = {};
  const knownCardObjects = new Set();
  let extractedCards = 0;
  let cardsWithoutPublicSlug = 0;
  let invalidPlacementCards = 0;

  for (const page of pages) {
    const extracted = cardsFromContent(page.contentJson);
    const ownerDefinition = definitionByOwner.get(page.slug);
    for (const entry of extracted) {
      extractedCards += 1;
      sourceCounts[entry.source] = (sourceCounts[entry.source] ?? 0) + 1;
      knownCardObjects.add(entry.card);
    }
    for (const entry of extracted) {
      const card = detailCard(entry.card);
      const placement = placementOf(entry.card.placement);
      if (!card) {
        if (!text(entry.card.publicSlug)) cardsWithoutPublicSlug += 1;
        if (placement.raw.length) {
          addIssue("placementOnUnroutableCard", {
            page: page.slug,
            source: entry.source,
            publicSlug: text(entry.card.publicSlug) ?? null,
            reason: "the card has no resolvable detail route, so the placement can never render"
          });
        }
        continue;
      }
      const key = `${card.kind}/${card.publicSlug}`;
      const isTemplateIdentity = Boolean(ownerDefinition?.cardSlug && ownerDefinition.cardSlug === card.publicSlug);
      const existing = uniqueCards.get(key) ?? { key, ...card, owners: [], placements: new Set(), templateOwner: undefined };
      existing.owners.push({ page: page.slug, source: entry.source, label: card.label, isTemplateIdentity });
      for (const slug of placement.valid) existing.placements.add(slug);
      if (isTemplateIdentity) existing.templateOwner = page.slug;
      uniqueCards.set(key, existing);

      if (placement.invalid.length) {
        invalidPlacementCards += 1;
        addIssue("invalidPlacementValue", { page: page.slug, publicSlug: card.publicSlug, values: placement.invalid });
      }
      for (const slug of placement.valid) {
        if (!facets.has(slug)) addIssue("unknownPlacementDirectory", { page: page.slug, publicSlug: card.publicSlug, placement: slug });
      }
      if (isTemplateIdentity && placement.valid.length) {
        addIssue("templateCardPlacementIgnored", {
          page: page.slug,
          publicSlug: card.publicSlug,
          placement: placement.valid,
          reason: "template cards derive categories from directory paths; explicit placement is ignored"
        });
      }
      if (!isTemplateIdentity && !placement.valid.length) {
        const owner = unplacedByOwner.get(page.slug) ?? { page: page.slug, cards: 0 };
        owner.cards += 1;
        unplacedByOwner.set(page.slug, owner);
      }
    }
  }

  // A placement key on an object that the shared extractor does not read is
  // dead data: it can never reach the detail page or a directory grid.
  for (const page of pages) {
    for (const found of walkPlacementObjects(page.contentJson)) {
      if (knownCardObjects.has(found.value)) continue;
      addIssue("placementOnNonCardObject", { page: page.slug, path: found.path.join(".") });
    }
  }

  const cards = [...uniqueCards.values()];
  for (const card of cards) {
    const owners = new Map(card.owners.map((owner) => [owner.page, owner]));
    if (owners.size > 1) {
      addIssue("duplicatePublicSlugAcrossPages", {
        publicSlug: card.publicSlug,
        kind: card.kind,
        pages: [...owners.keys()].sort(),
        reason: "resolveMediaDetail requires exactly one owner page; a shared slug returns no detail page"
      });
    }
    // Template pages are hidden-but-routable since the /templates gallery took
    // over (2026-10-30): directories no longer promise template reachability,
    // so the former templateCardWithoutDirectory membership rule is retired.
  }

  // The definition facets and the reverse directory index are two statements
  // about the same template. Drift means the detail page and the directory
  // page disagree about where the template belongs.
  for (const definition of definitions) {
    if (!definition.cardSlug) {
      addIssue("templateDefinitionWithoutCardSlug", { page: definition.path, name: definition.name });
      continue;
    }
    const directoryFacets = [...facets.values()]
      .filter((directory) => directory.paths.includes(definition.path))
      .map((directory) => directory.slug);
    const declared = new Set(definition.facets);
    const indexed = new Set(directoryFacets);
    const notIndexed = [...declared].filter((slug) => !indexed.has(slug)).sort();
    const notDeclared = [...indexed].filter((slug) => !declared.has(slug)).sort();
    if (notIndexed.length) addIssue("templateFacetNotInDirectory", { page: definition.path, publicSlug: definition.cardSlug, facets: notIndexed });
    if (notDeclared.length) addIssue("directoryPathNotInTemplateFacets", { page: definition.path, publicSlug: definition.cardSlug, facets: notDeclared });
  }

  // Template card consistency: a directory card is public copy and must be
  // complete. A missing image, alt text, description, or kind breaks the
  // directory grids, the filter pickers, and the accessibility contract.
  for (const definition of definitions) {
    if (definition.cardSlug) {
      if (!definition.cardImageSrc) addIssue("templateCardWithoutImage", { page: definition.path, name: definition.name });
      else if (!/\.(webp|png|jpe?g)$/i.test(definition.cardImageSrc)) addIssue("templateCardImageNotMedia", { page: definition.path, src: definition.cardImageSrc });
      if (!definition.cardImageAlt) addIssue("templateCardWithoutImageAlt", { page: definition.path, name: definition.name });
    }
    if (!definition.description) addIssue("templateDefinitionWithoutDescription", { page: definition.path, name: definition.name });
    if (definition.kind !== "photo" && definition.kind !== "video") addIssue("templateDefinitionWithoutKind", { page: definition.path, name: definition.name, kind: definition.kind ?? null });
  }

  const templateCards = cards.filter((card) => card.templateOwner);
  const mediaCards = cards.filter((card) => !card.templateOwner);
  const placedMediaCards = mediaCards.filter((card) => card.placements.size > 0);

  const directoryRows = [...facets.values()].map((directory) => {
    const templateMatches = templateCards
      .filter((card) => directory.paths.includes(card.templateOwner))
      .map((card) => card.publicSlug)
      .sort();
    const taggedMatches = mediaCards
      .filter((card) => card.placements.has(directory.slug))
      .map((card) => card.publicSlug)
      .sort();
    return {
      slug: directory.slug,
      kind: directory.kind,
      label: directory.label,
      directoryPaths: directory.paths.length,
      templateCards: templateMatches.length,
      taggedCards: taggedMatches.length,
      ...(details ? { templateSlugs: templateMatches, taggedSlugs: taggedMatches } : {
        templateSamples: templateMatches.slice(0, SAMPLE_LIMIT),
        taggedSamples: taggedMatches.slice(0, SAMPLE_LIMIT)
      })
    };
  }).sort((left, right) => left.slug.localeCompare(right.slug));

  const catalogRows = [...catalogs.values()].map((catalog) => ({
    slug: catalog.slug,
    label: catalog.label,
    directoryPaths: catalog.paths.length,
    templateCards: templateCards.filter((card) => catalog.paths.includes(card.templateOwner)).length
  })).sort((left, right) => left.slug.localeCompare(right.slug));

  const unplaced = [...unplacedByOwner.values()].sort((left, right) => right.cards - left.cards || left.page.localeCompare(right.page));
  const result = {
    ok: issues.length === 0,
    mode: "audit",
    target,
    database: databaseTargetSummary(),
    siteId: SITE_ID,
    liveDataOwner: "LivePage.contentJson",
    contract: "aidreamcapes-media-placement-v1",
    summary: {
      pages: pages.length,
      facetDirectories: facets.size,
      catalogDirectories: catalogs.size,
      extractedCards,
      uniquePublicCards: cards.length,
      templateCards: templateCards.length,
      mediaCards: mediaCards.length,
      placedMediaCards: placedMediaCards.length,
      unplacedMediaCards: mediaCards.length - placedMediaCards.length,
      cardsWithoutPublicSlug,
      cardsWithInvalidPlacement: invalidPlacementCards,
      sourceCounts
    },
    directories: [...directoryRows, ...catalogRows],
    unplacedByOwner: unplaced,
    issues
  };
  if (!facets.size) notes.push("No facet directory pages were found; no card can be placed.");
  if (!details) notes.push("Directory lists are truncated; pass --details for every template and tagged slug.");
  if (notes.length) result.notes = notes;
  console.log(JSON.stringify(result, null, 2));
  if (issues.length) process.exitCode = 1;
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
