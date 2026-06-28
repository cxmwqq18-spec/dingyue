import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getSiteByHostCandidatesFromState, isPlatformHost } from "@/lib/domain-routing";
import { findPage } from "@/lib/data";
import {
  readStorefrontPlatformStateFromDatabase,
  readStorefrontPublicRuntimeStateByHostFromDatabase,
  readStorefrontRuntimeStateByHostFromDatabase
} from "@/lib/storefront-state";
import {
  renderCustomerJobDetailPage,
  renderCustomerWorkspacePage,
  renderCustomerWorkspacePageBySlug,
  renderStorefrontPage,
  renderToolPage,
  resolveToolPageForSite
} from "@/lib/storefront-render";
import { metadataForDreamshootFallbackRoute, metadataForSeoDirectory } from "@/lib/dreamshoot-seo-content";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { policyPageSlug } from "@/lib/site-route-canonical";
import type { PlatformState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DREAMSHOOT_LEGACY_TOOL_REDIRECTS: Record<string, string> = {
  "ai-image-studio": "/tools",
  "image-studio": "/tools",
  "travel-portraits": "/tools/nature-adventure"
};
const PUBLIC_DIRECTORY_PAGE_SLUGS = new Set(["/collections", "/tools"]);
const DREAMSHOOT_PARTNER_TEMPLATE_SLUGS = new Set(["/creators-circle", "/partner-registration", "/about-us", "/contact-us"]);

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

async function getHostRuntimeStateWithFallback(hosts: Array<string | null>): Promise<PlatformState | undefined> {
  return getHostRuntimeStateForModeWithFallback(hosts, "private");
}

async function getHostPublicRuntimeStateWithFallback(hosts: Array<string | null>, pageSlug?: string): Promise<PlatformState | undefined> {
  return getHostRuntimeStateForModeWithFallback(hosts, "public", pageSlug);
}

async function getHostRuntimeStateForModeWithFallback(hosts: Array<string | null>, mode: "public" | "private", pageSlug?: string): Promise<PlatformState | undefined> {
  try {
    for (const host of hosts) {
      const state = mode === "public"
        ? await readStorefrontPublicRuntimeStateByHostFromDatabase(host, pageSlug)
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

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const [resolvedParams, headerStore] = await Promise.all([params, headers()]);
  const { path } = resolvedParams;
  const firstSegment = path[0] ?? "";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if ((host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) && ["tools", "account", "app", "collections"].includes(firstSegment)) {
    return {};
  }
  const metadataPageSlug = path[0] === "collections" && path[1] ? "/collections" : path[0] === "tools" && path[1] ? `/tools/${path[1]}` : policyPageSlug(`/${path.join("/")}`);
  const hostCandidates = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const state = await getHostPublicRuntimeStateWithFallback(hostCandidates, metadataPageSlug);
  if (!state) return {};
  const site = getSiteByHostCandidatesFromState(state, hostCandidates) ?? state.sites[0];
  if (!site) return {};
  const slug = policyPageSlug(`/${path.join("/")}`);
  if (path[0] === "tools" && path[1]) {
    redirectMydreamshootsLegacyTool(site, path[1]);
    const { matched } = resolveToolPageForSite(state, site, path[1]);
    if (!matched) return {};
    return metadataForSeoDirectory(site, "tool", path[1]);
  }
  if (path[0] === "collections" && path[1]) return metadataForSeoDirectory(site, "collection", path[1]);
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
  if (isPlatformHost(host)) redirect(`/platform/${path.join("/")}`);
  const slug = `/${path.join("/")}`;
  if (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) {
    const defaultSiteSlug = process.env.DEFAULT_STOREFRONT_SITE_SLUG || "mydreamshoots";
    if (firstSegment === "tools" || firstSegment === "account" || firstSegment === "app" || firstSegment === "collections") {
      redirect(`/site/${defaultSiteSlug}${slug}`);
    }
  }
  if (slug === "/privacy-policy" || slug === "/policies/privacy") redirect("/privacy");
  if (slug === "/terms-of-service" || slug === "/policies/terms") redirect("/terms");
  if (slug === "/cookie-policy" || slug === "/policies/cookies") redirect("/cookies");
  if (slug === "/refund-policy" || slug === "/policies/refund" || slug === "/policies/refunds") redirect("/refunds");
  if (slug === "/content-policy" || slug === "/policies/content") redirect("/content");
  const hostCandidates = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const needsPrivateRuntime = firstSegment === "app" || firstSegment === "dashboard";
  const publicPageSlug = firstSegment === "collections" && path[1] ? "/collections" : firstSegment === "tools" && path[1] ? `/tools/${path[1]}` : policyPageSlug(`/${path.join("/")}`);
  const state = needsPrivateRuntime
    ? await getHostRuntimeStateWithFallback(hostCandidates)
    : await getHostPublicRuntimeStateWithFallback(hostCandidates, publicPageSlug);
  if (!state) notFound();
  const site = getSiteByHostCandidatesFromState(state, hostCandidates) ?? state.sites[0];
  if (!site) notFound();
  const hasKnownPublicRoute =
    PUBLIC_DIRECTORY_PAGE_SLUGS.has(publicPageSlug) ||
    firstSegment === "tools" && Boolean(path[1]) ||
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
  if (firstSegment === "dashboard") {
    return renderCustomerWorkspacePage({ site, slug: "/app", query, routeMode: "host", state });
  }
  if (firstSegment === "tools" && path[1]) {
    redirectMydreamshootsLegacyTool(site, path[1]);
    return renderToolPage({ site, toolSlug: path[1], query, routeMode: "host", state });
  }
  const collectionCategory = firstSegment === "collections" && path[1] ? path[1] : "";
  const pageSlug = collectionCategory ? "/collections" : policyPageSlug(`/${path.join("/")}`);
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
