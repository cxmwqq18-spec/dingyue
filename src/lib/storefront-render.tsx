import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CustomerSessionBadge } from "@/components/app/customer-session-badge";
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
  toThemeRuntimeAsset,
  toThemeRuntimeJob,
  toThemeRuntimeLedgerEntry
} from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";
import { readStorefrontPlatformState } from "@/lib/storefront-state";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { themeStyleVars } from "@/lib/theme";
import type { CustomerSession, PlatformState, PublicCustomer, Site, ThemePageJson, ThemeRuntimeData } from "@/lib/types";

const jobDetailSlug = "/app/jobs/detail";

type SiteRenderData = {
  creativePacks: ReturnType<typeof getSiteCreativePacksFromState>;
  mediaAssets: ReturnType<typeof getSiteMediaAssetsFromState>;
  products: ReturnType<typeof getSiteProductsFromState>;
  siteAiApps: ReturnType<typeof getSiteAppsFromState>;
};

function getSiteRenderData(state: PlatformState, siteId: string): SiteRenderData {
  return {
    creativePacks: getSiteCreativePacksFromState(state, siteId),
    mediaAssets: getSiteMediaAssetsFromState(state, siteId),
    products: getSiteProductsFromState(state, siteId),
    siteAiApps: getSiteAppsFromState(state, siteId)
  };
}

function runtimeWithEmptyCollections(runtime: Partial<ThemeRuntimeData> = {}): ThemeRuntimeData {
  return {
    jobs: [],
    assets: [],
    albums: [],
    ledger: [],
    subscriptions: [],
    orders: [],
    customerModels: [],
    ...runtime
  };
}

async function getCurrentCustomerSession(
  state: PlatformState,
  siteId: string,
  sessionId?: string
): Promise<{ customer: PublicCustomer; session: CustomerSession } | undefined> {
  if (!sessionId) return undefined;
  const relational = await getCustomerBySessionRelational({ siteId, sessionId });
  if (relational) return relational;
  return getCustomerBySessionFromState(state, siteId, sessionId);
}

function getCustomerRuntimeFromState(state: PlatformState, siteId: string, customer: PublicCustomer, full: boolean): ThemeRuntimeData {
  const runtime = full ? getThemeRuntimeForCustomer(state, siteId, customer.id) : runtimeWithEmptyCollections();
  return {
    ...runtime,
    customer
  };
}

async function getLightCustomerRuntime(state: PlatformState, siteId: string, sessionId?: string): Promise<ThemeRuntimeData> {
  if (!sessionId) return runtimeWithEmptyCollections();
  const current = await getCurrentCustomerSession(state, siteId, sessionId);
  if (current) return getCustomerRuntimeFromState(state, siteId, current.customer, false);
  return runtimeWithEmptyCollections({
    customer: getCustomerBySessionFromState(state, siteId, sessionId)?.customer
  });
}

async function getFullCustomerRuntime(state: PlatformState, siteId: string, sessionId?: string): Promise<ThemeRuntimeData> {
  if (!sessionId) return runtimeWithEmptyCollections();
  const current = await getCurrentCustomerSession(state, siteId, sessionId);
  if (!current) return runtimeWithEmptyCollections();
  return getCustomerRuntimeFromState(state, siteId, current.customer, true);
}

function pageNeedsFullCustomerRuntime(pageJson: ThemePageJson, slug: string): boolean {
  if (slug === "/album" || slug === "/app" || slug === "/account" || slug === "/cart" || slug.startsWith("/app/")) return true;
  return pageJson.sectionsOrder.some((sectionId) => {
    const type = pageJson.sections[sectionId]?.type;
    return type === "upload_panel" || type === "generation_form" || type === "job_progress" || type === "album_gallery";
  });
}

function withAccountDashboardPage(pageJson: ReturnType<typeof getPage>["publishedJson"]) {
  if (pageJson.sections.account_ops_1) return pageJson;
  return {
    ...pageJson,
    sectionsOrder: ["account_ops_1", ...pageJson.sectionsOrder.filter((sectionId) => sectionId !== "intro_1")],
    sections: {
      ...pageJson.sections,
      account_ops_1: {
        type: "ai_feature_launcher",
        settings: {
          anchor: "account-ops",
          eyebrow: "Customer account",
          title: "Your personal center for credits, orders, albums, and AI progress.",
          subtitle: "Review profile information, plan status, order history, private albums, active jobs, and credit activity from one signed-in account page.",
          surface: "account",
          ctaLabel: "Open workspace",
          ctaHref: "/app#upload_1",
          chipList: "Profile|Plan and credits|Orders|Albums and progress"
        },
        blocks: [
          { id: "account_uploads", type: "feature", settings: { title: "Upload photos", description: "Add source portraits and style references before requesting images.", meta: "Assets", href: "/app#upload_1" } },
          { id: "account_create", type: "feature", settings: { title: "Create AI images", description: "Choose prompts and reserve credits for a private generation request.", meta: "Generate", href: "/app#create" } },
          { id: "account_progress", type: "feature", settings: { title: "AI generation progress", description: "Open queued, running, delivered, and review-needed requests.", meta: "Progress", href: "/app/jobs/progress" } },
          { id: "account_albums", type: "feature", settings: { title: "Personal albums", description: "Review delivered images and private gallery downloads.", meta: "Gallery", href: "/album" } }
        ]
      }
    }
  };
}

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

function normalizeToolLookup(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/tools\//, "")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const dreamshootImageStudioToolAliases = new Set([
  "professional-headshot-maker",
  "headshot",
  "creator-portrait-studio",
  "creator-portrait",
  "world-cup-fan-photos",
  "cyberpunk-portrait-maker",
  "cyberpunk-portrait",
  "gala-photo-maker",
  "gala-photo",
  "noir-character-portraits",
  "noir-portrait",
  "anime-avatar-builder",
  "anime-avatar",
  "nature-adventure-photos",
  "nature-adventure",
  "fashion-editorial-set",
  "fashion-editorial",
  "product-lifestyle-photos",
  "product-lifestyle",
  "background-changer",
  "background-remover",
  "magic-eraser",
  "photo-enhancer",
  "portrait-retouch",
  "unblur-image",
  "color-correction",
  "old-photo-restoration",
  "edit-by-prompt",
  "magic-upscaler",
  "image-to-video-concept",
  "image-to-video",
  "profile-clip-maker",
  "profile-clip",
  "fan-poster-motion",
  "creator-intro-video",
  "product-teaser-clip",
  "animated-avatar-preview",
  "animated-avatar",
  "fashion-reel-starter",
  "fashion-reel",
  "album-story-video"
]);

export function resolveToolPageForSite(state: PlatformState, site: Site, toolSlug: string, siteAiApps = getSiteAppsFromState(state, site.id), creativePacks = getSiteCreativePacksFromState(state, site.id)) {
  const normalizedToolSlug = normalizeToolLookup(toolSlug);
  const directPageSlug = `/tools/${toolSlug}`;
  const normalizedPageSlug = normalizedToolSlug ? `/tools/${normalizedToolSlug}` : directPageSlug;
  const aliasMap = new Map<string, string>();

  for (const page of site.pages.filter((item) => item.pageType === "ai_tool")) {
    aliasMap.set(page.slug, page.slug);
    aliasMap.set(page.slug.replace(/^\/tools\//, ""), page.slug);
    aliasMap.set(normalizeToolLookup(page.slug), page.slug);
  }

  for (const pack of creativePacks) {
    const slugCandidates = [
      pack.aiAppSlug,
      pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      pack.category
    ];
    for (const candidate of slugCandidates) {
      if (!candidate) continue;
      aliasMap.set(candidate, "/tools/image-studio");
      aliasMap.set(`/tools/${candidate}`, "/tools/image-studio");
      aliasMap.set(normalizeToolLookup(candidate), "/tools/image-studio");
    }
  }

  if (/dreamshoot/i.test(`${site.slug} ${site.name} ${site.branding.logoText}`)) {
    for (const alias of dreamshootImageStudioToolAliases) {
      aliasMap.set(alias, "/tools/image-studio");
      aliasMap.set(`/tools/${alias}`, "/tools/image-studio");
    }
  }

  const directApp = siteAiApps.find((siteApp) => normalizeToolLookup(siteApp.aiApp.slug) === normalizedToolSlug);
  const legacyImageApp = normalizedToolSlug === "image-studio" || normalizedToolSlug === "image-generator"
    ? siteAiApps.find((siteApp) => siteApp.aiApp.slug === "image_generator")
    : undefined;
  const resolvedSlug = aliasMap.get(toolSlug) ?? aliasMap.get(directPageSlug) ?? aliasMap.get(normalizedToolSlug) ?? normalizedPageSlug;
  const page = site.pages.find((item) => item.slug === resolvedSlug);
  const app = directApp ?? legacyImageApp ?? (page?.slug === "/tools/image-studio" ? siteAiApps.find((siteApp) => siteApp.aiApp.slug === "image_generator") : undefined);
  const matched = Boolean(page || directApp || legacyImageApp || aliasMap.has(toolSlug) || aliasMap.has(directPageSlug) || aliasMap.has(normalizedToolSlug));
  return { siteAiApps, page: page ?? getPage(site, "/tools/image-studio"), app, matched, resolvedSlug };
}

function renderThemePage({
  currentSite,
  page,
  pagePath,
  query,
  renderData,
  routeMode,
  runtime,
  settings
}: {
  currentSite: Site;
  page: ThemePageJson;
  pagePath: string;
  query: Record<string, string | string[] | undefined>;
  renderData: SiteRenderData;
  routeMode: "host" | "path";
  runtime: ThemeRuntimeData;
  settings: Site["themeSettings"]["publishedJson"];
}) {
  return (
    <div style={themeStyleVars(settings)}>
      <ThemeRenderer
        creativePacks={renderData.creativePacks}
        page={page}
        pagePath={pagePath}
        products={renderData.products}
        query={query}
        routeMode={routeMode}
        runtime={runtime}
        settings={settings}
        site={currentSite}
        siteAiApps={renderData.siteAiApps}
      />
    </div>
  );
}

export async function renderStorefrontPage({
  site,
  slug,
  query = {},
  routeMode = "path",
  state: providedState
}: {
  site: Site;
  slug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
}) {
  const state = providedState ?? readStorefrontPlatformState();
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const directPage = getPage(currentSite, slug);
  const page = directPage.slug === slug ? directPage : currentSite.pages.find((item) => item.slug === "/404") ?? directPage;
  const settings = currentSite.themeSettings.publishedJson;
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const pageJson = slug === "/account" ? withAccountDashboardPage(page.publishedJson) : page.publishedJson;
  const runtime = sessionId && pageNeedsFullCustomerRuntime(pageJson, slug)
    ? await getFullCustomerRuntime(state, currentSite.id, sessionId)
    : await getLightCustomerRuntime(state, currentSite.id, sessionId);
  const runtimeWithAuth = {
    ...runtime,
    ...(slug === "/login" ? { auth: getDefaultCustomerAuth(state, currentSite.id, typeof query.error === "string" ? query.error : undefined) } : {})
  };

  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: directPage.slug === slug ? slug : "/404",
    query,
    renderData,
    routeMode,
    runtime: runtimeWithAuth,
    settings
  });
}

export async function renderCustomerWorkspacePage({
  site,
  slug,
  query = {},
  routeMode = "path",
  state: providedState
}: {
  site: Site;
  slug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
}) {
  const state = providedState ?? readStorefrontPlatformState();
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const current = getCustomerBySessionFromState(state, currentSite.id, sessionId);
  if (!current) redirect(routeMode === "host" ? "/login" : `/site/${currentSite.slug}/login`);

  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const page = getPage(currentSite, slug);
  const settings = currentSite.themeSettings.publishedJson;
  const runtime = getThemeRuntimeFromSession(state, currentSite.id, sessionId);

  return (
    <div style={themeStyleVars(settings)}>
      <CustomerSessionBadge customer={current.customer} siteId={currentSite.id} siteSlug={currentSite.slug} />
      <ThemeRenderer
        creativePacks={renderData.creativePacks}
        page={slug === "/account" ? withAccountDashboardPage(page.publishedJson) : page.publishedJson}
        pagePath={slug}
        products={renderData.products}
        query={query}
        routeMode={routeMode}
        runtime={runtime}
        settings={settings}
        site={currentSite}
        siteAiApps={renderData.siteAiApps}
      />
    </div>
  );
}

export async function renderCustomerJobDetailPage({
  site,
  jobId,
  query = {},
  routeMode = "path",
  state: providedState
}: {
  site: Site;
  jobId: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
}) {
  const state = providedState ?? readStorefrontPlatformState();
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const current = getCustomerBySessionFromState(state, currentSite.id, sessionId);
  if (!current) redirect(routeMode === "host" ? "/login" : `/site/${currentSite.slug}/login`);

  const job = state.jobs.find((item) => item.id === jobId && item.siteId === currentSite.id && item.customerId === current.customer.id);
  if (!job) notFound();

  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
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
      <CustomerSessionBadge customer={current.customer} siteId={currentSite.id} siteSlug={currentSite.slug} />
      <ThemeRenderer
        creativePacks={renderData.creativePacks}
        page={page.publishedJson}
        pagePath={`/app/jobs/${job.id}`}
        products={renderData.products}
        query={query}
        routeMode={routeMode}
        runtime={runtime}
        settings={settings}
        site={currentSite}
        siteAiApps={renderData.siteAiApps}
      />
    </div>
  );
}

export async function renderToolPage({
  site,
  toolSlug,
  query = {},
  routeMode = "path",
  state: providedState
}: {
  site: Site;
  toolSlug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
}) {
  const state = providedState ?? readStorefrontPlatformState();
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const { page, matched } = resolveToolPageForSite(state, currentSite, toolSlug, renderData.siteAiApps, renderData.creativePacks);
  if (!matched) notFound();
  const settings = currentSite.themeSettings.publishedJson;
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const runtime = sessionId && pageNeedsFullCustomerRuntime(page.publishedJson, page.slug)
    ? getThemeRuntimeFromSession(state, currentSite.id, sessionId)
    : getLightCustomerRuntime(state, currentSite.id, sessionId);
  return renderThemePage({
    currentSite,
    page: page.publishedJson,
    pagePath: page.slug,
    query,
    renderData,
    routeMode,
    runtime,
    settings
  });
}
