import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { readPathModePublicMetadataState, readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import {
  readStorefrontPublicPageMetadataStateByHostFromDatabase,
  readStorefrontPublicRuntimeStateByHostFromDatabase
} from "@/lib/storefront-state";
import { metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { publicSiteSlug } from "@/lib/domain-routing";
import { headers } from "next/headers";
import { storefrontRouteModeForHeaders, type StorefrontRouteMode } from "@/lib/storefront-route-mode";

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

async function readRoutePublicRuntimeState(headers: HeaderReader, publicSlug: string, routeMode: StorefrontRouteMode) {
  if (routeMode === "host") {
    for (const host of publicHostCandidates(headers)) {
      const state = await readStorefrontPublicRuntimeStateByHostFromDatabase(host, "/");
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

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const publicSlug = publicSiteSlug(siteSlug);
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, publicSlug);
  const state = await readRoutePublicMetadataState(headerStore, publicSlug, routeMode);
  const site = state?.sites[0];
  if (!site) return {};
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
