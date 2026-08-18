import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { publicSiteSlug } from "@/lib/domain-routing";
import { metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readPathModePublicRuntimeState(publicSiteSlug(siteSlug), "/pricing");
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/pricing");
  return site && page
    ? metadataForPublishedStorefrontPage({ site, page, products: state?.products, creativePacks: state?.creativePacks })
    : {};
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
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, publicSlug);
  const query = searchParams ? await searchParams : {};
  const state = await readPathModePublicRuntimeState(publicSlug, "/pricing");
  const site = state?.sites[0];
  if (!state) notFound();
  if (!site) notFound();
  return renderStorefrontPage({ site, slug: "/pricing", query, routeMode, state, deferCustomerRuntime: true });
}
