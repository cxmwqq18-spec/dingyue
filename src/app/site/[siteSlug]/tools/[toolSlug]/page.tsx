import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { readStorefrontPublicRuntimeStateBySlugFromDatabase } from "@/lib/storefront-state";
import { renderToolPage, resolveToolPageForSite } from "@/lib/storefront-render";
import { metadataForSeoDirectory } from "@/lib/dreamshoot-seo-content";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";

const DREAMSHOOT_LEGACY_TOOL_REDIRECTS: Record<string, string> = {
  "ai-image-studio": "/tools",
  "image-studio": "/tools",
  "travel-portraits": "/tools/nature-adventure"
};

const AIDREAMCAPES_LEGACY_TOOL_REDIRECTS: Record<string, string> = {
  "background-changer": "/tools/route-portrait-engine",
  "background-remover": "/tools/route-portrait-engine",
  "dreamscape-generator": "/tools/route-portrait-engine",
  "image-to-video": "/tools/route-portrait-engine",
  "portrait-generator": "/tools/route-portrait-engine",
  "portrait-maker": "/tools/route-portrait-engine",
  "product-reverie": "/tools/route-moodboard",
  "soft-glam": "/tools/cafe-street-story",
  "couple-escape-album": "/tools/shared-route-album",
  headshot: "/tools/route-portrait-engine"
};

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
    toolsState ??
    detailState ??
    await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, "/");
  const site = state?.sites[0];
  if (!state || !site) return { state, site, siteAiApps: [], page: undefined, app: undefined, matched: false };
  return { state, site, ...resolveToolPageForSite(state, site, toolSlug) };
});

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; toolSlug: string }> }): Promise<Metadata> {
  const { siteSlug, toolSlug } = await params;
  if (siteSlug === "mydreamshoots") {
    const redirectPath = DREAMSHOOT_LEGACY_TOOL_REDIRECTS[toolSlug.trim().toLowerCase()];
    if (redirectPath) permanentRedirect(`/site/${siteSlug}${redirectPath}`);
  }
  if (siteSlug === "aidreamcapes") {
    const redirectPath = AIDREAMCAPES_LEGACY_TOOL_REDIRECTS[toolSlug.trim().toLowerCase()];
    if (redirectPath) permanentRedirect(`/site/${siteSlug}${redirectPath}`);
  }
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
  if (publicSiteSlug === "mydreamshoots") {
    const redirectPath = DREAMSHOOT_LEGACY_TOOL_REDIRECTS[toolSlug.trim().toLowerCase()];
    if (redirectPath) permanentRedirect(`/site/${publicSiteSlug}${redirectPath}`);
  }
  if (publicSiteSlug === "aidreamcapes") {
    const redirectPath = AIDREAMCAPES_LEGACY_TOOL_REDIRECTS[toolSlug.trim().toLowerCase()];
    if (redirectPath) permanentRedirect(`/site/${publicSiteSlug}${redirectPath}`);
  }
  const query = searchParams ? await searchParams : {};
  const { state, site, page, matched } = await resolveToolPage(publicSiteSlug, toolSlug);
  if (!site || !page) notFound();
  if (!matched) notFound();
  return renderToolPage({ site, toolSlug, query, routeMode: "path", state, resolvedPage: page });
}
