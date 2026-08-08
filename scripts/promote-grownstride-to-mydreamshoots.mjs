import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const statePath = path.join(process.cwd(), "data", "platform-state.json");
const sourceSiteId = "site_grownstride_test";
const targetSiteId = "site_dreamshoot";
const sourceSlug = "grownstride";
const targetSlug = "mydreamshoots";
const sourcePrimaryDomain = "test.grownstride.com";
const targetPrimaryDomain = "www.mydreamshoots.com";
const sourceApexDomain = "grownstride.com";
const targetApexDomain = "mydreamshoots.com";
const confirmPhrase = "promote-grownstride-to-mydreamshoots";
const blockedPageTypes = new Set(["account", "album", "cart", "job_detail", "job_progress", "login", "search", "workspace", "404"]);
const blockedPrefixes = ["/account", "/admin", "/api", "/app", "/cart", "/dashboard", "/job", "/login", "/search"];
const contentTableKeys = [
  "pages",
  "products",
  "prices",
  "siteAiApps",
  "creativePackCategories",
  "creativePacks",
  "mediaAssets",
  "siteThemes",
  "themeCopies",
  "themePublications",
  "toolCategories",
  "toolMenuItems",
  "videoThemeCategories",
  "videoThemes"
];

function wants(flag) {
  return process.argv.includes(flag);
}

function argValue(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && index + 1 < process.argv.length) return process.argv[index + 1];
  return undefined;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanId(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableSort(value[key])]));
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableSort(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  throw new Error(message);
}

function mappedId(id, fallbackPrefix = "dreamshoot") {
  if (!id) return `${fallbackPrefix}_${targetSlug}`;
  const raw = String(id);
  const next = raw.replaceAll("site_grownstride_test", targetSiteId).replaceAll("grownstride", "dreamshoot").replaceAll("mydreamshoots", targetSlug);
  return cleanId(next === raw ? `${raw}_${targetSlug}` : next);
}

const textRewrites = [
  ["https://test.grownstride.com", "https://www.mydreamshoots.com"],
  ["http://test.grownstride.com", "https://www.mydreamshoots.com"],
  ["test.grownstride.com", "www.mydreamshoots.com"],
  ["https://www.grownstride.com", "https://www.mydreamshoots.com"],
  ["https://grownstride.com", "https://mydreamshoots.com"],
  ["http://www.grownstride.com", "https://www.mydreamshoots.com"],
  ["http://grownstride.com", "https://mydreamshoots.com"],
  ["www.grownstride.com", "www.mydreamshoots.com"],
  ["grownstride.com", "mydreamshoots.com"],
  ["/site/grownstride", "/site/mydreamshoots"],
  ["site_grownstride_test", "site_dreamshoot"],
  ["/assets/sites/site_grownstride_test/", "/assets/dreamshoot/"],
  ["sites/site_grownstride_test/", "sites/site_dreamshoot/"],
  ["grownstride", "mydreamshoots"],
  ["MyDreamShoots Test", "MyDreamShoots"]
];

function buildIdMap(sourceSite) {
  const idMap = new Map([[sourceSite.id, targetSiteId]]);
  const add = (id, fallbackPrefix) => {
    if (id) idMap.set(id, mappedId(id, fallbackPrefix));
  };
  for (const page of sourceSite.pages ?? []) add(page.id, `${targetSiteId}_page`);
  for (const product of sourceSite.products ?? []) {
    add(product.id, "prod");
    for (const price of product.prices ?? []) add(price.id, "price");
  }
  for (const row of sourceSite.siteAiApps ?? []) add(row.id, "sai");
  for (const row of sourceSite.creativePackCategories ?? []) add(row.id, "cpc");
  for (const row of sourceSite.creativePacks ?? []) add(row.id, "pack");
  for (const row of sourceSite.mediaAssets ?? []) add(row.id, "media");
  for (const row of sourceSite.siteThemes ?? []) {
    add(row.id, "theme");
    add(row.themeId, "theme_id");
  }
  for (const row of sourceSite.themeCopies ?? []) add(row.id, "theme_copy");
  for (const row of sourceSite.themePublications ?? []) add(row.id, "pub");
  for (const row of sourceSite.toolCategories ?? []) add(row.id, "tool_cat");
  for (const row of sourceSite.toolMenuItems ?? []) add(row.id, "tool");
  for (const row of sourceSite.videoThemeCategories ?? []) add(row.id, "video_cat");
  for (const row of sourceSite.videoThemes ?? []) add(row.id, "video");
  return idMap;
}

function rewriteString(value, idMap) {
  if (typeof value !== "string") return value;
  let next = value;
  const idEntries = [...idMap.entries()].sort(([a], [b]) => String(b).length - String(a).length);
  for (const [from, to] of idEntries) {
    if (from && to) next = next.split(String(from)).join(String(to));
  }
  for (const [from, to] of textRewrites) {
    next = next.split(from).join(to);
  }
  return next;
}

function rewriteJson(value, idMap) {
  if (Array.isArray(value)) return value.map((item) => rewriteJson(item, idMap));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [rewriteString(idMap.get(key) ?? key, idMap), rewriteJson(item, idMap)])
    );
  }
  if (typeof value === "string") return rewriteString(idMap.get(value) ?? value, idMap);
  return value;
}

function defaultRobotsForPage(page) {
  const slug = page?.slug || "/";
  const pageType = page?.pageType || "";
  const blocked = blockedPageTypes.has(pageType) || blockedPrefixes.some((prefix) => slug === prefix || slug.startsWith(`${prefix}/`));
  return { index: !blocked, follow: true };
}

function normalizePageSeo(pageJson, page) {
  const next = rewriteJson(clone(pageJson), currentIdMap);
  if (!isPlainObject(next?.seo)) return next;
  const robots = defaultRobotsForPage(page);
  next.seo.index = robots.index;
  next.seo.follow = true;
  next.seo.robots = {
    ...(isPlainObject(next.seo.robots) ? next.seo.robots : {}),
    index: robots.index,
    follow: true
  };
  return next;
}

function normalizeThemeSettingsSeo(settings, pagesById) {
  const next = rewriteJson(clone(settings), currentIdMap);
  if (!isPlainObject(next?.seo)) return next;
  next.seo.index = true;
  next.seo.follow = true;
  next.seo.robots = {
    ...(isPlainObject(next.seo.robots) ? next.seo.robots : {}),
    index: true,
    follow: true
  };
  if (isPlainObject(next.seo.pages)) {
    for (const [pageId, pageSeo] of Object.entries(next.seo.pages)) {
      const page = pagesById.get(pageId);
      if (!page || !isPlainObject(pageSeo)) continue;
      const robots = defaultRobotsForPage(page);
      pageSeo.index = robots.index;
      pageSeo.follow = true;
      pageSeo.robots = {
        ...(isPlainObject(pageSeo.robots) ? pageSeo.robots : {}),
        index: robots.index,
        follow: true
      };
    }
  }
  return next;
}

function normalizeSnapshot(snapshot, pagesById) {
  const next = rewriteJson(clone(snapshot), currentIdMap);
  if (isPlainObject(next?.themeSettings)) next.themeSettings = normalizeThemeSettingsSeo(next.themeSettings, pagesById);
  if (Array.isArray(next?.pages)) {
    next.pages = next.pages.map((page) => {
      const pageId = page?.id;
      const sourcePage = pageId ? pagesById.get(pageId) : undefined;
      const nextPage = rewriteJson(clone(page), currentIdMap);
      if (!sourcePage) return nextPage;
      if (isPlainObject(nextPage?.publishedJson)) nextPage.publishedJson = normalizePageSeo(nextPage.publishedJson, sourcePage);
      if (isPlainObject(nextPage?.draftJson)) nextPage.draftJson = normalizePageSeo(nextPage.draftJson, sourcePage);
      return nextPage;
    });
  }
  return next;
}

function flattenPrices(products, siteId) {
  return asArray(products).flatMap((product) =>
    asArray(product.prices).map((price) => ({
      ...clone(price),
      id: price.id,
      siteId: siteId ?? price.siteId ?? product.siteId,
      productId: price.productId ?? product.id
    }))
  );
}

function liveStripePriceIdsFromRows(products) {
  const ids = new Map();
  for (const product of asArray(products)) {
    for (const price of asArray(product.prices)) {
      if (price?.id) ids.set(price.id, price.stripePriceId ?? null);
    }
  }
  return ids;
}

function patchLiveStripePriceIds(products, liveStripeIds) {
  return products.map((product) => ({
    ...product,
    prices: asArray(product.prices).map((price) => ({
      ...price,
      stripePriceId: liveStripeIds.get(price.id) ?? price.stripePriceId ?? null
    }))
  }));
}

function buildRows(sourceSite, targetSite, targetDomainsRows, liveStripeIds) {
  const pages = asArray(sourceSite.pages).map((page) => {
    const next = clone(page);
    next.id = currentIdMap.get(page.id) ?? mappedId(page.id, `${targetSiteId}_page`);
    next.siteId = targetSiteId;
    if (isPlainObject(next.draftJson)) next.draftJson = normalizePageSeo(next.draftJson, page);
    if (isPlainObject(next.publishedJson)) next.publishedJson = normalizePageSeo(next.publishedJson, page);
    return next;
  });
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const themeSettings = normalizeThemeSettingsSeo(sourceSite.themeSettings, pagesById);
  const products = patchLiveStripePriceIds(
    asArray(sourceSite.products).map((product) => {
      const next = clone(product);
      next.id = currentIdMap.get(product.id) ?? mappedId(product.id, "prod");
      next.siteId = targetSiteId;
      next.prices = asArray(product.prices).map((price) => {
        const nextPrice = clone(price);
        nextPrice.id = currentIdMap.get(price.id) ?? mappedId(price.id, "price");
        nextPrice.siteId = targetSiteId;
        nextPrice.productId = next.id;
        return nextPrice;
      });
      return next;
    }),
    liveStripeIds
  );
  const siteAiApps = asArray(sourceSite.siteAiApps).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "sai");
    next.siteId = targetSiteId;
    return next;
  });
  const creativePackCategories = asArray(sourceSite.creativePackCategories).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "cpc");
    next.siteId = targetSiteId;
    next.parentId = row.parentId ? currentIdMap.get(row.parentId) ?? mappedId(row.parentId, "cpc") : null;
    return next;
  });
  const creativePacks = asArray(sourceSite.creativePacks).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "pack");
    next.siteId = targetSiteId;
    next.categoryId = row.categoryId ? currentIdMap.get(row.categoryId) ?? mappedId(row.categoryId, "cpc") : next.categoryId ?? null;
    return next;
  });
  const mediaAssets = asArray(sourceSite.mediaAssets).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "media");
    next.siteId = targetSiteId;
    return next;
  });
  const siteThemes = asArray(sourceSite.siteThemes).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "theme");
    next.siteId = targetSiteId;
    next.themeId = row.themeId ? currentIdMap.get(row.themeId) ?? mappedId(row.themeId, "theme_id") : next.themeId;
    if (isPlainObject(next.settings)) next.settings = normalizeThemeSettingsSeo(next.settings, pagesById);
    return next;
  });
  const themeCopies = asArray(sourceSite.themeCopies).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "theme_copy");
    next.siteId = targetSiteId;
    if (isPlainObject(next.settings)) next.settings = normalizeThemeSettingsSeo(next.settings, pagesById);
    return next;
  });
  const themePublications = asArray(sourceSite.themePublications).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "pub");
    next.siteId = targetSiteId;
    next.snapshot = normalizeSnapshot(row.snapshot, pagesById);
    next.snapshotBytes = Buffer.byteLength(JSON.stringify(next.snapshot));
    return next;
  });
  const toolCategories = asArray(sourceSite.toolCategories).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "tool_cat");
    next.siteId = targetSiteId;
    next.parentId = row.parentId ? currentIdMap.get(row.parentId) ?? mappedId(row.parentId, "tool_cat") : null;
    return next;
  });
  const toolMenuItems = asArray(sourceSite.toolMenuItems).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "tool");
    next.siteId = targetSiteId;
    next.categoryId = row.categoryId ? currentIdMap.get(row.categoryId) ?? mappedId(row.categoryId, "tool_cat") : null;
    return next;
  });
  const videoThemeCategories = asArray(sourceSite.videoThemeCategories).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "video_cat");
    next.siteId = targetSiteId;
    return next;
  });
  const videoThemes = asArray(sourceSite.videoThemes).map((row) => {
    const next = rewriteJson(clone(row), currentIdMap);
    next.id = currentIdMap.get(row.id) ?? mappedId(row.id, "video");
    next.siteId = targetSiteId;
    next.categoryId = row.categoryId ? currentIdMap.get(row.categoryId) ?? mappedId(row.categoryId, "video_cat") : null;
    return next;
  });

  const site = {
    ...clone(targetSite),
    id: targetSiteId,
    name: targetSite.name || "MyDreamShoots",
    slug: targetSlug,
    status: targetSite.status || "active",
    primaryDomain: targetPrimaryDomain,
    siteDomains: clone(targetDomainsRows),
    themeSettings,
    pages,
    products,
    siteAiApps,
    creativePackCategories,
    creativePacks,
    mediaAssets,
    siteThemes,
    themeCopies,
    themePublications,
    toolCategories,
    toolMenuItems,
    videoThemeCategories,
    videoThemes
  };

  return {
    site,
    pages,
    products,
    siteAiApps,
    creativePackCategories,
    creativePacks,
    mediaAssets,
    siteThemes,
    themeCopies,
    themePublications,
    toolCategories,
    toolMenuItems,
    videoThemeCategories,
    videoThemes
  };
}

function replaceRowsBySiteId(state, key, rows) {
  state[key] = [...asArray(state[key]).filter((row) => row?.siteId !== targetSiteId), ...rows];
}

function rowDiff(beforeRows, afterRows) {
  const before = new Map(asArray(beforeRows).map((row) => [row.id, stableStringify(row)]));
  const after = new Map(asArray(afterRows).map((row) => [row.id, stableStringify(row)]));
  let added = 0;
  let updated = 0;
  let removed = 0;
  for (const [id, afterValue] of after) {
    if (!before.has(id)) added += 1;
    else if (before.get(id) !== afterValue) updated += 1;
  }
  for (const id of before.keys()) {
    if (!after.has(id)) removed += 1;
  }
  return { added, updated, removed, kept: after.size - added - updated };
}

function countSharedIds(sourceRows, targetRows) {
  const sourceIds = new Set(asArray(sourceRows).map((row) => row?.id).filter(Boolean));
  const targetIds = new Set(asArray(targetRows).map((row) => row?.id).filter(Boolean));
  return [...sourceIds].filter((id) => targetIds.has(id));
}

function flattenProtectedRows(state, siteId) {
  return {
    customers: asArray(state.customers).filter((row) => row.siteId === siteId),
    customerSessions: asArray(state.customerSessions).filter((row) => row.siteId === siteId),
    customerEmailVerifications: asArray(state.customerEmailVerifications).filter((row) => row.siteId === siteId),
    subscriptions: asArray(state.subscriptions).filter((row) => row.siteId === siteId),
    orders: asArray(state.orders).filter((row) => row.siteId === siteId),
    paymentEvents: asArray(state.paymentEvents).filter((row) => row.siteId === siteId),
    ledger: asArray(state.ledger).filter((row) => row.siteId === siteId),
    assetUploads: asArray(state.assetUploads).filter((row) => row.siteId === siteId),
    customerModels: asArray(state.customerModels).filter((row) => row.siteId === siteId),
    albums: asArray(state.albums).filter((row) => row.siteId === siteId),
    jobs: asArray(state.jobs).filter((row) => row.siteId === siteId)
  };
}

async function readLiveStripeIds(state) {
  if (!process.env.DATABASE_URL) {
    return {
      source: "state",
      ids: liveStripePriceIdsFromRows((state.products ?? []).filter((row) => row.siteId === targetSiteId))
    };
  }
  try {
    const rows = await prisma.price.findMany({
      where: { siteId: targetSiteId },
      select: { id: true, stripePriceId: true }
    });
    return {
      source: "database",
      ids: new Map(rows.map((row) => [row.id, row.stripePriceId ?? null]))
    };
  } catch (error) {
    return {
      source: "state",
      fallbackError: error instanceof Error ? error.message : String(error),
      ids: liveStripePriceIdsFromRows((state.products ?? []).filter((row) => row.siteId === targetSiteId))
    };
  }
}

function validateDomainIsolation(state, sourceSite, targetSite) {
  const sourceDomains = asArray(state.siteDomains).filter((row) => row.siteId === sourceSite.id).map((row) => String(row.domain).toLowerCase());
  const targetDomains = asArray(state.siteDomains).filter((row) => row.siteId === targetSite.id).map((row) => String(row.domain).toLowerCase());
  const overlap = sourceDomains.filter((domain) => targetDomains.includes(domain));
  if (overlap.length) fail(`domain overlap detected: ${overlap.join(", ")}`);
  if (!sourceDomains.some((domain) => domain.includes("grownstride"))) fail("source site is missing grownstride domains");
  if (!targetDomains.some((domain) => domain.includes("mydreamshoots"))) fail("target site is missing mydreamshoots domains");
  if (sourceDomains.some((domain) => domain.includes("mydreamshoots"))) fail("source grownstride site must not bind mydreamshoots domains");
  if (targetDomains.some((domain) => domain.includes("grownstride"))) fail("target mydreamshoots site must not bind grownstride domains");
}

function buildPlan(state, liveStripeIdsPayload) {
  const sourceSite = state.sites?.find((site) => site.id === sourceSiteId);
  const targetSite = state.sites?.find((site) => site.id === targetSiteId);
  if (!sourceSite) fail(`missing source site: ${sourceSiteId}`);
  if (!targetSite) fail(`missing target site: ${targetSiteId}`);
  if (sourceSiteId === targetSiteId || sourceSlug === targetSlug) fail("source and target must differ");
  validateDomainIsolation(state, sourceSite, targetSite);

  currentIdMap = buildIdMap(sourceSite);
  const targetDomainsRows = asArray(state.siteDomains).filter((row) => row.siteId === targetSiteId);
  const rows = buildRows(sourceSite, targetSite, targetDomainsRows, liveStripeIdsPayload.ids);
  const contentDiffs = Object.fromEntries(
    contentTableKeys.map((key) => {
      const beforeRows = key === "pages"
        ? targetSite.pages
        : key === "prices"
          ? flattenPrices(asArray(state.products).filter((row) => row.siteId === targetSiteId), targetSiteId)
          : state[key];
      const afterRows = key === "pages"
        ? rows.pages
        : key === "prices"
          ? flattenPrices(rows.products, targetSiteId)
          : rows[key];
      return [key, rowDiff(beforeRows, afterRows)];
    })
  );
  const sourceContentRows = {
    pages: sourceSite.pages,
    products: asArray(state.products).filter((row) => row.siteId === sourceSiteId),
    prices: flattenPrices(asArray(state.products).filter((row) => row.siteId === sourceSiteId), sourceSiteId),
    siteAiApps: asArray(state.siteAiApps).filter((row) => row.siteId === sourceSiteId),
    creativePackCategories: asArray(state.creativePackCategories).filter((row) => row.siteId === sourceSiteId),
    creativePacks: asArray(state.creativePacks).filter((row) => row.siteId === sourceSiteId),
    mediaAssets: asArray(state.mediaAssets).filter((row) => row.siteId === sourceSiteId),
    siteThemes: asArray(state.siteThemes).filter((row) => row.siteId === sourceSiteId),
    themeCopies: asArray(state.themeCopies).filter((row) => row.siteId === sourceSiteId),
    themePublications: asArray(state.themePublications).filter((row) => row.siteId === sourceSiteId),
    toolCategories: asArray(state.toolCategories).filter((row) => row.siteId === sourceSiteId),
    toolMenuItems: asArray(state.toolMenuItems).filter((row) => row.siteId === sourceSiteId),
    videoThemeCategories: asArray(state.videoThemeCategories).filter((row) => row.siteId === sourceSiteId),
    videoThemes: asArray(state.videoThemes).filter((row) => row.siteId === sourceSiteId)
  };
  const targetContentRows = {
    pages: targetSite.pages,
    products: asArray(state.products).filter((row) => row.siteId === targetSiteId),
    prices: flattenPrices(asArray(state.products).filter((row) => row.siteId === targetSiteId), targetSiteId),
    siteAiApps: asArray(state.siteAiApps).filter((row) => row.siteId === targetSiteId),
    creativePackCategories: asArray(state.creativePackCategories).filter((row) => row.siteId === targetSiteId),
    creativePacks: asArray(state.creativePacks).filter((row) => row.siteId === targetSiteId),
    mediaAssets: asArray(state.mediaAssets).filter((row) => row.siteId === targetSiteId),
    siteThemes: asArray(state.siteThemes).filter((row) => row.siteId === targetSiteId),
    themeCopies: asArray(state.themeCopies).filter((row) => row.siteId === targetSiteId),
    themePublications: asArray(state.themePublications).filter((row) => row.siteId === targetSiteId),
    toolCategories: asArray(state.toolCategories).filter((row) => row.siteId === targetSiteId),
    toolMenuItems: asArray(state.toolMenuItems).filter((row) => row.siteId === targetSiteId),
    videoThemeCategories: asArray(state.videoThemeCategories).filter((row) => row.siteId === targetSiteId),
    videoThemes: asArray(state.videoThemes).filter((row) => row.siteId === targetSiteId)
  };
  const contentSharedIds = Object.fromEntries(
    contentTableKeys.map((key) => [key, countSharedIds(sourceContentRows[key], targetContentRows[key])])
  );
  const protectedBefore = flattenProtectedRows(state, targetSiteId);
  const protectedSource = flattenProtectedRows(state, sourceSiteId);
  const protectedSharedIds = Object.fromEntries(
    Object.keys(protectedBefore).map((key) => [key, countSharedIds(protectedSource[key], protectedBefore[key])])
  );
  const warningPrices = rows.products.flatMap((product) =>
    asArray(product.prices).flatMap((price) => {
      const stripePriceId = price.stripePriceId ?? "";
      return /^price_[a-z0-9]+/i.test(stripePriceId)
        ? []
        : [{ productId: product.id, priceId: price.id, stripePriceId: stripePriceId || null }];
    })
  );
  const sourceMediaAssets = sourceContentRows.mediaAssets;
  const targetMediaAssets = targetContentRows.mediaAssets;
  const publicPrefixes = (assets) => [...new Set(
    asArray(assets)
      .map((asset) => String(asset.previewUrl || asset.originUrl || ""))
      .map((value) => value.match(/^\/assets\/(?:sites\/[^/]+|[^/]+)\//)?.[0] || "")
      .filter(Boolean)
  )];
  const storagePrefixes = (assets) => [...new Set(
    asArray(assets)
      .map((asset) => String(asset.storageKey || "").match(/^sites\/[^/]+\//)?.[0] || "")
      .filter(Boolean)
  )];
  const assetNamespaceSummary = {
    sourceStoragePrefixes: storagePrefixes(sourceMediaAssets),
    sourcePublicPrefixes: publicPrefixes(sourceMediaAssets),
    targetStoragePrefixes: storagePrefixes(targetMediaAssets),
    targetPublicPrefixes: publicPrefixes(targetMediaAssets)
  };
  const planPayload = {
    sourceSiteId,
    targetSiteId,
    sourcePrimaryDomain,
    targetPrimaryDomain,
    sourceApexDomain,
    targetApexDomain,
    liveStripeIdsSource: liveStripeIdsPayload.source,
    site: {
      id: rows.site.id,
      slug: rows.site.slug,
      name: rows.site.name,
      primaryDomain: rows.site.primaryDomain,
      robots: rows.site.themeSettings?.publishedJson?.seo?.robots ?? rows.site.themeSettings?.draftJson?.seo?.robots ?? null
    },
    rows: {
      pages: rows.pages,
      products: rows.products,
      siteAiApps: rows.siteAiApps,
      creativePackCategories: rows.creativePackCategories,
      creativePacks: rows.creativePacks,
      mediaAssets: rows.mediaAssets,
      siteThemes: rows.siteThemes,
      themeCopies: rows.themeCopies,
      themePublications: rows.themePublications,
      toolCategories: rows.toolCategories,
      toolMenuItems: rows.toolMenuItems,
      videoThemeCategories: rows.videoThemeCategories,
      videoThemes: rows.videoThemes
    }
  };
  const planHash = sha256(stableStringify(planPayload));
  return {
    planHash,
    planPayload,
    sourceSite,
    targetSite,
    rows,
    contentDiffs,
    contentSharedIds,
    protectedBefore,
    protectedSource,
    protectedSharedIds,
    warningPrices,
    assetNamespaceSummary,
    liveStripeIdsSource: liveStripeIdsPayload.source,
    liveStripeIdsFallbackError: liveStripeIdsPayload.fallbackError
  };
}

function applyRowsToState(state, plan) {
  const { rows, targetSite } = plan;
  state.sites = asArray(state.sites).filter((site) => site.id !== targetSiteId && site.slug !== targetSlug);
  state.sites.push(rows.site);
  replaceRowsBySiteId(state, "products", rows.products);
  replaceRowsBySiteId(state, "siteAiApps", rows.siteAiApps);
  replaceRowsBySiteId(state, "creativePackCategories", rows.creativePackCategories);
  replaceRowsBySiteId(state, "creativePacks", rows.creativePacks);
  replaceRowsBySiteId(state, "mediaAssets", rows.mediaAssets);
  replaceRowsBySiteId(state, "siteThemes", rows.siteThemes);
  replaceRowsBySiteId(state, "themeCopies", rows.themeCopies);
  replaceRowsBySiteId(state, "themePublications", rows.themePublications);
  replaceRowsBySiteId(state, "toolCategories", rows.toolCategories);
  replaceRowsBySiteId(state, "toolMenuItems", rows.toolMenuItems);
  replaceRowsBySiteId(state, "videoThemeCategories", rows.videoThemeCategories);
  replaceRowsBySiteId(state, "videoThemes", rows.videoThemes);
  state.auditLogs = [
    ...asArray(state.auditLogs).filter((row) => row.id !== "audit_grownstride_to_mydreamshoots"),
    {
      id: "audit_grownstride_to_mydreamshoots",
      siteId: targetSiteId,
      actorType: "system",
      actorId: "promote-grownstride-to-mydreamshoots",
      action: "content_promoted",
      targetType: "site",
      targetId: targetSiteId,
      createdAt: new Date().toISOString(),
      metadata: {
        sourceSiteId,
        sourceSlug,
        targetSlug,
        sourcePrimaryDomain,
        targetPrimaryDomain
      }
    }
  ];
  return state;
}

function readState() {
  if (!fs.existsSync(statePath)) fail(`state file not found: ${statePath}`);
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function writeState(state) {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

async function syncDatabaseFromState() {
  if (!process.env.DATABASE_URL) {
    return { skipped: true, reason: "DATABASE_URL is not configured" };
  }
  const result = spawnSync(process.execPath, ["scripts/sync-mydreamshoots-public-content-postgres.mjs", "--db", "--force-content-overwrite"], {
    cwd: process.cwd(),
    env: { ...process.env, SYNC_SITE_ID: targetSiteId },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`database content sync failed:\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
  return {
    skipped: false,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

let currentIdMap = new Map();

async function main() {
  const applyRequested = wants("--apply");
  const dryRunRequested = wants("--dry-run");
  if (applyRequested && dryRunRequested) fail("use either --dry-run or --apply, not both");
  if (applyRequested) {
    const confirmValue = argValue("--confirm");
    const expectedPlanHash = argValue("--expected-plan-hash");
    if (confirmValue !== confirmPhrase) {
      fail(`missing confirmation phrase. Use --confirm ${confirmPhrase}`);
    }
    if (!expectedPlanHash) {
      fail("missing --expected-plan-hash");
    }
    const state = readState();
    const liveStripeIds = await readLiveStripeIds(state);
    const plan = buildPlan(state, liveStripeIds);
    if (plan.planHash !== expectedPlanHash) {
      fail(`plan hash mismatch: expected ${expectedPlanHash}, got ${plan.planHash}`);
    }
    const backupDir = path.join(process.cwd(), "backups");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `grownstride-to-mydreamshoots-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    const nextState = applyRowsToState(clone(state), plan);
    writeState(nextState);
    const dbSync = await syncDatabaseFromState();
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "apply",
          sourceSiteId,
          targetSiteId,
          planHash: plan.planHash,
          backupPath,
          dbSync
        },
        null,
        2
      )
    );
    return;
  }

  const state = readState();
  const liveStripeIds = await readLiveStripeIds(state);
  const plan = buildPlan(state, liveStripeIds);
  const sourceProtectedCounts = Object.fromEntries(Object.entries(plan.protectedSource).map(([key, rows]) => [key, rows.length]));
  const targetProtectedCounts = Object.fromEntries(Object.entries(plan.protectedBefore).map(([key, rows]) => [key, rows.length]));
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "dry-run",
        sourceSiteId,
        targetSiteId,
        planHash: plan.planHash,
        liveStripeIdsSource: plan.liveStripeIdsSource,
        liveStripeIdsFallbackError: plan.liveStripeIdsFallbackError,
        site: {
          source: {
            id: plan.sourceSite.id,
            slug: plan.sourceSite.slug,
            primaryDomain: plan.sourceSite.primaryDomain,
            noIndex: plan.sourceSite.themeSettings?.publishedJson?.seo?.robots?.index === false || plan.sourceSite.themeSettings?.draftJson?.seo?.robots?.index === false
          },
          target: {
            id: plan.targetSite.id,
            slug: plan.targetSite.slug,
            primaryDomain: plan.targetSite.primaryDomain,
            noIndex: plan.targetSite.themeSettings?.publishedJson?.seo?.robots?.index === false || plan.targetSite.themeSettings?.draftJson?.seo?.robots?.index === false
          }
        },
        contentDiffs: plan.contentDiffs,
        sharedContentIds: plan.contentSharedIds,
        protectedCounts: {
          source: sourceProtectedCounts,
          target: targetProtectedCounts,
          sharedIds: plan.protectedSharedIds
        },
        warningPrices: plan.warningPrices,
        assetNamespaceSummary: plan.assetNamespaceSummary
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
