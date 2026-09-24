import "server-only";

import { readStorefrontPublicRuntimeStateByHostFromDatabase, readStorefrontPublicRuntimeStateForSiteFromDatabase } from "@/lib/storefront-state";
import type { CreativePack, CreativePackCategory, MediaAsset, PlatformState, Product, PublishedLeafRouteProjection, PublishedRouteProjection, PublishedStandardRouteProjection, PublishedVideoTopicRouteProjection, Site, StorefrontProfileJson, ThemePage, VideoTheme } from "@/lib/types";
import { isMydreamshootsPublicVideoGenerationSlug, publicCollectionPathForSite, publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { isMydreamshootsRetiredPublicPath } from "@/lib/mydreamshoots-legacy-public-redirects";
import { legacyPublicPathTarget } from "@/lib/site-route-canonical";
import { buildPublicationSnapshot } from "@/lib/stores/theme-store";
import { projectPublicPricingOffers, resolveStorefrontContext } from "./core";
import { isPrimaryMydreamshootsSite, resolveSiteCapability } from "./capabilities";
import { isAidreamshootsStorefrontSite } from "@/lib/spanish-storefronts";
import { canonicalPathForPage, canonicalUrlForSite, normalizeCanonicalPath } from "./seo-projection";
import { MYDREAMSHOOTS_STANDARD_SEO_ROUTES } from "@/lib/mydreamshoots-editorial-routes";
import { canonicalSaveTheDatePath, legacySaveTheDatePath, MYDREAMSHOOTS_WEDDING_INVITATION_PATH, MYDREAMSHOOTS_WEDDING_INVITATION_RETIRED_PATH, MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH } from "@/lib/save-the-date-routes";
import { AIDREAMCAPES_EU_SITE_ID, canonicalAidreamcapesEuPublicPath } from "@/lib/aidreamcapes-eu-retired-routes";
import type {
  EffectiveIndexability,
  EffectivePublishedPage,
  EntityReference,
  PublicCollectionItem,
  PublicPageMediaProjection,
  PublicPricingOffer,
  PublishedSiteSnapshot,
  RouteDisposition,
  StorefrontContextBundle
} from "./types";

function normalizePath(value: string): string {
  const clean = value.trim().split("?")[0] || "/";
  return clean === "/" ? "/" : `/${clean.replace(/^\/+|\/+$/g, "")}`;
}

export function assertLiveDraftPage(page: ThemePage): void {
  const json = page.draftJson;
  if (!json || typeof json !== "object" || !json.sections || !Array.isArray(json.sectionsOrder)) {
    throw new Error(`live_draft_invalid:${page.slug}`);
  }
  const sectionIds = new Set(Object.keys(json.sections));
  if (json.sectionsOrder.some((id) => !sectionIds.has(id))) throw new Error(`live_draft_sections_invalid:${page.slug}`);
}

function revision(value: unknown): string {
  const serialized = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isLeafRenderRoute(route: PublishedRouteProjection): route is PublishedLeafRouteProjection {
  return route.disposition === "render" && route.routeKind === "ai-image-theme-leaf";
}

function isPublishedPageEntityRoute(route: PublishedRouteProjection): route is PublishedLeafRouteProjection | PublishedStandardRouteProjection | PublishedVideoTopicRouteProjection {
  return route.disposition === "render" && (route.routeKind === "ai-image-theme-leaf" || route.routeKind === "ai-video-topic-leaf" || route.routeKind === "standard-content");
}

function profileFromPublishedFacts(facts: PublishedSiteSnapshot["publishedFacts"]): StorefrontProfileJson | undefined {
  if (!facts) return undefined;
  return {
    identity: { ...(facts.identity ?? {}), sameAs: [...(facts.identity?.sameAs ?? [])] },
    policyFacts: {
      usesCustomerMediaForTraining: facts.privacy?.customerMediaTraining,
      sourceMediaRetentionDays: facts.privacy?.sourceMediaRetentionDays,
      refundReviewRequired: facts.refund?.reviewRequired,
      refundWindowDays: facts.refund?.windowDays,
      effectiveDate: facts.refund?.effectiveDate,
      creditLifecycle: facts.creditLifecycle,
      security: facts.security
    }
  };
}

function productsFromPublishedOffers(snapshot: NonNullable<Site["activePublication"]>["snapshot"]): Product[] {
  const offers = snapshot.publishedOffers ?? [];
  const products = new Map<string, Product>();
  for (const offer of offers) {
    const product = products.get(offer.productId) ?? {
      id: offer.productId,
      siteId: offer.siteId,
      name: offer.productName,
      type: offer.productType,
      status: "active" as const,
      metadata: offer.productMetadata,
      prices: []
    };
    product.prices.push({
      id: offer.priceId,
      siteId: offer.siteId,
      productId: offer.productId,
      label: offer.priceLabel,
      amountCents: offer.amountCents,
      currency: offer.currency,
      interval: offer.interval,
      creditsGranted: offer.creditsGranted,
      stripePriceId: offer.stripePriceId,
      metadata: offer.priceMetadata,
      status: "active",
      providerVerifiedAt: "published-snapshot",
      providerFingerprint: offer.revision
    });
    products.set(product.id, product);
  }
  return [...products.values()];
}

function creativePacksFromPublishedCollections(
  snapshot: NonNullable<Site["activePublication"]>["snapshot"],
  publishedAt: string | undefined,
  siteId: string
): CreativePack[] {
  return (snapshot.publishedCollectionRefs ?? []).map((ref) => {
    const media = (snapshot.publishedPageMedia ?? []).find((candidate) => candidate.pageEntityId === ref.pageEntityId);
    return {
      id: ref.sourcePackId,
      siteId,
      name: ref.label,
      headline: ref.label,
      description: ref.summary,
      category: ref.categorySlug ?? ref.collectionSlug,
      aiAppSlug: ref.collectionSlug,
      // Route/media review status controls indexing, not whether an existing
      // package can be viewed. Keep packs with a real primary image active so
      // focused detail pages render their own gallery instead of falling back
      // to the legacy generic hero image.
      status: media?.primaryImage ? "active" : "draft",
      creditCost: ref.creditCost,
      outputCount: ref.outputCount,
      trainingRequired: false,
      generationCount: 0,
      conversionRate: 0,
      createdAt: publishedAt ?? "1970-01-01T00:00:00.000Z",
      imageUrl: media?.primaryImage ?? ref.image,
      galleryImages: media?.galleryImages ?? [],
      galleryImageAlts: media?.imageAlts ?? (ref.imageAlt ? [ref.imageAlt] : [])
    };
  });
}

function isPrivateStorefrontPath(path: string): boolean {
  const value = normalizePath(path);
  return value === "/account" || value === "/app" || value.startsWith("/app/") || value === "/album" || value.startsWith("/album/") || value === "/cart" || value === "/checkout" || value === "/dashboard" || value === "/login" || value === "/logout";
}

const DEFERRED_MYDREAMSHOOTS_VIDEO_PATHS = new Set([
  "/ai-video-generation/text-to-video",
  "/ai-video-generation/image-to-video"
]);
const MYDREAMSHOOTS_STANDARD_SEO_PATHS = new Set<string>(MYDREAMSHOOTS_STANDARD_SEO_ROUTES);

function bundleFor(snapshot: PublishedSiteSnapshot, page: ThemePage): StorefrontContextBundle {
  return {
    site: snapshot.site,
    page,
    products: snapshot.products,
    creativePacks: snapshot.creativePacks,
    publication: snapshot.publication,
    factsRevision: snapshot.factsRevision,
    buildId: snapshot.buildId,
    publishedFacts: snapshot.publishedFacts,
    publishedPageMedia: Object.fromEntries(snapshot.publishedPageMedia.map((projection) => [projection.pageEntityId, projection])),
    publishedStandardPageMedia: Object.fromEntries(snapshot.publishedStandardPageMedia.map((projection) => [projection.canonicalPath, projection])),
    snapshotIntegrity: snapshot.snapshotIntegrity,
    publishedPageEntities: Object.fromEntries(snapshot.publishedPageEntities.map((projection) => [projection.canonicalPath, projection])),
    publishedLinkRefs: snapshot.publishedLinkRefs
  };
}

export function resolvePublishedSeoEntity(snapshot: PublishedSiteSnapshot, canonicalPath: string) {
  const path = normalizePath(canonicalPath);
  const route = snapshot.publishedRoutes.find((candidate) => candidate.disposition === "render" && candidate.canonicalPath === path);
  const pageEntity = route && isPublishedPageEntityRoute(route)
    ? snapshot.publishedPageEntities.find((candidate) => candidate.pageEntityId === route.pageEntityId)
    : undefined;
  const pageCopy = pageEntity
    ? snapshot.publishedPageCopy.find((candidate) => candidate.pageEntityId === pageEntity.pageEntityId)
    : undefined;
  const pageMedia = pageEntity
    ? snapshot.publishedPageMedia.find((candidate) => candidate.pageEntityId === pageEntity.pageEntityId)
    : undefined;
  const standardPageMedia = snapshot.publishedStandardPageMedia.find((candidate) => candidate.canonicalPath === path);
  const ownerPageEntityId = pageEntity?.pageEntityId ?? standardPageMedia?.pageEntityId;
  return {
    route,
    pageEntity,
    pageCopy,
    pageMedia,
    standardPageMedia,
    facts: snapshot.publishedFacts,
    offers: snapshot.publishedOffers,
    collectionRefs: ownerPageEntityId
      ? snapshot.publishedCollectionRefs.filter((candidate) => candidate.ownerPageEntityId === ownerPageEntityId)
      : [],
    linkRefs: ownerPageEntityId
      ? snapshot.publishedLinkRefs.filter((candidate) => candidate.ownerPageEntityId === ownerPageEntityId)
      : [],
    revisions: snapshot.snapshotRevisions,
    publicationIdentity: {
      publicationId: snapshot.publicationId,
      publicationVersion: snapshot.publicationVersion,
      snapshotHash: snapshot.publication?.snapshot.snapshotHash,
      buildId: snapshot.buildId
    }
  };
}

export function createPublishedSiteSnapshot(
  state: PlatformState,
  site: Site,
  options: { source?: "postgres" | "platform-state" } = {}
): PublishedSiteSnapshot {
  // Public content is compiled from the latest draft records on every request.
  // The projection remains in-memory only; no publication/current-state row is
  // consulted and no historical payload can become a public fallback.
  const sourceSite: Site = {
    ...site,
    // Exclude malformed unrelated pages from the projection. The requested
    // route validates its own draft and returns 404 before rendering.
    pages: site.pages
      .filter((page) => {
        try { assertLiveDraftPage(page); return true; } catch { return false; }
      })
      .map((page) => ({ ...page, publishedJson: page.draftJson })),
    themeSettings: { ...site.themeSettings, publishedJson: site.themeSettings.draftJson },
    storefrontProfile: site.storefrontProfile
      ? { ...site.storefrontProfile, publishedJson: site.storefrontProfile.draftJson }
      : undefined
  };
  const liveProjection = buildPublicationSnapshot(
    sourceSite,
    undefined,
    (state.creativePacks ?? []) as never,
    state.products ?? []
  );
  const publishedAt = new Date().toISOString();
  const snapshotIntegrity = "valid" as const;
  const pages = liveProjection.pages.map((publishedPage): ThemePage => {
    const currentPage = site.pages.find((page) => page.id === publishedPage.id);
    return { ...currentPage, ...publishedPage, draftJson: publishedPage.publishedJson, publishedJson: publishedPage.publishedJson } as ThemePage;
  });
  const publishedSettings = { ...site.themeSettings, publishedJson: liveProjection.themeSettings };
  const publishedFacts = liveProjection.publishedFacts;
  const publishedProfile = profileFromPublishedFacts(publishedFacts) ?? liveProjection.storefrontProfile;
  const publishedSite = { ...sourceSite, pages, themeSettings: publishedSettings, storefrontProfile: sourceSite.storefrontProfile && publishedProfile ? { ...sourceSite.storefrontProfile, publishedJson: publishedProfile } : sourceSite.storefrontProfile };
  const publishedRoutes = liveProjection.publishedRoutes;
  const publishedPaths = Array.from(new Set([
    ...pages.flatMap((page) => [normalizePath(page.slug), canonicalPathForPage(page)]),
    ...publishedRoutes.flatMap((route) => route.disposition === "render" && route.status === "published" ? [route.canonicalPath] : [])
  ]));
  const products = productsFromPublishedOffers(liveProjection);
  const creativePacks = creativePacksFromPublishedCollections(liveProjection, publishedAt, site.id);
  const creativePackCategories: CreativePackCategory[] = [];
  const videoThemes: VideoTheme[] = [];
  const mediaAssets: MediaAsset[] = [];
  const baseEntityReferences: EntityReference[] = [
    ...pages.map((page) => ({ entityType: "page" as const, entityId: page.id, ownerId: site.id, revision: page.draftMeta?.etag ?? revision([page.id, page.publishedJson.version, page.updatedAt]), updatedAt: page.updatedAt })),
    ...publishedRoutes.map((route) => ({
      entityType: "route_manifest" as const,
      entityId: route.disposition === "redirect" ? route.aliasPath : route.canonicalPath,
      ownerId: route.disposition === "redirect" ? route.targetPath : route.pageEntityId,
      revision: route.disposition === "redirect" ? route.routeRevision : route.pageRevision,
      updatedAt: route.disposition === "redirect" ? route.routeRevision : route.disposition === "render" && route.routeKind === "ai-image-theme-leaf" ? route.copyRevision : route.pageRevision
    })),
    { entityType: "theme_settings" as const, entityId: site.id, ownerId: site.id, revision: revision(publishedSettings.publishedJson) },
    ...products.flatMap((product) => [
      { entityType: "product" as const, entityId: product.id, ownerId: site.id, revision: revision([product.id, product.metadata, product.status]) },
      ...product.prices.map((price) => ({ entityType: "price" as const, entityId: price.id, ownerId: site.id, revision: revision([price.id, price.amountCents, price.currency, price.interval, price.status, price.effectiveFrom, price.effectiveTo]) }))
    ]),
    ...creativePacks.map((pack) => ({ entityType: "creative_pack" as const, entityId: pack.id, ownerId: site.id, revision: revision([pack.id, pack.createdAt, pack.status, pack.creditCost, pack.outputCount, pack.imageUrl, pack.galleryImages]), updatedAt: pack.createdAt })),
    ...videoThemes.map((theme) => ({ entityType: "video_theme" as const, entityId: theme.id, ownerId: site.id, revision: revision([theme.id, theme.createdAt, theme.status, theme.slug, theme.imageUrl, theme.galleryImages]), updatedAt: theme.createdAt })),
    ...mediaAssets.map((asset) => ({ entityType: "media" as const, entityId: asset.id, ownerId: site.id, revision: revision([asset.id, asset.createdAt, asset.storageKey, asset.previewUrl, asset.originUrl]) }))
  ];
  const snapshotRevisions = liveProjection.revisions;
  const publishedPageCopy = liveProjection.publishedPageCopy;
  const publishedPageMedia = liveProjection.publishedPageMedia;
  const publishedStandardPageMedia = liveProjection.publishedStandardPageMedia;
  const publishedPackFacts = liveProjection.publishedPackFacts;
  const publishedCollectionRefs = liveProjection.publishedCollectionRefs;
  const publishedPageEntities = liveProjection.publishedPageEntities;
  const publishedOffers = liveProjection.publishedOffers;
  const publishedLinkRefs = liveProjection.publishedLinkRefs;
  const publishedVideoNavigation = liveProjection.publishedVideoNavigation;
  const publishedHomepageShowcases = liveProjection.publishedHomepageShowcases;
  const entityReferences: EntityReference[] = [
    ...baseEntityReferences,
    ...publishedPageCopy.map((copy) => ({ entityType: "page_copy" as const, entityId: copy.pageEntityId, ownerId: site.id, revision: copy.copyRevision })),
    ...publishedPageMedia.map((media) => ({ entityType: "page_media" as const, entityId: media.mediaEntityId, ownerId: media.ownerPageEntityId, revision: media.entityRevision })),
    ...publishedStandardPageMedia.map((media) => ({ entityType: "page_media" as const, entityId: media.mediaEntityId, ownerId: media.pageEntityId, revision: media.revision }))
  ];
  const factsRevision = snapshotRevisions.factsRevision ?? publishedFacts?.claimRevision ?? revision({ siteId: site.id, profile: publishedProfile });
  return {
    boundary: {
      siteId: site.id,
      source: options.source ?? "platform-state",
      publicationId: null,
      publicationVersion: null
    },
    site: publishedSite,
    themeSettings: publishedSettings.publishedJson,
    publication: undefined,
    publicationVersion: undefined,
    publicationId: undefined,
    factsRevision,
    buildId: liveProjection.buildId ?? (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "local"),
    pages,
    publishedPaths,
    publishedRoutes,
    publishedPageCopy,
    publishedPageEntities,
    publishedPageMedia,
    publishedStandardPageMedia,
    publishedPackFacts,
    publishedOffers,
    publishedFacts,
    publishedCollectionRefs,
    publishedLinkRefs,
    publishedVideoNavigation,
    publishedHomepageShowcases,
    snapshotRevisions,
    legacyProjectionRequired: false,
    snapshotIntegrity,
    products,
    creativePacks,
    creativePackCategories,
    videoThemes,
    mediaAssets,
    profile: publishedProfile,
    capability: resolveSiteCapability(publishedSite),
    entityReferences
  };
}

export async function loadPublishedSiteSnapshotByHost(host: string | null | undefined): Promise<PublishedSiteSnapshot> {
  const state = await readStorefrontPublicRuntimeStateByHostFromDatabase(host);
  const site = state?.sites[0];
  if (!state || !site) throw new Error("published_site_snapshot_not_found");
  return createPublishedSiteSnapshot(state, site, { source: "postgres" });
}

export async function loadPublishedSiteSnapshotBySiteId(siteId: string): Promise<PublishedSiteSnapshot> {
  const state = await readStorefrontPublicRuntimeStateForSiteFromDatabase(siteId);
  if (!state) throw new Error("published_site_snapshot_not_found");
  const site = state.sites.find((candidate) => candidate.id === siteId);
  if (!site) throw new Error("published_site_snapshot_not_found");
  return createPublishedSiteSnapshot(state, site, { source: "postgres" });
}

export function resolvePublishedStorefrontContext(snapshot: PublishedSiteSnapshot, page: ThemePage) {
  const context = resolveStorefrontContext(bundleFor(snapshot, page), "published");
  const resolved = resolvePublishedSeoEntity(snapshot, context.seo.canonicalPath);
  const media = resolved.pageMedia;
  const standardMedia = resolved.standardPageMedia;
  return {
    ...context,
    revisions: {
      ...context.revisions,
      pageMediaRevision: media?.entityRevision,
      ...(standardMedia ? { standardPageMediaRevision: standardMedia.revision } : {})
    },
    publishedPaths: snapshot.publishedPaths
  };
}

export function resolveEffectiveIndexability(snapshot: PublishedSiteSnapshot, page: ThemePage, context = resolveStorefrontContext(bundleFor(snapshot, page), "published")): EffectiveIndexability {
  const canonicalPath = normalizePath(context.seo.canonicalPath);
  const deferred = isPrimaryMydreamshootsSite(snapshot.site) && DEFERRED_MYDREAMSHOOTS_VIDEO_PATHS.has(canonicalPath);
  const blocked = deferred || page.pageType === "not_found" || page.slug === "/404" || isPrivateStorefrontPath(page.slug) || isPrivateStorefrontPath(canonicalPath);
  const resolved = resolvePublishedSeoEntity(snapshot, context.seo.canonicalPath);
  const publishedRoute = resolved.route && isPublishedPageEntityRoute(resolved.route) ? resolved.route : undefined;
  const publishedMedia = resolved.pageMedia;
  const standardMedia = resolved.standardPageMedia;
  const mediaReady = publishedRoute
    ? publishedRoute.indexable && (publishedRoute.routeKind === "standard-content" ? standardMedia?.status === "ready" : publishedMedia?.status === "ready")
      : MYDREAMSHOOTS_STANDARD_SEO_PATHS.has(canonicalPath)
      ? standardMedia?.status === "ready"
      : true;
  // The wedding invitation route predates the dedicated topic section. Keep
  // its verified AI-tool SEO contract indexable while the legacy content is
  // rendered through the compatibility page projection.
  const legacyWeddingInvitation = isPrimaryMydreamshootsSite(snapshot.site) && [MYDREAMSHOOTS_WEDDING_INVITATION_PATH, MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH].includes(canonicalPath) && page.pageType === "ai_tool";
  const index = !blocked && (legacyWeddingInvitation || context.seo.index) && (legacyWeddingInvitation || mediaReady);
  return {
    index,
    follow: blocked ? false : context.seo.follow,
    sitemapEligible: index && (legacyWeddingInvitation || context.seo.sitemapEligible) && (legacyWeddingInvitation || snapshot.publishedPaths.includes(normalizePath(context.seo.canonicalPath))) && (publishedRoute ? publishedRoute.sitemapEligible : true)
  };
}

export function resolveEffectivePublishedPage(snapshot: PublishedSiteSnapshot, path: string): EffectivePublishedPage {
  const requestedPath = normalizePath(path);
  const directPage = snapshot.pages.find((page) => normalizePath(page.slug) === requestedPath);
  const canonicalPage = snapshot.pages.find((page) => canonicalPathForPage(page) === requestedPath);
  const legacyPage = isPrimaryMydreamshootsSite(snapshot.site) && requestedPath.startsWith("/ai-save-the-date/")
    ? snapshot.pages.find((candidate) => normalizePath(candidate.slug) === legacySaveTheDatePath(requestedPath))
    : undefined;
  const page = directPage ?? canonicalPage ?? legacyPage;
  if (!page) {
    const fallbackPage = snapshot.pages.find((candidate) => canonicalPathForPage(candidate) === normalizePath(candidate.slug));
    if (!fallbackPage) {
      throw new Error("published_page_set_empty");
    }
    const fallbackContext = resolveStorefrontContext(bundleFor(snapshot, fallbackPage), "published");
    return {
      boundary: snapshot.boundary,
      siteId: snapshot.site.id,
      pageId: null,
      requestedPath,
      publicPath: requestedPath,
      pageJson: null,
      page: fallbackPage,
      context: fallbackContext,
      routeDisposition: { kind: "not_found", status: 404, path: requestedPath },
      indexability: { index: false, follow: false, sitemapEligible: false }
    };
  }
  const context = resolveStorefrontContext(bundleFor(snapshot, page), "published");
  const canonical = normalizeCanonicalPath(context.seo.canonicalPath);
  const routeDisposition: RouteDisposition = directPage && canonical !== requestedPath
    ? resolvePublishedRedirectDisposition(snapshot, requestedPath, canonical)
    : { kind: "render", status: 200, path: requestedPath, pageId: page.id };
  return {
    boundary: snapshot.boundary,
    siteId: snapshot.site.id,
    pageId: page.id,
    requestedPath,
    publicPath: canonical,
    pageJson: context.pageJson,
    page,
    context,
    routeDisposition,
    indexability: resolveEffectiveIndexability(snapshot, page, context)
  };
}

export function resolvePublishedRouteDisposition(snapshot: PublishedSiteSnapshot, path: string): RouteDisposition {
  const requestedPath = normalizePath(path);
  if (!snapshot.pages.length) return { kind: "not_found", status: 404, path: requestedPath };
  if (isPrimaryMydreamshootsSite(snapshot.site) && isMydreamshootsRetiredPublicPath(requestedPath)) {
    return { kind: "not_found", status: 404, path: requestedPath };
  }
  if (isPrimaryMydreamshootsSite(snapshot.site) && (requestedPath === MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH || requestedPath === MYDREAMSHOOTS_WEDDING_INVITATION_RETIRED_PATH)) {
    return { kind: "not_found", status: 404, path: requestedPath };
  }
  if (isPrimaryMydreamshootsSite(snapshot.site) && requestedPath === MYDREAMSHOOTS_WEDDING_INVITATION_PATH) {
    const directPage = snapshot.pages.find((candidate) => normalizePath(candidate.slug) === MYDREAMSHOOTS_WEDDING_INVITATION_PATH);
    if (directPage) return { kind: "render", status: 200, path: requestedPath, pageId: directPage.id };
    const sourcePage = snapshot.pages.find((candidate) => normalizePath(candidate.slug) === MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH && candidate.pageType === "ai_tool");
    if (sourcePage) return { kind: "render", status: 200, path: requestedPath, pageId: sourcePage.id };
    return { kind: "not_found", status: 404, path: requestedPath };
  }
  if (isAidreamshootsStorefrontSite(snapshot.site) && requestedPath === "/ai-image-generation/urban") {
    const canonicalPath = publicCollectionPathForSite(snapshot.site, "urbano");
    if (canonicalPath !== requestedPath && snapshot.publishedPaths.includes(canonicalPath)) {
      return resolvePublishedRedirectDisposition(snapshot, requestedPath, canonicalPath, 301);
    }
  }
  // Resolve legacy Save the Date aliases before direct page lookup. Otherwise
  // an old ThemePage row can render at 200 and split the page's SEO identity.
  if (isPrimaryMydreamshootsSite(snapshot.site) && (requestedPath.startsWith("/holidays-events/") || requestedPath === "/ai-video-generation/wedding-ceremony")) {
    const canonicalPath = normalizeCanonicalPath(canonicalSaveTheDatePath(requestedPath));
    if (canonicalPath !== requestedPath && snapshot.publishedPaths.includes(canonicalPath)) {
      return resolvePublishedRedirectDisposition(snapshot, requestedPath, canonicalPath, 301);
    }
  }
  if (isPrimaryMydreamshootsSite(snapshot.site) && DEFERRED_MYDREAMSHOOTS_VIDEO_PATHS.has(requestedPath)) {
    return { kind: "not_found", status: 404, path: requestedPath };
  }
  if (snapshot.site.id === AIDREAMCAPES_EU_SITE_ID) {
    const canonicalPath = canonicalAidreamcapesEuPublicPath(requestedPath);
    if (canonicalPath !== requestedPath && snapshot.publishedPaths.includes(canonicalPath)) {
      return resolvePublishedRedirectDisposition(snapshot, requestedPath, canonicalPath, 308);
    }
  }
  const exactPublishedRoute = snapshot.publishedRoutes.find((route) =>
    route.disposition === "redirect" ? route.aliasPath === requestedPath : route.canonicalPath === requestedPath
  );
  if (!exactPublishedRoute && isPrimaryMydreamshootsSite(snapshot.site) && requestedPath.startsWith("/ai-save-the-date/")) {
    const legacyPath = legacySaveTheDatePath(requestedPath);
    const legacyRoute = legacyPath && snapshot.publishedRoutes.find((route) => route.disposition === "render" && route.canonicalPath === legacyPath);
    if (legacyRoute) {
      const pageId = "pageId" in legacyRoute
        ? legacyRoute.pageId
        : snapshot.pages.find((page) => normalizePath(page.slug) === legacyPath || canonicalPathForPage(page) === legacyPath)?.id;
      if (pageId) return { kind: "render", status: 200, path: requestedPath, pageId };
    }
  }
  if (exactPublishedRoute?.disposition === "redirect") {
    return resolvePublishedRedirectDisposition(snapshot, requestedPath, exactPublishedRoute.targetPath, exactPublishedRoute.statusCode);
  }
  if (exactPublishedRoute?.disposition === "render" && exactPublishedRoute.routeKind === "policy") {
    const page = snapshot.pages.find((candidate) => candidate.id === exactPublishedRoute.pageId);
    return page
      ? { kind: "render", status: 200, path: requestedPath, pageId: page.id }
      : { kind: "not_found", status: 404, path: requestedPath };
  }
  if (exactPublishedRoute?.disposition === "render" && exactPublishedRoute.routeKind === "ai-video-topic-leaf") {
    if (exactPublishedRoute.status !== "published") return { kind: "not_found", status: 404, path: requestedPath };
    const page = snapshot.pages.find((candidate) => candidate.id === exactPublishedRoute.pageId && normalizePath(candidate.slug) === requestedPath);
    return page
      ? { kind: "render", status: 200, path: requestedPath, pageId: page.id }
      : { kind: "not_found", status: 404, path: requestedPath };
  }
  if (exactPublishedRoute?.disposition === "render" && exactPublishedRoute.routeKind === "standard-content") {
    if (exactPublishedRoute.status !== "published") return { kind: "not_found", status: 404, path: requestedPath };
    const page = snapshot.pages.find((candidate) => candidate.id === exactPublishedRoute.pageId && normalizePath(candidate.slug) === requestedPath);
    const entity = snapshot.publishedPageEntities.find((candidate) => candidate.pageEntityId === exactPublishedRoute.pageEntityId && candidate.canonicalPath === requestedPath && candidate.status === "published");
    const media = snapshot.publishedStandardPageMedia.find((candidate) => candidate.canonicalPath === requestedPath && candidate.mediaEntityId === exactPublishedRoute.mediaEntityId && candidate.status === "ready");
    return page && entity && media
      ? { kind: "render", status: 200, path: requestedPath, pageId: page.id }
      : { kind: "not_found", status: 404, path: requestedPath };
  }
  if (isPrimaryMydreamshootsSite(snapshot.site) && requestedPath.startsWith("/ai-video-generation/")) {
    const toolSlug = requestedPath.slice("/ai-video-generation/".length);
    const page = isMydreamshootsPublicVideoGenerationSlug(toolSlug)
      ? snapshot.pages.find((candidate) => candidate.slug === requestedPath && candidate.pageType === "ai_tool" && candidate.publishedJson.seo?.canonicalPath === requestedPath)
      : undefined;
    if (page) return { kind: "render", status: 200, path: requestedPath, pageId: page.id };
  }
  const legacyTarget = legacyPublicPathTarget(requestedPath, publicCollectionRootPathForSite(snapshot.site));
  if (legacyTarget) return resolvePublishedRedirectDisposition(snapshot, requestedPath, legacyTarget);
  if (isPrimaryMydreamshootsSite(snapshot.site) && requestedPath.startsWith("/ai-image-generation/")) {
    const route = snapshot.publishedRoutes.find((candidate): candidate is PublishedLeafRouteProjection => isLeafRenderRoute(candidate) && candidate.canonicalPath === requestedPath);
    if (!route || route.status !== "published") {
      return { kind: "not_found", status: 404, path: requestedPath };
    }
    const rootPage = snapshot.pages.find((page) => canonicalPathForPage(page) === publicCollectionRootPathForSite(snapshot.site) || normalizePath(page.slug) === publicCollectionRootPathForSite(snapshot.site));
    if (rootPage) return { kind: "render", status: 200, path: requestedPath, pageId: rootPage.id };
  }
  return resolveEffectivePublishedPage(snapshot, path).routeDisposition;
}

export function resolvePublishedRedirectDisposition(
  snapshot: PublishedSiteSnapshot,
  sourcePath: string,
  targetPath: string,
  status: 301 | 302 | 307 | 308 = 301
): RouteDisposition {
  const source = normalizeCanonicalPath(sourcePath);
  const target = normalizeCanonicalPath(targetPath);
  if (!snapshot.publishedPaths.includes(target)) return { kind: "not_found", status: 404, path: source };
  const targetPage = snapshot.pages.find((page) => normalizePath(page.slug) === target || canonicalPathForPage(page) === target);
  if (!targetPage || canonicalPathForPage(targetPage) !== target) return { kind: "not_found", status: 404, path: source };
  return {
    kind: "redirect",
    status,
    path: source,
    targetPath: target,
    targetUrl: target,
    targetPageId: targetPage.id
  };
}

export function resolvePublicCollectionItems(snapshot: PublishedSiteSnapshot): PublicCollectionItem[] {
  return snapshot.creativePacks
    .filter((pack) => pack.status === "active" && pack.creditCost > 0 && pack.outputCount > 0)
    .map((pack) => {
      const imageUrl = pack.imageUrl?.trim() || pack.galleryImages?.find((image) => image.trim())?.trim() || "";
      return {
        id: pack.id,
        ownerId: pack.siteId,
        revision: snapshot.entityReferences.find((reference) => reference.entityType === "creative_pack" && reference.entityId === pack.id)?.revision ?? revision(pack),
        name: pack.name,
        description: pack.description || pack.headline,
        categorySlug: pack.categoryRecord?.slug || pack.category || undefined,
        imageUrl,
        imageAlt: pack.name,
        creditCost: pack.creditCost,
        outputCount: pack.outputCount,
        source: pack
      };
    })
    .filter((item) => item.imageUrl);
}

export function resolvePublicPricingOffers(snapshot: PublishedSiteSnapshot, page?: ThemePage): PublicPricingOffer[] {
  const targetPage = page ?? snapshot.pages.find((candidate) => candidate.slug === "/pricing") ?? snapshot.pages[0];
  if (!targetPage) return [];
  const context = resolveStorefrontContext(bundleFor(snapshot, targetPage), "published");
  const explicitProductIds = new Set<string>();
  for (const sectionId of targetPage.publishedJson.sectionsOrder) {
    const settings = targetPage.publishedJson.sections[sectionId]?.settings ?? {};
    const value = settings.featuredProductId;
    if (typeof value === "string" && value.trim()) explicitProductIds.add(value.trim());
  }
  return projectPublicPricingOffers(context)
    .filter((offer) => !explicitProductIds.size || explicitProductIds.has(offer.product.id));
}

export function resolvePublicPageMedia(snapshot: PublishedSiteSnapshot, page: ThemePage): PublicPageMediaProjection[] {
  const referenced = new Set<string>();
  for (const sectionId of page.publishedJson.sectionsOrder) {
    const section = page.publishedJson.sections[sectionId];
    for (const [key, value] of Object.entries(section?.settings ?? {})) {
      if (!/(media|image|src|logo|icon)/i.test(key) || typeof value !== "string" || !value.startsWith("media_")) continue;
      referenced.add(value);
    }
  }
  const assets = snapshot.mediaAssets.filter((asset) => referenced.has(asset.id));
  return assets.map((asset: MediaAsset) => ({
    id: asset.id,
    ownerId: asset.siteId,
    entityRevision: snapshot.entityReferences.find((reference) => reference.entityType === "media" && reference.entityId === asset.id)?.revision ?? revision(asset),
    usage: asset.usage,
    url: asset.previewUrl || asset.originUrl || asset.storageKey,
    alt: asset.altText || asset.label,
    required: asset.usage === "brand" || asset.usage === "theme"
  }));
}

export function snapshotContextBundle(snapshot: PublishedSiteSnapshot, page: ThemePage): StorefrontContextBundle {
  return bundleFor(snapshot, page);
}
