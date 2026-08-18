import "server-only";

import { readStorefrontPublicRuntimeStateByHostFromDatabase } from "@/lib/storefront-state";
import type { MediaAsset, PlatformState, Site, ThemePage } from "@/lib/types";
import { readStorefrontPlatformStateFromDatabase } from "@/lib/storefront-state";
import { mydreamshootsPageCopyForRoute } from "@/lib/mydreamshoots-page-copy";
import { publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { legacyPublicPathTarget } from "@/lib/site-route-canonical";
import { projectPublicPricingOffers, resolveStorefrontContext } from "./core";
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

function bundleFor(snapshot: PublishedSiteSnapshot, page: ThemePage): StorefrontContextBundle {
  return {
    site: snapshot.site,
    page,
    products: snapshot.products,
    creativePacks: snapshot.creativePacks,
    publication: snapshot.publication,
    factsRevision: snapshot.factsRevision,
    buildId: snapshot.buildId
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
  const publishedPageSnapshots = new Map((publication?.snapshot.pages ?? []).map((page) => [page.id, page]));
  const pages = publishedPages(site)
    .map((page) => {
      const publishedPage = publishedPageSnapshots.get(page.id);
      return publishedPage
        ? { ...page, slug: publishedPage.slug, publishedJson: publishedPage.publishedJson }
        : page;
    })
    .filter((page) => Boolean(publication && publishedPageSnapshots.has(page.id)));
  const publicationThemeSettings = publication?.snapshot?.themeSettings;
  const publishedSettings = publicationThemeSettings
    ? { ...site.themeSettings, publishedJson: publicationThemeSettings }
    : site.themeSettings;
  const publishedProfile = publication?.snapshot.storefrontProfile ?? site.storefrontProfile?.publishedJson;
  const publishedSite = {
    ...site,
    pages,
    themeSettings: publishedSettings,
    storefrontProfile: site.storefrontProfile && publishedProfile
      ? { ...site.storefrontProfile, publishedJson: publishedProfile }
      : site.storefrontProfile
  };
  const publishedPaths = Array.from(new Set(pages.flatMap((page) => [normalizePath(page.slug), canonicalPathForPage(page)])));
  const products = state.products.filter((product) => product.siteId === site.id);
  const creativePacks = state.creativePacks.filter((pack) => pack.siteId === site.id);
  const creativePackCategories = (state.creativePackCategories ?? []).filter((category) => category.siteId === site.id);
  const videoThemes = (state.videoThemes ?? []).filter((theme) => theme.siteId === site.id);
  const mediaAssets = state.mediaAssets.filter((asset) => asset.siteId === site.id);
  const entityReferences: EntityReference[] = [
    ...pages.map((page) => ({ entityType: "page" as const, entityId: page.id, ownerId: site.id, revision: page.draftMeta?.etag ?? revision([page.id, page.publishedJson.version, page.updatedAt]), updatedAt: page.updatedAt })),
    ...pages.flatMap((page) => {
      const canonicalPath = canonicalPathForPage(page);
      const canonicalSlug = canonicalPath.match(/^\/ai-image-generation\/([^/?#]+)$/)?.[1];
      if (!canonicalSlug) return [];
      const copy = mydreamshootsPageCopyForRoute({
        siteId: site.id,
        routeKind: "ai-image-theme-leaf",
        canonicalSlug,
        canonicalPath
      });
      return copy ? [{ entityType: "page_copy" as const, entityId: copy.pageEntityId, ownerId: site.id, revision: copy.copyRevision }] : [];
    }),
    { entityType: "theme_settings" as const, entityId: site.id, ownerId: site.id, revision: revision(publishedSettings.publishedJson) },
    ...products.flatMap((product) => [
      { entityType: "product" as const, entityId: product.id, ownerId: site.id, revision: revision([product.id, product.metadata, product.status]) },
      ...product.prices.map((price) => ({ entityType: "price" as const, entityId: price.id, ownerId: site.id, revision: revision([price.id, price.amountCents, price.currency, price.interval, price.status, price.effectiveFrom, price.effectiveTo]) }))
    ]),
    ...creativePacks.map((pack) => ({ entityType: "creative_pack" as const, entityId: pack.id, ownerId: site.id, revision: revision([pack.id, pack.createdAt, pack.status, pack.creditCost, pack.outputCount, pack.imageUrl, pack.galleryImages]), updatedAt: pack.createdAt })),
    ...videoThemes.map((theme) => ({ entityType: "video_theme" as const, entityId: theme.id, ownerId: site.id, revision: revision([theme.id, theme.createdAt, theme.status, theme.slug, theme.imageUrl, theme.galleryImages]), updatedAt: theme.createdAt })),
    ...mediaAssets.map((asset) => ({ entityType: "media" as const, entityId: asset.id, ownerId: site.id, revision: revision([asset.id, asset.createdAt, asset.storageKey, asset.previewUrl, asset.originUrl]) }))
  ];
  const factsRevision = publication?.factsRevision ?? revision({
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
  return { ...resolveStorefrontContext(bundleFor(snapshot, page), "published"), publishedPaths: snapshot.publishedPaths };
}

export function resolveEffectiveIndexability(snapshot: PublishedSiteSnapshot, page: ThemePage, context = resolveStorefrontContext(bundleFor(snapshot, page), "published")): EffectiveIndexability {
  const blocked = page.pageType === "not_found" || page.slug === "/404" || isPrivateStorefrontPath(page.slug) || isPrivateStorefrontPath(context.seo.canonicalPath);
  const index = !blocked && context.seo.index;
  return {
    index,
    follow: blocked ? false : context.seo.follow,
    sitemapEligible: index && context.seo.sitemapEligible && snapshot.publishedPaths.includes(normalizePath(context.seo.canonicalPath))
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
  const legacyTarget = legacyPublicPathTarget(requestedPath, publicCollectionRootPathForSite(snapshot.site));
  if (legacyTarget) return resolvePublishedRedirectDisposition(snapshot, requestedPath, legacyTarget);
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
