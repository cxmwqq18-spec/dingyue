#!/usr/bin/env node
import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { readPlatformStateFromSql, writePlatformStateToSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const updateDb = args.has("--db");
const manifestPath = path.resolve(process.cwd(), process.env.MYDS_THEME_ASSET_MANIFEST ?? ".tmp/mydreamshoots-theme-assets/manifest.json");
const publicGalleryRoot = path.join(repoRoot, "public/assets/dreamshoot/generated/pack-galleries");
const publicCoverRoot = path.join(repoRoot, "public/assets/dreamshoot/generated/pack-covers");
const stageGalleryRoot = path.resolve(process.cwd(), process.env.MYDS_THEME_ASSET_STAGE_GALLERY ?? ".tmp/mydreamshoots-theme-assets/pack-galleries");
const stageCoverRoot = path.resolve(process.cwd(), process.env.MYDS_THEME_ASSET_STAGE_COVERS ?? ".tmp/mydreamshoots-theme-assets/pack-covers");
const version = process.env.MYDS_THEME_ASSET_VERSION ?? "20260815unique1";
const targetSlugs = [
  "only-fans",
  "singles-awareness-day",
  "bikini",
  "swimsuit",
  "background-remover",
  "magic-eraser",
  "portrait-retouch",
  "unblur-image",
  "color-correction",
  "old-photo-restoration",
  "edit-by-prompt"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanUrl(value) {
  return String(value ?? "").trim().split(/[?#]/)[0];
}

function packSlug(pack) {
  return String(pack?.category || pack?.categoryRecord?.slug || pack?.name || pack?.id || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function publicGalleryUrl(slug, index) {
  return `/assets/dreamshoot/generated/pack-galleries/${slug}/${slug}-${String(index + 1).padStart(2, "0")}.webp?v=${version}`;
}

function publicCoverUrl(slug) {
  return `/assets/dreamshoot/generated/pack-covers/${slug}/${slug}-cover.webp?v=${version}`;
}

function fileHash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function assertImage(filePath, expectedWidth, expectedHeight, label) {
  assert(fs.existsSync(filePath), `${label} is missing: ${filePath}`);
  const metadata = await sharp(filePath).metadata();
  assert(metadata.width === expectedWidth && metadata.height === expectedHeight, `${label} should be ${expectedWidth}x${expectedHeight}, got ${metadata.width}x${metadata.height}`);
}

function copyFileAtomically(source, destination) {
  const temporary = `${destination}.pending`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, temporary);
  fs.renameSync(temporary, destination);
}

async function validateManifest(manifest, state) {
  assert(manifest?.ok, "theme asset manifest is not marked ok");
  assert(manifest.siteId === "site_dreamshoot", `theme asset manifest must target site_dreamshoot, got ${manifest.siteId}`);
  const resultsBySlug = new Map((manifest.results ?? []).map((result) => [result.slug, result]));
  assert(resultsBySlug.size === targetSlugs.length, `expected ${targetSlugs.length} generated theme results, found ${resultsBySlug.size}`);

  const packs = (state.creativePacks ?? []).filter((pack) => pack.siteId === "site_dreamshoot" && pack.status === "active");
  const categories = (state.creativePackCategories ?? []).filter((category) => category.siteId === "site_dreamshoot" && category.status === "active");
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const packBySlug = new Map(packs.map((pack) => [packSlug(pack), pack]));
  const coverHashes = new Set();

  for (const slug of targetSlugs) {
    const result = resultsBySlug.get(slug);
    const pack = packBySlug.get(slug);
    assert(result, `${slug} is missing from the generated manifest`);
    assert(pack, `${slug} active pack is missing from platform state`);
    const category = categoryById.get(pack.categoryId);
    assert(category, `${slug} active category is missing from platform state`);
    assert(Array.isArray(result.galleryImages) && result.galleryImages.length === 12, `${slug} manifest should contain 12 gallery images`);
    assert(Array.isArray(result.galleryImageAlts) && result.galleryImageAlts.length === 13, `${slug} manifest should contain one cover alt plus 12 gallery alts`);

    const stageCover = path.join(stageCoverRoot, slug, `${slug}-cover.webp`);
    await assertImage(stageCover, 1280, 960, `${slug} staged cover`);
    const coverHash = fileHash(stageCover);
    assert(!coverHashes.has(coverHash), `${slug} staged cover duplicates another generated cover`);
    coverHashes.add(coverHash);

    for (let index = 0; index < 12; index += 1) {
      await assertImage(path.join(stageGalleryRoot, slug, `${slug}-${String(index + 1).padStart(2, "0")}.webp`), 1024, 1024, `${slug} staged gallery ${index + 1}`);
    }
  }

  return { packs, categories, packBySlug, categoryById, resultsBySlug };
}

async function updateDatabase(packs, categories) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      for (const pack of packs) {
        await tx.creativePack.update({
          where: { id: pack.id },
          data: {
            imageUrl: pack.imageUrl,
            galleryImages: pack.galleryImages,
            galleryImageAlts: pack.galleryImageAlts
          }
        });
      }
      for (const category of categories) {
        await tx.creativePackCategory.update({
          where: { id: category.id },
          data: { imageUrl: category.imageUrl }
        });
      }
    }, { timeout: 180_000 });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assert(fs.existsSync(manifestPath), `theme asset manifest is missing: ${manifestPath}`);
  const state = await readPlatformStateFromSql();
  const manifest = readJson(manifestPath);
  const { packBySlug, categoryById, resultsBySlug } = await validateManifest(manifest, state);
  const changedPacks = [];
  const changedCategories = [];

  for (const slug of targetSlugs) {
    const pack = packBySlug.get(slug);
    const category = categoryById.get(pack.categoryId);
    const result = resultsBySlug.get(slug);
    const imageUrl = publicCoverUrl(slug);
    const galleryImages = Array.from({ length: 12 }, (_, index) => publicGalleryUrl(slug, index));
    const galleryImageAlts = result.galleryImageAlts.map((alt) => String(alt).trim());

    changedPacks.push({
      id: pack.id,
      slug,
      imageUrl,
      galleryImages,
      galleryImageAlts
    });
    changedCategories.push({ id: category.id, slug, imageUrl });
  }

  if (!apply) {
    console.log(JSON.stringify({
      dryRun: true,
      manifestPath,
      targetSlugs,
      changedPacks,
      changedCategories,
      updateDb
    }, null, 2));
    return;
  }

  for (const change of changedPacks) {
    const slug = change.slug;
    copyFileAtomically(path.join(stageCoverRoot, slug, `${slug}-cover.webp`), path.join(publicCoverRoot, slug, `${slug}-cover.webp`));
    for (let index = 0; index < 12; index += 1) {
      const slot = String(index + 1).padStart(2, "0");
      copyFileAtomically(path.join(stageGalleryRoot, slug, `${slug}-${slot}.webp`), path.join(publicGalleryRoot, slug, `${slug}-${slot}.webp`));
    }
  }

  for (const change of changedPacks) {
    const pack = (state.creativePacks ?? []).find((item) => item.id === change.id);
    assert(pack, `state pack disappeared during asset sync: ${change.id}`);
    pack.imageUrl = change.imageUrl;
    pack.galleryImages = change.galleryImages;
    pack.galleryImageAlts = change.galleryImageAlts;
  }
  for (const change of changedCategories) {
    const category = (state.creativePackCategories ?? []).find((item) => item.id === change.id);
    assert(category, `state category disappeared during asset sync: ${change.id}`);
    category.imageUrl = change.imageUrl;
  }

  await writePlatformStateToSql(state);
  if (updateDb) await updateDatabase(changedPacks, changedCategories);

  console.log(JSON.stringify({
    dryRun: false,
    manifestPath,
    targetSlugs,
    updatedPacks: changedPacks.length,
    updatedCategories: changedCategories.length,
    updateDb
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
