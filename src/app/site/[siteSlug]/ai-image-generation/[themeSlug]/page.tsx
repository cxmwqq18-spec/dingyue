import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { findPage } from "@/lib/data";
import { imageThemeDetailContentFromPage } from "@/lib/aidreamcapes-image-theme-content";
import { parsePublicCollectionRouteForSite, publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { getSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
import { readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { createPublishedSiteSnapshot } from "@/lib/storefront-context";
import { metadataForPublishedStorefrontDirectoryPage, metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { canResolveCollectionSlugForSite } from "@/lib/storefront-render";
import { storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";
import { AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY, isAidreamshootsEngagementFrenchPage } from "@/lib/aidreamshoots-engagement-photo-french";
import { AIDREAMCAPES_IMAGE_THEME_ROOT_PATH, isAidreamcapesImageThemePath } from "@/lib/aidreamcapes-image-theme-routes";
import { isAidreamcapesEuRetiredPublicPath } from "@/lib/aidreamcapes-eu-retired-routes";
import type { PlatformState, Site } from "@/lib/types";

type RouteParams = Promise<{ siteSlug: string; themeSlug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadImageThemeState(siteSlug: string, themeSlug: string): Promise<{ state: PlatformState; site: Site } | undefined> {
  const requestedPath = `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${themeSlug}`;
  if (isAidreamcapesEuRetiredPublicPath(siteSlug, requestedPath)) return undefined;
  if (isAidreamcapesImageThemePath(siteSlug, requestedPath)) {
    const state = await readPathModePublicRuntimeState(siteSlug, requestedPath);
    const site = state?.sites[0];
    const page = site ? findPage(site, requestedPath) : undefined;
    return state && site && page && imageThemeDetailContentFromPage(page)
      ? { state, site }
      : undefined;
  }
  const state = await readPathModePublicRuntimeState(siteSlug, "/ai-image-generation", themeSlug);
  const site = state?.sites[0];
  return state && site && canResolveCollectionSlugForSite(state, site, themeSlug) ? { state, site } : undefined;
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { siteSlug, themeSlug } = await params;
  const loaded = await loadImageThemeState(siteSlug, themeSlug);
  if (!loaded) return {};
  const { state, site } = loaded;
  const requestedPath = `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${themeSlug}`;
  if (isAidreamcapesImageThemePath(siteSlug, requestedPath)) {
    const page = findPage(site, requestedPath);
    return page && imageThemeDetailContentFromPage(page)
      ? metadataForPublishedStorefrontPage({
          site,
          page,
          path: requestedPath,
          products: state.products,
          creativePacks: state.creativePacks,
          snapshot: createPublishedSiteSnapshot(state, site, { source: "platform-state" })
        })
      : {};
  }
  const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", themeSlug]);
  if (!route?.collectionSlug) return {};
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "postgres" });
  const page = findPage(site, publicCollectionRootPathForSite(site)) ?? findPage(site, "/collections");
  if (!page) return {};
  const metadata = await metadataForPublishedStorefrontDirectoryPage({
    site,
    page,
    kind: "collection",
    directorySlug: route.collectionSlug,
    path: route.canonicalPath,
    products: state.products,
    creativePacks: state.creativePacks,
    snapshot
  });
  const directoryContent = getSeoDirectoryContentForSite(site, "collection", route.collectionSlug);
  const engagementPhotoMeta = route.collectionSlug === "engagement-photo" && isAidreamshootsEngagementFrenchPage(site, route.canonicalPath)
    ? AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY
    : undefined;
  const engagementCanonical = engagementPhotoMeta ? `https://aidreamshoots.eu${engagementPhotoMeta.canonicalPath}` : undefined;
  const finalTitle = engagementPhotoMeta?.seoTitle ?? directoryContent.title;
  const finalDescription = engagementPhotoMeta?.seoDescription ?? directoryContent.description;
  return {
    ...metadata,
    title: finalTitle,
    description: finalDescription,
    ...(engagementPhotoMeta ? {
      keywords: engagementPhotoMeta.seoKeywords,
      alternates: {
        ...(metadata.alternates ?? {}),
        canonical: engagementCanonical
      }
    } : {}),
    openGraph: {
      ...(metadata.openGraph ?? {}),
      title: finalTitle,
      description: finalDescription,
      ...(engagementPhotoMeta ? { url: engagementCanonical, locale: "es_ES", type: "website" as const } : {})
    },
    twitter: {
      ...(metadata.twitter ?? {}),
      title: finalTitle,
      description: finalDescription
    }
  };
}

export default async function ImageThemePage({
  params,
  searchParams
}: {
  params: RouteParams;
  searchParams?: SearchParams;
}) {
  const resolved = await params;
  const loaded = await loadImageThemeState(resolved.siteSlug, resolved.themeSlug);
  if (!loaded) notFound();
  const { state, site } = loaded;
  const requestedPath = `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${resolved.themeSlug}`;
  if (isAidreamcapesImageThemePath(resolved.siteSlug, requestedPath)) {
    const routeMode = storefrontRouteModeForHeaders(await headers(), resolved.siteSlug);
    if (!imageThemeDetailContentFromPage(findPage(site, requestedPath)!)) notFound();
    return renderStorefrontPage({
      site,
      slug: requestedPath,
      publicPath: requestedPath,
      routeMode,
      state,
      deferCustomerRuntime: true
    });
  }
  const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", resolved.themeSlug]);
  if (!route?.collectionSlug) notFound();
  const query = searchParams ? await searchParams : {};
  return renderStorefrontPage({
    site,
    // Keep the renderer's source page on the canonical collection root so the
    // focused route emits canonical JSON-LD for the requested theme.
    slug: publicCollectionRootPathForSite(site),
    publicPath: route.canonicalPath,
    query: { ...query, category: route.collectionSlug },
    routeMode: "path",
    state,
    deferCustomerRuntime: true
  });
}
