#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const failures = [];
const prisma = new PrismaClient();
const state = await readPlatformStateFromSql(prisma);

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function comparableUrl(value) {
  return String(value || "").trim().split(/[?#]/)[0];
}

function publicAssetPath(url) {
  const pathname = comparableUrl(url);
  return pathname.startsWith("/assets/") ? path.join(repoRoot, "public", pathname) : "";
}

function packSlug(pack) {
  return String(pack?.category || pack?.categoryRecord?.slug || pack?.name || pack?.id || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function imageIdentity(url) {
  return comparableUrl(url);
}

function rgbRmse(left, right) {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index] - right[index];
    sum += delta * delta;
  }
  return Math.sqrt(sum / left.length);
}

async function resizedRawRgb(filePath, size) {
  return sharp(filePath)
    .resize(size, size, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
}

async function assertEngagementCoverUsesFullGalleryFrame() {
  const engagementPack = state.creativePacks?.find((pack) => pack.id === "pack_dreamshoot_engagement");
  const engagementCategory = state.creativePackCategories?.find((category) => category.id === "pack_cat_h1wmjb4n_1782444143728");
  const coverPath = publicAssetPath(engagementPack?.imageUrl);
  const firstGalleryPath = publicAssetPath(engagementPack?.galleryImages?.[0]);

  assert(Boolean(engagementPack), "Engagement creative pack should exist");
  assert(Boolean(engagementCategory), "Engagement category should exist");
  assert(comparableUrl(engagementPack?.imageUrl) === comparableUrl(engagementCategory?.imageUrl), "Engagement pack and category should share the repaired cover URL");
  assert(engagementPack?.imageUrl?.includes("20260805uncropped1"), "Engagement cover URL should use the uncropped cache-buster");
  assert(fs.existsSync(coverPath), `Engagement cover file is missing: ${coverPath}`);
  assert(fs.existsSync(firstGalleryPath), `Engagement gallery source is missing: ${firstGalleryPath}`);
  if (!fs.existsSync(coverPath) || !fs.existsSync(firstGalleryPath)) return;

  const coverMeta = await sharp(coverPath).metadata();
  const galleryMeta = await sharp(firstGalleryPath).metadata();
  assert(coverMeta.width === 1280 && coverMeta.height === 960, `Engagement cover should remain 1280x960, got ${coverMeta.width}x${coverMeta.height}`);
  assert(galleryMeta.width === 1024 && galleryMeta.height === 1024, `Engagement gallery source should remain 1024x1024, got ${galleryMeta.width}x${galleryMeta.height}`);

  const coverCenter = await sharp(coverPath)
    .extract({ left: 190, top: 30, width: 900, height: 900 })
    .resize(128, 128, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const galleryReference = await resizedRawRgb(firstGalleryPath, 128);
  const rmse = rgbRmse(coverCenter, galleryReference);
  assert(rmse < 35, `Engagement cover should preserve the full first gallery image in its safe center; RMSE=${rmse.toFixed(2)}`);
}

async function assertMydreamshootsThemeAssetContract() {
  const activePacks = (state.creativePacks ?? []).filter((pack) => pack.siteId === "site_dreamshoot" && pack.status === "active");
  const activeCategories = (state.creativePackCategories ?? []).filter((category) => category.siteId === "site_dreamshoot" && category.status === "active");
  const categoryById = new Map(activeCategories.map((category) => [category.id, category]));
  const targetSlugs = new Set([
    "only-fans",
    "singles-awareness-day",
    "bikini",
    "swimsuit",
    "background-remover",
    "magic-eraser",
    "portrait-retouch",
    "unblur-image",
    "color-correction",
    "old-photo-restoration"
  ]);

  assert(activePacks.length === 38, `MyDreamShoots should expose 38 active package themes, found ${activePacks.length}`);
  assert(activeCategories.length === 43, `MyDreamShoots should expose 43 active package categories, found ${activeCategories.length}`);

  const coverIdentities = new Map();
  for (const pack of activePacks) {
    const slug = packSlug(pack);
    const cover = String(pack.imageUrl ?? "").trim();
    const galleryImages = Array.isArray(pack.galleryImages) ? pack.galleryImages : [];
    const galleryAlts = Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts : [];
    const category = categoryById.get(pack.categoryId);

    assert(cover, `${slug} is missing a pack cover URL`);
    assert(fs.existsSync(publicAssetPath(cover)), `${slug} pack cover file is missing: ${cover}`);
    assert(galleryImages.length === 12, `${slug} should expose 12 gallery images, found ${galleryImages.length}`);
    assert(galleryAlts.length === galleryImages.length || galleryAlts.length === galleryImages.length + 1, `${slug} cover/gallery image and alt counts should match`);
    assert(category?.imageUrl, `${slug} leaf category is missing its category cover URL`);
    assert(imageIdentity(category?.imageUrl) === imageIdentity(cover), `${slug} category and pack cover URLs should match`);

    const previous = coverIdentities.get(imageIdentity(cover));
    assert(!previous, `${slug} reuses the pack cover from ${previous || "another theme"}`);
    coverIdentities.set(imageIdentity(cover), slug);

    const seenGallery = new Set();
    galleryImages.forEach((image, index) => {
      const identity = imageIdentity(image);
      assert(identity && !seenGallery.has(identity), `${slug} gallery image ${index + 1} is duplicated`);
      assert(fs.existsSync(publicAssetPath(image)), `${slug} gallery image file is missing: ${image}`);
      seenGallery.add(identity);
    });

    if (targetSlugs.has(slug)) {
      assert(comparableUrl(cover).includes(`/pack-covers/${slug}/${slug}-cover`), `${slug} should use its own canonical cover directory`);
      assert(galleryImages.every((image) => comparableUrl(image).includes(`/pack-galleries/${slug}/${slug}-`)), `${slug} should use its own canonical gallery directory`);
    }
  }

  for (const category of activeCategories.filter((item) => item.parentId)) {
    assert(category.imageUrl, `${category.slug} category imageUrl should not be empty`);
  }
}

function assertWorkspacePreviewLayout() {
  const source = read("src/components/app/job-create-form.tsx");
  assert(source.includes('data-workspace-selected-package-image="true"'), "Selected package preview image should expose a smoke-test marker");
  assert(source.includes("data-workspace-package-gallery-image=\"true\""), "Package gallery images should expose a smoke-test marker");
  assert(source.includes("aspect-[4/3] min-h-[260px] w-full self-start"), "Selected package preview frame should keep a stable 4:3 ratio");
  assert(source.includes("data-workspace-selected-package-image=\"true\"") && source.includes("object-contain"), "Selected package preview should use object-contain");
  assert(source.includes("data-workspace-package-gallery-image=\"true\"") && source.includes("object-contain"), "Package gallery examples should use object-contain");
}

function assertCoverScriptKeepsFullFrame(source, label) {
  assert(source.includes('.resize(1280, 960, { fit: "cover", position: "centre" })') && source.includes(".blur(26)"), `${label} should reserve 4:3 cover resizing for the blurred background`);
  assert(source.includes('.resize(900, 900, { fit: "inside"'), `${label} should place the full gallery frame inside the cover`);
  assert(source.includes("input: foreground"), `${label} should composite the uncropped foreground over the background`);
}

function assertCoverGeneratorKeepsFullFrame() {
  const generatorSource = read("scripts/generate-mydreamshoots-theme-galleries.mjs");
  assertCoverScriptKeepsFullFrame(generatorSource, "Pack cover generator");
  assert(generatorSource.includes("coverPublicVersionBySlug") && generatorSource.includes("20260805uncropped1"), "Pack cover generator should keep Engagement on the uncropped cover cache-buster");
  const enrichSource = read("scripts/enrich-mydreamshoots-collection-details.mjs");
  assertCoverScriptKeepsFullFrame(enrichSource, "Collection enrichment cover fallback");
  assert(enrichSource.includes("uniqueCoverVersionBySlug") && enrichSource.includes("20260805uncropped1"), "Collection enrichment should keep Engagement on the uncropped cover cache-buster");
}

await assertEngagementCoverUsesFullGalleryFrame();
await assertMydreamshootsThemeAssetContract();
assertWorkspacePreviewLayout();
assertCoverGeneratorKeepsFullFrame();

if (failures.length) {
  console.error("Workspace package preview image smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("✓ workspace package preview images preserve uncropped gallery art");
await prisma.$disconnect();
