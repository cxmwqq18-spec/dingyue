#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const DEFAULT_SITE_ID = "site_grownstride_test";
const DEFAULT_DOMAIN = "test.grownstride.com";
const CONFIRM_PHRASE = "sync-grownstride-test-public-state";
const DOCUMENT_ID = "platform";
const transactionTimeoutMs = Number(process.env.SYNC_TRANSACTION_TIMEOUT_MS ?? 600000);
const cacheFiles = [
  path.join(process.cwd(), ".next", "cache", "platform-state-postgres.json"),
  path.join(process.cwd(), ".next-build", "cache", "platform-state-postgres.json")
];

const prisma = new PrismaClient();
const rawArgs = process.argv.slice(2);

function usage() {
  console.log(
    [
      "Usage:",
      `  node scripts/sync-grownstride-test-public-state-from-json.mjs --dry-run`,
      `  node scripts/sync-grownstride-test-public-state-from-json.mjs --apply --confirm ${CONFIRM_PHRASE}`,
      `  node scripts/sync-grownstride-test-public-state-from-json.mjs --source <legacy-state.json> --dry-run`,
      "",
      "Purpose:",
      "  Sync only site_grownstride_test public storefront state from the relational database into Postgres.",
      "  Use --source only for a one-time legacy JSON backfill.",
      "",
      "Guards:",
      "  Defaults to --dry-run. --apply requires the exact confirm phrase.",
      "  Refuses any site other than site_grownstride_test."
    ].join("\n")
  );
}

function hasFlag(flag) {
  return rawArgs.includes(flag);
}

function argValue(name) {
  const equalPrefix = `${name}=`;
  const equalArg = rawArgs.find((arg) => arg.startsWith(equalPrefix));
  if (equalArg) return equalArg.slice(equalPrefix.length);
  const index = rawArgs.indexOf(name);
  if (index >= 0 && index + 1 < rawArgs.length) return rawArgs[index + 1];
  return undefined;
}

const siteId = argValue("--site-id") ?? process.env.SYNC_SITE_ID ?? DEFAULT_SITE_ID;
const sourceArg = argValue("--source");
const statePath = sourceArg ? path.resolve(sourceArg) : null;
const applyRequested = hasFlag("--apply");
const dryRunRequested = hasFlag("--dry-run");
const dryRun = dryRunRequested || !applyRequested;
const confirmation = argValue("--confirm");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function json(value, fallback = {}) {
  return value === undefined ? fallback : value;
}

function toDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function stripUndefined(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function noId(record) {
  const next = { ...record };
  delete next.id;
  return next;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function scopedRows(state) {
  const site = asArray(state.sites).find((item) => item?.id === siteId);
  if (!site) throw new Error(`site ${siteId} not found in ${statePath}`);
  if (siteId !== DEFAULT_SITE_ID) throw new Error(`refusing to sync non-test site: ${siteId}`);
  if (site.primaryDomain && site.primaryDomain !== DEFAULT_DOMAIN) {
    throw new Error(`refusing to sync ${siteId}; expected primaryDomain ${DEFAULT_DOMAIN}, got ${site.primaryDomain}`);
  }

  const topLevelPrices = asArray(state.prices).filter((item) => item?.siteId === siteId);
  const pricesByProduct = new Map();
  for (const price of topLevelPrices) {
    if (!pricesByProduct.has(price.productId)) pricesByProduct.set(price.productId, []);
    pricesByProduct.get(price.productId).push(price);
  }

  const products = asArray(state.products)
    .filter((item) => item?.siteId === siteId)
    .map((product) => ({
      ...product,
      prices: asArray(product.prices).length > 0 ? asArray(product.prices) : asArray(pricesByProduct.get(product.id))
    }));

  const settings = site.themeSettings
    ? {
        id: `settings_${siteId}`,
        siteId,
        draftJson: json(site.themeSettings.draftJson),
        publishedJson: json(site.themeSettings.publishedJson)
      }
    : null;
  const activePublicationId = site.activePublication?.publication?.id ?? null;
  const legacyProfile = [...asArray(site.themePublications)]
    .reverse()
    .map((publication) => publication?.snapshot?.storefrontProfile)
    .find((profile) => profile && typeof profile === "object");
  const storefrontProfile = site.storefrontProfile ?? (legacyProfile ? {
    id: `profile_${siteId}`,
    siteId,
    draftJson: clone(legacyProfile),
    publishedJson: clone(legacyProfile),
    draftMeta: { revision: 1, updatedAt: new Date().toISOString(), etag: "legacy-publication-migration" }
  } : null);

  return {
    site,
    activePublicationId,
    domains: asArray(state.siteDomains).filter((item) => item?.siteId === siteId),
    settings,
    storefrontProfile,
    pages: asArray(site.pages).filter((item) => item?.siteId === siteId || !item?.siteId),
    publications: asArray(state.themePublications).filter((item) => item?.siteId === siteId),
    siteThemes: asArray(state.siteThemes).filter((item) => item?.siteId === siteId),
    themeCopies: asArray(state.themeCopies).filter((item) => item?.siteId === siteId),
    products,
    siteAiApps: asArray(state.siteAiApps).filter((item) => item?.siteId === siteId),
    aiGatewayGroups: asArray(state.aiGatewayGroups).filter((item) => item?.siteId === siteId),
    creativePackCategories: asArray(state.creativePackCategories).filter((item) => item?.siteId === siteId),
    creativePacks: asArray(state.creativePacks).filter((item) => item?.siteId === siteId),
    mediaAssets: asArray(state.mediaAssets).filter((item) => item?.siteId === siteId),
    toolCategories: asArray(state.toolCategories).filter((item) => item?.siteId === siteId),
    toolMenuItems: asArray(state.toolMenuItems).filter((item) => item?.siteId === siteId),
    videoThemeCategories: asArray(state.videoThemeCategories).filter((item) => item?.siteId === siteId),
    videoThemes: asArray(state.videoThemes).filter((item) => item?.siteId === siteId)
  };
}

function collectTrustedLogoUrls(value, results = new Set()) {
  if (typeof value === "string") {
    if (value.includes("/generated/trusted-logos/")) results.add(value);
    return results;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTrustedLogoUrls(item, results);
    return results;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectTrustedLogoUrls(item, results);
  }
  return results;
}

function pageData(page) {
  return stripUndefined({
    id: page.id,
    siteId,
    pageType: page.pageType,
    templateKey: page.templateKey ?? null,
    slug: page.slug,
    title: page.title,
    draftJson: json(page.draftJson),
    publishedJson: json(page.publishedJson),
    draftMeta: page.draftMeta ? clone(page.draftMeta) : undefined,
    createdAt: toDate(page.createdAt),
    updatedAt: toDate(page.updatedAt)
  });
}

function productData(product) {
  return stripUndefined({
    id: product.id,
    siteId,
    name: product.name,
    type: product.type,
    status: product.status,
    createdAt: toDate(product.createdAt),
    updatedAt: toDate(product.updatedAt)
  });
}

function priceData(price, productId) {
  return stripUndefined({
    id: price.id,
    siteId,
    productId,
    label: price.label ?? price.id,
    amountCents: price.amountCents,
    currency: price.currency,
    interval: price.interval,
    creditsGranted: price.creditsGranted,
    stripePriceId: price.stripePriceId ?? null,
    metadata: price.metadata ? clone(price.metadata) : undefined,
    createdAt: toDate(price.createdAt),
    updatedAt: toDate(price.updatedAt)
  });
}

function aiAppData(aiApp) {
  return stripUndefined({
    id: aiApp.id,
    slug: aiApp.slug,
    name: aiApp.name,
    description: aiApp.description,
    appType: aiApp.appType,
    parameterSchema: json(aiApp.parameterSchema, []),
    createdAt: toDate(aiApp.createdAt),
    updatedAt: toDate(aiApp.updatedAt)
  });
}

function siteAiAppData(row) {
  return stripUndefined({
    id: row.id,
    siteId,
    aiAppId: row.aiAppId ?? row.aiApp?.id,
    enabled: row.enabled ?? true,
    creditCost: row.creditCost ?? 0,
    routeKey: row.routeKey,
    workflowConfig: row.workflowConfig ? clone(row.workflowConfig) : undefined,
    providerConfig: row.providerConfig ? clone(row.providerConfig) : undefined,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function aiGatewayGroupData(row, { preserveUsedQuota = false } = {}) {
  return stripUndefined({
    id: row.id,
    siteId,
    name: row.name,
    status: row.status,
    modelAllowlist: asArray(row.modelAllowlist),
    monthlyQuota: row.monthlyQuota ?? 0,
    usedQuota: preserveUsedQuota ? undefined : row.usedQuota ?? 0,
    retryStatusCodes: asArray(row.retryStatusCodes),
    rateLimitPerMinute: row.rateLimitPerMinute ?? 0,
    accountPoolMode: row.accountPoolMode,
    unavailableReason: row.unavailableReason ?? null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function creativePackCategoryData(row, parentId = null) {
  return stripUndefined({
    id: row.id,
    siteId,
    parentId,
    slug: row.slug,
    label: row.label,
    description: row.description ?? null,
    heroTitle: row.heroTitle ?? null,
    heroSubtitle: row.heroSubtitle ?? null,
    icon: row.icon ?? row.iconName ?? null,
    imageUrl: row.imageUrl ?? null,
    sortOrder: row.sortOrder ?? 0,
    status: row.status ?? "active",
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function creativePackData(row) {
  return stripUndefined({
    id: row.id,
    siteId,
    categoryId: row.categoryId ?? null,
    name: row.name,
    headline: row.headline,
    description: row.description,
    prompt: row.prompt ?? null,
    category: row.category,
    aiAppSlug: row.aiAppSlug,
    status: row.status,
    creditCost: row.creditCost ?? 0,
    outputCount: row.outputCount ?? 0,
    trainingRequired: Boolean(row.trainingRequired),
    generationCount: row.generationCount ?? 0,
    conversionRate: row.conversionRate ?? 0,
    imageUrl: row.imageUrl ?? null,
    galleryImages: row.galleryImages ? clone(row.galleryImages) : undefined,
    galleryImageAlts: row.galleryImageAlts ? clone(row.galleryImageAlts) : undefined,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function mediaAssetData(row) {
  return stripUndefined({
    id: row.id,
    siteId,
    label: row.label,
    storageKey: row.storageKey,
    mimeType: row.mimeType ?? "image/png",
    usageType: row.usageType ?? row.usage ?? "theme",
    sourceType: row.sourceType ?? null,
    previewUrl: row.previewUrl ?? null,
    originUrl: row.originUrl ?? null,
    altText: row.altText ?? null,
    notes: row.notes ?? null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function toolCategoryData(row, parentId = null) {
  return stripUndefined({
    id: row.id,
    siteId,
    parentId,
    slug: row.slug,
    label: row.label,
    description: row.description ?? null,
    icon: row.icon ?? row.iconName ?? null,
    sortOrder: row.sortOrder ?? 0,
    status: row.status ?? "active",
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function toolMenuItemData(row) {
  return stripUndefined({
    id: row.id,
    siteId,
    categoryId: row.categoryId ?? null,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    badge: row.badge ?? null,
    icon: row.icon ?? null,
    imageUrl: row.imageUrl ?? null,
    href: row.href,
    detailJson: row.detailJson ? clone(row.detailJson) : undefined,
    sortOrder: row.sortOrder ?? 0,
    status: row.status ?? "active",
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function videoThemeCategoryData(row) {
  return stripUndefined({
    id: row.id,
    siteId,
    slug: row.slug,
    label: row.label,
    description: row.description ?? null,
    imageUrl: row.imageUrl ?? null,
    sortOrder: row.sortOrder ?? 0,
    status: row.status ?? "active",
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function videoThemeData(row) {
  return stripUndefined({
    id: row.id,
    siteId,
    categoryId: row.categoryId ?? null,
    slug: row.slug,
    name: row.name,
    headline: row.headline,
    description: row.description,
    prompt: row.prompt,
    status: row.status ?? "draft",
    creditCost: row.creditCost ?? 0,
    modelPricing: row.modelPricing ? clone(row.modelPricing) : undefined,
    durationSeconds: row.durationSeconds ?? 6,
    maxFrames: row.maxFrames ?? 30,
    generationCount: row.generationCount ?? 0,
    imageUrl: row.imageUrl ?? null,
    galleryImages: row.galleryImages ? clone(row.galleryImages) : undefined,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function siteThemeData(row) {
  return stripUndefined({
    id: row.id,
    siteId,
    name: row.name,
    themeId: row.themeId,
    themeKey: row.themeKey,
    status: row.status,
    templates: json(row.templates),
    settings: json(row.settings),
    source: row.source,
    createdBy: row.createdBy,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function themeCopyData(row) {
  return stripUndefined({
    id: row.id,
    siteId,
    name: row.name,
    themeKey: row.themeKey,
    source: row.source,
    templates: json(row.templates),
    settings: json(row.settings),
    createdBy: row.createdBy,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt)
  });
}

function publicationData(row, records) {
  return stripUndefined({
    id: row.id,
    siteId,
    version: row.version,
    snapshot: json(row.snapshot),
    pageCount: row.pageCount ?? row.snapshot?.pages?.length ?? records.pages.length,
    sectionCount:
      row.sectionCount ??
      records.pages.reduce((sum, page) => sum + Object.keys(page.publishedJson?.sections ?? {}).length, 0),
    snapshotBytes: row.snapshotBytes ?? Buffer.byteLength(JSON.stringify(row.snapshot ?? {}), "utf8"),
    publishedBy: row.publishedBy ?? "system",
    publishedAt: toDate(row.publishedAt)
  });
}

function selectActivePublicationId(records, retainedPublicationId) {
  const sourceActiveId = records.activePublicationId;
  if (sourceActiveId && records.publications.some((publication) => publication.id === sourceActiveId)) {
    return sourceActiveId;
  }
  if (retainedPublicationId && records.publications.some((publication) => publication.id === retainedPublicationId)) {
    return retainedPublicationId;
  }
  const latestPublication = [...records.publications].sort((left, right) => {
    const versionDelta = (right.version ?? 0) - (left.version ?? 0);
    if (versionDelta !== 0) return versionDelta;
    return String(right.publishedAt ?? "").localeCompare(String(left.publishedAt ?? ""));
  })[0];
  return latestPublication?.id ?? null;
}

function summarize(records) {
  return {
    domains: records.domains.length,
    themeSettings: records.settings ? 1 : 0,
    pages: records.pages.length,
    publications: records.publications.length,
    siteThemes: records.siteThemes.length,
    themeCopies: records.themeCopies.length,
    products: records.products.length,
    prices: records.products.reduce((sum, product) => sum + asArray(product.prices).length, 0),
    siteAiApps: records.siteAiApps.length,
    aiGatewayGroups: records.aiGatewayGroups.length,
    creativePackCategories: records.creativePackCategories.length,
    creativePacks: records.creativePacks.length,
    mediaAssets: records.mediaAssets.length,
    toolCategories: records.toolCategories.length,
    toolMenuItems: records.toolMenuItems.length,
    videoThemeCategories: records.videoThemeCategories.length,
    videoThemes: records.videoThemes.length
  };
}

function collectionIds(rows) {
  return unique(asArray(rows).map((row) => row.id));
}

function excludingSourceIds(ids) {
  return ids.length > 0 ? { siteId, id: { notIn: ids } } : { siteId };
}

async function upsertById(model, data) {
  await model.upsert({
    where: { id: data.id },
    create: data,
    update: noId(data)
  });
  return data.id;
}

async function upsertBySiteSlug(model, data) {
  const existing = await model.findFirst({ where: { siteId, slug: data.slug } });
  if (existing && existing.id !== data.id) {
    await model.update({ where: { id: existing.id }, data: noId(data) });
    return existing.id;
  }
  await upsertById(model, data);
  return data.id;
}

async function upsertSiteTheme(tx, data) {
  const existing = await tx.siteTheme.findUnique({
    where: {
      siteId_themeId: {
        siteId: data.siteId,
        themeId: data.themeId
      }
    }
  });
  if (existing && existing.id !== data.id) {
    await tx.siteTheme.update({ where: { id: existing.id }, data: noId(data) });
    return existing.id;
  }
  await upsertById(tx.siteTheme, data);
  return data.id;
}

async function backupScopedPublicState(tx) {
  const site = await tx.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      settings: true,
      storefrontProfile: true,
      pages: true,
      publications: true,
      siteThemes: true,
      themeCopies: true,
      products: { include: { prices: true } },
      aiApps: { include: { aiApp: true } },
      gatewayGroups: true,
      creativePackCategories: true,
      creativePacks: true,
      mediaAssets: true,
      toolCategories: true,
      toolMenuItems: true,
      videoThemeCategories: true,
      videoThemes: true
    }
  });
  const document = await tx.platformStateDocument.findUnique({ where: { id: DOCUMENT_ID } });
  return {
    createdAt: new Date().toISOString(),
    siteId,
    scope: [
      "Site",
      "SiteDomain",
      "ThemeSettings",
      "ThemePage",
      "ThemePublication",
      "SiteTheme",
      "ThemeCopy",
      "Product/Price",
      "CreativePack*",
      "Tool*",
      "VideoTheme*",
      "MediaAsset",
      "SiteAiApp",
      "AiGatewayGroup",
      "PlatformStateDocument site-scoped public rows"
    ],
    excluded:
      "SiteAdmin, Customer, CustomerSession, Order, PaymentEvent, Subscription, CreditLedger, CreditBalance, Album, GenerationJob, AssetUpload, CustomerModel",
    site,
    platformStateDocument: document ? { id: document.id, state: scopedDocumentSlice(document.state) } : null
  };
}

function scopedDocumentSlice(state) {
  if (!state || typeof state !== "object") return null;
  const pickRows = (key) => asArray(state[key]).filter((row) => row?.siteId === siteId);
  return {
    site: asArray(state.sites).find((row) => row?.id === siteId) ?? null,
    siteDomains: pickRows("siteDomains"),
    products: pickRows("products"),
    siteAiApps: pickRows("siteAiApps"),
    aiGatewayGroups: pickRows("aiGatewayGroups"),
    creativePackCategories: pickRows("creativePackCategories"),
    creativePacks: pickRows("creativePacks"),
    mediaAssets: pickRows("mediaAssets"),
    siteThemes: pickRows("siteThemes"),
    themeCopies: pickRows("themeCopies"),
    themePublications: pickRows("themePublications"),
    toolCategories: pickRows("toolCategories"),
    toolMenuItems: pickRows("toolMenuItems"),
    videoThemeCategories: pickRows("videoThemeCategories"),
    videoThemes: pickRows("videoThemes")
  };
}

function nextDocumentState(currentState, sourceState, records) {
  const next = clone(currentState && typeof currentState === "object" ? currentState : sourceState);
  const siteForDocument = {
    ...clone(records.site),
    themeSettings: records.settings
      ? {
          draftJson: clone(records.settings.draftJson),
          publishedJson: clone(records.settings.publishedJson)
        }
      : undefined,
    pages: clone(records.pages),
    siteDomains: clone(records.domains),
    products: clone(records.products),
    siteAiApps: clone(records.siteAiApps),
    aiGatewayGroups: clone(records.aiGatewayGroups),
    creativePackCategories: clone(records.creativePackCategories),
    creativePacks: clone(records.creativePacks),
    mediaAssets: clone(records.mediaAssets),
    siteThemes: clone(records.siteThemes),
    themeCopies: clone(records.themeCopies),
    themePublications: clone(records.publications),
    toolCategories: clone(records.toolCategories),
    toolMenuItems: clone(records.toolMenuItems),
    videoThemeCategories: clone(records.videoThemeCategories),
    videoThemes: clone(records.videoThemes)
  };

  if (!Array.isArray(next.sites)) next.sites = [];
  next.sites = [...next.sites.filter((row) => row?.id !== siteId), siteForDocument];

  const replaceSiteRows = (key, rows) => {
    if (!Array.isArray(next[key])) next[key] = [];
    next[key] = [...next[key].filter((row) => row?.siteId !== siteId), ...clone(rows)];
  };
  replaceSiteRows("siteDomains", records.domains);
  replaceSiteRows("products", records.products);
  replaceSiteRows("siteAiApps", records.siteAiApps);
  replaceSiteRows("aiGatewayGroups", records.aiGatewayGroups);
  replaceSiteRows("creativePackCategories", records.creativePackCategories);
  replaceSiteRows("creativePacks", records.creativePacks);
  replaceSiteRows("mediaAssets", records.mediaAssets);
  replaceSiteRows("siteThemes", records.siteThemes);
  replaceSiteRows("themeCopies", records.themeCopies);
  replaceSiteRows("themePublications", records.publications);
  replaceSiteRows("toolCategories", records.toolCategories);
  replaceSiteRows("toolMenuItems", records.toolMenuItems);
  replaceSiteRows("videoThemeCategories", records.videoThemeCategories);
  replaceSiteRows("videoThemes", records.videoThemes);
  return next;
}

async function trustedLogoSummary(records) {
  const sourceHome =
    records.pages.find((page) => page.slug === "/" || page.pageType === "home") ??
    records.pages.find((page) => page.id?.includes("home"));
  const sourcePublished = [...collectTrustedLogoUrls(sourceHome?.publishedJson)].sort();
  const sourceDraft = [...collectTrustedLogoUrls(sourceHome?.draftJson)].sort();
  const databaseHome = await prisma.themePage.findFirst({
    where: { siteId, OR: [{ slug: "/" }, { pageType: "home" }] },
    orderBy: [{ slug: "asc" }]
  });
  const databasePublished = [...collectTrustedLogoUrls(databaseHome?.publishedJson)].sort();
  const databaseDraft = [...collectTrustedLogoUrls(databaseHome?.draftJson)].sort();
  return {
    sourcePublishedCount: sourcePublished.length,
    databasePublishedCount: databasePublished.length,
    sourcePublishedFirst: sourcePublished.slice(0, 8),
    databasePublishedFirst: databasePublished.slice(0, 8),
    wouldAddFirst: sourcePublished.filter((url) => !databasePublished.includes(url)).slice(0, 8),
    wouldRemoveFirst: databasePublished.filter((url) => !sourcePublished.includes(url)).slice(0, 8),
    sourceDraftCount: sourceDraft.length,
    databaseDraftCount: databaseDraft.length
  };
}

async function writePublicState(tx, sourceState, records) {
  const currentActivePublication = await tx.activeThemePublication.findUnique({ where: { siteId } });
  const retainedPublicationId = currentActivePublication?.publicationId ?? null;
  await tx.site.upsert({
    where: { id: siteId },
    create: stripUndefined({
      id: siteId,
      name: records.site.name,
      slug: records.site.slug,
      status: records.site.status,
      primaryDomain: records.site.primaryDomain,
      timezone: records.site.timezone,
      currency: records.site.currency,
      signupCreditGrant: records.site.signupCreditGrant,
      branding: json(records.site.branding),
      createdAt: toDate(records.site.createdAt),
      updatedAt: toDate(records.site.updatedAt)
    }),
    update: stripUndefined({
      name: records.site.name,
      slug: records.site.slug,
      status: records.site.status,
      primaryDomain: records.site.primaryDomain,
      timezone: records.site.timezone,
      currency: records.site.currency,
      signupCreditGrant: records.site.signupCreditGrant,
      branding: json(records.site.branding),
      updatedAt: toDate(records.site.updatedAt)
    })
  });

  const domainNames = unique(records.domains.map((domain) => domain.domain));
  for (const domain of records.domains) {
    const existing = await tx.siteDomain.findUnique({ where: { domain: domain.domain } });
    if (existing && existing.siteId !== siteId) {
      throw new Error(`domain ${domain.domain} belongs to ${existing.siteId}; refusing to move it`);
    }
  }
  await tx.siteDomain.deleteMany({ where: { siteId, domain: { notIn: domainNames } } });
  for (const domain of records.domains) {
    const data = stripUndefined({
      id: domain.id,
      siteId,
      domain: domain.domain,
      isPrimary: Boolean(domain.isPrimary),
      status: domain.status,
      allowedAiProviderIds: asArray(domain.allowedAiProviderIds),
      createdAt: toDate(domain.createdAt),
      updatedAt: toDate(domain.updatedAt)
    });
    const existing = await tx.siteDomain.findUnique({ where: { domain: data.domain } });
    if (existing) {
      await tx.siteDomain.update({ where: { id: existing.id }, data: noId(data) });
    } else {
      await upsertById(tx.siteDomain, data);
    }
  }

  if (records.settings) {
    await tx.themeSettings.upsert({
      where: { siteId },
      create: records.settings,
      update: {
        draftJson: records.settings.draftJson,
        publishedJson: records.settings.publishedJson
      }
    });
  }

  if (records.storefrontProfile) {
    await tx.storefrontProfile.upsert({
      where: { siteId },
      create: {
        id: records.storefrontProfile.id ?? `profile_${siteId}`,
        siteId,
        draftJson: json(records.storefrontProfile.draftJson),
        publishedJson: json(records.storefrontProfile.publishedJson),
        draftMeta: records.storefrontProfile.draftMeta ? json(records.storefrontProfile.draftMeta) : null
      },
      update: {
        draftJson: json(records.storefrontProfile.draftJson),
        publishedJson: json(records.storefrontProfile.publishedJson),
        draftMeta: records.storefrontProfile.draftMeta ? json(records.storefrontProfile.draftMeta) : null
      }
    });
  }

  const pageIds = collectionIds(records.pages);
  await tx.themePage.deleteMany({ where: { siteId, id: { notIn: pageIds } } });
  for (const page of records.pages) await upsertById(tx.themePage, pageData(page));

  await tx.activeThemePublication.deleteMany({ where: { siteId } });
  await tx.themePublication.deleteMany({ where: { siteId } });
  for (const publication of records.publications) {
    await tx.themePublication.create({ data: publicationData(publication, records) });
  }
  const nextActivePublicationId = selectActivePublicationId(records, retainedPublicationId);
  if (nextActivePublicationId) {
    const activeExists = records.publications.some((publication) => publication.id === nextActivePublicationId);
    if (!activeExists) {
      throw new Error(`active publication ${nextActivePublicationId} is not present in source records`);
    }
    await tx.activeThemePublication.upsert({
      where: { siteId },
      create: {
        siteId,
        publicationId: nextActivePublicationId,
        activatedBy: "sync-grownstride-test-public-state",
        activatedAt: new Date()
      },
      update: {
        publicationId: nextActivePublicationId,
        activatedBy: "sync-grownstride-test-public-state",
        activatedAt: new Date()
      }
    });
  }

  const siteThemeIds = collectionIds(records.siteThemes);
  await tx.siteTheme.updateMany({ where: excludingSourceIds(siteThemeIds), data: { status: "archived" } });
  for (const theme of records.siteThemes) await upsertSiteTheme(tx, siteThemeData(theme));

  const themeCopyIds = collectionIds(records.themeCopies);
  await tx.themeCopy.deleteMany({ where: excludingSourceIds(themeCopyIds) });
  for (const copyRecord of records.themeCopies) await upsertById(tx.themeCopy, themeCopyData(copyRecord));

  const productIds = collectionIds(records.products);
  await tx.product.updateMany({ where: excludingSourceIds(productIds), data: { status: "archived" } });
  for (const product of records.products) {
    await upsertById(tx.product, productData(product));
    for (const price of asArray(product.prices)) {
      const data = priceData(price, product.id);
      const existingByStripe = data.stripePriceId
        ? await tx.price.findFirst({ where: { siteId, stripePriceId: data.stripePriceId } })
        : null;
      if (existingByStripe && existingByStripe.id !== data.id) {
        await tx.price.update({ where: { id: existingByStripe.id }, data: noId(data) });
      } else {
        await upsertById(tx.price, data);
      }
    }
  }

  const siteAiAppIds = collectionIds(records.siteAiApps);
  await tx.siteAiApp.deleteMany({ where: excludingSourceIds(siteAiAppIds) });
  for (const row of records.siteAiApps) {
    if (row.aiApp) await upsertById(tx.aiApp, aiAppData(row.aiApp));
    await upsertById(tx.siteAiApp, siteAiAppData(row));
  }

  const gatewayIds = collectionIds(records.aiGatewayGroups);
  await tx.aiGatewayGroup.deleteMany({ where: excludingSourceIds(gatewayIds) });
  for (const group of records.aiGatewayGroups) {
    const existing = await tx.aiGatewayGroup.findUnique({ where: { id: group.id } });
    const data = aiGatewayGroupData(group, { preserveUsedQuota: Boolean(existing) });
    await upsertById(tx.aiGatewayGroup, data);
  }

  const creativeCategoryIds = collectionIds(records.creativePackCategories);
  await tx.creativePackCategory.updateMany({
    where: excludingSourceIds(creativeCategoryIds),
    data: { status: "archived", parentId: null }
  });
  const creativeCategoryIdMap = new Map();
  for (const category of records.creativePackCategories) {
    const actualId = await upsertBySiteSlug(tx.creativePackCategory, creativePackCategoryData(category, null));
    creativeCategoryIdMap.set(category.id, actualId);
  }
  for (const category of records.creativePackCategories.filter((item) => item.parentId)) {
    const actualId = creativeCategoryIdMap.get(category.id);
    const actualParentId = creativeCategoryIdMap.get(category.parentId);
    if (actualId && actualParentId) {
      await tx.creativePackCategory.update({ where: { id: actualId }, data: { parentId: actualParentId } });
    }
  }

  const creativePackIds = collectionIds(records.creativePacks);
  await tx.creativePack.updateMany({ where: excludingSourceIds(creativePackIds), data: { status: "archived" } });
  for (const pack of records.creativePacks) {
    await upsertById(
      tx.creativePack,
      creativePackData({
        ...pack,
        categoryId: pack.categoryId ? creativeCategoryIdMap.get(pack.categoryId) ?? pack.categoryId : null
      })
    );
  }

  const mediaAssetIds = collectionIds(records.mediaAssets);
  await tx.mediaAsset.deleteMany({ where: excludingSourceIds(mediaAssetIds) });
  for (const asset of records.mediaAssets) {
    const data = mediaAssetData(asset);
    const existingByStorageKey = await tx.mediaAsset.findFirst({ where: { siteId, storageKey: data.storageKey } });
    if (existingByStorageKey && existingByStorageKey.id !== data.id) {
      await tx.mediaAsset.update({ where: { id: existingByStorageKey.id }, data: noId(data) });
    } else {
      await upsertById(tx.mediaAsset, data);
    }
  }

  const toolCategoryIds = collectionIds(records.toolCategories);
  await tx.toolCategory.updateMany({
    where: excludingSourceIds(toolCategoryIds),
    data: { status: "archived", parentId: null }
  });
  const toolCategoryIdMap = new Map();
  for (const category of records.toolCategories) {
    const actualId = await upsertBySiteSlug(tx.toolCategory, toolCategoryData(category, null));
    toolCategoryIdMap.set(category.id, actualId);
  }
  for (const category of records.toolCategories.filter((item) => item.parentId)) {
    const actualId = toolCategoryIdMap.get(category.id);
    const actualParentId = toolCategoryIdMap.get(category.parentId);
    if (actualId && actualParentId) {
      await tx.toolCategory.update({ where: { id: actualId }, data: { parentId: actualParentId } });
    }
  }

  const toolMenuItemIds = collectionIds(records.toolMenuItems);
  await tx.toolMenuItem.updateMany({ where: excludingSourceIds(toolMenuItemIds), data: { status: "archived" } });
  for (const item of records.toolMenuItems) {
    await upsertBySiteSlug(
      tx.toolMenuItem,
      toolMenuItemData({
        ...item,
        categoryId: item.categoryId ? toolCategoryIdMap.get(item.categoryId) ?? item.categoryId : null
      })
    );
  }

  const videoCategoryIds = collectionIds(records.videoThemeCategories);
  await tx.videoThemeCategory.updateMany({ where: excludingSourceIds(videoCategoryIds), data: { status: "archived" } });
  const videoCategoryIdMap = new Map();
  for (const category of records.videoThemeCategories) {
    const actualId = await upsertBySiteSlug(tx.videoThemeCategory, videoThemeCategoryData(category));
    videoCategoryIdMap.set(category.id, actualId);
  }

  const videoThemeIds = collectionIds(records.videoThemes);
  await tx.videoTheme.updateMany({ where: excludingSourceIds(videoThemeIds), data: { status: "archived" } });
  for (const theme of records.videoThemes) {
    await upsertBySiteSlug(
      tx.videoTheme,
      videoThemeData({
        ...theme,
        categoryId: theme.categoryId ? videoCategoryIdMap.get(theme.categoryId) ?? theme.categoryId : null
      })
    );
  }

  const existingDocument = await tx.platformStateDocument.findUnique({ where: { id: DOCUMENT_ID } });
  const nextState = nextDocumentState(existingDocument?.state, sourceState, records);
  await tx.platformStateDocument.upsert({
    where: { id: DOCUMENT_ID },
    create: { id: DOCUMENT_ID, state: nextState },
    update: { state: nextState }
  });
}

function removeStateCaches() {
  const removed = [];
  for (const cacheFile of cacheFiles) {
    if (fs.existsSync(cacheFile)) {
      fs.rmSync(cacheFile, { force: true });
      removed.push(cacheFile);
    }
  }
  return removed;
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }
  if (applyRequested && confirmation !== CONFIRM_PHRASE) {
    throw new Error(`--apply requires --confirm ${CONFIRM_PHRASE}`);
  }
  if (siteId !== DEFAULT_SITE_ID) {
    throw new Error(`refusing to sync non-test site: ${siteId}`);
  }
  const sourceState = statePath ? JSON.parse(fs.readFileSync(statePath, "utf8")) : null;
  let records;
  let sourceLabel;
  if (sourceState) {
    records = scopedRows(sourceState);
    sourceLabel = path.relative(process.cwd(), statePath);
  } else {
    const sourceRuntime = await prisma.site.findUnique({
      where: { id: DEFAULT_SITE_ID },
      include: {
        domains: true,
        settings: true,
        storefrontProfile: true,
        pages: { orderBy: { slug: "asc" } },
        publications: { orderBy: { version: "asc" } },
        siteThemes: { orderBy: { updatedAt: "asc" } },
        themeCopies: { orderBy: { updatedAt: "asc" } },
        products: { include: { prices: true }, orderBy: { createdAt: "asc" } },
        aiApps: { include: { aiApp: true }, orderBy: { routeKey: "asc" } },
        gatewayGroups: { orderBy: { name: "asc" } },
        creativePackCategories: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] },
        creativePacks: { orderBy: { createdAt: "asc" } },
        mediaAssets: { orderBy: { createdAt: "asc" } },
        toolCategories: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] },
        toolMenuItems: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
        videoThemeCategories: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
        videoThemes: { orderBy: [{ createdAt: "asc" }, { slug: "asc" }] }
      }
    });
    if (!sourceRuntime) throw new Error(`source site not found in database: ${DEFAULT_SITE_ID}`);
    const source = {
      ...sourceRuntime,
      themeSettings: sourceRuntime.settings ? { draftJson: sourceRuntime.settings.draftJson, publishedJson: sourceRuntime.settings.publishedJson } : undefined,
      siteAiApps: sourceRuntime.aiApps,
      aiGatewayGroups: sourceRuntime.gatewayGroups,
      themePublications: sourceRuntime.publications
    };
    records = scopedRows({
      sites: [source],
      siteDomains: sourceRuntime.domains,
      themeSettings: source.themeSettings,
      storefrontProfile: sourceRuntime.storefrontProfile,
      prices: sourceRuntime.products.flatMap((product) => product.prices ?? []),
      products: sourceRuntime.products,
      siteAiApps: sourceRuntime.aiApps,
      aiGatewayGroups: sourceRuntime.gatewayGroups,
      creativePackCategories: sourceRuntime.creativePackCategories,
      creativePacks: sourceRuntime.creativePacks,
      mediaAssets: sourceRuntime.mediaAssets,
      toolCategories: sourceRuntime.toolCategories,
      toolMenuItems: sourceRuntime.toolMenuItems,
      videoThemeCategories: sourceRuntime.videoThemeCategories,
      videoThemes: sourceRuntime.videoThemes,
      themePublications: sourceRuntime.publications,
      siteThemes: sourceRuntime.siteThemes,
      themeCopies: sourceRuntime.themeCopies
    });
    sourceLabel = "database";
  }
  const sourceDomains = unique(records.domains.map((domain) => domain.domain));
  if (!sourceDomains.includes(DEFAULT_DOMAIN) && records.site.primaryDomain !== DEFAULT_DOMAIN) {
    throw new Error(`source state for ${siteId} does not include ${DEFAULT_DOMAIN}`);
  }

  const beforeTrustedLogos = await trustedLogoSummary(records);
  const summary = summarize(records);
  const guard = {
    writeEnabled: !dryRun,
    siteId,
    expectedDomain: DEFAULT_DOMAIN,
    requiredConfirm: CONFIRM_PHRASE,
    excluded:
      "test users, orders, payment events, subscriptions, generation jobs, albums, uploads, sessions, customer assets, ledgers"
  };

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "dry-run",
          guard,
          source: sourceLabel,
          summary,
          trustedLogos: beforeTrustedLogos
        },
        null,
        2
      )
    );
    return;
  }

  const backupDir = process.env.SYNC_BACKUP_DIR ?? path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(
    backupDir,
    `grownstride-test-public-state-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const timeout = Number.isFinite(transactionTimeoutMs) && transactionTimeoutMs > 0 ? transactionTimeoutMs : 600000;

  const result = await prisma.$transaction(
    async (tx) => {
      const backup = await backupScopedPublicState(tx);
      fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });
      await writePublicState(tx, sourceState, records);
      return {
        backupPath,
        beforeSummary: summarize({
          ...records,
          domains: backup.site?.domains ?? [],
          settings: backup.site?.settings ?? null,
          pages: backup.site?.pages ?? [],
          publications: backup.site?.publications ?? [],
          siteThemes: backup.site?.siteThemes ?? [],
          themeCopies: backup.site?.themeCopies ?? [],
          products: backup.site?.products ?? [],
          siteAiApps: backup.site?.aiApps ?? [],
          aiGatewayGroups: backup.site?.gatewayGroups ?? [],
          creativePackCategories: backup.site?.creativePackCategories ?? [],
          creativePacks: backup.site?.creativePacks ?? [],
          mediaAssets: backup.site?.mediaAssets ?? [],
          toolCategories: backup.site?.toolCategories ?? [],
          toolMenuItems: backup.site?.toolMenuItems ?? [],
          videoThemeCategories: backup.site?.videoThemeCategories ?? [],
          videoThemes: backup.site?.videoThemes ?? []
        })
      };
    },
    { timeout }
  );

  const removedCacheFiles = removeStateCaches();
  const afterTrustedLogos = await trustedLogoSummary(records);
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "apply",
        guard,
        source: sourceLabel,
        summary,
        backupPath,
        beforeSummary: result.beforeSummary,
        removedCacheFiles,
        trustedLogos: {
          before: beforeTrustedLogos,
          after: afterTrustedLogos
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
