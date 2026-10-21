#!/usr/bin/env node
// Read-only plan for the Aidreamcapes media detail slug normalization.
//
// The public product walls publish every media card with a slug that repeats
// the owner page path, e.g.
//   /ai-video-generation/bedroom-try-on-knitwear-ai-video-generation-ugc-ad-video
// The product's own short slug is the expected address:
//   /ai-video-generation/bedroom-try-on-knitwear
//
// This plan normalizes the published wall cards onto the product's short slug
// and records the replaced long slug as a `publicAliases` entry of the same
// card, so the retired address answers with a 308 to the canonical one.
//
// The runtime owns exactly one address per slug, so a product published on
// both walls keeps one canonical address (the video-ads wall) and the second
// wall copy keeps its own address.
//
// This script never writes content, a publication, or a snapshot. It reads the
// current LivePage rows of site_aidreamcapes and writes one reviewed manifest.
//
// Usage:
//   node scripts/plan-aidreamcapes-media-slug-alias.mjs --target=local
//   node scripts/plan-aidreamcapes-media-slug-alias.mjs --target=local --write-manifest
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
const CONTRACT = "aidreamcapes-media-slug-alias-2026-10-22-v1";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({ expectedTarget: target });
const writeManifest = hasArgument("--write-manifest");
const outPath = path.resolve(
  process.cwd(),
  argumentValue("--out") || `scripts/manifests/aidreamcapes-media-slug-alias-${target}-2026-10-22.json`
);

// The wall that owns the canonical product address. A product published on
// both walls keeps one canonical address here; the other wall keeps its own.
const CANONICAL_WALL = "/ai-video-generation/video-ads";
const OTHER_WALL = "/ai-video-generation";
const WALLS = [CANONICAL_WALL, OTHER_WALL];
const MEDIA_ROOTS = { photo: "ai-image-generation", video: "ai-video-generation" };

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

/** The slug rule the current data follows: slugify(card.label). */
function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function labelOf(card) {
  if (typeof card.label === "string") return card.label.trim();
  if (typeof card.title === "string") return card.title.trim();
  return "";
}

function kindOf(card) {
  if (card.kind === "photo") return "photo";
  if (card.kind === "video" || card.kind === "clip" || card.kind === "scene") return "video";
  return undefined;
}

/** Every media card of the current inventory, with its JSON path. */
function pageCards(contentJson) {
  const content = record(contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) && content.sectionsOrder.length
    ? content.sectionsOrder
    : Object.keys(sections ?? {});
  const out = [];
  for (const sectionId of order) {
    const section = record(sections?.[sectionId]);
    if (!section || section.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(section.settings)?.data);
    if (!data) continue;
    const picker = record(record(data.visual)?.picker);
    if (Array.isArray(picker?.cards)) {
      picker.cards.forEach((value, index) => {
        const card = record(value);
        if (card) out.push({ source: "picker", jsonPath: `sections.${sectionId}.settings.data.visual.picker.cards[${index}]`, card });
      });
    }
  }
  return out;
}

function detailPath(kind, slug) {
  return `/${MEDIA_ROOTS[kind]}/${slug}`;
}

/** The retired form repeats the owner page path after the product slug. */
function retiredProductSlug(slug) {
  const match = /^(.*)-ai-video-generation(-ugc-ad-video)?$/.exec(slug);
  return match ? match[1] : undefined;
}

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
  assert(rows.length > 0, `No LivePage rows for ${SITE_ID}.`);

  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const livePageSlugs = new Set(rows.map((row) => row.slug));

  // Every card slug of the site, so a new slug cannot collide with an
  // existing address.
  const ownedSlugs = new Map();
  for (const row of rows) {
    for (const entry of pageCards(row.contentJson)) {
      const slug = typeof entry.card.publicSlug === "string" ? entry.card.publicSlug.trim() : "";
      if (!slug) continue;
      const list = ownedSlugs.get(slug) ?? [];
      list.push({ page: row.slug, jsonPath: entry.jsonPath });
      ownedSlugs.set(slug, list);
    }
  }

  // ---- 1. The published wall cards --------------------------------------
  const wallCards = [];
  for (const wall of WALLS) {
    const row = bySlug.get(wall);
    assert(row, `Wall page ${wall} is missing for ${SITE_ID}.`);
    for (const entry of pageCards(row.contentJson)) {
      const card = entry.card;
      const kind = kindOf(card);
      const slug = typeof card.publicSlug === "string" ? card.publicSlug.trim() : "";
      const label = labelOf(card);
      if (!kind || !slug || !label) continue;
      const imageSrc = typeof record(card.image)?.src === "string" ? record(card.image).src : "";
      const aliases = Array.isArray(card.publicAliases)
        ? card.publicAliases.filter((value) => typeof value === "string" && value.trim())
        : [];
      wallCards.push({
        page: wall,
        jsonPath: entry.jsonPath,
        kind,
        label,
        imageSrc,
        currentSlug: slug,
        currentAliases: aliases,
        baseSlug: slugify(label),
        retiredProductSlug: retiredProductSlug(slug)
      });
    }
  }

  // ---- 2. One canonical owner per published product ----------------------
  const byMedia = new Map();
  for (const card of wallCards) {
    const key = `${card.kind}|${card.imageSrc}`;
    const list = byMedia.get(key) ?? [];
    list.push(card);
    byMedia.set(key, list);
  }

  const planned = [];
  const skipped = [];
  const problems = [];
  for (const [key, list] of byMedia) {
    const ordered = [...list].sort((a, b) => {
      const rank = (item) => (item.page === CANONICAL_WALL ? 0 : 1);
      return rank(a) - rank(b) || a.jsonPath.localeCompare(b.jsonPath);
    });
    const canonical = ordered[0];
    for (const other of ordered.slice(1)) {
      skipped.push({
        page: other.page,
        jsonPath: other.jsonPath,
        label: other.label,
        currentSlug: other.currentSlug,
        reason: `the canonical address of this product is owned by ${canonical.page}; one slug may only be owned by one page`
      });
    }

    const retired = canonical.retiredProductSlug;
    if (!retired) {
      // The card already carries a short address, or a name this plan does
      // not rewrite.
      skipped.push({
        page: canonical.page,
        jsonPath: canonical.jsonPath,
        label: canonical.label,
        currentSlug: canonical.currentSlug,
        reason: "the card already carries a short address"
      });
      continue;
    }

    // The target is the product's own short slug. When the stored label and
    // the retired slug disagree, the retired product part is used, because it
    // is the name the site already published for that product.
    const candidates = [canonical.baseSlug, retired].filter((value, index, all) => value && all.indexOf(value) === index);
    let targetSlug;
    for (const candidate of candidates) {
      const holders = (ownedSlugs.get(candidate) ?? []).filter(
        (holder) => !(holder.page === canonical.page && holder.jsonPath === canonical.jsonPath)
      );
      if (holders.length) continue;
      if (livePageSlugs.has(detailPath(canonical.kind, candidate))) continue;
      targetSlug = candidate;
      break;
    }
    if (!targetSlug) {
      skipped.push({
        page: canonical.page,
        jsonPath: canonical.jsonPath,
        label: canonical.label,
        currentSlug: canonical.currentSlug,
        reason: "no free short address is available for this product"
      });
      continue;
    }

    const oldOwners = (ownedSlugs.get(canonical.currentSlug) ?? []).filter(
      (holder) => !(holder.page === canonical.page && holder.jsonPath === canonical.jsonPath)
    );
    if (oldOwners.length) {
      problems.push(`${canonical.page}${canonical.jsonPath}: slug ${canonical.currentSlug} is also owned by ${oldOwners.map((owner) => `${owner.page}${owner.jsonPath}`).join(", ")}`);
      continue;
    }
    if (ownedSlugs.has(targetSlug)) {
      problems.push(`${canonical.page}${canonical.jsonPath}: slug ${targetSlug} is already owned by another card`);
      continue;
    }

    planned.push({
      ...canonical,
      targetSlug,
      afterAliases: [...new Set([...canonical.currentAliases, canonical.currentSlug])]
    });
  }

  // ---- 3. Guard the plan against the runtime's ownership rules -------------
  const seenTargets = new Map();
  for (const candidate of planned) {
    const owner = seenTargets.get(candidate.targetSlug);
    if (owner) problems.push(`slug ${candidate.targetSlug} is planned twice (${owner.page}${owner.jsonPath})`);
    seenTargets.set(candidate.targetSlug, candidate);
    if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(candidate.targetSlug)) {
      problems.push(`${candidate.page}${candidate.jsonPath}: target slug ${candidate.targetSlug} is not a valid public slug`);
    }
  }

  // ---- 4. Assemble the reviewed manifest ---------------------------------
  // The migrated addresses of the canonical owner of every product: the
  // retired long address and the canonical one. A card that is already
  // migrated keeps its aliases, so the list covers the applied state too.
  // A card that keeps its own address - the second wall of a product, or a
  // card that already carries a short name - is not a migrated address.
  const addresses = [];
  for (const candidate of planned) {
    addresses.push({
      oldPath: detailPath(candidate.kind, candidate.currentSlug),
      newPath: detailPath(candidate.kind, candidate.targetSlug),
      page: candidate.page,
      label: candidate.label
    });
  }
  for (const card of wallCards) {
    if (!card.currentAliases.length) continue;
    const owner = planned.some((candidate) => candidate.page === card.page && candidate.jsonPath === card.jsonPath);
    if (owner) continue;
    // An already migrated card: its aliases are the retired addresses.
    for (const alias of card.currentAliases) {
      if (alias === card.currentSlug) continue;
      addresses.push({
        oldPath: detailPath(card.kind, alias),
        newPath: detailPath(card.kind, card.currentSlug),
        page: card.page,
        label: card.label
      });
    }
  }
  addresses.sort((a, b) => a.oldPath.localeCompare(b.oldPath));

  const pages = [];
  for (const candidate of planned) {
    const row = bySlug.get(candidate.page);
    let page = pages.find((entry) => entry.slug === candidate.page);
    if (!page) {
      page = {
        id: row.id,
        slug: row.slug,
        title: row.title,
        pageType: row.pageType,
        templateKey: row.templateKey,
        baseHash: hash({
          id: row.id,
          siteId: row.siteId,
          slug: row.slug,
          title: row.title,
          pageType: row.pageType,
          templateKey: row.templateKey,
          contentJson: row.contentJson,
          updatedAt: row.updatedAt
        }),
        cards: []
      };
      pages.push(page);
    }
    page.cards.push({
      jsonPath: candidate.jsonPath,
      source: "picker",
      kind: candidate.kind,
      label: candidate.label,
      imageSrc: candidate.imageSrc,
      beforeSlug: candidate.currentSlug,
      afterSlug: candidate.targetSlug,
      beforeAliases: candidate.currentAliases.length ? candidate.currentAliases : null,
      afterAliases: candidate.afterAliases,
      oldPath: detailPath(candidate.kind, candidate.currentSlug),
      newPath: detailPath(candidate.kind, candidate.targetSlug),
      labelDrift: candidate.targetSlug !== candidate.baseSlug
    });
  }
  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  skipped.sort((a, b) => `${a.page}${a.jsonPath}`.localeCompare(`${b.page}${b.jsonPath}`));

  const body = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    canonicalWall: CANONICAL_WALL,
    pages,
    skipped,
    addresses
  };
  const manifest = {
    ok: problems.length === 0,
    mode: "plan",
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    canonicalWall: CANONICAL_WALL,
    generatedAt: new Date().toISOString(),
    owner: "LivePage.contentJson",
    rules: {
      publishedWalls: WALLS,
      canonicalWall: CANONICAL_WALL,
      slugRule: "slugify(card.label), or the product part of the retired slug when the stored label drifted",
      aliasRule: "the replaced long slug becomes a publicAliases entry of the same card",
      ownership: "one slug is owned by one page; the second wall keeps its own address",
      rollback: "the manifest is the field-level inverse: beforeSlug and beforeAliases restore the retired address"
    },
    summary: {
      livePageRowsScanned: rows.length,
      publishedWallCards: wallCards.length,
      plannedCards: pages.reduce((total, page) => total + page.cards.length, 0),
      plannedPages: pages.length,
      skippedCards: skipped.length,
      problems: problems.length
    },
    problems,
    pages,
    skipped,
    addresses,
    planHash: hash(body)
  };

  if (writeManifest) {
    assert(problems.length === 0, `Refusing to write a manifest with ${problems.length} problem(s):\n${problems.join("\n")}`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify({
    ok: manifest.ok,
    mode: "plan",
    target,
    siteId: SITE_ID,
    summary: manifest.summary,
    problems,
    planned: planned.map((candidate) => ({
      page: candidate.page,
      label: candidate.label,
      from: candidate.currentSlug,
      to: candidate.targetSlug,
      labelDrift: candidate.targetSlug !== candidate.baseSlug
    })),
    skipped,
    planHash: manifest.planHash,
    manifest: writeManifest ? path.relative(process.cwd(), outPath) : null
  }, null, 2));
  if (problems.length) process.exitCode = 1;
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
