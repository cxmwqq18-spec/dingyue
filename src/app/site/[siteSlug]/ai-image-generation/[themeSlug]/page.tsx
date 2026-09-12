import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPage } from "@/lib/data";
import { parsePublicCollectionRouteForSite, publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { getSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
import { readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { createPublishedSiteSnapshot } from "@/lib/storefront-context";
import { metadataForPublishedStorefrontDirectoryPage } from "@/lib/storefront-metadata";
import { canResolveCollectionSlugForSite } from "@/lib/storefront-render";
import { AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY, isAidreamshootsEngagementFrenchPage } from "@/lib/aidreamshoots-engagement-photo-french";
import type { PlatformState, Site } from "@/lib/types";

type RouteParams = Promise<{ siteSlug: string; themeSlug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadImageThemeState(siteSlug: string, themeSlug: string): Promise<{ state: PlatformState; site: Site } | undefined> {
  const state = await readPathModePublicRuntimeState(siteSlug, "/ai-image-generation", themeSlug);
  const site = state?.sites[0];
  return state && site && canResolveCollectionSlugForSite(state, site, themeSlug) ? { state, site } : undefined;
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { siteSlug, themeSlug } = await params;
  const loaded = await loadImageThemeState(siteSlug, themeSlug);
  if (!loaded) return {};
  const { state, site } = loaded;
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
        canonical: engagementPhotoMeta.canonicalPath
      }
    } : {}),
    openGraph: {
      ...(metadata.openGraph ?? {}),
      title: finalTitle,
      description: finalDescription,
      ...(engagementPhotoMeta ? { url: engagementPhotoMeta.canonicalPath, locale: "es_ES" } : {})
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
  const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", resolved.themeSlug]);
  if (!route?.collectionSlug) notFound();
  const query = searchParams ? await searchParams : {};
  return renderStorefrontPage({
    site,
    slug: "/ai-image-generation",
    publicPath: route.canonicalPath,
    query: { ...query, category: route.collectionSlug },
    routeMode: "path",
    state,
    deferCustomerRuntime: true
  });
}
