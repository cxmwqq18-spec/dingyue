#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const apply = hasArgument("--apply") && !hasArgument("--dry-run");

// This migration is deliberately local-only. The public SSR data source is
// local LivePage/CreativePack data in this workspace; production publication
// must go through the reviewed release pipeline instead.
assertDatabaseTarget({ expectedTarget: "local" });
if (apply) assertNonProductionWriteTarget();

const publicAssetPrefix = "/assets/sites/site_aidreamshoots/";
const regeneratedRoot = path.join(process.cwd(), "public/assets/sites/site_aidreamshoots/generated/regenerated");

const latestMedia = {
  engagement: `${publicAssetPrefix}generated/regenerated/aidreamshoots-engagement-13-20260912-v1/occasion-ce78ec5f5515.webp`,
  wedding: `${publicAssetPrefix}generated/regenerated/aidreamshoots-theme-wedding-20260913-v1/occasion-99f28104259b.webp`,
  valentine: `${publicAssetPrefix}generated/regenerated/aidreamshoots-theme-valentine-diverse-20260913-v2/valentine-00-quiet-city-walk-8cc46fd05c6a.webp`,
  christmas: `${publicAssetPrefix}generated/regenerated/aidreamshoots-theme-christmas-20260913-v1/seasonal-932951600e5f.webp`,
  christmasAlt: `${publicAssetPrefix}generated/regenerated/aidreamshoots-theme-christmas-20260913-v1/seasonal-64db2e4dada3.webp`,
  thanksgiving: `${publicAssetPrefix}generated/regenerated/aidreamshoots-theme-thanksgiving-20260913-v1/seasonal-d30583a4a4a4.webp`,
  halloween: `${publicAssetPrefix}generated/regenerated/aidreamshoots-theme-halloween-themed-20260913-v3/halloween-00-quiet-city-walk-235e19990231.webp`,
  avatar: `${publicAssetPrefix}generated/regenerated/aidreamshoots-professional-avatar-diverse-20260913-v1/avatar-00-quiet-city-walk-5530547ec560.webp`,
  headshot: `${publicAssetPrefix}generated/regenerated/aidreamshoots-professional-headshot-diverse-20260913-v1/headshot-00-quiet-city-walk-d1c3618678fc.webp`,
  portrait: `${publicAssetPrefix}generated/regenerated/aidreamshoots-professional-portrait-photo-diverse-20260913-v1/portrait-photo-00-quiet-city-walk-52a903358c93.webp`,
  gala: `${publicAssetPrefix}generated/regenerated/aidreamshoots-professional-gala-photo-diverse-20260913-v1/gala-photo-00-quiet-city-walk-f43ed55832c1.webp`,
  beauty: `${publicAssetPrefix}generated/regenerated/aidreamshoots-lifestyle-creative-rich-lifestyle-diverse-20260913-v1/rich-lifestyle-00-quiet-city-walk-907614798ac6.webp`,
  cyberpunk: `${publicAssetPrefix}generated/regenerated/aidreamshoots-lifestyle-creative-cyberpunk-diverse-20260913-v1/cyberpunk-00-quiet-city-walk-e2ff1a930e76.webp`,
  travel: `${publicAssetPrefix}generated/regenerated/aidreamshoots-lifestyle-creative-travel-diverse-20260913-v1/travel-00-quiet-city-walk-49147472065a.webp`,
  soccer: `${publicAssetPrefix}generated/regenerated/aidreamshoots-lifestyle-creative-soccer-diverse-20260913-v1/soccer-00-quiet-city-walk-d501ec18d0ff.webp`,
  noir: `${publicAssetPrefix}generated/regenerated/aidreamshoots-lifestyle-creative-mafia-diverse-20260913-v1/mafia-00-quiet-city-walk-004b8e5d8de2.webp`,
  social: `${publicAssetPrefix}generated/regenerated/aidreamshoots-magic-photo-tools-social-cards-diverse-20260913-v1/social-cards-00-quiet-city-walk-506437818041.webp`,
  hairstyle: `${publicAssetPrefix}generated/regenerated/aidreamshoots-magic-photo-tools-hairstyle-generator-diverse-20260913-v1/hairstyle-generator-00-quiet-city-walk-206e8ab7de1b.webp`,
  enhancer: `${publicAssetPrefix}generated/regenerated/aidreamshoots-magic-photo-tools-photo-enhancer-diverse-20260913-v1/photo-enhancer-00-quiet-city-walk-9974ef32fbe8.webp`,
  virtualTryOn: `${publicAssetPrefix}generated/regenerated/aidreamshoots-magic-photo-tools-virtual-try-on-diverse-20260913-v1/virtual-try-on-00-quiet-city-walk-bbf0dc2804c0.webp`,
  talkingPhoto: `${publicAssetPrefix}generated/regenerated/aidreamshoots-talking-photo-20260914-v1/talking-photo-hero-poster.webp`,
  blogCover: `${publicAssetPrefix}visuals/generated/blog/virtual-try-on-workflow-cover.webp`
};

const reviewMediaById = {
  review_ava: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/ava-football-fan.webp`,
  review_lucas: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/lucas-gala.webp`,
  review_mia: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/mia-christmas.webp`,
  review_noah: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/noah-private-gallery.webp`,
  review_chloe: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/chloe-creator-scene.webp`,
  review_eli: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/eli-professional-headshot.webp`,
  review_jordan: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/jordan-team-profile.webp`,
  review_riley: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/riley-social-content.webp`
};

const reviewAvatarById = {
  review_ava: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/ava-avatar.webp`,
  review_lucas: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/lucas-avatar.webp`,
  review_mia: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/mia-avatar.webp`,
  review_noah: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/noah-avatar.webp`,
  review_chloe: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/chloe-avatar.webp`,
  review_eli: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/eli-avatar.webp`,
  review_jordan: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/jordan-avatar.webp`,
  review_riley: `${publicAssetPrefix}generated/regenerated/aidreamshoots-review-media-20260915-v1/riley-avatar.webp`
};

const latestPackDirectories = {
  engagement: "aidreamshoots-engagement-13-20260912-v1",
  wedding: "aidreamshoots-theme-wedding-20260913-v1",
  valentine: "aidreamshoots-theme-valentine-diverse-20260913-v2",
  christmas: "aidreamshoots-theme-christmas-20260913-v1",
  thanksgiving: "aidreamshoots-theme-thanksgiving-20260913-v1",
  halloween: "aidreamshoots-theme-halloween-themed-20260913-v3",
  avatar: "aidreamshoots-professional-avatar-diverse-20260913-v1",
  headshot: "aidreamshoots-professional-headshot-diverse-20260913-v1",
  portrait: "aidreamshoots-professional-portrait-photo-diverse-20260913-v1",
  gala: "aidreamshoots-professional-gala-photo-diverse-20260913-v1",
  beauty: "aidreamshoots-lifestyle-creative-rich-lifestyle-diverse-20260913-v1",
  cyberpunk: "aidreamshoots-lifestyle-creative-cyberpunk-diverse-20260913-v1",
  travel: "aidreamshoots-lifestyle-creative-travel-diverse-20260913-v1",
  soccer: "aidreamshoots-lifestyle-creative-soccer-diverse-20260913-v1",
  noir: "aidreamshoots-lifestyle-creative-mafia-diverse-20260913-v1",
  social: "aidreamshoots-magic-photo-tools-social-cards-diverse-20260913-v1",
  hairstyle: "aidreamshoots-magic-photo-tools-hairstyle-generator-diverse-20260913-v1",
  enhancer: "aidreamshoots-magic-photo-tools-photo-enhancer-diverse-20260913-v1",
  virtualTryOn: "aidreamshoots-magic-photo-tools-virtual-try-on-diverse-20260913-v1",
  backgroundChanger: "aidreamshoots-magic-photo-tools-background-changer-diverse-20260913-v1",
  backgroundRemover: "aidreamshoots-magic-photo-tools-background-remover-diverse-20260913-v1",
  colorCorrection: "aidreamshoots-magic-photo-tools-color-correction-diverse-20260913-v1",
  editByPrompt: "aidreamshoots-magic-photo-tools-edit-by-prompt-diverse-20260913-v1",
  magicEraser: "aidreamshoots-magic-photo-tools-magic-eraser-diverse-20260913-v1",
  motionGenerator: "aidreamshoots-magic-photo-tools-motion-generator-diverse-20260913-v1",
  oldPhotoRestoration: "aidreamshoots-magic-photo-tools-old-photo-restoration-diverse-20260913-v1",
  portraitRetouch: "aidreamshoots-magic-photo-tools-portrait-retouch-diverse-20260913-v1",
  unblurImage: "aidreamshoots-magic-photo-tools-unblur-image-diverse-20260913-v1",
  bikini: "aidreamshoots-lifestyle-creative-bikini-diverse-20260913-v1",
  boudoir: "aidreamshoots-lifestyle-creative-boudoir-diverse-20260913-v1",
  cannes: "aidreamshoots-lifestyle-creative-cannes-diverse-20260913-v1",
  holiday: "aidreamshoots-lifestyle-creative-holiday-diverse-20260913-v1",
  nightlife: "aidreamshoots-lifestyle-creative-nightlife-diverse-20260913-v1",
  swimsuit: "aidreamshoots-lifestyle-creative-swimsuit-diverse-20260913-v1",
  streetStyle: "aidreamshoots-lifestyle-creative-street-style-diverse-20260913-v1",
  urban: "aidreamshoots-lifestyle-creative-urban-diverse-20260913-v1",
  blackFriday: "aidreamshoots-professional-black-friday-diverse-20260913-v1",
  onlyFans: "aidreamshoots-professional-only-fans-diverse-20260913-v1",
  singlesAwareness: "aidreamshoots-professional-singles-awareness-day-diverse-20260913-v1"
};

const latestPackMainNames = {
  engagement: "occasion-ce78ec5f5515.webp",
  wedding: "occasion-99f28104259b.webp",
  valentine: "valentine-00-quiet-city-walk-8cc46fd05c6a.webp",
  christmas: "seasonal-932951600e5f.webp",
  thanksgiving: "seasonal-d30583a4a4a4.webp",
  halloween: "halloween-00-quiet-city-walk-235e19990231.webp"
};

const latestPackCache = new Map();

function latestPackAssets(key) {
  if (latestPackCache.has(key)) return latestPackCache.get(key);
  const directory = latestPackDirectories[key];
  assert(directory, `No regenerated directory configured for pack key ${key}.`);
  const directoryPath = path.join(regeneratedRoot, directory);
  assert(fs.existsSync(directoryPath), `Regenerated directory is missing: ${directoryPath}`);
  const files = fs.readdirSync(directoryPath).filter((file) => file.endsWith(".webp")).sort();
  assert(files.length >= 2, `Regenerated directory has too few assets: ${directoryPath}`);
  const mainName = latestPackMainNames[key] ?? files.find((file) => /-00-/.test(file)) ?? files[0];
  assert(files.includes(mainName), `Regenerated main asset is missing: ${path.join(directoryPath, mainName)}`);
  const base = `${publicAssetPrefix}generated/regenerated/${directory}`;
  const result = {
    main: `${base}/${mainName}`,
    gallery: files.filter((file) => file !== mainName).slice(0, 12).map((file) => `${base}/${file}`)
  };
  latestPackCache.set(key, result);
  return result;
}

const legacyPackKeyBySlug = {
  engagement: "engagement",
  "wedding-portraits": "wedding",
  "desi-wedding": "wedding",
  "indian-wedding": "wedding",
  "valentine-photos": "valentine",
  "christmas-photos": "christmas",
  "christmas-couple": "christmas",
  "halloween-party-photos": "halloween",
  "thanksgiving-group-photos": "thanksgiving",
  "gala-photos": "gala",
  "world-cup-fan-photos": "soccer",
  "creator-portraits": "portrait",
  "professional-headshots": "headshot",
  "profile-cards": "avatar",
  "social-cards": "social",
  "anime-avatar": "avatar",
  "fashion-editorial": "cannes",
  "product-style": "backgroundChanger",
  holiday: "holiday",
  nature: "travel",
  "travel-scene-pack": "travel",
  "magic-upscaler": "enhancer",
  "ai-video-add-ons": "motionGenerator",
  "virtual-try-on": "virtualTryOn",
  hairstyle: "hairstyle",
  mafia: "noir",
  cyberpunk: "cyberpunk",
  boudoir: "boudoir",
  bikini: "bikini",
  swimsuit: "swimsuit",
  nightlife: "nightlife",
  "outdoor-creator-scenes": "travel",
  "black-friday": "blackFriday",
  "only-fans": "onlyFans",
  "singles-awareness-day": "singlesAwareness",
  "background-changer": "backgroundChanger",
  "background-remover": "backgroundRemover",
  "color-correction": "colorCorrection",
  "edit-by-prompt": "editByPrompt",
  "magic-eraser": "magicEraser",
  "motion-generator": "motionGenerator",
  "old-photo-restoration": "oldPhotoRestoration",
  "portrait-retouch": "portraitRetouch",
  "unblur-image": "unblurImage",
  "street-style": "streetStyle",
  "rich-lifestyle": "beauty",
  "professional": "headshot",
  "headshot": "headshot",
  "photo-enhancer": "enhancer",
  "photo-tools": "enhancer",
  "sports": "soccer",
  "video": "motionGenerator",
  "creator": "portrait",
  "couple": "engagement",
  "cultural": "beauty",
  "best-themes-presets": "beauty"
};

const legacyPackKeyByText = [
  ["professional-headshots", "headshot"], ["headshots", "headshot"], ["portrait-retouch", "portraitRetouch"],
  ["old-photo-restoration", "oldPhotoRestoration"], ["background-remover", "backgroundRemover"],
  ["background-changer", "backgroundChanger"], ["color-correction", "colorCorrection"],
  ["edit-by-prompt", "editByPrompt"], ["magic-eraser", "magicEraser"], ["motion-generator", "motionGenerator"],
  ["unblur-image", "unblurImage"], ["photo-enhancer", "enhancer"], ["magic-upscaler", "enhancer"],
  ["virtual-try-on", "virtualTryOn"], ["ai-video-add-ons", "motionGenerator"], ["anime-avatar", "avatar"],
  ["singles-awareness-day", "singlesAwareness"], ["only-fans", "onlyFans"], ["black-friday", "blackFriday"],
  ["christmas-photos", "christmas"], ["christmas-couple", "christmas"], ["christmas", "christmas"],
  ["thanksgiving", "thanksgiving"], ["halloween", "halloween"], ["valentine", "valentine"],
  ["engagement", "engagement"], ["wedding", "wedding"], ["gala", "gala"], ["world-cup", "soccer"],
  ["soccer", "soccer"], ["cyberpunk", "cyberpunk"], ["boudoir", "boudoir"], ["bikini", "bikini"],
  ["swimsuit", "swimsuit"], ["nightlife", "nightlife"], ["fashion-editorial", "cannes"],
  ["street-style", "streetStyle"], ["outdoor-creator", "travel"], ["travel", "travel"], ["nature", "travel"],
  ["profile-cards", "avatar"], ["social-cards", "social"], ["creator-portraits", "portrait"],
  ["creator", "portrait"], ["avatar", "avatar"], ["rich-lifestyle", "beauty"], ["lifestyle", "beauty"],
  ["cannes", "cannes"], ["holiday", "holiday"], ["urban", "urban"], ["calle", "streetStyle"],
  ["premium", "beauty"], ["product-style", "backgroundChanger"], ["product", "beauty"], ["headshot", "headshot"],
  ["professional", "headshot"], ["borrador", "magicEraser"], ["enfocar", "unblurImage"], ["mejorador", "enhancer"],
  ["retoque", "portraitRetouch"], ["cambiador", "backgroundChanger"], ["eliminador", "backgroundRemover"],
  ["correccion", "colorCorrection"], ["instrucciones", "editByPrompt"], ["peinado", "hairstyle"],
  ["mejora magica", "enhancer"], ["noir", "noir"], ["vida nocturna", "nightlife"], ["banador", "swimsuit"]
];

function inferPackKey(text) {
  const normalized = String(text ?? "").toLowerCase();
  for (const [token, key] of legacyPackKeyByText) if (normalized.includes(token)) return key;
  return undefined;
}

function packAssetForLegacyPath(relativePath) {
  const normalized = relativePath.replace(/^creative-packs\//, "");
  const match = normalized.match(/^(?:generated\/)?pack-(?:galleries|covers)\/([^/]+)\/([^/?#]+)/);
  if (!match) return undefined;
  const [, slug, filename] = match;
  const key = legacyPackKeyBySlug[slug] ?? inferPackKey(slug);
  if (!key) return undefined;
  const assets = latestPackAssets(key);
  if (normalized.includes("/pack-covers/")) return assets.main;
  const number = filename.match(/-(\d{2})(?:\D|$)/)?.[1];
  const index = number ? Math.max(0, Number(number) - 1) : 0;
  return assets.gallery[index] ?? assets.main;
}

const explicitLegacyMedia = {
  "generated/20260622-homepage-unique/hero-package-wall.png": latestMedia.beauty,
  "generated/20260622-homepage-unique/hero-credit-studio-card.png": latestMedia.headshot,
  "generated/20260622-homepage-unique/pricing-credits-visual.png": latestMedia.headshot,
  "generated/20260622-homepage-unique/hero-grid-business.png": latestMedia.headshot,
  "generated/20260622-homepage-unique/hero-grid-beauty.png": latestMedia.beauty,
  "generated/20260622-homepage-unique/hero-grid-cyber.png": latestMedia.cyberpunk,
  "generated/20260622-homepage-unique/hero-grid-travel.png": latestMedia.travel,
  "generated/20260622-homepage-unique/hero-grid-sports.png": latestMedia.soccer,
  "generated/20260622-homepage-unique/hero-grid-avatar.png": latestMedia.avatar,
  "generated/20260622-homepage-unique/hero-grid-product.png": latestMedia.portrait,
  "generated/20260622-homepage-unique/hero-grid-video.png": latestMedia.talkingPhoto,
  "generated/20260622-homepage-unique/hero-grid-social.png": latestMedia.social,
  "generated/20260622-homepage-unique/hero-grid-noir.png": latestMedia.noir,
  "generated/20260622-homepage-unique/hero-grid-gala.png": latestMedia.gala,
  "generated/20260622-homepage-unique/hero-grid-upscale.png": latestMedia.enhancer,
  "generated/20260622-homepage-unique/proof-worldcup-gallery.png": latestMedia.soccer,
  "generated/20260622-homepage-unique/proof-business-founder.png": latestMedia.headshot,
  "generated/20260622-homepage-unique/proof-beauty-hair.png": latestMedia.hairstyle,
  "generated/20260622-homepage-unique/proof-cinematic-worlds.png": latestMedia.cyberpunk,
  "generated/20260622-homepage-unique/proof-couple-engagement.png": latestMedia.engagement,
  "generated/20260622-homepage-unique/catalog-worldcup-card.png": latestMedia.soccer,
  "generated/20260622-homepage-unique/catalog-headshot-card.png": latestMedia.headshot,
  "generated/20260622-homepage-unique/catalog-hairstyle-card.png": latestMedia.hairstyle,
  "generated/20260622-homepage-unique/catalog-gala-card.png": latestMedia.gala,
  "generated/20260622-homepage-unique/flow-before-upload.png": latestMedia.headshot,
  "generated/20260622-homepage-unique/flow-private-album-workspace.png": reviewMediaById.review_noah,
  "generated/20260622-homepage-unique/about-company-office.png": latestMedia.portrait,
  "generated/20260622-homepage-unique/review-ava-avatar.png": reviewAvatarById.review_ava,
  "generated/20260622-homepage-unique/review-ava-result-gala.png": reviewMediaById.review_ava,
  "generated/20260622-homepage-unique/review-lucas-avatar.png": reviewAvatarById.review_lucas,
  "generated/20260622-homepage-unique/review-lucas-result-headshot.png": reviewMediaById.review_lucas,
  "generated/20260622-homepage-unique/review-mia-avatar.png": reviewAvatarById.review_mia,
  "generated/20260622-homepage-unique/review-mia-result-beauty-sports.png": reviewMediaById.review_mia,
  "generated/20260622-homepage-unique/review-noah-avatar.png": reviewAvatarById.review_noah,
  "generated/20260622-homepage-unique/review-noah-result-social-card.png": reviewMediaById.review_noah,
  "generated/20260622-pack-fill/ai-video-addons-pack.png": latestMedia.talkingPhoto,
  "generated/20260622-pack-fill/magic-upscaler-pack.png": latestMedia.enhancer,
  "generated/20260622-pack-fill/desi-wedding-pack.png": latestMedia.wedding,
  "generated/20260622-pack-fill/holiday-travel-pack.png": latestMedia.travel,
  "frames/faq-intro-portrait.png": latestMedia.headshot,
  "frames/sample-cyberpunk.png": latestMedia.cyberpunk,
  "frames/sample-professional-headshot.png": latestMedia.headshot,
  "frames/sample-wedding-trip.png": latestMedia.wedding,
  "frames/story-beauty-portrait.png": latestMedia.beauty,
  "frames/story-wedding-look.png": latestMedia.wedding,
  "frames/tab-virtual-looks.png": latestMedia.virtualTryOn,
  "frames/workflow-upload-source.png": latestMedia.headshot,
  "frames/sample-christmas-couple.png": latestMedia.christmas,
  "generated/20260618/headshot-lifestyle-v1.png": latestMedia.headshot,
  "generated/20260618/hairstyle-preview-v1.png": latestMedia.hairstyle,
  "generated/20260618/upscaler-utility-v1.png": latestMedia.enhancer,
  "generated/20260618/city-date-night-v1.png": latestMedia.engagement,
  "generated/20260619/cyberpunk-solo-city-v1.png": latestMedia.cyberpunk,
  "generated/20260619/mafia-noir-single-v1.png": latestMedia.noir,
  "generated/20260619/nature-adventure-solo-v1.png": latestMedia.travel,
  "generated/20260619/christmas-solo-card-v1.png": latestMedia.christmas,
  "generated/20260621-worldcup-pack/stadium-portrait.png": latestMedia.soccer,
  "generated/20260621-worldcup-pack/friend-fan-photos.png": latestMedia.soccer,
  "generated/20260621-worldcup-pack/match-day-avatar.png": latestMedia.avatar,
  "generated/20260621-worldcup-pack/fan-poster.png": latestMedia.soccer,
  "generated/20260621-worldcup-pack/social-story.png": latestMedia.soccer,
  "generated/20260621-worldcup-pack/banner-cover.png": latestMedia.soccer,
  "beauty-portrait-gpt2.png": latestMedia.beauty,
  "editorial-headshot-gpt2.png": latestMedia.headshot,
  "avatar-nora-gpt2.png": latestMedia.avatar,
  "avatar-nora-gpt2-fast.png": latestMedia.avatar,
  "holiday-card-gpt2.png": latestMedia.christmas,
  "generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-01.webp": latestMedia.blogCover,
  "generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-06.webp": latestMedia.talkingPhoto,
  "generated/pack-galleries/gala-photos/gala-photos-02-20260830.webp": reviewMediaById.review_lucas,
  "generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-03-20260830.webp": reviewMediaById.review_ava,
  "generated/20260830-homepage-review-replacements/world-cup-fan-photos-03-20260830.webp": reviewMediaById.review_ava,
  "generated/20260830-homepage-review-replacements/gala-photos-02-20260830.webp": reviewMediaById.review_lucas,
  "generated/20260830-homepage-review-replacements/instagram-social-content-creator-photo.webp": reviewMediaById.review_mia,
  "generated/20260830-homepage-review-replacements/private-photo-gallery-review.webp": reviewMediaById.review_noah,
  "generated/20260830-homepage-review-replacements/fresh-social-content-creator-scene.webp": reviewMediaById.review_chloe,
  "generated/20260830-homepage-review-replacements/polished-professional-headshot.webp": reviewMediaById.review_eli,
  "generated/20260830-homepage-review-replacements/jordan-k-team-profile-avatar.webp": reviewMediaById.review_jordan,
  "generated/20260830-homepage-review-replacements/riley-w-social-content-avatar.webp": reviewMediaById.review_riley
};

function relativePathForAssetCandidate(candidate) {
  if (candidate.startsWith("/assets/dreamshoot/")) return candidate.slice("/assets/dreamshoot/".length);
  if (candidate.startsWith(`${publicAssetPrefix}visuals/`)) return candidate.slice(`${publicAssetPrefix}visuals/`.length);
  if (candidate.startsWith(`${publicAssetPrefix}creative-packs/`)) return `creative-packs/${candidate.slice(`${publicAssetPrefix}creative-packs/`.length)}`;
  return "";
}

function replacementForRelativePath(relativePath) {
  const normalized = relativePath.replace(/^creative-packs\//, "");
  const explicit = explicitLegacyMedia[normalized] ?? explicitLegacyMedia[normalized.replace(/\.webp$/i, ".png")] ?? explicitLegacyMedia[normalized.replace(/\.png$/i, ".webp")];
  if (explicit) return explicit;
  return packAssetForLegacyPath(relativePath);
}

const assetCandidatePattern = /\/assets\/(?:dreamshoot\/|sites\/site_aidreamshoots\/(?:visuals|creative-packs)\/)[^"'\s|]+/g;

function rewriteMediaString(value) {
  if (typeof value !== "string" || !value.includes("/assets/")) return value;
  return value.replace(assetCandidatePattern, (candidate) => {
    const pathOnly = candidate.split(/[?#]/, 1)[0].replace(/[),.;]+$/g, "");
    const replacement = replacementForRelativePath(relativePathForAssetCandidate(pathOnly));
    return replacement ?? candidate;
  });
}

function rewriteValue(value) {
  if (typeof value === "string") return rewriteMediaString(value);
  if (Array.isArray(value)) return value.map(rewriteValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteValue(child)]));
}

function applyHomepageReviewMedia(value) {
  for (const block of value?.sections?.proof_1?.blocks ?? []) {
    const imageUrl = reviewMediaById[block?.id];
    if (!imageUrl) continue;
    block.settings = { ...(block.settings ?? {}), avatarUrl: reviewAvatarById[block.id], resultImageUrl: imageUrl };
  }
  return value;
}

function rewriteNestedHomepageReviews(value) {
  if (Array.isArray(value)) return value.map(rewriteNestedHomepageReviews);
  if (!value || typeof value !== "object") return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteNestedHomepageReviews(child)]));
  return next?.sections?.proof_1 ? applyHomepageReviewMedia(next) : next;
}

function updatePageJson(value, slug) {
  const next = rewriteValue(value ?? {});
  if (slug === "/") applyHomepageReviewMedia(next);
  if (slug === "/blog/video-photo-package-guide") {
    const blogDetail = next.sections?.blog_detail_1;
    if (blogDetail?.settings && typeof blogDetail.settings === "object") blogDetail.settings.imageUrl = latestMedia.blogCover;
  }
  return next;
}

function packKeyForRow(row) {
  return inferPackKey([row.id, row.name, row.imageUrl].filter(Boolean).join(" "));
}

const categoryKeyBySlug = {
  engagement: "engagement", "engagement-photo": "engagement", wedding: "wedding", "wedding-photo": "wedding",
  "wedding-portraits": "wedding", "desi-wedding": "wedding", "indian-wedding": "wedding", valentine: "valentine",
  "valentine-photos": "valentine", "valentines-photo": "valentine", christmas: "christmas", "christmas-photo": "christmas",
  "christmas-photos": "christmas", "christmas-couple": "christmas", thanksgiving: "thanksgiving", "thanksgiving-photo": "thanksgiving",
  "thanksgiving-group-photos": "thanksgiving", halloween: "halloween", "halloween-photo": "halloween", "halloween-party-photos": "halloween",
  professional: "headshot", headshot: "headshot", headshots: "headshot", "lifestyle-creative": "beauty", "rich-lifestyle": "beauty",
  magic: "beauty", "best-themes-presets": "beauty", creator: "portrait", "creator-portraits": "portrait", couple: "engagement",
  "photo-tools": "enhancer", "photo-enhancer": "enhancer", "magic-upscaler": "enhancer", video: "motionGenerator", "ai-video-add-ons": "motionGenerator",
  sports: "soccer", soccer: "soccer", "world-cup-fan-photos": "soccer", cyberpunk: "cyberpunk", gala: "gala", "gala-photo": "gala", "gala-photos": "gala",
  travel: "travel", nature: "travel", "travel-scene-pack": "travel", urban: "urban", "street-style": "streetStyle", "fashion-editorial": "cannes", cannes: "cannes",
  holiday: "holiday", nightlife: "nightlife", boudoir: "boudoir", bikini: "bikini", swimsuit: "swimsuit", "background-changer": "backgroundChanger",
  "background-remover": "backgroundRemover", "color-correction": "colorCorrection", "edit-by-prompt": "editByPrompt", "magic-eraser": "magicEraser",
  "motion-generator": "motionGenerator", "old-photo-restoration": "oldPhotoRestoration", "portrait-retouch": "portraitRetouch", "unblur-image": "unblurImage",
  "virtual-try-on": "virtualTryOn", "profile-cards": "avatar", "social-cards": "social", "anime-avatar": "avatar", "black-friday": "blackFriday",
  "only-fans": "onlyFans", "singles-awareness-day": "singlesAwareness", cultural: "beauty"
};

function categoryKeyForRow(row) {
  return categoryKeyBySlug[row.slug] ?? inferPackKey([row.slug, row.label, row.imageUrl].filter(Boolean).join(" "));
}

function changedJson(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function collectRecognizedLegacyPaths(value, found = new Set()) {
  if (typeof value === "string") {
    for (const candidate of value.match(assetCandidatePattern) ?? []) {
      const pathOnly = candidate.split(/[?#]/, 1)[0].replace(/[),.;]+$/g, "");
      const relative = relativePathForAssetCandidate(pathOnly);
      if (replacementForRelativePath(relative)) found.add(pathOnly);
    }
    return found;
  }
  if (Array.isArray(value)) { value.forEach((child) => collectRecognizedLegacyPaths(child, found)); return found; }
  if (value && typeof value === "object") Object.values(value).forEach((child) => collectRecognizedLegacyPaths(child, found));
  return found;
}

const prisma = new PrismaClient();
try {
  const [themePages, livePages, themeSettings, siteThemes, creativePacks, creativePackCategories] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID } }),
    prisma.siteTheme.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    prisma.creativePack.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    prisma.creativePackCategory.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } })
  ]);
  assert(themeSettings, "AIdreamshoots ThemeSettings row is required.");
  for (const [key, asset] of Object.entries(latestMedia)) {
    if (key === "blogCover") continue;
    const filePath = path.join(process.cwd(), asset.replace(/^\/assets\//, "public/assets/"));
    assert(fs.existsSync(filePath), `Latest media file is missing: ${filePath}`);
  }

  const nextThemePages = themePages.map((row) => ({ id: row.id, slug: row.slug, draftJson: updatePageJson(row.draftJson, row.slug), publishedJson: updatePageJson(row.publishedJson, row.slug) }));
  const nextLivePages = livePages.map((row) => ({ id: row.id, slug: row.slug, contentJson: updatePageJson(row.contentJson, row.slug) }));
  const nextThemeSettings = { id: themeSettings.id, draftJson: rewriteValue(themeSettings.draftJson), publishedJson: rewriteValue(themeSettings.publishedJson) };
  const nextSiteThemes = siteThemes.map((row) => ({ id: row.id, templates: rewriteNestedHomepageReviews(rewriteValue(row.templates)), settings: rewriteValue(row.settings) }));
  const nextCreativePacks = creativePacks.map((row) => {
    const key = packKeyForRow(row);
    const assets = key ? latestPackAssets(key) : undefined;
    return {
      id: row.id,
      imageUrl: assets?.main ?? rewriteMediaString(row.imageUrl),
      galleryImages: assets?.gallery ?? rewriteValue(row.galleryImages)
    };
  });
  const nextCreativePackCategories = creativePackCategories.map((row) => {
    const key = categoryKeyForRow(row);
    const assets = key ? latestPackAssets(key) : undefined;
    return { id: row.id, imageUrl: assets?.main ?? rewriteMediaString(row.imageUrl) };
  });

  const changed = {
    themePages: nextThemePages.filter((row) => { const before = themePages.find((candidate) => candidate.id === row.id); return changedJson(before?.draftJson, row.draftJson) || changedJson(before?.publishedJson, row.publishedJson); }).map((row) => row.slug),
    livePages: nextLivePages.filter((row) => changedJson(livePages.find((candidate) => candidate.id === row.id)?.contentJson, row.contentJson)).map((row) => row.slug),
    themeSettings: changedJson(themeSettings.draftJson, nextThemeSettings.draftJson) || changedJson(themeSettings.publishedJson, nextThemeSettings.publishedJson),
    siteThemes: nextSiteThemes.filter((row) => { const before = siteThemes.find((candidate) => candidate.id === row.id); return changedJson(before?.templates, row.templates) || changedJson(before?.settings, row.settings); }).map((row) => row.id),
    creativePacks: nextCreativePacks.filter((row) => { const before = creativePacks.find((candidate) => candidate.id === row.id); return before?.imageUrl !== row.imageUrl || changedJson(before?.galleryImages, row.galleryImages); }).map((row) => row.id),
    creativePackCategories: nextCreativePackCategories.filter((row) => creativePackCategories.find((candidate) => candidate.id === row.id)?.imageUrl !== row.imageUrl).map((row) => row.id)
  };

  const report = {
    ok: true,
    mode: apply ? "apply" : "dry-run",
    target: "local",
    siteId: SITE_ID,
    sourceRows: { themePages: themePages.length, livePages: livePages.length, siteThemes: siteThemes.length, creativePacks: creativePacks.length, creativePackCategories: creativePackCategories.length },
    changed,
    reviewPolicy: "Each homepage review uses a vendor-generated headshot avatar and a matching vendor-generated themed result image.",
    backupPath: null
  };

  if (apply) {
    const backupPath = path.join(process.cwd(), "releases/backups/local", `aidreamshoots-public-media-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, themePages, livePages, themeSettings, siteThemes, creativePacks, creativePackCategories }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      for (const row of nextThemePages) {
        const before = themePages.find((candidate) => candidate.id === row.id);
        if (changedJson(before?.draftJson, row.draftJson) || changedJson(before?.publishedJson, row.publishedJson)) await tx.themePage.update({ where: { id: row.id }, data: { draftJson: row.draftJson, publishedJson: row.publishedJson, updatedAt: new Date() } });
      }
      for (const row of nextLivePages) {
        const before = livePages.find((candidate) => candidate.id === row.id);
        if (changedJson(before?.contentJson, row.contentJson)) await tx.livePage.update({ where: { id: row.id }, data: { contentJson: row.contentJson, updatedAt: new Date() } });
      }
      if (changedJson(themeSettings.draftJson, nextThemeSettings.draftJson) || changedJson(themeSettings.publishedJson, nextThemeSettings.publishedJson)) await tx.themeSettings.update({ where: { id: themeSettings.id }, data: { draftJson: nextThemeSettings.draftJson, publishedJson: nextThemeSettings.publishedJson, updatedAt: new Date() } });
      for (const row of nextSiteThemes) {
        const before = siteThemes.find((candidate) => candidate.id === row.id);
        if (changedJson(before?.templates, row.templates) || changedJson(before?.settings, row.settings)) await tx.siteTheme.update({ where: { id: row.id }, data: { templates: row.templates, settings: row.settings, updatedAt: new Date() } });
      }
      for (const row of nextCreativePacks) {
        const before = creativePacks.find((candidate) => candidate.id === row.id);
        if (before?.imageUrl !== row.imageUrl || changedJson(before?.galleryImages, row.galleryImages)) await tx.creativePack.update({ where: { id: row.id }, data: { imageUrl: row.imageUrl, galleryImages: row.galleryImages, updatedAt: new Date() } });
      }
      for (const row of nextCreativePackCategories) {
        const before = creativePackCategories.find((candidate) => candidate.id === row.id);
        if (before?.imageUrl !== row.imageUrl) await tx.creativePackCategory.update({ where: { id: row.id }, data: { imageUrl: row.imageUrl, updatedAt: new Date() } });
      }
    }, { timeout: 120_000 });

    const [homeAfter, liveAfter] = await Promise.all([
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } }, select: { contentJson: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { contentJson: true } })
    ]);
    const reviewParity = (homeAfter?.contentJson?.sections?.proof_1?.blocks ?? []).filter((block) => reviewMediaById[block?.id]).map((block) => ({ id: block.id, avatarUrl: block.settings?.avatarUrl, resultImageUrl: block.settings?.resultImageUrl, expectedAvatarUrl: reviewAvatarById[block.id], expectedResultImageUrl: reviewMediaById[block.id], valid: block.settings?.avatarUrl === reviewAvatarById[block.id] && block.settings?.resultImageUrl === reviewMediaById[block.id] })).filter((item) => !item.valid);
    assert.equal(reviewParity.length, 0, "Homepage review avatar/result mapping failed after apply.");
    const remainingRecognizedLegacyMedia = [...new Set(liveAfter.flatMap((row) => [...collectRecognizedLegacyPaths(row.contentJson)]))];
    assert.equal(remainingRecognizedLegacyMedia.length, 0, `Recognized legacy media remains in LivePage data: ${remainingRecognizedLegacyMedia.join(", ")}`);
    report.backupPath = backupPath;
    report.readback = { homepageReviewCount: (homeAfter?.contentJson?.sections?.proof_1?.blocks ?? []).filter((block) => reviewMediaById[block?.id]).length, reviewParity, remainingRecognizedLegacyMedia };
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
