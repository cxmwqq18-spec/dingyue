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
  toThemeRuntimeAsset,
  toThemeRuntimeJob,
  toThemeRuntimeLedgerEntry
} from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";
import {
  readStorefrontCustomerRuntimeStateForSiteFromDatabase,
  readStorefrontPlatformState,
  readStorefrontPublicRuntimeStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateForSiteFromDatabase,
  readStorefrontRuntimeStateForSiteFromDatabase
} from "@/lib/storefront-state";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { getSiteIdBySlugRelational } from "@/lib/stores/site-store";
import { themeStyleVars } from "@/lib/theme";
import { canonicalSiteSlug, publicSiteSlug } from "@/lib/domain-routing";
import { withSeoDirectorySection } from "@/lib/dreamshoot-seo-content";
import { dreamshootAiStudioTemplates } from "@/lib/theme/packages/dreamshoot-ai-studio";
import type { CustomerSession, PlatformState, PublicCustomer, SectionBlockInstance, Site, ThemePageJson, ThemeRuntimeData } from "@/lib/types";

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

async function getStateForStorefrontRender(site: Site, routeMode: "host" | "path", providedState?: PlatformState): Promise<PlatformState> {
  if (providedState) return providedState;
  if (routeMode === "host") {
    try {
      const runtimeState = await readStorefrontRuntimeStateForSiteFromDatabase(site.id);
      if (runtimeState) return runtimeState;
    } catch {
      // Fall through to the legacy reader for local or migrating databases.
    }
  }
  return readStorefrontPlatformState();
}

async function getStateForCustomerRuntimeRender(
  site: Site,
  sessionId?: string,
  providedState?: PlatformState,
  profile: "full" | "workspace" | "account" = "full"
): Promise<PlatformState | undefined> {
  if (providedState) return providedState;
  if (!sessionId) return undefined;
  try {
    return await readStorefrontCustomerRuntimeStateForSiteFromDatabase({ siteId: site.id, sessionId, profile });
  } catch {
    // Fall through to the legacy full-site state reader for local or migrating databases.
    return undefined;
  }
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
  const stateResult = getCustomerBySessionFromState(state, siteId, sessionId);
  if (stateResult) return stateResult;
  const relational = await getCustomerBySessionRelational({ siteId, sessionId });
  if (relational) return relational;
  return undefined;
}

function getCustomerRuntimeFromState(state: PlatformState, siteId: string, customer: PublicCustomer, full: boolean): ThemeRuntimeData {
  const runtime = full ? getThemeRuntimeForCustomer(state, siteId, customer.id) : runtimeWithEmptyCollections();
  return {
    ...runtime,
    customer
  };
}

function trimCustomerRuntimeForWorkspace(runtime: ThemeRuntimeData, slug: string): ThemeRuntimeData {
  if (slug !== "/app") return runtime;
  return {
    ...runtime,
    jobs: (runtime.jobs ?? []).slice(0, 8),
    assets: (runtime.assets ?? []).slice(0, 24),
    albums: (runtime.albums ?? []).slice(0, 8),
    ledger: (runtime.ledger ?? []).slice(0, 12),
    subscriptions: (runtime.subscriptions ?? []).slice(0, 4),
    orders: (runtime.orders ?? []).slice(0, 6),
    customerModels: (runtime.customerModels ?? []).slice(0, 4)
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
  const accountSection = pageJson.sections.account_ops_1 ?? {
    type: "ai_feature_launcher" as const,
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
      { id: "account_uploads", type: "feature" as const, settings: { title: "Upload photos", description: "Add source portraits and style references before requesting images.", meta: "Assets", href: "/app#upload_1" } },
      { id: "account_create", type: "feature" as const, settings: { title: "Create AI images", description: "Choose prompts and reserve credits for a private generation request.", meta: "Generate", href: "/app#create" } },
      { id: "account_progress", type: "feature" as const, settings: { title: "AI generation progress", description: "Open queued, running, delivered, and review-needed requests.", meta: "Progress", href: "/app/jobs/progress" } },
      { id: "account_albums", type: "feature" as const, settings: { title: "Personal albums", description: "Review delivered images and private gallery downloads.", meta: "Gallery", href: "/album" } }
    ]
  };
  return {
    ...pageJson,
    sectionsOrder: ["account_ops_1"],
    sections: {
      account_ops_1: accountSection
    }
  };
}

function withCustomerWorkspaceFlowPage(pageJson: ThemePageJson): ThemePageJson {
  const sections: ThemePageJson["sections"] = {
    ...pageJson.sections,
    launcher_1: {
      ...pageJson.sections.launcher_1,
      type: "ai_feature_launcher" as const,
      settings: {
        ...(pageJson.sections.launcher_1?.settings ?? {}),
        ctaLabel: pageJson.sections.launcher_1?.settings?.ctaLabel ?? "Choose a tool",
        ctaHref: pageJson.sections.launcher_1?.settings?.ctaHref ?? "/app#create"
      },
      blocks: [
        { id: "feature_prepare", type: "feature", settings: { title: "Choose a tool", description: "Pick the photo workflow first, then attach the source photos it needs.", meta: "Tool first", href: "/app#create" } },
        { id: "feature_upload", type: "feature", settings: { title: "Upload photos", description: "Add private source portraits and references for this account.", meta: "Private intake", href: "/app#upload_1" } },
        { id: "feature_progress", type: "feature", settings: { title: "Track progress", description: "Review queued, running, delivered, and review-needed requests.", meta: "Live progress", href: "/app#progress_1" } },
        { id: "feature_album", type: "feature", settings: { title: "Download albums", description: "Open delivered images and private gallery downloads for this account.", meta: "Private delivery", href: "/app#album_1" } }
      ]
    },
    form_1: pageJson.sections.form_1 ?? {
      type: "generation_form" as const,
      settings: {
        aiAppSlug: "image_generator",
        title: "Choose a photo tool",
        helper: "Pick one backend-enabled tool first. Then upload the source photos it asks for and start a private request.",
        surface: "workspace"
      },
      blocks: []
    },
    upload_1: pageJson.sections.upload_1
      ? {
          ...pageJson.sections.upload_1,
          settings: {
            ...pageJson.sections.upload_1.settings,
            title: pageJson.sections.upload_1.settings.title ?? "Upload source photos",
            helper: pageJson.sections.upload_1.settings.helper ?? "Upload only the source photos needed for the selected tool."
          }
        }
      : pageJson.sections.upload_1
  };
  delete sections.trust_1;

  const desiredOrder = ["launcher_1", "form_1", "upload_1", "progress_1", "album_1"];
  const ordered = [
    ...desiredOrder.filter((sectionId) => sections[sectionId]),
    ...pageJson.sectionsOrder.filter((sectionId) => !desiredOrder.includes(sectionId) && sectionId !== "trust_1")
  ];

  return {
    ...pageJson,
    sections,
    sectionsOrder: ordered
  };
}

export function getSiteBySlugFromState(state: PlatformState, siteSlug: string): Site | undefined {
  const canonicalSlug = canonicalSiteSlug(siteSlug);
  return state.sites.find((item) => item.slug === canonicalSlug);
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

function sectionSetting(page: ThemePageJson, sectionId: string, key: string, fallback = ""): string {
  const value = page.sections[sectionId]?.settings?.[key];
  return typeof value === "string" ? value : fallback;
}

function blockString(block: SectionBlockInstance, key: string, fallback = ""): string {
  const value = block.settings[key];
  return typeof value === "string" ? value : fallback;
}

function clonePageJson(page: ThemePageJson): ThemePageJson {
  return JSON.parse(JSON.stringify(page)) as ThemePageJson;
}

function toolBlocksFromTheme(site: Site): SectionBlockInstance[] {
  const headerBlocks = site.themeSettings.publishedJson.globalSections?.header?.blocks?.filter((block) => block.type === "tool_card") ?? [];
  const toolPage = site.pages.find((page) => page.slug === "/tools" || page.pageType === "tools");
  const toolPageBlocks = toolPage
    ? Object.values(toolPage.publishedJson.sections).flatMap((section) => section.blocks ?? []).filter((block) => block.type === "tool_card")
    : [];
  const blocks = [...headerBlocks, ...toolPageBlocks];
  return Array.from(new Map(blocks.map((block) => [block.id, block])).values());
}

function toolSlugFromBlock(block: SectionBlockInstance): string {
  const href = blockString(block, "href", "");
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  return normalizeToolLookup(path.replace(/^\/tools\//, "") || block.id || blockString(block, "title"));
}

function appSlugForToolCategory(category: string, siteAiApps: ReturnType<typeof getSiteAppsFromState>): string {
  const normalized = category.toLowerCase();
  const preferred = normalized.includes("video") ? "video_generator" : "image_generator";
  return siteAiApps.find((app) => app.aiApp.slug === preferred)?.aiApp.slug ?? siteAiApps[0]?.aiApp.slug ?? preferred;
}

function titleFromToolSlug(toolSlug: string): string {
  const explicit: Record<string, string> = {
    "background-changer": "Background Changer Free",
    "background-remover": "Image Background Remover Free",
    "magic-eraser": "Magic Eraser Free",
    "photo-enhancer": "Photo Enhancer Free",
    "unblur-image": "Unblur Image Free",
    "color-correction": "Color Correction Free",
    "old-photo-restoration": "Old Photo Restoration Free",
    "edit-by-prompt": "Photo Edit by Prompt",
    "headshot-generator": "Headshot Photo Generator Free",
    "wedding-portraits": "Wedding Portraits",
    "image-to-video": "Image to Video Concept"
  };
  return explicit[toolSlug] ?? toolSlug.split("-").filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function categoryForToolSlug(toolSlug: string): string {
  if (toolSlug.includes("video") || toolSlug.includes("clip") || toolSlug.includes("motion")) return "Video AI";
  if (toolSlug.includes("background") || toolSlug.includes("eraser") || toolSlug.includes("enhancer") || toolSlug.includes("unblur") || toolSlug.includes("correction") || toolSlug.includes("restoration") || toolSlug.includes("prompt")) {
    return "AI Photo Edit";
  }
  return "Photo AI";
}

function fallbackToolBlockForSlug(toolSlug: string): SectionBlockInstance | undefined {
  if (!dreamshootImageStudioToolAliases.has(toolSlug)) return undefined;
  const title = titleFromToolSlug(toolSlug);
  return {
    id: `fallback_tool_${toolSlug}`,
    type: "tool_card",
    settings: {
      title,
      category: categoryForToolSlug(toolSlug),
      href: `/tools/${toolSlug}`,
      description: `${title} opens a dedicated photo workflow with the selected tool preset ready for private generation.`
    }
  };
}

function baseToolDetailPageForSite(site: Site, page?: Site["pages"][number]): Site["pages"][number] {
  const existingToolPage = page ?? site.pages.find((item) => item.pageType === "ai_tool") ?? site.pages.find((item) => item.slug === "/tools/image-studio");
  if (existingToolPage) return existingToolPage;
  const template = clonePageJson(dreamshootAiStudioTemplates["tool-detail"]);
  return {
    id: `${site.id}_synthetic_tool_detail`,
    siteId: site.id,
    pageType: "ai_tool",
    templateKey: "tool-detail",
    slug: "/tools/image-studio",
    title: "AI tool",
    draftJson: template,
    publishedJson: template
  };
}

function synthesizeToolDetailPage(basePage: ThemePageJson, tool: SectionBlockInstance, toolSlug: string, appSlug: string): ThemePageJson {
  const page = clonePageJson(basePage);
  const title = blockString(tool, "title", sectionSetting(page, "entry_1", "title", "AI photo tool"));
  const description = blockString(tool, "description", sectionSetting(page, "entry_1", "subtitle", "Upload a photo, choose the tool preset, and continue in the private studio."));
  const category = blockString(tool, "category", "AI Photo");
  const imageUrl = blockString(tool, "imageUrl", sectionSetting(page, "entry_1", "imageUrl"));
  const dashboardHref = `/dashboard?tool_id=${encodeURIComponent(toolSlug)}`;
  if (page.sections.tool_banner_1) {
    page.sections.tool_banner_1.settings = {
      ...page.sections.tool_banner_1.settings,
      eyebrow: category,
      title,
      subtitle: description,
      imageUrl
    };
  }
  if (page.sections.entry_1) {
    page.sections.entry_1.settings = {
      ...page.sections.entry_1.settings,
      aiAppSlug: appSlug,
      eyebrow: category,
      title,
      subtitle: description,
      ctaLabel: "Open editor",
      ctaHref: dashboardHref,
      imageUrl,
      toolSlug
    };
  }
  if (page.sections.form_1) {
    page.sections.form_1.settings = {
      ...page.sections.form_1.settings,
      aiAppSlug: appSlug,
      eyebrow: category,
      title: `${title} editor`,
      helper: "This editor opens with the selected tool preset locked for the current request.",
      toolSlug
    };
  }
  return page;
}

const dreamshootImageStudioToolAliases = new Set([
  "headshot-generator",
  "headshot-maker",
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
  "ai-image-studio",
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
  "album-story-video",
  "hairstyle-preview",
  "wedding-portraits",
  "indian-wedding",
  "christmas-photos",
  "virtual-try-on",
  "package-preview"
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
  const toolBlock = toolBlocksFromTheme(site).find((block) => toolSlugFromBlock(block) === normalizedToolSlug) ?? fallbackToolBlockForSlug(normalizedToolSlug);
  const basePage = baseToolDetailPageForSite(site, page);
  const synthesizedPage = toolBlock ? synthesizeToolDetailPage(basePage.publishedJson, toolBlock, normalizedToolSlug, appSlugForToolCategory(blockString(toolBlock, "category", "AI Photo"), siteAiApps)) : undefined;
  const matched = Boolean(page || directApp || legacyImageApp || toolBlock || aliasMap.has(toolSlug) || aliasMap.has(directPageSlug) || aliasMap.has(normalizedToolSlug));
  return { siteAiApps, page: synthesizedPage ? { ...basePage, slug: normalizedPageSlug, title: blockString(toolBlock!, "title", basePage.title), publishedJson: synthesizedPage } : basePage, app, matched, resolvedSlug };
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
  const state = await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const directPage = getPage(currentSite, slug);
  const page = directPage.slug === slug ? directPage : currentSite.pages.find((item) => item.slug === "/404") ?? directPage;
  const settings = currentSite.themeSettings.publishedJson;
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const pageJson = slug === "/account"
    ? withAccountDashboardPage(page.publishedJson)
    : slug === "/collections" && typeof query.category === "string" && query.category
    ? withSeoDirectorySection(page.publishedJson, "collection", query.category)
    : page.publishedJson;
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
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  const profile = slug === "/account" ? "account" : slug === "/app" ? "workspace" : "full";
  const state = (await getStateForCustomerRuntimeRender(site, sessionId, providedState, profile)) ?? await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const current = await getCurrentCustomerSession(state, currentSite.id, sessionId);
  if (!current) redirect(routeMode === "host" ? "/login" : `/site/${currentSite.slug}/login`);

  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const page = getPage(currentSite, slug);
  const settings = currentSite.themeSettings.publishedJson;
  const runtime = trimCustomerRuntimeForWorkspace(getCustomerRuntimeFromState(state, currentSite.id, current.customer, true), slug);

  const pageJson = slug === "/account"
    ? withAccountDashboardPage(page.publishedJson)
    : slug === "/app"
    ? withCustomerWorkspaceFlowPage(page.publishedJson)
    : page.publishedJson;

  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: slug,
    query,
    renderData,
    routeMode,
    runtime,
    settings
  });
}

export async function renderCustomerWorkspacePageBySlug({
  siteSlug,
  slug,
  query = {},
  routeMode = "path"
}: {
  siteSlug: string;
  slug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
}) {
  const canonicalSlug = canonicalSiteSlug(siteSlug);
  const routeSlug = publicSiteSlug(canonicalSlug);
  if (slug === "/account" || slug === "/app") {
    const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(canonicalSlug, slug) ?? await readStorefrontPlatformState();
    const currentSite = state.sites.find((item) => item.slug === canonicalSlug);
    if (!currentSite) notFound();
    const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
    if (!sessionId) redirect(routeMode === "host" ? "/login" : `/site/${routeSlug}/login`);
    const current = await getCustomerBySessionRelational({ siteId: currentSite.id, sessionId });
    if (!current) redirect(routeMode === "host" ? "/login" : `/site/${routeSlug}/login`);

    const renderData = getSiteRenderData(state, currentSite.id);
    currentSite.mediaAssets = renderData.mediaAssets;
    const page = getPage(currentSite, slug);
    const settings = currentSite.themeSettings.publishedJson;
    const runtime = runtimeWithEmptyCollections({ customer: current.customer });

    const pageJson = slug === "/account"
      ? withAccountDashboardPage(page.publishedJson)
      : withCustomerWorkspaceFlowPage(page.publishedJson);

    return renderThemePage({
      currentSite,
      page: pageJson,
      pagePath: slug,
      query,
      renderData,
      routeMode,
      runtime,
      settings
    });
  }

  const siteId = await getSiteIdBySlugRelational(canonicalSlug);
  if (!siteId) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  if (!sessionId) redirect(routeMode === "host" ? "/login" : `/site/${routeSlug}/login`);

  const profile = slug === "/account" ? "account" : slug === "/app" ? "workspace" : "full";
  const state = await readStorefrontCustomerRuntimeStateForSiteFromDatabase({ siteId, sessionId, profile });
  if (!state) redirect(routeMode === "host" ? "/login" : `/site/${routeSlug}/login`);
  const currentSite = state.sites.find((item) => item.id === siteId);
  if (!currentSite) notFound();
  const current = await getCurrentCustomerSession(state, currentSite.id, sessionId);
  if (!current) redirect(routeMode === "host" ? "/login" : `/site/${routeSlug}/login`);

  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const page = getPage(currentSite, slug);
  const settings = currentSite.themeSettings.publishedJson;
  const runtime = trimCustomerRuntimeForWorkspace(getCustomerRuntimeFromState(state, currentSite.id, current.customer, true), slug);

  const pageJson = slug === "/account"
    ? withAccountDashboardPage(page.publishedJson)
    : slug === "/app"
    ? withCustomerWorkspaceFlowPage(page.publishedJson)
    : page.publishedJson;

  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: slug,
    query,
    renderData,
    routeMode,
    runtime,
    settings
  });
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
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  const state = (await getStateForCustomerRuntimeRender(site, sessionId, providedState)) ?? await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const current = await getCurrentCustomerSession(state, currentSite.id, sessionId);
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

  return renderThemePage({
    currentSite,
    page: page.publishedJson,
    pagePath: `/app/jobs/${job.id}`,
    query,
    renderData,
    routeMode,
    runtime,
    settings
  });
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
  const state = await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const { page, matched } = resolveToolPageForSite(state, currentSite, toolSlug, renderData.siteAiApps, renderData.creativePacks);
  if (!matched) notFound();
  const settings = currentSite.themeSettings.publishedJson;
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const runtime = sessionId && pageNeedsFullCustomerRuntime(page.publishedJson, page.slug)
    ? await getFullCustomerRuntime(state, currentSite.id, sessionId)
    : await getLightCustomerRuntime(state, currentSite.id, sessionId);
  const pageJson = withSeoDirectorySection(page.publishedJson, "tool", toolSlug);
  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: page.slug,
    query,
    renderData,
    routeMode,
    runtime,
    settings
  });
}
