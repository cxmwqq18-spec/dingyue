import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readStorefrontPublicRuntimeStateBySlugFromDatabase } from "@/lib/storefront-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { redirectLegacySiteSlug } from "@/lib/site-route-canonical";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Tools" };
}

export default async function SiteToolsPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  redirectLegacySiteSlug(siteSlug, "/tools");
  const query = searchParams ? await searchParams : {};
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, "/tools");
  const site = state?.sites[0];
  if (!state || !site) notFound();
  return renderStorefrontPage({ site, slug: "/tools", query, routeMode: "path", state });
}
