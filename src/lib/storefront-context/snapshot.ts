import "server-only";

import { readStorefrontPublicRuntimeStateByHostFromDatabase } from "@/lib/storefront-state";
import type { CreativePack, MediaAsset, PlatformState, Product, PublishedFactsProjection, Site, StorefrontProfileJson, ThemePage } from "@/lib/types";
import { readStorefrontPlatformStateFromDatabase } from "@/lib/storefront-state";
import { publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { legacyPublicPathTarget } from "@/lib/site-route-canonical";
import { publicationSnapshotIntegrity } from "@/lib/publication-snapshot-integrity";
import { resolveStorefrontContext } from "./core";
import { resolveSiteCapability } from "./capabilities";
import { canonicalPathForPage, canonicalUrlForSite, normalizeCanonicalPath } from "./seo-projection";
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

function publishedPages(site: Site): ThemePage[] {
  return site.pages.filter((page) => Boolean(page.publishedJson && page.publishedJson.sectionsOrder));
}

function isPrivateStorefrontPath(path: string): boolean {
  const value = normalizePath(path);
  return value === "/account" || value === "/app" || value.startsWith("/app/") || value === "/album" || value.startsWith("/album/") || value === "/cart" || value === "/checkout" || value === "/dashboard" || value === "/login" || value === "/logout";
}

function profileFromPublishedFacts(facts: PublishedFactsProjection | undefined): StorefrontProfileJson | undefined {
  if (!facts) return undefined;
  return {
    identity: { ...(facts.identity ?? {}), sameAs: facts.identity?.sameAs ?? [] },
    policyFacts: {
      usesCustomerMediaForTraining: facts.privacy?.customerMediaTraining,
      sourceMediaRetentionDays: facts.privacy?.sourceMediaRetentionDays,
      refundReviewRequired: facts.refund?.reviewRequired,
      refundWindowDays: facts.refund?.windowDays,
      effectiveDate: facts.refund?.effectiveDate
    }
  };
}

export function publishedCreativePacksForRender(snapshot: PublishedSiteSnapshot): CreativePack[] {
  const mediaByPage = new Map(snapshot.publishedPageMedia.map((media) => [media.pageEntityId, media]));
  return snapshot.publishedCreativePacks
    .filter((pack) => pack.status === "published")
    .map((pack) => {
      const media = mediaByPage.get(pack.pageEntityId);
      return {
        id: pack.packId,
        siteId: snapshot.site.id,
        name: pack.label,
        headline: pack.label,
        description: pack.summary,
        category: pack.collectionSlug,
        aiAppSlug: "image-generation",
        status: "active" as const,
        creditCost: pack.creditCost,
        outputCount: pack.outputCount,
        trainingRequired: false,
        generationCount: 0,
        conversionRate: 0,
        createdAt: snapshot.publication?.publishedAt ?? new Date(0).toISOString(),
        imageUrl: pack.image,
        galleryImages: media?.galleryImages ?? [],
        galleryImageAlts: media?.imageAlts ?? [pack.imageAlt],
        categoryRecord: {
          id: `published-category:${pack.collectionSlug}`,
          siteId: snapshot.site.id,
          slug: pack.collectionSlug,
          label: pack.label,
          sortOrder: 0,
          status: "active" as const,
          createdAt: snapshot.publication?.publishedAt ?? new Date(0).toISOString()
        }
      };
    });
}

export function publishedProductsForRender(snapshot: PublishedSiteSnapshot): Product[] {
  return Array.from(new Set(snapshot.publishedOffers.map((offer) => offer.productId))).map((productId) => {
    const offer = snapshot.publishedOffers.find((candidate) => candidate.productId === productId)!;
    return {
      id: productId,
      siteId: offer.siteId,
      name: offer.productName,
      type: offer.productType,
      status: "active" as const,
      metadata: offer.productMetadata,
      prices: snapshot.publishedOffers.filter((candidate) => candidate.productId === productId).map((candidate) => ({
        id: candidate.priceId,
        siteId: candidate.siteId,
        productId: candidate.productId,
        label: candidate.priceLabel,
        amountCents: candidate.amountCents,
        currency: candidate.currency,
        interval: candidate.interval,
        creditsGranted: candidate.creditsGranted,
        stripePriceId: candidate.stripePriceId,
        metadata: candidate.priceMetadata,
        status: "active" as const
      }))
    };
  });
}

function bundleFor(snapshot: PublishedSiteSnapshot, page: ThemePage): StorefrontContextBundle {
  const immutableProjection = snapshot.publication?.snapshot.seoProjectionVersion === 1;
  const projectedProducts = publishedProductsForRender(snapshot);
  return {
    site: {
      ...snapshot.site,
      connect: immutableProjection && snapshot.site.connect
        ? {
            ...snapshot.site.connect,
            chargesEnabled: snapshot.publishedOffers.some((offer) => offer.checkoutEnabled),
            payoutsEnabled: snapshot.publishedOffers.some((offer) => offer.checkoutEnabled)
          }
        : snapshot.site.connect
    },
    page,
    products: immutableProjection ? projectedProducts : snapshot.products,
    creativePacks: immutableProjection ? publishedCreativePacksForRender(snapshot) : snapshot.creativePacks,
    publication: snapshot.publication,
    factsRevision: snapshot.factsRevision,
    buildId: snapshot.buildId,
    publishedPageCopies: Object.fromEntries(snapshot.publishedPageCopy.map((projection) => [projection.canonicalSlug, projection.copy])),
    publishedFacts: snapshot.publishedFacts,
    publishedCreativePacks: snapshot.publishedCreativePacks,
    snapshotIntegrity: snapshot.snapshotIntegrity
  };
}

export function createPublishedSiteSnapshot(
  state: PlatformState,
  site: Site,
  options: { source?: "postgres" | "platform-state" } = {}
): PublishedSiteSnapshot {
  const publication = site.latestPublication ?? (state.themePublications ?? [])
    .filter((candidate) => candidate.siteId === site.id)
    .sort((left, right) => right.version - left.version)[0];
  const snapshotIntegrity = publication?.snapshotIntegrity ?? publicationSnapshotIntegrity(publication?.snapshot);
  const hasImmutableSeoProjection = publication?.snapshot?.seoProjectionVersion === 1 && snapshotIntegrity === "valid";
  const publicationSnapshot = snapshotIntegrity === "invalid" ? undefined : publication?.snapshot;
  const publishedPageSnapshots = new Map((publicationSnapshot?.pages ?? []).map((page) => [page.id, page]));
  const pages = publishedPages(site)
    .map((page) => {
      const publishedPage = publishedPageSnapshots.get(page.id);
      return publishedPage
        ? { ...page, slug: publishedPage.slug, publishedJson: publishedPage.publishedJson }
        : page;
    })
    .filter((page) => Boolean(publication && publishedPageSnapshots.has(page.id)));
  const publicationThemeSettings = publicationSnapshot?.themeSettings;
  const publishedSettings = publicationThemeSettings
    ? { ...site.themeSettings, publishedJson: publicationThemeSettings }
    : site.themeSettings;
  const factsProjection = hasImmutableSeoProjection ? publicationSnapshot?.publishedFacts : undefined;
  const publishedProfile = hasImmutableSeoProjection
    ? profileFromPublishedFacts(factsProjection)
    : publicationSnapshot?.storefrontProfile ?? site.storefrontProfile?.publishedJson;
  const publishedSite = {
    ...site,
    pages,
    themeSettings: publishedSettings,
    storefrontProfile: site.storefrontProfile && publishedProfile
      ? { ...site.storefrontProfile, publishedJson: publishedProfile }
      : site.storefrontProfile
  };
  const snapshotRoutes = publicationSnapshot?.publishedRoutes;
  const publishedRoutes = site.id === "site_dreamshoot"
    ? hasImmutableSeoProjection
      ? (Array.isArray(snapshotRoutes) ? snapshotRoutes as PublishedSiteSnapshot["publishedRoutes"] : [])
      : []
    : [];
  const publishedPaths = Array.from(new Set([
    ...pages.flatMap((page) => [normalizePath(page.slug), canonicalPathForPage(page)]),
    ...publishedRoutes.filter((route) => route.status === "published").map((route) => route.canonicalPath)
  ]));
  const products = hasImmutableSeoProjection ? [] : state.products.filter((product) => product.siteId === site.id);
  const creativePacks = hasImmutableSeoProjection ? [] : state.creativePacks.filter((pack) => pack.siteId === site.id);
  const creativePackCategories = hasImmutableSeoProjection ? [] : (state.creativePackCategories ?? []).filter((category) => category.siteId === site.id);
  const videoThemes = hasImmutableSeoProjection ? [] : (state.videoThemes ?? []).filter((theme) => theme.siteId === site.id);
  const mediaAssets = hasImmutableSeoProjection ? [] : state.mediaAssets.filter((asset) => asset.siteId === site.id);
  const baseEntityReferences: EntityReference[] = [
    ...pages.map((page) => ({ entityType: "page" as const, entityId: page.id, ownerId: site.id, revision: page.draftMeta?.etag ?? revision([page.id, page.publishedJson.version, page.updatedAt]), updatedAt: page.updatedAt })),
    ...publishedRoutes.map((route) => ({
      entityType: "route_manifest" as const,
      entityId: route.canonicalPath,
      ownerId: route.pageEntityId,
      revision: route.copyRevision || revision(route),
      updatedAt: route.copyRevision
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
  const snapshotRevisions = publicationSnapshot?.revisions ?? {};
  const publishedPageCopy = hasImmutableSeoProjection && Array.isArray(publicationSnapshot?.publishedPageCopy)
    ? publicationSnapshot.publishedPageCopy as PublishedSiteSnapshot["publishedPageCopy"]
    : [];
  const publishedPageMedia = hasImmutableSeoProjection && Array.isArray(publicationSnapshot?.publishedPageMedia)
    ? publicationSnapshot.publishedPageMedia as PublishedSiteSnapshot["publishedPageMedia"]
    : [];
  const publishedPackFacts = hasImmutableSeoProjection && Array.isArray(publicationSnapshot?.publishedPackFacts)
    ? publicationSnapshot.publishedPackFacts as PublishedSiteSnapshot["publishedPackFacts"]
    : [];
  const publishedOffers = hasImmutableSeoProjection
    ? (Array.isArray(publicationSnapshot?.publishedOffers) ? publicationSnapshot.publishedOffers : [])
    : [];
  const publishedFacts = hasImmutableSeoProjection ? publicationSnapshot?.publishedFacts : undefined;
  const publishedCollectionRefs = hasImmutableSeoProjection && Array.isArray(publicationSnapshot?.publishedCollectionRefs)
    ? publicationSnapshot.publishedCollectionRefs as PublishedSiteSnapshot["publishedCollectionRefs"]
    : [];
  const publishedCreativePacks = hasImmutableSeoProjection && Array.isArray(publicationSnapshot?.publishedCreativePacks)
    ? publicationSnapshot.publishedCreativePacks
    : [];
  const entityReferences: EntityReference[] = [
    ...baseEntityReferences,
    ...publishedPageCopy.map((copy) => ({ entityType: "page_copy" as const, entityId: copy.pageEntityId, ownerId: site.id, revision: copy.copyRevision })),
    ...publishedPageMedia.map((media) => ({ entityType: "page_media" as const, entityId: media.mediaEntityId, ownerId: media.ownerPageEntityId, revision: media.entityRevision }))
  ];
  const factsRevision = snapshotRevisions.factsRevision ?? publication?.factsRevision ?? revision({
    siteId: site.id,
    publicationId: publication?.id ?? null,
    publicationVersion: publication?.version ?? null,
    profile: publishedProfile
  });
  return {
    boundary: {
      siteId: site.id,
      source: options.source ?? "platform-state",
      publicationId: publication?.id ?? null,
      publicationVersion: publication?.version ?? null
    },
    site: publishedSite,
    themeSettings: publishedSettings.publishedJson,
    publication,
    publicationVersion: publication?.version,
    publicationId: publication?.id,
    factsRevision,
    buildId: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "local",
    pages,
    publishedPaths,
    publishedRoutes,
    publishedPageCopy,
    publishedPageMedia,
    publishedPackFacts,
    publishedOffers,
    publishedFacts,
    publishedCollectionRefs,
    publishedCreativePacks,
    snapshotRevisions,
    legacyProjectionRequired: Boolean(publication && !hasImmutableSeoProjection),
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
  const route = snapshot.publishedRoutes.find((candidate) => candidate.canonicalPath === normalizePath(context.seo.canonicalPath));
  const media = route
    ? snapshot.publishedPageMedia.find((candidate) => candidate.pageEntityId === route.pageEntityId)
    : undefined;
  return {
    ...context,
    revisions: {
      ...context.revisions,
      pageMediaRevision: media?.entityRevision
    },
    publishedPaths: snapshot.publishedPaths
  };
}

export function resolveEffectiveIndexability(snapshot: PublishedSiteSnapshot, page: ThemePage, context = resolveStorefrontContext(bundleFor(snapshot, page), "published")): EffectiveIndexability {
  if (snapshot.snapshotIntegrity === "invalid") return { index: false, follow: false, sitemapEligible: false };
  const blocked = page.pageType === "not_found" || page.slug === "/404" || isPrivateStorefrontPath(page.slug) || isPrivateStorefrontPath(context.seo.canonicalPath);
  const publishedRoute = snapshot.publishedRoutes.find((route) => route.canonicalPath === normalizePath(context.seo.canonicalPath));
  const publishedMedia = publishedRoute ? snapshot.publishedPageMedia.find((media) => media.pageEntityId === publishedRoute.pageEntityId) : undefined;
  const legacyLeafBlocked = Boolean(snapshot.legacyProjectionRequired && /^\/ai-image-generation\/[^/]+$/.test(normalizePath(context.seo.canonicalPath)));
  const index = !blocked && !legacyLeafBlocked && context.seo.index && (publishedRoute ? publishedRoute.indexable && publishedMedia?.status === "ready" : true);
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
  if (snapshot.snapshotIntegrity === "invalid") return { kind: "not_found", status: 404, path: requestedPath };
  if (!snapshot.pages.length) return { kind: "not_found", status: 404, path: requestedPath };
  const legacyTarget = legacyPublicPathTarget(requestedPath, publicCollectionRootPathForSite(snapshot.site));
  if (legacyTarget) return resolvePublishedRedirectDisposition(snapshot, requestedPath, legacyTarget);
  if (snapshot.site.id === "site_dreamshoot" && requestedPath.startsWith("/ai-image-generation/")) {
    const route = snapshot.publishedRoutes.find((candidate) => candidate.canonicalPath === requestedPath);
    if (!route) return { kind: "not_found", status: 404, path: requestedPath };
    if (route.status !== "published") return { kind: "not_found", status: 404, path: requestedPath };
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
    targetUrl: canonicalUrlForSite(snapshot.site, target),
    targetPageId: targetPage.id
  };
}

export function resolvePublicCollectionItems(snapshot: PublishedSiteSnapshot): PublicCollectionItem[] {
  return snapshot.publishedCollectionRefs
    .filter((ref) => ref.status === "published" && ref.image && ref.imageAlt && ref.creditCost > 0 && ref.outputCount > 0)
    .map((ref) => ({
      id: ref.sourcePackId,
      ownerId: ref.pageEntityId,
      revision: ref.entityRevision,
      name: ref.label,
      description: ref.summary,
      categorySlug: ref.categorySlug,
      imageUrl: ref.image,
      imageAlt: ref.imageAlt,
      creditCost: ref.creditCost,
      outputCount: ref.outputCount
    }));
}

export function resolvePublicPricingOffers(snapshot: PublishedSiteSnapshot, page?: ThemePage): PublicPricingOffer[] {
  const targetPage = page ?? snapshot.pages.find((candidate) => candidate.slug === "/pricing") ?? snapshot.pages[0];
  if (!targetPage) return [];
  const explicitProductIds = new Set<string>();
  for (const sectionId of targetPage.publishedJson.sectionsOrder) {
    const settings = targetPage.publishedJson.sections[sectionId]?.settings ?? {};
    const value = settings.featuredProductId;
    if (typeof value === "string" && value.trim()) explicitProductIds.add(value.trim());
  }
  return snapshot.publishedOffers
    .filter((projection) => !explicitProductIds.size || explicitProductIds.has(projection.productId))
    .map((projection) => ({
      product: {
        id: projection.productId,
        siteId: projection.siteId,
        name: projection.productName,
        type: projection.productType,
        status: "active" as const,
        metadata: projection.productMetadata,
        prices: []
      },
      price: {
        id: projection.priceId,
        siteId: projection.siteId,
        productId: projection.productId,
        label: projection.priceLabel,
        amountCents: projection.amountCents,
        currency: projection.currency,
        interval: projection.interval,
        creditsGranted: projection.creditsGranted,
        stripePriceId: projection.stripePriceId,
        metadata: projection.priceMetadata,
        status: "active" as const
      },
      formattedPrice: new Intl.NumberFormat("en-US", { style: "currency", currency: projection.currency.toUpperCase() }).format(projection.amountCents / 100),
      checkoutEnabled: projection.checkoutEnabled
    }));
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
