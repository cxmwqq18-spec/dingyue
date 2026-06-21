import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ThemeRenderer } from "@/components/theme-renderer";
import { getPage } from "@/lib/data";
import { authMessageForCode } from "@/lib/auth-messages";
import {
  getCustomerBySessionFromState,
  getCustomerJobAssetsFromState,
  getCustomerLedgerFromState,
  getSiteAppsFromState,
  getSiteCreativePacksFromState,
  getSiteMediaAssetsFromState,
  getSiteProductsFromState,
  getThemeRuntimeForCustomer,
  getThemeRuntimeFromSession,
  readPlatformState,
  toThemeRuntimeAsset,
  toThemeRuntimeJob,
  toThemeRuntimeLedgerEntry
} from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";
import { themeStyleVars } from "@/lib/theme";
import type { PlatformState, Site } from "@/lib/types";

const jobDetailSlug = "/app/jobs/detail";

export function getSiteBySlugFromState(state: PlatformState, siteSlug: string): Site | undefined {
  return state.sites.find((item) => item.slug === siteSlug);
}

export function getDefaultCustomerAuth(state: PlatformState, siteId: string, errorCode?: string) {
  const defaultCustomer = state.customers.find((customer) => customer.siteId === siteId) ?? state.customers.find((customer) => customer.email === "mara@northpier.studio");
  return {
    defaultEmail: defaultCustomer?.email ?? "mara@northpier.studio",
    defaultName: defaultCustomer?.name ?? "Mara Voss",
    defaultPassword: "mara123",
    initialMessage: authMessageForCode("customer", errorCode)
  };
}

export function resolveToolPageForSite(state: PlatformState, site: Site, toolSlug: string) {
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
  return { siteAiApps, page, app };
}

export async function renderStorefrontPage({
  site,
  slug,
  query = {},
  routeMode = "path"
}: {
  site: Site;
  slug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
}) {
  const state = readPlatformState();
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  currentSite.mediaAssets = getSiteMediaAssetsFromState(state, currentSite.id);
  const directPage = getPage(currentSite, slug);
  const page = directPage.slug === slug ? directPage : currentSite.pages.find((item) => item.slug === "/404") ?? directPage;
  const settings = currentSite.themeSettings.publishedJson;
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const runtime = {
    ...getThemeRuntimeFromSession(state, currentSite.id, sessionId),
    ...(slug === "/login" ? { auth: getDefaultCustomerAuth(state, currentSite.id, typeof query.error === "string" ? query.error : undefined) } : {})
  };

  return (
    <div style={themeStyleVars(settings)}>
      <ThemeRenderer
        creativePacks={getSiteCreativePacksFromState(state, currentSite.id)}
        page={page.publishedJson}
        pagePath={directPage.slug === slug ? slug : "/404"}
        products={getSiteProductsFromState(state, currentSite.id)}
        query={query}
        routeMode={routeMode}
        runtime={runtime}
        settings={settings}
        site={currentSite}
        siteAiApps={getSiteAppsFromState(state, currentSite.id)}
      />
    </div>
  );
}

export async function renderCustomerWorkspacePage({
  site,
  slug,
  query = {},
  routeMode = "path"
}: {
  site: Site;
  slug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
}) {
  const state = readPlatformState();
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const current = getCustomerBySessionFromState(state, currentSite.id, sessionId);
  if (!current) redirect(routeMode === "host" ? "/login" : `/site/${currentSite.slug}/login`);

  currentSite.mediaAssets = getSiteMediaAssetsFromState(state, currentSite.id);
  const page = getPage(currentSite, slug);
  const settings = currentSite.themeSettings.publishedJson;
  const runtime = getThemeRuntimeFromSession(state, currentSite.id, sessionId);

  return (
    <div style={themeStyleVars(settings)}>
      <ThemeRenderer
        creativePacks={getSiteCreativePacksFromState(state, currentSite.id)}
        page={page.publishedJson}
        pagePath={slug}
        products={getSiteProductsFromState(state, currentSite.id)}
        query={query}
        routeMode={routeMode}
        runtime={runtime}
        settings={settings}
        site={currentSite}
        siteAiApps={getSiteAppsFromState(state, currentSite.id)}
      />
    </div>
  );
}

export async function renderCustomerJobDetailPage({
  site,
  jobId,
  query = {},
  routeMode = "path"
}: {
  site: Site;
  jobId: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
}) {
  const state = readPlatformState();
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const current = getCustomerBySessionFromState(state, currentSite.id, sessionId);
  if (!current) redirect(routeMode === "host" ? "/login" : `/site/${currentSite.slug}/login`);

  const job = state.jobs.find((item) => item.id === jobId && item.siteId === currentSite.id && item.customerId === current.customer.id);
  if (!job) notFound();

  currentSite.mediaAssets = getSiteMediaAssetsFromState(state, currentSite.id);
  const page = currentSite.pages.find((item) => item.slug === jobDetailSlug || item.pageType === "job_detail") ?? getPage(currentSite, "/app/jobs/progress");
  const settings = currentSite.themeSettings.publishedJson;
  const runtime = {
    ...getThemeRuntimeForCustomer(state, currentSite.id, current.customer.id),
    jobDetail: {
      job: toThemeRuntimeJob(job),
      ledger: getCustomerLedgerFromState(state, currentSite.id, current.customer.id)
        .filter((entry) => entry.sourceId === job.id)
        .map(toThemeRuntimeLedgerEntry),
      assets: getCustomerJobAssetsFromState(state, currentSite.id, current.customer.id, job.id).map((asset) => toThemeRuntimeAsset(state, asset))
    }
  };

  return (
    <div style={themeStyleVars(settings)}>
      <ThemeRenderer
        creativePacks={getSiteCreativePacksFromState(state, currentSite.id)}
        page={page.publishedJson}
        pagePath={`/app/jobs/${job.id}`}
        products={getSiteProductsFromState(state, currentSite.id)}
        query={query}
        routeMode={routeMode}
        runtime={runtime}
        settings={settings}
        site={currentSite}
        siteAiApps={getSiteAppsFromState(state, currentSite.id)}
      />
    </div>
  );
}

export async function renderToolPage({
  site,
  toolSlug,
  query = {},
  routeMode = "path"
}: {
  site: Site;
  toolSlug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
}) {
  const state = readPlatformState();
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  currentSite.mediaAssets = getSiteMediaAssetsFromState(state, currentSite.id);
  const { siteAiApps, page, app } = resolveToolPageForSite(state, currentSite, toolSlug);
  if (!app && page.slug !== `/tools/${toolSlug}`) notFound();
  const settings = currentSite.themeSettings.publishedJson;
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const runtime = getThemeRuntimeFromSession(state, currentSite.id, sessionId);
  return (
    <div style={themeStyleVars(settings)}>
      <ThemeRenderer
        creativePacks={getSiteCreativePacksFromState(state, currentSite.id)}
        page={page.publishedJson}
        pagePath={page.slug}
        products={getSiteProductsFromState(state, currentSite.id)}
        query={query}
        routeMode={routeMode}
        runtime={runtime}
        settings={settings}
        site={currentSite}
        siteAiApps={siteAiApps}
      />
    </div>
  );
}
