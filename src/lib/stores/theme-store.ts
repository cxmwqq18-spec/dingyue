import "server-only";

import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import { getSectionSchema } from "@/lib/section-schema";
import { clearSiteMediaSummaryCache, clearSiteReadCache, getThemePublishPreflightBundleRelational } from "@/lib/stores/site-store";
import { normalizeStorefrontProfile } from "@/lib/stores/storefront-profile-store";
import { clearStorefrontContextCache, hasCompleteStorefrontProfileFacts, loadDraftStorefrontContext } from "@/lib/storefront-context";
import { isPrimaryMydreamshootsSite } from "@/lib/storefront-context/capabilities";
import { resolveStorefrontBindings } from "@/lib/storefront-context/core";
import {
  buildSaasThemeDraft,
  buildSaasThemePublication,
  fromSaasSettings,
  fromSaasTemplate,
  toSaasTemplate,
  type SaasThemeRecord,
  type SaasThemeSettingsRecord,
  type SaasThemeTemplates
} from "@/lib/theme/saas-theme-model";
import {
  getImportedSaasSectionSchemasForTheme,
  getSaasThemePackage,
  normalizeSaasSettingsCurrentForTheme,
  resetSaasSettingsCurrentForTheme
} from "@/lib/theme/saas-theme-package";
import {
  getThemePackages,
  themePackageTemplateToPageJson,
  type ThemePackageSiteSettings,
  type ThemePackageTemplateKey
} from "@/lib/theme/packages";
import { runThemePublishPreflight, summarizeThemeGlobalVisuals, type PublishPreflightCreativePack } from "@/lib/theme/publish-preflight";
import { mydreamshootsPageCopyForRoute } from "@/lib/mydreamshoots-page-copy";
import {
  buildPublishedPageMediaProjection,
  mydreamshootsPublishedPageEntities,
  mydreamshootsPublishedRouteManifest,
  publishedLinkEntityId,
  publishedPageCopySourceHash
} from "@/lib/mydreamshoots-published-contract";
import { compileMydreamshootsVideoTopicPublication } from "@/lib/mydreamshoots-video-topic-publication";
import { normalizeGlobalSection } from "@/lib/theme/section-normalize";
import { publicationSnapshotHash, publicationSnapshotIntegrity } from "@/lib/publication-snapshot-integrity";
import { isMydreamshootsRemovedLegacyRoute, MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES, MYDREAMSHOOTS_STANDARD_SEO_ROUTES } from "@/lib/mydreamshoots-editorial-routes";
import type {
  MediaAsset,
  Product,
  SectionBlockInstance,
  SectionInstance,
  Site,
  SiteTheme,
  ThemeBlockSchema,
  ThemeCopy,
  ThemeDraftMeta,
  ThemePage,
  ThemePublication,
  PublishedRouteProjection,
  PublishedStandardRouteProjection,
  PublishedStandardPageMediaProjection,
  PublishedPageEntityProjection,
  PublishedSeoSnapshot,
  PublishedHomepageShowcaseItem,
  ThemeSectionSchema,
  ThemeSettings,
  ThemeSettingValue
} from "@/lib/types";

function asPublishedMediaPack(pack: PublishPreflightCreativePack | undefined): {
  id: string;
  status: "active" | "draft" | "paused";
  imageUrl?: string;
  galleryImages?: string[];
  galleryImageAlts?: string[];
} | undefined {
  if (!pack) return undefined;
  return {
    id: pack.id,
    status: (pack.status === "active" || pack.status === "draft" || pack.status === "paused" ? pack.status : "draft") as "active" | "draft" | "paused",
    imageUrl: pack.imageUrl ?? undefined,
    galleryImages: pack.galleryImages ?? undefined,
    galleryImageAlts: pack.galleryImageAlts ?? undefined
  };
}

function firstVideoUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /\.(?:mp4|webm)(?:[?#]|$)/i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = firstVideoUrl(item);
      if (result) return result;
    }
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const result = firstVideoUrl(item);
      if (result) return result;
    }
  }
  return undefined;
}

function buildHomepageShowcases(params: {
  site: Site;
  pages: ThemePage[];
  videoNavigation: PublishedSeoSnapshot["publishedVideoNavigation"];
  pageEntities: PublishedPageEntityProjection[];
  pageMedia: PublishedSeoSnapshot["publishedPageMedia"];
  standardMedia: PublishedStandardPageMediaProjection[];
  collections: PublishedSeoSnapshot["publishedCollectionRefs"];
}): PublishedHomepageShowcaseItem[] {
  const { site, pages, videoNavigation, pageEntities, pageMedia, standardMedia, collections } = params;
  const entities = new Map(pageEntities.map((entity) => [entity.pageEntityId, entity]));
  const media = new Map(pageMedia.map((item) => [item.pageEntityId, item]));
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const items: PublishedHomepageShowcaseItem[] = [];

  for (const item of videoNavigation) {
    const entity = entities.get(item.pageEntityId);
    const pageMediaItem = media.get(item.pageEntityId);
    if (!entity || entity.status !== "published" || !entity.indexable || !pageMediaItem || pageMediaItem.status !== "ready") continue;
    const page = pageById.get(item.id);
    items.push({
      id: `homepage-video-${item.slug}`,
      kind: "video",
      pageEntityId: item.pageEntityId,
      canonicalPath: item.canonicalPath,
      title: item.label,
      subtitle: item.description,
      category: item.parentLabel,
      sortOrder: item.sortOrder,
      imageUrl: pageMediaItem.primaryImage,
      imageAlt: pageMediaItem.imageAlts[0] || item.label,
      ...(page ? { videoUrl: firstVideoUrl(page.publishedJson) } : {}),
      status: "published",
      indexable: true,
      sitemapEligible: true,
      entityRevision: entity.pageRevision,
      mediaRevision: pageMediaItem.entityRevision
    });
  }

  const saveDateItems = (site.themeSettings.draftJson ?? site.themeSettings.publishedJson).saveTheDateNavigation?.groups
    ?.flatMap((group) => group.items.filter((item) => item.status === "published" && !(isPrimaryMydreamshootsSite(site) && isMydreamshootsRemovedLegacyRoute(item.href))).map((item) => ({ ...item, group }))) ?? [];
  for (const item of saveDateItems) {
    const entity = pageEntities.find((candidate) => candidate.canonicalPath === item.href && candidate.status === "published" && candidate.indexable);
    const pageMediaItem = entity ? standardMedia.find((candidate) => candidate.pageEntityId === entity.pageEntityId && candidate.status === "ready") : undefined;
    if (!entity || !pageMediaItem) continue;
    items.push({
      id: `homepage-save-the-date-${item.slug}`,
      kind: "save_the_date",
      pageEntityId: entity.pageEntityId,
      canonicalPath: entity.canonicalPath,
      title: item.label,
      subtitle: entity.metadata.description,
      category: item.group.label,
      sortOrder: item.sortOrder,
      imageUrl: pageMediaItem.primaryImage,
      imageAlt: pageMediaItem.primaryImageAlt,
      status: "published",
      indexable: true,
      sitemapEligible: true,
      entityRevision: entity.pageRevision,
      mediaRevision: pageMediaItem.revision
    });
  }

  for (const collection of collections) {
    if (collection.status !== "published") continue;
    const entity = entities.get(collection.pageEntityId);
    const pageMediaItem = media.get(collection.pageEntityId);
    if (!entity || !entity.indexable || !pageMediaItem || pageMediaItem.status !== "ready") continue;
    items.push({
      id: `homepage-photo-${collection.collectionSlug}`,
      kind: "photo",
      pageEntityId: collection.pageEntityId,
      canonicalPath: collection.canonicalPath,
      title: collection.label,
      subtitle: collection.summary,
      category: collection.categorySlug,
      sortOrder: items.length,
      imageUrl: pageMediaItem.primaryImage,
      imageAlt: pageMediaItem.imageAlts[0] || collection.imageAlt,
      status: "published",
      indexable: true,
      sitemapEligible: true,
      entityRevision: entity.pageRevision,
      mediaRevision: pageMediaItem.entityRevision
    });
  }
  return items;
}

const STANDARD_MYDREAMSHOOTS_MEDIA_PATHS = ["/about-us", "/best-packages", "/best-ai-image", "/best-ai-video", "/best-save-the-date", "/pricing", "/faq", "/workflow"] as const;
const SAVE_THE_DATE_EDITORIAL_PATHS = MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES;
const STANDARD_MYDREAMSHOOTS_MEDIA_ALTS: Record<(typeof STANDARD_MYDREAMSHOOTS_MEDIA_PATHS)[number] | (typeof SAVE_THE_DATE_EDITORIAL_PATHS)[number], string> = {
  "/about-us": "MyDreamShoots company overview with the private AI photo workflow",
  "/best-packages": "Published MyDreamShoots photo packages arranged for visual theme comparison",
  "/best-ai-image": "Published AI image examples selected from the current MyDreamShoots collection",
  "/best-ai-video": "Published AI video examples selected from the current MyDreamShoots themes",
  "/best-save-the-date": "Published Save the Date themes arranged for announcement story comparison",
  "/pricing": "MyDreamShoots subscription credits and billing options comparison visual",
  "/faq": "MyDreamShoots support questions for uploads credits generation and delivery",
  "/workflow": "MyDreamShoots approved upload generation review and private delivery workflow",
  "/ai-save-the-date/valentines-day": "Valentine's Day save the date visual story from approved couple photos",
  "/holidays-events/engagement": "Engagement save the date video scenes from approved couple visuals",
  "/holidays-events/proposal": "Proposal video scenes showing the planned story and reaction",
  "/holidays-events/save-the-date": "Save the Date video scenes for a confirmed wedding date",
  "/ai-video-generation/wedding-ceremony": "Wedding ceremony photo and video scenes for vows, rings, reactions, and the recessional",
  "/holidays-events/mothers-day": "Mother's Day family, flowers, gifts, brunch, and spring celebration scenes",
  "/holidays-events/fathers-day": "Father's Day family, gifts, outdoor activities, and celebration scenes",
  "/holidays-events/halloween": "Halloween costume, couple, family, pet, pumpkin, party, and haunted-scene ideas"
};
function collectPublishedImageUrls(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string" && /\.(?:avif|jpe?g|png|webp)(?:[?#]|$)/i.test(value.trim())) {
    if (value.trim() && !output.includes(value.trim())) output.push(value.trim());
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectPublishedImageUrls(item, output));
    return output;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectPublishedImageUrls(item, output));
  }
  return output;
}

function buildPublishedStandardPageMedia(
  site: Site,
  leafRoutes: ReturnType<typeof mydreamshootsPublishedRouteManifest>,
  leafMedia: ReturnType<typeof buildPublishedPageMediaProjection>[]
): PublishedStandardPageMediaProjection[] {
  if (!isPrimaryMydreamshootsSite(site)) return [];
  const editorialPaths = SAVE_THE_DATE_EDITORIAL_PATHS.filter((path) => site.pages.some((candidate) => candidate.slug === path || candidate.publishedJson.seo?.canonicalPath === path));
  const paths = [...STANDARD_MYDREAMSHOOTS_MEDIA_PATHS, ...editorialPaths];
  return paths.map((canonicalPath) => {
    const page = site.pages.find((candidate) => candidate.slug === canonicalPath || candidate.publishedJson.seo?.canonicalPath === canonicalPath);
    const manifest = page?.publishedJson.mediaManifest ?? [];
    const discovered = manifest.length ? manifest.map((item) => item.src).filter(Boolean) : page ? collectPublishedImageUrls(page.publishedJson) : [];
    const firstReadyLeafMedia = canonicalPath === "/best-ai-image"
      ? leafRoutes.flatMap((route) => {
          const media = leafMedia.find((candidate) => candidate.pageEntityId === route.pageEntityId);
          return route.status === "published" && media?.status === "ready" ? [media] : [];
        })[0]
      : undefined;
    const fallbackSiteImage = site.mediaAssets?.find((asset) => typeof asset.storageKey === "string" && (/^https:\/\//i.test(asset.storageKey) || asset.storageKey.startsWith("/")))?.storageKey ?? "";
    const primaryImage = firstReadyLeafMedia?.primaryImage ?? page?.publishedJson.seo?.ogImage ?? discovered[0] ?? fallbackSiteImage;
    const pageEntityId = `mydreamshoots:standard:${canonicalPath.slice(1).replace(/[^a-z0-9]+/gi, "-")}`;
    const mediaEntityId = `${pageEntityId}:media`;
    const primaryImageAlt = page ? (manifest[0]?.alt || STANDARD_MYDREAMSHOOTS_MEDIA_ALTS[canonicalPath] || "") : "";
    const sitemapImages = primaryImage ? [primaryImage, ...discovered.filter((image) => image !== primaryImage)].slice(0, 6) : [];
    const expectedMediaCount = page?.publishedJson.contentContract?.mediaCount ?? 11;
    const manifestAssetsReady = !SAVE_THE_DATE_EDITORIAL_PATHS.includes(canonicalPath as (typeof SAVE_THE_DATE_EDITORIAL_PATHS)[number]) || (
      manifest.length === expectedMediaCount &&
      manifest.every((item) => site.mediaAssets?.some((asset) => asset.siteId === site.id && asset.storageKey === item.src && asset.altText === item.alt))
    );
    const status = page && primaryImage && primaryImageAlt && manifestAssetsReady ? "ready" as const : "review_required" as const;
    const revision = projectionRevision({ pageEntityId, pageId: page?.id, canonicalPath, primaryImage, primaryImageAlt, sitemapImages, status });
    return {
      pageEntityId,
      pageId: page?.id ?? "",
      canonicalPath,
      mediaEntityId,
      primaryImage,
      primaryImageAlt,
      ogImage: primaryImage,
      twitterImage: primaryImage,
      jsonLdImage: primaryImage,
      sitemapImages,
      status,
      revision,
      ...(status === "ready" ? {} : { reviewReason: manifestAssetsReady ? "STANDARD_PAGE_MEDIA_REQUIRED" : "SAVE_THE_DATE_MEDIA_OWNER_REQUIRED" })
    };
  });
}

function standardContentRouteForPage(site: Site, page: ThemePage): PublishedStandardRouteProjection | undefined {
  if (!isPrimaryMydreamshootsSite(site)) return undefined;
  const canonicalPath = page.publishedJson.seo?.canonicalPath || page.publishedJson.seo?.canonical || page.slug;
  const standardPaths = new Set<string>(MYDREAMSHOOTS_STANDARD_SEO_ROUTES);
  if (!standardPaths.has(canonicalPath)) return undefined;
  const pageEntityId = `mydreamshoots:standard:${canonicalPath.slice(1).replace(/[^a-z0-9]+/gi, "-")}`;
  const mediaEntityId = `${pageEntityId}:media`;
  const pageRevision = crypto.createHash("sha256").update(JSON.stringify(page.publishedJson)).digest("hex").slice(0, 20);
  const indexable = page.publishedJson.seo?.index !== false && page.publishedJson.seo?.robots?.index !== false;
  const contract = page.publishedJson.contentContract;
  const strictEditorial = SAVE_THE_DATE_EDITORIAL_PATHS.includes(canonicalPath as (typeof SAVE_THE_DATE_EDITORIAL_PATHS)[number]);
  const expectedSections = contract?.requiredSections ?? [];
  const expectedSectionIds = page.publishedJson.sectionsOrder;
  const expectedSectionTypes = contract?.sectionTypes ?? [];
  const sectionIds = page.publishedJson.sectionsOrder.map((id) => page.publishedJson.sections[id]).filter(Boolean);
  const sectionOrderReady = expectedSections.length > 0 && page.publishedJson.sectionsOrder.length === expectedSections.length && page.publishedJson.sectionsOrder.every((id, index) => id === `${contract?.pageKey ?? "editorial"}_${expectedSections[index]?.replace(/-/g, "_")}`);
  const sectionTypesReady = sectionIds.length === expectedSectionTypes.length && sectionIds.every((section, index) => section.type === expectedSectionTypes[index]);
  const sectionAnchorsReady = sectionIds.length === expectedSections.length && sectionIds.every((section, index) => section.settings.anchor === expectedSections[index]);
  const faqSectionId = expectedSectionIds.find((id) => page.publishedJson.sections[id]?.type === "faq");
  const faqSection = faqSectionId ? page.publishedJson.sections[faqSectionId] : undefined;
  const faqReady = faqSection?.type === "faq" && faqSection.blocks?.length === (contract?.faqCount ?? 0) && faqSection.blocks.every((block) => typeof block.settings.question === "string" && Boolean(block.settings.question.trim()) && typeof block.settings.answer === "string" && Boolean(block.settings.answer.trim()));
  const ctaSectionId = expectedSectionIds.find((id) => page.publishedJson.sections[id]?.type === "editorial_cta");
  const ctaSection = ctaSectionId ? page.publishedJson.sections[ctaSectionId] : undefined;
  const ctaReady = ctaSection?.type === "editorial_cta" && ["primaryCta", "primaryHref", "secondaryCta", "secondaryHref"].every((key) => typeof ctaSection.settings[key] === "string" && Boolean(String(ctaSection.settings[key]).trim()));
  const manifest = page.publishedJson.mediaManifest ?? [];
  const mediaCount = contract?.mediaCount ?? 11;
  const manifestReady = manifest.length === mediaCount && new Set(manifest.map((item) => item.src)).size === mediaCount && manifest.every((item) => item.src && item.alt && item.width && item.height && ["hero", "content"].includes(item.role ?? "content"));
  const mediaReady = !strictEditorial || (manifestReady && manifest.every((item) => site.mediaAssets?.some((asset) => asset.siteId === site.id && asset.storageKey === item.src && asset.altText === item.alt)));
  const noRawMarkdown = !JSON.stringify(page.publishedJson).match(/---|```|`[^`]+`|\[[^\]]+\]\([^)]*\)/);
  const editorialReady = !strictEditorial || Boolean(
    contract?.schema === "editorial-page-v1" && contract.pageKey && contract.faqCount &&
    JSON.stringify(contract.requiredSections) === JSON.stringify(expectedSections) &&
    sectionIds.length === expectedSections.length &&
    sectionOrderReady &&
    sectionTypesReady &&
    sectionAnchorsReady &&
    new Set(sectionIds.map((section) => String(section.settings.anchor ?? ""))).size === expectedSections.length &&
    faqReady &&
    ctaReady &&
    manifestReady &&
    mediaReady &&
    noRawMarkdown
  );
  // A page can be publicly reachable while its launch gate keeps it out of
  // search and sitemap. This is used by design packages marked HOLD until
  // product evidence is approved.
  const publishable = editorialReady;
  return {
    disposition: "render",
    siteId: site.id as "site_dreamshoot" | "site_grownstride_test",
    routeKind: "standard-content",
    canonicalPath,
    pageEntityId,
    pageId: page.id,
    pageRevision,
    status: publishable ? "published" : "review_required",
    indexable: publishable && indexable,
    sitemapEligible: publishable && indexable,
    mediaEntityId,
    ...(!indexable ? { reviewReason: "PAGE_SEO_REVIEW_REQUIRED" } : !editorialReady ? { reviewReason: "EDITORIAL_PAGE_CONTRACT_REQUIRED" } : {})
  };
}

function standardContentEntity(site: Site, page: ThemePage, route: PublishedStandardRouteProjection): PublishedPageEntityProjection {
  const seo = page.publishedJson.seo ?? {};
  const sections = page.publishedJson.sectionsOrder.map((id) => page.publishedJson.sections[id]).filter(Boolean);
  const setting = (key: string, fallback = "") => {
    for (const section of sections) {
      const value = section.settings?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return fallback;
  };
  const sectionOf = (type: string) => sections.find((section) => section.type === type);
  const sectionOfAny = (types: string[]) => sections.find((section) => types.includes(section.type));
  const blockText = (block: SectionBlockInstance, key: string) => String(block.settings?.[key] ?? "").trim();
  const sectionSetting = (type: string, key: string) => String(sectionOf(type)?.settings?.[key] ?? "").trim();
  const story = sectionOfAny(["editorial_story_grid", "editorial_scene_grid"]);
  const details = sectionOf("editorial_detail_list");
  const workflow = sectionOfAny(["editorial_steps", "editorial_story_flow"]);
  const ideas = sectionOfAny(["editorial_ideas", "editorial_formats", "editorial_scene_grid"]);
  const checklist = sectionOf("editorial_checklist");
  const finalCta = sectionOf("editorial_cta");
  const storyBlocks = story?.blocks ?? [];
  const detailBlocks = details?.blocks ?? [];
  const workflowBlocks = workflow?.blocks ?? [];
  const ideaBlocks = ideas?.blocks ?? [];
  const checklistBlocks = checklist?.blocks ?? [];
  const heroTitle = sectionSetting("editorial_hero", "title") || page.title;
  const heroIntro = sectionSetting("editorial_hero", "intro") || seo.description || "Publication content pending review.";
  const faqSection = sections.find((section) => section.type === "faq");
  const faqItems = (faqSection?.blocks ?? []).map((block, index) => ({ id: block.id || `faq-${index + 1}`, question: String(block.settings.question ?? ""), answer: String(block.settings.answer ?? "") })).filter((item) => item.question && item.answer);
  const listOrFallback = (values: string[], fallback: string) => {
    const clean = values.filter(Boolean).slice(0, 8);
    while (clean.length < 3) clean.push(clean[clean.length % Math.max(clean.length, 1)] || fallback);
    return clean;
  };
  const finalTitle = sectionSetting("editorial_cta", "title") || "Continue with the published page";
  const strictEditorial = SAVE_THE_DATE_EDITORIAL_PATHS.includes(route.canonicalPath as (typeof SAVE_THE_DATE_EDITORIAL_PATHS)[number]);
  return {
    pageEntityId: route.pageEntityId,
    canonicalPath: route.canonicalPath,
    pageType: "standard-content",
    status: route.status,
    indexable: route.indexable,
    sitemapEligible: route.sitemapEligible,
    metadata: { title: seo.title || page.title, description: seo.description || "", canonicalPath: route.canonicalPath, robots: { index: route.indexable, follow: seo.follow !== false, ...(seo.robots?.maxImagePreview ? { maxImagePreview: seo.robots.maxImagePreview } : {}) } },
    content: {
      h1: heroTitle,
      heroIntro,
      metaLabel: sectionSetting("editorial_hero", "eyebrow") || setting("eyebrow", "Published page"),
      tags: listOrFallback(storyBlocks.map((block) => blockText(block, "title")), "Published content"),
      detailTags: listOrFallback(detailBlocks.map((block) => blockText(block, "label")), "Page detail"),
      detailIntro: sectionSetting("editorial_detail_list", "intro") || heroIntro,
      whatCreates: heroIntro,
      bestFor: listOrFallback(storyBlocks.map((block) => blockText(block, "title")), "Published content"),
      workflow: listOrFallback(workflowBlocks.map((block) => blockText(block, "title")), "Published step"),
      styleNotes: listOrFallback(ideaBlocks.map((block) => blockText(block, "title")), "Published direction"),
      reviewCriteria: listOrFallback(checklistBlocks.map((block) => blockText(block, "text")), "Published review item"),
      coverNote: sectionSetting("editorial_cta", "intro") || heroIntro,
      safetyNote: undefined,
      galleryTitle: sectionSetting("editorial_story_grid", "title") || sectionSetting("editorial_ideas", "title") || page.title,
      galleryIntro: sectionSetting("editorial_ideas", "intro") || heroIntro,
      ctaEyebrow: sectionSetting("editorial_hero", "eyebrow") || "Published action",
      ctaTitle: finalTitle,
      ctaSubtitle: sectionSetting("editorial_cta", "intro") || heroIntro,
      ctaLinkEntityId: `${route.pageEntityId}:link:cta`,
      faqEyebrow: sectionSetting("faq", "eyebrow") || "FAQ",
      faqTitle: sectionSetting("faq", "title") || "Frequently asked questions",
      faqItems: faqItems.length >= 4 ? faqItems : strictEditorial ? [] : [
        { id: "faq-review-1", question: "What does this page cover?", answer: heroIntro },
        { id: "faq-review-2", question: "Where can I review the published details?", answer: "Review the visible page sections and the current published metadata before relying on this information." },
        { id: "faq-review-3", question: "Can the page content change?", answer: "Published content changes only when a new validated publication snapshot is activated." },
        { id: "faq-review-4", question: "Who can help with questions?", answer: "Contact the published storefront support channel for account or page questions." }
      ],
      relatedEyebrow: "Related content",
      relatedTitle: "Continue exploring",
      relatedSubtitle: "Published related links appear here when route validation provides them.",
      relatedCtaLabel: "Explore published content",
      relatedLinkEntityIds: faqItems.length >= 4 ? [`${route.pageEntityId}:link:related:1`, `${route.pageEntityId}:link:related:2`] : strictEditorial ? [] : [`${route.pageEntityId}:link:related:1`, `${route.pageEntityId}:link:related:2`]
    },
    mediaEntityId: route.mediaEntityId,
    pageRevision: route.pageRevision,
    copyRevision: route.pageRevision,
    reviewReasons: []
  };
}

function stableProjection(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableProjection);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stableProjection(item)]));
}

function projectionRevision(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(stableProjection(value))).digest("hex").slice(0, 20);
}

import {
  addAuditLogRelational,
  assertThemeDraftVersion,
  cloneJson,
  draftJsonWithMeta,
  makeThemeDraftMeta,
  RelationalStoreError,
  themeSettingsDraftJsonWithMeta,
  mapProduct,
  toMediaAsset,
  toSite,
  toSiteTheme,
  toThemeCopy,
  toThemePage,
  toThemeSettings,
  toThemePublication,
  uid,
  type PrismaLike
} from "./prisma-mappers";

type ThemeState = {
  site: Site;
  mediaAssets: MediaAsset[];
  publications: ThemePublication[];
  siteThemes: SiteTheme[];
  themeCopies: ThemeCopy[];
};

const themeReadCache = createServerTtlCache("theme-store", Number(process.env.SITE_THEME_CACHE_TTL_MS ?? 10_000));

function clearSiteThemeReadCache(siteId: string) {
  themeReadCache.clear(`theme-state:${siteId}`);
  themeReadCache.clear(`theme-site:${siteId}`);
  themeReadCache.clear(`theme-record-summary:${siteId}`);
  themeReadCache.clear(`publication-meta:${siteId}`);
  themeReadCache.clear(`publication-count:${siteId}`);
  themeReadCache.clear(`theme-labels:${siteId}`);
  clearSiteReadCache();
}

async function finalizePublishedTheme(siteId: string, publicationId: string): Promise<void> {
  clearSiteThemeReadCache(siteId);
  clearStorefrontContextCache(siteId);
  const readback = await prisma.themePublication.findFirst({
    where: { siteId, id: publicationId },
    select: { id: true, siteId: true, version: true, factsRevision: true, snapshot: true }
  });
  const snapshot = readback?.snapshot && typeof readback.snapshot === "object" && !Array.isArray(readback.snapshot)
    ? readback.snapshot as unknown as ThemePublication["snapshot"]
    : undefined;
  if (!readback || publicationSnapshotIntegrity(snapshot) !== "valid") {
    throw new RelationalStoreError("theme_publish_readback_failed", 500);
  }
  const activation = await prisma.activeThemePublication.findUnique({ where: { siteId } });
  if (activation?.publicationId !== publicationId) {
    throw new RelationalStoreError("theme_publish_activation_readback_failed", 500);
  }
}

export type SaasThemeAction =
  | ({ type: "change"; scope: "page_section"; pageId: string; sectionId: string; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; scope: "page_block"; pageId: string; sectionId: string; blockId: string; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; scope: "global"; globalType: "header" | "footer"; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; scope: "global_setting"; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; scope: "global_block"; globalType: "header" | "footer"; blockId: string; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "dropition"; pageId: string; sectionsOrder: string[] } & { themeKey?: string })
  | ({ type: "dropitem"; pageId: string; scope: "page_section"; sectionId: string; blockIds: string[] } & { themeKey?: string })
  | ({ type: "dropitem"; scope: "global"; globalType: "header" | "footer"; blockIds: string[] } & { themeKey?: string })
  | ({ type: "delition"; pageId: string; sectionId: string } & { themeKey?: string })
  | ({ type: "delitem"; pageId: string; scope: "page_section"; sectionId: string; blockId: string } & { themeKey?: string })
  | ({ type: "delitem"; scope: "global"; globalType: "header" | "footer"; blockId: string } & { themeKey?: string })
  | ({ type: "addition"; pageId: string; sectionType: string; sectionId?: string; section?: SectionInstance; sectionsOrder?: string[] } & { themeKey?: string })
  | ({ type: "additem"; pageId: string; scope: "page_section"; sectionId: string; blockType: string; block?: SectionBlockInstance } & { themeKey?: string })
  | ({ type: "additem"; scope: "global"; globalType: "header" | "footer"; blockType: string; block?: SectionBlockInstance } & { themeKey?: string });

export type XfcartThemeEditPayload = {
  t: string;
  page?: string;
  theme_id?: string;
  themeKey?: string;
  theme_key?: string;
  x?: string;
  i?: string;
  k?: string | number;
  n?: string;
  v?: ThemeSettingValue;
  section?: SectionInstance;
  block?: SectionBlockInstance;
  sectionsOrder?: string[];
};

async function getSiteWithThemeRecords(db: PrismaLike, siteId: string) {
  const site = await db.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      storefrontProfile: true,
      mediaAssets: true,
      activePublication: { include: { publication: true } },
      publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 },
      connect: true
    }
  });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  return site;
}

export function buildPublicationSnapshot(
  site: Site,
  siteTheme?: SiteTheme,
  creativePacks: PublishPreflightCreativePack[] = [],
  products: Product[] = []
): PublishedSeoSnapshot {
  const publishedAt = Date.now();
  const isMydreamshootsPublicationSite = isPrimaryMydreamshootsSite(site);
  const sourceRoutes = isMydreamshootsPublicationSite ? mydreamshootsPublishedRouteManifest(site.id as "site_dreamshoot" | "site_grownstride_test") : [];
  const imagePublishedPageCopy = sourceRoutes.map((route) => {
    const copy = mydreamshootsPageCopyForRoute({
      siteId: site.id,
      routeKind: "ai-image-theme-leaf",
      canonicalSlug: route.canonicalSlug,
      canonicalPath: route.canonicalPath
    });
    return {
      pageEntityId: route.pageEntityId,
      canonicalSlug: route.canonicalSlug,
      copyRevision: copy?.copyRevision ?? route.copyRevision,
      copySource: copy ? "page-copy" : "missing",
      sourceHash: copy
        ? publishedPageCopySourceHash(copy)
        : crypto.createHash("sha256").update(JSON.stringify([route.pageEntityId, route.canonicalPath, "missing-copy"])).digest("hex")
    };
  });
  const imagePublishedPageMedia = sourceRoutes.map((route) =>
    buildPublishedPageMediaProjection(route, asPublishedMediaPack(creativePacks.find((candidate) => candidate.id === route.expectedPackId)))
  );
  const leafRoutes = sourceRoutes.map((route) => {
    const media = imagePublishedPageMedia.find((candidate) => candidate.pageEntityId === route.pageEntityId);
    if (route.status === "published" && media?.status === "ready") return route;
    return {
      ...route,
      status: "review_required" as const,
      indexable: false,
      sitemapEligible: false,
      reviewReason: route.reviewReason || media?.reviewReason || "PAGE_MEDIA_REQUIRED"
    };
  });
  const publishedStandardPageMedia = buildPublishedStandardPageMedia(site, leafRoutes, imagePublishedPageMedia);
  const standardContentPages = isMydreamshootsPublicationSite
    ? site.pages.map((page) => {
        const route = standardContentRouteForPage(site, page);
        return route ? { page, route } : undefined;
      }).filter((entry): entry is { page: ThemePage; route: PublishedStandardRouteProjection } => Boolean(entry))
    : [];
  const standardContentRoutes = standardContentPages.map(({ route }) => route);
  const standardContentEntities = standardContentPages.map(({ page, route }) => standardContentEntity(site, page, route));
  const policyRouteSpecs = [
    { canonicalPath: "/privacy" as const, aliases: ["/privacy-policy", "/policies/privacy", "/policies/privacy-policy"] },
    { canonicalPath: "/terms" as const, aliases: ["/terms-of-service", "/policies/terms", "/policies/terms-of-service"] },
    { canonicalPath: "/cookies" as const, aliases: ["/cookie-policy", "/policies/cookies"] },
    { canonicalPath: "/refunds" as const, aliases: ["/refund-policy", "/policies/refund", "/policies/refunds"] },
    { canonicalPath: "/content" as const, aliases: ["/content-policy", "/policies/content"] },
    { canonicalPath: "/shipping" as const, aliases: ["/shipping-policy", "/delivery-policy", "/policies/shipping"] },
    { canonicalPath: "/children-privacy" as const, aliases: ["/children-privacy-policy", "/childrens-privacy", "/policies/children-privacy"] },
    { canonicalPath: "/state-privacy" as const, aliases: ["/state-privacy-rights", "/california-privacy", "/ccpa", "/policies/state-privacy"] }
  ];
  const publishedPolicyPages = isMydreamshootsPublicationSite
    ? policyRouteSpecs.flatMap(({ canonicalPath, aliases }) => {
        const sourcePage = [canonicalPath, ...aliases]
          .map((slug) => site.pages.find((candidate) => candidate.slug === slug))
          .find(Boolean);
        return sourcePage ? [{ ...sourcePage, slug: canonicalPath }] : [];
      })
    : [];
  const policyRoutes: PublishedRouteProjection[] = isMydreamshootsPublicationSite
    ? policyRouteSpecs.flatMap(({ canonicalPath, aliases }) => {
        const page = publishedPolicyPages.find((candidate) => candidate.slug === canonicalPath);
        if (!page) return [];
        const pageRevision = crypto.createHash("sha256").update(JSON.stringify(page.publishedJson)).digest("hex").slice(0, 20);
        const renderRoute: PublishedRouteProjection = {
          disposition: "render",
          siteId: site.id as "site_dreamshoot" | "site_grownstride_test",
          routeKind: "policy",
          canonicalPath,
          pageEntityId: `mydreamshoots:policy:${canonicalPath.slice(1)}`,
          pageId: page.id,
          pageRevision,
          status: "published",
          indexable: true,
          sitemapEligible: true
        };
        const redirects: PublishedRouteProjection[] = aliases.map((aliasPath) => ({
          disposition: "redirect",
          siteId: site.id as "site_dreamshoot" | "site_grownstride_test",
          routeKind: "policy-alias",
          aliasPath,
          targetPath: canonicalPath,
          statusCode: 308,
          indexable: false,
          sitemapEligible: false,
          routeRevision: crypto.createHash("sha256").update(JSON.stringify([aliasPath, canonicalPath, 308])).digest("hex").slice(0, 20)
        }));
        return [renderRoute, ...redirects];
      })
    : [];
  const videoTopicPublication = isMydreamshootsPublicationSite
    ? compileMydreamshootsVideoTopicPublication(site.pages, site.id as "site_dreamshoot" | "site_grownstride_test")
    : { routes: [], pageEntities: [], pageCopy: [], pageMedia: [], linkRefs: [], navigation: [] };
  const motionLegacyRedirect: PublishedRouteProjection[] = isMydreamshootsPublicationSite && videoTopicPublication.routes.some((route) => route.disposition === "render" && route.canonicalPath === "/ai-video-generation/motion-generator" && route.status === "published")
    ? [{
        disposition: "redirect",
        siteId: site.id as "site_dreamshoot" | "site_grownstride_test",
        routeKind: "legacy-topic-alias",
        aliasPath: "/ai-image-generation/motion-generator",
        targetPath: "/ai-video-generation/motion-generator",
        statusCode: 308,
        indexable: false,
        sitemapEligible: false,
        routeRevision: crypto.createHash("sha256").update(JSON.stringify(["/ai-image-generation/motion-generator", "/ai-video-generation/motion-generator", 308])).digest("hex").slice(0, 20)
      }]
    : [];
  const publishedRoutes: PublishedRouteProjection[] = [...leafRoutes, ...standardContentRoutes, ...policyRoutes, ...videoTopicPublication.routes, ...motionLegacyRedirect];
  const sourcePageEntities = isMydreamshootsPublicationSite
    ? mydreamshootsPublishedPageEntities(site.id as "site_dreamshoot" | "site_grownstride_test")
    : [];
  const imagePublishedPageEntities = sourcePageEntities.map((entity) => {
    const route = leafRoutes.find((candidate) => candidate.pageEntityId === entity.pageEntityId);
    if (!route) return { ...entity, status: "review_required" as const, indexable: false, sitemapEligible: false };
    return {
      ...entity,
      status: route.status,
      indexable: route.indexable,
      sitemapEligible: route.sitemapEligible,
      metadata: {
        ...entity.metadata,
        robots: { index: route.indexable, follow: true }
      },
      reviewReasons: route.reviewReason
        ? Array.from(new Set([...entity.reviewReasons, route.reviewReason]))
        : entity.reviewReasons
    };
  });
  const publishedPageEntities = [...imagePublishedPageEntities, ...standardContentEntities, ...videoTopicPublication.pageEntities];
  const publishedPageCopy = [...imagePublishedPageCopy, ...videoTopicPublication.pageCopy];
  const publishedPageMedia = [...imagePublishedPageMedia, ...videoTopicPublication.pageMedia];
  const publishedVideoNavigation = videoTopicPublication.navigation;
  const publishedPackFacts = creativePacks.map((pack) => ({
    packId: pack.id,
    creditCost: pack.creditCost,
    outputCount: pack.outputCount,
    revision: crypto.createHash("sha256").update(JSON.stringify([pack.id, pack.creditCost, pack.outputCount])).digest("hex").slice(0, 20)
  }));
  const routeRevision = projectionRevision(publishedRoutes);
  const publishedOffers = products.flatMap((product) => product.prices
    .filter((price) => product.status === "active" && price.status === "active" && price.amountCents > 0)
    .filter((price) => Boolean(
      price.stripePriceId && /^price_[a-zA-Z0-9_]+$/.test(price.stripePriceId) &&
      price.currency.toLowerCase() === site.currency.toLowerCase() && price.providerVerifiedAt && price.providerFingerprint &&
      (!price.effectiveFrom || new Date(price.effectiveFrom).getTime() <= publishedAt) &&
      (!price.effectiveTo || new Date(price.effectiveTo).getTime() > publishedAt)
    ))
    .map((price) => ({
      productId: product.id,
      priceId: price.id,
      siteId: product.siteId,
      productName: product.name,
      productType: product.type,
      productMetadata: product.metadata,
      priceLabel: price.label,
      interval: price.interval,
      amountCents: price.amountCents,
      currency: price.currency,
      creditsGranted: price.creditsGranted,
      stripePriceId: price.stripePriceId!,
      priceMetadata: price.metadata,
      checkoutEnabled: Boolean(site.connect?.chargesEnabled && site.connect?.payoutsEnabled),
      revision: crypto.createHash("sha256").update(JSON.stringify([product.id, product.metadata, price])).digest("hex").slice(0, 20)
    })));
  const offerRevision = projectionRevision(publishedOffers);
  const publishedFacts = {
    identity: site.storefrontProfile?.draftJson?.identity ?? site.storefrontProfile?.publishedJson?.identity,
    privacy: {
      customerMediaTraining: site.storefrontProfile?.draftJson?.policyFacts?.usesCustomerMediaForTraining ?? site.storefrontProfile?.publishedJson?.policyFacts?.usesCustomerMediaForTraining,
      sourceMediaRetentionDays: site.storefrontProfile?.draftJson?.policyFacts?.sourceMediaRetentionDays ?? site.storefrontProfile?.publishedJson?.policyFacts?.sourceMediaRetentionDays
    },
    refund: {
      reviewRequired: site.storefrontProfile?.draftJson?.policyFacts?.refundReviewRequired ?? site.storefrontProfile?.publishedJson?.policyFacts?.refundReviewRequired,
      windowDays: site.storefrontProfile?.draftJson?.policyFacts?.refundWindowDays ?? site.storefrontProfile?.publishedJson?.policyFacts?.refundWindowDays,
      effectiveDate: site.storefrontProfile?.draftJson?.policyFacts?.effectiveDate ?? site.storefrontProfile?.publishedJson?.policyFacts?.effectiveDate
    },
    creditLifecycle: site.storefrontProfile?.draftJson?.policyFacts?.creditLifecycle ?? site.storefrontProfile?.publishedJson?.policyFacts?.creditLifecycle,
    security: site.storefrontProfile?.draftJson?.policyFacts?.security ?? site.storefrontProfile?.publishedJson?.policyFacts?.security,
    claimRevision: crypto.createHash("sha256").update(JSON.stringify(site.storefrontProfile?.draftJson ?? site.storefrontProfile?.publishedJson ?? {})).digest("hex").slice(0, 20)
  };
  const factsRevision = projectionRevision(publishedFacts);
  const policyRevision = projectionRevision({ privacy: publishedFacts.privacy, refund: publishedFacts.refund, creditLifecycle: publishedFacts.creditLifecycle, security: publishedFacts.security });
  const publishedCollectionRefs = leafRoutes.map((route) => {
    const entity = publishedPageEntities.find((candidate) => candidate.pageEntityId === route.pageEntityId);
    const media = publishedPageMedia.find((candidate) => candidate.pageEntityId === route.pageEntityId);
    const pack = creativePacks.find((candidate) => candidate.id === route.expectedPackId);
    const entityRevision = crypto.createHash("sha256").update(JSON.stringify([route, entity, media, pack])).digest("hex").slice(0, 20);
    return {
      ownerPageEntityId: route.pageEntityId,
      collectionEntityId: `mydreamshoots:collection:${route.canonicalSlug}`,
      collectionSlug: route.canonicalSlug,
      sourcePackId: route.expectedPackId,
      pageEntityId: route.pageEntityId,
      canonicalPath: route.canonicalPath,
      label: entity?.content.h1 ?? route.canonicalSlug,
      summary: entity?.metadata.description ?? "",
      image: media?.primaryImage ?? "",
      imageAlt: media?.imageAlts[0] ?? "",
      imageMediaEntityId: route.mediaEntityId,
      mediaEntityId: route.mediaEntityId,
      categorySlug: pack?.categoryRecord?.slug ?? pack?.category,
      creditCost: pack?.creditCost ?? 0,
      outputCount: pack?.outputCount ?? 0,
      revision: entityRevision,
      entityRevision,
      status: route.status === "published" && media?.status === "ready" ? "published" as const : "review_required" as const
    };
  });
  const collectionRevision = projectionRevision(publishedCollectionRefs);
  const publishedHomepageShowcases = buildHomepageShowcases({
    site,
    pages: site.pages,
    videoNavigation: publishedVideoNavigation,
    pageEntities: publishedPageEntities,
    pageMedia: publishedPageMedia,
    standardMedia: publishedStandardPageMedia,
    collections: publishedCollectionRefs
  });
  const imagePublishedLinkRefs: NonNullable<ThemePublication["snapshot"]["publishedLinkRefs"]> = imagePublishedPageEntities.flatMap((entity) => {
    if (entity.status !== "published") return [];
    const slug = entity.canonicalPath.match(/^\/ai-image-generation\/([^/?#]+)$/)?.[1];
    const copy = slug ? mydreamshootsPageCopyForRoute({ siteId: site.id, routeKind: "ai-image-theme-leaf", canonicalSlug: slug, canonicalPath: entity.canonicalPath }) : undefined;
    if (!copy) return [];
    const ctaLabel = copy.ctaLabel.trim();
    const ctaHref = copy.ctaHref?.trim() ?? "";
    const privateAction = /^\/app\/create(?:[/?]|$)/.test(ctaHref);
    const ctaTarget = publishedPageEntities.find((page) => page.canonicalPath === ctaHref);
    const cta = ctaLabel && ctaHref.startsWith("/") && (privateAction || ctaTarget)
      ? [privateAction
        ? {
          linkEntityId: publishedLinkEntityId(entity.pageEntityId, "cta"),
          ownerPageEntityId: entity.pageEntityId,
          kind: "cta" as const,
          targetType: "private_action" as const,
          label: ctaLabel,
          href: ctaHref,
          revision: crypto.createHash("sha256").update(JSON.stringify([entity.pageEntityId, "cta", ctaLabel, ctaHref])).digest("hex").slice(0, 20)
        }
        : {
          linkEntityId: publishedLinkEntityId(entity.pageEntityId, "cta"),
          ownerPageEntityId: entity.pageEntityId,
          kind: "cta" as const,
          targetType: "published_render" as const,
          targetPageEntityId: ctaTarget!.pageEntityId,
          label: ctaLabel,
          href: ctaHref,
          revision: crypto.createHash("sha256").update(JSON.stringify([entity.pageEntityId, "cta", ctaLabel, ctaHref])).digest("hex").slice(0, 20)
        }]
      : [];
    const related = (copy.relatedLinks ?? []).flatMap((candidate, index) => {
      const label = candidate.label.trim();
      const href = candidate.href.trim();
      const target = publishedPageEntities.find((page) => page.canonicalPath === href);
      if (!label || !target || target.status !== "published" || !target.indexable || !target.sitemapEligible) return [];
      return [{
        linkEntityId: publishedLinkEntityId(entity.pageEntityId, "related", index),
        ownerPageEntityId: entity.pageEntityId,
        targetPageEntityId: target.pageEntityId,
        targetType: "published_render" as const,
        kind: "related" as const,
        label,
        href,
        revision: crypto.createHash("sha256").update(JSON.stringify([entity.pageEntityId, target.pageEntityId, "related", label, href])).digest("hex").slice(0, 20)
      }];
    });
    entity.content.relatedLinkEntityIds = related.map((item) => item.linkEntityId);
    return [...cta, ...related];
  });
  const standardContentLinkRefs: NonNullable<ThemePublication["snapshot"]["publishedLinkRefs"]> = standardContentEntities.flatMap((entity) => {
    const cta = {
      linkEntityId: entity.content.ctaLinkEntityId,
      ownerPageEntityId: entity.pageEntityId,
      kind: "cta" as const,
      targetType: "private_action" as const,
      label: entity.content.ctaTitle,
      href: "/app/create",
      revision: crypto.createHash("sha256").update(JSON.stringify([entity.pageEntityId, "cta", "/app/create"])).digest("hex").slice(0, 20)
    };
    const sourcePage = standardContentPages.find(({ route }) => route.pageEntityId === entity.pageEntityId)?.page;
    const relatedLinks = sourcePage?.publishedJson.relatedLinks?.length
      ? sourcePage.publishedJson.relatedLinks
      : [{ label: "How it works", href: "/workflow" }, { label: "Best Packages", href: "/best-packages" }];
    const targets = relatedLinks.map((candidate, index) => {
      const href = candidate.href.trim();
      const label = candidate.label.trim();
      const target = standardContentEntities.find((candidate) => candidate.canonicalPath === href);
      return target ? {
        linkEntityId: `${entity.pageEntityId}:link:related:${index + 1}`,
        ownerPageEntityId: entity.pageEntityId,
        targetPageEntityId: target.pageEntityId,
        targetType: "published_render" as const,
        kind: "related" as const,
        label,
        href,
        revision: crypto.createHash("sha256").update(JSON.stringify([entity.pageEntityId, target.pageEntityId, href])).digest("hex").slice(0, 20)
      } : undefined;
    }).filter(Boolean);
    return [cta, ...targets] as NonNullable<ThemePublication["snapshot"]["publishedLinkRefs"]>;
  });
  const publishedLinkRefs = [...imagePublishedLinkRefs, ...standardContentLinkRefs, ...videoTopicPublication.linkRefs];
  const pageRevision = projectionRevision(publishedPageEntities);
  const copyRevision = projectionRevision(publishedPageCopy);
  const mediaRevision = projectionRevision({ leaf: publishedPageMedia, standard: publishedStandardPageMedia });
  const packRevision = projectionRevision(publishedPackFacts);
  const linkRevision = projectionRevision(publishedLinkRefs);
  const navigationRevision = projectionRevision(publishedVideoNavigation);
  const homepageShowcaseRevision = projectionRevision(publishedHomepageShowcases);
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "local";
  const snapshot: PublishedSeoSnapshot = {
    seoProjectionVersion: 1,
    pages: [...site.pages
      .filter((page) => !isMydreamshootsPublicationSite || !new Set(policyRouteSpecs.flatMap((spec) => [spec.canonicalPath, ...spec.aliases])).has(page.slug)),
      ...publishedPolicyPages]
      .map((page) => ({
      id: page.id,
      siteId: page.siteId,
      pageType: page.pageType,
      templateKey: page.templateKey,
      slug: page.slug,
      title: page.title,
      publishedJson: cloneJson(page.draftJson ?? page.publishedJson),
      createdAt: page.createdAt,
      updatedAt: page.updatedAt
      })),
    themeSettings: cloneJson(site.themeSettings.draftJson ?? site.themeSettings.publishedJson),
    storefrontProfile: (site.storefrontProfile?.draftJson ?? site.storefrontProfile?.publishedJson)
      ? cloneJson(site.storefrontProfile.draftJson ?? site.storefrontProfile.publishedJson)
      : undefined,
    saasTheme: siteTheme
      ? {
          name: siteTheme.name,
          themeId: siteTheme.themeId,
          themeKey: siteTheme.themeKey,
          status: siteTheme.status,
          templates: cloneJson(siteTheme.templates),
          settings: cloneJson(siteTheme.settings),
          updatedAt: siteTheme.updatedAt
        }
      : undefined,
    publishedRoutes,
    publishedPageEntities,
    publishedPageCopy,
    publishedPageMedia,
    publishedStandardPageMedia,
    publishedPackFacts,
    publishedOffers,
    publishedFacts,
    publishedCollectionRefs,
    publishedLinkRefs,
    publishedVideoNavigation,
    publishedHomepageShowcases,
    revisions: {
      factsRevision,
      routeRevision,
      pageRevision,
      copyRevision,
      mediaRevision,
      packRevision,
      offerRevision,
      collectionRevision,
      policyRevision,
      linkRevision,
      navigationRevision,
      homepageShowcaseRevision,
      snapshotHash: ""
    },
    snapshotHash: "",
    buildId
  };
  const snapshotHash = publicationSnapshotHash(snapshot);
  return {
    ...snapshot,
    snapshotHash,
    revisions: { ...snapshot.revisions, snapshotHash }
  };
}

function buildPublicationSnapshotStats(snapshot: ThemePublication["snapshot"]) {
  const pageCount = snapshot.pages.length;
  const sectionCount = snapshot.pages.reduce((sum, page) => sum + (page.publishedJson.sectionsOrder?.length ?? 0), 0);
  const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");
  return { pageCount, sectionCount, snapshotBytes };
}

type ImmutablePublicationScope = {
  type: "page" | "site";
  pageIds: string[];
  includeThemeSettings: boolean;
  includeStorefrontProfile: boolean;
};

async function createAndActivateImmutablePublication(
  tx: Prisma.TransactionClient,
  params: {
    siteId: string;
    version: number;
    snapshot: PublishedSeoSnapshot;
    actor: string;
    scope: ImmutablePublicationScope;
    manifestHash?: string;
  }
) {
  if (publicationSnapshotIntegrity(params.snapshot) !== "valid") {
    throw new RelationalStoreError("theme_publish_snapshot_integrity_failed", 409);
  }
  const stats = buildPublicationSnapshotStats(params.snapshot);
  const publicationRecord = await tx.themePublication.create({
    data: {
      id: `pub_${params.siteId}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
      siteId: params.siteId,
      version: params.version,
      snapshot: params.snapshot as unknown as Prisma.InputJsonValue,
      pageCount: stats.pageCount,
      sectionCount: stats.sectionCount,
      snapshotBytes: stats.snapshotBytes,
      publishedBy: params.actor,
      scope: params.scope as unknown as Prisma.InputJsonValue,
      manifestHash: params.manifestHash,
      factsRevision: params.snapshot.revisions.factsRevision
    } as unknown as Prisma.ThemePublicationUncheckedCreateInput
  });
  await tx.activeThemePublication.upsert({
    where: { siteId: params.siteId },
    create: { siteId: params.siteId, publicationId: publicationRecord.id, activatedBy: params.actor },
    update: { publicationId: publicationRecord.id, activatedAt: new Date(), activatedBy: params.actor }
  });
  return publicationRecord;
}

export async function publishSeoSnapshotRelational(params: {
  siteId: string;
  snapshot: PublishedSeoSnapshot;
  actor?: string;
  scope?: ImmutablePublicationScope;
}): Promise<{ publication: ThemePublication; publishedVersion: number }> {
  const actor = params.actor ?? "site_admin_demo";
  const scope = params.scope ?? { type: "site", pageIds: [], includeThemeSettings: true, includeStorefrontProfile: true };
  const result = await prisma.$transaction(async (tx) => {
    const latest = await tx.themePublication.findFirst({ where: { siteId: params.siteId }, orderBy: [{ version: "desc" }, { publishedAt: "desc" }], select: { version: true } });
    const publishedVersion = (latest?.version ?? 0) + 1;
    const publicationRecord = await createAndActivateImmutablePublication(tx, {
      siteId: params.siteId,
      version: publishedVersion,
      snapshot: params.snapshot,
      actor,
      scope
    });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "seo_snapshot_published",
      targetType: "theme_publication",
      targetId: publicationRecord.id,
      metadata: { version: publishedVersion, snapshotHash: params.snapshot.snapshotHash }
    }, { syncPlatformState: false });
    return { publication: toThemePublication(publicationRecord), publishedVersion };
  }, { timeout: 600_000, maxWait: 20_000 });
  await finalizePublishedTheme(params.siteId, result.publication.id);
  return result;
}

function normalizedPublishPack(pack: PublishPreflightCreativePack): PublishPreflightCreativePack {
  return {
    id: pack.id,
    status: pack.status,
    creditCost: pack.creditCost,
    outputCount: pack.outputCount,
    category: pack.category,
    categoryRecord: pack.categoryRecord?.slug ? { slug: pack.categoryRecord.slug } : null,
    imageUrl: pack.imageUrl ?? null,
    galleryImages: Array.isArray(pack.galleryImages) ? pack.galleryImages.filter((value): value is string => typeof value === "string") : [],
    galleryImageAlts: Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts.filter((value): value is string => typeof value === "string") : []
  };
}

function activeThemeFromDraft(siteId: string, draftTheme: SiteTheme | undefined, actor: string): SiteTheme {
  const now = new Date().toISOString();
  return {
    id: `theme_${siteId}_active`,
    siteId,
    name: draftTheme?.name ?? "Active theme",
    themeId: draftTheme?.themeId ?? `${siteId}_active`,
    themeKey: draftTheme?.themeKey ?? "theme1",
    status: "active",
    templates: cloneJson(draftTheme?.templates ?? {}),
    settings: cloneJson(draftTheme?.settings ?? {}),
    source: draftTheme?.source ?? "site",
    createdBy: draftTheme?.createdBy ?? actor,
    createdAt: draftTheme?.createdAt ?? now,
    updatedAt: now
  };
}

function readString(value: ThemeSettingValue | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const family = value.family;
    if (typeof family === "string") return family;
  }
  return undefined;
}

function pageTypeToSaasTemplateName(pageType: string): string {
  const mapped: Record<string, string> = {
    home: "index",
    pricing: "page",
    tool: "product",
    account: "account",
    legal: "privacy",
    blog: "blog",
    search: "search"
  };
  return mapped[pageType] ?? pageType;
}

function pageSaasTemplateKey(page: Pick<ThemePage, "pageType" | "templateKey">): string {
  return page.templateKey?.trim() || pageTypeToSaasTemplateName(page.pageType);
}

function mapInternalTemplateKey(templateKey: string): ThemePackageTemplateKey {
  const mapped: Record<string, ThemePackageTemplateKey> = {
    index: "home",
    page: "pricing",
    collection: "packages",
    product: "tool-detail",
    help: "help",
    blog: "blog-list",
    privacy: "policy",
    refunds: "policy",
    content: "policy",
    search: "search",
    account: "app-home"
  };
  return mapped[templateKey] ?? "home";
}

function applyInternalThemePackageSiteSettings(base: ThemeSettings, siteSettings?: ThemePackageSiteSettings): ThemeSettings {
  const next = cloneJson(base);
  const themeSettings = siteSettings?.themeSettings;
  if (!themeSettings) return next;
  if (themeSettings.colors) next.colors = { ...next.colors, ...themeSettings.colors };
  if (themeSettings.typography) next.typography = { ...next.typography, ...themeSettings.typography };
  if (themeSettings.radii) next.radii = { ...next.radii, ...themeSettings.radii };
  if (themeSettings.navigation) next.navigation = { ...next.navigation, ...themeSettings.navigation };
  if (themeSettings.seo) {
    next.seo = {
      siteTitle: themeSettings.seo.siteTitle ?? next.seo?.siteTitle ?? "",
      siteDescription: themeSettings.seo.siteDescription ?? next.seo?.siteDescription ?? "",
      siteKeywords: themeSettings.seo.siteKeywords ?? next.seo?.siteKeywords,
      titleTemplate: themeSettings.seo.titleTemplate ?? next.seo?.titleTemplate ?? "%s",
      defaultOgImage: themeSettings.seo.defaultOgImage ?? next.seo?.defaultOgImage,
      robots: next.seo?.robots ?? { index: true, follow: true }
    };
  }
  return next;
}

function themeScopedSectionSchema(sectionType: string, themeKey?: string): ThemeSectionSchema {
  const scoped = getImportedSaasSectionSchemasForTheme(themeKey ?? "theme1")[sectionType];
  return scoped ?? getSectionSchema(sectionType);
}

function defaultBlock(blockSchema: ThemeBlockSchema, index = 1): SectionBlockInstance {
  return {
    id: `${blockSchema.type}_${Date.now().toString(36)}_${index}`,
    type: blockSchema.type,
    settings: cloneJson(blockSchema.preset?.settings ?? Object.fromEntries(blockSchema.settings.map((field) => [field.id, field.default ?? ""])))
  };
}

function xfcartDefaultSection(sectionType: string, section?: SectionInstance, themeKey?: string): SectionInstance {
  if (section) return cloneJson(section);
  const schema = themeScopedSectionSchema(sectionType, themeKey);
  const preset = schema.presets?.[0];
  return {
    type: sectionType,
    settings: cloneJson(preset?.settings ?? Object.fromEntries(schema.settings.filter((field) => !field.id.startsWith("__")).map((field) => [field.id, field.default ?? ""]))),
    blocks: cloneJson(preset?.blocks ?? [])
  };
}

function xfcartDefaultBlock(section: SectionInstance, blockTypeOrPresetIndex: string, block?: SectionBlockInstance, themeKey?: string): SectionBlockInstance {
  if (block) return cloneJson(block);
  const sectionSchema = themeScopedSectionSchema(section.type, themeKey);
  const presetIndex = Number(blockTypeOrPresetIndex);
  const presetBlock = Number.isInteger(presetIndex) && presetIndex > 0 ? sectionSchema.presets?.[0]?.blocks?.[presetIndex - 1] : undefined;
  if (presetBlock) return cloneJson(presetBlock);
  const blockSchema = sectionSchema.blocks?.find((item) => item.type === blockTypeOrPresetIndex) ?? sectionSchema.blocks?.[0];
  if (!blockSchema) throw new RelationalStoreError("theme_block_schema_not_found", 404);
  return defaultBlock(blockSchema, section.blocks?.length ?? 0);
}

function requireGlobalSection(site: Site, globalType: "header" | "footer") {
  site.themeSettings.draftJson.globalSections ??= {};
  site.themeSettings.draftJson.globalSections[globalType] = normalizeGlobalSection(
    globalType,
    site.themeSettings.draftJson.globalSections[globalType]
  );
  return site.themeSettings.draftJson.globalSections[globalType];
}

function syncSaasGlobalSetting(site: Site, name: string, value: ThemeSettingValue, themeKey = "theme1") {
  site.themeSettings.draftJson.saasSettingsCurrent = normalizeSaasSettingsCurrentForTheme(themeKey, site.themeSettings.draftJson.saasSettingsCurrent);
  site.themeSettings.draftJson.saasSettingsCurrent[name] = value;
  const stringValue = readString(value);
  if (!stringValue) return;
  if (name === "skin_bg") site.themeSettings.draftJson.colors.background = stringValue;
  if (name === "skin_title_color") site.themeSettings.draftJson.colors.foreground = stringValue;
  if (name === "skin_price_color" || name === "skin_primary_btn_bg_color") site.themeSettings.draftJson.colors.accent = stringValue;
  if (name === "skin_muted_color") site.themeSettings.draftJson.colors.muted = stringValue;
  if (name === "skin_title_font_family") site.themeSettings.draftJson.typography.display = stringValue;
  if (name === "skin_text_font_family") site.themeSettings.draftJson.typography.body = stringValue;
}

function normalizeThemeScopedSettings(site: Site, themeKey: string, shouldResetDefaults = false) {
  site.themeSettings.draftJson.saasSettingsCurrent = shouldResetDefaults
    ? resetSaasSettingsCurrentForTheme(themeKey, site.themeSettings.draftJson.saasSettingsCurrent)
    : normalizeSaasSettingsCurrentForTheme(themeKey, site.themeSettings.draftJson.saasSettingsCurrent);
}

function syncSiteFromThemeRecord(site: Site, theme: SaasThemeRecord, mode: "draft" | "published") {
  const fallbackSettings = mode === "draft" ? site.themeSettings.draftJson : site.themeSettings.publishedJson;
  const themeSettings = fromSaasSettings(theme.settings, fallbackSettings, theme.themeKey);
  if (mode === "draft") site.themeSettings.draftJson = themeSettings;
  else site.themeSettings.publishedJson = themeSettings;

  for (const page of site.pages) {
    const templateName = pageSaasTemplateKey(page);
    const template = theme.templates[templateName] ?? theme.templates[page.pageType];
    if (!template) continue;
    const version = mode === "draft" ? page.draftJson.version : page.publishedJson.version;
    const pageJson = fromSaasTemplate(template, page.pageType, version);
    if (mode === "draft") page.draftJson = pageJson;
    else page.publishedJson = pageJson;
  }
}

function themeKeyFromAction(action: SaasThemeAction): string {
  return action.themeKey?.trim() || "theme1";
}

function themeKeyFromXfcartPayload(payload: XfcartThemeEditPayload, editedTheme?: SiteTheme): string {
  return payload.themeKey?.trim() || payload.theme_key?.trim() || editedTheme?.themeKey || "theme1";
}

function pageFromXfcartIdentifier(site: Site, pageIdentifier?: string): ThemePage | undefined {
  const identifier = pageIdentifier || "index";
  const matched = site.pages.find(
    (item) => item.id === identifier || item.slug === identifier || item.pageType === identifier || pageSaasTemplateKey(item) === identifier
  );
  const templateName = matched ? pageSaasTemplateKey(matched) : identifier;
  return site.pages.find((page) => pageSaasTemplateKey(page) === templateName || page.pageType === pageIdentifier || page.id === pageIdentifier || page.slug === pageIdentifier);
}

function parseXfcartSort(value: ThemeSettingValue | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => readString(item) ?? "").filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseXfcartIndex(value: string | number | undefined): number {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric - 1 : -1;
}

function normalizeXfcartValue(value: ThemeSettingValue | undefined): ThemeSettingValue | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function reorderXfcartBlocks(blocks: SectionBlockInstance[], sort: string[]): SectionBlockInstance[] {
  const byIndex = sort.map((item) => Number(item) - 1).filter((item) => Number.isInteger(item) && item >= 0);
  if (byIndex.length) return byIndex.map((item) => blocks[item]).filter((block): block is SectionBlockInstance => Boolean(block));
  const byId = new Map(blocks.map((block) => [block.id, block]));
  return sort.map((id) => byId.get(id)).filter((block): block is SectionBlockInstance => Boolean(block));
}

async function persistDraftThemeState(
  tx: PrismaLike,
  site: Site,
  themeKey: string,
  actor: string,
  existingDraft?: SiteTheme
): Promise<SiteTheme> {
  const record = buildSaasThemeDraft(site, themeKey);
  const existing =
    existingDraft ??
    (await tx.siteTheme.findFirst({ where: { siteId: site.id, status: "draft" }, orderBy: { updatedAt: "desc" } }).then((row) => (row ? toSiteTheme(row) : undefined)));
  const data = {
    name: existing?.name ?? record.name,
    themeKey,
    status: "draft",
    templates: cloneJson(record.templates) as unknown as Prisma.InputJsonValue,
    settings: cloneJson(record.settings) as unknown as Prisma.InputJsonValue,
    source: existing?.source ?? "site",
    createdBy: existing?.createdBy ?? actor
  };
  const row = existing
    ? await tx.siteTheme.update({ where: { id: existing.id }, data })
    : await tx.siteTheme.create({
        data: {
          id: uid("site_theme"),
          siteId: site.id,
          themeId: record.themeId,
          ...data
        }
      });
  return toSiteTheme(row);
}

async function persistSiteDraft(tx: PrismaLike, site: Site) {
  const nextSettings = {
    ...site.themeSettings,
    draftMeta: makeThemeDraftMeta(site.themeSettings)
  };
  await tx.themeSettings.upsert({
    where: { siteId: site.id },
    create: {
      id: `settings_${site.id}`,
      siteId: site.id,
      draftJson: themeSettingsDraftJsonWithMeta(nextSettings),
      publishedJson: cloneJson(site.themeSettings.publishedJson) as unknown as Prisma.InputJsonValue
    },
    update: { draftJson: themeSettingsDraftJsonWithMeta(nextSettings) }
  });
  for (const page of site.pages) {
    page.draftMeta = makeThemeDraftMeta(page);
    await tx.themePage.update({
      where: { id: page.id },
      data: { draftJson: draftJsonWithMeta(page) }
    });
  }
}

export async function getSiteThemeStateRelational(siteId: string): Promise<ThemeState> {
  return themeReadCache.get(`theme-state:${siteId}`, () => loadSiteThemeStateRelational(siteId));
}

export async function getSiteThemeSiteRelational(siteId: string): Promise<Site> {
  return themeReadCache.get(`theme-site:${siteId}`, async () => toSite(await getSiteWithThemeRecords(prisma, siteId)));
}

async function loadSiteThemeStateRelational(siteId: string): Promise<ThemeState> {
  const [siteRecord, mediaAssets, publications, siteThemes, themeCopies] = await Promise.all([
    getSiteWithThemeRecords(prisma, siteId),
    prisma.mediaAsset.findMany({ where: { siteId }, orderBy: { createdAt: "desc" } }),
    prisma.themePublication.findMany({ where: { siteId }, orderBy: [{ version: "desc" }, { publishedAt: "desc" }] }),
    prisma.siteTheme.findMany({ where: { siteId }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] }),
    prisma.themeCopy.findMany({ where: { siteId }, orderBy: { updatedAt: "desc" } })
  ]);
  return {
    site: toSite(siteRecord),
    mediaAssets: mediaAssets.map(toMediaAsset),
    publications: publications.map(toThemePublication),
    siteThemes: siteThemes.map(toSiteTheme),
    themeCopies: themeCopies.map(toThemeCopy)
  };
}

function themeRecordFromSiteTheme(record: SiteTheme): SaasThemeRecord {
  return {
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status,
    templates: cloneJson(record.templates) as SaasThemeRecord["templates"],
    settings: cloneJson(record.settings) as SaasThemeRecord["settings"],
    updatedAt: record.updatedAt
  };
}

export type ThemeRecordStats = {
  templateCount: number;
  sectionCount: number;
  blockCount: number;
  templateNames: string[];
  settingsFieldCount: number;
  settingsGlobalSections: string[];
  hasSettingsData: boolean;
};

export type SaasThemeRecordSummary = Omit<SaasThemeRecord, "templates" | "settings"> & {
  templates?: undefined;
  settings?: undefined;
  stats: ThemeRecordStats;
};

export type SiteThemeSummaryRecord = Omit<SiteTheme, "templates" | "settings"> & {
  templates?: undefined;
  settings?: undefined;
  stats: ThemeRecordStats;
};

export type ThemeCopySummaryRecord = Omit<ThemeCopy, "templates" | "settings"> & {
  templates?: undefined;
  settings?: undefined;
  stats: ThemeRecordStats;
};

type SiteThemeSummaryRow = {
  id: string;
  siteId: string;
  name: string;
  themeId: string;
  themeKey: string;
  status: string;
  templates: unknown;
  settings: unknown;
  source: string;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ThemeStatsSummaryRow = {
  templateCount: bigint | number | string | null;
  sectionCount: bigint | number | string | null;
  blockCount: bigint | number | string | null;
  templateNames: unknown;
  settingsFieldCount: bigint | number | string | null;
  settingsGlobalSections: unknown;
  hasSettingsData: boolean | null;
};

type SiteThemeStatsSummaryRow = Omit<SiteThemeSummaryRow, "templates" | "settings"> & ThemeStatsSummaryRow;

type ThemeCopySummaryRow = {
  id: string;
  siteId: string;
  name: string;
  themeKey: string;
  source: string;
  templates: unknown;
  settings: unknown;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ThemeCopyStatsSummaryRow = Omit<ThemeCopySummaryRow, "templates" | "settings"> & ThemeStatsSummaryRow;

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function getTemplateStats(templates: unknown) {
  if (!templates || typeof templates !== "object" || Array.isArray(templates)) {
    return { templateCount: 0, sectionCount: 0, blockCount: 0, templateNames: [] as string[] };
  }
  const entries = Object.entries(templates as Record<string, { sections?: unknown }>);
  let sectionCount = 0;
  let blockCount = 0;
  for (const [, template] of entries) {
    const sections = template?.sections && typeof template.sections === "object" ? (template.sections as Record<string, unknown>) : {};
    sectionCount += Object.keys(sections).length;
    for (const section of Object.values(sections)) {
      const blocks = section && typeof section === "object" ? (section as { blocks?: unknown }).blocks : undefined;
      blockCount += Array.isArray(blocks) ? blocks.length : 0;
    }
  }
  return { templateCount: entries.length, sectionCount, blockCount, templateNames: entries.map(([name]) => name) };
}

function getSettingsStats(settings: unknown) {
  const current =
    settings && typeof settings === "object" && "settings_data" in settings
      ? (settings as { settings_data?: { current?: Record<string, unknown> } }).settings_data?.current
      : undefined;
  const sections = current?.sections && typeof current.sections === "object" ? (current.sections as Record<string, unknown>) : {};
  const settingsFieldCount = current ? Object.keys(current).filter((key) => key !== "sections").length : 0;
  return {
    settingsFieldCount,
    settingsGlobalSections: Object.keys(sections),
    hasSettingsData: Boolean(current)
  };
}

function getThemeRecordStats(templates: unknown, settings: unknown): ThemeRecordStats {
  return {
    ...getTemplateStats(templates),
    ...getSettingsStats(settings)
  };
}

function numberFromDb(value: bigint | number | string | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

function stringArrayFromDb(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getThemeRecordStatsFromSummaryRow(record: ThemeStatsSummaryRow): ThemeRecordStats {
  return {
    templateCount: numberFromDb(record.templateCount),
    sectionCount: numberFromDb(record.sectionCount),
    blockCount: numberFromDb(record.blockCount),
    templateNames: stringArrayFromDb(record.templateNames),
    settingsFieldCount: numberFromDb(record.settingsFieldCount),
    settingsGlobalSections: stringArrayFromDb(record.settingsGlobalSections),
    hasSettingsData: Boolean(record.hasSettingsData)
  };
}

function _toSiteThemeSummary(record: SiteThemeSummaryRow): SiteThemeSummaryRecord {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status as SiteTheme["status"],
    source: record.source as SiteTheme["source"],
    createdBy: record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStats(record.templates, record.settings)
  };
}

function toSiteThemeStatsSummary(record: SiteThemeStatsSummaryRow): SiteThemeSummaryRecord {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status as SiteTheme["status"],
    source: record.source as SiteTheme["source"],
    createdBy: record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStatsFromSummaryRow(record)
  };
}

function _toThemeCopySummary(record: ThemeCopySummaryRow): ThemeCopySummaryRecord {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    themeKey: record.themeKey,
    source: record.source as ThemeCopy["source"],
    createdBy: record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStats(record.templates, record.settings)
  };
}

function toThemeCopyStatsSummary(record: ThemeCopyStatsSummaryRow): ThemeCopySummaryRecord {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    themeKey: record.themeKey,
    source: record.source as ThemeCopy["source"],
    createdBy: record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStatsFromSummaryRow(record)
  };
}

function _saasRecordSummaryFromSiteTheme(record: SiteThemeSummaryRow): SaasThemeRecordSummary {
  return {
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status as SaasThemeRecord["status"],
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStats(record.templates, record.settings)
  };
}

function saasRecordSummaryFromSiteThemeStats(record: SiteThemeStatsSummaryRow): SaasThemeRecordSummary {
  return {
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status as SaasThemeRecord["status"],
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStatsFromSummaryRow(record)
  };
}

function saasRecordSummaryFromFull(record: SaasThemeRecord): SaasThemeRecordSummary {
  return {
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status,
    updatedAt: record.updatedAt,
    stats: getThemeRecordStats(record.templates, record.settings)
  };
}

export async function getSiteSaasThemeRecordsRelational(siteId: string) {
  const state = await getSiteThemeStateRelational(siteId);
  const latestPublication = state.publications[0];
  const draft = state.siteThemes.find((theme) => theme.status === "draft");
  const active = state.siteThemes.find((theme) => theme.status === "active");
  const activeTheme =
    (active ? themeRecordFromSiteTheme(active) : undefined) ??
    (latestPublication?.snapshot.saasTheme as SaasThemeRecord | undefined) ??
    buildSaasThemePublication(state.site, latestPublication?.version ?? state.site.pages[0]?.publishedJson.version ?? 1).theme;
  const activeUpdatedAt = active?.updatedAt ?? latestPublication?.publishedAt ?? activeTheme.updatedAt;
  return {
    site: state.site,
    draft: draft ? themeRecordFromSiteTheme(draft) : buildSaasThemeDraft(state.site),
    active: {
      ...activeTheme,
      status: "active" as const,
      themeId: activeTheme.themeId || `${state.site.id}_active_v${latestPublication?.version ?? 1}`,
      updatedAt: activeUpdatedAt
    },
    themes: state.siteThemes,
    publications: state.publications,
    copies: state.themeCopies
  };
}

export async function getSiteSaasThemeRecordsSummaryRelational(siteId: string) {
  return themeReadCache.get(`theme-record-summary:${siteId}`, async () => {
    const [siteThemes, themeCopies, publications] = await Promise.all([
      prisma.$queryRaw<SiteThemeStatsSummaryRow[]>`
        SELECT
          "id",
          "siteId",
          "name",
          "themeId",
          "themeKey",
          "status",
          "source",
          "createdBy",
          "createdAt",
          "updatedAt",
          COALESCE((SELECT COUNT(*) FROM jsonb_each("templates"::jsonb)), 0) AS "templateCount",
          COALESCE((
            SELECT SUM((SELECT COUNT(*) FROM jsonb_each(COALESCE(template -> 'sections', '{}'::jsonb))))
            FROM jsonb_each("templates"::jsonb) AS templates(name, template)
          ), 0) AS "sectionCount",
          COALESCE((
            SELECT SUM(jsonb_array_length(COALESCE(section -> 'blocks', '[]'::jsonb)))
            FROM jsonb_each("templates"::jsonb) AS templates(name, template)
            CROSS JOIN jsonb_each(COALESCE(template -> 'sections', '{}'::jsonb)) AS sections(name, section)
          ), 0) AS "blockCount",
          COALESCE((
            SELECT jsonb_agg(name ORDER BY name)
            FROM jsonb_object_keys("templates"::jsonb) AS name
          ), '[]'::jsonb) AS "templateNames",
          CASE
            WHEN "settings"::jsonb ? 'settings_data'
              AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current') = 'object'
            THEN GREATEST(
              (SELECT COUNT(*) FROM jsonb_object_keys("settings"::jsonb -> 'settings_data' -> 'current')) -
                CASE WHEN "settings"::jsonb -> 'settings_data' -> 'current' ? 'sections' THEN 1 ELSE 0 END,
              0
            )
            ELSE 0
          END AS "settingsFieldCount",
          CASE
            WHEN "settings"::jsonb ? 'settings_data'
              AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current' -> 'sections') = 'object'
            THEN (
              SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb)
              FROM jsonb_object_keys("settings"::jsonb -> 'settings_data' -> 'current' -> 'sections') AS name
            )
            ELSE '[]'::jsonb
          END AS "settingsGlobalSections",
          ("settings"::jsonb ? 'settings_data'
            AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current') = 'object') AS "hasSettingsData"
        FROM "SiteTheme"
        WHERE "siteId" = ${siteId}
        ORDER BY "status" ASC, "updatedAt" DESC
      `,
      prisma.$queryRaw<ThemeCopyStatsSummaryRow[]>`
        SELECT
          "id",
          "siteId",
          "name",
          "themeKey",
          "source",
          "createdBy",
          "createdAt",
          "updatedAt",
          COALESCE((SELECT COUNT(*) FROM jsonb_each("templates"::jsonb)), 0) AS "templateCount",
          COALESCE((
            SELECT SUM((SELECT COUNT(*) FROM jsonb_each(COALESCE(template -> 'sections', '{}'::jsonb))))
            FROM jsonb_each("templates"::jsonb) AS templates(name, template)
          ), 0) AS "sectionCount",
          COALESCE((
            SELECT SUM(jsonb_array_length(COALESCE(section -> 'blocks', '[]'::jsonb)))
            FROM jsonb_each("templates"::jsonb) AS templates(name, template)
            CROSS JOIN jsonb_each(COALESCE(template -> 'sections', '{}'::jsonb)) AS sections(name, section)
          ), 0) AS "blockCount",
          COALESCE((
            SELECT jsonb_agg(name ORDER BY name)
            FROM jsonb_object_keys("templates"::jsonb) AS name
          ), '[]'::jsonb) AS "templateNames",
          CASE
            WHEN "settings"::jsonb ? 'settings_data'
              AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current') = 'object'
            THEN GREATEST(
              (SELECT COUNT(*) FROM jsonb_object_keys("settings"::jsonb -> 'settings_data' -> 'current')) -
                CASE WHEN "settings"::jsonb -> 'settings_data' -> 'current' ? 'sections' THEN 1 ELSE 0 END,
              0
            )
            ELSE 0
          END AS "settingsFieldCount",
          CASE
            WHEN "settings"::jsonb ? 'settings_data'
              AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current' -> 'sections') = 'object'
            THEN (
              SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb)
              FROM jsonb_object_keys("settings"::jsonb -> 'settings_data' -> 'current' -> 'sections') AS name
            )
            ELSE '[]'::jsonb
          END AS "settingsGlobalSections",
          ("settings"::jsonb ? 'settings_data'
            AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current') = 'object') AS "hasSettingsData"
        FROM "ThemeCopy"
        WHERE "siteId" = ${siteId}
        ORDER BY "updatedAt" DESC
      `,
      getSiteThemePublicationMetaRelational(siteId)
    ]);

    let fallbackSite: Site | undefined;
    async function getFallbackSite() {
      if (!fallbackSite) fallbackSite = toSite(await getSiteWithThemeRecords(prisma, siteId));
      return fallbackSite;
    }

    const latestPublication = publications[0];
    const draftRow = siteThemes.find((theme) => theme.status === "draft");
    const activeRow = siteThemes.find((theme) => theme.status === "active");
    const draft = draftRow
      ? saasRecordSummaryFromSiteThemeStats(draftRow)
      : saasRecordSummaryFromFull(buildSaasThemeDraft(await getFallbackSite()));
    const active = activeRow
      ? { ...saasRecordSummaryFromSiteThemeStats(activeRow), status: "active" as const }
      : {
          ...saasRecordSummaryFromFull(buildSaasThemePublication(await getFallbackSite(), latestPublication?.version ?? 1).theme),
          status: "active" as const,
          updatedAt: latestPublication?.publishedAt ?? new Date().toISOString()
        };

    return {
      site: fallbackSite,
      draft,
      active,
      themes: siteThemes.map(toSiteThemeStatsSummary),
      copies: themeCopies.map(toThemeCopyStatsSummary),
      publications
    };
  });
}

export async function getSiteSaasThemeLabelsRelational(siteId: string) {
  return themeReadCache.get(`theme-labels:${siteId}`, async () => {
    const rows = await prisma.siteTheme.findMany({
      where: { siteId, status: { in: ["active", "draft"] } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: {
        name: true,
        themeKey: true,
        status: true,
        updatedAt: true
      }
    });
    const active = rows.find((row) => row.status === "active");
    const draft = rows.find((row) => row.status === "draft");
    return {
      active: active
        ? { name: active.name, themeKey: active.themeKey, updatedAt: active.updatedAt.toISOString() }
        : undefined,
      draft: draft
        ? { name: draft.name, themeKey: draft.themeKey, updatedAt: draft.updatedAt.toISOString() }
        : undefined
    };
  });
}

export async function getSiteThemePublicationCountRelational(siteId: string): Promise<number> {
  return themeReadCache.get(`publication-count:${siteId}`, () => prisma.themePublication.count({ where: { siteId } }));
}

export type SiteThemePublicationMeta = {
  id: string;
  version: number;
  publishedAt: string;
  publishedBy: string;
  pageCount: number;
  sectionCount: number;
  snapshotBytes: number;
  visualSummary: Record<string, string>;
};

export async function getSiteThemePublicationMetaRelational(siteId: string): Promise<SiteThemePublicationMeta[]> {
  return themeReadCache.get(`publication-meta:${siteId}`, async () => {
    type PublicationMetaRow = {
      id: string;
      version: number;
      publishedAt: Date | string;
      publishedBy: string;
      snapshot: ThemePublication["snapshot"];
      pageCount: bigint | number | string | null;
      sectionCount: bigint | number | string | null;
      snapshotBytes: bigint | number | string | null;
    };
    const rows = await prisma.$queryRaw<PublicationMetaRow[]>`
      SELECT
        "id",
        "version",
        "publishedAt",
        "publishedBy",
        "snapshot",
        COALESCE("pageCount", jsonb_array_length("snapshot"::jsonb -> 'pages'), 0) AS "pageCount",
        COALESCE("sectionCount", (
          SELECT SUM(jsonb_array_length(COALESCE(page -> 'publishedJson' -> 'sectionsOrder', '[]'::jsonb)))
          FROM jsonb_array_elements(COALESCE("snapshot"::jsonb -> 'pages', '[]'::jsonb)) AS page
        ), 0) AS "sectionCount",
        COALESCE("snapshotBytes", octet_length("snapshot"::text), 0) AS "snapshotBytes"
      FROM "ThemePublication"
      WHERE "siteId" = ${siteId}
      ORDER BY "version" DESC, "publishedAt" DESC
    `;
    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      publishedAt: row.publishedAt instanceof Date ? row.publishedAt.toISOString() : String(row.publishedAt),
      publishedBy: row.publishedBy,
      pageCount: typeof row.pageCount === "bigint" ? Number(row.pageCount) : Number(row.pageCount ?? 0),
      sectionCount: typeof row.sectionCount === "bigint" ? Number(row.sectionCount) : Number(row.sectionCount ?? 0),
      snapshotBytes: typeof row.snapshotBytes === "bigint" ? Number(row.snapshotBytes) : Number(row.snapshotBytes ?? 0),
      visualSummary: summarizeThemeGlobalVisuals(row.snapshot.themeSettings)
    }));
  });
}

export async function saveThemePageDraftRelational(params: {
  siteId: string;
  pageId: string;
  draftJson: ThemePage["draftJson"];
  title?: string;
  actor?: string;
  expected?: { expectedRevision?: number; expectedEtag?: string };
}): Promise<{ draftVersion: ThemeDraftMeta }> {
  clearSiteThemeReadCache(params.siteId);
  const pageRecord = await prisma.themePage.findFirst({ where: { siteId: params.siteId, id: params.pageId } });
  if (!pageRecord) throw new RelationalStoreError("theme_page_not_found", 404);
  const page = toThemePage(pageRecord);
  assertThemeDraftVersion(page, params.expected);
  page.draftJson = cloneJson(params.draftJson);
  page.draftMeta = makeThemeDraftMeta(page);
  if (params.title !== undefined) page.title = params.title.trim() || page.title;
  await prisma.themePage.update({
    where: { id: page.id },
    data: {
      title: page.title,
      draftJson: draftJsonWithMeta(page)
    }
  });
  return { draftVersion: page.draftMeta };
}

type ThemeDraftVersionExpectation = { expectedRevision?: number; expectedEtag?: string };

function hasDraftVersionExpectation(expected?: ThemeDraftVersionExpectation): boolean {
  return expected?.expectedRevision !== undefined || expected?.expectedEtag !== undefined;
}

export async function saveThemeSettingsDraftRelational(params: {
  siteId: string;
  draftJson: ThemeSettings;
  actor?: string;
  expected?: ThemeDraftVersionExpectation;
  requireExpected?: boolean;
}): Promise<{ draftVersion: ThemeDraftMeta }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const current = await tx.themeSettings.findUnique({ where: { siteId: params.siteId } });
    const currentSettings = toThemeSettings(current);
    if (current && params.requireExpected && !hasDraftVersionExpectation(params.expected)) {
      throw new RelationalStoreError("theme_draft_version_required", 428);
    }
    if (current) assertThemeDraftVersion({ draftMeta: currentSettings.draftMeta }, params.expected);
    const nextSettings = {
      draftJson: cloneJson(params.draftJson),
      publishedJson: current ? currentSettings.publishedJson : cloneJson(params.draftJson),
      draftMeta: makeThemeDraftMeta(currentSettings)
    };
    await tx.themeSettings.upsert({
      where: { siteId: params.siteId },
      create: {
        id: `settings_${params.siteId}`,
        siteId: params.siteId,
        draftJson: themeSettingsDraftJsonWithMeta(nextSettings),
        publishedJson: cloneJson(nextSettings.publishedJson) as unknown as Prisma.InputJsonValue
      },
      update: {
        draftJson: themeSettingsDraftJsonWithMeta(nextSettings)
      }
    });
    return { draftVersion: nextSettings.draftMeta };
  }, { timeout: 60000 });
}

export type ThemeFooterSocialLinks = {
  socialHeading: string;
  socialBody: string;
  instagramUrl: string;
  facebookUrl: string;
  threadsUrl: string;
  pinterestUrl: string;
  youtubeUrl: string;
  xUrl: string;
};

function applyFooterSocialLinks(settings: ThemeSettings, socialLinks: ThemeFooterSocialLinks): ThemeSettings {
  const next = cloneJson(settings);
  next.globalSections ??= {};
  next.globalSections.footer = normalizeGlobalSection("footer", next.globalSections.footer);
  next.globalSections.footer.settings = {
    ...next.globalSections.footer.settings,
    socialHeading: socialLinks.socialHeading,
    socialBody: socialLinks.socialBody,
    instagramUrl: socialLinks.instagramUrl,
    facebookUrl: socialLinks.facebookUrl,
    threadsUrl: socialLinks.threadsUrl,
    pinterestUrl: socialLinks.pinterestUrl,
    youtubeUrl: socialLinks.youtubeUrl,
    xUrl: socialLinks.xUrl
  };
  return next;
}

export async function updateThemeFooterSocialLinksRelational(params: {
  siteId: string;
  socialLinks: ThemeFooterSocialLinks;
  actor?: string;
}): Promise<{ site: Site }> {
  clearSiteThemeReadCache(params.siteId);
  const current = await prisma.themeSettings.findUnique({ where: { siteId: params.siteId } });
  if (!current) {
    throw new RelationalStoreError("theme_settings_not_found", 404);
  }
  const currentSettings = toThemeSettings(current);
  const draftJson = applyFooterSocialLinks(currentSettings.draftJson, params.socialLinks);
  const nextSettings = {
    draftJson,
    publishedJson: currentSettings.publishedJson,
    draftMeta: makeThemeDraftMeta(currentSettings)
  };
  await prisma.themeSettings.update({
    where: { siteId: params.siteId },
    data: {
      draftJson: themeSettingsDraftJsonWithMeta(nextSettings)
    }
  });
  return { site: toSite(await getSiteWithThemeRecords(prisma, params.siteId)) };
}

export async function rollbackThemePageDraftRelational(params: {
  siteId: string;
  pageId: string;
}): Promise<{ page: ThemePage; draftVersion: ThemeDraftMeta }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const pageRecord = await tx.themePage.findFirst({ where: { siteId: params.siteId, id: params.pageId } });
    if (!pageRecord) throw new RelationalStoreError("theme_page_not_found", 404);
    const page = toThemePage(pageRecord);
    page.draftJson = cloneJson(page.publishedJson);
    page.draftMeta = makeThemeDraftMeta(page);
    const updated = await tx.themePage.update({
      where: { id: page.id },
      data: { draftJson: draftJsonWithMeta(page) }
    });
    return { page: toThemePage(updated), draftVersion: page.draftMeta };
  });
}

export async function resetDraftThemeFromActiveRelational(
  siteId: string,
  actor = "site_admin_demo"
): Promise<{ site: Site; sourceVersion: number }> {
  clearSiteThemeReadCache(siteId);
  return prisma.$transaction(async (tx) => {
    const siteRecord = await getSiteWithThemeRecords(tx, siteId);
    const site = toSite(siteRecord);
    const latestPublicationRecord = await tx.themePublication.findFirst({
      where: { siteId },
      orderBy: [{ version: "desc" }, { publishedAt: "desc" }]
    });
    const latestPublication = latestPublicationRecord ? toThemePublication(latestPublicationRecord) : undefined;
    const sourceVersion = latestPublication?.version ?? site.pages[0]?.publishedJson.version ?? 1;
    const publishedByPage = new Map(latestPublication?.snapshot.pages.map((page) => [page.id, page.publishedJson]) ?? []);

    for (const page of site.pages) {
      const published = publishedByPage.get(page.id) ?? page.publishedJson;
      page.draftJson = cloneJson(published);
      page.draftMeta = makeThemeDraftMeta(page);
      await tx.themePage.update({
        where: { id: page.id },
        data: { draftJson: draftJsonWithMeta(page) }
      });
    }

    const settingsDraft = cloneJson(latestPublication?.snapshot.themeSettings ?? site.themeSettings.publishedJson);
    const nextSettings = {
      ...site.themeSettings,
      draftJson: settingsDraft,
      draftMeta: makeThemeDraftMeta(site.themeSettings)
    };
    await tx.themeSettings.upsert({
      where: { siteId },
      create: {
        id: `settings_${siteId}`,
        siteId,
        draftJson: themeSettingsDraftJsonWithMeta(nextSettings),
        publishedJson: cloneJson(settingsDraft) as unknown as Prisma.InputJsonValue
      },
      update: {
        draftJson: themeSettingsDraftJsonWithMeta(nextSettings)
      }
    });

    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_draft_reset_from_active",
      targetType: "theme",
      targetId: siteId,
      metadata: { version: sourceVersion }
    });

    return { site: toSite(await getSiteWithThemeRecords(tx, siteId)), sourceVersion };
  }, { timeout: 60000 });
}

export async function publishDraftPageRelational(
  siteId: string,
  pageId: string,
  actor = "site_admin_demo",
  expected?: ThemeDraftVersionExpectation & {
    pageVersions?: Record<string, ThemeDraftVersionExpectation | undefined>;
    settingsVersion?: ThemeDraftVersionExpectation;
    expectedPublishedVersion?: number;
    requireSnapshotVersions?: boolean;
    acknowledgedGlobalVisualChanges?: boolean;
  }
): Promise<{
  site: Site;
  draftVersion?: ThemeDraftMeta;
  pageDraftVersions: Record<string, ThemeDraftMeta>;
  settingsDraftVersion?: ThemeDraftMeta;
  publication: ThemePublication;
  publishedVersion: number;
}> {
  clearSiteThemeReadCache(siteId);
  const targetExpectation = expected?.pageVersions?.[pageId] ?? {
    expectedRevision: expected?.expectedRevision,
    expectedEtag: expected?.expectedEtag
  };
  if (!hasDraftVersionExpectation(targetExpectation)) {
    throw new RelationalStoreError("theme_publish_page_revision_required", 409);
  }
  const targetContext = await loadDraftStorefrontContext({
    siteId,
    pageId,
    publishScope: { type: "page", pageIds: [pageId], includeThemeSettings: false, includeStorefrontProfile: false }
  });
  assertThemeDraftVersion(targetContext.page, targetExpectation);
  const unresolvedBindings = resolveStorefrontBindings(JSON.stringify(targetContext.pageJson), targetContext).missing;
  const missingRequiredFacts = targetContext.missingFacts.filter((fact) => fact.startsWith("profile.") || fact.endsWith("seo.description"));
  if (missingRequiredFacts.length) throw new RelationalStoreError("theme_publish_page_facts_incomplete", 409);
  if (unresolvedBindings.length) throw new RelationalStoreError("theme_publish_page_bindings_unresolved", 409);
  if (targetContext.catalog.invalidPacks.length) throw new RelationalStoreError("theme_publish_page_invalid_creative_pack", 409);
  if (targetContext.page.pageType === "pricing" && !targetContext.offers.active.some((offer) => offer.product.type === "subscription")) {
    throw new RelationalStoreError("theme_publish_page_active_subscription_required", 409);
  }
  const result = await prisma.$transaction(async (tx) => {
    const siteRecord = await getSiteWithThemeRecords(tx, siteId);
    const site = toSite(siteRecord);
    const targetPage = site.pages.find((page) => page.id === pageId);
    if (!targetPage) throw new RelationalStoreError("theme_page_not_found", 404);
    const currentPublishedVersion = Math.max(0, ...site.pages.map((page) => page.publishedJson.version ?? 0));
    if (expected?.expectedPublishedVersion !== undefined && currentPublishedVersion !== expected.expectedPublishedVersion) {
      throw new RelationalStoreError("theme_publish_conflict", 409);
    }
    if (expected?.requireSnapshotVersions) {
      if (expected.expectedPublishedVersion === undefined) {
        throw new RelationalStoreError("theme_publish_review_scope_incomplete", 409);
      }
      if (!hasDraftVersionExpectation(expected.pageVersions?.[pageId]) && !hasDraftVersionExpectation({ expectedRevision: expected.expectedRevision, expectedEtag: expected.expectedEtag })) {
        throw new RelationalStoreError("theme_publish_review_scope_incomplete", 409);
      }
    }
    assertThemeDraftVersion(targetPage, targetExpectation);
    const targetSeo = targetPage.draftJson.seo;
    if (!targetSeo?.title?.trim() || !targetSeo.description?.trim()) {
      throw new RelationalStoreError("theme_publish_page_seo_incomplete", 409);
    }
    const canonical = (targetSeo.canonical ?? targetSeo.canonicalPath)?.trim();
    if (canonical && !(canonical.startsWith("/") || canonical.startsWith("http://") || canonical.startsWith("https://"))) {
      throw new RelationalStoreError("theme_publish_page_canonical_invalid", 409);
    }

    const publishedVersion = currentPublishedVersion + 1;
    const pageDraftVersions: Record<string, ThemeDraftMeta> = {};

    targetPage.publishedJson = cloneJson(targetPage.draftJson);
    targetPage.publishedJson.version = publishedVersion;
    targetPage.draftJson.version = publishedVersion;
    targetPage.draftMeta = makeThemeDraftMeta(targetPage);
    const draftVersion = targetPage.draftMeta;
    pageDraftVersions[targetPage.id] = targetPage.draftMeta;
    await tx.themePage.update({
      where: { id: targetPage.id },
      data: {
        draftJson: draftJsonWithMeta(targetPage),
        publishedJson: cloneJson(targetPage.publishedJson) as unknown as Prisma.InputJsonValue
      }
    });

    const [publicationProductRows, publicationPackRows] = await Promise.all([
      tx.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: { id: "asc" } }),
      tx.creativePack.findMany({
        where: { siteId },
        select: { id: true, status: true, creditCost: true, outputCount: true, category: true, imageUrl: true, galleryImages: true, galleryImageAlts: true, categoryRecord: { select: { slug: true } } },
        orderBy: { id: "asc" }
      })
    ]);
    const snapshot = buildPublicationSnapshot(
      site,
      undefined,
      publicationPackRows.map((pack) => normalizedPublishPack(pack as PublishPreflightCreativePack)),
      publicationProductRows.map(mapProduct)
    );
    const publicationScope = { type: "page" as const, pageIds: [pageId], includeThemeSettings: false, includeStorefrontProfile: false };
    const publicationManifestHash = crypto.createHash("sha256").update(JSON.stringify({ ...publicationScope, version: publishedVersion })).digest("hex");
    const publicationRecord = await createAndActivateImmutablePublication(tx, {
      siteId,
      version: publishedVersion,
      snapshot,
      actor,
      scope: publicationScope,
      manifestHash: publicationManifestHash
    });
    const publication = toThemePublication(publicationRecord);
    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_published",
      targetType: "theme",
      targetId: siteId,
      metadata: { version: publishedVersion, pageId }
    });
    return { site, draftVersion, pageDraftVersions, settingsDraftVersion: site.themeSettings.draftMeta, publication, publishedVersion };
  }, { timeout: 120000 });
  await finalizePublishedTheme(siteId, result.publication.id);
  return result;
}

export type StorefrontPublishManifest = {
  pageIds: string[];
  includeThemeSettings: boolean;
  includeStorefrontProfile: boolean;
  pageVersions: Record<string, ThemeDraftVersionExpectation>;
  settingsVersion?: ThemeDraftVersionExpectation;
  profileVersion?: ThemeDraftVersionExpectation;
  manifestHash: string;
};

export function storefrontPublishManifestHash(manifest: Omit<StorefrontPublishManifest, "manifestHash">): string {
  return crypto.createHash("sha256").update(JSON.stringify({
    pageIds: [...manifest.pageIds].sort(),
    includeThemeSettings: manifest.includeThemeSettings,
    includeStorefrontProfile: manifest.includeStorefrontProfile,
    pageVersions: Object.fromEntries(Object.entries(manifest.pageVersions).sort()),
    settingsVersion: manifest.settingsVersion,
    profileVersion: manifest.profileVersion
  })).digest("hex");
}

export async function publishDraftSiteRelational(
  siteId: string,
  manifest: StorefrontPublishManifest,
  actor = "site_admin_demo"
): Promise<{ site: Site; publication: ThemePublication; publishedVersion: number }> {
  clearSiteThemeReadCache(siteId);
  const expectedHash = storefrontPublishManifestHash(manifest);
  if (manifest.manifestHash !== expectedHash) throw new RelationalStoreError("theme_publish_manifest_hash_invalid", 409);
  if (!manifest.pageIds.length) throw new RelationalStoreError("theme_publish_manifest_empty", 409);
  const preflightBundle = await getThemePublishPreflightBundleRelational(siteId);
  if (!preflightBundle.site) throw new RelationalStoreError("theme_site_not_found", 404);
  const preflight = runThemePublishPreflight({
    site: preflightBundle.site,
    products: preflightBundle.products,
    siteAiApps: preflightBundle.siteAiApps,
    mediaAssets: preflightBundle.mediaAssets,
    storefrontProfile: preflightBundle.storefrontProfile,
    creativePacks: preflightBundle.creativePacks,
    dirtyPageIds: preflightBundle.dirtyPageIds
  });
  if (!preflight.canPublish) throw new RelationalStoreError("theme_publish_preflight_blocked", 409);
  const result = await prisma.$transaction(async (tx) => {
    const siteRecord = await getSiteWithThemeRecords(tx, siteId);
    const site = toSite(siteRecord);
    const omittedDirtyPages = site.pages.filter((page) => !manifest.pageIds.includes(page.id) && JSON.stringify(page.draftJson) !== JSON.stringify(page.publishedJson));
    const settingsDirty = JSON.stringify(site.themeSettings.draftJson) !== JSON.stringify(site.themeSettings.publishedJson);
    const profileDirty = JSON.stringify(site.storefrontProfile?.draftJson) !== JSON.stringify(site.storefrontProfile?.publishedJson);
    if (omittedDirtyPages.length || (settingsDirty && !manifest.includeThemeSettings) || (profileDirty && !manifest.includeStorefrontProfile)) {
      throw new RelationalStoreError("theme_publish_manifest_unreviewed_objects", 409);
    }
    const pages = site.pages.filter((page) => manifest.pageIds.includes(page.id));
    if (pages.length !== manifest.pageIds.length) throw new RelationalStoreError("theme_publish_manifest_page_not_found", 409);
    for (const page of pages) {
      const expectedPageVersion = manifest.pageVersions[page.id];
      if (!hasDraftVersionExpectation(expectedPageVersion)) {
        throw new RelationalStoreError("theme_publish_manifest_page_revision_required", 409);
      }
      assertThemeDraftVersion(page, expectedPageVersion);
    }
    if (manifest.includeThemeSettings) {
      if (!manifest.settingsVersion) throw new RelationalStoreError("theme_publish_manifest_settings_revision_required", 409);
      assertThemeDraftVersion({ draftMeta: site.themeSettings.draftMeta }, manifest.settingsVersion);
    }
    const profile = site.storefrontProfile;
    if (manifest.includeStorefrontProfile) {
      if (!profile) throw new RelationalStoreError("storefront_profile_not_found", 409);
      if (!manifest.profileVersion || profile.draftMeta?.revision !== manifest.profileVersion.expectedRevision || (manifest.profileVersion.expectedEtag && profile.draftMeta?.etag !== manifest.profileVersion.expectedEtag)) throw new RelationalStoreError("storefront_profile_draft_conflict", 409);
    }
    const publishedProfile = manifest.includeStorefrontProfile ? profile?.draftJson : profile?.publishedJson;
    const normalizedPublishedProfile = publishedProfile ? normalizeStorefrontProfile(publishedProfile) : undefined;
    if (!hasCompleteStorefrontProfileFacts(normalizedPublishedProfile, { requireProductionClaims: siteId === "site_dreamshoot" })) {
      throw new RelationalStoreError("storefront_profile_incomplete", 409);
    }
    const [activePrices, invalidPackCount, otherSites, publicationPacks, publicationProductRows] = await Promise.all([
      tx.price.findMany({
        where: { siteId, status: "active", product: { status: "active" } },
        select: { id: true, stripePriceId: true, currency: true, interval: true, amountCents: true, providerVerifiedAt: true, providerFingerprint: true, effectiveFrom: true, effectiveTo: true }
      }),
      tx.creativePack.count({ where: { siteId, status: "active", OR: [{ creditCost: { lte: 0 } }, { outputCount: { lte: 0 } }] } }),
      tx.site.findMany({ where: { id: { not: siteId } }, select: { id: true, primaryDomain: true } }),
      tx.creativePack.findMany({
        where: { siteId },
        select: { id: true, status: true, creditCost: true, outputCount: true, category: true, imageUrl: true, galleryImages: true, galleryImageAlts: true, categoryRecord: { select: { slug: true } } },
        orderBy: { id: "asc" }
      }),
      tx.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: { id: "asc" } })
    ]);
    const normalizedPreflightPacks = preflightBundle.creativePacks.map(normalizedPublishPack).sort((left, right) => left.id.localeCompare(right.id));
    const normalizedPublicationPacks = publicationPacks.map((pack) => normalizedPublishPack(pack as PublishPreflightCreativePack)).sort((left, right) => left.id.localeCompare(right.id));
    const preflightPackRevision = crypto.createHash("sha256").update(JSON.stringify(normalizedPreflightPacks)).digest("hex");
    const transactionPackRevision = crypto.createHash("sha256").update(JSON.stringify(normalizedPublicationPacks)).digest("hex");
    if (preflightPackRevision !== transactionPackRevision) throw new RelationalStoreError("theme_publish_creative_pack_revision_conflict", 409);
    const now = Date.now();
    const invalidPrice = activePrices.find((price) =>
      !price.stripePriceId ||
      !/^price_[a-zA-Z0-9_]+$/.test(price.stripePriceId) ||
      !price.currency ||
      price.currency.trim().toLowerCase() !== site.currency.trim().toLowerCase() ||
      !price.interval ||
      price.amountCents <= 0 ||
      !price.providerVerifiedAt ||
      !price.providerFingerprint ||
      (price.effectiveFrom !== null && price.effectiveFrom.getTime() > now) ||
      (price.effectiveTo !== null && price.effectiveTo.getTime() <= now)
    );
    if (invalidPrice) throw new RelationalStoreError("theme_publish_price_facts_invalid", 409);
    if (invalidPackCount) throw new RelationalStoreError("theme_publish_creative_pack_facts_invalid", 409);
    if (!normalizedPublishedProfile) throw new RelationalStoreError("storefront_profile_incomplete", 409);
    const otherDomains = new Set(otherSites.map((other) => other.primaryDomain.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]).filter(Boolean));
    const crossSiteSocial = normalizedPublishedProfile.identity.sameAs.some((value) => {
      try {
        return otherDomains.has(new URL(value).hostname.replace(/^www\./i, ""));
      } catch {
        return true;
      }
    });
    if (crossSiteSocial) throw new RelationalStoreError("storefront_profile_social_cross_site", 409);
    const publishedVersion = Math.max(0, ...site.pages.map((page) => page.publishedJson.version ?? 0)) + 1;
    for (const page of pages) {
      page.publishedJson = cloneJson(page.draftJson);
      page.publishedJson.version = publishedVersion;
      page.draftJson.version = publishedVersion;
      page.draftMeta = makeThemeDraftMeta(page);
      await tx.themePage.update({ where: { id: page.id }, data: { draftJson: draftJsonWithMeta(page), publishedJson: cloneJson(page.publishedJson) as unknown as Prisma.InputJsonValue } });
    }
    if (manifest.includeThemeSettings) {
      site.themeSettings.publishedJson = cloneJson(site.themeSettings.draftJson);
      await tx.themeSettings.update({ where: { siteId }, data: { publishedJson: cloneJson(site.themeSettings.publishedJson) as unknown as Prisma.InputJsonValue } });
    }
    if (manifest.includeStorefrontProfile && profile) {
      profile.publishedJson = cloneJson(normalizedPublishedProfile!);
      await tx.storefrontProfile.update({ where: { siteId }, data: { publishedJson: cloneJson(profile.publishedJson) as unknown as Prisma.InputJsonValue } });
    }
    const snapshot = buildPublicationSnapshot(site, undefined, normalizedPublicationPacks, publicationProductRows.map(mapProduct));
    const publicationRecord = await createAndActivateImmutablePublication(tx, {
      siteId,
      version: publishedVersion,
      snapshot,
      actor,
      scope: { type: "site", ...manifest },
      manifestHash: manifest.manifestHash
    });
    await addAuditLogRelational(tx, { siteId, actorType: "site_admin", actorId: actor, action: "theme_site_published", targetType: "theme", targetId: siteId, metadata: { version: publishedVersion, manifestHash: manifest.manifestHash, pageIds: manifest.pageIds.join(",") } });
    return { site, publication: toThemePublication(publicationRecord), publishedVersion };
  }, { timeout: 120000 });
  await finalizePublishedTheme(siteId, result.publication.id);
  return result;
}

export async function restoreDraftThemeFromPublicationRelational(
  siteId: string,
  publicationId: string,
  actor = "site_admin_demo"
): Promise<{ site: Site; publication: ThemePublication }> {
  clearSiteThemeReadCache(siteId);
  return prisma.$transaction(async (tx) => {
    const publicationRecord = await tx.themePublication.findFirst({ where: { siteId, id: publicationId } });
    if (!publicationRecord) throw new RelationalStoreError("theme_publication_not_found", 404);
    const publication = toThemePublication(publicationRecord);
    const snapshotPages = new Map(publication.snapshot.pages.map((page) => [page.id, page.publishedJson]));

    const siteRecord = await getSiteWithThemeRecords(tx, siteId);
    const site = toSite(siteRecord);
    for (const page of site.pages) {
      const snapshotPage = snapshotPages.get(page.id);
      if (!snapshotPage) continue;
      page.draftJson = cloneJson(snapshotPage);
      page.draftMeta = makeThemeDraftMeta(page);
      await tx.themePage.update({
        where: { id: page.id },
        data: { draftJson: draftJsonWithMeta(page) }
      });
    }
    await tx.themeSettings.upsert({
      where: { siteId },
      create: {
        id: `settings_${siteId}`,
        siteId,
        draftJson: themeSettingsDraftJsonWithMeta({
          draftJson: cloneJson(publication.snapshot.themeSettings) as ThemeSettings,
          publishedJson: cloneJson(publication.snapshot.themeSettings) as ThemeSettings,
          draftMeta: makeThemeDraftMeta(site.themeSettings)
        }),
        publishedJson: cloneJson(publication.snapshot.themeSettings) as unknown as Prisma.InputJsonValue
      },
      update: {
        draftJson: themeSettingsDraftJsonWithMeta({
          draftJson: cloneJson(publication.snapshot.themeSettings) as ThemeSettings,
          publishedJson: cloneJson(publication.snapshot.themeSettings) as ThemeSettings,
          draftMeta: makeThemeDraftMeta(site.themeSettings)
        })
      }
    });
    site.themeSettings.draftJson = cloneJson(publication.snapshot.themeSettings);
    if (publication.snapshot.storefrontProfile) {
      await tx.storefrontProfile.upsert({
        where: { siteId },
        create: {
          id: `profile_${siteId}`,
          siteId,
          draftJson: cloneJson(publication.snapshot.storefrontProfile) as unknown as Prisma.InputJsonValue,
          publishedJson: cloneJson(site.storefrontProfile?.publishedJson ?? publication.snapshot.storefrontProfile) as unknown as Prisma.InputJsonValue,
          draftMeta: makeThemeDraftMeta(site.themeSettings) as unknown as Prisma.InputJsonValue
        },
        update: { draftJson: cloneJson(publication.snapshot.storefrontProfile) as unknown as Prisma.InputJsonValue }
      });
      if (site.storefrontProfile) site.storefrontProfile.draftJson = cloneJson(publication.snapshot.storefrontProfile);
    }

    const draftTheme = await tx.siteTheme.findFirst({ where: { siteId, status: "draft" }, orderBy: { updatedAt: "desc" } });
    if (draftTheme && publication.snapshot.saasTheme && typeof publication.snapshot.saasTheme === "object") {
      const record = publication.snapshot.saasTheme as Partial<SiteTheme>;
      await tx.siteTheme.update({
        where: { id: draftTheme.id },
        data: {
          templates: cloneJson(record.templates ?? draftTheme.templates) as unknown as Prisma.InputJsonValue,
          settings: cloneJson(record.settings ?? draftTheme.settings) as unknown as Prisma.InputJsonValue,
          themeKey: record.themeKey ?? draftTheme.themeKey
        }
      });
    }

    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_draft_restored_from_publication",
      targetType: "theme_publication",
      targetId: publication.id,
      metadata: { version: publication.version }
    });

    return { site, publication };
  }, { timeout: 20000 });
}

export async function activateThemePublicationRelational(
  siteId: string,
  publicationId: string,
  actor = "site_admin_demo"
): Promise<{ publication: ThemePublication }> {
  const publication = await prisma.$transaction(async (tx) => {
    const publicationRecord = await tx.themePublication.findFirst({ where: { siteId, id: publicationId } });
    if (!publicationRecord) throw new RelationalStoreError("theme_publication_not_found", 404);
    if (publicationSnapshotIntegrity(publicationRecord.snapshot as unknown as ThemePublication["snapshot"]) !== "valid") {
      throw new RelationalStoreError("theme_publication_snapshot_invalid", 409);
    }
    await tx.activeThemePublication.upsert({
      where: { siteId },
      create: { siteId, publicationId, activatedBy: actor },
      update: { publicationId, activatedAt: new Date(), activatedBy: actor }
    });
    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_publication_activated",
      targetType: "theme_publication",
      targetId: publicationId,
      metadata: { version: publicationRecord.version }
    });
    return toThemePublication(publicationRecord);
  }, { timeout: 120_000, maxWait: 20_000 });
  clearSiteThemeReadCache(siteId);
  clearStorefrontContextCache(siteId);
  return { publication };
}

export async function upsertThemeMediaAssetRelational(params: {
  siteId: string;
  assetId?: string;
  label: string;
  storageKey: string;
  mimeType: string;
  usage: MediaAsset["usage"];
  sourceType?: MediaAsset["sourceType"];
  previewUrl?: string;
  originUrl?: string;
  altText?: string;
  notes?: string;
}): Promise<{ asset: MediaAsset; created: boolean }> {
  clearSiteThemeReadCache(params.siteId);
  clearSiteMediaSummaryCache(params.siteId);
  const site = await prisma.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  const label = params.label.trim();
  const storageKey = params.storageKey.trim();
  const mimeType = params.mimeType.trim();
  if (label.length < 2) throw new RelationalStoreError("media_label_required", 400);
  if (!storageKey.startsWith(`sites/${params.siteId}/`)) throw new RelationalStoreError("media_storage_key_must_be_site_scoped", 400);
  if (!mimeType.includes("/")) throw new RelationalStoreError("invalid_mime_type", 400);

  const existing = params.assetId
    ? await prisma.mediaAsset.findFirst({ where: { siteId: params.siteId, id: params.assetId } })
    : null;
  const assetData = {
    label,
    storageKey,
    mimeType,
    usageType: params.usage,
    sourceType: params.sourceType ?? "manual",
    previewUrl: params.previewUrl?.trim() || null,
    originUrl: params.originUrl?.trim() || null,
    altText: params.altText?.trim() || null,
    notes: params.notes?.trim() || null
  };
  const record = existing
    ? await prisma.mediaAsset.update({
        where: { id: existing.id },
        data: assetData
      })
    : await prisma.mediaAsset.create({
        data: {
          id: params.assetId ?? uid("media"),
          siteId: params.siteId,
          ...assetData
        }
      });
  return { asset: toMediaAsset(record), created: !existing };
}

export async function deleteThemeMediaAssetRelational(params: {
  siteId: string;
  assetId: string;
}): Promise<{ asset: MediaAsset }> {
  clearSiteThemeReadCache(params.siteId);
  clearSiteMediaSummaryCache(params.siteId);
  const existing = await prisma.mediaAsset.findFirst({ where: { siteId: params.siteId, id: params.assetId } });
  if (!existing) throw new RelationalStoreError("theme_media_not_found", 404);
  await prisma.mediaAsset.delete({ where: { id: existing.id } });
  return { asset: toMediaAsset(existing) };
}

export async function applySiteThemeToDraftRelational(params: {
  siteId: string;
  themeId: string;
  actor?: string;
}): Promise<{ theme: SiteTheme; site: Site }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const theme = await tx.siteTheme.findFirst({ where: { siteId: params.siteId, id: params.themeId } });
    if (!theme) throw new RelationalStoreError("theme_not_found", 404);
    await tx.siteTheme.update({ where: { id: theme.id }, data: { status: "draft" } });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "theme_applied_to_draft",
      targetType: "site_theme",
      targetId: theme.id,
      metadata: { themeKey: theme.themeKey }
    });
    return {
      theme: toSiteTheme({ ...theme, status: "draft", updatedAt: new Date() }),
      site: toSite(await getSiteWithThemeRecords(tx, params.siteId))
    };
  });
}

export async function activateSiteThemeRelational(params: {
  siteId: string;
  themeId: string;
  actor?: string;
}): Promise<{ theme: SiteTheme; publication: ThemePublication }> {
  throw new RelationalStoreError("theme_activation_requires_full_publish_manifest", 409);
}

export async function deleteSiteThemeRelational(params: {
  siteId: string;
  themeId: string;
  actor?: string;
}): Promise<{ deletedThemeId: string }> {
  clearSiteThemeReadCache(params.siteId);
  const theme = await prisma.siteTheme.findFirst({ where: { siteId: params.siteId, id: params.themeId } });
  if (!theme) throw new RelationalStoreError("theme_not_found", 404);
  if (theme.status === "active") throw new RelationalStoreError("cannot_delete_active_theme", 409);
  await prisma.$transaction(async (tx) => {
    await tx.siteTheme.delete({ where: { id: theme.id } });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "theme_deleted",
      targetType: "site_theme",
      targetId: theme.id,
      metadata: { themeKey: theme.themeKey }
    });
  });
  return { deletedThemeId: theme.id };
}

export async function duplicateSiteThemeRelational(params: {
  siteId: string;
  name?: string;
  source?: "draft" | "active";
  sourceThemeId?: string;
  actor?: string;
}): Promise<{ themeCopy: ThemeCopy; siteTheme: SiteTheme }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const site = await tx.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
    if (!site) throw new RelationalStoreError("site_not_found", 404);
    const source = params.source ?? "draft";
    const sourceTheme = params.sourceThemeId
      ? await tx.siteTheme.findFirst({ where: { siteId: params.siteId, id: params.sourceThemeId } })
      : await tx.siteTheme.findFirst({
          where: { siteId: params.siteId, status: source === "active" ? "active" : "draft" },
          orderBy: { updatedAt: "desc" }
        });
    if (!sourceTheme) throw new RelationalStoreError("theme_not_found", 404);
    const now = new Date();
    const createdBy = params.actor ?? "site_admin_demo";
    const themeCopyRecord = await tx.themeCopy.create({
      data: {
        id: uid("theme_copy"),
        siteId: params.siteId,
        name: params.name?.trim() || `${sourceTheme.name} copy`,
        themeKey: sourceTheme.themeKey,
        source,
        templates: cloneJson(sourceTheme.templates) as unknown as Prisma.InputJsonValue,
        settings: cloneJson(sourceTheme.settings) as unknown as Prisma.InputJsonValue,
        createdBy
      }
    });
    const siteThemeRecord = await tx.siteTheme.create({
      data: {
        id: uid("site_theme"),
        siteId: params.siteId,
        name: themeCopyRecord.name,
        themeId: `theme_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        themeKey: sourceTheme.themeKey,
        status: "draft",
        templates: cloneJson(sourceTheme.templates) as unknown as Prisma.InputJsonValue,
        settings: cloneJson(sourceTheme.settings) as unknown as Prisma.InputJsonValue,
        source: "copy",
        createdBy,
        createdAt: now
      }
    });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: createdBy,
      action: "theme_duplicated",
      targetType: "site_theme",
      targetId: siteThemeRecord.id,
      metadata: { source, themeCopyId: themeCopyRecord.id }
    });
    return {
      themeCopy: toThemeCopy(themeCopyRecord),
      siteTheme: toSiteTheme(siteThemeRecord)
    };
  });
}

export async function exportSiteThemePackageRelational(siteId: string, source: "draft" | "active" = "draft") {
  const records = await getSiteSaasThemeRecordsRelational(siteId);
  const theme = source === "active" ? records.active : records.draft;
  return {
    exportedAt: new Date().toISOString(),
    source,
    site: {
      id: records.site.id,
      name: records.site.name,
      slug: records.site.slug,
      primaryDomain: records.site.primaryDomain
    },
    theme,
    pages: records.site.pages.map((page) => ({
      id: page.id,
      pageType: page.pageType,
      templateKey: pageSaasTemplateKey(page),
      slug: page.slug,
      title: page.title,
      json: source === "active" ? page.publishedJson : page.draftJson
    }))
  };
}

export async function installSaasThemeForSiteRelational(params: {
  siteId: string;
  name?: string;
  actor?: string;
  themeKey?: string;
}): Promise<{ theme: SiteTheme }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const site = toSite(await getSiteWithThemeRecords(tx, params.siteId));
    const sourcePackage = getSaasThemePackage(params.themeKey ?? "theme1");
    const now = new Date().toISOString();
    const templates = Object.fromEntries(
      site.pages.map((page) => {
        const templateName = pageSaasTemplateKey(page);
        const importedTemplate = (sourcePackage.templates[templateName] ?? sourcePackage.templates[page.pageType]) as SaasThemeTemplates[string] | undefined;
        const template = importedTemplate ?? toSaasTemplate(page.draftJson);
        return [templateName, cloneJson(template)];
      })
    ) as SaasThemeTemplates;
    const settings = { settings_data: cloneJson(sourcePackage.settingsData) } as SaasThemeSettingsRecord;
    const actor = params.actor ?? "site_admin_demo";
    const record: SaasThemeRecord = {
      name: params.name?.trim() || `${site.name} imported SaaS ${sourcePackage.themeKey}`,
      themeId: `theme_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      themeKey: sourcePackage.themeKey,
      status: "draft",
      templates,
      settings,
      updatedAt: now
    };
    const themeRecord = await tx.siteTheme.create({
      data: {
        id: uid("site_theme"),
        siteId: site.id,
        name: record.name,
        themeId: record.themeId,
        themeKey: record.themeKey,
        status: "draft",
        templates: cloneJson(record.templates) as unknown as Prisma.InputJsonValue,
        settings: cloneJson(record.settings) as unknown as Prisma.InputJsonValue,
        source: sourcePackage.themeKey === "theme1" ? "saas-theme1" : "saas-theme",
        createdBy: actor,
        createdAt: new Date(now)
      }
    });
    await addAuditLogRelational(tx, {
      siteId: site.id,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_installed",
      targetType: "site_theme",
      targetId: themeRecord.id,
      metadata: { themeKey: themeRecord.themeKey }
    });
    return { theme: toSiteTheme(themeRecord) };
  });
}

export async function installInternalThemePackageForSiteRelational(params: {
  siteId: string;
  packageKey: string;
  name?: string;
  actor?: string;
}): Promise<{ theme: SiteTheme }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const site = toSite(await getSiteWithThemeRecords(tx, params.siteId));
    const themePackage = getThemePackages().find((item) => item.key === params.packageKey);
    if (!themePackage) throw new RelationalStoreError("internal_theme_package_not_found", 404);
    const templates = Object.fromEntries(
      site.pages.map((page) => {
        const templateName = mapInternalTemplateKey(pageSaasTemplateKey(page));
        const template = themePackageTemplateToPageJson(themePackage.key, templateName, page.pageType, page.draftJson.version);
        return [pageSaasTemplateKey(page), toSaasTemplate(template ?? page.draftJson)];
      })
    ) as SaasThemeTemplates;
    const themedSite = {
      ...site,
      themeSettings: {
        ...site.themeSettings,
        draftJson: applyInternalThemePackageSiteSettings(site.themeSettings.draftJson, themePackage.siteSettings)
      }
    };
    const baseDraft = buildSaasThemeDraft(themedSite, themePackage.key);
    const actor = params.actor ?? "site_admin_demo";
    const record: SaasThemeRecord = {
      name: params.name?.trim() || `${site.name} ${themePackage.name}`,
      themeId: `theme_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      themeKey: themePackage.key,
      status: "draft",
      templates,
      settings: cloneJson(baseDraft.settings),
      updatedAt: new Date().toISOString()
    };
    const themeRecord = await tx.siteTheme.create({
      data: {
        id: uid("site_theme"),
        siteId: site.id,
        name: record.name,
        themeId: record.themeId,
        themeKey: record.themeKey,
        status: "draft",
        templates: cloneJson(record.templates) as unknown as Prisma.InputJsonValue,
        settings: cloneJson(record.settings) as unknown as Prisma.InputJsonValue,
        source: "imported",
        createdBy: actor
      }
    });
    await addAuditLogRelational(tx, {
      siteId: site.id,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_installed",
      targetType: "site_theme",
      targetId: themeRecord.id,
      metadata: { themeKey: themeRecord.themeKey, packageKey: themePackage.key }
    });
    return { theme: toSiteTheme(themeRecord) };
  });
}

export async function applySaasThemeActionRelational(
  siteId: string,
  action: SaasThemeAction,
  actor = "site_admin_demo"
): Promise<{ site: Site; sectionId?: string; responseType: "reload" | "th1" | "add" | "del" }> {
  clearSiteThemeReadCache(siteId);
  return prisma.$transaction(async (tx) => {
    const site = toSite(await getSiteWithThemeRecords(tx, siteId));
    const draftThemeRow = await tx.siteTheme.findFirst({ where: { siteId, status: "draft" }, orderBy: { updatedAt: "desc" } });
    const draftTheme = draftThemeRow ? toSiteTheme(draftThemeRow) : undefined;
    let sectionId: string | undefined = "sectionId" in action ? action.sectionId : undefined;
    let responseType: "reload" | "th1" | "add" | "del" = "reload";
    const themeKey = themeKeyFromAction(action);
    normalizeThemeScopedSettings(site, themeKey, draftTheme?.themeKey !== themeKey);
    const page = "pageId" in action ? site.pages.find((item) => item.id === action.pageId) : undefined;
    if ("pageId" in action && !page) throw new RelationalStoreError("theme_page_not_found", 404);

    if (action.type === "change") {
      if (action.scope === "page_section") {
        const section = page?.draftJson.sections[action.sectionId];
        if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
        section.settings[action.name] = action.value;
        responseType = "th1";
      } else if (action.scope === "page_block") {
        const block = page?.draftJson.sections[action.sectionId]?.blocks?.find((item) => item.id === action.blockId);
        if (!block) throw new RelationalStoreError("theme_block_not_found", 404);
        block.settings[action.name] = action.value;
        sectionId = action.sectionId;
        responseType = "th1";
      } else if (action.scope === "global") {
        const section = requireGlobalSection(site, action.globalType);
        section.settings[action.name] = action.value;
        sectionId = action.globalType === "header" ? "header_plus" : "footer_plus";
        responseType = "th1";
      } else if (action.scope === "global_setting") {
        syncSaasGlobalSetting(site, action.name, action.value, themeKey);
        responseType = "reload";
      } else {
        const block = requireGlobalSection(site, action.globalType).blocks?.find((item) => item.id === action.blockId);
        if (!block) throw new RelationalStoreError("theme_block_not_found", 404);
        block.settings[action.name] = action.value;
        sectionId = action.globalType === "header" ? "header_plus" : "footer_plus";
        responseType = "th1";
      }
    }

    if (action.type === "dropition") {
      if (!page) throw new RelationalStoreError("theme_page_not_found", 404);
      const validIds = new Set(Object.keys(page.draftJson.sections));
      page.draftJson.sectionsOrder = action.sectionsOrder.filter((id) => validIds.has(id));
    }
    if (action.type === "dropitem") {
      const blockIds = new Set(action.blockIds);
      const section = action.scope === "global" ? requireGlobalSection(site, action.globalType) : page?.draftJson.sections[action.sectionId];
      if (!section?.blocks) throw new RelationalStoreError("theme_section_not_found", 404);
      const byId = new Map(section.blocks.map((block) => [block.id, block]));
      section.blocks = action.blockIds.map((id) => byId.get(id)).filter((block): block is SectionBlockInstance => Boolean(block));
      for (const block of byId.values()) if (!blockIds.has(block.id)) section.blocks.push(block);
      sectionId = action.scope === "global" ? action.globalType === "header" ? "header_plus" : "footer_plus" : action.sectionId;
      responseType = "th1";
    }
    if (action.type === "delition") {
      if (!page) throw new RelationalStoreError("theme_page_not_found", 404);
      page.draftJson.sectionsOrder = page.draftJson.sectionsOrder.filter((id) => id !== action.sectionId);
      delete page.draftJson.sections[action.sectionId];
      responseType = "del";
    }
    if (action.type === "delitem") {
      const section = action.scope === "global" ? requireGlobalSection(site, action.globalType) : page?.draftJson.sections[action.sectionId];
      if (!section?.blocks) throw new RelationalStoreError("theme_section_not_found", 404);
      section.blocks = section.blocks.filter((block) => block.id !== action.blockId);
      sectionId = action.scope === "global" ? action.globalType === "header" ? "header_plus" : "footer_plus" : action.sectionId;
      responseType = "th1";
    }
    if (action.type === "addition") {
      if (!page) throw new RelationalStoreError("theme_page_not_found", 404);
      sectionId = action.sectionId ?? `${action.sectionType}_${Date.now().toString(36)}`;
      page.draftJson.sections[sectionId] = action.section ?? xfcartDefaultSection(action.sectionType, undefined, themeKey);
      if (action.sectionsOrder?.length) {
        const validIds = new Set(Object.keys(page.draftJson.sections));
        const normalizedOrder = action.sectionsOrder.filter((id) => validIds.has(id));
        page.draftJson.sectionsOrder = normalizedOrder.includes(sectionId) ? normalizedOrder : [...normalizedOrder, sectionId];
      } else {
        page.draftJson.sectionsOrder.push(sectionId);
      }
      responseType = "add";
    }
    if (action.type === "additem") {
      const section = action.scope === "global" ? requireGlobalSection(site, action.globalType) : page?.draftJson.sections[action.sectionId];
      if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
      const blockSchema = themeScopedSectionSchema(section.type, themeKey).blocks?.find((block) => block.type === action.blockType);
      if (!blockSchema) throw new RelationalStoreError("theme_block_schema_not_found", 404);
      section.blocks ??= [];
      section.blocks.push(action.block ?? defaultBlock(blockSchema, section.blocks.length + 1));
      sectionId = action.scope === "global" ? action.globalType === "header" ? "header_plus" : "footer_plus" : action.sectionId;
      responseType = "th1";
    }

    await persistSiteDraft(tx, site);
    await persistDraftThemeState(tx, site, themeKey, actor, draftTheme);
    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: `theme_saas_${action.type}`,
      targetType: "theme_draft",
      targetId: "pageId" in action ? action.pageId : action.scope,
      metadata: {
        actionType: action.type,
        scope: "scope" in action ? action.scope : "page",
        pageId: "pageId" in action ? action.pageId : "",
        sectionId: "sectionId" in action ? action.sectionId ?? "" : "",
        globalType: "globalType" in action ? action.globalType : "",
        themeKey
      }
    });
    return { site, sectionId, responseType };
  }, { timeout: 20000 });
}

export async function applyXfcartThemeEditRelational(
  siteId: string,
  payload: XfcartThemeEditPayload,
  actor = "site_admin_demo"
): Promise<{ site: Site; sectionId?: string; responseType: "reload" | "th1" | "add" | "del"; pageId?: string }> {
  clearSiteThemeReadCache(siteId);
  return prisma.$transaction(async (tx) => {
    const site = toSite(await getSiteWithThemeRecords(tx, siteId));
    const explicit = payload.theme_id?.trim()
      ? await tx.siteTheme.findFirst({
          where: { siteId, status: { not: "active" }, OR: [{ id: payload.theme_id.trim() }, { themeId: payload.theme_id.trim() }] }
        })
      : null;
    const fallbackDraft = await tx.siteTheme.findFirst({ where: { siteId, status: "draft" }, orderBy: { updatedAt: "desc" } });
    const editedTheme = explicit ? toSiteTheme(explicit) : fallbackDraft ? toSiteTheme(fallbackDraft) : undefined;
    if (editedTheme) syncSiteFromThemeRecord(site, themeRecordFromSiteTheme(editedTheme), "draft");
    const themeKey = themeKeyFromXfcartPayload(payload, editedTheme);
    normalizeThemeScopedSettings(site, themeKey, editedTheme?.themeKey !== themeKey);
    const page = pageFromXfcartIdentifier(site, payload.page);
    const pageId = page?.id;
    let sectionId = payload.i;
    let responseType: "reload" | "th1" | "add" | "del" = "reload";
    const x = payload.x ?? "";
    const index = parseXfcartIndex(payload.k);
    const value = normalizeXfcartValue(payload.v);

    if (payload.t === "change") {
      if (!payload.n) throw new RelationalStoreError("theme_field_name_required", 400);
      if (x === "global_setting") {
        syncSaasGlobalSetting(site, payload.n, value ?? "", themeKey);
      } else if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        sectionId = x;
        if (index >= 0) {
          const block = section.blocks?.[index];
          if (!block) throw new RelationalStoreError("theme_block_not_found", 404);
          block.settings[payload.n] = value ?? "";
        } else {
          section.settings[payload.n] = value ?? "";
        }
        responseType = "th1";
      } else {
        if (!page || !payload.i) throw new RelationalStoreError("theme_page_or_section_required", 400);
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
        if (index >= 0) {
          const block = section.blocks?.[index];
          if (!block) throw new RelationalStoreError("theme_block_not_found", 404);
          block.settings[payload.n] = value ?? "";
        } else {
          section.settings[payload.n] = value ?? "";
        }
        sectionId = payload.i;
        responseType = "th1";
      }
    }
    if (payload.t === "dropitem") {
      const sort = parseXfcartSort(value);
      if (!sort.length) throw new RelationalStoreError("theme_sort_required", 400);
      if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        section.blocks = reorderXfcartBlocks(section.blocks ?? [], sort);
        sectionId = x;
      } else {
        if (!page || !payload.i) throw new RelationalStoreError("theme_page_or_section_required", 400);
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
        section.blocks = reorderXfcartBlocks(section.blocks ?? [], sort);
        sectionId = payload.i;
      }
      responseType = "th1";
    }
    if (payload.t === "dropition") {
      if (!page) throw new RelationalStoreError("theme_page_not_found", 404);
      const sort = parseXfcartSort(value);
      const validIds = new Set(Object.keys(page.draftJson.sections));
      page.draftJson.sectionsOrder = sort.filter((id) => validIds.has(id));
    }
    if (payload.t === "delitem") {
      if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        section.blocks = (section.blocks ?? []).filter((_, blockIndex) => blockIndex !== index);
        sectionId = x;
      } else {
        if (!page || !payload.i) throw new RelationalStoreError("theme_page_or_section_required", 400);
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
        section.blocks = (section.blocks ?? []).filter((_, blockIndex) => blockIndex !== index);
        sectionId = payload.i;
      }
      responseType = "th1";
    }
    if (payload.t === "delition") {
      if (!page || !payload.i) throw new RelationalStoreError("theme_page_or_section_required", 400);
      page.draftJson.sectionsOrder = page.draftJson.sectionsOrder.filter((id) => id !== payload.i);
      delete page.draftJson.sections[payload.i];
      sectionId = payload.i;
      responseType = "del";
    }
    if (payload.t === "addition") {
      if (!page || !x) throw new RelationalStoreError("theme_page_or_section_required", 400);
      sectionId = payload.i || `${x}_${Date.now().toString(36)}`;
      page.draftJson.sections[sectionId] = xfcartDefaultSection(x, payload.section, themeKey);
      if (payload.sectionsOrder?.length) {
        const validIds = new Set(Object.keys(page.draftJson.sections));
        const normalizedOrder = payload.sectionsOrder.filter((id) => validIds.has(id));
        page.draftJson.sectionsOrder = normalizedOrder.includes(sectionId) ? normalizedOrder : [...normalizedOrder, sectionId];
      } else {
        page.draftJson.sectionsOrder.push(sectionId);
      }
      responseType = "add";
    }
    if (payload.t === "additem") {
      if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        section.blocks ??= [];
        section.blocks.push(xfcartDefaultBlock(section, readString(value) ?? payload.block?.type ?? "", payload.block, themeKey));
        sectionId = x;
      } else {
        if (!page || !payload.i) throw new RelationalStoreError("theme_page_or_section_required", 400);
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
        section.blocks ??= [];
        section.blocks.push(xfcartDefaultBlock(section, readString(value) ?? payload.block?.type ?? "", payload.block, themeKey));
        sectionId = payload.i;
      }
      responseType = "th1";
    }

    await persistSiteDraft(tx, site);
    const theme = await persistDraftThemeState(tx, site, themeKey, actor, editedTheme);
    if (payload.theme_id && (theme.id === payload.theme_id || theme.themeId === payload.theme_id) && theme.themeId !== payload.theme_id) {
      await tx.siteTheme.update({ where: { id: theme.id }, data: { themeId: payload.theme_id } });
    }
    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: `theme_xfcart_${payload.t}`,
      targetType: "theme_draft",
      targetId: pageId ?? x,
      metadata: {
        t: payload.t,
        x,
        i: payload.i ?? "",
        k: String(payload.k ?? ""),
        n: payload.n ?? "",
        page: payload.page ?? "index",
        theme_id: payload.theme_id ?? "",
        themeKey
      }
    });
    return { site, sectionId, responseType, pageId };
  }, { timeout: 20000 });
}
