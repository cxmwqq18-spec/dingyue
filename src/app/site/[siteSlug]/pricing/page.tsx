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

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) return {};
  return metadataForThemePage(site, getPage(site, "/pricing"));
}

export default async function PricingPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const query = searchParams ? await searchParams : {};
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  site.mediaAssets = getSiteMediaAssetsFromState(state, site.id);
  const page = getPage(site, "/pricing");
  const settings = site.themeSettings.publishedJson;
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  const runtime = getThemeRuntimeFromSession(state, site.id, sessionId);
  return (
    <div style={themeStyleVars(settings)}>
      <ThemeRenderer
        creativePacks={getSiteCreativePacksFromState(state, site.id)}
        page={page.publishedJson}
        pagePath="/pricing"
        products={getSiteProductsFromState(state, site.id)}
        query={query}
        runtime={runtime}
        settings={settings}
        site={site}
        siteAiApps={getSiteAppsFromState(state, site.id)}
      />
    </div>
  );
}
