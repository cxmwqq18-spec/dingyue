#!/usr/bin/env node

// Bounded local repair for the EU watch-page publication. This script does
// not copy source content and never writes site_dreamshoot. It only replaces
// explicit Aidreamcapes mirror video references with existing, target-owned
// media and registers those files in the target mediaAsset relation.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const APPLY_LOCAL = process.argv.includes("--apply-local");
const REPORT_ROOT = path.resolve(".tmp", "eu-watch-publication-repair");

const CAPES_ROOT = "/assets/sites/site_aidreamcapes_eu";
const CAPES_PUBLIC_ROOT = path.resolve("public", CAPES_ROOT.slice(1));

const homepageVideo = (name) => `${CAPES_ROOT}/homepage-showcase/videos/${name}.mp4`;
const homepagePoster = (name) => `${CAPES_ROOT}/homepage-showcase/posters/${name}.webp`;
const visualVideo = (slug, name) => `${CAPES_ROOT}/visuals/${slug}/${name}.mp4`;
const visualPoster = (slug) => `${CAPES_ROOT}/visuals/${slug}/${slug}-poster.jpg`;

const THEME_MEDIA = Object.freeze({
  "talking-photo": { video: visualVideo("talking-photo", "talking-photo"), poster: visualPoster("talking-photo"), alt: "Vidéo de portrait parlant créée avec Aidreamcapes." },
  "cinematic-video": { video: visualVideo("cinematic-video", "cinematic-video"), poster: visualPoster("cinematic-video"), alt: "Vidéo cinématographique créée avec Aidreamcapes." },
  "tiktok-video": { video: visualVideo("tiktok-video", "tiktok-video"), poster: visualPoster("tiktok-video"), alt: "Vidéo TikTok créée avec Aidreamcapes." },
  "product-video": { video: visualVideo("product-video", "product-video"), poster: visualPoster("product-video"), alt: "Vidéo de produit créée avec Aidreamcapes." },
  "instagram-reels": { video: visualVideo("instagram-reels", "instagram-reels"), poster: visualPoster("instagram-reels"), alt: "Bobine Instagram créée avec Aidreamcapes." },
  "promo-video": { video: visualVideo("promo-video", "promo-video"), poster: visualPoster("promo-video"), alt: "Vidéo promotionnelle créée avec Aidreamcapes." },
  "music-video": { video: visualVideo("music-video", "music-video"), poster: visualPoster("music-video"), alt: "Clip musical créé avec Aidreamcapes." },
  "product-ad-video": { video: visualVideo("product-ad-video", "product-ad-video"), poster: visualPoster("product-ad-video"), alt: "Publicité vidéo de produit créée avec Aidreamcapes." },

  // These nine rows were archived while their gallery still pointed at a
  // source mirror. Each receives a target-owned video and a target-owned
  // poster, then becomes active so the watch registry can expose it.
  "wedding-memory-film": { video: homepageVideo("heritage-celebration-film"), poster: homepagePoster("heritage-celebration-film"), alt: "Film souvenir de mariage créé avec Aidreamcapes." },
  "cinematic-portrait-motion": { video: homepageVideo("heritage-celebration-film_no_watermark"), poster: homepagePoster("heritage-celebration-film"), alt: "Mouvement de portrait cinématographique créé avec Aidreamcapes." },
  "social-profile-clip": { video: homepageVideo("old-quarter-walkthrough"), poster: homepagePoster("old-quarter-walkthrough"), alt: "Extrait de profil social créé avec Aidreamcapes." },
  "creator-intro-motion": { video: homepageVideo("resort-balcony-motion"), poster: homepagePoster("resort-balcony-motion"), alt: "Présentation de créateur animée créée avec Aidreamcapes." },
  "product-showcase-motion": { video: homepageVideo("route-atlas-motion"), poster: homepagePoster("route-atlas-motion"), alt: "Présentation de produit animée créée avec Aidreamcapes." },
  "creator-scene-motion": { video: homepageVideo("scenic-overlook-pan"), poster: homepagePoster("scenic-overlook-pan"), alt: "Scène de créateur animée créée avec Aidreamcapes." },
  "travel-route-story": { video: homepageVideo("solo-traveler-profile-clip"), poster: homepagePoster("solo-traveler-profile-clip"), alt: "Histoire de voyage animée créée avec Aidreamcapes." },
  "prompt-directed-motion": { video: homepageVideo("solo-traveler-profile-clip_no_watermark"), poster: homepagePoster("solo-traveler-profile-clip"), alt: "Mouvement dirigé par prompt créé avec Aidreamcapes." },
  "holiday-card-motion": { video: visualVideo("instagram-reels", "reels-instagram"), poster: visualPoster("instagram-reels"), alt: "Carte de vœux animée créée avec Aidreamcapes." }
});

const PAGE_MEDIA = Object.freeze({
  "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-20260814.mp4": {
    video: visualVideo("talking-photo", "portrait-parlant"),
    poster: visualPoster("talking-photo"),
    alt: "Tutoriel vidéo de création d’image IA avec Aidreamcapes."
  },
  "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-video-tutorial-20260814.mp4": {
    video: visualVideo("cinematic-video", "video-cinematographique"),
    poster: visualPoster("cinematic-video"),
    alt: "Tutoriel vidéo de création vidéo IA avec Aidreamcapes."
  },
  "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/seasonal/christmas/christmas-hero-family-gift.mp4": {
    video: homepageVideo("alpine-trail-motion"),
    poster: homepagePoster("alpine-trail-motion"),
    alt: "Vidéo de Noël créée avec Aidreamcapes."
  },
  "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/valentines-day/valentines-day-save-the-date.mp4": {
    video: homepageVideo("coastal-memory-clip"),
    poster: homepagePoster("coastal-memory-clip"),
    alt: "Vidéo Save the Date de la Saint-Valentin créée avec Aidreamcapes."
  }
});

const STRING_REPLACEMENTS = new Map([
  ...Object.entries(PAGE_MEDIA).flatMap(([oldVideo, media]) => [[oldVideo, media.video]]),
  ["/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/vendor-api-gpt-image-2-4k-v1/christmas/hero-ai-christmas-family-gift.jpg", homepagePoster("alpine-trail-motion")],
  ["/assets/dreamshoot/seasonal/christmas/hero-ai-christmas-family-gift.jpg", homepagePoster("alpine-trail-motion")],
  ["/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/valentines-day-4k-vendor-v1/hero-valentines-day-save-the-date-city-couple.jpg", homepagePoster("coastal-memory-clip")]
]);

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function rewrite(value) {
  if (typeof value === "string") return STRING_REPLACEMENTS.get(value) ?? value;
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewrite(child)]));
}

function replaceFirstVideo(galleryImages, nextVideo) {
  const gallery = Array.isArray(galleryImages) ? [...galleryImages] : [];
  const index = gallery.findIndex((value) => typeof value === "string" && /\.(?:mp4|webm)(?:[?#]|$)/i.test(value));
  if (index >= 0) gallery[index] = nextVideo;
  else gallery.unshift(nextVideo);
  return gallery;
}

function hashId(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function publicFile(pathname) {
  const clean = pathname.split(/[?#]/)[0];
  const filePath = path.resolve("public", clean.replace(/^\/+/, ""));
  assert(filePath.startsWith(`${CAPES_PUBLIC_ROOT}${path.sep}`), `Asset escaped target root: ${pathname}`);
  assert(fs.existsSync(filePath), `Target-owned asset is missing: ${pathname}`);
  assert(fs.statSync(filePath).isFile(), `Target-owned asset is not a file: ${pathname}`);
  return filePath;
}

function mediaAssetInput(pathname, alt, usageType) {
  const clean = pathname.split(/[?#]/)[0];
  const storageKey = clean.slice(1);
  publicFile(clean);
  return {
    id: `media_${SITE_ID}_watch_${hashId(storageKey)}`,
    siteId: SITE_ID,
    label: path.basename(clean),
    storageKey,
    mimeType: /\.mp4$/i.test(clean) ? "video/mp4" : "image/webp",
    usageType,
    sourceType: "aidreamcapes-eu-watch-local-v1",
    previewUrl: clean,
    originUrl: clean,
    altText: alt,
    notes: "Target-owned watch publication media; never use a source-site mirror URL."
  };
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function walkStrings(value, predicate, output = []) {
  if (typeof value === "string") {
    if (predicate(value)) output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => walkStrings(item, predicate, output));
    return output;
  }
  if (value && typeof value === "object") Object.values(value).forEach((item) => walkStrings(item, predicate, output));
  return output;
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (APPLY_LOCAL) assertNonProductionWriteTarget();

  const prisma = new PrismaClient();
  try {
    const [site, livePages, themePages, themeSettings, videoThemes] = await Promise.all([
      prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themeSettings.findUnique({ where: { siteId: SITE_ID } }),
      prisma.videoTheme.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } })
    ]);
    assert.deepEqual(site, { id: SITE_ID, slug: SITE_SLUG, primaryDomain: "aidreamcapes.eu" }, "Aidreamcapes target identity check failed.");

    const targetVideoThemes = videoThemes
      .filter((theme) => THEME_MEDIA[theme.slug])
      .map((theme) => {
        const media = THEME_MEDIA[theme.slug];
        const nextGalleryImages = replaceFirstVideo(theme.galleryImages, media.video);
        const next = {
          status: "active",
          imageUrl: media.poster,
          galleryImages: nextGalleryImages
        };
        return { theme, media, next, changed: changed({ status: theme.status, imageUrl: theme.imageUrl, galleryImages: theme.galleryImages }, next) };
      });

    const nextLivePages = livePages.map((page) => ({ page, contentJson: rewrite(page.contentJson) })).filter(({ page, contentJson }) => changed(page.contentJson, contentJson));
    const nextThemePages = themePages.map((page) => ({ page, draftJson: rewrite(page.draftJson), publishedJson: rewrite(page.publishedJson) })).filter(({ page, draftJson, publishedJson }) => changed(page.draftJson, draftJson) || changed(page.publishedJson, publishedJson));
    const nextThemeSettings = themeSettings
      ? { row: themeSettings, draftJson: rewrite(themeSettings.draftJson), publishedJson: rewrite(themeSettings.publishedJson) }
      : null;
    const themeSettingsChanged = Boolean(nextThemeSettings && (changed(themeSettings.draftJson, nextThemeSettings.draftJson) || changed(themeSettings.publishedJson, nextThemeSettings.publishedJson)));

    const mediaAssets = [];
    for (const { media } of targetVideoThemes) {
      mediaAssets.push(mediaAssetInput(media.video, media.alt, "watch-video"));
      mediaAssets.push(mediaAssetInput(media.poster, media.alt, "watch-poster"));
    }
    for (const media of Object.values(PAGE_MEDIA)) {
      mediaAssets.push(mediaAssetInput(media.video, media.alt, "watch-video"));
      mediaAssets.push(mediaAssetInput(media.poster, media.alt, "watch-poster"));
    }
    const uniqueMediaAssets = [...new Map(mediaAssets.map((asset) => [asset.storageKey, asset])).values()];

    const report = {
      ok: true,
      mode: APPLY_LOCAL ? "apply-local" : "dry-run",
      siteId: SITE_ID,
      siteDomain: site.primaryDomain,
      themeRowsChecked: targetVideoThemes.length,
      themeRowsChanged: targetVideoThemes.filter((item) => item.changed).map((item) => item.theme.slug),
      activeWatchThemesAfterRepair: targetVideoThemes.length,
      livePagesChanged: nextLivePages.map(({ page }) => page.slug),
      themePagesChanged: nextThemePages.map(({ page }) => page.slug),
      themeSettingsChanged,
      mediaAssetsRegistered: uniqueMediaAssets.length,
      mediaPolicy: "all watch video and poster URLs use /assets/sites/site_aidreamcapes_eu/ and no /mirror/ path",
      sourceWrites: 0
    };

    assert.equal(targetVideoThemes.length, 17, "Expected the complete 17-theme Aidreamcapes video registry.");
    for (const asset of uniqueMediaAssets) assert(asset.storageKey.startsWith(`${CAPES_ROOT.slice(1)}/`), `Media asset escaped target namespace: ${asset.storageKey}`);

    let backupPath;
    if (APPLY_LOCAL) {
      backupPath = path.join(REPORT_ROOT, `backup-before-eu-watch-${timestamp()}.json`);
      writeJson(backupPath, {
        site,
        livePages: nextLivePages.map(({ page }) => page),
        themePages: nextThemePages.map(({ page }) => page),
        themeSettings: themeSettingsChanged ? themeSettings : null,
        videoThemes: targetVideoThemes.map(({ theme }) => theme),
        mediaAssets: uniqueMediaAssets
      });
      await prisma.$transaction(async (tx) => {
        for (const { page, contentJson } of nextLivePages) await tx.livePage.update({ where: { id: page.id }, data: { contentJson } });
        for (const { page, draftJson, publishedJson } of nextThemePages) await tx.themePage.update({ where: { id: page.id }, data: { draftJson, publishedJson } });
        if (themeSettingsChanged && nextThemeSettings) {
          await tx.themeSettings.update({ where: { id: nextThemeSettings.row.id }, data: { draftJson: nextThemeSettings.draftJson, publishedJson: nextThemeSettings.publishedJson } });
        }
        for (const { theme, next } of targetVideoThemes) await tx.videoTheme.update({ where: { id: theme.id }, data: next });
        for (const asset of uniqueMediaAssets) {
          await tx.mediaAsset.upsert({
            where: { siteId_storageKey: { siteId: SITE_ID, storageKey: asset.storageKey } },
            create: asset,
            update: {
              label: asset.label,
              mimeType: asset.mimeType,
              usageType: asset.usageType,
              sourceType: asset.sourceType,
              previewUrl: asset.previewUrl,
              originUrl: asset.originUrl,
              altText: asset.altText,
              notes: asset.notes
            }
          });
        }
      }, { maxWait: 20_000, timeout: 60_000 });
      report.backupPath = backupPath;
    }

    const reportPath = path.join(REPORT_ROOT, `report-eu-watch-${timestamp()}.json`);
    writeJson(reportPath, report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
