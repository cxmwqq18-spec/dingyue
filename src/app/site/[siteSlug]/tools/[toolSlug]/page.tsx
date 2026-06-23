import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readStorefrontPlatformState } from "@/lib/storefront-state";
import { renderToolPage, resolveToolPageForSite } from "@/lib/storefront-render";
import { metadataForThemePage } from "@/lib/theme/seo";

function resolveToolPage(siteSlug: string, toolSlug: string) {
  const state = readStorefrontPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) return { state, site: undefined, siteAiApps: [], page: undefined, app: undefined, matched: false };
  return { state, site, ...resolveToolPageForSite(state, site, toolSlug) };
}

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; toolSlug: string }> }): Promise<Metadata> {
  const { siteSlug, toolSlug } = await params;
  const { site, page, matched } = resolveToolPage(siteSlug, toolSlug);
  if (!site || !page || !matched) return {};
  return metadataForThemePage(site, page);
}

export default async function ToolPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; toolSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug, toolSlug } = await params;
  const query = searchParams ? await searchParams : {};
  const { state, site, page, matched } = resolveToolPage(siteSlug, toolSlug);
  if (!site || !page) notFound();
  if (!matched) notFound();
  return renderToolPage({ site, toolSlug, query, routeMode: "path", state });
}
