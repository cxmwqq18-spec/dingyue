#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const root = process.cwd();
const publicRoot = path.join(root, "public");
const cleanRoot = path.join(root, "public/assets/dreamshoot/generated/video-topic-clean");
const legacyPattern = /\/assets\/dreamshoot\/(?:tiktok-video|instagram-reels|social-media-video|story-video)\/[^"?#]+\.(?:png|jpe?g|webp)(?:[?#]|$)/i;
const topics = ["tiktok-video", "instagram-reels", "social-media-video", "story-video"];
const publicVideoTopicSlugs = [
  "talking-photo", "cinematic-video", "tiktok-video", "instagram-reels", "social-media-video", "youtube-video",
  "story-video", "meme-video", "product-video", "product-ad-video", "promo-video", "ugc-ad-video",
  "video-ad", "brand-video", "music-video", "fashion-video", "food-video", "pet-video", "explainer-video",
  "how-to-video", "talking-head-video"
];
const perceptualSize = 32;
// Re-encoding and small crop changes stay below this value; distinct images do not.
const duplicateMeanAbsoluteError = 6;
const youtubeCardAssetMap = {
  "youtube-card-01": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-01.webp",
  "youtube-card-02": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-02.webp",
  "youtube-card-03": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-03.webp",
  "youtube-card-04": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-04.webp",
  "youtube-card-05": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-05.webp",
  "youtube-card-06": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-06.webp"
};
const youtubeAssetMap = {
  ...youtubeCardAssetMap,
  "youtube-video-full-tutorial": youtubeCardAssetMap["youtube-card-01"],
  "youtube-video-review-comparison": youtubeCardAssetMap["youtube-card-02"],
  "youtube-video-interview-conversation": youtubeCardAssetMap["youtube-card-03"],
  "youtube-video-case-study": youtubeCardAssetMap["youtube-card-04"],
  "youtube-video-webinar-recap": youtubeCardAssetMap["youtube-card-05"],
  "youtube-video-series-episode": youtubeCardAssetMap["youtube-card-06"],
  "youtube-video-01": youtubeCardAssetMap["youtube-card-04"],
  "youtube-video-02": youtubeCardAssetMap["youtube-card-01"],
  "youtube-video-03": youtubeCardAssetMap["youtube-card-01"],
  "youtube-video-04": youtubeCardAssetMap["youtube-card-03"],
  "youtube-video-05": youtubeCardAssetMap["youtube-card-02"],
  "youtube-video-06": youtubeCardAssetMap["youtube-card-06"],
  "youtube-video-07": youtubeCardAssetMap["youtube-card-05"]
};
const prisma = new PrismaClient();

function imageUrlsIn(value, found = new Set()) {
  if (typeof value === "string") {
    const cleanUrl = value.split(/[?#]/, 1)[0];
    if (/^\/assets\/.*\.(?:png|jpe?g|webp)$/i.test(cleanUrl)) found.add(cleanUrl);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) imageUrlsIn(item, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) imageUrlsIn(item, found);
  }
  return found;
}

function renderedAssetUrl(url) {
  const youtubeAsset = url.match(/^\/assets\/dreamshoot\/youtube-video\/([^/?#]+)\.(?:png|jpe?g|webp)$/i);
  if (youtubeAsset && youtubeAssetMap[youtubeAsset[1].toLowerCase()]) return youtubeAssetMap[youtubeAsset[1].toLowerCase()];
  const webpUrl = url.replace(/\.png$/i, ".webp");
  return webpUrl !== url && fs.existsSync(path.join(publicRoot, webpUrl)) ? webpUrl : url;
}

function meanAbsoluteError(left, right) {
  assert.equal(left.length, right.length, "perceptual fingerprints must have equal dimensions");
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference += Math.abs(left[index] - right[index]);
  return difference / left.length;
}

async function perceptualAssetFingerprint(url) {
  const assetPath = path.join(publicRoot, url);
  assert.equal(fs.existsSync(assetPath), true, `missing_referenced_video_topic_asset:${url}`);
  const source = fs.readFileSync(assetPath);
  try {
    return {
      byteHash: crypto.createHash("sha256").update(source).digest("hex"),
      pixels: await sharp(source)
        .rotate()
        .resize(perceptualSize, perceptualSize, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer()
    };
  } catch (error) {
    throw new Error(`unreadable_referenced_video_topic_asset:${url}`, { cause: error });
  }
}

try {
  const themes = await prisma.videoTheme.findMany({
    where: { siteId, slug: { in: publicVideoTopicSlugs } },
    select: { slug: true, imageUrl: true, galleryImages: true }
  });
  const publicTopicSlugs = new Set(themes.map((theme) => theme.slug));
  const pages = await prisma.livePage.findMany({
    where: { siteId, slug: { in: [...publicTopicSlugs].map((slug) => `/ai-video-generation/${slug}`) } },
    select: { slug: true, contentJson: true }
  });
  assert.equal(pages.length, publicTopicSlugs.size, "every public video topic must have a LivePage row");
  const references = [...pages.flatMap((page) => [...imageUrlsIn(page.contentJson)]), ...themes.flatMap((theme) => [theme.imageUrl, ...(theme.galleryImages ?? [])])];
  assert.equal(references.some((url) => legacyPattern.test(url) && !/^(?:\/assets\/dreamshoot\/(?:tiktok-video|instagram-reels)\/turn-(?:your-photos-and-ideas-into-tiktok-first-videos|photos-and-ideas-into-reels-that-fit-your-feed)\.webp)$/i.test(url)), false, "video topic pages and directory themes must not reference legacy blurred assets");

  const assetOwners = new Map();
  function registerAsset(topic, rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.startsWith("/assets/")) return;
    const cleanUrl = rawUrl.split(/[?#]/, 1)[0];
    if (!/\.(?:png|jpe?g|webp)$/i.test(cleanUrl)) return;
    const url = renderedAssetUrl(cleanUrl);
    const owners = assetOwners.get(url) ?? new Set();
    owners.add(topic);
    assetOwners.set(url, owners);
  }
  for (const page of pages) {
    const topic = page.slug.slice("/ai-video-generation/".length);
    for (const url of imageUrlsIn(page.contentJson)) registerAsset(topic, url);
  }
  for (const theme of themes) {
    registerAsset(theme.slug, theme.imageUrl);
    for (const url of theme.galleryImages ?? []) registerAsset(theme.slug, url);
  }
  for (const topic of publicVideoTopicSlugs) {
    const topicDirectory = path.join(publicRoot, "assets/dreamshoot", topic);
    if (!fs.existsSync(topicDirectory)) continue;
    const preferredByBaseName = new Map();
    for (const file of fs.readdirSync(topicDirectory).filter((name) => /\.(?:png|jpe?g|webp)$/i.test(name)).sort()) {
      const baseName = file.replace(/\.[^.]+$/, "");
      const current = preferredByBaseName.get(baseName);
      if (!current || file.endsWith(".webp")) preferredByBaseName.set(baseName, file);
    }
    for (const file of preferredByBaseName.values()) registerAsset(topic, `/assets/dreamshoot/${topic}/${file}`);
  }

  const assets = await Promise.all([...assetOwners].map(async ([url, owners]) => ({
    url,
    owners: [...owners].sort(),
    fingerprint: await perceptualAssetFingerprint(url)
  })));
  const duplicateGroups = [];
  for (const asset of assets) {
    if (asset.owners.length > 1) {
      duplicateGroups.push({ left: asset.url, right: asset.url, owners: asset.owners, exact: true, meanAbsoluteError: 0 });
    }
  }
  for (let leftIndex = 0; leftIndex < assets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < assets.length; rightIndex += 1) {
      const left = assets[leftIndex];
      const right = assets[rightIndex];
      if (left.owners.every((owner) => right.owners.includes(owner)) && right.owners.every((owner) => left.owners.includes(owner))) continue;
      const pixelError = meanAbsoluteError(left.fingerprint.pixels, right.fingerprint.pixels);
      if (pixelError > duplicateMeanAbsoluteError) continue;
      duplicateGroups.push({
        left: left.url,
        right: right.url,
        leftOwners: left.owners,
        rightOwners: right.owners,
        exact: left.fingerprint.byteHash === right.fingerprint.byteHash,
        meanAbsoluteError: Number(pixelError.toFixed(3))
      });
    }
  }
  assert.deepEqual(
    duplicateGroups,
    [],
    `video topic media must be visually exclusive to one topic; found ${duplicateGroups.length} cross-topic duplicate pairs:\n${JSON.stringify(duplicateGroups, null, 2)}`
  );

  const files = [];
  for (const topic of topics) {
    const directory = path.join(cleanRoot, topic);
    assert.equal(fs.existsSync(directory), true, `missing_clean_topic_directory:${topic}`);
    for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".webp"))) {
      const metadata = await sharp(path.join(directory, file)).metadata();
      assert.equal(`${metadata.width}x${metadata.height}`, "1600x900", `clean media must use a sharp 16:9 frame: ${topic}/${file}`);
      files.push(`${topic}/${file}`);
    }
  }
  assert.ok(files.length >= 35, `expected all legacy topic assets to have clean derivatives, found ${files.length}`);
  console.log(JSON.stringify({
    ok: true,
    topics: publicTopicSlugs.size,
    referencedMedia: assets.length,
    cleanMedia: files.length,
    legacyReferences: 0,
    crossTopicDuplicatePairs: 0
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
