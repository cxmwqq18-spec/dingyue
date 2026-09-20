#!/usr/bin/env node

// Rebuild the EU video-topic copy from the English storefront. This script is
// intentionally source-preserving: it translates customer-facing strings in
// place, keeps the source section shape and card order, and retains the EU
// target's already-approved media, URLs, ids, and route data.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SOURCE_SITE_ID = "site_dreamshoot";
const TARGET_SITE_ID = "site_aidreamcapes_xby";
const TARGET_DOMAIN = "aidreamcapes.eu";
const apply = process.argv.includes("--apply") || process.argv.includes("--apply-local");
const BACKUP_ROOT = path.resolve(".tmp", "aidreamcapes-eu-video-french-copy");
const CACHE_PATH = path.join(BACKUP_ROOT, "translation-cache.json");
const DEDICATED_TYPES = new Set(["ai_video_topic_landing", "talking_photo_landing"]);
const STRUCTURAL_KEY = /^(?:id|siteId|themeId|pageId|sectionId|blockId|productId|priceId|categoryId|parentId|mediaId|assetId|slug|path|href|canonicalPath|url|previewUrl|originUrl|src|imageUrl|videoUrl|poster|posterUrl|thumbnail|thumbnailUrl|storageKey|filename|mimeType|contentType|sourceType|pageType|templateKey|routeKey|appSlug|sortOrder|position|order|status|currency|interval|type|provider|model|modelId|createdAt|updatedAt|width|height|fit)$/i;
const ASSET_OR_REFERENCE = /^(?:https?:|mailto:|\/|data:|site_|prod_|price_|page_|media_|tool_|pack_|video_|ai_)/i;
const COPY_SEPARATOR = "\n\n";
const MAX_BATCH_ITEMS = 10;
const MAX_BATCH_CHARS = 3600;
const BATCH_CONCURRENCY = 4;

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

function dedicatedSection(pageJson) {
  return Object.values(pageJson?.sections ?? {}).find((section) => DEDICATED_TYPES.has(section?.type));
}

function dedicatedSectionEntry(pageJson) {
  return Object.entries(pageJson?.sections ?? {}).find(([, section]) => DEDICATED_TYPES.has(section?.type));
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
    .replaceAll("www.aidreamcapes.com", "aidreamcapes.eu")
    .replaceAll("support@mydreamshoots.com", "support@aidreamcapes.eu")
    .replaceAll("mes shootings de rêves", "Aidreamcapes");
}

function normalizeFrenchTranslation(value) {
  return replaceTargetBrand(value)
    .replace(/\bAI Social Media Video Maker\b/gi, "Créateur de vidéos pour les réseaux sociaux avec IA")
    .replace(/\bSocial Media Video Maker\b/gi, "Créateur de vidéos pour les réseaux sociaux")
    .replace(/\bSocial Media Video\b/gi, "Vidéo pour les réseaux sociaux")
    .replace(/\bHow-to Video\b/gi, "Vidéo tutorielle")
    .replace(/\bStory Video\b/gi, "Vidéo narrative")
    .replace(/\bFood Video\b/gi, "Vidéo culinaire")
    .replace(/\bPet Video\b/gi, "Vidéo animalière")
    .replace(/\bSave the Date Video\b/gi, "Vidéo annonce de date")
    .replace(/\bSave the Date\b/gi, "Annoncez la date")
    .replace(/\bhow-to-(?:Video|Vidéo)\b/gi, "vidéo tutorielle")
    .replace(/\bstory-(?:Video|Vidéo)\b/gi, "vidéo narrative")
    .replace(/\bbrand-(?:Video|Vidéo)\b/gi, "vidéo de marque")
    .replace(/\bfood-(?:Video|Vidéo)\b/gi, "vidéo culinaire")
    .replace(/\bpet-(?:Video|Vidéo)\b/gi, "vidéo animalière")
    .replace(/\bAI Promo Video Maker\b/gi, "Créateur de vidéos promotionnelles avec IA")
    .replace(/\bPromo Video Maker\b/gi, "Créateur de vidéos promotionnelles")
    .replace(/\bImage to Video\b/gi, "Image vers vidéo")
    .replace(/\bText to Video\b/gi, "Texte vers vidéo")
    .replace(/\bTalking Head Video\b/gi, "Vidéo face caméra")
    .replace(/\bAvatar Video\b/gi, "Vidéo avatar")
    .replace(/\bBrand Video\b/gi, "Vidéo de marque")
    .replace(/\bFashion Video\b/gi, "Vidéo de mode")
    .replace(/\bMusic Video\b/gi, "Vidéo musicale")
    .replace(/\bVideo Ad\b/gi, "Publicité vidéo")
    .replace(/\bUGC Ad Video\b/gi, "Publicité UGC")
    .replace(/\bAd Video\b/gi, "Publicité vidéo")
    .replace(/\bAI Video\b/gi, "Vidéo IA")
    .replace(/\bAI Photo\b/gi, "Photo IA")
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
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) => collectCopyStrings(childValue, childKey, output));
  }
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
  const markers = values.map((_, index) => `[[[FR_COPY_${index}]]]`);
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
    result.set(values[index], normalizeFrenchTranslation(translated.slice(valueStart, nextMarker).trim()));
  }
  return result;
}

async function translateValues(values, cache) {
  const unique = [...new Set(values)].filter((value) => !cache[value]);
  const chunks = chunkValues(unique);
  for (let offset = 0; offset < chunks.length; offset += BATCH_CONCURRENCY) {
    const batchResults = await Promise.all(chunks.slice(offset, offset + BATCH_CONCURRENCY).map((chunk) => translateBatch(chunk)));
    for (const result of batchResults) for (const [source, translated] of result) cache[source] = translated;
    if (offset % (BATCH_CONCURRENCY * 5) === 0 || offset + BATCH_CONCURRENCY >= chunks.length) {
      console.log(`translated ${Math.min(offset + BATCH_CONCURRENCY, chunks.length)}/${chunks.length} copy batches`);
    }
    writeJson(CACHE_PATH, cache);
  }
  return cache;
}

function translateSourceValue(sourceValue, targetValue, key, cache) {
  if (typeof sourceValue === "string") {
    if (copyString(key, sourceValue)) return normalizeFrenchTranslation(cache[sourceValue] ?? sourceValue);
    return targetValue ?? sourceValue;
  }
  if (Array.isArray(sourceValue)) {
    return sourceValue.map((item, index) => translateSourceValue(item, targetValue?.[index], key, cache));
  }
  if (sourceValue && typeof sourceValue === "object") {
    const targetObject = targetValue && typeof targetValue === "object" && !Array.isArray(targetValue) ? targetValue : {};
    return Object.fromEntries(Object.entries(sourceValue).map(([childKey, childValue]) => [
      childKey,
      translateSourceValue(childValue, targetObject[childKey], childKey, cache)
    ]));
  }
  return targetValue ?? sourceValue;
}

function rebuildPageJson(sourceJson, targetJson, cache) {
  const sourceEntry = dedicatedSectionEntry(sourceJson);
  const targetEntry = dedicatedSectionEntry(targetJson);
  if (!sourceEntry || !targetEntry) return targetJson;
  const [sourceSectionId, sourceSection] = sourceEntry;
  const [targetSectionId, targetSection] = targetEntry;
  const next = clone(targetJson);
  next.seo = {
    ...(targetJson?.seo ?? {}),
    ...translateSourceValue(sourceJson?.seo ?? {}, targetJson?.seo ?? {}, "seo", cache)
  };
  next.seo.canonical = targetJson?.seo?.canonical ?? `https://${TARGET_DOMAIN}${next.seo.canonicalPath ?? ""}`;
  next.sections[targetSectionId] = {
    ...targetSection,
    settings: {
      ...(targetSection.settings ?? {}),
      content: translateSourceValue(sourceSection.settings?.content ?? {}, targetSection.settings?.content ?? {}, "content", cache)
    }
  };
  return next;
}

function copyPageTitle(sourcePage, cache) {
  return normalizeFrenchTranslation(cache[sourcePage.title] ?? sourcePage.title);
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const [sourceLive, targetLive, sourceTheme, targetTheme] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SOURCE_SITE_ID, slug: { startsWith: "/ai-video-generation/" } }, orderBy: { slug: "asc" } }),
      prisma.livePage.findMany({ where: { siteId: TARGET_SITE_ID, slug: { startsWith: "/ai-video-generation/" } }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: SOURCE_SITE_ID, slug: { startsWith: "/ai-video-generation/" } }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: TARGET_SITE_ID, slug: { startsWith: "/ai-video-generation/" } }, orderBy: { slug: "asc" } })
    ]);
    const sourceLiveBySlug = new Map(sourceLive.map((page) => [page.slug, page]));
    const targetLiveBySlug = new Map(targetLive.map((page) => [page.slug, page]));
    const sourceThemeBySlug = new Map(sourceTheme.map((page) => [page.slug, page]));
    const targetThemeBySlug = new Map(targetTheme.map((page) => [page.slug, page]));
    const slugs = [...new Set([...sourceLive, ...sourceTheme].filter((page) => dedicatedSection(page.contentJson ?? page.publishedJson)).map((page) => page.slug))].sort();
    assert(slugs.length >= 20, `expected at least 20 source video-topic pages, found ${slugs.length}`);
    const cache = readJsonIfPresent(CACHE_PATH, {});
    const values = [];
    for (const slug of slugs) {
      const sourceLivePage = sourceLiveBySlug.get(slug);
      const sourceThemePage = sourceThemeBySlug.get(slug);
      values.push(...collectCopyStrings(dedicatedSection(sourceLivePage?.contentJson)?.settings?.content ?? {}));
      values.push(...collectCopyStrings(sourceLivePage?.contentJson?.seo ?? {}));
      if (sourceLivePage?.title) values.push(sourceLivePage.title);
      values.push(...collectCopyStrings(dedicatedSection(sourceThemePage?.publishedJson)?.settings?.content ?? {}));
    }
    await translateValues(values, cache);
    const repairedLive = slugs.map((slug) => {
      const sourcePage = sourceLiveBySlug.get(slug);
      const targetPage = targetLiveBySlug.get(slug);
      assert(sourcePage && targetPage, `${slug}: source or target live page is missing`);
      return { slug, sourcePage, targetPage, contentJson: rebuildPageJson(sourcePage.contentJson, targetPage.contentJson, cache), title: copyPageTitle(sourcePage, cache) };
    });
    const repairedTheme = slugs.map((slug) => {
      const sourcePage = sourceThemeBySlug.get(slug);
      const targetPage = targetThemeBySlug.get(slug);
      assert(sourcePage && targetPage, `${slug}: source or target theme page is missing`);
      return { slug, sourcePage, targetPage, draftJson: rebuildPageJson(sourcePage.draftJson, targetPage.draftJson, cache), publishedJson: rebuildPageJson(sourcePage.publishedJson, targetPage.publishedJson, cache), title: copyPageTitle(sourcePage, cache) };
    });
    const report = {
      ok: true,
      mode: apply ? "apply-local" : "dry-run",
      sourceSiteId: SOURCE_SITE_ID,
      targetSiteId: TARGET_SITE_ID,
      pages: slugs.length,
      copyStrings: Object.keys(cache).length,
      changedLivePages: repairedLive.filter((row) => JSON.stringify(row.targetPage.contentJson) !== JSON.stringify(row.contentJson)).length,
      changedThemePages: repairedTheme.filter((row) => JSON.stringify(row.targetPage.draftJson) !== JSON.stringify(row.draftJson) || JSON.stringify(row.targetPage.publishedJson) !== JSON.stringify(row.publishedJson)).length,
      providerCalls: 0,
      translationService: "Google Translate Chrome endpoint"
    };
    if (apply) {
      const backupPath = path.join(BACKUP_ROOT, `backup-before-source-copy-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, {
        livePages: targetLive.map((row) => ({ id: row.id, slug: row.slug, title: row.title, contentJson: row.contentJson })),
        themePages: targetTheme.map((row) => ({ id: row.id, slug: row.slug, title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson }))
      });
      await prisma.$transaction(async (tx) => {
        for (const row of repairedLive) await tx.livePage.update({ where: { id: row.targetPage.id }, data: { title: row.title, contentJson: row.contentJson } });
        for (const row of repairedTheme) await tx.themePage.update({ where: { id: row.targetPage.id }, data: { title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson } });
      }, { maxWait: 20_000, timeout: 120_000 });
      report.backupPath = backupPath;
    }
    const reportPath = path.join(BACKUP_ROOT, `report-source-copy-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
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
