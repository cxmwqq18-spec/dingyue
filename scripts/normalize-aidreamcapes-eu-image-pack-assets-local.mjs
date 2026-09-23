#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import { assertProviderAspectRatio } from "./lib/provider-image-output.mjs";
import { assertAidreamcapesEuHomepageIntegrity } from "./lib/aidreamcapes-eu-homepage-integrity.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_ASSET_SLUG = "site_aidreamcapes_eu";
const PUBLIC_ROOT = path.resolve("public");
const ASSET_PREFIX = `/assets/sites/${SITE_ASSET_SLUG}/`;
const OUTPUT_RELATIVE_ROOT = `assets/sites/${SITE_ASSET_SLUG}/generated/recovered/aidreamcapes-eu-image-pack-4k-20260916-v1`;
const OUTPUT_PUBLIC_ROOT = `/${OUTPUT_RELATIVE_ROOT}/`;
const OUTPUT_FS_ROOT = path.resolve(PUBLIC_ROOT, OUTPUT_RELATIVE_ROOT);
const REPORT_ROOT = path.resolve(".tmp", "aidreamcapes-eu-image-pack-4k");
const VERSION = "20260916euimagepack4k1";

const EXPECTED_SLUGS = [
  "avatar", "background-changer", "background-remover", "bikini", "black-friday", "boudoir", "cannes",
  "christmas-photo", "color-correction", "cyberpunk", "edit-by-prompt", "engagement-photo", "gala-photo",
  "hairstyle-generator", "halloween-photo", "headshot", "holiday", "mafia", "magic-eraser", "motion-generator",
  "nightlife", "old-photo-restoration", "only-fans", "photo-enhancer", "portrait-photo", "portrait-retouch",
  "rich-lifestyle", "singles-awareness-day", "soccer", "social-cards", "street-style", "swimsuit",
  "thanksgiving-photo", "travel", "unblur-image", "urban", "valentines-photo", "virtual-try-on", "wedding-photo"
];

const IMAGE_EXT_RE = /\.(?:jpe?g|png|webp|avif)$/i;
const args = parseArgs(process.argv.slice(2));
const APPLY = Boolean(args.apply || String(args.mode || "").toLowerCase() === "apply");

function parseArgs(items) {
  const out = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.startsWith("--")) continue;
    const raw = item.slice(2);
    const equal = raw.indexOf("=");
    const key = (equal >= 0 ? raw.slice(0, equal) : raw).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (equal >= 0) out[key] = raw.slice(equal + 1);
    else if (items[index + 1] && !items[index + 1].startsWith("--")) out[key] = items[++index];
    else out[key] = true;
  }
  return out;
}

function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function stripQuery(value) { return String(value || "").split(/[?#]/)[0]; }
function sha256(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function storageKey(value) { return stripQuery(value).replace(/^\//, ""); }
function isTargetImageUrl(value) { return typeof value === "string" && stripQuery(value).startsWith(ASSET_PREFIX) && IMAGE_EXT_RE.test(stripQuery(value)); }

function localPathForUrl(value) {
  const pathname = stripQuery(value);
  assert(pathname.startsWith(ASSET_PREFIX), `Expected EU asset URL: ${value}`);
  const filePath = path.resolve(PUBLIC_ROOT, pathname.slice(1));
  assert(filePath === PUBLIC_ROOT || filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`), `Asset escaped public root: ${value}`);
  return filePath;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function versioned(value) {
  const base = stripQuery(value);
  return `${base}?v=${VERSION}`;
}

function walkAndRewrite(value, replacements) {
  if (typeof value === "string") {
    if (!isTargetImageUrl(value)) return value;
    return replacements.get(stripQuery(value)) || value;
  }
  if (Array.isArray(value)) return value.map((item) => walkAndRewrite(item, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walkAndRewrite(item, replacements)]));
}

function changed(before, after) { return JSON.stringify(before) !== JSON.stringify(after); }

function makeOutputUrl(slug, slot, sourceUrl) {
  const sourceName = path.basename(stripQuery(sourceUrl));
  const ext = path.extname(sourceName);
  const stem = path.basename(sourceName, ext).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const role = slot === 0 ? "cover" : `gallery-${String(slot).padStart(2, "0")}`;
  return versioned(`${OUTPUT_PUBLIC_ROOT}${slug}/${role}-${stem || role}.jpg`);
}

async function normalizeAsset(sourceUrl, targetUrl, apply) {
  const source = localPathForUrl(sourceUrl);
  const target = localPathForUrl(targetUrl);
  assert(fs.existsSync(source), `Missing image-pack source: ${source}`);
  await assertProviderAspectRatio({
    filePath: source,
    expectedWidth: 3840,
    expectedHeight: 2160,
    label: source
  });
  if (apply) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const pending = `${target}.pending`;
    await sharp(source)
      .resize(3840, 2160, { fit: "inside", withoutEnlargement: false })
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toFile(pending);
    fs.renameSync(pending, target);
  }
  if (!fs.existsSync(target)) return null;
  const buffer = fs.readFileSync(target);
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.format, "jpeg", `Expected JPEG output: ${target}`);
  assert.equal(metadata.width, 3840, `Expected 3840px output: ${target}`);
  assert.equal(metadata.height, 2160, `Expected 2160px output: ${target}`);
  assert(buffer.length > 1024, `Output image is unexpectedly small: ${target}`);
  return { url: targetUrl, path: target, width: metadata.width, height: metadata.height, format: metadata.format, bytes: buffer.length, sha256: sha256(buffer) };
}

function collectTargetUrls(rows) {
  const urls = new Map();
  for (const pack of rows) {
    const sourceUrls = [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])].filter(isTargetImageUrl);
    sourceUrls.forEach((url, slot) => urls.set(stripQuery(url), { url, slug: pack.categoryRecord?.slug || pack.category || pack.id, slot }));
  }
  return urls;
}

function mediaAssetUpdate(asset, replacements) {
  const sourceKey = stripQuery(asset.storageKey || "").replace(/^\//, "");
  const replacement = replacements.get(`/${sourceKey}`) || replacements.get(sourceKey.startsWith("assets/") ? `/${sourceKey}` : sourceKey);
  const sourceUrl = sourceKey.startsWith("assets/") ? `/${sourceKey}` : sourceKey;
  const targetUrl = replacements.get(sourceUrl);
  if (!targetUrl) return null;
  return {
    storageKey: storageKey(targetUrl),
    previewUrl: targetUrl,
    originUrl: targetUrl,
    mimeType: "image/jpeg",
    sourceType: "aidreamcapes-eu-image-pack-existing-asset-normalized-4k"
  };
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (APPLY) assertNonProductionWriteTarget();

  const prisma = new PrismaClient();
  try {
    const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } });
    assert.deepEqual(site, { id: SITE_ID, slug: "aidreamcapes-eu", primaryDomain: "aidreamcapes.eu" }, "Target site identity check failed.");

    const [packs, categories, livePages, themePages, themeSettings, videoThemes, videoExamples, videoCategories, mediaAssets] = await Promise.all([
      prisma.creativePack.findMany({ where: { siteId: SITE_ID, status: "active" }, include: { categoryRecord: true }, orderBy: { id: "asc" } }),
      prisma.creativePackCategory.findMany({ where: { siteId: SITE_ID }, orderBy: { sortOrder: "asc" } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themeSettings.findUnique({ where: { siteId: SITE_ID } }),
      prisma.videoTheme.findMany({ where: { siteId: SITE_ID }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.videoThemeExample.findMany({ where: { siteId: SITE_ID }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      prisma.videoThemeCategory.findMany({ where: { siteId: SITE_ID }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.mediaAsset.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } })
    ]);
    assert.equal(packs.length, EXPECTED_SLUGS.length, `Expected ${EXPECTED_SLUGS.length} active EU image packs, got ${packs.length}.`);
    const packSlugs = new Set(packs.map((pack) => String(pack.categoryRecord?.slug || pack.category || "").toLowerCase()));
    assert.deepEqual([...packSlugs].sort(), [...EXPECTED_SLUGS].sort(), "Active EU image pack slug set changed unexpectedly.");

    const sourceUrls = collectTargetUrls(packs);
    const replacements = new Map();
    const assetPlan = [];
    for (const { url, slug, slot } of sourceUrls.values()) {
      const targetUrl = makeOutputUrl(slug, slot, url);
      replacements.set(stripQuery(url), targetUrl);
      assetPlan.push({ slug, slot, sourceUrl: url, targetUrl });
    }
    assert.equal(assetPlan.length, 507, `Expected 507 active image-pack assets, got ${assetPlan.length}.`);
    assert.equal(new Set([...replacements.values()].map(stripQuery)).size, assetPlan.length, "Image-pack output paths are not unique.");

    const assets = [];
    for (const item of assetPlan) assets.push({ ...item, output: await normalizeAsset(item.sourceUrl, item.targetUrl, APPLY) });
    if (assets.some((item) => !item.output)) assert(!APPLY, "Dry-run output is missing; apply mode should have written every image.");
    const usableAssets = assets.filter((item) => item.output);
    const shaGroups = new Map();
    for (const item of usableAssets) shaGroups.set(item.output.sha256, [...(shaGroups.get(item.output.sha256) || []), item]);
    const exactDuplicates = [...shaGroups.values()].filter((group) => group.length > 1).map((group) => group.map(({ slug, slot, targetUrl, output }) => ({ slug, slot, targetUrl, sha256: output.sha256 })));
    assert.equal(exactDuplicates.length, 0, "Normalized active image packs contain exact duplicate files.");

    const nextPacks = packs.map((pack) => ({
      pack,
      imageUrl: replacements.get(stripQuery(pack.imageUrl)) || pack.imageUrl,
      galleryImages: Array.isArray(pack.galleryImages) ? pack.galleryImages.map((url) => replacements.get(stripQuery(url)) || url) : pack.galleryImages
    }));
    const nextCategories = categories.map((category) => ({ category, imageUrl: replacements.get(stripQuery(category.imageUrl)) || category.imageUrl }));
    const nextLivePages = livePages.map((page) => ({ page, contentJson: walkAndRewrite(clone(page.contentJson), replacements) }));
    const nextThemePages = themePages.map((page) => ({ page, draftJson: walkAndRewrite(clone(page.draftJson), replacements), publishedJson: walkAndRewrite(clone(page.publishedJson), replacements) }));
    const nextSettings = themeSettings ? {
      draftJson: walkAndRewrite(clone(themeSettings.draftJson), replacements),
      publishedJson: walkAndRewrite(clone(themeSettings.publishedJson), replacements)
    } : null;
    const nextVideoThemes = videoThemes.map((theme) => ({ theme, imageUrl: replacements.get(stripQuery(theme.imageUrl)) || theme.imageUrl, galleryImages: walkAndRewrite(clone(theme.galleryImages), replacements) }));
    const nextVideoExamples = videoExamples.map((example) => ({ example, imageUrl: replacements.get(stripQuery(example.imageUrl)) || example.imageUrl, galleryImages: walkAndRewrite(clone(example.galleryImages), replacements) }));
    const nextVideoCategories = videoCategories.map((category) => ({ category, imageUrl: replacements.get(stripQuery(category.imageUrl)) || category.imageUrl }));
    const nextMediaAssets = mediaAssets.map((asset) => ({ asset, update: mediaAssetUpdate(asset, replacements) })).filter((item) => item.update);

    const changedRows = {
      packs: nextPacks.filter(({ pack, imageUrl, galleryImages }) => pack.imageUrl !== imageUrl || changed(pack.galleryImages, galleryImages)).length,
      categories: nextCategories.filter(({ category, imageUrl }) => category.imageUrl !== imageUrl).length,
      livePages: nextLivePages.filter(({ page, contentJson }) => changed(page.contentJson, contentJson)).length,
      themePages: nextThemePages.filter(({ page, draftJson, publishedJson }) => changed(page.draftJson, draftJson) || changed(page.publishedJson, publishedJson)).length,
      themeSettings: nextSettings && (changed(themeSettings.draftJson, nextSettings.draftJson) || changed(themeSettings.publishedJson, nextSettings.publishedJson)),
      videoThemes: nextVideoThemes.filter(({ theme, imageUrl, galleryImages }) => theme.imageUrl !== imageUrl || changed(theme.galleryImages, galleryImages)).length,
      videoExamples: nextVideoExamples.filter(({ example, imageUrl, galleryImages }) => example.imageUrl !== imageUrl || changed(example.galleryImages, galleryImages)).length,
      videoCategories: nextVideoCategories.filter(({ category, imageUrl }) => category.imageUrl !== imageUrl).length,
      mediaAssets: nextMediaAssets.length
    };

    const summary = {
      ok: true,
      mode: APPLY ? "apply" : "dry-run",
      siteId: SITE_ID,
      activePacks: packs.length,
      sourceAssets: assetPlan.length,
      outputRoot: OUTPUT_PUBLIC_ROOT,
      dimensions: "3840x2160",
      format: "jpeg",
      providerCalls: 0,
      provider: "existing local assets only; no image generation",
      oldResourcesDeleted: 0,
      exactDuplicateGroups: exactDuplicates.length,
      changedRows,
      assetSamples: assetPlan.slice(0, 8)
    };

    if (!APPLY) {
      writeJson(path.join(REPORT_ROOT, "dry-run-summary.json"), summary);
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const backupPath = path.join(REPORT_ROOT, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(backupPath, {
      createdAt: new Date().toISOString(), siteId: SITE_ID, database: "local",
      packs: packs.map(({ id, imageUrl, galleryImages }) => ({ id, imageUrl, galleryImages })),
      categories: categories.map(({ id, imageUrl }) => ({ id, imageUrl })),
      livePages: livePages.map(({ id, slug, contentJson }) => ({ id, slug, contentJson })),
      themePages: themePages.map(({ id, slug, draftJson, publishedJson }) => ({ id, slug, draftJson, publishedJson })),
      themeSettings: themeSettings ? { id: themeSettings.id, draftJson: themeSettings.draftJson, publishedJson: themeSettings.publishedJson } : null,
      videoThemes: videoThemes.map(({ id, imageUrl, galleryImages }) => ({ id, imageUrl, galleryImages })),
      videoExamples: videoExamples.map(({ id, imageUrl, galleryImages }) => ({ id, imageUrl, galleryImages })),
      videoCategories: videoCategories.map(({ id, imageUrl }) => ({ id, imageUrl })),
      mediaAssets: nextMediaAssets.map(({ asset }) => ({ id: asset.id, storageKey: asset.storageKey, previewUrl: asset.previewUrl, originUrl: asset.originUrl, mimeType: asset.mimeType, sourceType: asset.sourceType }))
    });

    await prisma.$transaction(async (tx) => {
      for (const { pack, imageUrl, galleryImages } of nextPacks) {
        await tx.creativePack.update({ where: { id: pack.id }, data: { imageUrl, galleryImages, updatedAt: new Date() } });
      }
      for (const { category, imageUrl } of nextCategories) {
        if (category.imageUrl !== imageUrl) await tx.creativePackCategory.update({ where: { id: category.id }, data: { imageUrl, updatedAt: new Date() } });
      }
      for (const { page, contentJson } of nextLivePages) {
        if (changed(page.contentJson, contentJson)) await tx.livePage.update({ where: { id: page.id }, data: { contentJson, updatedAt: new Date() } });
      }
      for (const { page, draftJson, publishedJson } of nextThemePages) {
        if (changed(page.draftJson, draftJson) || changed(page.publishedJson, publishedJson)) await tx.themePage.update({ where: { id: page.id }, data: { draftJson, publishedJson, updatedAt: new Date() } });
      }
      if (themeSettings && nextSettings && (changed(themeSettings.draftJson, nextSettings.draftJson) || changed(themeSettings.publishedJson, nextSettings.publishedJson))) {
        await tx.themeSettings.update({ where: { id: themeSettings.id }, data: { draftJson: nextSettings.draftJson, publishedJson: nextSettings.publishedJson, updatedAt: new Date() } });
      }
      for (const { theme, imageUrl, galleryImages } of nextVideoThemes) {
        if (theme.imageUrl !== imageUrl || changed(theme.galleryImages, galleryImages)) await tx.videoTheme.update({ where: { id: theme.id }, data: { imageUrl, galleryImages, updatedAt: new Date() } });
      }
      for (const { example, imageUrl, galleryImages } of nextVideoExamples) {
        if (example.imageUrl !== imageUrl || changed(example.galleryImages, galleryImages)) await tx.videoThemeExample.update({ where: { id: example.id }, data: { imageUrl, galleryImages, updatedAt: new Date() } });
      }
      for (const { category, imageUrl } of nextVideoCategories) {
        if (category.imageUrl !== imageUrl) await tx.videoThemeCategory.update({ where: { id: category.id }, data: { imageUrl, updatedAt: new Date() } });
      }
      for (const { asset, update } of nextMediaAssets) {
        await tx.mediaAsset.update({ where: { id: asset.id }, data: update });
      }
      await assertAidreamcapesEuHomepageIntegrity(tx);
    }, { timeout: 180_000, maxWait: 30_000 });

    const report = { ...summary, backupPath, appliedAt: new Date().toISOString() };
    writeJson(path.join(REPORT_ROOT, "apply-summary.json"), report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
