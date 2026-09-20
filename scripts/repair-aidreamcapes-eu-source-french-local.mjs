#!/usr/bin/env node

// Rebuild the complete French storefront page copy from the source storefront.
// The source JSON owns the page structure, field set, card order, and semantics;
// the EU JSON only supplies route-safe ids, URLs, media, and French storefront
// canonical paths. This is deliberately separate from the old fallback-copy
// repairs, which generated generic text when they saw English.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SOURCE_SITE_ID = "site_dreamshoot";
const TARGET_SITE_ID = "site_aidreamcapes_xby";
const TARGET_DOMAIN = "aidreamcapes.eu";
const apply = process.argv.includes("--apply") || process.argv.includes("--apply-local");
const target = process.argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length) ?? "local";
const productionConfirmation = "--confirm=aidreamcapes-eu-source-french-production";
const BACKUP_ROOT = path.resolve(".tmp", "aidreamcapes-eu-source-french-copy");
const CACHE_PATH = path.join(BACKUP_ROOT, "translation-cache.json");
const EXISTING_VIDEO_CACHE = path.resolve(".tmp", "aidreamcapes-eu-video-french-copy", "translation-cache.json");
const MAX_BATCH_ITEMS = 10;
const MAX_BATCH_CHARS = 3600;
const BATCH_CONCURRENCY = 4;

// These target routes do not have a same-slug live row in the source database.
// They still use source storefront content so they cannot fall back to a
// hand-written generic page.
const SOURCE_ALIASES = {
  "/collections": "/ai-image-generation",
  "/tools": "/ai-video-generation",
  "/ai-save-the-date/wedding-invitation": "/ai-save-the-date/save-the-date"
};

const STRUCTURAL_KEY = /^(?:id|siteId|themeId|pageId|sectionId|blockId|productId|priceId|categoryId|parentId|mediaId|assetId|slug|path|href|canonicalPath|canonical|url|previewUrl|originUrl|src|imageUrl|imageOriginalUrl|videoUrl|poster|posterUrl|thumbnail|thumbnailUrl|ogImage|twitterImage|storageKey|filename|mimeType|contentType|sourceType|pageType|templateKey|routeKey|appSlug|sortOrder|position|order|status|currency|interval|type|provider|model|modelId|createdAt|updatedAt|role|loading|fetchPriority|format|fit|rel|target|method|locale|language|prompt|providerConfig|workflowConfig|modelPricing|objectKey)$/i;
const SOURCE_STRUCTURE_KEY = /^(?:sectionsOrder|sectionOrder|sectionIds|blockIds|contentKey|anchor|anchorId|routeKey)$/i;
const STYLE_STRUCTURE_KEY = /^(?:style|font_face|fontFace|className|class|primaryButton|secondaryButton|primaryButtonText|secondaryButtonText|.*(?:Color|_color|Bg|_bg|Font|_font|Shadow|_shadow|Border|_border|Family|_family|Gradient|_gradient|Spacing|_spacing|Weight|_weight))$/;
const ASSET_OR_REFERENCE = /^(?:https?:|mailto:|\/|data:|site_|prod_|price_|page_|media_|tool_|pack_|video_|ai_)/i;
const COPY_SEPARATOR = "\n\n";

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonIfPresent(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function sourceSlugFor(targetSlug) {
  return SOURCE_ALIASES[targetSlug] ?? targetSlug;
}

function copyString(key, value) {
  return typeof value === "string" && value.trim().length > 0 && !STRUCTURAL_KEY.test(key) && !ASSET_OR_REFERENCE.test(value.trim());
}

function replaceTargetBrand(value) {
  return String(value)
    .replaceAll("myDreamShoots", "Aidreamcapes")
    .replaceAll("myDreamshoots", "Aidreamcapes")
    .replaceAll("MyDreamShoots", "Aidreamcapes")
    .replaceAll("MYDREAMSHOOTS", "AIDREAMCAPES")
    .replaceAll("mydreamshoots.com", "aidreamcapes.eu")
    .replaceAll("www.mydreamshoots.com", "aidreamcapes.eu")
    .replaceAll("www.aidreamcapes.com", "aidreamcapes.eu")
    .replaceAll("support@mydreamshoots.com", "support@aidreamcapes.eu")
    .replaceAll("partners@mydreamshoots.com", "partners@aidreamcapes.eu")
    .replaceAll("mes shootings de rêves", "Aidreamcapes");
}

function normalizeFrench(value) {
  return replaceTargetBrand(value)
    .replace(/\bAI Social Media Video Maker\b/gi, "Créateur de vidéos pour les réseaux sociaux avec IA")
    .replace(/\bSocial Media Video Maker\b/gi, "Créateur de vidéos pour les réseaux sociaux")
    .replace(/\bSocial Media Video\b/gi, "Vidéo pour les réseaux sociaux")
    .replace(/\bAI Promo Video Maker\b/gi, "Créateur de vidéos promotionnelles avec IA")
    .replace(/\bPromo Video Maker\b/gi, "Créateur de vidéos promotionnelles")
    .replace(/\bImage to Video\b/gi, "Image vers vidéo")
    .replace(/\bText to Video\b/gi, "Texte vers vidéo")
    .replace(/\bTalking Head Video\b/gi, "Vidéo face caméra")
    .replace(/\bAvatar Video\b/gi, "Vidéo avatar")
    .replace(/\bBrand Video\b/gi, "Vidéo de marque")
    .replace(/\bFashion Video\b/gi, "Vidéo de mode")
    .replace(/\bFood Video\b/gi, "Vidéo culinaire")
    .replace(/\bPet Video\b/gi, "Vidéo animalière")
    .replace(/\bMusic Video\b/gi, "Vidéo musicale")
    .replace(/\bVideo Ad\b/gi, "Publicité vidéo")
    .replace(/\bUGC Ad Video\b/gi, "Publicité UGC")
    .replace(/\bAd Video\b/gi, "Publicité vidéo")
    .replace(/\bAI Video\b/g, "Vidéo IA")
    .replace(/\bAI Photo\b/g, "Photo IA")
    .replace(/\bAI\b/g, "IA");
}

function collectCopyStrings(value, key = "", output = []) {
  if (copyString(key, value)) {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectCopyStrings(item, key, output));
    return output;
  }
  if (value && typeof value === "object") Object.entries(value).forEach(([childKey, childValue]) => collectCopyStrings(childValue, childKey, output));
  return output;
}

function chunkValues(values) {
  const chunks = [];
  let current = [];
  let chars = 0;
  for (const value of values) {
    const nextChars = chars + value.length + 40;
    if (current.length && (current.length >= MAX_BATCH_ITEMS || nextChars > MAX_BATCH_CHARS)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(value);
    chars += value.length + 40;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function translateBatch(values) {
  const markers = values.map((_, index) => `[[[FR_SOURCE_COPY_${index}]]]`);
  const query = values.map((value, index) => `${markers[index]}${COPY_SEPARATOR}${value}`).join(COPY_SEPARATOR);
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=fr&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`French translation service returned ${response.status}`);
  const payload = await response.json();
  const translated = Array.isArray(payload) ? String(payload[0] ?? "") : "";
  const result = new Map();
  for (let index = 0; index < markers.length; index += 1) {
    const start = translated.indexOf(markers[index]);
    if (start < 0) throw new Error(`French translation response lost marker ${markers[index]}`);
    const valueStart = start + markers[index].length + COPY_SEPARATOR.length;
    const nextMarker = index + 1 < markers.length ? translated.indexOf(markers[index + 1], valueStart) : translated.length;
    if (nextMarker < 0) throw new Error(`French translation response lost marker ${markers[index + 1]}`);
    result.set(values[index], normalizeFrench(translated.slice(valueStart, nextMarker).trim()));
  }
  return result;
}

async function translateValues(values, cache) {
  const unique = [...new Set(values)].filter((value) => !cache[value]);
  const chunks = chunkValues(unique);
  for (let offset = 0; offset < chunks.length; offset += BATCH_CONCURRENCY) {
    const batchResults = await Promise.all(chunks.slice(offset, offset + BATCH_CONCURRENCY).map((chunk) => translateBatch(chunk)));
    for (const result of batchResults) for (const [source, translated] of result) cache[source] = translated;
    writeJson(CACHE_PATH, cache);
    console.log(`translated ${Math.min(offset + BATCH_CONCURRENCY, chunks.length)}/${chunks.length} source-copy batches`);
  }
  return cache;
}

function translateSourceValue(sourceValue, targetValue, key, cache) {
  if (typeof sourceValue === "string") {
    if (SOURCE_STRUCTURE_KEY.test(key)) return sourceValue;
    if (STYLE_STRUCTURE_KEY.test(key)) return sourceValue;
    if (copyString(key, sourceValue)) return normalizeFrench(cache[sourceValue] ?? sourceValue);
    return targetValue ?? sourceValue;
  }
  if (Array.isArray(sourceValue)) return sourceValue.map((item, index) => translateSourceValue(item, targetValue?.[index], key, cache));
  if (sourceValue && typeof sourceValue === "object") {
    const targetObject = targetValue && typeof targetValue === "object" && !Array.isArray(targetValue) ? targetValue : {};
    return Object.fromEntries(Object.entries(sourceValue).map(([childKey, childValue]) => [childKey, translateSourceValue(childValue, targetObject[childKey], childKey, cache)]));
  }
  return targetValue ?? sourceValue;
}

function mappedSource(sourceLiveBySlug, sourceThemeBySlug, targetSlug, targetKind) {
  const sourceSlug = sourceSlugFor(targetSlug);
  const live = sourceLiveBySlug.get(sourceSlug);
  const theme = sourceThemeBySlug.get(sourceSlug);
  if (targetKind === "live") {
    if (live) return { sourceSlug, json: live.contentJson, title: live.title };
    if (theme) return { sourceSlug, json: theme.publishedJson ?? theme.draftJson, title: theme.title };
  } else {
    if (theme) return { sourceSlug, json: theme.publishedJson ?? theme.draftJson, draftJson: theme.draftJson, title: theme.title };
    if (live) return { sourceSlug, json: live.contentJson, draftJson: live.contentJson, title: live.title };
  }
  return null;
}

function rebuildPageJson(sourceJson, targetJson, targetSlug, cache) {
  const next = translateSourceValue(sourceJson ?? {}, targetJson ?? {}, "content", cache);
  next.seo = { ...(next.seo ?? {}) };
  next.seo.canonicalPath = targetSlug;
  next.seo.canonical = `https://${TARGET_DOMAIN}${targetSlug === "/" ? "/" : targetSlug}`;
  return next;
}

function copyTitle(sourceTitle, cache) {
  return normalizeFrench(cache[sourceTitle] ?? sourceTitle);
}

function addPageSourceValues(values, mapping) {
  if (!mapping?.json) return;
  values.push(...collectCopyStrings(mapping.json));
  if (mapping.title) values.push(mapping.title);
  if (mapping.draftJson) values.push(...collectCopyStrings(mapping.draftJson));
}

function sourceMirrorId(kind, sourceId) {
  const hash = crypto.createHash("sha256").update(String(sourceId)).digest("hex").slice(0, 16);
  return `aidreamcapes_eu_mirror_${kind}_${hash}`;
}

function addCatalogSourceValues(values, rows, fields) {
  for (const row of rows) {
    for (const field of fields) {
      if (row[field] !== undefined && row[field] !== null) values.push(...collectCopyStrings(row[field], field));
    }
  }
}

function sourceParentTargetId(sourceRow, sourceById, targetBySlug) {
  if (!sourceRow.parentId) return null;
  const sourceParent = sourceById.get(sourceRow.parentId);
  return sourceParent ? targetBySlug.get(sourceParent.slug)?.id ?? null : null;
}

function sourceCategoryTargetId(sourceCategoryId, sourceById, targetBySlug) {
  if (!sourceCategoryId) return null;
  const sourceCategory = sourceById.get(sourceCategoryId);
  return sourceCategory ? targetBySlug.get(sourceCategory.slug)?.id ?? null : null;
}

function sourceThemeTargetId(sourceThemeId, sourceById, targetBySlug) {
  if (!sourceThemeId) return null;
  const sourceTheme = sourceById.get(sourceThemeId);
  return sourceTheme ? targetBySlug.get(sourceTheme.slug)?.id ?? null : null;
}

async function main() {
  if (target === "local") {
    assertDatabaseTarget({ expectedTarget: "local" });
    if (apply) assertNonProductionWriteTarget();
  } else if (target === "production") {
    assertDatabaseTarget({
      expectedTarget: "production",
      requireProductionConfirmation: true,
      productionConfirmed: process.argv.includes(productionConfirmation)
    });
    if (apply && !process.argv.includes(productionConfirmation)) {
      throw new Error(`Production Aidreamcapes writes require ${productionConfirmation}.`);
    }
  } else {
    throw new Error(`Unsupported target ${target}; use --target=local or --target=production.`);
  }
  const prisma = new PrismaClient();
  try {
    const [sourceLive, targetLive, sourceTheme, targetTheme, sourceSettings, targetSettings, sourceProfile, targetProfile, sourceSiteThemes, targetSiteThemes, sourceProducts, targetProducts, sourcePackCategories, targetPackCategories, sourcePacks, targetPacks, sourceToolCategories, targetToolCategories, sourceToolItems, targetToolItems, sourceVideoCategories, targetVideoCategories, sourceVideoThemes, targetVideoThemes, sourceVideoExamples, targetVideoExamples] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.livePage.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themeSettings.findUnique({ where: { siteId: SOURCE_SITE_ID } }),
      prisma.themeSettings.findUnique({ where: { siteId: TARGET_SITE_ID } }),
      prisma.storefrontProfile.findUnique({ where: { siteId: SOURCE_SITE_ID } }),
      prisma.storefrontProfile.findUnique({ where: { siteId: TARGET_SITE_ID } }),
      prisma.siteTheme.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: { themeKey: "asc" } }),
      prisma.siteTheme.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: { themeKey: "asc" } }),
      prisma.product.findMany({ where: { siteId: SOURCE_SITE_ID }, include: { prices: true }, orderBy: { id: "asc" } }),
      prisma.product.findMany({ where: { siteId: TARGET_SITE_ID }, include: { prices: true }, orderBy: { id: "asc" } }),
      prisma.creativePackCategory.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.creativePackCategory.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.creativePack.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: { id: "asc" } }),
      prisma.creativePack.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: { id: "asc" } }),
      prisma.toolCategory.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.toolCategory.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.toolMenuItem.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.toolMenuItem.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.videoThemeCategory.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.videoThemeCategory.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.videoTheme.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.videoTheme.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.videoThemeExample.findMany({ where: { siteId: SOURCE_SITE_ID }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      prisma.videoThemeExample.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] })
    ]);
    const sourceLiveBySlug = new Map(sourceLive.map((page) => [page.slug, page]));
    const sourceThemeBySlug = new Map(sourceTheme.map((page) => [page.slug, page]));
    const targetLiveBySlug = new Map(targetLive.map((page) => [page.slug, page]));
    const targetThemeBySlug = new Map(targetTheme.map((page) => [page.slug, page]));
    const liveRows = [];
    const themeRows = [];
    const sourceValues = [];
    for (const targetPage of targetLive) {
      const mapping = mappedSource(sourceLiveBySlug, sourceThemeBySlug, targetPage.slug, "live");
      assert(mapping?.json, `${targetPage.slug}: no source live/theme payload available`);
      addPageSourceValues(sourceValues, mapping);
      liveRows.push({ targetPage, mapping, contentJson: rebuildPageJson(mapping.json, targetPage.contentJson, targetPage.slug, {}) });
    }
    for (const targetPage of targetTheme) {
      const mapping = mappedSource(sourceLiveBySlug, sourceThemeBySlug, targetPage.slug, "theme");
      assert(mapping?.json, `${targetPage.slug}: no source theme/live payload available`);
      addPageSourceValues(sourceValues, mapping);
      themeRows.push({ targetPage, mapping });
    }
    assert(sourceSettings && targetSettings, "source_or_target_theme_settings_missing");
    assert(sourceProfile && targetProfile, "source_or_target_storefront_profile_missing");
    sourceValues.push(...collectCopyStrings(sourceSettings.draftJson), ...collectCopyStrings(sourceSettings.publishedJson));
    sourceValues.push(...collectCopyStrings(sourceProfile.draftJson), ...collectCopyStrings(sourceProfile.publishedJson));
    const sourceThemeByKey = new Map(sourceSiteThemes.map((theme) => [theme.themeKey, theme]));
    for (const targetTheme of targetSiteThemes) {
      const sourceTheme = sourceThemeByKey.get(targetTheme.themeKey) ?? sourceSiteThemes.find((candidate) => candidate.themeId === targetTheme.themeId);
      if (!sourceTheme) continue;
      sourceValues.push(...collectCopyStrings(sourceTheme.templates), ...collectCopyStrings(sourceTheme.settings));
      if (sourceTheme.name) sourceValues.push(sourceTheme.name);
    }
    addCatalogSourceValues(sourceValues, sourceProducts, ["name", "metadata"]);
    for (const product of sourceProducts) addCatalogSourceValues(sourceValues, product.prices, ["label", "metadata"]);
    addCatalogSourceValues(sourceValues, sourcePackCategories, ["label", "description", "heroTitle", "heroSubtitle"]);
    addCatalogSourceValues(sourceValues, sourcePacks, ["name", "headline", "description", "galleryImageAlts"]);
    addCatalogSourceValues(sourceValues, sourceToolCategories, ["label", "description"]);
    addCatalogSourceValues(sourceValues, sourceToolItems, ["title", "description", "badge", "detailJson"]);
    addCatalogSourceValues(sourceValues, sourceVideoCategories, ["label", "description"]);
    addCatalogSourceValues(sourceValues, sourceVideoThemes, ["name", "headline", "description"]);
    addCatalogSourceValues(sourceValues, sourceVideoExamples, ["name", "description"]);
    const cache = { ...readJsonIfPresent(EXISTING_VIDEO_CACHE, {}), ...readJsonIfPresent(CACHE_PATH, {}) };
    await translateValues(sourceValues, cache);
    for (const row of liveRows) row.contentJson = rebuildPageJson(row.mapping.json, row.targetPage.contentJson, row.targetPage.slug, cache);
    for (const row of themeRows) {
      row.draftJson = rebuildPageJson(row.mapping.draftJson ?? row.mapping.json, row.targetPage.draftJson, row.targetPage.slug, cache);
      row.publishedJson = rebuildPageJson(row.mapping.json, row.targetPage.publishedJson, row.targetPage.slug, cache);
    }
    const nextSettings = {
      draftJson: translateSourceValue(sourceSettings.draftJson, targetSettings.draftJson, "settings", cache),
      publishedJson: translateSourceValue(sourceSettings.publishedJson, targetSettings.publishedJson, "settings", cache)
    };
    const nextProfile = {
      draftJson: translateSourceValue(sourceProfile.draftJson, targetProfile.draftJson, "profile", cache),
      publishedJson: translateSourceValue(sourceProfile.publishedJson, targetProfile.publishedJson, "profile", cache)
    };
    const nextSiteThemes = targetSiteThemes.map((targetTheme) => {
      const sourceTheme = sourceThemeByKey.get(targetTheme.themeKey) ?? sourceSiteThemes.find((candidate) => candidate.themeId === targetTheme.themeId);
      if (!sourceTheme) return { targetTheme };
      return {
        targetTheme,
        name: copyTitle(sourceTheme.name, cache),
        templates: translateSourceValue(sourceTheme.templates, targetTheme.templates, "templates", cache),
        settings: translateSourceValue(sourceTheme.settings, targetTheme.settings, "settings", cache)
      };
    });
    const sourcePackCategoryById = new Map(sourcePackCategories.map((row) => [row.id, row]));
    const targetPackCategoryBySlug = new Map(targetPackCategories.map((row) => [row.slug, row]));
    const sourceVideoCategoryById = new Map(sourceVideoCategories.map((row) => [row.id, row]));
    const targetVideoCategoryBySlug = new Map(targetVideoCategories.map((row) => [row.slug, row]));
    const sourceVideoThemeById = new Map(sourceVideoThemes.map((row) => [row.id, row]));
    const targetVideoThemeBySlug = new Map(targetVideoThemes.map((row) => [row.slug, row]));
    const sourceToolCategoryById = new Map(sourceToolCategories.map((row) => [row.id, row]));
    const targetToolCategoryBySlug = new Map(targetToolCategories.map((row) => [row.slug, row]));
    const targetProductByMirrorId = new Map(targetProducts.map((row) => [row.id, row]));
    const targetPackByMirrorId = new Map(targetPacks.map((row) => [row.id, row]));
    const targetVideoExampleByMirrorId = new Map(targetVideoExamples.map((row) => [row.id, row]));
    const catalog = {
      products: [],
      prices: [],
      packCategories: [],
      packs: [],
      toolCategories: [],
      toolItems: [],
      videoCategories: [],
      videoThemes: [],
      videoExamples: []
    };
    for (const sourceProduct of sourceProducts) {
      const targetProduct = targetProductByMirrorId.get(sourceMirrorId("product", sourceProduct.id));
      assert(targetProduct, `missing target product mirror for ${sourceProduct.id}`);
      catalog.products.push({
        targetProduct,
        data: {
          name: normalizeFrench(cache[sourceProduct.name] ?? sourceProduct.name),
          metadata: translateSourceValue(sourceProduct.metadata, targetProduct.metadata, "metadata", cache),
          status: sourceProduct.status
        }
      });
      for (const sourcePrice of sourceProduct.prices) {
        const targetPrice = targetProduct.prices.find((row) => row.interval === sourcePrice.interval);
        assert(targetPrice, `missing target price mirror for ${sourcePrice.id}`);
        catalog.prices.push({
          targetPrice,
          data: {
            label: normalizeFrench(cache[sourcePrice.label] ?? sourcePrice.label),
            metadata: translateSourceValue(sourcePrice.metadata, targetPrice.metadata, "metadata", cache),
            status: sourcePrice.status
          }
        });
      }
    }
    for (const sourceCategory of sourcePackCategories) {
      const targetCategory = targetPackCategoryBySlug.get(sourceCategory.slug);
      assert(targetCategory, `missing target creative pack category for ${sourceCategory.slug}`);
      catalog.packCategories.push({
        targetCategory,
        data: {
          parentId: sourceParentTargetId(sourceCategory, sourcePackCategoryById, targetPackCategoryBySlug),
          label: normalizeFrench(cache[sourceCategory.label] ?? sourceCategory.label),
          description: sourceCategory.description === null ? null : normalizeFrench(cache[sourceCategory.description] ?? sourceCategory.description),
          heroTitle: sourceCategory.heroTitle === null ? null : normalizeFrench(cache[sourceCategory.heroTitle] ?? sourceCategory.heroTitle),
          heroSubtitle: sourceCategory.heroSubtitle === null ? null : normalizeFrench(cache[sourceCategory.heroSubtitle] ?? sourceCategory.heroSubtitle),
          status: sourceCategory.status,
          sortOrder: sourceCategory.sortOrder
        }
      });
    }
    for (const sourcePack of sourcePacks) {
      const targetPack = targetPackByMirrorId.get(sourceMirrorId("pack", sourcePack.id));
      assert(targetPack, `missing target creative pack mirror for ${sourcePack.id}`);
      catalog.packs.push({
        targetPack,
        data: {
          categoryId: sourceCategoryTargetId(sourcePack.categoryId, sourcePackCategoryById, targetPackCategoryBySlug),
          category: sourcePack.category,
          name: normalizeFrench(cache[sourcePack.name] ?? sourcePack.name),
          headline: normalizeFrench(cache[sourcePack.headline] ?? sourcePack.headline),
          description: normalizeFrench(cache[sourcePack.description] ?? sourcePack.description),
          galleryImageAlts: translateSourceValue(sourcePack.galleryImageAlts, targetPack.galleryImageAlts, "galleryImageAlts", cache),
          aiAppSlug: sourcePack.aiAppSlug,
          status: sourcePack.status,
          creditCost: sourcePack.creditCost,
          outputCount: sourcePack.outputCount,
          trainingRequired: sourcePack.trainingRequired
        }
      });
    }
    for (const sourceCategory of sourceToolCategories) {
      const targetCategory = targetToolCategories.find((row) => row.slug === sourceCategory.slug);
      assert(targetCategory, `missing target tool category for ${sourceCategory.slug}`);
      catalog.toolCategories.push({
        targetCategory,
        data: {
          parentId: sourceParentTargetId(sourceCategory, sourceToolCategoryById, targetToolCategoryBySlug),
          label: normalizeFrench(cache[sourceCategory.label] ?? sourceCategory.label),
          description: sourceCategory.description === null ? null : normalizeFrench(cache[sourceCategory.description] ?? sourceCategory.description),
          status: sourceCategory.status,
          sortOrder: sourceCategory.sortOrder
        }
      });
    }
    for (const sourceItem of sourceToolItems) {
      const targetItem = targetToolItems.find((row) => row.slug === sourceItem.slug);
      assert(targetItem, `missing target tool item for ${sourceItem.slug}`);
      catalog.toolItems.push({
        targetItem,
        data: {
          title: normalizeFrench(cache[sourceItem.title] ?? sourceItem.title),
          description: sourceItem.description === null ? null : normalizeFrench(cache[sourceItem.description] ?? sourceItem.description),
          badge: sourceItem.badge === null ? null : normalizeFrench(cache[sourceItem.badge] ?? sourceItem.badge),
          detailJson: translateSourceValue(sourceItem.detailJson, targetItem.detailJson, "detailJson", cache),
          status: sourceItem.status
        }
      });
    }
    for (const sourceCategory of sourceVideoCategories) {
      const targetCategory = targetVideoCategoryBySlug.get(sourceCategory.slug);
      assert(targetCategory, `missing target video category for ${sourceCategory.slug}`);
      catalog.videoCategories.push({
        targetCategory,
        data: {
          parentId: sourceParentTargetId(sourceCategory, sourceVideoCategoryById, targetVideoCategoryBySlug),
          label: normalizeFrench(cache[sourceCategory.label] ?? sourceCategory.label),
          description: sourceCategory.description === null ? null : normalizeFrench(cache[sourceCategory.description] ?? sourceCategory.description),
          status: sourceCategory.status,
          sortOrder: sourceCategory.sortOrder
        }
      });
    }
    for (const sourceThemeRow of sourceVideoThemes) {
      const targetThemeRow = targetVideoThemeBySlug.get(sourceThemeRow.slug);
      assert(targetThemeRow, `missing target video theme for ${sourceThemeRow.slug}`);
      catalog.videoThemes.push({
        targetThemeRow,
        data: {
          categoryId: sourceCategoryTargetId(sourceThemeRow.categoryId, sourceVideoCategoryById, targetVideoCategoryBySlug),
          name: normalizeFrench(cache[sourceThemeRow.name] ?? sourceThemeRow.name),
          headline: normalizeFrench(cache[sourceThemeRow.headline] ?? sourceThemeRow.headline),
          description: normalizeFrench(cache[sourceThemeRow.description] ?? sourceThemeRow.description),
          status: sourceThemeRow.status,
          creditCost: sourceThemeRow.creditCost,
          durationSeconds: sourceThemeRow.durationSeconds,
          maxFrames: sourceThemeRow.maxFrames,
          sortOrder: sourceThemeRow.sortOrder
        }
      });
    }
    for (const sourceExample of sourceVideoExamples) {
      const targetExample = targetVideoExampleByMirrorId.get(sourceMirrorId("video_example", sourceExample.id));
      assert(targetExample, `missing target video example mirror for ${sourceExample.id}`);
      catalog.videoExamples.push({
        targetExample,
        data: {
          themeId: sourceThemeTargetId(sourceExample.themeId, sourceVideoThemeById, targetVideoThemeBySlug),
          name: normalizeFrench(cache[sourceExample.name] ?? sourceExample.name),
          description: sourceExample.description === null ? null : normalizeFrench(cache[sourceExample.description] ?? sourceExample.description),
          status: sourceExample.status,
          sortOrder: sourceExample.sortOrder
        }
      });
    }
    const report = {
      ok: true,
      mode: apply ? "apply-local" : "dry-run",
      sourceSiteId: SOURCE_SITE_ID,
      targetSiteId: TARGET_SITE_ID,
      sourceLivePages: sourceLive.length,
      targetLivePages: targetLive.length,
      sourceThemePages: sourceTheme.length,
      targetThemePages: targetTheme.length,
      translatedSourceStrings: Object.keys(cache).length,
      changedLivePages: liveRows.filter((row) => JSON.stringify(row.targetPage.contentJson) !== JSON.stringify(row.contentJson)).length,
      changedThemePages: themeRows.filter((row) => JSON.stringify(row.targetPage.draftJson) !== JSON.stringify(row.draftJson) || JSON.stringify(row.targetPage.publishedJson) !== JSON.stringify(row.publishedJson)).length,
      changedSettings: JSON.stringify(sourceSettings.draftJson) !== JSON.stringify(nextSettings.draftJson) || JSON.stringify(sourceSettings.publishedJson) !== JSON.stringify(nextSettings.publishedJson),
      changedProfile: JSON.stringify(sourceProfile.draftJson) !== JSON.stringify(nextProfile.draftJson) || JSON.stringify(sourceProfile.publishedJson) !== JSON.stringify(nextProfile.publishedJson),
      changedSiteThemes: nextSiteThemes.filter((row) => row.name !== undefined).length,
      sourceProducts: sourceProducts.length,
      sourcePackCategories: sourcePackCategories.length,
      sourcePacks: sourcePacks.length,
      sourceToolCategories: sourceToolCategories.length,
      sourceToolItems: sourceToolItems.length,
      sourceVideoCategories: sourceVideoCategories.length,
      sourceVideoThemes: sourceVideoThemes.length,
      sourceVideoExamples: sourceVideoExamples.length,
      matchedCatalogRows: Object.fromEntries(Object.entries(catalog).map(([key, rows]) => [key, rows.length])),
      translationService: "Google Translate Chrome endpoint"
    };
    if (apply) {
      const backupPath = path.join(BACKUP_ROOT, `backup-before-source-french-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, {
        livePages: targetLive.map((row) => ({ id: row.id, slug: row.slug, title: row.title, contentJson: row.contentJson })),
        themePages: targetTheme.map((row) => ({ id: row.id, slug: row.slug, title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson })),
        themeSettings: targetSettings,
        storefrontProfile: targetProfile,
        siteThemes: targetSiteThemes,
        products: targetProducts,
        packCategories: targetPackCategories,
        packs: targetPacks,
        toolCategories: targetToolCategories,
        toolItems: targetToolItems,
        videoCategories: targetVideoCategories,
        videoThemes: targetVideoThemes,
        videoExamples: targetVideoExamples
      });
      await prisma.$transaction(async (tx) => {
        for (const row of liveRows) await tx.livePage.update({ where: { id: row.targetPage.id }, data: { title: copyTitle(row.mapping.title, cache), contentJson: row.contentJson } });
        for (const row of themeRows) await tx.themePage.update({ where: { id: row.targetPage.id }, data: { title: copyTitle(row.mapping.title, cache), draftJson: row.draftJson, publishedJson: row.publishedJson } });
        await tx.themeSettings.update({ where: { id: targetSettings.id }, data: nextSettings });
        await tx.storefrontProfile.update({ where: { id: targetProfile.id }, data: nextProfile });
        for (const row of nextSiteThemes) {
          if (row.name === undefined) continue;
          await tx.siteTheme.update({ where: { id: row.targetTheme.id }, data: { name: row.name, templates: row.templates, settings: row.settings } });
        }
        for (const row of catalog.products) await tx.product.update({ where: { id: row.targetProduct.id }, data: row.data });
        for (const row of catalog.prices) await tx.price.update({ where: { id: row.targetPrice.id }, data: row.data });
        for (const row of catalog.packCategories) await tx.creativePackCategory.update({ where: { id: row.targetCategory.id }, data: row.data });
        for (const row of catalog.packs) await tx.creativePack.update({ where: { id: row.targetPack.id }, data: row.data });
        for (const row of catalog.toolCategories) await tx.toolCategory.update({ where: { id: row.targetCategory.id }, data: row.data });
        for (const row of catalog.toolItems) await tx.toolMenuItem.update({ where: { id: row.targetItem.id }, data: row.data });
        for (const row of catalog.videoCategories) await tx.videoThemeCategory.update({ where: { id: row.targetCategory.id }, data: row.data });
        for (const row of catalog.videoThemes) await tx.videoTheme.update({ where: { id: row.targetThemeRow.id }, data: row.data });
        for (const row of catalog.videoExamples) await tx.videoThemeExample.update({ where: { id: row.targetExample.id }, data: row.data });
        await tx.product.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: catalog.products.map((row) => row.targetProduct.id) } }, data: { status: "inactive" } });
        await tx.price.updateMany({ where: { siteId: TARGET_SITE_ID, productId: { notIn: catalog.products.map((row) => row.targetProduct.id) } }, data: { status: "draft" } });
        await tx.toolCategory.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: catalog.toolCategories.map((row) => row.targetCategory.id) } }, data: { status: "inactive" } });
        await tx.toolMenuItem.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: catalog.toolItems.map((row) => row.targetItem.id) } }, data: { status: "inactive" } });
        await tx.creativePackCategory.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: catalog.packCategories.map((row) => row.targetCategory.id) } }, data: { status: "inactive" } });
        await tx.creativePack.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: catalog.packs.map((row) => row.targetPack.id) } }, data: { status: "inactive" } });
        await tx.videoThemeCategory.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: catalog.videoCategories.map((row) => row.targetCategory.id) } }, data: { status: "inactive" } });
        await tx.videoTheme.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: catalog.videoThemes.map((row) => row.targetThemeRow.id) } }, data: { status: "inactive" } });
        await tx.videoThemeExample.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: catalog.videoExamples.map((row) => row.targetExample.id) } }, data: { status: "inactive" } });
      }, { maxWait: 20_000, timeout: 180_000 });
      report.backupPath = backupPath;
    }
    const reportPath = path.join(BACKUP_ROOT, `report-source-french-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
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
