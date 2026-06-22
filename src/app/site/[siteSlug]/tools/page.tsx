import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data";
import { readStorefrontPlatformState } from "@/lib/storefront-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { metadataForThemePage } from "@/lib/theme/seo";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = readStorefrontPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) return {};
  return metadataForThemePage(site, getPage(site, "/tools"));
}

export default async function SiteToolsPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const query = searchParams ? await searchParams : {};
  const state = readStorefrontPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  return renderStorefrontPage({ site, slug: "/tools", query, routeMode: "path", state });
}
