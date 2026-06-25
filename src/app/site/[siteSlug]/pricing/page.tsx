import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readStorefrontPublicRuntimeStateBySlugFromDatabase } from "@/lib/storefront-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { redirectLegacySiteSlug } from "@/lib/site-route-canonical";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Pricing" };
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
