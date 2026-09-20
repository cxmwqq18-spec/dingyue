#!/usr/bin/env node

import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, buildTunneledDatabaseUrl } from "./lib/database-target.mjs";
import { applyAidreamcapesEuGlobalCopy, applyAidreamcapesEuHomepageCopy, applyAidreamcapesEuProductCopy, applyAidreamcapesEuThemeHomepageCopy, applyAidreamcapesEuThemeSettingsCopy } from "./lib/aidreamcapes-eu-homepage-copy.mjs";
import { assertAidreamcapesEuHomepageIntegrity, assertAidreamcapesEuHomepageJsonContract } from "./lib/aidreamcapes-eu-homepage-integrity.mjs";
import { translateFrenchText } from "./lib/french-copy.mjs";

const SOURCE_SITE_ID = "site_dreamshoot";
const TARGET_SITE_ID = "site_aidreamcapes_xby";
const TARGET_SLUG = "aidreamcapes-eu";
const TARGET_DOMAIN = "aidreamcapes.eu";
const TARGET_WWW_DOMAIN = "www.aidreamcapes.eu";
const TARGET_ASSET_NAMESPACE = "site_aidreamcapes_eu";
const TARGET_LOGO = "/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-logo-refined.svg?v=20260717a";
const SUPPORT_EMAIL = "support@aidreamcapes.eu";
const LOCALE = "fr-FR";
const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const skipAssets = args.has("--skip-assets");
const confirm = "--confirm=aidreamcapes-from-mydreamshoots";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length) ?? "local";

if (target === "remote") {
  if (!args.has("--confirm=aidreamcapes-from-mydreamshoots-production")) {
    throw new Error("Remote Aidreamcapes writes require --confirm=aidreamcapes-from-mydreamshoots-production");
  }
  process.env.DINGYUE_ENV = "remote";
  process.env.DATABASE_TARGET = "remote";
  process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
} else if (target !== "local") {
  throw new Error(`Unsupported sync target: ${target}`);
}

assertDatabaseTarget({ expectedTarget: target });
const applyConfirm = target === "remote" ? "--confirm=aidreamcapes-from-mydreamshoots-production" : confirm;
if (apply && !args.has(applyConfirm)) {
  throw new Error(`--apply requires ${applyConfirm}`);
}

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const sha = (value) => crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
const fileSha = (filePath) => crypto.createHash("sha256").update(fsSync.readFileSync(filePath)).digest("hex");
const targetId = (kind, sourceId) => `aidreamcapes_eu_mirror_${kind}_${sha(sourceId)}`;
const idMaps = new Map();
const sourceIdMap = (kind, sourceId, value) => {
  if (!sourceId) return;
  if (!idMaps.has(kind)) idMaps.set(kind, new Map());
  idMaps.get(kind).set(sourceId, value);
};
const mappedId = (value) => {
  for (const map of idMaps.values()) if (map.has(value)) return map.get(value);
  return value;
};

function targetPageSlug(sourceSlug) {
  return sourceSlug;
}

function targetCanonicalPath(value) {
  return value;
}

function sourceAssetDescriptor(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\/)?(assets\/dreamshoot|assets\/sites\/site_dreamshoot|sites\/site_dreamshoot)(\/[^?#|\s"'<>]+)(\?[^#|\s"'<>]+)?$/);
  if (!match) return null;
  const prefix = match[2];
  const tail = match[3];
  const query = match[4] ?? "";
  const publicPrefix = prefix === "assets/dreamshoot" ? "dreamshoot" : "site_dreamshoot";
  const sourceCandidates = prefix === "assets/dreamshoot"
    ? [
        path.join(repoRoot, "public", "assets", "dreamshoot", tail.slice(1)),
        path.join(repoRoot, "public", "assets", "dreamshoot", tail.slice(1).replace("generated/youtube-video/", "generated/video-topic-media/youtube-video/")),
        path.join(repoRoot, "public", "assets", "dreamshoot", tail.slice(1).replace("youtube-video/", "generated/video-topic-media/youtube-video/")),
        path.join(repoRoot, "public", "assets", "dreamshoot", tail.slice(1).replace("story-video-fictional-noir-character-conflict.webp", "story-video-fictional-noir-character-conflict-v2.webp")),
        path.join(repoRoot, "public", "assets", "dreamshoot", tail.slice(1).replace("generated/pack-galleries/gala-photos/black-tie-red-carpet-gala-portrait.webp", "generated/pack-galleries/gala-photos/gala-photos-01.webp")),
        path.join(repoRoot, "public", "assets", "dreamshoot", tail.slice(1).replace("generated/pack-galleries/world-cup-fan-photos/brazil-soccer-fan-stadium-celebration.webp", "generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-01.webp"))
      ]
    : [
        path.join(repoRoot, "public", "assets", "sites", "site_dreamshoot", tail.slice(1)),
        path.join(repoRoot, "public", "sites", "site_dreamshoot", tail.slice(1))
      ];
  const sourceFile = sourceCandidates.find((candidate) => fsSync.existsSync(candidate) && fsSync.statSync(candidate).isFile());
  const targetRelative = `assets/sites/${TARGET_ASSET_NAMESPACE}/mirror/aidreamcapes/${publicPrefix}${tail}`
    .replace(/mydreamshoots/gi, "aidreamcapes")
    .replace(/site_dreamshoot/gi, "aidreamcapes");
  return { sourceFile, targetRelative, targetUrl: `/${targetRelative}${query}`, sourceValue: value };
}

function legacyAidreamcapesAssetDescriptor(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\/)?(assets\/sites\/site_aidreamcapes)(\/[^?#|\s"'<>]+)(\?[^#|\s"'<>]+)?$/);
  if (!match) return null;
  const tail = match[3];
  const query = match[4] ?? "";
  const sourceFile = path.join(repoRoot, "public", "assets", "sites", "site_aidreamcapes", tail.slice(1));
  const targetRelative = `assets/sites/${TARGET_ASSET_NAMESPACE}${tail}`;
  return { sourceFile: fsSync.existsSync(sourceFile) ? sourceFile : undefined, targetRelative, targetUrl: `/${targetRelative}${query}`, sourceValue: value };
}

const STATIC_AIDREAMCAPES_FALLBACK_ASSETS = [
  "fan-holiday-theme/categories/fan-scene-albums.webp",
  "fan-holiday-theme/categories/game-day-group-photos.webp",
  "fan-holiday-theme/categories/premiere-style-portraits.webp",
  "fan-holiday-theme/categories/christmas-holiday-albums.webp",
  "fan-holiday-theme/categories/thanksgiving-memory-sets.webp",
  "fan-holiday-theme/categories/halloween-party-portraits.webp",
  "fan-holiday-theme/categories/seasonal-celebration-photos.webp",
  "fan-holiday-theme/covers/private-fan-scene-album.webp",
  ["fan-holiday-theme/categories/professionnel-portraits-professionnels.webp", "fan-holiday-theme/categories/premiere-style-portraits.webp"]
].map((asset) => Array.isArray(asset) ? { source: asset[1], target: asset[0] } : { source: asset, target: asset });
const STATIC_EU_SHARED_ASSETS = [
  { sourceFile: path.join(repoRoot, "public", "assets", "brand", "google-g.svg"), targetRelative: `assets/sites/${TARGET_ASSET_NAMESPACE}/brand/google-g.svg` },
  ...[
    "talking-photo",
    "cinematic-video",
    "music-video",
    "tiktok-video",
    "instagram-reels",
    "product-video",
    "product-ad-video",
    "promo-video"
  ].map((slug) => ({
    sourceFile: path.join(repoRoot, "public", "assets", "dreamshoot", "generated", "homepage-showcase", "posters", `first-frame-${slug}.jpg`),
    targetRelative: `assets/sites/${TARGET_ASSET_NAMESPACE}/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/posters/first-frame-${slug}.jpg`
  }))
];

const copiedAssets = new Map();
const missingAssets = new Set();
const staticAssetsToCopy = new Set();
const staticAssetsMissing = new Set();
const DEDICATED_VIDEO_TOPIC_TYPES = new Set(["ai_video_topic_landing", "talking_photo_landing"]);

function hasDedicatedVideoTopicCopy(value) {
  return Object.values(value?.sections ?? {}).some((section) => DEDICATED_VIDEO_TOPIC_TYPES.has(section?.type));
}

function preserveDedicatedVideoTopicCopy(sourceJson, targetJson, slug) {
  if (!hasDedicatedVideoTopicCopy(sourceJson)) return transformJsonSync(sourceJson);
  if (!targetJson || !hasDedicatedVideoTopicCopy(targetJson)) {
    throw new Error(`${slug}: dedicated video-topic copy must be repaired with repair:aidreamcapes-eu-video-french-local before it can be synced`);
  }
  return clone(targetJson);
}

const PROTECTED_TABLES = [
  ["customer", "Customer"],
  ["customerProfile", "CustomerProfile"],
  ["customerSession", "CustomerSession"],
  ["subscription", "Subscription"],
  ["order", "Order"],
  ["paymentEvent", "PaymentEvent"],
  ["creditLedger", "CreditLedger"],
  ["creditBalance", "CreditBalance"],
  ["generationJob", "GenerationJob"],
  ["assetUpload", "AssetUpload"],
  ["album", "Album"],
  ["customerAssetDownload", "CustomerAssetDownload"],
  ["customerModel", "CustomerModel"],
  ["siteAdmin", "SiteAdmin"],
  ["siteAdminSession", "SiteAdminSession"],
  ["siteApiKey", "SiteApiKey"],
  ["aiGatewayGroup", "AiGatewayGroup"]
];

async function protectedTableCounts(prisma) {
  const entries = await Promise.all(PROTECTED_TABLES.map(async ([key, model]) => {
    const delegate = prisma[key];
    if (!delegate?.count) return [model, null];
    return [model, await delegate.count({ where: { siteId: TARGET_SITE_ID } })];
  }));
  return Object.fromEntries(entries);
}
function ensureAssetMirror(sourceFile, destination) {
  if (fsSync.existsSync(destination)) {
    const current = fsSync.lstatSync(destination);
    if (!current.isSymbolicLink()) return;
    fsSync.unlinkSync(destination);
  }
  try {
    const current = fsSync.lstatSync(destination);
    if (!current.isSymbolicLink()) return;
    fsSync.unlinkSync(destination);
  } catch {
    // The destination does not exist yet.
  }
  fsSync.mkdirSync(path.dirname(destination), { recursive: true });
  fsSync.copyFileSync(sourceFile, destination);
}

function repairExistingMirrorSymlinks() {
  if (!apply || skipAssets) return 0;
  const mirrorRoot = path.join(repoRoot, "public", "assets", "sites", TARGET_ASSET_NAMESPACE, "mirror", "aidreamcapes");
  if (!fsSync.existsSync(mirrorRoot)) return 0;
  let repaired = 0;
  const walk = (current) => {
    for (const entry of fsSync.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isSymbolicLink()) continue;
      const sourceFile = fsSync.realpathSync(absolute);
      fsSync.unlinkSync(absolute);
      fsSync.copyFileSync(sourceFile, absolute);
      repaired += 1;
    }
  };
  walk(mirrorRoot);
  return repaired;
}

function prepareStaticAidreamcapesFallbackAssets() {
  for (const asset of STATIC_AIDREAMCAPES_FALLBACK_ASSETS) {
    const sourceFile = path.join(repoRoot, "public", "assets", "sites", "site_aidreamcapes", asset.source);
    const targetRelative = `assets/sites/${TARGET_ASSET_NAMESPACE}/${asset.target}`;
    const destination = path.join(repoRoot, "public", targetRelative);
    if (!fsSync.existsSync(sourceFile) || !fsSync.statSync(sourceFile).isFile()) {
      staticAssetsMissing.add(asset.source);
      continue;
    }
    if (fsSync.existsSync(destination)) continue;
    staticAssetsToCopy.add(targetRelative);
    if (apply && !skipAssets) {
      ensureAssetMirror(sourceFile, destination);
      copiedAssets.set(targetRelative, sourceFile);
    }
  }
  for (const asset of STATIC_EU_SHARED_ASSETS) {
    const destination = path.join(repoRoot, "public", asset.targetRelative);
    if (!fsSync.existsSync(asset.sourceFile) || !fsSync.statSync(asset.sourceFile).isFile()) {
      staticAssetsMissing.add(asset.sourceFile);
      continue;
    }
    if (fsSync.existsSync(destination)) continue;
    staticAssetsToCopy.add(asset.targetRelative);
    if (apply && !skipAssets) {
      ensureAssetMirror(asset.sourceFile, destination);
      copiedAssets.set(asset.targetRelative, asset.sourceFile);
    }
  }
}
const NON_COPY_KEY_PATTERN = /(?:^|\.)(?:id|siteId|themeId|pageId|sectionId|blockId|productId|priceId|categoryId|parentId|mediaId|assetId|slug|path|canonicalPath|href|url|src|imageUrl|videoUrl|thumbnailUrl|assetUrl|storageKey|filename|mimeType|contentType|sourceType|pageType|templateKey|routeKey|appSlug|sortOrder|position|order|status|currency|interval|type|provider|model|modelId|createdAt|updatedAt|objectKey)(?:\.|$)/i;

function transformJsonSync(value, key = "") {
  if (typeof value === "string") {
    let next = value;
    for (const sourceMap of idMaps.values()) for (const [sourceId, targetValue] of sourceMap.entries()) if (next === sourceId) next = targetValue;
    const assetMatches = [...next.matchAll(/(?:\/?assets\/dreamshoot|\/?assets\/sites\/site_dreamshoot|\/?assets\/sites\/site_aidreamcapes|\/?sites\/site_dreamshoot)\/[^?#|\s"'<>]+(?:\?[^#|\s"'<>]+)?/g)];
    for (const match of assetMatches) {
      const descriptor = sourceAssetDescriptor(match[0]) ?? legacyAidreamcapesAssetDescriptor(match[0]);
      if (!descriptor) continue;
      if (!descriptor.sourceFile) {
        missingAssets.add(descriptor.sourceValue);
      } else if (!skipAssets && apply && !copiedAssets.has(descriptor.targetRelative)) {
        const destination = path.join(repoRoot, "public", descriptor.targetRelative);
        ensureAssetMirror(descriptor.sourceFile, destination);
        copiedAssets.set(descriptor.targetRelative, descriptor.sourceFile);
      }
      next = next.replace(match[0], descriptor.targetUrl);
    }
    next = next
      .replaceAll("https://www.mydreamshoots.com", `https://${TARGET_DOMAIN}`)
      .replaceAll("http://www.mydreamshoots.com", `https://${TARGET_DOMAIN}`)
      .replaceAll("www.mydreamshoots.com", TARGET_DOMAIN)
      .replaceAll("mydreamshoots.com", TARGET_DOMAIN)
      .replaceAll("partners@mydreamshoots.com", SUPPORT_EMAIL)
      .replaceAll("myDreamShoots", "Aidreamcapes")
      .replaceAll("myDreamshoots", "Aidreamcapes")
      .replaceAll("MyDreamShoots", "Aidreamcapes")
      .replaceAll("MYDREAMSHOOTS", "AIDREAMCAPES")
      .replaceAll("mydreamshoots", "aidreamcapes")
      .replaceAll("site_dreamshoot", TARGET_SITE_ID)
      .replaceAll("site_mydreamshoots", TARGET_SITE_ID)
      .replaceAll("prod_dreamshoot", "prod_aidreamcapes")
      .replaceAll("price_dreamshoot", "price_aidreamcapes");
    next = targetCanonicalPath(next);
    for (const sourceMap of idMaps.values()) for (const [sourceId, targetValue] of sourceMap.entries()) if (next === sourceId) next = targetValue;
    const isProviderText = /(?:^|\.)prompt$|providerConfig|workflowConfig|modelPricing|notes|createdBy/i.test(key);
    const isStructuralValue = NON_COPY_KEY_PATTERN.test(key);
    return isProviderText || isStructuralValue ? next : translateFrenchText(next);
  }
  if (Array.isArray(value)) return value.map((item) => transformJsonSync(item, key));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([entryKey, item]) => [entryKey, transformJsonSync(item, `${key}.${entryKey}`)]));
  return value;
}

function stripProviderIds(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return metadata;
  const next = clone(metadata);
  delete next.publicReference;
  return next;
}

async function readSource(prisma) {
  const [site, settings, profile, livePages, themePages, siteThemes, products, packCategories, packs, toolCategories, tools, videoCategories, videos, videoExamples, redirects, media, siteApps] = await Promise.all([
    prisma.site.findUnique({ where: { id: SOURCE_SITE_ID } }),
    prisma.themeSettings.findUnique({ where: { siteId: SOURCE_SITE_ID } }),
    prisma.storefrontProfile.findUnique({ where: { siteId: SOURCE_SITE_ID } }),
    prisma.livePage.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.themePage.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.siteTheme.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: { status: "asc" } }),
    prisma.product.findMany({ where: { siteId: SOURCE_SITE_ID }, include: { prices: true }, orderBy: { id: "asc" } }),
    prisma.creativePackCategory.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
    prisma.creativePack.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: { id: "asc" } }),
    prisma.toolCategory.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
    prisma.toolMenuItem.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
    prisma.videoThemeCategory.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
    prisma.videoTheme.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
    prisma.videoThemeExample.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.videoThemeSlugRedirect.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: { oldSlug: "asc" } }),
    prisma.mediaAsset.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: { storageKey: "asc" } }),
    prisma.siteAiApp.findMany({ where: { siteId: SOURCE_SITE_ID }, include: { aiApp: true }, orderBy: { routeKey: "asc" } })
  ]);
  if (!site || !settings) throw new Error("source_mydreamshoots_public_store_not_found");
  return { site, settings, profile, livePages, themePages, siteThemes, products, packCategories, packs, toolCategories, tools, videoCategories, videos, videoExamples, redirects, media, siteApps };
}

async function readTarget(prisma) {
  const [site, settings, profile, livePages, themePages, siteThemes, products, packCategories, packs, toolCategories, tools, videoCategories, videos, videoExamples, redirects, media, siteApps] = await Promise.all([
    prisma.site.findUnique({ where: { id: TARGET_SITE_ID } }),
    prisma.themeSettings.findUnique({ where: { siteId: TARGET_SITE_ID } }),
    prisma.storefrontProfile.findUnique({ where: { siteId: TARGET_SITE_ID } }),
    prisma.livePage.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.themePage.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.siteTheme.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.product.findMany({ where: { siteId: TARGET_SITE_ID }, include: { prices: true } }),
    prisma.creativePackCategory.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.creativePack.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.toolCategory.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.toolMenuItem.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.videoThemeCategory.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.videoTheme.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.videoThemeExample.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.videoThemeSlugRedirect.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.mediaAsset.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.siteAiApp.findMany({ where: { siteId: TARGET_SITE_ID }, include: { aiApp: true } })
  ]);
  if (!site || !settings) throw new Error("target_aidreamcapes_store_not_found");
  return { site, settings, profile, livePages, themePages, siteThemes, products, packCategories, packs, toolCategories, tools, videoCategories, videos, videoExamples, redirects, media, siteApps };
}

function registerMappings(source, target) {
  const existingBySlug = (rows) => new Map(rows.map((row) => [row.slug, row.id]));
  const pageIds = new Map(target.livePages.map((row) => [targetPageSlug(row.slug), row.id]));
  for (const row of source.livePages) {
    const slug = targetPageSlug(row.slug);
    const id = pageIds.get(slug) ?? targetId("live_page", slug);
    sourceIdMap("page", row.id, id);
  }
  const themePageIds = new Map(target.themePages.map((row) => [targetPageSlug(row.slug), row.id]));
  for (const row of source.themePages) {
    const slug = targetPageSlug(row.slug);
    const id = themePageIds.get(slug) ?? targetId("theme_page", slug);
    sourceIdMap("page", row.id, id);
  }
  const categoryIds = existingBySlug(target.packCategories);
  for (const row of source.packCategories) sourceIdMap("packCategory", row.id, categoryIds.get(row.slug) ?? targetId("pack_category", row.id));
  for (const row of source.packs) sourceIdMap("pack", row.id, targetId("pack", row.id));
  const videoCategoryIds = existingBySlug(target.videoCategories);
  for (const row of source.videoCategories) sourceIdMap("videoCategory", row.id, videoCategoryIds.get(row.slug) ?? targetId("video_category", row.id));
  const toolCategoryIds = existingBySlug(target.toolCategories);
  for (const row of source.toolCategories) sourceIdMap("toolCategory", row.id, toolCategoryIds.get(row.slug) ?? targetId("tool_category", row.id));
  const videoIds = existingBySlug(target.videos);
  for (const row of source.videos) sourceIdMap("video", row.id, videoIds.get(row.slug) ?? targetId("video", row.id));
  const toolIds = existingBySlug(target.tools);
  for (const row of source.tools) sourceIdMap("tool", row.id, toolIds.get(row.slug) ?? targetId("tool", row.id));
  for (const row of source.videoExamples) sourceIdMap("videoExample", row.id, targetId("video_example", row.id));
  for (const row of source.redirects) sourceIdMap("videoRedirect", row.id, targetId("video_redirect", row.id));
  for (const row of source.media) sourceIdMap("media", row.id, targetId("media", row.id));
  const targetProductBySuffix = new Map(target.products.map((row) => [row.id.replace(/^prod_aidreamcapes_/, ""), row.id]));
  for (const row of source.products) sourceIdMap("product", row.id, targetProductBySuffix.get(row.id.replace(/^prod_dreamshoot_/, "")) ?? targetId("product", row.id));
  const targetPrices = target.products.flatMap((row) => row.prices);
  for (const product of source.products) for (const price of product.prices) {
    const targetProductId = mappedId(product.id);
    const existing = targetPrices.find((row) => row.productId === targetProductId && row.interval === price.interval);
    sourceIdMap("price", price.id, existing?.id ?? targetId("price", price.id));
  }
  for (const row of source.siteApps) sourceIdMap("siteAiApp", row.id, target.siteApps.find((candidate) => candidate.aiAppId === row.aiAppId)?.id ?? targetId("site_app", row.id));
}

function sourcePageBySlug(source, slug) {
  return source.livePages.find((row) => row.slug === slug);
}

function sourceThemePageBySlug(source, slug) {
  return source.themePages.find((row) => row.slug === slug);
}

function buildPageRows(source, target) {
  const livePages = [];
  const themePages = [];
  const targetLiveBySlug = new Map(target.livePages.map((row) => [row.slug, row]));
  const targetThemeBySlug = new Map(target.themePages.map((row) => [row.slug, row]));
  for (const row of source.livePages) {
    const slug = targetPageSlug(row.slug);
    const existingTarget = targetLiveBySlug.get(slug);
    const id = existingTarget?.id ?? targetId("live_page", slug);
    const contentJson = preserveDedicatedVideoTopicCopy(row.contentJson, existingTarget?.contentJson, slug);
    if (slug === "/") applyAidreamcapesEuHomepageCopy(contentJson);
    livePages.push({
      id,
      siteId: TARGET_SITE_ID,
      pageType: row.pageType,
      templateKey: row.templateKey,
      slug,
      title: slug === "/" ? "Accueil — AIdreamcapes" : hasDedicatedVideoTopicCopy(row.contentJson) ? existingTarget.title : transformJsonSync(row.title),
      contentJson
    });
  }
  const videoRoot = sourcePageBySlug(source, "/ai-video-generation");
  const imageRoot = sourcePageBySlug(source, "/ai-image-generation");
  if (imageRoot && !livePages.some((row) => row.slug === "/collections")) {
    const contentJson = transformJsonSync(imageRoot.contentJson);
    contentJson.seo = { ...(contentJson.seo ?? {}), canonicalPath: "/collections" };
    livePages.push({ id: targetLiveBySlug.get("/collections")?.id ?? targetId("page", "alias-collections"), siteId: TARGET_SITE_ID, pageType: imageRoot.pageType, templateKey: imageRoot.templateKey, slug: "/collections", title: "AI Image Generation", contentJson });
  }
  if (videoRoot && !livePages.some((row) => row.slug === "/tools")) {
    const contentJson = transformJsonSync(videoRoot.contentJson);
    contentJson.seo = { ...(contentJson.seo ?? {}), canonicalPath: "/tools" };
    livePages.push({ id: targetLiveBySlug.get("/tools")?.id ?? targetId("page", "alias-tools"), siteId: TARGET_SITE_ID, pageType: videoRoot.pageType, templateKey: videoRoot.templateKey, slug: "/tools", title: "AI Video Generation", contentJson });
  }
  for (const row of source.themePages) {
    const slug = targetPageSlug(row.slug);
    const existingTarget = targetThemeBySlug.get(slug);
    const id = existingTarget?.id ?? targetId("theme_page", slug);
    const draftJson = preserveDedicatedVideoTopicCopy(row.draftJson, existingTarget?.draftJson, slug);
    const publishedJson = preserveDedicatedVideoTopicCopy(row.publishedJson, existingTarget?.publishedJson, slug);
    if (slug === "/") {
      applyAidreamcapesEuHomepageCopy(draftJson);
      applyAidreamcapesEuHomepageCopy(publishedJson);
    }
    themePages.push({
      id,
      siteId: TARGET_SITE_ID,
      pageType: row.pageType,
      templateKey: row.templateKey,
      slug,
      title: slug === "/" ? "Accueil — AIdreamcapes" : hasDedicatedVideoTopicCopy(row.publishedJson) ? existingTarget.title : transformJsonSync(row.title),
      draftJson,
      publishedJson,
      draftMeta: clone(row.draftMeta)
    });
  }
  if (imageRoot && !themePages.some((row) => row.slug === "/collections")) {
    const sourceTheme = sourceThemePageBySlug(source, "/ai-image-generation");
    if (sourceTheme) {
      const draftJson = transformJsonSync(sourceTheme.draftJson);
      const publishedJson = transformJsonSync(sourceTheme.publishedJson);
      draftJson.seo = { ...(draftJson.seo ?? {}), canonicalPath: "/collections" };
      publishedJson.seo = { ...(publishedJson.seo ?? {}), canonicalPath: "/collections" };
      themePages.push({ id: targetThemeBySlug.get("/collections")?.id ?? targetId("page", "alias-collections"), siteId: TARGET_SITE_ID, pageType: sourceTheme.pageType, templateKey: sourceTheme.templateKey, slug: "/collections", title: "AI Image Generation", draftJson, publishedJson, draftMeta: clone(sourceTheme.draftMeta) });
    }
  }
  if (videoRoot && !themePages.some((row) => row.slug === "/tools")) {
    const sourceTheme = sourceThemePageBySlug(source, "/ai-video-generation");
    if (sourceTheme) {
      const draftJson = transformJsonSync(sourceTheme.draftJson);
      const publishedJson = transformJsonSync(sourceTheme.publishedJson);
      draftJson.seo = { ...(draftJson.seo ?? {}), canonicalPath: "/tools" };
      publishedJson.seo = { ...(publishedJson.seo ?? {}), canonicalPath: "/tools" };
      themePages.push({ id: targetThemeBySlug.get("/tools")?.id ?? targetId("page", "alias-tools"), siteId: TARGET_SITE_ID, pageType: sourceTheme.pageType, templateKey: sourceTheme.templateKey, slug: "/tools", title: "AI Video Generation", draftJson, publishedJson, draftMeta: clone(sourceTheme.draftMeta) });
    }
  }
  return { livePages, themePages };
}

function buildSettings(source) {
  const nextDraft = transformJsonSync(source.settings.draftJson);
  const nextPublished = transformJsonSync(source.settings.publishedJson);
  for (const settings of [nextDraft, nextPublished]) {
    settings.globalSections ??= {};
    settings.globalSections.header ??= { type: "header", settings: {}, blocks: [] };
    settings.globalSections.footer ??= { type: "footer", settings: {}, blocks: [] };
    const header = settings.globalSections.header.settings ?? {};
    settings.globalSections.header.settings = {
      ...header,
      title: "AIdreamcapes",
      logoAlt: "Logo AIdreamcapes pour la création de photos et vidéos IA",
      logoImageUrl: TARGET_LOGO,
      ctaHref: "/app/create",
      ctaLabel: "Commencer à créer"
    };
    const footer = settings.globalSections.footer.settings ?? {};
    settings.globalSections.footer.settings = {
      ...footer,
      title: "AIdreamcapes",
      logoAlt: "Logo AIdreamcapes pour la création de photos et vidéos IA",
      logoImageUrl: TARGET_LOGO,
      companyName: "AIdreamcapes.eu",
      contactEmail: SUPPORT_EMAIL,
      salesEmail: "",
      contactPhone: "",
      contactAddress: "",
      copyright: "© 2026 AIdreamcapes.eu. Tous droits réservés.",
      instagramUrl: "https://www.instagram.com/aidreamcapes",
      facebookUrl: "https://www.facebook.com/aidreamcapes",
      threadsUrl: "https://www.threads.com/@aidreamcapes",
      pinterestUrl: "https://www.pinterest.com/aidreamcapes",
      youtubeUrl: "https://www.youtube.com/@aidreamcapes",
      twitterUrl: "https://x.com/aidreamcapes",
      xUrl: "https://x.com/aidreamcapes",
      tiktokUrl: "https://www.tiktok.com/@aidreamcapes"
    };
    applyAidreamcapesEuGlobalCopy(settings);
  }
  return { draftJson: nextDraft, publishedJson: nextPublished };
}

function buildProfile(source, target) {
  const policyFacts = transformJsonSync(clone(target.profile?.publishedJson?.policyFacts ?? target.profile?.draftJson?.policyFacts ?? source.profile?.publishedJson?.policyFacts ?? source.profile?.draftJson?.policyFacts ?? {}), "policyFacts");
  const identity = clone(target.profile?.publishedJson?.identity ?? target.profile?.draftJson?.identity ?? source.profile?.publishedJson?.identity ?? source.profile?.draftJson?.identity ?? {});
  identity.sameAs = Array.isArray(identity.sameAs) ? identity.sameAs : [];
  identity.supportEmail = SUPPORT_EMAIL;
  return {
    id: `profile_${TARGET_SITE_ID}`,
    siteId: TARGET_SITE_ID,
    draftJson: { identity, policyFacts },
    publishedJson: { identity, policyFacts },
    draftMeta: { revision: 1, updatedAt: new Date().toISOString(), etag: "aidreamcapes-from-mydreamshoots" }
  };
}

function buildSiteThemes(source, target) {
  return source.siteThemes.map((row) => {
    const existing = target.siteThemes.find((candidate) => candidate.status === row.status) ?? target.siteThemes.find((candidate) => candidate.themeKey === row.themeKey);
    return {
      id: existing?.id ?? targetId("site_theme", row.id),
      siteId: TARGET_SITE_ID,
      name: row.status === "active" ? "Aidreamcapes Live" : "Aidreamcapes Draft",
      themeId: existing?.themeId ?? `site_aidreamcapes_${row.status}`,
      themeKey: row.themeKey,
      status: row.status,
      templates: applyAidreamcapesEuThemeHomepageCopy(transformJsonSync(row.templates)),
      settings: applyAidreamcapesEuThemeSettingsCopy(transformJsonSync(row.settings), { logoUrl: TARGET_LOGO, supportEmail: SUPPORT_EMAIL }),
      source: row.source,
      createdBy: `admin_${TARGET_SLUG}`,
      createdAt: row.createdAt,
      updatedAt: new Date()
    };
  });
}

function buildProducts(source, target) {
  const products = [];
  const prices = [];
  for (const sourceProduct of source.products) {
    const productId = mappedId(sourceProduct.id);
    products.push({
      id: productId,
      siteId: TARGET_SITE_ID,
      name: transformJsonSync(sourceProduct.name),
      type: sourceProduct.type,
      status: sourceProduct.status,
      metadata: transformJsonSync(sourceProduct.metadata)
    });
    for (const sourcePrice of sourceProduct.prices) {
      const priceId = mappedId(sourcePrice.id);
      const existing = target.products.flatMap((row) => row.prices).find((row) => row.id === priceId) ?? target.products.flatMap((row) => row.prices).find((row) => row.productId === productId && row.interval === sourcePrice.interval);
      prices.push({
        id: existing?.id ?? priceId,
        siteId: TARGET_SITE_ID,
        productId,
        label: transformJsonSync(sourcePrice.label),
        amountCents: sourcePrice.amountCents,
        currency: sourcePrice.currency,
        interval: sourcePrice.interval,
        creditsGranted: sourcePrice.creditsGranted,
        metadata: stripProviderIds(transformJsonSync(sourcePrice.metadata)),
        stripePriceId: existing?.stripePriceId ?? null,
        status: sourcePrice.status ?? existing?.status ?? "draft",
        effectiveFrom: existing?.effectiveFrom ?? null,
        effectiveTo: existing?.effectiveTo ?? null,
        replacesPriceId: existing?.replacesPriceId ?? null,
        providerVerifiedAt: existing?.providerVerifiedAt ?? null,
        providerFingerprint: existing?.providerFingerprint ?? null,
        createdAt: existing?.createdAt ?? sourcePrice.createdAt,
        updatedAt: new Date()
      });
    }
  }
  return applyAidreamcapesEuProductCopy(products, prices);
}

function buildPublicRows(source) {
  const categories = source.packCategories.map((row) => ({
    id: mappedId(row.id),
    siteId: TARGET_SITE_ID,
    parentId: row.parentId ? mappedId(row.parentId) : null,
    slug: row.slug,
    label: transformJsonSync(row.label),
    description: transformJsonSync(row.description),
    heroTitle: transformJsonSync(row.heroTitle),
    heroSubtitle: transformJsonSync(row.heroSubtitle),
    icon: row.icon,
    imageUrl: transformJsonSync(row.imageUrl),
    sortOrder: row.sortOrder,
    status: row.status
  }));
  const packs = source.packs.map((row) => ({
    id: targetId("pack", row.id),
    siteId: TARGET_SITE_ID,
    categoryId: row.categoryId ? mappedId(row.categoryId) : null,
    name: transformJsonSync(row.name),
    headline: transformJsonSync(row.headline),
    description: transformJsonSync(row.description),
    prompt: transformJsonSync(row.prompt, "prompt"),
    category: transformJsonSync(row.category),
    aiAppSlug: row.aiAppSlug,
    status: row.status,
    creditCost: row.creditCost,
    outputCount: row.outputCount,
    trainingRequired: row.trainingRequired,
    generationCount: row.generationCount,
    conversionRate: row.conversionRate,
    imageUrl: transformJsonSync(row.imageUrl),
    galleryImages: transformJsonSync(row.galleryImages),
    galleryImageAlts: transformJsonSync(row.galleryImageAlts)
  }));
  const toolCategories = source.toolCategories.map((row) => ({
    id: mappedId(row.id),
    siteId: TARGET_SITE_ID,
    parentId: row.parentId ? mappedId(row.parentId) : null,
    slug: row.slug,
    label: transformJsonSync(row.label),
    description: transformJsonSync(row.description),
    icon: row.icon,
    sortOrder: row.sortOrder,
    status: row.status
  }));
  const tools = source.tools.map((row) => ({
    id: mappedId(row.id),
    siteId: TARGET_SITE_ID,
    categoryId: row.categoryId ? mappedId(row.categoryId) : null,
    slug: row.slug,
    title: transformJsonSync(row.title),
    description: transformJsonSync(row.description),
    badge: transformJsonSync(row.badge),
    icon: row.icon,
    imageUrl: transformJsonSync(row.imageUrl),
    href: row.href,
    detailJson: transformJsonSync(row.detailJson),
    sortOrder: row.sortOrder,
    status: row.status
  }));
  const videoCategories = source.videoCategories.map((row) => ({
    id: mappedId(row.id),
    siteId: TARGET_SITE_ID,
    parentId: row.parentId ? mappedId(row.parentId) : null,
    slug: row.slug,
    label: transformJsonSync(row.label),
    description: transformJsonSync(row.description),
    icon: row.icon,
    accentColor: row.accentColor,
    imageUrl: transformJsonSync(row.imageUrl),
    sortOrder: row.sortOrder,
    status: row.status
  }));
  const videos = source.videos.map((row) => ({
    id: mappedId(row.id),
    siteId: TARGET_SITE_ID,
    categoryId: row.categoryId ? mappedId(row.categoryId) : null,
    slug: row.slug,
    name: transformJsonSync(row.name),
    headline: transformJsonSync(row.headline),
    description: transformJsonSync(row.description),
    prompt: transformJsonSync(row.prompt, "prompt"),
    status: row.status,
    creditCost: row.creditCost,
    modelPricing: transformJsonSync(row.modelPricing),
    durationSeconds: row.durationSeconds,
    maxFrames: row.maxFrames,
    generationCount: row.generationCount,
    sortOrder: row.sortOrder,
    imageUrl: transformJsonSync(row.imageUrl),
    galleryImages: transformJsonSync(row.galleryImages)
  }));
  const examples = source.videoExamples.map((row) => ({
    id: mappedId(row.id),
    siteId: TARGET_SITE_ID,
    themeId: mappedId(row.themeId),
    name: transformJsonSync(row.name),
    description: transformJsonSync(row.description),
    imageUrl: transformJsonSync(row.imageUrl),
    galleryImages: transformJsonSync(row.galleryImages),
    prompt: transformJsonSync(row.prompt, "prompt"),
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: new Date()
  }));
  const media = source.media.map((row) => {
    const storage = sourceAssetDescriptor(row.storageKey) ?? sourceAssetDescriptor(row.previewUrl ?? row.originUrl);
    const storageQuery = String(row.storageKey ?? "").includes("?") ? String(row.storageKey).slice(String(row.storageKey).indexOf("?")) : "";
    const targetStorageKey = storage ? `${storage.targetRelative.replace(/^assets\//, "")}${storageQuery}` : `sites/${TARGET_ASSET_NAMESPACE}/mirror/aidreamcapes/${String(row.storageKey).replace(/^\/+/, "")}`;
    return {
      id: mappedId(row.id),
      siteId: TARGET_SITE_ID,
      label: transformJsonSync(row.label),
      storageKey: targetStorageKey,
      mimeType: row.mimeType,
      usageType: row.usageType,
      sourceType: row.sourceType,
      previewUrl: transformJsonSync(row.previewUrl),
      originUrl: transformJsonSync(row.originUrl),
      altText: transformJsonSync(row.altText),
      notes: transformJsonSync(row.notes),
      createdAt: row.createdAt,
      updatedAt: new Date()
    };
  });
  return { categories, packs, toolCategories, tools, videoCategories, videos, examples, media };
}

function summarize(source, target, pages, publicRows, products) {
  return {
    source: {
      siteId: SOURCE_SITE_ID,
      livePages: source.livePages.length,
      themePages: source.themePages.length,
      packCategories: source.packCategories.length,
      packs: source.packs.length,
      toolCategories: source.toolCategories.length,
      tools: source.tools.length,
      videoCategories: source.videoCategories.length,
      videos: source.videos.length,
      videoExamples: source.videoExamples.length,
      media: source.media.length,
      products: source.products.length,
      prices: source.products.reduce((sum, row) => sum + row.prices.length, 0)
    },
    targetBefore: {
      livePages: target.livePages.length,
      themePages: target.themePages.length,
      packCategories: target.packCategories.length,
      packs: target.packs.length,
      toolCategories: target.toolCategories.length,
      tools: target.tools.length,
      videoCategories: target.videoCategories.length,
      videos: target.videos.length,
      videoExamples: target.videoExamples.length,
      media: target.media.length,
      products: target.products.length,
      prices: target.products.reduce((sum, row) => sum + row.prices.length, 0)
    },
    targetAfter: {
      livePages: pages.livePages.length,
      themePages: pages.themePages.length,
      packCategories: publicRows.categories.length,
      packs: publicRows.packs.length,
      toolCategories: publicRows.toolCategories.length,
      tools: publicRows.tools.length,
      videoCategories: publicRows.videoCategories.length,
      videos: publicRows.videos.length,
      videoExamples: publicRows.examples.length,
      media: publicRows.media.length,
      products: products.products.length,
      prices: products.prices.length
    }
  };
}

async function backupTarget(prisma, filePath) {
  const target = await readTarget(prisma);
  const safe = (value) => clone(value);
  const backup = {
    generatedAt: new Date().toISOString(),
    siteId: TARGET_SITE_ID,
    public: {
      site: safe(target.site),
      settings: safe(target.settings),
      profile: safe(target.profile),
      livePages: safe(target.livePages),
      themePages: safe(target.themePages),
      siteThemes: safe(target.siteThemes),
      products: safe(target.products),
      packCategories: safe(target.packCategories),
      packs: safe(target.packs),
      toolCategories: safe(target.toolCategories),
      tools: safe(target.tools),
      videoCategories: safe(target.videoCategories),
      videos: safe(target.videos),
      videoExamples: safe(target.videoExamples),
      redirects: safe(target.redirects),
      media: safe(target.media)
    }
  };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(backup, null, 2)}\n`);
}

function publicPageSlugs(rows) { return new Set(rows.map((row) => row.slug)); }

const SCOPE_MODELS = [
  ["livePages", "livePage"],
  ["themePages", "themePage"],
  ["themeSettings", "themeSettings"],
  ["storefrontProfiles", "storefrontProfile"],
  ["siteThemes", "siteTheme"],
  ["products", "product"],
  ["prices", "price"],
  ["packCategories", "creativePackCategory"],
  ["packs", "creativePack"],
  ["toolCategories", "toolCategory"],
  ["tools", "toolMenuItem"],
  ["videoCategories", "videoThemeCategory"],
  ["videos", "videoTheme"],
  ["videoExamples", "videoThemeExample"],
  ["media", "mediaAsset"],
  ["siteApps", "siteAiApp"]
];

async function siteScopeSnapshot(prisma) {
  const sites = await prisma.site.findMany({
    select: { id: true, slug: true, status: true, primaryDomain: true, branding: true },
    orderBy: { id: "asc" }
  });
  const entries = await Promise.all(sites.map(async (site) => {
    const counts = {};
    const tableHashes = {};
    for (const [key, delegateName] of SCOPE_MODELS) {
      const delegate = prisma[delegateName];
      if (!delegate?.findMany) {
        counts[key] = null;
        tableHashes[key] = null;
        continue;
      }
      const rows = await delegate.findMany({ where: { siteId: site.id }, orderBy: { id: "asc" } });
      counts[key] = rows.length;
      tableHashes[key] = sha(JSON.stringify(rows));
    }
    const domains = await prisma.siteDomain.findMany({ where: { siteId: site.id }, select: { domain: true, status: true, isPrimary: true }, orderBy: { domain: "asc" } });
    const summary = { ...site, domains, counts, tableHashes };
    return [site.id, { ...summary, hash: sha(JSON.stringify(summary)) }];
  }));
  return Object.fromEntries(entries);
}

function scopeChanges(before, after, excludedSiteId = TARGET_SITE_ID) {
  return Object.keys(before)
    .filter((siteId) => siteId !== excludedSiteId && JSON.stringify(before[siteId]) !== JSON.stringify(after[siteId]))
    .map((siteId) => ({ siteId, before: before[siteId], after: after[siteId] }));
}

async function applyState(prisma, source, target, pages, settings, profile, themes, products, publicRows) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Site" WHERE "id" = ${TARGET_SITE_ID} FOR UPDATE`;
    await tx.site.update({ where: { id: TARGET_SITE_ID }, data: {
      name: "AIdreamcapes",
      slug: TARGET_SLUG,
      primaryDomain: TARGET_DOMAIN,
      currency: source.site.currency,
      signupCreditGrant: source.site.signupCreditGrant,
      branding: {
        logoText: "AIdreamcapes",
        logoImageUrl: TARGET_LOGO,
        market: "Création photo et vidéo IA, outils créatifs, crédits et galeries privées",
        description: "AIdreamcapes est un studio privé pour créer des photos et vidéos avec l'IA, gérer vos crédits et recevoir vos galeries personnelles."
      }
    }});
    await tx.siteDomain.upsert({
      where: { domain: TARGET_DOMAIN },
      create: { id: `domain_${TARGET_SITE_ID}_primary`, siteId: TARGET_SITE_ID, domain: TARGET_DOMAIN, isPrimary: true, status: "active" },
      update: { siteId: TARGET_SITE_ID, isPrimary: true, status: "active" }
    });
    await tx.siteDomain.upsert({
      where: { domain: TARGET_WWW_DOMAIN },
      create: { id: `domain_${TARGET_SITE_ID}_www`, siteId: TARGET_SITE_ID, domain: TARGET_WWW_DOMAIN, isPrimary: false, status: "active" },
      update: { siteId: TARGET_SITE_ID, isPrimary: false, status: "active" }
    });
    await tx.siteDomain.updateMany({
      where: { siteId: TARGET_SITE_ID, domain: { notIn: [TARGET_DOMAIN, TARGET_WWW_DOMAIN] } },
      data: { isPrimary: false, status: "inactive" }
    });
    await tx.themeSettings.update({ where: { siteId: TARGET_SITE_ID }, data: settings });
    await tx.storefrontProfile.upsert({ where: { siteId: TARGET_SITE_ID }, create: profile, update: { draftJson: profile.draftJson, publishedJson: profile.publishedJson, draftMeta: profile.draftMeta } });

    const desiredLive = publicPageSlugs(pages.livePages);
    const desiredTheme = publicPageSlugs(pages.themePages);
    await tx.livePage.deleteMany({ where: { siteId: TARGET_SITE_ID, slug: { notIn: [...desiredLive] } } });
    await tx.themePage.deleteMany({ where: { siteId: TARGET_SITE_ID, slug: { notIn: [...desiredTheme] } } });
    for (const row of pages.livePages) {
      await tx.livePage.upsert({ where: { siteId_slug: { siteId: TARGET_SITE_ID, slug: row.slug } }, create: row, update: { pageType: row.pageType, templateKey: row.templateKey, title: row.title, contentJson: row.contentJson } });
    }
    for (const row of pages.themePages) {
      await tx.themePage.upsert({ where: { siteId_slug: { siteId: TARGET_SITE_ID, slug: row.slug } }, create: row, update: { pageType: row.pageType, templateKey: row.templateKey, title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson, draftMeta: row.draftMeta } });
    }
    await assertAidreamcapesEuHomepageIntegrity(tx);
    for (const row of themes) {
      await tx.siteTheme.upsert({ where: { id: row.id }, create: row, update: { name: row.name, themeId: row.themeId, themeKey: row.themeKey, status: row.status, templates: row.templates, settings: row.settings, source: row.source, createdBy: row.createdBy } });
    }
    await tx.toolMenuItem.updateMany({ where: { siteId: TARGET_SITE_ID }, data: { status: "inactive" } });
    await tx.toolCategory.updateMany({ where: { siteId: TARGET_SITE_ID }, data: { status: "inactive" } });
    for (const row of [...publicRows.toolCategories].sort((left, right) => Number(Boolean(left.parentId)) - Number(Boolean(right.parentId)))) {
      await tx.toolCategory.upsert({ where: { id: row.id }, create: row, update: { parentId: row.parentId, slug: row.slug, label: row.label, description: row.description, icon: row.icon, sortOrder: row.sortOrder, status: row.status } });
    }
    for (const row of publicRows.tools) {
      await tx.toolMenuItem.upsert({ where: { id: row.id }, create: row, update: { categoryId: row.categoryId, slug: row.slug, title: row.title, description: row.description, badge: row.badge, icon: row.icon, imageUrl: row.imageUrl, href: row.href, detailJson: row.detailJson, sortOrder: row.sortOrder, status: row.status } });
    }
    await tx.toolCategory.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: publicRows.toolCategories.map((row) => row.id) } }, data: { status: "inactive" } });
    await tx.toolMenuItem.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: publicRows.tools.map((row) => row.id) } }, data: { status: "inactive" } });
    for (const row of [...publicRows.categories].sort((left, right) => Number(Boolean(left.parentId)) - Number(Boolean(right.parentId)))) {
      await tx.creativePackCategory.upsert({ where: { id: row.id }, create: row, update: { parentId: row.parentId, slug: row.slug, label: row.label, description: row.description, heroTitle: row.heroTitle, heroSubtitle: row.heroSubtitle, icon: row.icon, imageUrl: row.imageUrl, sortOrder: row.sortOrder, status: row.status } });
    }
    await tx.creativePackCategory.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: publicRows.categories.map((row) => row.id) } }, data: { status: "inactive" } });
    for (const row of publicRows.packs) {
      await tx.creativePack.upsert({ where: { id: row.id }, create: row, update: { categoryId: row.categoryId, name: row.name, headline: row.headline, description: row.description, prompt: row.prompt, category: row.category, aiAppSlug: row.aiAppSlug, status: row.status, creditCost: row.creditCost, outputCount: row.outputCount, trainingRequired: row.trainingRequired, generationCount: row.generationCount, conversionRate: row.conversionRate, imageUrl: row.imageUrl, galleryImages: row.galleryImages, galleryImageAlts: row.galleryImageAlts } });
    }
    await tx.creativePack.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: publicRows.packs.map((row) => row.id) } }, data: { status: "inactive" } });
    for (const row of [...publicRows.videoCategories].sort((left, right) => Number(Boolean(left.parentId)) - Number(Boolean(right.parentId)))) {
      await tx.videoThemeCategory.upsert({ where: { id: row.id }, create: row, update: { parentId: row.parentId, slug: row.slug, label: row.label, description: row.description, icon: row.icon, accentColor: row.accentColor, imageUrl: row.imageUrl, sortOrder: row.sortOrder, status: row.status } });
    }
    await tx.videoThemeCategory.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: publicRows.videoCategories.map((row) => row.id) } }, data: { status: "inactive" } });
    for (const row of publicRows.videos) {
      await tx.videoTheme.upsert({ where: { id: row.id }, create: row, update: { categoryId: row.categoryId, slug: row.slug, name: row.name, headline: row.headline, description: row.description, prompt: row.prompt, status: row.status, creditCost: row.creditCost, modelPricing: row.modelPricing, durationSeconds: row.durationSeconds, maxFrames: row.maxFrames, generationCount: row.generationCount, sortOrder: row.sortOrder, imageUrl: row.imageUrl, galleryImages: row.galleryImages } });
    }
    await tx.videoTheme.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: publicRows.videos.map((row) => row.id) } }, data: { status: "inactive" } });
    for (const row of publicRows.examples) {
      await tx.videoThemeExample.upsert({ where: { id: row.id }, create: row, update: { themeId: row.themeId, name: row.name, description: row.description, imageUrl: row.imageUrl, galleryImages: row.galleryImages, prompt: row.prompt, status: row.status, sortOrder: row.sortOrder } });
    }
    await tx.videoThemeExample.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: publicRows.examples.map((row) => row.id) } }, data: { status: "inactive" } });
    for (const row of publicRows.media) {
      await tx.mediaAsset.upsert({ where: { id: row.id }, create: row, update: { label: row.label, storageKey: row.storageKey, mimeType: row.mimeType, usageType: row.usageType, sourceType: row.sourceType, previewUrl: row.previewUrl, originUrl: row.originUrl, altText: row.altText, notes: row.notes } });
    }
    const targetMediaIds = publicRows.media.map((row) => row.id);
    if (!targetMediaIds.length || targetMediaIds.some((id) => !id)) throw new Error(`invalid_media_ids:${JSON.stringify(targetMediaIds.slice(0, 3))}`);
    await tx.mediaAsset.deleteMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: targetMediaIds } } });
    for (const product of products.products) {
      await tx.product.upsert({ where: { id: product.id }, create: product, update: { name: product.name, type: product.type, status: product.status, metadata: product.metadata } });
    }
    await tx.product.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: products.products.map((row) => row.id) } }, data: { status: "inactive" } });
    for (const price of products.prices) {
      await tx.price.upsert({ where: { id: price.id }, create: price, update: { productId: price.productId, label: price.label, amountCents: price.amountCents, currency: price.currency, interval: price.interval, creditsGranted: price.creditsGranted, metadata: price.metadata, status: price.status } });
    }
    const desiredPriceIds = new Set(products.prices.map((row) => row.id));
    await tx.price.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: [...desiredPriceIds] } }, data: { status: "draft" } });
  }, { timeout: 600000, maxWait: 20000 });
}

async function main() {
  const prisma = new PrismaClient();
  const backupPath = path.join(repoRoot, "releases", "backups", `aidreamcapes-before-mydreamshoots-sync-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const scopeAuditPath = path.join(repoRoot, "releases", "audits", `${path.basename(backupPath, ".json")}-scope.json`);
  try {
    const [source, targetState] = await Promise.all([readSource(prisma), readTarget(prisma)]);
    prepareStaticAidreamcapesFallbackAssets();
    const protectedBefore = await protectedTableCounts(prisma);
    const scopeBefore = await siteScopeSnapshot(prisma);
    registerMappings(source, targetState);
    const pages = buildPageRows(source, targetState);
    const plannedLiveHomepage = pages.livePages.find((row) => row.slug === "/");
    const plannedThemeHomepage = pages.themePages.find((row) => row.slug === "/");
    assertAidreamcapesEuHomepageJsonContract(plannedLiveHomepage?.contentJson, "sync plan LivePage homepage");
    assertAidreamcapesEuHomepageJsonContract(plannedThemeHomepage?.draftJson, "sync plan ThemePage draft homepage");
    assertAidreamcapesEuHomepageJsonContract(plannedThemeHomepage?.publishedJson, "sync plan ThemePage published homepage");
    const duplicateLiveIds = pages.livePages.filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) !== index).map((row) => ({ id: row.id, slug: row.slug }));
    if (duplicateLiveIds.length) throw new Error(`duplicate_live_page_ids:${JSON.stringify(duplicateLiveIds)}`);
    const liveIdConflicts = pages.livePages.flatMap((row) => targetState.livePages.filter((existing) => existing.id === row.id && existing.slug !== row.slug).map((existing) => ({ id: row.id, desiredSlug: row.slug, existingSlug: existing.slug })));
    if (liveIdConflicts.length) throw new Error(`live_page_id_conflicts:${JSON.stringify(liveIdConflicts)}`);
    const duplicateThemeIds = pages.themePages.filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) !== index).map((row) => ({ id: row.id, slug: row.slug }));
    if (duplicateThemeIds.length) throw new Error(`duplicate_theme_page_ids:${JSON.stringify(duplicateThemeIds)}`);
    const settings = buildSettings(source);
    const profile = buildProfile(source, targetState);
    const themes = buildSiteThemes(source, targetState);
    const products = buildProducts(source, targetState);
    const publicRows = buildPublicRows(source);
    const summary = summarize(source, targetState, pages, publicRows, products);
    let repairedSymlinks = 0;
    if (apply) {
      await backupTarget(prisma, backupPath);
      await applyState(prisma, source, targetState, pages, settings, profile, themes, products, publicRows);
      repairedSymlinks = repairExistingMirrorSymlinks();
    }
    const scopeAfter = await siteScopeSnapshot(prisma);
    const otherSiteChanges = scopeChanges(scopeBefore, scopeAfter);
    if (otherSiteChanges.length) throw new Error(`other_site_scope_changed:${JSON.stringify(otherSiteChanges.map((change) => change.siteId))}`);
    const protectedAfter = apply ? await protectedTableCounts(prisma) : protectedBefore;
    const protectedChanged = Object.entries(protectedBefore).filter(([table, count]) => protectedAfter[table] !== count);
    if (protectedChanged.length) throw new Error(`protected_site_data_changed:${JSON.stringify(protectedChanged)}`);
    const manifest = {
      sourceSiteId: SOURCE_SITE_ID,
      targetSiteId: TARGET_SITE_ID,
      targetDomain: TARGET_DOMAIN,
      targetWwwDomain: TARGET_WWW_DOMAIN,
      locale: LOCALE,
      routeInventory: pages.livePages.map((row) => row.slug).sort(),
      publicEntityDiff: summary,
      protectedTableCounts: protectedAfter,
      assetChecksums: Object.fromEntries([...copiedAssets.entries()].map(([relative, sourceFile]) => [relative, fileSha(sourceFile)])),
      mediaIdSample: publicRows.media.slice(0, 3).map((row) => ({ id: row.id, siteId: row.siteId })),
      scopeGuard: {
        allowedSiteIds: [TARGET_SITE_ID],
        sourceSiteId: SOURCE_SITE_ID,
        targetSiteId: TARGET_SITE_ID,
        targetBefore: scopeBefore[TARGET_SITE_ID],
        targetAfter: scopeAfter[TARGET_SITE_ID],
        otherSiteChanges: []
      },
      translationRevision: "fr-FR-v2"
    };
    const scopeGuard = {
      allowedSiteIds: [TARGET_SITE_ID],
      sourceSiteId: SOURCE_SITE_ID,
      targetSiteId: TARGET_SITE_ID,
      targetBefore: scopeBefore[TARGET_SITE_ID],
      targetAfter: scopeAfter[TARGET_SITE_ID],
      otherSiteChanges
    };
    manifest.scopeGuard = { ...scopeGuard, otherSiteChanges: [] };
    manifest.scopeAuditPath = apply ? scopeAuditPath : null;
    if (apply) {
      await fs.mkdir(path.dirname(scopeAuditPath), { recursive: true });
      await fs.writeFile(scopeAuditPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...scopeGuard, before: scopeBefore, after: scopeAfter }, null, 2)}\n`);
    }
    console.log(JSON.stringify({
      ok: true,
      mode: apply ? "applied" : "dry-run",
      target,
      sourceSiteId: SOURCE_SITE_ID,
      targetSiteId: TARGET_SITE_ID,
      backupPath: apply ? backupPath : null,
      copiedAssets: copiedAssets.size,
      staticAssets: {
        toCopy: [...staticAssetsToCopy],
        missing: [...staticAssetsMissing]
      },
      repairedSymlinks,
      missingAssets: [...missingAssets].slice(0, 30),
      missingAssetCount: missingAssets.size,
      summary,
      scopeGuard: manifest.scopeGuard,
      scopeAuditPath: apply ? scopeAuditPath : null,
      protectedTables: PROTECTED_TABLES.map(([, model]) => model),
      manifest
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
