import type { Metadata } from "next";
import { headers } from "next/headers";
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
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";

const dreamshootPartnerTemplateSlugs = new Set(["/creators-circle", "/partner-registration"]);

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
  const headerStore = await headers();
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: slug,
    siteSlug
  });
  if (slug === "/privacy-policy") redirect(`/site/${publicSlug}/policies/privacy`);
  if (slug === "/terms-of-service") redirect(`/site/${publicSlug}/policies/terms`);
  if (slug === "/cookie-policy") redirect(`/site/${publicSlug}/policies/cookies`);
  if (slug === "/tool") redirect(`/site/${publicSlug}/tools`);
  if (slug === "/dashboard") {
    const query = searchParams ? await searchParams : {};
    return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug: "/app", query, routeMode: "path" });
  }
  if (path[0] === "app") {
    const query = searchParams ? await searchParams : {};
    return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug, query, routeMode: "path" });
  }
  if (path[0] === "job" && path[1]) redirect(`/site/${publicSlug}/app/jobs/${path[1]}`);
  const collectionCategory = path[0] === "collections" && path[1] ? path[1] : "";
  const query = {
    ...(searchParams ? await searchParams : {}),
    ...(collectionCategory ? { category: collectionCategory } : {})
  };
  if (slug === "/account") {
    return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug, query, routeMode: "path" });
  }
  const pageSlug = collectionCategory ? "/collections" : slug === "/faq" ? "/help" : slug;
  const state = collectionCategory
    ? await readStorefrontPublicCollectionDetailStateBySlugFromDatabase(publicSlug, collectionCategory)
    : await readStorefrontPublicRuntimeStateBySlugFromDatabase(publicSlug, pageSlug);
  const publicSite = state?.sites[0];
  if (!state || !publicSite) notFound();
  const canUseDreamShootPartnerTemplate =
    dreamshootPartnerTemplateSlugs.has(pageSlug) &&
    /dreamshoot/i.test(`${publicSite.slug} ${publicSite.name} ${publicSite.branding.logoText}`);
  if (!collectionCategory && !findPage(publicSite, pageSlug) && !canUseDreamShootPartnerTemplate) notFound();
  return renderStorefrontPage({ site: publicSite, slug: pageSlug, query, state });
}
