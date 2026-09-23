#!/usr/bin/env node

// Replace the eight French storefront video-topic assets with user-supplied
// local videos. The migration is deliberately limited to site_aidreamcapes_xby
// and the exact eight public video themes requested for aidreamcapes.eu.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const ASSET_ROOT = "/assets/sites/site_aidreamcapes_eu/visuals";
const DEFAULT_SOURCE_DIR = "/Users/a1/Downloads/法语";
const BACKUP_ROOT = path.resolve(".tmp/aidreamcapes-eu-video-media-replacement");
const APPLY_LOCAL = process.argv.includes("--apply-local");
const APPLY_PRODUCTION = process.argv.includes("--apply-production");
const APPLY = APPLY_LOCAL || APPLY_PRODUCTION;
const PRODUCTION_CONFIRMATION = "aidreamcapes-eu-video-media-replacement";

const topics = Object.freeze([
  {
    slug: "talking-photo",
    source: "minimax-h3-cbd210c9-12b2-4bbd-be2f-33ad76c2796a.mp4",
    alt: "Vidéo de photo parlante montrant un portrait qui s’adresse à la caméra.",
  },
  {
    slug: "cinematic-video",
    source: "minimax-h3-011c55bb-4e9c-4cc3-8108-314185bb6c48.mp4",
    alt: "Vidéo cinématographique illustrant une scène narrative avec une lumière dramatique.",
  },
  {
    slug: "music-video",
    source: "minimax-h3-7c61fcbd-f7ee-4639-b41d-da96ee6a05ee.mp4",
    alt: "Clip vidéo musical montrant une interprétation d’artiste sous des lumières de scène.",
  },
  {
    slug: "tiktok-video",
    source: "minimax-h3-f30ad414-e4aa-4263-b27b-2779708c4996.mp4",
    alt: "Vidéo TikTok horizontale présentant une création courte pensée pour le format mobile.",
  },
  {
    slug: "product-video",
    source: "minimax-h3-1c75b27a-6fef-48f4-ad75-d1cbfebc0578.mp4",
    alt: "Vidéo produit montrant un article dans une présentation commerciale soignée.",
  },
  {
    slug: "promo-video",
    source: "minimax-h3-60aa1733-cab2-4564-be80-d706d0f3626b.mp4",
    alt: "Vidéo promotionnelle annonçant un lancement ou une offre avec un appel à l’action.",
  },
  {
    slug: "product-ad-video",
    source: "minimax-h3-febe259a-baca-4b9b-9f50-0f9be8de553a.mp4",
    alt: "Publicité vidéo produit mettant en scène une démonstration orientée vers une décision d’achat.",
  },
  {
    slug: "instagram-reels",
    source: "minimax-h3-db5ff954-7ae1-4ccc-94e3-1a3ce7881326.mp4",
    alt: "Instagram Reel horizontal présentant une histoire visuelle conçue pour le fil mobile.",
  },
]);

function argumentValue(prefix, fallback) {
  const value = process.argv.find((arg) => arg.startsWith(`${prefix}=`));
  return value ? value.slice(prefix.length + 1) : fallback;
}

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function stripQuery(value) {
  return String(value ?? "").split(/[?#]/)[0];
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function topicUrl(topic) {
  return `${ASSET_ROOT}/${topic.slug}/${topic.slug}.mp4`;
}

function topicPosterUrl(topic) {
  return `${ASSET_ROOT}/${topic.slug}/${topic.slug}-poster.jpg`;
}

function topicStorageKey(topic) {
  return topicUrl(topic).slice(1);
}

function sourcePathFor(topic, sourceDir) {
  return path.resolve(sourceDir, topic.source);
}

function destinationPathFor(topic) {
  const filePath = path.resolve("public", topicUrl(topic).slice(1));
  const publicRoot = path.resolve("public");
  assert(filePath.startsWith(`${publicRoot}${path.sep}`), `${topic.slug}: asset path escaped public root`);
  return filePath;
}

function destinationPosterPathFor(topic) {
  const filePath = path.resolve("public", topicPosterUrl(topic).slice(1));
  const publicRoot = path.resolve("public");
  assert(filePath.startsWith(`${publicRoot}${path.sep}`), `${topic.slug}: poster path escaped public root`);
  return filePath;
}

function isVideoObject(value, oldUrl) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.src === oldUrl);
}

function isImageObject(value, oldUrl) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.src === oldUrl);
}

function rewriteVideoJson(value, oldVideoUrl, nextVideoUrl, oldImageUrl, nextPosterUrl, alt) {
  if (Array.isArray(value)) return value.map((item) => rewriteVideoJson(item, oldVideoUrl, nextVideoUrl, oldImageUrl, nextPosterUrl, alt));
  if (!value || typeof value !== "object") {
    if (value === oldVideoUrl) return nextVideoUrl;
    if (value === oldImageUrl) return nextPosterUrl;
    return value;
  }
  const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteVideoJson(item, oldVideoUrl, nextVideoUrl, oldImageUrl, nextPosterUrl, alt)]));
  if (isVideoObject(value, oldVideoUrl)) {
    next.src = nextVideoUrl;
    next.alt = alt;
    // The current production renderer reads `label` for the video element's
    // accessible name. Keep it aligned with the descriptive alt text so both
    // old and new French storefront renderers expose the topic description.
    next.label = alt;
    next.width = 1344;
    next.height = 768;
    next.fit = "contain";
    next.poster = nextPosterUrl;
  } else if (isImageObject(value, oldImageUrl)) {
    next.src = nextPosterUrl;
    next.alt = alt;
    next.width = 1344;
    next.height = 768;
    next.fit = "contain";
  }
  return next;
}

function replaceVideoThemeGallery(galleryImages, oldUrl, nextUrl) {
  if (!Array.isArray(galleryImages)) return galleryImages;
  return galleryImages.map((value) => value === oldUrl ? nextUrl : value);
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function validateSourceFiles(sourceDir) {
  return topics.map((topic) => {
    const sourcePath = sourcePathFor(topic, sourceDir);
    const posterPath = destinationPosterPathFor(topic);
    assert(fs.existsSync(sourcePath), `${topic.slug}: source video is missing: ${sourcePath}`);
    const stat = fs.statSync(sourcePath);
    assert(stat.isFile(), `${topic.slug}: source path is not a file: ${sourcePath}`);
    assert(stat.size > 1024, `${topic.slug}: source video is unexpectedly small`);
    assert(fs.existsSync(posterPath), `${topic.slug}: poster image is missing: ${posterPath}`);
    const posterStat = fs.statSync(posterPath);
    assert(posterStat.isFile() && posterStat.size > 1024, `${topic.slug}: poster image is unexpectedly small`);
    return { topic, sourcePath, posterPath, bytes: stat.size, posterBytes: posterStat.size, sha256: sha256(fs.readFileSync(sourcePath)), posterSha256: sha256(fs.readFileSync(posterPath)) };
  });
}

function copyVideo(sourcePath, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  if (fs.existsSync(destinationPath)) {
    const existing = fs.readFileSync(destinationPath);
    const incoming = fs.readFileSync(sourcePath);
    assert.equal(sha256(existing), sha256(incoming), `Refusing to overwrite a different asset: ${destinationPath}`);
    return false;
  }
  const pending = `${destinationPath}.pending`;
  fs.copyFileSync(sourcePath, pending);
  fs.renameSync(pending, destinationPath);
  return true;
}

function dedicatedContentJson(json) {
  const sections = json?.sections ?? {};
  const entry = Object.entries(sections).find(([, section]) => ["ai_video_topic_landing", "talking_photo_landing"].includes(section?.type));
  return entry ? entry[1]?.settings?.content : undefined;
}

async function main() {
  assert.equal(!(APPLY_LOCAL && APPLY_PRODUCTION), true, "Choose exactly one apply target.");
  const target = APPLY_PRODUCTION ? "production" : "local";
  const sourceDir = argumentValue("--source-dir", DEFAULT_SOURCE_DIR);
  const sourceFiles = APPLY_PRODUCTION
    ? topics.map((topic) => {
        const sourcePath = destinationPathFor(topic);
        const posterPath = destinationPosterPathFor(topic);
        assert(fs.existsSync(sourcePath), `${topic.slug}: production asset is missing from the release: ${sourcePath}`);
        const stat = fs.statSync(sourcePath);
        assert(stat.isFile() && stat.size > 1024, `${topic.slug}: production asset is unexpectedly small`);
        assert(fs.existsSync(posterPath), `${topic.slug}: production poster is missing from the release: ${posterPath}`);
        const posterStat = fs.statSync(posterPath);
        assert(posterStat.isFile() && posterStat.size > 1024, `${topic.slug}: production poster is unexpectedly small`);
        return { topic, sourcePath, posterPath, bytes: stat.size, posterBytes: posterStat.size, sha256: sha256(fs.readFileSync(sourcePath)), posterSha256: sha256(fs.readFileSync(posterPath)) };
      })
    : validateSourceFiles(sourceDir);

  assertDatabaseTarget({
    expectedTarget: target,
    requireProductionConfirmation: APPLY_PRODUCTION,
    productionConfirmed: process.argv.includes(`--confirm=${PRODUCTION_CONFIRMATION}`),
  });
  if (APPLY_LOCAL) assertNonProductionWriteTarget();
  if (APPLY_PRODUCTION) {
    assert(process.argv.includes(`--confirm=${PRODUCTION_CONFIRMATION}`), `Production apply requires --confirm=${PRODUCTION_CONFIRMATION}`);
  }

  const prisma = new PrismaClient();
  try {
    const slugs = topics.map((topic) => topic.slug);
    const pageSlugs = slugs.map((slug) => `/ai-video-generation/${slug}`);
    const [site, livePages, themePages, videoThemes, mediaAssets] = await Promise.all([
      prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: pageSlugs } }, select: { id: true, siteId: true, slug: true, contentJson: true } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: pageSlugs } }, select: { id: true, siteId: true, slug: true, draftJson: true, publishedJson: true } }),
      prisma.videoTheme.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } }, select: { id: true, siteId: true, slug: true, imageUrl: true, galleryImages: true } }),
      prisma.mediaAsset.findMany({ where: { siteId: SITE_ID, mimeType: "video/mp4" }, select: { id: true, siteId: true, label: true, storageKey: true, mimeType: true, usageType: true, sourceType: true, previewUrl: true, originUrl: true, altText: true } }),
    ]);
    assert.deepEqual(site, { id: SITE_ID, slug: SITE_SLUG, primaryDomain: "aidreamcapes.eu" }, "French storefront identity check failed.");
    assert.equal(livePages.length, topics.length, "Expected all eight French live topic pages.");
    assert.equal(videoThemes.length, topics.length, "Expected all eight French video themes.");

    const liveBySlug = new Map(livePages.map((page) => [page.slug, page]));
    const themeBySlug = new Map(themePages.map((page) => [page.slug, page]));
    const videoThemeBySlug = new Map(videoThemes.map((theme) => [theme.slug, theme]));
    const mediaByStorageKey = new Map(mediaAssets.map((asset) => [asset.storageKey, asset]));
    const updates = [];

    for (const { topic, sourcePath, posterPath, bytes, posterBytes, sha256: sourceHash, posterSha256 } of sourceFiles) {
      const pageSlug = `/ai-video-generation/${topic.slug}`;
      const liveContent = dedicatedContentJson(liveBySlug.get(pageSlug)?.contentJson);
      const oldUrl = liveContent?.hero?.video?.src;
      const oldImageUrl = liveContent?.hero?.image?.src;
      assert(typeof oldUrl === "string" && oldUrl.endsWith(".mp4"), `${topic.slug}: live hero video URL is missing`);
      assert(typeof oldImageUrl === "string" && /\.(?:avif|jpe?g|png|webp)(?:[?#]|$)/i.test(oldImageUrl), `${topic.slug}: live hero image URL is missing`);
      const nextUrl = topicUrl(topic);
      const nextPosterUrl = topicPosterUrl(topic);
      const live = liveBySlug.get(pageSlug);
      const theme = themeBySlug.get(pageSlug);
      const videoTheme = videoThemeBySlug.get(topic.slug);
      assert(live && videoTheme, `${topic.slug}: required database rows are missing`);

      const nextLiveJson = rewriteVideoJson(live.contentJson, oldUrl, nextUrl, oldImageUrl, nextPosterUrl, topic.alt);
      const nextDraftJson = theme ? rewriteVideoJson(theme.draftJson, oldUrl, nextUrl, oldImageUrl, nextPosterUrl, topic.alt) : undefined;
      const nextPublishedJson = theme ? rewriteVideoJson(theme.publishedJson, oldUrl, nextUrl, oldImageUrl, nextPosterUrl, topic.alt) : undefined;
      const nextGalleryImages = replaceVideoThemeGallery(videoTheme.galleryImages, oldUrl, nextUrl);
      const nextVideoThemeImageUrl = nextPosterUrl;
      assert(JSON.stringify(nextLiveJson).includes(nextUrl), `${topic.slug}: live page did not receive new video URL`);
      assert(JSON.stringify(nextLiveJson).includes(nextPosterUrl), `${topic.slug}: live page did not receive new poster URL`);
      assert(JSON.stringify(nextGalleryImages).includes(nextUrl), `${topic.slug}: homepage video theme did not receive new video URL`);
      assert(nextVideoThemeImageUrl === nextPosterUrl, `${topic.slug}: homepage video theme did not receive new poster URL`);

      const media = mediaByStorageKey.get(oldUrl.replace(/^\//, ""))
        || mediaAssets.find((asset) => asset.previewUrl === oldUrl || asset.originUrl === oldUrl);
      assert(media, `${topic.slug}: media asset row for old video URL is missing`);
      const nextMedia = {
        ...media,
        label: `Vidéo ${topic.slug}`,
        storageKey: topicStorageKey(topic),
        previewUrl: nextUrl,
        originUrl: nextUrl,
        altText: topic.alt,
      };
      updates.push({ topic, sourcePath, posterPath, sourceBytes: bytes, posterBytes, sourceHash, posterSha256, oldUrl, oldImageUrl, nextUrl, nextPosterUrl, live, theme, videoTheme, nextLiveJson, nextDraftJson, nextPublishedJson, nextGalleryImages, nextVideoThemeImageUrl, media, nextMedia });
    }

    const summary = {
      ok: true,
      mode: APPLY_PRODUCTION ? "apply-production" : APPLY_LOCAL ? "apply-local" : "dry-run",
      target: { siteId: SITE_ID, siteSlug: SITE_SLUG, domain: site.primaryDomain },
      sourceDir,
      topics: updates.map(({ topic, sourceBytes, posterBytes, sourceHash, posterSha256, oldUrl, oldImageUrl, nextUrl, nextPosterUrl, media, nextMedia }) => ({
        slug: topic.slug,
        source: topic.source,
        sourceBytes,
        sourceSha256: sourceHash,
        posterBytes,
        posterSha256,
        oldUrl,
        oldImageUrl,
        newUrl: nextUrl,
        newPosterUrl: nextPosterUrl,
        alt: topic.alt,
        mediaAssetId: media.id,
        oldStorageKey: media.storageKey,
        newStorageKey: nextMedia.storageKey,
      })),
      changedLivePages: updates.filter(({ live, nextLiveJson }) => changed(live.contentJson, nextLiveJson)).length,
      changedThemeDrafts: updates.filter(({ theme, nextDraftJson }) => theme && changed(theme.draftJson, nextDraftJson)).length,
      changedThemePublished: updates.filter(({ theme, nextPublishedJson }) => theme && changed(theme.publishedJson, nextPublishedJson)).length,
      changedVideoThemes: updates.filter(({ videoTheme, nextGalleryImages, nextVideoThemeImageUrl }) => changed({ imageUrl: videoTheme.imageUrl, galleryImages: videoTheme.galleryImages }, { imageUrl: nextVideoThemeImageUrl, galleryImages: nextGalleryImages })).length,
      changedMediaAssets: updates.filter(({ media, nextMedia }) => changed(media, nextMedia)).length,
      copiedAssets: 0,
    };

    if (!APPLY) {
      const reportPath = path.join(BACKUP_ROOT, `dry-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(reportPath, summary);
      console.log(JSON.stringify({ ...summary, reportPath }, null, 2));
      return;
    }

    const backupPath = path.join(BACKUP_ROOT, `backup-before-video-media-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(backupPath, {
      createdAt: new Date().toISOString(),
      target: { siteId: SITE_ID, siteSlug: SITE_SLUG, database: target },
      livePages: updates.map(({ live }) => live),
      themePages: updates.filter(({ theme }) => theme).map(({ theme }) => theme),
      videoThemes: updates.map(({ videoTheme }) => videoTheme),
      mediaAssets: updates.map(({ media }) => media),
    });

    if (APPLY_LOCAL) {
      for (const item of updates) {
        const destinationPath = destinationPathFor(item.topic);
        item.copied = copyVideo(item.sourcePath, destinationPath);
        assert(fs.existsSync(destinationPath), `${item.topic.slug}: destination video is missing after copy`);
        assert(fs.existsSync(item.posterPath), `${item.topic.slug}: destination poster is missing after copy`);
        summary.copiedAssets += item.copied ? 1 : 0;
      }
    } else {
      for (const item of updates) {
        assert(fs.existsSync(destinationPathFor(item.topic)), `${item.topic.slug}: production asset is missing from the release`);
        assert(fs.existsSync(item.posterPath), `${item.topic.slug}: production poster is missing from the release`);
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const item of updates) {
        await tx.livePage.update({ where: { id: item.live.id }, data: { contentJson: item.nextLiveJson, updatedAt: new Date() } });
        if (item.theme && changed(item.theme.draftJson, item.nextDraftJson) || item.theme && changed(item.theme.publishedJson, item.nextPublishedJson)) {
          await tx.themePage.update({ where: { id: item.theme.id }, data: { draftJson: item.nextDraftJson, publishedJson: item.nextPublishedJson, updatedAt: new Date() } });
        }
        await tx.videoTheme.update({ where: { id: item.videoTheme.id }, data: { imageUrl: item.nextVideoThemeImageUrl, galleryImages: item.nextGalleryImages, updatedAt: new Date() } });
        await tx.mediaAsset.update({ where: { id: item.media.id }, data: { label: item.nextMedia.label, storageKey: item.nextMedia.storageKey, previewUrl: item.nextMedia.previewUrl, originUrl: item.nextMedia.originUrl, altText: item.nextMedia.altText, updatedAt: new Date() } });
      }
    }, { maxWait: 20_000, timeout: 60_000 });

    summary.backupPath = backupPath;
    const reportPath = path.join(BACKUP_ROOT, `apply-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(reportPath, summary);
    console.log(JSON.stringify({ ...summary, reportPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
