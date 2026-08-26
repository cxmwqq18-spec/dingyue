import "server-only";

import { prisma } from "@/lib/prisma";
import { toCreativePack, mapProduct, toSite } from "@/lib/stores/prisma-mappers";
import { currentPublishedContentHash } from "@/lib/stores/site-published-state";
import type { SitePublishedState } from "@/lib/types";
import { resolveStorefrontContext } from "./core";
import type { DraftStorefrontContextAdapter, PublishedStorefrontContextAdapter, StorefrontContext, StorefrontPublishScope } from "./types";

const publishedContextCache = new Map<string, { context: StorefrontContext; expiresAt: number }>();
const siteContextKeys = new Map<string, Set<string>>();
const PUBLISHED_CONTEXT_MAX_TTL_MS = 60_000;

export function storefrontContextCacheKey(params: { siteId: string; pageId?: string; currentRevision?: string; factsRevision: string; pageEntityId?: string; copyRevision?: string; pageMediaRevision?: string }): string {
  return `${params.siteId}:${params.currentRevision ?? "missing-current-state"}:${params.factsRevision}:${params.pageId ?? "site"}:${params.pageEntityId ?? "page"}:${params.copyRevision ?? "copy"}:${params.pageMediaRevision ?? "media"}`;
}

export function clearStorefrontContextCache(siteId: string): void {
  for (const key of siteContextKeys.get(siteId) ?? []) publishedContextCache.delete(key);
  siteContextKeys.delete(siteId);
}

function cachePublishedContext(siteId: string, context: StorefrontContext, expiresAt: number): StorefrontContext {
  const key = storefrontContextCacheKey({
    siteId,
    pageId: context.page.id,
    currentRevision: context.revisions.snapshotRevision,
    factsRevision: context.revisions.factsRevision,
    pageEntityId: context.revisions.pageEntityId,
    copyRevision: context.revisions.copyRevision,
    pageMediaRevision: context.revisions.pageMediaRevision
  });
  const cached = publishedContextCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.context;
  if (cached) publishedContextCache.delete(key);
  publishedContextCache.set(key, { context, expiresAt });
  const keys = siteContextKeys.get(siteId) ?? new Set<string>();
  keys.add(key);
  siteContextKeys.set(siteId, keys);
  if (publishedContextCache.size > 200) {
    const oldest = publishedContextCache.keys().next().value as string | undefined;
    if (oldest) {
      publishedContextCache.delete(oldest);
      for (const [cachedSiteId, cachedKeys] of siteContextKeys) {
        cachedKeys.delete(oldest);
        if (!cachedKeys.size) siteContextKeys.delete(cachedSiteId);
      }
    }
  }
  return context;
}

type PrismaContextBundle = Awaited<ReturnType<typeof loadPrismaBundle>>;

function nextPriceBoundary(bundle: Pick<PrismaContextBundle, "products">, now: number): number | undefined {
  const boundaries = bundle.products.flatMap((product) => product.prices.flatMap((price) => [price.effectiveFrom, price.effectiveTo]))
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value) && value > now);
  return boundaries.length ? Math.min(...boundaries) : undefined;
}

function normalizedPath(value: string): string {
  const clean = value.trim().split("?")[0] || "/";
  return clean === "/" ? "/" : `/${clean.replace(/^\/+|\/+$/g, "")}`;
}

async function loadPrismaBundle(siteId: string) {
  const siteRecord = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      storefrontProfile: true,
      connect: true,
      products: { include: { prices: true } },
      creativePacks: true,
      currentPublishedState: true
    }
  });
  if (!siteRecord) throw new Error("site_not_found");
  const rawCurrentState = siteRecord.currentPublishedState;
  if (!rawCurrentState) throw new Error("current_published_state_missing");
  if (currentPublishedContentHash(rawCurrentState.payload) !== rawCurrentState.contentHash) {
    throw new Error("current_published_state_hash_mismatch");
  }
  const release = await prisma.deploymentRelease.findFirst({
    where: { siteId, status: "applied" },
    orderBy: { appliedAt: "desc" }
  });
  const site = toSite(siteRecord);
  const currentState = site.currentPublishedState as SitePublishedState;
  const payload = currentState.payload;
  const payloadPages = new Map(payload.pages.map((page) => [page.id, page]));
  site.pages = site.pages.map((page) => {
    const current = payloadPages.get(page.id) ?? payload.pages.find((candidate) => candidate.slug === page.slug);
    return current ? { ...page, publishedJson: current.publishedJson, title: current.title ?? page.title } : page;
  });
  site.themeSettings = { ...site.themeSettings, publishedJson: payload.themeSettings };
  if (site.storefrontProfile && payload.storefrontProfile) {
    site.storefrontProfile = { ...site.storefrontProfile, publishedJson: payload.storefrontProfile };
  }
  return {
    site,
    products: siteRecord.products.map(mapProduct),
    creativePacks: siteRecord.creativePacks.map(toCreativePack),
    currentState,
    publication: undefined,
    factsRevision: currentState.payload.revisions.factsRevision,
    buildId: release?.codeCommit,
    publishedPageEntities: Object.fromEntries(currentState.payload.publishedPageEntities.map((entity) => [entity.metadata.canonicalPath, entity])),
    publishedFacts: currentState.payload.publishedFacts,
    publishedPageMedia: Object.fromEntries(currentState.payload.publishedPageMedia.map((entity) => [entity.pageEntityId, entity])),
    publishedStandardPageMedia: Object.fromEntries(currentState.payload.publishedStandardPageMedia.map((entity) => [entity.canonicalPath, entity])),
    publishedLinkRefs: currentState.payload.publishedLinkRefs,
    snapshotIntegrity: "valid" as const
  };
}

const prismaPublishedAdapter: PublishedStorefrontContextAdapter = {
  async loadPublishedBundle(siteId, path) {
    const bundle = await loadPrismaBundle(siteId);
    const page = bundle.site.pages.find((candidate) => candidate.slug === normalizedPath(path));
    if (!page) throw new Error("theme_page_not_found");
    return { ...bundle, page };
  }
};

const prismaDraftAdapter: DraftStorefrontContextAdapter = {
  async loadDraftBundle(siteId, pageId) {
    const bundle = await loadPrismaBundle(siteId);
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
  if (now) return context;
  const expiresAt = Math.min(Date.now() + PUBLISHED_CONTEXT_MAX_TTL_MS, nextPriceBoundary(bundle, observedAt.getTime()) ?? Number.POSITIVE_INFINITY);
  return cachePublishedContext(siteId, context, expiresAt);
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
