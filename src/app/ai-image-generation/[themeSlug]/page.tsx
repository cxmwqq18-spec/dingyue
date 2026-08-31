import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSiteByHostCandidatesFromState } from "@/lib/domain-routing";
import { findPage } from "@/lib/data";
import { parsePublicCollectionRouteForSite, publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { readStorefrontPublicRuntimeStateByHostFromDatabase } from "@/lib/storefront-state";
import { canResolveCollectionSlugForSite, renderStorefrontPage } from "@/lib/storefront-render";
import { createPublishedSiteSnapshot } from "@/lib/storefront-context";
import { metadataForPublishedStorefrontDirectoryPage } from "@/lib/storefront-metadata";
import type { PlatformState, Site } from "@/lib/types";

type Params = Promise<{ themeSlug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadImageThemeState(): Promise<{ state: PlatformState; site: Site } | undefined> {
  const headerStore = await headers();
  const hosts = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const state = await Promise.all(hosts.map((host) =>
    host ? readStorefrontPublicRuntimeStateByHostFromDatabase(host, "/ai-image-generation") : undefined
  )).then((states) => states.find(Boolean));
  if (!state) return undefined;
  const site = getSiteByHostCandidatesFromState(state, hosts) ?? state.sites[0];
  return site ? { state, site } : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { themeSlug } = await params;
  const loaded = await loadImageThemeState();
  if (!loaded) return {};
  const { state, site } = loaded;
  const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", themeSlug]);
  if (!route?.collectionSlug || !canResolveCollectionSlugForSite(state, site, route.collectionSlug)) return {};
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "postgres" });
  const page = findPage(site, publicCollectionRootPathForSite(site)) ?? findPage(site, "/collections");
  if (!page) return {};
  return metadataForPublishedStorefrontDirectoryPage({
    site,
    page,
    kind: "collection",
    directorySlug: route.collectionSlug,
    path: route.canonicalPath,
    products: state.products,
    creativePacks: state.creativePacks,
    snapshot
  });
}

export default async function ImageThemePage({
  params,
  searchParams
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const { themeSlug } = await params;
  const loaded = await loadImageThemeState();
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
