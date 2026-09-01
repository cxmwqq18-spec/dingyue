import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSiteByHostCandidatesFromState } from "@/lib/domain-routing";
import { findPage } from "@/lib/data";
import { parsePublicCollectionRouteForSite, publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { getSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
import { readStorefrontPublicRuntimeStateByHostFromDatabase } from "@/lib/storefront-state";
import { canResolveCollectionSlugForSite, renderStorefrontPage } from "@/lib/storefront-render";
import { createPublishedSiteSnapshot } from "@/lib/storefront-context";
import { metadataForPublishedStorefrontDirectoryPage } from "@/lib/storefront-metadata";
import type { PlatformState, Site } from "@/lib/types";

type Params = Promise<{ themeSlug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadImageThemeState(themeSlug: string): Promise<{ state: PlatformState; site: Site } | undefined> {
  const headerStore = await headers();
  const hosts = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const state = await Promise.all(hosts.map((host) =>
    host ? readStorefrontPublicRuntimeStateByHostFromDatabase(host, "/ai-image-generation", themeSlug) : undefined
  )).then((states) => states.find(Boolean));
  if (!state) return undefined;
  const site = getSiteByHostCandidatesFromState(state, hosts) ?? state.sites[0];
  return site ? { state, site } : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { themeSlug } = await params;
  const loaded = await loadImageThemeState(themeSlug);
  if (!loaded) return {};
  const { state, site } = loaded;
  const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", themeSlug]);
  if (!route?.collectionSlug || !canResolveCollectionSlugForSite(state, site, route.collectionSlug)) return {};
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
  const engagementPhotoMeta = route.collectionSlug === "engagement-photo"
    ? {
        title: "AI Engagement Photos for Proposals & Announcements | myDreamshoots",
        description: "Create proposal-inspired engagement portraits, announcement images, ring reveal scenes, and romantic couple story photos."
      }
    : undefined;
  const finalTitle = engagementPhotoMeta?.title ?? directoryContent.title;
  const finalDescription = engagementPhotoMeta?.description ?? directoryContent.description;
  return {
    ...metadata,
    title: finalTitle,
    description: finalDescription,
    openGraph: {
      ...(metadata.openGraph ?? {}),
      title: finalTitle,
      description: finalDescription
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
  params: Params;
  searchParams?: SearchParams;
}) {
  const { themeSlug } = await params;
  const loaded = await loadImageThemeState(themeSlug);
  if (!loaded) notFound();
  const { state, site } = loaded;
  const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", themeSlug]);
  if (!route?.collectionSlug || !canResolveCollectionSlugForSite(state, site, route.collectionSlug)) notFound();
  const query = searchParams ? await searchParams : {};
  return renderStorefrontPage({
    site,
    slug: "/ai-image-generation",
    publicPath: route.canonicalPath,
    query: { ...query, category: route.collectionSlug },
    routeMode: "host",
    state,
    deferCustomerRuntime: true
  });
}
