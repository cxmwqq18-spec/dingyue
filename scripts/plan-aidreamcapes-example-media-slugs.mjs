#!/usr/bin/env node
// Field-level plan for the AIVideosUGC / site_aidreamcapes media cards that have
// no `publicSlug` yet.
//
// Scope (2026-10-21): 18 `visual.picker.cards[*]` entries carrying the
// `example` chip, 30 `data.examples.groups[*].items[*]` gallery entries and the
// 18 `data.templateDefinition.card` entries the template pages render in their
// picker. Those three shapes are the only cards the public renderer still
// sends to a preset/tool link instead of a media detail page
// (`/ai-image-generation/<slug>` or `/ai-video-generation/<slug>`).
//
// A template definition card and the picker card next to it are the same media
// (same image, same label), so both name the same detail page and share one
// slug.
//
// This script only reads the relational rows and writes the reviewable
// manifest. It never writes the database. Run
// `scripts/apply-aidreamcapes-example-media-slugs.mjs` to apply the manifest
// with compare-and-set.
//
// Slug rules: `base = <pageSlugLeaf>-<slugify(cardLabel)>`, lowercase
// `[a-z0-9-]`, at most 80 characters, unique against every existing card
// `publicSlug` of the site, every `LivePage.slug` path and every slug planned
// in the same run. Collisions get `-2`, `-3`, ... and are recorded.
//
// The two directory root pages (`/ai-image-generation`, `/ai-video-generation`)
// own the directory name already, so their base is `slugify(cardLabel)` with no
// repeated leaf (`/ai-video-generation` + "Bottle Ad With a Person" ->
// `bottle-ad-with-a-person`). Every other page keeps its own leaf as prefix
// (`/ai-image-generation/ugc-still-ad` + "Creator-Style Photo" ->
// `ugc-still-ad-creator-style-photo`).
//
// Usage:
//   node scripts/plan-aidreamcapes-example-media-slugs.mjs
//   node scripts/plan-aidreamcapes-example-media-slugs.mjs --target=local
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget } from "./lib/database-target.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultManifestPath = path.join(here, "manifests", "aidreamcapes-example-media-slugs-2026-10-21.json");
// `--manifest=<path>` keeps the reviewed production plan next to the local one
// instead of overwriting it.
const manifestPath = (() => {
  const requested = argumentValue("--manifest");
  if (!requested) return defaultManifestPath;
  return path.isAbsolute(requested) ? requested : path.resolve(process.cwd(), requested);
})();
const CONTRACT = "aidreamcapes-example-media-slugs-2026-10-21-v1";
const SITE_ID = "site_aidreamcapes";
const EXPECTED = { picker: 18, examples: 30, definition: 18 };
const SLUG_MAX = 80;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FAMILY = { photo: "ai-image-generation", video: "ai-video-generation" };
const ROOT_LEAVES = new Set([FAMILY.photo, FAMILY.video]);
const EXAMPLE_CHIP = "example";

const siteId = assertAllowedSite(SITE_ID);
assert.equal(siteId, SITE_ID, "This manifest is scoped to site_aidreamcapes only.");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
assert(new Set(["local", "production"]).has(target), "Use --target=local or --target=production.");
assertDatabaseTarget({ expectedTarget: target });

function stable(value) {
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
function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function pageSlugLeaf(slug) {
  return String(slug).split("/").filter(Boolean).pop() ?? "";
}
function detailPath(kind, slug) {
  return `/${FAMILY[kind]}/${slug}`;
}
/** Keeps a base slug within the 80 character ceiling, including its suffix. */
function capSlug(base, suffixLength = 0) {
  const limit = SLUG_MAX - suffixLength;
  if (base.length <= limit) return base;
  return base.slice(0, limit).replace(/-+$/g, "");
}

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await db.livePage.findMany({
    where: { siteId },
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
  assert(rows.length > 0, `No LivePage rows for ${siteId}.`);

  /** Every card of the four public shapes with its slug, in page order. */
  const cardsWithSlugs = (contentJson) => {
    const found = [];
    const content = record(contentJson) ?? {};
    const sections = record(content.sections) ?? {};
    const order = Array.isArray(content.sectionsOrder) && content.sectionsOrder.length
      ? content.sectionsOrder
      : Object.keys(sections);
    for (const sectionId of order) {
      const section = record(sections[sectionId]);
      if (!section || section.type !== "aidreamcapes_v2_page") continue;
      const data = record(record(section.settings)?.data);
      if (!data) continue;
      const push = (value) => {
        const card = record(value);
        const slug = typeof card?.publicSlug === "string" ? card.publicSlug.trim() : "";
        if (card && slug) found.push([slug, card]);
      };
      const pickerCards = record(record(data.visual)?.picker)?.cards;
      if (Array.isArray(pickerCards)) pickerCards.forEach(push);
      if (Array.isArray(data.workspaceCases)) data.workspaceCases.forEach(push);
      const groups = record(data.examples)?.groups;
      if (Array.isArray(groups)) {
        for (const group of groups) {
          const items = record(group)?.items;
          if (Array.isArray(items)) items.forEach(push);
        }
      }
      const definition = record(record(data.templateDefinition)?.card);
      if (definition) push(definition);
    }
    return found;
  };

  // ---- Uniqueness domain --------------------------------------------------
  const existingCardSlugs = new Set();
  const livePageSlugs = new Set();
  let cardSlugValues = 0;
  const collectCardSlugs = (value) => {
    if (Array.isArray(value)) {
      value.forEach(collectCardSlugs);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "publicSlug" && typeof child === "string" && child.trim()) {
        cardSlugValues += 1;
        existingCardSlugs.add(child.trim());
      } else collectCardSlugs(child);
    }
  };
  for (const row of rows) {
    livePageSlugs.add(row.slug);
    collectCardSlugs(row.contentJson);
  }
  // A slug value belongs to exactly one media item. Two card shapes of the same
  // page may carry the same slug when they are the same media (a template
  // definition card and the picker card beside it). The same slug on two
  // different media, or on two pages, would make the detail address ambiguous
  // and is rejected here.
  const sharedMediaPairs = [];
  const slugOwners = new Map();
  for (const row of rows) {
    const perPage = new Map();
    for (const [slug, card] of cardsWithSlugs(row.contentJson)) {
      const imageSrc = String(record(card.image)?.src ?? "");
      const owner = slugOwners.get(slug);
      assert(!owner || owner.page === row.slug, `Slug ${slug} is used on two pages (${owner?.page} and ${row.slug}).`);
      slugOwners.set(slug, { page: row.slug, imageSrc: owner?.imageSrc ?? imageSrc });
      const previous = perPage.get(slug);
      if (previous === undefined) {
        perPage.set(slug, imageSrc);
        continue;
      }
      assert(previous === imageSrc, `Slug ${slug} is used by two different media on ${row.slug}.`);
      sharedMediaPairs.push({ page: row.slug, slug, imageSrc });
    }
  }
  assert.equal(
    cardSlugValues - existingCardSlugs.size,
    sharedMediaPairs.length,
    "Card publicSlug values are not distinct; review the uniqueness domain before planning."
  );

  // ---- Previous review (for the applied / superseded distinction) ---------
  // A card that already carries the slug this manifest planned is "applied".
  // A card that carries the exact slug a previous revision of this manifest
  // planned may be superseded by a corrected slug. Any other non-empty value is
  // an online edit and aborts the plan.
  const previous = new Map();
  const history = [];
  const rememberPrevious = (key, value) => {
    if (typeof value !== "string" || !value) return;
    const values = previous.get(key) ?? new Set();
    values.add(value);
    previous.set(key, values);
  };
  if (fs.existsSync(manifestPath)) {
    try {
      const previousManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (previousManifest?.contract === CONTRACT) {
        for (const entry of previousManifest.history ?? []) history.push(entry);
        for (const page of previousManifest.pages ?? []) {
          for (const card of page.cards ?? []) {
            const key = `${page.id}::${card.jsonPath}`;
            // Both values this artifact planned and values it recorded as
            // superseded belong to this operation, not to an online editor.
            rememberPrevious(key, card.publicSlug);
            rememberPrevious(key, card.supersedes);
          }
        }
      }
    } catch {
      // An unreadable previous manifest cannot authorise a correction; the
      // cards then have to match this plan exactly.
    }
  }

  // ---- Inventory ----------------------------------------------------------
  const planned = [];
  for (const row of rows) {
    const content = record(row.contentJson) ?? {};
    const sections = record(content.sections) ?? {};
    const order = Array.isArray(content.sectionsOrder) && content.sectionsOrder.length
      ? content.sectionsOrder
      : Object.keys(sections);
    const cards = [];
    for (const sectionId of order) {
      const section = record(sections[sectionId]);
      if (!section || section.type !== "aidreamcapes_v2_page") continue;
      const data = record(record(section.settings)?.data);
      if (!data) continue;

      const pickerCards = record(record(data.visual)?.picker)?.cards;
      if (Array.isArray(pickerCards)) {
        pickerCards.forEach((value, index) => {
          const card = record(value);
          if (!card) return;
          const chips = Array.isArray(card.chips) ? card.chips.map(String) : [];
          if (!chips.includes(EXAMPLE_CHIP)) return;
          cards.push({
            source: "picker",
            jsonPath: `sections.${sectionId}.settings.data.visual.picker.cards[${index}]`,
            kind: card.kind === "video" ? "video" : card.kind === "photo" ? "photo" : undefined,
            label: String(card.label ?? ""),
            storedLabel: String(card.label ?? ""),
            labelSource: "card",
            imageSrc: String(record(card.image)?.src ?? ""),
            current: typeof card.publicSlug === "string" ? card.publicSlug.trim() : ""
          });
        });
      }

      const definition = record(record(data.templateDefinition)?.card);
      if (definition) {
        // A template page renders this card in its own picker, so it needs the
        // same detail slug as the picker card next to it.
        cards.push({
          source: "definition",
          jsonPath: `sections.${sectionId}.settings.data.templateDefinition.card`,
          kind: definition.kind === "video" ? "video" : definition.kind === "photo" ? "photo" : undefined,
          label: String(definition.label ?? ""),
          storedLabel: String(definition.label ?? ""),
          labelSource: "card",
          imageSrc: String(record(definition.image)?.src ?? ""),
          current: typeof definition.publicSlug === "string" ? definition.publicSlug.trim() : ""
        });
      }

      const groups = record(data.examples)?.groups;
      if (Array.isArray(groups)) {
        // The video hub renders one row with the group name as the card title
        // (`oneRowWhenSingles` in page.tsx) when every group holds one item, so
        // that is the label a visitor actually clicks.
        const oneRowTitles = data.id === "video-hub"
          && Boolean(data.visual)
          && groups.length > 0
          && groups.every((groupValue) => Array.isArray(record(groupValue)?.items) && record(groupValue).items.length === 1);
        groups.forEach((groupValue, groupIndex) => {
          const group = record(groupValue);
          const items = group?.items;
          if (!Array.isArray(items)) return;
          items.forEach((value, itemIndex) => {
            const item = record(value);
            if (!item) return;
            const groupLabel = String(group?.label ?? "").trim();
            const useGroupLabel = oneRowTitles && Boolean(groupLabel);
            cards.push({
              source: "examples",
              jsonPath: `sections.${sectionId}.settings.data.examples.groups[${groupIndex}].items[${itemIndex}]`,
              kind: item.kind === "clip" ? "video" : "photo",
              label: useGroupLabel ? groupLabel : String(item.title ?? ""),
              storedLabel: String(item.title ?? ""),
              labelSource: useGroupLabel ? "group" : "item",
              imageSrc: String(record(item.image)?.src ?? ""),
              current: typeof item.publicSlug === "string" ? item.publicSlug.trim() : ""
            });
          });
        });
      }
    }
    if (!cards.length) continue;
    planned.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      baseHash: hash(row),
      updatedAt: row.updatedAt.toISOString(),
      cards
    });
  }

  // ---- Deterministic slug assignment -------------------------------------
  const used = new Set(existingCardSlugs);
  const collisions = [];
  const assignmentProblems = [];
  for (const page of planned) {
    const rawLeaf = slugify(pageSlugLeaf(page.slug));
    const leaf = ROOT_LEAVES.has(rawLeaf) ? "" : rawLeaf;
    for (const card of page.cards) {
      assert(card.kind, `Card ${page.slug} ${card.jsonPath} has an unknown kind.`);
      assert(card.label.trim(), `Card ${page.slug} ${card.jsonPath} has no label.`);
      assert(card.imageSrc, `Card ${page.slug} ${card.jsonPath} has no image.src.`);
      const plannedBefore = previous.get(`${page.id}::${card.jsonPath}`);
      if (card.current && !plannedBefore?.has(card.current)) {
        // Online edits win. A value this manifest never planned is never touched.
        assignmentProblems.push({
          page: page.slug,
          jsonPath: card.jsonPath,
          reason: `card already carries publicSlug "${card.current}", which this manifest never planned; online edit wins`
        });
        continue;
      }
      const base = capSlug([leaf, slugify(card.label)].filter(Boolean).join("-"));
      if (!base || !SLUG_RE.test(base)) {
        assignmentProblems.push({ page: page.slug, jsonPath: card.jsonPath, reason: `label "${card.label}" does not slugify` });
        continue;
      }
      // A template definition card and the picker card beside it are the same
      // media. Both must name the same detail page, so the definition card
      // reuses its sibling's slug instead of claiming a second address.
      const sibling = page.cards.find((candidate) => candidate !== card
        && candidate.imageSrc === card.imageSrc
        && candidate.kind === card.kind
        && candidate.publicSlug);
      if (sibling) {
        card.publicSlug = sibling.publicSlug;
        card.pageSlug = page.slug;
        card.detailPath = detailPath(card.kind, card.publicSlug);
        card.sharesSlugWith = sibling.jsonPath;
        card.state = !card.current ? "new" : card.current === card.publicSlug ? "applied" : "superseded";
        if (card.state === "superseded") {
          card.supersedes = card.current;
          history.push({
            page: page.slug,
            jsonPath: card.jsonPath,
            label: card.label,
            from: card.current,
            to: card.publicSlug,
            reason: "slug shared with the template picker card that renders the same media"
          });
        }
        continue;
      }
      // The card's own current value (written by an earlier revision of this
      // manifest) is not a foreign collision; free it before choosing the slug.
      if (card.current) used.delete(card.current);
      let slug = base;
      let suffix = 1;
      const clash = () => used.has(slug) || livePageSlugs.has(detailPath(card.kind, slug));
      while (clash()) {
        suffix += 1;
        slug = `${capSlug(base, String(suffix).length + 1)}-${suffix}`;
        if (suffix > 50) break;
      }
      if (suffix > 1) {
        const reason = used.has(base)
          ? "existing card publicSlug"
          : livePageSlugs.has(detailPath(card.kind, base))
            ? "existing LivePage slug path"
            : "slug planned earlier in this run";
        collisions.push({ page: page.slug, label: card.label, base, slug, suffix, reason });
      }
      used.add(slug);
      card.publicSlug = slug;
      card.pageSlug = page.slug;
      card.detailPath = detailPath(card.kind, slug);
      card.state = !card.current ? "new" : card.current === slug ? "applied" : "superseded";
      if (card.state === "superseded") {
        card.supersedes = card.current;
        history.push({
          page: page.slug,
          jsonPath: card.jsonPath,
          label: card.label,
          from: card.current,
          to: slug,
          reason: "slug recomputed from the rendered card label after review"
        });
      }
    }
  }
  if (assignmentProblems.length) {
    console.error(JSON.stringify({ ok: false, mode: "plan", siteId, problems: assignmentProblems }, null, 2));
    process.exitCode = 1;
  }

  const manifestPages = planned.map((page) => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
    baseHash: page.baseHash,
    updatedAt: page.updatedAt,
    cards: page.cards.map((card) => ({
      source: card.source,
      jsonPath: card.jsonPath,
      kind: card.kind,
      label: card.label,
      storedLabel: card.storedLabel,
      labelSource: card.labelSource,
      imageSrc: card.imageSrc,
      publicSlug: card.publicSlug,
      detailPath: card.detailPath,
      state: card.state,
      ...(card.sharesSlugWith ? { sharesSlugWith: card.sharesSlugWith } : {}),
      ...(card.supersedes ? { supersedes: card.supersedes } : {})
    }))
  }));

  const manifest = {
    siteId,
    contract: CONTRACT,
    // The database this plan was reviewed against. It may only be applied to
    // the same target.
    target,
    routeFamilies: FAMILY,
    slugRules: {
      base: "<pageSlugLeaf>-<slugify(cardLabel)>, leaf omitted on /ai-image-generation and /ai-video-generation",
      cardLabel: "picker: card.label; gallery: item.title, or the group label when the video hub renders one row of single-item groups",
      pattern: SLUG_RE.source,
      maxLength: SLUG_MAX,
      uniqueAgainst: ["existing card publicSlug values", "LivePage.slug paths", "slugs planned in this run"],
      collisionSuffix: "-2, -3, ...",
      supersede: "a card may only replace a value this manifest planned earlier; any other non-empty publicSlug aborts the plan"
    },
    baseHashScheme: "sha256(stableJSON({id, siteId, slug, title, pageType, templateKey, contentJson, updatedAt}))",
    uniquenessDomain: { existingCardSlugs: existingCardSlugs.size, livePageSlugs: livePageSlugs.size },
    expected: EXPECTED,
    collisions,
    history,
    planHash: hash(manifestPages),
    pages: manifestPages
  };

  const cards = planned.flatMap((page) => page.cards);
  const totals = {
    pages: planned.length,
    cards: cards.length,
    picker: cards.filter((card) => card.source === "picker").length,
    examples: cards.filter((card) => card.source === "examples").length,
    definition: cards.filter((card) => card.source === "definition").length,
    photo: cards.filter((card) => card.kind === "photo").length,
    video: cards.filter((card) => card.kind === "video").length,
    new: cards.filter((card) => card.state === "new").length,
    applied: cards.filter((card) => card.state === "applied").length,
    superseded: cards.filter((card) => card.state === "superseded").length,
    collisions: collisions.length
  };

  let manifestWritten = false;
  if (cards.length && assignmentProblems.length === 0) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    manifestWritten = true;
  }

  const result = {
    ok: assignmentProblems.length === 0,
    mode: "plan",
    target,
    siteId,
    contract: CONTRACT,
    database: { host: "127.0.0.1:15433/dingyue_local", livePages: rows.length, existingCardSlugs: existingCardSlugs.size },
    manifestPath: path.relative(process.cwd(), manifestPath),
    manifestWritten,
    planHash: manifest.planHash,
    matchesExpectation: totals.picker === EXPECTED.picker && totals.examples === EXPECTED.examples,
    totals,
    collisions,
    pages: planned.map((page) => ({ slug: page.slug, baseHash: page.baseHash, cards: page.cards.length })),
    assignments: cards.map((card) => ({
      detailPath: card.detailPath,
      page: card.pageSlug,
      source: card.source,
      label: card.label,
      publicSlug: card.publicSlug,
      state: card.state,
      ...(card.supersedes ? { supersedes: card.supersedes } : {})
    }))
  };
  // Keep the assignment table readable: one compact line per card.
  for (const entry of result.assignments) {
    const note = entry.supersedes ? `  (supersedes ${entry.supersedes})` : "";
    console.log(`${entry.detailPath}  <-  ${entry.page}  [${entry.source}|${entry.state}]  "${entry.label}"${note}`);
  }
  delete result.assignments;
  console.log(JSON.stringify(result, null, 2));
} finally {
  await db.$disconnect();
}
