import { notFound, redirect } from "next/navigation";
import { cache, type ReactElement } from "react";
import { CustomerAccountClientPage, CustomerWorkspaceClientPage } from "@/components/storefront/customer-bootstrap-client";
import type { HeaderVideoGenerationTopic } from "@/components/storefront/header-mega-menu-panels";
import { StorefrontJsonLd } from "@/components/storefront/storefront-json-ld";
import { ThemeRenderer, ThemeSectionFrame, searchPageEntriesForSite, type StorefrontSectionPayload, type RoutedSite } from "@/components/theme-renderer";
import { findPage, getPage } from "@/lib/data";
import { authMessageForCode } from "@/lib/auth-messages";
import { getCustomerAdminAccessForSite } from "@/lib/customer-admin-access";
import { prisma } from "@/lib/prisma";
import { preferLocalPathModeState, readPathModePublicMetadataState, readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
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
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase,
  readStorefrontRuntimeStateForSiteFromDatabase
} from "@/lib/storefront-state";
import { toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { getCustomerAccountSummaryRuntimeRelational } from "@/lib/stores/customer-account-runtime";
import { toAssetUploadRelational, toCustomerModelRelational } from "@/lib/stores/prisma-mappers";
import { getCustomerWorkspaceBootstrapRelational, getCustomerWorkspaceSiteShellRelational, getSiteIdBySlugRelational, getStorefrontPublicCreativePacksForSite, getStorefrontPublicVideoThemesForSite as getCachedPublicVideoThemesForSite } from "@/lib/stores/site-store";
import { readWorkspaceJobSummariesRelational, WORKSPACE_RELATED_JOB_SUMMARY_LIMIT, WORKSPACE_VIDEO_FRAME_ASSET_LIMIT } from "@/lib/workspace-runtime-jobs";
import { createPublishedSiteSnapshot, isAidreamcapesSite as isAidreamcapesCapabilitySite, isPrimaryMydreamshootsSite as isPrimaryMydreamshootsCapabilitySite, resolvePublishedRouteDisposition, resolvePublishedStorefrontContext, usesAiGenerationPublicRoutes } from "@/lib/storefront-context";
import type { StorefrontContext } from "@/lib/storefront-context/types";
import { themeStyleVars } from "@/lib/theme";
import { canonicalSiteSlug, publicSiteSlug } from "@/lib/domain-routing";
import { publicContentPageSlug } from "@/lib/site-route-canonical";
import { dreamshootToolDetailFaqBlocks, dreamshootToolDetailFaqSectionSettings } from "@/lib/dreamshoot-tool-faq";
import { pageCopyFromPublishedPageEntity } from "@/lib/mydreamshoots-published-contract";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { canonicalSeoDirectorySlugForSite, getExplicitSeoDirectorySlugsForSite, getSeoDirectoryContentForSite, isExplicitSeoDirectoryContentForSite, withSeoDirectorySection, withSeoDirectorySeo } from "@/lib/dreamshoot-seo-content";
import { isMydreamshootsCollectionItemSlug, isMydreamshootsPublicVideoGenerationSlug, isMydreamshootsVideoGenerationSlug, parsePublicCollectionRouteForSite, publicCollectionPathForSite, publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { buildCollectionDirectoryJsonLd, buildStorefrontJsonLd, buildToolDirectoryJsonLd, type JsonLdNode } from "@/lib/theme/json-ld";
import { dreamshootAiStudioTemplates, dreamshootAiStudioTemplatesForSite } from "@/lib/theme/packages/dreamshoot-ai-studio";
import type { CreativePack, CreativePackCategory, CustomerSession, MediaAsset, PlatformState, Price, Product, PublicCustomer, PublishedHomepageShowcaseItem, SectionBlockInstance, SectionInstance, Site, SiteAiApp, ThemePage, ThemePageJson, ThemeRuntimeData, ToolMenuItem, VideoTheme, VideoThemeCategory } from "@/lib/types";

const jobDetailSlug = "/app/jobs/detail";
const dreamshootPartnerTemplateSlugs = new Set([
  "/workflow",
  "/faq",
  "/creators-circle",
  "/partner-registration",
  "/about-us",
  "/contact-us",
  "/best-packages",
  "/best-ai-image",
  "/best-ai-video"
]);

function publishedLeafCopy(snapshot: ReturnType<typeof createPublishedSiteSnapshot>, canonicalSlug: string) {
  const entity = snapshot.publishedPageEntities.find((candidate) => candidate.canonicalPath === `/ai-image-generation/${canonicalSlug}`);
  return entity ? pageCopyFromPublishedPageEntity(entity, snapshot.publishedLinkRefs) : undefined;
}

function publishedVideoGenerationTopics(snapshot: ReturnType<typeof createPublishedSiteSnapshot>): HeaderVideoGenerationTopic[] | undefined {
  if (!isPrimaryMydreamshootsCapabilitySite(snapshot.site) || snapshot.snapshotIntegrity !== "valid") return undefined;
  return snapshot.publishedVideoNavigation.map((item) => ({
    id: item.id,
    slug: item.slug,
    label: item.label,
    description: item.description,
    href: item.canonicalPath,
    imageUrl: item.imageUrl,
    parentSlug: item.parentSlug,
    parentLabel: item.parentLabel,
    parentSortOrder: item.parentSortOrder,
    sortOrder: item.sortOrder
  }));
}

type SiteRenderData = {
  creativePackCategories: CreativePackCategory[];
  creativePacks: ReturnType<typeof getSiteCreativePacksFromState>;
  mediaAssets: ReturnType<typeof getSiteMediaAssetsFromState>;
  products: ReturnType<typeof getSiteProductsFromState>;
  siteAiApps: ReturnType<typeof getSiteAppsFromState>;
  toolMenuItems: PlatformState["toolMenuItems"];
  videoThemeCategories: VideoThemeCategory[];
  videoThemes: VideoTheme[];
  homepageShowcases: PublishedHomepageShowcaseItem[];
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
    videoThemeCategories: (state.videoThemeCategories ?? []).filter((category) => category.siteId === siteId),
    videoThemes: (state.videoThemes ?? []).filter((theme) => theme.siteId === siteId),
    homepageShowcases: []
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
    videoThemeCategories: [],
    videoThemes: [],
    homepageShowcases: []
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
    videoThemeCategories: renderData.videoThemeCategories,
    videoThemes: [],
    homepageShowcases: []
  };
}

const productSectionTypes = new Set(["cart_summary", "dreamshoot_generation_showcase", "pricing_table", "product_detail", "products", "products_plus", "search_results"]);
const siteAiAppSectionTypes = new Set(["ai_tool_entry", "ai_tool_grid", "aidreamcapes_tool_collection", "generation_form", "search_results"]);
const creativePackSectionTypes = new Set(["aidreamcapes_package_catalog", "aidreamcapes_package_taxonomy", "collection_list_plus", "dreamshoot_featured_pack", "dreamshoot_generation_showcase", "dreamshoot_media_gallery", "dreamshoot_package_catalog", "dreamshoot_package_taxonomy", "dreamshoot_related_packages", "dreamshoot_theme_cta", "dreamshoot_theme_faq", "photo_package_wall", "products", "products_plus", "search_results"]);
const toolMenuItemSectionTypes = new Set(["aidreamcapes_tool_collection", "dreamshoot_tool_collection", "search_results"]);
const videoThemeSectionTypes = new Set(["dreamshoot_generation_showcase", "dreamshoot_media_gallery"]);
const customerRuntimeSectionTypes = new Set(["album_gallery", "cart_summary", "generation_form", "job_detail", "job_progress", "login_method_panel", "upload_panel"]);
const publicDirectoryPackLimit = 128;
const publicHomePackLimit = publicDirectoryPackLimit;
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

function creativePackMatchesInitialCategory(pack: CreativePack, rawCategory: string | undefined): boolean {
  if (!rawCategory || pack.status !== "active") return false;
  const normalizedCategory = normalizePublicSlug(rawCategory);
  if (!normalizedCategory) return false;
  return [
    pack.categoryRecord?.slug,
    pack.categoryRecord?.label,
    pack.categoryRecord?.parent?.slug,
    pack.categoryRecord?.parent?.label,
    pack.category,
    pack.name
  ].some((value) => value ? normalizePublicSlug(String(value)) === normalizedCategory : false);
}

function resolveInitialCreativePackId(rawPack: string | undefined, packs: CreativePack[], rawCategory?: string): string | undefined {
  const normalizedPack = rawPack ? publicStorefrontToken(rawPack, []) : "";
  const packMatch = rawPack ? packs.find((pack) => {
    if (pack.status !== "active") return false;
    return pack.id === rawPack || publicStorefrontToken(pack.id, []) === normalizedPack || publicCreativePackToken(pack) === normalizedPack;
  }) : undefined;
  if (packMatch) return packMatch.id;

  const categoryMatch = packs.find((pack) => creativePackMatchesInitialCategory(pack, rawCategory));
  if (categoryMatch) return categoryMatch.id;
  return rawPack;
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

function publicPackLimitForPage({
  slug,
  usesFullMediaGallery,
  isDirectoryPage = false,
  hasDirectorySections = false
}: {
  slug: string;
  usesFullMediaGallery: boolean;
  isDirectoryPage?: boolean;
  hasDirectorySections?: boolean;
}): number | undefined {
  if (usesFullMediaGallery) return undefined;
  if (slug === "/") return publicHomePackLimit;
  if (isDirectoryPage || slug === "/collections" || hasDirectorySections) return publicDirectoryPackLimit;
  return publicHomePackLimit;
}

async function completePublicCreativePacksForSite(site: Site, existing: SiteRenderData["creativePacks"], limit?: number): Promise<SiteRenderData["creativePacks"]> {
  const sanitizedExisting = existing.map(lightweightCreativePack);
  // The homepage runtime can already contain the requested number of lightweight
  // packs while omitting their gallery arrays. MyDreamShoots recommendation cards
  // need two published gallery images, so complete those rows before rendering.
  // Published snapshots can contain a complete gallery but still carry an old
  // imageUrl. Refresh all primary-site packs so the card cover and gallery are
  // sourced from the same current relational row.
  const shouldRefreshPrimaryMydreamshoots = isPrimaryMydreamshootsCapabilitySite(site) && sanitizedExisting.some((pack) => pack.status === "active");
  if (typeof limit === "number" && sanitizedExisting.length >= limit && !shouldRefreshPrimaryMydreamshoots) return sanitizedExisting.slice(0, limit);
  const fullPacks = (await getStorefrontPublicCreativePacksForSite(site.id, shouldRefreshPrimaryMydreamshoots ? undefined : limit)).map(lightweightCreativePack);
  if (!fullPacks.length) return limitedCreativePacks(sanitizedExisting, limit);

  const fullPackIds = new Set(fullPacks.map((pack) => pack.id));
  const merged = [
    ...fullPacks,
    ...sanitizedExisting.filter((pack) => !fullPackIds.has(pack.id))
  ];
  return limitedCreativePacks(merged, limit);
}

function publicVideoThemesFromRenderData(siteId: string, existing: VideoTheme[], limit?: number): VideoTheme[] {
  const activeThemes = existing
    .filter((theme) => theme.siteId === siteId && theme.status === "active")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return (typeof limit === "number" ? activeThemes.slice(0, limit) : activeThemes)
    .map(lightweightVideoTheme);
}

async function loadStorefrontPublicVideoThemesForSection(site: Pick<Site, "id" | "slug">, existing: VideoTheme[], limit?: number): Promise<VideoTheme[]> {
  const localThemes = publicVideoThemesFromRenderData(site.id, existing, limit);
  if (preferLocalPathModeState(site.slug)) return localThemes;

  try {
    // Fetch the full public set for a bounded section before theme filtering.
    // A legacy blocked theme can otherwise consume one of the eight SQL rows.
    const themes = (await getCachedPublicVideoThemesForSite(site.id)).map(lightweightVideoTheme);
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
    metadata: price.metadata,
    status: price.status,
    effectiveFrom: price.effectiveFrom,
    effectiveTo: price.effectiveTo,
    replacesPriceId: price.replacesPriceId,
    providerVerifiedAt: price.providerVerifiedAt,
    providerFingerprint: price.providerFingerprint
  };
}

function lightweightProduct(product: Product): Product {
  return {
    id: product.id,
    siteId: product.siteId,
    name: product.name,
    type: product.type,
    status: product.status,
    metadata: product.metadata,
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
    galleryImageAlts: (pack.galleryImageAlts ?? []).map((alt) => alt.trim()).slice(0, 12),
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
    sortOrder: theme.sortOrder,
    effectiveMaxFrames: theme.effectiveMaxFrames,
    providerMaxFrames: theme.providerMaxFrames,
    generationCount: theme.generationCount,
    createdAt: theme.createdAt,
    imageUrl: theme.imageUrl,
    galleryImages: (theme.galleryImages ?? []).filter(Boolean).slice(0, 12),
    examples: theme.examples?.map((example) => ({
      ...example,
      galleryImages: (example.galleryImages ?? []).filter(Boolean).slice(0, 12)
    }))
  };
}

function storefrontSettingList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value !== "string") return [];
  return value.split(/[\n|,]/).map((item) => item.trim()).filter(Boolean);
}

function storefrontBooleanSetting(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function sectionUsesFullMediaGallery(section?: SectionInstance): boolean {
  return section?.type === "dreamshoot_media_gallery" && storefrontBooleanSetting(section.settings?.fullGallery);
}

function pageUsesFullMediaGallery(pageJson: ThemePageJson): boolean {
  return Object.values(pageJson.sections).some((section) => sectionUsesFullMediaGallery(section));
}

const blockedPublicVideoThemeSlugs = new Set(["creator-scene-motion"]);

function isBlockedPublicVideoTheme(theme: VideoTheme): boolean {
  return blockedPublicVideoThemeSlugs.has(theme.slug) && theme.siteId === "site_aidreamcapes";
}

function trimVideoThemesForStorefront(renderData: SiteRenderData, limit?: number, section?: SectionInstance): VideoTheme[] {
  const activeThemes = renderData.videoThemes.filter((theme) => theme.status === "active" && !isBlockedPublicVideoTheme(theme));
  const selectedSlugs = storefrontSettingList(section?.settings?.videoSlugs).map(normalizePublicSlug);
  const selectedSlugSet = new Set(selectedSlugs);
  const selectedThemes = selectedSlugs.length
    ? [
        ...selectedSlugs
        .map((slug) => activeThemes.find((theme) => normalizePublicSlug(theme.slug) === slug))
          .filter((theme): theme is VideoTheme => Boolean(theme)),
        ...(section?.type === "dreamshoot_generation_showcase"
          ? activeThemes.filter((theme) => !selectedSlugSet.has(normalizePublicSlug(theme.slug)))
          : [])
      ]
    : activeThemes;
  const limitedThemes = typeof limit === "number" ? selectedThemes.slice(0, limit) : selectedThemes;
  return limitedThemes.map(lightweightVideoTheme);
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

function trimRenderDataForPage(
  renderData: SiteRenderData,
  pageJson: ThemePageJson,
  slug: string,
  isDirectoryPage = false
): SiteRenderData {
  const sectionTypes = pageSectionTypes(pageJson);
  const usesFullMediaGallery = pageUsesFullMediaGallery(pageJson);
  const needsProducts = slug === "/pricing" || slug === "/cart" || Array.from(sectionTypes).some((type) => productSectionTypes.has(type));
  const hasPricingTable = slug === "/pricing" || sectionTypes.has("pricing_table") || sectionTypes.has("dreamshoot_generation_showcase");
  const needsSiteAiApps = slug === "/tools" || slug.startsWith("/tools/") || Array.from(sectionTypes).some((type) => siteAiAppSectionTypes.has(type));
  const needsCreativePacks = slug === "/" || slug === "/collections" || slug === "/tools" || Array.from(sectionTypes).some((type) => creativePackSectionTypes.has(type));
  const needsVideoThemes = Array.from(sectionTypes).some((type) => videoThemeSectionTypes.has(type));
  const packLimit = publicPackLimitForPage({
    slug,
    usesFullMediaGallery,
    isDirectoryPage,
    hasDirectorySections: sectionTypes.has("dreamshoot_generation_showcase") || sectionTypes.has("dreamshoot_media_gallery") || sectionTypes.has("dreamshoot_featured_pack")
  });
  const videoThemeLimit = sectionTypes.has("dreamshoot_media_gallery")
    ? usesFullMediaGallery ? undefined : publicDirectoryPackLimit
    : sectionTypes.has("dreamshoot_generation_showcase")
    ? undefined
    : 32;
  const siteAiAppLimit = slug === "/tools" ? publicToolLimit : 48;
  return {
    creativePackCategories: needsCreativePacks ? trimCreativePackCategoriesForStorefront(renderData) : [],
    creativePacks: needsCreativePacks ? trimCreativePacksForStorefront(renderData, packLimit) : [],
    mediaAssets: renderData.mediaAssets,
    products: needsProducts ? (hasPricingTable ? trimPricingProductsForStorefront(renderData, 12) : trimProductsForStorefront(renderData, slug === "/cart" ? 12 : 6)) : [],
    siteAiApps: needsSiteAiApps ? trimSiteAiAppsForStorefront(renderData, siteAiAppLimit) : [],
    toolMenuItems: renderData.toolMenuItems.slice(0, 160).map(lightweightToolMenuItem),
    videoThemeCategories: renderData.videoThemeCategories,
    videoThemes: needsVideoThemes ? trimVideoThemesForStorefront(renderData, videoThemeLimit) : [],
    homepageShowcases: renderData.homepageShowcases
  };
}

function trimRenderDataForSection(renderData: SiteRenderData, pageJson: ThemePageJson, slug: string, sectionId: string): SiteRenderData {
  const section = pageJson.sections[sectionId];
  if (!section) return emptySiteRenderData();
  const sectionType = section.type;
  const usesFullMediaGallery = sectionUsesFullMediaGallery(section);
  const needsProducts = productSectionTypes.has(sectionType);
  const needsSiteAiApps = siteAiAppSectionTypes.has(sectionType);
  const needsCreativePacks = creativePackSectionTypes.has(sectionType);
  const needsToolMenuItems = toolMenuItemSectionTypes.has(sectionType);
  const needsVideoThemes = videoThemeSectionTypes.has(sectionType);
  const hasPricingTable = sectionType === "pricing_table" || sectionType === "dreamshoot_generation_showcase";
  const packLimit = usesFullMediaGallery
    ? undefined
    : slug === "/"
    ? publicHomePackLimit
    : slug === "/collections" || sectionType === "dreamshoot_generation_showcase" || sectionType === "dreamshoot_media_gallery" || sectionType === "dreamshoot_featured_pack"
    ? publicDirectoryPackLimit
    : publicHomePackLimit;
  const videoThemeLimit = sectionType === "dreamshoot_generation_showcase" ? undefined : usesFullMediaGallery ? undefined : publicDirectoryPackLimit;
  const siteAiAppLimit = sectionType.includes("tool_collection") ? publicToolLimit : 48;
  return {
    creativePackCategories: needsCreativePacks ? trimCreativePackCategoriesForStorefront(renderData) : [],
    creativePacks: needsCreativePacks ? trimCreativePacksForStorefront(renderData, packLimit) : [],
    mediaAssets: renderData.mediaAssets,
    products: needsProducts ? (hasPricingTable ? trimPricingProductsForStorefront(renderData, 12) : trimProductsForStorefront(renderData, slug === "/cart" ? 12 : 6)) : [],
    siteAiApps: needsSiteAiApps ? trimSiteAiAppsForStorefront(renderData, siteAiAppLimit) : [],
    toolMenuItems: needsToolMenuItems ? renderData.toolMenuItems.slice(0, 160).map(lightweightToolMenuItem) : [],
    videoThemeCategories: renderData.videoThemeCategories,
    videoThemes: needsVideoThemes ? trimVideoThemesForStorefront(renderData, videoThemeLimit, section) : [],
    homepageShowcases: renderData.homepageShowcases
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
  const { colors, radii, typography, saveTheDateNavigation } = site.themeSettings.publishedJson;
  const settings: Site["themeSettings"]["publishedJson"] = {
    colors,
    typography,
    radii,
    saveTheDateNavigation,
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

function isSpanishXbyStorefront(site: Site): boolean {
  return isSpanishStorefrontSite(site);
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

async function getPublicSectionShellStateForRoute(publicSlug: string, slug: string, routeMode: "host" | "path"): Promise<PlatformState | undefined> {
  if (routeMode === "path") return readPathModePublicMetadataState(publicSlug, slug);
  try {
    const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(publicSlug, slug);
    if (state) return state;
  } catch (error) {
    if (isMydreamshootsContentSourceSlug(publicSlug)) {
      throw new Error(
        `MyDreamShoots section metadata for ${publicSlug}${slug} must read Postgres published content. ` +
        "Refusing to fall back to legacy state because that can reintroduce stale copy. " +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  if (isMydreamshootsContentSourceSlug(publicSlug)) {
    throw new Error(`MyDreamShoots section metadata for ${publicSlug}${slug} was not found in Postgres. Refusing to fall back to legacy state.`);
  }
  return readStorefrontPlatformState();
}

function sectionIdsNeedPublicRuntime(pageJson: ThemePageJson, slug: string, sectionIds: string[], query: Record<string, string | string[] | undefined>): boolean {
  if (slug === "/account" || slug === "/login" || slug.startsWith("/app/") || slug.startsWith("/tools/")) return true;
  if (slug === "/cart" || slug === "/pricing") return true;
  if (slug === "/collections" && typeof query.category === "string" && query.category) return true;
  return sectionIds.some((sectionId) => {
    const sectionType = pageJson.sections[sectionId]?.type;
    return Boolean(sectionType && (
      productSectionTypes.has(sectionType) ||
      siteAiAppSectionTypes.has(sectionType) ||
      creativePackSectionTypes.has(sectionType) ||
      toolMenuItemSectionTypes.has(sectionType) ||
      videoThemeSectionTypes.has(sectionType) ||
      customerRuntimeSectionTypes.has(sectionType)
    ));
  });
}

function isCollectionPublicPath(slug: string): boolean {
  return slug === "/collections" || slug.startsWith("/collections/") || slug === "/ai-image-generation" || slug.startsWith("/ai-image-generation/");
}

function internalPageSlugForPublicPath(slug: string): string {
  return isCollectionPublicPath(slug) ? "/collections" : slug;
}

function collectionCategoryFromPublicPath(slug: string): string {
  const parts = slug.split(/[?#]/)[0]?.split("/").filter(Boolean) ?? [];
  if (parts[0] === "ai-image-generation") return parts[1] || "";
  if (parts[0] === "collections") return parts[1] || "";
  return "";
}

function queryWithPublicCollectionCategory(slug: string, query: Record<string, string | string[] | undefined>): Record<string, string | string[] | undefined> {
  if (typeof query.category === "string" && query.category) return query;
  const category = collectionCategoryFromPublicPath(slug);
  return category ? { ...query, category } : query;
}

async function getPublicSectionStateForRoute(
  publicSlug: string,
  slug: string,
  routeMode: "host" | "path",
  sectionIds: string[],
  query: Record<string, string | string[] | undefined>
): Promise<PlatformState | undefined> {
  const shellState = await getPublicSectionShellStateForRoute(publicSlug, slug, routeMode);
  const shellSite = shellState?.sites.find((item) =>
    publicSiteSlug(item.slug) === publicSlug ||
    canonicalSiteSlug(item.slug) === canonicalSiteSlug(publicSlug)
  );
  const shellPage = shellSite
    ? findPage(shellSite, slug) ?? syntheticDreamShootPartnerPage(shellSite, slug)
    : undefined;
  if (!shellState || !shellSite || !shellPage) return shellState;
  if (!sectionIdsNeedPublicRuntime(shellPage.publishedJson, slug, sectionIds, query)) return shellState;
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
  const isAidreamcapes = isAidreamcapesStorefront(site);
  const isSpanishXby = isSpanishXbyStorefront(site);
  const isMyDreamShoots = !isAidreamcapes && !isSpanishXby;
  const myDreamShootsIntroCopy = {
    eyebrow: "AI photo package library",
    title: "AI Photo Packages for Every Style and Goal",
    body: "Browse every active myDreamshoots theme by professional, lifestyle, creative, magic, and photo-editing direction before you spend credits.",
    primaryCta: "Browse photo packages"
  };
  if (pageJson.sections[introSectionId]) {
    if (!isMyDreamShoots) return pageJson;
    return {
      ...pageJson,
      sections: {
        ...pageJson.sections,
        [introSectionId]: {
          ...pageJson.sections[introSectionId],
          settings: {
            ...pageJson.sections[introSectionId].settings,
            eyebrow: myDreamShootsIntroCopy.eyebrow,
            title: myDreamShootsIntroCopy.title,
            subtitle: myDreamShootsIntroCopy.body,
            primaryCta: myDreamShootsIntroCopy.primaryCta,
            primaryHref: "#package-taxonomy"
          }
        }
      }
    };
  }
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
          eyebrow: isSpanishXby ? isAidreamcapes ? "Biblioteca de albumes de ocasion" : "Biblioteca de paquetes de fotos" : isAidreamcapes ? "Occasion album library" : myDreamShootsIntroCopy.eyebrow,
          title: isSpanishXby
            ? isAidreamcapes
              ? "Albumes privados de fans y recuerdos festivos por ocasion."
              : "Paquetes de fotos con IA por estilo, uso y entrega."
            : myDreamShootsIntroCopy.title,
          body: isSpanishXby
            ? isAidreamcapes
              ? "Explora albumes de fans, grupos de partido, estrenos, Navidad, Accion de Gracias y Halloween antes de gastar creditos."
              : "Compara retratos profesionales, retratos de creador, fotos de hincha, belleza, albumes tematicos y video antes de gastar creditos."
            : isAidreamcapes
              ? "Browse fan-scene albums, game-day group portraits, premiere-inspired sets, Christmas, Thanksgiving, Halloween, and seasonal memories before you spend credits."
              : myDreamShootsIntroCopy.body,
          primaryCta: isSpanishXby ? isAidreamcapes ? "Ver albumes de ocasion" : "Ver paquetes de fotos" : isAidreamcapes ? "Browse occasion albums" : myDreamShootsIntroCopy.primaryCta,
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
  const taxonomySectionId = page.sectionsOrder.find((sectionId) => {
    const type = page.sections[sectionId]?.type;
    return type === "dreamshoot_package_taxonomy" || type === "aidreamcapes_package_taxonomy";
  });

  const isAidreamcapes = isAidreamcapesStorefront(site);
  const isSpanishXby = isSpanishXbyStorefront(site);
  const isMyDreamShoots = !isAidreamcapes && !isSpanishXby;
  const myDreamShootsTaxonomyCopy = {
    eyebrow: "AI photo package library",
    title: "Browse AI photo packages by category",
    subtitle: "Choose a top-level category, then compare focused themes, example outputs, and visible credit expectations before you start."
  };
  if (taxonomySectionId && isMyDreamShoots) {
    return {
      ...page,
      sections: {
        ...page.sections,
        [taxonomySectionId]: {
          ...page.sections[taxonomySectionId],
          settings: {
            ...page.sections[taxonomySectionId].settings,
            eyebrow: myDreamShootsTaxonomyCopy.eyebrow,
            title: myDreamShootsTaxonomyCopy.title,
            subtitle: myDreamShootsTaxonomyCopy.subtitle,
            headingLevel: "h2"
          }
        }
      }
    };
  }
  if (taxonomySectionId) return page;

  const taxonomyId = safeSectionId(page, "package_taxonomy_1");
  const insertAfterIntro = page.sectionsOrder.indexOf("collections_intro_1");
  const sectionsOrder = [...page.sectionsOrder];
  sectionsOrder.splice(insertAfterIntro >= 0 ? insertAfterIntro + 1 : Math.min(1, sectionsOrder.length), 0, taxonomyId);

  return {
    ...page,
    sectionsOrder,
    sections: {
      ...page.sections,
      [taxonomyId]: {
        type: "dreamshoot_package_taxonomy",
        settings: {
          anchor: "package-taxonomy",
          eyebrow: isSpanishXby ? isAidreamcapes ? "Biblioteca de albumes de ocasion" : "Biblioteca de paquetes de fotos" : isAidreamcapes ? "Occasion album library" : myDreamShootsTaxonomyCopy.eyebrow,
          title: isSpanishXby
            ? isAidreamcapes
              ? "Albumes privados de fans y recuerdos festivos por ocasion."
              : "Paquetes de fotos con IA por estilo, uso y entrega."
            : isAidreamcapes
              ? "Private fan-scene and holiday albums by occasion."
              : myDreamShootsTaxonomyCopy.title,
          subtitle: isSpanishXby
            ? isAidreamcapes
              ? "Explora albumes de fans, grupos de partido, estrenos, Navidad, Accion de Gracias y Halloween antes de gastar creditos."
              : "Compara retratos profesionales, retratos de creador, fotos de hincha, belleza, albumes tematicos y video antes de gastar creditos."
            : isAidreamcapes
              ? "Browse fan-scene albums, game-day group portraits, premiere-inspired sets, Christmas, Thanksgiving, Halloween, and seasonal memories before you spend credits."
              : myDreamShootsTaxonomyCopy.subtitle,
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
    .replace(/^\/ai-video-generation\//, "")
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
  const toolPage = site.pages.find((page) => page.slug === "/ai-video-generation" || page.slug === "/tools" || page.pageType === "tools");
  const toolPageBlocks = toolPage
    ? Object.values(toolPage.publishedJson.sections).flatMap((section) => section.blocks ?? []).filter((block) => block.type === "tool_card")
    : [];
  const blocks = [...headerBlocks, ...toolPageBlocks];
  return Array.from(new Map(blocks.map((block) => [block.id, block])).values());
}

function toolSlugFromBlock(block: SectionBlockInstance): string {
  const href = blockString(block, "href", "");
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  return normalizeToolLookup(path.replace(/^\/tools\//, "").replace(/^\/ai-video-generation\//, "") || block.id || blockString(block, "title"));
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
    "wedding-portraits": "Wedding Portraits"
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
  if (isPrimaryMydreamshootsCapabilitySite(site) && isMydreamshootsCollectionItemSlug(normalized)) return true;
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
  "profile-clip",
  "creator-intro-video"
];

const fallbackToolDirectoryBlocks = cache((): SectionBlockInstance[] =>
  dreamshootToolDirectorySlugs.map((slug) => fallbackToolBlockForSlug(slug)).filter((block): block is SectionBlockInstance => Boolean(block))
);

function toolsDirectoryFaqSectionForSite(site: Site): SectionInstance {
  const isAidreamcapes = isAidreamcapesStorefront(site);
  const isSpanishXby = isSpanishXbyStorefront(site);
  const items = isSpanishXby
    ? isAidreamcapes
      ? [
          ["Que herramienta de ocasion debo usar?", "Elige la herramienta que coincida con el momento: fans, dia de partido, festivos, retratos de viaje o planificacion segura."],
          ["Las herramientas copian identidades oficiales?", "No. Usa fotos aprobadas y direcciones originales, sin recrear celebridades, deportistas, logos o marcas protegidas sin permiso."],
          ["Los resultados son privados?", "Si. Fotos fuente, pedidos, creditos y albumes terminados permanecen vinculados a la cuenta del cliente."],
          ["Puedo publicar resultados en redes?", "Si, cuando las personas mostradas aprobaron el uso y cumples las reglas de plataforma, derechos y divulgacion."]
        ]
      : [
          ["Que herramienta de fotos debo usar?", "Elige por resultado: retratos profesionales, retratos de creador, edicion de fondo, mejora de imagen o video corto."],
          ["Las herramientas usan subida privada?", "Si. Fotos fuente, pedidos, creditos y resultados terminados permanecen vinculados a la cuenta del cliente."],
          ["Puedo usar resultados en redes o paginas de negocio?", "Si, cuando tienes permiso para las fotos fuente y cumples las reglas de la plataforma."],
          ["Que debo revisar antes de descargar?", "Revisa caras, manos, recortes, marcas, texto accidental y calidad general antes de publicar."]
        ]
    : isAidreamcapes
      ? [
          ["Which Aidreamcapes occasion tool should I use?", "Choose the tool that matches the private album moment: fan-scene atmosphere, game-day group energy, holiday cards, creator occasion portraits, premiere-inspired photos, or permission-safe content planning."],
          ["Do tools recreate real public figures or official marks?", "No. Aidreamcapes tools focus on original occasion atmosphere and approved source photos, not unauthorized celebrity likenesses, athlete identities, official logos, league marks, venue marks, or misleading affiliation."],
          ["What source photos work best for occasion tools?", "Use clear, well-lit photos with permission from every person shown. Group tools work better when faces are visible and not heavily overlapping; holiday and fan-scene tools work better when the source photos have enough detail for a private album concept."],
          ["Are source photos and finished albums private?", "Uploads, request details, credit records, generation status, and finished albums remain connected to the signed-in Aidreamcapes account. Results are delivered to a private gallery for review and download rather than a public listing."],
          ["How are credits handled for Aidreamcapes tools?", "Supported tools show the credit requirement before generation starts, reserve credits while processing, and settle or release credits according to the recorded request status. Review the cost before starting an album or motion request."],
          ["Can I use results on social pages?", "Yes, when every person shown approved the use, the content avoids misleading endorsement or official affiliation, and the post follows platform and AI disclosure rules."]
        ]
      : [
          ["Which AI photo tool should I start with?", "Start with the tool that matches the final asset you need. Use headshot tools for LinkedIn, resumes, founder bios, and team pages; creator portrait tools for media kits and campaign images; edit tools for cleanup or enhancement; and AI video tools when you want a short motion concept from an approved still image."],
          ["What source photos work best for AI tools?", "Use sharp, recent, well-lit photos where the subject is visible and the intended edit is clear. Avoid screenshots, heavy beauty filters, tiny crops, sunglasses, blurred faces, extreme compression, and any photo you do not own or have permission to process."],
          ["Do myDreamshoots tools use a private upload flow?", "Yes. Customer-facing AI tools keep source photos, request settings, credit reservations, generation status, and finished images connected to the signed-in myDreamshoots workspace instead of publishing them publicly by default."],
          ["How are credits shown for AI photo and video tools?", "Paid tools show the credit requirement before generation begins, so you can compare an AI headshot, background edit, image enhancement, portrait style, or AI video request before credits are reserved. Failed requests can release reserved credits according to the recorded job status."],
          ["Can tool results be used for social media or business pages?", "You can use suitable results for social media, creator pages, LinkedIn, websites, ad drafts, or business profiles when you control the source photos, every person shown has approved the use, and the destination platform rules and AI disclosure requirements are followed."],
          ["What should I inspect before downloading or publishing results?", "Review identity details, facial consistency, hands, text-like marks, logos, background artifacts, crop quality, and overall realism. AI results should be checked before use in professional profiles, campaigns, printed material, or customer-facing business pages."]
        ];
  return {
    type: "faq",
    settings: {
      anchor: "faq",
      layout: "visual_faq",
      eyebrow: isSpanishXby ? "Preguntas de herramientas" : isAidreamcapes ? "Occasion tools FAQ" : "Tools FAQ",
      title: isSpanishXby ? "Preguntas antes de usar herramientas" : isAidreamcapes ? "Aidreamcapes tool questions" : "AI tool questions before upload",
      subtitle: isSpanishXby
        ? "Respuestas sobre fotos fuente, creditos, privacidad y entrega."
        : isAidreamcapes
          ? "Answers about Aidreamcapes occasion tools, approved source photos, protected-identity boundaries, credits, privacy, social use, and private album delivery."
          : "Answers about myDreamshoots AI photo tools, source photos, credits, privacy, quality review, and publishing use."
    },
    blocks: items.map(([question, answer], index) => ({
      id: `tools_directory_faq_${index + 1}`,
      type: "faq_item",
      settings: { question, answer }
    }))
  };
}

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
    sectionsOrder: ["tools_directory_1", "faq_1"],
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
      },
      faq_1: toolsDirectoryFaqSectionForSite(site)
    }
  };
}

function withDreamShootVideoGenerationDirectoryPage(pageJson: ThemePageJson): ThemePageJson {
  // The root video directory has a dedicated presentation contract. Keep it
  // independent from any legacy photo-tool sections that may remain in a
  // publication snapshot while its topic pages are being updated.
  return {
    ...pageJson,
    sectionsOrder: ["video_theme_directory_1"],
    sections: {
      video_theme_directory_1: {
        type: "dreamshoot_tool_collection",
        settings: {
          anchor: "video-themes",
          title: "AI Video Generation",
          subtitle: "Browse every public AI video theme and open the dedicated guide for the direction you want.",
          layout: "video_theme_grid",
          headingLevel: "h1"
        },
        blocks: []
      }
    }
  };
}

function baseToolDetailPageForSite(site: Site, page?: Site["pages"][number]): Site["pages"][number] {
  const existingToolPage =
    page ??
    site.pages.find((item) => item.slug === "/ai-video-generation") ??
    site.pages.find((item) => item.slug === "/tools/image-studio") ??
    site.pages.find((item) => item.pageType === "ai_tool" && /^\/(?:tools|ai-video-generation)\/[^/]+$/.test(item.slug));
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
  return isAidreamcapesCapabilitySite(site);
}

function isPrimaryMydreamshootsStorefront(site: Pick<Site, "id" | "slug" | "name" | "primaryDomain"> & { branding: Pick<Site["branding"], "logoText"> }): boolean {
  return isPrimaryMydreamshootsCapabilitySite(site);
}

function usesSharedDreamShootNavigation(site: Pick<Site, "id" | "slug" | "name" | "primaryDomain"> & { branding: Pick<Site["branding"], "logoText"> }): boolean {
  return usesAiGenerationPublicRoutes(site) || isAidreamcapesStorefront(site);
}

function toolDetailFaqBlocksForSite(
  site: Site,
  input: {
    toolSlug: string;
    label: string;
    description: string;
    category: string;
    workflow: string[];
    useCases: string[];
  }
): SectionBlockInstance[] {
  return dreamshootToolDetailFaqBlocks({ site, ...input }, `faq_tool_${input.toolSlug}`);
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
  const useDirectoryToolContent = spanishXby || aidreamcapes || directoryContent.explicit;
  const toolBrandName = site.branding.logoText || site.name || (aidreamcapes ? "Aidreamcapes" : "myDreamshoots");
  const effectiveCategory = spanishXby ? aidreamcapes ? "Herramienta de viaje IA" : "Herramienta de fotos IA" : category;
  const effectiveTitle = useDirectoryToolContent ? directoryContent.label : detailText(detail, "title", title);
  const effectiveDescription = useDirectoryToolContent
    ? directoryContent.intro
    : detailText(detail, "subtitle", blockString(tool, "description", sectionSetting(page, "entry_1", "subtitle", copy.intro)));
  const effectiveCta = useDirectoryToolContent
    ? directoryContent.ctaLabel
    : detailText(detail, "ctaLabel", copy.primaryCta);
  const guideTitle = useDirectoryToolContent
    ? directoryContent.h3[0] ?? (spanishXby ? `Guia de ${effectiveTitle}` : copy.guideTitle)
    : detailText(detail, "guideTitle", copy.guideTitle);
  const guideBody = detailText(
    detail,
    "guideBody",
    spanishXby
      ? aidreamcapes
        ? `Sube fotos fuente claras, elige una direccion de viaje, revisa creditos visibles y guarda resultados en la galeria privada de ${site.branding.logoText || site.name}.`
        : `Sube fotos fuente claras, elige el estilo, revisa creditos visibles y guarda resultados en la galeria privada de ${site.branding.logoText || site.name}.`
      : aidreamcapes ? directoryContent.workflow.join(" ") : copy.guideBody
  );
  const effectiveGuideBody = useDirectoryToolContent ? directoryContent.workflow.join(" ") : guideBody;
  const detailTitle = useDirectoryToolContent
    ? spanishXby ? `Detalles de ${effectiveTitle}` : `How ${directoryContent.label} fits ${toolBrandName}`
    : detailText(detail, "detailTitle", `What ${title} is used for`);
  const detailBody = useDirectoryToolContent
    ? directoryContent.details.join(" ")
    : detailText(detail, "detailBody", copy.detailBody);
  const workflowItems = useDirectoryToolContent ? directoryContent.workflow : detailList(detail, "workflow", []);
  const useCaseItems = useDirectoryToolContent ? directoryContent.useCases : detailList(detail, "useCases", [copy.useCaseOneDescription, copy.useCaseTwoDescription]);
  const imageUrl = blockString(tool, "imageUrl", sectionSetting(page, "entry_1", "imageUrl"));
  const appCreateHref = isStandaloneVideoToolSlug(toolSlug) ? `/app/create?videoMode=${encodeURIComponent(toolSlug)}#step-video` : `/app/create?tool_id=${encodeURIComponent(toolSlug)}`;
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
      body: effectiveGuideBody,
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
          settings: {
            meta: index === 0 ? spanishXby ? "Ideal para" : "Best for" : spanishXby ? "Caso de uso" : "Use case",
            title: useDirectoryToolContent ? directoryContent.h3[index + 1] ?? `${spanishXby ? "Caso" : "Use case"} ${index + 1}` : description,
            description
          }
        }))
      : toolDetailUseCaseBlocks(copy)
  };
  if (page.sections.faq_1) {
    const toolFaqInput = {
      site,
      toolSlug,
      label: effectiveTitle,
      description: effectiveDescription,
      category: effectiveCategory,
      workflow: workflowItems.length ? workflowItems : directoryContent.workflow,
      useCases: useCaseItems
    };
    page.sections.faq_1.settings = {
      ...page.sections.faq_1.settings,
      ...dreamshootToolDetailFaqSectionSettings(toolFaqInput)
    };
    page.sections.faq_1.blocks = toolDetailFaqBlocksForSite(site, toolFaqInput);
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
  const isPrimaryMydreamshoots = isPrimaryMydreamshootsStorefront(site);
  const isPublicVideoTopic = isPrimaryMydreamshoots && isMydreamshootsPublicVideoGenerationSlug(normalizedToolSlug);
  const databaseVideoTheme = isPublicVideoTopic ? undefined : (state.videoThemes ?? []).find((theme) =>
    theme.siteId === site.id &&
    theme.status === "active" &&
    normalizeToolLookup(theme.slug) === normalizedToolSlug
  );
  const isVideoTool = isPrimaryMydreamshoots && (isMydreamshootsVideoGenerationSlug(normalizedToolSlug) || Boolean(databaseVideoTheme));
  const aidreamcapesAliasTarget = isAidreamcapes ? aidreamcapesToolAliases.get(normalizedToolSlug) : undefined;
  const canonicalToolSlug = aidreamcapesAliasTarget ?? normalizedToolSlug;
  const directPageSlug = isVideoTool ? `/ai-video-generation/${normalizedToolSlug}` : `/tools/${toolSlug}`;
  const normalizedPageSlug = normalizedToolSlug
    ? isVideoTool ? `/ai-video-generation/${normalizedToolSlug}` : `/tools/${normalizedToolSlug}`
    : directPageSlug;
  const aliasMap = new Map<string, string>();

  for (const page of site.pages.filter((item) => item.pageType === "ai_tool" || item.slug.startsWith("/ai-video-generation/"))) {
    aliasMap.set(page.slug, page.slug);
    aliasMap.set(page.slug.replace(/^\/(?:tools|ai-video-generation)\//, ""), page.slug);
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

  if (isPrimaryMydreamshootsStorefront(site)) {
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
  const page = site.pages.find((item) => item.slug === resolvedSlug) ?? site.pages.find((item) => item.slug === directPageSlug);
  const pageTypes = page ? pageSectionTypes(page.publishedJson) : undefined;
  const hasDedicatedVideoLanding = Boolean(
    isVideoTool &&
    pageTypes &&
    (pageTypes.has("ai_video_topic_landing") || pageTypes.has("talking_photo_landing"))
  );
  if (hasDedicatedVideoLanding && page) {
    return { siteAiApps, page, app: undefined, matched: true, resolvedSlug };
  }
  if (isPublicVideoTopic) {
    return {
      siteAiApps,
      page: page ?? baseToolDetailPageForSite(site, page),
      app: undefined,
      // The public topic route is valid only when its immutable publication
      // contains a dedicated landing page. Generic tool pages never stand in
      // for a published video topic.
      matched: Boolean(page && hasDedicatedVideoLanding),
      resolvedSlug
    };
  }
  const app = directApp ?? legacyImageApp ?? (page?.slug === "/tools/image-studio" ? siteAiApps.find((siteApp) => siteApp.aiApp.slug === "image_generator") : undefined);
  const menuTool = (state.toolMenuItems ?? []).find((item) => {
    if (item.siteId !== site.id || item.status !== "active") return false;
    const hrefSlug = normalizeToolLookup(item.href.replace(/^\/tools\//, "").replace(/^\/ai-video-generation\//, ""));
    const itemSlug = normalizeToolLookup(item.slug);
    return hrefSlug === normalizedToolSlug || hrefSlug === canonicalToolSlug || itemSlug === normalizedToolSlug || itemSlug === canonicalToolSlug;
  });
  const themeToolBlock = toolBlocksFromTheme(site).find((block) => {
    const blockSlug = toolSlugFromBlock(block);
    return blockSlug === normalizedToolSlug || blockSlug === canonicalToolSlug;
  });
  const databaseThemeToolBlock = databaseVideoTheme
    ? {
        id: `video_theme_${databaseVideoTheme.id}`,
        type: "tool_card",
        settings: {
          title: databaseVideoTheme.name,
          description: databaseVideoTheme.description,
          category: databaseVideoTheme.category?.label ?? "AI Video",
          href: `/ai-video-generation/${databaseVideoTheme.slug}`,
          imageUrl: databaseVideoTheme.imageUrl ?? ""
        }
      } as SectionBlockInstance
    : undefined;
  const toolBlock = menuTool
    ? toolBlockFromMenuItem(menuTool)
    : themeToolBlock ?? databaseThemeToolBlock ?? (explicitAidreamcapesToolSlug ? aidreamcapesToolBlockForSlug(site, canonicalToolSlug) : isAidreamcapes ? undefined : fallbackToolBlockForSlug(canonicalToolSlug));
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
    : Boolean(page || directApp || legacyImageApp || databaseVideoTheme || toolBlock || aliasMap.has(toolSlug) || aliasMap.has(directPageSlug) || aliasMap.has(normalizedToolSlug));
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
  navigationVideoThemeCategories,
  navigationVideoThemes,
  navigationVideoGenerationTopics,
  routeMode,
  runtime,
  settings,
  jsonLd,
  storefrontContext,
  publishedPaths,
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
  navigationVideoThemeCategories?: SiteRenderData["videoThemeCategories"];
  navigationVideoThemes?: SiteRenderData["videoThemes"];
  navigationVideoGenerationTopics?: HeaderVideoGenerationTopic[];
  routeMode: "host" | "path";
  runtime: ThemeRuntimeData;
  settings: Site["themeSettings"]["publishedJson"];
  jsonLd?: JsonLdNode[];
  storefrontContext?: StorefrontContext;
  publishedPaths?: string[];
  lightweightChrome?: boolean;
}) {
  const jsonLdNodes = jsonLd;
  const navigationPagePaths = new Set(currentSite.pages.flatMap((publishedPage) => [
    publishedPage.slug,
    publishedPage.publishedJson.seo?.canonical,
    publishedPage.publishedJson.seo?.canonicalPath
  ].filter((value): value is string => Boolean(value))));
  const guardedNavigationPaths = new Set([
    "/children-privacy",
    "/content",
    "/cookies",
    "/creators-circle",
    "/privacy",
    "/refunds",
    "/state-privacy",
    "/terms"
  ]);
  const navigationLinkIsPublished = (href: string) => {
    const path = href.split(/[?#]/)[0] || "/";
    if (!guardedNavigationPaths.has(path)) return true;
    if (publishedPaths) return publishedPaths.includes(path);
    return navigationPagePaths.has(path) || navigationPagePaths.has(publicContentPageSlug(path));
  };
  const resolvedSettings = {
    ...settings,
    navigation: {
      headerLinks: settings.navigation.headerLinks.filter((link) => navigationLinkIsPublished(link.href)),
      footerLinks: settings.navigation.footerLinks.filter((link) => navigationLinkIsPublished(link.href))
    }
  };
  const activePackIds = storefrontContext
    ? new Set(storefrontContext.catalog.activePacks.map((pack) => pack.id))
    : undefined;
  const activeProductIds = storefrontContext
    ? new Set(storefrontContext.offers.active.map((offer) => offer.product.id))
    : undefined;
  // Best Photo is a public catalog view. Keep all database-backed themes visible
  // there, including review_required snapshot entries; generation flows still
  // enforce the published storefront context and credit/output checks.
  const preserveBestPhotoCatalog = isPrimaryMydreamshootsCapabilitySite(currentSite) && pagePath === "/best-ai-image";
  const resolvedCreativePacks = activePackIds && !preserveBestPhotoCatalog
    ? renderData.creativePacks.filter((pack) => activePackIds.has(pack.id))
    : renderData.creativePacks;
  const preserveMydreamshootsPhotoMenu = isPrimaryMydreamshootsCapabilitySite(currentSite);
  const resolvedNavigationCreativePacks = activePackIds && navigationCreativePacks && !preserveMydreamshootsPhotoMenu
    ? navigationCreativePacks.filter((pack) => activePackIds.has(pack.id))
    : navigationCreativePacks;

  return (
    <div style={themeStyleVars(resolvedSettings)}>
      <ThemeRenderer
        creativePackCategories={renderData.creativePackCategories}
        creativePacks={resolvedCreativePacks}
        page={page}
        pagePath={pagePath}
        products={activeProductIds ? renderData.products.filter((product) => activeProductIds.has(product.id)) : renderData.products}
        query={query}
        routeMode={routeMode}
        runtime={runtime}
        settings={resolvedSettings}
        site={clientSiteForThemeRender(currentSite, page, pagePath)}
        siteAiApps={renderData.siteAiApps}
        navigationCreativePackCategories={navigationCreativePackCategories}
        navigationCreativePacks={resolvedNavigationCreativePacks}
        navigationToolMenuItems={navigationToolMenuItems}
        navigationVideoThemeCategories={navigationVideoThemeCategories}
        navigationVideoThemes={navigationVideoThemes}
        navigationVideoGenerationTopics={navigationVideoGenerationTopics}
        toolMenuItems={renderData.toolMenuItems}
        videoThemeCategories={renderData.videoThemeCategories}
        videoThemes={renderData.videoThemes}
        homepageShowcases={renderData.homepageShowcases}
        lightweightChrome={lightweightChrome}
        storefrontContext={storefrontContext}
      />
      {jsonLdNodes?.length ? <StorefrontJsonLd nodes={jsonLdNodes} /> : null}
    </div>
  );
}

export async function renderStorefrontPage({
  site,
  slug,
  publicPath,
  query = {},
  routeMode = "path",
  state: providedState,
  deferCustomerRuntime = false
}: {
  site: Site;
  slug: string;
  publicPath?: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
  deferCustomerRuntime?: boolean;
}) {
  const shouldDeferCustomerRuntime = deferCustomerRuntime && publicCustomerBootstrapEnabled();
  const shouldCompletePublicPacks = !preferLocalPathModeState(site.slug);
  const state = await getStateForStorefrontRender(site, routeMode, providedState);
  const stateSite = state.sites.find((item) => item.id === site.id);
  if (!stateSite) notFound();
  const publishedSnapshot = createPublishedSiteSnapshot(state, stateSite);
  const currentSite = publishedSnapshot.site;
  const collectionCategory = typeof query.category === "string" ? query.category : "";
  const collectionRootPath = publicCollectionRootPathForSite(currentSite);
  const isCollectionDirectoryPage = slug === "/collections" || slug === collectionRootPath;
  const isFocusedCollectionPage = isCollectionDirectoryPage && Boolean(collectionCategory);
  const usesPublishedLeafProjection = isFocusedCollectionPage && isPrimaryMydreamshootsStorefront(currentSite);
  const renderPagePath = publicPath ?? (
    isCollectionDirectoryPage
      ? publicCollectionPathForSite(currentSite, collectionCategory)
      : slug
  );
  if (usesPublishedLeafProjection && resolvePublishedRouteDisposition(publishedSnapshot, renderPagePath).kind !== "render") notFound();
  const currentRenderData = getSiteRenderData(state, currentSite.id);
  const renderData = usesPublishedLeafProjection
    ? {
        ...currentRenderData,
        creativePackCategories: [],
        creativePacks: publishedSnapshot.creativePacks,
        mediaAssets: [],
        products: publishedSnapshot.products
      }
    : {
        ...currentRenderData,
        homepageShowcases: publishedSnapshot.publishedHomepageShowcases ?? []
      };
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
  const navigationVideoThemeCategories = useSharedNavigation
    ? renderData.videoThemeCategories
    : undefined;
  const navigationVideoThemes = useSharedNavigation
    ? renderData.videoThemes
    : undefined;
  const navigationVideoGenerationTopics = publishedVideoGenerationTopics(publishedSnapshot);
  currentSite.mediaAssets = renderData.mediaAssets;
  const directPage = findPage(currentSite, slug);
  if (!directPage) notFound();
  const page = directPage;
  if (isFocusedCollectionPage) {
    currentSite.pages = currentSite.pages.filter((item) => item.slug === slug || item.slug === "/404");
  }
  const settings = currentSite.themeSettings.publishedJson;
  const sessionId = shouldDeferCustomerRuntime ? undefined : await readCustomerSessionId(currentSite.id);
  const usesDreamShootToolsDirectory =
    slug === "/tools" &&
    (usesAiGenerationPublicRoutes(currentSite) || isAidreamcapesStorefront(currentSite));
  const usesDreamShootVideoGenerationDirectory = slug === "/ai-video-generation" && isPrimaryMydreamshootsStorefront(currentSite);
  const pageJson = slug === "/account"
    ? withAccountDashboardPage(page.publishedJson)
    : usesDreamShootVideoGenerationDirectory
    ? withDreamShootVideoGenerationDirectoryPage(page.publishedJson)
    : usesDreamShootToolsDirectory
    ? withDreamShootToolsDirectoryPage(page.publishedJson, currentSite)
    : isFocusedCollectionPage
    ? withSeoDirectorySection(page.publishedJson, "collection", collectionCategory, {
        focused: true,
        site: currentSite,
        publishedCopy: publishedLeafCopy(publishedSnapshot, collectionCategory)
      })
    : isCollectionDirectoryPage
    ? withDreamShootCollectionsDirectoryPage(page.publishedJson, currentSite)
    : page.publishedJson;
  const renderDataForPage = isFocusedCollectionPage ? focusedCollectionRenderData : renderData;
  let pageRenderData = withPageMediaAssets(
    currentSite,
    pageJson,
    settings,
    trimRenderDataForPage(renderDataForPage, pageJson, slug, isCollectionDirectoryPage && !isFocusedCollectionPage)
  );
  const currentPageSectionTypes = pageSectionTypes(pageJson);
  const currentPageUsesFullMediaGallery = pageUsesFullMediaGallery(pageJson);
  const pageUsesDirectoryPackLimit = currentPageSectionTypes.has("dreamshoot_generation_showcase") || currentPageSectionTypes.has("dreamshoot_media_gallery") || currentPageSectionTypes.has("dreamshoot_featured_pack");
  const pageNeedsPublicCreativePacks = !isFocusedCollectionPage && (slug === "/" || isCollectionDirectoryPage || Array.from(currentPageSectionTypes).some((type) => creativePackSectionTypes.has(type)));
  const pageNeedsPublicVideoThemes = currentPageSectionTypes.has("dreamshoot_generation_showcase") || currentPageSectionTypes.has("dreamshoot_media_gallery");
  const directoryPackLimit = publicPackLimitForPage({
    slug,
    usesFullMediaGallery: currentPageUsesFullMediaGallery,
    isDirectoryPage: isCollectionDirectoryPage && !isFocusedCollectionPage,
    hasDirectorySections: pageUsesDirectoryPackLimit
  });
  if (!usesPublishedLeafProjection && shouldCompletePublicPacks && pageNeedsPublicCreativePacks && pageRenderData.creativePacks.length > 0) {
    pageRenderData = {
      ...pageRenderData,
      creativePacks: await completePublicCreativePacksForSite(currentSite, pageRenderData.creativePacks, directoryPackLimit)
    };
  }
  if (!usesPublishedLeafProjection && shouldCompletePublicPacks && pageNeedsPublicCreativePacks && !pageRenderData.creativePacks.length) {
    pageRenderData = {
      ...pageRenderData,
      creativePacks: (await getStorefrontPublicCreativePacksForSite(currentSite.id, directoryPackLimit)).map((pack) => ({
        ...pack,
        prompt: undefined,
        galleryImages: (pack.galleryImages ?? []).filter(Boolean).slice(0, 12),
        galleryImageAlts: (pack.galleryImageAlts ?? []).map((alt) => alt.trim()).slice(0, 12)
      }))
    };
  }
  // The homepage showcase must prefer the relational public video-theme source.
  // A legacy publication can contain one unrelated tutorial video, which would
  // otherwise prevent the empty-data fallback from loading the eight themes.
  if (pageNeedsPublicVideoThemes && (currentPageSectionTypes.has("dreamshoot_generation_showcase") || !pageRenderData.videoThemes.length)) {
    const videoThemeLimit = currentPageSectionTypes.has("dreamshoot_media_gallery")
      ? currentPageUsesFullMediaGallery ? undefined : publicDirectoryPackLimit
      : currentPageSectionTypes.has("dreamshoot_generation_showcase")
      ? 8
      : 32;
    const configuredVideoSection = Object.values(pageJson.sections).find((section) =>
      section.type === "dreamshoot_generation_showcase" || section.type === "dreamshoot_media_gallery"
    );
    pageRenderData = {
      ...pageRenderData,
      videoThemes: trimVideoThemesForStorefront(
        { ...emptySiteRenderData(), videoThemes: await loadStorefrontPublicVideoThemesForSection(currentSite, renderData.videoThemes, videoThemeLimit) },
        videoThemeLimit,
        configuredVideoSection
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
  const renderedPage = { ...page, publishedJson: pageJson };
  const storefrontContext = resolvePublishedStorefrontContext(publishedSnapshot, renderedPage);

  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: renderPagePath,
    query,
    navigationCreativePackCategories,
    navigationCreativePacks,
    navigationToolMenuItems,
    navigationVideoThemeCategories,
    navigationVideoThemes,
    navigationVideoGenerationTopics,
    renderData: pageRenderData,
    routeMode,
    runtime: runtimeWithAuth,
    settings,
    storefrontContext,
    publishedPaths: publishedSnapshot.publishedPaths,
    jsonLd: isFocusedCollectionPage
      ? buildCollectionDirectoryJsonLd({
          site: currentSite,
          collectionSlug: collectionCategory,
          routeMode,
          creativePacks: trimCreativePacksForStorefront(focusedCollectionRenderData, publicDirectoryPackLimit),
          context: storefrontContext
        })
      : buildStorefrontJsonLd({
          site: currentSite,
          page,
          pageJson,
          pagePath: renderPagePath,
          routeMode,
          creativePacks: pageRenderData.creativePacks,
          products: usesPublishedLeafProjection ? publishedSnapshot.products : state.products,
          context: storefrontContext,
          videoThemes: pageRenderData.videoThemes,
          publishedRoutePaths: publishedSnapshot.publishedRoutes.flatMap((route) =>
            route.disposition === "render" && route.status === "published" && "canonicalPath" in route
              ? [route.canonicalPath]
              : []
          )
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
  const activePackIds = payload.storefrontContext
    ? new Set(payload.storefrontContext.catalog.activePacks.map((pack) => pack.id))
    : undefined;
  const preserveBestPhotoCatalog = isPrimaryMydreamshootsCapabilitySite(payload.clientSite) && payload.renderContext.pagePath === "/best-ai-image";
  return (
    <ThemeSectionFrame
      creativePackCategories={payload.renderData.creativePackCategories}
      creativePacks={activePackIds && !preserveBestPhotoCatalog ? payload.renderData.creativePacks.filter((pack) => activePackIds.has(pack.id)) : payload.renderData.creativePacks}
      id={payload.id}
      lazyRender={false}
      mode={payload.mode}
      products={payload.renderData.products}
      renderContext={payload.renderContext}
      runtime={payload.runtime}
      section={payload.section}
      site={payload.clientSite}
      siteAiApps={payload.renderData.siteAiApps}
      storefrontContext={payload.storefrontContext}
      toolMenuItems={payload.renderData.toolMenuItems}
      videoThemeCategories={payload.renderData.videoThemeCategories ?? []}
      videoThemes={payload.renderData.videoThemes ?? []}
      homepageShowcases={payload.renderData.homepageShowcases ?? []}
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
  const requestSlug = slug;
  const internalSlug = internalPageSlugForPublicPath(requestSlug);
  const requestQuery = queryWithPublicCollectionCategory(requestSlug, query);
  const shouldCompletePublicPacks = !(routeMode === "path" && preferLocalPathModeState(publicSlug));
  const state = await getPublicSectionStateForRoute(publicSlug, internalSlug, routeMode, requestedSectionIds, requestQuery);
  if (!state) return [];
  const currentSite = state.sites.find((item) =>
    item.slug === siteSlug ||
    publicSiteSlug(item.slug) === publicSlug ||
    canonicalSiteSlug(item.slug) === canonicalSiteSlug(siteSlug)
  );
  if (!currentSite) return [];
  const publishedSnapshot = createPublishedSiteSnapshot(state, currentSite);
  const sectionState = state;
  const sectionSite = currentSite;

  const collectionRoute = isCollectionPublicPath(requestSlug) ? parsePublicCollectionRouteForSite(currentSite, requestSlug) : undefined;
  if (isCollectionPublicPath(requestSlug) && !collectionRoute) return [];
  const collectionCategory = collectionRoute?.collectionSlug ?? (typeof requestQuery.category === "string" ? requestQuery.category : "");
  const renderPagePath = collectionRoute?.canonicalPath ?? requestSlug;
  const isFocusedCollectionPage = internalSlug === "/collections" && Boolean(collectionCategory);
  const currentRenderData = getSiteRenderData(state, currentSite.id);
  const renderData = isFocusedCollectionPage && isPrimaryMydreamshootsStorefront(currentSite)
    ? { ...currentRenderData, creativePackCategories: [], creativePacks: publishedSnapshot.creativePacks, mediaAssets: [], products: publishedSnapshot.products }
    : currentRenderData;
  currentSite.mediaAssets = renderData.mediaAssets;
  const toolDetailSlug = internalSlug.match(/^\/tools\/([^/]+)$/)?.[1] ?? "";
  const resolvedToolDetail = toolDetailSlug
    ? resolveToolPageForSite(state, currentSite, toolDetailSlug, renderData.siteAiApps, renderData.creativePacks)
    : undefined;
  const directPage = resolvedToolDetail?.matched
    ? resolvedToolDetail.page
    : findPage(currentSite, internalSlug) ?? syntheticDreamShootPartnerPage(currentSite, internalSlug);
  if (!directPage) return [];
  if (isFocusedCollectionPage && isPrimaryMydreamshootsStorefront(currentSite) && resolvePublishedRouteDisposition(publishedSnapshot, renderPagePath).kind !== "render") return [];
  if (isFocusedCollectionPage) {
    currentSite.pages = currentSite.pages.filter((item) => item.slug === internalSlug || item.slug === "/404");
  }

  const usesDreamShootToolsDirectory =
    internalSlug === "/tools" &&
    (usesAiGenerationPublicRoutes(currentSite) || isAidreamcapesStorefront(currentSite));
  const usesDreamShootVideoGenerationDirectory = internalSlug === "/ai-video-generation" && isPrimaryMydreamshootsStorefront(currentSite);
  const pageJson: ThemePageJson = internalSlug === "/account"
    ? withAccountDashboardPage(directPage.publishedJson)
    : toolDetailSlug && resolvedToolDetail?.matched
    ? withSeoDirectorySection(directPage.publishedJson, "tool", toolDetailSlug, { site: currentSite })
    : usesDreamShootVideoGenerationDirectory
    ? withDreamShootVideoGenerationDirectoryPage(directPage.publishedJson)
    : usesDreamShootToolsDirectory
    ? withDreamShootToolsDirectoryPage(directPage.publishedJson, currentSite)
    : isFocusedCollectionPage
    ? withSeoDirectorySection(directPage.publishedJson, "collection", collectionCategory, {
        focused: true,
        site: currentSite,
        publishedCopy: publishedLeafCopy(publishedSnapshot, collectionCategory)
      })
    : internalSlug === "/collections"
    ? withDreamShootCollectionsDirectoryPage(directPage.publishedJson, currentSite)
    : directPage.publishedJson;

  const settings = currentSite.themeSettings.publishedJson;
  const renderedPage = { ...directPage, publishedJson: pageJson };
  const storefrontContext = resolvePublishedStorefrontContext(createPublishedSiteSnapshot(sectionState, currentSite), renderedPage);
  const runtimeByMode = new Map<"empty" | "full" | "light", Promise<ThemeRuntimeData>>();
  let sectionSessionId: string | undefined;
  async function runtimeForSection(singleSectionPageJson: ThemePageJson, section: SectionInstance): Promise<ThemeRuntimeData | undefined> {
    if (toolDetailSlug) {
      runtimeByMode.set("empty", runtimeByMode.get("empty") ?? Promise.resolve(runtimeWithEmptyCollections()));
      return runtimeByMode.get("empty");
    }
    const needsCustomerRuntime = customerRuntimeSectionTypes.has(section.type) || internalSlug === "/account" || internalSlug.startsWith("/app/");
    if (!needsCustomerRuntime) return undefined;
    sectionSessionId ??= await readCustomerSessionId(sectionSite.id);
    if (pageNeedsFullCustomerRuntime(singleSectionPageJson, internalSlug)) {
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
        internalSlug,
        sectionId
      )
    );
    if (shouldCompletePublicPacks && (internalSlug === "/" || (internalSlug === "/collections" && !isFocusedCollectionPage) || creativePackSectionTypes.has(section.type)) && pageRenderData.creativePacks.length > 0) {
      const sectionFullMediaGallery = sectionUsesFullMediaGallery(section);
      const directoryPackLimit = sectionFullMediaGallery
        ? undefined
        : internalSlug === "/"
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
    if (section.type === "dreamshoot_media_gallery" && pageRenderData.videoThemes.length) {
      const videoThemeLimit = sectionUsesFullMediaGallery(section) ? undefined : publicDirectoryPackLimit;
      pageRenderData = {
        ...pageRenderData,
        videoThemes: trimVideoThemesForStorefront({ ...emptySiteRenderData(), videoThemes: pageRenderData.videoThemes }, videoThemeLimit, section)
      };
    }
    if ((section.type === "dreamshoot_generation_showcase" || section.type === "dreamshoot_media_gallery") && !pageRenderData.videoThemes.length) {
      const videoThemeLimit = section.type === "dreamshoot_media_gallery"
        ? sectionUsesFullMediaGallery(section) ? undefined : publicDirectoryPackLimit
        : 8;
      pageRenderData = {
        ...pageRenderData,
        videoThemes: trimVideoThemesForStorefront(
          { ...emptySiteRenderData(), videoThemes: await loadStorefrontPublicVideoThemesForSection(currentSite, renderData.videoThemes, videoThemeLimit) },
          videoThemeLimit,
          section
        )
      };
    }
    pageRenderData = withPageMediaAssets(currentSite, singleSectionPageJson, settings, pageRenderData);
    currentSite.mediaAssets = pageRenderData.mediaAssets;

    const runtime = await runtimeForSection(singleSectionPageJson, section);
    const routedSite = clientSiteForSectionRender(currentSite, singleSectionPageJson, internalSlug) as Site & { __storefrontBasePath?: string };
    routedSite.__storefrontBasePath = routeMode === "host" ? "" : `/site/${publicSiteSlug(currentSite.slug)}`;
    const renderContext = {
      pagePath: renderPagePath,
      query: requestQuery,
      page: pageJson,
      pages: pageNeedsSearchEntries(pageJson) ? searchPageEntriesForSite(routedSite) : []
    };

    payloads.push({
      clientSite: routedSite as RoutedSite,
      component: "ThemeSectionFrame",
      id: sectionId,
      mode: "published",
      pagePath: renderPagePath,
      renderData: {
        creativePackCategories: pageRenderData.creativePackCategories,
        creativePacks: pageRenderData.creativePacks,
        products: pageRenderData.products,
        siteAiApps: pageRenderData.siteAiApps,
        toolMenuItems: pageRenderData.toolMenuItems,
        videoThemeCategories: pageRenderData.videoThemeCategories,
        videoThemes: pageRenderData.videoThemes,
        homepageShowcases: pageRenderData.homepageShowcases
      },
      renderContext,
      storefrontContext,
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
  const requestSlug = slug;
  const internalSlug = internalPageSlugForPublicPath(requestSlug);
  const requestQuery = queryWithPublicCollectionCategory(requestSlug, query);
  const shouldCompletePublicPacks = !(routeMode === "path" && preferLocalPathModeState(publicSlug));
  const state = await getPublicSectionStateForRoute(publicSlug, internalSlug, routeMode, [sectionId], requestQuery);
  if (!state) return undefined;
  const currentSite = state.sites.find((item) =>
    item.slug === siteSlug ||
    publicSiteSlug(item.slug) === publicSlug ||
    canonicalSiteSlug(item.slug) === canonicalSiteSlug(siteSlug)
  );
  if (!currentSite) return undefined;
  const publishedSnapshot = createPublishedSiteSnapshot(state, currentSite);

  const collectionRoute = isCollectionPublicPath(requestSlug) ? parsePublicCollectionRouteForSite(currentSite, requestSlug) : undefined;
  if (isCollectionPublicPath(requestSlug) && !collectionRoute) return undefined;
  const collectionCategory = collectionRoute?.collectionSlug ?? (typeof requestQuery.category === "string" ? requestQuery.category : "");
  const renderPagePath = collectionRoute?.canonicalPath ?? requestSlug;
  const isFocusedCollectionPage = internalSlug === "/collections" && Boolean(collectionCategory);
  const currentRenderData = getSiteRenderData(state, currentSite.id);
  const renderData = isFocusedCollectionPage && isPrimaryMydreamshootsStorefront(currentSite)
    ? { ...currentRenderData, creativePackCategories: [], creativePacks: publishedSnapshot.creativePacks, mediaAssets: [], products: publishedSnapshot.products }
    : currentRenderData;
  currentSite.mediaAssets = renderData.mediaAssets;
  const toolDetailSlug = internalSlug.match(/^\/tools\/([^/]+)$/)?.[1] ?? "";
  const resolvedToolDetail = toolDetailSlug
    ? resolveToolPageForSite(state, currentSite, toolDetailSlug, renderData.siteAiApps, renderData.creativePacks)
    : undefined;
  const directPage = resolvedToolDetail?.matched
    ? resolvedToolDetail.page
    : findPage(currentSite, internalSlug) ?? syntheticDreamShootPartnerPage(currentSite, internalSlug);
  if (!directPage) return undefined;
  if (isFocusedCollectionPage && isPrimaryMydreamshootsStorefront(currentSite) && resolvePublishedRouteDisposition(publishedSnapshot, renderPagePath).kind !== "render") return undefined;
  if (isFocusedCollectionPage) {
    currentSite.pages = currentSite.pages.filter((item) => item.slug === internalSlug || item.slug === "/404");
  }

  const usesDreamShootToolsDirectory =
    internalSlug === "/tools" &&
    (usesAiGenerationPublicRoutes(currentSite) || isAidreamcapesStorefront(currentSite));
  const pageJson: ThemePageJson = internalSlug === "/account"
    ? withAccountDashboardPage(directPage.publishedJson)
    : toolDetailSlug && resolvedToolDetail?.matched
    ? withSeoDirectorySection(directPage.publishedJson, "tool", toolDetailSlug, { site: currentSite })
    : usesDreamShootToolsDirectory
    ? withDreamShootToolsDirectoryPage(directPage.publishedJson, currentSite)
    : isFocusedCollectionPage
    ? withSeoDirectorySection(directPage.publishedJson, "collection", collectionCategory, {
        focused: true,
        site: currentSite,
        publishedCopy: publishedLeafCopy(publishedSnapshot, collectionCategory)
      })
    : internalSlug === "/collections"
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
  const renderedPage = { ...directPage, publishedJson: pageJson };
  const storefrontContext = resolvePublishedStorefrontContext(createPublishedSiteSnapshot(state, currentSite), renderedPage);
  let pageRenderData = withPageMediaAssets(
    currentSite,
    singleSectionPageJson,
    settings,
    trimRenderDataForSection(
      toolDetailSlug
        ? trimToolDetailRenderData(renderData)
        : renderData,
      pageJson,
      internalSlug,
      sectionId
    )
  );
  if (shouldCompletePublicPacks && (internalSlug === "/" || (internalSlug === "/collections" && !isFocusedCollectionPage) || creativePackSectionTypes.has(section.type)) && pageRenderData.creativePacks.length > 0) {
    const sectionFullMediaGallery = sectionUsesFullMediaGallery(section);
    const directoryPackLimit = sectionFullMediaGallery
      ? undefined
      : internalSlug === "/"
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
  if (section.type === "dreamshoot_media_gallery" && pageRenderData.videoThemes.length) {
    const videoThemeLimit = sectionUsesFullMediaGallery(section) ? undefined : publicDirectoryPackLimit;
    pageRenderData = {
      ...pageRenderData,
      videoThemes: trimVideoThemesForStorefront({ ...emptySiteRenderData(), videoThemes: pageRenderData.videoThemes }, videoThemeLimit, section)
    };
  }
  if ((section.type === "dreamshoot_generation_showcase" || section.type === "dreamshoot_media_gallery") && !pageRenderData.videoThemes.length) {
    const videoThemeLimit = section.type === "dreamshoot_media_gallery"
      ? sectionUsesFullMediaGallery(section) ? undefined : publicDirectoryPackLimit
      : 8;
    pageRenderData = {
      ...pageRenderData,
      videoThemes: trimVideoThemesForStorefront(
        { ...emptySiteRenderData(), videoThemes: await loadStorefrontPublicVideoThemesForSection(currentSite, renderData.videoThemes, videoThemeLimit) },
        videoThemeLimit,
        section
      )
    };
  }
  pageRenderData = withPageMediaAssets(currentSite, singleSectionPageJson, settings, pageRenderData);
  currentSite.mediaAssets = pageRenderData.mediaAssets;

  const needsCustomerRuntime = customerRuntimeSectionTypes.has(section.type) || internalSlug === "/account" || internalSlug.startsWith("/app/");
  const sessionId = needsCustomerRuntime ? await readCustomerSessionId(currentSite.id) : undefined;
  const runtime = toolDetailSlug
    ? runtimeWithEmptyCollections()
    : needsCustomerRuntime
    ? sessionId && pageNeedsFullCustomerRuntime(singleSectionPageJson, internalSlug)
      ? await getFullCustomerRuntime(state, currentSite.id, sessionId)
      : await getLightCustomerRuntime(state, currentSite.id, sessionId)
    : undefined;
  const routedSite = clientSiteForSectionRender(currentSite, singleSectionPageJson, internalSlug) as Site & { __storefrontBasePath?: string };
  routedSite.__storefrontBasePath = routeMode === "host" ? "" : `/site/${publicSiteSlug(currentSite.slug)}`;
  const renderContext = {
    pagePath: renderPagePath,
    query: requestQuery,
    page: pageJson,
    pages: pageNeedsSearchEntries(pageJson) ? searchPageEntriesForSite(routedSite) : []
  };

  return {
    clientSite: routedSite as RoutedSite,
    component: "ThemeSectionFrame",
    id: sectionId,
    mode: "published",
    pagePath: renderPagePath,
    renderData: {
      creativePackCategories: pageRenderData.creativePackCategories,
      creativePacks: pageRenderData.creativePacks,
      products: pageRenderData.products,
      siteAiApps: pageRenderData.siteAiApps,
      toolMenuItems: pageRenderData.toolMenuItems,
      videoThemeCategories: pageRenderData.videoThemeCategories,
      videoThemes: pageRenderData.videoThemes,
      homepageShowcases: pageRenderData.homepageShowcases
    },
    renderContext,
    storefrontContext,
    routeMode,
    runtime,
    section,
    site: routedSite as RoutedSite
  };
}

function syntheticDreamShootPartnerPage(site: Site, slug: string): ThemePage | undefined {
  if (!dreamshootPartnerTemplateSlugs.has(slug)) return undefined;
  if (!usesSharedDreamShootNavigation(site)) return undefined;
  const templateKey =
    slug === "/workflow" ? "workflow" :
    slug === "/faq" ? "help" :
    slug === "/partner-registration" ? "partner-registration" :
    slug === "/about-us" ? "about-us" :
    slug === "/contact-us" ? "contact-us" :
    slug === "/best-packages" ? "best-packages" :
    slug === "/best-ai-image" ? "best-ai-image" :
    slug === "/best-ai-video" ? "best-ai-video" :
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
      templateKey === "best-packages" ? "Best Packages" :
      templateKey === "best-ai-image" ? "Best AI image" :
      templateKey === "best-ai-video" ? "Best AI video" :
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
  const state = providedState
    ?? (routeMode === "path" ? await readPathModePublicRuntimeState(publicSiteSlug(site.slug), "/login") : undefined)
    ?? await getStateForStorefrontRender(site, routeMode);
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
      toolMenuItems: renderData.toolMenuItems,
      videoThemeCategories: renderData.videoThemeCategories
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
  if (slug === "/account") {
    const [bootstrap, accountRuntime] = await Promise.all([
      getCustomerWorkspaceBootstrapRelational(currentSite.slug),
      getCustomerAccountSummaryRuntimeRelational({ customer: current.customer, siteId: currentSite.id })
    ]);
    return (
      <CustomerAccountClientPage
        initialCreativePackCategories={bootstrap?.creativePackCategories ?? []}
        initialCreativePacks={bootstrap?.creativePacks ?? []}
        initialCustomer={accountRuntime.customer ?? current.customer}
        initialRuntime={accountRuntime}
        initialSite={currentSite}
        initialToolMenuItems={bootstrap?.toolMenuItems ?? []}
        initialVideoThemeCategories={bootstrap?.videoThemeCategories ?? []}
        initialPublishedVideoGenerationTopics={bootstrap?.publishedVideoGenerationTopics ?? []}
        siteSlug={publicSiteSlug(currentSite.slug)}
      />
    );
  }
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
    if (!siteId) redirect(loginPathWithNext);
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
        initialVideoThemeCategories={bootstrap?.videoThemeCategories ?? []}
        initialPublishedVideoGenerationTopics={bootstrap?.publishedVideoGenerationTopics ?? []}
        siteSlug={routeSlug}
      />
    );
  }

  if (isWorkspaceRoute) {
    const siteId = await getSiteIdBySlugRelational(canonicalSlug);
    if (!siteId) redirect(loginPathWithNext);
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
        initialCreativePackId={resolveInitialCreativePackId(
          typeof query.pack === "string" ? query.pack : undefined,
          bootstrap.creativePacks,
          typeof query.category === "string" ? query.category : undefined
        )}
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
  publicPath,
  query = {},
  routeMode = "path",
  state: providedState,
  resolvedPage
}: {
  site: Site;
  toolSlug: string;
  publicPath?: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
  resolvedPage?: ThemePage;
}) {
  const state = await getStateForStorefrontRender(site, routeMode, providedState);
  const stateSite = state.sites.find((item) => item.id === site.id);
  if (!stateSite) notFound();
  const publishedSnapshot = createPublishedSiteSnapshot(state, stateSite);
  const currentSite = publishedSnapshot.site;
  const renderData = getSiteRenderData(state, currentSite.id);
  const candidate = resolvedPage
    ? { page: resolvedPage, matched: true }
    : resolveToolPageForSite(state, currentSite, toolSlug, renderData.siteAiApps, renderData.creativePacks);
  const page = publishedSnapshot.pages.find((publishedPage) => publishedPage.id === candidate.page.id);
  if (!candidate.matched || !page) notFound();
  const toolRenderData = trimToolDetailRenderData(renderData);
  currentSite.mediaAssets = toolRenderData.mediaAssets;
  const settings = currentSite.themeSettings.publishedJson;
  const normalizedToolSlug = normalizeToolLookup(toolSlug);
  const pageHasToolEntry = page.publishedJson.sectionsOrder.some((sectionId) => page.publishedJson.sections[sectionId]?.type === "ai_tool_entry");
  const pageHasTalkingPhotoLanding = page.publishedJson.sectionsOrder.some((sectionId) => page.publishedJson.sections[sectionId]?.type === "talking_photo_landing");
  const pageHasAiVideoTopicLanding = page.publishedJson.sectionsOrder.some((sectionId) => page.publishedJson.sections[sectionId]?.type === "ai_video_topic_landing");
  const pageHasDedicatedVideoLanding = pageHasTalkingPhotoLanding || pageHasAiVideoTopicLanding;
  const basePageJson = pageHasDedicatedVideoLanding
    ? page.publishedJson
    : pageHasToolEntry
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
  const pageJson = pageHasDedicatedVideoLanding
    ? withSeoDirectorySeo(basePageJson, "tool", toolSlug, currentSite)
    : withSeoDirectorySection(basePageJson, "tool", toolSlug, { site: currentSite });
  const pageRenderData = withPageMediaAssets(
    currentSite,
    pageJson,
    settings,
    trimRenderDataForPage(toolRenderData, pageJson, page.slug)
  );
  currentSite.mediaAssets = pageRenderData.mediaAssets;
  const renderedPage = { ...page, publishedJson: pageJson };
  const storefrontContext = resolvePublishedStorefrontContext(publishedSnapshot, renderedPage);
  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: publicPath ?? page.slug,
    query,
    navigationCreativePackCategories: trimCreativePackCategoriesForStorefront(renderData),
    navigationCreativePacks: trimCreativePacksForNavigation(renderData),
    navigationToolMenuItems: renderData.toolMenuItems.map(lightweightToolMenuItem),
    navigationVideoThemeCategories: renderData.videoThemeCategories,
    navigationVideoThemes: renderData.videoThemes,
    navigationVideoGenerationTopics: publishedVideoGenerationTopics(publishedSnapshot),
    renderData: pageRenderData,
    routeMode,
    runtime: runtimeWithEmptyCollections(),
    settings,
    storefrontContext,
    publishedPaths: publishedSnapshot.publishedPaths,
    jsonLd: buildToolDirectoryJsonLd({
      site: currentSite,
      toolSlug,
      publicPath,
      routeMode,
      pageJson,
      context: storefrontContext
    })
  });
}
