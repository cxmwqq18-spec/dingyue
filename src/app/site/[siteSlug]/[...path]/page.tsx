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
import { metadataForDreamshootFallbackRoute, metadataForSeoDirectory } from "@/lib/dreamshoot-seo-content";
import { policyPageSlug, redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import { publicSiteSlug } from "@/lib/domain-routing";

const dreamshootPartnerTemplateSlugs = new Set(["/creators-circle", "/partner-registration", "/about-us", "/contact-us"]);

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; path: string[] }> }): Promise<Metadata> {
  const { siteSlug, path } = await params;
  const requestedSlug = `/${path.join("/")}`;
  const collectionCategory = path[0] === "collections" && path[1] ? path[1] : "";
  const slug = collectionCategory ? "/collections" : requestedSlug === "/faq" ? "/help" : policyPageSlug(requestedSlug);
  if (slug === "/account") return { title: "Account" };
  const state = collectionCategory
    ? await readStorefrontPublicCollectionMetadataStateBySlugFromDatabase(siteSlug)
    : await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, slug);
  const site = state?.sites[0];
  if (!site) return {};
  if (collectionCategory) return metadataForSeoDirectory(site, "collection", collectionCategory);
  if (dreamshootPartnerTemplateSlugs.has(slug) && /dreamshoot/i.test(`${site.slug} ${site.name} ${site.branding.logoText}`)) {
    return metadataForDreamshootFallbackRoute(publicSiteSlug(siteSlug), slug, {
      primaryDomain: site.primaryDomain,
      ogImage: site.themeSettings.publishedJson.seo?.defaultOgImage,
      siteName: site.branding.logoText || site.name
    });
  }
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
  if (slug === "/privacy-policy" || slug === "/policies/privacy") redirect(`/site/${publicSlug}/privacy`);
  if (slug === "/terms-of-service" || slug === "/policies/terms") redirect(`/site/${publicSlug}/terms`);
  if (slug === "/cookie-policy" || slug === "/policies/cookies") redirect(`/site/${publicSlug}/cookies`);
  if (slug === "/refund-policy" || slug === "/policies/refund" || slug === "/policies/refunds") redirect(`/site/${publicSlug}/refunds`);
  if (slug === "/content-policy" || slug === "/policies/content") redirect(`/site/${publicSlug}/content`);
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
  const pageSlug = collectionCategory ? "/collections" : slug === "/faq" ? "/help" : policyPageSlug(slug);
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
