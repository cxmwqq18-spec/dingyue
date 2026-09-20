#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import { assertAidreamcapesEuHomepageIntegrity } from "./lib/aidreamcapes-eu-homepage-integrity.mjs";

const siteId = "site_aidreamcapes_xby";
const siteSlug = "aidreamcapes-eu";
const assetSiteSlug = "site_aidreamcapes_eu";
const expectedConfirmation = "aidreamcapes-eu-public-media-replacement";
const publicVersion = "20260915eupublicmedia1";
// Review avatars are identity assets. Keep them as independent headshots so a
// future media replacement cannot turn them back into crops of the themed result.
const reviewAvatarVersion = "20260919eureviewheadshot1";
const reviewResultVersion = "20260919eureviewvendor1";
const reviewResultUrlById = {
  review_ava: `/assets/sites/${assetSiteSlug}/generated/public-media/reviews/vendor-20260919/review-ava-theme.webp?v=${reviewResultVersion}`,
  review_lucas: `/assets/sites/${assetSiteSlug}/generated/public-media/reviews/vendor-20260919/review-lucas-theme.webp?v=${reviewResultVersion}`,
  review_mia: `/assets/sites/${assetSiteSlug}/generated/public-media/reviews/vendor-20260919/review-mia-theme.webp?v=${reviewResultVersion}`,
  review_noah: `/assets/sites/${assetSiteSlug}/generated/public-media/reviews/vendor-20260919/review-noah-theme.webp?v=${reviewResultVersion}`,
  review_chloe: `/assets/sites/${assetSiteSlug}/generated/public-media/reviews/vendor-20260919/review-chloe-theme.webp?v=${reviewResultVersion}`,
  review_eli: `/assets/sites/${assetSiteSlug}/generated/public-media/reviews/vendor-20260919/review-eli-theme.webp?v=${reviewResultVersion}`,
  review_jordan: `/assets/sites/${assetSiteSlug}/generated/public-media/reviews/vendor-20260919/review-jordan-theme.webp?v=${reviewResultVersion}`,
  review_riley: `/assets/sites/${assetSiteSlug}/generated/public-media/reviews/vendor-20260919/review-riley-theme.webp?v=${reviewResultVersion}`
};
const legacyBatchId = "aidreamcapes-eu-legacy-diverse-20260914-v1";
const legacyManifestRoot = path.resolve(".tmp", "aidreamcapes-eu-legacy-regeneration", legacyBatchId, "manifests");
const legacyFallbackRoot = path.resolve(".tmp", "aidreamshoots-image-regeneration", "aidreamshoots-magic-photo-tools-old-photo-restoration-diverse-20260913-v1", "outputs");
const replacementRoot = path.resolve(".tmp", "aidreamcapes-eu-public-media-replacement");
const publicRoot = path.resolve("public");
const assetPrefix = `/assets/sites/${assetSiteSlug}/`;
const videoTopicRoot = path.resolve("public", "assets", "sites", assetSiteSlug, "generated", "eu-regenerated", "aidreamcapes-eu-video-topics-diverse-20260914-v1");
const talkingPhotoRoot = path.resolve("public", "assets", "sites", assetSiteSlug, "generated", "eu-regenerated", "aidreamcapes-eu-talking-photo-diverse-20260914-v1");
const motionGeneratorRoot = path.resolve("public", "assets", "sites", assetSiteSlug, "generated", "eu-regenerated", "aidreamcapes-eu-motion-generator-4k-20260915-v1");
const legacySlugs = [
  "motion-generator", "background-remover", "color-correction", "edit-by-prompt", "hairstyle-generator",
  "magic-eraser", "old-photo-restoration", "portrait-retouch", "background-changer", "social-cards",
  "unblur-image", "photo-enhancer", "virtual-try-on"
];
const legacySlugSet = new Set(legacySlugs);
const saveTheDateDetailPackByHref = new Map([
  ["/ai-save-the-date/valentines-day", "valentines-photo"],
  ["/ai-save-the-date/engagement", "engagement-photo"],
  ["/ai-save-the-date/proposal", "engagement-photo"],
  ["/ai-save-the-date/save-the-date", "wedding-photo"],
  ["/ai-save-the-date/wedding-invitation", "wedding-photo"],
  ["/ai-save-the-date/wedding-ceremony", "wedding-photo"],
  ["/ai-save-the-date/christmas", "christmas-photo"],
  ["/ai-save-the-date/halloween", "halloween-photo"],
  ["/ai-save-the-date/thanksgiving", "thanksgiving-photo"],
  ["/ai-save-the-date/new-year", "holiday"],
  ["/ai-save-the-date/mothers-day", "thanksgiving-photo"],
  ["/ai-save-the-date/fathers-day", "rich-lifestyle"],
  ["/ai-save-the-date/easter", "holiday"],
  ["/ai-save-the-date/wedding-anniversary", "wedding-photo"]
]);

const args = parseArgs(process.argv.slice(2));
const applyMode = args.apply === true || String(args.mode || "").toLowerCase() === "apply";

function parseArgs(list) {
  const result = {};
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item.startsWith("--")) continue;
    const raw = item.slice(2);
    const equals = raw.indexOf("=");
    const rawKey = equals >= 0 ? raw.slice(0, equals) : raw;
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (equals >= 0) result[key] = raw.slice(equals + 1);
    else {
      const next = list[index + 1];
      if (!next || next.startsWith("--")) result[key] = true;
      else { result[key] = next; index += 1; }
    }
  }
  return result;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function cloneJson(value) {
  return structuredClone(value);
}

function stripQuery(value) {
  return String(value || "").split(/[?#]/)[0];
}

function versioned(value) {
  const base = stripQuery(value);
  assert(base.startsWith(assetPrefix), `Expected EU asset URL, received ${value}`);
  return `${base}?v=${publicVersion}`;
}

function localPathForUrl(value) {
  const pathname = stripQuery(value);
  assert(pathname.startsWith(assetPrefix), `Expected EU asset URL, received ${value}`);
  const filePath = path.resolve(publicRoot, pathname.slice(1));
  assert(filePath === publicRoot || filePath.startsWith(`${publicRoot}${path.sep}`), `Asset escaped public root: ${value}`);
  return filePath;
}

function storageKeyForUrl(value) {
  return stripQuery(value).replace(/^\/assets\//, "");
}

function atomicCopy(source, target, { allowReplace = false } = {}) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const sourceHash = sha256(fs.readFileSync(source));
    const targetHash = sha256(fs.readFileSync(target));
    if (targetHash === sourceHash) return false;
    assert(allowReplace, `Refusing to overwrite an existing different EU asset: ${target}`);
  }
  const pending = `${target}.pending`;
  fs.copyFileSync(source, pending);
  fs.renameSync(pending, target);
  return true;
}

function matchingFallbackFile(slotIndex) {
  const prefix = `old-photo-restoration-${String(slotIndex).padStart(2, "0")}-`;
  const matches = fs.existsSync(legacyFallbackRoot)
    ? fs.readdirSync(legacyFallbackRoot).filter((name) => name.startsWith(prefix) && name.endsWith(".webp"))
    : [];
  assert.equal(matches.length, 1, `Expected one existing fallback for old-photo-restoration slot ${slotIndex}.`);
  return path.join(legacyFallbackRoot, matches[0]);
}

function sourceForTask(slug, task) {
  if (fs.existsSync(task.stageFile)) return { source: task.stageFile, sourceKind: "eu-staged" };
  if (slug === "old-photo-restoration") return { source: matchingFallbackFile(task.slotIndex), sourceKind: "existing-staged-fallback" };
  assert.fail(`Missing staged EU output for ${slug} slot ${task.slotIndex}: ${task.stageFile}`);
}

async function validateLegacySources(manifests) {
  const sources = [];
  for (const manifest of manifests) {
    const slug = manifest.batchId.replace(`${legacyBatchId}-`, "");
    assert(legacySlugSet.has(slug), `Unexpected legacy manifest: ${manifest.batchId}`);
    assert.equal(manifest.tasks.length, 13, `${slug}: expected cover plus twelve gallery tasks.`);
    if (slug !== "old-photo-restoration") {
      assert.equal(manifest.runtime?.succeeded, 13, `${slug}: staged generation is incomplete.`);
      assert.equal(manifest.runtime?.failed, 0, `${slug}: staged generation has failures.`);
      assert.equal(manifest.diversityResult?.pass, true, `${slug}: diversity gate did not pass.`);
    }
    for (const task of manifest.tasks) {
      const resolved = sourceForTask(slug, task);
      const buffer = fs.readFileSync(resolved.source);
      const metadata = await sharp(buffer).metadata();
      assert(metadata.width && metadata.height, `${task.id}: staged output has no dimensions.`);
      assert(buffer.length > 1024, `${task.id}: staged output is unexpectedly small.`);
      sources.push({ manifest, slug, task, source: resolved.source, sourceKind: resolved.sourceKind, sha: sha256(buffer) });
    }
  }
  assert.equal(sources.length, legacySlugs.length * 13);
  for (const manifest of manifests) {
    const rows = sources.filter((item) => item.manifest.batchId === manifest.batchId);
    assert.equal(new Set(rows.map((item) => item.sha)).size, rows.length, `${manifest.batchId}: duplicate output detected.`);
  }
  return sources;
}

function packAsset(effectivePacks, slug, slot = 0) {
  const pack = effectivePacks.get(slug);
  assert(pack, `Missing active pack for ${slug}.`);
  const gallery = Array.isArray(pack.galleryImages) ? pack.galleryImages : [];
  const raw = slot === 0 ? pack.imageUrl : gallery[slot - 1];
  assert(typeof raw === "string" && raw.trim(), `${slug}: missing media slot ${slot}.`);
  return versioned(raw);
}

function isVideoUrl(value) {
  return /\.mp4(?:[?#]|$)/i.test(stripQuery(value));
}

function isTargetMirrorImage(value) {
  const pathname = stripQuery(value);
  return pathname.startsWith(`${assetPrefix}mirror/`) && !isVideoUrl(pathname);
}

function generatedAssetUrl(root, fileName) {
  const filePath = path.resolve(root, fileName);
  assert(filePath.startsWith(`${publicRoot}${path.sep}`), `Generated video asset escaped public root: ${fileName}`);
  assert(fs.existsSync(filePath), `Missing generated EU video asset: ${filePath}`);
  const relative = path.relative(publicRoot, filePath).split(path.sep).join("/");
  return versioned(`/${relative}`);
}

function generatedImageFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((name) => /\.(?:webp|png|jpe?g)$/i.test(name))
    .sort();
}

function generatedTopicMedia(slug) {
  const marker = `-${slug}-`;
  const files = generatedImageFiles(videoTopicRoot)
    .filter((name) => name.includes(marker) && !name.includes("-slot-"));
  if (!files.length) return null;
  return {
    imageUrl: generatedAssetUrl(videoTopicRoot, files[0]),
    galleryImages: files.slice(1).map((name) => generatedAssetUrl(videoTopicRoot, name))
  };
}

function generatedRootMedia(root) {
  const files = generatedImageFiles(root);
  assert(files.length > 0, `No generated EU video images found in ${root}`);
  return {
    imageUrl: generatedAssetUrl(root, files[0]),
    galleryImages: files.slice(1).map((name) => generatedAssetUrl(root, name))
  };
}

function packMedia(effectivePacks, slug) {
  const pack = effectivePacks.get(slug);
  assert(pack, `Missing active EU pack for video media fallback: ${slug}`);
  return {
    imageUrl: packAsset(effectivePacks, slug),
    galleryImages: (Array.isArray(pack.galleryImages) ? pack.galleryImages : []).map((value) => versioned(value))
  };
}

function videoThemeMedia(effectivePacks, slug) {
  const generatedTopic = generatedTopicMedia(slug);
  if (generatedTopic) return generatedTopic;
  if (slug === "talking-photo") return generatedRootMedia(talkingPhotoRoot);
  if (slug === "motion-generator") return generatedRootMedia(motionGeneratorRoot);

  const homepageShowcasePacks = {
    "creator-scene-motion": ["only-fans", 3],
    "cinematic-portrait-motion": ["headshot", 0],
    "social-profile-clip": ["social-cards", 0],
    "travel-route-story": ["travel", 0],
    "wedding-memory-film": ["wedding-photo", 0],
    "holiday-card-motion": ["christmas-photo", 0],
    "product-showcase-motion": ["background-changer", 0],
    "prompt-directed-motion": ["motion-generator", 4],
    "creator-intro-motion": ["avatar", 0]
  };
  const showcasePack = homepageShowcasePacks[slug];
  if (showcasePack) return { imageUrl: packAsset(effectivePacks, showcasePack[0], showcasePack[1]), galleryImages: [] };

  const seasonalPackFallbacks = {
    "valentines-day": "valentines-photo",
    engagement: "engagement-photo",
    halloween: "halloween-photo",
    thanksgiving: "thanksgiving-photo",
    proposal: "engagement-photo",
    "new-year": "holiday",
    "save-the-date": "wedding-photo",
    "wedding-invitation": "wedding-photo",
    "mothers-day": "thanksgiving-photo",
    "fathers-day": "rich-lifestyle",
    "wedding-ceremony": "wedding-photo",
    christmas: "christmas-photo"
  };
  const fallbackSlug = seasonalPackFallbacks[slug];
  return fallbackSlug ? packMedia(effectivePacks, fallbackSlug) : null;
}

const generatedVideoTopicSlugs = [
  "brand-video", "cinematic-video", "explainer-video", "fashion-video", "food-video", "how-to-video",
  "instagram-reels", "meme-video", "music-video", "pet-video", "product-ad-video", "product-video",
  "promo-video", "social-media-video", "story-video", "talking-head-video", "tiktok-video", "ugc-ad-video",
  "video-ad", "youtube-video"
];

const publicVideoTopicSlugs = [
  ...generatedVideoTopicSlugs,
  "valentines-day", "halloween", "engagement", "thanksgiving", "talking-photo", "proposal", "motion-generator",
  "new-year", "save-the-date", "wedding-invitation", "mothers-day", "fathers-day", "wedding-ceremony", "christmas",
  "creator-scene-motion", "cinematic-portrait-motion", "social-profile-clip", "travel-route-story", "wedding-memory-film",
  "holiday-card-motion", "product-showcase-motion", "prompt-directed-motion", "creator-intro-motion"
];

function fallbackMirrorImageReplacement(effectivePacks, value) {
  const pathname = stripQuery(value);
  if (!isTargetMirrorImage(pathname)) return value;

  let media;
  const topic = publicVideoTopicSlugs.find((slug) => pathname.includes(`/${slug}/`) || pathname.includes(`/${slug}-`));
  if (topic) media = videoThemeMedia(effectivePacks, topic);
  if (!media && pathname.includes("/seasonal/easter/")) media = packMedia(effectivePacks, "thanksgiving-photo");

  if (!media) {
    const keywordFallbacks = [
      ["wedding", "wedding-photo"], ["engagement", "engagement-photo"], ["valentine", "valentines-photo"],
      ["christmas", "christmas-photo"], ["holiday", "holiday"], ["halloween", "halloween-photo"],
      ["thanksgiving", "thanksgiving-photo"], ["travel", "travel"], ["nature", "travel"], ["cyber", "cyberpunk"],
      ["beauty", "boudoir"], ["avatar", "avatar"], ["profile", "headshot"], ["portrait", "headshot"],
      ["product", "background-changer"], ["social", "social-cards"], ["creator", "only-fans"], ["video", "motion-generator"],
      ["upscal", "photo-enhancer"], ["enhancer", "photo-enhancer"], ["magic", "photo-enhancer"]
    ];
    const fallback = keywordFallbacks.find(([keyword]) => pathname.toLowerCase().includes(keyword));
    media = packMedia(effectivePacks, fallback?.[1] || "rich-lifestyle");
  }

  const pool = [media.imageUrl, ...(Array.isArray(media.galleryImages) ? media.galleryImages : [])].filter((url) => typeof url === "string" && !isVideoUrl(url));
  assert(pool.length > 0, `Empty replacement media pool for ${value}`);
  const index = Number.parseInt(sha256(pathname).slice(0, 8), 16) % pool.length;
  return pool[index];
}

function replaceVideoGallery(existing, media) {
  if (!Array.isArray(existing) || !existing.some((value) => isTargetMirrorImage(value))) return existing;
  const videos = existing.filter((value) => isVideoUrl(value));
  const hadImages = existing.some((value) => !isVideoUrl(value));
  return videos.concat(hadImages ? media.galleryImages : []);
}

function buildVideoThemeUpdates(videoThemes, effectivePacks) {
  const updates = [];
  const nextById = new Map();
  for (const theme of videoThemes) {
    const currentGallery = Array.isArray(theme.galleryImages) ? theme.galleryImages : [];
    const needsImage = isTargetMirrorImage(theme.imageUrl);
    const needsGallery = currentGallery.some((value) => isTargetMirrorImage(value));
    if (!needsImage && !needsGallery) {
      nextById.set(theme.id, { theme, next: { imageUrl: theme.imageUrl, galleryImages: currentGallery } });
      continue;
    }
    const media = videoThemeMedia(effectivePacks, theme.slug);
    assert(media, `No replacement media mapping for EU video theme ${theme.slug}`);
    const next = {
      imageUrl: needsImage ? media.imageUrl : theme.imageUrl,
      galleryImages: needsGallery ? replaceVideoGallery(currentGallery, media) : currentGallery
    };
    const item = { theme, next };
    updates.push(item);
    nextById.set(theme.id, item);
  }
  return { updates, nextById };
}

function buildVideoExampleUpdates(videoExamples, videoThemeUpdates) {
  const updates = [];
  for (const example of videoExamples) {
    const linked = videoThemeUpdates.nextById.get(example.themeId);
    if (!linked) continue;
    const currentGallery = Array.isArray(example.galleryImages) ? example.galleryImages : [];
    const needsImage = isTargetMirrorImage(example.imageUrl);
    const needsGallery = currentGallery.some((value) => isTargetMirrorImage(value));
    if (!needsImage && !needsGallery) continue;
    const next = {
      imageUrl: needsImage ? linked.next.imageUrl : example.imageUrl,
      galleryImages: needsGallery
        ? currentGallery.map((value) => isTargetMirrorImage(value) ? linked.next.imageUrl : value)
        : currentGallery
    };
    updates.push({ example, next });
  }
  return updates;
}

function buildVideoCategoryUpdates(videoCategories, videoThemes, videoThemeUpdates, effectivePacks) {
  const themesByCategory = new Map();
  for (const theme of videoThemes) {
    const linked = videoThemeUpdates.nextById.get(theme.id);
    if (!linked || !linked.next.imageUrl || !theme.categoryId) continue;
    const list = themesByCategory.get(theme.categoryId) || [];
    list.push(linked);
    themesByCategory.set(theme.categoryId, list);
  }
  const fallbackTheme = {
    "creator-scene-motion": "creator-scene-motion", "portrait-motion": "cinematic-portrait-motion", "creator-motion": "social-profile-clip", "travel-story": "travel-route-story", "edit-by-prompt": "prompt-directed-motion", "social-cards": "social-profile-clip", "wedding-memory": "wedding-memory-film", "product-teaser": "product-showcase-motion",
    "core-ai-creation": "motion-generator", "love-wedding": "wedding-memory-film", "text-to-video": "motion-generator", "image-to-video": "motion-generator", "seasonal-holidays": "holiday-card-motion", "social-creator": "social-profile-clip", "marketing-commerce": "product-showcase-motion", "talking-photo": "talking-photo", "creative-lifestyle": "creator-scene-motion", "motion-generator": "motion-generator", "photo-animation": "motion-generator", "photo-slideshow-video": "wedding-memory-film", "professional-business": "cinematic-portrait-motion", "cinematic-video": "cinematic-video", "save-the-date": "wedding-memory-film", "tiktok-video": "tiktok-video", "youtube-shorts": "youtube-video", "youtube-video": "youtube-video", "social-media-video": "social-media-video", "story-video": "story-video", "meme-video": "meme-video", "product-video": "product-video", "product-demo-video": "product-video", "product-ad-video": "product-ad-video", "ugc-ad-video": "ugc-ad-video", "promo-video": "promo-video", "video-ad": "video-ad", "brand-video": "brand-video", "music-video": "music-video", "travel-video": "travel-route-story", "fashion-video": "fashion-video", "food-video": "food-video", "fitness-video": "creator-scene-motion", "pet-video": "pet-video", "explainer-video": "explainer-video", "how-to-video": "how-to-video", "real-estate-video": "creator-scene-motion", "corporate-video": "brand-video", "ai-avatar-video": "creator-intro-motion", "talking-head-video": "talking-head-video"
  };
  const updates = [];
  for (const category of videoCategories) {
    if (!isTargetMirrorImage(category.imageUrl)) continue;
    const child = (themesByCategory.get(category.id) || []).find((item) => item.next.imageUrl);
    let nextImageUrl = child?.next.imageUrl;
    if (!nextImageUrl) {
      const themeSlug = fallbackTheme[category.slug];
      if (themeSlug) nextImageUrl = videoThemeMedia(effectivePacks, themeSlug)?.imageUrl;
    }
    assert(nextImageUrl, `No replacement media mapping for EU video category ${category.slug}`);
    updates.push({ category, nextImageUrl });
  }
  return updates;
}

function buildInactivePackUpdates(inactivePacks, effectivePacks) {
  const updates = [];
  for (const pack of inactivePacks) {
    const currentGallery = Array.isArray(pack.galleryImages) ? pack.galleryImages : [];
    const hasOldMedia = isTargetMirrorImage(pack.imageUrl) || currentGallery.some((value) => isTargetMirrorImage(value));
    if (!hasOldMedia) continue;
    const slug = String(pack.categoryRecord?.slug || "");
    const replacement = effectivePacks.get(slug);
    assert(replacement, `No active EU replacement pack for inactive pack ${slug || pack.id}.`);
    const replacementUrls = [
      packAsset(effectivePacks, slug),
      ...(Array.isArray(replacement.galleryImages) ? replacement.galleryImages : []).map((value) => versioned(value))
    ];
    assert(replacementUrls.length >= currentGallery.length + 1, `Replacement pack ${slug} has fewer media slots than inactive pack ${pack.id}.`);
    const next = {
      imageUrl: isTargetMirrorImage(pack.imageUrl) ? replacementUrls[0] : pack.imageUrl,
      galleryImages: currentGallery.map((value, index) => isTargetMirrorImage(value) ? replacementUrls[index + 1] : value)
    };
    updates.push({ pack, next });
  }
  return updates;
}

function replaceString(value, replacements, fallbackReplacement) {
  if (value.includes("|")) return value.split("|").map((item) => replaceString(item, replacements, fallbackReplacement)).join("|");
  const pathname = stripQuery(value);
  if (!pathname.startsWith(`${assetPrefix}mirror/`)) return value;
  for (const [suffix, replacement] of replacements) {
    if (pathname.endsWith(suffix)) return replacement;
  }
  return fallbackReplacement ? fallbackReplacement(value) : value;
}

function rewriteJson(value, replacements, fallbackReplacement) {
  if (Array.isArray(value)) return value.map((item) => rewriteJson(item, replacements, fallbackReplacement));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteJson(item, replacements, fallbackReplacement)]));
  }
  if (typeof value === "string") return replaceString(value, replacements, fallbackReplacement);
  return value;
}

function setIfObject(value, key, next) {
  if (value && typeof value === "object" && !Array.isArray(value)) value[key] = next;
}

function applySaveTheDateDetailOverrides(json, slug, effectivePacks) {
  const packSlug = saveTheDateDetailPackByHref.get(slug);
  if (!packSlug || !json || typeof json !== "object") return json;
  const media = (slot = 0) => packAsset(effectivePacks, packSlug, slot);
  const manifest = json.mediaManifest;
  const hasApprovedSupplierManifest = Array.isArray(manifest) && manifest.length > 0 && manifest.every((entry) =>
    entry && typeof entry === "object" && /\/vendor-api-gpt-image-2-4k-v1\//i.test(String(entry.src ?? ""))
  );
  if (hasApprovedSupplierManifest) return json;
  if (Array.isArray(manifest)) {
    for (const [index, entry] of manifest.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const imageUrl = media(index);
      entry.src = imageUrl;
      entry.format = "WEBP";
      entry.filename = path.basename(stripQuery(imageUrl));
      entry.source = "Aidreamcapes EU themed media";
    }
  }
  if (json.seo && typeof json.seo === "object" && !Array.isArray(json.seo)) {
    json.seo.ogImage = media();
    json.seo.twitterImage = media();
  }
  return json;
}

function applyPageOverrides(json, slug, effectivePacks, reviewPairs) {
  const media = (packSlug, slot = 0) => packAsset(effectivePacks, packSlug, slot);
  const sections = json?.sections;
  if (!sections || typeof sections !== "object") return json;

  const faqGallery = [
    media("rich-lifestyle"), media("headshot"), media("christmas-photo", 1),
    media("only-fans", 3), media("motion-generator", 1), media("virtual-try-on")
  ];
  const faqGalleryAlts = [
    "Portrait lifestyle avec un cadrage naturel pour un profil",
    "Portrait professionnel avec une lumière nette et un visage visible",
    "Portrait de couple dans une ambiance festive chaleureuse",
    "Portrait de créateur avec un cadrage soigné pour les réseaux",
    "Portrait prêt pour une courte séquence animée",
    "Portrait de style virtuel avec une idée de tenue"
  ];
  for (const section of Object.values(sections)) {
    if (section?.type !== "faq" || section.settings?.layout !== "visual_faq") continue;
    setIfObject(section.settings, "imageUrl", faqGallery[0]);
    setIfObject(section.settings, "imageList", faqGallery.join("|"));
    setIfObject(section.settings, "imageListAlt", faqGalleryAlts.join("|"));
  }

  if (slug === "/") {
    const hero = sections.hero_1?.settings;
    if (hero) {
      hero.imageUrl = media("rich-lifestyle");
      hero.secondaryImageUrl = media("headshot");
      hero.tertiaryImageUrl = media("mafia");
      hero.heroGridImages = [
        media("headshot"), media("boudoir"), media("cyberpunk"), media("travel"), media("soccer"),
        media("avatar"), media("background-changer"), media("motion-generator", 1), media("social-cards"),
        media("mafia"), media("photo-enhancer")
      ].join("|");
    }
    const faq = sections.faq_1;
    const faqImages = {
      0: media("rich-lifestyle"),
      6: media("avatar"),
      7: media("christmas-photo", 1),
      8: media("only-fans", 3),
      9: media("motion-generator", 1),
      10: media("virtual-try-on")
    };
    for (const [index, imageUrl] of Object.entries(faqImages)) setIfObject(faq?.blocks?.[Number(index)]?.settings, "imageUrl", imageUrl);
    setIfObject(sections.pricing_1?.settings, "backgroundImage", media("rich-lifestyle"));
    setIfObject(sections.tutorial_video_1?.settings, "imageUrl", media("motion-generator", 1));

    for (const block of sections.proof_1?.blocks || []) {
      const pair = reviewPairs[block.id];
      if (!pair) continue;
      block.settings = block.settings || {};
      block.settings.avatarUrl = pair.avatarUrl;
      block.settings.resultImageUrl = pair.resultImageUrl;
    }
  }

  if (slug === "/blog") {
    json.seo = json.seo || {};
    json.seo.ogImage = media("motion-generator", 1);
    const blogImages = [media("headshot"), media("hairstyle-generator"), media("christmas-photo"), media("avatar")];
    for (const [index, imageUrl] of blogImages.entries()) setIfObject(sections.packages_strip_1?.blocks?.[index]?.settings, "imageUrl", imageUrl);
  }

  if (slug === "/pricing") {
    setIfObject(sections.pricing_1?.settings, "backgroundImage", media("rich-lifestyle"));
    setIfObject(sections.plan_rules_1?.settings, "imageUrl", media("headshot"));
  }

  if (slug === "/help" || slug === "/faq") setIfObject(sections.plan_rules_1?.settings, "imageUrl", media("headshot"));
  return json;
}

function applySettingsOverrides(json, effectivePacks, detailMediaByHref) {
  const groups = json?.saveTheDateNavigation?.groups;
  if (!Array.isArray(groups)) return json;
  const media = (slug, slot = 0) => packAsset(effectivePacks, slug, slot);
  const groupImages = [
    [
      media("valentines-photo"), media("engagement-photo"), media("rich-lifestyle"),
      media("engagement-photo", 1), media("wedding-photo"), media("wedding-photo", 1)
    ],
    [
      media("christmas-photo"), media("halloween-photo"), media("thanksgiving-photo"),
      media("holiday"), media("christmas-photo", 1), media("rich-lifestyle", 1)
    ]
  ];
  for (const [groupIndex, items] of groupImages.entries()) {
    for (const [itemIndex, imageUrl] of items.entries()) {
      const item = groups[groupIndex]?.items?.[itemIndex];
      if (!item || typeof item !== "object") continue;
      const detailMedia = detailMediaByHref?.get(item.href);
      setIfObject(item, "imageUrl", detailMedia?.src || imageUrl);
      if (detailMedia?.alt) setIfObject(item, "imageAlt", detailMedia.alt);
    }
  }
  return json;
}

function buildReplacements(effectivePacks, reviewPairs) {
  const media = (slug, slot = 0) => packAsset(effectivePacks, slug, slot);
  const replacements = new Map();
  const add = (suffix, value) => replacements.set(suffix, value);

  const semantic = {
    business: media("headshot"),
    editorial: media("headshot"),
    beauty: media("boudoir"),
    cyber: media("cyberpunk"),
    travel: media("travel"),
    soccer: media("soccer"),
    avatar: media("avatar"),
    product: media("background-changer"),
    video: media("motion-generator", 1),
    social: media("social-cards"),
    noir: media("mafia"),
    upscale: media("photo-enhancer"),
    holiday: media("holiday"),
    christmas: media("christmas-photo"),
    creator: media("only-fans", 3),
    hairstyle: media("hairstyle-generator"),
    virtual: media("virtual-try-on"),
    private: media("rich-lifestyle"),
    profile: media("headshot"),
    gala: media("gala-photo"),
    nature: media("travel", 4),
    wedding: media("wedding-photo"),
    magic: media("photo-enhancer")
  };

  add("generated/20260622-homepage-unique/hero-package-wall.png", semantic.private);
  add("generated/20260622-homepage-unique/hero-credit-studio-card.png", semantic.editorial);
  add("generated/20260622-homepage-unique/hero-grid-business.png", semantic.business);
  add("generated/20260622-homepage-unique/hero-grid-beauty.png", semantic.beauty);
  add("generated/20260622-homepage-unique/hero-grid-cyber.png", semantic.cyber);
  add("generated/20260622-homepage-unique/hero-grid-travel.png", semantic.travel);
  add("generated/20260622-homepage-unique/hero-grid-sports.png", semantic.soccer);
  add("generated/20260622-homepage-unique/hero-grid-avatar.png", semantic.avatar);
  add("generated/20260622-homepage-unique/hero-grid-product.png", semantic.product);
  add("generated/20260622-homepage-unique/hero-grid-video.png", semantic.video);
  add("generated/20260622-homepage-unique/hero-grid-social.png", semantic.social);
  add("generated/20260622-homepage-unique/hero-grid-noir.png", semantic.noir);
  add("generated/20260622-homepage-unique/hero-grid-upscale.png", semantic.upscale);
  add("generated/20260622-homepage-unique/hero-grid-gala.png", semantic.gala);
  add("generated/20260622-homepage-unique/pricing-credits-visual.png", semantic.private);
  add("generated/20260622-homepage-unique/catalog-headshot-card.png", semantic.editorial);
  add("generated/20260622-homepage-unique/catalog-worldcup-card.png", semantic.soccer);
  add("generated/20260622-homepage-unique/proof-business-founder.png", semantic.business);
  add("generated/20260622-homepage-unique/proof-cinematic-worlds.png", semantic.noir);
  add("generated/20260622-homepage-unique/proof-beauty-hair.png", semantic.hairstyle);
  add("generated/20260622-homepage-unique/flow-before-upload.png", semantic.private);
  add("generated/20260622-homepage-unique/flow-private-album-workspace.png", semantic.private);
  add("generated/20260622-homepage-unique/about-company-office.png", semantic.editorial);
  add("generated/20260622-pack-fill/magic-upscaler-pack.png", semantic.magic);
  add("generated/20260622-pack-fill/ai-video-addons-pack.png", semantic.video);
  add("generated/20260618/headshot-lifestyle-v1.png", semantic.private);
  add("generated/20260618/hairstyle-preview-v1.png", semantic.hairstyle);
  add("generated/20260618/upscaler-utility-v1.png", semantic.upscale);
  add("generated/20260619/cyberpunk-solo-city-v1.png", semantic.cyber);
  add("generated/20260619/mafia-noir-single-v1.png", semantic.noir);
  add("generated/20260619/nature-adventure-solo-v1.png", semantic.nature);
  add("generated/20260621-worldcup-pack/stadium-portrait.png", semantic.soccer);
  add("generated/20260621-worldcup-pack/friend-fan-photos.png", semantic.soccer);
  add("generated/20260621-worldcup-pack/match-day-avatar.png", semantic.soccer);
  add("generated/20260621-worldcup-pack/fan-poster.png", semantic.soccer);
  add("generated/20260621-worldcup-pack/social-story.png", semantic.soccer);
  add("generated/20260621-worldcup-pack/banner-cover.png", semantic.soccer);
  add("frames/faq-intro-portrait.png", semantic.avatar);
  add("frames/tab-virtual-looks.png", semantic.virtual);
  add("frames/sample-cyberpunk.png", semantic.cyber);
  add("frames/sample-professional-headshot.png", semantic.editorial);
  add("editorial-headshot-gpt2.png", semantic.editorial);
  add("beauty-portrait-gpt2.png", semantic.beauty);
  add("holiday-card-gpt2.png", semantic.holiday);
  add("avatar-nora-gpt2.png", semantic.avatar);
  add("avatar-nora-gpt2-fast.png", semantic.avatar);
  add("generated/pack-covers/professional-headshots/professional-headshots-cover.webp", semantic.editorial);
  add("generated/pack-covers/christmas-couple/christmas-couple-cover.webp", semantic.christmas);
  add("generated/pack-galleries/creator-portraits/creator-portraits-01.webp", semantic.creator);
  add("generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-01.webp", semantic.video);
  add("generated/pack-galleries/christmas-couple/christmas-couple-01.webp", media("christmas-photo", 1));
  add("generated/pack-galleries/christmas-couple/christmas-couple-02.webp", media("christmas-photo", 1));
  add("generated/pack-galleries/christmas-couple/christmas-couple-04.webp", media("christmas-photo", 2));
  add("generated/pack-galleries/christmas-couple/christmas-couple-05.webp", media("christmas-photo", 3));
  add("generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-01.webp", media("soccer", 1));
  add("generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-03-20260830.webp", media("soccer", 3));
  add("generated/pack-galleries/gala-photos/gala-photos-01.webp", media("gala-photo", 1));
  add("generated/pack-galleries/gala-photos/gala-photos-02-20260830.webp", media("gala-photo", 2));
  add("generated/pack-galleries/mafia/mafia-01.webp", media("mafia", 1));
  add("generated/pack-galleries/nature/nature-01.webp", semantic.nature);
  add("generated/pack-galleries/boudoir/boudoir-01.webp", media("boudoir", 1));
  add("generated/pack-galleries/fashion-editorial/fashion-editorial-01.webp", media("gala-photo", 2));
  add("generated/pack-galleries/cyberpunk/cyberpunk-01.webp", media("cyberpunk", 1));
  add("generated/pack-galleries/hairstyle/hairstyle-01.webp", media("hairstyle-generator", 1));
  add("generated/pack-galleries/anime-avatar/anime-avatar-01.webp", media("avatar", 2));
  add("generated/pack-galleries/desi-wedding/desi-wedding-01.webp", media("wedding-photo", 1));
  add("generated/pack-galleries/indian-wedding/indian-wedding-01.webp", media("wedding-photo", 2));
  add("generated/pack-galleries/social-cards/social-cards-01.webp", media("social-cards", 1));
  add("generated/pack-galleries/product-style/product-style-01.webp", media("background-changer", 1));
  add("generated/pack-galleries/profile-cards/profile-cards-01.webp", media("headshot", 1));
  add("generated/pack-galleries/wedding-portraits/wedding-portraits-01.webp", media("wedding-photo", 3));
  add("generated/pack-galleries/outdoor-creator-scenes/outdoor-creator-scenes-01.webp", media("only-fans", 4));
  add("generated/pack-galleries/professional-headshots/professional-headshots-01.webp", media("headshot", 1));
  add("generated/20260622-pack-fill/magic-upscaler-pack.webp", semantic.magic);
  add("generated/blog/virtual-try-on-workflow-cover.webp", semantic.virtual);
  add("generated/homepage-showcase/images/holiday.webp", semantic.holiday);
  add("generated/homepage-showcase/posters/aidreamcapes-ai-image-tutorial-20260814.jpg", semantic.video);
  add("generated/homepage-showcase/posters/aidreamcapes-ai-video-tutorial-20260814.jpg", media("motion-generator", 2));
  add("generated/standard-page-media/wedding-anniversary/wedding-anniversary-01.webp", media("wedding-photo", 1));
  for (let index = 1; index <= 11; index += 1) {
    add(`generated/standard-page-media/save-the-date/save-the-date-${String(index).padStart(2, "0")}.webp`, media("wedding-photo", index));
  }

  for (const [id, pair] of Object.entries(reviewPairs)) {
    const shortId = id.replace(/^review_/, "");
    add(`generated/20260622-homepage-unique/review-${shortId}-avatar.png`, pair.avatarUrl);
    add(`generated/20260630-homepage-unique/review-${shortId}-avatar.png`, pair.avatarUrl);
  }
  add("generated/20260622-homepage-unique/review-lucas-result-headshot.png", reviewPairs.review_lucas.resultImageUrl);
  add("generated/20260622-homepage-unique/review-noah-result-social-card.png", reviewPairs.review_noah.resultImageUrl);
  add("generated/20260830-homepage-review-replacements/christmas-holiday-card-couple-photo.webp", reviewPairs.review_mia.resultImageUrl);
  add("generated/20260830-homepage-review-replacements/private-photo-gallery-review.webp", reviewPairs.review_noah.resultImageUrl);
  add("generated/20260830-homepage-review-replacements/fresh-social-content-creator-scene.webp", reviewPairs.review_chloe.resultImageUrl);
  add("generated/20260830-homepage-review-replacements/polished-professional-headshot.webp", reviewPairs.review_eli.resultImageUrl);
  add("generated/20260830-homepage-review-replacements/team-page-professional-portrait.webp", reviewPairs.review_jordan.resultImageUrl);
  add("generated/20260830-homepage-review-replacements/instagram-social-content-creator-photo.webp", reviewPairs.review_riley.resultImageUrl);
  add("generated/20260830-homepage-review-replacements/jordan-k-team-profile-avatar.webp", reviewPairs.review_jordan.avatarUrl);
  add("generated/20260830-homepage-review-replacements/riley-w-social-content-avatar.webp", reviewPairs.review_riley.avatarUrl);
  return replacements;
}

function reviewSourceDefinitions(effectivePacks) {
  const source = (id, packSlug, slot) => {
    const sourceResultImageUrl = packAsset(effectivePacks, packSlug, slot);
    const resultImageUrl = reviewResultUrlById[id] || sourceResultImageUrl;
    return { id, packSlug, slot, sourceResultImageUrl, resultImageUrl };
  };
  return [
    source("review_ava", "soccer", 0),
    source("review_lucas", "gala-photo", 1),
    source("review_mia", "christmas-photo", 0),
    source("review_noah", "rich-lifestyle", 0),
    source("review_chloe", "only-fans", 3),
    source("review_eli", "headshot", 3),
    source("review_jordan", "avatar", 1),
    source("review_riley", "travel", 4)
  ];
}

function reviewAvatarUrl(reviewId) {
  const shortId = reviewId.replace(/^review_/, "");
  return `${assetPrefix}generated/public-media/reviews/review-${shortId}-headshot.webp?v=${reviewAvatarVersion}`;
}

async function prepareReviewAvatars(effectivePacks) {
  const pairs = {};
  for (const item of reviewSourceDefinitions(effectivePacks)) {
    const sourcePath = localPathForUrl(item.sourceResultImageUrl);
    assert(fs.existsSync(sourcePath), `Review source image is missing: ${sourcePath}`);
    const avatarUrl = reviewAvatarUrl(item.id);
    const outputPath = localPathForUrl(avatarUrl);
    const resultPath = localPathForUrl(item.resultImageUrl);
    assert(fs.existsSync(resultPath), `${item.id}: vendor themed result is missing: ${resultPath}`);
    assert(fs.existsSync(outputPath), `${item.id}: independent headshot is missing: ${outputPath}`);
    const meta = await sharp(outputPath).metadata();
    assert.equal(meta.width, 640, `${item.id}: independent headshot width mismatch.`);
    assert.equal(meta.height, 640, `${item.id}: independent headshot height mismatch.`);
    assert.notEqual(stripQuery(avatarUrl), stripQuery(item.resultImageUrl), `${item.id}: avatar and themed result must use different files.`);
    pairs[item.id] = {
      sourcePackSlug: item.packSlug,
      sourceSlot: item.slot,
      avatarUrl,
      resultImageUrl: item.resultImageUrl,
      avatarPath: outputPath
    };
  }
  return pairs;
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function addAsset(assetRows, url, label, usageType, altText) {
  const pathname = stripQuery(url);
  if (!pathname.startsWith(assetPrefix)) return;
  const storageKey = storageKeyForUrl(url);
  assetRows.set(storageKey, {
    url: versioned(url),
    label: label || path.basename(pathname),
    usageType: usageType || "theme",
    altText: altText || null,
    storageKey
  });
}

function addPackAssets(assetRows, effectivePacks) {
  for (const [slug, pack] of effectivePacks) {
    const urls = [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])];
    for (const [index, url] of urls.entries()) {
      if (typeof url !== "string" || !url.trim()) continue;
      const alts = Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts : [];
      addAsset(assetRows, url, `${slug} ${index === 0 ? "cover" : `gallery ${index}`}`, "package", alts[index]);
    }
  }
}

function addVideoAssetRows(assetRows, videoThemeUpdates, videoExampleUpdates, videoCategoryUpdates) {
  const addVideoUrl = (url, label) => {
    if (!isVideoUrl(url)) addAsset(assetRows, url, label, "video-theme");
  };
  for (const item of videoThemeUpdates.updates) {
    addVideoUrl(item.next.imageUrl, `${item.theme.slug} video theme cover`);
    for (const [index, url] of (Array.isArray(item.next.galleryImages) ? item.next.galleryImages : []).entries()) {
      addVideoUrl(url, `${item.theme.slug} video theme image ${index + 1}`);
    }
  }
  for (const item of videoExampleUpdates) {
    addVideoUrl(item.next.imageUrl, "Video theme example image");
    for (const url of (Array.isArray(item.next.galleryImages) ? item.next.galleryImages : [])) addVideoUrl(url, "Video theme example gallery image");
  }
  for (const item of videoCategoryUpdates) addVideoUrl(item.nextImageUrl, `${item.category.slug} video category image`);
}

function assetRowsForChanges(effectivePacks, replacements, reviewPairs, legacySources, videoThemeUpdates, videoExampleUpdates, videoCategoryUpdates) {
  const rows = new Map();
  addPackAssets(rows, effectivePacks);
  for (const value of replacements.values()) addAsset(rows, value, "Aidreamcapes EU public media", "theme");
  for (const pair of Object.values(reviewPairs)) {
    addAsset(rows, pair.avatarUrl, "Review identity headshot", "theme", "Independent identity headshot paired with the matching themed review result.");
    addAsset(rows, pair.resultImageUrl, "Review result image", "theme", "Review result image paired with its matching avatar.");
  }
  for (const item of legacySources) {
    const task = item.task;
    addAsset(rows, task.publicUrl, task.altText, "package", task.altText);
  }
  addVideoAssetRows(rows, videoThemeUpdates, videoExampleUpdates, videoCategoryUpdates);
  return rows;
}

async function assertAssetFiles(assetRows, legacySources, apply, plannedExtra = []) {
  const plannedFiles = new Set([
    ...legacySources.map((item) => path.resolve(publicRoot, "assets", item.task.outputRelative)),
    ...plannedExtra.map((filePath) => path.resolve(filePath))
  ]);
  for (const row of assetRows.values()) {
    const filePath = localPathForUrl(row.url);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      assert(buffer.length > 1024, `Referenced public asset is unexpectedly small: ${filePath}`);
      await sharp(buffer).metadata();
      continue;
    }
    assert(!apply && plannedFiles.has(filePath), `Referenced public asset is missing: ${filePath}`);
  }
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (applyMode) {
    assert.equal(String(args.confirm || ""), expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
    assertNonProductionWriteTarget();
  }

  const prisma = new PrismaClient();
  try {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.deepEqual(site, { id: siteId, slug: siteSlug, primaryDomain: "aidreamcapes.eu" }, "Target site identity check failed.");

    const [legacyPacks, allPacks, inactivePacks, categories, livePages, themePages, settings, videoThemes, videoExamples, videoCategories] = await Promise.all([
      prisma.creativePack.findMany({ where: { siteId, status: "active", categoryRecord: { slug: { in: legacySlugs } } }, include: { categoryRecord: true }, orderBy: { id: "asc" } }),
      prisma.creativePack.findMany({ where: { siteId, status: "active" }, include: { categoryRecord: true }, orderBy: { id: "asc" } }),
      prisma.creativePack.findMany({ where: { siteId, status: { not: "active" } }, include: { categoryRecord: true }, orderBy: { id: "asc" } }),
      prisma.creativePackCategory.findMany({ where: { siteId }, orderBy: { sortOrder: "asc" } }),
      prisma.livePage.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
      prisma.themeSettings.findUnique({ where: { siteId } }),
      prisma.videoTheme.findMany({ where: { siteId }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.videoThemeExample.findMany({ where: { siteId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      prisma.videoThemeCategory.findMany({ where: { siteId }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] })
    ]);
    assert.equal(legacyPacks.length, legacySlugs.length, `Expected ${legacySlugs.length} active legacy packs.`);
    assert(allPacks.length >= legacySlugs.length, "No active EU packs found.");
    assert(livePages.length > 0, "No EU LivePages found.");
    assert(settings, "No EU ThemeSettings found.");

    const manifests = legacySlugs.map((slug) => readJson(path.join(legacyManifestRoot, `${slug}.json`)));
    const legacySources = await validateLegacySources(manifests);
    const byLegacySlug = new Map(legacyPacks.map((pack) => [pack.categoryRecord?.slug, pack]));
    const legacyUpdates = new Map();
    for (const slug of legacySlugs) {
      const pack = byLegacySlug.get(slug);
      const items = legacySources.filter((item) => item.slug === slug).sort((a, b) => a.task.slotIndex - b.task.slotIndex);
      const cover = items.find((item) => item.task.isCover);
      const gallery = items.filter((item) => !item.task.isCover);
      assert(cover && gallery.length === 12, `${slug}: invalid cover/gallery source count.`);
      const url = (item) => `${item.task.publicUrl}?v=20260914eulegacy1`;
      legacyUpdates.set(slug, {
        pack,
        cover,
        gallery,
        next: {
          imageUrl: url(cover),
          galleryImages: gallery.map(url),
          galleryImageAlts: items.map((item) => item.task.altText)
        }
      });
    }

    const effectivePacks = new Map();
    for (const pack of allPacks) {
      const slug = String(pack.categoryRecord?.slug || "");
      const update = legacyUpdates.get(slug);
      effectivePacks.set(slug, update ? { ...pack, ...update.next } : pack);
    }
    assert(videoThemes.length > 0, "No EU VideoThemes found.");
    const videoThemeUpdates = buildVideoThemeUpdates(videoThemes, effectivePacks);
    const videoExampleUpdates = buildVideoExampleUpdates(videoExamples, videoThemeUpdates);
    const videoCategoryUpdates = buildVideoCategoryUpdates(videoCategories, videoThemes, videoThemeUpdates, effectivePacks);
    const inactivePackUpdates = buildInactivePackUpdates(inactivePacks, effectivePacks);
    const reviewPairs = await prepareReviewAvatars(effectivePacks);
    const detailMediaByHref = new Map(
      livePages
        .map((page) => {
          const detailPackSlug = saveTheDateDetailPackByHref.get(page.slug);
          const firstMedia = page.contentJson?.mediaManifest?.[0];
          return [page.slug, detailPackSlug
            ? { ...firstMedia, src: packAsset(effectivePacks, detailPackSlug) }
            : firstMedia];
        })
        .filter((entry) => entry[1]?.src)
    );
    const replacements = buildReplacements(effectivePacks, reviewPairs);
    const fallbackReplacement = (value) => fallbackMirrorImageReplacement(effectivePacks, value);
    const changedLivePages = [];
    for (const page of livePages) {
      let next = rewriteJson(cloneJson(page.contentJson), replacements, fallbackReplacement);
      next = applySaveTheDateDetailOverrides(next, page.slug, effectivePacks);
      next = applyPageOverrides(next, page.slug, effectivePacks, reviewPairs);
      if (changed(page.contentJson, next)) changedLivePages.push({ page, next });
    }
    const changedThemePages = [];
    for (const page of themePages) {
      let nextDraft = rewriteJson(cloneJson(page.draftJson), replacements, fallbackReplacement);
      nextDraft = applySaveTheDateDetailOverrides(nextDraft, page.slug, effectivePacks);
      nextDraft = applyPageOverrides(nextDraft, page.slug, effectivePacks, reviewPairs);
      let nextPublished = rewriteJson(cloneJson(page.publishedJson), replacements, fallbackReplacement);
      nextPublished = applySaveTheDateDetailOverrides(nextPublished, page.slug, effectivePacks);
      nextPublished = applyPageOverrides(nextPublished, page.slug, effectivePacks, reviewPairs);
      if (changed(page.draftJson, nextDraft) || changed(page.publishedJson, nextPublished)) changedThemePages.push({ page, nextDraft, nextPublished });
    }
    const nextSettingsDraft = applySettingsOverrides(rewriteJson(cloneJson(settings.draftJson), replacements, fallbackReplacement), effectivePacks, detailMediaByHref);
    const nextSettingsPublished = applySettingsOverrides(rewriteJson(cloneJson(settings.publishedJson), replacements, fallbackReplacement), effectivePacks, detailMediaByHref);
    const settingsChanged = changed(settings.draftJson, nextSettingsDraft) || changed(settings.publishedJson, nextSettingsPublished);

    const categoryParentMedia = {
      "best-themes-presets": packAsset(effectivePacks, "holiday"),
      professional: packAsset(effectivePacks, "headshot"),
      "lifestyle-creative": packAsset(effectivePacks, "rich-lifestyle"),
      magic: packAsset(effectivePacks, "boudoir"),
      "photo-tools": packAsset(effectivePacks, "photo-enhancer"),
      couple: packAsset(effectivePacks, "engagement-photo"),
      creator: packAsset(effectivePacks, "only-fans"),
      cultural: packAsset(effectivePacks, "gala-photo"),
      "profile-cards": packAsset(effectivePacks, "avatar"),
      sports: packAsset(effectivePacks, "soccer"),
      video: packAsset(effectivePacks, "motion-generator"),
      wedding: packAsset(effectivePacks, "wedding-photo")
    };
    const categoryUpdates = [];
    for (const category of categories) {
      const slug = String(category.slug || "");
      const nextImageUrl = effectivePacks.has(slug) ? packAsset(effectivePacks, slug) : categoryParentMedia[slug];
      if (nextImageUrl && isTargetMirrorImage(category.imageUrl)) categoryUpdates.push({ category, nextImageUrl });
    }
    const assetRows = assetRowsForChanges(effectivePacks, replacements, reviewPairs, legacySources, videoThemeUpdates, videoExampleUpdates, videoCategoryUpdates);
    const addImageAssetsFromJson = (value) => {
      const visit = (item) => {
        if (typeof item === "string") {
          if (item.startsWith(assetPrefix) && !isVideoUrl(item)) addAsset(assetRows, item, "Aidreamcapes EU public image", "theme");
          return;
        }
        if (Array.isArray(item)) { for (const entry of item) visit(entry); return; }
        if (item && typeof item === "object") for (const entry of Object.values(item)) visit(entry);
      };
      visit(value);
    };
    for (const item of changedLivePages) addImageAssetsFromJson(item.next);
    for (const item of changedThemePages) { addImageAssetsFromJson(item.nextDraft); addImageAssetsFromJson(item.nextPublished); }
    addImageAssetsFromJson(nextSettingsDraft);
    addImageAssetsFromJson(nextSettingsPublished);
    const plannedReviewAvatars = Object.values(reviewPairs).map((pair) => pair.avatarPath);
    // The legacy pack outputs are copied immediately below; allow those planned
    // files during this pre-copy validation, then validate the final filesystem
    // again after the copy completes.
    await assertAssetFiles(assetRows, legacySources, false, plannedReviewAvatars);

    const summary = {
      ok: true,
      mode: applyMode ? "apply" : "dry-run",
      target: { siteId, siteSlug, domain: site.primaryDomain },
      legacyPacks: legacySlugs.length,
      legacyFiles: legacySources.length,
      legacyFallbackFiles: legacySources.filter((item) => item.sourceKind === "existing-staged-fallback").length,
      changedLivePages: changedLivePages.length,
      changedThemePages: changedThemePages.length,
      settingsChanged,
      changedCategories: categoryUpdates.length,
      cleanedInactivePacks: inactivePackUpdates.length,
      changedVideoThemes: videoThemeUpdates.updates.length,
      changedVideoExamples: videoExampleUpdates.length,
      changedVideoCategories: videoCategoryUpdates.length,
      reviewPairs: Object.keys(reviewPairs).length,
      plannedMediaAssets: assetRows.size,
      remainingMirrorReferencesBeforeApply: countMirrorReferences(livePages.map((page) => page.contentJson).concat(settings.draftJson, videoThemes, videoExamples, videoCategories))
    };

    if (!applyMode) {
      writeJson(path.join(replacementRoot, "dry-run-summary.json"), summary);
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const backupPath = path.join(replacementRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-backup.json`);
    writeJson(backupPath, {
      createdAt: new Date().toISOString(),
      target: { siteId, siteSlug, domain: site.primaryDomain, database: "local" },
      livePages: livePages.map((page) => ({ id: page.id, slug: page.slug, contentJson: page.contentJson })),
      themePages: themePages.map((page) => ({ id: page.id, slug: page.slug, draftJson: page.draftJson, publishedJson: page.publishedJson })),
      themeSettings: { id: settings.id, draftJson: settings.draftJson, publishedJson: settings.publishedJson },
      categories: categories.filter((category) => categoryUpdates.some((item) => item.category.id === category.id)).map((category) => ({ id: category.id, slug: category.slug, imageUrl: category.imageUrl })),
      creativePacks: legacyPacks.map((pack) => ({ id: pack.id, categoryId: pack.categoryId, imageUrl: pack.imageUrl, galleryImages: pack.galleryImages, galleryImageAlts: pack.galleryImageAlts })),
      inactiveCreativePacks: inactivePackUpdates.map((item) => ({ id: item.pack.id, categoryId: item.pack.categoryId, status: item.pack.status, imageUrl: item.pack.imageUrl, galleryImages: item.pack.galleryImages, galleryImageAlts: item.pack.galleryImageAlts })),
      videoThemeCategories: videoCategoryUpdates.map((item) => ({ id: item.category.id, slug: item.category.slug, imageUrl: item.category.imageUrl })),
      videoThemes: videoThemeUpdates.updates.map((item) => ({ id: item.theme.id, slug: item.theme.slug, imageUrl: item.theme.imageUrl, galleryImages: item.theme.galleryImages })),
      videoThemeExamples: videoExampleUpdates.map((item) => ({ id: item.example.id, themeId: item.example.themeId, imageUrl: item.example.imageUrl, galleryImages: item.example.galleryImages }))
    });

    for (const item of legacySources) {
      const targetPath = path.resolve(publicRoot, "assets", item.task.outputRelative);
      assert.equal(targetPath, path.resolve(item.task.finalFile), `${item.task.id}: final asset path mismatch.`);
      atomicCopy(item.source, targetPath, { allowReplace: true });
    }
    await assertAssetFiles(assetRows, legacySources, true, plannedReviewAvatars);

    await prisma.$transaction(async (tx) => {
      for (const item of legacyUpdates.values()) {
        if (item.pack.categoryRecord) await tx.creativePackCategory.update({ where: { id: item.pack.categoryRecord.id }, data: { imageUrl: item.next.imageUrl } });
        await tx.creativePack.update({ where: { id: item.pack.id }, data: item.next });
      }
      for (const item of inactivePackUpdates) await tx.creativePack.update({ where: { id: item.pack.id }, data: item.next });
      for (const item of categoryUpdates) await tx.creativePackCategory.update({ where: { id: item.category.id }, data: { imageUrl: item.nextImageUrl } });
      for (const item of videoThemeUpdates.updates) await tx.videoTheme.update({ where: { id: item.theme.id }, data: { imageUrl: item.next.imageUrl, galleryImages: item.next.galleryImages, updatedAt: new Date() } });
      for (const item of videoExampleUpdates) await tx.videoThemeExample.update({ where: { id: item.example.id }, data: { imageUrl: item.next.imageUrl, galleryImages: item.next.galleryImages, updatedAt: new Date() } });
      for (const item of videoCategoryUpdates) await tx.videoThemeCategory.update({ where: { id: item.category.id }, data: { imageUrl: item.nextImageUrl, updatedAt: new Date() } });
      for (const item of changedLivePages) await tx.livePage.update({ where: { id: item.page.id }, data: { contentJson: item.next } });
      for (const item of changedThemePages) await tx.themePage.update({ where: { id: item.page.id }, data: { draftJson: item.nextDraft, publishedJson: item.nextPublished } });
      if (settingsChanged) await tx.themeSettings.update({ where: { id: settings.id }, data: { draftJson: nextSettingsDraft, publishedJson: nextSettingsPublished } });
      for (const row of assetRows.values()) {
        const mediaId = `media_${siteId}_${sha256(row.storageKey).slice(0, 16)}`;
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId, storageKey: row.storageKey } },
          create: { id: mediaId, siteId, label: row.label, storageKey: row.storageKey, mimeType: "image/webp", usageType: row.usageType, sourceType: "aidreamcapes-eu-public-media-replacement", previewUrl: row.url, originUrl: row.url, altText: row.altText },
          update: { label: row.label, mimeType: "image/webp", usageType: row.usageType, sourceType: "aidreamcapes-eu-public-media-replacement", previewUrl: row.url, originUrl: row.url, altText: row.altText }
        });
      }
      await assertAidreamcapesEuHomepageIntegrity(tx);
    }, { timeout: 180_000, maxWait: 30_000 });

    const report = { ...summary, backupPath, appliedAt: new Date().toISOString(), remainingMirrorReferencesAfterApply: countMirrorReferences(changedLivePages.map((item) => item.next).concat(nextSettingsDraft, videoThemeUpdates.updates.map((item) => item.next), videoExampleUpdates.map((item) => item.next), videoCategoryUpdates.map((item) => ({ imageUrl: item.nextImageUrl })))) };
    writeJson(path.join(replacementRoot, "apply-summary.json"), report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function countMirrorReferences(values) {
  let count = 0;
  const visit = (value) => {
    if (typeof value === "string") { if (value.includes(`${assetPrefix}mirror/`)) count += 1; return; }
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    if (value && typeof value === "object") for (const item of Object.values(value)) visit(item);
  };
  for (const value of values) visit(value);
  return count;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
