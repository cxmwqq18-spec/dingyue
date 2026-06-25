import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readStorefrontPublicRuntimeStateBySlugFromDatabase } from "@/lib/storefront-state";
import { renderToolPage, resolveToolPageForSite } from "@/lib/storefront-render";
import { metadataForThemePage } from "@/lib/theme/seo";
import { redirectLegacySiteSlug } from "@/lib/site-route-canonical";

async function resolveToolPage(siteSlug: string, toolSlug: string) {
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, `/tools/${toolSlug}`);
  const site = state?.sites[0];
  if (!state || !site) return { state, site, siteAiApps: [], page: undefined, app: undefined, matched: false };
  return { state, site, ...resolveToolPageForSite(state, site, toolSlug) };
}

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; toolSlug: string }> }): Promise<Metadata> {
  const { siteSlug, toolSlug } = await params;
  const { site, page, matched } = await resolveToolPage(siteSlug, toolSlug);
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
  redirectLegacySiteSlug(siteSlug, `/tools/${toolSlug}`);
  const query = searchParams ? await searchParams : {};
  const { state, site, page, matched } = await resolveToolPage(siteSlug, toolSlug);
  if (!site || !page) notFound();
  if (!matched) notFound();
  return renderToolPage({ site, toolSlug, query, routeMode: "path", state });
}
