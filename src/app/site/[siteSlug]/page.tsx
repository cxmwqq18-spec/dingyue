import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data";
import {
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { publicSiteSlug } from "@/lib/domain-routing";

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
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(publicSlug, "/");
  const site = state?.sites[0];
  if (!state) notFound();
  if (!site) notFound();
  return renderStorefrontPage({ site, slug: "/", query, state, deferCustomerRuntime: true });
}
