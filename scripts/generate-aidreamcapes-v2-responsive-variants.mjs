#!/usr/bin/env node
// Controlled responsive-variant pilot for the AIVideosUGC storefront
// (site_aidreamcapes, https://www.aivideosugc.com).
//
// Scope is deliberately small. Only the pages that carry the storefront's
// first-screen pictures are read, and only their own image records are used:
//
//   /                     the homepage first screen and its product-scene cards
//   /ai-video-generation  the video hub hero and its tool cards
//   /ai-image-generation  the photo hub hero and its example cards
//   /ai-actors            the actor directory cards
//
// The script never reads or writes another storefront. It reads the published
// `LivePage.contentJson` of those four rows, derives the picture list from the
// stored data, and writes width variants next to the source media:
//
//   public/<folder>/_responsive/<name>--<width>.webp
//
// The generated index describes the variants and is written next to the code
// that reads it:
//
//   src/lib/aidreamcapes-v2-responsive-image-manifest.json
//
// Neither the variants nor the index belong in Git: the media tree is
// provisioned outside the repository, and a committed index would point at
// files a deployment does not have.
//
// Usage:
//   node scripts/generate-aidreamcapes-v2-responsive-variants.mjs --target=local
//   node scripts/generate-aidreamcapes-v2-responsive-variants.mjs --target=local --apply
//
// Without `--apply` the script only reports what it would do.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({ expectedTarget: target });

const PUBLIC_ROOT = path.resolve("public");
const MANIFEST_PATH = path.resolve("src/lib/aidreamcapes-v2-responsive-image-manifest.json");
const TARGET_WIDTHS = [320, 640, 960];
const IMAGE_EXTENSIONS = /\.(?:jpe?g|png|webp|avif)$/i;

// The width variants are published under the storefront's own asset prefix.
// The v2 pages serve their pictures from `/ai-image-generation/...`, which the
// edge answers with a single-segment file name, so a nested folder such as
// `_responsive/` would not be served there. The shared `/assets/` tree is
// answered by the application itself, so the variants live there with the
// source folder kept underneath them.
const VARIANT_URL_PREFIX = "/assets/sites/site_aidreamcapes/v2-responsive";
// The published media lives in two folders on the release host: the edge maps
// `/ai-image-generation/actors/<file>` to `actor/` and `/ai-image-generation/<file>`
// to `image/`. A local checkout keeps the URL layout instead.
const MEDIA_FOLDER_BY_URL_PREFIX = [
  ["/ai-image-generation/actors/", "actor/"],
  ["/ai-image-generation/", "image/"]
];

const apply = hasArgument("--apply");

// The pilot pages and the image fields each of them publishes.
const PILOT_PAGES = [
  { slug: "/", label: "homepage", collect: collectHomepageImages },
  { slug: "/ai-video-generation", label: "video hub", collect: collectVideoHubImages },
  { slug: "/ai-image-generation", label: "photo hub", collect: collectPhotoHubImages },
  { slug: "/ai-actors", label: "actor directory", collect: collectActorImages }
];

// Site-wide sweep: `--site-wide-images` walks every published LivePage row of
// this site and collects every media image URL it references (photo example
// cards, directory facets, detail heroes, nav strips...). This is what puts
// the photo cards on /templates and the hub into the variant pipeline without
// hand-listing every section shape. Generated variants themselves are skipped.
const SITE_WIDE = hasArgument("--site-wide-images");
const MEDIA_URL_PREFIXES = ["/ai-image-generation/", "/ai-video-generation/", "/ai-actors/", "/assets/sites/site_aidreamcapes/"];

function collectSiteWideImages(value, out) {
  if (typeof value === "string") {
    if (
      value.startsWith("/") &&
      IMAGE_EXTENSIONS.test(value.split(/[?#]/, 1)[0] ?? "") &&
      MEDIA_URL_PREFIXES.some((prefix) => value.startsWith(prefix)) &&
      !value.startsWith(`${VARIANT_URL_PREFIX}/`)
    ) {
      out.push(value.split(/[?#]/, 1)[0]);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSiteWideImages(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectSiteWideImages(item, out);
  }
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function sectionOf(contentJson) {
  const sections = record(contentJson?.sections) ?? {};
  const order = Array.isArray(contentJson?.sectionsOrder) ? contentJson.sectionsOrder : [];
  for (const id of order) {
    const section = record(sections[id]);
    if (section?.type === "aidreamcapes_v2_page") return section;
  }
  return undefined;
}

function pageData(contentJson) {
  return record(sectionOf(contentJson)?.settings?.data) ?? {};
}

function imageSrc(value) {
  const src = record(value)?.src;
  return typeof src === "string" && src.startsWith("/") ? src.split(/[?#]/, 1)[0] : undefined;
}

function collectHomepageImages(data) {
  const sources = [];
  // The homepage first screen: the product picture and the phone picture of the
  // hero block. Both are wired to the candidate list by the v2 renderer.
  const media = record(data.homeExperience?.media) ?? {};
  for (const key of ["m01", "m02"]) {
    const src = imageSrc(media[key]);
    if (src) sources.push(src);
  }
  // The homepage product-scene cards below the first screen. The homepage
  // renders the first twenty of them, so only those are collected.
  for (const card of (data.visual?.picker?.cards ?? []).slice(0, 20)) {
    const src = imageSrc(card?.image);
    if (src) sources.push(src);
  }
  return sources;
}

function collectVideoHubImages(data) {
  const sources = [];
  for (const card of data.heroCards ?? []) {
    const src = imageSrc(card?.image);
    if (src) sources.push(src);
  }
  for (const card of data.visual?.picker?.cards ?? []) {
    const src = imageSrc(card?.image);
    if (src) sources.push(src);
  }
  return sources;
}

function collectPhotoHubImages(data) {
  const sources = [];
  for (const card of data.hero?.cards ?? []) {
    const src = imageSrc(card?.image);
    if (src) sources.push(src);
  }
  for (const group of data.examples?.groups ?? []) {
    for (const item of group?.items ?? []) {
      const src = imageSrc(item?.image);
      if (src) sources.push(src);
    }
  }
  return sources;
}

function collectActorImages(data) {
  const sources = [];
  for (const actor of data.actors ?? []) {
    const src = imageSrc(actor?.image);
    if (src) sources.push(src);
  }
  return sources;
}

/**
 * Where one published picture lives on disk. The local checkout keeps the URL
 * layout; the release host keeps the folder layout the edge maps onto.
 */
function mediaFileForUrl(url) {
  const candidates = [path.join(PUBLIC_ROOT, url.slice(1))];
  for (const [prefix, folder] of MEDIA_FOLDER_BY_URL_PREFIX) {
    if (!url.startsWith(prefix)) continue;
    candidates.push(path.join(PUBLIC_ROOT, folder, url.slice(prefix.length)));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** The published location of one width variant. */
function variantTarget(url, width) {
  const name = path.basename(url);
  const folder = url.slice(0, url.length - name.length);
  return {
    url: `${VARIANT_URL_PREFIX}${folder}${name.replace(/(\.[^.]+)$/, `--${width}$1`)}`,
    diskPath: path.join(PUBLIC_ROOT, VARIANT_URL_PREFIX.slice(1), folder, name.replace(/(\.[^.]+)$/, `--${width}$1`))
  };
}

async function main() {
  const prisma = new PrismaClient();
  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    siteId: SITE_ID,
    targetWidths: TARGET_WIDTHS,
    pages: [],
    sources: 0,
    missing: [],
    skipped: [],
    variants: 0,
    bytesOriginal: 0,
    bytesVariants: 0,
    bytesSmallestVariant: 0
  };

  try {
    const bySource = new Map();
    for (const pilot of PILOT_PAGES) {
      const row = await prisma.livePage.findUnique({
        where: { siteId_slug: { siteId: SITE_ID, slug: pilot.slug } },
        select: { slug: true, contentJson: true }
      });
      if (!row) {
        report.pages.push({ slug: pilot.slug, label: pilot.label, found: false, images: 0 });
        continue;
      }
      const data = pageData(row.contentJson);
      const sources = pilot.collect(data);
      const unique = [...new Set(sources)];
      report.pages.push({ slug: pilot.slug, label: pilot.label, found: true, images: unique.length });
      for (const source of unique) {
        if (!bySource.has(source)) bySource.set(source, []);
        bySource.get(source).push(pilot.slug);
      }
    }

    // Site-wide sweep runs before the index merge so photo cards everywhere
    // are covered in one pass.
    if (SITE_WIDE) {
      const rows = await prisma.livePage.findMany({
        where: { siteId: SITE_ID },
        select: { slug: true, contentJson: true }
      });
      const found = [];
      for (const row of rows) {
        const out = [];
        collectSiteWideImages(row.contentJson, out);
        if (out.length) found.push({ slug: row.slug, images: out.length });
        for (const source of new Set(out)) {
          if (!bySource.has(source)) bySource.set(source, []);
          bySource.get(source).push(row.slug);
        }
      }
      report.siteWide = { pages: rows.length, pagesWithImages: found.length, sources: bySource.size };
    }

    // The index is merged, not replaced: entries for other images survive a run
    // that only covers the pilot pages.
    let manifest = {};
    if (fs.existsSync(MANIFEST_PATH)) {
      try {
        manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
      } catch {
        manifest = {};
      }
    }
    for (const [source, pages] of [...bySource.entries()].sort()) {
      report.sources += 1;
      const sourcePath = mediaFileForUrl(source);
      if (!sourcePath || !IMAGE_EXTENSIONS.test(sourcePath)) {
        report.missing.push({ source, pages });
        continue;
      }
      const buffer = fs.readFileSync(sourcePath);
      const metadata = await sharp(buffer).metadata();
      const sourceWidth = metadata.width ?? 0;
      const sourceHeight = metadata.height ?? 0;
      report.bytesOriginal += buffer.length;
      if (!sourceWidth || !sourceHeight) {
        report.skipped.push({ source, reason: "no intrinsic dimensions" });
        continue;
      }
      const widths = TARGET_WIDTHS.filter((width) => width < sourceWidth);
      if (!widths.length) {
        report.skipped.push({ source, reason: `source is ${sourceWidth}px wide`, pages });
        manifest[source] = { original: source, width: sourceWidth, height: sourceHeight, variants: [] };
        continue;
      }
      const variants = [];
      for (const width of widths) {
        const target = variantTarget(source, width);
        if (apply) {
          fs.mkdirSync(path.dirname(target.diskPath), { recursive: true });
          const pipeline = sharp(sourcePath).rotate().resize({ width, fit: "inside", withoutEnlargement: true });
          const output = await pipeline.webp({ quality: 80, effort: 4, smartSubsample: true }).toFile(target.diskPath);
          report.bytesVariants += output.size;
          if (width === Math.min(...widths)) report.bytesSmallestVariant += output.size;
        }
        variants.push({ width, url: target.url });
        report.variants += 1;
      }
      manifest[source] = { original: source, width: sourceWidth, height: sourceHeight, variants };
    }

    if (apply) {
      fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
      fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
      report.manifest = MANIFEST_PATH;
    }

    // A 1x mobile visitor downloads the smallest variant instead of the source.
    report.estimate = {
      method: "sum of the source bytes of the pilot images versus the sum of the smallest generated variant bytes for the same images",
      bytesOriginal: report.bytesOriginal,
      bytesSmallestVariant: report.bytesSmallestVariant,
      savedBytes: report.bytesOriginal - report.bytesSmallestVariant,
      savedPercent: report.bytesOriginal ? Math.round(((report.bytesOriginal - report.bytesSmallestVariant) / report.bytesOriginal) * 1000) / 10 : 0
    };

    console.log(JSON.stringify(report, null, 2));
    if (report.missing.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
