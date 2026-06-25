import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data";
import { readStorefrontPublicRuntimeStateBySlugFromDatabase } from "@/lib/storefront-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { metadataForThemePage } from "@/lib/theme/seo";
import { redirectLegacySiteSlug } from "@/lib/site-route-canonical";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, "/");
  const site = state?.sites[0];
  if (!site) return {};
  return metadataForThemePage(site, getPage(site, "/"));
}

export default async function SiteFrontPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  redirectLegacySiteSlug(siteSlug, "/");
  const query = searchParams ? await searchParams : {};
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, "/");
  const site = state?.sites[0];
  if (!state) notFound();
  if (!site) notFound();
  return renderStorefrontPage({ site, slug: "/", query, state });
}
