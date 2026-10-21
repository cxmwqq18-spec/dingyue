#!/usr/bin/env node
// Read-only product-level placement plan for AIVideosUGC / site_aidreamcapes.
//
// One image/video asset is one product. A product can have many page-local
// cards with different `publicSlug` values. This plan validates the reviewed
// selection against the current LivePage rows and writes a manifest; it never
// writes content or a publication.
//
// Usage:
//   node scripts/plan-aidreamcapes-media-product-placement.mjs --target=local
//   node scripts/plan-aidreamcapes-media-product-placement.mjs --target=local --write-manifest
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import {
  argumentValue,
  assertAllowedSite,
  assertDatabaseTarget,
  hasArgument
} from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({ expectedTarget: target });
const defaultSelectionPath = "scripts/manifests/aidreamcapes-media-product-pilot-selection-2026-10-21.json";
const selectionPath = path.resolve(process.cwd(), argumentValue("--selection") || defaultSelectionPath);
const writeManifest = hasArgument("--write-manifest");
const defaultManifestPath = target === "local"
  ? "scripts/manifests/aidreamcapes-media-product-placement-local-2026-10-21.json"
  : `scripts/manifests/aidreamcapes-media-product-placement-${target}-2026-10-21.json`;
const manifestPath = path.resolve(process.cwd(), argumentValue("--out") || defaultManifestPath);
const CONTRACT = "aidreamcapes-media-product-placement-2026-10-21-v1";
const SELECTION_CONTRACT = "aidreamcapes-media-product-pilot-selection-2026-10-21-v1";
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

function normalizedMediaSrc(value) {
  const src = text(value);
  if (!src) return undefined;
  return src.split(/[?#]/, 1)[0];
}

function mediaOf(card) {
  const image = record(card.image);
  const video = record(card.video);
  const poster = record(video?.poster);
  const videoSrc = normalizedMediaSrc(video?.src);
  const imageSrc = normalizedMediaSrc(image?.src);
  const posterSrc = normalizedMediaSrc(poster?.src);
  if (videoSrc) return { mediaType: "video", mediaSrc: videoSrc, stillSrc: imageSrc ?? posterSrc };
  if (imageSrc) return { mediaType: "image", mediaSrc: imageSrc };
  if (posterSrc) return { mediaType: "video", mediaSrc: posterSrc };
  return undefined;
}

function pointerSegment(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
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
    const base = `/sections/${pointerSegment(sectionId)}/settings/data`;
    const definition = record(data?.templateDefinition);
    if (record(definition?.card)) {
      cards.push({ card: definition.card, source: "definition", fieldPath: `${base}/templateDefinition/card/placement` });
    }
    const picker = record(record(data?.visual)?.picker);
    if (picker && Array.isArray(picker.cards)) {
      picker.cards.forEach((card, index) => {
        if (record(card)) cards.push({ card, source: "picker", fieldPath: `${base}/visual/picker/cards/${index}/placement` });
      });
    }
    if (Array.isArray(data?.workspaceCases)) {
      data.workspaceCases.forEach((card, index) => {
        if (record(card)) cards.push({ card, source: "workspaceCase", fieldPath: `${base}/workspaceCases/${index}/placement` });
      });
    }
    const examples = record(data?.examples);
    if (examples && Array.isArray(examples.groups)) {
      examples.groups.forEach((group, groupIndex) => {
        const items = record(group)?.items;
        if (Array.isArray(items)) {
          items.forEach((card, itemIndex) => {
            if (record(card)) {
              cards.push({ card, source: "example", fieldPath: `${base}/examples/groups/${groupIndex}/items/${itemIndex}/placement` });
            }
          });
        }
      });
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

function directoryData(contentJson) {
  const sections = record(record(contentJson)?.sections);
  for (const section of Object.values(sections ?? {})) {
    if (record(section)?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(record(section)?.settings)?.data);
    if (data && record(data.templateDirectory)) return data;
  }
  return undefined;
}

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
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

function productKeyOf(kind, mediaType, mediaSrc) {
  return `mp_${crypto.createHash("sha256").update(`${kind}|${mediaType}|${mediaSrc}`).digest("hex").slice(0, 12)}`;
}

function cardOrder(entry) {
  return [
    entry.templateRole ? 0 : 1,
    SOURCE_RANK[entry.source] ?? 9,
    entry.page === "/" ? 0 : entry.page.startsWith("/templates") ? 1 : 2,
    entry.publicSlug.length,
    entry.publicSlug,
    entry.page
  ];
}

function compareCards(left, right) {
  const a = cardOrder(left);
  const b = cardOrder(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

const selection = JSON.parse(fs.readFileSync(selectionPath, "utf8"));
assert.equal(selection.contract, SELECTION_CONTRACT, `Selection contract must be ${SELECTION_CONTRACT}.`);
assert.equal(selection.siteId, SITE_ID, "Selection must be scoped to site_aidreamcapes.");
assert.equal(selection.target, target, `Selection was reviewed for ${selection.target}; refusing to plan for ${target}.`);
assert(Array.isArray(selection.items) && selection.items.length > 0, "Selection has no items.");

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    select: {
      id: true,
      siteId: true,
      slug: true,
      title: true,
      pageType: true,
      templateKey: true,
      contentJson: true,
      updatedAt: true
    },
    orderBy: { slug: "asc" }
  });
  assert(rows.length > 0, `No LivePage rows for ${SITE_ID}.`);

  const directories = new Map();
  for (const row of rows) {
    const data = directoryData(row.contentJson);
    if (!data) continue;
    const directory = record(data.templateDirectory);
    if (!directory || !Array.isArray(directory.paths)) continue;
    const kind = text(data.kind);
    if (kind !== "industry" && kind !== "platform" && kind !== "occasion") continue;
    const label = text(data.label) ?? text(row.title) ?? row.slug;
    directories.set(row.slug, { slug: row.slug, kind, label });
  }

  const groups = new Map();
  for (const row of rows) {
    const templateSlug = templateCardSlug(row.contentJson);
    for (const entry of cardsFromContent(row.contentJson)) {
      const card = entry.card;
      const kind = mediaKind(card.kind);
      const label = text(card.label) ?? text(card.title);
      const publicSlug = text(card.publicSlug);
      const media = mediaOf(card);
      if (!kind || !label || !publicSlug || !media) continue;
      const groupKey = `${kind}|${media.mediaType}|${media.mediaSrc}`;
      const group = groups.get(groupKey) ?? {
        groupKey,
        productKey: productKeyOf(kind, media.mediaType, media.mediaSrc),
        kind,
        mediaType: media.mediaType,
        mediaSrc: media.mediaSrc,
        cards: []
      };
      group.cards.push({
        page: row.slug,
        pageId: row.id,
        source: entry.source,
        fieldPath: entry.fieldPath,
        templateRole: Boolean(templateSlug && templateSlug === publicSlug),
        publicSlug,
        label,
        placement: uniqueSorted(list(card.placement).filter((value) => PLACEMENT_PATTERN.test(value))),
        rawPlacement: Array.isArray(card.placement) ? card.placement : []
      });
      groups.set(groupKey, group);
    }
  }

  const items = [];
  for (const selected of selection.items) {
    const productKey = text(selected.productKey);
    assert(productKey, "Selection item is missing productKey.");
    const group = [...groups.values()].find((candidate) => candidate.productKey === productKey);
    assert(group, `Product group ${productKey} no longer exists in current LivePage rows.`);

    const sorted = [...group.cards].sort(compareCards);
    const canonical = sorted[0];
    assert.equal(
      selected.canonicalOwnerPath,
      canonical.page,
      `Product ${productKey}: reviewed owner ${selected.canonicalOwnerPath} is no longer canonical (${canonical.page}).`
    );
    assert.equal(
      selected.canonicalPublicSlug,
      canonical.publicSlug,
      `Product ${productKey}: reviewed slug ${selected.canonicalPublicSlug} is no longer canonical (${canonical.publicSlug}).`
    );
    assert.equal(selected.expectedLabel, canonical.label, `Product ${productKey}: canonical label changed.`);
    assert.equal(selected.expectedMediaType, group.mediaType, `Product ${productKey}: media type changed.`);
    assert.equal(selected.expectedMediaSrc, group.mediaSrc, `Product ${productKey}: media source changed.`);

    for (const card of group.cards) {
      for (const value of card.rawPlacement) {
        assert(PLACEMENT_PATTERN.test(value), `Product ${productKey}: card ${card.page}/${card.publicSlug} has non-directory placement ${JSON.stringify(value)}.`);
      }
    }
    const targetPlacement = uniqueSorted(list(selected.placement));
    assert(targetPlacement.length > 0, `Product ${productKey}: placement is empty.`);
    for (const slug of targetPlacement) {
      assert(PLACEMENT_PATTERN.test(slug), `Product ${productKey}: invalid placement ${slug}.`);
      const directory = directories.get(slug);
      assert(directory, `Product ${productKey}: placement ${slug} has no current directory page.`);
      const prefix = slug.split("/")[1];
      const expectedKind = prefix === "industries" ? "industry" : prefix === "platforms" ? "platform" : "occasion";
      assert.equal(directory.kind, expectedKind, `Product ${productKey}: ${slug} kind is ${directory.kind}, expected ${expectedKind}.`);
    }

    const groupPlacements = uniqueSorted(group.cards.flatMap((card) => card.placement));
    const alreadyApplied = groupPlacements.length === targetPlacement.length
      && groupPlacements.every((value, index) => value === targetPlacement[index]);
    if (groupPlacements.length && !alreadyApplied) {
      throw new Error(
        `Product ${productKey}: current placement [${groupPlacements.join(", ")}] conflicts with planned [${targetPlacement.join(", ")}]. ` +
        "Online edits win; stop and review."
      );
    }
    assert(!group.cards.some((card) => card.templateRole), `Product ${productKey}: template products use directory paths, not explicit placement.`);

    const page = rows.find((row) => row.id === canonical.pageId);
    assert(page, `Product ${productKey}: canonical page ${canonical.pageId} disappeared.`);
    items.push({
      productKey,
      pageId: page.id,
      canonicalOwnerPath: canonical.page,
      canonicalPublicSlug: canonical.publicSlug,
      expectedLabel: canonical.label,
      expectedKind: group.kind,
      expectedMediaType: group.mediaType,
      expectedMediaSrc: group.mediaSrc,
      fieldPath: canonical.fieldPath,
      beforePlacement: canonical.placement,
      placement: targetPlacement,
      currentPlacement: groupPlacements,
      alreadyApplied,
      cardCount: group.cards.length,
      uniquePages: uniqueSorted(group.cards.map((card) => card.page)),
      publicSlugs: uniqueSorted(group.cards.map((card) => card.publicSlug)),
      ...(text(selected.reviewNote) ? { reviewNote: text(selected.reviewNote) } : {})
    });
  }

  items.sort((left, right) => left.placement.join(",").localeCompare(right.placement.join(",")) || left.canonicalPublicSlug.localeCompare(right.canonicalPublicSlug));
  const pageMap = new Map();
  for (const item of items) {
    const row = rows.find((candidate) => candidate.id === item.pageId);
    const page = pageMap.get(item.pageId) ?? {
      id: row.id,
      slug: row.slug,
      updatedAt: row.updatedAt,
      baseHash: pageHash(row),
      items: 0
    };
    page.items += 1;
    pageMap.set(item.pageId, page);
  }
  const pages = [...pageMap.values()].sort((left, right) => left.slug.localeCompare(right.slug));
  const planHash = hash({ contract: CONTRACT, siteId: SITE_ID, target, pages, items });
  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    selection: path.relative(process.cwd(), selectionPath),
    planHash,
    summary: {
      products: items.length,
      cardsCovered: items.reduce((total, item) => total + item.cardCount, 0),
      pagesUpdated: pages.length,
      alreadyApplied: items.filter((item) => item.alreadyApplied).length,
      reviews: items.filter((item) => item.reviewNote).length,
      byDirectory: items.reduce((acc, item) => {
        const slug = item.placement[0];
        acc[slug] = (acc[slug] ?? 0) + 1;
        return acc;
      }, {})
    },
    pages,
    items
  };

  if (writeManifest) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  const printable = writeManifest
    ? {
        ok: true,
        contract: manifest.contract,
        siteId: manifest.siteId,
        target: manifest.target,
        planHash: manifest.planHash,
        summary: manifest.summary,
        manifest: path.relative(process.cwd(), manifestPath)
      }
    : manifest;
  console.log(JSON.stringify(printable, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: "plan",
    target,
    siteId: SITE_ID,
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
