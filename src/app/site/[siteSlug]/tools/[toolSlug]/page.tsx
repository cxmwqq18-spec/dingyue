import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPlatformState } from "@/lib/server-store";
import { renderToolPage, resolveToolPageForSite } from "@/lib/storefront-render";
import { metadataForThemePage } from "@/lib/theme/seo";

function resolveToolPage(siteSlug: string, toolSlug: string) {
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) return { state, site: undefined, siteAiApps: [], page: undefined, app: undefined };
  return { state, site, ...resolveToolPageForSite(state, site, toolSlug) };
}

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; toolSlug: string }> }): Promise<Metadata> {
  const { siteSlug, toolSlug } = await params;
  const { site, page, app } = resolveToolPage(siteSlug, toolSlug);
  if (!site || !page || (!app && page.slug !== `/tools/${toolSlug}`)) return {};
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
  const { site, page, app } = resolveToolPage(siteSlug, toolSlug);
  if (!site || !page) notFound();
  if (!app && page.slug !== `/tools/${toolSlug}`) notFound();
  return renderToolPage({ site, toolSlug, query, routeMode: "path" });
}
