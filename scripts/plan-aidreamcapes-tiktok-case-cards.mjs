#!/usr/bin/env node
// Field-level plan (v2) for the AIVideosUGC / site_aidreamcapes TikTok case
// cards (2026-10-28 import, 45 items).
//
// v1 appended all 45 cards to `visual.picker.cards` of their assigned page.
// Production verification showed the renderer only surfaces picker cards on
// `layout: "tool"` pages whose `blockOrder` contains the "picker" block, and
// `template` pages replace their picker with the page's own template card
// (`resolveTemplateCardLinks`). v2 therefore plans, per assigned page:
//
//   * `layout: "tool"` pages without "picker" in `blockOrder`:
//       insert "picker" after "hero" so the appended cards render.
//   * `layout: "template"` pages (their picker always shows the template's
//       own card only): move the appended cards out of the picker into a new
//       `data.examples` gallery group and insert the "examples" block after
//       "picker". Every card keeps exactly one owner on the page, so each
//       detail page keeps exactly one owner.
//   * `layout: "tool"` pages that already render their picker: no change.
//
// This script only reads the relational rows and writes the reviewable plan
// manifest. It never writes the database. Run
// `scripts/apply-aidreamcapes-tiktok-case-cards.mjs` to apply with
// compare-and-set.
//
// Usage:
//   node scripts/plan-aidreamcapes-tiktok-case-cards.mjs --target=local
//   node scripts/plan-aidreamcapes-tiktok-case-cards.mjs --target=production
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget } from "./lib/database-target.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, "manifests", "aidreamcapes-tiktok-case-cards-source-2026-10-28.json");
const CONTRACT = "aidreamcapes-tiktok-case-cards-2026-10-28-v2";
const SITE_ID = "site_aidreamcapes";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MEDIA_RE = /^\/(ai-image-generation|ai-video-generation)\/[a-z0-9][a-z0-9.-]*\.(?:mp4|webp)$/;
const PLACEMENT_RE = /^\/(industries|platforms|occasions)\/[a-z0-9][a-z0-9-]*$/;
const PICKER_PATH = ["sections", "v2_main", "settings", "data", "visual", "picker", "cards"];

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
assert(new Set(["local", "production"]).has(target), "Use --target=local or --target=production.");
assertDatabaseTarget({ expectedTarget: target });
const manifestPath = (() => {
  const requested = argumentValue("--manifest");
  if (requested) return path.isAbsolute(requested) ? requested : path.resolve(process.cwd(), requested);
  return path.join(here, "manifests", `aidreamcapes-tiktok-case-cards-${target}-2026-10-28.json`);
})();

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
assert.equal(source.contract, "aidreamcapes-tiktok-case-cards-2026-10-28-v1", "Source manifest contract mismatch.");
assert.equal(source.siteId, SITE_ID, "Source manifest is scoped to site_aidreamcapes only.");
assert.equal(assertAllowedSite(source.siteId), SITE_ID);
assert(Array.isArray(source.items) && source.items.length === 45, "Source manifest must list exactly 45 items.");

// ---- validate the source before touching the database ----------------------
const seenSlugs = new Set();
for (const item of source.items) {
  const rank = item.rank;
  assert(Number.isInteger(rank), `item ${rank}: rank must be an integer`);
  assert(SLUG_RE.test(item.slug) && item.slug.length <= 80, `item ${rank}: invalid slug ${item.slug}`);
  assert(!seenSlugs.has(item.slug), `item ${rank}: duplicate slug ${item.slug}`);
  seenSlugs.add(item.slug);
  assert(typeof item.label === "string" && item.label.trim().length <= 120, `item ${rank}: label`);
  assert(typeof item.prompt === "string" && item.prompt.trim().length > 40, `item ${rank}: prompt`);
  assert(item.aspect === "9:16", `item ${rank}: aspect`);
  assert(Number.isInteger(item.duration) && item.duration > 0 && item.duration <= 120, `item ${rank}: duration`);
  assert(typeof item.toolPath === "string" && item.toolPath.startsWith("/ai-video-generation/"), `item ${rank}: toolPath`);
  assert(MEDIA_RE.test(item.videoSrc) && item.videoSrc.endsWith(`${item.slug}.mp4`), `item ${rank}: videoSrc`);
  assert(MEDIA_RE.test(item.posterSrc) && item.posterSrc.endsWith(`${item.slug}-640.webp`), `item ${rank}: posterSrc`);
  for (const key of ["videoWidth", "videoHeight", "posterWidth", "posterHeight"]) {
    assert(Number.isInteger(item[key]) && item[key] > 0, `item ${rank}: ${key}`);
  }
  assert(Array.isArray(item.placement) && item.placement.length >= 1, `item ${rank}: placement`);
  for (const facet of item.placement) assert(PLACEMENT_RE.test(facet), `item ${rank}: facet ${facet}`);
}

/** Picker card shape as appended by the v1 run (kept for reference/validation). */
function pickerCardFor(item) {
  return {
    href: `/ai-video-generation/${item.slug}`,
    kind: "video",
    chips: ["example"],
    image: { src: item.posterSrc, alt: item.alt, w: item.posterWidth, h: item.posterHeight, kind: "video" },
    label: item.label,
    line: item.line,
    aspect: item.aspect,
    prompt: item.prompt,
    duration: item.duration,
    publicSlug: item.slug,
    video: { src: item.videoSrc, poster: { src: item.posterSrc, alt: item.alt }, width: item.videoWidth, height: item.videoHeight },
    referenceImages: [{ src: item.posterSrc, alt: item.alt }],
    placement: [...item.placement].sort()
  };
}

/** Example-gallery item shape (V2Example) with the detail-card fields included. */
function exampleItemFor(item) {
  return {
    key: `tiktok45-${item.rank}`,
    href: `/ai-video-generation/${item.slug}`,
    kind: "clip",
    title: item.label,
    image: { src: item.posterSrc, alt: item.alt, width: item.posterWidth, height: item.posterHeight, w: item.posterWidth, h: item.posterHeight },
    prompt: item.prompt,
    line: item.line,
    aspect: item.aspect,
    duration: item.duration,
    publicSlug: item.slug,
    video: { src: item.videoSrc, name: item.alt, poster: { src: item.posterSrc, alt: item.alt }, width: item.videoWidth, height: item.videoHeight },
    referenceImages: [{ src: item.posterSrc, alt: item.alt }],
    placement: [...item.placement].sort()
  };
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
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
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
function collectCardSlugs(value, into = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((child) => collectCardSlugs(child, into));
    return into;
  }
  if (!value || typeof value !== "object") return into;
  for (const [key, child] of Object.entries(value)) {
    if (key === "publicSlug" && typeof child === "string" && child.trim()) into.add(child.trim());
    else collectCardSlugs(child, into);
  }
  return into;
}
function sectionSettings(contentJson) {
  return record(record(contentJson)?.sections?.v2_main?.settings);
}
function sectionData(contentJson) {
  return record(sectionSettings(contentJson)?.data);
}

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert(rows.length > 0, `No LivePage rows for ${SITE_ID}.`);
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const grouped = new Map();
  for (const item of source.items) {
    const list = grouped.get(item.toolPath) ?? [];
    list.push(item);
    grouped.set(item.toolPath, list);
  }

  const pages = [];
  const problems = [];
  for (const [toolPath, items] of [...grouped.entries()].sort()) {
    const row = bySlug.get(toolPath);
    if (!row) {
      problems.push({ page: toolPath, reason: "assigned LivePage row is missing" });
      continue;
    }
    const data = sectionData(row.contentJson);
    if (!data) {
      problems.push({ page: toolPath, reason: "v2_main section data is missing" });
      continue;
    }
    const layout = typeof sectionSettings(row.contentJson)?.layout === "string" ? sectionSettings(row.contentJson).layout : "";
    const blockOrder = Array.isArray(data.blockOrder) ? data.blockOrder.map(String) : undefined;
    const pickerCards = (() => {
      let node = row.contentJson;
      for (const step of PICKER_PATH) node = record(node)?.[step];
      return Array.isArray(node) ? node : [];
    })();
    const slugs = items.map((item) => item.slug);
    const ops = [];

    if (layout === "tool") {
      // The v1 run already appended these cards to the picker. Keep them
      // there and make the picker render by inserting the block.
      const missing = slugs.filter((slug) => !pickerCards.some((card) => card?.publicSlug === slug));
      if (missing.length) {
        problems.push({ page: toolPath, reason: `picker cards not found (apply v1 first): ${missing.join(", ")}` });
        continue;
      }
      if (!blockOrder) {
        problems.push({ page: toolPath, reason: "tool page has no blockOrder to insert the picker block into" });
        continue;
      }
      if (!blockOrder.includes("picker")) {
        if (!blockOrder.includes("hero")) {
          problems.push({ page: toolPath, reason: "blockOrder has no hero anchor for the picker block" });
          continue;
        }
        ops.push({ op: "blockOrderInsert", after: "hero", value: "picker" });
      }
    } else if (layout === "template") {
      // Template pages replace their picker with the page's own template
      // card, so the appended cards must move into the examples gallery.
      const inPicker = pickerCards.filter((card) => slugs.includes(card?.publicSlug));
      if (inPicker.length !== items.length) {
        problems.push({ page: toolPath, reason: `expected ${items.length} appended picker cards to move, found ${inPicker.length}` });
        continue;
      }
      const definition = record(data.templateDefinition);
      const templateCard = record(definition?.card);
      if (!templateCard) {
        problems.push({ page: toolPath, reason: "template page has no templateDefinition.card to restore" });
        continue;
      }
      ops.push({ op: "pickerRemoveSlugs", slugs, remainingCount: pickerCards.length - inPicker.length });
      if (record(data.examples)) {
        problems.push({ page: toolPath, reason: "page already has data.examples; refusing to merge automatically" });
        continue;
      }
      ops.push({
        op: "examplesEnsure",
        h2: `More ${data.label} video examples`,
        groupLabel: "",
        items: items.map(exampleItemFor)
      });
      if (!blockOrder) {
        problems.push({ page: toolPath, reason: "template page has no blockOrder to insert the examples block into" });
        continue;
      }
      if (!blockOrder.includes("examples")) {
        if (!blockOrder.includes("picker")) {
          problems.push({ page: toolPath, reason: "blockOrder has no picker anchor for the examples block" });
          continue;
        }
        ops.push({ op: "blockOrderInsert", after: "picker", value: "examples" });
      }
    } else {
      problems.push({ page: toolPath, reason: `unsupported layout "${layout}" for the TikTok case cards` });
      continue;
    }

    pages.push({ id: row.id, slug: row.slug, layout, baseHash: pageHash(row), ops });
  }

  assert.equal(problems.length, 0, `Plan problems: ${JSON.stringify(problems)}`);
  const plannedPages = pages.filter((page) => page.ops.length);
  const ownerBySlug = new Map();
  for (const item of source.items) ownerBySlug.set(item.slug, item.toolPath);
  const slugOwnerPages = new Map();
  for (const row of rows) {
    for (const slug of collectCardSlugs(row.contentJson)) {
      const owners = slugOwnerPages.get(slug) ?? new Set();
      owners.add(row.slug);
      slugOwnerPages.set(slug, owners);
    }
  }
  for (const [slug, owners] of slugOwnerPages) {
    if (!ownerBySlug.has(slug)) continue;
    const expected = ownerBySlug.get(slug);
    if (owners.size !== 1 || !owners.has(expected)) {
      problems.push({ slug, reason: `slug must be owned only by ${expected}, found ${[...owners].join(", ") || "nothing"}` });
    }
  }
  assert.equal(problems.length, 0, `Plan problems: ${JSON.stringify(problems)}`);

  const sourceHash = hash(JSON.parse(fs.readFileSync(sourcePath, "utf8")));
  const planHash = hash({ contract: CONTRACT, siteId: SITE_ID, target, sourceHash, pages: plannedPages.map(({ id, slug, layout, baseHash, ops }) => ({ id, slug, layout, baseHash, ops })) });
  const manifest = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    createdAt: new Date().toISOString(),
    sourceFile: path.basename(sourcePath),
    sourceHash,
    planHash,
    summary: Object.fromEntries(pages.map((page) => [page.slug, { layout: page.layout, ops: page.ops.map((op) => op.op) }])),
    pages: plannedPages
  };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(JSON.stringify({
    ok: true,
    mode: "plan",
    target,
    manifestPath,
    planHash,
    pages: pages.map((page) => ({ slug: page.slug, layout: page.layout, ops: page.ops.map((op) => op.op) })),
    pagesPlanned: plannedPages.length
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, siteId: SITE_ID, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
