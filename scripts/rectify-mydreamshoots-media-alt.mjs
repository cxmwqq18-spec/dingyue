#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const SITE_ID = "site_dreamshoot";
const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--apply") && !args.has("--db");
const applyJson = args.has("--apply");
const applyDb = args.has("--db");
const reportArgIndex = process.argv.indexOf("--report");
const reportPath = reportArgIndex >= 0 && process.argv[reportArgIndex + 1]
  ? path.resolve(process.argv[reportArgIndex + 1])
  : "";

if (applyJson) {
  throw new Error("--apply is disabled for this single-store repair; use --db after reviewing the dry-run report.");
}

const forbiddenAltPattern = /\b(?:visual reference|gallery image|gallery example|package gallery|image\s+\d+|for browsing|for review|mydreamshoots|mydreamshoots\.com|aidreamshoots|aidreamcapes)\b/i;
const productionDirectionPattern = /\b(?:scene\s*\d+|escena\s*\d+|framing|encuadre|crop|recorte|lighting|luz|studio\s+light|visual\s+reference|prompt|production|camera|camara|shot|toma|close[- ]?up|half[- ]?body|cinematic\s+contrast|editorial\s+lighting)\b/i;
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

const subjectBySourceSlug = {
  "professional-headshots": "Professional headshot",
  "world-cup-fan-photos": "Football fan portrait in a stadium",
  hairstyle: "Hairstyle preview portrait",
  cyberpunk: "Neon cyberpunk portrait",
  "gala-photos": "Formal gala portrait",
  mafia: "Noir character portrait",
  nature: "Outdoor adventure portrait",
  "outdoor-creator-scenes": "Urban lifestyle portrait",
  "virtual-try-on": "Beauty portrait",
  "profile-cards": "Social profile card portrait",
  "creator-portraits": "Creator portrait",
  "fashion-editorial": "Editorial fashion portrait",
  "anime-avatar": "Stylized anime-inspired avatar portrait",
  "product-style": "Product-style lifestyle scene",
  "social-cards": "Social card portrait",
  "wedding-portraits": "Wedding-style couple portrait",
  "indian-wedding": "Indian wedding-style portrait",
  "desi-wedding": "Desi wedding-style portrait",
  "valentine-photos": "Romantic couple portrait",
  engagement: "Engagement-style couple portrait for an announcement",
  boudoir: "Tasteful style portrait",
  holiday: "Seasonal holiday portrait",
  "christmas-couple": "Christmas couple portrait",
  "christmas-photos": "Solo Christmas portrait",
  "ai-video-add-ons": "Motion-ready portrait frame",
  "magic-upscaler": "Enhanced portrait preview with crisp detail",
  "thanksgiving-group-photos": "Thanksgiving group portrait",
  "halloween-party-photos": "Halloween party portrait"
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

function sanitizeMediaAlt(value) {
  const cleaned = cleanAltText(value)
    .replace(/^close[- ]?up\s+of\s+/i, "")
    .replace(/\s+(?:for|showing)\s+(?:a|an|the)?\s*[^.]*\b(?:video|prompt|production|reference)\b[^.]*$/i, "")
    .replace(/\s+(?:with|using)\s+(?:a|an|the)?\s*[^.]*\b(?:camera|video|prompt|production|reference)\b[^.]*$/i, "")
    .replace(/^camera\s+filming\s+/i, "")
    .replace(/^camera\s+recording\s+/i, "")
    .replace(/\s+(?:recording|filming)\s+(?:a|an|the)?\s*[^.]*\b(?:video|announcement|camera)\b[^.]*$/i, "")
    .replace(/\s+(?:photo\s+and\s+video|video\s+and\s+photo)\s+scene\.?$/i, "")
    .replace(/\b lighting up\b/gi, " brightening")
    .replace(/\s+visual\s+scene\s*\d+\.?$/i, "")
    .replace(/\s+production\s+scene\s+for\s+the\s+theme\s+directory\.?$/i, "")
    .replace(/\s+(?:with|under|in)\s+(?:[^.]*?\b(?:lighting|light|framing|crop|detail)\b)[^.]*\.?$/i, "")
    .replace(/\s+with\s+polished\s+styling\.?$/i, "")
    .trim();
  return cleaned || "Storefront image";
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
  if (productionDirectionPattern.test(alt)) {
    throw new Error(`Production direction in alt for ${context}: ${alt}`);
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
  return "Portrait image";
}

function galleryCandidates(pack, imageUrl, index, role = "gallery") {
  const subject = subjectForPack(pack, imageUrl);
  return [`${subject}.`];
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
      return reserveAlt(registry, imageUrl, galleryCandidates(pack, imageUrl, index, index === 0 ? "cover" : "gallery"), `creative pack ${pack.id} ${index === 0 ? "cover" : `gallery slot ${index}`}`);
    });
  }
  return { total, uniqueImages: registry.byImage.size };
}

function fileNameFromStorageKey(storageKey) {
  return String(storageKey ?? "").split("/").filter(Boolean).at(-1) || "";
}

function buildMediaAssetAlts(assets) {
  let total = 0;
  const altBySource = new Map();
  for (const asset of assets) {
    const fileName = fileNameFromStorageKey(asset.storageKey);
    const mapped = mediaAssetAltByFile[fileName];
    const existing = cleanAltText(asset.altText);
    const identity = imageIdentity(asset.storageKey);
    const candidate = altBySource.get(identity) || sanitizeMediaAlt(mapped || existing || "Storefront image");
    asset.altText = assertValidAlt(candidate, `media asset ${asset.id}`);
    altBySource.set(identity, asset.altText);
    total += 1;
  }
  return total;
}

function normalizePageMediaManifests(state, pages) {
  let updated = 0;
  for (const page of pages) {
    for (const json of [page.draftJson, page.publishedJson]) {
      if (!json || typeof json !== "object" || !Array.isArray(json.mediaManifest)) continue;
      json.mediaManifest = json.mediaManifest.map((item) => {
        if (!item || typeof item !== "object") return item;
        const fallback = cleanAltText(page.title || "Storefront image");
        let alt = sanitizeMediaAlt(item.alt || fallback);
        if (productionDirectionPattern.test(alt) || forbiddenAltPattern.test(alt) || pathOrFilePattern.test(alt)) {
          alt = sanitizeMediaAlt(fallback);
        }
        alt = assertValidAlt(alt, `page media ${page.id}`);
        if (alt !== item.alt) updated += 1;
        return { ...item, alt };
      });
    }
  }
  const statePages = state.sites?.flatMap((site) => site.pages ?? []) ?? [];
  for (const page of pages) {
    const statePage = statePages.find((candidate) => candidate.id === page.id);
    if (statePage) {
      statePage.draftJson = page.draftJson;
      statePage.publishedJson = page.publishedJson;
    }
  }
  return updated;
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

function validateMediaAssetAltUniqueness(assets) {
  const altByImage = new Map();
  const imageByAlt = new Map();
  for (const asset of assets) {
    const image = imageIdentity(asset.storageKey).replace(/^sites\/site_dreamshoot\//, "assets/dreamshoot/");
    const alt = normalizeAlt(asset.altText);
    const existingAlt = altByImage.get(image);
    if (existingAlt && existingAlt !== alt) throw new Error(`Conflicting alts for media source ${image}`);
    altByImage.set(image, alt);
    imageByAlt.set(alt, image);
  }
  return { uniqueMediaImages: altByImage.size, uniqueMediaAlts: imageByAlt.size };
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

async function updateDatabase(state, packs, assets, pages, originals) {
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
    const pageCount = await prisma.themePage.count({ where: { siteId: SITE_ID } });
    if (pageCount !== pages.length) {
      throw new Error(`Database preflight failed for ${SITE_ID}: expected ${pages.length} theme pages, found ${pageCount}. No database rows were changed.`);
    }
    const backupDir = path.resolve(process.env.MYDREAMSHOOTS_ALT_BACKUP_DIR || "/tmp/mydreamshoots-alt-backups");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `${SITE_ID}-media-alt-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify({
      createdAt: new Date().toISOString(),
      siteId: SITE_ID,
      creativePacks: originals.packs.map((pack) => ({ id: pack.id, galleryImageAlts: pack.galleryImageAlts })),
      mediaAssets: originals.assets.map((asset) => ({ id: asset.id, altText: asset.altText })),
      themePages: originals.pages.map((page) => ({ id: page.id, draftJson: page.draftJson, publishedJson: page.publishedJson }))
    }, null, 2)}\n`, { mode: 0o600 });
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
      for (const page of pages) {
        await tx.themePage.update({
          where: { id: page.id },
          data: { draftJson: page.draftJson, publishedJson: page.publishedJson }
        });
      }
    }, { timeout: 180_000 });
    return backupPath;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const state = await readState();
  const packs = (state.creativePacks ?? []).filter((pack) => pack.siteId === SITE_ID);
  const assets = (state.mediaAssets ?? []).filter((asset) => asset.siteId === SITE_ID);
  const pages = state.sites?.find((site) => site.id === SITE_ID)?.pages ?? [];
  if (!packs.length) throw new Error("No MyDreamShoots creative packs found");
  if (!assets.length) throw new Error("No MyDreamShoots media assets found");

  const before = {
    packs: packs.length,
    mediaCount: packs.reduce(
      (total, pack) => total + [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])].filter(Boolean).length,
      0
    ),
    mediaAssets: assets.length
  };
  const beforeAltSamples = [
    ...packs.flatMap((pack) => [pack.galleryImageAlts].filter(Array.isArray).flat()),
    ...assets.map((asset) => asset.altText),
    ...pages.flatMap((page) => [page.draftJson, page.publishedJson]
      .filter((json) => Array.isArray(json?.mediaManifest))
      .flatMap((json) => json.mediaManifest.map((item) => item?.alt).filter(Boolean)))
  ];
  const originals = {
    packs: structuredClone(packs),
    assets: structuredClone(assets),
    pages: structuredClone(pages)
  };
  const gallerySummary = buildGalleryAlts(packs);
  const mediaAssetCount = buildMediaAssetAlts(assets);
  const pageManifestUpdates = normalizePageMediaManifests(state, pages);
  const mediaUniqueness = validateMediaAssetAltUniqueness(assets);
  const after = validateState(state);
  const afterAltSamples = [
    ...packs.flatMap((pack) => [pack.galleryImageAlts].filter(Array.isArray).flat()),
    ...assets.map((asset) => asset.altText),
    ...pages.flatMap((page) => [page.draftJson, page.publishedJson]
      .filter((json) => Array.isArray(json?.mediaManifest))
      .flatMap((json) => json.mediaManifest.map((item) => item?.alt).filter(Boolean)))
  ];
  if (after.galleryCount !== before.mediaCount) throw new Error(`Expected ${before.mediaCount} cover/gallery alts, found ${after.galleryCount}`);
  if (after.mediaAssets !== before.mediaAssets) throw new Error(`Expected ${before.mediaAssets} media asset alts, found ${after.mediaAssets}`);

  const backupPath = applyDb ? await updateDatabase(state, packs, assets, pages, originals) : "";
  const cacheCleared = applyJson || applyDb ? clearPlatformStateCaches() : [];
  const result = {
    ok: true,
    dryRun,
    appliedJson: applyJson,
    appliedDb: applyDb,
    siteId: SITE_ID,
    creativePacks: after.packs,
    galleryAlts: after.galleryCount,
    uniqueGalleryImages: gallerySummary.uniqueImages,
    mediaAssets: mediaAssetCount,
    mediaUniqueness,
    pageManifestUpdates,
    cacheCleared,
    validation: after,
    baseline: before,
    audit: {
      beforeAltCount: beforeAltSamples.length,
      afterAltCount: afterAltSamples.length,
      changedPageManifestItems: pageManifestUpdates,
      forbiddenBefore: beforeAltSamples.filter((value) => productionDirectionPattern.test(String(value)) || forbiddenAltPattern.test(String(value)) || pathOrFilePattern.test(String(value))).length,
      forbiddenAfter: 0,
      writeTarget: applyDb ? "relational-database" : applyJson ? "platform-state-json" : "none",
      reportMode: dryRun ? "dry-run" : "apply",
      backupPath: backupPath || null
    }
  };
  if (reportPath) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  }
  result.report = reportPath || null;
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
