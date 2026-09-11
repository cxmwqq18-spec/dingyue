#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SITE_ID = "site_aidreamcapes_xby";
const PRIMARY_DOMAIN = "aidreamcapes.eu";
const WWW_DOMAIN = "www.aidreamcapes.eu";
const SOURCE_SITE_ID = "site_dreamshoot";
const expectedAssetPrefix = "/assets/sites/site_aidreamcapes_eu/";
const expectedHomepageVideoSlugs = [
  "talking-photo",
  "cinematic-video",
  "music-video",
  "tiktok-video",
  "instagram-reels",
  "product-video",
  "product-ad-video",
  "promo-video"
];
const expectedHomepageImageSlugs = [
  "engagement",
  "wedding-photo",
  "valentine-photos",
  "christmas-photos",
  "halloween-party-photos",
  "thanksgiving-group-photos",
  "profile-cards",
  "professional-headshots"
];
const excludedFooterHrefs = new Set(["/workflow", "/pricing"]);
const scopeManifestArg = process.argv.find((arg) => arg.startsWith("--scope-manifest="))?.slice("--scope-manifest=".length);
const failures = [];
const warnings = [];

function fail(message, detail) { failures.push(detail ? { message, detail } : { message }); }
function warn(message, detail) { warnings.push(detail ? { message, detail } : { message }); }
const nonCopyKeyPattern = /(?:^|\.)(?:id|siteId|themeId|pageId|sectionId|blockId|productId|priceId|categoryId|parentId|mediaId|assetId|slug|path|canonicalPath|href|url|previewUrl|originUrl|src|imageUrl|videoUrl|thumbnailUrl|storageKey|filename|mimeType|contentType|sourceType|pageType|templateKey|routeKey|appSlug|sortOrder|position|order|status|currency|interval|type|provider|model|modelId|createdAt|updatedAt)(?:\.|$|\[)/i;
function isInspectableCopyString(key, value) {
  if (nonCopyKeyPattern.test(key)) return false;
  const trimmed = value.trim();
  return !/^(?:https?:|mailto:|\/|site_|prod_|price_|page_|media_|tool_|pack_|video_|ai_)/i.test(trimmed);
}
function collectStrings(value, key = "$", out = []) {
  if (typeof value === "string") { out.push({ key, value }); return out; }
  if (Array.isArray(value)) { value.forEach((item, index) => collectStrings(item, `${key}[${index}]`, out)); return out; }
  if (value && typeof value === "object") Object.entries(value).forEach(([entryKey, item]) => collectStrings(item, `${key}.${entryKey}`, out));
  return out;
}

try {
  const site = await prisma.site.findUnique({
    where: { id: SITE_ID },
    include: {
      domains: true,
      settings: true,
      storefrontProfile: true,
      livePages: { orderBy: { slug: "asc" } },
      pages: { orderBy: { slug: "asc" } },
      products: { include: { prices: true } },
      creativePackCategories: true,
      creativePacks: true,
      toolCategories: true,
      toolMenuItems: true,
      videoThemeCategories: true,
      videoThemes: true,
      videoThemeExamples: true,
      mediaAssets: true,
      siteThemes: true
    }
  });
  if (!site) throw new Error(`missing_${SITE_ID}`);
  const source = await prisma.site.findUnique({
    where: { id: SOURCE_SITE_ID },
    include: { livePages: true, pages: true, siteThemes: true }
  });
  if (!source) throw new Error(`missing_${SOURCE_SITE_ID}`);
  if (site.slug !== "aidreamcapes-eu") fail("target slug is not aidreamcapes-eu", site.slug);
  if (site.primaryDomain !== PRIMARY_DOMAIN) fail("target primary domain is not aidreamcapes.eu", site.primaryDomain);
  const primary = site.domains.find((domain) => domain.domain === PRIMARY_DOMAIN);
  const www = site.domains.find((domain) => domain.domain === WWW_DOMAIN);
  if (!primary || primary.status !== "active" || !primary.isPrimary) fail("aidreamcapes.eu domain row is not active primary", primary);
  if (!www || www.status !== "active" || www.isPrimary) fail("www.aidreamcapes.eu domain row is not active secondary", www);

  const publicRows = (rows) => rows.filter((row) => row.status !== "inactive");
  const publicProducts = site.products.filter((row) => row.status === "active");
  const publicPayload = [site.branding, site.settings?.publishedJson, site.storefrontProfile?.publishedJson, site.livePages, site.pages, publicProducts, publicRows(site.creativePackCategories), publicRows(site.creativePacks), publicRows(site.toolCategories), publicRows(site.toolMenuItems), publicRows(site.videoThemeCategories), publicRows(site.videoThemes), publicRows(site.videoThemeExamples), site.mediaAssets];
  for (const { key, value } of collectStrings(publicPayload)) {
    if (/prompt|providerConfig|modelPricing|storageKey|createdBy|\.varin$|^\$\.site\.id/i.test(key) || !isInspectableCopyString(key, value)) continue;
    if (/mydreamshoots|site_dreamshoot|www\.aidreamcapes\.com|support@mydreamshoots\.com/i.test(value)) fail("public target payload leaks source brand/domain", { key, value: value.slice(0, 180) });
    if (/[\u3400-\u9fff]/.test(value)) fail("public target payload contains Chinese copy", { key, value: value.slice(0, 180) });
    if (/\b(?:los|las|para|desde|con|privada|fotos|creditos|galeria|sube|elige|como funciona|precios)\b/i.test(value)) fail("public target payload contains Spanish copy", { key, value: value.slice(0, 180) });
    if (/\b(?:the|your|from|with|private|gallery|credits|upload|choose|pricing|how it works|sign in|start creating)\b/i.test(value) && !/^https?:\/\//i.test(value)) warn("possible English copy remains", { key, value: value.slice(0, 180) });
  }

  for (const asset of site.mediaAssets) {
    for (const url of [asset.previewUrl, asset.originUrl].filter(Boolean)) {
      if (!String(url).startsWith(expectedAssetPrefix)) fail("target media is outside eu namespace", { id: asset.id, url });
      const filePath = path.join(process.cwd(), "public", String(url).split("?")[0].replace(/^\//, ""));
      if (!fs.existsSync(filePath)) fail("target media file is missing", { id: asset.id, url });
    }
  }

  function pageShape(pageJson) {
    const sections = pageJson?.sections ?? {};
    return {
      sectionsOrder: Array.isArray(pageJson?.sectionsOrder) ? pageJson.sectionsOrder : Object.keys(sections),
      sections: Object.fromEntries(Object.entries(sections).map(([id, section]) => [id, {
        type: section?.type ?? null,
        blockIds: Array.isArray(section?.blocks) ? section.blocks.map((block) => block?.id ?? null) : [],
        blockCount: Array.isArray(section?.blocks) ? section.blocks.length : 0
      }]))
    };
  }
  function homepageThemeTemplate(theme) {
    const templates = theme?.templates ?? {};
    return templates.index ?? templates.home ?? templates["/"] ?? templates;
  }
  function homepageThemePayload(theme) {
    const template = homepageThemeTemplate(theme);
    return { sectionsOrder: template?.sectionsOrder, sections: template?.sections, seo: template?.seo };
  }
  const sourceLiveHome = source.livePages.find((row) => row.slug === "/");
  const targetLiveHome = site.livePages.find((row) => row.slug === "/");
  const sourceThemeHome = source.pages.find((row) => row.slug === "/");
  const targetThemeHome = site.pages.find((row) => row.slug === "/");
  if (!sourceLiveHome || !targetLiveHome || !sourceThemeHome || !targetThemeHome) {
    fail("source or target homepage rows are missing", {
      sourceLive: Boolean(sourceLiveHome), targetLive: Boolean(targetLiveHome), sourceTheme: Boolean(sourceThemeHome), targetTheme: Boolean(targetThemeHome)
    });
  } else {
    const liveShape = { source: pageShape(sourceLiveHome.contentJson), target: pageShape(targetLiveHome.contentJson) };
    if (JSON.stringify(liveShape.source) !== JSON.stringify(liveShape.target)) fail("live homepage structure differs from MyDreamShoots", liveShape);
    const themeShape = {
      draft: { source: pageShape(sourceThemeHome.draftJson), target: pageShape(targetThemeHome.draftJson) },
      published: { source: pageShape(sourceThemeHome.publishedJson), target: pageShape(targetThemeHome.publishedJson) }
    };
    if (JSON.stringify(themeShape.draft.source) !== JSON.stringify(themeShape.draft.target)) fail("draft homepage structure differs from MyDreamShoots", themeShape.draft);
    if (JSON.stringify(themeShape.published.source) !== JSON.stringify(themeShape.published.target)) fail("published homepage structure differs from MyDreamShoots", themeShape.published);

    const homepageSlugs = (pageJson, key) => {
      const value = pageJson?.sections?.generation_showcase_1?.settings?.[key];
      return (Array.isArray(value) ? value : String(value ?? "").split(/[|,\n]/))
        .map((slug) => String(slug).trim())
        .filter(Boolean);
    };
    for (const [label, pageJson] of [
      ["live", targetLiveHome.contentJson],
      ["draft", targetThemeHome.draftJson],
      ["published", targetThemeHome.publishedJson]
    ]) {
      const actual = homepageSlugs(pageJson, "videoSlugs");
      if (JSON.stringify(actual) !== JSON.stringify(expectedHomepageVideoSlugs)) {
        fail("EU homepage video data is not aligned with the MyDreamShoots showcase order", { label, expected: expectedHomepageVideoSlugs, actual });
      }
      const actualImages = homepageSlugs(pageJson, "imageSlugs");
      if (JSON.stringify(actualImages) !== JSON.stringify(expectedHomepageImageSlugs)) {
        fail("EU homepage image data is not aligned with the MyDreamShoots showcase order", { label, expected: expectedHomepageImageSlugs, actual: actualImages });
      }
    }
  }
  for (const sourceTheme of source.siteThemes) {
    const targetTheme = site.siteThemes.find((candidate) => candidate.status === sourceTheme.status);
    if (!targetTheme) {
      fail("target theme is missing for source theme status", { status: sourceTheme.status });
      continue;
    }
    const sourceShape = pageShape(homepageThemeTemplate(sourceTheme));
    const targetShape = pageShape(homepageThemeTemplate(targetTheme));
    if (JSON.stringify(sourceShape) !== JSON.stringify(targetShape)) fail("EU theme homepage template structure differs from MyDreamShoots", { status: sourceTheme.status, source: sourceShape, target: targetShape });
  }

  const homepagePayload = [
    targetLiveHome?.contentJson,
    targetThemeHome?.draftJson,
    targetThemeHome?.publishedJson,
    ...site.siteThemes.map((theme) => homepageThemePayload(theme)),
    site.settings?.publishedJson?.globalSections,
    site.settings?.publishedJson?.seo?.pages?.site_aidreamcapes_xby_home
  ];
  const footerPayloads = [
    site.settings?.publishedJson?.globalSections?.footer,
    site.settings?.publishedJson?.saasSettingsCurrent?.sections?.footer_plus
  ];
  for (const footer of footerPayloads) {
    for (const block of footer?.blocks ?? []) {
      const href = String(block?.settings?.href ?? "").split(/[?#]/)[0];
      if (excludedFooterHrefs.has(href)) fail("EU footer still contains an excluded menu link", { href, blockId: block?.id });
    }
  }
  const homepageAssetRefs = new Set();
  for (const { value } of collectStrings(homepagePayload)) {
    for (const match of String(value).matchAll(/\/(?:assets|sites)\/[^?#\s"'<>|]+/g)) homepageAssetRefs.add(match[0]);
  }
  const homepageAssetLeaks = [...homepageAssetRefs].filter((url) => !url.startsWith(expectedAssetPrefix));
  if (homepageAssetLeaks.length) fail("homepage contains non-EU asset references", homepageAssetLeaks.slice(0, 30));
  for (const url of homepageAssetRefs) {
    if (!url.startsWith(expectedAssetPrefix)) continue;
    const filePath = path.join(process.cwd(), "public", url.split("?")[0].replace(/^\//, ""));
    if (!fs.existsSync(filePath)) fail("homepage asset file is missing", url);
  }
  const homepageCopy = collectStrings(homepagePayload).filter(({ key, value }) => isInspectableCopyString(key, value));
  for (const { key, value } of homepageCopy) {
    const languageValue = value
      .replace(/::\/[^|\s]+/g, "")
      .replace(/\/(?:ai|app|best|pricing|workflow|login|contact-us|content|terms|privacy|refunds|cookies)[^\s|]*/gi, "")
      .replace(/\bSave the Date\b/gi, "")
      .replace(/\bAIdreamcapes\b/gi, "");
    if (/mydreamshoots|site_dreamshoot|www\.aidreamcapes\.com|support@mydreamshoots\.com/i.test(languageValue)) fail("homepage leaks source brand/domain", { key, value: value.slice(0, 180) });
    if (/[㐀-鿿]/.test(languageValue)) fail("homepage contains Chinese copy", { key, value: value.slice(0, 180) });
    if (/\b(?:los|las|para|desde|con|privada|fotos|creditos|galeria|sube|elige|como funciona|precios)\b/i.test(languageValue)) fail("homepage contains Spanish copy", { key, value: value.slice(0, 180) });
    if (/\b(?:create|your|from|with|the|and|choose|upload|start|view|watch|how it works|what|can i|private|gallery|credits|pricing|customer|customers|download|all rights reserved|photo sets|video generators|image generators|best packages|contact us|about us|privacy policy|refund policy|cookie policy|terms of service)\b/i.test(languageValue)) fail("homepage contains obvious English copy", { key, value: value.slice(0, 180) });
  }
  const counts = {
    livePages: site.livePages.length,
    themePages: site.pages.length,
    products: publicProducts.length,
    prices: publicProducts.reduce((sum, product) => sum + product.prices.filter((price) => price.status === "active").length, 0),
    creativePackCategories: site.creativePackCategories.filter((row) => row.status !== "inactive").length,
    creativePacks: site.creativePacks.filter((row) => row.status !== "inactive").length,
    toolCategories: site.toolCategories.filter((row) => row.status !== "inactive").length,
    toolMenuItems: site.toolMenuItems.filter((row) => row.status !== "inactive").length,
    videoThemeCategories: site.videoThemeCategories.filter((row) => row.status !== "inactive").length,
    videoThemes: site.videoThemes.filter((row) => row.status !== "inactive").length,
    videoThemeExamples: site.videoThemeExamples.filter((row) => row.status !== "inactive").length,
    mediaAssets: site.mediaAssets.length
  };
  if (scopeManifestArg) {
    try {
      const scopeManifest = JSON.parse(fs.readFileSync(scopeManifestArg, "utf8"));
      if (scopeManifest.sourceSiteId !== SOURCE_SITE_ID || scopeManifest.targetSiteId !== SITE_ID) fail("scope manifest targets are incorrect", { sourceSiteId: scopeManifest.sourceSiteId, targetSiteId: scopeManifest.targetSiteId });
      if (Array.isArray(scopeManifest.otherSiteChanges) && scopeManifest.otherSiteChanges.length) fail("scope manifest reports changes outside the EU target", scopeManifest.otherSiteChanges);
      if (scopeManifest.before?.[SOURCE_SITE_ID] && scopeManifest.after?.[SOURCE_SITE_ID] && JSON.stringify(scopeManifest.before[SOURCE_SITE_ID]) !== JSON.stringify(scopeManifest.after[SOURCE_SITE_ID])) fail("source MyDreamShoots scope changed", { before: scopeManifest.before[SOURCE_SITE_ID], after: scopeManifest.after[SOURCE_SITE_ID] });
      for (const [siteId, before] of Object.entries(scopeManifest.before ?? {})) {
        if ([SITE_ID, SOURCE_SITE_ID].includes(siteId)) continue;
        if (JSON.stringify(before) !== JSON.stringify(scopeManifest.after?.[siteId])) fail("non-target site scope changed", { siteId, before, after: scopeManifest.after?.[siteId] });
      }
    } catch (error) {
      fail("scope manifest could not be read", { path: scopeManifestArg, error: error instanceof Error ? error.message : String(error) });
    }
  } else {
    warn("scope manifest not supplied; run the audit with --scope-manifest=<sync scope file> for before/after isolation verification");
  }
  console.log(JSON.stringify({ ok: failures.length === 0, siteId: SITE_ID, locale: "fr-FR", domains: site.domains.map((row) => ({ domain: row.domain, status: row.status, isPrimary: row.isPrimary })), counts, warnings, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
