import type { Metadata } from "next";
import { headers } from "next/headers";
import { readStorefrontPublicPageMetadataStateBySlugFromDatabase } from "@/lib/storefront-state";
import { renderCustomerWorkspacePageBySlug } from "@/lib/storefront-render";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, "/app/jobs/progress");
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/app/jobs/progress");
  return {
    ...(site && page ? metadataForSingleThemePage(site, page) : {}),
    robots: { index: false, follow: false }
  };
}

export default async function CustomerJobProgressPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/app/jobs/progress",
    siteSlug
  });
  return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug: "/app/jobs/progress", routeMode: "path" });
}
