#!/usr/bin/env node

import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const PUBLIC_ROOT = path.resolve("public");
const MANIFEST_PATH = path.resolve("src/lib/storefront-responsive-image-manifest.json");
const TARGET_WIDTHS = [640, 1280, 1600];
const IMAGE_EXTENSIONS = /\.(?:jpe?g|png|webp|avif)$/i;
const GENERATED_VARIANT_FILENAME = /-\d+w\.(?:jpe?g|png|webp|avif)$/i;
const EXCLUDED_PATH = /\/(?:_responsive|provider-results|originals|private|customer-assets|temp|tmp|video|videos)\//i;
const AIDREAMCAPES_RETIRED_CONTENT_PATH = /\/assets\/sites\/site_aidreamcapes\/(?:[^/]+\/)*(?:save-the-date|wedding-invitation)(?:\/|[-_])/i;
const MODEL_NAMES = [
  "livePage",
  "themePage",
  "themeSettings",
  "videoTheme",
  "videoThemeExample",
  "videoThemeCategory",
  "creativePack",
  "creativePackCategory",
  "storefrontProfile",
  "sitePublishedState"
];

const SITES = {
  "aidreamcapes-com": {
    siteId: "site_aidreamcapes",
    assetPrefix: "/assets/sites/site_aidreamcapes/"
  },
  "aidreamcapes-eu": {
    siteId: "site_aidreamcapes_xby",
    assetPrefix: "/assets/sites/site_aidreamcapes_eu/"
  },
  "aidreamshoots-eu": {
    siteId: "site_mydreamshoots_xby",
    assetPrefix: "/assets/sites/site_aidreamshoots/"
  }
};

// These four homepage video showcase posters are selected from the shared
// renderer's approved static catalogue rather than a relational media row.
// Keep them in the same responsive manifest as database-backed assets so the
// public HTML has intrinsic dimensions and can reuse generated variants.
const AIDREAMSHOOTS_STATIC_RESPONSIVE_IMAGE_URLS = [
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-other-topics-20260914-v1/cinematic-video/cinematic-video-01-create-a-more-cinematic-video-without-a-full-film-cr-84e9edc816.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-other-topics-20260914-v1/music-video/music-video-01-ai-music-video-generator-for-artist-visuals-and-perf-c12d6d69b3.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-other-topics-20260914-v1/tiktok-video/tiktok-video-01-turn-your-photos-and-ideas-into-tiktok-first-videos-7a108dbe77.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-other-topics-20260914-v1/instagram-reels/instagram-reels-01-turn-photos-and-ideas-into-reels-that-fit-your-feed-0f724d6c63.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-other-topics-20260914-v1/product-video/product-video-01-feature-led-product-showcase-3765370633.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-other-topics-20260914-v1/product-ad-video/product-ad-video-01-build-the-ad-around-one-buyer-decision-90e0edcd71.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-other-topics-20260914-v1/promo-video/promo-video-01-promo-video-launch-teaser-73271ed69f.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-lifestyle-creative-rich-lifestyle-diverse-20260913-v1/rich-lifestyle-00-quiet-city-walk-907614798ac6.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-review-media-20260915-v1/ava-avatar.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-review-media-20260915-v1/lucas-avatar.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-review-media-20260915-v1/mia-avatar.webp",
  "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-review-media-20260915-v1/noah-avatar.webp"
];

const args = new Set(process.argv.slice(2));
const siteArg = process.argv.find((arg) => arg.startsWith("--site="))?.slice("--site=".length) || "all";
const minBytes = Number(process.argv.find((arg) => arg.startsWith("--min-bytes="))?.slice("--min-bytes=".length) || 262144);
const apply = args.has("--apply");
const force = args.has("--force");

if (siteArg !== "all" && !SITES[siteArg]) {
  throw new Error(`Unknown --site=${siteArg}. Use all, aidreamcapes-com, aidreamcapes-eu, or aidreamshoots-eu.`);
}

function stripQuery(value) {
  return String(value || "").split(/[?#]/)[0];
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isPublicImageUrl(value, assetPrefix) {
  const clean = stripQuery(value);
  return typeof value === "string"
    && clean.startsWith(assetPrefix)
    && IMAGE_EXTENSIONS.test(clean)
    && !EXCLUDED_PATH.test(clean);
}

function localPathForUrl(value) {
  const clean = stripQuery(value);
  if (!clean.startsWith("/assets/")) return undefined;
  const filePath = path.resolve(PUBLIC_ROOT, clean.slice(1));
  if (filePath !== PUBLIC_ROOT && !filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) return undefined;
  return filePath;
}

function urlForLocalPath(filePath) {
  const resolved = path.resolve(filePath);
  if (resolved !== PUBLIC_ROOT && !resolved.startsWith(`${PUBLIC_ROOT}${path.sep}`)) return undefined;
  return `/${path.relative(PUBLIC_ROOT, resolved).split(path.sep).join("/")}`;
}

function collectAssetUrls(value, assetPrefix, refMap, ref) {
  if (typeof value === "string") {
    const matches = value.match(/\/assets\/[^?#|"'\s]+/g) || [];
    for (const match of matches) {
      if (!isPublicImageUrl(match, assetPrefix)) continue;
      if (GENERATED_VARIANT_FILENAME.test(stripQuery(match))) continue;
      const clean = stripQuery(match);
      if (assetPrefix === SITES["aidreamcapes-com"].assetPrefix && AIDREAMCAPES_RETIRED_CONTENT_PATH.test(clean)) continue;
      const current = refMap.get(clean) || { url: clean, refs: [] };
      current.refs.push(ref);
      refMap.set(clean, current);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectAssetUrls(item, assetPrefix, refMap, { ...ref, fieldPath: `${ref.fieldPath || ""}/${index}` }));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => collectAssetUrls(item, assetPrefix, refMap, { ...ref, fieldPath: `${ref.fieldPath || ""}/${key}` }));
  }
}

function collectPublicAssetInventory(siteKey, config, refMap) {
  if (siteKey !== "aidreamcapes-com") return;
  const root = localPathForUrl(config.assetPrefix);
  if (!root || !fs.existsSync(root)) return;

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
        continue;
      }
      const url = urlForLocalPath(filePath);
      if (!url || !isPublicImageUrl(url, config.assetPrefix) || AIDREAMCAPES_RETIRED_CONTENT_PATH.test(url)) continue;
      const current = refMap.get(url) || { url, refs: [] };
      current.refs.push({ site: siteKey, model: "public-asset-inventory", rowId: null, fieldPath: url });
      refMap.set(url, current);
    }
  }

  visit(root);
}

async function findManyOptional(prisma, modelName, argsForQuery) {
  try {
    return await prisma[modelName].findMany(argsForQuery);
  } catch (error) {
    if (error?.code === "P2021" || error?.code === "P2022") return [];
    throw error;
  }
}

function variantPath(sourcePath, width, format) {
  const parsed = path.parse(sourcePath);
  return path.join(parsed.dir, "_responsive", `${parsed.name}--${width}.${format}`);
}

function manifestVariantUrl(sourcePath, width, format) {
  return urlForLocalPath(variantPath(sourcePath, width, format));
}

function shouldGenerate(filePath, metadata) {
  return Boolean(metadata.width && metadata.height && metadata.width > Math.min(...TARGET_WIDTHS))
    && !filePath.includes(`${path.sep}_responsive${path.sep}`);
}

async function inspectImage(filePath) {
  const buffer = fs.readFileSync(filePath);
  const metadata = await sharp(buffer).metadata();
  return {
    buffer,
    bytes: buffer.length,
    format: metadata.format || path.extname(filePath).slice(1).toLowerCase(),
    width: metadata.width || 0,
    height: metadata.height || 0,
    sha256: sha256(buffer)
  };
}

async function writeVariant(sourcePath, targetPath, width, format) {
  if (fs.existsSync(targetPath) && !force) {
    const existing = await inspectImage(targetPath);
    if (existing.width <= width && existing.width > 0 && existing.height > 0) return existing;
    throw new Error(`Refusing to overwrite an existing non-generated-looking file without --force: ${targetPath}`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const pipeline = sharp(sourcePath)
    .rotate()
    .resize({ width, fit: "inside", withoutEnlargement: true });
  if (format === "avif") {
    await pipeline.avif({ quality: 52, effort: 4 }).toFile(targetPath);
  } else {
    await pipeline.webp({ quality: 80, effort: 4, smartSubsample: true }).toFile(targetPath);
  }
  return inspectImage(targetPath);
}

async function collectSiteRefs(prisma, siteKey, config) {
  const refs = new Map();
  for (const modelName of MODEL_NAMES) {
    const rows = await findManyOptional(prisma, modelName, { where: { siteId: config.siteId } });
    for (const row of rows) {
      collectAssetUrls(row, config.assetPrefix, refs, {
        site: siteKey,
        model: modelName,
        rowId: row.id || null,
        fieldPath: ""
      });
    }
  }

  const mediaAssets = await findManyOptional(prisma, "mediaAsset", {
    where: { siteId: config.siteId },
    select: { storageKey: true, previewUrl: true, originUrl: true, usageType: true }
  });
  for (const row of mediaAssets) {
    collectAssetUrls(row, config.assetPrefix, refs, {
      site: siteKey,
      model: "mediaAsset",
      rowId: null,
      fieldPath: ""
    });
  }
  collectPublicAssetInventory(siteKey, config, refs);
  if (siteKey === "aidreamshoots-eu") {
    for (const url of AIDREAMSHOOTS_STATIC_RESPONSIVE_IMAGE_URLS) {
      const current = refs.get(url) || { url, refs: [] };
      current.refs.push({ site: siteKey, model: "static-renderer-catalogue", rowId: null, fieldPath: "" });
      refs.set(url, current);
    }
  }
  return refs;
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  const selectedSites = siteArg === "all" ? Object.entries(SITES) : [[siteArg, SITES[siteArg]]];
  const prisma = new PrismaClient();
  const existingManifest = apply && siteArg !== "all" && fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"))
    : {};
  const manifest = siteArg === "all"
    ? {}
    : Object.fromEntries(Object.entries(existingManifest).filter(([, entry]) => entry?.site !== siteArg));
  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    minBytes,
    targetWidths: TARGET_WIDTHS,
    sites: {},
    missing: [],
    skipped: 0,
    skippedExamples: [],
    errors: [],
    entries: 0,
    variants: 0,
    bytesBefore: 0,
    bytesAfter: 0
  };

  try {
    for (const [siteKey, config] of selectedSites) {
      const site = await prisma.site.findUnique({ where: { id: config.siteId }, select: { id: true, slug: true, primaryDomain: true } });
      if (!site) throw new Error(`Site ${config.siteId} was not found in the local database.`);
      const refs = await collectSiteRefs(prisma, siteKey, config);
      const siteReport = {
        siteId: config.siteId,
        assetPrefix: config.assetPrefix,
        referenced: refs.size,
        eligible: 0,
        entries: 0,
        variants: 0,
        missing: 0,
        skipped: 0
      };

      for (const ref of refs.values()) {
        const sourcePath = localPathForUrl(ref.url);
        if (!sourcePath || !fs.existsSync(sourcePath)) {
          siteReport.missing += 1;
          report.missing.push({ site: siteKey, url: ref.url, refs: ref.refs.slice(0, 8) });
          continue;
        }
        let source;
        try {
          source = await inspectImage(sourcePath);
        } catch (error) {
          report.errors.push({ site: siteKey, url: ref.url, error: error instanceof Error ? error.message : String(error) });
          continue;
        }
        report.bytesBefore += source.bytes;
        if (!shouldGenerate(sourcePath, source)) {
          siteReport.skipped += 1;
          report.skipped += 1;
          if (report.skippedExamples.length < 20) {
            report.skippedExamples.push({ site: siteKey, url: ref.url, bytes: source.bytes, width: source.width, height: source.height });
          }
          manifest[ref.url] = {
            site: siteKey,
            width: source.width,
            height: source.height,
            format: source.format,
            bytes: source.bytes,
            sha256: source.sha256,
            original: ref.url,
            variants: []
          };
          siteReport.entries += 1;
          report.entries += 1;
          continue;
        }
        siteReport.eligible += 1;
        const variants = [];
        const formatResults = await Promise.all(
          TARGET_WIDTHS
            .filter((width) => width < source.width)
            .flatMap((targetWidth) => ["avif", "webp"].map(async (format) => {
              const outputPath = variantPath(sourcePath, targetWidth, format);
              try {
                const output = apply
                  ? await writeVariant(sourcePath, outputPath, targetWidth, format)
                  : null;
                const outputUrl = manifestVariantUrl(sourcePath, targetWidth, format);
                if (outputUrl && (apply ? fs.existsSync(outputPath) : true)) {
                  return { targetWidth, format, outputUrl, output };
                }
              } catch (error) {
                report.errors.push({ site: siteKey, url: ref.url, targetWidth, format, error: error instanceof Error ? error.message : String(error) });
              }
              return null;
            }))
        );
        const variantsByWidth = new Map();
        for (const result of formatResults.filter(Boolean)) {
          const variant = variantsByWidth.get(result.targetWidth) || { width: result.targetWidth };
          variant[result.format] = result.outputUrl;
          variantsByWidth.set(result.targetWidth, variant);
          report.variants += 1;
          siteReport.variants += 1;
          if (result.output) report.bytesAfter += result.output.bytes;
        }
        variants.push(...[...variantsByWidth.values()].sort((left, right) => left.width - right.width));
        const entry = {
          site: siteKey,
          width: source.width,
          height: source.height,
          format: source.format,
          bytes: source.bytes,
          sha256: source.sha256,
          original: ref.url,
          variants
        };
        manifest[ref.url] = entry;
        siteReport.entries += 1;
        report.entries += 1;
      }
      report.sites[siteKey] = siteReport;
    }

    if (apply) {
      fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
      fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
      report.manifest = MANIFEST_PATH;
    }
    console.log(JSON.stringify(report, null, 2));
    if (report.errors.length || report.missing.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
