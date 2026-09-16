import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { readPathModePublicRuntimeState } from "@/lib/storefront-local-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { publicSiteSlug } from "@/lib/domain-routing";
import { metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const publicSlug = publicSiteSlug(siteSlug);
  if (["mydreamshoots", "aidreamshoots"].includes(publicSlug)) return {};
  const state = await readPathModePublicRuntimeState(publicSlug, "/tools");
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/tools");
  return site && page
    ? metadataForPublishedStorefrontPage({ site, page, products: state?.products, creativePacks: state?.creativePacks })
    : {};
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
  if (["mydreamshoots", "aidreamshoots"].includes(publicSlug)) notFound();
  if (publicSlug === "aidreamcapes") permanentRedirect(`/site/${publicSlug}/ai-video-generation`);
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, publicSlug);
  const query = searchParams ? await searchParams : {};
  const state = await readPathModePublicRuntimeState(publicSlug, "/tools");
  const site = state?.sites[0];
  if (!state || !site) notFound();
  return renderStorefrontPage({ site, slug: "/tools", query, routeMode, state, deferCustomerRuntime: true });
}
