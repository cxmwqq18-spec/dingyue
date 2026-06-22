import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPage } from "@/lib/data";
import { readStorefrontPlatformState } from "@/lib/storefront-state";
import { renderCustomerWorkspacePage, renderStorefrontPage } from "@/lib/storefront-render";
import { metadataForThemePage } from "@/lib/theme/seo";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; path: string[] }> }): Promise<Metadata> {
  const { siteSlug, path } = await params;
  const state = readStorefrontPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) return {};
  const slug = `/${path.join("/")}`;
  const page = getPage(site, slug);
  const resolvedPage = page.slug === slug ? page : site.pages.find((item) => item.slug === "/404") ?? page;
  return metadataForThemePage(site, resolvedPage);
}

export default async function SiteCatchAllPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; path: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug, path } = await params;
  const slug = `/${path.join("/")}`;
  if (slug === "/privacy-policy") redirect(`/site/${siteSlug}/policies/privacy`);
  if (slug === "/terms-of-service") redirect(`/site/${siteSlug}/policies/terms`);
  if (slug === "/tool") redirect(`/site/${siteSlug}/tools`);
  if (path[0] === "job" && path[1]) redirect(`/site/${siteSlug}/app/jobs/${path[1]}`);
  const query = searchParams ? await searchParams : {};
  const state = readStorefrontPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  if (slug === "/account") {
    return renderCustomerWorkspacePage({ site, slug, query, routeMode: "path", state });
  }
  return renderStorefrontPage({ site, slug, query, state });
}
