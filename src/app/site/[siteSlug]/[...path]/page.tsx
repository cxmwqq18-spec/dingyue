import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPage } from "@/lib/data";
import { readStorefrontPublicRuntimeStateBySlugFromDatabase } from "@/lib/storefront-state";
import { renderCustomerWorkspacePageBySlug, renderStorefrontPage } from "@/lib/storefront-render";
import { metadataForThemePage } from "@/lib/theme/seo";
import { redirectLegacySiteSlug } from "@/lib/site-route-canonical";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; path: string[] }> }): Promise<Metadata> {
  const { siteSlug, path } = await params;
  const requestedSlug = `/${path.join("/")}`;
  const collectionCategory = path[0] === "collections" && path[1] ? path[1] : "";
  const slug = collectionCategory ? "/collections" : requestedSlug;
  if (slug === "/account") return { title: "Account" };
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, slug);
  const site = state?.sites[0];
  if (!site) return {};
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
  redirectLegacySiteSlug(siteSlug, slug);
  if (slug === "/privacy-policy") redirect(`/site/${siteSlug}/policies/privacy`);
  if (slug === "/terms-of-service") redirect(`/site/${siteSlug}/policies/terms`);
  if (slug === "/tool") redirect(`/site/${siteSlug}/tools`);
  if (path[0] === "job" && path[1]) redirect(`/site/${siteSlug}/app/jobs/${path[1]}`);
  const collectionCategory = path[0] === "collections" && path[1] ? path[1] : "";
  const query = {
    ...(searchParams ? await searchParams : {}),
    ...(collectionCategory ? { category: collectionCategory } : {})
  };
  if (slug === "/account") {
    return renderCustomerWorkspacePageBySlug({ siteSlug, slug, query, routeMode: "path" });
  }
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, slug);
  const publicSite = state?.sites[0];
  if (!state || !publicSite) notFound();
  return renderStorefrontPage({ site: publicSite, slug, query, state });
}
