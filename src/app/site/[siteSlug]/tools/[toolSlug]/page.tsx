import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { readStorefrontPublicRuntimeStateBySlugFromDatabase } from "@/lib/storefront-state";
import { renderToolPage, resolveToolPageForSite } from "@/lib/storefront-render";
import { canonicalSeoDirectoryPathForSite, metadataForSeoDirectory } from "@/lib/dreamshoot-seo-content";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import { publicSiteSlug as normalizePublicSiteSlug } from "@/lib/domain-routing";

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

function legacyToolRedirectPath(siteSlug: string, toolSlug: string): string | undefined {
  const publicSlug = normalizePublicSiteSlug(siteSlug);
  const normalizedToolSlug = toolSlug.trim().toLowerCase();
  if (publicSlug === "mydreamshoots") return DREAMSHOOT_LEGACY_TOOL_REDIRECTS[normalizedToolSlug];
  if (publicSlug === "aidreamcapes") return AIDREAMCAPES_LEGACY_TOOL_REDIRECTS[normalizedToolSlug];
  return undefined;
}

const resolveToolPage = cache(async (siteSlug: string, toolSlug: string) => {
  const detailState = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, `/tools/${toolSlug}`, toolSlug);
  const detailSite = detailState?.sites[0];
  if (detailState && detailSite) {
    const resolved = resolveToolPageForSite(detailState, detailSite, toolSlug);
    if (resolved.matched) return { state: detailState, site: detailSite, ...resolved };
  }
  const toolsState = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, "/tools");
  const toolsSite = toolsState?.sites[0];
  if (toolsState && toolsSite) {
    const resolved = resolveToolPageForSite(toolsState, toolsSite, toolSlug);
    if (resolved.matched) return { state: toolsState, site: toolsSite, ...resolved };
  }
  const state =
    detailState ??
    toolsState ??
    await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, "/");
  const site = state?.sites[0];
  if (!state || !site) return { state, site, siteAiApps: [], page: undefined, app: undefined, matched: false };
  return { state, site, ...resolveToolPageForSite(state, site, toolSlug) };
});

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; toolSlug: string }> }): Promise<Metadata> {
  const { siteSlug, toolSlug } = await params;
  if (legacyToolRedirectPath(siteSlug, toolSlug)) return {};
  const { site, matched } = await resolveToolPage(siteSlug, toolSlug);
  if (!site || !matched) return {};
  return metadataForSeoDirectory(site, "tool", toolSlug);
}

export default async function ToolPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; toolSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug, toolSlug } = await params;
  const headerStore = await headers();
  const publicSiteSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: `/tools/${toolSlug}`,
    siteSlug
  });
  const redirectPath = legacyToolRedirectPath(publicSiteSlug, toolSlug);
  if (redirectPath) permanentRedirect(`/site/${publicSiteSlug}${redirectPath}`);
  const query = searchParams ? await searchParams : {};
  const { state, site, page, matched } = await resolveToolPage(publicSiteSlug, toolSlug);
  if (!site || !page) notFound();
  if (!matched) notFound();
  const canonicalToolPath = canonicalSeoDirectoryPathForSite(site, "tool", toolSlug);
  if (canonicalToolPath !== `/tools/${toolSlug}`) permanentRedirect(`/site/${publicSiteSlug}${canonicalToolPath}`);
  return renderToolPage({ site, toolSlug, query, routeMode: "path", state, resolvedPage: page });
}
