import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getSiteByHostCandidatesFromState, isPlatformHost, siteAdminPathForHost } from "@/lib/domain-routing";
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
  "background-changer": "/tools/route-portrait-engine",
  "background-remover": "/tools/route-portrait-engine",
  "dreamscape-generator": "/tools/route-portrait-engine",
  "image-to-video": "/tools/route-portrait-engine",
  "image-studio": "/tools",
  "portrait-generator": "/tools/route-portrait-engine",
  "portrait-maker": "/tools/route-portrait-engine",
  "product-reverie": "/tools/route-moodboard",
  "soft-glam": "/tools/cafe-street-story",
  "couple-escape-album": "/tools/shared-route-album",
  "wedding-portraits": "/tools",
  "world-cup-fan-photos": "/tools",
  headshot: "/tools/route-portrait-engine"
};
const PUBLIC_DIRECTORY_PAGE_SLUGS = new Set(["/collections", "/tools"]);
const DREAMSHOOT_PARTNER_TEMPLATE_SLUGS = new Set(["/creators-circle", "/partner-registration", "/about-us", "/contact-us"]);

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

function canUseMydreamshootsSyntheticPage(site: { slug: string; name: string; branding: { logoText: string } }, slug: string): boolean {
  return DREAMSHOOT_PARTNER_TEMPLATE_SLUGS.has(slug) && isMydreamshootsSite(site);
}

function redirectMydreamshootsLegacyTool(site: { slug: string; name: string; branding: { logoText: string } }, toolSlug: string): void {
  if (!isMydreamshootsSite(site)) return;
  const redirectPath = DREAMSHOOT_LEGACY_TOOL_REDIRECTS[toolSlug.trim().toLowerCase()];
  if (redirectPath) permanentRedirect(redirectPath);
}

function redirectAidreamcapesLegacyTool(site: { slug: string; name: string; branding: { logoText: string } }, toolSlug: string): void {
  if (!/aidreamcapes/i.test(`${site.slug} ${site.name} ${site.branding.logoText}`)) return;
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
  if (path[0] === "dashboard") return { title: "Workspace" };
  if (canUseMydreamshootsSyntheticPage(site, slug)) {
    return metadataForDreamshootFallbackRoute(site.slug, slug, {
      primaryDomain: site.primaryDomain,
      ogImage: site.themeSettings.publishedJson.seo?.defaultOgImage,
      siteName: site.branding.logoText || site.name
    });
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
    if (firstSegment === "tools" || firstSegment === "account" || firstSegment === "app" || firstSegment === "collections" || firstSegment === "pricing" || firstSegment === "help") {
      const query = searchParams ? await searchParams : {};
      redirect(`/site/${defaultSiteSlug}${slug}${searchParamsSuffix(query)}`);
    }
  }
  if (slug === "/about") redirect("/about-us");
  if (slug === "/contact") redirect("/contact-us");
  if (slug === "/examples") redirect("/collections");
  if (slug === "/privacy-policy" || slug === "/policies/privacy") redirect("/privacy");
  if (slug === "/terms-of-service" || slug === "/policies/terms") redirect("/terms");
  if (slug === "/cookie-policy" || slug === "/policies/cookies") redirect("/cookies");
  if (slug === "/refund-policy" || slug === "/policies/refund" || slug === "/policies/refunds") redirect("/refunds");
  if (slug === "/content-policy" || slug === "/policies/content") redirect("/content");
  if (slug === "/shipping-policy" || slug === "/delivery-policy" || slug === "/policies/shipping") redirect("/shipping");
  if (slug === "/tool") redirect("/tools");
  const hostCandidates = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const needsPrivateRuntime = firstSegment === "app" || firstSegment === "account" || firstSegment === "dashboard";
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
    canUseMydreamshootsSyntheticPage(site, publicPageSlug);
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
    return renderCustomerWorkspacePage({ site, slug: "/app", query, routeMode: "host", state });
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
  if (!collectionCategory && !findPage(site, pageSlug) && !canUseMydreamshootsSyntheticPage(site, pageSlug)) notFound();
  const storefrontQuery = collectionCategory ? { ...query, category: collectionCategory } : query;
  return renderStorefrontPage({
    site,
    slug: pageSlug,
    query: storefrontQuery,
    routeMode: "host",
    state
  });
}
