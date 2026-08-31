import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPage } from "@/lib/data";
import { parsePublicCollectionRouteForSite, publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { createPublishedSiteSnapshot, resolvePublishedRouteDisposition } from "@/lib/storefront-context";
import { metadataForPublishedStorefrontDirectoryPage } from "@/lib/storefront-metadata";
import type { PlatformState, Site } from "@/lib/types";

type RouteParams = Promise<{ siteSlug: string; themeSlug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function hasActiveCollection(state: PlatformState, themeSlug: string): boolean {
  return (state.creativePackCategories ?? []).some((category) => category.slug === themeSlug && category.status === "active");
}

async function loadImageThemeState(siteSlug: string, themeSlug: string): Promise<{ state: PlatformState; site: Site } | undefined> {
  const state = await readPathModePublicRuntimeState(siteSlug, "/ai-image-generation", themeSlug);
  const site = state?.sites[0];
  return state && site && hasActiveCollection(state, themeSlug) ? { state, site } : undefined;
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { siteSlug, themeSlug } = await params;
  const loaded = await loadImageThemeState(siteSlug, themeSlug);
  if (!loaded) return {};
  const { state, site } = loaded;
  const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", themeSlug]);
  if (!route?.collectionSlug) return {};
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "postgres" });
  if (resolvePublishedRouteDisposition(snapshot, route.canonicalPath).kind !== "render") return {};
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
  params: RouteParams;
  searchParams?: SearchParams;
}) {
  const resolved = await params;
  const loaded = await loadImageThemeState(resolved.siteSlug, resolved.themeSlug);
  if (!loaded) notFound();
  const { state, site } = loaded;
  const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", resolved.themeSlug]);
  if (!route?.collectionSlug) notFound();
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "postgres" });
  if (resolvePublishedRouteDisposition(snapshot, route.canonicalPath).kind !== "render") notFound();
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
