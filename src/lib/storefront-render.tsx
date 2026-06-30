import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { CustomerAccountClientPage, CustomerWorkspaceClientPage } from "@/components/storefront/customer-bootstrap-client";
import { ThemeRenderer } from "@/components/theme-renderer";
import { findPage, getPage } from "@/lib/data";
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
  readStorefrontPublicRuntimeStateForSiteFromDatabase,
  readStorefrontRuntimeStateForSiteFromDatabase
} from "@/lib/storefront-state";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { getCustomerWorkspaceBootstrapRelational, getCustomerWorkspaceSiteShellRelational, getSiteIdBySlugRelational, getStorefrontPublicCreativePacksForSite } from "@/lib/stores/site-store";
import { themeStyleVars } from "@/lib/theme";
import { canonicalSiteSlug, publicSiteSlug } from "@/lib/domain-routing";
import { canonicalAidreamcapesDirectorySlug, getExplicitSeoDirectorySlugsForSite, getSeoDirectoryContentForSite, isExplicitSeoDirectoryContentForSite, withSeoDirectorySection } from "@/lib/dreamshoot-seo-content";
import { buildCollectionDirectoryJsonLd, buildStorefrontJsonLd, buildToolDirectoryJsonLd, type JsonLdNode } from "@/lib/theme/json-ld";
import { dreamshootAiStudioTemplates } from "@/lib/theme/packages/dreamshoot-ai-studio";
import type { CustomerSession, PlatformState, PublicCustomer, SectionBlockInstance, Site, ThemePage, ThemePageJson, ThemeRuntimeData, ToolMenuItem } from "@/lib/types";

const jobDetailSlug = "/app/jobs/detail";
const dreamshootPartnerTemplateSlugs = new Set(["/creators-circle", "/partner-registration", "/about-us", "/contact-us"]);

type SiteRenderData = {
  creativePacks: ReturnType<typeof getSiteCreativePacksFromState>;
  mediaAssets: ReturnType<typeof getSiteMediaAssetsFromState>;
  products: ReturnType<typeof getSiteProductsFromState>;
  siteAiApps: ReturnType<typeof getSiteAppsFromState>;
  toolMenuItems: PlatformState["toolMenuItems"];
};

function getSiteRenderData(state: PlatformState, siteId: string): SiteRenderData {
  return {
    creativePacks: getSiteCreativePacksFromState(state, siteId),
    mediaAssets: getSiteMediaAssetsFromState(state, siteId),
    products: getSiteProductsFromState(state, siteId),
    siteAiApps: getSiteAppsFromState(state, siteId),
    toolMenuItems: state.toolMenuItems.filter((item) => item.siteId === siteId)
  };
}

function emptySiteRenderData(): SiteRenderData {
  return {
    creativePacks: [],
    mediaAssets: [],
    products: [],
    siteAiApps: [],
    toolMenuItems: []
  };
}

function trimToolDetailRenderData(renderData: SiteRenderData): SiteRenderData {
  return {
    creativePacks: renderData.creativePacks.slice(0, 12).map((pack) => ({
      ...pack,
      prompt: undefined,
      galleryImages: []
    })),
    mediaAssets: [],
    products: [],
    siteAiApps: renderData.siteAiApps.slice(0, 8).map((siteApp) => ({
      ...siteApp,
      providerConfig: undefined,
      workflowConfig: undefined,
      aiApp: {
        ...siteApp.aiApp,
        parameterSchema: []
      }
    })),
    toolMenuItems: renderData.toolMenuItems.slice(0, 24)
  };
}

const productSectionTypes = new Set(["cart_summary", "pricing_table", "product_detail", "products", "products_plus", "search_results"]);
const siteAiAppSectionTypes = new Set(["ai_tool_entry", "ai_tool_grid", "aidreamcapes_tool_collection", "generation_form", "search_results"]);
const creativePackSectionTypes = new Set(["aidreamcapes_package_catalog", "aidreamcapes_package_taxonomy", "collection_list_plus", "dreamshoot_package_catalog", "dreamshoot_package_taxonomy", "photo_package_wall", "products", "products_plus", "search_results"]);

function pageSectionTypes(pageJson: ThemePageJson): Set<string> {
  return new Set(pageJson.sectionsOrder.map((sectionId) => pageJson.sections[sectionId]?.type).filter((type): type is string => Boolean(type)));
}

function trimCreativePacksForStorefront(renderData: SiteRenderData, limit: number): SiteRenderData["creativePacks"] {
  return renderData.creativePacks.slice(0, limit).map((pack) => ({
    ...pack,
    prompt: undefined,
    galleryImages: []
  }));
}

async function completePublicCreativePacksForSite(site: Site, existing: SiteRenderData["creativePacks"], limit: number): Promise<SiteRenderData["creativePacks"]> {
  const sanitizedExisting = existing.map((pack) => ({
    ...pack,
    prompt: undefined,
    galleryImages: []
  }));
  try {
    const fullState = await readStorefrontPlatformState();
    const canonicalSlug = publicSiteSlug(site.slug);
    const siteIdentity = `${site.slug} ${site.name} ${site.branding.logoText}`.toLowerCase();
    const fullSite = fullState.sites.find((item) => {
      const itemIdentity = `${item.slug} ${item.name} ${item.branding.logoText}`.toLowerCase();
      return (
        item.id === site.id ||
        publicSiteSlug(item.slug) === canonicalSlug ||
        (siteIdentity.includes("aidreamcapes") && itemIdentity.includes("aidreamcapes")) ||
        (siteIdentity.includes("mydreamshoots") && itemIdentity.includes("mydreamshoots"))
      );
    });
    if (!fullSite) return sanitizedExisting;
    const fullPacks = getSiteCreativePacksFromState(fullState, fullSite.id)
      .filter((pack) => pack.status === "active")
      .slice(0, limit)
      .map((pack) => ({
        ...pack,
        prompt: undefined,
        galleryImages: []
      }));
    return fullPacks.length > sanitizedExisting.length ? fullPacks : sanitizedExisting;
  } catch {
    return sanitizedExisting;
  }
}

function trimSiteAiAppsForStorefront(renderData: SiteRenderData, limit = 12): SiteRenderData["siteAiApps"] {
  return renderData.siteAiApps.slice(0, limit).map((siteApp) => ({
    ...siteApp,
    providerConfig: undefined,
    workflowConfig: undefined,
    aiApp: {
      ...siteApp.aiApp,
      parameterSchema: []
    }
  }));
}

function trimProductsForStorefront(renderData: SiteRenderData, limit = 8): SiteRenderData["products"] {
  const active = renderData.products.filter((product) => product.status === "active");
  return (active.length ? active : renderData.products).slice(0, limit);
}

function trimRenderDataForPage(renderData: SiteRenderData, pageJson: ThemePageJson, slug: string): SiteRenderData {
  const sectionTypes = pageSectionTypes(pageJson);
  const needsProducts = slug === "/pricing" || slug === "/cart" || Array.from(sectionTypes).some((type) => productSectionTypes.has(type));
  const needsSiteAiApps = slug === "/tools" || slug.startsWith("/tools/") || Array.from(sectionTypes).some((type) => siteAiAppSectionTypes.has(type));
  const needsCreativePacks = slug === "/" || slug === "/collections" || slug === "/tools" || Array.from(sectionTypes).some((type) => creativePackSectionTypes.has(type));
  const packLimit = slug === "/" || slug === "/collections" ? 48 : 18;
  return {
    creativePacks: needsCreativePacks ? trimCreativePacksForStorefront(renderData, packLimit) : [],
    mediaAssets: renderData.mediaAssets,
    products: needsProducts ? trimProductsForStorefront(renderData, slug === "/pricing" || slug === "/cart" ? 12 : 6) : [],
    siteAiApps: needsSiteAiApps ? trimSiteAiAppsForStorefront(renderData) : [],
    toolMenuItems: renderData.toolMenuItems.slice(0, 80)
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
  return runtimeWithEmptyCollections();
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
      ctaLabel: "Upload photos",
      ctaHref: "/app/upload",
      chipList: "Profile|Plan and credits|Orders|Albums and progress"
    },
    blocks: [
      { id: "account_uploads", type: "feature" as const, settings: { title: "Upload photos", description: "Add source portraits and style references before requesting images.", meta: "Assets", href: "/app/upload" } },
      { id: "account_create", type: "feature" as const, settings: { title: "Create AI images", description: "Choose prompts and reserve credits for a private generation request.", meta: "Generate", href: "/app/create" } },
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
        ctaHref: pageJson.sections.launcher_1?.settings?.ctaHref ?? "/app/create"
      },
      blocks: [
        { id: "feature_prepare", type: "feature", settings: { title: "Choose a tool", description: "Pick the photo workflow first, then attach the source photos it needs.", meta: "Tool first", href: "/app/create" } },
        { id: "feature_upload", type: "feature", settings: { title: "Upload photos", description: "Add private source portraits and references for this account.", meta: "Private intake", href: "/app/upload" } },
        { id: "feature_progress", type: "feature", settings: { title: "Track progress", description: "Review queued, running, delivered, and review-needed requests.", meta: "Live progress", href: "/app/jobs/progress" } },
        { id: "feature_album", type: "feature", settings: { title: "Download albums", description: "Open delivered images and private gallery downloads for this account.", meta: "Private delivery", href: "/album" } }
      ]
    },
    form_1: pageJson.sections.form_1 ?? {
      type: "generation_form" as const,
      settings: {
        aiAppSlug: "image_generator",
        title: "Choose a photo tool",
        helper: "Pick a photo tool first. Then upload the source photos it asks for and start your private result.",
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

function normalizePublicSlug(value: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  return decoded
    .trim()
    .toLowerCase()
    .replace(/^\/?(collections|tools)\//, "")
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

function toolBlockFromMenuItem(item: ToolMenuItem): SectionBlockInstance {
  const parent = item.category?.parent;
  const category = parent?.label || item.category?.label || "AI Tools";
  const categoryDescription = parent?.description || item.category?.description || "";
  const categoryIcon = parent?.icon || parent?.iconName || item.category?.icon || item.category?.iconName || "";
  return {
    id: `tool_menu_${item.id}`,
    type: "tool_card",
    settings: {
      title: item.title,
      description: item.description ?? "",
      category,
      categoryTitle: category,
      categoryDescription,
      categoryIcon,
      badge: item.category?.parent ? item.category.label : item.badge ?? item.category?.label ?? "Tool",
      icon: item.icon ?? item.category?.icon ?? item.category?.iconName ?? parent?.icon ?? parent?.iconName ?? "",
      imageUrl: item.imageUrl ?? "",
      href: item.href || `/tools/${item.slug}`,
      ...(item.detailJson ? { detailJson: item.detailJson } : {})
    }
  };
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
    "background-changer": "Background Changer",
    "background-remover": "Image Background Remover",
    "magic-eraser": "Magic Eraser",
    "photo-enhancer": "Photo Enhancer",
    "unblur-image": "Unblur Image",
    "color-correction": "Color Correction",
    "old-photo-restoration": "Old Photo Restoration",
    "edit-by-prompt": "Photo Edit by Prompt",
    "headshot-generator": "Headshot Photo Generator",
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
      description: customerToolIntro(toolSlug, title)
    }
  };
}

function aidreamcapesToolBlockForSlug(site: Site, toolSlug: string): SectionBlockInstance {
  const content = getSeoDirectoryContentForSite(site, "tool", toolSlug);
  const category = toolSlug.includes("avatar") ? "Fantasy Portrait Tools" :
    toolSlug.includes("product") || toolSlug.includes("social") ? "Creator Story Tools" :
    "Dreamscape Portrait Tools";
  return {
    id: `aidreamcapes_tool_${toolSlug}`,
    type: "tool_card",
    settings: {
      title: content.label,
      description: content.intro,
      category,
      categoryTitle: category,
      categoryDescription: "Site-maintained Aidreamcapes tools for private portrait galleries.",
      badge: "Aidreamcapes",
      href: `/tools/${toolSlug}`
    }
  };
}

function creativePackCollectionSlugs(pack: PlatformState["creativePacks"][number]): string[] {
  return [
    pack.categoryRecord?.slug,
    pack.categoryRecord?.parent?.slug,
    pack.category,
    pack.name
  ].map((value) => value ? normalizePublicSlug(value) : "").filter(Boolean);
}

export function canResolveCollectionSlugForSite(state: PlatformState, site: Site, collectionSlug: string): boolean {
  const normalized = normalizePublicSlug(collectionSlug);
  if (!normalized) return false;
  if (isExplicitSeoDirectoryContentForSite(site, "collection", normalized)) return true;
  const canonicalSlug = canonicalAidreamcapesDirectorySlug("collection", normalized);
  return state.creativePacks.some((pack) => pack.siteId === site.id && pack.status === "active" && creativePackCollectionSlugs(pack).includes(canonicalSlug));
}

const workspaceOnlyToolSectionTypes = new Set(["upload_panel", "generation_form", "job_progress", "album_gallery"]);

function safeSectionId(page: ThemePageJson, preferredId: string): string {
  if (!page.sections[preferredId]) return preferredId;
  let next = 2;
  while (page.sections[`${preferredId}_${next}`]) next += 1;
  return `${preferredId}_${next}`;
}

type CustomerToolCopy = {
  intro: string;
  primaryCta: string;
  guideTitle: string;
  guideBody: string;
  inputTitle: string;
  inputDescription: string;
  styleTitle: string;
  styleDescription: string;
  outputTitle: string;
  outputDescription: string;
  useCaseOneTitle: string;
  useCaseOneDescription: string;
  useCaseTwoTitle: string;
  useCaseTwoDescription: string;
  detailBody: string;
};

function customerToolIntro(toolSlug: string, title: string): string {
  const copy = customerToolCopy(toolSlug, title, categoryForToolSlug(toolSlug));
  return copy.intro;
}

function customerToolCopy(toolSlug: string, title: string, category: string): CustomerToolCopy {
  const fallback: CustomerToolCopy = {
    intro: `Use ${title} to turn your own uploads into a private, ready-to-download photo set with clear guidance before you start.`,
    primaryCta: "Start this photo set",
    guideTitle: `Plan your ${title.toLowerCase()} set`,
    guideBody: `Start with the right upload, choose the result you want, then review the private output before your next edit or download.`,
    inputTitle: "Upload the right source photos",
    inputDescription: `Choose clear portraits, product photos, or references that match the ${category.toLowerCase()} result you want.`,
    styleTitle: "Choose the result you need",
    styleDescription: "Pick the look, use case, or visual direction before you continue, so the editor starts with the right intent.",
    outputTitle: "Download a private result",
    outputDescription: "Your finished images stay in your account, where you can review, download, and keep the best options.",
    useCaseOneTitle: "Profile and creator updates",
    useCaseOneDescription: `${title} helps refresh profile photos, creator visuals, campaign images, and social-ready assets from everyday uploads.`,
    useCaseTwoTitle: "Clear next step",
    useCaseTwoDescription: "Start with your source photos, review the credit cost, then create the photo set when you are ready.",
    detailBody: `Use ${title} when you already know the outcome you want. Upload clear source material, choose the visual direction, and continue with the finished result in your private account.`
  };
  const overrides: Record<string, Partial<CustomerToolCopy>> = {
    headshot: {
      intro: "Upload selfies or casual portraits and create a profile-ready headshot set for LinkedIn, resumes, founder pages, and team bios.",
      primaryCta: "Create profile headshots",
      guideTitle: "Create headshots from everyday selfies",
      guideBody: "Upload varied face photos, choose a professional look, then review polished headshot options before downloading your favorites.",
      inputTitle: "Upload varied face photos",
      inputDescription: "Use clear selfies with different angles, simple lighting, and natural expressions for more realistic business portraits.",
      styleTitle: "Choose a professional look",
      styleDescription: "Aim for clean studio lighting, founder portraits, resume photos, or team-page images before you create.",
      outputTitle: "Download profile-ready options",
      outputDescription: "Review several polished headshots in your private account and choose the best images for professional channels.",
      useCaseOneTitle: "LinkedIn, resumes, and bios",
      useCaseOneDescription: "Create a trustworthy profile image without booking a studio session.",
      useCaseTwoTitle: "Team-ready portraits",
      useCaseTwoDescription: "Upload each person's best source photos, generate consistent options, and choose matching portraits for the team page.",
      detailBody: "The headshot maker turns everyday uploads into a private set of professional portraits. Use it when the next step is a LinkedIn update, resume refresh, founder bio, or team directory."
    },
    "headshot-generator": {
      primaryCta: "Create profile headshots"
    },
    "background-changer": {
      intro: "Replace a distracting background with a cleaner setting before you order portraits, product shots, or social images.",
      primaryCta: "Change my background",
      guideTitle: "Clean up the scene behind your subject",
      guideBody: "Upload a clear subject photo, choose a cleaner setting, then save the edited image or use it as better source material for a larger set.",
      inputTitle: "Upload a clear subject photo",
      inputDescription: "Use an image where the person, product, or object is easy to see and separated from the background.",
      styleTitle: "Choose the new setting",
      styleDescription: "Move from cluttered rooms to clean studio, lifestyle, travel, or brand-friendly backgrounds.",
      outputTitle: "Save a cleaner image",
      outputDescription: "Use the edited image for profiles, listings, campaign drafts, or as stronger source material for a full photo set.",
      useCaseOneTitle: "Better portraits and listings",
      useCaseOneDescription: "Remove visual noise before creating a profile image, product visual, or creator post.",
      useCaseTwoTitle: "Fast source-photo repair",
      useCaseTwoDescription: "Fix the background first when the subject is good but the setting is not.",
      detailBody: "Background changer is for photos where the subject works but the scene gets in the way. Upload the image, replace the setting, then continue with a cleaner asset for profiles, listings, posts, or photo packages."
    },
    "image-to-video": {
      intro: "Turn a strong still image into a short video concept for creator intros, product teasers, social clips, and campaign previews.",
      primaryCta: "Create a video concept",
      guideTitle: "Plan motion from a still image",
      guideBody: "Upload one finished image, choose the motion idea, then review a private short clip before downloading or planning the next video package.",
      inputTitle: "Upload one strong image",
      inputDescription: "Start with a sharp portrait, product shot, or scene that already has the look you want to animate.",
      styleTitle: "Choose the motion idea",
      styleDescription: "Think about camera movement, mood, pacing, and where the short video clip will be used before creating.",
      outputTitle: "Review a private video draft",
      outputDescription: "Use the video output as a social clip, intro concept, product teaser, or creative direction for a larger motion set.",
      useCaseOneTitle: "Social and creator clips",
      useCaseOneDescription: "Give a finished image enough movement for short-form posts and profile intros.",
      useCaseTwoTitle: "Campaign previews",
      useCaseTwoDescription: "Test motion, pacing, and mood before investing in a larger video package.",
      detailBody: "Image to video starts with a still image and returns a private short clip with motion. Use it when the next step is video output for a post, profile intro, teaser, or campaign preview."
    },
    "background-remover": {
      primaryCta: "Remove my background",
      intro: "Cut out a subject from a busy image and prepare a cleaner asset for profile photos, product visuals, and creative edits."
    },
    "photo-enhancer": {
      primaryCta: "Enhance my photo",
      intro: "Improve dark, soft, or low-detail source photos before using them for portraits, packages, or social-ready images."
    },
    "anime-avatar": {
      primaryCta: "Create an anime avatar",
      intro: "Turn source portraits into anime-inspired avatars for profiles, creator identities, and playful social images."
    },
    "cyberpunk-portrait": {
      primaryCta: "Create a neon portrait",
      intro: "Transform a clean portrait into a cinematic neon city image for avatars, campaigns, and high-impact social posts."
    }
  };
  return { ...fallback, ...(overrides[toolSlug] ?? {}) };
}

function toolDetailGuideBlocks(copy: CustomerToolCopy): SectionBlockInstance[] {
  return [
    {
      id: "tool_detail_input",
      type: "rich_text_card",
      settings: {
        meta: "01",
        title: copy.inputTitle,
        description: copy.inputDescription
      }
    },
    {
      id: "tool_detail_preset",
      type: "rich_text_card",
      settings: {
        meta: "02",
        title: copy.styleTitle,
        description: copy.styleDescription
      }
    },
    {
      id: "tool_detail_delivery",
      type: "rich_text_card",
      settings: {
        meta: "03",
        title: copy.outputTitle,
        description: copy.outputDescription
      }
    }
  ];
}

function toolDetailUseCaseBlocks(copy: CustomerToolCopy): SectionBlockInstance[] {
  return [
    {
      id: "tool_detail_use_case_1",
      type: "rich_text_card",
      settings: {
        meta: "Best for",
        title: copy.useCaseOneTitle,
        description: copy.useCaseOneDescription
      }
    },
    {
      id: "tool_detail_use_case_2",
      type: "rich_text_card",
      settings: {
        meta: "Next step",
        title: copy.useCaseTwoTitle,
        description: copy.useCaseTwoDescription
      }
    }
  ];
}

const dreamshootToolDirectorySlugs = [
  "background-changer",
  "background-remover",
  "magic-eraser",
  "photo-enhancer",
  "unblur-image",
  "color-correction",
  "old-photo-restoration",
  "edit-by-prompt",
  "headshot-generator",
  "wedding-portraits",
  "anime-avatar",
  "gala-photo",
  "cyberpunk-portrait",
  "image-to-video",
  "profile-clip",
  "creator-intro-video"
];

const fallbackToolDirectoryBlocks = cache((): SectionBlockInstance[] =>
  dreamshootToolDirectorySlugs.map((slug) => fallbackToolBlockForSlug(slug)).filter((block): block is SectionBlockInstance => Boolean(block))
);

function withDreamShootToolsDirectoryPage(pageJson: ThemePageJson, site: Site): ThemePageJson {
  const blocks = toolBlocksFromTheme(site);
  const toolsBySlug = new Map<string, SectionBlockInstance>();
  const isAidreamcapes = isAidreamcapesStorefront(site);
  if (isAidreamcapes) {
    for (const slug of getExplicitSeoDirectorySlugsForSite(site, "tool")) {
      toolsBySlug.set(slug, aidreamcapesToolBlockForSlug(site, slug));
    }
  } else {
    for (const block of fallbackToolDirectoryBlocks()) {
      toolsBySlug.set(toolSlugFromBlock(block), block);
    }
  }
  for (const block of blocks) {
    const slug = toolSlugFromBlock(block);
    toolsBySlug.set(slug, block);
  }
  const tools = Array.from(toolsBySlug.values());
  return {
    ...pageJson,
    sectionsOrder: ["tools_directory_1"],
    sections: {
      tools_directory_1: {
        type: "dreamshoot_tool_collection",
        settings: {
          anchor: "tools",
          title: isAidreamcapes ? "Aidreamcapes studio tools" : "AI Tools Collection",
          subtitle: isAidreamcapes
            ? "Choose a focused Aidreamcapes tool for destination portraits, city breaks, coastal light, adventure routes, private travel albums, and postcard-ready story sets."
            : "Discover paid AI tools for photo generation, background editing, video concepts, and private album workflows. Every tool has its own page and opens the editor with the correct preset.",
          categories: isAidreamcapes ? "Destination Tools|Travel Moment Tools|Adventure Tools|Creator Travel Tools" : "Photo AI|AI Photo Edit|Video AI",
          layout: "directory"
        },
        blocks: tools
      }
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

function isAidreamcapesStorefront(site: Pick<Site, "id" | "slug" | "name" | "primaryDomain"> & { branding: Pick<Site["branding"], "logoText"> }): boolean {
  return `${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`.toLowerCase().includes("aidreamcapes");
}

function aidreamcapesToolFaqBlocks(label: string, workflow: string[]): SectionBlockInstance[] {
  return [
    {
      id: "faq_inputs",
      type: "faq_item",
      settings: {
        question: `What should I upload for ${label}?`,
        answer: workflow[1] ?? "Upload clear source portraits or references that match the dreamscape direction you want."
      }
    },
    {
      id: "faq_private",
      type: "faq_item",
      settings: {
        question: "Are Aidreamcapes results private?",
        answer: "Yes. Source photos, photo sets, credit records, and finished galleries stay connected to the signed-in customer account."
      }
    },
    {
      id: "faq_credits",
      type: "faq_item",
      settings: {
        question: "When are credits used?",
        answer: "Credits are shown before a request starts, reserved for generation, consumed after successful delivery, and released when a request fails."
      }
    }
  ];
}

function detailText(detail: ToolMenuItem["detailJson"] | undefined, key: keyof NonNullable<ToolMenuItem["detailJson"]>, fallback: string): string {
  const value = detail?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function detailList(detail: ToolMenuItem["detailJson"] | undefined, key: "useCases" | "workflow", fallback: string[]): string[] {
  const value = detail?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : fallback;
}

function synthesizeToolDetailPage(basePage: ThemePageJson, tool: SectionBlockInstance, toolSlug: string, appSlug: string, site: Site): ThemePageJson {
  const page = clonePageJson(basePage);
  const title = blockString(tool, "title", sectionSetting(page, "entry_1", "title", "AI photo tool"));
  const category = blockString(tool, "category", "AI Photo");
  const copy = customerToolCopy(toolSlug, title, category);
  const detail = tool.settings.detailJson && typeof tool.settings.detailJson === "object" && !Array.isArray(tool.settings.detailJson)
    ? tool.settings.detailJson as ToolMenuItem["detailJson"]
    : undefined;
  const aidreamcapes = isAidreamcapesStorefront(site);
  const directoryContent = getSeoDirectoryContentForSite(site, "tool", toolSlug);
  const effectiveTitle = detailText(detail, "title", aidreamcapes ? directoryContent.label : title);
  const effectiveDescription = detailText(detail, "subtitle", aidreamcapes ? directoryContent.intro : blockString(tool, "description", sectionSetting(page, "entry_1", "subtitle", copy.intro)));
  const effectiveCta = detailText(detail, "ctaLabel", aidreamcapes ? directoryContent.ctaLabel : copy.primaryCta);
  const guideTitle = detailText(detail, "guideTitle", aidreamcapes ? directoryContent.h3[0] ?? copy.guideTitle : copy.guideTitle);
  const guideBody = detailText(detail, "guideBody", aidreamcapes ? directoryContent.workflow.join(" ") : copy.guideBody);
  const detailTitle = detailText(detail, "detailTitle", aidreamcapes ? `How ${directoryContent.label} fits Aidreamcapes` : `What ${title} is used for`);
  const detailBody = detailText(detail, "detailBody", aidreamcapes ? directoryContent.details.join(" ") : copy.detailBody);
  const workflowItems = detailList(detail, "workflow", aidreamcapes ? directoryContent.workflow : []);
  const useCaseItems = detailList(detail, "useCases", aidreamcapes ? directoryContent.useCases : [copy.useCaseOneDescription, copy.useCaseTwoDescription]);
  const description = blockString(tool, "description", sectionSetting(page, "entry_1", "subtitle", copy.intro));
  const imageUrl = blockString(tool, "imageUrl", sectionSetting(page, "entry_1", "imageUrl"));
  const appCreateHref = `/app/create?tool_id=${encodeURIComponent(toolSlug)}`;
  const keptSectionIds = page.sectionsOrder.filter((sectionId) => {
    const type = page.sections[sectionId]?.type;
    return type && !workspaceOnlyToolSectionTypes.has(type);
  });
  page.sectionsOrder = keptSectionIds;
  for (const [sectionId, section] of Object.entries(page.sections)) {
    if (workspaceOnlyToolSectionTypes.has(section.type)) {
      delete page.sections[sectionId];
    }
  }
  if (page.sections.tool_banner_1) {
    page.sections.tool_banner_1.settings = {
      ...page.sections.tool_banner_1.settings,
      eyebrow: category,
      title: effectiveTitle,
      subtitle: effectiveDescription,
      imageUrl
    };
  }
  if (page.sections.entry_1) {
    page.sections.entry_1.settings = {
      ...page.sections.entry_1.settings,
      aiAppSlug: appSlug,
      eyebrow: detailText(detail, "eyebrow", category),
      title: effectiveTitle,
      subtitle: effectiveDescription,
      ctaLabel: effectiveCta,
      ctaHref: appCreateHref,
      imageUrl,
      toolSlug
    };
  }
  const guideSectionId = safeSectionId(page, "tool_detail_guide_1");
  const useCaseSectionId = safeSectionId(page, "tool_detail_use_cases_1");
  page.sections[guideSectionId] = {
    type: "rich_text",
    settings: {
      eyebrow: category,
      title: guideTitle,
      body: guideBody,
      primaryCta: effectiveCta,
      primaryHref: appCreateHref,
      secondaryCta: "Choose a plan",
      secondaryHref: "/pricing",
      layout: "compact"
    },
    blocks: workflowItems.length
      ? workflowItems.slice(0, 3).map((description, index) => ({
          id: `tool_detail_step_${index + 1}`,
          type: "rich_text_card",
          settings: { meta: `0${index + 1}`, title: directoryContent.h3[index] ?? `Step ${index + 1}`, description }
        }))
      : toolDetailGuideBlocks(copy)
  };
  page.sections[useCaseSectionId] = {
    type: "rich_text",
    settings: {
      eyebrow: "Tool details",
      title: detailTitle,
      body: detailBody,
      layout: "compact",
      tone: "dark"
    },
    blocks: useCaseItems.length
      ? useCaseItems.slice(0, 4).map((description, index) => ({
          id: `tool_detail_use_case_${index + 1}`,
          type: "rich_text_card",
          settings: { meta: index === 0 ? "Best for" : "Use case", title: description, description }
        }))
      : toolDetailUseCaseBlocks(copy)
  };
  if (aidreamcapes && page.sections.faq_1) {
    page.sections.faq_1.settings = {
      ...page.sections.faq_1.settings,
      eyebrow: "Aidreamcapes tool questions",
      title: `${directoryContent.label} FAQ`,
      subtitle: "Answers about source photos, credits, private galleries, and delivery before you generate."
    };
    page.sections.faq_1.blocks = aidreamcapesToolFaqBlocks(directoryContent.label, directoryContent.workflow);
  }
  const insertAfterEntry = page.sectionsOrder.includes("entry_1") ? page.sectionsOrder.indexOf("entry_1") + 1 : page.sectionsOrder.length;
  page.sectionsOrder.splice(insertAfterEntry, 0, guideSectionId, useCaseSectionId);
  return page;
}

const dreamshootImageStudioToolAliases = new Set([
  "headshot-generator",
  "headshot-maker",
  "professional-headshot",
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

const aidreamcapesToolAliases = new Map<string, string>([
  ["portrait-generator", "route-portrait-engine"],
  ["portrait-maker", "route-portrait-engine"],
  ["dreamscape-generator", "route-portrait-engine"],
  ["image-studio", "route-portrait-engine"],
  ["image-generator", "route-portrait-engine"],
  ["headshot", "route-portrait-engine"],
  ["couple-escape-album", "shared-route-album"]
]);

export function resolveToolPageForSite(state: PlatformState, site: Site, toolSlug: string, siteAiApps = getSiteAppsFromState(state, site.id), creativePacks = getSiteCreativePacksFromState(state, site.id)) {
  const normalizedToolSlug = normalizeToolLookup(toolSlug);
  const isAidreamcapes = isAidreamcapesStorefront(site);
  const aidreamcapesAliasTarget = isAidreamcapes ? aidreamcapesToolAliases.get(normalizedToolSlug) : undefined;
  const canonicalToolSlug = aidreamcapesAliasTarget ?? normalizedToolSlug;
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
  if (isAidreamcapes) {
    for (const [alias, target] of aidreamcapesToolAliases) {
      aliasMap.set(alias, `/tools/${target}`);
      aliasMap.set(`/tools/${alias}`, `/tools/${target}`);
      aliasMap.set(normalizeToolLookup(alias), `/tools/${target}`);
    }
  }
  const explicitAidreamcapesToolSlug = isAidreamcapes && getExplicitSeoDirectorySlugsForSite(site, "tool").includes(canonicalToolSlug);

  const directApp = siteAiApps.find((siteApp) => normalizeToolLookup(siteApp.aiApp.slug) === canonicalToolSlug);
  const legacyImageApp = canonicalToolSlug === "image-studio" || canonicalToolSlug === "image-generator"
    ? siteAiApps.find((siteApp) => siteApp.aiApp.slug === "image_generator")
    : undefined;
  const resolvedSlug = aliasMap.get(toolSlug) ?? aliasMap.get(directPageSlug) ?? aliasMap.get(normalizedToolSlug) ?? normalizedPageSlug;
  const page = site.pages.find((item) => item.slug === resolvedSlug);
  const app = directApp ?? legacyImageApp ?? (page?.slug === "/tools/image-studio" ? siteAiApps.find((siteApp) => siteApp.aiApp.slug === "image_generator") : undefined);
  const menuTool = state.toolMenuItems.find((item) => {
    if (item.siteId !== site.id || item.status !== "active") return false;
    const hrefSlug = normalizeToolLookup(item.href.replace(/^\/tools\//, ""));
    const itemSlug = normalizeToolLookup(item.slug);
    return hrefSlug === normalizedToolSlug || hrefSlug === canonicalToolSlug || itemSlug === normalizedToolSlug || itemSlug === canonicalToolSlug;
  });
  const themeToolBlock = toolBlocksFromTheme(site).find((block) => {
    const blockSlug = toolSlugFromBlock(block);
    return blockSlug === normalizedToolSlug || blockSlug === canonicalToolSlug;
  });
  const toolBlock = menuTool
    ? toolBlockFromMenuItem(menuTool)
    : themeToolBlock ?? (explicitAidreamcapesToolSlug ? aidreamcapesToolBlockForSlug(site, canonicalToolSlug) : isAidreamcapes ? undefined : fallbackToolBlockForSlug(canonicalToolSlug));
  const basePage = baseToolDetailPageForSite(site, page);
  const synthesizedPage = toolBlock
    ? synthesizeToolDetailPage(
        basePage.publishedJson,
        toolBlock,
        canonicalToolSlug,
        appSlugForToolCategory(blockString(toolBlock, "category", "AI Photo"), siteAiApps),
        site,
      )
    : undefined;
  const matched = isAidreamcapes
    ? !aidreamcapesAliasTarget && Boolean(page || directApp || menuTool || themeToolBlock || explicitAidreamcapesToolSlug)
    : Boolean(page || directApp || legacyImageApp || toolBlock || aliasMap.has(toolSlug) || aliasMap.has(directPageSlug) || aliasMap.has(normalizedToolSlug));
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
  settings,
  jsonLd,
  lightweightChrome = false
}: {
  currentSite: Site;
  page: ThemePageJson;
  pagePath: string;
  query: Record<string, string | string[] | undefined>;
  renderData: SiteRenderData;
  routeMode: "host" | "path";
  runtime: ThemeRuntimeData;
  settings: Site["themeSettings"]["publishedJson"];
  jsonLd?: JsonLdNode[];
  lightweightChrome?: boolean;
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
        toolMenuItems={renderData.toolMenuItems}
        jsonLd={jsonLd}
        lightweightChrome={lightweightChrome}
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
  const collectionCategory = typeof query.category === "string" ? query.category : "";
  const isFocusedCollectionPage = slug === "/collections" && Boolean(collectionCategory);
  const renderData = getSiteRenderData(state, currentSite.id);
  currentSite.mediaAssets = renderData.mediaAssets;
  const directPage = findPage(currentSite, slug) ?? syntheticDreamShootPartnerPage(currentSite, slug);
  if (!directPage) notFound();
  const page = directPage;
  if (isFocusedCollectionPage) {
    currentSite.pages = currentSite.pages.filter((item) => item.slug === slug || item.slug === "/404");
  }
  const settings = currentSite.themeSettings.publishedJson;
  const sessionId = (await cookies()).get(customerSessionCookie(currentSite.id))?.value;
  const usesDreamShootToolsDirectory =
    slug === "/tools" &&
    (/dreamshoot/i.test(`${currentSite.slug} ${currentSite.name} ${currentSite.branding.logoText}`) || isAidreamcapesStorefront(currentSite));
  const pageJson = slug === "/account"
    ? withAccountDashboardPage(page.publishedJson)
    : usesDreamShootToolsDirectory
    ? withDreamShootToolsDirectoryPage(page.publishedJson, currentSite)
    : isFocusedCollectionPage
    ? withSeoDirectorySection(page.publishedJson, "collection", collectionCategory, { focused: true, site: currentSite })
    : page.publishedJson;
  let pageRenderData = trimRenderDataForPage(renderData, pageJson, slug);
  if (slug === "/" || slug === "/collections") {
    pageRenderData = {
      ...pageRenderData,
      creativePacks: await completePublicCreativePacksForSite(currentSite, pageRenderData.creativePacks, 48)
    };
  }
  if ((slug === "/" || slug === "/collections") && !pageRenderData.creativePacks.length) {
    pageRenderData = {
      ...pageRenderData,
      creativePacks: (await getStorefrontPublicCreativePacksForSite(currentSite.id, 48)).map((pack) => ({
        ...pack,
        prompt: undefined,
        galleryImages: []
      }))
    };
  }
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
    pagePath: slug,
    query,
    renderData: pageRenderData,
    routeMode,
    runtime: runtimeWithAuth,
    settings,
    jsonLd: isFocusedCollectionPage
      ? buildCollectionDirectoryJsonLd({
          site: currentSite,
          collectionSlug: collectionCategory,
          routeMode,
          creativePacks: pageRenderData.creativePacks
        })
      : buildStorefrontJsonLd({
          site: currentSite,
          page,
          pageJson,
          pagePath: slug,
          routeMode,
          creativePacks: pageRenderData.creativePacks
        }),
    lightweightChrome: false
  });
}

function syntheticDreamShootPartnerPage(site: Site, slug: string): ThemePage | undefined {
  if (!dreamshootPartnerTemplateSlugs.has(slug)) return undefined;
  if (!(/dreamshoot/i.test(`${site.slug} ${site.name} ${site.branding.logoText}`) || isAidreamcapesStorefront(site))) return undefined;
  const templateKey =
    slug === "/partner-registration" ? "partner-registration" :
    slug === "/about-us" ? "about-us" :
    slug === "/contact-us" ? "contact-us" :
    "creators-circle";
  const pageJson = dreamshootAiStudioTemplates[templateKey];
  return {
    id: `${site.id}_${templateKey}_synthetic`,
    siteId: site.id,
    pageType: pageJson.pageType,
    templateKey,
    slug,
    title:
      templateKey === "partner-registration" ? "Partner Registration" :
      templateKey === "about-us" ? "About Us" :
      templateKey === "contact-us" ? "Contact Us" :
      "Creators Circle",
    draftJson: pageJson,
    publishedJson: pageJson
  };
}

export async function renderStorefrontLoginPage({
  site,
  query = {},
  routeMode = "path",
  state: providedState
}: {
  site: Site;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
}) {
  const state = await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const page = getPage(currentSite, "/login");
  currentSite.mediaAssets = [];

  return renderThemePage({
    currentSite,
    page: page.publishedJson,
    pagePath: "/login",
    query,
    renderData: emptySiteRenderData(),
    routeMode,
    runtime: runtimeWithEmptyCollections({
      auth: getDefaultCustomerAuth(state, currentSite.id, typeof query.error === "string" ? query.error : undefined)
    }),
    settings: currentSite.themeSettings.publishedJson,
    lightweightChrome: false
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
  const pageRenderData = trimRenderDataForPage(renderData, pageJson, slug);

  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: slug,
    query,
    renderData: pageRenderData,
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
  const loginPath = routeMode === "host" ? "/login" : `/site/${routeSlug}/login`;
  const workspacePath = routeMode === "host" ? slug : `/site/${routeSlug}${slug}`;
  const queryString = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => {
      if (typeof value === "string") return [[key, value]];
      if (Array.isArray(value)) return value.map((item) => [key, item]);
      return [];
    })
  ).toString();
  const loginPathWithNext = `${loginPath}?next=${encodeURIComponent(`${workspacePath}${queryString ? `?${queryString}` : ""}`)}`;
  const isWorkspaceRoute = slug === "/app" || slug.startsWith("/app/");
  const initialWorkspacePanel = slug === "/app/upload" ? "upload" : "create";
  if (slug === "/account") {
    const siteId = await getSiteIdBySlugRelational(canonicalSlug);
    if (!siteId) notFound();
    const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
    if (!sessionId) redirect(loginPathWithNext);
    const [current, site] = await Promise.all([
      getCustomerBySessionRelational({ siteId, sessionId }),
      getCustomerWorkspaceSiteShellRelational(canonicalSlug)
    ]);
    if (!current || !site) redirect(loginPathWithNext);
    return <CustomerAccountClientPage initialCustomer={current.customer} initialSite={site} siteSlug={routeSlug} />;
  }

  if (isWorkspaceRoute) {
    const siteId = await getSiteIdBySlugRelational(canonicalSlug);
    if (!siteId) notFound();
    const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
    if (!sessionId) redirect(loginPathWithNext);
    const [current, bootstrap] = await Promise.all([
      getCustomerBySessionRelational({ siteId, sessionId }),
      getCustomerWorkspaceBootstrapRelational(canonicalSlug)
    ]);
    if (!current || !bootstrap) redirect(loginPathWithNext);
    return (
      <CustomerWorkspaceClientPage
        initialBootstrap={{ ...bootstrap, customer: current.customer }}
        initialCreativePackId={typeof query.pack === "string" ? query.pack : undefined}
        initialPanel={initialWorkspacePanel}
        initialToolId={typeof query.tool_id === "string" ? query.tool_id : undefined}
        siteSlug={routeSlug}
      />
    );
  }

  const siteId = await getSiteIdBySlugRelational(canonicalSlug);
  if (!siteId) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  if (!sessionId) redirect(loginPathWithNext);

  const profile = slug === "/account" ? "account" : slug === "/app" ? "workspace" : "full";
  const state = await readStorefrontCustomerRuntimeStateForSiteFromDatabase({ siteId, sessionId, profile });
  if (!state) redirect(loginPathWithNext);
  const currentSite = state.sites.find((item) => item.id === siteId);
  if (!currentSite) notFound();
  const current = await getCurrentCustomerSession(state, currentSite.id, sessionId);
  if (!current) redirect(loginPathWithNext);

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
  const pageRenderData = trimRenderDataForPage(renderData, pageJson, slug);

  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: slug,
    query,
    renderData: pageRenderData,
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
    renderData: trimRenderDataForPage(renderData, page.publishedJson, `/app/jobs/${job.id}`),
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
  state: providedState,
  resolvedPage
}: {
  site: Site;
  toolSlug: string;
  query?: Record<string, string | string[] | undefined>;
  routeMode?: "host" | "path";
  state?: PlatformState;
  resolvedPage?: ThemePage;
}) {
  const state = await getStateForStorefrontRender(site, routeMode, providedState);
  const currentSite = state.sites.find((item) => item.id === site.id);
  if (!currentSite) notFound();
  const renderData = getSiteRenderData(state, currentSite.id);
  const resolved = resolvedPage
    ? { page: resolvedPage, matched: true }
    : resolveToolPageForSite(state, currentSite, toolSlug, renderData.siteAiApps, renderData.creativePacks);
  const { page, matched } = resolved;
  if (!matched) notFound();
  const toolRenderData = trimToolDetailRenderData(renderData);
  currentSite.mediaAssets = toolRenderData.mediaAssets;
  const settings = currentSite.themeSettings.publishedJson;
  const pageJson = withSeoDirectorySection(page.publishedJson, "tool", toolSlug, { site: currentSite });
  const pageRenderData = trimRenderDataForPage(toolRenderData, pageJson, page.slug);
  return renderThemePage({
    currentSite,
    page: pageJson,
    pagePath: page.slug,
    query,
    renderData: pageRenderData,
    routeMode,
    runtime: runtimeWithEmptyCollections(),
    settings,
    jsonLd: buildToolDirectoryJsonLd({
      site: currentSite,
      toolSlug,
      routeMode
    })
  });
}
