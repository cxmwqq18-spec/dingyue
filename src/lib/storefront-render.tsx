import { notFound, redirect } from "next/navigation";
import { cache, type ReactElement } from "react";
import { CustomerAccountClientPage, CustomerWorkspaceClientPage } from "@/components/storefront/customer-bootstrap-client";
import { StorefrontJsonLd } from "@/components/storefront/storefront-json-ld";
import { ThemeRenderer, ThemeSectionFrame, searchPageEntriesForSite, type StorefrontSectionPayload, type RoutedSite } from "@/components/theme-renderer";
import { findPage, getPage } from "@/lib/data";
import { authMessageForCode } from "@/lib/auth-messages";
import { getCustomerAdminAccessForSite } from "@/lib/customer-admin-access";
import { prisma } from "@/lib/prisma";
import { preferLocalPathModeState, readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { isMydreamshootsContentSourceSite, isMydreamshootsContentSourceSlug } from "@/lib/storefront-content-source-policy";
import {
  getCustomerBySessionFromState,
  getCustomerJobAssetsFromState,
  getCustomerLedgerFromState,
  getSiteAppsFromState,
  getSiteCreativePacksFromState,
  getSiteMediaAssetsFromState,
  getSiteProductsFromState,
  getThemeRuntimeForCustomer,
  toThemeRuntimeAsset,
  toThemeRuntimeJob,
  toThemeRuntimeLedgerEntry
} from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";
import {
  readStorefrontCustomerRuntimeStateForSiteFromDatabase,
  readStorefrontPlatformState,
  readStorefrontPublicRuntimeStateBySlugFromDatabase,
  readStorefrontRuntimeStateForSiteFromDatabase
} from "@/lib/storefront-state";
import { toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { getCustomerAccountSummaryRuntimeRelational } from "@/lib/stores/customer-account-runtime";
import { toAssetUploadRelational, toCustomerModelRelational } from "@/lib/stores/prisma-mappers";
import { getCustomerWorkspaceBootstrapRelational, getCustomerWorkspaceSiteShellRelational, getSiteIdBySlugRelational, getStorefrontPublicCreativePacksForSite, getStorefrontPublicVideoThemesForSite as getCachedPublicVideoThemesForSite } from "@/lib/stores/site-store";
import { readWorkspaceJobSummariesRelational, WORKSPACE_RELATED_JOB_SUMMARY_LIMIT, WORKSPACE_VIDEO_FRAME_ASSET_LIMIT } from "@/lib/workspace-runtime-jobs";
import { themeStyleVars } from "@/lib/theme";
import { canonicalSiteSlug, publicSiteSlug } from "@/lib/domain-routing";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { canonicalSeoDirectorySlugForSite, getExplicitSeoDirectorySlugsForSite, getSeoDirectoryContentForSite, isExplicitSeoDirectoryContentForSite, withSeoDirectorySection } from "@/lib/dreamshoot-seo-content";
import { buildCollectionDirectoryJsonLd, buildStorefrontJsonLd, buildToolDirectoryJsonLd, type JsonLdNode } from "@/lib/theme/json-ld";
import { dreamshootAiStudioTemplates, dreamshootAiStudioTemplatesForSite } from "@/lib/theme/packages/dreamshoot-ai-studio";
import { getAidreamcapesPolicySeo, getMydreamshootsPolicySeo, getSpanishXbyPolicySeo, type PolicySeoCopy } from "@/lib/theme/policy-seo";
import type { CreativePack, CreativePackCategory, CustomerSession, MediaAsset, PlatformState, Price, Product, PublicCustomer, SectionBlockInstance, SectionInstance, Site, SiteAiApp, ThemePage, ThemePageJson, ThemeRuntimeData, ToolMenuItem, VideoTheme } from "@/lib/types";

const jobDetailSlug = "/app/jobs/detail";
const dreamshootPartnerTemplateSlugs = new Set(["/workflow", "/faq", "/creators-circle", "/partner-registration", "/about-us", "/contact-us"]);

type SiteRenderData = {
  creativePackCategories: CreativePackCategory[];
  creativePacks: ReturnType<typeof getSiteCreativePacksFromState>;
  mediaAssets: ReturnType<typeof getSiteMediaAssetsFromState>;
  products: ReturnType<typeof getSiteProductsFromState>;
  siteAiApps: ReturnType<typeof getSiteAppsFromState>;
  toolMenuItems: PlatformState["toolMenuItems"];
  videoThemes: VideoTheme[];
};

const storefrontMediaReferenceKeys = new Set([
  "avatarUrl",
  "backgroundImage",
  "beforeImage",
  "bg_image",
  "galleryImages",
  "image",
  "imageUrl",
  "leadImageUrl",
  "logoImageUrl",
  "mediaAssetId",
  "mobile_src",
  "resultImageUrl",
  "secondaryImageUrl",
  "src"
]);

function isStorefrontMediaReferenceKey(key: string): boolean {
  return storefrontMediaReferenceKeys.has(key) || /^image\d*$/i.test(key) || /^src\d*$/i.test(key);
}

function getSiteRenderData(state: PlatformState, siteId: string): SiteRenderData {
  return {
    creativePackCategories: (state.creativePackCategories ?? []).filter((category) => category.siteId === siteId),
    creativePacks: (state.creativePacks ?? []).filter((pack) => pack.siteId === siteId),
    mediaAssets: (state.mediaAssets ?? []).filter((asset) => asset.siteId === siteId),
    products: (state.products ?? []).filter((product) => product.siteId === siteId),
    siteAiApps: (state.siteAiApps ?? []).filter((app) => app.siteId === siteId),
    toolMenuItems: (state.toolMenuItems ?? []).filter((item) => item.siteId === siteId),
    videoThemes: (state.videoThemes ?? []).filter((theme) => theme.siteId === siteId)
  };
}

function emptySiteRenderData(): SiteRenderData {
  return {
    creativePackCategories: [],
    creativePacks: [],
    mediaAssets: [],
    products: [],
    siteAiApps: [],
    toolMenuItems: [],
    videoThemes: []
  };
}

function trimToolDetailRenderData(renderData: SiteRenderData): SiteRenderData {
  return {
    creativePackCategories: [],
    creativePacks: renderData.creativePacks.slice(0, 12).map((pack) => ({
      ...pack,
      prompt: undefined,
      galleryImages: []
    })),
    mediaAssets: [],
    products: [],
    siteAiApps: renderData.siteAiApps.slice(0, 8).map((siteApp) => ({
      ...siteApp,
      providerConfig: undefined,
      workflowConfig: undefined,
      aiApp: {
        ...siteApp.aiApp,
        parameterSchema: []
      }
    })),
    toolMenuItems: renderData.toolMenuItems.slice(0, 24),
    videoThemes: []
  };
}

const productSectionTypes = new Set(["cart_summary", "dreamshoot_generation_showcase", "pricing_table", "product_detail", "products", "products_plus", "search_results"]);
const siteAiAppSectionTypes = new Set(["ai_tool_entry", "ai_tool_grid", "aidreamcapes_tool_collection", "generation_form", "search_results"]);
const creativePackSectionTypes = new Set(["aidreamcapes_package_catalog", "aidreamcapes_package_taxonomy", "collection_list_plus", "dreamshoot_generation_showcase", "dreamshoot_package_catalog", "dreamshoot_package_taxonomy", "dreamshoot_related_packages", "dreamshoot_theme_cta", "dreamshoot_theme_faq", "photo_package_wall", "products", "products_plus", "search_results"]);
const toolMenuItemSectionTypes = new Set(["aidreamcapes_tool_collection", "dreamshoot_tool_collection", "search_results"]);
const videoThemeSectionTypes = new Set(["dreamshoot_generation_showcase"]);
const customerRuntimeSectionTypes = new Set(["album_gallery", "cart_summary", "generation_form", "job_detail", "job_progress", "login_method_panel", "upload_panel"]);
const publicHomePackLimit = 12;
const publicDirectoryPackLimit = 128;
const publicToolLimit = 96;

function pageSectionTypes(pageJson: ThemePageJson): Set<string> {
  return new Set(pageJson.sectionsOrder.map((sectionId) => pageJson.sections[sectionId]?.type).filter((type): type is string => Boolean(type)));
}

function publicStorefrontToken(value: string, prefixes: string[]): string {
  let next = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  for (const prefix of prefixes) {
    const normalizedPrefix = prefix
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (next.startsWith(`${normalizedPrefix}-`)) next = next.slice(normalizedPrefix.length + 1);
  }
  return next;
}

function publicCreativePackToken(pack: CreativePack): string {
  return publicStorefrontToken(pack.id || pack.name, ["pack_mydreamshoots_xby", "pack_aidreamcapes_xby", "pack_dreamshoot", "pack_aidreamcapes"]);
}

function resolveInitialCreativePackId(rawPack: string | undefined, packs: CreativePack[]): string | undefined {
  if (!rawPack) return undefined;
  const normalized = publicStorefrontToken(rawPack, []);
  const match = packs.find((pack) => {
    if (pack.status !== "active") return false;
    return pack.id === rawPack || publicStorefrontToken(pack.id, []) === normalized || publicCreativePackToken(pack) === normalized;
  });
  return match?.id ?? rawPack;
}

function limitedCreativePacks(packs: SiteRenderData["creativePacks"], limit?: number): SiteRenderData["creativePacks"] {
  return typeof limit === "number" ? packs.slice(0, limit) : packs;
}

function trimCreativePacksForStorefront(renderData: SiteRenderData, limit?: number): SiteRenderData["creativePacks"] {
  return limitedCreativePacks(renderData.creativePacks, limit).map(lightweightCreativePack);
}

function trimCreativePackCategoriesForStorefront(renderData: SiteRenderData): CreativePackCategory[] {
  return renderData.creativePackCategories
    .filter((category) => category.status === "active")
    .map((category) => lightweightCategoryRecord(category))
    .filter((category): category is CreativePackCategory => Boolean(category));
}

async function completePublicCreativePacksForSite(site: Site, existing: SiteRenderData["creativePacks"], limit?: number): Promise<SiteRenderData["creativePacks"]> {
  const sanitizedExisting = existing.map(lightweightCreativePack);
  if (typeof limit === "number" && sanitizedExisting.length >= limit) return sanitizedExisting.slice(0, limit);
  if (typeof limit !== "number" && sanitizedExisting.length > 0) return sanitizedExisting;
  const fullPacks = (await getStorefrontPublicCreativePacksForSite(site.id, limit)).map(lightweightCreativePack);
  if (!fullPacks.length) return limitedCreativePacks(sanitizedExisting, limit);

  const fullPackIds = new Set(fullPacks.map((pack) => pack.id));
  const merged = [
    ...fullPacks,
    ...sanitizedExisting.filter((pack) => !fullPackIds.has(pack.id))
  ];
  return limitedCreativePacks(merged, limit);
}

function publicVideoThemesFromRenderData(siteId: string, existing: VideoTheme[], limit = 32): VideoTheme[] {
  return existing
    .filter((theme) => theme.siteId === siteId && theme.status === "active")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(0, limit)
    .map(lightweightVideoTheme);
}

async function loadStorefrontPublicVideoThemesForSection(site: Pick<Site, "id" | "slug">, existing: VideoTheme[], limit = 32): Promise<VideoTheme[]> {
  const localThemes = publicVideoThemesFromRenderData(site.id, existing, limit);
  if (preferLocalPathModeState(site.slug)) return localThemes;

  try {
    const themes = (await getCachedPublicVideoThemesForSite(site.id, limit)).map(lightweightVideoTheme);
    return themes.length ? themes : localThemes;
  } catch (error) {
    if (isMydreamshootsContentSourceSite(site)) throw error;
    return localThemes;
  }
}

function trimSiteAiAppsForStorefront(renderData: SiteRenderData, limit = publicToolLimit): SiteRenderData["siteAiApps"] {
  return renderData.siteAiApps.slice(0, limit).map(lightweightSiteAiApp);
}

function trimProductsForStorefront(renderData: SiteRenderData, limit = 8): SiteRenderData["products"] {
  const active = renderData.products.filter((product) => product.status === "active");
  return (active.length ? active : renderData.products).slice(0, limit).map(lightweightProduct);
}

function trimPricingProductsForStorefront(renderData: SiteRenderData, limit = 8): SiteRenderData["products"] {
  const active = renderData.products.filter((product) => product.status === "active");
  const source = active.length ? active : renderData.products;
  const subscriptions = source.filter((product) => product.type === "subscription");
  const subscriptionIds = new Set(subscriptions.map((product) => product.id));
  const remaining = source.filter((product) => !subscriptionIds.has(product.id));
  return [...subscriptions, ...remaining].slice(0, limit).map(lightweightProduct);
}

function lightweightPrice(price: Price): Price {
  return {
    id: price.id,
    siteId: price.siteId,
    productId: price.productId,
    label: price.label,
    amountCents: price.amountCents,
    currency: price.currency,
    interval: price.interval,
    creditsGranted: price.creditsGranted,
    stripePriceId: price.stripePriceId,
    metadata: price.metadata
  };
}

function lightweightProduct(product: Product): Product {
  return {
    id: product.id,
    siteId: product.siteId,
    name: product.name,
    type: product.type,
    status: product.status,
    prices: product.prices.map(lightweightPrice)
  };
}

function lightweightSiteAiApp(siteApp: SiteAiApp): SiteAiApp {
  return {
    id: siteApp.id,
    siteId: siteApp.siteId,
    enabled: siteApp.enabled,
    creditCost: siteApp.creditCost,
    routeKey: siteApp.routeKey,
    providerConfig: undefined,
    workflowConfig: undefined,
    aiApp: {
      id: siteApp.aiApp.id,
      slug: siteApp.aiApp.slug,
      name: siteApp.aiApp.name,
      description: siteApp.aiApp.description,
      appType: siteApp.aiApp.appType,
      parameterSchema: []
    }
  };
}

function lightweightCategoryRecord(category: CreativePack["categoryRecord"]): CreativePack["categoryRecord"] {
  if (!category) return undefined;
  return {
    id: category.id,
    siteId: category.siteId,
    parentId: category.parentId,
    parent: category.parent
      ? {
          id: category.parent.id,
          siteId: category.parent.siteId,
          parentId: category.parent.parentId,
          slug: category.parent.slug,
          label: category.parent.label,
          description: category.parent.description,
          icon: category.parent.icon,
          iconName: category.parent.iconName,
          imageUrl: category.parent.imageUrl,
          sortOrder: category.parent.sortOrder,
          status: category.parent.status,
          createdAt: ""
        }
      : undefined,
    slug: category.slug,
    label: category.label,
    description: category.description,
    heroTitle: category.heroTitle,
    heroSubtitle: category.heroSubtitle,
    icon: category.icon,
    iconName: category.iconName,
    imageUrl: category.imageUrl,
    sortOrder: category.sortOrder,
    status: category.status,
    createdAt: ""
  };
}

function lightweightCreativePack(pack: CreativePack): CreativePack {
  return {
    id: pack.id,
    siteId: pack.siteId,
    categoryId: pack.categoryId,
    name: pack.name,
    headline: pack.headline,
    description: pack.description,
    prompt: undefined,
    category: pack.category,
    aiAppSlug: pack.aiAppSlug,
    status: pack.status,
    creditCost: pack.creditCost,
    outputCount: pack.outputCount,
    trainingRequired: pack.trainingRequired,
    generationCount: pack.generationCount,
    conversionRate: pack.conversionRate,
    createdAt: "",
    imageUrl: pack.imageUrl,
    galleryImages: (pack.galleryImages ?? []).filter(Boolean).slice(0, 12),
    galleryImageAlts: (pack.galleryImageAlts ?? []).filter(Boolean).slice(0, 12),
    categoryRecord: lightweightCategoryRecord(pack.categoryRecord)
  };
}

function lightweightCreativePackForFocusedCollection(pack: CreativePack): CreativePack {
  return lightweightCreativePack(pack);
}

function lightweightCreativePackForNavigation(pack: CreativePack): CreativePack {
  return {
    id: pack.id,
    siteId: pack.siteId,
    categoryId: pack.categoryId,
    name: pack.name,
    headline: "",
    description: "",
    prompt: undefined,
    category: pack.category,
    aiAppSlug: pack.aiAppSlug,
    status: pack.status,
    creditCost: 0,
    outputCount: 0,
    trainingRequired: false,
    generationCount: 0,
    conversionRate: 0,
    createdAt: "",
    imageUrl: "",
    galleryImages: [],
    categoryRecord: lightweightCategoryRecord(pack.categoryRecord)
  };
}

function trimCreativePacksForNavigation(renderData: SiteRenderData): SiteRenderData["creativePacks"] {
  return renderData.creativePacks.map(lightweightCreativePackForNavigation);
}

function lightweightMediaAsset(asset: MediaAsset): MediaAsset {
  return {
    id: asset.id,
    siteId: asset.siteId,
    label: asset.label,
    storageKey: asset.storageKey,
    mimeType: asset.mimeType,
    usage: asset.usage,
    sourceType: asset.sourceType,
    previewUrl: asset.previewUrl,
    originUrl: asset.originUrl,
    altText: asset.altText,
    createdAt: ""
  };
}

function lightweightToolMenuItem(item: ToolMenuItem): ToolMenuItem {
  return {
    id: item.id,
    siteId: item.siteId,
    categoryId: item.categoryId,
    category: item.category,
    slug: item.slug,
    title: item.title,
    description: item.description,
    badge: item.badge,
    icon: item.icon,
    imageUrl: item.imageUrl,
    href: item.href,
    detailJson: item.detailJson,
    sortOrder: item.sortOrder,
    status: item.status,
    createdAt: ""
  };
}

function lightweightVideoTheme(theme: VideoTheme): VideoTheme {
  return {
    id: theme.id,
    siteId: theme.siteId,
    categoryId: theme.categoryId,
    category: theme.category,
    slug: theme.slug,
    name: theme.name,
    headline: theme.headline,
    description: theme.description,
    prompt: "",
    status: theme.status,
    creditCost: theme.creditCost,
    modelPricing: theme.modelPricing,
    durationSeconds: theme.durationSeconds,
    maxFrames: theme.maxFrames,
    effectiveMaxFrames: theme.effectiveMaxFrames,
    providerMaxFrames: theme.providerMaxFrames,
    generationCount: theme.generationCount,
    createdAt: theme.createdAt,
    imageUrl: theme.imageUrl,
    galleryImages: (theme.galleryImages ?? []).filter(Boolean).slice(0, 12)
  };
}

function storefrontSettingList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value !== "string") return [];
  return value.split(/[\n|,]/).map((item) => item.trim()).filter(Boolean);
}

function trimVideoThemesForStorefront(renderData: SiteRenderData, limit = 24, section?: SectionInstance): VideoTheme[] {
  const activeThemes = renderData.videoThemes.filter((theme) => theme.status === "active");
  const selectedSlugs = storefrontSettingList(section?.settings?.videoSlugs).map(normalizePublicSlug);
  const selectedThemes = selectedSlugs.length
    ? selectedSlugs
        .map((slug) => activeThemes.find((theme) => normalizePublicSlug(theme.slug) === slug))
        .filter((theme): theme is VideoTheme => Boolean(theme))
    : activeThemes;
  return selectedThemes.slice(0, limit).map(lightweightVideoTheme);
}

function collectStorefrontMediaReferences(value: unknown, refs: Set<string>, parentKey = ""): void {
  if (!value) return;
  if (typeof value === "string") {
    if (isStorefrontMediaReferenceKey(parentKey)) refs.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStorefrontMediaReferences(item, refs, parentKey));
    return;
  }
  if (typeof value !== "object") return;
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    collectStorefrontMediaReferences(child, refs, key);
  });
}

function trimMediaAssetsForPage(site: Site, pageJson: ThemePageJson, settings: Site["themeSettings"]["publishedJson"], renderData: SiteRenderData): SiteRenderData["mediaAssets"] {
  if (!renderData.mediaAssets.length) return [];
  const refs = new Set<string>();
  collectStorefrontMediaReferences(site.branding, refs);
  collectStorefrontMediaReferences(settings.globalSections, refs);
  collectStorefrontMediaReferences(pageJson, refs);
  collectStorefrontMediaReferences(renderData.creativePackCategories, refs);
  collectStorefrontMediaReferences(renderData.creativePacks, refs);
  collectStorefrontMediaReferences(renderData.products, refs);
  collectStorefrontMediaReferences(renderData.toolMenuItems, refs);
  if (!refs.size) return [];
  return renderData.mediaAssets.filter((asset) =>
    refs.has(asset.id) ||
    refs.has(asset.storageKey) ||
    Boolean(asset.previewUrl && refs.has(asset.previewUrl)) ||
    Boolean(asset.originUrl && refs.has(asset.originUrl))
  ).map(lightweightMediaAsset);
}

function trimRenderDataForPage(renderData: SiteRenderData, pageJson: ThemePageJson, slug: string): SiteRenderData {
  const sectionTypes = pageSectionTypes(pageJson);
  const needsProducts = slug === "/pricing" || slug === "/cart" || Array.from(sectionTypes).some((type) => productSectionTypes.has(type));
  const hasPricingTable = slug === "/pricing" || sectionTypes.has("pricing_table") || sectionTypes.has("dreamshoot_generation_showcase");
  const needsSiteAiApps = slug === "/tools" || slug.startsWith("/tools/") || Array.from(sectionTypes).some((type) => siteAiAppSectionTypes.has(type));
  const needsCreativePacks = slug === "/" || slug === "/collections" || slug === "/tools" || Array.from(sectionTypes).some((type) => creativePackSectionTypes.has(type));
  const needsVideoThemes = Array.from(sectionTypes).some((type) => videoThemeSectionTypes.has(type));
  const packLimit = slug === "/collections" || sectionTypes.has("dreamshoot_generation_showcase")
    ? publicDirectoryPackLimit
    : publicHomePackLimit;
  const siteAiAppLimit = slug === "/tools" ? publicToolLimit : 48;
  return {
    creativePackCategories: needsCreativePacks ? trimCreativePackCategoriesForStorefront(renderData) : [],
    creativePacks: needsCreativePacks ? trimCreativePacksForStorefront(renderData, packLimit) : [],
    mediaAssets: renderData.mediaAssets,
    products: needsProducts ? (hasPricingTable ? trimPricingProductsForStorefront(renderData, 12) : trimProductsForStorefront(renderData, slug === "/cart" ? 12 : 6)) : [],
    siteAiApps: needsSiteAiApps ? trimSiteAiAppsForStorefront(renderData, siteAiAppLimit) : [],
    toolMenuItems: renderData.toolMenuItems.slice(0, 160).map(lightweightToolMenuItem),
    videoThemes: needsVideoThemes ? trimVideoThemesForStorefront(renderData, 32) : []
  };
}

function trimRenderDataForSection(renderData: SiteRenderData, pageJson: ThemePageJson, slug: string, sectionId: string): SiteRenderData {
  const section = pageJson.sections[sectionId];
  if (!section) return emptySiteRenderData();
  const sectionType = section.type;
  const needsProducts = productSectionTypes.has(sectionType);
  const needsSiteAiApps = siteAiAppSectionTypes.has(sectionType);
  const needsCreativePacks = creativePackSectionTypes.has(sectionType);
  const needsToolMenuItems = toolMenuItemSectionTypes.has(sectionType);
  const needsVideoThemes = videoThemeSectionTypes.has(sectionType);
  const hasPricingTable = sectionType === "pricing_table" || sectionType === "dreamshoot_generation_showcase";
  const packLimit = slug === "/collections" || sectionType === "dreamshoot_generation_showcase"
    ? publicDirectoryPackLimit
    : publicHomePackLimit;
  const siteAiAppLimit = sectionType.includes("tool_collection") ? publicToolLimit : 48;
  return {
    creativePackCategories: needsCreativePacks ? trimCreativePackCategoriesForStorefront(renderData) : [],
    creativePacks: needsCreativePacks ? trimCreativePacksForStorefront(renderData, packLimit) : [],
    mediaAssets: renderData.mediaAssets,
    products: needsProducts ? (hasPricingTable ? trimPricingProductsForStorefront(renderData, 12) : trimProductsForStorefront(renderData, slug === "/cart" ? 12 : 6)) : [],
    siteAiApps: needsSiteAiApps ? trimSiteAiAppsForStorefront(renderData, siteAiAppLimit) : [],
    toolMenuItems: needsToolMenuItems ? renderData.toolMenuItems.slice(0, 160).map(lightweightToolMenuItem) : [],
    videoThemes: needsVideoThemes ? trimVideoThemesForStorefront(renderData, sectionType === "dreamshoot_generation_showcase" ? 8 : 32, section) : []
  };
}

function collectionSlugForCreativePack(pack: CreativePack, collectionSlug: string): boolean {
  const normalizedSlug = normalizePublicSlug(collectionSlug);
  if (!normalizedSlug) return false;
  return [
    pack.categoryRecord?.slug,
    pack.categoryRecord?.parent?.slug,
    pack.category,
    pack.name
  ].some((value) => value ? normalizePublicSlug(value) === normalizedSlug : false);
}

function trimFocusedCollectionRenderData(renderData: SiteRenderData, collectionSlug: string): SiteRenderData {
  if (!collectionSlug) return renderData;
  const focusedPacks = renderData.creativePacks.filter((pack) =>
    pack.status === "active" && collectionSlugForCreativePack(pack, collectionSlug)
  );
  if (!focusedPacks.length) return renderData;
  const focusedCategoryIds = new Set<string>();
  focusedPacks.forEach((pack) => {
    if (pack.categoryId) focusedCategoryIds.add(pack.categoryId);
    if (pack.categoryRecord?.id) focusedCategoryIds.add(pack.categoryRecord.id);
    if (pack.categoryRecord?.parentId) focusedCategoryIds.add(pack.categoryRecord.parentId);
    if (pack.categoryRecord?.parent?.id) focusedCategoryIds.add(pack.categoryRecord.parent.id);
  });
  return {
    ...renderData,
    creativePackCategories: focusedCategoryIds.size
      ? renderData.creativePackCategories
          .filter((category) => focusedCategoryIds.has(category.id))
          .map(lightweightCategoryRecord)
          .filter((category): category is CreativePackCategory => Boolean(category))
      : renderData.creativePackCategories,
    creativePacks: focusedPacks.map(lightweightCreativePackForFocusedCollection)
  };
}

function withPageMediaAssets(site: Site, pageJson: ThemePageJson, settings: Site["themeSettings"]["publishedJson"], renderData: SiteRenderData): SiteRenderData {
  return {
    ...renderData,
    mediaAssets: trimMediaAssetsForPage(site, pageJson, settings, renderData)
  };
}

function pageNeedsSearchEntries(pageJson: ThemePageJson): boolean {
  return pageJson.sectionsOrder.some((sectionId) => {
    const type = pageJson.sections[sectionId]?.type;
    return type === "search" || type === "search_results";
  });
}

function pageNeedsBlogEntries(pageJson: ThemePageJson, pagePath: string): boolean {
  if (pagePath === "/blog" || pagePath.startsWith("/blog/")) return true;
  return pageJson.sectionsOrder.some((sectionId) => {
    const type = pageJson.sections[sectionId]?.type;
    return type === "blog_list" || type === "blog_article";
  });
}

const emptyClientPageJson: ThemePageJson = {
  pageType: "content",
  version: 1,
  sectionsOrder: [],
  sections: {}
};

function lightweightPageForClient(page: ThemePage, includeContent = false): ThemePage {
  const pageJson = includeContent ? page.publishedJson : { ...emptyClientPageJson, pageType: page.publishedJson.pageType };
  return {
    ...page,
    draftJson: pageJson,
    publishedJson: pageJson
  };
}

const blogArticleMetadataSettings = new Set([
  "eyebrow",
  "headingLevel",
  "title",
  "summary",
  "author",
  "publishedAt",
  "updatedAt",
  "readMinutes",
  "imageUrl",
  "imageAlt",
  "tags",
  "guideType",
  "targetHref",
  "targetLabel"
]);

function lightweightBlogArticlePageForClient(page: ThemePage): ThemePage {
  const sourceJson = page.publishedJson;
  const sectionId = sourceJson.sectionsOrder.find((id) => sourceJson.sections[id]?.type === "blog_article");
  const sourceSection = sectionId ? sourceJson.sections[sectionId] : undefined;
  if (!sectionId || !sourceSection) return lightweightPageForClient(page, false);
  const settings = Object.fromEntries(
    Object.entries(sourceSection.settings).filter(([key]) => blogArticleMetadataSettings.has(key))
  ) as SectionInstance["settings"];
  const pageJson: ThemePageJson = {
    pageType: sourceJson.pageType,
    version: sourceJson.version,
    sectionsOrder: [sectionId],
    sections: {
      [sectionId]: {
        type: "blog_article",
        settings,
        blocks: []
      }
    },
    seo: sourceJson.seo
  };
  return {
    ...page,
    draftJson: pageJson,
    publishedJson: pageJson
  };
}

function lightweightSiteForClient(site: Site, pages: ThemePage[]): Site {
  const { colors, radii, typography } = site.themeSettings.publishedJson;
  const settings: Site["themeSettings"]["publishedJson"] = {
    colors,
    typography,
    radii,
    navigation: {
      headerLinks: [],
      footerLinks: []
    },
    globalSections: {},
    seo: {
      siteTitle: "",
      siteDescription: "",
      titleTemplate: "%s",
      robots: {
        index: false,
        follow: false
      },
      pages: {}
    }
  };
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    status: site.status,
    primaryDomain: site.primaryDomain,
    currency: site.currency,
    timezone: site.timezone,
    signupCreditGrant: site.signupCreditGrant,
    branding: site.branding,
    connect: {
      stripeAccountId: "",
      status: site.connect.status,
      chargesEnabled: site.connect.chargesEnabled,
      payoutsEnabled: site.connect.payoutsEnabled
    },
    themeSettings: {
      draftJson: settings,
      publishedJson: settings
    },
    pages,
    mediaAssets: site.mediaAssets?.map(lightweightMediaAsset)
  };
}

function clientSiteForThemeRender(site: Site, activePage: ThemePageJson, pagePath: string): Site {
  const pageMap = new Map<string, ThemePage>();
  const includeSearchEntries = pageNeedsSearchEntries(activePage);
  const includeBlogEntries = pageNeedsBlogEntries(activePage, pagePath);
  for (const page of site.pages) {
    const includeFullContent = includeSearchEntries || (includeBlogEntries && page.slug === pagePath);
    if (
      page.slug === pagePath ||
      page.slug === "/" ||
      page.slug === "/404" ||
      (includeBlogEntries && page.slug.startsWith("/blog/")) ||
      (includeSearchEntries && (["/help", "/blog", "/pricing", "/collections", "/search"].includes(page.slug) || page.slug.startsWith("/policies/")))
    ) {
      pageMap.set(
        page.id,
        includeFullContent
          ? lightweightPageForClient(page, true)
          : includeBlogEntries && page.slug.startsWith("/blog/")
            ? lightweightBlogArticlePageForClient(page)
            : lightweightPageForClient(page, false)
      );
    }
  }
  return lightweightSiteForClient(site, Array.from(pageMap.values()));
}

function clientSiteForSectionRender(site: Site, activePage: ThemePageJson, pagePath: string): Site {
  const pageMap = new Map<string, ThemePage>();
  const includeBlogEntries = pageNeedsBlogEntries(activePage, pagePath);
  for (const page of site.pages) {
    if (page.slug === pagePath) {
      pageMap.set(page.id, {
        ...page,
        draftJson: activePage,
        publishedJson: activePage
      });
    } else if (includeBlogEntries && page.slug.startsWith("/blog/")) {
      pageMap.set(page.id, lightweightBlogArticlePageForClient(page));
    } else if (page.slug === "/" || page.slug === "/404") {
      pageMap.set(page.id, lightweightPageForClient(page, false));
    }
  }
  if (!pageMap.size) {
    pageMap.set(`${site.id}_section_page`, {
      id: `${site.id}_section_page`,
      siteId: site.id,
      pageType: activePage.pageType,
      templateKey: "section",
      slug: pagePath,
      title: "Storefront section",
      draftJson: activePage,
      publishedJson: activePage
    });
  }
  return lightweightSiteForClient(site, Array.from(pageMap.values()));
}

function proposedFederalPrivacyLegislationNotice(brand: string): string {
  return `<h3>5. Proposed federal privacy legislation watch</h3><p>${brand} monitors proposed U.S. federal privacy legislation, including the SECURE Data Act and the GUARD Financial Data Act. These proposals are not treated as enacted storefront policy unless they become law, but our privacy operations are prepared around data minimization, customer access, portable copy, deletion, sensitive-data opt-in, and AI-use transparency where applicable.</p>`;
}

const MYDREAMSHOOTS_TERMS_POLICY_BODY =
  `<h3>1. Agreement to these terms</h3><p>These Terms of Service apply when you visit www.mydreamshoots.com, create a MyDreamShoots account, upload photos, buy credits or subscriptions, use AI photo tools, start generation jobs, download outputs, or access private albums.</p><h3>2. Accounts, credits, and checkout</h3><p>You are responsible for accurate account information and secure sign-in. Credits are added after payment confirmation, displayed before generation, reserved when a request begins, used after successful delivery, and released or reviewed when a request fails.</p><h3>3. Upload rights and consent</h3><p>You may upload only photos, reference images, prompts, or other materials that you own or have permission to use. Do not upload minors, non-consenting people, public figures, protected marks, stolen images, or materials that violate law, platform rules, or third-party rights.</p><h3>4. No AI training on your photos</h3><p>Your inputs are never used to train models. 30-day auto-delete applies to input photos after generation. Private uploads and account records are protected with AES-256 at rest and TLS 256-bit in transit. Some billing, security, tax, dispute, refund, and account-integrity records may be retained where required or reasonably necessary.</p><h3>5. AI output variability</h3><p>AI photo results can vary based on source photo quality, pose, lighting, package settings, moderation review, provider availability, and model behavior. MyDreamShoots may reject, rerun, delay, moderate, or remove jobs that violate rules or cannot be completed reliably.</p><h3>6. Private albums and use of outputs</h3><p>Generated images and albums are designed for private customer access unless you choose to share, publish, or download them. You are responsible for reviewing outputs before using them in advertising, profiles, documents, merchandise, social media, or other public settings.</p><h3>7. Refunds and guarantee review</h3><p>Refunds and credit adjustments follow the Refund Policy, including the 100% money-back guarantee when the shoot does not look like you, subject to support review, account history, and the details of the affected request.</p><h3>8. Contact</h3><p>Email <a href="mailto:support@mydreamshoots.com">support@mydreamshoots.com</a> for account, billing, refund, policy, or legal questions.</p>`;

function mydreamshootsPolicyBody(path: string): string {
  const normalized = normalizePublicSlug(path).replace(/-/g, " ");
  if (normalized.includes("children")) {
    return "<h3>1. Service audience</h3><p>MyDreamShoots is not directed to children under 13 and is not designed for child account creation. Customers should use the service only if they can lawfully manage an account or have permission from a parent or legal guardian.</p><h3>2. COPPA-aware handling</h3><p>The Children's Online Privacy Protection Act (COPPA) applies to certain online services directed to children under 13 or knowingly collecting personal information from children under 13. MyDreamShoots does not knowingly collect account information directly from children under 13. If we learn that child personal information was provided without required consent, we will review and delete or restrict it as appropriate.</p><h3>3. Photos of minors</h3><p>Customers must not upload photos of minors unless they are the parent, legal guardian, or otherwise have the legal right and consent to use those images for the requested AI photo workflow. Minor images should never be used for deceptive, exploitative, unlawful, or unsafe purposes.</p><h3>4. Parent or guardian requests</h3><p>A parent or legal guardian may contact us to ask about access, deletion, or restriction of child-related information. We may request verification before acting on a sensitive privacy request.</p><h3>5. DPDPA requests</h3><p>California and other U.S. state privacy requests are handled in our <a href=\"/state-privacy\">DPDPA</a> notice, including access, deletion, correction, opt-out, and appeal requests where applicable.</p><h3>6. Contact</h3><p>Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> for children's privacy or COPPA-related questions.</p>";
  }
  if (normalized.includes("state privacy") || normalized.includes("california") || normalized.includes("ccpa")) {
    return "<h3>1. DPDPA</h3><p>California and other U.S. residents may have privacy rights, including rights to request access to personal information, deletion, correction, a portable copy, and information about certain disclosures. Where applicable, customers may also request to opt out of sale or sharing of personal information. MyDreamShoots does not sell personal source photos or generated private albums as stock content.</p><h3>2. Company record for privacy contact</h3><p>Company: myDreamshoots.com; Address: 8 THE GREEN STE B,DOVER,DE 19901; Contact Us: support@mydreamshoots.com.</p><h3>3. How to submit a request</h3><p>Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> with the account email, request type, and any relevant order or gallery details. We will review the request under the privacy rights that apply to the customer and account.</p>" + proposedFederalPrivacyLegislationNotice("MyDreamShoots");
  }
  if (normalized.includes("cookie")) {
    return "<h3>1. Essential cookies and local storage</h3><p>MyDreamShoots uses essential cookies and local storage for sign-in, account sessions, cart continuity, credit visibility, private gallery access, and site reliability.</p><h3>2. Security and checkout continuity</h3><p>Operational storage helps keep customer sessions secure, remember checkout state, protect private albums, and diagnose failed requests or delivery issues.</p><h3>3. Payment and service providers</h3><p>Checkout, infrastructure, email, analytics, and AI processing providers may use limited cookies or identifiers when needed for payment status, fraud prevention, service delivery, security, or operational measurement.</p><h3>4. Your choices</h3><p>You can clear cookies or adjust browser settings. Clearing storage may sign you out, interrupt checkout, remove local preferences, or require another sign-in before opening private albums, jobs, credit history, or downloads.</p><h3>5. Contact us</h3><p>Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> with cookie, account session, checkout continuity, or private gallery questions.</p>";
  }
  if (normalized.includes("term")) {
    return MYDREAMSHOOTS_TERMS_POLICY_BODY;
  }
  return "<p>Private uploads, account activity, credits, checkout status, generated images, and delivered albums are handled according to this policy.</p>";
}

function aidreamcapesPolicyBody(path: string): string {
  const normalized = normalizePublicSlug(path).replace(/-/g, " ");
  if (normalized.includes("children")) {
    return "<h3>1. Service audience</h3><p>Aidreamcapes is not directed to children under 13 and is not designed for child account creation. Customers should use the service only if they can lawfully manage an account or have permission from a parent or legal guardian.</p><h3>2. COPPA-aware handling</h3><p>The Children's Online Privacy Protection Act (COPPA) applies to certain online services directed to children under 13 or knowingly collecting personal information from children under 13. Aidreamcapes does not knowingly collect account information directly from children under 13. If we learn that child personal information was provided without required consent, we will review and delete or restrict it as appropriate.</p><h3>3. Photos of minors</h3><p>Customers must not upload photos of minors unless they are the parent, legal guardian, or otherwise have the legal right and consent to use those images for the requested AI photo album workflow. Minor images should never be used for deceptive, exploitative, unlawful, or unsafe purposes.</p><h3>4. Parent or guardian requests</h3><p>A parent or legal guardian may contact us to ask about access, deletion, or restriction of child-related information. We may request verification before acting on a sensitive privacy request.</p><h3>5. CISA requests</h3><p>California and other U.S. state privacy requests are handled in our <a href=\"/state-privacy\">CISA</a> notice, including access, deletion, correction, opt-out, and appeal requests where applicable.</p><h3>6. Contact</h3><p>Email <a href=\"mailto:support@aidreamcapes.com\">support@aidreamcapes.com</a> for children's privacy or COPPA-related questions.</p>";
  }
  if (normalized.includes("state privacy") || normalized.includes("california") || normalized.includes("ccpa")) {
    return "<h3>1. CISA</h3><p>California and other U.S. residents may have privacy rights, including rights to request access to personal information, deletion, correction, a portable copy, and information about certain disclosures. Where applicable, customers may also request to opt out of sale or sharing of personal information. Aidreamcapes does not sell personal source photos or generated private galleries as stock content.</p><h3>2. Company record for privacy contact</h3><p>Company: Aidreamcapes.com; Address: 30 N GOULD ST STE R,SHERIDAN,WY 82801; Contact Us: support@aidreamcapes.com.</p><h3>3. How to submit a request</h3><p>Email <a href=\"mailto:support@aidreamcapes.com\">support@aidreamcapes.com</a> with the account email, request type, and any relevant order or gallery details. We will review the request under the privacy rights that apply to the customer and account.</p>" + proposedFederalPrivacyLegislationNotice("Aidreamcapes");
  }
  if (normalized.includes("cookie")) {
    return "<h3>1. Essential cookies and local storage</h3><p>Aidreamcapes uses essential cookies and local storage for secure sign-in, cart continuity, credit visibility, private gallery access, and site reliability.</p><h3>2. Service providers</h3><p>Checkout, infrastructure, email, analytics, and AI processing providers may use limited identifiers when needed for payment status, fraud prevention, service delivery, security, or operational measurement.</p><h3>3. Your choices</h3><p>You can clear cookies or adjust browser settings. Clearing storage may sign you out, interrupt checkout, remove local preferences, or require another sign-in before opening private galleries, credits, jobs, or downloads.</p><h3>4. Contact us</h3><p>Email <a href=\"mailto:support@aidreamcapes.com\">support@aidreamcapes.com</a> with cookie, account session, checkout continuity, or private gallery questions.</p>";
  }
  if (normalized.includes("term")) {
    return "<h3>1. Acceptance</h3><p>By using Aidreamcapes, creating an account, purchasing credits, uploading source photos, starting a generation job, or opening a private gallery, you agree to these terms and the privacy policy that governs account data, uploads, payment status, and delivery records.</p><h3>2. Accounts and source photos</h3><p>Customers must provide accurate account information, keep sign-in credentials secure, and only upload images and references they own or have permission to use.</p><h3>3. Credits, packages, and delivery</h3><p>Credits are granted after confirmed payment, displayed before package creation, reserved when a job starts, consumed after successful delivery, and released when a request fails or times out.</p><h3>4. Safety and rights</h3><p>Aidreamcapes may reject, remove, restrict, or review requests that violate law, policy, platform safety rules, or third-party rights.</p><h3>5. Contact us</h3><p>Email <a href=\"mailto:support@aidreamcapes.com\">support@aidreamcapes.com</a> for account, billing, refund, policy, generation, or private gallery questions.</p>";
  }
  return "<p>Private uploads, account activity, credits, checkout status, generated portraits, and delivered galleries are handled according to this policy.</p>";
}

function isSpanishXbyStorefront(site: Site): boolean {
  return isSpanishStorefrontSite(site);
}

function storefrontSupportEmail(site: Site, fallback: string): string {
  const configuredEmail = site.themeSettings?.publishedJson?.globalSections?.footer?.settings?.contactEmail;
  const spanishXby = isSpanishXbyStorefront(site);
  if (typeof configuredEmail === "string" && configuredEmail.includes("@")) {
    if (!spanishXby || !/(?:mydreamshoots|aidreamcapes)\.com|localhost/i.test(configuredEmail)) return configuredEmail;
  }
  const host = String(site.primaryDomain ?? "").trim().replace(/^https?:\/\//i, "").split("/")[0].replace(/\/+$/, "");
  if (spanishXby && host) return `support@${host}`;
  return fallback;
}

function spanishXbyPolicyTitle(path: string, seo: PolicySeoCopy): string {
  const normalized = normalizePublicSlug(path).replace(/-/g, " ");
  if (normalized.includes("cookie")) return "Politica de cookies";
  if (normalized.includes("term")) return "Terminos de servicio";
  if (normalized.includes("refund")) return "Revision de creditos y reembolsos";
  if (normalized.includes("shipping") || normalized.includes("delivery")) return "Entrega digital";
  if (normalized.includes("content")) return "Politica de contenido";
  if (normalized.includes("privacy")) return "Politica de privacidad";
  return seo.title.replace(/\s+\|\s+.*$/i, "");
}

function spanishXbyPolicyBody(site: Site, path: string, contactEmail: string): string {
  const brand = site.branding.logoText || site.name;
  const normalized = normalizePublicSlug(path).replace(/-/g, " ");
  if (normalized.includes("cookie")) {
    return `<h3>1. Cookies esenciales y almacenamiento local</h3><p>${brand} usa cookies esenciales para mantener sesiones, carrito, creditos, pago, seguridad y acceso a galerias privadas.</p><h3>2. Proveedores de servicio</h3><p>Los proveedores de pago, infraestructura, correo, analitica operativa e IA pueden usar identificadores limitados cuando son necesarios para confirmar pagos, prevenir fraude, entregar el servicio o diagnosticar incidencias.</p><h3>3. Tus opciones</h3><p>Puedes borrar cookies o ajustar el navegador. Al hacerlo, puede que tengas que iniciar sesion de nuevo antes de abrir pedidos, creditos, descargas o galerias privadas.</p><h3>4. Contacto</h3><p>Escribe a <a href="mailto:${contactEmail}">${contactEmail}</a> para preguntas sobre cookies, sesiones, pago o acceso privado.</p>`;
  }
  if (normalized.includes("term")) {
    return `<h3>1. Aceptacion</h3><p>Al usar ${brand}, crear una cuenta, comprar creditos, subir fotos fuente, iniciar una generacion o abrir una galeria privada, aceptas estos terminos y la politica de privacidad.</p><h3>2. Cuentas y seguridad</h3><p>Debes proporcionar datos correctos, proteger tus credenciales y usar el servicio solo para flujos personales, creativos o comerciales permitidos.</p><h3>3. Creditos, paquetes y entrega</h3><p>Los creditos se muestran antes de generar, se reservan cuando inicia un pedido, se consumen al entregar resultados correctos y se liberan si una solicitud falla o expira.</p><h3>4. Fotos subidas y derechos</h3><p>Solo debes subir imagenes y referencias que sean tuyas o que tengas permiso para usar. Sigues siendo responsable del material fuente y del uso de los resultados.</p><h3>5. Seguridad creativa</h3><p>${brand} puede rechazar, revisar o limitar solicitudes que infrinjan la ley, derechos de terceros, normas de seguridad o politicas de contenido.</p><h3>6. Contacto</h3><p>Escribe a <a href="mailto:${contactEmail}">${contactEmail}</a> para cuenta, facturacion, reembolsos, politicas, generacion o entrega de galerias.</p>`;
  }
  if (normalized.includes("refund")) {
    return `<h3>1. Revision de creditos</h3><p>${brand} revisa incidencias de creditos, pedidos fallidos, duplicados, errores de pago y solicitudes de rerun desde el historial de la cuenta.</p><h3>2. Pedidos fallidos</h3><p>Cuando una generacion no puede completarse, los creditos se liberan o se devuelven segun el estado real del pedido y la confirmacion del sistema.</p><h3>3. Contacto</h3><p>Escribe a <a href="mailto:${contactEmail}">${contactEmail}</a> con el correo de tu cuenta, pedido, plan o captura relevante.</p>`;
  }
  if (normalized.includes("content")) {
    return `<h3>1. Fotos permitidas</h3><p>Debes subir fotos fuente que puedas usar legalmente y que representen a personas con consentimiento cuando corresponda.</p><h3>2. Solicitudes no permitidas</h3><p>${brand} puede bloquear contenido que infrinja derechos, seguridad, privacidad, identidad, abuso, acoso o cualquier uso no autorizado.</p><h3>3. Uso responsable</h3><p>Los resultados generados deben usarse de forma responsable y respetando a las personas representadas.</p>`;
  }
  if (normalized.includes("shipping") || normalized.includes("delivery")) {
    return `<h3>1. Entrega digital</h3><p>${brand} entrega creditos, imagenes generadas, descargas y galerias privadas de forma digital dentro de la cuenta del cliente.</p><h3>2. Sin envio fisico</h3><p>No hay productos fisicos, tracking postal, aduanas ni transportistas para estos pedidos.</p><h3>3. Soporte</h3><p>Escribe a <a href="mailto:${contactEmail}">${contactEmail}</a> si no puedes abrir una galeria o descargar resultados.</p>`;
  }
  return `<p>${brand} gestiona subidas privadas, actividad de cuenta, creditos, pago, imagenes generadas y galerias de acuerdo con esta politica. Para preguntas, escribe a <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>`;
}

function storefrontPolicySeoForSite(site: Site, slug: string): PolicySeoCopy | undefined {
  const identity = `${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`;
  if (isSpanishXbyStorefront(site)) return getSpanishXbyPolicySeo(site, slug);
  if (/aidreamcapes/i.test(identity)) return getAidreamcapesPolicySeo(slug);
  if (/dreamshoot/i.test(identity)) return getMydreamshootsPolicySeo(slug);
  return undefined;
}

function syntheticStorefrontPolicyPage(site: Site, slug: string): ThemePage | undefined {
  const seo = storefrontPolicySeoForSite(site, slug);
  if (!seo) return undefined;
  const isAidreamcapes = isAidreamcapesStorefront(site);
  const isSpanishXby = isSpanishXbyStorefront(site);
  const contactEmail = storefrontSupportEmail(site, isAidreamcapes ? "support@aidreamcapes.com" : "support@mydreamshoots.com");
  const title =
    isSpanishXby ? spanishXbyPolicyTitle(slug, seo) :
    slug.includes("children") ? "KIDS Act" :
    slug.includes("state-privacy") || slug.includes("california") || slug.includes("ccpa") ? isAidreamcapes ? "CISA" : "DPDPA" :
    slug.includes("cookie") ? "Cookie Policy" :
    slug.includes("term") ? "Terms of Service" :
    seo.title.replace(/\s+\|\s+(MyDreamShoots|Aidreamcapes).*$/i, "");
  const pageJson: ThemePageJson = {
    pageType: "policy",
    version: 1,
    sectionsOrder: ["policy_1"],
    sections: {
      policy_1: {
        type: "policy_content",
        settings: {
          eyebrow: isSpanishXby ? "Politica" : "Policy",
          title,
          body: isSpanishXby ? spanishXbyPolicyBody(site, slug, contactEmail) : isAidreamcapes ? aidreamcapesPolicyBody(slug) : mydreamshootsPolicyBody(slug),
          contactEmail,
          lastUpdated: isSpanishXby || isAidreamcapes ? "July 14, 2026" : "August 5, 2026",
          headingLevel: "h1"
        },
        blocks: []
      }
    }
  };
  return {
    id: `${site.id}_${normalizePublicSlug(slug || "policy")}_synthetic`,
    siteId: site.id,
    pageType: "policy",
    templateKey: "policy",
    slug,
    title,
    draftJson: pageJson,
    publishedJson: pageJson
  };
}

async function getStateForStorefrontRender(site: Site, routeMode: "host" | "path", providedState?: PlatformState): Promise<PlatformState> {
  if (providedState) return providedState;
  const requiresPublishedSource = isMydreamshootsContentSourceSite(site);
  if (routeMode === "host" || requiresPublishedSource) {
    try {
      const runtimeState = await readStorefrontRuntimeStateForSiteFromDatabase(site.id);
      if (runtimeState) return runtimeState;
    } catch (error) {
      if (requiresPublishedSource) {
        throw new Error(
          `MyDreamShoots runtime for ${site.slug} must read Postgres published content. ` +
          "Refusing to fall back to legacy state because that can reintroduce stale copy. " +
          `Original error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      // Fall through to the legacy reader for local or migrating databases.
    }
    if (requiresPublishedSource) {
      throw new Error(`MyDreamShoots runtime for ${site.slug} was not found in Postgres. Refusing to fall back to legacy state.`);
    }
  }
  return readStorefrontPlatformState();
}

async function getPublicSectionStateForRoute(publicSlug: string, slug: string, routeMode: "host" | "path"): Promise<PlatformState | undefined> {
  if (routeMode === "path") return readPathModePublicRuntimeState(publicSlug, slug);
  try {
    const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(publicSlug, slug);
    if (state) return state;
  } catch (error) {
    if (isMydreamshootsContentSourceSlug(publicSlug)) {
      throw new Error(
        `MyDreamShoots section runtime for ${publicSlug}${slug} must read Postgres published content. ` +
        "Refusing to fall back to legacy state because that can reintroduce stale copy. " +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  if (isMydreamshootsContentSourceSlug(publicSlug)) {
    throw new Error(`MyDreamShoots section runtime for ${publicSlug}${slug} was not found in Postgres. Refusing to fall back to legacy state.`);
  }
  return readStorefrontPlatformState();
}

async function getStateForCustomerRuntimeRender(
  site: Site,
  sessionId?: string,
  providedState?: PlatformState,
  profile: "full" | "workspace" | "account" = "full"
): Promise<PlatformState | undefined> {
  if (providedState) return providedState;
  if (!sessionId) return undefined;
  try {
    return await readStorefrontCustomerRuntimeStateForSiteFromDatabase({ siteId: site.id, sessionId, profile });
  } catch {
    // Fall through to the legacy full-site state reader for local or migrating databases.
    return undefined;
  }
}

function runtimeWithEmptyCollections(runtime: Partial<ThemeRuntimeData> = {}): ThemeRuntimeData {
  return {
    jobs: [],
    assets: [],
    albums: [],
    ledger: [],
    subscriptions: [],
    orders: [],
    customerModels: [],
    ...runtime
  };
}

function workspaceRuntimePreloadTimeoutMs(): number {
  const configured = Number.parseInt(process.env.STOREFRONT_WORKSPACE_INITIAL_RUNTIME_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(configured) && configured >= 500 ? configured : 2_500;
}

function withWorkspaceRuntimePreloadTimeout<T>({
  label,
  promise,
  timeoutMs
}: {
  label: string;
  promise: Promise<T | undefined>;
  timeoutMs: number;
}): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => {
      timer = setTimeout(() => {
        console.warn(`[customer-workspace-ssr] ${label} timed out after ${timeoutMs}ms; deferring to client runtime refresh.`);
        resolve(undefined);
      }, timeoutMs);
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function isoFromRelationalValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return new Date(0).toISOString();
}

function numberFromRelationalValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function relationalJsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function relationalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function runtimeJobFrameAssetIdsFromRelational(job: Pick<ThemeRuntimeData["jobs"][number], "requestJson">): string[] {
  const request = relationalJsonRecord(job.requestJson) ?? {};
  const fields = relationalJsonRecord(request.fields) ?? {};
  return Array.from(new Set([
    ...relationalStringArray(fields.frameAssetIds),
    ...relationalStringArray(request.assetIds)
  ]));
}

function workspaceSubscriptionFromRelationalRow(subscription: Record<string, unknown>): NonNullable<ThemeRuntimeData["subscriptions"]>[number] {
  return {
    id: String(subscription.id),
    productId: String(subscription.productId),
    priceId: String(subscription.priceId),
    status: String(subscription.status) as NonNullable<ThemeRuntimeData["subscriptions"]>[number]["status"],
    currentPeriodEnd: isoFromRelationalValue(subscription.currentPeriodEnd),
    creditsPerCycle: numberFromRelationalValue(subscription.creditsPerCycle),
    createdAt: isoFromRelationalValue(subscription.createdAt)
  };
}

async function readLightWorkspaceRuntimeForCustomerRelational({
  customer,
  siteId
}: {
  customer: PublicCustomer;
  siteId: string;
}): Promise<ThemeRuntimeData> {
  const [recentJobs, recentAssets, videoFrameAssets, subscriptions, customerModels] = await Promise.all([
    readWorkspaceJobSummariesRelational({ siteId, customerId: customer.id, take: 8 }),
    prisma.assetUpload.findMany({
      where: {
        siteId,
        customerId: customer.id,
        deletedAt: null,
        role: { in: ["input", "training_input", "output"] }
      },
      orderBy: { createdAt: "desc" },
      take: 48
    }),
    prisma.assetUpload.findMany({
      where: {
        siteId,
        customerId: customer.id,
        deletedAt: null,
        role: "input",
        subjectRole: "video_frame"
      },
      orderBy: { createdAt: "desc" },
      take: WORKSPACE_VIDEO_FRAME_ASSET_LIMIT
    }),
    prisma.subscription.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 4
    }),
    prisma.customerModel.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { updatedAt: "desc" },
      take: 4
    })
  ]);
  const recentJobIds = new Set(recentJobs.map((job) => job.id));
  const relatedJobIds = Array.from(new Set(
    recentAssets
      .map((asset) => asset.jobId)
      .filter((jobId): jobId is string => typeof jobId === "string" && !recentJobIds.has(jobId))
  )).slice(0, WORKSPACE_RELATED_JOB_SUMMARY_LIMIT);
  const relatedJobs = relatedJobIds.length
    ? await readWorkspaceJobSummariesRelational({ siteId, customerId: customer.id, ids: relatedJobIds, includeJson: false })
    : [];
  const jobs = [...recentJobs, ...relatedJobs]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const recentAssetIds = new Set([...recentAssets, ...videoFrameAssets].map((asset) => asset.id));
  const referencedFrameAssetIds = Array.from(new Set(jobs.flatMap(runtimeJobFrameAssetIdsFromRelational)))
    .filter((assetId) => !recentAssetIds.has(assetId));
  const referencedFrameAssets = referencedFrameAssetIds.length
    ? await prisma.assetUpload.findMany({
        where: {
          siteId,
          customerId: customer.id,
          id: { in: referencedFrameAssetIds },
          deletedAt: null
        },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const assets = Array.from(new Map(
    [...recentAssets, ...videoFrameAssets, ...referencedFrameAssets]
      .map((asset) => [asset.id, asset])
  ).values())
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((asset) => {
      const mapped = toAssetUploadRelational(asset as unknown as Record<string, unknown>);
      return toThemeRuntimeAssetRelational(mapped);
    });
  return runtimeWithEmptyCollections({
    customer,
    jobs,
    assets,
    subscriptions: subscriptions.map((subscription) => workspaceSubscriptionFromRelationalRow(subscription as unknown as Record<string, unknown>)),
    customerModels: customerModels.map((model) => {
      const mapped = toCustomerModelRelational(model as unknown as Record<string, unknown>);
      return {
        id: mapped.id,
        label: mapped.label,
        modelType: mapped.modelType,
        status: mapped.status,
        inputAssetCount: mapped.inputAssetCount,
        minInputAssets: mapped.minInputAssets,
        createdAt: mapped.createdAt,
        updatedAt: mapped.updatedAt
      };
    })
  });
}

function publicCustomerBootstrapEnabled(): boolean {
  return process.env.STOREFRONT_PUBLIC_CLIENT_CUSTOMER_BOOTSTRAP === "1";
}

async function readCustomerSessionId(siteId: string): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  return (await cookies()).get(customerSessionCookie(siteId))?.value;
}

async function hasAnyCustomerSessionCookie(): Promise<boolean> {
  const { cookies } = await import("next/headers");
  return (await cookies()).getAll().some((cookie) => cookie.name.startsWith("customer_session_") && Boolean(cookie.value));
}

async function getCurrentCustomerSession(
  state: PlatformState,
  siteId: string,
  sessionId?: string
): Promise<{ customer: PublicCustomer; session: CustomerSession } | undefined> {
  if (!sessionId) return undefined;
  const stateResult = getCustomerBySessionFromState(state, siteId, sessionId);
  if (stateResult) return stateResult;
  const relational = await getCustomerBySessionRelational({ siteId, sessionId });
  if (relational) return relational;
  return undefined;
}

function getCustomerRuntimeFromState(state: PlatformState, siteId: string, customer: PublicCustomer, full: boolean): ThemeRuntimeData {
  const runtime = full ? getThemeRuntimeForCustomer(state, siteId, customer.id) : runtimeWithEmptyCollections();
  return {
    ...runtime,
    customer
  };
}

function trimCustomerRuntimeForWorkspace(runtime: ThemeRuntimeData, slug: string): ThemeRuntimeData {
  if (slug !== "/app") return runtime;
  return {
    ...runtime,
    jobs: (runtime.jobs ?? []).slice(0, 8),
    assets: (runtime.assets ?? []).slice(0, 24),
    albums: (runtime.albums ?? []).slice(0, 8),
    ledger: (runtime.ledger ?? []).slice(0, 12),
    subscriptions: (runtime.subscriptions ?? []).slice(0, 4),
    orders: (runtime.orders ?? []).slice(0, 6),
    customerModels: (runtime.customerModels ?? []).slice(0, 4)
  };
}

async function getLightCustomerRuntime(state: PlatformState, siteId: string, sessionId?: string): Promise<ThemeRuntimeData> {
  if (!sessionId) return runtimeWithEmptyCollections();
  const current = await getCurrentCustomerSession(state, siteId, sessionId);
  if (current) return getCustomerRuntimeFromState(state, siteId, current.customer, false);
  return runtimeWithEmptyCollections();
}

async function getFullCustomerRuntime(state: PlatformState, siteId: string, sessionId?: string): Promise<ThemeRuntimeData> {
  if (!sessionId) return runtimeWithEmptyCollections();
  const current = await getCurrentCustomerSession(state, siteId, sessionId);
  if (!current) return runtimeWithEmptyCollections();
  return getCustomerRuntimeFromState(state, siteId, current.customer, true);
}

function pageNeedsFullCustomerRuntime(pageJson: ThemePageJson, slug: string): boolean {
  if (slug === "/album" || slug === "/app" || slug === "/account" || slug === "/cart" || slug.startsWith("/app/")) return true;
  return pageJson.sectionsOrder.some((sectionId) => {
    const type = pageJson.sections[sectionId]?.type;
    return type === "upload_panel" || type === "generation_form" || type === "job_progress" || type === "album_gallery";
  });
}

function withAccountDashboardPage(pageJson: ReturnType<typeof getPage>["publishedJson"]) {
  const accountSection = pageJson.sections.account_ops_1 ?? {
    type: "ai_feature_launcher" as const,
    settings: {
      anchor: "account-ops",
      eyebrow: "Customer account",
      title: "Your personal center for credits, orders, albums, and AI progress.",
      subtitle: "Review profile information, plan status, order history, private albums, active jobs, and credit activity from one signed-in account page.",
      surface: "account",
      ctaLabel: "Upload photos",
      ctaHref: "/app/upload",
      chipList: "Profile|Plan and credits|Orders|Albums and progress"
    },
    blocks: [
      { id: "account_uploads", type: "feature" as const, settings: { title: "Upload photos", description: "Add source portraits and style references before requesting images.", meta: "Assets", href: "/app/upload" } },
      { id: "account_create", type: "feature" as const, settings: { title: "Create AI images", description: "Choose prompts and reserve credits for a private generation request.", meta: "Generate", href: "/app/create" } },
      { id: "account_progress", type: "feature" as const, settings: { title: "AI generation progress", description: "Open queued, running, delivered, and review-needed requests.", meta: "Progress", href: "/app/jobs/progress" } },
      { id: "account_albums", type: "feature" as const, settings: { title: "Personal albums", description: "Review delivered images and private gallery downloads.", meta: "Gallery", href: "/album" } }
    ]
  };
  return {
    ...pageJson,
    sectionsOrder: ["account_ops_1"],
    sections: {
      account_ops_1: accountSection
    }
  };
}

function withCustomerWorkspaceFlowPage(pageJson: ThemePageJson): ThemePageJson {
  const sections: ThemePageJson["sections"] = {
    ...pageJson.sections,
    launcher_1: {
      ...pageJson.sections.launcher_1,
      type: "ai_feature_launcher" as const,
      settings: {
        ...(pageJson.sections.launcher_1?.settings ?? {}),
        ctaLabel: pageJson.sections.launcher_1?.settings?.ctaLabel ?? "Choose a tool",
        ctaHref: pageJson.sections.launcher_1?.settings?.ctaHref ?? "/app/create"
      },
      blocks: [
        { id: "feature_prepare", type: "feature", settings: { title: "Choose a tool", description: "Pick the photo workflow first, then attach the source photos it needs.", meta: "Tool first", href: "/app/create" } },
        { id: "feature_upload", type: "feature", settings: { title: "Upload photos", description: "Add private source portraits and references for this account.", meta: "Private intake", href: "/app/upload" } },
        { id: "feature_progress", type: "feature", settings: { title: "Track progress", description: "Review queued, running, delivered, and review-needed requests.", meta: "Live progress", href: "/app/jobs/progress" } },
        { id: "feature_album", type: "feature", settings: { title: "Download albums", description: "Open delivered images and private gallery downloads for this account.", meta: "Private delivery", href: "/album" } }
      ]
    },
    form_1: pageJson.sections.form_1 ?? {
      type: "generation_form" as const,
      settings: {
        aiAppSlug: "image_generator",
        title: "Choose a photo tool",
        helper: "Pick a photo tool first. Then upload the source photos it asks for and start your private result.",
        surface: "workspace"
      },
      blocks: []
    },
    upload_1: pageJson.sections.upload_1
      ? {
          ...pageJson.sections.upload_1,
          settings: {
            ...pageJson.sections.upload_1.settings,
            title: pageJson.sections.upload_1.settings.title ?? "Upload source photos",
            helper: pageJson.sections.upload_1.settings.helper ?? "Upload only the source photos needed for the selected tool."
          }
        }
      : pageJson.sections.upload_1
  };
  delete sections.trust_1;

  const desiredOrder = ["launcher_1", "form_1", "upload_1", "progress_1", "album_1"];
  const ordered = [
    ...desiredOrder.filter((sectionId) => sections[sectionId]),
    ...pageJson.sectionsOrder.filter((sectionId) => !desiredOrder.includes(sectionId) && sectionId !== "trust_1")
  ];

  return {
    ...pageJson,
    sections,
    sectionsOrder: ordered
  };
}

function withLightweightCollectionIntroPage(pageJson: ThemePageJson, site: Site): ThemePageJson {
  if (!pageJson.sectionsOrder.length) return pageJson;
  const introSectionId = "collections_intro_1";
  if (pageJson.sections[introSectionId]) return pageJson;
  const isAidreamcapes = isAidreamcapesStorefront(site);
  const isSpanishXby = isSpanishXbyStorefront(site);
  const firstSection = pageJson.sections[pageJson.sectionsOrder[0]];
  const sections = Object.fromEntries(
    Object.entries(pageJson.sections).map(([sectionId, section]) => {
      if (section.type !== "dreamshoot_package_taxonomy" && section.type !== "aidreamcapes_package_taxonomy") {
        return [sectionId, section];
      }
      return [
        sectionId,
        {
          ...section,
          settings: {
            ...section.settings,
            headingLevel: "h2"
          }
        }
      ];
    })
  ) as ThemePageJson["sections"];
  return {
    ...pageJson,
    sectionsOrder: [introSectionId, ...pageJson.sectionsOrder],
    sections: {
      ...sections,
      [introSectionId]: {
        type: "rich_text",
        settings: {
          anchor: "packages",
          eyebrow: isSpanishXby ? isAidreamcapes ? "Biblioteca de albumes de ocasion" : "Biblioteca de paquetes de fotos" : isAidreamcapes ? "Occasion album library" : "Photo package library",
          title: isSpanishXby
            ? isAidreamcapes
              ? "Albumes privados de fans y recuerdos festivos por ocasion."
              : "Paquetes de fotos con IA por estilo, uso y entrega."
            : firstSection?.settings?.title || (isAidreamcapes ? "Private fan-scene and holiday albums by occasion." : "AI photo packages by style, use case, and delivery goal."),
          body: isSpanishXby
            ? isAidreamcapes
              ? "Explora albumes de fans, grupos de partido, estrenos, Navidad, Accion de Gracias y Halloween antes de gastar creditos."
              : "Compara retratos profesionales, retratos de creador, fotos de hincha, belleza, albumes tematicos y video antes de gastar creditos."
            : firstSection?.settings?.subtitle || (isAidreamcapes
              ? "Browse fan-scene albums, game-day group portraits, premiere-inspired sets, Christmas, Thanksgiving, Halloween, and seasonal memories before you spend credits."
              : "Compare headshots, creator portraits, fan photos, beauty previews, themed albums, and video add-ons before you spend credits."),
          primaryCta: isSpanishXby ? isAidreamcapes ? "Ver albumes de ocasion" : "Ver paquetes de fotos" : isAidreamcapes ? "Browse occasion albums" : "Browse photo packages",
          primaryHref: "#package-taxonomy",
          secondaryCta: isSpanishXby ? "Ver precios" : "View pricing",
          secondaryHref: "/pricing",
          layout: "compact",
          headingLevel: "h1"
        },
        blocks: []
      }
    }
  };
}

function withDreamShootCollectionsDirectoryPage(pageJson: ThemePageJson, site: Site): ThemePageJson {
  const page = withLightweightCollectionIntroPage(pageJson, site);
  const hasPackageTaxonomy = page.sectionsOrder.some((sectionId) => {
    const type = page.sections[sectionId]?.type;
    return type === "dreamshoot_package_taxonomy" || type === "aidreamcapes_package_taxonomy";
  });
  if (hasPackageTaxonomy) return page;

  const isAidreamcapes = isAidreamcapesStorefront(site);
  const isSpanishXby = isSpanishXbyStorefront(site);
  const taxonomySectionId = safeSectionId(page, "package_taxonomy_1");
  const insertAfterIntro = page.sectionsOrder.indexOf("collections_intro_1");
  const sectionsOrder = [...page.sectionsOrder];
  sectionsOrder.splice(insertAfterIntro >= 0 ? insertAfterIntro + 1 : Math.min(1, sectionsOrder.length), 0, taxonomySectionId);

  return {
    ...page,
    sectionsOrder,
    sections: {
      ...page.sections,
      [taxonomySectionId]: {
        type: "dreamshoot_package_taxonomy",
        settings: {
          anchor: "package-taxonomy",
          eyebrow: isSpanishXby ? isAidreamcapes ? "Biblioteca de albumes de ocasion" : "Biblioteca de paquetes de fotos" : isAidreamcapes ? "Occasion album library" : "Photo package library",
          title: isSpanishXby
            ? isAidreamcapes
              ? "Albumes privados de fans y recuerdos festivos por ocasion."
              : "Paquetes de fotos con IA por estilo, uso y entrega."
            : isAidreamcapes
              ? "Private fan-scene and holiday albums by occasion."
              : "AI photo packages by style, use case, and delivery goal.",
          subtitle: isSpanishXby
            ? isAidreamcapes
              ? "Explora albumes de fans, grupos de partido, estrenos, Navidad, Accion de Gracias y Halloween antes de gastar creditos."
              : "Compara retratos profesionales, retratos de creador, fotos de hincha, belleza, albumes tematicos y video antes de gastar creditos."
            : isAidreamcapes
              ? "Browse fan-scene albums, game-day group portraits, premiere-inspired sets, Christmas, Thanksgiving, Halloween, and seasonal memories before you spend credits."
              : "Compare headshots, creator portraits, fan photos, beauty previews, themed albums, and video add-ons before you spend credits.",
          layout: "editorial",
          headingLevel: "h2"
        },
        blocks: []
      }
    }
  };
}

export function getSiteBySlugFromState(state: PlatformState, siteSlug: string): Site | undefined {
  const canonicalSlug = canonicalSiteSlug(siteSlug);
  return state.sites.find((item) => item.slug === canonicalSlug);
}

export function getDefaultCustomerAuth(state: PlatformState, siteId: string, errorCode?: string) {
  return {
    defaultEmail: "",
    defaultName: "",
    defaultPassword: "",
    initialMessage: authMessageForCode("customer", errorCode)
  };
}

function normalizeToolLookup(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/tools\//, "")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePublicSlug(value: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  return decoded
    .trim()
    .toLowerCase()
    .replace(/^\/?(collections|tools)\//, "")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sectionSetting(page: ThemePageJson, sectionId: string, key: string, fallback = ""): string {
  const value = page.sections[sectionId]?.settings?.[key];
  return typeof value === "string" ? value : fallback;
}

function blockString(block: SectionBlockInstance, key: string, fallback = ""): string {
  const value = block.settings[key];
  return typeof value === "string" ? value : fallback;
}

function toolBlockFromMenuItem(item: ToolMenuItem): SectionBlockInstance {
  const parent = item.category?.parent;
  const category = parent?.label || item.category?.label || "AI Tools";
  const categoryDescription = parent?.description || item.category?.description || "";
  const categoryIcon = parent?.icon || parent?.iconName || item.category?.icon || item.category?.iconName || "";
  return {
    id: `tool_menu_${item.id}`,
    type: "tool_card",
    settings: {
      title: item.title,
      description: item.description ?? "",
      category,
      categoryTitle: category,
      categoryDescription,
      categoryIcon,
      badge: item.category?.parent ? item.category.label : item.badge ?? item.category?.label ?? "Tool",
      icon: item.icon ?? item.category?.icon ?? item.category?.iconName ?? parent?.icon ?? parent?.iconName ?? "",
      imageUrl: item.imageUrl ?? "",
      href: item.href || `/tools/${item.slug}`,
      ...(item.detailJson ? { detailJson: item.detailJson } : {})
    }
  };
}

function clonePageJson(page: ThemePageJson): ThemePageJson {
  return JSON.parse(JSON.stringify(page)) as ThemePageJson;
}

function toolBlocksFromTheme(site: Site): SectionBlockInstance[] {
  const headerBlocks = site.themeSettings.publishedJson.globalSections?.header?.blocks?.filter((block) => block.type === "tool_card") ?? [];
  const toolPage = site.pages.find((page) => page.slug === "/tools" || page.pageType === "tools");
  const toolPageBlocks = toolPage
    ? Object.values(toolPage.publishedJson.sections).flatMap((section) => section.blocks ?? []).filter((block) => block.type === "tool_card")
    : [];
  const blocks = [...headerBlocks, ...toolPageBlocks];
  return Array.from(new Map(blocks.map((block) => [block.id, block])).values());
}

function toolSlugFromBlock(block: SectionBlockInstance): string {
  const href = blockString(block, "href", "");
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  return normalizeToolLookup(path.replace(/^\/tools\//, "") || block.id || blockString(block, "title"));
}

function appSlugForToolCategory(category: string, siteAiApps: ReturnType<typeof getSiteAppsFromState>): string {
  const normalized = category.toLowerCase();
  const preferred = normalized.includes("video") ? "video_generator" : "image_generator";
  return siteAiApps.find((app) => app.aiApp.slug === preferred)?.aiApp.slug ?? siteAiApps[0]?.aiApp.slug ?? preferred;
}

function titleFromToolSlug(toolSlug: string): string {
  const explicit: Record<string, string> = {
    "photo-ai": "Photo AI",
    "video-ai": "Video AI",
    "ai-photo-edit": "AI Photo Edit",
    "background-changer": "Background Changer",
    "background-remover": "Image Background Remover",
    "magic-eraser": "Magic Eraser",
    "photo-enhancer": "Photo Enhancer",
    "unblur-image": "Unblur Image",
    "color-correction": "Color Correction",
    "old-photo-restoration": "Old Photo Restoration",
    "edit-by-prompt": "Photo Edit by Prompt",
    "headshot-generator": "Headshot Photo Generator",
    "wedding-portraits": "Wedding Portraits",
    "image-to-video": "Image to Video Concept"
  };
  return explicit[toolSlug] ?? toolSlug.split("-").filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function categoryForToolSlug(toolSlug: string): string {
  if (toolSlug.includes("video") || toolSlug.includes("clip") || toolSlug.includes("motion")) return "Video AI";
  if (toolSlug.includes("background") || toolSlug.includes("eraser") || toolSlug.includes("enhancer") || toolSlug.includes("unblur") || toolSlug.includes("correction") || toolSlug.includes("restoration") || toolSlug.includes("prompt")) {
    return "AI Photo Edit";
  }
  return "Photo AI";
}

function isStandaloneVideoToolSlug(toolSlug: string): boolean {
  return toolSlug.includes("video") || toolSlug.includes("clip") || toolSlug.includes("motion") || toolSlug.includes("reel");
}

function fallbackToolBlockForSlug(toolSlug: string): SectionBlockInstance | undefined {
  if (!dreamshootImageStudioToolAliases.has(toolSlug)) return undefined;
  const title = titleFromToolSlug(toolSlug);
  return {
    id: `fallback_tool_${toolSlug}`,
    type: "tool_card",
    settings: {
      title,
      category: categoryForToolSlug(toolSlug),
      href: `/tools/${toolSlug}`,
      description: customerToolIntro(toolSlug, title)
    }
  };
}

function aidreamcapesToolBlockForSlug(site: Site, toolSlug: string): SectionBlockInstance {
  const content = getSeoDirectoryContentForSite(site, "tool", toolSlug);
  const category = toolSlug.includes("avatar") ? "Fantasy Portrait Tools" :
    toolSlug.includes("product") || toolSlug.includes("social") ? "Creator Story Tools" :
    "Dreamscape Portrait Tools";
  return {
    id: `aidreamcapes_tool_${toolSlug}`,
    type: "tool_card",
    settings: {
      title: content.label,
      description: content.intro,
      category,
      categoryTitle: category,
      categoryDescription: "Site-maintained Aidreamcapes tools for private portrait galleries.",
      badge: "Aidreamcapes",
      href: `/tools/${toolSlug}`
    }
  };
}

function spanishXbyToolCategoryForSlug(site: Site, toolSlug: string): string {
  if (isAidreamcapesStorefront(site)) return "Herramienta de viaje IA";
  if (toolSlug.includes("video") || toolSlug.includes("clip") || toolSlug.includes("motion")) return "Video IA";
  if (toolSlug.includes("background") || toolSlug.includes("eraser") || toolSlug.includes("enhancer") || toolSlug.includes("unblur") || toolSlug.includes("correction") || toolSlug.includes("restoration") || toolSlug.includes("prompt")) return "Edicion IA";
  return "Foto IA";
}

function spanishXbyToolBlockForSite(site: Site, block: SectionBlockInstance): SectionBlockInstance {
  if (!isSpanishXbyStorefront(site)) return block;
  const toolSlug = toolSlugFromBlock(block);
  const content = getSeoDirectoryContentForSite(site, "tool", toolSlug);
  const category = spanishXbyToolCategoryForSlug(site, toolSlug);
  return {
    ...block,
    settings: {
      ...block.settings,
      title: content.label,
      description: content.intro,
      category,
      categoryTitle: category,
      categoryDescription: isAidreamcapesStorefront(site)
        ? "Herramientas mantenidas para retratos de viaje, rutas visuales y galerias privadas."
        : "Herramientas mantenidas para fotos, retoques, vistas previas y albumes privados.",
      badge: category,
      href: `/tools/${toolSlug}`
    }
  };
}

function creativePackCollectionSlugs(site: Site, pack: PlatformState["creativePacks"][number]): string[] {
  return Array.from(new Set(
    [
      pack.categoryRecord?.slug,
      pack.categoryRecord?.parent?.slug,
      pack.category,
      pack.name
    ]
      .map((value) => value ? normalizePublicSlug(value) : "")
      .filter(Boolean)
      .flatMap((slug) => [slug, canonicalSeoDirectorySlugForSite(site, "collection", slug)])
  ));
}

export function canResolveCollectionSlugForSite(state: PlatformState, site: Site, collectionSlug: string): boolean {
  const normalized = normalizePublicSlug(collectionSlug);
  if (!normalized) return false;
  if (isExplicitSeoDirectoryContentForSite(site, "collection", normalized)) return true;
  const canonicalSlug = canonicalSeoDirectorySlugForSite(site, "collection", normalized);
  if ((state.creativePackCategories ?? []).some((category) => {
    if (category.siteId !== site.id || category.status !== "active") return false;
    return canonicalSeoDirectorySlugForSite(site, "collection", category.slug || category.label) === canonicalSlug;
  })) return true;
  return state.creativePacks.some((pack) => pack.siteId === site.id && pack.status === "active" && creativePackCollectionSlugs(site, pack).includes(canonicalSlug));
}

const workspaceOnlyToolSectionTypes = new Set(["upload_panel", "generation_form", "job_progress", "album_gallery"]);

function safeSectionId(page: ThemePageJson, preferredId: string): string {
  if (!page.sections[preferredId]) return preferredId;
  let next = 2;
  while (page.sections[`${preferredId}_${next}`]) next += 1;
  return `${preferredId}_${next}`;
}

function withToolEntryFirst(page: ThemePageJson): ThemePageJson {
  const entrySectionId = page.sectionsOrder.find((sectionId) => page.sections[sectionId]?.type === "ai_tool_entry");
  if (!entrySectionId || page.sectionsOrder[0] === entrySectionId) return page;
  return {
    ...page,
    sectionsOrder: [entrySectionId, ...page.sectionsOrder.filter((sectionId) => sectionId !== entrySectionId)]
  };
}

type CustomerToolCopy = {
  intro: string;
  primaryCta: string;
  guideTitle: string;
  guideBody: string;
  inputTitle: string;
  inputDescription: string;
  styleTitle: string;
  styleDescription: string;
  outputTitle: string;
  outputDescription: string;
  useCaseOneTitle: string;
  useCaseOneDescription: string;
  useCaseTwoTitle: string;
  useCaseTwoDescription: string;
  detailBody: string;
};

function customerToolIntro(toolSlug: string, title: string): string {
  const copy = customerToolCopy(toolSlug, title, categoryForToolSlug(toolSlug));
  return copy.intro;
}

function customerToolCopy(toolSlug: string, title: string, category: string): CustomerToolCopy {
  const fallback: CustomerToolCopy = {
    intro: `Use ${title} to turn your own uploads into a private, ready-to-download photo set with clear guidance before you start.`,
    primaryCta: "Start this photo set",
    guideTitle: `Plan your ${title.toLowerCase()} set`,
    guideBody: `Start with the right upload, choose the result you want, then review the private output before your next edit or download.`,
    inputTitle: "Upload the right source photos",
    inputDescription: `Choose clear portraits, product photos, or references that match the ${category.toLowerCase()} result you want.`,
    styleTitle: "Choose the result you need",
    styleDescription: "Pick the look, use case, or visual direction before you continue, so the editor starts with the right intent.",
    outputTitle: "Download a private result",
    outputDescription: "Your finished images stay in your account, where you can review, download, and keep the best options.",
    useCaseOneTitle: "Profile and creator updates",
    useCaseOneDescription: `${title} helps refresh profile photos, creator visuals, campaign images, and social-ready assets from everyday uploads.`,
    useCaseTwoTitle: "Clear next step",
    useCaseTwoDescription: "Start with your source photos, review the credit cost, then create the photo set when you are ready.",
    detailBody: `Use ${title} when you already know the outcome you want. Upload clear source material, choose the visual direction, and continue with the finished result in your private account.`
  };
  const overrides: Record<string, Partial<CustomerToolCopy>> = {
    headshot: {
      intro: "Upload selfies or casual portraits and create a profile-ready headshot set for LinkedIn, resumes, founder pages, and team bios.",
      primaryCta: "Create profile headshots",
      guideTitle: "Create headshots from everyday selfies",
      guideBody: "Upload varied face photos, choose a professional look, then review polished headshot options before downloading your favorites.",
      inputTitle: "Upload varied face photos",
      inputDescription: "Use clear selfies with different angles, simple lighting, and natural expressions for more realistic business portraits.",
      styleTitle: "Choose a professional look",
      styleDescription: "Aim for clean studio lighting, founder portraits, resume photos, or team-page images before you create.",
      outputTitle: "Download profile-ready options",
      outputDescription: "Review several polished headshots in your private account and choose the best images for professional channels.",
      useCaseOneTitle: "LinkedIn, resumes, and bios",
      useCaseOneDescription: "Create a trustworthy profile image without booking a studio session.",
      useCaseTwoTitle: "Team-ready portraits",
      useCaseTwoDescription: "Upload each person's best source photos, generate consistent options, and choose matching portraits for the team page.",
      detailBody: "The headshot maker turns everyday uploads into a private set of professional portraits. Use it when the next step is a LinkedIn update, resume refresh, founder bio, or team directory."
    },
    "headshot-generator": {
      primaryCta: "Create profile headshots"
    },
    "background-changer": {
      intro: "Replace a distracting background with a cleaner setting before you order portraits, product shots, or social images.",
      primaryCta: "Change my background",
      guideTitle: "Clean up the scene behind your subject",
      guideBody: "Upload a clear subject photo, choose a cleaner setting, then save the edited image or use it as better source material for a larger set.",
      inputTitle: "Upload a clear subject photo",
      inputDescription: "Use an image where the person, product, or object is easy to see and separated from the background.",
      styleTitle: "Choose the new setting",
      styleDescription: "Move from cluttered rooms to clean studio, lifestyle, travel, or brand-friendly backgrounds.",
      outputTitle: "Save a cleaner image",
      outputDescription: "Use the edited image for profiles, listings, campaign drafts, or as stronger source material for a full photo set.",
      useCaseOneTitle: "Better portraits and listings",
      useCaseOneDescription: "Remove visual noise before creating a profile image, product visual, or creator post.",
      useCaseTwoTitle: "Fast source-photo repair",
      useCaseTwoDescription: "Fix the background first when the subject is good but the setting is not.",
      detailBody: "Background changer is for photos where the subject works but the scene gets in the way. Upload the image, replace the setting, then continue with a cleaner asset for profiles, listings, posts, or photo packages."
    },
    "image-to-video": {
      intro: "Turn a strong still image into a short video concept for creator intros, product teasers, social clips, and campaign previews.",
      primaryCta: "Create a video concept",
      guideTitle: "Plan motion from a still image",
      guideBody: "Upload one finished image, choose the motion idea, then review a private short clip before downloading or planning the next video package.",
      inputTitle: "Upload one strong image",
      inputDescription: "Start with a sharp portrait, product shot, or scene that already has the look you want to animate.",
      styleTitle: "Choose the motion idea",
      styleDescription: "Think about camera movement, mood, pacing, and where the short video clip will be used before creating.",
      outputTitle: "Review a private video draft",
      outputDescription: "Use the video output as a social clip, intro concept, product teaser, or creative direction for a larger motion set.",
      useCaseOneTitle: "Social and creator clips",
      useCaseOneDescription: "Give a finished image enough movement for short-form posts and profile intros.",
      useCaseTwoTitle: "Campaign previews",
      useCaseTwoDescription: "Test motion, pacing, and mood before investing in a larger video package.",
      detailBody: "Image to video starts with a still image and returns a private short clip with motion. Use it when the next step is video output for a post, profile intro, teaser, or campaign preview."
    },
    "background-remover": {
      primaryCta: "Remove my background",
      intro: "Cut out a subject from a busy image and prepare a cleaner asset for profile photos, product visuals, and creative edits."
    },
    "photo-enhancer": {
      primaryCta: "Enhance my photo",
      intro: "Improve dark, soft, or low-detail source photos before using them for portraits, packages, or social-ready images."
    },
    "anime-avatar": {
      primaryCta: "Create an anime avatar",
      intro: "Turn source portraits into anime-inspired avatars for profiles, creator identities, and playful social images."
    },
    "cyberpunk-portrait": {
      primaryCta: "Create a neon portrait",
      intro: "Transform a clean portrait into a cinematic neon city image for avatars, campaigns, and high-impact social posts."
    }
  };
  return { ...fallback, ...(overrides[toolSlug] ?? {}) };
}

function toolDetailGuideBlocks(copy: CustomerToolCopy): SectionBlockInstance[] {
  return [
    {
      id: "tool_detail_input",
      type: "rich_text_card",
      settings: {
        meta: "01",
        title: copy.inputTitle,
        description: copy.inputDescription
      }
    },
    {
      id: "tool_detail_preset",
      type: "rich_text_card",
      settings: {
        meta: "02",
        title: copy.styleTitle,
        description: copy.styleDescription
      }
    },
    {
      id: "tool_detail_delivery",
      type: "rich_text_card",
      settings: {
        meta: "03",
        title: copy.outputTitle,
        description: copy.outputDescription
      }
    }
  ];
}

function toolDetailUseCaseBlocks(copy: CustomerToolCopy): SectionBlockInstance[] {
  return [
    {
      id: "tool_detail_use_case_1",
      type: "rich_text_card",
      settings: {
        meta: "Best for",
        title: copy.useCaseOneTitle,
        description: copy.useCaseOneDescription
      }
    },
    {
      id: "tool_detail_use_case_2",
      type: "rich_text_card",
      settings: {
        meta: "Next step",
        title: copy.useCaseTwoTitle,
        description: copy.useCaseTwoDescription
      }
    }
  ];
}

const dreamshootToolDirectorySlugs = [
  "background-changer",
  "background-remover",
  "magic-eraser",
  "photo-enhancer",
  "unblur-image",
  "color-correction",
  "old-photo-restoration",
  "edit-by-prompt",
  "headshot-generator",
  "wedding-portraits",
  "anime-avatar",
  "gala-photo",
  "cyberpunk-portrait",
  "image-to-video",
  "profile-clip",
  "creator-intro-video"
];

const fallbackToolDirectoryBlocks = cache((): SectionBlockInstance[] =>
  dreamshootToolDirectorySlugs.map((slug) => fallbackToolBlockForSlug(slug)).filter((block): block is SectionBlockInstance => Boolean(block))
);

function withDreamShootToolsDirectoryPage(pageJson: ThemePageJson, site: Site): ThemePageJson {
  const blocks = toolBlocksFromTheme(site);
  const toolsBySlug = new Map<string, SectionBlockInstance>();
  const isAidreamcapes = isAidreamcapesStorefront(site);
  const isSpanishXby = isSpanishXbyStorefront(site);
  if (isAidreamcapes) {
    for (const slug of getExplicitSeoDirectorySlugsForSite(site, "tool")) {
      toolsBySlug.set(slug, aidreamcapesToolBlockForSlug(site, slug));
    }
  } else {
    for (const block of fallbackToolDirectoryBlocks()) {
      toolsBySlug.set(toolSlugFromBlock(block), block);
    }
  }
  for (const block of blocks) {
    const slug = toolSlugFromBlock(block);
    toolsBySlug.set(slug, block);
  }
  const tools = Array.from(toolsBySlug.values()).map((tool) => isSpanishXby ? spanishXbyToolBlockForSite(site, tool) : tool);
  return {
    ...pageJson,
    sectionsOrder: ["tools_directory_1"],
    sections: {
      tools_directory_1: {
        type: "dreamshoot_tool_collection",
        settings: {
          anchor: "tools",
          title: isSpanishXby
            ? isAidreamcapes
              ? "Herramientas de albumes privados de ocasion"
              : "Herramientas de fotos con IA"
            : isAidreamcapes
              ? "Aidreamcapes studio tools"
              : "AI Tools Collection",
          subtitle: isSpanishXby
            ? isAidreamcapes
              ? "Elige herramientas para albumes de fans, grupos de partido, estrenos, Navidad, Accion de Gracias, Halloween y recuerdos privados."
              : "Elige herramientas para generar fotos, cambiar fondos, preparar videos, retocar imagenes y entregar albumes privados."
            : isAidreamcapes
              ? "Choose a focused Aidreamcapes tool for fan-scene albums, game-day group portraits, premiere-inspired sets, Christmas groups, Thanksgiving keepsakes, Halloween portraits, and seasonal memories."
              : "Discover paid AI tools for photo generation, background editing, video concepts, and private album workflows. Every tool has its own page and opens the editor with the correct preset.",
          categories: isSpanishXby
            ? isAidreamcapes
              ? "Fans|Dia de partido|Festivos|Seguridad"
              : "Foto IA|Edicion IA|Video IA"
            : isAidreamcapes ? "Fan-Scene Tools|Game-Day Tools|Holiday Memory Tools|Safety Planning Tools" : "Photo AI|AI Photo Edit|Video AI",
          layout: "directory"
        },
        blocks: tools
      }
    }
  };
}

function baseToolDetailPageForSite(site: Site, page?: Site["pages"][number]): Site["pages"][number] {
  const existingToolPage =
    page ??
    site.pages.find((item) => item.slug === "/tools/image-studio") ??
    site.pages.find((item) => item.pageType === "ai_tool" && /^\/tools\/[^/]+$/.test(item.slug));
  if (existingToolPage) return existingToolPage;
  const template = clonePageJson(dreamshootAiStudioTemplates["tool-detail"]);
  return {
    id: `${site.id}_synthetic_tool_detail`,
    siteId: site.id,
    pageType: "ai_tool",
    templateKey: "tool-detail",
    slug: "/tools/image-studio",
    title: "AI tool",
    draftJson: template,
    publishedJson: template
  };
}

function isAidreamcapesStorefront(site: Pick<Site, "id" | "slug" | "name" | "primaryDomain"> & { branding: Pick<Site["branding"], "logoText"> }): boolean {
  return `${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`.toLowerCase().includes("aidreamcapes");
}

function usesSharedDreamShootNavigation(site: Pick<Site, "id" | "slug" | "name" | "primaryDomain"> & { branding: Pick<Site["branding"], "logoText"> }): boolean {
  return /mydreamshoots|dreamshoot/i.test(`${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`) || isAidreamcapesStorefront(site);
}

function aidreamcapesToolFaqBlocks(label: string, workflow: string[]): SectionBlockInstance[] {
  return [
    {
      id: "faq_inputs",
      type: "faq_item",
      settings: {
        question: `What should I upload for ${label}?`,
        answer: workflow[1] ?? "Upload clear source portraits or references that match the dreamscape direction you want."
      }
    },
    {
      id: "faq_private",
      type: "faq_item",
      settings: {
        question: "Are Aidreamcapes results private?",
        answer: "Yes. Source photos, photo sets, credit records, and finished galleries stay connected to the signed-in customer account."
      }
    },
    {
      id: "faq_credits",
      type: "faq_item",
      settings: {
        question: "When are credits used?",
        answer: "Credits are shown before a request starts, reserved for generation, consumed after successful delivery, and released when a request fails."
      }
    }
  ];
}

function detailText(detail: ToolMenuItem["detailJson"] | undefined, key: keyof NonNullable<ToolMenuItem["detailJson"]>, fallback: string): string {
  const value = detail?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function detailList(detail: ToolMenuItem["detailJson"] | undefined, key: "useCases" | "workflow", fallback: string[]): string[] {
  const value = detail?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : fallback;
}

function synthesizeToolDetailPage(basePage: ThemePageJson, tool: SectionBlockInstance, toolSlug: string, appSlug: string, site: Site): ThemePageJson {
  const page = clonePageJson(basePage);
  const title = blockString(tool, "title", sectionSetting(page, "entry_1", "title", "AI photo tool"));
  const category = blockString(tool, "category", "AI Photo");
  const copy = customerToolCopy(toolSlug, title, category);
  const detail = tool.settings.detailJson && typeof tool.settings.detailJson === "object" && !Array.isArray(tool.settings.detailJson)
    ? tool.settings.detailJson as ToolMenuItem["detailJson"]
    : undefined;
  const aidreamcapes = isAidreamcapesStorefront(site);
  const spanishXby = isSpanishXbyStorefront(site);
  const directoryContent = getSeoDirectoryContentForSite(site, "tool", toolSlug);
  const effectiveCategory = spanishXby ? aidreamcapes ? "Herramienta de viaje IA" : "Herramienta de fotos IA" : category;
  const effectiveTitle = spanishXby ? directoryContent.label : detailText(detail, "title", aidreamcapes ? directoryContent.label : title);
  const effectiveDescription = spanishXby ? directoryContent.intro : detailText(detail, "subtitle", aidreamcapes ? directoryContent.intro : blockString(tool, "description", sectionSetting(page, "entry_1", "subtitle", copy.intro)));
  const effectiveCta = detailText(detail, "ctaLabel", spanishXby ? aidreamcapes ? "Crear ruta privada" : "Crear set privado" : aidreamcapes ? directoryContent.ctaLabel : copy.primaryCta);
  const guideTitle = detailText(detail, "guideTitle", spanishXby ? `Guia de ${effectiveTitle}` : aidreamcapes ? directoryContent.h3[0] ?? copy.guideTitle : copy.guideTitle);
  const guideBody = detailText(
    detail,
    "guideBody",
    spanishXby
      ? aidreamcapes
        ? `Sube fotos fuente claras, elige una direccion de viaje, revisa creditos visibles y guarda resultados en la galeria privada de ${site.branding.logoText || site.name}.`
        : `Sube fotos fuente claras, elige el estilo, revisa creditos visibles y guarda resultados en la galeria privada de ${site.branding.logoText || site.name}.`
      : aidreamcapes ? directoryContent.workflow.join(" ") : copy.guideBody
  );
  const detailTitle = detailText(detail, "detailTitle", spanishXby ? `Detalles de ${effectiveTitle}` : aidreamcapes ? `How ${directoryContent.label} fits Aidreamcapes` : `What ${title} is used for`);
  const detailBody = detailText(
    detail,
    "detailBody",
    spanishXby
      ? "Esta pagina resume el uso recomendado, las fotos fuente necesarias y el flujo privado antes de iniciar la generacion."
      : aidreamcapes ? directoryContent.details.join(" ") : copy.detailBody
  );
  const workflowItems = spanishXby ? directoryContent.workflow : detailList(detail, "workflow", aidreamcapes ? directoryContent.workflow : []);
  const useCaseItems = spanishXby ? directoryContent.useCases : detailList(detail, "useCases", aidreamcapes ? directoryContent.useCases : [copy.useCaseOneDescription, copy.useCaseTwoDescription]);
  const imageUrl = blockString(tool, "imageUrl", sectionSetting(page, "entry_1", "imageUrl"));
  const appCreateHref = isStandaloneVideoToolSlug(toolSlug) ? "/app/create#step-video" : `/app/create?tool_id=${encodeURIComponent(toolSlug)}`;
  const keptSectionIds = page.sectionsOrder.filter((sectionId) => {
    const type = page.sections[sectionId]?.type;
    return type && !workspaceOnlyToolSectionTypes.has(type);
  });
  page.sectionsOrder = keptSectionIds;
  for (const [sectionId, section] of Object.entries(page.sections)) {
    if (workspaceOnlyToolSectionTypes.has(section.type)) {
      delete page.sections[sectionId];
    }
  }
  if (page.sections.tool_banner_1) {
    page.sections.tool_banner_1.settings = {
      ...page.sections.tool_banner_1.settings,
      eyebrow: effectiveCategory,
      title: effectiveTitle,
      subtitle: effectiveDescription,
      imageUrl
    };
  }
  if (!page.sections.entry_1) {
    page.sections.entry_1 = {
      type: "ai_tool_entry",
      settings: {}
    };
    if (!page.sectionsOrder.includes("entry_1")) {
      page.sectionsOrder.splice(0, 0, "entry_1");
    }
  }
  if (page.sections.entry_1) {
    page.sections.entry_1.settings = {
      ...page.sections.entry_1.settings,
      aiAppSlug: appSlug,
      eyebrow: spanishXby ? effectiveCategory : detailText(detail, "eyebrow", category),
      title: effectiveTitle,
      subtitle: effectiveDescription,
      ctaLabel: effectiveCta,
      ctaHref: appCreateHref,
      imageUrl,
      toolSlug
    };
  }
  const guideSectionId = safeSectionId(page, "tool_detail_guide_1");
  const useCaseSectionId = safeSectionId(page, "tool_detail_use_cases_1");
  page.sections[guideSectionId] = {
    type: "rich_text",
    settings: {
      eyebrow: effectiveCategory,
      title: guideTitle,
      body: guideBody,
      primaryCta: effectiveCta,
      primaryHref: appCreateHref,
      secondaryCta: spanishXby ? "Elegir un plan" : "Choose a plan",
      secondaryHref: "/pricing",
      layout: "compact"
    },
    blocks: workflowItems.length
      ? workflowItems.slice(0, 3).map((description, index) => ({
          id: `tool_detail_step_${index + 1}`,
          type: "rich_text_card",
          settings: { meta: `0${index + 1}`, title: directoryContent.h3[index] ?? `${spanishXby ? "Paso" : "Step"} ${index + 1}`, description }
        }))
      : toolDetailGuideBlocks(copy)
  };
  page.sections[useCaseSectionId] = {
    type: "rich_text",
    settings: {
      eyebrow: spanishXby ? "Detalles de herramienta" : "Tool details",
      title: detailTitle,
      body: detailBody,
      layout: "compact",
      tone: "dark"
    },
    blocks: useCaseItems.length
      ? useCaseItems.slice(0, 4).map((description, index) => ({
          id: `tool_detail_use_case_${index + 1}`,
          type: "rich_text_card",
          settings: { meta: index === 0 ? spanishXby ? "Ideal para" : "Best for" : spanishXby ? "Caso de uso" : "Use case", title: description, description }
        }))
      : toolDetailUseCaseBlocks(copy)
  };
  if (aidreamcapes && page.sections.faq_1) {
    page.sections.faq_1.settings = {
      ...page.sections.faq_1.settings,
      eyebrow: spanishXby ? "Preguntas de herramienta" : "Aidreamcapes tool questions",
      title: spanishXby ? `FAQ de ${directoryContent.label}` : `${directoryContent.label} FAQ`,
      subtitle: spanishXby ? "Respuestas sobre fotos fuente, creditos, galerias privadas y entrega antes de generar." : "Answers about source photos, credits, private galleries, and delivery before you generate."
    };
    page.sections.faq_1.blocks = spanishXby
      ? [
          {
            id: "faq_inputs",
            type: "faq_item",
            settings: {
              question: `Que debo subir para ${directoryContent.label}?`,
              answer: directoryContent.workflow[1] ?? "Sube retratos o referencias claras que coincidan con la direccion de viaje que quieres."
            }
          },
          {
            id: "faq_private",
            type: "faq_item",
            settings: {
              question: "Los resultados son privados?",
              answer: "Si. Fotos fuente, pedidos, creditos y galerias terminadas permanecen vinculados a la cuenta del cliente."
            }
          },
          {
            id: "faq_credits",
            type: "faq_item",
            settings: {
              question: "Cuando se usan los creditos?",
              answer: "Los creditos se muestran antes de empezar, se reservan durante la generacion y se liberan si el pedido falla."
            }
          }
        ]
      : aidreamcapesToolFaqBlocks(directoryContent.label, directoryContent.workflow);
  }
  const insertAfterEntry = page.sectionsOrder.includes("entry_1") ? page.sectionsOrder.indexOf("entry_1") + 1 : page.sectionsOrder.length;
  page.sectionsOrder.splice(insertAfterEntry, 0, guideSectionId, useCaseSectionId);
  return page;
}

const dreamshootImageStudioToolAliases = new Set([
  "photo-ai",
  "video-ai",
  "ai-photo-edit",
  "headshot-generator",
  "headshot-maker",
  "professional-headshot",
  "professional-headshot-maker",
  "headshot",
  "creator-portrait-studio",
  "creator-portrait",
  "world-cup-fan-photos",
  "cyberpunk-portrait-maker",
  "cyberpunk-portrait",
  "gala-photo-maker",
  "gala-photo",
  "noir-character-portraits",
  "noir-portrait",
  "anime-avatar-builder",
  "anime-avatar",
  "nature-adventure-photos",
  "nature-adventure",
  "fashion-editorial-set",
  "fashion-editorial",
  "product-lifestyle-photos",
  "product-lifestyle",
  "ai-image-studio",
  "background-changer",
  "background-remover",
  "magic-eraser",
  "photo-enhancer",
  "portrait-retouch",
  "unblur-image",
  "color-correction",
  "old-photo-restoration",
  "edit-by-prompt",
  "magic-upscaler",
  "image-to-video-concept",
  "image-to-video",
  "profile-clip-maker",
  "profile-clip",
  "fan-poster-motion",
  "creator-intro-video",
  "product-teaser-clip",
  "animated-avatar-preview",
  "animated-avatar",
  "fashion-reel-starter",
  "fashion-reel",
  "album-story-video",
  "hairstyle-preview",
  "wedding-portraits",
  "indian-wedding",
  "christmas-photos",
  "virtual-try-on",
  "package-preview"
]);

const aidreamcapesToolAliases = new Map<string, string>([
  ["portrait-generator", "fan-scene-album-builder"],
  ["portrait-maker", "fan-scene-album-builder"],
  ["dreamscape-generator", "fan-scene-album-builder"],
  ["image-studio", "fan-scene-album-builder"],
  ["image-generator", "fan-scene-album-builder"],
  ["headshot", "premiere-portrait-set-builder"],
  ["background-changer", "fan-scene-album-builder"],
  ["background-remover", "fan-scene-album-builder"],
  ["image-to-video", "new-year-countdown-album-maker"],
  ["product-reverie", "permission-safe-photo-planner"],
  ["soft-glam", "premiere-portrait-set-builder"],
  ["couple-escape-album", "birthday-fan-moment-maker"],
  ["wedding-portraits", "birthday-fan-moment-maker"],
  ["world-cup-fan-photos", "game-day-group-portrait-maker"],
  ["route-portrait-engine", "fan-scene-album-builder"],
  ["coastal-portrait", "christmas-group-album-studio"],
  ["island-resort-scenes", "new-year-countdown-album-maker"],
  ["scenic-overlook-story", "game-day-group-portrait-maker"],
  ["travel-profile-story", "fan-scene-album-builder"],
  ["editorial-getaway", "premiere-portrait-set-builder"],
  ["cafe-street-story", "premiere-portrait-set-builder"],
  ["cinematic-travel", "game-day-group-portrait-maker"],
  ["route-moodboard", "permission-safe-photo-planner"],
  ["social-keepsake", "birthday-fan-moment-maker"],
  ["family-travel-keepsakes", "thanksgiving-keepsake-set-maker"],
  ["seasonal-celebration-album-maker", "new-year-countdown-album-maker"],
  ["travel-journal-cover-maker", "new-year-countdown-album-maker"]
]);

export function resolveToolPageForSite(state: PlatformState, site: Site, toolSlug: string, siteAiApps = getSiteAppsFromState(state, site.id), creativePacks = getSiteCreativePacksFromState(state, site.id)) {
  const normalizedToolSlug = normalizeToolLookup(toolSlug);
  const isAidreamcapes = isAidreamcapesStorefront(site);
  const aidreamcapesAliasTarget = isAidreamcapes ? aidreamcapesToolAliases.get(normalizedToolSlug) : undefined;
  const canonicalToolSlug = aidreamcapesAliasTarget ?? normalizedToolSlug;
  const directPageSlug = `/tools/${toolSlug}`;
  const normalizedPageSlug = normalizedToolSlug ? `/tools/${normalizedToolSlug}` : directPageSlug;
  const aliasMap = new Map<string, string>();

  for (const page of site.pages.filter((item) => item.pageType === "ai_tool")) {
    aliasMap.set(page.slug, page.slug);
    aliasMap.set(page.slug.replace(/^\/tools\//, ""), page.slug);
    aliasMap.set(normalizeToolLookup(page.slug), page.slug);
  }

  const explicitPageSlug = aliasMap.get(normalizedToolSlug) ?? aliasMap.get(directPageSlug);
  const setLegacyAlias = (alias: string, target: string) => {
    if (!aliasMap.has(alias)) aliasMap.set(alias, target);
  };

  for (const pack of creativePacks) {
    const slugCandidates = [
      pack.aiAppSlug,
      pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      pack.category
    ];
    for (const candidate of slugCandidates) {
      if (!candidate) continue;
      setLegacyAlias(candidate, "/tools/image-studio");
      setLegacyAlias(`/tools/${candidate}`, "/tools/image-studio");
      setLegacyAlias(normalizeToolLookup(candidate), "/tools/image-studio");
    }
  }

  if (/dreamshoot/i.test(`${site.slug} ${site.name} ${site.branding.logoText}`)) {
    for (const alias of dreamshootImageStudioToolAliases) {
      setLegacyAlias(alias, "/tools/image-studio");
      setLegacyAlias(`/tools/${alias}`, "/tools/image-studio");
    }
  }
  if (isAidreamcapes) {
    for (const [alias, target] of aidreamcapesToolAliases) {
      setLegacyAlias(alias, `/tools/${target}`);
      setLegacyAlias(`/tools/${alias}`, `/tools/${target}`);
      setLegacyAlias(normalizeToolLookup(alias), `/tools/${target}`);
    }
  }
  const explicitAidreamcapesToolSlug = isAidreamcapes && getExplicitSeoDirectorySlugsForSite(site, "tool").includes(canonicalToolSlug);

  const directApp = siteAiApps.find((siteApp) => normalizeToolLookup(siteApp.aiApp.slug) === canonicalToolSlug);
  const legacyImageApp = canonicalToolSlug === "image-studio" || canonicalToolSlug === "image-generator"
    ? siteAiApps.find((siteApp) => siteApp.aiApp.slug === "image_generator")
    : undefined;
  const resolvedSlug = explicitPageSlug ?? aliasMap.get(toolSlug) ?? aliasMap.get(directPageSlug) ?? aliasMap.get(normalizedToolSlug) ?? normalizedPageSlug;
  const page = site.pages.find((item) => item.slug === resolvedSlug);
  const app = directApp ?? legacyImageApp ?? (page?.slug === "/tools/image-studio" ? siteAiApps.find((siteApp) => siteApp.aiApp.slug === "image_generator") : undefined);
  const menuTool = (state.toolMenuItems ?? []).find((item) => {
    if (item.siteId !== site.id || item.status !== "active") return false;
    const hrefSlug = normalizeToolLookup(item.href.replace(/^\/tools\//, ""));
    const itemSlug = normalizeToolLookup(item.slug);
    return hrefSlug === normalizedToolSlug || hrefSlug === canonicalToolSlug || itemSlug === normalizedToolSlug || itemSlug === canonicalToolSlug;
  });
  const themeToolBlock = toolBlocksFromTheme(site).find((block) => {
    const blockSlug = toolSlugFromBlock(block);
    return blockSlug === normalizedToolSlug || blockSlug === canonicalToolSlug;
  });
  const toolBlock = menuTool
    ? toolBlockFromMenuItem(menuTool)
    : themeToolBlock ?? (explicitAidreamcapesToolSlug ? aidreamcapesToolBlockForSlug(site, canonicalToolSlug) : isAidreamcapes ? undefined : fallbackToolBlockForSlug(canonicalToolSlug));
  const localizedToolBlock = toolBlock ? spanishXbyToolBlockForSite(site, toolBlock) : undefined;
  const basePage = baseToolDetailPageForSite(site, page);
  const synthesizedPage = localizedToolBlock
    ? synthesizeToolDetailPage(
        basePage.publishedJson,
        localizedToolBlock,
        canonicalToolSlug,
        appSlugForToolCategory(blockString(toolBlock!, "category", "AI Photo"), siteAiApps),
        site,
      )
    : undefined;
  const matched = isAidreamcapes
    ? !aidreamcapesAliasTarget && Boolean(page || directApp || menuTool || themeToolBlock || explicitAidreamcapesToolSlug)
    : Boolean(page || directApp || legacyImageApp || toolBlock || aliasMap.has(toolSlug) || aliasMap.has(directPageSlug) || aliasMap.has(normalizedToolSlug));
  return { siteAiApps, page: synthesizedPage ? { ...basePage, slug: normalizedPageSlug, title: blockString(localizedToolBlock!, "title", basePage.title), publishedJson: synthesizedPage } : basePage, app, matched, resolvedSlug };
}

function renderThemePage({
  currentSite,
  page,
  pagePath,
  query,
  renderData,
  navigationCreativePackCategories,
  navigationCreativePacks,
  navigationToolMenuItems,
  routeMode,
  runtime,
  settings,
  jsonLd,
  lightweightChrome = false
}: {
  currentSite: Site;
  page: ThemePageJson;
  pagePath: string;
  query: Record<string, string | string[] | undefined>;
  renderData: SiteRenderData;
  navigationCreativePackCategories?: SiteRenderData["creativePackCategories"];
  navigationCreativePacks?: SiteRenderData["creativePacks"];
  navigationToolMenuItems?: SiteRenderData["toolMenuItems"];
  routeMode: "host" | "path";
  runtime: ThemeRuntimeData;
  settings: Site["themeSettings"]["publishedJson"];
  jsonLd?: JsonLdNode[];
  lightweightChrome?: boolean;
}) {
  return (
    <div style={themeStyleVars(settings)}>
      <ThemeRenderer
        creativePackCategories={renderData.creativePackCategories}
        creativePacks={renderData.creativePacks}
        page={page}
        pagePath={pagePath}
        products={renderData.products}
        query={query}
        routeMode={routeMode}
        runtime={runtime}
        settings={settings}
        site={clientSiteForThemeRender(currentSite, page, pagePath)}
        siteAiApps={renderData.siteAiApps}
        navigationCreativePackCategories={navigationCreativePackCategories}
        navigationCreativePacks={navigationCreativePacks}
        navigationToolMenuItems={navigationToolMenuItems}
        toolMenuItems={renderData.toolMenuItems}
        videoThemes={renderData.videoThemes}
        lightweightChrome={lightweightChrome}
      />
      {jsonLd?.length ? <StorefrontJsonLd nodes={jsonLd} /> : null}
    </div>
  );
}

export async function renderStorefrontPage({
  site,
  slug,
  query = {},
  routeMode = "path",
  state: providedState,
  deferCustomerRuntime = false
}: {
  site: Site;
  slug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
  deferCustomerRuntime?: boolean;
}) {
  const shouldDeferCustomerRuntime = deferCustomerRuntime && publicCustomerBootstrapEnabled();
  const shouldCompletePublicPacks = !(routeMode === "path" && preferLocalPathModeState(site.slug));
  const state = await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const collectionCategory = typeof query.category === "string" ? query.category : "";
  const isFocusedCollectionPage = slug === "/collections" && Boolean(collectionCategory);
  const renderData = getSiteRenderData(state, currentSite.id);
  const focusedCollectionRenderData = isFocusedCollectionPage ? trimFocusedCollectionRenderData(renderData, collectionCategory) : renderData;
  const useSharedNavigation = usesSharedDreamShootNavigation(currentSite);
  const navigationCreativePackCategories = useSharedNavigation
    ? trimCreativePackCategoriesForStorefront(renderData)
    : undefined;
  const navigationCreativePacks = useSharedNavigation
    ? trimCreativePacksForNavigation(renderData)
    : undefined;
  const navigationToolMenuItems = useSharedNavigation
    ? renderData.toolMenuItems.map(lightweightToolMenuItem)
    : undefined;
  currentSite.mediaAssets = renderData.mediaAssets;
  const directPage = findPage(currentSite, slug) ?? syntheticStorefrontPolicyPage(currentSite, slug) ?? syntheticDreamShootPartnerPage(currentSite, slug);
  if (!directPage) notFound();
  const page = directPage;
  if (isFocusedCollectionPage) {
    currentSite.pages = currentSite.pages.filter((item) => item.slug === slug || item.slug === "/404");
  }
  const settings = currentSite.themeSettings.publishedJson;
  const sessionId = shouldDeferCustomerRuntime ? undefined : await readCustomerSessionId(currentSite.id);
  const usesDreamShootToolsDirectory =
    slug === "/tools" &&
    (/dreamshoot/i.test(`${currentSite.slug} ${currentSite.name} ${currentSite.branding.logoText}`) || isAidreamcapesStorefront(currentSite));
  const pageJson = slug === "/account"
    ? withAccountDashboardPage(page.publishedJson)
    : usesDreamShootToolsDirectory
    ? withDreamShootToolsDirectoryPage(page.publishedJson, currentSite)
    : isFocusedCollectionPage
    ? withSeoDirectorySection(page.publishedJson, "collection", collectionCategory, { focused: true, site: currentSite })
    : slug === "/collections"
    ? withDreamShootCollectionsDirectoryPage(page.publishedJson, currentSite)
    : page.publishedJson;
  const renderDataForPage = isFocusedCollectionPage ? focusedCollectionRenderData : renderData;
  let pageRenderData = withPageMediaAssets(
    currentSite,
    pageJson,
    settings,
    trimRenderDataForPage(renderDataForPage, pageJson, slug)
  );
  if (shouldCompletePublicPacks && slug === "/") {
    const directoryPackLimit = pageSectionTypes(pageJson).has("dreamshoot_generation_showcase")
      ? publicDirectoryPackLimit
      : publicHomePackLimit;
    pageRenderData = {
      ...pageRenderData,
      creativePacks: await completePublicCreativePacksForSite(currentSite, pageRenderData.creativePacks, directoryPackLimit)
    };
  }
  if (shouldCompletePublicPacks && slug === "/" && !pageRenderData.creativePacks.length) {
    const directoryPackLimit = pageSectionTypes(pageJson).has("dreamshoot_generation_showcase")
      ? publicDirectoryPackLimit
      : publicHomePackLimit;
    pageRenderData = {
      ...pageRenderData,
      creativePacks: (await getStorefrontPublicCreativePacksForSite(currentSite.id, directoryPackLimit)).map((pack) => ({
        ...pack,
        prompt: undefined,
        galleryImages: (pack.galleryImages ?? []).filter(Boolean).slice(0, 12)
      }))
    };
  }
  if (pageSectionTypes(pageJson).has("dreamshoot_generation_showcase") && !pageRenderData.videoThemes.length) {
    pageRenderData = {
      ...pageRenderData,
      videoThemes: trimVideoThemesForStorefront(
        { ...emptySiteRenderData(), videoThemes: await loadStorefrontPublicVideoThemesForSection(currentSite, renderData.videoThemes, 32) },
        32
      )
    };
  }
  pageRenderData = withPageMediaAssets(currentSite, pageJson, settings, pageRenderData);
  currentSite.mediaAssets = pageRenderData.mediaAssets;
  const runtime = sessionId && pageNeedsFullCustomerRuntime(pageJson, slug)
    ? await getFullCustomerRuntime(state, currentSite.id, sessionId)
    : await getLightCustomerRuntime(state, currentSite.id, sessionId);
  const runtimeWithAuth = {
    ...runtime,
    ...(shouldDeferCustomerRuntime ? { clientBootstrapCustomer: true } : {}),
    ...(slug === "/login" ? { auth: getDefaultCustomerAuth(state, currentSite.id, typeof query.error === "string" ? query.error : undefined) } : {})
  };

  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: slug,
    query,
    navigationCreativePackCategories,
    navigationCreativePacks,
    navigationToolMenuItems,
    renderData: pageRenderData,
    routeMode,
    runtime: runtimeWithAuth,
    settings,
    jsonLd: isFocusedCollectionPage
      ? buildCollectionDirectoryJsonLd({
          site: currentSite,
          collectionSlug: collectionCategory,
          routeMode,
          creativePacks: trimCreativePacksForStorefront(focusedCollectionRenderData, publicDirectoryPackLimit),
          products: state.products
        })
      : buildStorefrontJsonLd({
          site: currentSite,
          page,
          pageJson,
          pagePath: slug,
          routeMode,
          creativePacks: pageRenderData.creativePacks,
          products: state.products,
          videoThemes: pageRenderData.videoThemes
        }),
    lightweightChrome: false
  });
}

export async function renderStorefrontSectionNode({
  siteSlug,
  slug,
  sectionId,
  query = {},
  routeMode = "path"
}: {
  siteSlug: string;
  slug: string;
  sectionId: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
}): Promise<ReactElement | undefined> {
  const payload = await renderStorefrontSectionPayload({ siteSlug, slug, sectionId, query, routeMode });
  if (!payload) return undefined;
  return (
    <ThemeSectionFrame
      creativePackCategories={payload.renderData.creativePackCategories}
      creativePacks={payload.renderData.creativePacks}
      id={payload.id}
      lazyRender={false}
      mode={payload.mode}
      products={payload.renderData.products}
      renderContext={payload.renderContext}
      runtime={payload.runtime}
      section={payload.section}
      site={payload.clientSite}
      siteAiApps={payload.renderData.siteAiApps}
      toolMenuItems={payload.renderData.toolMenuItems}
      videoThemes={payload.renderData.videoThemes ?? []}
    />
  );
}

export async function renderStorefrontSectionPayloads({
  siteSlug,
  slug,
  sectionIds,
  query = {},
  routeMode = "path"
}: {
  siteSlug: string;
  slug: string;
  sectionIds: string[];
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
}): Promise<StorefrontSectionPayload[]> {
  const requestedSectionIds = Array.from(new Set(sectionIds.map((sectionId) => sectionId.trim()).filter(Boolean)));
  if (!requestedSectionIds.length) return [];
  const publicSlug = publicSiteSlug(siteSlug);
  const shouldCompletePublicPacks = !(routeMode === "path" && preferLocalPathModeState(publicSlug));
  const state = await getPublicSectionStateForRoute(publicSlug, slug, routeMode);
  if (!state) return [];
  const currentSite = state.sites.find((item) =>
    item.slug === siteSlug ||
    publicSiteSlug(item.slug) === publicSlug ||
    canonicalSiteSlug(item.slug) === canonicalSiteSlug(siteSlug)
  );
  if (!currentSite) return [];
  const sectionState = state;
  const sectionSite = currentSite;

  const collectionCategory = typeof query.category === "string" ? query.category : "";
  const isFocusedCollectionPage = slug === "/collections" && Boolean(collectionCategory);
  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const toolDetailSlug = slug.match(/^\/tools\/([^/]+)$/)?.[1] ?? "";
  const resolvedToolDetail = toolDetailSlug
    ? resolveToolPageForSite(state, currentSite, toolDetailSlug, renderData.siteAiApps, renderData.creativePacks)
    : undefined;
  const directPage = resolvedToolDetail?.matched
    ? resolvedToolDetail.page
    : findPage(currentSite, slug) ?? syntheticStorefrontPolicyPage(currentSite, slug) ?? syntheticDreamShootPartnerPage(currentSite, slug);
  if (!directPage) return [];
  if (isFocusedCollectionPage) {
    currentSite.pages = currentSite.pages.filter((item) => item.slug === slug || item.slug === "/404");
  }

  const usesDreamShootToolsDirectory =
    slug === "/tools" &&
    (/dreamshoot/i.test(`${currentSite.slug} ${currentSite.name} ${currentSite.branding.logoText}`) || isAidreamcapesStorefront(currentSite));
  const pageJson: ThemePageJson = slug === "/account"
    ? withAccountDashboardPage(directPage.publishedJson)
    : toolDetailSlug && resolvedToolDetail?.matched
    ? withSeoDirectorySection(directPage.publishedJson, "tool", toolDetailSlug, { site: currentSite })
    : usesDreamShootToolsDirectory
    ? withDreamShootToolsDirectoryPage(directPage.publishedJson, currentSite)
    : isFocusedCollectionPage
    ? withSeoDirectorySection(directPage.publishedJson, "collection", collectionCategory, { focused: true, site: currentSite })
    : slug === "/collections"
    ? withDreamShootCollectionsDirectoryPage(directPage.publishedJson, currentSite)
    : directPage.publishedJson;

  const settings = currentSite.themeSettings.publishedJson;
  const runtimeByMode = new Map<"empty" | "full" | "light", Promise<ThemeRuntimeData>>();
  let sectionSessionId: string | undefined;
  async function runtimeForSection(singleSectionPageJson: ThemePageJson, section: SectionInstance): Promise<ThemeRuntimeData | undefined> {
    if (toolDetailSlug) {
      runtimeByMode.set("empty", runtimeByMode.get("empty") ?? Promise.resolve(runtimeWithEmptyCollections()));
      return runtimeByMode.get("empty");
    }
    const needsCustomerRuntime = customerRuntimeSectionTypes.has(section.type) || slug === "/account" || slug.startsWith("/app/");
    if (!needsCustomerRuntime) return undefined;
    sectionSessionId ??= await readCustomerSessionId(sectionSite.id);
    if (pageNeedsFullCustomerRuntime(singleSectionPageJson, slug)) {
      runtimeByMode.set("full", runtimeByMode.get("full") ?? getFullCustomerRuntime(sectionState, sectionSite.id, sectionSessionId));
      return runtimeByMode.get("full");
    }
    runtimeByMode.set("light", runtimeByMode.get("light") ?? getLightCustomerRuntime(sectionState, sectionSite.id, sectionSessionId));
    return runtimeByMode.get("light");
  }

  const payloads: StorefrontSectionPayload[] = [];
  for (const sectionId of requestedSectionIds) {
    const section = (pageJson.sections as Record<string, SectionInstance>)[sectionId];
    if (!section || !pageJson.sectionsOrder.includes(sectionId)) continue;
    const singleSectionPageJson: ThemePageJson = {
      ...pageJson,
      sectionsOrder: [sectionId],
      sections: { [sectionId]: section }
    };
    let pageRenderData = withPageMediaAssets(
      currentSite,
      singleSectionPageJson,
      settings,
      trimRenderDataForSection(
        toolDetailSlug
          ? trimToolDetailRenderData(renderData)
          : renderData,
        pageJson,
        slug,
        sectionId
      )
    );
    if (shouldCompletePublicPacks && (slug === "/" || (slug === "/collections" && !isFocusedCollectionPage)) && pageRenderData.creativePacks.length > 0) {
      const directoryPackLimit = slug === "/" && section.type !== "dreamshoot_generation_showcase"
        ? publicHomePackLimit
        : publicDirectoryPackLimit;
      pageRenderData = {
        ...pageRenderData,
        creativePacks: await completePublicCreativePacksForSite(currentSite, pageRenderData.creativePacks, directoryPackLimit)
      };
    }
    if (section.type === "dreamshoot_generation_showcase" && pageRenderData.videoThemes.length) {
      pageRenderData = {
        ...pageRenderData,
        videoThemes: trimVideoThemesForStorefront({ ...emptySiteRenderData(), videoThemes: pageRenderData.videoThemes }, 8, section)
      };
    }
    if (section.type === "dreamshoot_generation_showcase" && !pageRenderData.videoThemes.length) {
      pageRenderData = {
        ...pageRenderData,
        videoThemes: trimVideoThemesForStorefront(
          { ...emptySiteRenderData(), videoThemes: await loadStorefrontPublicVideoThemesForSection(currentSite, renderData.videoThemes, 32) },
          8,
          section
        )
      };
    }
    pageRenderData = withPageMediaAssets(currentSite, singleSectionPageJson, settings, pageRenderData);
    currentSite.mediaAssets = pageRenderData.mediaAssets;

    const runtime = await runtimeForSection(singleSectionPageJson, section);
    const routedSite = clientSiteForSectionRender(currentSite, singleSectionPageJson, slug) as Site & { __storefrontBasePath?: string };
    routedSite.__storefrontBasePath = routeMode === "host" ? "" : `/site/${publicSiteSlug(currentSite.slug)}`;
    const renderContext = {
      pagePath: slug,
      query,
      page: pageJson,
      pages: pageNeedsSearchEntries(pageJson) ? searchPageEntriesForSite(routedSite) : []
    };

    payloads.push({
      clientSite: routedSite as RoutedSite,
      component: "ThemeSectionFrame",
      id: sectionId,
      mode: "published",
      pagePath: slug,
      renderData: {
        creativePackCategories: pageRenderData.creativePackCategories,
        creativePacks: pageRenderData.creativePacks,
        products: pageRenderData.products,
        siteAiApps: pageRenderData.siteAiApps,
        toolMenuItems: pageRenderData.toolMenuItems,
        videoThemes: pageRenderData.videoThemes
      },
      renderContext,
      routeMode,
      runtime,
      section,
      site: routedSite as RoutedSite
    });
  }
  return payloads;
}

export async function renderStorefrontSectionPayload({
  siteSlug,
  slug,
  sectionId,
  query = {},
  routeMode = "path"
}: {
  siteSlug: string;
  slug: string;
  sectionId: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
}): Promise<StorefrontSectionPayload | undefined> {
  const publicSlug = publicSiteSlug(siteSlug);
  const shouldCompletePublicPacks = !(routeMode === "path" && preferLocalPathModeState(publicSlug));
  const state = await getPublicSectionStateForRoute(publicSlug, slug, routeMode);
  if (!state) return undefined;
  const currentSite = state.sites.find((item) =>
    item.slug === siteSlug ||
    publicSiteSlug(item.slug) === publicSlug ||
    canonicalSiteSlug(item.slug) === canonicalSiteSlug(siteSlug)
  );
  if (!currentSite) return undefined;

  const collectionCategory = typeof query.category === "string" ? query.category : "";
  const isFocusedCollectionPage = slug === "/collections" && Boolean(collectionCategory);
  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const toolDetailSlug = slug.match(/^\/tools\/([^/]+)$/)?.[1] ?? "";
  const resolvedToolDetail = toolDetailSlug
    ? resolveToolPageForSite(state, currentSite, toolDetailSlug, renderData.siteAiApps, renderData.creativePacks)
    : undefined;
  const directPage = resolvedToolDetail?.matched
    ? resolvedToolDetail.page
    : findPage(currentSite, slug) ?? syntheticStorefrontPolicyPage(currentSite, slug) ?? syntheticDreamShootPartnerPage(currentSite, slug);
  if (!directPage) return undefined;
  if (isFocusedCollectionPage) {
    currentSite.pages = currentSite.pages.filter((item) => item.slug === slug || item.slug === "/404");
  }

  const usesDreamShootToolsDirectory =
    slug === "/tools" &&
    (/dreamshoot/i.test(`${currentSite.slug} ${currentSite.name} ${currentSite.branding.logoText}`) || isAidreamcapesStorefront(currentSite));
  const pageJson: ThemePageJson = slug === "/account"
    ? withAccountDashboardPage(directPage.publishedJson)
    : toolDetailSlug && resolvedToolDetail?.matched
    ? withSeoDirectorySection(directPage.publishedJson, "tool", toolDetailSlug, { site: currentSite })
    : usesDreamShootToolsDirectory
    ? withDreamShootToolsDirectoryPage(directPage.publishedJson, currentSite)
    : isFocusedCollectionPage
    ? withSeoDirectorySection(directPage.publishedJson, "collection", collectionCategory, { focused: true, site: currentSite })
    : slug === "/collections"
    ? withDreamShootCollectionsDirectoryPage(directPage.publishedJson, currentSite)
    : directPage.publishedJson;
  const section = (pageJson.sections as Record<string, SectionInstance>)[sectionId];
  if (!section || !pageJson.sectionsOrder.includes(sectionId)) return undefined;

  const singleSectionPageJson: ThemePageJson = {
    ...pageJson,
    sectionsOrder: [sectionId],
    sections: { [sectionId]: section }
  };
  const settings = currentSite.themeSettings.publishedJson;
  let pageRenderData = withPageMediaAssets(
    currentSite,
    singleSectionPageJson,
    settings,
    trimRenderDataForSection(
      toolDetailSlug
        ? trimToolDetailRenderData(renderData)
        : renderData,
      pageJson,
      slug,
      sectionId
    )
  );
  if (shouldCompletePublicPacks && (slug === "/" || (slug === "/collections" && !isFocusedCollectionPage)) && pageRenderData.creativePacks.length > 0) {
    const directoryPackLimit = slug === "/" && section.type !== "dreamshoot_generation_showcase"
      ? publicHomePackLimit
      : publicDirectoryPackLimit;
    pageRenderData = {
      ...pageRenderData,
      creativePacks: await completePublicCreativePacksForSite(currentSite, pageRenderData.creativePacks, directoryPackLimit)
    };
  }
  if (section.type === "dreamshoot_generation_showcase" && pageRenderData.videoThemes.length) {
    pageRenderData = {
      ...pageRenderData,
      videoThemes: trimVideoThemesForStorefront({ ...emptySiteRenderData(), videoThemes: pageRenderData.videoThemes }, 8, section)
    };
  }
  if (section.type === "dreamshoot_generation_showcase" && !pageRenderData.videoThemes.length) {
    pageRenderData = {
      ...pageRenderData,
      videoThemes: trimVideoThemesForStorefront(
        { ...emptySiteRenderData(), videoThemes: await loadStorefrontPublicVideoThemesForSection(currentSite, renderData.videoThemes, 32) },
        8,
        section
      )
    };
  }
  pageRenderData = withPageMediaAssets(currentSite, singleSectionPageJson, settings, pageRenderData);
  currentSite.mediaAssets = pageRenderData.mediaAssets;

  const needsCustomerRuntime = customerRuntimeSectionTypes.has(section.type) || slug === "/account" || slug.startsWith("/app/");
  const sessionId = needsCustomerRuntime ? await readCustomerSessionId(currentSite.id) : undefined;
  const runtime = toolDetailSlug
    ? runtimeWithEmptyCollections()
    : needsCustomerRuntime
    ? sessionId && pageNeedsFullCustomerRuntime(singleSectionPageJson, slug)
      ? await getFullCustomerRuntime(state, currentSite.id, sessionId)
      : await getLightCustomerRuntime(state, currentSite.id, sessionId)
    : undefined;
  const routedSite = clientSiteForSectionRender(currentSite, singleSectionPageJson, slug) as Site & { __storefrontBasePath?: string };
  routedSite.__storefrontBasePath = routeMode === "host" ? "" : `/site/${publicSiteSlug(currentSite.slug)}`;
  const renderContext = {
    pagePath: slug,
    query,
    page: pageJson,
    pages: pageNeedsSearchEntries(pageJson) ? searchPageEntriesForSite(routedSite) : []
  };

  return {
    clientSite: routedSite as RoutedSite,
    component: "ThemeSectionFrame",
    id: sectionId,
    mode: "published",
    pagePath: slug,
    renderData: {
      creativePackCategories: pageRenderData.creativePackCategories,
      creativePacks: pageRenderData.creativePacks,
      products: pageRenderData.products,
      siteAiApps: pageRenderData.siteAiApps,
      toolMenuItems: pageRenderData.toolMenuItems,
      videoThemes: pageRenderData.videoThemes
    },
    renderContext,
    routeMode,
    runtime,
    section,
    site: routedSite as RoutedSite
  };
}

function syntheticDreamShootPartnerPage(site: Site, slug: string): ThemePage | undefined {
  if (!dreamshootPartnerTemplateSlugs.has(slug)) return undefined;
  if (!(/dreamshoot/i.test(`${site.slug} ${site.name} ${site.branding.logoText}`) || isAidreamcapesStorefront(site))) return undefined;
  const templateKey =
    slug === "/workflow" ? "workflow" :
    slug === "/faq" ? "help" :
    slug === "/partner-registration" ? "partner-registration" :
    slug === "/about-us" ? "about-us" :
    slug === "/contact-us" ? "contact-us" :
    "creators-circle";
  const pageJson = dreamshootAiStudioTemplatesForSite(site)[templateKey];
  return {
    id: `${site.id}_${templateKey}_synthetic`,
    siteId: site.id,
    pageType: pageJson.pageType,
    templateKey,
    slug,
    title:
      templateKey === "workflow" ? "How It Works" :
      templateKey === "help" ? "FAQ" :
      templateKey === "partner-registration" ? "Partner Registration" :
      templateKey === "about-us" ? "About Us" :
      templateKey === "contact-us" ? "Contact Us" :
      "Creators Circle",
    draftJson: pageJson,
    publishedJson: pageJson
  };
}

export async function renderStorefrontLoginPage({
  site,
  query = {},
  routeMode = "path",
  state: providedState
}: {
  site: Site;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
}) {
  const state = await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const page = getPage(currentSite, "/login");
  const renderData = getSiteRenderData(state, currentSite.id);
  const sessionId = await readCustomerSessionId(currentSite.id);
  const current = sessionId ? await getCustomerBySessionRelational({ siteId: currentSite.id, sessionId }) : undefined;
  currentSite.mediaAssets = [];

  return renderThemePage({
    currentSite,
    page: page.publishedJson,
    pagePath: "/login",
    query,
    renderData: {
      ...emptySiteRenderData(),
      creativePackCategories: renderData.creativePackCategories,
      creativePacks: renderData.creativePacks,
      toolMenuItems: renderData.toolMenuItems
    },
    routeMode,
    runtime: runtimeWithEmptyCollections({
      ...(current ? { customer: current.customer } : {}),
      auth: getDefaultCustomerAuth(state, currentSite.id, typeof query.error === "string" ? query.error : undefined)
    }),
    settings: currentSite.themeSettings.publishedJson,
    lightweightChrome: false
  });
}

export async function renderCustomerWorkspacePage({
  site,
  slug,
  query = {},
  routeMode = "path",
  state: providedState
}: {
  site: Site;
  slug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
}) {
  const sessionId = await readCustomerSessionId(site.id);
  const profile = slug === "/account" ? "account" : slug === "/app" ? "workspace" : "full";
  const state = (await getStateForCustomerRuntimeRender(site, sessionId, providedState, profile)) ?? await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const current = await getCurrentCustomerSession(state, currentSite.id, sessionId);
  if (!current) redirect(routeMode === "host" ? "/login" : `/site/${currentSite.slug}/login`);

  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const page = getPage(currentSite, slug);
  const settings = currentSite.themeSettings.publishedJson;
  const adminAccess = await getCustomerAdminAccessForSite({ siteId: currentSite.id, customer: current.customer });
  const runtime = {
    ...trimCustomerRuntimeForWorkspace(getCustomerRuntimeFromState(state, currentSite.id, current.customer, true), slug),
    adminAccess
  };

  const pageJson = slug === "/account"
    ? withAccountDashboardPage(page.publishedJson)
    : slug === "/app"
    ? withCustomerWorkspaceFlowPage(page.publishedJson)
    : page.publishedJson;
  const pageRenderData = trimRenderDataForPage(renderData, pageJson, slug);

  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: slug,
    query,
    renderData: pageRenderData,
    routeMode,
    runtime,
    settings
  });
}

export async function renderCustomerWorkspacePageBySlug({
  siteSlug,
  slug,
  query = {},
  routeMode = "path"
}: {
  siteSlug: string;
  slug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
}) {
  const canonicalSlug = canonicalSiteSlug(siteSlug);
  const routeSlug = publicSiteSlug(canonicalSlug);
  const loginPath = routeMode === "host" ? "/login" : `/site/${routeSlug}/login`;
  const workspacePath = routeMode === "host" ? slug : `/site/${routeSlug}${slug}`;
  const queryString = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => {
      if (typeof value === "string") return [[key, value]];
      if (Array.isArray(value)) return value.map((item) => [key, item]);
      return [];
    })
  ).toString();
  const loginPathWithNext = `${loginPath}?next=${encodeURIComponent(`${workspacePath}${queryString ? `?${queryString}` : ""}`)}`;
  const isWorkspaceRoute = slug === "/app" || slug.startsWith("/app/");
  const initialWorkspacePanel = slug === "/app/upload" ? "upload" : slug === "/app" ? "overview" : "create";
  if ((slug === "/account" || isWorkspaceRoute) && !(await hasAnyCustomerSessionCookie())) {
    redirect(loginPathWithNext);
  }
  if (slug === "/account") {
    const siteId = await getSiteIdBySlugRelational(canonicalSlug);
    if (!siteId) notFound();
    const sessionId = await readCustomerSessionId(siteId);
    if (!sessionId) redirect(loginPathWithNext);
    const [current, site, bootstrap] = await Promise.all([
      getCustomerBySessionRelational({ siteId, sessionId }),
      getCustomerWorkspaceSiteShellRelational(canonicalSlug),
      getCustomerWorkspaceBootstrapRelational(canonicalSlug)
    ]);
    if (!current || !site) redirect(loginPathWithNext);
    const accountRuntime = await getCustomerAccountSummaryRuntimeRelational({ customer: current.customer, siteId });
    return (
      <CustomerAccountClientPage
        initialCreativePackCategories={bootstrap?.creativePackCategories ?? []}
        initialCreativePacks={bootstrap?.creativePacks ?? []}
        initialCustomer={current.customer}
        initialRuntime={accountRuntime}
        initialSite={site}
        initialToolMenuItems={bootstrap?.toolMenuItems ?? []}
        siteSlug={routeSlug}
      />
    );
  }

  if (isWorkspaceRoute) {
    const siteId = await getSiteIdBySlugRelational(canonicalSlug);
    if (!siteId) notFound();
    const sessionId = await readCustomerSessionId(siteId);
    if (!sessionId) redirect(loginPathWithNext);
    const current = await getCustomerBySessionRelational({ siteId, sessionId });
    if (!current) redirect(loginPathWithNext);
    const bootstrap = await getCustomerWorkspaceBootstrapRelational(canonicalSlug);
    if (!bootstrap) redirect(loginPathWithNext);
    const preloadTimeoutMs = workspaceRuntimePreloadTimeoutMs();
    const [adminAccess, workspaceRuntime] = await Promise.all([
      withWorkspaceRuntimePreloadTimeout({
        label: "admin access preload",
        timeoutMs: preloadTimeoutMs,
        promise: getCustomerAdminAccessForSite({ siteId, customer: current.customer })
          .catch(() => ({ canBypassBilling: false }))
      }).then((access) => access ?? { canBypassBilling: false }),
      withWorkspaceRuntimePreloadTimeout({
        label: "workspace runtime preload",
        timeoutMs: preloadTimeoutMs,
        promise: readLightWorkspaceRuntimeForCustomerRelational({ siteId, customer: current.customer })
          .then((runtime) => trimCustomerRuntimeForWorkspace(runtime, "/app"))
          .catch(() => undefined)
      })
    ]);
    const initialWorkspaceRuntime = workspaceRuntime
      ? {
        ...workspaceRuntime,
        customer: current.customer,
        adminAccess
      }
      : undefined;
    return (
      <CustomerWorkspaceClientPage
        initialBootstrap={{
          ...bootstrap,
          customer: current.customer,
          ...(initialWorkspaceRuntime ? { workspaceRuntime: initialWorkspaceRuntime } : {})
        }}
        initialCreativePackId={resolveInitialCreativePackId(typeof query.pack === "string" ? query.pack : undefined, bootstrap.creativePacks)}
        initialPanel={initialWorkspacePanel}
        initialToolId={typeof query.tool_id === "string" ? query.tool_id : undefined}
        siteSlug={routeSlug}
      />
    );
  }

  const siteId = await getSiteIdBySlugRelational(canonicalSlug);
  if (!siteId) notFound();
  const sessionId = await readCustomerSessionId(siteId);
  if (!sessionId) redirect(loginPathWithNext);

  const profile = slug === "/account" ? "account" : slug === "/app" ? "workspace" : "full";
  const state = await readStorefrontCustomerRuntimeStateForSiteFromDatabase({ siteId, sessionId, profile });
  if (!state) redirect(loginPathWithNext);
  const currentSite = state.sites.find((item) => item.id === siteId);
  if (!currentSite) notFound();
  const current = await getCurrentCustomerSession(state, currentSite.id, sessionId);
  if (!current) redirect(loginPathWithNext);

  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const page = getPage(currentSite, slug);
  const settings = currentSite.themeSettings.publishedJson;
  const adminAccess = await getCustomerAdminAccessForSite({ siteId: currentSite.id, customer: current.customer });
  const runtime = {
    ...trimCustomerRuntimeForWorkspace(getCustomerRuntimeFromState(state, currentSite.id, current.customer, true), slug),
    adminAccess
  };

  const pageJson = slug === "/account"
    ? withAccountDashboardPage(page.publishedJson)
    : slug === "/app"
    ? withCustomerWorkspaceFlowPage(page.publishedJson)
    : page.publishedJson;
  const pageRenderData = trimRenderDataForPage(renderData, pageJson, slug);

  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: slug,
    query,
    renderData: pageRenderData,
    routeMode,
    runtime,
    settings
  });
}

export async function renderCustomerJobDetailPage({
  site,
  jobId,
  query = {},
  routeMode = "path",
  state: providedState
}: {
  site: Site;
  jobId: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
}) {
  const sessionId = await readCustomerSessionId(site.id);
  const state = (await getStateForCustomerRuntimeRender(site, sessionId, providedState)) ?? await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const current = await getCurrentCustomerSession(state, currentSite.id, sessionId);
  if (!current) redirect(routeMode === "host" ? "/login" : `/site/${currentSite.slug}/login`);

  const job = state.jobs.find((item) => item.id === jobId && item.siteId === currentSite.id && item.customerId === current.customer.id);
  if (!job) notFound();

  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const page = currentSite.pages.find((item) => item.slug === jobDetailSlug || item.pageType === "job_detail") ?? getPage(currentSite, "/app/jobs/progress");
  const settings = currentSite.themeSettings.publishedJson;
  const runtime = {
    ...runtimeWithEmptyCollections({ customer: current.customer }),
    jobDetail: {
      job: toThemeRuntimeJob(job),
      ledger: getCustomerLedgerFromState(state, currentSite.id, current.customer.id)
        .filter((entry) => entry.sourceId === job.id)
        .map(toThemeRuntimeLedgerEntry),
      assets: getCustomerJobAssetsFromState(state, currentSite.id, current.customer.id, job.id).map((asset) => toThemeRuntimeAsset(state, asset))
    }
  };

  return renderThemePage({
    currentSite,
    page: page.publishedJson,
    pagePath: `/app/jobs/${job.id}`,
    query,
    renderData: trimRenderDataForPage(renderData, page.publishedJson, `/app/jobs/${job.id}`),
    routeMode,
    runtime,
    settings,
    lightweightChrome: true
  });
}

export async function renderToolPage({
  site,
  toolSlug,
  query = {},
  routeMode = "path",
  state: providedState,
  resolvedPage
}: {
  site: Site;
  toolSlug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
  resolvedPage?: ThemePage;
}) {
  const state = await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const renderData = getSiteRenderData(state, currentSite.id);
  const resolved = resolvedPage
    ? { page: resolvedPage, matched: true }
    : resolveToolPageForSite(state, currentSite, toolSlug, renderData.siteAiApps, renderData.creativePacks);
  const { page, matched } = resolved;
  if (!matched) notFound();
  const toolRenderData = trimToolDetailRenderData(renderData);
  currentSite.mediaAssets = toolRenderData.mediaAssets;
  const settings = currentSite.themeSettings.publishedJson;
  const normalizedToolSlug = normalizeToolLookup(toolSlug);
  const pageHasToolEntry = page.publishedJson.sectionsOrder.some((sectionId) => page.publishedJson.sections[sectionId]?.type === "ai_tool_entry");
  const basePageJson = pageHasToolEntry
    ? withToolEntryFirst(page.publishedJson)
    : (() => {
        const fallbackBlock = isAidreamcapesStorefront(currentSite)
          ? aidreamcapesToolBlockForSlug(currentSite, normalizedToolSlug)
          : fallbackToolBlockForSlug(normalizedToolSlug);
        if (!fallbackBlock) return page.publishedJson;
        const localizedBlock = spanishXbyToolBlockForSite(currentSite, fallbackBlock);
        return withToolEntryFirst(synthesizeToolDetailPage(
          page.publishedJson,
          localizedBlock,
          normalizedToolSlug,
          appSlugForToolCategory(blockString(fallbackBlock, "category", "AI Photo"), renderData.siteAiApps),
          currentSite
        ));
      })();
  const pageJson = withSeoDirectorySection(basePageJson, "tool", toolSlug, { site: currentSite });
  const pageRenderData = withPageMediaAssets(
    currentSite,
    pageJson,
    settings,
    trimRenderDataForPage(toolRenderData, pageJson, page.slug)
  );
  currentSite.mediaAssets = pageRenderData.mediaAssets;
  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: page.slug,
    query,
    navigationCreativePackCategories: trimCreativePackCategoriesForStorefront(renderData),
    navigationCreativePacks: trimCreativePacksForNavigation(renderData),
    navigationToolMenuItems: renderData.toolMenuItems.map(lightweightToolMenuItem),
    renderData: pageRenderData,
    routeMode,
    runtime: runtimeWithEmptyCollections(),
    settings,
    jsonLd: buildToolDirectoryJsonLd({
      site: currentSite,
      toolSlug,
      routeMode
    })
  });
}
