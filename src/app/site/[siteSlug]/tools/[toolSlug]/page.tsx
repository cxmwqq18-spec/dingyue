import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ThemeRenderer } from "@/components/theme-renderer";
import { getPage } from "@/lib/data";
import {
  getSiteAppsFromState,
  getSiteCreativePacksFromState,
  getSiteMediaAssetsFromState,
  getSiteProductsFromState,
  getThemeRuntimeFromSession,
  readPlatformState
} from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";
import { themeStyleVars } from "@/lib/theme";
import { metadataForThemePage } from "@/lib/theme/seo";

function resolveToolPage(siteSlug: string, toolSlug: string) {
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) return { state, site: undefined, siteAiApps: [], page: undefined, app: undefined };
  const siteAiApps = getSiteAppsFromState(state, site.id);
  const directApp = siteAiApps.find((siteApp) => siteApp.aiApp.slug === toolSlug);
  const directPageSlug = `/tools/${toolSlug}`;
  const aliasMap = new Map<string, string>();

  for (const page of site.pages.filter((item) => item.pageType === "ai_tool")) {
    aliasMap.set(page.slug, page.slug);
    aliasMap.set(page.slug.replace(/^\/tools\//, ""), page.slug);
  }

  for (const pack of getSiteCreativePacksFromState(state, site.id)) {
    const slugCandidates = [
      pack.aiAppSlug,
      pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      pack.category
    ];
    for (const candidate of slugCandidates) {
      if (!candidate) continue;
      aliasMap.set(candidate, "/tools/image-studio");
      aliasMap.set(`/tools/${candidate}`, "/tools/image-studio");
    }
  }

  const resolvedSlug = aliasMap.get(toolSlug) ?? aliasMap.get(directPageSlug) ?? directPageSlug;
  const app = directApp ?? siteAiApps.find((siteApp) => siteApp.aiApp.slug === toolSlug || siteApp.aiApp.slug === "image_generator");
  const page = site.pages.find((item) => item.slug === resolvedSlug) ?? getPage(site, "/tools/image-studio");
  return { state, site, siteAiApps, page, app };
}

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; toolSlug: string }> }): Promise<Metadata> {
  const { siteSlug, toolSlug } = await params;
  const { site, page, app } = resolveToolPage(siteSlug, toolSlug);
  if (!site || !page || (!app && page.slug !== `/tools/${toolSlug}`)) return {};
  return metadataForThemePage(site, page);
}

export default async function ToolPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; toolSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug, toolSlug } = await params;
  const query = searchParams ? await searchParams : {};
  const { state, site, siteAiApps, page, app } = resolveToolPage(siteSlug, toolSlug);
  if (!site || !page) notFound();
  site.mediaAssets = getSiteMediaAssetsFromState(state, site.id);
  if (!app && page.slug !== `/tools/${toolSlug}`) notFound();
  const settings = site.themeSettings.publishedJson;
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  const runtime = getThemeRuntimeFromSession(state, site.id, sessionId);
  return (
    <div style={themeStyleVars(settings)}>
      <ThemeRenderer
        creativePacks={getSiteCreativePacksFromState(state, site.id)}
        page={page.publishedJson}
        pagePath={page.slug}
        products={getSiteProductsFromState(state, site.id)}
        query={query}
        runtime={runtime}
        settings={settings}
        site={site}
        siteAiApps={siteAiApps}
      />
    </div>
  );
}
