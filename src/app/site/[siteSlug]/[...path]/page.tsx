import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { findPage } from "@/lib/data";
import {
  readStorefrontPublicCollectionDetailStateBySlugFromDatabase,
  readStorefrontPublicPageMetadataStateByHostFromDatabase,
  readStorefrontPublicRuntimeStateByHostFromDatabase,
} from "@/lib/storefront-state";
import { canResolveCollectionSlugForSite, renderCustomerWorkspacePageBySlug, renderStorefrontPage, renderToolPage } from "@/lib/storefront-render";
import { preferLocalPathModeState, readPathModePublicMetadataState, readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { metadataForPublishedStorefrontDirectoryPage, metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { canonicalSeoDirectoryPathForSite } from "@/lib/dreamshoot-seo-content";
import { parsePublicCollectionRouteForSite, parsePublicVideoGenerationRouteForSite } from "@/lib/photo-package-taxonomy";
import { legacyPublicPathTarget, publicContentPageSlug } from "@/lib/site-route-canonical";
import { publicSiteSlug } from "@/lib/domain-routing";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { STOREFRONT_PUBLIC_HOST_HEADER, storefrontPathForRouteMode, storefrontRouteModeForHeaders, type StorefrontRouteMode } from "@/lib/storefront-route-mode";
import { isPrimaryMydreamshootsSlug, usesAiGenerationPublicRoutes, usesAiGenerationPublicSlug } from "@/lib/storefront-context/capabilities";
import { createPublishedSiteSnapshot, resolvePublishedRedirectDisposition, resolvePublishedRouteDisposition } from "@/lib/storefront-context";
import { isMydreamshootsEditorialThemeRoute } from "@/lib/mydreamshoots-editorial-routes";


type HeaderReader = {
  get(name: string): string | null;
};

function publicHostCandidates(headers: HeaderReader): Array<string | null> {
  return [
    headers.get(STOREFRONT_PUBLIC_HOST_HEADER),
    headers.get("x-forwarded-host"),
    headers.get("host")
  ];
}

async function readRoutePublicRuntimeState(
  headers: HeaderReader,
  routeMode: StorefrontRouteMode,
  publicSlug: string,
  pageSlug: string,
  contextSlug?: string
) {
  if (routeMode === "host") {
    for (const host of publicHostCandidates(headers)) {
      const state = await readStorefrontPublicRuntimeStateByHostFromDatabase(host, pageSlug, contextSlug);
      if (state?.sites[0]) return state;
    }
  }
  return readPathModePublicRuntimeState(publicSlug, pageSlug, contextSlug);
}

async function readRoutePublicMetadataState(
  headers: HeaderReader,
  routeMode: StorefrontRouteMode,
  publicSlug: string,
  pageSlug: string
) {
  if (routeMode === "host") {
    for (const host of publicHostCandidates(headers)) {
      const state = await readStorefrontPublicPageMetadataStateByHostFromDatabase(host, pageSlug);
      if (state?.sites[0]) return state;
    }
  }
  return readPathModePublicMetadataState(publicSlug, pageSlug);
}
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
  return !isSpanishXbyStorefrontSite(site) && usesAiGenerationPublicRoutes({ id: "", slug: site.slug });
}

function isCollectionRouteRequest(path: string[]): boolean {
  return path[0] === "ai-image-generation" || path[0] === "collections";
}

function isVideoGenerationRouteRequest(path: string[]): boolean {
  return path[0] === "ai-video-generation" && !isMydreamshootsEditorialThemeRoute(`/${path.join("/")}`);
}

function canRenderPublishedPublicPath(
  snapshot: ReturnType<typeof createPublishedSiteSnapshot>,
  internalPath: string,
  requestedPath: string,
  site?: Parameters<typeof findPage>[0]
): boolean {
  const disposition = resolvePublishedRouteDisposition(snapshot, internalPath);
  if (disposition.kind === "render" || (disposition.kind === "redirect" && disposition.targetPath === requestedPath)) return true;
  // Keep already-published standard-content pages reachable while an older
  // immutable publication is being replaced. The page itself is still
  // required to carry the requested canonical path; draft-only pages never
  // pass this compatibility check.
  const page = site ? findPage(site, internalPath) : undefined;
  return (page?.pageType === "standard-content" || page?.pageType === "content") && page.publishedJson?.seo?.canonicalPath === internalPath;
}

function collectionRouteLookupSlug(path: string[]): string {
  if (path[0] === "ai-image-generation") return path[1] || "";
  if (path[0] === "collections") return path[1] || "";
  return "";
}

function searchParamsSuffix(query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function fallbackCollectionRootPathForPublicSlug(publicSlug: string): string {
  return (publicSlug === "grownstride" || isPrimaryMydreamshootsSlug(publicSlug))
    ? "/ai-image-generation"
    : "/collections";
}

async function readCollectionRouteState(
  siteSlug: string,
  collectionCategory: string,
  headers?: HeaderReader,
  routeMode: StorefrontRouteMode = "path"
) {
  const collectionRootPageSlug = fallbackCollectionRootPathForPublicSlug(siteSlug);
  if (routeMode === "host" && headers) {
    const hostState = await readRoutePublicRuntimeState(
      headers,
      routeMode,
      siteSlug,
      collectionRootPageSlug,
      collectionCategory || undefined
    );
    if (hostState?.sites[0]) return hostState;
  }
  if (preferLocalPathModeState(siteSlug)) return readPathModePublicRuntimeState(siteSlug, collectionRootPageSlug);
  try {
    const detailState = await readStorefrontPublicCollectionDetailStateBySlugFromDatabase(siteSlug, collectionCategory);
    const detailSite = detailState?.sites[0];
    if (detailState && detailSite && canResolveCollectionSlugForSite(detailState, detailSite, collectionCategory)) return detailState;
  } catch {
    // Continue to the broader collections state or local JSON fallback.
  }
  return readPathModePublicRuntimeState(siteSlug, collectionRootPageSlug);
}

async function readVideoGenerationRouteState(siteSlug: string, videoSlug: string) {
  if (videoSlug) {
    const detailState = await readPathModePublicRuntimeState(siteSlug, `/ai-video-generation/${videoSlug}`);
    if (detailState) return detailState;
  }
  return readPathModePublicRuntimeState(siteSlug, "/ai-video-generation");
}

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; path: string[] }> }): Promise<Metadata> {
  const { siteSlug, path } = await params;
  const requestedSlug = `/${path.join("/")}`;
  const isCollectionRequest = isCollectionRouteRequest(path);
  const isVideoGenerationRequest = isVideoGenerationRouteRequest(path);
  const collectionRootPageSlug = fallbackCollectionRootPathForPublicSlug(siteSlug);
  const collectionLookupSlug = collectionRouteLookupSlug(path);
  const videoLookupSlug = isVideoGenerationRequest ? path[1] || "" : "";
  const slug = isCollectionRequest ? collectionRootPageSlug : isVideoGenerationRequest ? "/ai-video-generation" : publicContentPageSlug(requestedSlug);
  if (slug === "/account") {
    return { title: isSpanishStorefrontSite({ slug: siteSlug, name: siteSlug, branding: { logoText: siteSlug } }) ? "Cuenta" : "Account", robots: { index: false, follow: false } };
  }
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, siteSlug);
  const state = isVideoGenerationRequest
    ? routeMode === "host"
      ? await readRoutePublicRuntimeState(headerStore, routeMode, siteSlug, `/ai-video-generation/${videoLookupSlug || ""}`.replace(/\/$/, ""), videoLookupSlug || undefined)
      : await readVideoGenerationRouteState(siteSlug, videoLookupSlug)
    : isCollectionRequest && collectionLookupSlug
    ? routeMode === "host"
      ? await readRoutePublicRuntimeState(headerStore, routeMode, siteSlug, collectionRootPageSlug, collectionLookupSlug)
      : await readCollectionRouteState(siteSlug, collectionLookupSlug, headerStore, routeMode)
    : slug === "/ai-image-generation"
      ? routeMode === "host"
        ? await readRoutePublicRuntimeState(headerStore, routeMode, siteSlug, "/ai-image-generation")
        : await readPathModePublicRuntimeState(siteSlug, "/ai-image-generation")
    : await readRoutePublicMetadataState(headerStore, routeMode, siteSlug, slug);
  const site = state?.sites[0];
  if (!site) return {};
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "platform-state" });
  const videoGenerationRoute = isVideoGenerationRequest ? parsePublicVideoGenerationRouteForSite(site, path) : undefined;
  if (isVideoGenerationRequest) {
    if (!videoGenerationRoute) return {};
    if (videoGenerationRoute.itemSlug) {
      const disposition = resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath);
      if (disposition.kind !== "render") return {};
      const page = snapshot.pages.find((candidate) => candidate.id === disposition.pageId);
      return page ? metadataForPublishedStorefrontDirectoryPage({
        site,
        page,
        kind: "tool",
        directorySlug: videoGenerationRoute.itemSlug,
        path: videoGenerationRoute.canonicalPath,
        products: state.products,
        creativePacks: state.creativePacks,
        snapshot
      }) : {};
    }
    if (resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath).kind !== "render") return {};
    const page = findPage(site, "/ai-video-generation");
    return page ? metadataForPublishedStorefrontPage({ site, page, products: state.products, creativePacks: state.creativePacks, snapshot }) : {};
  }
  const collectionRoute = isCollectionRequest ? parsePublicCollectionRouteForSite(site, path) : undefined;
  if (isCollectionRequest) {
    if (!collectionRoute) return {};
    if (collectionRoute.collectionSlug && resolvePublishedRouteDisposition(snapshot, collectionRoute.canonicalPath).kind !== "render") return {};
    if (collectionRoute.collectionSlug && !canResolveCollectionSlugForSite(state, site, collectionRoute.collectionSlug)) return {};
    if (resolvePublishedRouteDisposition(snapshot, collectionRootPageSlug).kind !== "render") return {};
    const page = findPage(site, collectionRootPageSlug) ?? findPage(site, "/collections");
    if (collectionRoute.collectionSlug && page) {
      return metadataForPublishedStorefrontDirectoryPage({
        site,
        page,
        kind: "collection",
        directorySlug: collectionRoute.collectionSlug,
        path: collectionRoute.canonicalPath,
        products: state.products,
        creativePacks: state.creativePacks,
        snapshot
      });
    }
    return page ? metadataForPublishedStorefrontPage({ site, page, products: state.products, creativePacks: state.creativePacks, snapshot }) : {};
  }
  if (!canRenderPublishedPublicPath(snapshot, slug, requestedSlug, site)) return {};
  const page = findPage(site, slug);
  return page ? metadataForPublishedStorefrontPage({ site, page, products: state.products, creativePacks: state.creativePacks, snapshot }) : {};
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
  const legacyAliasTarget = legacyPublicPathTarget(slug, fallbackCollectionRootPathForPublicSlug(publicSlug));
  if (legacyAliasTarget && (slug === "/collections/engagement-photo" || slug === "/collections/headshot")) {
    permanentRedirect(routePath(legacyAliasTarget));
  }
  if (slug === "/help" && usesAiGenerationPublicSlug(publicSlug)) redirect(routePath("/faq"));
  if (slug === "/how-it-works" && usesAiGenerationPublicSlug(publicSlug)) redirect(routePath("/workflow"));
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
  if (slug === "/workspace") {
    const query = searchParams ? await searchParams : {};
    redirect(`${routePath("/app/create")}${searchParamsSuffix(query)}`);
  }
  if (slug === "/tool") {
    if (isPrimaryMydreamshootsSlug(publicSlug)) notFound();
    redirect(routePath("/tools"));
  }
  if (slug === "/dashboard") {
    redirect(routePath("/app/create"));
  }
  if (slug === "/account") {
    const query = searchParams ? await searchParams : {};
    return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug, query, routeMode });
  }
  if (path[0] === "app") {
    if (slug === "/app") redirect(routePath("/app/create"));
    const query = searchParams ? await searchParams : {};
    const videoMode = Array.isArray(query.videoMode) ? query.videoMode[0] : query.videoMode;
    if (videoMode === "text-to-video" || videoMode === "image-to-video") notFound();
    return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug, query, routeMode });
  }
  if (path[0] === "job" && path[1]) redirect(routePath(`/app/jobs/${path[1]}`));
  if (path[0] === "tools" && isPrimaryMydreamshootsSlug(publicSlug)) notFound();
  const isCollectionRequest = isCollectionRouteRequest(path);
  const isVideoGenerationRequest = isVideoGenerationRouteRequest(path);
  const collectionRootPageSlug = fallbackCollectionRootPathForPublicSlug(publicSlug);
  const collectionLookupSlug = collectionRouteLookupSlug(path);
  const videoLookupSlug = isVideoGenerationRequest ? path[1] || "" : "";
  const query = {
    ...(searchParams ? await searchParams : {}),
  };
  const legacyPathTarget = legacyPublicPathTarget(slug, collectionRootPageSlug);
  const pageSlug = isCollectionRequest ? collectionRootPageSlug : isVideoGenerationRequest ? "/ai-video-generation" : legacyPathTarget ? publicContentPageSlug(legacyPathTarget) : publicContentPageSlug(slug);
  const state = isVideoGenerationRequest
    ? await readVideoGenerationRouteState(publicSlug, videoLookupSlug)
    : isCollectionRequest && collectionLookupSlug
    ? await readCollectionRouteState(publicSlug, collectionLookupSlug, headerStore, routeMode)
    : await readPathModePublicRuntimeState(publicSlug, pageSlug);
  const publicSite = state?.sites[0];
  if (!state || !publicSite) notFound();
  if (isPrimaryMydreamshootsSlug(publicSlug) && isVideoGenerationRequest && ["text-to-video", "image-to-video"].includes(path[1] ?? "")) {
    notFound();
  }
  const snapshot = createPublishedSiteSnapshot(state, publicSite, { source: "platform-state" });
  const legacyTarget = legacyPublicPathTarget(slug, fallbackCollectionRootPathForPublicSlug(publicSlug));
  // Keep a published seasonal page canonical when it exists. The legacy
  // redirect is only a recovery path for publications that are missing the
  // old navigation URL, so a normal published route must still render 200.
  if (legacyTarget) {
    const disposition = resolvePublishedRedirectDisposition(snapshot, slug, legacyTarget);
    if (disposition.kind === "redirect" && disposition.targetPath) permanentRedirect(routePath(disposition.targetPath));
    notFound();
  }
  const videoGenerationRoute = isVideoGenerationRequest ? parsePublicVideoGenerationRouteForSite(publicSite, path) : undefined;
  if (isVideoGenerationRequest) {
    if (!videoGenerationRoute) notFound();
    if (videoGenerationRoute.itemSlug) {
      const disposition = resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath);
      if (disposition.kind !== "render") notFound();
      const detailPage = snapshot.pages.find((candidate) => candidate.id === disposition.pageId);
      if (!detailPage) notFound();
      return renderToolPage({
        site: publicSite,
        toolSlug: videoGenerationRoute.itemSlug,
        publicPath: videoGenerationRoute.canonicalPath,
        query,
        routeMode,
        state,
        resolvedPage: detailPage
      });
    }
    if (resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath).kind !== "render") notFound();
    return renderStorefrontPage({ site: publicSite, slug: "/ai-video-generation", publicPath: videoGenerationRoute.canonicalPath, query, routeMode, state, deferCustomerRuntime: true });
  }
  const collectionRoute = isCollectionRequest ? parsePublicCollectionRouteForSite(publicSite, path) : undefined;
  if (isCollectionRequest && !collectionRoute) notFound();
  const collectionCategory = collectionRoute?.collectionSlug ?? "";
  const storefrontQuery = {
    ...query,
    ...(collectionCategory ? { category: collectionCategory } : {})
  };
  if (collectionRoute) {
    if (resolvePublishedRouteDisposition(snapshot, collectionRootPageSlug).kind !== "render") notFound();
    if (collectionRoute.collectionSlug && resolvePublishedRouteDisposition(snapshot, collectionRoute.canonicalPath).kind !== "render") notFound();
    const canonicalCollectionPath = canonicalSeoDirectoryPathForSite(publicSite, "collection", collectionRoute.collectionSlug);
    if (canonicalCollectionPath !== collectionRoute.canonicalPath) redirect(routePath(canonicalCollectionPath));
  }
  if (collectionCategory && !canResolveCollectionSlugForSite(state, publicSite, collectionCategory)) notFound();
  if (!isCollectionRequest && !canRenderPublishedPublicPath(snapshot, pageSlug, slug, publicSite)) notFound();
  if (!isCollectionRequest && !findPage(publicSite, pageSlug) && resolvePublishedRouteDisposition(snapshot, pageSlug).kind !== "render") notFound();
  const publicPath = collectionRoute?.canonicalPath ?? publicContentPageSlug(slug);
  return renderStorefrontPage({ site: publicSite, slug: pageSlug, publicPath, query: storefrontQuery, routeMode, state, deferCustomerRuntime: pageSlug !== "/cart" });
}
