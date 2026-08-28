#!/usr/bin/env node
import assert from "node:assert/strict";
import createJiti from "jiti";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const dryRun = process.argv.includes("--dry-run");
const jiti = createJiti(import.meta.url);
const {
  mydreamshootsVideoGenerationCategoriesForSite,
  mydreamshootsVideoGenerationParentCategoriesForSite,
  parentVideoGenerationCategorySlugForChild
} = jiti("../src/lib/mydreamshoots-video-framework.ts");
const mydreamshootsVideoGenerationCategories = mydreamshootsVideoGenerationCategoriesForSite(siteId);
const mydreamshootsVideoGenerationParentCategories = mydreamshootsVideoGenerationParentCategoriesForSite(siteId);
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const parentBySlug = new Map(mydreamshootsVideoGenerationParentCategories.map((row) => [row.slug, row]));
const categoryBySlug = new Map(mydreamshootsVideoGenerationCategories.map((row) => [row.slug, row]));
const parentSlugByChild = {
  "text-to-video": "core-ai-creation",
  "image-to-video": "core-ai-creation",
  "talking-photo": "core-ai-creation",
  "photo-animation": "core-ai-creation",
  "photo-slideshow-video": "core-ai-creation",
  "cinematic-video": "core-ai-creation",
  "tiktok-video": "social-creator",
  "instagram-reels": "social-creator",
  "youtube-shorts": "social-creator",
  "youtube-video": "social-creator",
  "social-media-video": "social-creator",
  "story-video": "social-creator",
  "meme-video": "social-creator",
  "product-video": "marketing-commerce",
  "product-demo-video": "marketing-commerce",
  "product-ad-video": "marketing-commerce",
  "ugc-ad-video": "marketing-commerce",
  "promo-video": "marketing-commerce",
  "video-ad": "marketing-commerce",
  "brand-video": "marketing-commerce",
  "music-video": "creative-lifestyle",
  "travel-video": "creative-lifestyle",
  "fashion-video": "creative-lifestyle",
  "food-video": "creative-lifestyle",
  "fitness-video": "creative-lifestyle",
  "pet-video": "creative-lifestyle",
  "explainer-video": "professional-business",
  "how-to-video": "professional-business",
  "real-estate-video": "professional-business",
  "corporate-video": "professional-business",
  "ai-avatar-video": "professional-business",
  "talking-head-video": "professional-business",
  "portrait-motion": "core-ai-creation",
  "creator-motion": "social-creator",
  "travel-story": "creative-lifestyle",
  "edit-by-prompt": "core-ai-creation",
  "social-cards": "social-creator",
  "wedding-memory": "creative-lifestyle",
  "product-teaser": "marketing-commerce",
  "profile-clip": "social-creator",
  "fan-poster-motion": "social-creator",
  "creator-intro-video": "social-creator",
  "product-teaser-clip": "marketing-commerce",
  "animated-avatar": "professional-business",
  "fashion-reel": "creative-lifestyle",
  "album-story-video": "creative-lifestyle"
};
for (const category of mydreamshootsVideoGenerationCategories) {
  const parentSlug = parentVideoGenerationCategorySlugForChild(category.slug);
  if (parentSlug) parentSlugByChild[category.slug] = parentSlug;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const platformDocument = await prisma.platformStateDocument.findUnique({ where: { id: "platform" } });
assert.ok(platformDocument?.state && typeof platformDocument.state === "object", "PostgreSQL platform state document must exist");
const state = clone(platformDocument.state);
const photoCategorySnapshot = JSON.stringify((state.creativePackCategories ?? []).filter((row) => row.siteId === siteId));
const photoThemeSnapshot = JSON.stringify((state.creativePacks ?? []).filter((row) => row.siteId === siteId));
const now = new Date().toISOString();

try {
  const dbCategories = dryRun
    ? await prisma.videoThemeCategory.findMany({ where: { siteId }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] })
    : await prisma.$transaction(async (tx) => {
    const ids = new Map();
    for (const parent of mydreamshootsVideoGenerationParentCategories) {
      const row = await tx.videoThemeCategory.upsert({
        where: { siteId_slug: { siteId, slug: parent.slug } },
        create: { id: `video_cat_${siteId}_${parent.slug.replaceAll("-", "_")}`, siteId, slug: parent.slug, label: parent.label, description: parent.description, sortOrder: parent.sortOrder, status: "active", parentId: null },
        update: { label: parent.label, description: parent.description, sortOrder: parent.sortOrder, status: "active", parentId: null }
      });
      ids.set(parent.slug, row.id);
    }
    for (const category of mydreamshootsVideoGenerationCategories) {
      const parentSlug = parentSlugByChild[category.slug];
      await tx.videoThemeCategory.upsert({
        where: { siteId_slug: { siteId, slug: category.slug } },
        create: { id: `video_cat_${siteId}_${category.slug.replaceAll("-", "_")}`, siteId, slug: category.slug, label: category.label, description: category.description, sortOrder: category.sortOrder, status: "active", parentId: ids.get(parentSlug) ?? null },
        update: { label: category.label, description: category.description, sortOrder: category.sortOrder, status: "active", parentId: ids.get(parentSlug) ?? null }
      });
    }
    for (const [slug, parentSlug] of Object.entries(parentSlugByChild)) {
      if (parentBySlug.has(slug) || categoryBySlug.has(slug)) continue;
      const parentId = ids.get(parentSlug);
      if (parentId) await tx.videoThemeCategory.updateMany({ where: { siteId, slug }, data: { parentId } });
    }
    return tx.videoThemeCategory.findMany({ where: { siteId }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
    });

  const existing = new Map((state.videoThemeCategories ?? []).filter((row) => row.siteId === siteId).map((row) => [row.slug, row]));
  const rows = [];
  for (const parent of mydreamshootsVideoGenerationParentCategories) {
    const current = existing.get(parent.slug);
    const db = dbCategories.find((row) => row.slug === parent.slug);
    rows.push({ ...(current ?? {}), id: db?.id ?? current?.id ?? `video_cat_${siteId}_${parent.slug.replaceAll("-", "_")}`, siteId, slug: parent.slug, label: parent.label, description: parent.description, sortOrder: parent.sortOrder, status: "active", parentId: null, createdAt: current?.createdAt ?? now, updatedAt: now });
  }
  for (const category of mydreamshootsVideoGenerationCategories) {
    const current = existing.get(category.slug);
    const db = dbCategories.find((row) => row.slug === category.slug);
    const parentSlug = parentSlugByChild[category.slug];
    const parent = dbCategories.find((row) => row.slug === parentSlug);
    rows.push({ ...(current ?? {}), id: db?.id ?? current?.id ?? `video_cat_${siteId}_${category.slug.replaceAll("-", "_")}`, siteId, slug: category.slug, label: category.label, description: category.description, sortOrder: category.sortOrder, status: "active", parentId: parent?.id ?? null, createdAt: current?.createdAt ?? now, updatedAt: now });
  }
  const legacyRows = (state.videoThemeCategories ?? [])
    .filter((row) => row.siteId === siteId && parentSlugByChild[row.slug] && !parentBySlug.has(row.slug) && !categoryBySlug.has(row.slug))
    .map((row) => ({ ...row, parentId: dbCategories.find((category) => category.slug === parentSlugByChild[row.slug])?.id ?? null, updatedAt: now }));
  const untouched = (state.videoThemeCategories ?? []).filter((row) => row.siteId !== siteId || (!parentBySlug.has(row.slug) && !categoryBySlug.has(row.slug) && !parentSlugByChild[row.slug]));
  rows.push(...legacyRows);
  state.videoThemeCategories = [...untouched, ...rows];
  assert.equal(JSON.stringify((state.creativePackCategories ?? []).filter((row) => row.siteId === siteId)), photoCategorySnapshot, "photo categories changed unexpectedly");
  assert.equal(JSON.stringify((state.creativePacks ?? []).filter((row) => row.siteId === siteId)), photoThemeSnapshot, "photo themes changed unexpectedly");
  if (!dryRun) await prisma.platformStateDocument.update({ where: { id: "platform" }, data: { state } });
  console.log(JSON.stringify({ ok: true, dryRun, siteId, parents: mydreamshootsVideoGenerationParentCategories.length, children: mydreamshootsVideoGenerationCategories.length, databaseRows: dbCategories.length, photoDataPreserved: true }, null, 2));
} finally {
  await prisma.$disconnect();
}
