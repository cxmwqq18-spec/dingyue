import type { Metadata } from "next";
import { headers } from "next/headers";
import { readPathModePublicMetadataState } from "@/lib/storefront-local-state";
import { renderCustomerWorkspacePageBySlug } from "@/lib/storefront-render";
import { metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import { storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readPathModePublicMetadataState(siteSlug, "/app/jobs/progress");
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/app/jobs/progress");
  return {
    ...(site && page ? await metadataForPublishedStorefrontPage({ site, page, products: state?.products, creativePacks: state?.creativePacks }) : {}),
    robots: { index: false, follow: false }
  };
}

export default async function CustomerJobProgressPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, siteSlug);
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/app/jobs/progress",
    siteSlug
  });
  return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug: "/app/jobs/progress", routeMode });
}
