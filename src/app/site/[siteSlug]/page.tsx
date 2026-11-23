import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { readPathModePublicMetadataState, readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import {
  readStorefrontPublicPageMetadataStateByHostFromDatabase,
  readStorefrontPublicRuntimeStateByHostFromDatabase
} from "@/lib/storefront-state";
import { metadataForPublishedStorefrontDirectoryPage, metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { publicSiteSlug } from "@/lib/domain-routing";
import { headers } from "next/headers";
import { storefrontRouteModeForHeaders, type StorefrontRouteMode } from "@/lib/storefront-route-mode";
import { canResolveCollectionSlugForSite } from "@/lib/storefront-render";
import { createPublishedSiteSnapshot } from "@/lib/storefront-context";
import { parsePublicCollectionRouteForSite } from "@/lib/photo-package-taxonomy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HeaderReader = {
  get(name: string): string | null;
};

function publicHostCandidates(headers: HeaderReader): Array<string | null> {
  return [
    headers.get("x-forwarded-host"),
    headers.get("host")
  ];
}

async function readRoutePublicRuntimeState(headers: HeaderReader, publicSlug: string, routeMode: StorefrontRouteMode, contextSlug?: string) {
  if (routeMode === "host") {
    for (const host of publicHostCandidates(headers)) {
      const state = await readStorefrontPublicRuntimeStateByHostFromDatabase(host, "/", contextSlug);
      if (state?.sites[0]) return state;
    }
  }
  return readPathModePublicRuntimeState(publicSlug, "/");
}

async function readRoutePublicMetadataState(headers: HeaderReader, publicSlug: string, routeMode: StorefrontRouteMode) {
  if (routeMode === "host") {
    for (const host of publicHostCandidates(headers)) {
      const state = await readStorefrontPublicPageMetadataStateByHostFromDatabase(host, "/");
      if (state?.sites[0]) return state;
    }
  }
  return readPathModePublicMetadataState(publicSlug, "/");
}

/** Public AIVideosUGC/Aidreamcapes hosts must not serve another storefront's
 * homepage through the path-mode prefix. */
async function assertAidreamcapesPathModeSite(siteSlug: string): Promise<void> {
  const requestHeaders = await headers();
  const host = String(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  const isAivideosugcHost = host === "www.aivideosugc.com" || host === "aivideosugc.com"
    || host === "www.aidreamcapes.com" || host === "aidreamcapes.com";
  const slug = publicSiteSlug(siteSlug);
  if (isAivideosugcHost && slug !== "aidreamcapes" && slug !== "aivideosugc") notFound();
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ siteSlug: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { siteSlug } = await params;
  await assertAidreamcapesPathModeSite(siteSlug);
  const publicSlug = publicSiteSlug(siteSlug);
  const query = searchParams ? await searchParams : {};
  const headerStore = await headers();
  const category = typeof query.category === "string"
    ? query.category
    : Array.isArray(query.category)
      ? query.category[0]
      : headerStore.get("x-storefront-image-theme")?.trim();
  const routeMode = storefrontRouteModeForHeaders(headerStore, publicSlug);
  const state = category
    ? await readRoutePublicRuntimeState(headerStore, publicSlug, routeMode, category)
    : await readRoutePublicMetadataState(headerStore, publicSlug, routeMode);
  const site = state?.sites[0];
  if (!site) return {};
  if (category) {
    const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", category]);
    if (route?.collectionSlug && canResolveCollectionSlugForSite(state, site, route.collectionSlug)) {
      const snapshot = createPublishedSiteSnapshot(state, site, { source: "postgres" });
      return metadataForPublishedStorefrontDirectoryPage({
        site,
        page: getPage(site, "/"),
        kind: "collection",
        directorySlug: route.collectionSlug,
        path: route.canonicalPath,
        products: state.products,
        creativePacks: state.creativePacks,
        snapshot
      });
    }
  }
  return metadataForPublishedStorefrontPage({ site, page: getPage(site, "/"), products: state.products, creativePacks: state.creativePacks });
}

export default async function SiteFrontPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  await assertAidreamcapesPathModeSite(siteSlug);
  const publicSlug = publicSiteSlug(siteSlug);
  const query = searchParams ? await searchParams : {};
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, publicSlug);
  const state = await readRoutePublicRuntimeState(headerStore, publicSlug, routeMode);
  const site = state?.sites[0];
  if (!state) notFound();
  if (!site) notFound();
  return renderStorefrontPage({ site, slug: "/", query, routeMode, state, deferCustomerRuntime: true });
}
