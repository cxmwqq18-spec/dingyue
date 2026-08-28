import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toCreativePack, mapProduct, toSite, toMediaAsset, toVideoTheme, toVideoThemeCategory, toCreativePackCategory } from "@/lib/stores/prisma-mappers";
import type { PlatformState } from "@/lib/types";
import { createPublishedSiteSnapshot } from "./snapshot";
import { resolveStorefrontContext } from "./core";
import type { DraftStorefrontContextAdapter, PublishedStorefrontContextAdapter, StorefrontContext, StorefrontPublishScope } from "./types";

export { assertLiveDraftPage } from "./snapshot";

export function storefrontContextCacheKey(params: { siteId: string; pageId?: string; currentRevision?: string; factsRevision: string; pageEntityId?: string; copyRevision?: string; pageMediaRevision?: string }): string {
  return `${params.siteId}:${params.factsRevision}:${params.pageId ?? "site"}:${params.pageEntityId ?? "page"}:${params.copyRevision ?? "copy"}:${params.pageMediaRevision ?? "media"}`;
}

export function clearStorefrontContextCache(_siteId: string): void {
  // Public SSR has no cross-request content cache. Kept as a compatibility
  // hook for admin mutations that used to invalidate the publication cache.
}

type PrismaContextBundle = Awaited<ReturnType<typeof loadPrismaBundle>>;

/**
 * Canonical public SSR data entrypoint. Every call reads the current draft
 * records from PostgreSQL in a repeatable-read transaction.
 */
export async function loadLiveStorefrontBundle(siteId: string): Promise<PrismaContextBundle> {
  return loadPrismaBundle(siteId);
}

function normalizedPath(value: string): string {
  const clean = value.trim().split("?")[0] || "/";
  return clean === "/" ? "/" : `/${clean.replace(/^\/+|\/+$/g, "")}`;
}

async function loadPrismaBundle(siteId: string) {
  const siteRecord = await prisma.$transaction((tx) => tx.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      storefrontProfile: true,
      connect: true,
      products: { include: { prices: true } },
      creativePacks: true,
      creativePackCategories: true,
      mediaAssets: true,
      videoThemeCategories: true,
      videoThemes: { include: { category: true, examples: true } }
    }
  }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  if (!siteRecord) throw new Error("site_not_found");
  const site = toSite(siteRecord);
  const products = siteRecord.products.map(mapProduct);
  const creativePacks = siteRecord.creativePacks.map(toCreativePack);
  const live = createPublishedSiteSnapshot({ sites: [site], products, creativePacks } as PlatformState, site, { source: "postgres" });
  return {
    site: live.site,
    products: live.products,
    creativePacks: live.creativePacks,
    mediaAssets: siteRecord.mediaAssets.map(toMediaAsset),
    creativePackCategories: siteRecord.creativePackCategories.map(toCreativePackCategory),
    videoThemeCategories: siteRecord.videoThemeCategories.map(toVideoThemeCategory),
    videoThemes: siteRecord.videoThemes.map(toVideoTheme),
    currentState: undefined,
    publication: undefined,
    factsRevision: live.factsRevision,
    buildId: live.buildId,
    publishedPageEntities: Object.fromEntries(live.publishedPageEntities.map((entity) => [entity.metadata.canonicalPath, entity])),
    publishedFacts: live.publishedFacts,
    publishedPageMedia: Object.fromEntries(live.publishedPageMedia.map((entity) => [entity.pageEntityId, entity])),
    publishedStandardPageMedia: Object.fromEntries(live.publishedStandardPageMedia.map((entity) => [entity.canonicalPath, entity])),
    publishedLinkRefs: live.publishedLinkRefs,
    snapshotIntegrity: "valid" as const
  };
}

const prismaPublishedAdapter: PublishedStorefrontContextAdapter = {
  async loadPublishedBundle(siteId, path) {
    const bundle = await loadLiveStorefrontBundle(siteId);
    const page = bundle.site.pages.find((candidate) => candidate.slug === normalizedPath(path));
    if (!page) throw new Error("theme_page_not_found");
    return { ...bundle, page };
  }
};

const prismaDraftAdapter: DraftStorefrontContextAdapter = {
  async loadDraftBundle(siteId, pageId) {
    const bundle = await loadLiveStorefrontBundle(siteId);
    const page = bundle.site.pages.find((candidate) => candidate.id === pageId);
    if (!page) throw new Error("theme_page_not_found");
    return { ...bundle, page };
  }
};

export async function loadPublishedStorefrontContext({
  siteId,
  path,
  adapter = prismaPublishedAdapter,
  now
}: {
  siteId: string;
  path: string;
  adapter?: PublishedStorefrontContextAdapter;
  now?: Date;
}): Promise<StorefrontContext> {
  const observedAt = now ?? new Date();
  const bundle = await adapter.loadPublishedBundle(siteId, path);
  const context = resolveStorefrontContext(bundle, "published", { now: observedAt });
  return context;
}

export async function loadDraftStorefrontContext({
  siteId,
  pageId,
  publishScope,
  adapter = prismaDraftAdapter,
  now
}: {
  siteId: string;
  pageId: string;
  publishScope: StorefrontPublishScope;
  adapter?: DraftStorefrontContextAdapter;
  now?: Date;
}): Promise<StorefrontContext> {
  return resolveStorefrontContext(await adapter.loadDraftBundle(siteId, pageId), "draft", { now, scope: publishScope });
}

export { projectPublicCreativePacks, projectPublicPricingOffers, selectOfferPrice } from "./core";
export { hasCompleteStorefrontProfileFacts, isProductionStorefrontClaim, isPublicPriceFact, missingStorefrontProfileFacts } from "./facts";
export { applyTitleTemplate, canonicalPathForPage, canonicalUrlForSite, normalizeCanonicalPath, storefrontBaseUrl, storefrontOrigin } from "./seo-projection";
export { isAidreamcapesSite, isPrimaryMydreamshootsSite, isPrimaryMydreamshootsSlug, resolveSiteCapability, usesAiGenerationPublicRoutes, usesAiGenerationPublicSlug } from "./capabilities";
export {
  createPublishedSiteSnapshot,
  loadPublishedSiteSnapshotBySiteId,
  loadPublishedSiteSnapshotByHost,
  resolveEffectiveIndexability,
  resolveEffectivePublishedPage,
  resolvePublishedRouteDisposition,
  resolvePublishedSeoEntity,
  resolvePublishedRedirectDisposition,
  resolvePublicCollectionItems,
  resolvePublicPageMedia,
  resolvePublicPricingOffers,
  resolvePublishedStorefrontContext,
  snapshotContextBundle
} from "./snapshot";
export type {
  DraftStorefrontContextAdapter,
  EffectiveIndexability,
  EffectivePublishedPage,
  EntityReference,
  PublicationBoundary,
  PublishedSiteSnapshot,
  PublishedStorefrontContextAdapter,
  PublicCollectionItem,
  PublicPageMediaProjection,
  PublicPricingOffer,
  ResolvedOffer,
  ResolvedPageSeo,
  RouteDisposition,
  SiteCapability,
  StorefrontContext,
  StorefrontPublishScope
} from "./types";
