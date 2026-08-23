#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import { readPlatformStateFromSql, writePlatformStateToSql } from "./lib/platform-state-sql.mjs";

const SITE_ID = "site_dreamshoot";
const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--apply") && !args.has("--db");
const applyJson = args.has("--apply");
const applyDb = args.has("--db");

const forbiddenAltPattern = /\b(?:visual reference|gallery image|gallery example|package gallery|image\s+\d+|for browsing|for review|mydreamshoots|mydreamshoots\.com|aidreamshoots|aidreamcapes)\b/i;
const pathOrFilePattern = /https?:\/\/|\/assets\/|(?:^|\s)sites\/|(?:^|\s)[\w./-]+\.(?:png|jpe?g|webp|avif|svg)(?:\?\S+)?/i;
const repeatedPhrasePattern = /\b([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){1,3})\s+\1\b/i;
const stopWords = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with"
]);

const galleryScenes = [
  "close portrait framing with clear facial detail",
  "half-body editorial pose with balanced crop",
  "group-friendly composition with space around the subjects",
  "wide environmental scene with contextual background",
  "candid social-style expression with natural posture",
  "detail portrait crop with polished styling",
  "vertical profile crop with clean framing",
  "cinematic color contrast with directional light",
  "album-cover style crop with strong subject focus",
  "lifestyle portrait framing with natural setting cues",
  "event-style portrait under polished light",
  "distinct themed pose with refined styling"
];

const subjectBySourceSlug = {
  "professional-headshots": "Professional studio headshot",
  "world-cup-fan-photos": "Football fan portrait in a stadium",
  hairstyle: "Hairstyle preview portrait with polished styling",
  cyberpunk: "Neon cyberpunk portrait in a city scene",
  "gala-photos": "Formal gala portrait with editorial lighting",
  mafia: "Noir character portrait with dramatic contrast",
  nature: "Outdoor adventure portrait in a natural landscape",
  "outdoor-creator-scenes": "Urban lifestyle portrait in a city setting",
  "virtual-try-on": "Beauty portrait with editorial lighting",
  "profile-cards": "Social profile card portrait with clean avatar framing",
  "creator-portraits": "Creator portrait with polished studio styling",
  "fashion-editorial": "Editorial fashion portrait with refined wardrobe styling",
  "anime-avatar": "Stylized anime-inspired avatar portrait",
  "product-style": "Product-style lifestyle scene with clean studio lighting",
  "social-cards": "Social card portrait with polished graphic framing",
  "wedding-portraits": "Wedding-style couple portrait in soft ceremony light",
  "indian-wedding": "Indian wedding-style portrait with rich celebration styling",
  "desi-wedding": "Desi wedding-style portrait with traditional celebration styling",
  "valentine-photos": "Romantic couple portrait with warm date-night light",
  engagement: "Engagement-style couple portrait for an announcement",
  boudoir: "Tasteful style portrait with soft studio lighting",
  holiday: "Seasonal holiday portrait with warm festive styling",
  "christmas-couple": "Christmas couple portrait with cozy festive light",
  "christmas-photos": "Solo Christmas portrait with warm greeting-card styling",
  "ai-video-add-ons": "Motion-ready portrait frame with cinematic lighting",
  "magic-upscaler": "Enhanced portrait preview with crisp detail",
  "thanksgiving-group-photos": "Thanksgiving group portrait at a warm dinner setting",
  "halloween-party-photos": "Halloween party portrait with dramatic colored lighting"
};

const mediaAssetAltByFile = {
  "cyberpunk-solo-city-v1.png": "Neon city cyberpunk portrait with futuristic styling.",
  "worldcup-friend-fan-photos.png": "Friends in football fan outfits celebrating together.",
  "worldcup-match-day-avatar.png": "Square match-day football fan avatar portrait.",
  "worldcup-fan-poster.png": "Football fan poster artwork with stadium lighting.",
  "worldcup-social-story.png": "Vertical football fan story layout for mobile sharing.",
  "worldcup-banner-cover.png": "Wide football supporter banner with stadium lights.",
  "worldcup-stadium-portrait.png": "Football supporter portrait in stadium match light.",
  "holiday-card-gpt2.png": "Holiday card style portrait with seasonal styling.",
  "cliffside-holiday-v1.png": "Cliffside travel portrait in bright destination light.",
  "avatar-nora-gpt2.png": "Creator profile portrait with personal styling.",
  "editorial-headshot-gpt2.png": "Editorial headshot portrait with polished studio lighting.",
  "beauty-portrait-gpt2.png": "Soft studio beauty portrait with polished styling.",
  "headshot-lifestyle-v1.png": "Lifestyle headshot with natural creator framing.",
  "hairstyle-preview-v1.png": "Hairstyle preview portrait with polished hair direction.",
  "upscaler-utility-v1.png": "Enhanced portrait preview with sharper detail.",
  "holiday-portrait-v1.png": "Profile-card portrait designed for social use.",
  "mafia-noir-single-v1.png": "Noir character portrait with dramatic lighting.",
  "nature-adventure-solo-v1.png": "Outdoor adventure portrait in a natural landscape.",
  "hero-credit-studio-card.png": "Credit studio card showing package and album options.",
  "pricing-credits-visual.png": "Pricing credit visual with plan and checkout details.",
  "flow-before-upload.png": "Source photo upload step before creating an album.",
  "flow-private-album-workspace.png": "Private album workspace with finished result cards.",
  "hero-package-wall.png": "Homepage wall showing multiple portrait outcomes."
};

async function readState() {
  return readPlatformStateFromSql();
}

async function writeState(state) {
  await writePlatformStateToSql(state);
}

function cleanAltText(value) {
  return String(value ?? "")
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .replace(/\/assets\/\S+/gi, " ")
    .replace(/\b(?:sites|public|generated|assets)\/[\w./-]+/gi, " ")
    .replace(/\b[\w./-]+\.(?:png|jpe?g|webp|avif|svg)(?:\?\S+)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/[,.]+\s*$/g, "")
    .trim();
}

function normalizeAlt(value) {
  return cleanAltText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return new Set(
    normalizeAlt(value)
      .split(" ")
      .filter((token) => token.length > 2 && !stopWords.has(token))
  );
}

function similarity(left, right) {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / (leftTokens.size + rightTokens.size - intersection);
}

function imageIdentity(value) {
  return String(value ?? "").trim().split("#")[0].split("?")[0];
}

function assertValidAlt(value, context) {
  const alt = cleanAltText(value);
  if (!alt) throw new Error(`Empty alt candidate for ${context}`);
  if (forbiddenAltPattern.test(alt)) {
    throw new Error(`Forbidden alt content for ${context}: ${alt}`);
  }
  if (pathOrFilePattern.test(alt)) {
    throw new Error(`Path, URL, or filename in alt for ${context}: ${alt}`);
  }
  if (repeatedPhrasePattern.test(alt)) {
    throw new Error(`Repeated phrase in alt for ${context}: ${alt}`);
  }
  return alt.endsWith(".") ? alt : `${alt}.`;
}

function sourceSlugFromImageUrl(imageUrl) {
  const cleanUrl = imageIdentity(imageUrl);
  const segments = cleanUrl.split("/").filter(Boolean);
  return segments.at(-2) || "";
}

function subjectForPack(pack, imageUrl) {
  const sourceSlug = sourceSlugFromImageUrl(imageUrl);
  if (subjectBySourceSlug[sourceSlug]) return subjectBySourceSlug[sourceSlug];

  const packSlug = String(pack.category || pack.name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (sourceSlug && sourceSlug === packSlug) {
    const headline = cleanAltText(pack.headline || pack.description || pack.name);
    return headline || `${pack.name} themed portrait`;
  }

  const packKey = `${pack.category ?? ""} ${pack.name ?? ""} ${pack.description ?? ""}`.toLowerCase();
  if (/(headshot|professional|linkedin|portrait retouch)/.test(packKey)) return subjectBySourceSlug["professional-headshots"];
  if (/(soccer|football|stadium|fan)/.test(packKey)) return subjectBySourceSlug["world-cup-fan-photos"];
  if (/(wedding|engagement|valentine|couple|desi|indian)/.test(packKey)) return subjectBySourceSlug["wedding-portraits"];
  if (/(holiday|christmas|thanksgiving|halloween|seasonal)/.test(packKey)) return subjectBySourceSlug.holiday;
  if (/(fashion|style|bikini|swimsuit|boudoir)/.test(packKey)) return subjectBySourceSlug["fashion-editorial"];
  if (/(travel|nature|outdoor|urban)/.test(packKey)) return subjectBySourceSlug.nature;
  if (/(video|motion)/.test(packKey)) return subjectBySourceSlug["ai-video-add-ons"];
  if (/(upscaler|enhancer|eraser|unblur|restore|correction)/.test(packKey)) return subjectBySourceSlug["magic-upscaler"];
  return "Portrait with polished editorial styling";
}

function galleryCandidates(pack, imageUrl, index, role = "gallery") {
  const subject = subjectForPack(pack, imageUrl);
  if (role === "cover") {
    return [
      `${subject} used as the representative package cover.`,
      `Representative package cover featuring a ${subject.charAt(0).toLowerCase() + subject.slice(1)}.`,
      `${pack.name} cover featuring a focused ${subject.charAt(0).toLowerCase() + subject.slice(1)}.`
    ];
  }
  const scene = galleryScenes[index % galleryScenes.length];
  const alternateScene = galleryScenes[(index + 3) % galleryScenes.length];
  const subjectLower = subject.charAt(0).toLowerCase() + subject.slice(1);
  const exactSubject = sourceSlugFromImageUrl(imageUrl) === "virtual-try-on" && index === 0
    ? [subject]
    : [];
  return [
    ...exactSubject,
    `${subject}, ${scene}.`,
    `${subjectLower}, ${alternateScene}.`,
    `${scene.charAt(0).toUpperCase() + scene.slice(1)} in a ${subjectLower}.`
  ];
}

function createAltRegistry() {
  return {
    byImage: new Map(),
    accepted: []
  };
}

function reserveAlt(registry, imageUrl, candidates, context) {
  const identity = imageIdentity(imageUrl);
  const existing = registry.byImage.get(identity);
  if (existing) return existing;

  for (const candidate of candidates) {
    const alt = assertValidAlt(candidate, context);
    const normalized = normalizeAlt(alt);
    if (registry.accepted.some((item) => item.normalized === normalized)) continue;
    if (registry.accepted.some((item) => similarity(item.alt, alt) >= 0.82)) continue;
    registry.byImage.set(identity, alt);
    registry.accepted.push({ alt, normalized });
    return alt;
  }
  throw new Error(`No unique alt candidate remains for ${context} (${identity})`);
}

function buildGalleryAlts(packs) {
  const registry = createAltRegistry();
  let total = 0;
  for (const pack of packs) {
    const galleryImages = Array.isArray(pack.galleryImages) ? pack.galleryImages : [];
    const images = [pack.imageUrl, ...galleryImages].filter((imageUrl) => typeof imageUrl === "string" && imageUrl.trim());
    pack.galleryImageAlts = images.map((imageUrl, index) => {
      total += 1;
      return reserveAlt(
        registry,
        imageUrl,
        galleryCandidates(pack, imageUrl, Math.max(0, index - 1), index === 0 ? "cover" : "gallery"),
        `creative pack ${pack.id} ${index === 0 ? "cover" : `gallery slot ${index}`}`
      );
    });
  }
  return { total, uniqueImages: registry.byImage.size };
}

function fileNameFromStorageKey(storageKey) {
  return String(storageKey ?? "").split("/").filter(Boolean).at(-1) || "";
}

function buildMediaAssetAlts(assets) {
  let total = 0;
  for (const asset of assets) {
    const fileName = fileNameFromStorageKey(asset.storageKey);
    const mapped = mediaAssetAltByFile[fileName];
    if (!mapped) throw new Error(`No confirmed media alt mapping for ${asset.storageKey}`);
    asset.altText = assertValidAlt(mapped, `media asset ${asset.id}`);
    total += 1;
  }
  return total;
}

function validateState(state) {
  const packs = (state.creativePacks ?? []).filter((pack) => pack.siteId === SITE_ID);
  const assets = (state.mediaAssets ?? []).filter((asset) => asset.siteId === SITE_ID);
  const registry = createAltRegistry();
  let galleryCount = 0;
  for (const pack of packs) {
    const images = [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])]
      .filter((imageUrl) => typeof imageUrl === "string" && imageUrl.trim());
    const alts = Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts : [];
    if (images.length !== alts.length) {
      throw new Error(`Cover/gallery image/alt count mismatch for ${pack.id}: ${images.length}/${alts.length}`);
    }
    images.forEach((imageUrl, index) => {
      galleryCount += 1;
      reserveAlt(registry, imageUrl, [alts[index]], `validated creative pack ${pack.id} ${index === 0 ? "cover" : `gallery slot ${index}`}`);
    });
  }
  for (const asset of assets) assertValidAlt(asset.altText, `validated media asset ${asset.id}`);
  return {
    packs: packs.length,
    galleryCount,
    uniqueGalleryImages: registry.byImage.size,
    mediaAssets: assets.length
  };
}

function clearPlatformStateCaches() {
  const cachePaths = [
    ".next/cache/platform-state-postgres.json",
    ".next-dev/cache/platform-state-postgres.json",
    ".next-3002/cache/platform-state-postgres.json"
  ].map((value) => path.resolve(process.cwd(), value));
  return cachePaths.filter((cachePath) => {
    if (!fs.existsSync(cachePath)) return false;
    fs.rmSync(cachePath, { force: true });
    return true;
  });
}

async function updateDatabase(state, packs, assets) {
  assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const [packCount, assetCount] = await Promise.all([
      prisma.creativePack.count({ where: { siteId: SITE_ID } }),
      prisma.mediaAsset.count({ where: { siteId: SITE_ID } })
    ]);
    if (packCount !== packs.length || assetCount !== assets.length) {
      throw new Error(
        `Database preflight failed for ${SITE_ID}: expected ${packs.length} creative packs and ${assets.length} media assets, ` +
        `found ${packCount} and ${assetCount}. No database rows were changed.`
      );
    }
    await prisma.$transaction(async (tx) => {
      for (const pack of packs) {
        await tx.creativePack.update({
          where: { id: pack.id },
          data: { galleryImageAlts: pack.galleryImageAlts }
        });
      }
      for (const asset of assets) {
        await tx.mediaAsset.update({
          where: { id: asset.id },
          data: { altText: asset.altText }
        });
      }
      await tx.platformStateDocument.upsert({
        where: { id: "platform" },
        create: { id: "platform", state },
        update: { state }
      });
    }, { timeout: 180_000 });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const state = await readState();
  const packs = (state.creativePacks ?? []).filter((pack) => pack.siteId === SITE_ID);
  const assets = (state.mediaAssets ?? []).filter((asset) => asset.siteId === SITE_ID);
  if (packs.length !== 38) throw new Error(`Expected 38 MyDreamShoots creative packs, found ${packs.length}`);
  if (assets.length !== 23) throw new Error(`Expected 23 MyDreamShoots media assets, found ${assets.length}`);

  const before = {
    packs: packs.length,
    mediaCount: packs.reduce(
      (total, pack) => total + [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])].filter(Boolean).length,
      0
    ),
    mediaAssets: assets.length
  };
  const gallerySummary = buildGalleryAlts(packs);
  const mediaAssetCount = buildMediaAssetAlts(assets);
  const after = validateState(state);
  if (after.galleryCount !== 494) throw new Error(`Expected 494 cover/gallery alts, found ${after.galleryCount}`);
  if (after.mediaAssets !== 23) throw new Error(`Expected 23 media asset alts, found ${after.mediaAssets}`);

  if (applyJson) await writeState(state);
  if (applyDb) {
    await updateDatabase(state, packs, assets);
  }
  const cacheCleared = applyJson || applyDb ? clearPlatformStateCaches() : [];
  console.log(JSON.stringify({
    ok: true,
    dryRun,
    appliedJson: applyJson,
    appliedDb: applyDb,
    siteId: SITE_ID,
    creativePacks: after.packs,
    galleryAlts: after.galleryCount,
    uniqueGalleryImages: gallerySummary.uniqueImages,
    mediaAssets: mediaAssetCount,
    cacheCleared,
    validation: after,
    baseline: before
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
