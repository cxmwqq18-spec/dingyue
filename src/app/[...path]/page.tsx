import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { cleanHost, getSiteByHostCandidatesFromState, isPlatformHost, publicSiteUrl, siteAdminPathForHost } from "@/lib/domain-routing";
import { findPage } from "@/lib/data";
import {
  readStorefrontPublicCollectionDetailStateBySlugFromDatabase,
  readStorefrontPlatformStateFromDatabase,
  readStorefrontPublicRuntimeStateByHostFromDatabase,
  readStorefrontSiteByHostFromDatabase,
  readStorefrontRuntimeStateByHostFromDatabase
} from "@/lib/storefront-state";
import {
  canResolveCollectionSlugForSite,
  renderCustomerJobDetailPage,
  renderCustomerWorkspacePage,
  renderCustomerWorkspacePageBySlug,
  renderStorefrontPage,
  renderToolPage,
  resolveToolPageForSite
} from "@/lib/storefront-render";
import { canonicalSeoDirectoryPathForSite } from "@/lib/dreamshoot-seo-content";
import { parsePublicCollectionRouteForSite, parsePublicVideoGenerationRouteForSite, publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { metadataForPublishedStorefrontDirectoryPage, metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { legacyPublicPathTarget, publicContentPageSlug } from "@/lib/site-route-canonical";
import { customerSessionCookie } from "@/lib/session";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { isAidreamcapesSite as isAidreamcapesCapabilitySite, usesAiGenerationPublicRoutes } from "@/lib/storefront-context/capabilities";
import { createPublishedSiteSnapshot, resolvePublishedRedirectDisposition, resolvePublishedRouteDisposition } from "@/lib/storefront-context";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { getSiteByHostForPublicAuth, getVideoThemeSlugRedirectRelational } from "@/lib/stores/site-store";
import type { PlatformState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DREAMSHOOT_LEGACY_TOOL_REDIRECTS: Record<string, string> = {};
const AIDREAMCAPES_LEGACY_TOOL_REDIRECTS: Record<string, string> = {
  "ai-image-studio": "/tools",
  "background-changer": "/tools/fan-scene-album-builder",
  "background-remover": "/tools/fan-scene-album-builder",
  "dreamscape-generator": "/tools/fan-scene-album-builder",
  "image-generator": "/tools/fan-scene-album-builder",
  "image-to-video": "/tools/new-year-countdown-album-maker",
  "image-studio": "/tools",
  "portrait-generator": "/tools/fan-scene-album-builder",
  "portrait-maker": "/tools/fan-scene-album-builder",
  "product-reverie": "/tools/permission-safe-photo-planner",
  "soft-glam": "/tools/premiere-portrait-set-builder",
  "couple-escape-album": "/tools/birthday-fan-moment-maker",
  "wedding-portraits": "/tools/birthday-fan-moment-maker",
  "world-cup-fan-photos": "/tools/game-day-group-portrait-maker",
  headshot: "/tools/premiere-portrait-set-builder",
  "route-portrait-engine": "/tools/fan-scene-album-builder",
  "coastal-portrait": "/tools/christmas-group-album-studio",
  "island-resort-scenes": "/tools/new-year-countdown-album-maker",
  "scenic-overlook-story": "/tools/game-day-group-portrait-maker",
  "travel-profile-story": "/tools/fan-scene-album-builder",
  "editorial-getaway": "/tools/premiere-portrait-set-builder",
  "cafe-street-story": "/tools/premiere-portrait-set-builder",
  "cinematic-travel": "/tools/game-day-group-portrait-maker",
  "route-moodboard": "/tools/permission-safe-photo-planner",
  "social-keepsake": "/tools/birthday-fan-moment-maker",
  "family-travel-keepsakes": "/tools/thanksgiving-keepsake-set-maker",
  "seasonal-celebration-album-maker": "/tools/new-year-countdown-album-maker",
  "travel-journal-cover-maker": "/tools/new-year-countdown-album-maker"
};
const DREAMSHOOT_LEGACY_BLOG_CATEGORY_REDIRECTS: Record<string, string> = {
  "ai-video-add-ons": "/blog/video-photo-package-guide"
};
const DREAMSHOOT_LEGACY_BLOG_TOOL_REDIRECTS: Record<string, string> = {
  "ai-photo-edit": "/blog/utility-image-prep-guide",
  "album-story-video": "/blog/video-photo-package-guide",
  "animated-avatar": "/blog/avatar-photo-package-guide",
  "background-changer": "/blog/utility-image-prep-guide",
  "background-remover": "/blog/utility-image-prep-guide",
  "color-correction": "/blog/utility-image-prep-guide",
  "creator-intro-video": "/blog/video-photo-package-guide",
  "creator-portrait": "/blog/creator-photo-package-guide",
  "cyberpunk-portrait": "/blog/creative-photo-package-guide",
  "edit-by-prompt": "/blog/utility-image-prep-guide",
  "fan-poster-motion": "/blog/video-photo-package-guide",
  "fashion-editorial": "/blog/creator-photo-package-guide",
  "fashion-reel": "/blog/video-photo-package-guide",
  "gala-photo": "/blog/creative-photo-package-guide",
  headshot: "/blog/headshot-photo-package-guide",
  "image-to-video": "/blog/video-photo-package-guide",
  "magic-eraser": "/blog/utility-image-prep-guide",
  "magic-upscaler": "/blog/utility-image-prep-guide",
  "nature-adventure": "/blog/creative-photo-package-guide",
  "noir-portrait": "/blog/creative-photo-package-guide",
  "old-photo-restoration": "/blog/utility-image-prep-guide",
  "photo-ai": "/blog/choosing-ai-photo-packages",
  "photo-enhancer": "/blog/utility-image-prep-guide",
  "portrait-retouch": "/blog/utility-image-prep-guide",
  "product-lifestyle": "/blog/creator-photo-package-guide",
  "product-teaser-clip": "/blog/video-photo-package-guide",
  "profile-clip": "/blog/video-photo-package-guide",
  "unblur-image": "/blog/utility-image-prep-guide",
  "video-ai": "/blog/video-photo-package-guide",
  "world-cup-fan-photos": "/blog/sports-fan-photo-guide"
};
const DREAMSHOOT_LEGACY_BLOG_VIDEO_REDIRECTS: Record<string, string> = {
  "creator-motion": "/blog/video-photo-package-guide",
  "portrait-motion": "/blog/video-photo-package-guide",
  "product-teaser": "/blog/video-photo-package-guide",
  "social-cards": "/blog/video-photo-package-guide",
  "wedding-memory": "/blog/video-photo-package-guide"
};
const AIDREAMCAPES_LEGACY_BLOG_CATEGORY_REDIRECTS: Record<string, string> = {
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
const AIDREAMCAPES_LEGACY_BLOG_DIRECT_REDIRECTS: Record<string, string> = {
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
const AIDREAMCAPES_LEGACY_BLOG_TOOL_REDIRECTS: Record<string, string> = {
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
const AIDREAMCAPES_LEGACY_BLOG_VIDEO_REDIRECTS: Record<string, string> = {
  "coastal-motion": "/blog/private-fan-scene-album-photo-package-guide",
  "memory-film": "/blog/private-fan-scene-album-photo-package-guide",
  "profile-travel": "/blog/private-fan-scene-album-photo-package-guide",
  "route-motion": "/blog/private-fan-scene-album-photo-package-guide"
};
const PUBLIC_DIRECTORY_PAGE_SLUGS = new Set(["/collections", "/tools", "/ai-image-generation", "/ai-video-generation", "/best-packages", "/best-ai-image", "/best-ai-video"]);
const DREAMSHOOT_PARTNER_TEMPLATE_SLUGS = new Set(["/workflow", "/faq", "/creators-circle", "/partner-registration", "/about-us", "/contact-us", "/best-packages", "/best-ai-image", "/best-ai-video"]);
const STATIC_ASSET_REQUEST_SEGMENTS = new Set(["_next", "assets"]);

function isStaticAssetCatchAllRequest(firstSegment: string): boolean {
  return STATIC_ASSET_REQUEST_SEGMENTS.has(firstSegment);
}

async function hasAnyCustomerSessionCookie(): Promise<boolean> {
  return (await cookies()).getAll().some((cookie) => cookie.name.startsWith("customer_session_") && Boolean(cookie.value));
}

async function hasValidCustomerSessionForSite(site: { id: string }): Promise<boolean> {
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  if (!sessionId) return false;
  const relationalCustomer = await getCustomerBySessionRelational({ siteId: site.id, sessionId });
  return Boolean(relationalCustomer);
}

function safeHostCustomerNextPath(value: string | string[] | undefined, fallback = "/app/create"): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue !== "string") return fallback;
  const path = rawValue.trim();
  if (!path || !path.startsWith("/") || path.startsWith("//")) return fallback;
  if (/^\/(?:login|logout)(?:[/?#]|$)/i.test(path)) return fallback;
  return path;
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

function isMydreamshootsSite(site: { id?: string; slug: string; name: string; branding: { logoText: string } }): boolean {
  const hasVideoCapability = site.id
    ? usesAiGenerationPublicRoutes({ id: site.id, slug: site.slug })
    : site.slug.trim().toLowerCase() === "mydreamshoots";
  return hasVideoCapability && site.slug.trim().toLowerCase() === "mydreamshoots";
}

function isAidreamcapesSite(site: { slug: string; name: string; branding: { logoText: string } }): boolean {
  return isAidreamcapesCapabilitySite({ id: "", slug: site.slug });
}

function isCollectionRouteRequest(path: string[]): boolean {
  return path[0] === "ai-image-generation" || path[0] === "collections";
}

function isVideoGenerationRouteRequest(path: string[]): boolean {
  return path[0] === "ai-video-generation";
}

function collectionRouteLookupSlug(path: string[]): string {
  if (path[0] === "ai-image-generation") return path[1] || "";
  if (path[0] === "collections") return path[1] || "";
  return "";
}

function isMydreamshootsPublicSlug(slug: string | undefined): boolean {
  const value = slug ?? "";
  return value === "grownstride" || value === "mydreamshoots";
}

function fallbackCollectionRootPathForHost(host: string | null | undefined): string {
  return isMydreamshootsPublicSlug(knownWorkspaceSiteSlugForHost([host ?? null])) ? "/ai-image-generation" : "/collections";
}

function isSpanishXbyStorefrontSite(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }): boolean {
  return isSpanishStorefrontSite(site);
}

function canUseStorefrontPartnerTemplate(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }, slug: string): boolean {
  return DREAMSHOOT_PARTNER_TEMPLATE_SLUGS.has(slug) && (isSpanishXbyStorefrontSite(site) || isMydreamshootsSite(site) || isAidreamcapesSite(site));
}

function redirectMydreamshootsLegacyTool(site: { slug: string; name: string; branding: { logoText: string } }, toolSlug: string): void {
  if (!isMydreamshootsSite(site)) return;
  const redirectPath = DREAMSHOOT_LEGACY_TOOL_REDIRECTS[toolSlug.trim().toLowerCase()];
  if (redirectPath) permanentRedirect(redirectPath);
}

function redirectAidreamcapesLegacyTool(site: { slug: string; name: string; branding: { logoText: string } }, toolSlug: string): void {
  if (!isAidreamcapesSite(site)) return;
  const redirectPath = AIDREAMCAPES_LEGACY_TOOL_REDIRECTS[toolSlug.trim().toLowerCase()];
  if (redirectPath) permanentRedirect(redirectPath);
}

function legacyBlogRedirectPath(
  articleSlug: string,
  categoryRedirects: Record<string, string>,
  toolRedirects: Record<string, string>,
  videoRedirects: Record<string, string>,
  directRedirects: Record<string, string> = {}
): string | undefined {
  const normalizedSlug = articleSlug.trim().toLowerCase();
  const directLegacyRedirect = directRedirects[normalizedSlug];
  if (directLegacyRedirect) return directLegacyRedirect;
  const directRedirect = toolRedirects[normalizedSlug];
  if (directRedirect) return directRedirect;
  if (normalizedSlug.endsWith("-photo-package-guide")) {
    return categoryRedirects[normalizedSlug.slice(0, -"-photo-package-guide".length)];
  }
  if (normalizedSlug.endsWith("-tool-guide")) {
    return toolRedirects[normalizedSlug.slice(0, -"-tool-guide".length)];
  }
  if (normalizedSlug.endsWith("-video-theme-guide")) {
    return videoRedirects[normalizedSlug.slice(0, -"-video-theme-guide".length)];
  }
  return undefined;
}

function redirectLegacyBlogArticle(site: { slug: string; name: string; branding: { logoText: string } }, slug: string, query: Record<string, string | string[] | undefined> = {}): void {
  if (!slug.startsWith("/blog/")) return;
  if (isMydreamshootsSite(site) && slug === "/blog/world-cup-fan-photos-photo-package-guide" && process.env.MDS_SOCCER_MIGRATION_APPROVED === "1") {
    permanentRedirect(`/blog/soccer-fan-photo-guide${searchParamsSuffix(query)}`);
  }
  const articleSlug = slug.slice("/blog/".length);
  const redirectPath = isAidreamcapesSite(site)
    ? legacyBlogRedirectPath(
      articleSlug,
      AIDREAMCAPES_LEGACY_BLOG_CATEGORY_REDIRECTS,
      AIDREAMCAPES_LEGACY_BLOG_TOOL_REDIRECTS,
      AIDREAMCAPES_LEGACY_BLOG_VIDEO_REDIRECTS,
      AIDREAMCAPES_LEGACY_BLOG_DIRECT_REDIRECTS
    )
    : isMydreamshootsSite(site)
    ? legacyBlogRedirectPath(articleSlug, DREAMSHOOT_LEGACY_BLOG_CATEGORY_REDIRECTS, DREAMSHOOT_LEGACY_BLOG_TOOL_REDIRECTS, DREAMSHOOT_LEGACY_BLOG_VIDEO_REDIRECTS)
    : undefined;
  if (redirectPath && redirectPath !== slug) permanentRedirect(redirectPath);
}

async function getHostRuntimeStateWithFallback(hosts: Array<string | null>): Promise<PlatformState | undefined> {
  return getHostRuntimeStateForModeWithFallback(hosts, "private");
}

async function getHostPublicRuntimeStateWithFallback(hosts: Array<string | null>, pageSlug?: string): Promise<PlatformState | undefined> {
  return getHostRuntimeStateForModeWithFallback(hosts, "public", pageSlug);
}

async function getHostPublicToolRuntimeStateWithFallback(hosts: Array<string | null>, pageSlug: string, toolSlug: string): Promise<PlatformState | undefined> {
  return getHostRuntimeStateForModeWithFallback(hosts, "public", pageSlug, toolSlug);
}

async function getHostPublicCollectionRuntimeStateWithFallback(hosts: Array<string | null>, collectionSlug: string): Promise<PlatformState | undefined> {
  const normalizedCollectionSlug = collectionSlug.trim();
  for (const host of hosts) {
    if (!host) continue;
    const site = await readStorefrontSiteByHostFromDatabase(host);
    if (!site) continue;
    const state = await readStorefrontPublicCollectionDetailStateBySlugFromDatabase(site.slug, normalizedCollectionSlug);
    const resolved = resolveHostCollectionPage(state, hosts, collectionSlug);
    if (resolved) return state;
  }
  return getHostRuntimeStateForModeWithFallback(hosts, "public", fallbackCollectionRootPathForHost(hosts.find(Boolean)), collectionSlug);
}

function knownWorkspaceSiteSlugForHost(hosts: Array<string | null>): string | undefined {
  for (const hostValue of hosts) {
    const host = cleanHost(hostValue);
    if (!host) continue;
    if (host === "mydreamshoots.com" || host === "www.mydreamshoots.com" || host.endsWith(".mydreamshoots.localhost")) return "mydreamshoots";
    if (host === "grownstride.com" || host === "www.grownstride.com" || host === "test.grownstride.com" || host.endsWith(".grownstride.localhost")) return "grownstride";
    if (host === "aidreamcapes.com" || host === "www.aidreamcapes.com" || host.endsWith(".aidreamcapes.localhost")) return "aidreamcapes";
    if (host === "aidreamshoots.eu" || host === "www.aidreamshoots.eu" || host.endsWith(".aidreamshoots.localhost")) return "aidreamshoots";
    if (host === "aidreamcapes.eu" || host === "www.aidreamcapes.eu") return "aidreamcapes-eu";
  }
  return undefined;
}

async function getHostSiteSlugShellWithFallback(hosts: Array<string | null>): Promise<string | undefined> {
  const knownSlug = knownWorkspaceSiteSlugForHost(hosts);
  if (knownSlug) return knownSlug;
  try {
    for (const host of hosts) {
      const site = await getSiteByHostForPublicAuth(host);
      if (site) return site.slug;
    }
  } catch {
    // Fall through to the full state reader for local or migrating databases.
  }
  const state = await readStorefrontPlatformStateFromDatabase();
  return getSiteByHostCandidatesFromState(state, hosts)?.slug;
}

async function getHostRuntimeStateForModeWithFallback(hosts: Array<string | null>, mode: "public" | "private", pageSlug?: string, contextSlug?: string): Promise<PlatformState | undefined> {
  try {
    for (const host of hosts) {
      const state = mode === "public"
        ? await readStorefrontPublicRuntimeStateByHostFromDatabase(host, pageSlug, contextSlug)
        : await readStorefrontRuntimeStateByHostFromDatabase(host);
      if (state) return state;
    }
  } catch {
    // Fall through to the full state reader for local or migrating databases.
  }
  const state = await readStorefrontPlatformStateFromDatabase();
  const site = getSiteByHostCandidatesFromState(state, hosts);
  return site ? state : undefined;
}

function resolveHostToolPage(state: PlatformState | undefined, hosts: Array<string | null>, toolSlug: string) {
  const site = state ? getSiteByHostCandidatesFromState(state, hosts) ?? state.sites[0] : undefined;
  if (!state || !site) return undefined;
  const resolved = resolveToolPageForSite(state, site, toolSlug);
  return resolved.matched ? { state, site, ...resolved } : undefined;
}

function resolveHostCollectionPage(state: PlatformState | undefined, hosts: Array<string | null>, collectionSlug: string) {
  const site = state ? getSiteByHostCandidatesFromState(state, hosts) ?? state.sites[0] : undefined;
  if (!state || !site) return undefined;
  return canResolveCollectionSlugForSite(state, site, collectionSlug) ? { state, site } : undefined;
}

async function resolveHostToolPageWithFallback(hosts: Array<string | null>, toolSlug: string) {
  const detailState = await getHostPublicToolRuntimeStateWithFallback(hosts, `/ai-video-generation/${toolSlug}`, toolSlug);
  const detailResolved = resolveHostToolPage(detailState, hosts, toolSlug);
  if (detailResolved) return detailResolved;

  const toolsState = await getHostPublicRuntimeStateWithFallback(hosts, "/ai-video-generation");
  const toolsResolved = resolveHostToolPage(toolsState, hosts, toolSlug);
  if (toolsResolved) return toolsResolved;

  const legacyDetailState = await getHostPublicToolRuntimeStateWithFallback(hosts, `/tools/${toolSlug}`, toolSlug);
  const legacyDetailResolved = resolveHostToolPage(legacyDetailState, hosts, toolSlug);
  if (legacyDetailResolved) return legacyDetailResolved;

  const legacyToolsState = await getHostPublicRuntimeStateWithFallback(hosts, "/tools");
  const legacyToolsResolved = resolveHostToolPage(legacyToolsState, hosts, toolSlug);
  if (legacyToolsResolved) return legacyToolsResolved;

  const homeState = await getHostPublicRuntimeStateWithFallback(hosts, "/");
  return resolveHostToolPage(homeState, hosts, toolSlug);
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const [resolvedParams, headerStore] = await Promise.all([params, headers()]);
  const { path } = resolvedParams;
  const firstSegment = path[0] ?? "";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (isStaticAssetCatchAllRequest(firstSegment)) return {};
  if (firstSegment === "account") {
    const spanishTitle = /(?:aidreamshoots|aidreamcapes)\.eu/i.test(host ?? "");
    return { title: spanishTitle ? "Cuenta" : "Account", robots: { index: false, follow: false } };
  }
  if (firstSegment === "app" || firstSegment === "dashboard") {
    const spanishTitle = /(?:aidreamshoots|aidreamcapes)\.eu/i.test(host ?? "");
    return { title: spanishTitle ? "Espacio privado" : "Workspace", robots: { index: false, follow: false } };
  }
  if ((host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) && ["tools", "account", "app", "collections", "ai-image-generation", "ai-video-generation", "best-packages", "best-ai-image", "best-ai-video"].includes(firstSegment)) {
    return {};
  }
  const isCollectionRequest = isCollectionRouteRequest(path);
  const isVideoGenerationRequest = isVideoGenerationRouteRequest(path);
  const collectionRootPageSlug = fallbackCollectionRootPathForHost(host);
  const metadataPageSlug = isCollectionRequest
    ? collectionRootPageSlug
    : isVideoGenerationRequest
    ? path[1] ? `/ai-video-generation/${path[1]}` : "/ai-video-generation"
    : path[0] === "tools" && path[1] ? `/tools/${path[1]}` : publicContentPageSlug(`/${path.join("/")}`);
  const hostCandidates = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const state = await getHostPublicRuntimeStateWithFallback(hostCandidates, metadataPageSlug);
  if (!state) return {};
  const site = getSiteByHostCandidatesFromState(state, hostCandidates) ?? state.sites[0];
  if (!site) return {};
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "platform-state" });
  if (path[0] === "tools" && isMydreamshootsSite(site) && !isAidreamcapesSite(site)) return {};
  const slug = publicContentPageSlug(`/${path.join("/")}`);
  if (isVideoGenerationRequest) {
    const videoGenerationRoute = parsePublicVideoGenerationRouteForSite(site, path);
    if (!videoGenerationRoute) return {};
    if (videoGenerationRoute.itemSlug) {
      const redirectRecord = await getVideoThemeSlugRedirectRelational(site.id, videoGenerationRoute.itemSlug);
      if (redirectRecord?.theme?.status === "active") {
        const redirected = await resolveHostToolPageWithFallback(hostCandidates, redirectRecord.theme.slug);
        if (!redirected) return {};
        const redirectedSnapshot = createPublishedSiteSnapshot(redirected.state, redirected.site, { source: "platform-state" });
        if (resolvePublishedRouteDisposition(redirectedSnapshot, `/ai-video-generation/${redirectRecord.theme.slug}`).kind !== "render") return {};
        return metadataForPublishedStorefrontDirectoryPage({
          site: redirected.site,
          page: redirected.page,
          kind: "tool",
          directorySlug: redirectRecord.theme.slug,
          path: redirectRecord.theme.slug,
          products: redirected.state.products,
          creativePacks: redirected.state.creativePacks,
          snapshot: redirectedSnapshot
        });
      }
      const resolved = await resolveHostToolPageWithFallback(hostCandidates, videoGenerationRoute.itemSlug);
      if (!resolved) return {};
      const resolvedSnapshot = createPublishedSiteSnapshot(resolved.state, resolved.site, { source: "platform-state" });
      if (resolvePublishedRouteDisposition(resolvedSnapshot, videoGenerationRoute.canonicalPath).kind !== "render") return {};
      return metadataForPublishedStorefrontDirectoryPage({
        site: resolved.site,
        page: resolved.page,
        kind: "tool",
        directorySlug: videoGenerationRoute.itemSlug,
        path: videoGenerationRoute.canonicalPath,
        products: resolved.state.products,
        creativePacks: resolved.state.creativePacks,
        snapshot: resolvedSnapshot
      });
    }
    if (resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath).kind !== "render") return {};
    const page = findPage(site, "/ai-video-generation");
    return page ? metadataForPublishedStorefrontPage({ site, page, products: state.products, creativePacks: state.creativePacks, snapshot }) : {};
  }
  if (path[0] === "tools" && path[1]) {
    const resolved = await resolveHostToolPageWithFallback(hostCandidates, path[1]);
    if (!resolved) return {};
    return metadataForPublishedStorefrontDirectoryPage({
      site: resolved.site,
      page: resolved.page,
      kind: "tool",
      directorySlug: path[1],
      products: resolved.state.products,
      creativePacks: resolved.state.creativePacks
    });
  }
  if (isCollectionRequest) {
    const collectionRoute = parsePublicCollectionRouteForSite(site, path);
    if (!collectionRoute) return {};
    if (collectionRoute.collectionSlug && !canResolveCollectionSlugForSite(state, site, collectionRoute.collectionSlug)) return {};
    if (resolvePublishedRouteDisposition(snapshot, collectionRootPageSlug).kind !== "render") return {};
    const page = findPage(site, publicCollectionRootPathForSite(site)) ?? findPage(site, "/collections");
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
  if (resolvePublishedRouteDisposition(snapshot, slug).kind !== "render") return {};
  const page = findPage(site, slug);
  return page ? metadataForPublishedStorefrontPage({ site, page, products: state.products, creativePacks: state.creativePacks, snapshot }) : {};
}

export default async function HostStorefrontCatchAllPage({
  params,
  searchParams
}: {
  params: Promise<{ path: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ path }, headerStore] = await Promise.all([params, headers()]);
  const firstSegment = path[0] ?? "";
  if (firstSegment === "platform" || firstSegment === "site" || firstSegment === "api" || isStaticAssetCatchAllRequest(firstSegment)) {
    notFound();
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const siteAdminPath = siteAdminPathForHost(host);
  if (siteAdminPath) redirect(siteAdminPath);
  if (isPlatformHost(host)) redirect(`/platform/${path.join("/")}`);
  const slug = `/${path.join("/")}`;
  if (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) {
    const defaultSiteSlug = process.env.DEFAULT_STOREFRONT_SITE_SLUG || "mydreamshoots";
    if (firstSegment === "tools" || firstSegment === "account" || firstSegment === "app" || firstSegment === "ai-image-generation" || firstSegment === "ai-video-generation" || firstSegment === "pricing" || firstSegment === "help" || firstSegment === "faq" || firstSegment === "workflow" || firstSegment === "best-packages" || firstSegment === "best-ai-image" || firstSegment === "best-ai-video") {
      const query = searchParams ? await searchParams : {};
      redirect(`/site/${defaultSiteSlug}${firstSegment === "help" ? "/faq" : slug}${searchParamsSuffix(query)}`);
    }
  }
  if (slug === "/tool") {
    if (isMydreamshootsPublicSlug(knownWorkspaceSiteSlugForHost([host ?? null]))) notFound();
    redirect("/tools");
  }
  if (slug === "/app" || slug === "/dashboard") {
    const query = searchParams ? await searchParams : {};
    redirect(`/app/create${searchParamsSuffix(query)}`);
  }
  const hostCandidates = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const needsPrivateRuntime = firstSegment === "app" || firstSegment === "account" || firstSegment === "dashboard";
  if (needsPrivateRuntime && !(await hasAnyCustomerSessionCookie())) {
    const query = searchParams ? await searchParams : {};
    redirect(`/login?next=${encodeURIComponent(`${slug}${searchParamsSuffix(query)}`)}`);
  }
  const canUseFastWorkspaceShell = firstSegment === "app" && !(path[1] === "jobs" && path[2] && path[2] !== "progress");
  if (canUseFastWorkspaceShell) {
    const query = searchParams ? await searchParams : {};
    if (slug === "/app") redirect(`/app/create${searchParamsSuffix(query)}`);
    const siteSlug = await getHostSiteSlugShellWithFallback(hostCandidates);
    if (!siteSlug) notFound();
    return renderCustomerWorkspacePageBySlug({ siteSlug, slug, query, routeMode: "host" });
  }
  const isCollectionRequest = isCollectionRouteRequest(path);
  const isVideoGenerationRequest = isVideoGenerationRouteRequest(path);
  const collectionRootPageSlug = fallbackCollectionRootPathForHost(host);
  const legacyPathTarget = legacyPublicPathTarget(slug, collectionRootPageSlug);
  const publicPageSlug = isCollectionRequest
    ? collectionRootPageSlug
    : isVideoGenerationRequest
    ? path[1] ? `/ai-video-generation/${path[1]}` : "/ai-video-generation"
    : firstSegment === "tools" && path[1] ? `/tools/${path[1]}` : legacyPathTarget ? publicContentPageSlug(legacyPathTarget) : publicContentPageSlug(`/${path.join("/")}`);
  const collectionLookupSlug = collectionRouteLookupSlug(path);
  const videoLookupSlug = isVideoGenerationRequest ? path[1] || "" : "";
  const state = needsPrivateRuntime
    ? await getHostRuntimeStateWithFallback(hostCandidates)
    : isVideoGenerationRequest && videoLookupSlug
    ? await getHostPublicToolRuntimeStateWithFallback(hostCandidates, `/ai-video-generation/${videoLookupSlug}`, videoLookupSlug)
    : isVideoGenerationRequest
    ? await getHostPublicRuntimeStateWithFallback(hostCandidates, "/ai-video-generation")
    : isCollectionRequest && collectionLookupSlug
    ? await getHostPublicCollectionRuntimeStateWithFallback(hostCandidates, collectionLookupSlug)
    : await getHostPublicRuntimeStateWithFallback(hostCandidates, publicPageSlug);
  if (!state) notFound();
  const site = getSiteByHostCandidatesFromState(state, hostCandidates) ?? state.sites[0];
  if (!site) notFound();
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "platform-state" });
  const legacyTarget = legacyPublicPathTarget(slug, fallbackCollectionRootPathForHost(host));
  if (legacyTarget) {
    const disposition = resolvePublishedRedirectDisposition(snapshot, slug, legacyTarget);
    if (disposition.kind === "redirect" && disposition.targetPath) permanentRedirect(publicSiteUrl(site, disposition.targetPath));
    notFound();
  }
  if (slug === "/login" && (await hasValidCustomerSessionForSite(site))) {
    const query = searchParams ? await searchParams : {};
    redirect(safeHostCustomerNextPath(query.next));
  }
  if (slug === "/help" && (isMydreamshootsSite(site) || isAidreamcapesSite(site))) redirect("/faq");
  if (slug === "/how-it-works" && (isMydreamshootsSite(site) || isAidreamcapesSite(site))) redirect("/workflow");
  if (firstSegment === "tools" && isMydreamshootsSite(site) && !isAidreamcapesSite(site)) notFound();
  const routeQuery = searchParams ? await searchParams : {};
  redirectLegacyBlogArticle(site, slug, routeQuery);
  const resolvedToolPage = firstSegment === "tools" && path[1]
    ? await resolveHostToolPageWithFallback(hostCandidates, path[1])
    : undefined;
  const resolvedVideoToolPage = isVideoGenerationRequest && path[1]
    ? await resolveHostToolPageWithFallback(hostCandidates, path[1])
    : undefined;
  const collectionRoute = isCollectionRequest ? parsePublicCollectionRouteForSite(site, path) : undefined;
  const videoGenerationRoute = isVideoGenerationRequest ? parsePublicVideoGenerationRouteForSite(site, path) : undefined;
  if (firstSegment === "tools" && path[1]) {
    const toolSite = resolvedToolPage?.site ?? site;
    redirectMydreamshootsLegacyTool(toolSite, path[1]);
    redirectAidreamcapesLegacyTool(toolSite, path[1]);
    const canonicalToolPath = canonicalSeoDirectoryPathForSite(toolSite, "tool", path[1]);
    if (canonicalToolPath !== `/tools/${path[1]}`) permanentRedirect(publicSiteUrl(toolSite, canonicalToolPath));
  }
  const hasKnownPublicRoute =
    PUBLIC_DIRECTORY_PAGE_SLUGS.has(publicPageSlug) ||
    Boolean(resolvedToolPage) ||
    Boolean(videoGenerationRoute) ||
    Boolean(resolvedVideoToolPage) ||
    Boolean(collectionRoute) ||
    Boolean(findPage(site, publicPageSlug)) ||
    canUseStorefrontPartnerTemplate(site, publicPageSlug);
  if (!needsPrivateRuntime && !hasKnownPublicRoute) notFound();
  const query = searchParams ? await searchParams : {};
  if (firstSegment === "app") {
    if (path[1] === "jobs" && path[2] && path[2] !== "progress") {
      return renderCustomerJobDetailPage({ site, jobId: path[2], query, routeMode: "host", state });
    }
    if (path[1] === "create" || path[1] === "upload") {
      return renderCustomerWorkspacePageBySlug({ siteSlug: site.slug, slug: `/${path.join("/")}`, query, routeMode: "host" });
    }
    return renderCustomerWorkspacePage({ site, slug: `/${path.join("/")}`, query, routeMode: "host", state });
  }
  if (firstSegment === "account") {
    return renderCustomerWorkspacePage({ site, slug: "/account", query, routeMode: "host", state });
  }
  if (firstSegment === "dashboard") {
    redirect(`/app/create${searchParamsSuffix(query)}`);
  }
  if (isVideoGenerationRequest) {
    if (!videoGenerationRoute) notFound();
    if (videoGenerationRoute.itemSlug) {
      if (resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath).kind !== "render") notFound();
      const redirectRecord = await getVideoThemeSlugRedirectRelational(site.id, videoGenerationRoute.itemSlug);
      if (redirectRecord?.theme?.status === "active" && redirectRecord.theme.slug !== videoGenerationRoute.itemSlug) {
        permanentRedirect(publicSiteUrl(site, `/ai-video-generation/${redirectRecord.theme.slug}`));
      }
      if (!resolvedVideoToolPage) notFound();
      const canonicalToolPath = resolvedVideoToolPage.site.id === site.id && state.videoThemes?.some((theme) => theme.siteId === site.id && theme.slug === videoGenerationRoute.itemSlug)
        ? videoGenerationRoute.canonicalPath
        : canonicalSeoDirectoryPathForSite(resolvedVideoToolPage.site, "tool", videoGenerationRoute.itemSlug);
      if (canonicalToolPath !== videoGenerationRoute.canonicalPath) permanentRedirect(publicSiteUrl(resolvedVideoToolPage.site, canonicalToolPath));
      return renderToolPage({
        site: resolvedVideoToolPage.site,
        toolSlug: videoGenerationRoute.itemSlug,
        publicPath: videoGenerationRoute.canonicalPath,
        query,
        routeMode: "host",
        state: resolvedVideoToolPage.state,
        resolvedPage: resolvedVideoToolPage.page
      });
    }
    if (resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath).kind !== "render") notFound();
    return renderStorefrontPage({
      site,
      slug: "/ai-video-generation",
      publicPath: videoGenerationRoute.canonicalPath,
      query,
      routeMode: "host",
      state,
      deferCustomerRuntime: true
    });
  }
  if (firstSegment === "tools" && path[1]) {
    if (!resolvedToolPage) notFound();
    return renderToolPage({ site: resolvedToolPage.site, toolSlug: path[1], query, routeMode: "host", state: resolvedToolPage.state, resolvedPage: resolvedToolPage.page });
  }
  if (isCollectionRequest && !collectionRoute) notFound();
  const collectionCategory = collectionRoute?.collectionSlug ?? "";
  if (collectionRoute) {
    if (resolvePublishedRouteDisposition(snapshot, collectionRootPageSlug).kind !== "render") notFound();
    const canonicalCollectionPath = canonicalSeoDirectoryPathForSite(site, "collection", collectionRoute.collectionSlug);
    if (canonicalCollectionPath !== collectionRoute.canonicalPath) permanentRedirect(publicSiteUrl(site, canonicalCollectionPath));
  }
  if (collectionCategory && !canResolveCollectionSlugForSite(state, site, collectionCategory)) notFound();
  const pageSlug = collectionRoute ? publicCollectionRootPathForSite(site) : publicContentPageSlug(`/${path.join("/")}`);
  if (!collectionRoute && resolvePublishedRouteDisposition(snapshot, pageSlug).kind !== "render") notFound();
  if (!collectionRoute && !findPage(site, pageSlug) && !canUseStorefrontPartnerTemplate(site, pageSlug)) notFound();
  const storefrontQuery = collectionCategory ? { ...query, category: collectionCategory } : query;
  return renderStorefrontPage({
    site,
    slug: pageSlug,
    publicPath: collectionRoute?.canonicalPath ?? pageSlug,
    query: storefrontQuery,
    routeMode: "host",
    state
  });
}
