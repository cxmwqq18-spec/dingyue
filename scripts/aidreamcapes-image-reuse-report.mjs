#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  analyzeSiteV2ImageReuse,
  buildSiteV2,
  imageBase,
  loadSiteV2Source,
  reusePageType
} from "./lib/aidreamcapes-site-v2-content.mjs";

const ASSET_ROOT = "/assets/sites/site_aidreamcapes/site-v2";
const ASSET_FILES_AVAILABLE = fs.existsSync(path.join(process.cwd(), "public", "assets"));
const source = loadSiteV2Source();
const build = buildSiteV2(source);
const reuse = analyzeSiteV2ImageReuse(build, source);
const selectedIds = process.argv.slice(2);
const allPageIds = new Set(build.pages.map((page) => page.id));
const unknownIds = selectedIds.filter((pageId) => !allPageIds.has(pageId));

if (unknownIds.length) {
  console.error(`Unknown Aidreamcapes page id(s): ${unknownIds.join(", ")}`);
  console.error("Usage: node scripts/aidreamcapes-image-reuse-report.mjs [page-id ...]");
  process.exit(1);
}

const selected = new Set(selectedIds);
const touchesSelected = (pages) => selected.size === 0 || pages.some((pageId) => selected.has(pageId));
const formatPages = (pages) => [...pages].sort().join(", ");
const reportViolations = reuse.violations.map((item) => {
  const actualPages = [...(reuse.actualPagesByImage.get(item.image) ?? [])].sort();
  return { ...item, actualPages };
}).filter((item) => touchesSelected(item.pages));
const duplicateViolations = reuse.samePageDuplicates.filter((item) => touchesSelected(item.pages));
const totalViolations = reportViolations.length + duplicateViolations.length;

console.log(`Image reuse violations (${totalViolations})`);
for (const item of reportViolations) {
  const rule = item.rule === "max-two-pages" ? "over 2 pages" : `same type: ${item.pageType}`;
  const logicalPages = item.pages.join(", ");
  const actualPages = formatPages(item.actualPages);
  const actualSuffix = actualPages === logicalPages ? "" : ` | rendered on ${actualPages}; target-card count on ${logicalPages}`;
  console.log(`${item.image} | pages: ${actualPages} | ${rule}${actualSuffix}`);
}
for (const item of duplicateViolations) {
  console.log(`${item.image} | pages: ${item.pages.join(", ")} | repeated on one page`);
}

const violatingPageCounts = new Map();
for (const pageId of allPageIds) violatingPageCounts.set(pageId, 0);
for (const item of [...reportViolations, ...duplicateViolations]) {
  for (const pageId of item.pages) violatingPageCounts.set(pageId, (violatingPageCounts.get(pageId) ?? 0) + 1);
}
console.log("Violations by page");
for (const page of source.master.pages) {
  if (selected.size && !selected.has(page.id)) continue;
  console.log(`${page.id}: ${violatingPageCounts.get(page.id) ?? 0}`);
}

function frameGroup(width, height) {
  const ratio = Number(width) / Number(height);
  const frames = [["1:1", 1], ["9:16", 9 / 16], ["16:9", 16 / 9], ["4:5", 4 / 5]];
  return frames.find(([, expected]) => Math.abs(ratio - expected) <= 0.035)?.[0] ?? null;
}

const imageCatalog = new Map();
function addImage(src, meta, fallbackAlt) {
  if (!src || !meta || !Number(meta.w) || !Number(meta.h)) return;
  const alt = String(meta.alt ?? fallbackAlt ?? "").trim();
  if (!alt) return;
  const frame = frameGroup(meta.w, meta.h);
  if (!frame) return;
  const candidates = [src, ...(meta._candidateVariants ?? [])];
  const available = ASSET_FILES_AVAILABLE
    ? candidates.find((candidate) => fs.existsSync(path.join(process.cwd(), "public", candidate.replace(/^\/+/, ""))))
    : (candidates[1] ?? src);
  if (!available) return;
  const variantWidth = Number(available.match(/--(\d+)\.webp(?:[?#].*)?$/)?.[1]);
  const width = variantWidth || Number(meta.w);
  const height = variantWidth ? Math.round((width * Number(meta.h)) / Number(meta.w)) : Number(meta.h);
  const base = imageBase(available);
  const current = imageCatalog.get(base);
  if (!current) imageCatalog.set(base, { src: available, width, height, alt, frame });
}

function variantPaths(dir, file, variants = []) {
  return [...variants].sort((a, b) => Number(a) - Number(b)).map((width) => `${dir}/_responsive/${file}--${width}.webp`);
}

const catalog = source.media.catalog;
for (const [key, meta] of Object.entries(catalog.site ?? {})) {
  addImage(`${ASSET_ROOT}/${key}.webp`, { ...source.images[key], alt: meta.alt });
}
for (const gallery of Object.values(catalog.galleries ?? {})) {
  for (const [file, meta] of Object.entries(gallery.items ?? {})) {
    if (file === "og" || file === "source-input") continue;
    addImage(`${gallery.dir}/${file}.webp`, { ...meta, _candidateVariants: variantPaths(gallery.dir, file, gallery.variants) });
  }
}
for (const [name, meta] of Object.entries(catalog.ugc?.items ?? {})) {
  const src = `${catalog.ugc.dir}/${meta.file}.webp`;
  addImage(src, { ...meta, _candidateVariants: variantPaths(catalog.ugc.dir, meta.file, catalog.ugc.variants) }, name);
}
for (const [name, meta] of Object.entries(catalog.frames ?? {})) {
  addImage(`${ASSET_ROOT}/frames/${name}.webp`, { ...meta, _candidateVariants: meta.variants?.map((width) => `${ASSET_ROOT}/frames/${name}--${width}.webp`) });
}
for (const [name, meta] of Object.entries(catalog.clipFrames ?? {})) {
  if (!ASSET_FILES_AVAILABLE) continue;
  const size = Number(meta.w) > Number(meta.h) ? 1280 : 540;
  addImage(`${ASSET_ROOT}/clips/${name}--${size}.webp`, { ...meta, _candidateVariants: meta.variants?.map((width) => `${ASSET_ROOT}/clips/${name}--${width}.webp`) });
}
for (const [name, meta] of Object.entries(catalog.gen ?? {})) {
  addImage(`${ASSET_ROOT}/gen/${name}.webp`, { ...meta, _candidateVariants: meta.variants?.map((width) => `${ASSET_ROOT}/gen/${name}--${width}.webp`) });
}
for (const [name, meta] of Object.entries(catalog.gen2 ?? {})) {
  const file = name.replace(/:/g, "");
  addImage(`${ASSET_ROOT}/gen2/${file}.webp`, { ...meta, _candidateVariants: meta.variants?.map((width) => `${ASSET_ROOT}/gen2/${file}--${width}.webp`) });
}
for (const [name, meta] of Object.entries(catalog.guide?.items ?? {})) {
  addImage(`${catalog.guide.dir}/${meta.file}.webp`, { ...meta, _candidateVariants: meta.variants?.map((width) => `${catalog.guide.dir}/${meta.file}--${width}.webp`) }, name);
}

const selectedTypes = new Set(selectedIds.map((pageId) => {
  const type = source.master.pages.find((page) => page.id === pageId)?.type;
  return reusePageType(type) ?? type;
}));
const freeByFrame = new Map([["1:1", []], ["9:16", []], ["16:9", []], ["4:5", []]]);
for (const image of imageCatalog.values()) {
  const usedPages = [...(reuse.countedPagesByImage.get(imageBase(image.src)) ?? [])].sort();
  if (usedPages.length > 1) continue;
  const usedPageType = usedPages.length
    ? (reusePageType(reuse.masterById.get(usedPages[0])?.type) ?? reuse.masterById.get(usedPages[0])?.type)
    : null;
  if (selectedTypes.size && usedPageType && [...selectedTypes].some((type) => type === usedPageType)) continue;
  const status = usedPages.length ? `used once: ${usedPages[0]} (${usedPageType})` : "unused";
  freeByFrame.get(image.frame).push({ ...image, status });
}

console.log("Free images (unused or assigned to one different page type)");
for (const frame of ["1:1", "9:16", "16:9", "4:5"]) {
  const images = freeByFrame.get(frame).sort((a, b) => a.src.localeCompare(b.src));
  console.log(`[${frame}] ${images.length}`);
  for (const image of images) {
    console.log(`${image.src} | ${image.width}×${image.height} | ${image.alt} | ${image.status}`);
  }
}
