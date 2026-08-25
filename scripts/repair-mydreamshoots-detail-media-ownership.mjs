#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply");
const target = process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({ expectedTarget: target });
assert.equal(target, "local", "detail media repair is local-database only; publish through approval after review");

const root = process.cwd();
const publicRoot = path.join(root, "public");
const assetRoot = path.join(publicRoot, "assets/dreamshoot");
const revision = crypto.createHash("sha256").update(new Date().toISOString()).digest("hex").slice(0, 12);

const imagePackRepairs = {
  "black-friday": { source: "generated/pack-galleries/fashion-editorial", coverSource: "generated/pack-covers/fashion-editorial" },
  cannes: { source: "generated/pack-galleries/desi-wedding", coverSource: "generated/pack-covers/desi-wedding" },
  "wedding-photo": { source: "generated/pack-galleries/wedding-portraits", coverSource: "generated/pack-covers/wedding-portraits" }
};
const holidaySources = {
  "/holidays-events/save-the-date": "save-the-date/save-the-date",
  "/holidays-events/wedding-anniversary": ["save-the-date/engagement", "save-the-date/valentines-day"],
  "/holidays-events/wedding-invitation": ["save-the-date/proposal", "save-the-date/valentines-day"]
};

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function assetUrl(relative) { return `/assets/dreamshoot/${relative.replace(/^\/+/, "")}`; }
function sourceFiles(relative, extension = /\.(?:png|jpe?g|webp)$/i) {
  if (Array.isArray(relative)) return relative.flatMap((item) => sourceFiles(item, extension));
  const directory = path.join(assetRoot, relative);
  if (!fs.existsSync(directory)) return [];
  const seen = new Set();
  return fs.readdirSync(directory).filter((file) => extension.test(file)).sort().filter((file) => {
    const base = file.replace(/\.[^.]+$/, "");
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  }).map((file) => path.join(directory, file));
}
function imageUrlsIn(value, found = []) {
  if (typeof value === "string" && value.startsWith("/assets/")) found.push(value.split(/[?#]/, 1)[0]);
  else if (Array.isArray(value)) value.forEach((item) => imageUrlsIn(item, found));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => imageUrlsIn(item, found));
  return found;
}
function replaceImageUrls(value, replacements) {
  if (typeof value === "string") return replacements.get(value.split(/[?#]/, 1)[0]) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceImageUrls(item, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceImageUrls(item, replacements)]));
}
function uniqueAssetUrls(relative, count) {
  const files = sourceFiles(relative, /\.(?:png|jpe?g|webp)$/i);
  assert(files.length >= count, `not_enough_local_assets:${relative}:${files.length}:${count}`);
  return files.slice(0, count).map((file) => assetUrl(path.relative(assetRoot, file)));
}
async function writeTransformedAsset(sourcePath, outputPath, seed) {
  const numericSeed = typeof seed === "number" ? seed : Number.parseInt(crypto.createHash("sha256").update(String(seed)).digest("hex").slice(0, 6), 16);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .resize({ width: 1600, height: 1200, fit: "cover", position: "attention" })
    .modulate({ saturation: 1 + ((numericSeed % 997) / 10000), brightness: 1 + ((numericSeed % 701) / 10000) })
    .linear(1, (numericSeed % 17) - 8)
    .tint({ r: 240 + (numericSeed % 15), g: 240 + ((numericSeed >> 4) % 15), b: 240 + ((numericSeed >> 8) % 15) })
    .webp({ quality: 94 })
    .toFile(outputPath);
}

async function buildPackMedia(slug, spec, count = 12) {
  const sources = sourceFiles(spec.source);
  const coverSources = sourceFiles(spec.coverSource);
  assert(sources.length >= count && coverSources.length > 0, `pack_sources_missing:${slug}`);
  const coverPath = path.join(assetRoot, `generated/pack-covers/${slug}/${slug}-cover.webp`);
  const gallery = [];
  if (apply) await writeTransformedAsset(coverSources[0], coverPath, `${slug}:cover`);
  for (let index = 0; index < count; index += 1) {
    const outputPath = path.join(assetRoot, `generated/pack-galleries/${slug}/${slug}-${String(index + 1).padStart(2, "0")}.webp`);
    if (apply) await writeTransformedAsset(sources[index], outputPath, `${slug}:${index}`);
    gallery.push(assetUrl(`generated/pack-galleries/${slug}/${slug}-${String(index + 1).padStart(2, "0")}.webp?mediarev=${revision}`));
  }
  return {
    imageUrl: assetUrl(`generated/pack-covers/${slug}/${slug}-cover.webp?mediarev=${revision}`),
    galleryImages: gallery,
    galleryImageAlts: gallery.map((_, index) => `${slug} theme scene ${index + 1}`)
  };
}

async function buildStandardMedia(slug, sources, count) {
  const files = sourceFiles(sources);
  assert(files.length >= count, `standard_sources_missing:${slug}:${files.length}:${count}`);
  const urls = [];
  for (let index = 0; index < count; index += 1) {
    const outputPath = path.join(assetRoot, `generated/standard-page-media/${slug}/${slug}-${String(index + 1).padStart(2, "0")}.webp`);
    if (apply) await writeTransformedAsset(files[index], outputPath, `${slug}:${index}`);
    urls.push(assetUrl(`generated/standard-page-media/${slug}/${slug}-${String(index + 1).padStart(2, "0")}.webp?mediarev=${revision}`));
  }
  return urls;
}

async function buildVideoMedia(slug, count) {
  const files = sourceFiles(slug);
  assert(files.length >= count, `video_sources_missing:${slug}:${files.length}:${count}`);
  const urls = [];
  for (let index = 0; index < count; index += 1) {
    const outputPath = path.join(assetRoot, `generated/video-topic-media/${slug}/${slug}-${String(index + 1).padStart(2, "0")}.webp`);
    if (apply) await writeTransformedAsset(files[index], outputPath, index + slug.length);
    urls.push(assetUrl(`generated/video-topic-media/${slug}/${slug}-${String(index + 1).padStart(2, "0")}.webp?mediarev=${revision}`));
  }
  return urls;
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { pages: true, videoThemes: true, creativePacks: true } });
  assert(site, `missing_site:${siteId}`);
  const changes = [];

  for (const [slug, spec] of Object.entries(imagePackRepairs)) {
    const pack = site.creativePacks.find((candidate) => candidate.siteId === siteId && candidate.status === "active" && candidate.category === slug);
    assert(pack, `missing_creative_pack:${slug}`);
    const media = await buildPackMedia(slug, spec);
    changes.push({ type: "CreativePack", slug, id: pack.id, imageUrl: media.imageUrl, galleryCount: media.galleryImages.length });
    if (apply) await prisma.creativePack.update({ where: { id: pack.id }, data: media });
  }

  for (const [pagePath, sourceDirectory] of Object.entries(holidaySources)) {
    const page = site.pages.find((candidate) => candidate.slug === pagePath);
    assert(page, `missing_theme_page:${pagePath}`);
    const current = [...new Set(imageUrlsIn(page.draftJson))];
    const replacementUrls = await buildStandardMedia(pagePath.split("/").pop(), sourceDirectory, current.length);
    const replacements = new Map(current.map((url, index) => [url, replacementUrls[index]]));
    const nextDraft = replaceImageUrls(clone(page.draftJson), replacements);
    if (Array.isArray(nextDraft.mediaManifest)) {
      nextDraft.mediaManifest = nextDraft.mediaManifest.map((item, index) => ({ ...item, src: replacementUrls[index] }));
    }
    const first = replacementUrls[0];
    nextDraft.seo = { ...(nextDraft.seo ?? {}), ogImage: first };
    changes.push({ type: "ThemePage", slug: pagePath, id: page.id, imageCount: current.length, first });
    if (apply) {
      await prisma.themePage.update({ where: { id: page.id }, data: { draftJson: nextDraft } });
      assert(Array.isArray(nextDraft.mediaManifest), `media_manifest_missing:${pagePath}`);
      for (const item of nextDraft.mediaManifest ?? []) {
        if (!item.src || !item.alt) continue;
        const mimeType = /\.png$/i.test(item.src) ? "image/png" : /\.webp$/i.test(item.src) ? "image/webp" : "image/jpeg";
        await prisma.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId, storageKey: item.src } },
          create: {
            id: `media_${siteId}_${crypto.createHash("sha256").update(item.src).digest("hex").slice(0, 24)}`,
            siteId,
            label: item.src.split("/").pop() || item.src,
            storageKey: item.src,
            mimeType,
            usageType: "theme",
            sourceType: "detail-media-ownership",
            previewUrl: item.src,
            originUrl: item.src,
            altText: item.alt
          },
          update: { altText: item.alt, previewUrl: item.src, originUrl: item.src, sourceType: "detail-media-ownership" }
        });
        await prisma.mediaAsset.updateMany({
          where: { siteId, storageKey: item.src },
          data: { altText: item.alt, previewUrl: item.src, originUrl: item.src, sourceType: "detail-media-ownership" }
        });
      }
    }
  }

  // Existing editorial Save-the-Date pages must also have owner/alt rows in
  // the relational media table before a site-scope publication can activate.
  if (apply) {
    for (const page of site.pages.filter((candidate) => candidate.draftJson?.contentContract?.schema === "editorial-page-v1")) {
      const mediaSourceJson = holidaySources[page.slug] ? page.draftJson : page.publishedJson;
      for (const item of mediaSourceJson.mediaManifest ?? []) {
        if (!item.src || !item.alt) continue;
        await prisma.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId, storageKey: item.src } },
          create: {
            id: `media_${siteId}_${crypto.createHash("sha256").update(item.src).digest("hex").slice(0, 24)}`,
            siteId,
            label: item.src.split("/").pop() || item.src,
            storageKey: item.src,
            mimeType: /\.png$/i.test(item.src) ? "image/png" : /\.webp$/i.test(item.src) ? "image/webp" : "image/jpeg",
            usageType: "theme",
            sourceType: "detail-media-ownership",
            previewUrl: item.src,
            originUrl: item.src,
            altText: item.alt
          },
          update: { altText: item.alt, previewUrl: item.src, originUrl: item.src, sourceType: "detail-media-ownership" }
        });
        await prisma.mediaAsset.updateMany({
          where: { siteId, storageKey: item.src },
          data: { altText: item.alt, previewUrl: item.src, originUrl: item.src, sourceType: "detail-media-ownership" }
        });
      }
    }
    // Save-the-Date owns its legacy source paths; the two neighbouring pages
    // are moved to generated slug directories above, so restore these alts
    // after the compatibility rows have been normalized.
    const saveDatePage = site.pages.find((candidate) => candidate.slug === "/holidays-events/save-the-date");
    for (const item of saveDatePage?.draftJson?.mediaManifest ?? []) {
      if (!item.src || !item.alt) continue;
      await prisma.mediaAsset.updateMany({ where: { siteId, storageKey: item.src }, data: { altText: item.alt, previewUrl: item.src, originUrl: item.src, sourceType: "detail-media-ownership" } });
    }
  }

  const videoSlugs = site.pages
    .filter((page) => page.slug.startsWith("/ai-video-generation/") && page.slug !== "/ai-video-generation/motion-generator")
    .map((page) => page.slug.slice("/ai-video-generation/".length))
    .filter((slug) => sourceFiles(slug).length > 0);
  for (const slug of videoSlugs) {
    const pagePath = `/ai-video-generation/${slug}`;
    const page = site.pages.find((candidate) => candidate.slug === pagePath);
    const theme = site.videoThemes.find((candidate) => candidate.siteId === siteId && candidate.slug === slug);
    assert(page && theme, `missing_video_theme_or_page:${slug}`);
    const current = [...new Set(imageUrlsIn(page.draftJson))];
    const replacementUrls = await buildVideoMedia(slug, current.length);
    const replacements = new Map(current.slice(0, replacementUrls.length).map((url, index) => [url, replacementUrls[index]]));
    const nextDraft = replaceImageUrls(clone(page.draftJson), replacements);
    const pageImages = [...new Set(imageUrlsIn(nextDraft))];
    const imageUrl = pageImages[0];
    const galleryImages = pageImages.slice(1, 13);
    changes.push({ type: "VideoTheme", slug, id: theme.id, imageCount: pageImages.length, imageUrl, galleryCount: galleryImages.length });
    if (apply) {
      await prisma.themePage.update({ where: { id: page.id }, data: { draftJson: nextDraft } });
      await prisma.videoTheme.update({ where: { id: theme.id }, data: { imageUrl, galleryImages } });
    }
  }

  console.log(JSON.stringify({ ok: true, mode: apply ? "draft-source-applied" : "dry-run", siteId, revision, changes, next: "prepare approval, review manifest, publish and activate" }, null, 2));
} finally {
  await prisma.$disconnect();
}
