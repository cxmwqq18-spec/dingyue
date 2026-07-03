import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data";
import {
  readStorefrontPlatformState,
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { publicSiteSlug } from "@/lib/domain-routing";
import type { PlatformState } from "@/lib/types";

function stateWithSiteFirst(state: PlatformState, siteSlug: string): PlatformState | undefined {
  const canonicalSlug = publicSiteSlug(siteSlug);
  const site = state.sites.find((item) => publicSiteSlug(item.slug) === canonicalSlug || item.slug === siteSlug);
  if (!site) return undefined;
  return {
    ...state,
    sites: [site, ...state.sites.filter((item) => item.id !== site.id)]
  };
}

async function readPublicRuntimeStateBySlugWithFallback(siteSlug: string, pageSlug: string): Promise<PlatformState | undefined> {
  try {
    const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, pageSlug);
    if (state?.sites[0]) return state;
  } catch {
    // Local development and cold starts can temporarily exhaust the relational pool.
  }
  return stateWithSiteFirst(await readStorefrontPlatformState(), siteSlug);
}

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, "/");
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
  const state = await readPublicRuntimeStateBySlugWithFallback(publicSlug, "/");
  const site = state?.sites[0];
  if (!state) notFound();
  if (!site) notFound();
  return renderStorefrontPage({ site, slug: "/", query, state, deferCustomerRuntime: true });
}
