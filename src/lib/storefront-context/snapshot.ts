import "server-only";

import { readStorefrontPublicRuntimeStateByHostFromDatabase } from "@/lib/storefront-state";
import type { CreativePack, CreativePackCategory, MediaAsset, PlatformState, Product, PublishedLeafRouteProjection, PublishedRouteProjection, PublishedStandardRouteProjection, PublishedVideoTopicRouteProjection, Site, StorefrontProfileJson, ThemePage, ThemePublication, VideoTheme } from "@/lib/types";
import { readStorefrontPlatformStateFromDatabase } from "@/lib/storefront-state";
import { publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { legacyPublicPathTarget } from "@/lib/site-route-canonical";
import { publicationSnapshotIntegrity } from "@/lib/publication-snapshot-integrity";
import { projectPublicPricingOffers, resolveStorefrontContext } from "./core";
import { isPrimaryMydreamshootsSite, resolveSiteCapability } from "./capabilities";
import { canonicalPathForPage, canonicalUrlForSite, normalizeCanonicalPath } from "./seo-projection";
import { MYDREAMSHOOTS_STANDARD_SEO_ROUTES } from "@/lib/mydreamshoots-editorial-routes";
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
      status: ref.status === "published" ? "active" : "draft",
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
  const isMydreamshootsPublicationSite = isPrimaryMydreamshootsSite(site);
  // Public rendering is intentionally fail-closed. CurrentPublishedState is
  // the only public owner; historical publications and active pointers are
  // never consulted.
  const currentState = site.currentPublishedState;
  if (!currentState) throw new Error("published_snapshot_current_state_required");
  const publication = {
    id: `current-state:${site.id}`,
    siteId: site.id,
    version: 0,
    snapshot: currentState.payload,
    publishedBy: currentState.publishedBy,
    publishedAt: currentState.publishedAt,
    factsRevision: currentState.payload.revisions.factsRevision
  } as ThemePublication;
  const snapshotIntegrity = publicationSnapshotIntegrity(publication.snapshot);
  if (snapshotIntegrity !== "valid") throw new Error("published_snapshot_integrity_invalid");
  const currentPages = new Map(site.pages.map((page) => [page.id, page]));
  const snapshotPages = publication.snapshot.pages;
  const pages = snapshotPages.map((publishedPage): ThemePage => {
    const currentPage = currentPages.get(publishedPage.id);
    return {
      id: publishedPage.id,
      siteId: publishedPage.siteId ?? site.id,
      pageType: publishedPage.pageType ?? currentPage?.pageType ?? "page",
      templateKey: publishedPage.templateKey ?? currentPage?.templateKey,
      slug: publishedPage.slug,
      title: publishedPage.title ?? currentPage?.title ?? publishedPage.slug,
      draftJson: publishedPage.publishedJson,
      publishedJson: publishedPage.publishedJson,
      createdAt: publishedPage.createdAt ?? currentPage?.createdAt,
      updatedAt: publishedPage.updatedAt ?? currentPage?.updatedAt
    };
  });
  const publicationThemeSettings = publication?.snapshot?.themeSettings;
  const publishedSettings = publicationThemeSettings
    ? {
        ...site.themeSettings,
        publishedJson: publicationThemeSettings
      }
    : site.themeSettings;
  const hasImmutableSeoProjection = snapshotIntegrity === "valid";
  const publishedFacts = hasImmutableSeoProjection ? publication?.snapshot.publishedFacts : undefined;
  const publishedProfile = hasImmutableSeoProjection
    ? profileFromPublishedFacts(publishedFacts)
    : publication.snapshot.storefrontProfile;
  const publishedSite = {
    ...site,
    pages,
    themeSettings: publishedSettings,
    storefrontProfile: site.storefrontProfile && publishedProfile
      ? { ...site.storefrontProfile, publishedJson: publishedProfile }
      : site.storefrontProfile
  };
  const snapshotRoutes = publication?.snapshot?.publishedRoutes;
  const publishedRoutes = hasImmutableSeoProjection
    ? (Array.isArray(snapshotRoutes) ? snapshotRoutes as PublishedSiteSnapshot["publishedRoutes"] : [])
    : [];
  const publishedPaths = Array.from(new Set([
    ...pages.flatMap((page) => [normalizePath(page.slug), canonicalPathForPage(page)]),
    ...publishedRoutes.flatMap((route) => route.disposition === "render" && route.status === "published" ? [route.canonicalPath] : [])
  ]));
  const products = productsFromPublishedOffers(publication.snapshot);
  const creativePacks = creativePacksFromPublishedCollections(publication.snapshot, publication.publishedAt, site.id);
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
  const snapshotRevisions = publication?.snapshot?.revisions ?? {};
  const publishedPageCopy = hasImmutableSeoProjection && Array.isArray(publication?.snapshot?.publishedPageCopy)
    ? publication!.snapshot.publishedPageCopy as PublishedSiteSnapshot["publishedPageCopy"]
    : [];
  const publishedPageMedia = hasImmutableSeoProjection
    ? (Array.isArray(publication?.snapshot?.publishedPageMedia) ? publication!.snapshot.publishedPageMedia as PublishedSiteSnapshot["publishedPageMedia"] : [])
    : [];
  const publishedStandardPageMedia = hasImmutableSeoProjection
    ? (Array.isArray(publication?.snapshot?.publishedStandardPageMedia) ? publication!.snapshot.publishedStandardPageMedia as PublishedSiteSnapshot["publishedStandardPageMedia"] : [])
    : [];
  const publishedPackFacts = hasImmutableSeoProjection
    ? (Array.isArray(publication?.snapshot?.publishedPackFacts) ? publication!.snapshot.publishedPackFacts as PublishedSiteSnapshot["publishedPackFacts"] : [])
    : [];
  const publishedCollectionRefs = hasImmutableSeoProjection && Array.isArray(publication?.snapshot?.publishedCollectionRefs)
    ? publication!.snapshot.publishedCollectionRefs as PublishedSiteSnapshot["publishedCollectionRefs"]
    : [];
  const publishedPageEntities = hasImmutableSeoProjection && Array.isArray(publication?.snapshot?.publishedPageEntities)
    ? publication!.snapshot.publishedPageEntities as PublishedSiteSnapshot["publishedPageEntities"]
    : [];
  const publishedOffers = hasImmutableSeoProjection && Array.isArray(publication?.snapshot?.publishedOffers)
    ? publication!.snapshot.publishedOffers as PublishedSiteSnapshot["publishedOffers"]
    : [];
  const publishedLinkRefs = hasImmutableSeoProjection && Array.isArray(publication?.snapshot?.publishedLinkRefs)
    ? publication!.snapshot.publishedLinkRefs as PublishedSiteSnapshot["publishedLinkRefs"]
    : [];
  const publishedVideoNavigation = hasImmutableSeoProjection && Array.isArray(publication?.snapshot?.publishedVideoNavigation)
    ? publication!.snapshot.publishedVideoNavigation as PublishedSiteSnapshot["publishedVideoNavigation"]
    : [];
  const publishedHomepageShowcases = hasImmutableSeoProjection && Array.isArray(publication?.snapshot?.publishedHomepageShowcases)
    ? publication!.snapshot.publishedHomepageShowcases as PublishedSiteSnapshot["publishedHomepageShowcases"]
    : [];
  const entityReferences: EntityReference[] = [
    ...baseEntityReferences,
    ...publishedPageCopy.map((copy) => ({ entityType: "page_copy" as const, entityId: copy.pageEntityId, ownerId: site.id, revision: copy.copyRevision })),
    ...publishedPageMedia.map((media) => ({ entityType: "page_media" as const, entityId: media.mediaEntityId, ownerId: media.ownerPageEntityId, revision: media.entityRevision })),
    ...publishedStandardPageMedia.map((media) => ({ entityType: "page_media" as const, entityId: media.mediaEntityId, ownerId: media.pageEntityId, revision: media.revision }))
  ];
  const factsRevision = hasImmutableSeoProjection
    ? snapshotRevisions.factsRevision ?? publishedFacts?.claimRevision ?? "published-facts-missing"
    : isMydreamshootsPublicationSite ? "publication-snapshot-invalid" : publication?.factsRevision ?? revision({
        siteId: site.id,
      publicationId: undefined,
      publicationVersion: undefined,
        profile: publishedProfile
      });
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
    buildId: hasImmutableSeoProjection ? publication?.snapshot.buildId ?? "published-build-missing" : process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "local",
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
    legacyProjectionRequired: isMydreamshootsPublicationSite && !hasImmutableSeoProjection,
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
  const state = await readStorefrontPlatformStateFromDatabase();
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
  const index = !blocked && context.seo.index && mediaReady;
  return {
    index,
    follow: blocked ? false : context.seo.follow,
    sitemapEligible: index && context.seo.sitemapEligible && snapshot.publishedPaths.includes(normalizePath(context.seo.canonicalPath)) && (publishedRoute ? publishedRoute.sitemapEligible : true)
  };
}

export function resolveEffectivePublishedPage(snapshot: PublishedSiteSnapshot, path: string): EffectivePublishedPage {
  const requestedPath = normalizePath(path);
  const directPage = snapshot.pages.find((page) => normalizePath(page.slug) === requestedPath);
  const canonicalPage = snapshot.pages.find((page) => canonicalPathForPage(page) === requestedPath);
  const page = directPage ?? canonicalPage;
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
  if (isPrimaryMydreamshootsSite(snapshot.site) && requestedPath === "/ai-image-generation/motion-generator") {
    return resolvePublishedRedirectDisposition(snapshot, requestedPath, "/ai-video-generation/motion-generator", 308);
  }
  if (isPrimaryMydreamshootsSite(snapshot.site) && DEFERRED_MYDREAMSHOOTS_VIDEO_PATHS.has(requestedPath)) {
    return { kind: "not_found", status: 404, path: requestedPath };
  }
  const exactPublishedRoute = snapshot.publishedRoutes.find((route) =>
    route.disposition === "redirect" ? route.aliasPath === requestedPath : route.canonicalPath === requestedPath
  );
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
    // Editorial video guides can be intentionally noindex while product proof is
    // collected. They are still public destinations when navigation points to
    // them; all other incomplete video routes remain unavailable.
    const evidenceOnlyReview = exactPublishedRoute.status === "review_required" &&
      exactPublishedRoute.reviewReason === "FIRST_PARTY_PRODUCT_EVIDENCE_REQUIRED";
    if (exactPublishedRoute.status !== "published" && !evidenceOnlyReview) return { kind: "not_found", status: 404, path: requestedPath };
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
  status: 301 | 302 | 307 | 308 = 308
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
