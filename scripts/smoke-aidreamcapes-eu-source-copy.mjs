#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const SOURCE_SITE_ID = "site_dreamshoot";
const TARGET_SITE_ID = "site_aidreamcapes_xby";
const SOURCE_ALIASES = {
  "/collections": "/ai-image-generation",
  "/tools": "/ai-video-generation",
  "/ai-save-the-date/wedding-invitation": "/ai-save-the-date/save-the-date"
};
const GENERIC_MARKERS = [
  "Préparez aidreamcapes avec des sources autorisées, puis vérifiez chaque détail avant le partage.",
  "Créez aidreamcapes à partir de sources autorisées, puis vérifiez chaque détail avant le partage.",
  "Aidreamcapes avec l’IA"
];
const STRUCTURAL_KEY = /^(?:id|siteId|themeId|pageId|sectionId|blockId|productId|priceId|categoryId|parentId|mediaId|assetId|slug|path|href|canonicalPath|url|previewUrl|originUrl|src|imageUrl|videoUrl|poster|posterUrl|thumbnail|thumbnailUrl|storageKey|filename|mimeType|contentType|sourceType|pageType|templateKey|routeKey|appSlug|sortOrder|position|order|status|currency|interval|type|provider|model|modelId|createdAt|updatedAt|role|loading|fetchPriority|format|fit|prompt)$/i;
const ASSET_OR_REFERENCE = /^(?:https?:|mailto:|\/|data:|site_|prod_|price_|page_|media_|tool_|pack_|video_|ai_)/i;

function sourceSlugFor(targetSlug) {
  return SOURCE_ALIASES[targetSlug] ?? targetSlug;
}

function dedicatedContent(page, field) {
  return page?.[field] ?? null;
}

function shape(value, options = {}) {
  if (Array.isArray(value)) return `[${value.length}:${value.map((item) => shape(item, options)).join("|")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).filter((key) => key !== "canonical" && !(options.ignoreHomepageExtensions && key === "featureCaption"));
    return `{${keys.sort().map((key) => `${key}:${shape(value[key], options)}`).join(",")}}`;
  }
  return typeof value;
}

function copyValues(value, key = "", output = []) {
  if (typeof value === "string") {
    if (value.trim() && !STRUCTURAL_KEY.test(key) && !ASSET_OR_REFERENCE.test(value.trim())) output.push(value.trim());
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => copyValues(item, key, output));
    return output;
  }
  if (value && typeof value === "object") Object.entries(value).forEach(([childKey, childValue]) => copyValues(childValue, childKey, output));
  return output;
}

function findSource(sourceLiveBySlug, sourceThemeBySlug, targetSlug, field) {
  const sourceSlug = sourceSlugFor(targetSlug);
  const live = sourceLiveBySlug.get(sourceSlug);
  const theme = sourceThemeBySlug.get(sourceSlug);
  if (field === "contentJson") {
    return live?.contentJson ?? theme?.publishedJson ?? theme?.draftJson;
  }
  if (field === "draftJson") return theme?.draftJson ?? theme?.publishedJson ?? live?.contentJson;
  return theme?.publishedJson ?? theme?.draftJson ?? live?.contentJson;
}

function assertPageCopy(sourceJson, targetJson, slug, field) {
  assert(sourceJson && targetJson, `${slug} (${field}): source or target payload is missing`);
  // The EU homepage intentionally has one approved French-only caption field;
  // all other homepage structure must still remain source-aligned.
  const shapeOptions = slug === "/" ? { ignoreHomepageExtensions: true } : {};
  assert.equal(shape(sourceJson, shapeOptions), shape(targetJson, shapeOptions), `${slug} (${field}): target structure diverged from source structure`);
  const generic = copyValues(targetJson).filter((value) => GENERIC_MARKERS.includes(value));
  assert.equal(generic.length, 0, `${slug} (${field}): generic fallback copy remains (${generic.length} nodes)`);
  const sourceValues = new Set(copyValues(sourceJson).filter((value) => value.length >= 40));
  const unchanged = copyValues(targetJson).filter((value) => value.length >= 40 && sourceValues.has(value));
  assert(unchanged.length <= 4, `${slug} (${field}): ${unchanged.length} long source-language strings remain untranslated`);
}

function sourceMirrorId(kind, sourceId) {
  const hash = crypto.createHash("sha256").update(String(sourceId)).digest("hex").slice(0, 16);
  return `aidreamcapes_eu_mirror_${kind}_${hash}`;
}

function assertSourceMappedStatuses(sourceRows, targetRows, key, label) {
  const targetByKey = new Map(targetRows.map((row) => [key(row), row]));
  for (const sourceRow of sourceRows) {
    const targetRow = targetByKey.get(key(sourceRow));
    assert(targetRow, `${label}: missing target source mapping for ${key(sourceRow)}`);
    assert.equal(targetRow.status, sourceRow.status, `${label}: status diverged for ${key(sourceRow)}`);
  }
  const sourceKeys = new Set(sourceRows.map(key));
  const activeExtras = targetRows.filter((row) => row.status === "active" && !sourceKeys.has(key(row)));
  assert.equal(activeExtras.length, 0, `${label}: ${activeExtras.length} active target-only rows remain`);
  return targetByKey;
}

const prisma = new PrismaClient();
try {
  const [sourceLive, targetLive, sourceTheme, targetTheme] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: SOURCE_SITE_ID }, select: { slug: true, contentJson: true } }),
    prisma.livePage.findMany({ where: { siteId: TARGET_SITE_ID }, select: { slug: true, contentJson: true } }),
    prisma.themePage.findMany({ where: { siteId: SOURCE_SITE_ID }, select: { slug: true, publishedJson: true, draftJson: true } }),
    prisma.themePage.findMany({ where: { siteId: TARGET_SITE_ID }, select: { slug: true, publishedJson: true, draftJson: true } })
  ]);
  const sourceLiveBySlug = new Map(sourceLive.map((page) => [page.slug, page]));
  const sourceThemeBySlug = new Map(sourceTheme.map((page) => [page.slug, page]));
  let checked = 0;
  for (const targetPage of targetLive) {
    assertPageCopy(findSource(sourceLiveBySlug, sourceThemeBySlug, targetPage.slug, "contentJson"), targetPage.contentJson, targetPage.slug, "contentJson");
    checked += 1;
  }
  for (const targetPage of targetTheme) {
    assertPageCopy(findSource(sourceLiveBySlug, sourceThemeBySlug, targetPage.slug, "publishedJson"), targetPage.publishedJson, targetPage.slug, "publishedJson");
    assertPageCopy(findSource(sourceLiveBySlug, sourceThemeBySlug, targetPage.slug, "draftJson"), targetPage.draftJson, targetPage.slug, "draftJson");
    checked += 2;
  }
  const [sourceProducts, targetProducts, sourcePackCategories, targetPackCategories, sourcePacks, targetPacks, sourceToolCategories, targetToolCategories, sourceToolItems, targetToolItems, sourceVideoCategories, targetVideoCategories, sourceVideoThemes, targetVideoThemes, sourceVideoExamples, targetVideoExamples] = await Promise.all([
    prisma.product.findMany({ where: { siteId: SOURCE_SITE_ID }, include: { prices: true } }),
    prisma.product.findMany({ where: { siteId: TARGET_SITE_ID }, include: { prices: true } }),
    prisma.creativePackCategory.findMany({ where: { siteId: SOURCE_SITE_ID } }),
    prisma.creativePackCategory.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.creativePack.findMany({ where: { siteId: SOURCE_SITE_ID } }),
    prisma.creativePack.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.toolCategory.findMany({ where: { siteId: SOURCE_SITE_ID } }),
    prisma.toolCategory.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.toolMenuItem.findMany({ where: { siteId: SOURCE_SITE_ID } }),
    prisma.toolMenuItem.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.videoThemeCategory.findMany({ where: { siteId: SOURCE_SITE_ID } }),
    prisma.videoThemeCategory.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.videoTheme.findMany({ where: { siteId: SOURCE_SITE_ID } }),
    prisma.videoTheme.findMany({ where: { siteId: TARGET_SITE_ID } }),
    prisma.videoThemeExample.findMany({ where: { siteId: SOURCE_SITE_ID } }),
    prisma.videoThemeExample.findMany({ where: { siteId: TARGET_SITE_ID } })
  ]);
  const productById = new Map(targetProducts.map((row) => [row.id, row]));
  for (const sourceProduct of sourceProducts) {
    const targetProduct = productById.get(sourceMirrorId("product", sourceProduct.id));
    assert(targetProduct, `products: missing target mirror for ${sourceProduct.id}`);
    assert.equal(targetProduct.status, sourceProduct.status, `products: status diverged for ${sourceProduct.id}`);
    for (const sourcePrice of sourceProduct.prices) {
      const targetPrice = targetProduct.prices.find((row) => row.interval === sourcePrice.interval);
      assert(targetPrice, `prices: missing target interval for ${sourcePrice.id}`);
      assert.equal(targetPrice.status, sourcePrice.status, `prices: status diverged for ${sourcePrice.id}`);
    }
  }
  assert.equal(targetProducts.filter((row) => row.status === "active" && !row.id.includes("_eu_mirror_product_")).length, 0, "products: active target-only rows remain");
  const packCategoryBySlug = assertSourceMappedStatuses(sourcePackCategories, targetPackCategories, (row) => row.slug, "creative pack categories");
  const packById = new Map(targetPacks.map((row) => [row.id, row]));
  for (const sourcePack of sourcePacks) {
    const targetPack = packById.get(sourceMirrorId("pack", sourcePack.id));
    assert(targetPack, `creative packs: missing target mirror for ${sourcePack.id}`);
    assert.equal(targetPack.status, sourcePack.status, `creative packs: status diverged for ${sourcePack.id}`);
    assert.equal(targetPack.category, sourcePack.category, `creative packs: source category diverged for ${sourcePack.id}`);
    if (sourcePack.categoryId) assert.equal(targetPack.categoryId, packCategoryBySlug.get(sourcePackCategories.find((row) => row.id === sourcePack.categoryId)?.slug)?.id, `creative packs: category mapping diverged for ${sourcePack.id}`);
  }
  assert.equal(targetPacks.filter((row) => row.status === "active" && !row.id.includes("_eu_mirror_pack_")).length, 0, "creative packs: active target-only rows remain");
  assert.equal(sourceToolCategories.length, 0, "tool categories: source snapshot unexpectedly changed");
  assert.equal(sourceToolItems.length, 0, "tool items: source snapshot unexpectedly changed");
  assert.equal(targetToolCategories.filter((row) => row.status === "active").length, 0, "tool categories: active target-only rows remain");
  assert.equal(targetToolItems.filter((row) => row.status === "active").length, 0, "tool items: active target-only rows remain");
  assertSourceMappedStatuses(sourceVideoCategories, targetVideoCategories, (row) => row.slug, "video theme categories");
  assertSourceMappedStatuses(sourceVideoThemes, targetVideoThemes, (row) => row.slug, "video themes");
  const videoExampleById = new Map(targetVideoExamples.map((row) => [row.id, row]));
  for (const sourceExample of sourceVideoExamples) {
    const targetExample = videoExampleById.get(sourceMirrorId("video_example", sourceExample.id));
    assert(targetExample, `video theme examples: missing target mirror for ${sourceExample.id}`);
    assert.equal(targetExample.status, sourceExample.status, `video theme examples: status diverged for ${sourceExample.id}`);
  }
  assert.equal(targetVideoExamples.filter((row) => row.status === "active" && !row.id.includes("_eu_mirror_video_example_")).length, 0, "video theme examples: active target-only rows remain");
  const publicDynamic = {
    products: targetProducts.filter((row) => row.status === "active"),
    packCategories: targetPackCategories.filter((row) => row.status === "active"),
    packs: targetPacks.filter((row) => row.status === "active"),
    toolCategories: targetToolCategories.filter((row) => row.status === "active"),
    toolItems: targetToolItems.filter((row) => row.status === "active"),
    videoCategories: targetVideoCategories.filter((row) => row.status === "active"),
    videoThemes: targetVideoThemes.filter((row) => row.status === "active"),
    videoExamples: targetVideoExamples.filter((row) => row.status === "active")
  };
  const publicDynamicText = JSON.stringify(publicDynamic);
  for (const marker of GENERIC_MARKERS) assert(!publicDynamicText.includes(marker), `public dynamic data still contains generic fallback copy: ${marker}`);
  console.log(JSON.stringify({ ok: true, checkedPayloads: checked, sourceLive: sourceLive.length, targetLive: targetLive.length, sourceTheme: sourceTheme.length, targetTheme: targetTheme.length, checkedDynamic: { products: sourceProducts.length, packCategories: sourcePackCategories.length, packs: sourcePacks.length, videoCategories: sourceVideoCategories.length, videoThemes: sourceVideoThemes.length, videoExamples: sourceVideoExamples.length } }));
} finally {
  await prisma.$disconnect();
}
