"use client";

import { type DragEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Menu, PanelBottom, PanelTop, SearchCheck } from "lucide-react";
import { PreviewFrame } from "@/components/designer/preview-frame";
import {
  type DesignerDragToken,
  readDesignerDragToken,
  sectionDropPosition,
  writeDesignerDragToken
} from "@/components/designer/designer-drag-protocol";
import {
  type PreviewMode,
  type PreviewViewportPreset,
  type IframePatchPayload,
  type IframeDesignerMessage,
  previewSectionIdForSelection,
  selectionForEditorTab,
  selectionFromPreviewMessage,
  syncSelectionToPreview
} from "@/components/designer/designer-preview-protocol";
import {
  blockDisplayLabel,
  categoryLabel,
  fieldDisplayLabel,
  globalNodeBlueprints,
  labelForSchema,
  pageOptionLabel,
  pageTypeLabel,
  saasPresetCategoryOrder,
  schemaBlockCount,
  schemaMetaLine,
  templateDisplayName
} from "@/components/designer/designer-metadata";
import { DesignerWorkspacePane } from "@/components/designer/designer-workspace-pane";
import {
  type DesignerCopyLocatorItem,
  type DesignerCopyLocatorQuickTarget
} from "@/components/designer/designer-copy-locator";
import { DesignerWorkbenchTutorial } from "@/components/designer/designer-workbench-tutorial";
import {
  createGlobalTreeProps,
  createPageTreeProps,
  createSectionTreeProps
} from "@/components/designer/designer-workspace-bindings";
import {
  addGlobalBlock as appendGlobalBlock,
  addPageBlock,
  duplicatePageSection,
  insertPageSection,
  moveGlobalBlock as moveGlobalBlockInSettings,
  movePageBlock,
  movePageSection,
  removeGlobalBlock,
  removePageBlock,
  removePageSection,
  reorderGlobalBlock as reorderGlobalBlockInSettings,
  reorderPageBlock,
  reorderPageSection,
  updateGlobalBlockSetting as updateGlobalBlockSettingInSettings,
  updateGlobalSectionSetting,
  updatePageBlockSetting,
  updatePageSectionSetting
} from "@/components/designer/designer-draft-operations";
import {
  publishThemePageDraft,
  resetThemeDraftFromActive,
  saveAllThemePageDrafts,
  saveThemePageDraft,
  saveThemeSettingsDraft
} from "@/components/designer/designer-theme-persistence";
import {
  updateThemeColorValue,
  updateThemeLinksValue,
  updateThemeRadiiValue,
  updateThemeSettingFromSaasField,
  updateThemeTypographyValue
} from "@/components/designer/designer-theme-operations";
import {
  clonePage,
  cloneSettings,
  instanceKey,
  normalizeGlobalSections,
  resolveBlockSchemaFromSchemas,
  safeBlocks,
  selectionSummary,
  settingLinkString
} from "@/components/designer/designer-theme-utils";
import {
  resolvePageTemplateName,
  sendXfcartAction
} from "@/components/designer/designer-xfcart-bridge";
import {
  type DesignerDragState,
  type GlobalLocalField,
  type Selection
} from "@/components/designer/designer-types";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import {
  groupFieldsByIds
} from "@/components/designer/designer-types";
import { parseFieldValue } from "@/components/designer/field-editor-registry";
import type { DesignerResourceKind, DesignerResourceStatus, FieldOptions } from "@/components/designer/field-editor-types";
import type { DesignerToolbarMenuOption } from "@/components/designer/designer-toolbar-primitives";
import {
  aiSubscriptionSectionSchemas,
  defaultBlock,
  defaultSection,
  getSectionSchema,
  readThemeFieldValue,
  sectionSchemas
} from "@/lib/section-schema";
import { buildSaasThemeDraft } from "@/lib/theme/saas-theme-model";
import { getThemePackages, themePackageTemplateToPageJson, type ThemePackageSiteSettings, type ThemePackageTemplateKey } from "@/lib/theme/registry";
import {
  getImportedSaasSectionSchemasForTheme,
  getImportedSaasSettingsGroupsForTheme
} from "@/lib/theme/saas-theme-package";
import type {
  CreativePack,
  MediaAsset,
  Product,
  SectionBlockInstance,
  SectionInstance,
  SectionType,
  Site,
  SiteAiApp,
  ThemeBlockSchema,
  ThemeDraftMeta,
  ThemeFieldSchema,
  ThemePage,
  ThemePageJson,
  ThemeSectionSchema,
  ThemeSettingValue,
  ThemeSettings
} from "@/lib/types";
import type { SaasThemeAction } from "@/lib/server-store";
import type { DesignerWorkspaceTab } from "@/components/designer/designer-workspace-pane";

type XfcartVersionResult = {
  pageDraftVersions?: Record<string, ThemeDraftMeta>;
  settingsDraftVersion?: ThemeDraftMeta;
};

type QueuedXfcartAction = {
  action: SaasThemeAction;
  fallbackMessage: string;
  sequence: number;
};

type QueuedXfcartActionRecord = {
  inflight: boolean;
  pending?: QueuedXfcartAction;
  promise?: Promise<XfcartVersionResult | undefined>;
  timerId?: number;
};

type XfcartMutationContext = {
  pages: ThemePage[];
  drafts: Record<string, ThemePageJson>;
  selectedPageId: string;
  draft: ThemePageJson;
  themeSettings: ThemeSettings;
  themeId: string;
  themeKey: string;
  previewMode: PreviewMode;
};

function templatePackageKeyForPage(page: ThemePage, templateName: string): ThemePackageTemplateKey | undefined {
  const normalizedTemplate = templateName.replace(/\.liquid$/, "");
  const byPageType: Record<string, ThemePackageTemplateKey> = {
    home: "home",
    pricing: "pricing",
    ai_tool: "tool-detail",
    collection: "packages",
    package_detail: "package-detail",
    login: "login",
    workspace: "app-home",
    job_progress: "job-progress",
    job_detail: "job-detail",
    album: "album",
    account: "account-billing",
    policy: "policy",
    help: "help",
    blog: "blog-list",
    article: "blog-detail",
    search: "search",
    cart: "cart",
    "404": "404"
  };
  const byTemplate: Record<string, ThemePackageTemplateKey> = {
    index: "home",
    product: "tool-detail",
    collection: "packages",
    "package-detail": "package-detail",
    page: page.pageType === "pricing" ? "pricing" : "policy",
    login: "login",
    "app-home": "app-home",
    "job-progress": "job-progress",
    "job-detail": "job-detail",
    album: "album",
    "account-billing": "account-billing",
    privacy: "policy",
    refunds: "policy",
    content: "policy",
    help: "help",
    blog: "blog-list",
    "blog-detail": "blog-detail",
    search: "search",
    cart: "cart",
    "404": "404"
  };
  return byPageType[page.pageType] ?? byTemplate[normalizedTemplate];
}

function specializeTemplateForPage(page: ThemePage, pageJson: ThemePageJson, packageKey?: string): ThemePageJson {
  const nextPage = clonePage(pageJson);
  if (page.pageType !== "policy") return nextPage;

  const pageIdentity = `${page.templateKey ?? ""} ${page.slug} ${page.title}`.toLowerCase();
  const policyContentSectionId = nextPage.sectionsOrder.find((sectionId) => nextPage.sections[sectionId]?.type === "policy_content");
  if (!policyContentSectionId) return nextPage;

  const weddingProfiles: Record<string, { title: string; body: string }> = {
    privacy: {
      title: "Privacy policy",
      body: "<p>Couple uploads, wedding source files, generation jobs, generated albums, orders, subscriptions, and credit history entries remain scoped to this storefront and customer account.</p>"
    },
    refunds: {
      title: "Refunds policy",
      body: "<p>Refunds and billing reversals are recorded as site-scoped payment events and credit history adjustments. Checkout completion never grants credits before the webhook is fulfilled.</p>"
    },
    content: {
      title: "Content policy",
      body: "<p>Customers may upload only wedding, couple, venue, wardrobe, and inspiration assets they have permission to use. Private album delivery remains restricted to the signed-in customer.</p>"
    }
  };
  const genericProfiles: Record<string, { title: string; body: string }> = {
    privacy: {
      title: "Privacy policy",
      body: "<p>Customer uploads, source files, AI jobs, generated albums, orders, subscriptions, and credit history entries remain scoped to this storefront and customer account.</p>"
    },
    refunds: {
      title: "Refunds policy",
      body: "<p>Refunds and billing reversals are recorded as site-scoped payment events and credit history adjustments. Checkout completion never grants credits before the webhook is fulfilled.</p>"
    },
    content: {
      title: "Content policy",
      body: "<p>Customers may upload only portraits, event photos, brand references, wardrobe, venue, and inspiration assets they have permission to use. Private album delivery remains restricted to the signed-in customer.</p>"
    }
  };
  const dreamshootProfiles: Record<string, { title: string; body: string }> = {
    privacy: {
      title: "Privacy policy",
      body: "<p>Uploads, source files, AI jobs, generated albums, orders, subscriptions, and credit history entries remain scoped to this storefront and customer account.</p>"
    },
    refunds: {
      title: "Refunds policy",
      body: "<p>Refunds and billing reversals are recorded as site-scoped payment events and credit history adjustments. Checkout completion never grants credits before the webhook is fulfilled.</p>"
    },
    content: {
      title: "Content policy",
      body: "<p>Customers may upload only portraits, lifestyle photos, wardrobe references, and inspiration assets they have permission to use. Private album delivery remains restricted to the signed-in customer.</p>"
    }
  };
  const profiles = packageKey === "wedding-story-house" ? weddingProfiles : packageKey === "dreamshoot-ai-studio" ? dreamshootProfiles : genericProfiles;

  const policyKey: keyof typeof profiles | undefined = pageIdentity.includes("refund")
    ? "refunds"
    : pageIdentity.includes("content")
      ? "content"
      : pageIdentity.includes("privacy")
        ? "privacy"
        : undefined;
  if (!policyKey) return nextPage;

  nextPage.sections[policyContentSectionId] = {
    ...nextPage.sections[policyContentSectionId],
    settings: {
      ...nextPage.sections[policyContentSectionId].settings,
      ...profiles[policyKey]
    }
  };
  return nextPage;
}

function cloneDesignerJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stripLocatorText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function locatorTextFromValue(value: ThemeSettingValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return stripLocatorText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(locatorTextFromValue).filter(Boolean).join(" / ");
  const record = value as Record<string, ThemeSettingValue>;
  const prioritized = ["label", "title", "headline", "name", "text", "description", "href", "url"];
  const direct = prioritized.map((key) => locatorTextFromValue(record[key])).find(Boolean);
  if (direct) return direct;
  return Object.values(record).map(locatorTextFromValue).filter(Boolean).join(" / ");
}

function shouldIndexField(field: ThemeFieldSchema) {
  return !["image_picker", "media_asset", "video_url", "color", "range", "font_picker"].includes(field.type);
}

function applyThemePackageSettingsToDraftSettings(base: ThemeSettings, siteSettings?: ThemePackageSiteSettings): ThemeSettings {
  const next = normalizeGlobalSections(cloneSettings(base));
  const packageSettings = siteSettings?.themeSettings;
  if (!packageSettings) return next;

  if (packageSettings.colors) next.colors = { ...next.colors, ...packageSettings.colors };
  if (packageSettings.typography) next.typography = { ...next.typography, ...packageSettings.typography };
  if (packageSettings.radii) next.radii = { ...next.radii, ...packageSettings.radii };
  if (packageSettings.navigation?.headerLinks) next.navigation.headerLinks = cloneDesignerJson(packageSettings.navigation.headerLinks);
  if (packageSettings.navigation?.footerLinks) next.navigation.footerLinks = cloneDesignerJson(packageSettings.navigation.footerLinks);

  next.globalSections ??= {
    header: defaultSection("header"),
    footer: defaultSection("footer")
  };
  next.globalSections.header ??= defaultSection("header");
  next.globalSections.footer ??= defaultSection("footer");
  if (packageSettings.globalSections?.header) {
    next.globalSections.header = {
      ...next.globalSections.header,
      settings: {
        ...(next.globalSections.header?.settings ?? {}),
        ...(packageSettings.globalSections.header.settings ?? {})
      },
      blocks: packageSettings.globalSections.header.blocks
        ? cloneDesignerJson(packageSettings.globalSections.header.blocks) as SectionBlockInstance[]
        : next.globalSections.header?.blocks
    };
  }
  if (packageSettings.globalSections?.footer) {
    next.globalSections.footer = {
      ...next.globalSections.footer,
      settings: {
        ...(next.globalSections.footer?.settings ?? {}),
        ...(packageSettings.globalSections.footer.settings ?? {})
      },
      blocks: packageSettings.globalSections.footer.blocks
        ? cloneDesignerJson(packageSettings.globalSections.footer.blocks) as SectionBlockInstance[]
        : next.globalSections.footer?.blocks
    };
  }

  if (packageSettings.seo) {
    next.seo = {
      siteTitle: packageSettings.seo.siteTitle ?? next.seo?.siteTitle ?? "",
      siteDescription: packageSettings.seo.siteDescription ?? next.seo?.siteDescription ?? "",
      titleTemplate: packageSettings.seo.titleTemplate ?? next.seo?.titleTemplate ?? "",
      defaultOgImage: packageSettings.seo.defaultOgImage ?? next.seo?.defaultOgImage,
      robots: next.seo?.robots ?? { index: true, follow: true },
      pages: next.seo?.pages ?? {}
    };
  }

  if (packageSettings.saasSettingsCurrent) {
    next.saasSettingsCurrent = {
      ...(next.saasSettingsCurrent ?? {}),
      ...(cloneDesignerJson(packageSettings.saasSettingsCurrent) as ThemeSettings["saasSettingsCurrent"])
    };
  }

  return normalizeGlobalSections(next);
}

export type DesignerClientProps = {
  site: Site;
  pages: ThemePage[];
  products?: Product[];
  siteAiApps?: SiteAiApp[];
  creativePacks?: CreativePack[];
  mediaAssets?: MediaAsset[];
  previewToken: string;
  publicationCount?: number;
  initialPageId?: string;
  initialThemeKey?: string;
  activeThemeName: string;
  activeThemeKey: string;
  draftThemeName: string;
  draftThemeKey: string;
  toolbarLeading?: ReactNode;
  toolbarTrailing?: ReactNode;
};

type DesignerResourcePayload = {
  kind?: DesignerResourceKind;
  products?: Product[];
  siteAiApps?: SiteAiApp[];
  creativePacks?: CreativePack[];
  mediaAssets?: MediaAsset[];
  error?: string;
};

export function DesignerClient({
  site,
  pages,
  products: initialProducts = [],
  siteAiApps: initialSiteAiApps = [],
  creativePacks: initialCreativePacks = [],
  mediaAssets: initialMediaAssets = [],
  previewToken,
  publicationCount = 0,
  initialPageId,
  initialThemeKey = "theme1",
  activeThemeName,
  activeThemeKey,
  draftThemeName,
  draftThemeKey,
  toolbarLeading,
  toolbarTrailing
}: DesignerClientProps) {
  function expansionStateForPage(page?: ThemePageJson, preferredSectionId?: string) {
    const firstSectionId = preferredSectionId || page?.sectionsOrder[0] || "";
    return Object.fromEntries((page?.sectionsOrder ?? []).map((sectionId) => [sectionId, sectionId === firstSectionId]));
  }

  const initialPage = pages.find((page) => page.id === initialPageId) ?? pages[0];
  const [selectedPageId, setSelectedPageId] = useState(initialPage.id);
  const [selection, setSelection] = useState<Selection>(() => ({ kind: "section", sectionId: initialPage.draftJson.sectionsOrder[0] ?? "" }));
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewViewportPreset, setPreviewViewportPreset] = useState<PreviewViewportPreset>("desktop-1440");
  const [activeTab, setActiveTab] = useState<DesignerWorkspaceTab>("templates");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("edit");
  const [iframeReloadKey, setIframeReloadKey] = useState(0);
  const [iframeStatus, setIframeStatus] = useState<"loading" | "ready" | "recovering" | "failed">("loading");
  const iframeRecoveryCount = useRef(0);
  const activeDragTokenRef = useRef<DesignerDragToken | null>(null);
  const sectionPointerSourceRef = useRef<string | null>(null);
  const sectionDragTargetRef = useRef<{ targetId: string; position: "before" | "after" } | null>(null);
  const currentThemeKey = draftThemeKey || activeThemeKey || initialThemeKey;
  const selectedInitialThemeKey = currentThemeKey === "ai_subscription_theme1" ? "theme1" : currentThemeKey;
  const activeIndustryThemeKey = activeThemeKey || draftThemeKey || initialThemeKey;
  const [selectedSaasThemeKey] = useState(selectedInitialThemeKey);
  const [dragState, setDragState] = useState<DesignerDragState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ThemePageJson>>(
    Object.fromEntries(pages.map((page) => [page.id, clonePage(page.draftJson)]))
  );
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(normalizeGlobalSections(cloneSettings(site.themeSettings.draftJson)));
  const [draftVersions, setDraftVersions] = useState<Record<string, ThemeDraftMeta>>(
    Object.fromEntries(pages.flatMap((page) => page.draftMeta ? [[page.id, page.draftMeta] as const] : []))
  );
  const [themeSettingsDraftVersion, setThemeSettingsDraftVersion] = useState<ThemeDraftMeta | undefined>(site.themeSettings.draftMeta);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [locatorBreadcrumb, setLocatorBreadcrumb] = useState<string | undefined>(undefined);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    expansionStateForPage(initialPage?.draftJson, initialPage?.draftJson.sectionsOrder[0])
  );
  const [expandedGlobals, setExpandedGlobals] = useState<Record<"header" | "footer", boolean>>({ header: false, footer: false });
  const [publishedVersion, setPublishedVersion] = useState(() => Math.max(1, ...pages.map((page) => page.publishedJson.version ?? 0)));
  const [lastAction, setLastAction] = useState("已载入当前页面草稿，可继续编辑并按需发布。");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mutationBusyRef = useRef(false);
  const previewMutationQueuesRef = useRef(new Map<string, QueuedXfcartActionRecord>());
  const previewMutationSequenceRef = useRef(0);
  const xfcartContextRef = useRef<XfcartMutationContext | null>(null);
  const dirtyPageIdsRef = useRef<Set<string>>(new Set());
  const themeSettingsDirtyRef = useRef(false);
  const previewSelectionLockUntilRef = useRef(0);
  const [publishedPages, setPublishedPages] = useState<Record<string, ThemePageJson>>(
    Object.fromEntries(pages.map((page) => [page.id, clonePage(page.publishedJson)]))
  );
  const [publishedThemeSettings, setPublishedThemeSettings] = useState<ThemeSettings>(() =>
    normalizeGlobalSections(cloneSettings(site.themeSettings.publishedJson))
  );
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [siteAiApps, setSiteAiApps] = useState<SiteAiApp[]>(initialSiteAiApps);
  const [creativePacks, setCreativePacks] = useState<CreativePack[]>(initialCreativePacks);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(initialMediaAssets);
  const [resourceStatus, setResourceStatus] = useState<Record<DesignerResourceKind, DesignerResourceStatus>>({
    products: initialProducts.length ? "ready" : "idle",
    siteAiApps: initialSiteAiApps.length ? "ready" : "idle",
    creativePacks: initialCreativePacks.length ? "ready" : "idle",
    mediaAssets: initialMediaAssets.length ? "ready" : "idle"
  });
  const resourceStatusRef = useRef(resourceStatus);
  const inflightResourceRef = useRef<Partial<Record<DesignerResourceKind, boolean>>>({});
  useEffect(() => {
    resourceStatusRef.current = resourceStatus;
  }, [resourceStatus]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyOverscrollBehavior: body.style.overscrollBehavior
    };
    html.style.overflow = "hidden";
    html.style.height = "100%";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.height = "100%";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.height = previous.htmlHeight;
      html.style.overscrollBehavior = previous.htmlOverscrollBehavior;
      body.style.overflow = previous.bodyOverflow;
      body.style.height = previous.bodyHeight;
      body.style.overscrollBehavior = previous.bodyOverscrollBehavior;
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(max-width: 640px)").matches) {
      setDevice("mobile");
      setPreviewMode("edit");
    }
  }, []);

  useEffect(() => {
    setDraftVersions(Object.fromEntries(pages.flatMap((page) => (page.draftMeta ? [[page.id, page.draftMeta] as const] : []))));
    setThemeSettingsDraftVersion(site.themeSettings.draftMeta);
    setPublishedVersion(Math.max(1, ...pages.map((page) => page.publishedJson.version ?? 0)));
  }, [pages, site.themeSettings.draftMeta]);

  const activePage = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  const draft = drafts[selectedPageId];
  const livePage = publishedPages[selectedPageId] ?? activePage.publishedJson;

  const loadDesignerResource = useCallback(async (kind: DesignerResourceKind, options?: { signal?: AbortSignal }) => {
    const currentStatus = resourceStatusRef.current[kind];
    if (currentStatus === "ready" || currentStatus === "loading" || inflightResourceRef.current[kind]) return;
    inflightResourceRef.current[kind] = true;
    setResourceStatus((current) => current[kind] === "ready" || current[kind] === "loading" ? current : { ...current, [kind]: "loading" });
    try {
      const response = await fetchAdminJson<DesignerResourcePayload>(`/api/sites/${site.id}/admin/design-resources?kind=${kind}`, {
        init: { signal: options?.signal },
        ttlMs: 15_000
      });
      if (!response.ok) {
        setResourceStatus((current) => ({ ...current, [kind]: "error" }));
        setLastAction(response.data.error ?? "装修器资源加载失败，编辑器已先载入页面草稿。");
        return;
      }
      if (kind === "products") setProducts(response.data.products ?? []);
      if (kind === "siteAiApps") setSiteAiApps(response.data.siteAiApps ?? []);
      if (kind === "creativePacks") setCreativePacks(response.data.creativePacks ?? []);
      if (kind === "mediaAssets") setMediaAssets(response.data.mediaAssets ?? []);
      setResourceStatus((current) => ({ ...current, [kind]: "ready" }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setResourceStatus((current) => current[kind] === "loading" ? { ...current, [kind]: "idle" } : current);
        return;
      }
      setResourceStatus((current) => ({ ...current, [kind]: "error" }));
      setLastAction(error instanceof Error ? error.message : "装修器资源加载失败，编辑器已先载入页面草稿。");
    } finally {
      inflightResourceRef.current[kind] = false;
    }
  }, [site.id]);

  const fieldOptions = useMemo<FieldOptions>(() => ({
    pages,
    products,
    siteAiApps,
    mediaAssets,
    creativePacks,
    requestResource: loadDesignerResource,
    resourceStatus
  }), [pages, products, siteAiApps, mediaAssets, creativePacks, loadDesignerResource, resourceStatus]);
  const saasSettingsGroups = useMemo(() => getImportedSaasSettingsGroupsForTheme(selectedSaasThemeKey), [selectedSaasThemeKey]);
  const flattenedSaasFields = useMemo(() => saasSettingsGroups.flatMap((group) => group.fields), [saasSettingsGroups]);
  const globalNodes = useMemo(() => {
    return globalNodeBlueprints.filter((node) => {
      if (node.kind === "globalSection") return true;
      if (node.localFields?.length) return true;
      if (!node.fieldIds?.length) return false;
      return groupFieldsByIds(flattenedSaasFields, node.fieldIds).length > 0;
    });
  }, [flattenedSaasFields]);
  const sectionList = useMemo(
    () => draft.sectionsOrder.map((id) => ({ id, section: draft.sections[id] })).filter((item) => item.section),
    [draft]
  );
  const selectedSectionId = selection.kind === "section" || selection.kind === "block" ? selection.sectionId : "";
  const activeSectionId = selectedSectionId && draft.sections[selectedSectionId] ? selectedSectionId : sectionList[0]?.id;
  const activeGlobalNode = selection.kind === "globalSettings" ? globalNodes.find((node) => node.id === selection.node) : undefined;
  const activeSection =
    selection.kind === "global"
      ? themeSettings.globalSections?.[selection.globalType]
      : selection.kind === "globalBlock"
      ? themeSettings.globalSections?.[selection.globalType]
      : selection.kind === "globalSettings"
      ? undefined
      : activeSectionId
      ? draft.sections[activeSectionId]
      : undefined;
  const selectedSaasSectionSchemas = useMemo(() => getImportedSaasSectionSchemasForTheme(selectedSaasThemeKey), [selectedSaasThemeKey]);
  const activeBlock = selection.kind === "block" && activeSection ? safeBlocks(activeSection).find((block) => block.id === selection.blockId) : undefined;
  const activeGlobalBlock = selection.kind === "globalBlock" && activeSection ? safeBlocks(activeSection).find((block) => block.id === selection.blockId) : undefined;
  const activeGlobalNodeFields = useMemo(
    () => (activeGlobalNode?.fieldIds?.length ? groupFieldsByIds(flattenedSaasFields, activeGlobalNode.fieldIds) : []),
    [activeGlobalNode, flattenedSaasFields]
  );
  const selectionMeta = selectionSummary(selection, activeSection, activeBlock, activeGlobalBlock, activeGlobalNode);
  const saasDraft = useMemo(
    () => buildSaasThemeDraft(
      { ...site, pages: pages.map((page) => ({ ...page, draftJson: drafts[page.id] ?? page.draftJson })), themeSettings: { ...site.themeSettings, draftJson: themeSettings } },
      selectedSaasThemeKey
    ),
    [site, pages, drafts, themeSettings, selectedSaasThemeKey]
  );
  const schemaGroups = useMemo(() => {
    const featuredDreamShootTypes: SectionType[] = [
      "hero",
      "brand_logo_strip",
      "sample_strip",
      "luxury_highlight",
      "destination_showcase",
      "example_gallery",
      "story_mosaic",
      "video_feature",
      "mobile_video_showcase",
      "photo_package_wall",
      "occasion_showcase",
      "dreamshoot_feature_tabs",
      "studio_steps",
      "pricing_table",
      "trust_signal_bar",
      "conversion_panel",
      "final_cta",
      "testimonial_wall",
      "faq",
      "ai_tool_entry",
      "upload_panel",
      "generation_form",
      "job_progress",
      "album_gallery"
    ];
    function groupSchemas(schemas: Record<string, ThemeSectionSchema>, mode: "saas" | "ai" | "dreamshoot") {
      const byCategory = new Map<string, SectionType[]>();
      Object.keys(schemas).forEach((type) => {
        const schema = schemas[type];
        const category = mode === "saas" ? schema.saasPresetCategory || "未分类" : schema.category;
        byCategory.set(category, [...(byCategory.get(category) ?? []), type]);
      });
      return [...byCategory.entries()].sort(([a], [b]) => {
        if (mode !== "saas") return a.localeCompare(b);
        const ai = saasPresetCategoryOrder.indexOf(a);
        const bi = saasPresetCategoryOrder.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    }
    return [
      {
        title: "DreamShoot 推荐模块",
        source: "dreamshoot",
        groups: [
          [
            "首页转化",
            featuredDreamShootTypes.filter((type) => Boolean(aiSubscriptionSectionSchemas[type]))
          ] as [string, SectionType[]]
        ]
      },
      { title: "AI 订阅业务积木", source: "ai", groups: groupSchemas(aiSubscriptionSectionSchemas, "ai") },
      { title: `SaaS ${selectedSaasThemeKey} 原始积木`, source: "saas", groups: groupSchemas(selectedSaasSectionSchemas, "saas") }
    ];
  }, [selectedSaasSectionSchemas, selectedSaasThemeKey]);
  const currentTemplateName = activePage.templateKey ?? resolvePageTemplateName(activePage.id, pages);
  const industryThemePackages = useMemo(() => getThemePackages(), []);
  const currentTemplatePackageKey = templatePackageKeyForPage(activePage, currentTemplateName);
  const templateApplyOptions = useMemo(() => {
    if (!currentTemplatePackageKey) return [];
    return industryThemePackages
      .map((themePackage) => {
        const template = themePackage.templates.find((item) => item.key === currentTemplatePackageKey);
        if (!template) return null;
        return {
          key: `${themePackage.key}:${template.key}`,
          packageKey: themePackage.key,
          templateKey: template.key,
          label: `${themePackage.name} / ${template.label}`,
          sectionCount: template.sectionCount,
          accent: themePackage.accent ?? "#f4a719"
        };
      })
      .filter(Boolean) as Array<{
        key: string;
        packageKey: string;
        templateKey: ThemePackageTemplateKey;
        label: string;
        sectionCount: number;
        accent: string;
      }>;
  }, [currentTemplatePackageKey, industryThemePackages]);
  const themePackageApplyCards = useMemo(() => {
    return industryThemePackages.map((themePackage) => {
      const packageTemplateKeys = new Set(themePackage.templates.map((item) => item.key));
      const matchedPages = pages
        .map((page) => {
          const templateName = page.templateKey ?? resolvePageTemplateName(page.id, pages);
          const templateKey = templatePackageKeyForPage(page, templateName);
          if (!templateKey || !packageTemplateKeys.has(templateKey)) return null;
          return { page, templateKey };
        })
        .filter(Boolean) as Array<{ page: ThemePage; templateKey: ThemePackageTemplateKey }>;
      const currentTemplate = currentTemplatePackageKey
        ? themePackage.templates.find((item) => item.key === currentTemplatePackageKey)
        : undefined;
      const currentOption = currentTemplate
        ? templateApplyOptions.find((item) => item.packageKey === themePackage.key && item.templateKey === currentTemplate.key)
        : undefined;
      const firstMatchedPages = matchedPages.slice(0, 4).map(({ page }) => pageTypeLabel(page));
      return {
        key: themePackage.key,
        name: themePackage.name,
        description: themePackage.description,
        audience: themePackage.audience,
        accent: themePackage.accent ?? "#f4a719",
        templateCount: themePackage.templates.length,
        matchedPageCount: matchedPages.length,
        currentTemplateLabel: currentTemplate?.label,
        currentOptionKey: currentOption?.key,
        firstMatchedPages
      };
    }).sort((left, right) => {
      const activeKey = activeIndustryThemeKey === "ai_subscription_theme1" ? "dreamshoot-ai-studio" : activeIndustryThemeKey;
      const score = (item: { key: string }) => {
        if (item.key === activeKey) return 0;
        if (item.key === "wedding-story-house") return 1;
        return 2;
      };
      const leftScore = score(left);
      const rightScore = score(right);
      if (leftScore !== rightScore) return leftScore - rightScore;
      return left.name.localeCompare(right.name);
    });
  }, [activeIndustryThemeKey, currentTemplatePackageKey, industryThemePackages, pages, templateApplyOptions]);
  const pageMenuOptions = useMemo<DesignerToolbarMenuOption[]>(() => {
    return pages.map((page) => {
      const pageDraft = drafts[page.id] ?? page.draftJson;
      const pagePublished = publishedPages[page.id] ?? page.publishedJson;
      const dirty = JSON.stringify(pageDraft) !== JSON.stringify(pagePublished);
      const templateKey = page.templateKey ?? resolvePageTemplateName(page.id, pages);
      return {
        key: page.id,
        label: pageTypeLabel(page),
        description: `${page.slug} / ${templateDisplayName(templateKey)}`,
        chipLabel: dirty ? "草稿" : "线上",
        chipTone: dirty ? "draft" : "live"
      };
    });
  }, [drafts, pages, publishedPages]);
  const dirtyPagesCount = pages.filter((page) => {
    const draftPage = drafts[page.id] ?? page.draftJson;
    const pagePublished = publishedPages[page.id] ?? page.publishedJson;
    return JSON.stringify(draftPage) !== JSON.stringify(pagePublished);
  }).length;
  const currentPageDirty = JSON.stringify(draft) !== JSON.stringify(livePage);
  const globalSettingsDirty = JSON.stringify(themeSettings) !== JSON.stringify(publishedThemeSettings);
  const wholeSiteDirtyCount = dirtyPagesCount + (globalSettingsDirty ? 1 : 0);
  const hiddenDraftCount = Math.max(0, wholeSiteDirtyCount - (currentPageDirty ? 1 : 0));
  const currentSectionIds = Array.from(new Set([...draft.sectionsOrder, ...livePage.sectionsOrder]));
  const changedSectionCount =
    currentSectionIds.filter((sectionId) => JSON.stringify(draft.sections[sectionId] ?? null) !== JSON.stringify(livePage.sections[sectionId] ?? null)).length +
    (JSON.stringify(draft.sectionsOrder) === JSON.stringify(livePage.sectionsOrder) ? 0 : 1);
  const pageIsEmpty = sectionList.length === 0;

  const schemaForType = useCallback((type: SectionType): ThemeSectionSchema => {
    return selectedSaasSectionSchemas[type] ?? sectionSchemas[type] ?? getSectionSchema(type);
  }, [selectedSaasSectionSchemas]);
  const activeSectionSchema = activeSection ? schemaForType(activeSection.type) : undefined;
  const activeBlockSchema = activeSection && activeBlock ? resolveBlockSchemaFromSchemas(selectedSaasSectionSchemas, activeSection, activeBlock.type) : undefined;
  const activeGlobalBlockSchema = activeSection && activeGlobalBlock ? resolveBlockSchemaFromSchemas(selectedSaasSectionSchemas, activeSection, activeGlobalBlock.type) : undefined;
  const selectedBlockSchema = activeBlockSchema ?? activeGlobalBlockSchema;
  const selectedBlockSettings = selectedBlockSchema?.settings ?? [];

  function defaultSectionForType(type: SectionType): SectionInstance {
    const schema = schemaForType(type);
    const preset = schema.presets?.[0];
    return {
      type,
      settings: { ...(preset?.settings ?? Object.fromEntries(schema.settings.map((field) => [field.id, field.default ?? ""]))) },
      blocks: preset?.blocks ? JSON.parse(JSON.stringify(preset.blocks)) as SectionBlockInstance[] : []
    };
  }

  const copyLocatorItems = useMemo<DesignerCopyLocatorItem[]>(() => {
    const items: DesignerCopyLocatorItem[] = [];
    const seen = new Set<string>();

    function pushItem(item: DesignerCopyLocatorItem) {
      const dedupeKey = `${item.source}:${item.path}:${item.text}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      items.push(item);
    }

    function pushField({
      idBase,
      field,
      values,
      fallbackValue,
      path,
      source,
      sourceLabel,
      selection,
      workspaceTab
    }: {
      idBase: string;
      field: ThemeFieldSchema;
      values?: Record<string, ThemeSettingValue>;
      fallbackValue?: ThemeSettingValue;
      path: string;
      source: DesignerCopyLocatorItem["source"];
      sourceLabel: string;
      selection: Selection;
      workspaceTab: DesignerWorkspaceTab;
    }) {
      if (!shouldIndexField(field)) return;
      const text = locatorTextFromValue(readThemeFieldValue(values, field) ?? fallbackValue ?? field.default);
      if (!text) return;
      pushItem({
        id: `${idBase}:${field.id}`,
        label: fieldDisplayLabel(field),
        path,
        selection,
        source,
        sourceLabel,
        text,
        workspaceTab
      });
    }

    sectionList.forEach(({ id, section }, sectionIndex) => {
      const schema = schemaForType(section.type);
      const sectionLabel = labelForSchema(section.type, selectedSaasSectionSchemas);
      schema.settings.forEach((field) => {
        pushField({
          idBase: `page:${id}`,
          field,
          values: section.settings,
          path: `${activePage.title} / ${sectionLabel} / ${fieldDisplayLabel(field)}`,
          source: "page",
          sourceLabel: "当前页面",
          selection: { kind: "section", sectionId: id },
          workspaceTab: "templates"
        });
      });
      safeBlocks(section).forEach((block, blockIndex) => {
        const blockSchema = resolveBlockSchemaFromSchemas(selectedSaasSectionSchemas, section, block.type);
        const blockLabel = blockDisplayLabel(blockSchema, block, blockIndex);
        blockSchema?.settings.forEach((field) => {
          pushField({
            idBase: `page:${id}:${block.id}`,
            field,
            values: block.settings,
            path: `${activePage.title} / ${sectionIndex + 1}. ${sectionLabel} / ${blockLabel} / ${fieldDisplayLabel(field)}`,
            source: "page",
            sourceLabel: "当前页面",
            selection: { kind: "block", sectionId: id, blockId: block.id },
            workspaceTab: "templates"
          });
        });
      });
    });

    (["header", "footer"] as const).forEach((globalType) => {
      const section = themeSettings.globalSections?.[globalType];
      if (!section) return;
      const schema = schemaForType(section.type);
      const globalLabel = globalType === "header" ? "全局页头" : "全局页脚";
      schema.settings.forEach((field) => {
        pushField({
          idBase: `global:${globalType}`,
          field,
          values: section.settings,
          path: `${globalLabel} / ${fieldDisplayLabel(field)}`,
          source: "global",
          sourceLabel: "全局配置",
          selection: { kind: "global", globalType },
          workspaceTab: "global"
        });
      });
      safeBlocks(section).forEach((block, blockIndex) => {
        const blockSchema = resolveBlockSchemaFromSchemas(selectedSaasSectionSchemas, section, block.type);
        const blockLabel = blockDisplayLabel(blockSchema, block, blockIndex);
        blockSchema?.settings.forEach((field) => {
          pushField({
            idBase: `global:${globalType}:${block.id}`,
            field,
            values: block.settings,
            path: `${globalLabel} / ${blockLabel} / ${fieldDisplayLabel(field)}`,
            source: "global",
            sourceLabel: "全局配置",
            selection: { kind: "globalBlock", globalType, blockId: block.id },
            workspaceTab: "global"
          });
        });
      });
    });

    themeSettings.navigation.headerLinks.forEach((link, index) => {
      pushItem({
        id: `navigation:header:${index}`,
        label: "页眉导航",
        path: `全局配置 / 导航 / 页眉导航 / ${index + 1}`,
        selection: { kind: "globalSettings", node: "navigation" },
        source: "navigation",
        sourceLabel: "导航菜单",
        text: [link.label, link.href, link.group].filter(Boolean).join(" / "),
        workspaceTab: "global"
      });
    });
    themeSettings.navigation.footerLinks.forEach((link, index) => {
      pushItem({
        id: `navigation:footer:${index}`,
        label: "页脚导航",
        path: `全局配置 / 导航 / 页脚导航 / ${index + 1}`,
        selection: { kind: "globalSettings", node: "navigation" },
        source: "navigation",
        sourceLabel: "导航菜单",
        text: [link.label, link.href, link.group].filter(Boolean).join(" / "),
        workspaceTab: "global"
      });
    });

    const seoEntries = [
      ["siteTitle", "站点标题", themeSettings.seo?.siteTitle],
      ["siteDescription", "默认描述", themeSettings.seo?.siteDescription],
      ["titleTemplate", "标题模板", themeSettings.seo?.titleTemplate],
      ["defaultOgImage", "默认分享图", themeSettings.seo?.defaultOgImage]
    ] as const;
    seoEntries.forEach(([id, label, value]) => {
      const text = locatorTextFromValue(value);
      if (!text) return;
      pushItem({
        id: `seo:${id}`,
        label,
        path: `全局配置 / SEO 默认项 / ${label}`,
        selection: { kind: "globalSettings", node: "seo" },
        source: "seo",
        sourceLabel: "SEO",
        text,
        workspaceTab: "global"
      });
    });

    pushItem({
      id: "code:hardcoded",
      label: "代码硬编码",
      path: "代码 / 尚未迁移为后台字段",
      readOnly: true,
      source: "code",
      sourceLabel: "代码硬编码",
      text: "如果搜索不到预览文案，通常需要开发把这句文案迁移为可配置字段。",
      hint: "只读提示"
    });

    return items;
  }, [activePage.title, schemaForType, sectionList, selectedSaasSectionSchemas, themeSettings]);

  function updateDraft(next: ThemePageJson, action: string) {
    setDrafts((current) => ({ ...current, [selectedPageId]: next }));
    dirtyPageIdsRef.current.add(selectedPageId);
    setLastAction(action);
  }

  function markThemeSettingsDirty() {
    themeSettingsDirtyRef.current = true;
  }

  const postPatchToIframe = useCallback((payload: IframePatchPayload) => {
    iframeRef.current?.contentWindow?.postMessage(payload, "*");
  }, []);

  function reloadIframePreview() {
    iframeRecoveryCount.current = 0;
    setIframeStatus("loading");
    setIframeReloadKey((current) => current + 1);
  }

  function changePreviewDevice(nextDevice: "desktop" | "mobile") {
    setDevice(nextDevice);
    setLastAction(nextDevice === "mobile" ? "手机预览使用真实移动端宽度渲染，默认仍是编辑定位模式。" : "已切换到桌面缩放预览，默认仍是编辑定位模式。");
    reloadIframePreview();
  }

  function togglePreviewMode() {
    const nextMode: PreviewMode = previewMode === "edit" ? "interactive" : "edit";
    setPreviewMode(nextMode);
    setLastAction(
      nextMode === "interactive"
        ? "已切换到真实交互预览：点击会按正常网站行为跳转。"
        : "已切换到编辑定位模式：点击只选中文案和模块，不执行业务跳转。"
    );
    reloadIframePreview();
  }

  function handleIframeLoad() {
    if (previewMode === "interactive") {
      setIframeStatus("ready");
      return;
    }
    window.setTimeout(checkIframePreviewHealth, 240);
  }

  const syncSelectionToIframe = useCallback((nextSelection = selection, options?: { scroll?: boolean }) => {
    syncSelectionToPreview({
      selection: nextSelection,
      previewMode,
      postPatch: postPatchToIframe,
      scroll: options?.scroll
    });
  }, [postPatchToIframe, previewMode, selection]);

  function selectionBelongsToEditorTab(currentSelection: Selection, tab: DesignerWorkspaceTab) {
    if (tab === "publish") return false;
    if (tab === "global") {
      return currentSelection.kind === "global" || currentSelection.kind === "globalBlock" || currentSelection.kind === "globalSettings";
    }
    return currentSelection.kind === "section" || currentSelection.kind === "block";
  }

  function lockPreviewSelectionUpdates(durationMs = 350) {
    previewSelectionLockUntilRef.current = Date.now() + durationMs;
  }

  function chooseSelection(nextSelection: Selection, options?: { syncPreview?: boolean; scrollPreview?: boolean; lockPreviewSelection?: boolean }) {
    if (options?.lockPreviewSelection !== false) lockPreviewSelectionUpdates();
    if (nextSelection.kind === "section" || nextSelection.kind === "block") {
      setExpandedSections((current) => ({ ...current, [nextSelection.sectionId]: true }));
    }
    if (nextSelection.kind === "global" || nextSelection.kind === "globalBlock") {
      setExpandedGlobals((current) => ({ ...current, [nextSelection.globalType]: true }));
    }
    setLocatorBreadcrumb(undefined);
    setSelection(nextSelection);
    if (options?.syncPreview !== false && previewMode === "edit") {
      syncSelectionToIframe(nextSelection, { scroll: options?.scrollPreview ?? true });
    }
  }

  function switchEditorTab(nextTab: DesignerWorkspaceTab) {
    setActiveTab(nextTab);
    const nextSelection = selectionForEditorTab({
      nextTab,
      currentSelection: selection,
      firstGlobalNodeId: globalNodes[0]?.id,
      activeSectionId,
      firstSectionId: sectionList[0]?.id
    });
    setLocatorBreadcrumb(undefined);
    if (nextSelection) {
      chooseSelection(nextSelection, { scrollPreview: false });
      return;
    }
    if (nextTab === "publish") {
      postPatchToIframe({ act: "clearSelection" });
      return;
    }
    if (selectionBelongsToEditorTab(selection, nextTab)) {
      syncSelectionToIframe(selection, { scroll: false });
      return;
    }
    postPatchToIframe({ act: "clearSelection" });
  }

  function chooseCopyQuickTarget(target: DesignerCopyLocatorQuickTarget) {
    const nextSelection: Selection =
      target === "header"
        ? { kind: "global", globalType: "header" }
        : target === "footer"
        ? { kind: "global", globalType: "footer" }
        : target === "navigation"
        ? { kind: "globalSettings", node: "navigation" }
        : { kind: "globalSettings", node: "seo" };
    const nextLabel =
      target === "header"
        ? "全局页头"
        : target === "footer"
        ? "全局页脚"
        : target === "navigation"
        ? "全局导航"
        : "SEO 默认项";
    setActiveTab("global");
    chooseSelection(nextSelection);
    setLocatorBreadcrumb(`${activePage.title} / ${nextLabel}`);
    setLastAction(`已定位到${nextLabel}。保存草稿不会上线，发布整站快照后前台才会读取。`);
  }

  function chooseCopyLocatorItem(item: DesignerCopyLocatorItem) {
    if (item.workspaceTab) setActiveTab(item.workspaceTab);
    if (item.selection) chooseSelection(item.selection);
    setLocatorBreadcrumb(item.path);
    setLastAction(
      item.readOnly
        ? `「${item.text}」属于${item.sourceLabel}，当前只能查看，需要开发迁移为可配置字段。`
        : `已定位「${item.text}」：${item.path}`
    );
  }

  useEffect(() => {
    function onPreviewMessage(event: MessageEvent<IframeDesignerMessage>) {
      if (previewMode !== "edit") return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (Date.now() < previewSelectionLockUntilRef.current) return;
      const nextState = selectionFromPreviewMessage({ message: event.data, draft, themeSettings });
      if (!nextState) return;
      setActiveTab(nextState.tab);
      setSelection(nextState.selection);
      setLastAction(nextState.actionLabel);
    }

    window.addEventListener("message", onPreviewMessage);
    return () => window.removeEventListener("message", onPreviewMessage);
  }, [draft, previewMode, themeSettings]);

  const checkIframePreviewHealth = useCallback(() => {
    const iframe = iframeRef.current;
    const iframeDocument = iframe?.contentDocument;
    const iframeHref = iframeDocument?.location?.href ?? "";
    const documentReady = iframeDocument?.readyState === "complete" || iframeDocument?.readyState === "interactive";
    const hasPreviewRoot = Boolean(iframeDocument?.querySelector("[data-theme-sections-root]"));
    if (documentReady && (previewMode === "interactive" || hasPreviewRoot)) {
      iframeRecoveryCount.current = 0;
      setIframeStatus("ready");
      if (previewMode === "edit") syncSelectionToIframe();
      return true;
    }
    const stillNavigating = !iframeDocument || iframeDocument.readyState === "loading" || iframeHref === "about:blank";
    if (stillNavigating) {
      setIframeStatus("loading");
      return false;
    }
    if (iframeRecoveryCount.current < 1) {
      iframeRecoveryCount.current += 1;
      setIframeStatus("recovering");
      setIframeReloadKey((current) => current + 1);
      return false;
    }
    setIframeStatus("failed");
    return false;
  }, [previewMode, syncSelectionToIframe]);

  useEffect(() => {
    setIframeStatus((current) => (current === "ready" ? "ready" : "loading"));
    const earlyCheck = window.setTimeout(() => {
      checkIframePreviewHealth();
    }, 900);
    const slowCheck = window.setTimeout(() => {
      checkIframePreviewHealth();
    }, 4_000);
    const recoveryCheck = window.setTimeout(() => {
      checkIframePreviewHealth();
    }, 12_000);
    return () => {
      window.clearTimeout(earlyCheck);
      window.clearTimeout(slowCheck);
      window.clearTimeout(recoveryCheck);
    };
  }, [previewMode, selectedPageId, iframeReloadKey, checkIframePreviewHealth]);

  useEffect(() => {
    xfcartContextRef.current = {
      pages,
      drafts,
      selectedPageId,
      draft,
      themeSettings,
      themeId: saasDraft.themeId,
      themeKey: selectedSaasThemeKey,
      previewMode
    };
  }, [draft, drafts, pages, previewMode, saasDraft.themeId, selectedPageId, selectedSaasThemeKey, themeSettings]);

  function applyXfcartVersionResult(result?: XfcartVersionResult) {
    if (!result) return;
    if (result.pageDraftVersions && Object.keys(result.pageDraftVersions).length) {
      setDraftVersions((current) => ({ ...current, ...result.pageDraftVersions }));
    }
    if (result.settingsDraftVersion) setThemeSettingsDraftVersion(result.settingsDraftVersion);
  }

  async function sendSaasAction(action: SaasThemeAction, fallbackMessage: string): Promise<XfcartVersionResult | undefined> {
    const context = xfcartContextRef.current ?? {
      pages,
      drafts,
      selectedPageId,
      draft,
      themeSettings,
      themeId: saasDraft.themeId,
      themeKey: selectedSaasThemeKey,
      previewMode
    };
    const result = await sendXfcartAction({
      siteId: site.id,
      action,
      fallbackMessage,
      context: {
        pages: context.pages,
        selectedPageId: context.selectedPageId,
        draft: "pageId" in action ? context.drafts[action.pageId] ?? context.draft : context.draft,
        themeSettings: context.themeSettings,
        themeId: context.themeId,
        themeKey: context.themeKey
      },
      previewMode: context.previewMode,
      postPatch: postPatchToIframe,
      setLastAction
    });
    applyXfcartVersionResult(result);
    return result;
  }

  function queuedActionKey(action: SaasThemeAction) {
    const scope = "scope" in action ? action.scope : "page";
    const pageId = "pageId" in action ? action.pageId : "";
    const sectionId = "sectionId" in action ? action.sectionId ?? "" : "";
    const blockId = "blockId" in action ? action.blockId : "";
    const globalType = "globalType" in action ? action.globalType : "";
    const name = "name" in action ? action.name : "";
    return [action.type, scope, pageId, globalType, sectionId, blockId, name].join("|");
  }

  function mergeXfcartVersionResults(results: Array<XfcartVersionResult | undefined>): XfcartVersionResult | undefined {
    const pageDraftVersions: Record<string, ThemeDraftMeta> = {};
    let settingsDraftVersion: ThemeDraftMeta | undefined;
    for (const result of results) {
      if (result?.pageDraftVersions) Object.assign(pageDraftVersions, result.pageDraftVersions);
      if (result?.settingsDraftVersion) settingsDraftVersion = result.settingsDraftVersion;
    }
    if (!Object.keys(pageDraftVersions).length && !settingsDraftVersion) return undefined;
    return { pageDraftVersions, settingsDraftVersion };
  }

  async function drainPreviewMutationQueue(key: string): Promise<XfcartVersionResult | undefined> {
    const record = previewMutationQueuesRef.current.get(key);
    if (!record) return undefined;
    if (record.timerId) {
      window.clearTimeout(record.timerId);
      record.timerId = undefined;
    }
    if (record.inflight && record.promise) return record.promise;
    record.inflight = true;
    record.promise = (async () => {
      const results: Array<XfcartVersionResult | undefined> = [];
      while (record.pending) {
        const pending = record.pending;
        record.pending = undefined;
        results.push(await sendSaasAction(pending.action, pending.fallbackMessage));
      }
      return mergeXfcartVersionResults(results);
    })();
    try {
      return await record.promise;
    } finally {
      record.inflight = false;
      record.promise = undefined;
      if (!record.pending) previewMutationQueuesRef.current.delete(key);
      else void drainPreviewMutationQueue(key);
    }
  }

  function queuePreviewMutation(action: SaasThemeAction, fallbackMessage: string, delayMs = 420) {
    const key = queuedActionKey(action);
    const record = previewMutationQueuesRef.current.get(key) ?? { inflight: false };
    if (record.timerId) window.clearTimeout(record.timerId);
    record.pending = {
      action,
      fallbackMessage,
      sequence: previewMutationSequenceRef.current += 1
    };
    if (!record.inflight) {
      record.timerId = window.setTimeout(() => {
        void drainPreviewMutationQueue(key);
      }, delayMs);
    }
    previewMutationQueuesRef.current.set(key, record);
  }

  async function flushPreviewMutationQueues(): Promise<XfcartVersionResult | undefined> {
    const keys = Array.from(previewMutationQueuesRef.current.keys());
    const results = await Promise.all(keys.map((key) => drainPreviewMutationQueue(key)));
    return mergeXfcartVersionResults(results);
  }

  function cancelPreviewMutationQueues() {
    previewMutationQueuesRef.current.forEach((record) => {
      if (record.timerId) window.clearTimeout(record.timerId);
    });
    previewMutationQueuesRef.current.clear();
  }

  useEffect(() => cancelPreviewMutationQueues, []);

  function selectPage(pageId: string) {
    setSelectedPageId(pageId);
    const nextPage = drafts[pageId] ?? pages.find((page) => page.id === pageId)?.draftJson;
    const firstSectionId = nextPage?.sectionsOrder[0] ?? "";
    setExpandedSections(expansionStateForPage(nextPage, firstSectionId));
    setSelection({ kind: "section", sectionId: firstSectionId });
    setActiveTab("templates");
    setLocatorBreadcrumb(undefined);
    iframeRecoveryCount.current = 0;
    setIframeStatus("loading");
    setIframeReloadKey((current) => current + 1);
  }

  function moveSection(id: string, direction: -1 | 1) {
    const next = movePageSection(draft, id, direction);
    if (!next) return;
    updateDraft(next, "模块顺序已调整，尚未影响线上页面。");
    void sendSaasAction({ type: "dropition", pageId: selectedPageId, sectionsOrder: next.sectionsOrder }, "模块顺序已调整。");
  }

  function reorderSection(draggedId: string, targetId: string, position: "before" | "after" = "before") {
    const next = reorderPageSection(draft, draggedId, targetId, position);
    if (!next) return;
    updateDraft(next, "模块顺序已通过拖拽更新。");
    void sendSaasAction({ type: "dropition", pageId: selectedPageId, sectionsOrder: next.sectionsOrder }, "模块顺序已通过拖拽更新。");
  }

  function insertSection(type: SectionType, targetId?: string, position: "before" | "after" = "after") {
    const id = `${type}_${Date.now().toString(36).slice(-5)}`;
    const section = defaultSectionForType(type);
    const next = insertPageSection(draft, id, section, targetId, position);
    chooseSelection({ kind: "section", sectionId: id });
    setExpandedSections((current) => ({ ...current, [id]: true }));
    setActiveTab("templates");
    updateDraft(next, `已新增「${labelForSchema(type, selectedSaasSectionSchemas)}」模块。`);
    void sendSaasAction(
      { type: "addition", pageId: selectedPageId, sectionType: type, sectionId: id, section, sectionsOrder: next.sectionsOrder },
      `已新增「${labelForSchema(type, selectedSaasSectionSchemas)}」模块。`
    );
  }

  function onSectionPointerDown(sectionId: string) {
    sectionPointerSourceRef.current = sectionId;
  }

  function onSectionDragStart(event: DragEvent<HTMLElement>, sectionId: string) {
    const sourceSectionId = sectionPointerSourceRef.current ?? sectionId;
    const dragToken: DesignerDragToken = { kind: "section", sectionId: sourceSectionId };
    activeDragTokenRef.current = dragToken;
    sectionDragTargetRef.current = null;
    writeDesignerDragToken(event, dragToken, "move");
    setDragState({ kind: "section", id: sourceSectionId });
  }

  function onLibrarySectionDragStart(event: DragEvent<HTMLElement>, type: SectionType) {
    const dragToken: DesignerDragToken = { kind: "librarySection", sectionType: type };
    activeDragTokenRef.current = dragToken;
    sectionDragTargetRef.current = null;
    writeDesignerDragToken(event, dragToken, "copy");
    setDragState({ kind: "librarySection", type });
  }

  function onSectionDragTarget(sectionId: string, position: "before" | "after") {
    sectionDragTargetRef.current = { targetId: sectionId, position };
    setDragState((current) =>
      current?.kind === "section" || current?.kind === "librarySection"
        ? { ...current, targetId: sectionId, position }
        : current
    );
  }

  function onSectionDrop(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    const token = readDesignerDragToken(event) ?? activeDragTokenRef.current;
    const target = sectionDragTargetRef.current ?? { targetId, position: sectionDropPosition(event) };
    if (token?.kind === "section") reorderSection(token.sectionId, target.targetId, target.position);
    if (token?.kind === "librarySection") insertSection(token.sectionType, target.targetId, target.position);
    activeDragTokenRef.current = null;
    sectionPointerSourceRef.current = null;
    sectionDragTargetRef.current = null;
    setDragState(null);
  }

  function onSectionDragEnd() {
    const pending = activeDragTokenRef.current;
    const pendingTarget = sectionDragTargetRef.current;
    if (pendingTarget && pending?.kind === "section") {
      reorderSection(pending.sectionId, pendingTarget.targetId, pendingTarget.position);
    }
    if (pendingTarget && pending?.kind === "librarySection") {
      insertSection(pending.sectionType, pendingTarget.targetId, pendingTarget.position);
    }
    activeDragTokenRef.current = null;
    sectionPointerSourceRef.current = null;
    sectionDragTargetRef.current = null;
    setDragState(null);
  }

  function onCanvasEmptyDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const token = readDesignerDragToken(event) ?? activeDragTokenRef.current;
    if (token?.kind === "librarySection") insertSection(token.sectionType);
    activeDragTokenRef.current = null;
    sectionPointerSourceRef.current = null;
    sectionDragTargetRef.current = null;
    setDragState(null);
  }

  function toggleSectionExpanded(sectionId: string) {
    setExpandedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }

  function setAllSectionsExpanded(expanded: boolean) {
    setExpandedSections(Object.fromEntries(sectionList.map(({ id }) => [id, expanded])));
  }

  function toggleGlobalExpanded(globalType: "header" | "footer") {
    setExpandedGlobals((current) => ({ ...current, [globalType]: !current[globalType] }));
  }

  function setAllGlobalsExpanded(expanded: boolean) {
    setExpandedGlobals({ header: expanded, footer: expanded });
  }

  function deleteSection(id: string) {
    const next = removePageSection(draft, id);
    chooseSelection({ kind: "section", sectionId: next.sectionsOrder[0] ?? "" });
    updateDraft(next, "模块已从当前草稿移除。");
    void sendSaasAction({ type: "delition", pageId: selectedPageId, sectionId: id }, "模块已移除。");
  }

  function duplicateSection(id: string) {
    const original = draft.sections[id];
    if (!original) return;
    const copyId = `${original.type}_${Date.now().toString(36).slice(-5)}`;
    const next = duplicatePageSection(draft, id, copyId);
    if (!next) return;
    chooseSelection({ kind: "section", sectionId: copyId });
    updateDraft(next, `已复制「${labelForSchema(original.type, selectedSaasSectionSchemas)}」模块。`);
    void sendSaasAction(
      {
        type: "addition",
        pageId: selectedPageId,
        sectionType: original.type,
        sectionId: copyId,
        section: next.sections[copyId],
        sectionsOrder: next.sectionsOrder
      },
      `已复制「${labelForSchema(original.type, selectedSaasSectionSchemas)}」模块。`
    );
  }

  function editSectionSetting(id: string, field: ThemeFieldSchema, value: string) {
    const parsed = parseFieldValue(field, value);
    const next = updatePageSectionSetting(draft, id, field.id, parsed);
    if (!next) return;
    updateDraft(next, `已更新模块字段「${field.label}」。`);
    queuePreviewMutation({ type: "change", pageId: selectedPageId, scope: "page_section", sectionId: id, name: field.id, value: parsed }, `已更新模块字段「${field.label}」。`);
  }

  function addBlock(sectionId: string, blockSchema: ThemeBlockSchema) {
    const section = draft.sections[sectionId];
    if (!section) return;
    const sectionSchema = schemaForType(section.type);
    const currentBlocks = safeBlocks(section);
    if (sectionSchema.maxBlocks && currentBlocks.length >= sectionSchema.maxBlocks) return;
    if (blockSchema.maxBlocks && currentBlocks.filter((block) => block.type === blockSchema.type).length >= blockSchema.maxBlocks) return;
    const blockInstance = defaultBlock(blockSchema, currentBlocks.length + 1);
    const next = addPageBlock(draft, sectionId, blockInstance);
    if (!next) return;
    chooseSelection({ kind: "block", sectionId, blockId: blockInstance.id });
    updateDraft(next, `已新增子块「${blockSchema.label}」。`);
    void sendSaasAction({ type: "additem", pageId: selectedPageId, scope: "page_section", sectionId, blockType: blockSchema.type, block: blockInstance }, `已新增子块「${blockSchema.label}」。`);
  }

  function editBlockSetting(sectionId: string, blockId: string, field: ThemeFieldSchema, value: string) {
    const parsed = parseFieldValue(field, value);
    const next = updatePageBlockSetting(draft, sectionId, blockId, field.id, parsed);
    if (!next) return;
    updateDraft(next, `已更新子块字段「${field.label}」。`);
    queuePreviewMutation({ type: "change", pageId: selectedPageId, scope: "page_block", sectionId, blockId, name: field.id, value: parsed }, `已更新子块字段「${field.label}」。`);
  }

  function editGlobalSetting(globalType: "header" | "footer", field: ThemeFieldSchema, value: string) {
    const parsed = parseFieldValue(field, value);
    markThemeSettingsDirty();
    setThemeSettings((current) => updateGlobalSectionSetting(current, globalType, field.id, parsed));
    setLastAction(`已更新${globalType === "header" ? "页眉" : "页脚"}字段「${field.label}」。`);
    queuePreviewMutation({ type: "change", scope: "global", globalType, name: field.id, value: parsed }, `已更新${globalType === "header" ? "页眉" : "页脚"}字段「${field.label}」。`);
  }

  function addGlobalBlock(globalType: "header" | "footer", blockSchema: ThemeBlockSchema) {
    const blockInstance = defaultBlock(blockSchema, safeBlocks(themeSettings.globalSections?.[globalType]).length + 1);
    markThemeSettingsDirty();
    setThemeSettings((current) => appendGlobalBlock(current, globalType, blockInstance));
    chooseSelection({ kind: "globalBlock", globalType, blockId: blockInstance.id });
    setLastAction(`已向${globalType === "header" ? "页眉" : "页脚"}新增子块「${blockSchema.label}」。`);
    void sendSaasAction({ type: "additem", scope: "global", globalType, blockType: blockSchema.type, block: blockInstance }, `已向${globalType === "header" ? "页眉" : "页脚"}新增子块「${blockSchema.label}」。`);
  }

  function editGlobalBlockSetting(globalType: "header" | "footer", blockId: string, field: ThemeFieldSchema, value: string) {
    const parsed = parseFieldValue(field, value);
    markThemeSettingsDirty();
    setThemeSettings((current) => updateGlobalBlockSettingInSettings(current, globalType, blockId, field.id, parsed));
    setLastAction(`已更新${globalType === "header" ? "页眉" : "页脚"}子块字段「${field.label}」。`);
    queuePreviewMutation({ type: "change", scope: "global_block", globalType, blockId, name: field.id, value: parsed }, `已更新${globalType === "header" ? "页眉" : "页脚"}子块字段「${field.label}」。`);
  }

  function moveGlobalBlock(globalType: "header" | "footer", blockId: string, direction: -1 | 1) {
    const nextSettings = moveGlobalBlockInSettings(themeSettings, globalType, blockId, direction);
    markThemeSettingsDirty();
    setThemeSettings(nextSettings);
    setLastAction(`${globalType === "header" ? "页眉" : "页脚"}子块顺序已调整。`);
    const currentBlockIds = safeBlocks(nextSettings.globalSections?.[globalType]).map((block) => block.id);
    if (currentBlockIds.includes(blockId)) {
      void sendSaasAction({ type: "dropitem", scope: "global", globalType, blockIds: currentBlockIds }, `${globalType === "header" ? "页眉" : "页脚"}子块顺序已调整。`);
    }
  }

  function reorderGlobalBlock(globalType: "header" | "footer", draggedBlockId: string, targetBlockId: string) {
    const nextSettings = reorderGlobalBlockInSettings(themeSettings, globalType, draggedBlockId, targetBlockId);
    markThemeSettingsDirty();
    setThemeSettings(nextSettings);
    setLastAction(`${globalType === "header" ? "页眉" : "页脚"}子块顺序已拖拽更新。`);
    const currentBlockIds = safeBlocks(nextSettings.globalSections?.[globalType]).map((block) => block.id);
    if (currentBlockIds.includes(draggedBlockId)) {
      void sendSaasAction({ type: "dropitem", scope: "global", globalType, blockIds: currentBlockIds }, `${globalType === "header" ? "页眉" : "页脚"}子块顺序已调整。`);
    }
  }

  function onGlobalBlockDragStart(event: DragEvent<HTMLElement>, globalType: "header" | "footer", blockId: string) {
    event.stopPropagation();
    const dragToken: DesignerDragToken = { kind: "globalBlock", globalType, blockId };
    activeDragTokenRef.current = dragToken;
    writeDesignerDragToken(event, dragToken, "move");
    setDragState({ kind: "globalBlock", id: blockId });
  }

  function onGlobalBlockDrop(event: DragEvent<HTMLElement>, globalType: "header" | "footer", targetBlockId: string) {
    event.preventDefault();
    event.stopPropagation();
    const token = readDesignerDragToken(event) ?? activeDragTokenRef.current;
    if (token?.kind === "globalBlock" && token.globalType === globalType) reorderGlobalBlock(globalType, token.blockId, targetBlockId);
    activeDragTokenRef.current = null;
    setDragState(null);
  }

  function deleteGlobalBlock(globalType: "header" | "footer", blockId: string) {
    markThemeSettingsDirty();
    setThemeSettings((current) => removeGlobalBlock(current, globalType, blockId));
    chooseSelection({ kind: "global", globalType });
    setLastAction(`${globalType === "header" ? "页眉" : "页脚"}子块已移除。`);
    void sendSaasAction({ type: "delitem", scope: "global", globalType, blockId }, `${globalType === "header" ? "页眉" : "页脚"}子块已移除。`);
  }

  function moveBlock(sectionId: string, blockId: string, direction: -1 | 1) {
    const next = movePageBlock(draft, sectionId, blockId, direction);
    if (!next) return;
    updateDraft(next, "子块顺序已调整。");
    void sendSaasAction({ type: "dropitem", pageId: selectedPageId, scope: "page_section", sectionId, blockIds: safeBlocks(next.sections[sectionId]).map((block) => block.id) }, "子块顺序已调整。");
  }

  function reorderBlock(sectionId: string, draggedBlockId: string, targetBlockId: string) {
    const next = reorderPageBlock(draft, sectionId, draggedBlockId, targetBlockId);
    if (!next) return;
    updateDraft(next, "子块顺序已通过拖拽更新。");
    void sendSaasAction({ type: "dropitem", pageId: selectedPageId, scope: "page_section", sectionId, blockIds: safeBlocks(next.sections[sectionId]).map((block) => block.id) }, "子块顺序已通过拖拽更新。");
  }

  function onBlockDragStart(event: DragEvent<HTMLElement>, sectionId: string, blockId: string) {
    event.stopPropagation();
    const dragToken: DesignerDragToken = { kind: "block", sectionId, blockId };
    activeDragTokenRef.current = dragToken;
    writeDesignerDragToken(event, dragToken, "move");
    setDragState({ kind: "block", id: blockId });
  }

  function onBlockDrop(event: DragEvent<HTMLElement>, sectionId: string, targetBlockId: string) {
    event.preventDefault();
    event.stopPropagation();
    const token = readDesignerDragToken(event) ?? activeDragTokenRef.current;
    if (token?.kind === "block" && token.sectionId === sectionId) reorderBlock(sectionId, token.blockId, targetBlockId);
    activeDragTokenRef.current = null;
    setDragState(null);
  }

  function deleteBlock(sectionId: string, blockId: string) {
    const next = removePageBlock(draft, sectionId, blockId);
    if (!next) return;
    chooseSelection({ kind: "section", sectionId });
    updateDraft(next, "子块已从当前草稿移除。");
    void sendSaasAction({ type: "delitem", pageId: selectedPageId, scope: "page_section", sectionId, blockId }, "子块已移除。");
  }

  function updateThemeColor(key: keyof ThemeSettings["colors"], value: string) {
    markThemeSettingsDirty();
    setThemeSettings((current) => updateThemeColorValue(current, key, value, selectedSaasThemeKey));
    setLastAction(`已更新颜色项「${key}」。`);
  }

  function updateThemeTypography(key: keyof ThemeSettings["typography"], value: string) {
    markThemeSettingsDirty();
    setThemeSettings((current) => updateThemeTypographyValue(current, key, value, selectedSaasThemeKey));
    setLastAction(`已更新字体项「${key}」。`);
  }

  function updateThemeRadii(key: keyof ThemeSettings["radii"], value: string) {
    markThemeSettingsDirty();
    setThemeSettings((current) => updateThemeRadiiValue(current, key, value));
    setLastAction(`已更新圆角项「${key}」。`);
  }

  function updateThemeLinks(key: keyof ThemeSettings["navigation"], value: string) {
    markThemeSettingsDirty();
    setThemeSettings((current) => updateThemeLinksValue(current, key, value));
    setLastAction(`已更新导航项「${key}」。`);
  }

  function updateThemeSeo(field: GlobalLocalField, value: string | boolean) {
    markThemeSettingsDirty();
    setThemeSettings((current) => {
      const next = normalizeGlobalSections(cloneSettings(current));
      const seo = next.seo ?? {
        siteTitle: site.branding.logoText || site.name,
        siteDescription: site.branding.description,
        titleTemplate: `%s | ${site.branding.logoText || site.name}`,
        defaultOgImage: "",
        robots: {
          index: true,
          follow: true
        },
        pages: {}
      };

      if (field.kind === "seo_checkbox") {
        next.seo = {
          ...seo,
          robots: {
            ...seo.robots,
            [field.themeKey]: Boolean(value)
          }
        };
      } else {
        next.seo = {
          ...seo,
          [field.themeKey]: String(value)
        };
      }

      return next;
    });
    setLastAction(`已更新 SEO 字段「${field.label}」。`);
  }

  function updateSaasGlobalSetting(field: ThemeFieldSchema, value: string) {
    const parsed = parseFieldValue(field, value);
    markThemeSettingsDirty();
    setThemeSettings((current) => updateThemeSettingFromSaasField(current, field.id, parsed, selectedSaasThemeKey));
    setLastAction(`已更新全局字段「${field.label}」。`);
    queuePreviewMutation({ type: "change", scope: "global_setting", name: field.id, value: parsed }, `已更新全局字段「${field.label}」。`);
  }

  function currentPageDraftVersions(): Record<string, ThemeDraftMeta | undefined> {
    return Object.fromEntries(pages.map((page) => [page.id, draftVersions[page.id] ?? page.draftMeta]));
  }

  async function saveDraft() {
    if (mutationBusyRef.current) {
      setLastAction("当前已有保存或发布操作正在处理，请等待完成后再操作。");
      return {
        ok: false,
        pageVersions: currentPageDraftVersions(),
        settingsVersion: themeSettingsDraftVersion,
        status: 429
      };
    }
    mutationBusyRef.current = true;
    try {
      const flushedPreviewVersions = await flushPreviewMutationQueues();
      const pageVersionsBeforeSave = {
        ...currentPageDraftVersions(),
        ...(flushedPreviewVersions?.pageDraftVersions ?? {})
      };
      const settingsVersionBeforeSave = flushedPreviewVersions?.settingsDraftVersion ?? themeSettingsDraftVersion;
      const dirtyPageIds = Array.from(dirtyPageIdsRef.current).filter((pageId) => pages.some((page) => page.id === pageId));
      const shouldSaveThemeSettings = themeSettingsDirtyRef.current;
      if (!dirtyPageIds.length && !shouldSaveThemeSettings) {
        setLastAction("没有需要保存的草稿改动：当前页面和全局设置已在后台草稿区。");
        return { ok: true, pageVersions: pageVersionsBeforeSave, settingsVersion: settingsVersionBeforeSave };
      }
      const settingsSaved = shouldSaveThemeSettings
        ? await saveThemeSettingsDraft(site.id, themeSettings, settingsVersionBeforeSave)
        : { ok: true, draftVersion: settingsVersionBeforeSave, status: 200 };
      if (settingsSaved.draftVersion) setThemeSettingsDraftVersion(settingsSaved.draftVersion);
      const pagesSaved = dirtyPageIds.length
        ? await saveAllThemePageDrafts(
            site.id,
            dirtyPageIds.map((pageId) => {
              const page = pages.find((item) => item.id === pageId);
              return {
                pageId,
                draftJson: drafts[pageId] ?? page?.draftJson ?? activePage.draftJson,
                expected: pageVersionsBeforeSave[pageId]
              };
            })
          )
        : { ok: true, draftVersions: {}, errors: [] };
      if (Object.keys(pagesSaved.draftVersions).length) {
        setDraftVersions((current) => ({ ...current, ...pagesSaved.draftVersions }));
      }
      const failedPageIds = new Set(pagesSaved.errors.map((item) => item.pageId));
      for (const pageId of dirtyPageIds) {
        if (!failedPageIds.has(pageId)) dirtyPageIdsRef.current.delete(pageId);
      }
      const nextPageVersions = { ...pageVersionsBeforeSave, ...pagesSaved.draftVersions };
      if (!settingsSaved.ok || !pagesSaved.ok) {
        const conflict = pagesSaved.errors.some((item) => item.status === 409) || settingsSaved.status === 409;
        setLastAction(conflict ? "草稿保存被拦截：页面或全局设置版本已变化，请刷新后重新检查。" : "草稿保存失败，请检查页面配置后重试。");
        return { ok: false, pageVersions: nextPageVersions, settingsVersion: settingsSaved.draftVersion };
      }
      if (settingsSaved.ok) themeSettingsDirtyRef.current = false;
      setLastAction(`草稿已保存但不会上线：${dirtyPageIds.length} 个已编辑页面与全局设置已写入后台草稿区，发布整站快照后前台才会读取。`);
      return { ok: true, pageVersions: nextPageVersions, settingsVersion: settingsSaved.draftVersion };
    } finally {
      mutationBusyRef.current = false;
    }
  }

  function requestPublishDraft() {
    setActiveTab("publish");
    setPublishConfirmOpen(true);
  }

  async function publishDraft() {
    if (publishBusy) return;
    setPublishBusy(true);
    try {
    const saved = await saveDraft();
    if (!saved.ok) return;
    const result = await publishThemePageDraft(site.id, selectedPageId, "site_admin_demo", {
      pageVersions: saved.pageVersions,
      settingsVersion: saved.settingsVersion,
      publishedVersion
    });
    if (!result.ok) {
      setLastAction(result.status === 409 ? "发布已拦截：你确认时看到的页面、全局设置或线上版本已经变化，请刷新后重新检查。" : "发布失败，当前草稿仍已保留。");
      return;
    }
    if (result.pageDraftVersions) setDraftVersions(result.pageDraftVersions);
    if (result.settingsDraftVersion) setThemeSettingsDraftVersion(result.settingsDraftVersion);
    const nextVersion = result.publishedVersion ?? publishedVersion + 1;
    setPublishedPages(
      Object.fromEntries(
        pages.map((page) => {
          const draftPage = clonePage(drafts[page.id] ?? page.draftJson);
          draftPage.version = nextVersion;
          return [page.id, draftPage];
        })
      )
    );
    setDrafts((current) =>
      Object.fromEntries(
        pages.map((page) => {
          const draftPage = clonePage(current[page.id] ?? page.draftJson);
          draftPage.version = nextVersion;
          return [page.id, draftPage];
        })
      )
    );
    setPublishedThemeSettings(normalizeGlobalSections(cloneSettings(themeSettings)));
    setPublishedVersion(nextVersion);
    dirtyPageIdsRef.current.clear();
    themeSettingsDirtyRef.current = false;
    setPublishConfirmOpen(false);
    setLastAction(`已发布到线上版本 v${nextVersion}：当前页面、隐藏草稿页与全局设置已写入同一套线上快照。`);
    } finally {
      setPublishBusy(false);
    }
  }

  async function rollback() {
    if (mutationBusyRef.current) {
      setLastAction("当前已有保存或发布操作正在处理，请等待完成后再操作。");
      return;
    }
    mutationBusyRef.current = true;
    try {
      cancelPreviewMutationQueues();
      const result = await resetThemeDraftFromActive(site.id, "site_admin_demo");
      if (!result) {
        setLastAction("回滚失败，请稍后重试。");
        return;
      }
      const refreshedSite = result.site ?? site;
      dirtyPageIdsRef.current.clear();
      themeSettingsDirtyRef.current = false;
      setDrafts(Object.fromEntries(refreshedSite.pages.map((page) => [page.id, clonePage(page.draftJson)])));
      setPublishedPages(Object.fromEntries(refreshedSite.pages.map((page) => [page.id, clonePage(page.publishedJson)])));
      setDraftVersions(Object.fromEntries(refreshedSite.pages.flatMap((page) => (page.draftMeta ? [[page.id, page.draftMeta] as const] : []))));
      setThemeSettings(normalizeGlobalSections(cloneSettings(refreshedSite.themeSettings.draftJson)));
      setThemeSettingsDraftVersion(refreshedSite.themeSettings.draftMeta);
      setPublishedThemeSettings(normalizeGlobalSections(cloneSettings(refreshedSite.themeSettings.publishedJson)));
      setPublishedVersion(Math.max(1, ...refreshedSite.pages.map((page) => page.publishedJson.version ?? 0)));
      const selectedDraft = clonePage(refreshedSite.pages.find((page) => page.id === selectedPageId)?.draftJson ?? activePage.publishedJson);
      const firstSectionId = selectedDraft.sectionsOrder[0] ?? "";
      setExpandedSections(expansionStateForPage(selectedDraft, firstSectionId));
      setSelection({ kind: "section", sectionId: firstSectionId });
      reloadIframePreview();
      setLastAction(`整站草稿已恢复到线上发布版本 v${result.sourceVersion ?? publishedVersion}，所有页面与全局设置同步回线上基线。`);
    } finally {
      mutationBusyRef.current = false;
    }
  }

  async function applyIndustryTemplate(optionKey: string) {
    const option = templateApplyOptions.find((item) => item.key === optionKey);
    if (!option) return;
    await flushPreviewMutationQueues();
    const nextPage = themePackageTemplateToPageJson(option.packageKey, option.templateKey, activePage.pageType, draft.version);
    if (!nextPage) {
      setLastAction("行业模板套用失败，当前页面没有匹配模板。");
      return;
    }
    const nextDraft = specializeTemplateForPage(activePage, nextPage, option.packageKey);
    const firstSectionId = nextDraft.sectionsOrder[0] ?? "";
    setDrafts((current) => ({ ...current, [selectedPageId]: nextDraft }));
    dirtyPageIdsRef.current.add(selectedPageId);
    setExpandedSections(expansionStateForPage(nextDraft, firstSectionId));
    setSelection({ kind: "section", sectionId: firstSectionId });
    setActiveTab("templates");
    const saved = await saveThemePageDraft(site.id, selectedPageId, nextDraft, draftVersions[selectedPageId] ?? activePage.draftMeta);
    if (!saved.ok) {
      setLastAction("行业模板已放入本地草稿，但保存失败，请稍后再试。");
      return;
    }
    if (saved.draftVersion) {
      const draftVersion = saved.draftVersion;
      setDraftVersions((current) => ({ ...current, [selectedPageId]: draftVersion }));
    }
    dirtyPageIdsRef.current.delete(selectedPageId);
    reloadIframePreview();
    setLastAction(`已套用「${option.label}」到当前页面草稿，线上页面仍需发布后生效。`);
  }

  async function applyIndustryPackageToAllPages(packageKey: string) {
    const themePackage = industryThemePackages.find((item) => item.key === packageKey);
    if (!themePackage) return;
    await flushPreviewMutationQueues();
    const nextDraftEntries = pages
      .map((page) => {
        const templateName = page.templateKey ?? resolvePageTemplateName(page.id, pages);
        const templateKey = templatePackageKeyForPage(page, templateName);
        if (!templateKey) return null;
        const nextPage = themePackageTemplateToPageJson(
          themePackage.key,
          templateKey,
          page.pageType,
          (drafts[page.id] ?? page.draftJson).version
        );
        if (!nextPage) return null;
        return {
          pageId: page.id,
          draftJson: specializeTemplateForPage(page, nextPage, themePackage.key)
        };
      })
      .filter(Boolean) as Array<{ pageId: string; draftJson: ThemePageJson }>;

    if (!nextDraftEntries.length) {
      setLastAction(`「${themePackage.name}」没有匹配当前站点页面的模板。`);
      return;
    }

    const nextDraftMap = Object.fromEntries(nextDraftEntries.map((entry) => [entry.pageId, entry.draftJson]));
    const nextThemeSettings = applyThemePackageSettingsToDraftSettings(themeSettings, themePackage.siteSettings);
    setDrafts((current) => ({ ...current, ...nextDraftMap }));
    for (const entry of nextDraftEntries) dirtyPageIdsRef.current.add(entry.pageId);
    markThemeSettingsDirty();
    setThemeSettings(nextThemeSettings);

    const selectedDraft = nextDraftMap[selectedPageId] ?? drafts[selectedPageId] ?? activePage.draftJson;
    const firstSectionId = selectedDraft.sectionsOrder[0] ?? "";
    setExpandedSections(expansionStateForPage(selectedDraft, firstSectionId));
    setSelection({ kind: "section", sectionId: firstSectionId });
    setActiveTab("templates");

    const pageVersionsBeforeSave = currentPageDraftVersions();
    const pagesSaved = await saveAllThemePageDrafts(
      site.id,
      nextDraftEntries.map((entry) => ({ ...entry, expected: pageVersionsBeforeSave[entry.pageId] }))
    );
    const settingsSaved = await saveThemeSettingsDraft(site.id, nextThemeSettings, themeSettingsDraftVersion);
    if (Object.keys(pagesSaved.draftVersions).length) {
      setDraftVersions((current) => ({ ...current, ...pagesSaved.draftVersions }));
    }
    if (settingsSaved.draftVersion) setThemeSettingsDraftVersion(settingsSaved.draftVersion);
    const failedPageIds = new Set(pagesSaved.errors.map((item) => item.pageId));
    for (const entry of nextDraftEntries) {
      if (!failedPageIds.has(entry.pageId)) dirtyPageIdsRef.current.delete(entry.pageId);
    }
    if (!pagesSaved.ok || !settingsSaved.ok) {
      setLastAction(`「${themePackage.name}」全站页面与全局装修已放入本地草稿，但保存失败，请稍后再试。`);
      return;
    }
    themeSettingsDirtyRef.current = false;

    reloadIframePreview();
    setLastAction(`已套用「${themePackage.name}」到 ${nextDraftEntries.length} 个页面草稿，并同步品牌、导航、页眉、页脚、SEO 全局装修；线上页面仍需发布后生效。`);
  }

  function choosePreviewSelection(sectionId: string, blockId = "") {
    const nextState = selectionFromPreviewMessage({
      message: { act: "previewSelect", id: sectionId, blockId },
      draft,
      themeSettings
    });
    if (!nextState) return;
    setActiveTab(nextState.tab);
    chooseSelection(nextState.selection, { lockPreviewSelection: false });
    setLastAction(nextState.actionLabel.replace("iframe preview", "编辑定位预览"));
  }

  const activePackageCard =
    themePackageApplyCards.find((item) => item.key === (activeIndustryThemeKey === "ai_subscription_theme1" ? "dreamshoot-ai-studio" : activeIndustryThemeKey)) ??
    themePackageApplyCards.find((item) => item.key === "wedding-story-house") ??
    themePackageApplyCards[0];
  const templateApplyControl = industryThemePackages.length ? (
    <div
      className="flex h-[40px] min-w-[420px] max-w-[720px] flex-1 items-center overflow-hidden rounded-[10px] border border-white/10 bg-[#101722] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      data-designer-layout="saas-theme-package-strip"
    >
      <div className="flex h-full min-w-0 flex-1 items-center gap-2 border-r border-white/10 px-3">
        <span className="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.08em] text-[#f4a719]">主题包</span>
        <span className="min-w-0 truncate text-[12px] font-semibold text-white">{activePackageCard?.name ?? "行业主题"}</span>
        {activePackageCard ? (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/58">
            {activePackageCard.matchedPageCount}/{pages.length}
          </span>
        ) : null}
      </div>
      <label
        className={templateApplyOptions.length ? "flex h-full w-[164px] shrink-0 items-center overflow-hidden border-r border-white/10 bg-white/[0.035]" : "flex h-full w-[164px] shrink-0 items-center overflow-hidden border-r border-white/10 bg-white/[0.035] opacity-55"}
        data-designer-action="industry-template-apply"
        title={templateApplyOptions.length ? "套用行业主题包的当前页面模板到草稿" : "当前页面没有匹配的行业页面模板"}
      >
        <span className="w-[66px] shrink-0 px-2 text-[10px] text-white/48">套当前页</span>
        <select
          className="h-full min-w-0 flex-1 appearance-none bg-transparent px-2 text-[11px] text-white outline-none"
          disabled={!templateApplyOptions.length}
          onChange={(event) => {
            if (event.target.value) void applyIndustryTemplate(event.target.value);
            event.currentTarget.value = "";
          }}
          value=""
        >
          <option value="">{templateApplyOptions.length ? "套模板" : "无匹配"}</option>
          {templateApplyOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} ({option.sectionCount})
            </option>
          ))}
        </select>
      </label>
      <label
        className="flex h-full w-[164px] shrink-0 items-center overflow-hidden bg-white/[0.035]"
        data-designer-action="industry-template-apply-all"
        title="将行业主题包的整套页面模板套用到所有匹配页面草稿"
      >
        <span className="w-[66px] shrink-0 px-2 text-[10px] text-white/48">套全站</span>
        <select
          className="h-full min-w-0 flex-1 appearance-none bg-transparent px-2 text-[11px] text-white outline-none"
          onChange={(event) => {
            if (event.target.value) void applyIndustryPackageToAllPages(event.target.value);
            event.currentTarget.value = "";
          }}
          value=""
        >
          <option value="">套主题</option>
          {themePackageApplyCards.map((themePackage) => (
            <option key={themePackage.key} value={themePackage.key}>
              {themePackage.name} ({themePackage.matchedPageCount}/{pages.length})
            </option>
          ))}
        </select>
      </label>
    </div>
  ) : null;

  const pageTreeProps = createPageTreeProps({
    activePage,
    currentPageDirty,
    drafts,
    publishedPages,
    onSelectPage: selectPage,
    pageOptionLabel,
    pages,
    selectedPageId
  });

  const globalTreeProps = createGlobalTreeProps({
    dragState,
    expandedGlobals,
    globalNodes,
    instanceKey,
    onChooseSelection: chooseSelection,
    onGlobalBlockDragStart,
    onGlobalBlockDrop,
    onSetAllGlobalsExpanded: setAllGlobalsExpanded,
    onToggleGlobalExpanded: toggleGlobalExpanded,
    resolveBlockSchema: (section, blockType) => resolveBlockSchemaFromSchemas(selectedSaasSectionSchemas, section, blockType),
    safeBlocks,
    selection,
    setDragState,
    themeSettings
  });

  const publishSummary = {
    activePageTitle: activePage.title,
    currentPageDirty,
    dirtyPagesCount,
    hiddenDraftCount,
    globalSettingsDirty,
    publishedVersion,
    publicationCount,
    currentDraftRevision: draftVersions[selectedPageId]?.revision ?? draft?.version ?? 1,
    themeSettingsRevision: themeSettingsDraftVersion?.revision ?? 1
  };
  const previewSelection =
    activeTab === "publish"
      ? undefined
      : activeTab === "global"
      ? selection.kind === "global" || selection.kind === "globalBlock"
        ? selection
        : undefined
      : selection.kind === "section" || selection.kind === "block"
      ? selection
      : undefined;
  const activeLocatorBreadcrumb = locatorBreadcrumb ?? `${activePage.title} / ${selectionMeta.scope}${selectionMeta.detail ? ` / ${selectionMeta.detail}` : ""}`;
  const emptyPageGlobalShortcuts = (
    <div className="grid gap-1.5" data-designer-layout="saas-empty-page-global-shortcuts">
      <button className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-[#d9dde4] bg-white px-2 text-[11px] font-medium text-[#344054] transition hover:border-[#2f6fed] hover:text-[#2f6fed]" onClick={() => chooseCopyQuickTarget("header")} type="button">
        <PanelTop className="h-3.5 w-3.5" strokeWidth={1.8} />
        编辑页头
      </button>
      <button className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-[#d9dde4] bg-white px-2 text-[11px] font-medium text-[#344054] transition hover:border-[#2f6fed] hover:text-[#2f6fed]" onClick={() => chooseCopyQuickTarget("footer")} type="button">
        <PanelBottom className="h-3.5 w-3.5" strokeWidth={1.8} />
        编辑页脚
      </button>
      <button className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-[#d9dde4] bg-white px-2 text-[11px] font-medium text-[#344054] transition hover:border-[#2f6fed] hover:text-[#2f6fed]" onClick={() => chooseCopyQuickTarget("navigation")} type="button">
        <Menu className="h-3.5 w-3.5" strokeWidth={1.8} />
        编辑导航
      </button>
      <button className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-[#d9dde4] bg-white px-2 text-[11px] font-medium text-[#344054] transition hover:border-[#2f6fed] hover:text-[#2f6fed]" onClick={() => chooseCopyQuickTarget("seo")} type="button">
        <SearchCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
        编辑 SEO
      </button>
    </div>
  );
  const workspaceHeaderActions = (
    <button
      data-designer-open-tutorial="true"
      className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-[8px] border border-[#d8dbe1] bg-white px-3 text-[11px] font-medium leading-none text-[#383838] transition hover:bg-[#f7f8fb] focus-visible:outline-none active:scale-[0.98]"
      onClick={() => setTutorialOpen(true)}
      title="打开装修器新手教程"
      type="button"
    >
      <BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
      教程
    </button>
  );

  const sectionTreeProps = createSectionTreeProps({
    activePage,
    blockDisplayLabel,
    categoryLabel,
    changedSectionCount,
    dragState,
    expandedSections,
    instanceKey,
    labelForSchema,
    moduleLibraryCategoryOrder: saasPresetCategoryOrder,
    moduleLibrarySchemaGroups: schemaGroups,
    onBlockDragStart,
    onBlockDrop,
    onCanvasEmptyDrop,
    onChooseSelection: chooseSelection,
    onAddBlock: addBlock,
    emptyStateActions: emptyPageGlobalShortcuts,
    onInsertSection: insertSection,
    onLibrarySectionDragStart,
    onSectionDragEnd,
    onSectionDragTarget,
    onSectionPointerDown,
    onSectionDragStart,
    onSectionDrop,
    onSetAllSectionsExpanded: setAllSectionsExpanded,
    onToggleSectionExpanded: toggleSectionExpanded,
    resolveBlockSchema: resolveBlockSchemaFromSchemas,
    safeBlocks,
    schemaBlockCount,
    schemaForType,
    schemaMetaLine,
    sectionList,
    selectedSaasSectionSchemas,
    selection,
    setDragState
  });

  return (
	    <div
	      className="saas-designer-root flex h-full overflow-hidden bg-[#d7dce4]"
	      data-designer-contract="saas-store-builder xfcart-fullscreen-section-editor saas-three-pane-builder"
	      data-designer-selected-page-id={selectedPageId}
	    >
      <div className="hidden" aria-hidden="true">
        <span>高级：SaaS 原主题导入</span>
        <span>SaaS</span>
        <span>settings_schema</span>
        <span>Color</span>
        <span>Product</span>
        <span>Social media</span>
        <span>XFCart edit protocol</span>
        <span>xfcart-edit</span>
        <span>Iframe section selection sync</span>
        <span>Preview click selection</span>
        <span>previewSelect</span>
        <span>content_for_page</span>
        <span>种子块</span>
        <span>个预设</span>
        <span>商品</span>
        <span>素材</span>
        <span>导航</span>
        <span>营销</span>
        <span>基础</span>
        <span>AI 订阅业务积木</span>
        <span>header_plus</span>
        <span>footer_plus</span>
        <span>theme10</span>
        <span>default</span>
        <span data-designer-contract="saas-store-builder xfcart-fullscreen-section-editor saas-three-pane-builder">designer root</span>
        <span data-designer-contract="saas-right-decoration-workbench saas-left-decoration-workbench">designer split</span>
        <span data-designer-contract="saas-theme-package-strip">theme package strip</span>
        <span data-designer-contract="xfcart-section-block-tree">section block tree</span>
        <span data-designer-contract="xfcart-collapsible-global-block-tree">global block tree</span>
        <span data-designer-contract="xfcart-preset-category-library">preset category library</span>
        <span data-designer-contract="saas-visible-page-switcher">visible page switcher</span>
        <span data-designer-contract="saas-designer-flow-map">flow map</span>
        <span data-designer-contract="section-expanded">section expanded</span>
        <span data-designer-contract="global-expanded">global expanded</span>
        <span data-designer-contract="xfcart-iframe-selection-sync">iframe selection sync</span>
        <span data-designer-contract="xfcart-preview-click-select">preview click selection</span>
        <span data-designer-contract="xfcart-iframe-scroll-highlight">iframe scroll highlight</span>
        <span>SaaS media picker</span>
        <span>SaaS collection binding</span>
        <span>SaaS product binding</span>
        <span>SaaS link selector</span>
        <span>SaaS resource selector</span>
        <span>SaaS media resource modal</span>
        <span>SaaS product resource modal</span>
        <span>SaaS collection resource modal</span>
        <span>SaaS page/url resource modal</span>
        <span data-designer-contract="saas-resource-selector-modal">resource selector modal</span>
        <span data-designer-contract="saas-media-resource-selector">media selector</span>
        <span>SaaS custom image select</span>
        <span>SaaS range slider</span>
        <span>SaaS switch</span>
        <span>SaaS menu picker</span>
        <span>SaaS font picker</span>
        <span>SaaS html editor</span>
        <span>SaaS richtext editor</span>
        <span>SaaS video_url editor</span>
        <span>SaaS popover notice</span>
        <span>Collection - /collections - 专辑页</span>
        <span>Search - /search - 搜索页</span>
        <span>Cart - /cart - 购物车</span>
        <span>404 - /404 - 404</span>
      </div>
      <div className="saas-designer-preview-shell flex min-h-0 min-w-0 flex-1">
        <PreviewFrame
          activePage={activePage}
          activeThemeName={activeThemeName}
          changedSectionCount={changedSectionCount}
          creativePacks={creativePacks}
          currentPageDirty={currentPageDirty}
          currentTemplateName={currentTemplateName}
          device={device}
          dirtyPagesCount={dirtyPagesCount}
          draft={draft}
          iframeRef={iframeRef}
          draftThemeKey={draftThemeKey}
          draftThemeName={draftThemeName}
          iframeReloadKey={iframeReloadKey}
          iframeStatus={iframeStatus}
          lastAction={lastAction}
          pageMenuOptions={pageMenuOptions}
          onDeviceChange={changePreviewDevice}
          onIframeLoad={handleIframeLoad}
          onIframeRetry={reloadIframePreview}
          onLivePreviewSelect={choosePreviewSelection}
          onPageSelect={selectPage}
          onPreviewModeToggle={togglePreviewMode}
          onPreviewViewportChange={setPreviewViewportPreset}
          onPublishDraft={requestPublishDraft}
          onReloadPreview={reloadIframePreview}
          onRollback={rollback}
          onSaveDraft={saveDraft}
          pages={pages}
          previewToken={previewToken}
          previewMode={previewMode}
          previewViewportPreset={previewViewportPreset}
          products={products}
          publishedVersion={publishedVersion}
          selectedPageId={selectedPageId}
          selectedPreviewBlockId={previewSelection && (previewSelection.kind === "block" || previewSelection.kind === "globalBlock") ? previewSelection.blockId : undefined}
          selectedPreviewSectionId={previewSelection ? previewSectionIdForSelection(previewSelection) : undefined}
          site={site}
          siteAiApps={siteAiApps}
          templateApplyControl={templateApplyControl}
          templateDisplayName={templateDisplayName}
          themeSettings={themeSettings}
          toolbarLeading={toolbarLeading}
          toolbarTrailing={toolbarTrailing}
        />
      </div>

      <DesignerWorkspacePane
        activeTab={activeTab}
        globalTreeProps={globalTreeProps}
        headerActions={workspaceHeaderActions}
        mobileActions={{
          adminHref: `/site/${site.slug}/admin`,
          storefrontHref: `/site/${site.slug}`,
          currentPageDirty,
          dirtyPagesCount,
          publishedVersion,
          onPublishDraft: requestPublishDraft,
          onRollback: rollback,
          onSaveDraft: saveDraft
        }}
        mobileThemeApplyControl={templateApplyControl}
        onTabChange={switchEditorTab}
        pageTreeProps={pageTreeProps}
        propertyPaneProps={{
          activePageTitle: activePage.title,
          activeBlock,
          activeBlockSchema,
          activeGlobalBlock,
          activeGlobalBlockSchema,
          activeGlobalNode,
          activeGlobalNodeFields,
          activeSection,
          activeSectionId,
          activeSectionSchema,
          addBlock,
          addGlobalBlock,
          copyLocatorItems,
          deleteBlock,
          deleteGlobalBlock,
          deleteSection,
          duplicateSection,
          editBlockSetting,
          editGlobalBlockSetting,
          editGlobalSetting,
          editSectionSetting,
          fieldOptions,
          labelForSchema,
          mediaAssets,
          moveBlock,
          moveGlobalBlock,
          moveSection,
          locatorBreadcrumb: activeLocatorBreadcrumb,
          onChooseSelection: chooseSelection,
          onCopyLocatorSelect: chooseCopyLocatorItem,
          onCopyQuickSelect: chooseCopyQuickTarget,
          pageIsEmpty,
          publishSummary,
          products,
          safeBlocks,
          selectedBlockSettings,
          selectedSaasSectionSchemas,
          selection,
          selectionMeta,
          settingLinkString,
          site,
          siteAiApps,
          themeSettings,
          updateSaasGlobalSetting,
          updateThemeColor,
          updateThemeLinks,
          updateThemeRadii,
          updateThemeSeo,
          updateThemeTypography,
          workspaceTab: activeTab
        }}
        sectionTreeProps={sectionTreeProps}
      />
      <DesignerWorkbenchTutorial onClose={() => setTutorialOpen(false)} open={tutorialOpen} />
      {publishConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-[760px] rounded-[16px] border border-[#d9dde4] bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)]">
            <div className="border-b border-[#e6e9ee] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#667085]">确认发布</div>
                  <h2 className="mt-1 text-[18px] font-semibold text-[#101828]">发布会更新整站线上快照</h2>
                </div>
                <button
                  className="rounded-[10px] border border-[#d9dde4] px-3 py-1.5 text-sm text-[#344054] transition hover:border-[#98a2b3] hover:text-[#101828]"
                  onClick={() => setPublishConfirmOpen(false)}
                  type="button"
                >
                  取消
                </button>
              </div>
            </div>
            <div className="grid gap-4 px-5 py-4">
              <p className="text-[13px] leading-6 text-[#475467]">
                保存草稿不会上线。确认发布后，系统会先保存草稿，再把当前页面、隐藏草稿页和全局设置一起写入线上快照。
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[12px] border border-[#e6e9ee] bg-[#fafbfc] p-4">
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#667085]">会一起上线的内容</p>
                  <div className="mt-3 grid gap-2 text-[13px] text-[#344054]">
                    <div className="flex items-center justify-between gap-3">
                      <span>当前页面</span>
                      <span className="font-medium">{activePage?.title ?? "未选择"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>待发布页面</span>
                      <span className="font-medium">{dirtyPagesCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>隐藏草稿</span>
                      <span className="font-medium">{hiddenDraftCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>全局设置</span>
                      <span className="font-medium">{globalSettingsDirty ? "有变更" : "无变更"}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-[12px] border border-[#e6e9ee] bg-[#fafbfc] p-4">
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#667085]">版本保护</p>
                  <div className="mt-3 grid gap-2 text-[13px] text-[#344054]">
                    <div className="flex items-center justify-between gap-3">
                      <span>当前线上版本</span>
                      <span className="font-medium">v{publishedVersion}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>最近一次发布版本</span>
                      <span className="font-medium">v{publishedVersion}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>发布记录</span>
                      <span className="font-medium">{publicationCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>当前草稿页版本</span>
                      <span className="font-medium">v{draftVersions[selectedPageId]?.revision ?? draft?.version ?? 1}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>主题设置草稿版本</span>
                      <span className="font-medium">v{themeSettingsDraftVersion?.revision ?? 1}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-6 text-amber-900">
                如果页面草稿、全局设置或线上版本在你确认前被别人改过，这次发布会被 409 拦住，避免把别人的文案静默覆盖掉。
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6e9ee] px-5 py-4">
              <button
                className="rounded-[10px] border border-[#d9dde4] bg-white px-4 py-2 text-sm text-[#344054] transition hover:border-[#98a2b3] hover:text-[#101828] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={publishBusy}
                onClick={() => setPublishConfirmOpen(false)}
                type="button"
              >
                返回
              </button>
              <button
                className="rounded-[10px] border border-[#f4a719] bg-[#f4a719] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#eb9a0e] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={publishBusy}
                onClick={() => void publishDraft()}
                type="button"
              >
                {publishBusy ? "发布中" : "确认发布"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
