import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { cleanHost, getSiteByHostCandidatesFromState, isPlatformHost, siteAdminPathForHost } from "@/lib/domain-routing";
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
import { canonicalSeoDirectoryPathForSite, metadataForDreamshootFallbackRoute, metadataForSeoDirectory } from "@/lib/dreamshoot-seo-content";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { publicContentPageSlug } from "@/lib/site-route-canonical";
import { customerSessionCookie } from "@/lib/session";
import { getAidreamcapesPolicySeo, getMydreamshootsPolicySeo, getSpanishXbyPolicySeo, policyCanonicalUrlForSite, type PolicySeoCopy } from "@/lib/theme/policy-seo";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { getSiteByHostForPublicAuth } from "@/lib/stores/site-store";
import type { PlatformState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DREAMSHOOT_LEGACY_TOOL_REDIRECTS: Record<string, string> = {
  "ai-image-studio": "/tools",
  "image-studio": "/tools",
  "travel-portraits": "/tools/nature-adventure"
};
const AIDREAMCAPES_LEGACY_TOOL_REDIRECTS: Record<string, string> = {
  "ai-image-studio": "/tools",
  "background-changer": "/tools/fan-scene-album-builder",
  "background-remover": "/tools/fan-scene-album-builder",
  "dreamscape-generator": "/tools/fan-scene-album-builder",
  "image-generator": "/tools/fan-scene-album-builder",
  "image-to-video": "/tools/seasonal-celebration-album-maker",
  "image-studio": "/tools",
  "portrait-generator": "/tools/fan-scene-album-builder",
  "portrait-maker": "/tools/fan-scene-album-builder",
  "product-reverie": "/tools/permission-safe-photo-planner",
  "soft-glam": "/tools/premiere-portrait-set-builder",
  "couple-escape-album": "/tools/seasonal-celebration-album-maker",
  "wedding-portraits": "/tools/seasonal-celebration-album-maker",
  "world-cup-fan-photos": "/tools/game-day-group-portrait-maker",
  headshot: "/tools/premiere-portrait-set-builder",
  "route-portrait-engine": "/tools/fan-scene-album-builder",
  "coastal-portrait": "/tools/christmas-group-album-studio",
  "island-resort-scenes": "/tools/seasonal-celebration-album-maker",
  "scenic-overlook-story": "/tools/game-day-group-portrait-maker",
  "travel-profile-story": "/tools/fan-scene-album-builder",
  "editorial-getaway": "/tools/premiere-portrait-set-builder",
  "cafe-street-story": "/tools/premiere-portrait-set-builder",
  "cinematic-travel": "/tools/game-day-group-portrait-maker",
  "route-moodboard": "/tools/permission-safe-photo-planner",
  "social-keepsake": "/tools/seasonal-celebration-album-maker",
  "family-travel-keepsakes": "/tools/thanksgiving-keepsake-set-maker",
  "travel-journal-cover-maker": "/tools/seasonal-celebration-album-maker"
};
const PUBLIC_DIRECTORY_PAGE_SLUGS = new Set(["/collections", "/tools"]);
const DREAMSHOOT_PARTNER_TEMPLATE_SLUGS = new Set(["/workflow", "/faq", "/creators-circle", "/partner-registration", "/about-us", "/contact-us"]);

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

function isMydreamshootsSite(site: { slug: string; name: string; branding: { logoText: string } }): boolean {
  return /dreamshoot/i.test(`${site.slug} ${site.name} ${site.branding.logoText}`);
}

function isAidreamcapesSite(site: { slug: string; name: string; branding: { logoText: string } }): boolean {
  return /aidreamcapes/i.test(`${site.slug} ${site.name} ${site.branding.logoText}`);
}

function isSpanishXbyStorefrontSite(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }): boolean {
  return isSpanishStorefrontSite(site);
}

function canUseStorefrontPartnerTemplate(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }, slug: string): boolean {
  return DREAMSHOOT_PARTNER_TEMPLATE_SLUGS.has(slug) && (isSpanishXbyStorefrontSite(site) || isMydreamshootsSite(site) || isAidreamcapesSite(site));
}

function storefrontPolicySeoForSite(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }, slug: string): PolicySeoCopy | undefined {
  if (isSpanishXbyStorefrontSite(site)) return getSpanishXbyPolicySeo(site, slug);
  if (isAidreamcapesSite(site)) return getAidreamcapesPolicySeo(slug);
  if (isMydreamshootsSite(site)) return getMydreamshootsPolicySeo(slug);
  return undefined;
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
  return getHostRuntimeStateForModeWithFallback(hosts, "public", "/collections", collectionSlug);
}

function knownWorkspaceSiteSlugForHost(hosts: Array<string | null>): string | undefined {
  for (const hostValue of hosts) {
    const host = cleanHost(hostValue);
    if (!host) continue;
    if (host === "mydreamshoots.com" || host === "www.mydreamshoots.com" || host.endsWith(".mydreamshoots.localhost")) return "mydreamshoots";
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
  const detailState = await getHostPublicToolRuntimeStateWithFallback(hosts, `/tools/${toolSlug}`, toolSlug);
  const detailResolved = resolveHostToolPage(detailState, hosts, toolSlug);
  if (detailResolved) return detailResolved;

  const toolsState = await getHostPublicRuntimeStateWithFallback(hosts, "/tools");
  const toolsResolved = resolveHostToolPage(toolsState, hosts, toolSlug);
  if (toolsResolved) return toolsResolved;

  const homeState = await getHostPublicRuntimeStateWithFallback(hosts, "/");
  return resolveHostToolPage(homeState, hosts, toolSlug);
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const [resolvedParams, headerStore] = await Promise.all([params, headers()]);
  const { path } = resolvedParams;
  const firstSegment = path[0] ?? "";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (firstSegment === "app" || firstSegment === "account" || firstSegment === "dashboard") {
    const spanishTitle = /(?:aidreamshoots|aidreamcapes)\.eu/i.test(host ?? "");
    return { title: spanishTitle ? "Espacio privado" : "Workspace", robots: { index: false, follow: false } };
  }
  if ((host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) && ["tools", "account", "app", "collections"].includes(firstSegment)) {
    return {};
  }
  const metadataPageSlug = path[0] === "collections" && path[1] ? "/collections" : path[0] === "tools" && path[1] ? `/tools/${path[1]}` : publicContentPageSlug(`/${path.join("/")}`);
  const hostCandidates = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const state = await getHostPublicRuntimeStateWithFallback(hostCandidates, metadataPageSlug);
  if (!state) return {};
  const site = getSiteByHostCandidatesFromState(state, hostCandidates) ?? state.sites[0];
  if (!site) return {};
  const slug = publicContentPageSlug(`/${path.join("/")}`);
  if (path[0] === "tools" && path[1]) {
    const resolved = await resolveHostToolPageWithFallback(hostCandidates, path[1]);
    if (!resolved) return {};
    return metadataForSeoDirectory(resolved.site, "tool", path[1]);
  }
  if (path[0] === "collections" && path[1]) {
    if (!canResolveCollectionSlugForSite(state, site, path[1])) return {};
    return metadataForSeoDirectory(site, "collection", path[1]);
  }
  if (DREAMSHOOT_PARTNER_TEMPLATE_SLUGS.has(slug) && (isSpanishXbyStorefrontSite(site) || canUseStorefrontPartnerTemplate(site, slug))) {
    return metadataForDreamshootFallbackRoute(site.slug, slug, {
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

export default async function HostStorefrontCatchAllPage({
  params,
  searchParams
}: {
  params: Promise<{ path: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ path }, headerStore] = await Promise.all([params, headers()]);
  const firstSegment = path[0] ?? "";
  if (firstSegment === "platform" || firstSegment === "site" || firstSegment === "api" || firstSegment === "_next") {
    notFound();
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const siteAdminPath = siteAdminPathForHost(host);
  if (siteAdminPath) redirect(siteAdminPath);
  if (isPlatformHost(host)) redirect(`/platform/${path.join("/")}`);
  const slug = `/${path.join("/")}`;
  if (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) {
    const defaultSiteSlug = process.env.DEFAULT_STOREFRONT_SITE_SLUG || "mydreamshoots";
    if (firstSegment === "tools" || firstSegment === "account" || firstSegment === "app" || firstSegment === "collections" || firstSegment === "pricing" || firstSegment === "help" || firstSegment === "faq" || firstSegment === "workflow") {
      const query = searchParams ? await searchParams : {};
      redirect(`/site/${defaultSiteSlug}${firstSegment === "help" ? "/faq" : slug}${searchParamsSuffix(query)}`);
    }
  }
  if (slug === "/about") redirect("/about-us");
  if (slug === "/contact") redirect("/contact-us");
  if (slug === "/examples") redirect("/collections");
  if (slug === "/packages") redirect("/collections");
  if (slug === "/privacy-policy" || slug === "/policies/privacy") redirect("/privacy");
  if (slug === "/terms-of-service" || slug === "/policies/terms") redirect("/terms");
  if (slug === "/cookie-policy" || slug === "/policies/cookies") redirect("/cookies");
  if (slug === "/refund-policy" || slug === "/policies/refund" || slug === "/policies/refunds") redirect("/refunds");
  if (slug === "/content-policy" || slug === "/policies/content") redirect("/content");
  if (slug === "/shipping-policy" || slug === "/delivery-policy" || slug === "/policies/shipping") redirect("/shipping");
  if (slug === "/children-privacy-policy" || slug === "/childrens-privacy" || slug === "/policies/children-privacy") redirect("/children-privacy");
  if (slug === "/state-privacy-rights" || slug === "/california-privacy" || slug === "/ccpa" || slug === "/policies/state-privacy") redirect("/state-privacy");
  if (slug === "/tool") redirect("/tools");
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
  const publicPageSlug = firstSegment === "collections" && path[1] ? "/collections" : firstSegment === "tools" && path[1] ? `/tools/${path[1]}` : publicContentPageSlug(`/${path.join("/")}`);
  const collectionCategory = firstSegment === "collections" && path[1] ? path[1] : "";
  const state = needsPrivateRuntime
    ? await getHostRuntimeStateWithFallback(hostCandidates)
    : collectionCategory
    ? await getHostPublicCollectionRuntimeStateWithFallback(hostCandidates, collectionCategory)
    : await getHostPublicRuntimeStateWithFallback(hostCandidates, publicPageSlug);
  if (!state) notFound();
  const site = getSiteByHostCandidatesFromState(state, hostCandidates) ?? state.sites[0];
  if (!site) notFound();
  if (slug === "/login" && (await hasValidCustomerSessionForSite(site))) {
    const query = searchParams ? await searchParams : {};
    redirect(safeHostCustomerNextPath(query.next));
  }
  if (slug === "/help" && (isMydreamshootsSite(site) || isAidreamcapesSite(site))) redirect("/faq");
  if (slug === "/how-it-works" && (isMydreamshootsSite(site) || isAidreamcapesSite(site))) redirect("/workflow");
  const resolvedToolPage = firstSegment === "tools" && path[1]
    ? await resolveHostToolPageWithFallback(hostCandidates, path[1])
    : undefined;
  if (firstSegment === "tools" && path[1]) {
    const toolSite = resolvedToolPage?.site ?? site;
    redirectMydreamshootsLegacyTool(toolSite, path[1]);
    redirectAidreamcapesLegacyTool(toolSite, path[1]);
    const canonicalToolPath = canonicalSeoDirectoryPathForSite(toolSite, "tool", path[1]);
    if (canonicalToolPath !== `/tools/${path[1]}`) permanentRedirect(canonicalToolPath);
  }
  const hasKnownPublicRoute =
    PUBLIC_DIRECTORY_PAGE_SLUGS.has(publicPageSlug) ||
    Boolean(resolvedToolPage) ||
    firstSegment === "collections" && Boolean(path[1]) ||
    Boolean(findPage(site, publicPageSlug)) ||
    canUseStorefrontPartnerTemplate(site, publicPageSlug) ||
    Boolean(storefrontPolicySeoForSite(site, publicPageSlug));
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
  if (firstSegment === "tools" && path[1]) {
    if (!resolvedToolPage) notFound();
    return renderToolPage({ site: resolvedToolPage.site, toolSlug: path[1], query, routeMode: "host", state: resolvedToolPage.state, resolvedPage: resolvedToolPage.page });
  }
  if (collectionCategory) {
    const canonicalCollectionPath = canonicalSeoDirectoryPathForSite(site, "collection", collectionCategory);
    if (canonicalCollectionPath !== `/collections/${collectionCategory}`) permanentRedirect(canonicalCollectionPath);
  }
  if (collectionCategory && !canResolveCollectionSlugForSite(state, site, collectionCategory)) notFound();
  const pageSlug = collectionCategory ? "/collections" : publicContentPageSlug(`/${path.join("/")}`);
  if (!collectionCategory && !findPage(site, pageSlug) && !canUseStorefrontPartnerTemplate(site, pageSlug) && !storefrontPolicySeoForSite(site, pageSlug)) notFound();
  const storefrontQuery = collectionCategory ? { ...query, category: collectionCategory } : query;
  return renderStorefrontPage({
    site,
    slug: pageSlug,
    query: storefrontQuery,
    routeMode: "host",
    state
  });
}
