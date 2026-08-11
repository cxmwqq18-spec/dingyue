import type { Metadata } from "next";
import { headers } from "next/headers";
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
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { storefrontPathForRouteMode, storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";

const dreamshootPartnerTemplateSlugs = new Set([
  "/workflow",
  "/faq",
  "/creators-circle",
  "/partner-registration",
  "/about-us",
  "/contact-us",
  "/best-packages",
  "/best-ai-image",
  "/best-ai-video"
]);
const aidreamcapesLegacyBlogCategoryRedirects: Record<string, string> = {
  "fan-scene-albums": "/blog/private-fan-scene-album-photo-package-guide",
  "private-fan-scene-albums": "/blog/private-fan-scene-album-photo-package-guide",
  "backstage-meetup-portraits": "/blog/backstage-meetup-portraits-photo-package-guide",
  "supporter-photo-walls": "/blog/creator-supporter-photo-wall-photo-package-guide",
  "fan-keepsake-card-sets": "/blog/fan-keepsake-card-set-photo-package-guide",
  "game-day-group-photos": "/blog/game-day-group-portraits-photo-package-guide",
  "game-day-group-portraits": "/blog/game-day-group-portraits-photo-package-guide",
  "stadium-night-fan-sets": "/blog/stadium-night-fan-set-photo-package-guide",
  "watch-party-albums": "/blog/championship-watch-party-album-photo-package-guide",
  "premiere-style-portraits": "/blog/premiere-flash-portraits-photo-package-guide",
  "premiere-flash-portraits": "/blog/premiere-flash-portraits-photo-package-guide",
  "vip-arrival-photo-sets": "/blog/vip-arrival-photo-set-photo-package-guide",
  "award-night-keepsake-albums": "/blog/award-night-keepsake-album-photo-package-guide",
  "christmas-holiday-albums": "/blog/christmas-group-album-photo-package-guide",
  "christmas-group-albums": "/blog/christmas-group-album-photo-package-guide",
  "cozy-card-portrait-sets": "/blog/cozy-card-portrait-set-photo-package-guide",
  "winter-fan-greeting-albums": "/blog/winter-fan-greeting-album-photo-package-guide",
  "thanksgiving-memory-sets": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "thanksgiving-table-keepsakes": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "gratitude-group-portraits": "/blog/gratitude-group-portrait-album-photo-package-guide",
  "friendsgiving-memory-sets": "/blog/friendsgiving-memory-set-photo-package-guide",
  "halloween-party-portraits": "/blog/halloween-party-portrait-set-photo-package-guide",
  "halloween-party-portrait-sets": "/blog/halloween-party-portrait-set-photo-package-guide",
  "costume-cast-photo-albums": "/blog/costume-cast-photo-album-photo-package-guide",
  "seasonal-celebration-photos": "/blog/seasonal-celebration-photo-set-photo-package-guide",
  "birthday-fan-moment-sets": "/blog/birthday-fan-moment-set-photo-package-guide",
  "new-year-countdown-albums": "/blog/new-year-countdown-group-album-photo-package-guide"
};
const aidreamcapesLegacyBlogDirectRedirects: Record<string, string> = {
  "fan-scene-photo-albums-guide": "/blog/private-fan-scene-album-photo-package-guide",
  "game-day-group-portraits-guide": "/blog/game-day-group-portraits-photo-package-guide",
  "premiere-style-photo-sets-guide": "/blog/premiere-flash-portraits-photo-package-guide",
  "holiday-memory-albums-guide": "/blog/christmas-group-album-photo-package-guide",
  "thanksgiving-keepsake-sets-category-guide": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "halloween-party-portraits-category-guide": "/blog/halloween-party-portrait-set-photo-package-guide",
  "seasonal-celebration-photos-category-guide": "/blog/seasonal-celebration-photo-set-photo-package-guide",
  "permission-safe-fan-scene-references": "/blog/family-occasion-portrait-album-photo-package-guide",
  "private-album-credit-planning": "/blog/private-fan-scene-album-photo-package-guide"
};
const aidreamcapesLegacyBlogToolRedirects: Record<string, string> = {
  "fan-scene-builders-guide": "/blog/private-fan-scene-album-photo-package-guide",
  "game-day-builders-guide": "/blog/game-day-group-portraits-photo-package-guide",
  "premiere-creator-tools-guide": "/blog/premiere-flash-portraits-photo-package-guide",
  "holiday-album-tools-guide": "/blog/christmas-group-album-photo-package-guide",
  "occasion-card-tools-guide": "/blog/seasonal-celebration-photo-set-photo-package-guide",
  "safety-prep-tools-guide": "/blog/family-occasion-portrait-album-photo-package-guide",
  "fan-scene-album-builder": "/blog/private-fan-scene-album-photo-package-guide",
  "backstage-meetup-scene-builder": "/blog/backstage-meetup-portraits-photo-package-guide",
  "supporter-photo-wall-maker": "/blog/creator-supporter-photo-wall-photo-package-guide",
  "fan-keepsake-card-maker": "/blog/fan-keepsake-card-set-photo-package-guide",
  "game-day-group-portrait-maker": "/blog/game-day-group-portraits-photo-package-guide",
  "stadium-night-fan-set-maker": "/blog/stadium-night-fan-set-photo-package-guide",
  "watch-party-album-builder": "/blog/championship-watch-party-album-photo-package-guide",
  "premiere-portrait-set-builder": "/blog/premiere-flash-portraits-photo-package-guide",
  "vip-arrival-photo-maker": "/blog/vip-arrival-photo-set-photo-package-guide",
  "award-night-album-studio": "/blog/award-night-keepsake-album-photo-package-guide",
  "new-year-countdown-album-maker": "/blog/new-year-countdown-group-album-photo-package-guide",
  "christmas-group-album-studio": "/blog/christmas-group-album-photo-package-guide",
  "cozy-card-portrait-maker": "/blog/cozy-card-portrait-set-photo-package-guide",
  "winter-fan-greeting-maker": "/blog/winter-fan-greeting-album-photo-package-guide",
  "thanksgiving-keepsake-set-maker": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "friendsgiving-memory-maker": "/blog/friendsgiving-memory-set-photo-package-guide",
  "halloween-party-portrait-maker": "/blog/halloween-party-portrait-set-photo-package-guide",
  "costume-cast-album-builder": "/blog/costume-cast-photo-album-photo-package-guide",
  "birthday-fan-moment-maker": "/blog/birthday-fan-moment-set-photo-package-guide",
  "permission-safe-photo-planner": "/blog/family-occasion-portrait-album-photo-package-guide"
};
const aidreamcapesLegacyBlogVideoRedirects: Record<string, string> = {
  "coastal-motion": "/blog/private-fan-scene-album-photo-package-guide",
  "memory-film": "/blog/private-fan-scene-album-photo-package-guide",
  "profile-travel": "/blog/private-fan-scene-album-photo-package-guide",
  "route-motion": "/blog/private-fan-scene-album-photo-package-guide"
};

function isSpanishXbyStorefrontSite(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }): boolean {
  return isSpanishStorefrontSite(site);
}

function aidreamcapesLegacyBlogRedirectPath(siteSlug: string, slug: string): string | undefined {
  if (siteSlug !== "aidreamcapes" || !slug.startsWith("/blog/")) return undefined;
  const articleSlug = slug.slice("/blog/".length).trim().toLowerCase();
  const directRedirect = aidreamcapesLegacyBlogDirectRedirects[articleSlug] ?? aidreamcapesLegacyBlogToolRedirects[articleSlug];
  if (directRedirect) return directRedirect;
  if (articleSlug.endsWith("-photo-package-guide")) {
    return aidreamcapesLegacyBlogCategoryRedirects[articleSlug.slice(0, -"-photo-package-guide".length)];
  }
  if (articleSlug.endsWith("-tool-guide")) {
    return aidreamcapesLegacyBlogToolRedirects[articleSlug.slice(0, -"-tool-guide".length)];
  }
  if (articleSlug.endsWith("-video-theme-guide")) {
    return aidreamcapesLegacyBlogVideoRedirects[articleSlug.slice(0, -"-video-theme-guide".length)];
  }
  return undefined;
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
  if (preferLocalPathModeState(siteSlug)) return readPathModePublicRuntimeState(siteSlug, "/collections");
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
    return { title: isSpanishStorefrontSite({ slug: siteSlug, name: siteSlug, branding: { logoText: siteSlug } }) ? "Espacio privado" : "Workspace", robots: { index: false, follow: false } };
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
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, publicSlug);
  const routePath = (targetPath: string) => storefrontPathForRouteMode(publicSlug, targetPath, routeMode);
  if (slug === "/about") redirect(routePath("/about-us"));
  if (slug === "/contact") redirect(routePath("/contact-us"));
  if (slug === "/help" && /mydreamshoots|dreamshoot|aidreamcapes/i.test(publicSlug)) redirect(routePath("/faq"));
  if (slug === "/how-it-works" && /mydreamshoots|dreamshoot|aidreamcapes/i.test(publicSlug)) redirect(routePath("/workflow"));
  if (slug === "/examples") redirect(routePath("/collections"));
  if (slug === "/packages") redirect(routePath("/collections"));
  if (slug === "/privacy-policy" || slug === "/policies/privacy") redirect(routePath("/privacy"));
  if (slug === "/terms-of-service" || slug === "/policies/terms") redirect(routePath("/terms"));
  if (slug === "/cookie-policy" || slug === "/policies/cookies") redirect(routePath("/cookies"));
  if (slug === "/refund-policy" || slug === "/policies/refund" || slug === "/policies/refunds") redirect(routePath("/refunds"));
  if (slug === "/content-policy" || slug === "/policies/content") redirect(routePath("/content"));
  if (slug === "/shipping-policy" || slug === "/delivery-policy" || slug === "/policies/shipping") redirect(routePath("/shipping"));
  if (slug === "/children-privacy-policy" || slug === "/childrens-privacy" || slug === "/policies/children-privacy") redirect(routePath("/children-privacy"));
  if (slug === "/state-privacy-rights" || slug === "/california-privacy" || slug === "/ccpa" || slug === "/policies/state-privacy") redirect(routePath("/state-privacy"));
  const aidreamcapesBlogRedirect = aidreamcapesLegacyBlogRedirectPath(publicSlug, slug);
  if (aidreamcapesBlogRedirect && aidreamcapesBlogRedirect !== slug) redirect(routePath(aidreamcapesBlogRedirect));
  if (slug === "/checkout") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ? await searchParams : {})) {
      if (typeof value === "string") query.set(key, value);
      else if (Array.isArray(value)) {
        for (const item of value) query.append(key, item);
      }
    }
    redirect(`${routePath("/cart")}${query.size ? `?${query.toString()}` : ""}`);
  }
  if (slug === "/tool") redirect(routePath("/tools"));
  if (slug === "/dashboard") {
    redirect(routePath("/app/create"));
  }
  if (slug === "/account") redirect(routePath("/app/create"));
  if (path[0] === "app") {
    if (slug === "/app") redirect(routePath("/app/create"));
    const query = searchParams ? await searchParams : {};
    return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug, query, routeMode });
  }
  if (path[0] === "job" && path[1]) redirect(routePath(`/app/jobs/${path[1]}`));
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
    if (canonicalCollectionPath !== `/collections/${collectionCategory}`) redirect(routePath(canonicalCollectionPath));
  }
  if (collectionCategory && !canResolveCollectionSlugForSite(state, publicSite, collectionCategory)) notFound();
  const canUseDreamShootPartnerTemplate =
    dreamshootPartnerTemplateSlugs.has(pageSlug) &&
    (isSpanishXbyStorefrontSite(publicSite) || isDreamshootPartnerTemplateSite(publicSite));
  const canUseStorefrontPolicy = Boolean(storefrontPolicySeoForSite(publicSite, pageSlug));
  if (!collectionCategory && !findPage(publicSite, pageSlug) && !canUseDreamShootPartnerTemplate && !canUseStorefrontPolicy) notFound();
  return renderStorefrontPage({ site: publicSite, slug: pageSlug, query, routeMode, state, deferCustomerRuntime: pageSlug !== "/cart" });
}
