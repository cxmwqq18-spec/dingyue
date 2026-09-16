#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const siteId = "site_aidreamcapes_xby";
const outputPath = path.resolve(process.argv[2] || "scripts/data/aidreamcapes-eu-public-content-scope-v1.json");

const sitemapPaths = [
  "/",
  "/ai-image-generation",
  ...[
    "avatar", "background-changer", "background-remover", "bikini", "black-friday", "boudoir", "cannes",
    "christmas-photo", "color-correction", "cyberpunk", "edit-by-prompt", "engagement-photo", "gala-photo",
    "hairstyle-generator", "halloween-photo", "headshot", "holiday", "mafia", "magic-eraser", "motion-generator",
    "nightlife", "old-photo-restoration", "only-fans", "photo-enhancer", "portrait-photo", "portrait-retouch",
    "rich-lifestyle", "singles-awareness-day", "soccer", "social-cards", "street-style", "swimsuit",
    "thanksgiving-photo", "travel", "unblur-image", "urban", "valentines-photo", "virtual-try-on", "wedding-photo"
  ].map((slug) => `/ai-image-generation/${slug}`),
  ...[
    "christmas", "engagement", "fathers-day", "halloween", "mothers-day", "new-year", "proposal",
    "save-the-date", "thanksgiving", "valentines-day", "wedding-ceremony", "wedding-invitation"
  ].map((slug) => `/ai-save-the-date/${slug}`),
  "/ai-video-generation", "/blog", "/blog/video-photo-package-guide",
  "/children-privacy", "/contact-us", "/content", "/cookies", "/digital-delivery", "/privacy", "/refunds",
  "/state-privacy", "/terms", "/tools"
];
const internalPaths = [
  ...[
    "talking-photo", "cinematic-video", "music-video", "fashion-video", "food-video", "pet-video", "tiktok-video",
    "instagram-reels", "youtube-video", "social-media-video", "story-video", "meme-video", "explainer-video",
    "how-to-video", "talking-head-video", "product-video", "product-ad-video", "ugc-ad-video", "promo-video",
    "video-ad", "brand-video"
  ].map((slug) => `/ai-video-generation/${slug}`),
  "/best-save-the-date", "/ai-image-generation/estilo-y-fantasia", "/best-packages", "/workflow", "/pricing",
  "/ai-image-generation/professional", "/ai-image-generation/photo-tools", "/ai-image-generation/lifestyle-creative",
  "/ai-image-generation/magic", "/ai-image-generation/best-themes-presets", "/best-ai-video", "/about-us", "/creators-circle"
];
const publicPaths = new Set([...sitemapPaths, ...internalPaths]);

function collectStrings(value, output = new Set()) {
  if (typeof value === "string") {
    if (value.startsWith("/")) {
      output.add(value);
      output.add(value.split(/[?#]/, 1)[0]);
    }
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return output;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
  return output;
}

function addKeys(entities, entityType, keys) {
  if (!keys.length) return;
  entities[entityType] = { keys: [...new Set(keys)].sort() };
}

const prisma = new PrismaClient();
try {
  const [themePages, livePages, creativePacks, videoThemes, videoThemeCategories, toolCategories, toolMenuItems, themeSettings, storefrontProfile, mediaAssets] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId }, orderBy: { id: "asc" } }),
    prisma.livePage.findMany({ where: { siteId }, orderBy: { id: "asc" } }),
    prisma.creativePack.findMany({ where: { siteId, status: "active" }, orderBy: { id: "asc" } }),
    prisma.videoTheme.findMany({ where: { siteId, status: "active" }, orderBy: { id: "asc" } }),
    prisma.videoThemeCategory.findMany({ where: { siteId }, orderBy: { id: "asc" } }),
    prisma.toolCategory.findMany({ where: { siteId, status: "active" }, orderBy: { id: "asc" } }),
    prisma.toolMenuItem.findMany({ where: { siteId, status: "active" }, orderBy: { id: "asc" } }),
    prisma.themeSettings.findUnique({ where: { siteId } }),
    prisma.storefrontProfile.findUnique({ where: { siteId } }),
    prisma.mediaAsset.findMany({ where: { siteId }, orderBy: { id: "asc" } })
  ]);

  const publicThemePages = themePages.filter((row) => publicPaths.has(row.slug));
  const publicLivePages = livePages.filter((row) => publicPaths.has(row.slug));
  const activeCategoryIds = new Set(videoThemes.map((row) => row.categoryId).filter(Boolean));
  const referencedStrings = new Set();
  [...publicThemePages, ...publicLivePages, ...creativePacks, ...videoThemes, themeSettings, storefrontProfile]
    .filter(Boolean)
    .forEach((row) => collectStrings(row, referencedStrings));
  const referencedMedia = mediaAssets.filter((row) => [row.storageKey, row.previewUrl, row.originUrl]
    .filter((value) => typeof value === "string")
    .some((value) => referencedStrings.has(value) || referencedStrings.has(value.split(/[?#]/, 1)[0])));
  const assetFiles = [...new Set(referencedMedia.flatMap((row) => [row.previewUrl, row.originUrl, row.storageKey]
    .filter((value) => typeof value === "string" && value.startsWith("/"))
    .map((value) => value.replace(/^\/+/, "").split(/[?#]/, 1)[0])
    .filter((value) => /\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(value))
    .map((value) => path.resolve("public", value))
    .filter((value) => fs.existsSync(value) && fs.statSync(value).isFile())
    .map((value) => path.relative(process.cwd(), value))))].sort();

  const entities = {};
  addKeys(entities, "theme_page", publicThemePages.map((row) => row.slug));
  addKeys(entities, "live_page", publicLivePages.map((row) => row.slug));
  addKeys(entities, "creative_pack", creativePacks.map((row) => row.id));
  addKeys(entities, "video_theme", videoThemes.map((row) => row.slug));
  addKeys(entities, "video_theme_category", videoThemeCategories.filter((row) => activeCategoryIds.has(row.id)).map((row) => row.slug));
  addKeys(entities, "tool_category", toolCategories.map((row) => row.slug));
  addKeys(entities, "tool_menu_item", toolMenuItems.map((row) => row.slug));
  addKeys(entities, "theme_settings", themeSettings ? [siteId] : []);
  addKeys(entities, "storefront_profile", storefrontProfile ? [siteId] : []);
  addKeys(entities, "media_asset", referencedMedia.map((row) => row.storageKey));

  const scope = {
    formatVersion: 1,
    siteId,
    purpose: "Aidreamcapes EU public content release; only this site is in scope.",
    entities,
    deletions: [{ entityType: "live_page", keys: ["/ai-save-the-date/easter"], reason: "retired_public_route" }]
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(scope, null, 2)}\n`);
  if (process.argv.includes("--asset-list")) {
    process.stdout.write(assetFiles.join("\0"));
  } else {
    console.log(JSON.stringify({
      ok: true,
      outputPath,
      publicPaths: publicPaths.size,
      themePages: publicThemePages.length,
      livePages: publicLivePages.length,
      creativePacks: creativePacks.length,
      videoThemes: videoThemes.length,
      mediaAssets: referencedMedia.length,
      assetFiles: assetFiles.length
    }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
