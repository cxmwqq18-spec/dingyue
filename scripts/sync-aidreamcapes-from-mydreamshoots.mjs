#!/usr/bin/env node

import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, buildTunneledDatabaseUrl } from "./lib/database-target.mjs";

const SOURCE_SITE_ID = "site_dreamshoot";
const TARGET_SITE_ID = "site_aidreamcapes";
const TARGET_SLUG = "aidreamcapes";
const TARGET_DOMAIN = "www.aidreamcapes.com";
const TARGET_LOGO = "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c";
const SUPPORT_EMAIL = "support@aidreamcapes.com";
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
const targetId = (kind, sourceId) => `aidreamcapes_mirror_${kind}_${sha(sourceId)}`;
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
  const targetRelative = `assets/sites/site_aidreamcapes/mirror/aidreamcapes/${publicPrefix}${tail}`
    .replace(/mydreamshoots/gi, "aidreamcapes")
    .replace(/site_dreamshoot/gi, "aidreamcapes");
  return { sourceFile, targetRelative, targetUrl: `/${targetRelative}${query}`, sourceValue: value };
}

const copiedAssets = new Map();
const missingAssets = new Set();
function ensureAssetMirror(sourceFile, destination) {
  if (fsSync.existsSync(destination)) return;
  try {
    if (fsSync.lstatSync(destination)) return;
  } catch {
    // The destination does not exist yet.
  }
  fsSync.mkdirSync(path.dirname(destination), { recursive: true });
  fsSync.symlinkSync(path.relative(path.dirname(destination), sourceFile), destination);
}
function transformJsonSync(value) {
  if (typeof value === "string") {
    let next = value;
    for (const sourceMap of idMaps.values()) for (const [sourceId, targetValue] of sourceMap.entries()) if (next === sourceId) next = targetValue;
    const assetMatches = [...next.matchAll(/(?:\/?assets\/dreamshoot|\/?assets\/sites\/site_dreamshoot|\/?sites\/site_dreamshoot)\/[^?#|\s"'<>]+(?:\?[^#|\s"'<>]+)?/g)];
    for (const match of assetMatches) {
      const descriptor = sourceAssetDescriptor(match[0]);
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
      .replaceAll("mydreamshoots.com", "aidreamcapes.com")
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
    return next;
  }
  if (Array.isArray(value)) return value.map(transformJsonSync);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [transformJsonSync(key), transformJsonSync(item)]));
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
    const id = pageIds.get(slug) ?? targetId("page", slug);
    sourceIdMap("page", row.id, id);
  }
  for (const row of source.themePages) {
    const slug = targetPageSlug(row.slug);
    const id = pageIds.get(slug) ?? targetId("page", slug);
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

function buildPageRows(source, target) {
  const livePages = [];
  const themePages = [];
  const targetLiveBySlug = new Map(target.livePages.map((row) => [row.slug, row]));
  const targetThemeBySlug = new Map(target.themePages.map((row) => [row.slug, row]));
  for (const row of source.livePages) {
    const slug = targetPageSlug(row.slug);
    const id = targetLiveBySlug.get(slug)?.id ?? mappedId(row.id);
    livePages.push({
      id,
      siteId: TARGET_SITE_ID,
      pageType: row.pageType,
      templateKey: row.templateKey,
      slug,
      title: transformJsonSync(row.title),
      contentJson: transformJsonSync(row.contentJson)
    });
  }
  const videoRoot = sourcePageBySlug(source, "/ai-video-generation");
  if (videoRoot && !livePages.some((row) => row.slug === "/tools")) {
    const contentJson = transformJsonSync(videoRoot.contentJson);
    contentJson.seo = { ...(contentJson.seo ?? {}), canonicalPath: "/tools" };
    livePages.push({ id: targetLiveBySlug.get("/tools")?.id ?? targetId("page", "alias-tools"), siteId: TARGET_SITE_ID, pageType: videoRoot.pageType, templateKey: videoRoot.templateKey, slug: "/tools", title: "AI Video Generation", contentJson });
  }
  for (const row of source.themePages) {
    const slug = targetPageSlug(row.slug);
    const id = targetThemeBySlug.get(slug)?.id ?? mappedId(row.id);
    themePages.push({
      id,
      siteId: TARGET_SITE_ID,
      pageType: row.pageType,
      templateKey: row.templateKey,
      slug,
      title: transformJsonSync(row.title),
      draftJson: transformJsonSync(row.draftJson),
      publishedJson: transformJsonSync(row.publishedJson),
      draftMeta: clone(row.draftMeta)
    });
  }
  if (videoRoot && !themePages.some((row) => row.slug === "/tools")) {
    const sourceTheme = source.themePages.find((row) => row.slug === "/ai-video-generation");
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
      title: "Aidreamcapes",
      logoAlt: "Aidreamcapes logo for AI photo and video creation",
      logoImageUrl: TARGET_LOGO,
      ctaHref: "/app/create",
      ctaLabel: "Start Creating"
    };
    const footer = settings.globalSections.footer.settings ?? {};
    settings.globalSections.footer.settings = {
      ...footer,
      title: "Aidreamcapes",
      logoAlt: "Aidreamcapes logo for AI photo and video creation",
      logoImageUrl: TARGET_LOGO,
      companyName: "Aidreamcapes.com",
      contactEmail: SUPPORT_EMAIL,
      salesEmail: "",
      contactPhone: "",
      contactAddress: "",
      copyright: "© 2026 Aidreamcapes.com. All rights reserved.",
      instagramUrl: "https://www.instagram.com/aidreamcapes",
      facebookUrl: "https://www.facebook.com/aidreamcapes",
      threadsUrl: "",
      pinterestUrl: "https://www.pinterest.com/aidreamcapes",
      youtubeUrl: "https://www.youtube.com/@aidreamcapes",
      twitterUrl: "https://x.com/aidreamcapes",
      xUrl: "https://x.com/aidreamcapes",
      tiktokUrl: ""
    };
  }
  return { draftJson: nextDraft, publishedJson: nextPublished };
}

function buildProfile(source) {
  const policyFacts = clone(source.profile?.publishedJson?.policyFacts ?? source.profile?.draftJson?.policyFacts ?? {});
  const identity = {
    sameAs: [],
    legalName: "BLYDEYUS INC",
    entityType: "company",
    supportEmail: SUPPORT_EMAIL,
    phone: "(+1)307-310-3014",
    address: {
      line1: "30 N GOULD ST STE R",
      city: "SHERIDAN",
      region: "WY",
      postalCode: "82801",
      country: "US"
    }
  };
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
      templates: transformJsonSync(row.templates),
      settings: transformJsonSync(row.settings),
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
        status: existing?.status ?? "draft",
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
  return { products, prices };
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
    prompt: transformJsonSync(row.prompt),
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
    prompt: transformJsonSync(row.prompt),
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
    prompt: transformJsonSync(row.prompt),
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: new Date()
  }));
  const media = source.media.map((row) => {
    const storage = sourceAssetDescriptor(row.storageKey) ?? sourceAssetDescriptor(row.previewUrl ?? row.originUrl);
    const storageQuery = String(row.storageKey ?? "").includes("?") ? String(row.storageKey).slice(String(row.storageKey).indexOf("?")) : "";
    const targetStorageKey = storage ? `${storage.targetRelative.replace(/^assets\//, "")}${storageQuery}` : `sites/site_aidreamcapes/mirror/aidreamcapes/${String(row.storageKey).replace(/^\/+/, "")}`;
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
  return { categories, packs, videoCategories, videos, examples, media };
}

function summarize(source, target, pages, publicRows, products) {
  return {
    source: {
      siteId: SOURCE_SITE_ID,
      livePages: source.livePages.length,
      themePages: source.themePages.length,
      packCategories: source.packCategories.length,
      packs: source.packs.length,
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

async function applyState(prisma, source, target, pages, settings, profile, themes, products, publicRows) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Site" WHERE "id" = ${TARGET_SITE_ID} FOR UPDATE`;
    await tx.site.update({ where: { id: TARGET_SITE_ID }, data: {
      name: "Aidreamcapes",
      primaryDomain: TARGET_DOMAIN,
      currency: source.site.currency,
      signupCreditGrant: source.site.signupCreditGrant,
      branding: {
        logoText: "Aidreamcapes",
        logoImageUrl: TARGET_LOGO,
        market: "AI video, photo, Save the Date, and private gallery creation",
        description: "Aidreamcapes is a private AI video and photo workspace for themed generation, creative tools, credits, and private gallery delivery."
      }
    }});
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
    for (const row of themes) {
      await tx.siteTheme.upsert({ where: { id: row.id }, create: row, update: { name: row.name, themeId: row.themeId, themeKey: row.themeKey, status: row.status, templates: row.templates, settings: row.settings, source: row.source, createdBy: row.createdBy } });
    }
    await tx.toolMenuItem.updateMany({ where: { siteId: TARGET_SITE_ID }, data: { status: "inactive" } });
    await tx.toolCategory.updateMany({ where: { siteId: TARGET_SITE_ID }, data: { status: "inactive" } });
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
    await tx.mediaAsset.deleteMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: targetMediaIds } } });
    for (const product of products.products) {
      await tx.product.upsert({ where: { id: product.id }, create: product, update: { name: product.name, type: product.type, status: product.status, metadata: product.metadata } });
    }
    await tx.product.updateMany({ where: { siteId: TARGET_SITE_ID, id: { notIn: products.products.map((row) => row.id) }, type: "credit_pack" }, data: { status: "inactive" } });
    for (const price of products.prices) {
      await tx.price.upsert({ where: { id: price.id }, create: price, update: { productId: price.productId, label: price.label, amountCents: price.amountCents, currency: price.currency, interval: price.interval, creditsGranted: price.creditsGranted, metadata: price.metadata } });
    }
    const desiredPriceIds = new Set(products.prices.map((row) => row.id));
    for (const oldPrice of target.products.flatMap((row) => row.prices)) {
      if (!desiredPriceIds.has(oldPrice.id)) await tx.price.update({ where: { id: oldPrice.id }, data: { status: "draft" } });
    }
  }, { timeout: 600000, maxWait: 20000 });
}

async function main() {
  const prisma = new PrismaClient();
  const backupPath = path.join(repoRoot, "releases", "backups", `aidreamcapes-before-mydreamshoots-sync-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  try {
    const [source, targetState] = await Promise.all([readSource(prisma), readTarget(prisma)]);
    registerMappings(source, targetState);
    const pages = buildPageRows(source, targetState);
    const settings = buildSettings(source);
    const profile = buildProfile(source);
    const themes = buildSiteThemes(source, targetState);
    const products = buildProducts(source, targetState);
    const publicRows = buildPublicRows(source);
    const summary = summarize(source, targetState, pages, publicRows, products);
    if (apply) {
      await backupTarget(prisma, backupPath);
      await applyState(prisma, source, targetState, pages, settings, profile, themes, products, publicRows);
    }
    console.log(JSON.stringify({
      ok: true,
      mode: apply ? "applied" : "dry-run",
      target,
      sourceSiteId: SOURCE_SITE_ID,
      targetSiteId: TARGET_SITE_ID,
      backupPath: apply ? backupPath : null,
      copiedAssets: copiedAssets.size,
      missingAssets: [...missingAssets].slice(0, 30),
      missingAssetCount: missingAssets.size,
      summary,
      protectedTables: ["Customer", "CustomerProfile", "CustomerSession", "Subscription", "Order", "PaymentEvent", "CreditLedger", "CreditBalance", "GenerationJob", "AssetUpload", "Album", "CustomerAssetDownload", "SiteAdmin", "SiteAdminSession", "SiteApiKey", "AiGatewayGroup"]
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
