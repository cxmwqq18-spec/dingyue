import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { redirectLegacySiteSlug } from "@/lib/site-route-canonical";
import { metadataForSingleThemePage } from "@/lib/theme/seo";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, "/pricing");
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/pricing");
  return site && page ? metadataForSingleThemePage(site, page) : { title: "Pricing" };
}

export default async function PricingPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  redirectLegacySiteSlug(siteSlug, "/pricing");
  const query = searchParams ? await searchParams : {};
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, "/pricing");
  const site = state?.sites[0];
  if (!state) notFound();
  if (!site) notFound();
  return renderStorefrontPage({ site, slug: "/pricing", query, routeMode: "path", state });
}
