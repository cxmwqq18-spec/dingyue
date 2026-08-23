#!/usr/bin/env node
import "./load-runtime-env.mjs";
import { createHash } from "node:crypto";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, hasArgument, parseDatabaseUrl } from "./lib/database-target.mjs";

const runtimeDatabaseUrl = process.env.DATABASE_URL;
const targetUrl = argumentValue("--target-url") || runtimeDatabaseUrl;
const sourceUrl = argumentValue("--source-url") || runtimeDatabaseUrl;
const sourceSiteId = argumentValue("--source-site") || "site_dreamshoot";
const targetSiteId = argumentValue("--target-site") || (process.env.DATABASE_TARGET === "production" ? "site_dreamshoot" : "site_grownstride_test");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
const confirmPhrase = "sync-mydreamshoots-public-sql";
const apply = hasArgument("--apply");
const allowSameSite = hasArgument("--allow-same-site");
const noIndex = argumentValue("--noindex") !== "false" && target !== "production";

if (!target) throw new Error("--target=test|production is required");
if (argumentValue("--target-url")) {
  if (!hasArgument("--bridge")) throw new Error("A custom target URL requires --bridge.");
  const parsed = parseDatabaseUrl(targetUrl);
  if (parsed.port === 15433 || parsed.database === "dingyue_local") throw new Error("The SQL bridge target cannot be the isolated local database.");
} else {
  assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: target === "production", productionConfirmed: hasArgument("--confirm-production") });
}
if (target === "test" && targetSiteId !== "site_grownstride_test") throw new Error("Test sync must target site_grownstride_test.");
if (target === "production" && targetSiteId !== "site_dreamshoot") throw new Error("Production sync must target site_dreamshoot.");

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  // Mirror Next's TypeScript-first alias resolution. Some source modules have a
  // JSON data file beside the TS module and Node would otherwise select JSON.
  const aliasedRequest = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  const resolvedRequest = request.startsWith("@/") && !path.extname(aliasedRequest)
    ? `${aliasedRequest}.ts`
    : aliasedRequest;
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};
process.env.DATABASE_URL = targetUrl;
const jiti = createJiti(import.meta.url);
const { buildPublicationSnapshot, publishSeoSnapshotRelational } = jiti("../src/lib/stores/theme-store.ts");
const { mapProduct, toSite } = jiti("../src/lib/stores/prisma-mappers.ts");
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const prisma = new PrismaClient({ datasources: { db: { url: targetUrl } } });
const sourcePrisma = new PrismaClient({ datasources: { db: { url: sourceUrl } } });

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function slugKey(value) { return String(value ?? "").trim().toLowerCase(); }
function stableKey(parts) { return parts.map((part) => slugKey(part)).join("|"); }
function generatedId(prefix, key) { return `${prefix}_${createHash("sha1").update(`${prefix}:${key}`).digest("hex").slice(0, 18)}`; }
function targetDomain() { return target === "production" ? "www.mydreamshoots.com" : "test.grownstride.com"; }
function rewriteText(value, source) {
  if (typeof value !== "string") return value;
  const sourceDomain = source.primaryDomain || "www.mydreamshoots.com";
  return value
    .replaceAll(`https://${sourceDomain}`, `https://${targetDomain()}`)
    .replaceAll(`http://${sourceDomain}`, `https://${targetDomain()}`)
    .replaceAll(sourceDomain, targetDomain())
    .replaceAll("/site/mydreamshoots", targetSiteId === "site_dreamshoot" ? "/site/mydreamshoots" : "/site/grownstride");
}
function remapJson(value, maps, source) {
  if (Array.isArray(value)) return value.map((item) => remapJson(item, maps, source));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [rewriteText(maps.ids.get(key) || key, source), remapJson(item, maps, source)]));
  if (typeof value === "string") return rewriteText(maps.ids.get(value) || value, source).replaceAll(source.id, targetSiteId);
  return value;
}
function applyNoIndex(value) {
  if (!noIndex || !value || typeof value !== "object" || Array.isArray(value)) return value;
  const next = clone(value);
  const seo = next.seo;
  if (seo && typeof seo === "object" && !Array.isArray(seo)) {
    seo.index = false;
    seo.follow = seo.follow ?? true;
    seo.robots = { ...(seo.robots || {}), index: false, follow: seo.robots?.follow ?? seo.follow };
    if (seo.pages && typeof seo.pages === "object" && !Array.isArray(seo.pages)) Object.values(seo.pages).forEach((item) => { if (item && typeof item === "object") { item.index = false; item.robots = { ...(item.robots || {}), index: false, follow: item.robots?.follow ?? true }; } });
  }
  return next;
}
function publicJson(value, maps, source) { return applyNoIndex(remapJson(value, maps, source)); }
function storageKey(value) {
  const raw = String(value || "");
  return target === "test" ? raw.replaceAll("sites/site_dreamshoot", "sites/site_grownstride_test") : raw.replaceAll("sites/site_grownstride_test", "assets/dreamshoot").replaceAll("sites/site_dreamshoot", "assets/dreamshoot");
}

async function readSite(id, client = prisma) {
  return client.site.findUnique({
    where: { id },
    include: {
      pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true,
      activePublication: { include: { publication: true } },
      siteThemes: { orderBy: [{ status: "asc" }, { updatedAt: "desc" }] }, themeCopies: { orderBy: { updatedAt: "desc" } },
      creativePackCategories: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] },
      creativePacks: { include: { categoryRecord: true }, orderBy: { createdAt: "asc" } }, mediaAssets: { orderBy: { storageKey: "asc" } },
      toolCategories: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }, toolMenuItems: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      videoThemeCategories: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }, videoThemes: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      products: { include: { prices: true }, orderBy: { name: "asc" } }
    }
  });
}

function mapsFor(source, targetSite) {
  const ids = new Map([[source.id, targetSiteId]]);
  const mapRows = (sourceRows, targetRows, key, prefix) => {
    const existing = new Map(targetRows.map((row) => [key(row), row.id]));
    const usedIds = new Set(targetRows.map((row) => row.id));
    sourceRows.forEach((row) => {
      const matchedId = existing.get(key(row));
      if (matchedId) {
        ids.set(row.id, matchedId);
        return;
      }
      let candidate = generatedId(prefix, key(row));
      if (usedIds.has(candidate)) candidate = generatedId(`${prefix}_sync`, key(row));
      usedIds.add(candidate);
      ids.set(row.id, candidate);
    });
  };
  mapRows(source.creativePackCategories, targetSite.creativePackCategories, (row) => slugKey(row.slug), "cpc");
  mapRows(source.creativePacks, targetSite.creativePacks, (row) => stableKey([row.categoryRecord?.slug || row.category, row.name]), "pack");
  mapRows(source.mediaAssets, targetSite.mediaAssets, (row) => storageKey(row.storageKey), "media");
  mapRows(source.toolCategories, targetSite.toolCategories, (row) => slugKey(row.slug), "toolcat");
  mapRows(source.toolMenuItems, targetSite.toolMenuItems, (row) => slugKey(row.slug), "tool");
  mapRows(source.videoThemeCategories, targetSite.videoThemeCategories, (row) => slugKey(row.slug), "videocat");
  mapRows(source.videoThemes, targetSite.videoThemes, (row) => slugKey(row.slug), "video");
  mapRows(source.pages, targetSite.pages, (row) => row.slug, "page");
  mapRows(source.siteThemes, targetSite.siteThemes, (row) => stableKey([row.themeKey, row.status]), "theme");
  const targetThemeIds = new Map(targetSite.siteThemes.map((row) => [stableKey([row.themeKey, row.status]), row.themeId]));
  source.siteThemes.forEach((row) => ids.set(row.themeId, targetThemeIds.get(stableKey([row.themeKey, row.status])) || generatedId("theme_id", stableKey([row.themeKey, row.status]))));
  mapRows(source.themeCopies, targetSite.themeCopies, (row) => stableKey([row.themeKey, row.name]), "theme_copy");
  const products = new Map(targetSite.products.map((row) => [stableKey([row.name, row.type]), row]));
  source.products.forEach((product) => {
    const existing = products.get(stableKey([product.name, product.type]));
    ids.set(product.id, existing?.id || generatedId("prod", stableKey([product.name, product.type])));
    const prices = new Map((existing?.prices || []).map((row) => [stableKey([row.label, row.interval, row.amountCents]), row.id]));
    product.prices.forEach((price) => ids.set(price.id, prices.get(stableKey([price.label, price.interval, price.amountCents])) || generatedId("price", stableKey([product.name, price.label, price.interval]))));
  });
  return { ids };
}
function packKey(row) { return stableKey([row.categoryRecord?.slug || row.category, row.name]); }
function productMatch(site, row) { return site.products.find((item) => stableKey([item.name, item.type]) === stableKey([row.name, row.type])); }
function priceMatch(site, product, row) { return productMatch(site, product)?.prices.find((item) => stableKey([item.label, item.interval, item.amountCents]) === stableKey([row.label, row.interval, row.amountCents])); }
function counts(site) { return { pages: site.pages.length, activePacks: site.creativePacks.filter((row) => row.status === "active").length, activeVideos: site.videoThemes.filter((row) => row.status === "active").length, mediaAssets: site.mediaAssets.length, products: site.products.length, prices: site.products.reduce((n, row) => n + row.prices.length, 0), activePublication: site.activePublication?.publication ? { version: site.activePublication.publication.version, id: site.activePublication.publication.id } : null }; }
const protectedModels = ["customer", "order", "subscription", "creditBalance", "creditLedger", "generationJob", "assetUpload", "album"];
async function protectedFingerprint(client) {
  const rows = await Promise.all(protectedModels.map(async (model) => {
    const values = await client[model].findMany({ where: { siteId: targetSiteId }, orderBy: { id: "asc" } });
    return [model, values];
  }));
  const serialized = JSON.stringify(rows);
  return { hash: createHash("sha256").update(serialized).digest("hex"), counts: Object.fromEntries(rows.map(([model, values]) => [model, values.length])) };
}

async function main() {
  const [source, current] = await Promise.all([readSite(sourceSiteId, sourcePrisma), readSite(targetSiteId, prisma)]);
  if (!source || !current) throw new Error(`Both source (${sourceSiteId}) and target (${targetSiteId}) sites are required.`);
if (sourceSiteId === targetSiteId && !allowSameSite) throw new Error("Source and target sites must be different unless --allow-same-site is explicit.");
  const maps = mapsFor(source, current);
  const sourceSnapshot = source.activePublication?.publication?.snapshot;
  if (!sourceSnapshot || publicationSnapshotIntegrity(sourceSnapshot) !== "valid") throw new Error("Source active publication snapshot is missing or invalid.");
  if (!apply) { console.log(JSON.stringify({ ok: true, mode: "dry-run", target, sourceSiteId, targetSiteId, noIndex, source: counts(source), targetBefore: counts(current) }, null, 2)); return; }
  if (argumentValue("--confirm") !== confirmPhrase) throw new Error(`Apply requires --confirm=${confirmPhrase}.`);

  const protectedBefore = await protectedFingerprint(prisma);
  await prisma.$transaction(async (tx) => {
    for (const row of source.creativePackCategories) await tx.creativePackCategory.upsert({ where: { siteId_slug: { siteId: targetSiteId, slug: row.slug } }, create: { id: maps.ids.get(row.id), siteId: targetSiteId, parentId: null, slug: row.slug, label: row.label, description: row.description, heroTitle: row.heroTitle, heroSubtitle: row.heroSubtitle, icon: row.icon, imageUrl: rewriteText(row.imageUrl, source), sortOrder: row.sortOrder, status: row.status }, update: { label: row.label, description: row.description, heroTitle: row.heroTitle, heroSubtitle: row.heroSubtitle, icon: row.icon, imageUrl: rewriteText(row.imageUrl, source), sortOrder: row.sortOrder, status: row.status, updatedAt: new Date() } });
    for (const row of source.creativePackCategories) await tx.creativePackCategory.update({ where: { id: maps.ids.get(row.id) }, data: { parentId: row.parentId ? maps.ids.get(row.parentId) || null : null } });
    for (const row of source.creativePacks) await tx.creativePack.upsert({ where: { id: maps.ids.get(row.id) }, create: { id: maps.ids.get(row.id), siteId: targetSiteId, categoryId: row.categoryId ? maps.ids.get(row.categoryId) || null : null, name: row.name, headline: row.headline, description: row.description, prompt: row.prompt, category: row.category, aiAppSlug: row.aiAppSlug, status: row.status, creditCost: row.creditCost, outputCount: row.outputCount, trainingRequired: row.trainingRequired, generationCount: row.generationCount, conversionRate: row.conversionRate, imageUrl: rewriteText(row.imageUrl, source), galleryImages: remapJson(row.galleryImages, maps, source), galleryImageAlts: remapJson(row.galleryImageAlts, maps, source) }, update: { categoryId: row.categoryId ? maps.ids.get(row.categoryId) || null : null, name: row.name, headline: row.headline, description: row.description, prompt: row.prompt, category: row.category, aiAppSlug: row.aiAppSlug, status: row.status, creditCost: row.creditCost, outputCount: row.outputCount, trainingRequired: row.trainingRequired, generationCount: row.generationCount, conversionRate: row.conversionRate, imageUrl: rewriteText(row.imageUrl, source), galleryImages: remapJson(row.galleryImages, maps, source), galleryImageAlts: remapJson(row.galleryImageAlts, maps, source), updatedAt: new Date() } });
    await tx.creativePack.updateMany({ where: { siteId: targetSiteId, id: { notIn: source.creativePacks.map((row) => maps.ids.get(row.id)) } }, data: { status: "archived", updatedAt: new Date() } });
    for (const row of source.mediaAssets) {
      const normalizedStorageKey = storageKey(row.storageKey);
      const existingMedia = current.mediaAssets.find((candidate) => candidate.storageKey === normalizedStorageKey);
      const idAlreadyUsed = current.mediaAssets.some((candidate) => candidate.id === maps.ids.get(row.id) && candidate.storageKey !== normalizedStorageKey);
      const mediaId = existingMedia?.id || (idAlreadyUsed ? generatedId("media_sync", normalizedStorageKey) : maps.ids.get(row.id));
      await tx.mediaAsset.upsert({
        where: { siteId_storageKey: { siteId: targetSiteId, storageKey: normalizedStorageKey } },
        create: { id: mediaId, siteId: targetSiteId, label: row.label, storageKey: normalizedStorageKey, mimeType: row.mimeType, usageType: row.usageType, sourceType: row.sourceType, previewUrl: rewriteText(row.previewUrl, source), originUrl: rewriteText(row.originUrl, source), altText: row.altText, notes: row.notes },
        update: { label: row.label, mimeType: row.mimeType, usageType: row.usageType, sourceType: row.sourceType, previewUrl: rewriteText(row.previewUrl, source), originUrl: rewriteText(row.originUrl, source), altText: row.altText, notes: row.notes, updatedAt: new Date() }
      });
    }
    for (const row of source.toolCategories) await tx.toolCategory.upsert({ where: { siteId_slug: { siteId: targetSiteId, slug: row.slug } }, create: { id: maps.ids.get(row.id), siteId: targetSiteId, parentId: null, slug: row.slug, label: row.label, description: row.description, icon: row.icon, sortOrder: row.sortOrder, status: row.status }, update: { label: row.label, description: row.description, icon: row.icon, sortOrder: row.sortOrder, status: row.status, updatedAt: new Date() } });
    for (const row of source.toolCategories) await tx.toolCategory.update({ where: { id: maps.ids.get(row.id) }, data: { parentId: row.parentId ? maps.ids.get(row.parentId) || null : null } });
    for (const row of source.toolMenuItems) await tx.toolMenuItem.upsert({ where: { siteId_slug: { siteId: targetSiteId, slug: row.slug } }, create: { id: maps.ids.get(row.id), siteId: targetSiteId, categoryId: row.categoryId ? maps.ids.get(row.categoryId) || null : null, slug: row.slug, title: row.title, description: row.description, badge: row.badge, icon: row.icon, imageUrl: rewriteText(row.imageUrl, source), href: rewriteText(row.href, source), detailJson: remapJson(row.detailJson, maps, source), sortOrder: row.sortOrder, status: row.status }, update: { categoryId: row.categoryId ? maps.ids.get(row.categoryId) || null : null, title: row.title, description: row.description, badge: row.badge, icon: row.icon, imageUrl: rewriteText(row.imageUrl, source), href: rewriteText(row.href, source), detailJson: remapJson(row.detailJson, maps, source), sortOrder: row.sortOrder, status: row.status, updatedAt: new Date() } });
    for (const row of source.videoThemeCategories) {
      const existingCategory = current.videoThemeCategories.find((candidate) => candidate.slug === row.slug);
      const idInUse = current.videoThemeCategories.some((candidate) => candidate.id === maps.ids.get(row.id) && candidate.slug !== row.slug);
      const categoryId = existingCategory?.id || (idInUse ? generatedId("videocat_sync", row.slug) : maps.ids.get(row.id));
      maps.ids.set(row.id, categoryId);
      await tx.videoThemeCategory.upsert({ where: { siteId_slug: { siteId: targetSiteId, slug: row.slug } }, create: { id: categoryId, siteId: targetSiteId, slug: row.slug, label: row.label, description: row.description, imageUrl: rewriteText(row.imageUrl, source), sortOrder: row.sortOrder, status: row.status }, update: { label: row.label, description: row.description, imageUrl: rewriteText(row.imageUrl, source), sortOrder: row.sortOrder, status: row.status, updatedAt: new Date() } });
    }
    for (const row of source.videoThemes) await tx.videoTheme.upsert({ where: { id: maps.ids.get(row.id) }, create: { id: maps.ids.get(row.id), siteId: targetSiteId, categoryId: row.categoryId ? maps.ids.get(row.categoryId) || null : null, slug: row.slug, name: row.name, headline: row.headline, description: row.description, prompt: row.prompt, status: row.status, creditCost: row.creditCost, modelPricing: remapJson(row.modelPricing, maps, source), durationSeconds: row.durationSeconds, maxFrames: row.maxFrames, generationCount: row.generationCount, sortOrder: row.sortOrder, imageUrl: rewriteText(row.imageUrl, source), galleryImages: remapJson(row.galleryImages, maps, source) }, update: { categoryId: row.categoryId ? maps.ids.get(row.categoryId) || null : null, name: row.name, headline: row.headline, description: row.description, prompt: row.prompt, status: row.status, creditCost: row.creditCost, modelPricing: remapJson(row.modelPricing, maps, source), durationSeconds: row.durationSeconds, maxFrames: row.maxFrames, generationCount: row.generationCount, sortOrder: row.sortOrder, imageUrl: rewriteText(row.imageUrl, source), galleryImages: remapJson(row.galleryImages, maps, source), updatedAt: new Date() } });
    for (const product of source.products) {
      const existingProduct = productMatch(current, product); const productId = maps.ids.get(product.id);
      if (existingProduct) await tx.product.update({ where: { id: existingProduct.id }, data: { name: product.name, type: product.type, status: product.status, metadata: remapJson(product.metadata, maps, source) } });
      else await tx.product.create({ data: { id: productId, siteId: targetSiteId, name: product.name, type: product.type, status: product.status, metadata: remapJson(product.metadata, maps, source) } });
      for (const price of product.prices) {
        const existingPrice = priceMatch(current, product, price); const data = { siteId: targetSiteId, productId: existingProduct?.id || productId, label: price.label, amountCents: price.amountCents, currency: price.currency, interval: price.interval, creditsGranted: price.creditsGranted, metadata: remapJson(price.metadata, maps, source), status: price.status, effectiveFrom: price.effectiveFrom, effectiveTo: price.effectiveTo, providerVerifiedAt: existingPrice?.providerVerifiedAt ?? price.providerVerifiedAt, providerFingerprint: existingPrice?.providerFingerprint ?? price.providerFingerprint, rateLimitPerMinute: existingPrice?.rateLimitPerMinute ?? price.rateLimitPerMinute, accountPoolMode: existingPrice?.accountPoolMode ?? price.accountPoolMode, unavailableReason: existingPrice?.unavailableReason ?? price.unavailableReason };
        if (existingPrice) await tx.price.update({ where: { id: existingPrice.id }, data }); else await tx.price.create({ data: { id: maps.ids.get(price.id), stripePriceId: null, ...data } });
      }
    }
    for (const page of source.pages) await tx.themePage.upsert({ where: { siteId_slug: { siteId: targetSiteId, slug: page.slug } }, create: { id: maps.ids.get(page.id), siteId: targetSiteId, pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, draftJson: publicJson(page.draftJson, maps, source), publishedJson: publicJson(page.publishedJson, maps, source), draftMeta: remapJson(page.draftMeta, maps, source) }, update: { pageType: page.pageType, templateKey: page.templateKey, title: page.title, draftJson: publicJson(page.draftJson, maps, source), publishedJson: publicJson(page.publishedJson, maps, source), draftMeta: remapJson(page.draftMeta, maps, source), updatedAt: new Date() } });
    if (source.settings) await tx.themeSettings.update({ where: { siteId: targetSiteId }, data: { draftJson: publicJson(source.settings.draftJson, maps, source), publishedJson: publicJson(source.settings.publishedJson, maps, source), updatedAt: new Date() } });
    for (const theme of source.siteThemes) await tx.siteTheme.upsert({ where: { siteId_themeId: { siteId: targetSiteId, themeId: maps.ids.get(theme.themeId) } }, create: { id: maps.ids.get(theme.id), siteId: targetSiteId, name: theme.name, themeId: maps.ids.get(theme.themeId), themeKey: theme.themeKey, status: theme.status, templates: publicJson(theme.templates, maps, source), settings: publicJson(theme.settings, maps, source), source: theme.source, createdBy: theme.createdBy }, update: { name: theme.name, themeKey: theme.themeKey, status: theme.status, templates: publicJson(theme.templates, maps, source), settings: publicJson(theme.settings, maps, source), source: theme.source, createdBy: theme.createdBy, updatedAt: new Date() } });
    for (const copy of source.themeCopies) await tx.themeCopy.upsert({ where: { id: maps.ids.get(copy.id) }, create: { id: maps.ids.get(copy.id), siteId: targetSiteId, name: copy.name, themeKey: copy.themeKey, source: copy.source, templates: publicJson(copy.templates, maps, source), settings: publicJson(copy.settings, maps, source), createdBy: copy.createdBy }, update: { name: copy.name, themeKey: copy.themeKey, source: copy.source, templates: publicJson(copy.templates, maps, source), settings: publicJson(copy.settings, maps, source), createdBy: copy.createdBy, updatedAt: new Date() } });
  }, { timeout: 180000, maxWait: 20000 });

  const protectedAfter = await protectedFingerprint(prisma);
  if (protectedBefore.hash !== protectedAfter.hash) throw new Error("Protected business row contents changed during public SQL sync.");
  const fresh = await readSite(targetSiteId, prisma);
  const targetSite = toSite(fresh);
  const existingProfile = fresh.activePublication?.publication?.snapshot?.storefrontProfile;
  if (!targetSite.storefrontProfile && existingProfile) {
    targetSite.storefrontProfile = {
      id: `profile_${targetSiteId}`,
      siteId: targetSiteId,
      draftJson: clone(existingProfile),
      publishedJson: clone(existingProfile)
    };
  }
  const normalizedPacks = fresh.creativePacks.map((pack) => ({
    id: pack.id,
    status: ["active", "draft", "paused"].includes(pack.status) ? pack.status : "draft",
    creditCost: Number(pack.creditCost ?? 0),
    outputCount: Number(pack.outputCount ?? 0),
    category: pack.category ?? undefined,
    categoryRecord: pack.categoryRecord?.slug ? { slug: pack.categoryRecord.slug } : null,
    imageUrl: typeof pack.imageUrl === "string" ? pack.imageUrl : undefined,
    galleryImages: Array.isArray(pack.galleryImages) ? pack.galleryImages.filter((value) => typeof value === "string") : [],
    galleryImageAlts: Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts.filter((value) => typeof value === "string") : []
  }));
  const snapshot = buildPublicationSnapshot(targetSite, undefined, normalizedPacks, fresh.products.map(mapProduct));
  if (publicationSnapshotIntegrity(snapshot) !== "valid") throw new Error("Target public SQL publication snapshot is invalid after rebuild.");
  const published = await publishSeoSnapshotRelational({ siteId: targetSiteId, snapshot, actor: "sync:mydreamshoots-public-sql" });
  console.log(JSON.stringify({ ok: true, mode: "applied", target, sourceSiteId, targetSiteId, noIndex, source: counts(source), targetAfter: counts(await readSite(targetSiteId)), publicationId: published.publication.id, publishedVersion: published.publishedVersion, snapshotHash: published.publication.snapshot.snapshotHash, protected: protectedAfter }, null, 2));
}

main().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); await sourcePrisma.$disconnect(); Module._resolveFilename = originalResolveFilename; });
