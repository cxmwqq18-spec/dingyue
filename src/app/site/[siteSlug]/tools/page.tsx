import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { publicSiteSlug } from "@/lib/domain-routing";
import { metadataForDreamshootFallbackRoute } from "@/lib/dreamshoot-seo-content";
import { metadataForSingleThemePage } from "@/lib/theme/seo";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readPathModePublicRuntimeState(publicSiteSlug(siteSlug), "/tools");
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/tools");
  return site && page
    ? metadataForSingleThemePage(site, page)
    : metadataForDreamshootFallbackRoute(publicSiteSlug(siteSlug), "/tools", {
        primaryDomain: site?.primaryDomain,
        ogImage: site?.themeSettings.publishedJson.seo?.defaultOgImage,
        siteName: site?.branding.logoText || site?.name
      });
}

export default async function SiteToolsPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const publicSlug = publicSiteSlug(siteSlug);
  const query = searchParams ? await searchParams : {};
  const state = await readPathModePublicRuntimeState(publicSlug, "/tools");
  const site = state?.sites[0];
  if (!state || !site) notFound();
  return renderStorefrontPage({ site, slug: "/tools", query, routeMode: "path", state, deferCustomerRuntime: true });
}
