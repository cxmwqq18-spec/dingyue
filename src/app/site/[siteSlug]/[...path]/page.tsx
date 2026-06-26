import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findPage } from "@/lib/data";
import {
  readStorefrontPublicCollectionDetailStateBySlugFromDatabase,
  readStorefrontPublicCollectionMetadataStateBySlugFromDatabase,
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { renderCustomerWorkspacePageBySlug, renderStorefrontPage } from "@/lib/storefront-render";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { metadataForSeoDirectory } from "@/lib/dreamshoot-seo-content";
import { redirectLegacySiteSlug } from "@/lib/site-route-canonical";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; path: string[] }> }): Promise<Metadata> {
  const { siteSlug, path } = await params;
  const requestedSlug = `/${path.join("/")}`;
  const collectionCategory = path[0] === "collections" && path[1] ? path[1] : "";
  const slug = collectionCategory ? "/collections" : requestedSlug === "/faq" ? "/help" : requestedSlug;
  if (slug === "/account") return { title: "Account" };
  const state = collectionCategory
    ? await readStorefrontPublicCollectionMetadataStateBySlugFromDatabase(siteSlug)
    : await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, slug);
  const site = state?.sites[0];
  if (!site) return {};
  if (collectionCategory) return metadataForSeoDirectory(site, "collection", collectionCategory);
  const page = findPage(site, slug);
  return page ? metadataForSingleThemePage(site, page) : {};
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
  if (slug === "/cookie-policy") redirect(`/site/${siteSlug}/policies/cookies`);
  if (slug === "/tool") redirect(`/site/${siteSlug}/tools`);
  if (slug === "/dashboard") {
    const query = searchParams ? await searchParams : {};
    return renderCustomerWorkspacePageBySlug({ siteSlug, slug: "/app", query, routeMode: "path" });
  }
  if (path[0] === "app") {
    const query = searchParams ? await searchParams : {};
    return renderCustomerWorkspacePageBySlug({ siteSlug, slug, query, routeMode: "path" });
  }
  if (path[0] === "job" && path[1]) redirect(`/site/${siteSlug}/app/jobs/${path[1]}`);
  const collectionCategory = path[0] === "collections" && path[1] ? path[1] : "";
  const query = {
    ...(searchParams ? await searchParams : {}),
    ...(collectionCategory ? { category: collectionCategory } : {})
  };
  if (slug === "/account") {
    return renderCustomerWorkspacePageBySlug({ siteSlug, slug, query, routeMode: "path" });
  }
  const pageSlug = collectionCategory ? "/collections" : slug === "/faq" ? "/help" : slug;
  const state = collectionCategory
    ? await readStorefrontPublicCollectionDetailStateBySlugFromDatabase(siteSlug, collectionCategory)
    : await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, pageSlug);
  const publicSite = state?.sites[0];
  if (!state || !publicSite) notFound();
  if (!collectionCategory && !findPage(publicSite, pageSlug)) notFound();
  return renderStorefrontPage({ site: publicSite, slug: pageSlug, query, state });
}
