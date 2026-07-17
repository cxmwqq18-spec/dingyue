import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { readPathModePublicMetadataState, readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { publicSiteSlug } from "@/lib/domain-routing";
import { headers } from "next/headers";
import { storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readPathModePublicMetadataState(siteSlug, "/");
  const site = state?.sites[0];
  if (!site) return {};
  return metadataForSingleThemePage(site, getPage(site, "/"));
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
  const state = await readPathModePublicRuntimeState(publicSlug, "/");
  const site = state?.sites[0];
  if (!state) notFound();
  if (!site) notFound();
  return renderStorefrontPage({ site, slug: "/", query, routeMode, state, deferCustomerRuntime: true });
}
