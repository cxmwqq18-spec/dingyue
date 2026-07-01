import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { publicSiteSlug } from "@/lib/domain-routing";
import { metadataForDreamshootFallbackRoute } from "@/lib/dreamshoot-seo-content";
import { metadataForSingleThemePage } from "@/lib/theme/seo";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, "/pricing");
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/pricing");
  return site && page
    ? metadataForSingleThemePage(site, page)
    : metadataForDreamshootFallbackRoute(publicSiteSlug(siteSlug), "/pricing", {
        primaryDomain: site?.primaryDomain,
        ogImage: site?.themeSettings.publishedJson.seo?.defaultOgImage,
        siteName: site?.branding.logoText || site?.name
      });
}

export default async function PricingPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const publicSlug = publicSiteSlug(siteSlug);
  const query = searchParams ? await searchParams : {};
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(publicSlug, "/pricing");
  const site = state?.sites[0];
  if (!state) notFound();
  if (!site) notFound();
  return renderStorefrontPage({ site, slug: "/pricing", query, routeMode: "path", state, deferCustomerRuntime: true });
}
