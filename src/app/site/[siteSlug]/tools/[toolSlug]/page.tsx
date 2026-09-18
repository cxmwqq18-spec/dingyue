import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { renderToolPage, resolveToolPageForSite } from "@/lib/storefront-render";
import { readPathModePublicRuntimeState } from "@/lib/storefront-local-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { canonicalSeoDirectoryPathForSite } from "@/lib/dreamshoot-seo-content";
import { metadataForPublishedStorefrontDirectoryPage } from "@/lib/storefront-metadata";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import { publicSiteSlug as normalizePublicSiteSlug } from "@/lib/domain-routing";
import { storefrontPathForRouteMode, storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";
import { isRetiredAidreamcapesImageToolPath } from "@/lib/aidreamcapes-image-theme-routes";

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
  "social-keepsake": "/tools/birthday-fan-moment-maker",
  "seasonal-celebration-album-maker": "/tools/new-year-countdown-album-maker",
  "family-travel-keepsakes": "/tools/thanksgiving-keepsake-set-maker",
  "travel-journal-cover-maker": "/tools/new-year-countdown-album-maker"
};

function legacyToolRedirectPath(siteSlug: string, toolSlug: string): string | undefined {
  const publicSlug = normalizePublicSiteSlug(siteSlug);
  const normalizedToolSlug = toolSlug.trim().toLowerCase();
  if (publicSlug === "aidreamcapes") return AIDREAMCAPES_LEGACY_TOOL_REDIRECTS[normalizedToolSlug];
  return undefined;
}

function findPublicSiteInState<TSite extends { slug: string }>(state: { sites: TSite[] } | undefined, siteSlug: string): TSite | undefined {
  if (!state) return undefined;
  const publicSlug = normalizePublicSiteSlug(siteSlug);
  return state.sites.find((site) => normalizePublicSiteSlug(site.slug) === publicSlug);
}

const resolveToolPage = cache(async (siteSlug: string, toolSlug: string) => {
  const detailState = await readPathModePublicRuntimeState(siteSlug, `/tools/${toolSlug}`, toolSlug);
  const detailSite = findPublicSiteInState(detailState, siteSlug);
  if (detailState && detailSite) {
    const resolved = resolveToolPageForSite(detailState, detailSite, toolSlug);
    if (resolved.matched) return { state: detailState, site: detailSite, ...resolved };
  }

  const toolsState = await readPathModePublicRuntimeState(siteSlug, "/tools");
  const toolsSite = findPublicSiteInState(toolsState, siteSlug);
  if (toolsState && toolsSite) {
    const resolved = resolveToolPageForSite(toolsState, toolsSite, toolSlug);
    if (resolved.matched) return { state: toolsState, site: toolsSite, ...resolved };
  }

  const state =
    detailState ??
    toolsState ??
    await readPathModePublicRuntimeState(siteSlug, "/");
  const site = findPublicSiteInState(state, siteSlug);
  if (!state || !site) return { state, site, siteAiApps: [], page: undefined, app: undefined, matched: false };
  return { state, site, ...resolveToolPageForSite(state, site, toolSlug) };
});

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; toolSlug: string }> }): Promise<Metadata> {
  const { siteSlug, toolSlug } = await params;
  if (["mydreamshoots", "aidreamshoots"].includes(normalizePublicSiteSlug(siteSlug))) return {};
  if (isRetiredAidreamcapesImageToolPath(normalizePublicSiteSlug(siteSlug), `/tools/${toolSlug}`)) return {};
  if (legacyToolRedirectPath(siteSlug, toolSlug)) return {};
  const { state, site, page, matched } = await resolveToolPage(siteSlug, toolSlug);
  if (!state || !site || !page || !matched) return {};
  return metadataForPublishedStorefrontDirectoryPage({
    site,
    page,
    kind: "tool",
    directorySlug: toolSlug,
    products: state.products,
    creativePacks: state.creativePacks
  });
}

export default async function ToolPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; toolSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug, toolSlug } = await params;
  if (["mydreamshoots", "aidreamshoots"].includes(normalizePublicSiteSlug(siteSlug))) notFound();
  if (isRetiredAidreamcapesImageToolPath(normalizePublicSiteSlug(siteSlug), `/tools/${toolSlug}`)) notFound();
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, siteSlug);
  // A host-based storefront is already on its public URL. Calling
  // redirectPublicSitePathToCanonicalHost here would redirect the request to
  // the same /tools/... path and create a permanent-redirect loop. Path-mode
  // requests still need the normal canonical-host redirect.
  const publicSiteSlug = routeMode === "host"
    ? normalizePublicSiteSlug(siteSlug)
    : redirectPublicSitePathToCanonicalHost({
        host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
        pathname: `/tools/${toolSlug}`,
        siteSlug
      });
  const redirectPath = legacyToolRedirectPath(publicSiteSlug, toolSlug);
  if (redirectPath) permanentRedirect(storefrontPathForRouteMode(publicSiteSlug, redirectPath, routeMode));
  const query = searchParams ? await searchParams : {};
  const { state, site, page, matched } = await resolveToolPage(publicSiteSlug, toolSlug);
  if (!site || !page) notFound();
  if (!matched) notFound();
  const canonicalToolPath = canonicalSeoDirectoryPathForSite(site, "tool", toolSlug);
  if (canonicalToolPath !== `/tools/${toolSlug}`) permanentRedirect(storefrontPathForRouteMode(publicSiteSlug, canonicalToolPath, routeMode));
  return renderToolPage({ site, toolSlug, query, routeMode, state, resolvedPage: page });
}
