import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findPage } from "@/lib/data";
import {
  readStorefrontPublicCollectionDetailStateBySlugFromDatabase,
} from "@/lib/storefront-state";
import { canResolveCollectionSlugForSite, renderCustomerWorkspacePageBySlug, renderStorefrontPage } from "@/lib/storefront-render";
import { preferLocalPathModeState, readPathModePublicMetadataState, readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { canonicalSeoDirectoryPathForSite, metadataForDreamshootFallbackRoute, metadataForSeoDirectory } from "@/lib/dreamshoot-seo-content";
import { publicContentPageSlug } from "@/lib/site-route-canonical";
import { publicSiteSlug } from "@/lib/domain-routing";
import { getAidreamcapesPolicySeo, getMydreamshootsPolicySeo, getSpanishXbyPolicySeo, policyCanonicalUrlForSite, type PolicySeoCopy } from "@/lib/theme/policy-seo";

const dreamshootPartnerTemplateSlugs = new Set(["/creators-circle", "/partner-registration", "/about-us", "/contact-us"]);

function isSpanishXbyStorefrontSite(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }): boolean {
  return /(?:-xby|_xby)/i.test(`${site.slug} ${site.name} ${site.primaryDomain ?? ""} ${site.branding.logoText}`);
}

function isDreamshootPartnerTemplateSite(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }): boolean {
  return !isSpanishXbyStorefrontSite(site) && /dreamshoot|aidreamcapes/i.test(`${site.slug} ${site.name} ${site.primaryDomain ?? ""} ${site.branding.logoText}`);
}

function storefrontPolicySeoForSite(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }, slug: string): PolicySeoCopy | undefined {
  const identity = `${site.slug} ${site.name} ${site.primaryDomain ?? ""} ${site.branding.logoText}`;
  if (isSpanishXbyStorefrontSite(site)) return getSpanishXbyPolicySeo(site, slug);
  if (/aidreamcapes/i.test(identity)) return getAidreamcapesPolicySeo(slug);
  if (/dreamshoot/i.test(identity)) return getMydreamshootsPolicySeo(slug);
  return undefined;
}

async function readCollectionRouteState(siteSlug: string, collectionCategory: string) {
  if (preferLocalPathModeState()) return readPathModePublicRuntimeState(siteSlug, "/collections");
  try {
    const detailState = await readStorefrontPublicCollectionDetailStateBySlugFromDatabase(siteSlug, collectionCategory);
    const detailSite = detailState?.sites[0];
    if (detailState && detailSite && canResolveCollectionSlugForSite(detailState, detailSite, collectionCategory)) return detailState;
  } catch {
    // Continue to the broader collections state or local JSON fallback.
  }
  return readPathModePublicRuntimeState(siteSlug, "/collections");
}

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; path: string[] }> }): Promise<Metadata> {
  const { siteSlug, path } = await params;
  const requestedSlug = `/${path.join("/")}`;
  const collectionCategory = path[0] === "collections" && path[1] ? path[1] : "";
  const slug = collectionCategory ? "/collections" : publicContentPageSlug(requestedSlug);
  if (slug === "/account") {
    return { title: /(?:-xby|_xby)/i.test(siteSlug) ? "Espacio privado" : "Workspace", robots: { index: false, follow: false } };
  }
  const state = collectionCategory
    ? await readCollectionRouteState(siteSlug, collectionCategory)
    : slug === "/collections"
      ? await readPathModePublicRuntimeState(siteSlug, "/collections")
    : await readPathModePublicMetadataState(siteSlug, slug);
  const site = state?.sites[0];
  if (!site) return {};
  if (collectionCategory) {
    if (!canResolveCollectionSlugForSite(state, site, collectionCategory)) return {};
    return metadataForSeoDirectory(site, "collection", collectionCategory);
  }
  if (dreamshootPartnerTemplateSlugs.has(slug) && (isSpanishXbyStorefrontSite(site) || isDreamshootPartnerTemplateSite(site))) {
    return metadataForDreamshootFallbackRoute(publicSiteSlug(siteSlug), slug, {
      primaryDomain: site.primaryDomain,
      ogImage: site.themeSettings.publishedJson.seo?.defaultOgImage,
      siteName: site.branding.logoText || site.name
    });
  }
  const policySeo = storefrontPolicySeoForSite(site, slug);
  if (policySeo) {
    return {
      title: policySeo.title,
      description: policySeo.description,
      keywords: policySeo.keywords,
      robots: {
        follow: policySeo.follow,
        index: policySeo.index
      },
      alternates: {
        canonical: policyCanonicalUrlForSite(site, policySeo.canonicalPath)
      }
    };
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
  const publicSlug = publicSiteSlug(siteSlug);
  if (slug === "/about") redirect(`/site/${publicSlug}/about-us`);
  if (slug === "/contact") redirect(`/site/${publicSlug}/contact-us`);
  if (slug === "/help" && /mydreamshoots|dreamshoot|aidreamcapes/i.test(publicSlug)) redirect(`/site/${publicSlug}/faq`);
  if (slug === "/how-it-works" && /mydreamshoots|dreamshoot|aidreamcapes/i.test(publicSlug)) redirect(`/site/${publicSlug}/workflow`);
  if (slug === "/examples") redirect(`/site/${publicSlug}/collections`);
  if (slug === "/packages") redirect(`/site/${publicSlug}/collections`);
  if (slug === "/privacy-policy" || slug === "/policies/privacy") redirect(`/site/${publicSlug}/privacy`);
  if (slug === "/terms-of-service" || slug === "/policies/terms") redirect(`/site/${publicSlug}/terms`);
  if (slug === "/cookie-policy" || slug === "/policies/cookies") redirect(`/site/${publicSlug}/cookies`);
  if (slug === "/refund-policy" || slug === "/policies/refund" || slug === "/policies/refunds") redirect(`/site/${publicSlug}/refunds`);
  if (slug === "/content-policy" || slug === "/policies/content") redirect(`/site/${publicSlug}/content`);
  if (slug === "/shipping-policy" || slug === "/delivery-policy" || slug === "/policies/shipping") redirect(`/site/${publicSlug}/shipping`);
  if (slug === "/checkout") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ? await searchParams : {})) {
      if (typeof value === "string") query.set(key, value);
      else if (Array.isArray(value)) {
        for (const item of value) query.append(key, item);
      }
    }
    redirect(`/site/${publicSlug}/cart${query.size ? `?${query.toString()}` : ""}`);
  }
  if (slug === "/tool") redirect(`/site/${publicSlug}/tools`);
  if (slug === "/dashboard") {
    redirect(`/site/${publicSlug}/app/create`);
  }
  if (slug === "/account") redirect(`/site/${publicSlug}/app/create`);
  if (path[0] === "app") {
    if (slug === "/app") redirect(`/site/${publicSlug}/app/create`);
    const query = searchParams ? await searchParams : {};
    return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug, query, routeMode: "path" });
  }
  if (path[0] === "job" && path[1]) redirect(`/site/${publicSlug}/app/jobs/${path[1]}`);
  const collectionCategory = path[0] === "collections" && path[1] ? path[1] : "";
  const query = {
    ...(searchParams ? await searchParams : {}),
    ...(collectionCategory ? { category: collectionCategory } : {})
  };
  const pageSlug = collectionCategory ? "/collections" : publicContentPageSlug(slug);
  const state = collectionCategory
    ? await readCollectionRouteState(publicSlug, collectionCategory)
    : await readPathModePublicRuntimeState(publicSlug, pageSlug);
  const publicSite = state?.sites[0];
  if (!state || !publicSite) notFound();
  if (collectionCategory) {
    const canonicalCollectionPath = canonicalSeoDirectoryPathForSite(publicSite, "collection", collectionCategory);
    if (canonicalCollectionPath !== `/collections/${collectionCategory}`) redirect(`/site/${publicSlug}${canonicalCollectionPath}`);
  }
  if (collectionCategory && !canResolveCollectionSlugForSite(state, publicSite, collectionCategory)) notFound();
  const canUseDreamShootPartnerTemplate =
    dreamshootPartnerTemplateSlugs.has(pageSlug) &&
    isDreamshootPartnerTemplateSite(publicSite);
  const canUseStorefrontPolicy = Boolean(storefrontPolicySeoForSite(publicSite, pageSlug));
  if (!collectionCategory && !findPage(publicSite, pageSlug) && !canUseDreamShootPartnerTemplate && !canUseStorefrontPolicy) notFound();
  return renderStorefrontPage({ site: publicSite, slug: pageSlug, query, state, deferCustomerRuntime: pageSlug !== "/cart" });
}
