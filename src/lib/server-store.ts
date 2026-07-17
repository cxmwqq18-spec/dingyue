import "server-only";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { platformState as seedState } from "./data";
import {
  buildSaasThemeDraft,
  buildSaasThemePublication,
  fromSaasSettings,
  fromSaasTemplate,
  toSaasTemplate
} from "@/lib/theme/saas-theme-model";
import {
  getImportedSaasSectionSchemasForTheme,
  getSaasThemePackage,
  getSaasThemePackageList,
  getSaasThemePackageSummaryList,
  normalizeSaasSettingsCurrent,
  resetSaasSettingsCurrentForTheme,
  normalizeSaasSettingsCurrentForTheme
} from "@/lib/theme/saas-theme-package";
import { defaultBlock, defaultSection, getSectionSchema } from "@/lib/section-schema";
import { withNormalizedSeo } from "@/lib/theme/seo";
import { normalizeGlobalSection } from "@/lib/theme/section-normalize";
import { getThemePackages, themePackageTemplateToPageJson, type ThemePackageManifest, type ThemePackageSiteSettings } from "@/lib/theme/registry";
import {
  customerAssetFileExists as storageCustomerAssetFileExists,
  customerAssetFilePath as storageCustomerAssetFilePath,
  deleteCustomerAssetFile as storageDeleteCustomerAssetFile,
  normalizeCustomerAssetStorageKey,
  writeCustomerAssetFile as storageWriteCustomerAssetFile
} from "@/lib/customer-asset-storage";
import type {
  Album,
  AssetUpload,
  AuditLogEntry,
  AiGatewayGroup,
  CreativePack,
  CreditLedgerEntry,
  Customer,
  CustomerModel,
  CustomerSession,
  GenerationJob,
  LedgerType,
  MediaAsset,
  Order,
  PaymentEvent,
  PlatformAdmin,
  PlatformAiProvider,
  PlatformCloudflareAccount,
  PublicCustomer,
  PublicPlatformAdmin,
  PublicSiteAdmin,
  PlatformSession,
  PlatformState,
  Price,
  Product,
  Site,
  SiteAdmin,
  SiteAdminSession,
  SiteAiApp,
  SiteDomain,
  SiteTheme,
  Subscription,
  ThemeCopy,
  ThemeDraftMeta,
  ThemePublication,
  ThemePage,
  ThemePageJson,
  SectionBlockInstance,
  SectionInstance,
  ThemeSectionSchema,
  ThemeRuntimeData,
  ThemeRuntimeAlbum,
  ThemeRuntimeAsset,
  ThemeRuntimeCustomerModel,
  ThemeRuntimeJob,
  ThemeRuntimeLedgerEntry,
  ThemeRuntimeOrder,
  ThemeRuntimeSubscription,
  ThemeNavLink,
  ThemeSettings,
  ThemeSettingValue
} from "./types";
import { fallbackImageForSeed, resolveMediaAssetUrl } from "@/lib/media";
import { normalizePlatformEmailConfig, normalizeResendApiKey } from "@/lib/resend-email";
import type { SaasThemeRecord, SaasThemeSettingsRecord, SaasThemeTemplates } from "@/lib/theme/saas-theme-model";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "platform-state.json");
const postgresBridgeScript = path.join(process.cwd(), "scripts", "platform-state-db-bridge.mjs");
const postgresStateCacheMs = Math.max(0, Number(process.env.PLATFORM_STATE_CACHE_MS ?? "30000") || 0);
const postgresStateCacheFile = path.join(process.cwd(), ".next", "cache", "platform-state-postgres.json");
const postgresStateDiskCacheEnabled = process.env.PLATFORM_STATE_DISK_CACHE !== "0";
const jsonStateCacheMs = Math.max(0, Number(process.env.PLATFORM_STATE_JSON_CACHE_MS ?? "5000") || 0);
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;
const themePackageListCacheMs = Math.max(0, Number(process.env.THEME_PACKAGE_LIST_CACHE_MS ?? "60000") || 0);

let postgresStateCache: { expiresAt: number; state: PlatformState } | null = null;
let jsonStateCache: { expiresAt: number; mtimeMs: number; state: PlatformState } | null = null;
let availableSaasThemeSummaryCache: { expiresAt: number; themes: ReturnType<typeof getSaasThemePackageSummaryList> } | null = null;
let availableInternalThemeSummaryCache: {
  expiresAt: number;
  themes: Array<
    Pick<ThemePackageManifest, "key" | "name" | "description" | "audience" | "accent" | "thumbnailUrl" | "templates" | "featuredSections"> & {
      installType: "internal";
    }
  >;
} | null = null;
let postgresFallbackWarned = false;

export class StoreError extends Error {
  status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = "StoreError";
    this.status = status;
  }
}

function cloneState(state: PlatformState): PlatformState {
  return JSON.parse(JSON.stringify(state)) as PlatformState;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readPostgresStateCache(): PlatformState | null {
  if (postgresStateCacheMs <= 0) return null;
  const now = Date.now();
  if (postgresStateCache && postgresStateCache.expiresAt > now) {
    return cloneState(postgresStateCache.state);
  }
  if (!postgresStateDiskCacheEnabled) return null;
  try {
    const cached = JSON.parse(fs.readFileSync(postgresStateCacheFile, "utf8")) as { expiresAt?: number; state?: PlatformState };
    if (!cached.expiresAt || cached.expiresAt <= now || !cached.state) return null;
    postgresStateCache = { expiresAt: cached.expiresAt, state: normalizeState(cached.state) };
    return cloneState(postgresStateCache.state);
  } catch {
    return null;
  }
}

function shouldFallbackToJsonState(): boolean {
  return process.env.PERSISTENCE_BACKEND === "postgres" && process.env.NODE_ENV !== "production" && process.env.PLATFORM_STATE_POSTGRES_STRICT !== "1";
}

function warnPostgresFallback(error: unknown): void {
  if (postgresFallbackWarned) return;
  postgresFallbackWarned = true;
  const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
  console.warn(`[platform-state] Postgres unavailable; using JSON fallback for local development. ${message}`);
}

function readJsonPlatformStateFallback(): PlatformState {
  if (!fs.existsSync(dataFile)) {
    return normalizeState(cloneState(seedState));
  }
  const stat = fs.statSync(dataFile);
  const now = Date.now();
  if (jsonStateCacheMs > 0 && jsonStateCache && jsonStateCache.expiresAt > now && jsonStateCache.mtimeMs === stat.mtimeMs) {
    return cloneState(jsonStateCache.state);
  }
  const normalized = normalizeState(JSON.parse(fs.readFileSync(dataFile, "utf8")) as PlatformState);
  if (jsonStateCacheMs > 0) {
    jsonStateCache = { expiresAt: now + jsonStateCacheMs, mtimeMs: stat.mtimeMs, state: cloneState(normalized) };
  }
  return normalized;
}

function writeJsonPlatformStateFallback(nextState: PlatformState): PlatformState {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, `${JSON.stringify(nextState, null, 2)}\n`);
  jsonStateCache = null;
  return nextState;
}

function writePostgresStateCache(state: PlatformState): void {
  if (postgresStateCacheMs <= 0) {
    postgresStateCache = null;
    return;
  }
  const nextCache = { expiresAt: Date.now() + postgresStateCacheMs, state: cloneState(state) };
  postgresStateCache = nextCache;
  if (!postgresStateDiskCacheEnabled) return;
  try {
    fs.mkdirSync(path.dirname(postgresStateCacheFile), { recursive: true });
    const tempFile = `${postgresStateCacheFile}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(nextCache));
    fs.renameSync(tempFile, postgresStateCacheFile);
  } catch {
    // Cache writes should never block core persistence.
  }
}

function safeCustomerAssetRelativePath(storageKey: string): string {
  try {
    return normalizeCustomerAssetStorageKey(storageKey);
  } catch {
    throw new StoreError("unsafe_asset_storage_key", 400);
  }
}

function customerAssetFilePath(storageKey: string): string {
  safeCustomerAssetRelativePath(storageKey);
  return storageCustomerAssetFilePath(storageKey);
}

function customerAssetFileExists(storageKey: string): boolean {
  return storageCustomerAssetFileExists(storageKey);
}

function isCustomerAssetStorageKey(storageKey: string | undefined): storageKey is string {
  const normalized = storageKey?.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  return Boolean(normalized && (normalized.startsWith("customer-assets/") || (normalized.startsWith("sites/") && normalized.includes("/customers/"))));
}

type TextReplacement = {
  from: string;
  to: string;
};

function applyTextReplacements(value: string, replacements: TextReplacement[]): string {
  return replacements.reduce((current, replacement) => {
    if (!replacement.from || replacement.from === replacement.to) return current;
    return current.split(replacement.from).join(replacement.to);
  }, value);
}

function deepReplaceText<T>(value: T, replacements: TextReplacement[]): T {
  if (typeof value === "string") return applyTextReplacements(value, replacements) as T;
  if (Array.isArray(value)) return value.map((item) => deepReplaceText(item, replacements)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, deepReplaceText(entryValue, replacements)])
    ) as T;
  }
  return value;
}

function siteTextReplacements(sourceSite: Site, targetSite: Site): TextReplacement[] {
  return [
    { from: sourceSite.name, to: targetSite.name },
    { from: sourceSite.branding.description, to: targetSite.branding.description },
    { from: sourceSite.branding.logoText, to: targetSite.branding.logoText }
  ]
    .filter((item) => item.from && item.to && item.from !== item.to)
    .sort((left, right) => right.from.length - left.from.length);
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function themeDraftEtag(page: ThemePage, revision: number, updatedAt: string): string {
  return crypto.createHash("sha256").update(`${page.siteId}:${page.id}:${revision}:${updatedAt}`).digest("base64url");
}

function ensureThemeDraftMeta(page: ThemePage): ThemeDraftMeta {
  if (page.draftMeta) return page.draftMeta;
  const updatedAt = new Date().toISOString();
  const revision = page.draftJson.version;
  const meta = { revision, updatedAt, etag: themeDraftEtag(page, revision, updatedAt) };
  page.draftMeta = meta;
  return meta;
}

function assertThemeDraftVersion(page: ThemePage, expected?: { expectedRevision?: number; expectedEtag?: string }) {
  if (expected?.expectedRevision === undefined && expected?.expectedEtag === undefined) return;
  const meta = ensureThemeDraftMeta(page);
  if (
    (expected.expectedRevision !== undefined && meta.revision !== expected.expectedRevision) ||
    (expected.expectedEtag !== undefined && meta.etag !== expected.expectedEtag)
  ) {
    throw new StoreError("theme_draft_conflict", 409);
  }
}

function bumpThemeDraftMeta(page: ThemePage): ThemeDraftMeta {
  const current = ensureThemeDraftMeta(page);
  const revision = current.revision + 1;
  const updatedAt = new Date().toISOString();
  const meta = { revision, updatedAt, etag: themeDraftEtag(page, revision, updatedAt) };
  page.draftMeta = meta;
  return meta;
}

function hashPassword(password: string): string {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

function verifyPassword(password: string, passwordHash?: string): boolean {
  return Boolean(passwordHash) && hashPassword(password) === passwordHash;
}

function readString(value: ThemeSettingValue | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const family = value.family;
    if (typeof family === "string") return family;
  }
  return undefined;
}

function navigationBlocks(
  links: ThemeNavLink[],
  prefix: "global_header" | "global_footer"
): SectionBlockInstance[] {
  return links.map((link, index) => ({
    id: `${prefix}_${index + 1}`,
    type: "menu_link",
    settings: {
      label: link.label,
      href: link.href,
      ...(link.group?.trim() ? { group: link.group.trim() } : {})
    }
  }));
}

function linksFromGlobalSection(section?: SectionInstance): ThemeNavLink[] {
  return (section?.blocks ?? [])
    .filter((block) => block.type === "menu_link")
    .map((block) => {
      const label = readString(block.settings.label)?.trim() || "Link";
      const href = readString(block.settings.href)?.trim() || "#";
      const group = readString(block.settings.group)?.trim();
      return {
        label,
        href,
        ...(group ? { group } : {})
      };
    });
}

function hasGroupedLinks(links: ThemeNavLink[]): boolean {
  return links.some((link) => Boolean(link.group?.trim()));
}

function normalizeNavigationLinks(links: ThemeNavLink[]): ThemeNavLink[] {
  return links
    .map((link) => {
      const label = String(link.label ?? "").trim();
      const href = String(link.href ?? "").trim() || "#";
      const group = link.group?.trim();
      if (!label) return null;
      return {
        label,
        href,
        ...(group ? { group } : {})
      };
    })
    .filter(Boolean) as ThemeNavLink[];
}

function navLinkIdentity(link: ThemeNavLink): string {
  return `${link.label.trim().toLowerCase()}::${link.href.trim().toLowerCase()}`;
}

function inferFooterGroup(link: ThemeNavLink): string | undefined {
  const value = `${link.label} ${link.href}`.toLowerCase();
  if (/(help|guide|about|contact|journal|blog|company|story)/.test(value)) return "company";
  if (/(privacy|refund|content|policy|support|faq|terms|cookie|shipping|delivery)/.test(value)) return "support";
  if (/(pricing|package|collection|style|example|work|tool|album|how it works)/.test(value)) return "product";
  return undefined;
}

function mergeFooterLinksWithStoredGroups(
  nextLinks: ThemeNavLink[],
  storedLinks: ThemeNavLink[]
): ThemeNavLink[] {
  if (!nextLinks.length) return storedLinks;
  const storedByIdentity = new Map(storedLinks.map((link) => [navLinkIdentity(link), link]));
  const storedByHref = new Map(storedLinks.map((link) => [link.href.trim().toLowerCase(), link]));
  const storedByLabel = new Map(storedLinks.map((link) => [link.label.trim().toLowerCase(), link]));
  return nextLinks.map((link) => {
    if (link.group?.trim()) return link;
    const stored =
      storedByIdentity.get(navLinkIdentity(link)) ??
      storedByHref.get(link.href.trim().toLowerCase()) ??
      storedByLabel.get(link.label.trim().toLowerCase());
    const mergedGroup = stored?.group?.trim() || inferFooterGroup(link);
    return mergedGroup ? { ...link, group: mergedGroup } : link;
  });
}

function packageNavigationLinks(
  themeKey: string,
  key: keyof ThemeSettings["navigation"]
): ThemeNavLink[] | undefined {
  const themePackage = getThemePackages().find((item) => item.key === themeKey);
  const links = themePackage?.siteSettings?.themeSettings?.navigation?.[key];
  return links ? normalizeNavigationLinks(cloneJson(links as ThemeNavLink[])) : undefined;
}

function isLegacyWeddingFooterNavigation(links: ThemeNavLink[]): boolean {
  if (links.length !== 5 || hasGroupedLinks(links)) return false;
  return JSON.stringify(links.map((link) => link.label)) === JSON.stringify([
    "Privacy",
    "Refunds",
    "Content policy",
    "Help center",
    "Journal"
  ]);
}

function repairThemeNavigation(settings: Site["themeSettings"]["draftJson"], themeKey: string) {
  settings.navigation.headerLinks = normalizeNavigationLinks(settings.navigation.headerLinks ?? []);
  settings.navigation.footerLinks = normalizeNavigationLinks(settings.navigation.footerLinks ?? []);

  const headerSection = normalizeGlobalSection("header", settings.globalSections?.header);
  const footerSection = normalizeGlobalSection("footer", settings.globalSections?.footer);
  const headerSectionLinks = linksFromGlobalSection(headerSection);
  const footerSectionLinks = linksFromGlobalSection(footerSection);

  if (!settings.navigation.headerLinks.length && headerSectionLinks.length) {
    settings.navigation.headerLinks = headerSectionLinks;
  }

  if (
    !settings.navigation.footerLinks.length ||
    (!hasGroupedLinks(settings.navigation.footerLinks) && hasGroupedLinks(footerSectionLinks))
  ) {
    settings.navigation.footerLinks = !settings.navigation.footerLinks.length
      ? (footerSectionLinks.length ? footerSectionLinks : settings.navigation.footerLinks)
      : mergeFooterLinksWithStoredGroups(settings.navigation.footerLinks, footerSectionLinks);
  }

  if (themeKey === "wedding-story-house" && isLegacyWeddingFooterNavigation(settings.navigation.footerLinks)) {
    settings.navigation.footerLinks = packageNavigationLinks(themeKey, "footerLinks") ?? settings.navigation.footerLinks;
  }
}

function syncNavigationIntoGlobalSections(settings: Site["themeSettings"]["draftJson"]) {
  settings.globalSections ??= {};
  settings.globalSections.header = normalizeGlobalSection("header", settings.globalSections.header);
  settings.globalSections.footer = normalizeGlobalSection("footer", settings.globalSections.footer);
  const preservedHeaderBlocks = (settings.globalSections.header.blocks ?? []).filter((block) => block.type !== "menu_link");
  const preservedFooterBlocks = (settings.globalSections.footer.blocks ?? []).filter((block) => block.type !== "menu_link");
  settings.globalSections.header.blocks = [...navigationBlocks(settings.navigation.headerLinks, "global_header"), ...preservedHeaderBlocks];
  settings.globalSections.footer.blocks = [...navigationBlocks(settings.navigation.footerLinks, "global_footer"), ...preservedFooterBlocks];
}

function withNormalizedThemeSettings(settings: Site["themeSettings"]["draftJson"], themeKey = "theme1"): Site["themeSettings"]["draftJson"] {
  const next = {
    ...settings,
    globalSections: {
      header: normalizeGlobalSection("header", settings.globalSections?.header),
      footer: normalizeGlobalSection("footer", settings.globalSections?.footer)
    },
    saasSettingsCurrent: normalizeSaasSettingsCurrentForTheme(themeKey, settings.saasSettingsCurrent)
  };
  const current = next.saasSettingsCurrent;
  next.colors = {
    ...next.colors,
    background: readString(current.skin_bg) ?? next.colors.background,
    foreground: readString(current.skin_title_color) ?? next.colors.foreground,
    accent: readString(current.skin_price_color ?? current.skin_primary_btn_bg_color) ?? next.colors.accent,
    muted: readString(current.skin_muted_color) ?? next.colors.muted
  };
  next.typography = {
    ...next.typography,
    display: readString(current.skin_title_font_family) ?? next.typography.display,
    body: readString(current.skin_text_font_family) ?? next.typography.body
  };
  repairThemeNavigation(next, themeKey);
  syncNavigationIntoGlobalSections(next);
  return next;
}

function withNormalizedSiteThemeSettings(site: Site, settings: Site["themeSettings"]["draftJson"], themeKey = "theme1"): Site["themeSettings"]["draftJson"] {
  return withNormalizedSeo(site, withNormalizedThemeSettings(settings, themeKey));
}

function pageTypeToSaasTemplateName(pageType: string): string {
  if (pageType === "home") return "index";
  if (pageType === "ai_tool") return "product";
  if (pageType === "pricing") return "page";
  return pageType;
}

const legacyImportedSectionTypes = new Set([
  "slide",
  "slide_plus",
  "slide_banner",
  "collection_list",
  "collection_list_plus",
  "collection_slider",
  "products_plus",
  "feature_columns",
  "logo_bar",
  "reveal_slide",
  "vertical_showcase_slider",
  "header_plus",
  "footer_plus"
]);

function pageSaasTemplateKey(page: Pick<ThemePage, "pageType" | "templateKey">): string {
  return page.templateKey?.trim() || pageTypeToSaasTemplateName(page.pageType);
}

function pageIdForTemplate(siteId: string, templateKey: string): string {
  if (templateKey === "index") return `${siteId}_home`;
  if (templateKey === "page") return `${siteId}_pricing`;
  if (templateKey === "product") return `${siteId}_tool_image`;
  return `${siteId}_${templateKey}`;
}

function fallbackPageTitle(templateKey: string): string {
  const labels: Record<string, string> = {
    "404": "404",
    "account-billing": "Account and billing",
    "app-home": "Customer workspace",
    album: "Album",
    cart: "Cart",
    collection: "Collection",
    "job-detail": "Job detail",
    "job-progress": "Job progress",
    index: "Home",
    login: "Login",
    page: "Pricing",
    product: "Image Studio",
    search: "Search"
  };
  return labels[templateKey] ?? templateKey;
}

function fallbackPageSlug(templateKey: string): string {
  const slugs: Record<string, string> = {
    "404": "/404",
    "account-billing": "/account",
    "app-home": "/app",
    album: "/album",
    cart: "/cart",
    collection: "/collections",
    "job-detail": "/app/jobs/detail",
    "job-progress": "/app/jobs/progress",
    index: "/",
    login: "/login",
    page: "/pricing",
    product: "/tools/headshot",
    search: "/search"
  };
  return slugs[templateKey] ?? `/${templateKey}`;
}

function applyDefaultSectionSetting(
  pageJson: ThemePageJson,
  sectionId: string,
  sectionType: string,
  key: string,
  value: ThemeSettingValue
) {
  const section = pageJson.sections[sectionId];
  if (!section || section.type !== sectionType) return;
  if (section.settings[key] !== undefined && section.settings[key] !== null && String(section.settings[key]).trim() !== "") return;
  section.settings[key] = value;
}

function withNormalizedAiSectionSurfaces(page: ThemePage): ThemePage {
  const next = {
    ...page,
    draftJson: cloneJson(page.draftJson),
    publishedJson: cloneJson(page.publishedJson)
  };

  const apply = (pageJson: ThemePageJson) => {
    if (page.slug === "/app") {
      applyDefaultSectionSetting(pageJson, "workspace_1", "ai_feature_launcher", "surface", "workspace");
      applyDefaultSectionSetting(pageJson, "upload_1", "upload_panel", "surface", "workspace");
      applyDefaultSectionSetting(pageJson, "form_1", "generation_form", "surface", "workspace");
      applyDefaultSectionSetting(pageJson, "progress_1", "job_progress", "surface", "workspace");
      applyDefaultSectionSetting(pageJson, "album_1", "album_gallery", "surface", "immersive");
    }

    if (page.slug === "/app/jobs/progress") {
      applyDefaultSectionSetting(pageJson, "progress_1", "job_progress", "surface", "timeline");
      applyDefaultSectionSetting(pageJson, "album_1", "album_gallery", "surface", "immersive");
    }

    if (page.slug === "/account") {
      applyDefaultSectionSetting(pageJson, "account_ops_1", "ai_feature_launcher", "surface", "account");
      applyDefaultSectionSetting(pageJson, "album_1", "album_gallery", "surface", "immersive");
    }

    if (page.slug === "/album") {
      applyDefaultSectionSetting(pageJson, "account_ops_1", "ai_feature_launcher", "surface", "account");
      applyDefaultSectionSetting(pageJson, "album_1", "album_gallery", "surface", "immersive");
    }
  };

  apply(next.draftJson);
  apply(next.publishedJson);
  return next;
}

function fallbackPageType(templateKey: string): string {
  const pageTypes: Record<string, string> = {
    "account-billing": "account",
    "app-home": "workspace",
    "job-detail": "job_detail",
    "job-progress": "job_progress",
    index: "home",
    page: "pricing",
    product: "ai_tool"
  };
  return pageTypes[templateKey] ?? templateKey;
}

function seededOverlapCount(pageJson: ThemePageJson, seededPageJson: ThemePageJson): number {
  const seededIds = new Set(seededPageJson.sectionsOrder);
  return pageJson.sectionsOrder.filter((sectionId) => seededIds.has(sectionId)).length;
}

function shouldAlignPageWithSeed(pageJson: ThemePageJson, seededPageJson: ThemePageJson): boolean {
  if (!pageJson.sectionsOrder.length) return true;
  if (!seededPageJson.sectionsOrder.length) return false;
  const overlapCount = seededOverlapCount(pageJson, seededPageJson);
  return overlapCount >= Math.max(3, Math.ceil(seededPageJson.sectionsOrder.length * 0.5));
}

function normalizePageJsonWithSeed(pageJson: ThemePageJson, seededPageJson: ThemePageJson): ThemePageJson {
  if (!shouldAlignPageWithSeed(pageJson, seededPageJson)) return pageJson;

  const nextSections = cloneJson(pageJson.sections);
  for (const seededSectionId of seededPageJson.sectionsOrder) {
    if (!nextSections[seededSectionId] && seededPageJson.sections[seededSectionId]) {
      nextSections[seededSectionId] = cloneJson(seededPageJson.sections[seededSectionId]);
    }
  }

  const seededOrder = seededPageJson.sectionsOrder.filter((sectionId) => Boolean(nextSections[sectionId]));
  const additionalIds = pageJson.sectionsOrder.filter((sectionId) => {
    if (seededOrder.includes(sectionId)) return false;
    if (sectionId.startsWith("smoke_")) return true;
    const sectionType = nextSections[sectionId]?.type;
    return !sectionType || !legacyImportedSectionTypes.has(sectionType);
  });
  const sectionsOrder = Array.from(new Set([...seededOrder, ...additionalIds])).filter((sectionId) => Boolean(nextSections[sectionId]));

  return {
    ...pageJson,
    sectionsOrder,
    sections: Object.fromEntries(sectionsOrder.map((sectionId) => [sectionId, nextSections[sectionId]]))
  };
}

function normalizeThemeTemplatesWithSeed(
  templates: SaasThemeTemplates,
  seededPagesByTemplateKey: Map<string, ThemePage>
): SaasThemeTemplates {
  const nextTemplates = cloneJson(templates) as SaasThemeTemplates;
  for (const [templateKey, seededPage] of seededPagesByTemplateKey.entries()) {
    const template = nextTemplates[templateKey];
    if (!template) {
      nextTemplates[templateKey] = toSaasTemplate(seededPage.draftJson);
      continue;
    }
    const pageType = fallbackPageType(templateKey);
    const pageJson = fromSaasTemplate(template, pageType, seededPage.draftJson.version);
    const normalized = normalizePageJsonWithSeed(pageJson, seededPage.draftJson);
    nextTemplates[templateKey] = toSaasTemplate(normalized);
  }
  return nextTemplates;
}

function internalThemeTemplateForPage(themeKey: string, page: ThemePage): SaasThemeTemplates[string] | undefined {
  const templateName = mapInternalTemplateKey(pageSaasTemplateKey(page));
  const pageJson = themePackageTemplateToPageJson(themeKey, templateName as never, page.pageType, page.draftJson.version);
  return pageJson ? toSaasTemplate(pageJson) : undefined;
}

function supplementInternalThemeRecordTemplates(theme: SaasThemeRecord, pages: ThemePage[]): SaasThemeRecord {
  if (!internalThemePackageForKey(theme.themeKey)) return theme;
  const next = {
    ...theme,
    templates: cloneJson(theme.templates) as SaasThemeTemplates
  };
  for (const page of pages) {
    const templateKey = pageSaasTemplateKey(page);
    if (next.templates[templateKey]) continue;
    const template = internalThemeTemplateForPage(theme.themeKey, page);
    if (template) next.templates[templateKey] = template;
  }
  return next;
}

function importedDemoHeader(settings: Site["themeSettings"]["draftJson"]) {
  return settings.saasSettingsCurrent?.sections &&
    typeof settings.saasSettingsCurrent.sections === "object" &&
    !Array.isArray(settings.saasSettingsCurrent.sections)
    ? (settings.saasSettingsCurrent.sections as Record<string, ThemeSettingValue>).header_plus as Record<string, ThemeSettingValue> | undefined
    : undefined;
}

function shouldRestoreSeedThemeSettings(
  settings: Site["themeSettings"]["draftJson"],
  pageJson: ThemePageJson,
  seededPageJson: ThemePageJson
): boolean {
  if (!shouldAlignPageWithSeed(pageJson, seededPageJson)) return false;
  const header = importedDemoHeader(settings);
  const announceTitle = readString(header?.settings && typeof header.settings === "object" ? (header.settings as Record<string, ThemeSettingValue>).announce_title : undefined);
  return announceTitle === "We Offer Free Shipping Worldwide." || settings.colors.accent === "#9B3C44";
}

function shouldRepairLegacySeedTheme(site: Site, seeded: Site, mode: "draft" | "published"): boolean {
  if (site.id === "site_lumen") return false;
  if (site.id !== seeded.id) return false;
  const settings = mode === "draft" ? site.themeSettings.draftJson : site.themeSettings.publishedJson;
  const headerTitle = readString(settings.globalSections?.header?.settings?.title);
  const footerTitle = readString(settings.globalSections?.footer?.settings?.title);
  return headerTitle === "Lumen" && footerTitle === "Lumen Portrait Works";
}

function inferSiteThemeKey(
  state: Pick<PlatformState, "siteThemes" | "themePublications">,
  site: Pick<Site, "id">
): string {
  const siteThemes = (state.siteThemes ?? []).filter((theme) => theme.siteId === site.id);
  const latestActiveTheme = siteThemes
    .filter((theme) => theme.status === "active")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  if (latestActiveTheme?.themeKey?.trim()) return latestActiveTheme.themeKey;

  const latestSiteTheme = siteThemes
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  if (latestSiteTheme?.themeKey?.trim()) return latestSiteTheme.themeKey;

  const latestPublication = latestThemePublication(state as PlatformState, site.id);
  const publicationThemeKey = (
    latestPublication?.snapshot as { saasTheme?: { themeKey?: string } } | undefined
  )?.saasTheme?.themeKey;
  if (typeof publicationThemeKey === "string" && publicationThemeKey.trim()) return publicationThemeKey;

  return "ai_subscription_theme1";
}

function shouldSkipSeedAlignment(state: Pick<PlatformState, "siteThemes">, site: Site, seeded?: Site): boolean {
  if (!seeded) return true;
  if (site.name.trim() !== seeded.name.trim()) return true;
  if (site.branding.logoText.trim() !== seeded.branding.logoText.trim()) return true;
  if (site.branding.description.trim() !== seeded.branding.description.trim()) return true;
  return state.siteThemes.some((theme) => {
    if (theme.siteId !== site.id || theme.status !== "active") return false;
    if (theme.source !== "site") return true;
    return theme.themeKey !== "ai_subscription_theme1" && theme.themeKey !== "theme1";
  });
}

function mapInternalTemplateKey(templateKey: string): string {
  const mapped: Record<string, string> = {
    index: "home",
    page: "pricing",
    collection: "packages",
    product: "tool-detail",
    help: "help",
    blog: "blog-list",
    privacy: "policy",
    refunds: "policy",
    content: "policy",
    search: "search",
    cart: "cart",
    login: "login",
    "app-home": "app-home",
    "job-detail": "job-detail",
    "job-progress": "job-progress",
    album: "album",
    "account-billing": "account-billing",
    "404": "404"
  };
  return mapped[templateKey] ?? "home";
}

export function toPublicPlatformAdmin(admin: PlatformAdmin): PublicPlatformAdmin {
  const { passwordHash: _passwordHash, ...safe } = admin;
  return safe;
}

export function toPublicSiteAdmin(admin: SiteAdmin): PublicSiteAdmin {
  const { passwordHash: _passwordHash, ...safe } = admin;
  return safe;
}

export function toPublicCustomer(customer: Customer): PublicCustomer {
  const { passwordHash: _passwordHash, ...safe } = customer;
  return safe;
}

function normalizeState(state: PlatformState): PlatformState {
  const next = state as PlatformState;
  next.platformAdmins ??= [
    {
      id: "platform_admin_root",
      email: "platform@local.test",
      passwordHash: hashPassword("platform123"),
      displayName: "Platform Root",
      role: "super_admin",
      createdAt: new Date().toISOString()
    }
  ];
  next.platformAdmins = next.platformAdmins.map((admin) => ({
    ...admin,
    email: admin.email.trim().toLowerCase(),
    passwordHash: admin.passwordHash ?? hashPassword("platform123")
  }));
  next.platformSessions ??= [];
  next.platformEmailSettings ??= { provider: "resend" };
  const legacyEmailSettings = next.platformEmailSettings;
  next.platformEmailConfigs = (next.platformEmailConfigs ?? []).map((config) => normalizePlatformEmailConfig(config, legacyEmailSettings));
  if (!next.platformEmailConfigs.length) {
    next.platformEmailConfigs = [normalizePlatformEmailConfig({ id: "resend_default", label: "Default Resend", isDefault: true }, legacyEmailSettings)];
  }
  if (!next.platformEmailConfigs.some((config) => config.isDefault)) next.platformEmailConfigs[0].isDefault = true;
  next.siteEmailConfigAssignments = (next.siteEmailConfigAssignments ?? []).filter((assignment) => {
    return next.sites?.some((site) => site.id === assignment.siteId) && next.platformEmailConfigs?.some((config) => config.id === assignment.configId);
  });
  next.platformCloudflareAccounts ??= [];
  next.platformCloudflareAccounts = next.platformCloudflareAccounts.map((account) => {
    const id = account.id || `cf_${crypto.createHash("sha1").update(`${account.accountId}:${account.email}`).digest("hex").slice(0, 10)}`;
    const now = new Date().toISOString();
    return {
      ...account,
      id,
      label: account.label || account.email || account.accountId || id,
      email: account.email || "",
      createdAt: account.createdAt || account.updatedAt || now
    };
  });
  if (next.currentCloudflareAccountId && !next.platformCloudflareAccounts.some((account) => account.id === next.currentCloudflareAccountId)) {
    delete next.currentCloudflareAccountId;
  }
  next.platformAiProviders ??= [];
  next.currentAiProviderId ??= next.platformAiProviders.find((provider) => provider.preferred)?.id ?? next.platformAiProviders[0]?.id;
  next.siteDomains ??= next.sites.map((site) => ({
    id: `dom_${site.id}_primary`,
    siteId: site.id,
    domain: site.primaryDomain,
    isPrimary: true,
    status: site.status === "active" ? "active" : "pending",
    createdAt: new Date().toISOString()
  }));
  next.siteAdmins ??= next.sites.map((site) => ({
    id: `admin_${site.id}_owner`,
    siteId: site.id,
    email: `owner@${site.slug}.localhost`,
    passwordHash: hashPassword(`${site.slug}123`),
    displayName: `${site.name} Owner`,
    role: "owner",
    createdAt: new Date().toISOString()
  }));
  next.siteAdmins = next.siteAdmins.map((admin) => {
    const site = next.sites.find((item) => item.id === admin.siteId);
    return {
      ...admin,
      email: admin.email.trim().toLowerCase(),
      passwordHash: admin.passwordHash ?? hashPassword(`${site?.slug ?? "site"}123`)
    };
  });
  next.siteAdminSessions ??= [];
  next.customers = next.customers.map((customer) => ({
    ...customer,
    email: customer.email.trim().toLowerCase(),
    passwordHash: customer.passwordHash ?? hashPassword("mara123")
  }));
  next.customerSessions ??= [];
  next.orders ??= [];
  next.paymentEvents ??= [];
  next.subscriptions ??= [];
  next.aiGatewayGroups ??= next.sites.map((site) => ({
    id: `gw_${site.id}_primary`,
    siteId: site.id,
    name: `${site.branding.logoText} primary quota`,
    status: site.connect.chargesEnabled ? "active" : "paused",
    modelAllowlist: ["gpt-image-2", "gpt-4.1-mini"],
    monthlyQuota: 3000,
    usedQuota: 0,
    retryStatusCodes: [429, 500, 502, 503],
    rateLimitPerMinute: 30,
    accountPoolMode: "shared",
    unavailableReason: site.connect.chargesEnabled ? undefined : "Stripe Connect pending"
  }));
  next.jobs ??= [];
  next.assetUploads ??= [];
  next.creativePacks ??= [];
  next.creativePacks = next.creativePacks.map((pack) => ({
    ...pack,
    headline: pack.headline ?? pack.name,
    description: pack.description ?? `${pack.name} creative pack.`,
    outputCount: pack.outputCount ?? (pack.category === "fashion" ? 40 : 20),
    trainingRequired: pack.trainingRequired ?? pack.category !== "copy"
  }));
  next.mediaAssets ??= [];
  next.themePublications ??= [];
  next.siteThemes ??= [];
  next.themeCopies ??= [];
  next.customerModels ??= [];
  next.albums ??= [];
  const legacyPublications = (next as unknown as { publications?: ThemePublication[] }).publications;
  if (legacyPublications?.length && !next.themePublications.length) {
    next.themePublications = legacyPublications;
  }
  next.auditLogs ??= [];
  next.ledger ??= [];
  const seededSites = new Map(seedState.sites.map((site) => [site.id, site]));
  next.sites = next.sites.map((site) => {
    const siteThemeKey = inferSiteThemeKey(next, site);
    const seeded = seededSites.get(site.id);
    const skipSeedAlignment = shouldSkipSeedAlignment(next, site, seeded);
    if (!seeded) {
      return {
        ...site,
        pages: site.pages
          .map((page) => ({ ...page, templateKey: pageSaasTemplateKey(page) }))
          .map((page) => withNormalizedAiSectionSurfaces(page)),
        themeSettings: {
          draftJson: withNormalizedSiteThemeSettings(site, site.themeSettings.draftJson, siteThemeKey),
          publishedJson: withNormalizedSiteThemeSettings(site, site.themeSettings.publishedJson, siteThemeKey)
        }
      };
    }
    const seededPages = new Map(seeded.pages.map((page) => [page.slug, page]));
    const normalizedPages = site.pages.map((page) => {
      const seededPage = seededPages.get(page.slug);
      if (!seededPage) return { ...page, templateKey: pageSaasTemplateKey(page) };
      if (skipSeedAlignment) {
        return {
          ...page,
          templateKey: page.templateKey ?? seededPage.templateKey ?? pageSaasTemplateKey(page)
        };
      }
      return {
        ...page,
        templateKey: page.templateKey ?? seededPage.templateKey ?? pageSaasTemplateKey(page),
        draftJson: normalizePageJsonWithSeed(page.draftJson, seededPage.draftJson),
        publishedJson: normalizePageJsonWithSeed(page.publishedJson, seededPage.publishedJson)
      };
    });
    const normalizedHome = normalizedPages.find((page) => page.slug === "/");
    const seededHome = seededPages.get("/");
    const restoreDraftSettings =
      !skipSeedAlignment && normalizedHome && seededHome
        ? shouldRestoreSeedThemeSettings(site.themeSettings.draftJson, normalizedHome.draftJson, seededHome.draftJson)
        : false;
    const restorePublishedSettings =
      !skipSeedAlignment && normalizedHome && seededHome
        ? shouldRestoreSeedThemeSettings(site.themeSettings.publishedJson, normalizedHome.publishedJson, seededHome.publishedJson)
        : false;
    const repairDraftSettings = shouldRepairLegacySeedTheme(site, seeded, "draft");
    const repairPublishedSettings = shouldRepairLegacySeedTheme(site, seeded, "published");
    const normalizedSite: Site = {
      ...site,
      pages: normalizedPages.map((page) => withNormalizedAiSectionSurfaces(page)),
      themeSettings: {
        draftJson: withNormalizedSiteThemeSettings(
          site,
          restoreDraftSettings || repairDraftSettings ? cloneJson(seeded.themeSettings.draftJson) : site.themeSettings.draftJson,
          siteThemeKey
        ),
        publishedJson: withNormalizedSiteThemeSettings(
          site,
          restorePublishedSettings || repairPublishedSettings ? cloneJson(seeded.themeSettings.publishedJson) : site.themeSettings.publishedJson,
          siteThemeKey
        )
      }
    };
    const existingTemplateKeys = new Set(normalizedSite.pages.map((page) => pageSaasTemplateKey(page)));
    for (const seededPage of seeded.pages) {
      const templateKey = pageSaasTemplateKey(seededPage);
      if (existingTemplateKeys.has(templateKey)) continue;
      normalizedSite.pages.push(withNormalizedAiSectionSurfaces({
        ...seededPage,
        id: pageIdForTemplate(site.id, templateKey),
        siteId: site.id,
        templateKey,
        draftJson: cloneJson(seededPage.draftJson),
        publishedJson: cloneJson(seededPage.publishedJson)
      }));
      existingTemplateKeys.add(templateKey);
    }
    return normalizedSite;
  });
  next.siteAiApps = next.siteAiApps.map((siteAiApp) => {
    const embeddedAiApp = siteAiApp.aiApp;
    const catalogAiApp =
      next.aiApps.find((app) => app.id === siteAiApp.aiApp?.id) ??
      next.aiApps.find((app) => app.slug === siteAiApp.aiApp?.slug);
    const hasSiteSpecificSchema =
      Array.isArray(embeddedAiApp?.parameterSchema) && embeddedAiApp.parameterSchema.length > 0;
    const aiApp = hasSiteSpecificSchema
      ? { ...(catalogAiApp ?? embeddedAiApp), ...embeddedAiApp }
      : (catalogAiApp ?? embeddedAiApp);
    return { ...siteAiApp, aiApp };
  });
  next.siteThemes = normalizeSiteThemes(next);
  return next;
}

function themeRecordFromSiteTheme(record: SiteTheme): SaasThemeRecord {
  return {
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status,
    templates: cloneJson(record.templates) as SaasThemeTemplates,
    settings: cloneJson(record.settings) as SaasThemeSettingsRecord,
    updatedAt: record.updatedAt
  };
}

function siteThemeFromRecord(params: {
  id: string;
  siteId: string;
  record: SaasThemeRecord;
  source: SiteTheme["source"];
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}): SiteTheme {
  const now = new Date().toISOString();
  return {
    id: params.id,
    siteId: params.siteId,
    name: params.record.name,
    themeId: params.record.themeId,
    themeKey: params.record.themeKey,
    status: params.record.status,
    templates: cloneJson(params.record.templates),
    settings: cloneJson(params.record.settings),
    source: params.source,
    createdBy: params.createdBy,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? params.createdAt ?? now
  };
}

function applyInternalThemePackageSiteSettings(
  base: Site["themeSettings"]["draftJson"],
  siteSettings?: ThemePackageSiteSettings
): Site["themeSettings"]["draftJson"] {
  const next = cloneJson(base);
  const themeSettings = siteSettings?.themeSettings;
  if (!themeSettings) return next;

  if (themeSettings.colors) next.colors = { ...next.colors, ...themeSettings.colors };
  if (themeSettings.typography) next.typography = { ...next.typography, ...themeSettings.typography };
  if (themeSettings.radii) next.radii = { ...next.radii, ...themeSettings.radii };
  if (themeSettings.navigation?.headerLinks) next.navigation.headerLinks = cloneJson(themeSettings.navigation.headerLinks);
  if (themeSettings.navigation?.footerLinks) next.navigation.footerLinks = cloneJson(themeSettings.navigation.footerLinks);

  const baseHeader = normalizeGlobalSection("header", next.globalSections?.header);
  const baseFooter = normalizeGlobalSection("footer", next.globalSections?.footer);
  next.globalSections = {
    header: baseHeader,
    footer: baseFooter
  };

  if (themeSettings.globalSections?.header) {
    const headerSource = themeSettings.globalSections.header;
    next.globalSections.header = normalizeGlobalSection("header", {
      settings: {
        ...baseHeader.settings,
        ...(headerSource.settings ?? {})
      },
      blocks: headerSource.blocks
        ? cloneJson(headerSource.blocks as SectionBlockInstance[])
        : baseHeader.blocks
    });
  }

  if (themeSettings.globalSections?.footer) {
    const footerSource = themeSettings.globalSections.footer;
    next.globalSections.footer = normalizeGlobalSection("footer", {
      settings: {
        ...baseFooter.settings,
        ...(footerSource.settings ?? {})
      },
      blocks: footerSource.blocks
        ? cloneJson(footerSource.blocks as SectionBlockInstance[])
        : baseFooter.blocks
    });
  }

  if (themeSettings.seo) {
    next.seo = {
      siteTitle: themeSettings.seo.siteTitle ?? next.seo?.siteTitle ?? "",
      siteDescription: themeSettings.seo.siteDescription ?? next.seo?.siteDescription ?? "",
      titleTemplate: themeSettings.seo.titleTemplate ?? next.seo?.titleTemplate ?? "",
      defaultOgImage: themeSettings.seo.defaultOgImage ?? next.seo?.defaultOgImage,
      robots: next.seo?.robots ?? { index: true, follow: true },
      pages: next.seo?.pages ?? {}
    };
  }

  if (themeSettings.saasSettingsCurrent) {
    next.saasSettingsCurrent = normalizeSaasSettingsCurrent({
      ...(next.saasSettingsCurrent ?? {}),
      ...(cloneJson(themeSettings.saasSettingsCurrent as Record<string, ThemeSettingValue>))
    });
  }

  return next;
}

function applyInternalThemePackageSiteIdentity(site: Site, siteSettings?: ThemePackageSiteSettings) {
  const branding = siteSettings?.branding;
  if (!branding) return;
  const logoText = branding.logoText?.trim();
  const market = branding.market?.trim();
  const description = branding.description?.trim();
  if (logoText) {
    site.name = siteSettings?.themeSettings?.seo?.siteTitle?.trim() || logoText;
    site.branding.logoText = logoText;
  }
  if (market) site.branding.market = market;
  if (description) site.branding.description = description;
}

function internalThemePackageForKey(themeKey: string): ThemePackageManifest | undefined {
  return getThemePackages().find((item) => item.key === themeKey);
}

function applyInternalThemePackageToSite(site: Site, themeKey: string, mode: "draft" | "published" = "published") {
  const themePackage = internalThemePackageForKey(themeKey);
  if (!themePackage?.siteSettings) return;
  if (mode === "draft") {
    site.themeSettings.draftJson = withNormalizedSiteThemeSettings(
      site,
      applyInternalThemePackageSiteSettings(site.themeSettings.draftJson, themePackage.siteSettings),
      themeKey
    );
    return;
  }
  applyInternalThemePackageSiteIdentity(site, themePackage.siteSettings);
  site.themeSettings.draftJson = withNormalizedSiteThemeSettings(
    site,
    applyInternalThemePackageSiteSettings(site.themeSettings.draftJson, themePackage.siteSettings),
    themeKey
  );
  site.themeSettings.publishedJson = withNormalizedSiteThemeSettings(
    site,
    applyInternalThemePackageSiteSettings(site.themeSettings.publishedJson, themePackage.siteSettings),
    themeKey
  );
}

function normalizeSiteThemes(state: PlatformState): SiteTheme[] {
  const records = [...(state.siteThemes ?? [])].map((theme) => ({
    ...theme,
    status: theme.status === "active" ? "active" as const : "draft" as const,
    source: theme.source ?? "site" as const
  }));
  for (const site of state.sites) {
    for (const theme of records.filter((item) => item.siteId === site.id)) {
      const supplemented = supplementInternalThemeRecordTemplates(themeRecordFromSiteTheme(theme), site.pages);
      theme.templates = cloneJson(supplemented.templates);
      theme.settings = cloneJson(supplemented.settings);
    }
    const seeded = seedState.sites.find((item) => item.id === site.id);
    const seededPagesByTemplateKey = new Map((seeded?.pages ?? []).map((page) => [pageSaasTemplateKey(page), page]));
    const siteRecords = records.filter((theme) => theme.siteId === site.id);
    if (!siteRecords.length) {
      const latestPublication = latestThemePublication(state, site.id);
      const draft = buildSaasThemeDraft(site);
      const active =
        (latestPublication?.snapshot.saasTheme as SaasThemeRecord | undefined) ??
        buildSaasThemePublication(site, latestPublication?.version ?? site.pages[0]?.publishedJson.version ?? 1).theme;
      records.push(
        siteThemeFromRecord({
          id: `theme_${site.id}_draft`,
          siteId: site.id,
          record: draft,
          source: "site",
          createdBy: "system",
          createdAt: site.pages[0]?.publishedJson.version ? latestPublication?.publishedAt : undefined,
          updatedAt: draft.updatedAt
        }),
        siteThemeFromRecord({
          id: `theme_${site.id}_active`,
          siteId: site.id,
          record: {
            ...active,
            status: "active",
            themeId: active.themeId || `${site.id}_active_v${latestPublication?.version ?? 1}`,
            updatedAt: latestPublication?.publishedAt ?? active.updatedAt
          },
          source: "site",
          createdBy: latestPublication?.publishedBy ?? "system",
          createdAt: latestPublication?.publishedAt,
          updatedAt: latestPublication?.publishedAt ?? active.updatedAt
        })
      );
      continue;
    }
    if (!siteRecords.some((theme) => theme.status === "draft")) {
      records.push(
        siteThemeFromRecord({
          id: `theme_${site.id}_draft`,
          siteId: site.id,
          record: buildSaasThemeDraft(site),
          source: "site",
          createdBy: "system"
        })
      );
    }
    if (!siteRecords.some((theme) => theme.status === "active")) {
      const latestPublication = latestThemePublication(state, site.id);
      const active =
        (latestPublication?.snapshot.saasTheme as SaasThemeRecord | undefined) ??
        buildSaasThemePublication(site, latestPublication?.version ?? site.pages[0]?.publishedJson.version ?? 1).theme;
      records.push(
        siteThemeFromRecord({
          id: `theme_${site.id}_active`,
          siteId: site.id,
          record: { ...active, status: "active" },
          source: "site",
          createdBy: latestPublication?.publishedBy ?? "system",
          createdAt: latestPublication?.publishedAt,
          updatedAt: latestPublication?.publishedAt ?? active.updatedAt
        })
      );
    }

    const latestPublication = latestThemePublication(state, site.id);
    const canonicalDraft = records.find((theme) => theme.siteId === site.id && theme.id === `theme_${site.id}_draft`);
    const canonicalActive = records.find((theme) => theme.siteId === site.id && theme.id === `theme_${site.id}_active`);
    const currentDraft = buildSaasThemeDraft(site);
    const currentPublished =
      (latestPublication?.snapshot.saasTheme as SaasThemeRecord | undefined) ??
      buildSaasThemePublication(site, latestPublication?.version ?? site.pages[0]?.publishedJson.version ?? 1).theme;

    if (canonicalDraft) {
      canonicalDraft.templates = normalizeThemeTemplatesWithSeed(cloneJson(currentDraft.templates), seededPagesByTemplateKey);
      canonicalDraft.settings = cloneJson(currentDraft.settings);
      canonicalDraft.themeKey = currentDraft.themeKey;
      canonicalDraft.updatedAt = currentDraft.updatedAt;
      canonicalDraft.source = "site";
      canonicalDraft.status = "draft";
    }

    if (canonicalActive) {
      canonicalActive.templates = normalizeThemeTemplatesWithSeed(cloneJson(currentPublished.templates), seededPagesByTemplateKey);
      canonicalActive.settings = cloneJson(currentPublished.settings);
      canonicalActive.themeKey = currentPublished.themeKey;
      canonicalActive.updatedAt = latestPublication?.publishedAt ?? currentPublished.updatedAt;
      canonicalActive.source = "site";
    }

    const siteRecordsAfterSync = records.filter((theme) => theme.siteId === site.id);
    const publishedTemplates = JSON.stringify(currentPublished.templates);
    const publishedSettings = JSON.stringify(currentPublished.settings);
    const exactMatches = siteRecordsAfterSync.filter(
      (theme) =>
        JSON.stringify(theme.templates) === publishedTemplates &&
        JSON.stringify(theme.settings) === publishedSettings
    );
    const preferredActive =
      exactMatches.find((theme) => theme.status === "active") ??
      exactMatches.find((theme) => theme.id === `theme_${site.id}_active`) ??
      exactMatches[0];

    if (preferredActive) {
      for (const theme of siteRecordsAfterSync) {
        theme.status = theme.id === preferredActive.id ? "active" : "draft";
      }
    }
  }
  return records;
}

export function readPlatformState(options: { fresh?: boolean } = {}): PlatformState {
  if (process.env.PERSISTENCE_BACKEND === "postgres") {
    const cachedState = options.fresh ? null : readPostgresStateCache();
    if (cachedState) return cachedState;
    let raw = "";
    try {
      raw = execFileSync(process.execPath, [postgresBridgeScript, "read"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: process.env,
        maxBuffer: 1024 * 1024 * 64
      }).trim();
    } catch (error) {
      if (!shouldFallbackToJsonState()) throw error;
      warnPostgresFallback(error);
      const fallbackState = readJsonPlatformStateFallback();
      writePostgresStateCache(fallbackState);
      return fallbackState;
    }
    if (raw) {
      const normalized = normalizeState(JSON.parse(raw) as PlatformState);
      writePostgresStateCache(normalized);
      return normalized;
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("Postgres platform state is empty; import platform state before starting production.");
    }
    return writePlatformState(cloneState(seedState));
  }
  if (!fs.existsSync(dataFile)) {
    return writePlatformState(cloneState(seedState));
  }
  return normalizeState(JSON.parse(fs.readFileSync(dataFile, "utf8")) as PlatformState);
}

export function writePlatformState(nextState: PlatformState): PlatformState {
  fs.mkdirSync(dataDir, { recursive: true });
  const normalized = normalizeState(nextState);
  if (process.env.PERSISTENCE_BACKEND === "postgres") {
    try {
      execFileSync(process.execPath, [postgresBridgeScript, "write"], {
        cwd: process.cwd(),
        input: JSON.stringify(normalized),
        encoding: "utf8",
        env: process.env,
        maxBuffer: 1024 * 1024 * 64
      });
    } catch (error) {
      if (!shouldFallbackToJsonState()) throw error;
      warnPostgresFallback(error);
      writePostgresStateCache(normalized);
      return writeJsonPlatformStateFallback(normalized);
    }
    writePostgresStateCache(normalized);
    return normalized;
  }
  fs.writeFileSync(dataFile, `${JSON.stringify(normalized, null, 2)}\n`);
  jsonStateCache = null;
  return normalized;
}

export function mutatePlatformState(mutator: (state: PlatformState) => void): PlatformState {
  const state = readPlatformState({ fresh: true });
  mutator(state);
  return writePlatformState(state);
}

export function getSiteBySlugFromStore(slug: string): Site | undefined {
  return readPlatformState().sites.find((site) => site.slug === slug);
}

export function getSiteByIdFromStore(siteId: string): Site | undefined {
  return readPlatformState().sites.find((site) => site.id === siteId);
}

export function getPlatformAdminBySessionFromState(
  state: PlatformState,
  sessionId?: string
): { platformAdmin: PlatformAdmin; session: PlatformSession } | undefined {
  if (!sessionId) return undefined;
  const now = Date.now();
  const session = state.platformSessions.find((item) => item.id === sessionId && new Date(item.expiresAt).getTime() > now);
  const platformAdmin = session ? state.platformAdmins.find((item) => item.id === session.platformAdminId) : undefined;
  return session && platformAdmin ? { platformAdmin, session } : undefined;
}

export function getSiteAdminBySessionFromState(
  state: PlatformState,
  siteId: string,
  sessionId?: string
): { siteAdmin: SiteAdmin; session: SiteAdminSession } | undefined {
  if (!sessionId) return undefined;
  const now = Date.now();
  const session = state.siteAdminSessions.find(
    (item) => item.id === sessionId && item.siteId === siteId && new Date(item.expiresAt).getTime() > now
  );
  const siteAdmin = session ? state.siteAdmins.find((item) => item.id === session.siteAdminId && item.siteId === siteId) : undefined;
  return session && siteAdmin ? { siteAdmin, session } : undefined;
}

export function getSiteProductsFromState(state: PlatformState, siteId: string): Product[] {
  return state.products.filter((product) => product.siteId === siteId);
}

export function getSiteAppsFromState(state: PlatformState, siteId: string): SiteAiApp[] {
  return state.siteAiApps.filter((app) => app.siteId === siteId);
}

export function getSiteJobsFromState(state: PlatformState, siteId: string): GenerationJob[] {
  return state.jobs.filter((job) => job.siteId === siteId);
}

export function getSiteLedgerFromState(state: PlatformState, siteId: string): CreditLedgerEntry[] {
  return state.ledger.filter((entry) => entry.siteId === siteId);
}

export function getSiteCustomersFromState(state: PlatformState, siteId: string): Customer[] {
  return state.customers.filter((customer) => customer.siteId === siteId);
}

export function getPublicSiteCustomersFromState(state: PlatformState, siteId: string): PublicCustomer[] {
  return getSiteCustomersFromState(state, siteId).map(toPublicCustomer);
}

export function getSiteDomainsFromState(state: PlatformState, siteId: string): SiteDomain[] {
  return state.siteDomains.filter((domain) => domain.siteId === siteId);
}

export function getSiteAdminsFromState(state: PlatformState, siteId: string): SiteAdmin[] {
  return state.siteAdmins.filter((admin) => admin.siteId === siteId);
}

export function getPublicSiteAdminsFromState(state: PlatformState, siteId: string): PublicSiteAdmin[] {
  return getSiteAdminsFromState(state, siteId).map(toPublicSiteAdmin);
}

export function getSiteGatewayGroupsFromState(state: PlatformState, siteId: string): AiGatewayGroup[] {
  return state.aiGatewayGroups.filter((group) => group.siteId === siteId);
}

export function getSiteSubscriptionsFromState(state: PlatformState, siteId: string): Subscription[] {
  return state.subscriptions.filter((subscription) => subscription.siteId === siteId);
}

export function getSiteOrdersFromState(state: PlatformState, siteId: string): Order[] {
  return state.orders.filter((order) => order.siteId === siteId);
}

export function getSiteCreativePacksFromState(state: PlatformState, siteId: string): CreativePack[] {
  return state.creativePacks.filter((pack) => pack.siteId === siteId);
}

export function getSiteMediaAssetsFromState(state: PlatformState, siteId: string): MediaAsset[] {
  return state.mediaAssets.filter((asset) => asset.siteId === siteId);
}

export function deleteThemeMediaAsset(params: { siteId: string; assetId: string }): { asset: MediaAsset } {
  let result: { asset: MediaAsset } | undefined;
  mutatePlatformState((state) => {
    const index = state.mediaAssets.findIndex((asset) => asset.siteId === params.siteId && asset.id === params.assetId);
    if (index === -1) throw new StoreError("theme_media_not_found", 404);
    const [asset] = state.mediaAssets.splice(index, 1);
    result = { asset };
  });
  if (!result) throw new StoreError("theme_media_delete_failed", 500);
  return result;
}

export function getSiteThemePublicationsFromState(state: PlatformState, siteId: string): ThemePublication[] {
  return state.themePublications.filter((publication) => publication.siteId === siteId);
}

export function getSiteThemeCopiesFromState(state: PlatformState, siteId: string): ThemeCopy[] {
  return state.themeCopies.filter((themeCopy) => themeCopy.siteId === siteId);
}

export function getSiteThemesFromState(state: PlatformState, siteId: string): SiteTheme[] {
  return state.siteThemes.filter((theme) => theme.siteId === siteId);
}

export function getSiteCustomerModelsFromState(state: PlatformState, siteId: string): CustomerModel[] {
  return state.customerModels.filter((model) => model.siteId === siteId);
}

export function getSiteAlbumsFromState(state: PlatformState, siteId: string): Album[] {
  return state.albums.filter((album) => album.siteId === siteId);
}

export function getSiteAuditLogsFromState(state: PlatformState, siteId: string): AuditLogEntry[] {
  return state.auditLogs.filter((entry) => entry.siteId === siteId);
}

export function getPlatformAuditLogsFromState(state: PlatformState): AuditLogEntry[] {
  return state.auditLogs;
}

export function getCustomerJobsFromState(state: PlatformState, siteId: string, customerId: string): GenerationJob[] {
  return state.jobs.filter((job) => job.siteId === siteId && job.customerId === customerId);
}

export function getCustomerLedgerFromState(state: PlatformState, siteId: string, customerId: string): CreditLedgerEntry[] {
  return state.ledger.filter((entry) => entry.siteId === siteId && entry.customerId === customerId);
}

export function getCustomerAssetsFromState(state: PlatformState, siteId: string, customerId: string): AssetUpload[] {
  return state.assetUploads.filter((asset) => asset.siteId === siteId && asset.customerId === customerId && !asset.deletedAt);
}

export function getCustomerJobAssetsFromState(state: PlatformState, siteId: string, customerId: string, jobId: string): AssetUpload[] {
  return state.assetUploads.filter(
    (asset) => asset.siteId === siteId && asset.customerId === customerId && asset.jobId === jobId && !asset.deletedAt
  );
}

function runtimeSiteForState(state: PlatformState, siteId: string): Site | undefined {
  const site = state.sites.find((item) => item.id === siteId);
  return site ? { ...site, mediaAssets: getSiteMediaAssetsFromState(state, siteId) } : undefined;
}

export function toThemeRuntimeJob(job: GenerationJob): ThemeRuntimeJob {
  return {
    id: job.id,
    aiAppId: job.aiAppId,
    status: job.status,
    creditsReserved: job.creditsReserved,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    requestJson: job.requestJson,
    resultJson: job.resultJson
  };
}

export function toThemeRuntimeAsset(state: PlatformState, asset: AssetUpload): ThemeRuntimeAsset {
  const site = runtimeSiteForState(state, asset.siteId);
  const storageKey = asset.storageKey?.trim();
  const isCustomerAsset = isCustomerAssetStorageKey(storageKey);
  const hasReadablePreview = !isCustomerAsset || customerAssetFileExists(storageKey);
  const previewUrl = site ? resolveMediaAssetUrl(site, storageKey) : "";
  return {
    id: asset.id,
    jobId: asset.jobId,
    subjectRole: asset.subjectRole,
    label: asset.label,
    storageKey,
    previewUrl,
    previewStatus: hasReadablePreview ? "ready" : "loading",
    downloadUrl: `/api/sites/${asset.siteId}/customers/${asset.customerId}/assets/${asset.id}/download`,
    mimeType: asset.mimeType,
    role: asset.role,
    reviewStatus: asset.reviewStatus,
    createdAt: asset.createdAt
  };
}

export function toThemeRuntimeAlbum(album: Album): ThemeRuntimeAlbum {
  return {
    id: album.id,
    title: album.title,
    sourceJobId: album.sourceJobId,
    creativePackId: album.creativePackId,
    status: album.status,
    outputCount: album.outputCount,
    coverAssetId: album.coverAssetId,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt
  };
}

export function toThemeRuntimeLedgerEntry(entry: CreditLedgerEntry): ThemeRuntimeLedgerEntry {
  return {
    id: entry.id,
    amount: entry.amount,
    type: entry.type,
    createdAt: entry.createdAt
  };
}

export function toThemeRuntimeCustomerModel(model: CustomerModel): ThemeRuntimeCustomerModel {
  return {
    id: model.id,
    label: model.label,
    modelType: model.modelType,
    status: model.status,
    inputAssetCount: model.inputAssetCount,
    minInputAssets: model.minInputAssets,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt
  };
}

export function toThemeRuntimeSubscription(subscription: Subscription): ThemeRuntimeSubscription {
  return {
    id: subscription.id,
    productId: subscription.productId,
    priceId: subscription.priceId,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    creditsPerCycle: subscription.creditsPerCycle,
    createdAt: subscription.createdAt
  };
}

export function toThemeRuntimeOrder(order: Order): ThemeRuntimeOrder {
  return {
    id: order.id,
    status: order.status,
    amountCents: order.amountCents,
    currency: order.currency,
    credits: order.credits,
    sourceId: order.sourceId,
    createdAt: order.createdAt
  };
}

export function getThemeRuntimeForCustomer(state: PlatformState, siteId: string, customerId: string): ThemeRuntimeData {
  const customer = state.customers.find((item) => item.siteId === siteId && item.id === customerId);
  const jobs = getCustomerJobsFromState(state, siteId, customerId);
  const assets = getCustomerAssetsFromState(state, siteId, customerId);
  const albums = getSiteAlbumsFromState(state, siteId).filter((album) => album.customerId === customerId);
  const ledger = getCustomerLedgerFromState(state, siteId, customerId);
  const customerModels = getSiteCustomerModelsFromState(state, siteId).filter((model) => model.customerId === customerId);
  const subscriptions = state.subscriptions.filter((subscription) => subscription.siteId === siteId && subscription.customerId === customerId);
  const orders = state.orders.filter((order) => order.siteId === siteId && order.customerId === customerId);
  return {
    customer: customer ? toPublicCustomer(customer) : undefined,
    jobs: jobs.map(toThemeRuntimeJob),
    assets: assets.map((asset) => toThemeRuntimeAsset(state, asset)),
    albums: albums.map(toThemeRuntimeAlbum),
    ledger: ledger.map(toThemeRuntimeLedgerEntry),
    customerModels: customerModels.map(toThemeRuntimeCustomerModel),
    subscriptions: subscriptions.map(toThemeRuntimeSubscription),
    orders: orders.map(toThemeRuntimeOrder)
  };
}

export function getThemeRuntimeFromSession(
  state: PlatformState,
  siteId: string,
  sessionId?: string
): ThemeRuntimeData {
  const current = getCustomerBySessionFromState(state, siteId, sessionId);
  if (!current) {
    return {
      jobs: [],
      assets: [],
      albums: [],
      ledger: [],
      subscriptions: [],
      orders: [],
      customerModels: []
    };
  }
  return getThemeRuntimeForCustomer(state, siteId, current.customer.id);
}

export function getPreviewThemeRuntime(state: PlatformState, siteId: string): ThemeRuntimeData {
  const primaryCustomer = state.customers.find((item) => item.siteId === siteId && item.status !== "blocked");
  const base = primaryCustomer
    ? getThemeRuntimeForCustomer(state, siteId, primaryCustomer.id)
    : {
        jobs: [],
        assets: [],
        albums: [],
        ledger: [],
        subscriptions: [],
        orders: [],
        customerModels: []
      };
  return {
    ...base,
    isPreview: true
  };
}

export function createAssetUpload(params: {
  siteId: string;
  customerId: string;
  label: string;
  mimeType: string;
  role?: AssetUpload["role"];
  jobId?: string;
  storageKey?: string;
}): { asset: AssetUpload } {
  let result: { asset: AssetUpload } | undefined;
  mutatePlatformState((state) => {
    const customer = state.customers.find((item) => item.siteId === params.siteId && item.id === params.customerId);
    if (!customer) throw new StoreError("customer_not_found_for_site", 404);
    const label = params.label.trim();
    if (!label) throw new StoreError("asset_label_required", 400);
    const mimeType = params.mimeType.trim();
    if (!mimeType.includes("/")) throw new StoreError("invalid_mime_type", 400);
    const assetId = uid("asset");
    const storageKey =
      params.storageKey ??
      `sites/${params.siteId}/customers/${params.customerId}/assets/${assetId}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const asset: AssetUpload = {
      id: assetId,
      siteId: params.siteId,
      customerId: params.customerId,
      jobId: params.jobId,
      label,
      storageKey,
      mimeType,
      role: params.role ?? "input",
      visibility: "private",
      reviewStatus: "approved",
      createdAt: new Date().toISOString()
    };
    state.assetUploads.unshift(asset);
    result = { asset };
  });
  if (!result) throw new StoreError("asset_create_failed", 500);
  return result;
}

export function writeCustomerAssetFile(params: {
  storageKey: string;
  bytes: Buffer;
}): { path: string; size: number } {
  return storageWriteCustomerAssetFile(params);
}

export function readCustomerAssetFile(params: {
  siteId: string;
  customerId: string;
  assetId: string;
}): { asset: AssetUpload; bytes: Buffer } {
  const state = readPlatformState();
  const asset = state.assetUploads.find(
    (item) => item.siteId === params.siteId && item.customerId === params.customerId && item.id === params.assetId && !item.deletedAt
  );
  if (!asset) throw new StoreError("asset_not_found_for_customer", 404);
  const filePath = customerAssetFilePath(asset.storageKey);
  if (!fs.existsSync(filePath)) throw new StoreError("asset_file_missing", 404);
  return { asset, bytes: fs.readFileSync(filePath) };
}

export function deleteAssetUpload(params: {
  siteId: string;
  customerId: string;
  assetId: string;
}): { asset: AssetUpload } {
  let result: { asset: AssetUpload } | undefined;
  mutatePlatformState((state) => {
    const asset = state.assetUploads.find(
      (item) => item.siteId === params.siteId && item.customerId === params.customerId && item.id === params.assetId
    );
    if (!asset) throw new StoreError("asset_not_found_for_customer", 404);
    asset.deletedAt = new Date().toISOString();
    try {
      storageDeleteCustomerAssetFile(asset.storageKey);
    } catch {
      // The metadata delete should still succeed if the file was already gone.
    }
    result = { asset };
  });
  if (!result) throw new StoreError("asset_delete_failed", 500);
  return result;
}

export function createAssetDownloadLink(params: {
  siteId: string;
  customerId: string;
  assetId: string;
}): { asset: AssetUpload; downloadUrl: string; expiresAt: string } {
  const state = readPlatformState();
  const asset = state.assetUploads.find(
    (item) => item.siteId === params.siteId && item.customerId === params.customerId && item.id === params.assetId && !item.deletedAt
  );
  if (!asset) throw new StoreError("asset_not_found_for_customer", 404);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString();
  const token = Buffer.from(`${asset.id}:${asset.storageKey}:${expiresAt}`).toString("base64url");
  return {
    asset,
    downloadUrl: `/api/sites/${params.siteId}/customers/${params.customerId}/assets/${params.assetId}/download?token=${token}`,
    expiresAt
  };
}

export function upsertCreativePack(params: {
  siteId: string;
  packId?: string;
  name: string;
  headline: string;
  description: string;
  category: CreativePack["category"];
  aiAppSlug: string;
  status: CreativePack["status"];
  creditCost: number;
  outputCount: number;
  trainingRequired: boolean;
  imageUrl?: string;
}): { pack: CreativePack; created: boolean } {
  let result: { pack: CreativePack; created: boolean } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const name = params.name.trim();
    if (name.length < 2) throw new StoreError("creative_pack_name_required", 400);
    const headline = params.headline.trim() || name;
    const description = params.description.trim();
    const imageUrl = params.imageUrl?.trim() || undefined;
    if (description.length < 8) throw new StoreError("creative_pack_description_required", 400);
    if (!state.aiApps.some((app) => app.slug === params.aiAppSlug)) throw new StoreError("ai_app_not_found", 404);
    if (!Number.isInteger(params.creditCost) || params.creditCost < 0) throw new StoreError("invalid_credit_cost", 400);
    if (!Number.isInteger(params.outputCount) || params.outputCount < 1) throw new StoreError("invalid_output_count", 400);
    const existing = params.packId
      ? state.creativePacks.find((pack) => pack.siteId === params.siteId && pack.id === params.packId)
      : undefined;
    if (existing) {
      existing.name = name;
      existing.headline = headline;
      existing.description = description;
      existing.category = params.category;
      existing.aiAppSlug = params.aiAppSlug;
      existing.status = params.status;
      existing.creditCost = params.creditCost;
      existing.outputCount = params.outputCount;
      existing.trainingRequired = params.trainingRequired;
      existing.imageUrl = imageUrl;
      result = { pack: existing, created: false };
      return;
    }
    const pack: CreativePack = {
      id: params.packId ?? uid("pack"),
      siteId: params.siteId,
      name,
      headline,
      description,
      category: params.category,
      aiAppSlug: params.aiAppSlug,
      status: params.status,
      creditCost: params.creditCost,
      outputCount: params.outputCount,
      trainingRequired: params.trainingRequired,
      imageUrl,
      generationCount: 0,
      conversionRate: 0,
      createdAt: new Date().toISOString()
    };
    state.creativePacks.unshift(pack);
    result = { pack, created: true };
  });
  if (!result) throw new StoreError("creative_pack_save_failed", 500);
  return result;
}

export function deleteCreativePack(params: {
  siteId: string;
  packId: string;
}): { deletedPack: CreativePack } {
  let result: { deletedPack: CreativePack } | undefined;
  mutatePlatformState((state) => {
    const index = state.creativePacks.findIndex((pack) => pack.siteId === params.siteId && pack.id === params.packId);
    if (index === -1) throw new StoreError("creative_pack_not_found", 404);
    const [deletedPack] = state.creativePacks.splice(index, 1);
    result = { deletedPack };
  });
  if (!result) throw new StoreError("creative_pack_delete_failed", 500);
  return result;
}

export function upsertThemeMediaAsset(params: {
  siteId: string;
  assetId?: string;
  label: string;
  storageKey: string;
  mimeType: string;
  usage: MediaAsset["usage"];
  sourceType?: MediaAsset["sourceType"];
  previewUrl?: string;
  originUrl?: string;
  altText?: string;
  notes?: string;
}): { asset: MediaAsset; created: boolean } {
  let result: { asset: MediaAsset; created: boolean } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const label = params.label.trim();
    const storageKey = params.storageKey.trim();
    const mimeType = params.mimeType.trim();
    const previewUrl = params.previewUrl?.trim();
    const originUrl = params.originUrl?.trim();
    const altText = params.altText?.trim();
    const notes = params.notes?.trim();
    if (label.length < 2) throw new StoreError("media_label_required", 400);
    if (!storageKey.startsWith(`sites/${params.siteId}/`)) throw new StoreError("media_storage_key_must_be_site_scoped", 400);
    if (!mimeType.includes("/")) throw new StoreError("invalid_mime_type", 400);
    const existing = params.assetId
      ? state.mediaAssets.find((asset) => asset.siteId === params.siteId && asset.id === params.assetId)
      : undefined;
    if (existing) {
      existing.label = label;
      existing.storageKey = storageKey;
      existing.mimeType = mimeType;
      existing.usage = params.usage;
      existing.sourceType = params.sourceType ?? existing.sourceType ?? "manual";
      existing.previewUrl = previewUrl || undefined;
      existing.originUrl = originUrl || undefined;
      existing.altText = altText || undefined;
      existing.notes = notes || undefined;
      result = { asset: existing, created: false };
      return;
    }
    const asset: MediaAsset = {
      id: params.assetId ?? uid("media"),
      siteId: params.siteId,
      label,
      storageKey,
      mimeType,
      usage: params.usage,
      sourceType: params.sourceType ?? "manual",
      previewUrl: previewUrl || undefined,
      originUrl: originUrl || undefined,
      altText: altText || undefined,
      notes: notes || undefined,
      createdAt: new Date().toISOString()
    };
    state.mediaAssets.unshift(asset);
    result = { asset, created: true };
  });
  if (!result) throw new StoreError("theme_media_save_failed", 500);
  return result;
}

export function updateCustomerModel(params: {
  siteId: string;
  modelId: string;
  status: CustomerModel["status"];
  providerModelId?: string;
  failureReason?: string;
  inputAssetCount?: number;
}): { model: CustomerModel } {
  let result: { model: CustomerModel } | undefined;
  mutatePlatformState((state) => {
    const model = state.customerModels.find((item) => item.siteId === params.siteId && item.id === params.modelId);
    if (!model) throw new StoreError("customer_model_not_found", 404);
    if (!["collecting_uploads", "training", "ready", "failed", "archived"].includes(params.status)) {
      throw new StoreError("invalid_customer_model_status", 400);
    }
    model.status = params.status;
    if (params.providerModelId !== undefined) {
      model.providerModelId = params.providerModelId.trim() || undefined;
    }
    if (params.failureReason !== undefined) {
      model.failureReason = params.failureReason.trim() || undefined;
    }
    if (typeof params.inputAssetCount === "number") {
      if (!Number.isInteger(params.inputAssetCount) || params.inputAssetCount < 0) throw new StoreError("invalid_input_asset_count", 400);
      model.inputAssetCount = params.inputAssetCount;
    }
    model.updatedAt = new Date().toISOString();
    result = { model };
  });
  if (!result) throw new StoreError("customer_model_update_failed", 500);
  return result;
}

export function updateAlbum(params: {
  siteId: string;
  albumId: string;
  status: Album["status"];
  title?: string;
  outputCount?: number;
  coverAssetId?: string;
}): { album: Album } {
  let result: { album: Album } | undefined;
  mutatePlatformState((state) => {
    const album = state.albums.find((item) => item.siteId === params.siteId && item.id === params.albumId);
    if (!album) throw new StoreError("album_not_found", 404);
    if (!["processing", "ready", "hidden"].includes(params.status)) throw new StoreError("invalid_album_status", 400);
    album.status = params.status;
    if (params.title !== undefined) {
      album.title = params.title.trim() || album.title;
    }
    if (typeof params.outputCount === "number") {
      if (!Number.isInteger(params.outputCount) || params.outputCount < 0) throw new StoreError("invalid_output_count", 400);
      album.outputCount = params.outputCount;
    }
    if (params.coverAssetId !== undefined) {
      album.coverAssetId = params.coverAssetId.trim() || undefined;
    }
    album.updatedAt = new Date().toISOString();
    result = { album };
  });
  if (!result) throw new StoreError("album_update_failed", 500);
  return result;
}

export function getCustomerBySessionFromState(
  state: PlatformState,
  siteId: string,
  sessionId?: string
): { customer: PublicCustomer; session: CustomerSession } | undefined {
  if (!sessionId) return undefined;
  const now = Date.now();
  const session = state.customerSessions.find(
    (item) => item.id === sessionId && item.siteId === siteId && new Date(item.expiresAt).getTime() > now
  );
  const customer = session ? state.customers.find((item) => item.id === session.customerId && item.siteId === siteId) : undefined;
  return session && customer ? { customer: toPublicCustomer(customer), session } : undefined;
}

export function findThemePage(state: PlatformState, siteId: string, pageId: string) {
  const site = state.sites.find((item) => item.id === siteId);
  const page = site?.pages.find((item) => item.id === pageId);
  return { site, page };
}

export function findDraftThemeSection(state: PlatformState, siteId: string, pageId: string, sectionId: string) {
  const { site, page } = findThemePage(state, siteId, pageId);
  const section = page?.draftJson.sections[sectionId];
  return { site, page, section };
}

export function saveDraftPage(
  siteId: string,
  pageId: string,
  draftJson: ThemePageJson,
  expected?: { expectedRevision?: number; expectedEtag?: string }
): { state: PlatformState; draftVersion: ThemeDraftMeta } {
  let draftVersion: ThemeDraftMeta | undefined;
  const state = mutatePlatformState((state) => {
    const { site, page } = findThemePage(state, siteId, pageId);
    if (!site || !page) throw new Error("theme_page_not_found");
    assertThemeDraftVersion(page, expected);
    page.draftJson = draftJson;
    draftVersion = bumpThemeDraftMeta(page);
    const draftTheme = getPrimaryDraftSiteTheme(state, siteId);
    if (draftTheme) {
      const record = buildSaasThemeDraft(site, draftTheme.themeKey);
      draftTheme.templates = cloneJson(record.templates);
      draftTheme.settings = cloneJson(record.settings);
      draftTheme.themeKey = record.themeKey;
      draftTheme.updatedAt = new Date().toISOString();
    }
  });
  if (!draftVersion) throw new StoreError("theme_draft_save_failed", 500);
  return { state, draftVersion };
}

export function saveDraftThemeSettings(siteId: string, draftJson: Site["themeSettings"]["draftJson"]): PlatformState {
  return mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === siteId);
    if (!site) throw new Error("site_not_found");
    const draftTheme = getPrimaryDraftSiteTheme(state, siteId);
    const themeKey = draftTheme?.themeKey ?? getActiveSiteTheme(state, siteId)?.themeKey ?? "theme1";
    site.themeSettings.draftJson = withNormalizedSiteThemeSettings(site, draftJson, themeKey);
    if (draftTheme) {
      const record = buildSaasThemeDraft(site, themeKey);
      draftTheme.templates = cloneJson(record.templates);
      draftTheme.settings = cloneJson(record.settings);
      draftTheme.themeKey = record.themeKey;
      draftTheme.updatedAt = new Date().toISOString();
    }
  });
}

export type SaasThemeAction =
  | ({ type: "change"; pageId: string; scope: "page_section"; sectionId: string; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; pageId: string; scope: "page_block"; sectionId: string; blockId: string; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; scope: "global_setting"; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; scope: "global"; globalType: "header" | "footer"; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; scope: "global_block"; globalType: "header" | "footer"; blockId: string; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "dropition"; pageId: string; sectionsOrder: string[] } & { themeKey?: string })
  | ({ type: "dropitem"; pageId: string; scope: "page_section"; sectionId: string; blockIds: string[] } & { themeKey?: string })
  | ({ type: "dropitem"; scope: "global"; globalType: "header" | "footer"; blockIds: string[] } & { themeKey?: string })
  | ({ type: "delition"; pageId: string; sectionId: string } & { themeKey?: string })
  | ({ type: "delitem"; pageId: string; scope: "page_section"; sectionId: string; blockId: string } & { themeKey?: string })
  | ({ type: "delitem"; scope: "global"; globalType: "header" | "footer"; blockId: string } & { themeKey?: string })
  | ({ type: "addition"; pageId: string; sectionType: string; sectionId?: string; section?: SectionInstance; sectionsOrder?: string[] } & { themeKey?: string })
  | ({ type: "additem"; pageId: string; scope: "page_section"; sectionId: string; blockType: string; block?: SectionBlockInstance } & { themeKey?: string })
  | ({ type: "additem"; scope: "global"; globalType: "header" | "footer"; blockType: string; block?: SectionBlockInstance } & { themeKey?: string });

export type XfcartThemeEditPayload = {
  t: string;
  page?: string;
  theme_id?: string;
  themeKey?: string;
  theme_key?: string;
  x?: string;
  i?: string;
  k?: string | number;
  n?: string;
  v?: ThemeSettingValue;
  section?: SectionInstance;
  block?: SectionBlockInstance;
  sectionsOrder?: string[];
};

function requireGlobalSection(site: Site, globalType: "header" | "footer") {
  site.themeSettings.draftJson.globalSections ??= {};
  site.themeSettings.draftJson.globalSections[globalType] = normalizeGlobalSection(
    globalType,
    site.themeSettings.draftJson.globalSections[globalType]
  );
  return site.themeSettings.draftJson.globalSections[globalType];
}

function syncSaasGlobalSetting(site: Site, name: string, value: ThemeSettingValue, themeKey = "theme1") {
  site.themeSettings.draftJson.saasSettingsCurrent = normalizeSaasSettingsCurrentForTheme(themeKey, site.themeSettings.draftJson.saasSettingsCurrent);
  site.themeSettings.draftJson.saasSettingsCurrent[name] = value;
  const stringValue = readString(value);
  if (!stringValue) return;
  if (name === "skin_bg") site.themeSettings.draftJson.colors.background = stringValue;
  if (name === "skin_title_color") site.themeSettings.draftJson.colors.foreground = stringValue;
  if (name === "skin_price_color" || name === "skin_primary_btn_bg_color") site.themeSettings.draftJson.colors.accent = stringValue;
  if (name === "skin_muted_color") site.themeSettings.draftJson.colors.muted = stringValue;
  if (name === "skin_title_font_family") site.themeSettings.draftJson.typography.display = stringValue;
  if (name === "skin_text_font_family") site.themeSettings.draftJson.typography.body = stringValue;
}

function themeKeyFromAction(action: SaasThemeAction): string {
  return action.themeKey?.trim() || "theme1";
}

function themeKeyFromXfcartPayload(payload: XfcartThemeEditPayload, editedTheme?: SiteTheme): string {
  return payload.themeKey?.trim() || payload.theme_key?.trim() || editedTheme?.themeKey || "theme1";
}

function themeScopedSectionSchema(sectionType: string, themeKey?: string): ThemeSectionSchema {
  const scoped = getImportedSaasSectionSchemasForTheme(themeKey ?? "theme1")[sectionType];
  return scoped ?? getSectionSchema(sectionType);
}

function normalizeThemeScopedSettings(site: Site, themeKey: string, shouldResetDefaults = false) {
  site.themeSettings.draftJson.saasSettingsCurrent = shouldResetDefaults
    ? resetSaasSettingsCurrentForTheme(themeKey, site.themeSettings.draftJson.saasSettingsCurrent)
    : normalizeSaasSettingsCurrentForTheme(themeKey, site.themeSettings.draftJson.saasSettingsCurrent);
  site.themeSettings.draftJson = withNormalizedSiteThemeSettings(site, site.themeSettings.draftJson, themeKey);
}

export function applySaasThemeAction(siteId: string, action: SaasThemeAction, actor = "site_admin_demo"): { state: PlatformState; sectionId?: string; responseType: "reload" | "th1" | "add" | "del" } {
  let sectionId: string | undefined = "sectionId" in action ? action.sectionId : undefined;
  let responseType: "reload" | "th1" | "add" | "del" = "reload";
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === siteId);
    if (!site) throw new Error("site_not_found");
    const themeKey = themeKeyFromAction(action);
    const draftTheme = getPrimaryDraftSiteTheme(state, siteId);
    normalizeThemeScopedSettings(site, themeKey, draftTheme?.themeKey !== themeKey);
    const page = "pageId" in action ? site.pages.find((item) => item.id === action.pageId) : undefined;
    if ("pageId" in action && !page) throw new Error("theme_page_not_found");

    if (action.type === "change") {
      if (action.scope === "page_section") {
        const section = page?.draftJson.sections[action.sectionId];
        if (!section) throw new Error("theme_section_not_found");
        section.settings[action.name] = action.value;
        responseType = "th1";
      } else if (action.scope === "page_block") {
        const block = page?.draftJson.sections[action.sectionId]?.blocks?.find((item) => item.id === action.blockId);
        if (!block) throw new Error("theme_block_not_found");
        block.settings[action.name] = action.value;
        sectionId = action.sectionId;
        responseType = "th1";
      } else if (action.scope === "global") {
        const section = requireGlobalSection(site, action.globalType);
        section.settings[action.name] = action.value;
        sectionId = action.globalType === "header" ? "header_plus" : "footer_plus";
        responseType = "th1";
      } else if (action.scope === "global_setting") {
        syncSaasGlobalSetting(site, action.name, action.value, themeKey);
        responseType = "reload";
      } else {
        const block = requireGlobalSection(site, action.globalType).blocks?.find((item) => item.id === action.blockId);
        if (!block) throw new Error("theme_block_not_found");
        block.settings[action.name] = action.value;
        sectionId = action.globalType === "header" ? "header_plus" : "footer_plus";
        responseType = "th1";
      }
    }

    if (action.type === "dropition") {
      if (!page) throw new Error("theme_page_not_found");
      const validIds = new Set(Object.keys(page.draftJson.sections));
      page.draftJson.sectionsOrder = action.sectionsOrder.filter((id) => validIds.has(id));
      responseType = "reload";
    }

    if (action.type === "dropitem") {
      const blockIds = new Set(action.blockIds);
      const section = action.scope === "global" ? requireGlobalSection(site, action.globalType) : page?.draftJson.sections[action.sectionId];
      if (!section?.blocks) throw new Error("theme_section_not_found");
      const byId = new Map(section.blocks.map((block) => [block.id, block]));
      section.blocks = action.blockIds.map((id) => byId.get(id)).filter((block): block is NonNullable<typeof block> => Boolean(block));
      for (const block of byId.values()) {
        if (!blockIds.has(block.id)) section.blocks.push(block);
      }
      sectionId = action.scope === "global" ? action.globalType === "header" ? "header_plus" : "footer_plus" : action.sectionId;
      responseType = "th1";
    }

    if (action.type === "delition") {
      if (!page) throw new Error("theme_page_not_found");
      page.draftJson.sectionsOrder = page.draftJson.sectionsOrder.filter((id) => id !== action.sectionId);
      delete page.draftJson.sections[action.sectionId];
      responseType = "del";
    }

    if (action.type === "delitem") {
      const section = action.scope === "global" ? requireGlobalSection(site, action.globalType) : page?.draftJson.sections[action.sectionId];
      if (!section?.blocks) throw new Error("theme_section_not_found");
      section.blocks = section.blocks.filter((block) => block.id !== action.blockId);
      sectionId = action.scope === "global" ? action.globalType === "header" ? "header_plus" : "footer_plus" : action.sectionId;
      responseType = "th1";
    }

    if (action.type === "addition") {
      if (!page) throw new Error("theme_page_not_found");
      sectionId = action.sectionId ?? `${action.sectionType}_${Date.now().toString(36)}`;
      page.draftJson.sections[sectionId] = action.section ?? xfcartDefaultSection(action.sectionType, undefined, themeKey);
      if (action.sectionsOrder?.length) {
        const validIds = new Set(Object.keys(page.draftJson.sections));
        const normalizedOrder = action.sectionsOrder.filter((id) => validIds.has(id));
        page.draftJson.sectionsOrder = normalizedOrder.includes(sectionId)
          ? normalizedOrder
          : [...normalizedOrder, sectionId];
      } else {
        page.draftJson.sectionsOrder.push(sectionId);
      }
      responseType = "add";
    }

    if (action.type === "additem") {
      const section = action.scope === "global" ? requireGlobalSection(site, action.globalType) : page?.draftJson.sections[action.sectionId];
      if (!section) throw new Error("theme_section_not_found");
      const blockSchema = themeScopedSectionSchema(section.type, themeKey).blocks?.find((block) => block.type === action.blockType);
      if (!blockSchema) throw new Error("theme_block_schema_not_found");
      section.blocks ??= [];
      section.blocks.push(action.block ?? defaultBlock(blockSchema, section.blocks.length + 1));
      sectionId = action.scope === "global" ? action.globalType === "header" ? "header_plus" : "footer_plus" : action.sectionId;
      responseType = "th1";
    }

    if (draftTheme) {
      const record = buildSaasThemeDraft(site, themeKey);
      draftTheme.templates = cloneJson(record.templates);
      draftTheme.settings = cloneJson(record.settings);
      draftTheme.themeKey = themeKey;
      draftTheme.updatedAt = new Date().toISOString();
    }

    state.auditLogs.unshift({
      id: uid("audit"),
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: `theme_saas_${action.type}`,
      targetType: "theme_draft",
      targetId: "pageId" in action ? action.pageId : action.scope,
      createdAt: new Date().toISOString(),
      metadata: {
        actionType: action.type,
        scope: "scope" in action ? action.scope : "page",
        pageId: "pageId" in action ? action.pageId : "",
        sectionId: "sectionId" in action ? action.sectionId ?? "" : "",
        globalType: "globalType" in action ? action.globalType : "",
        themeKey
      }
    });
  });
  const state = readPlatformState();
  return { state, sectionId, responseType };
}

function templateNameForPageIdentifier(site: Site, pageIdentifier?: string): string {
  const identifier = pageIdentifier || "index";
  const page = site.pages.find(
    (item) =>
      item.id === identifier ||
      item.slug === identifier ||
      item.pageType === identifier ||
      pageSaasTemplateKey(item) === identifier
  );
  return page ? pageSaasTemplateKey(page) : identifier;
}

function pageFromXfcartIdentifier(site: Site, pageIdentifier?: string): ThemePage | undefined {
  const templateName = templateNameForPageIdentifier(site, pageIdentifier);
  return site.pages.find((page) => pageSaasTemplateKey(page) === templateName || page.pageType === pageIdentifier || page.id === pageIdentifier || page.slug === pageIdentifier);
}

function draftThemeForXfcartEdit(state: PlatformState, siteId: string, themeId?: string): SiteTheme | undefined {
  const value = themeId?.trim();
  if (value) {
    const explicit = state.siteThemes.find((theme) => theme.siteId === siteId && theme.status !== "active" && (theme.id === value || theme.themeId === value));
    if (explicit) return explicit;
  }
  return getPrimaryDraftSiteTheme(state, siteId);
}

function parseXfcartSort(value: ThemeSettingValue | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => readString(item) ?? "").filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseXfcartIndex(value: string | number | undefined): number {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric - 1 : -1;
}

function normalizeXfcartValue(value: ThemeSettingValue | undefined): ThemeSettingValue | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function reorderXfcartBlocks(blocks: SectionBlockInstance[], sort: string[]): SectionBlockInstance[] {
  const byIndex = sort.map((item) => Number(item) - 1).filter((item) => Number.isInteger(item) && item >= 0);
  if (byIndex.length) {
    return byIndex.map((item) => blocks[item]).filter((block): block is SectionBlockInstance => Boolean(block));
  }
  const byId = new Map(blocks.map((block) => [block.id, block]));
  return sort.map((id) => byId.get(id)).filter((block): block is SectionBlockInstance => Boolean(block));
}

function xfcartDefaultSection(sectionType: string, section?: SectionInstance, themeKey?: string): SectionInstance {
  if (section) return cloneJson(section);
  const schema = themeScopedSectionSchema(sectionType, themeKey);
  const preset = schema.presets?.[0];
  return {
    type: sectionType,
    settings: cloneJson(preset?.settings ?? Object.fromEntries(schema.settings.filter((field) => !field.id.startsWith("__")).map((field) => [field.id, field.default ?? ""]))),
    blocks: cloneJson(preset?.blocks ?? [])
  };
}

function xfcartDefaultBlock(section: SectionInstance, blockTypeOrPresetIndex: string, block?: SectionBlockInstance, themeKey?: string): SectionBlockInstance {
  if (block) return cloneJson(block);
  const sectionSchema = themeScopedSectionSchema(section.type, themeKey);
  const presetIndex = Number(blockTypeOrPresetIndex);
  const presetBlock = Number.isInteger(presetIndex) && presetIndex > 0 ? sectionSchema.presets?.[0]?.blocks?.[presetIndex - 1] : undefined;
  if (presetBlock) return cloneJson(presetBlock);
  const blockSchema = sectionSchema.blocks?.find((item) => item.type === blockTypeOrPresetIndex) ?? sectionSchema.blocks?.[0];
  if (!blockSchema) throw new Error("theme_block_schema_not_found");
  return defaultBlock(blockSchema, section.blocks?.length ?? 0);
}

export function applyXfcartThemeEdit(
  siteId: string,
  payload: XfcartThemeEditPayload,
  actor = "site_admin_demo"
): { state: PlatformState; sectionId?: string; responseType: "reload" | "th1" | "add" | "del"; pageId?: string } {
  let sectionId = payload.i;
  let responseType: "reload" | "th1" | "add" | "del" = "reload";
  let pageId: string | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === siteId);
    if (!site) throw new Error("site_not_found");
    const editedTheme = draftThemeForXfcartEdit(state, siteId, payload.theme_id);
    if (editedTheme) syncSiteFromThemeRecord(site, themeRecordFromSiteTheme(editedTheme), "draft");
    const themeKey = themeKeyFromXfcartPayload(payload, editedTheme);
    const draftTheme = editedTheme ?? getPrimaryDraftSiteTheme(state, siteId);
    normalizeThemeScopedSettings(site, themeKey, draftTheme?.themeKey !== themeKey);
    const page = pageFromXfcartIdentifier(site, payload.page);
    pageId = page?.id;
    const x = payload.x ?? "";
    const index = parseXfcartIndex(payload.k);
    const value = normalizeXfcartValue(payload.v);

    if (payload.t === "change") {
      if (!payload.n) throw new Error("theme_field_name_required");
      if (x === "global_setting") {
        syncSaasGlobalSetting(site, payload.n, value ?? "", themeKey);
        responseType = "reload";
      } else if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        sectionId = x;
        if (index >= 0) {
          const block = section.blocks?.[index];
          if (!block) throw new Error("theme_block_not_found");
          block.settings[payload.n] = value ?? "";
        } else {
          section.settings[payload.n] = value ?? "";
        }
        responseType = "th1";
      } else {
        if (!page || !payload.i) throw new Error("theme_page_or_section_required");
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new Error("theme_section_not_found");
        if (index >= 0) {
          const block = section.blocks?.[index];
          if (!block) throw new Error("theme_block_not_found");
          block.settings[payload.n] = value ?? "";
        } else {
          section.settings[payload.n] = value ?? "";
        }
        sectionId = payload.i;
        responseType = "th1";
      }
    }

    if (payload.t === "dropitem") {
      const sort = parseXfcartSort(value);
      if (!sort.length) throw new Error("theme_sort_required");
      if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        section.blocks = reorderXfcartBlocks(section.blocks ?? [], sort);
        sectionId = x;
      } else {
        if (!page || !payload.i) throw new Error("theme_page_or_section_required");
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new Error("theme_section_not_found");
        section.blocks = reorderXfcartBlocks(section.blocks ?? [], sort);
        sectionId = payload.i;
      }
      responseType = "th1";
    }

    if (payload.t === "dropition") {
      if (!page) throw new Error("theme_page_not_found");
      const sort = parseXfcartSort(value);
      const validIds = new Set(Object.keys(page.draftJson.sections));
      page.draftJson.sectionsOrder = sort.filter((id) => validIds.has(id));
      responseType = "reload";
    }

    if (payload.t === "delitem") {
      if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        section.blocks = (section.blocks ?? []).filter((_, blockIndex) => blockIndex !== index);
        sectionId = x;
      } else {
        if (!page || !payload.i) throw new Error("theme_page_or_section_required");
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new Error("theme_section_not_found");
        section.blocks = (section.blocks ?? []).filter((_, blockIndex) => blockIndex !== index);
        sectionId = payload.i;
      }
      responseType = "th1";
    }

    if (payload.t === "delition") {
      if (!page || !payload.i) throw new Error("theme_page_or_section_required");
      page.draftJson.sectionsOrder = page.draftJson.sectionsOrder.filter((id) => id !== payload.i);
      delete page.draftJson.sections[payload.i];
      sectionId = payload.i;
      responseType = "del";
    }

    if (payload.t === "addition") {
      if (!page || !x) throw new Error("theme_page_or_section_required");
      sectionId = payload.i || `${x}_${Date.now().toString(36)}`;
      page.draftJson.sections[sectionId] = xfcartDefaultSection(x, payload.section, themeKey);
      if (payload.sectionsOrder?.length) {
        const validIds = new Set(Object.keys(page.draftJson.sections));
        const normalizedOrder = payload.sectionsOrder.filter((id) => validIds.has(id));
        page.draftJson.sectionsOrder = normalizedOrder.includes(sectionId)
          ? normalizedOrder
          : [...normalizedOrder, sectionId];
      } else {
        page.draftJson.sectionsOrder.push(sectionId);
      }
      responseType = "add";
    }

    if (payload.t === "additem") {
      if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        section.blocks ??= [];
        section.blocks.push(xfcartDefaultBlock(section, readString(value) ?? payload.block?.type ?? "", payload.block, themeKey));
        sectionId = x;
      } else {
        if (!page || !payload.i) throw new Error("theme_page_or_section_required");
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new Error("theme_section_not_found");
        section.blocks ??= [];
        section.blocks.push(xfcartDefaultBlock(section, readString(value) ?? payload.block?.type ?? "", payload.block, themeKey));
        sectionId = payload.i;
      }
      responseType = "th1";
    }

    if (draftTheme) {
      const record = buildSaasThemeDraft(site, themeKey);
      draftTheme.templates = cloneJson(record.templates);
      draftTheme.settings = cloneJson(record.settings);
      draftTheme.themeKey = themeKey;
      draftTheme.updatedAt = new Date().toISOString();
      if (payload.theme_id && (draftTheme.id === payload.theme_id || draftTheme.themeId === payload.theme_id)) {
        draftTheme.themeId = payload.theme_id;
      }
    }
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: `theme_xfcart_${payload.t}`,
      targetType: "theme_draft",
      targetId: pageId ?? x,
      createdAt: new Date().toISOString(),
      metadata: {
        t: payload.t,
        x,
        i: payload.i ?? "",
        k: String(payload.k ?? ""),
        n: payload.n ?? "",
        page: payload.page ?? "index",
        theme_id: payload.theme_id ?? "",
        themeKey
      }
    });
  });
  const state = readPlatformState();
  return { state, sectionId, responseType, pageId };
}

export function publishDraftPage(
  siteId: string,
  pageId: string,
  actor = "site_admin_demo",
  expected?: { expectedRevision?: number; expectedEtag?: string }
): { state: PlatformState; draftVersion?: ThemeDraftMeta; publishedVersion: number } {
  let draftVersion: ThemeDraftMeta | undefined;
  let publishedVersion = 0;
  const state = mutatePlatformState((state) => {
    const { site, page } = findThemePage(state, siteId, pageId);
    if (!site || !page) throw new Error("theme_page_not_found");
    assertThemeDraftVersion(page, expected);
    const themeKey =
      getPrimaryDraftSiteTheme(state, siteId)?.themeKey ??
      getActiveSiteTheme(state, siteId)?.themeKey ??
      "theme1";
    site.themeSettings.publishedJson = cloneJson(site.themeSettings.draftJson);
    const currentMax = site.pages.reduce((max, item) => Math.max(max, item.publishedJson.version), 0);
    const version = currentMax + 1;
    publishedVersion = version;
    for (const themePage of site.pages) {
      themePage.publishedJson = JSON.parse(JSON.stringify(themePage.draftJson)) as ThemePageJson;
      themePage.publishedJson.version = version;
      themePage.draftJson.version = version;
      const nextMeta = bumpThemeDraftMeta(themePage);
      if (themePage.id === pageId) draftVersion = nextMeta;
    }
    state.sites = state.sites.map((item) => (item.id === siteId ? site : item));
    const activeRecord = buildSaasThemePublication(site, version, themeKey).theme;
    const draftTheme = getPrimaryDraftSiteTheme(state, siteId);
    if (draftTheme) {
      draftTheme.templates = cloneJson(activeRecord.templates);
      draftTheme.settings = cloneJson(activeRecord.settings);
      draftTheme.themeKey = activeRecord.themeKey;
      draftTheme.updatedAt = new Date().toISOString();
    }
    for (const siteTheme of state.siteThemes) {
      if (siteTheme.siteId === siteId && siteTheme.status === "active") siteTheme.status = "draft";
    }
    const activeTheme = state.siteThemes.find((siteTheme) => siteTheme.siteId === siteId && siteTheme.id === `theme_${siteId}_active`);
    if (activeTheme) {
      activeTheme.templates = cloneJson(activeRecord.templates);
      activeTheme.settings = cloneJson(activeRecord.settings);
      activeTheme.themeKey = activeRecord.themeKey;
      activeTheme.updatedAt = new Date().toISOString();
      activeTheme.status = "active";
    } else {
      state.siteThemes.unshift(
        siteThemeFromRecord({
          id: `theme_${siteId}_active`,
          siteId,
          record: activeRecord,
          source: "site",
          createdBy: actor
        })
      );
    }
    const publication = {
      id: `pub_${siteId}_${Date.now().toString(36)}`,
      siteId,
      version,
      snapshot: {
        pages: site.pages.map((sitePage) => ({
          id: sitePage.id,
          slug: sitePage.slug,
          publishedJson: sitePage.publishedJson
        })),
        themeSettings: site.themeSettings.publishedJson,
        saasTheme: activeRecord
      },
      publishedBy: actor,
      publishedAt: new Date().toISOString()
    };
    state.themePublications = [...state.themePublications, publication];
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_published",
      targetType: "theme",
      targetId: siteId,
      createdAt: new Date().toISOString(),
      metadata: { version, pageId }
    });
  });
  return { state, draftVersion, publishedVersion };
}

export function rollbackDraftPage(siteId: string, pageId: string): PlatformState {
  return mutatePlatformState((state) => {
    const { site, page } = findThemePage(state, siteId, pageId);
    if (!site || !page) throw new Error("theme_page_not_found");
    page.draftJson = cloneJson(page.publishedJson);
    bumpThemeDraftMeta(page);
    site.themeSettings.draftJson = cloneJson(site.themeSettings.publishedJson);
  });
}

function latestThemePublication(state: PlatformState, siteId: string): ThemePublication | undefined {
  return state.themePublications
    .filter((publication) => publication.siteId === siteId)
    .sort((a, b) => b.version - a.version || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];
}

function getActiveSiteTheme(state: PlatformState, siteId: string): SiteTheme | undefined {
  return state.siteThemes
    .filter((theme) => theme.siteId === siteId && theme.status === "active")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

function getPrimaryDraftSiteTheme(state: PlatformState, siteId: string): SiteTheme | undefined {
  return state.siteThemes
    .filter((theme) => theme.siteId === siteId && theme.status === "draft")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

function syncSiteFromThemeRecord(site: Site, theme: SaasThemeRecord, mode: "draft" | "published") {
  const fallbackSettings = mode === "draft" ? site.themeSettings.draftJson : site.themeSettings.publishedJson;
  const themeSettings = fromSaasSettings(theme.settings, fallbackSettings, theme.themeKey);
  if (mode === "draft") site.themeSettings.draftJson = themeSettings;
  else site.themeSettings.publishedJson = themeSettings;

  for (const page of site.pages) {
    const templateName = pageSaasTemplateKey(page);
    const template = theme.templates[templateName] ?? theme.templates[page.pageType];
    if (!template) continue;
    const version = mode === "draft" ? page.draftJson.version : page.publishedJson.version;
    const pageJson = fromSaasTemplate(template, page.pageType, version);
    if (mode === "draft") page.draftJson = pageJson;
    else page.publishedJson = pageJson;
  }
}

export function getSiteSaasThemeRecords(siteId: string) {
  const state = readPlatformState();
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) throw new StoreError("site_not_found", 404);
  const latestPublication = latestThemePublication(state, siteId);
  const draft = getPrimaryDraftSiteTheme(state, siteId);
  const active = getActiveSiteTheme(state, siteId);
  const activeTheme =
    (active ? themeRecordFromSiteTheme(active) : undefined) ??
    (latestPublication?.snapshot.saasTheme as SaasThemeRecord | undefined) ??
    buildSaasThemePublication(site, latestPublication?.version ?? site.pages[0]?.publishedJson.version ?? 1).theme;
  const activeUpdatedAt = active?.updatedAt ?? latestPublication?.publishedAt ?? activeTheme.updatedAt;
  return {
    site,
    draft: draft ? themeRecordFromSiteTheme(draft) : buildSaasThemeDraft(site),
    active: {
      ...activeTheme,
      status: "active" as const,
      themeId: activeTheme.themeId || `${site.id}_active_v${latestPublication?.version ?? 1}`,
      updatedAt: activeUpdatedAt
    },
    themes: getSiteThemesFromState(state, siteId),
    publications: getSiteThemePublicationsFromState(state, siteId),
    copies: getSiteThemeCopiesFromState(state, siteId)
  };
}

export function exportSiteThemePackage(siteId: string, source: "draft" | "active" = "draft") {
  const records = getSiteSaasThemeRecords(siteId);
  const theme = source === "active" ? records.active : records.draft;
  return {
    exportedAt: new Date().toISOString(),
    source,
    site: {
      id: records.site.id,
      name: records.site.name,
      slug: records.site.slug,
      primaryDomain: records.site.primaryDomain
    },
    theme,
    pages: records.site.pages.map((page) => ({
      id: page.id,
      pageType: page.pageType,
      templateKey: pageSaasTemplateKey(page),
      slug: page.slug,
      title: page.title,
      json: source === "active" ? page.publishedJson : page.draftJson
    }))
  };
}

export function installSaasThemeForSite(params: {
  siteId: string;
  name?: string;
  actor?: string;
  themeKey?: string;
}): { theme: SiteTheme } {
  let result: { theme: SiteTheme } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const sourcePackage = getSaasThemePackage(params.themeKey ?? "theme1");
    const now = new Date().toISOString();
    const templates = Object.fromEntries(
      site.pages.map((page) => {
        const templateName = pageSaasTemplateKey(page);
        const importedTemplate = (sourcePackage.templates[templateName] ?? sourcePackage.templates[page.pageType]) as SaasThemeTemplates[string] | undefined;
        const template = importedTemplate ?? toSaasTemplate(page.draftJson);
        return [templateName, cloneJson(template)];
      })
    ) as SaasThemeTemplates;
    const settings = {
      settings_data: cloneJson(sourcePackage.settingsData)
    } as SaasThemeSettingsRecord;
    const record: SaasThemeRecord = {
      name: params.name?.trim() || `${site.name} imported SaaS ${sourcePackage.themeKey}`,
      themeId: `theme_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      themeKey: sourcePackage.themeKey,
      status: "draft",
      templates,
      settings,
      updatedAt: now
    };
    const theme = siteThemeFromRecord({
      id: uid("site_theme"),
      siteId: site.id,
      record,
      source: sourcePackage.themeKey === "theme1" ? "saas-theme1" : "saas-theme",
      createdBy: params.actor ?? "site_admin_demo",
      createdAt: now,
      updatedAt: now
    });
    state.siteThemes.unshift(theme);
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId: site.id,
      actorType: "site_admin",
      actorId: theme.createdBy,
      action: "theme_installed",
      targetType: "site_theme",
      targetId: theme.id,
      createdAt: now,
      metadata: { themeKey: theme.themeKey }
    });
    result = { theme };
  });
  if (!result) throw new StoreError("theme_install_failed", 500);
  return result;
}

export function installInternalThemePackageForSite(params: {
  siteId: string;
  packageKey: string;
  name?: string;
  actor?: string;
}): { theme: SiteTheme } {
  let result: { theme: SiteTheme } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const themePackage = getThemePackages().find((item) => item.key === params.packageKey);
    if (!themePackage) throw new StoreError("internal_theme_package_not_found", 404);
    const now = new Date().toISOString();
    const templates = Object.fromEntries(
      site.pages.map((page) => {
        const templateName = mapInternalTemplateKey(pageSaasTemplateKey(page));
        const template = themePackageTemplateToPageJson(themePackage.key, templateName as never, page.pageType, page.draftJson.version);
        return [pageSaasTemplateKey(page), toSaasTemplate(template ?? page.draftJson)];
      })
    ) as SaasThemeTemplates;
    const themedSite = {
      ...site,
      themeSettings: {
        ...site.themeSettings,
        draftJson: applyInternalThemePackageSiteSettings(site.themeSettings.draftJson, themePackage.siteSettings)
      }
    };
    const baseDraft = buildSaasThemeDraft(themedSite, themePackage.key);
    const record: SaasThemeRecord = {
      name: params.name?.trim() || `${site.name} ${themePackage.name}`,
      themeId: `theme_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      themeKey: themePackage.key,
      status: "draft",
      templates,
      settings: cloneJson(baseDraft.settings),
      updatedAt: now
    };
    const theme = siteThemeFromRecord({
      id: uid("site_theme"),
      siteId: site.id,
      record,
      source: "imported",
      createdBy: params.actor ?? "site_admin_demo",
      createdAt: now,
      updatedAt: now
    });
    state.siteThemes.unshift(theme);
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId: site.id,
      actorType: "site_admin",
      actorId: theme.createdBy,
      action: "internal_theme_package_installed",
      targetType: "site_theme",
      targetId: theme.id,
      createdAt: now,
      metadata: { themeKey: theme.themeKey, packageKey: themePackage.key }
    });
    result = { theme };
  });
  if (!result) throw new StoreError("internal_theme_install_failed", 500);
  return result;
}

export function getAvailableSaasThemesForInstall() {
  return getSaasThemePackageList();
}

export function getAvailableSaasThemeSummariesForInstall() {
  const now = Date.now();
  if (themePackageListCacheMs > 0 && availableSaasThemeSummaryCache && availableSaasThemeSummaryCache.expiresAt > now) {
    return availableSaasThemeSummaryCache.themes;
  }
  const themes = getSaasThemePackageSummaryList();
  if (themePackageListCacheMs > 0) {
    availableSaasThemeSummaryCache = { expiresAt: now + themePackageListCacheMs, themes };
  }
  return themes;
}

export function getAvailableInternalThemePackages(): Array<ThemePackageManifest & { installType: "internal" }> {
  return getThemePackages().map((themePackage) => ({
    ...themePackage,
    installType: "internal" as const
  }));
}

export function getAvailableInternalThemePackageSummaries(): Array<
  Pick<ThemePackageManifest, "key" | "name" | "description" | "audience" | "accent" | "thumbnailUrl" | "templates" | "featuredSections"> & {
    installType: "internal";
  }
> {
  const now = Date.now();
  if (themePackageListCacheMs > 0 && availableInternalThemeSummaryCache && availableInternalThemeSummaryCache.expiresAt > now) {
    return availableInternalThemeSummaryCache.themes;
  }
  const themes = getThemePackages().map((themePackage) => ({
    key: themePackage.key,
    name: themePackage.name,
    description: themePackage.description,
    audience: themePackage.audience,
    accent: themePackage.accent,
    thumbnailUrl: themePackage.thumbnailUrl,
    templates: themePackage.templates.map((template) => ({
      key: template.key,
      label: template.label,
      pageType: template.pageType,
      sectionCount: template.sectionCount
    })),
    featuredSections: themePackage.featuredSections.slice(0, 8),
    installType: "internal" as const
  }));
  if (themePackageListCacheMs > 0) {
    availableInternalThemeSummaryCache = { expiresAt: now + themePackageListCacheMs, themes };
  }
  return themes;
}

export function applySiteThemeToDraft(params: {
  siteId: string;
  themeId: string;
  actor?: string;
}): { theme: SiteTheme; site: Site } {
  let result: { theme: SiteTheme; site: Site } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const theme = state.siteThemes.find((item) => item.siteId === params.siteId && item.id === params.themeId);
    if (!theme) throw new StoreError("theme_not_found", 404);
    syncSiteFromThemeRecord(site, themeRecordFromSiteTheme(theme), "draft");
    applyInternalThemePackageToSite(site, theme.themeKey, "draft");
    const now = new Date().toISOString();
    theme.updatedAt = now;
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId: site.id,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "theme_applied_to_draft",
      targetType: "site_theme",
      targetId: theme.id,
      createdAt: now,
      metadata: { themeKey: theme.themeKey }
    });
    result = { theme, site };
  });
  if (!result) throw new StoreError("theme_apply_failed", 500);
  return result;
}

export function activateSiteTheme(params: {
  siteId: string;
  themeId: string;
  actor?: string;
}): { theme: SiteTheme; publication: ThemePublication } {
  let result: { theme: SiteTheme; publication: ThemePublication } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const theme = state.siteThemes.find((item) => item.siteId === params.siteId && item.id === params.themeId);
    if (!theme) throw new StoreError("theme_not_found", 404);
    const record = { ...themeRecordFromSiteTheme(theme), status: "active" as const };
    syncSiteFromThemeRecord(site, record, "draft");
    syncSiteFromThemeRecord(site, record, "published");
    applyInternalThemePackageToSite(site, record.themeKey, "published");
    const currentMax = Math.max(0, ...state.themePublications.filter((publication) => publication.siteId === site.id).map((publication) => publication.version));
    const version = currentMax + 1;
    for (const page of site.pages) {
      page.draftJson.version = version;
      page.publishedJson.version = version;
    }
    const now = new Date().toISOString();
    for (const siteTheme of state.siteThemes) {
      if (siteTheme.siteId === site.id && siteTheme.status === "active") siteTheme.status = "draft";
    }
    theme.status = "active";
    theme.updatedAt = now;
    const activeRecord = themeRecordFromSiteTheme(theme);
    const publication: ThemePublication = {
      id: `pub_${site.id}_${Date.now().toString(36)}`,
      siteId: site.id,
      version,
      snapshot: {
        pages: site.pages.map((sitePage) => ({
          id: sitePage.id,
          slug: sitePage.slug,
          publishedJson: sitePage.publishedJson
        })),
        themeSettings: site.themeSettings.publishedJson,
        saasTheme: activeRecord
      },
      publishedBy: params.actor ?? "site_admin_demo",
      publishedAt: now
    };
    state.themePublications.push(publication);
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId: site.id,
      actorType: "site_admin",
      actorId: publication.publishedBy,
      action: "theme_activated",
      targetType: "site_theme",
      targetId: theme.id,
      createdAt: now,
      metadata: { version, themeKey: theme.themeKey }
    });
    result = { theme, publication };
  });
  if (!result) throw new StoreError("theme_activate_failed", 500);
  return result;
}

export function deleteSiteTheme(params: {
  siteId: string;
  themeId: string;
  actor?: string;
}): { deletedThemeId: string } {
  let result: { deletedThemeId: string } | undefined;
  mutatePlatformState((state) => {
    const theme = state.siteThemes.find((item) => item.siteId === params.siteId && item.id === params.themeId);
    if (!theme) throw new StoreError("theme_not_found", 404);
    if (theme.status === "active") throw new StoreError("cannot_delete_active_theme", 409);
    state.siteThemes = state.siteThemes.filter((item) => !(item.siteId === params.siteId && item.id === params.themeId));
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "theme_deleted",
      targetType: "site_theme",
      targetId: theme.id,
      createdAt: new Date().toISOString(),
      metadata: { themeKey: theme.themeKey }
    });
    result = { deletedThemeId: theme.id };
  });
  if (!result) throw new StoreError("theme_delete_failed", 500);
  return result;
}

export function duplicateSiteTheme(params: {
  siteId: string;
  name?: string;
  source?: "draft" | "active";
  sourceThemeId?: string;
  actor?: string;
}): { themeCopy: ThemeCopy; siteTheme: SiteTheme } {
  let result: { themeCopy: ThemeCopy; siteTheme: SiteTheme } | undefined;
  mutatePlatformState((state) => {
    state.themeCopies ??= [];
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const source = params.source ?? "draft";
    const sourceTheme = params.sourceThemeId ? state.siteThemes.find((item) => item.siteId === site.id && item.id === params.sourceThemeId) : undefined;
    const theme = sourceTheme
      ? themeRecordFromSiteTheme(sourceTheme)
      : source === "draft"
      ? themeRecordFromSiteTheme(getPrimaryDraftSiteTheme(state, site.id) ?? siteThemeFromRecord({ id: "tmp", siteId: site.id, record: buildSaasThemeDraft(site), source: "site", createdBy: "system" }))
      : ((getActiveSiteTheme(state, site.id) ? themeRecordFromSiteTheme(getActiveSiteTheme(state, site.id) as SiteTheme) : undefined) ??
        (latestThemePublication(state, site.id)?.snapshot.saasTheme as SaasThemeRecord | undefined) ??
        buildSaasThemePublication(site, site.pages[0]?.publishedJson.version ?? 1).theme);
    const now = new Date().toISOString();
    const themeCopy: ThemeCopy = {
      id: uid("theme_copy"),
      siteId: site.id,
      name: params.name?.trim() || `${theme.name} copy`,
      themeKey: theme.themeKey,
      source,
      templates: cloneJson(theme.templates),
      settings: cloneJson(theme.settings),
      createdBy: params.actor ?? "site_admin_demo",
      createdAt: now,
      updatedAt: now
    };
    const siteTheme = siteThemeFromRecord({
      id: uid("site_theme"),
      siteId: site.id,
      record: {
        ...theme,
        name: themeCopy.name,
        themeId: `theme_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        status: "draft",
        updatedAt: now
      },
      source: "copy",
      createdBy: themeCopy.createdBy,
      createdAt: now,
      updatedAt: now
    });
    state.themeCopies.unshift(themeCopy);
    state.siteThemes.unshift(siteTheme);
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId: site.id,
      actorType: "site_admin",
      actorId: themeCopy.createdBy,
      action: "theme_duplicated",
      targetType: "site_theme",
      targetId: siteTheme.id,
      createdAt: now,
      metadata: { source, themeCopyId: themeCopy.id }
    });
    result = { themeCopy, siteTheme };
  });
  if (!result) throw new StoreError("theme_duplicate_failed", 500);
  return result;
}

export function resetDraftThemeFromActive(siteId: string, actor = "site_admin_demo"): { site: Site; sourceVersion: number } {
  let result: { site: Site; sourceVersion: number } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const latestPublication = latestThemePublication(state, siteId);
    if (latestPublication) {
      const publishedById = new Map(latestPublication.snapshot.pages.map((page) => [page.id, page.publishedJson]));
      for (const page of site.pages) {
        const published = publishedById.get(page.id);
        if (published) page.draftJson = cloneJson(published);
      }
      site.themeSettings.draftJson = cloneJson(latestPublication.snapshot.themeSettings);
      result = { site, sourceVersion: latestPublication.version };
    } else {
      for (const page of site.pages) page.draftJson = cloneJson(page.publishedJson);
      site.themeSettings.draftJson = cloneJson(site.themeSettings.publishedJson);
      result = { site, sourceVersion: site.pages[0]?.publishedJson.version ?? 1 };
    }
    const draftTheme = getPrimaryDraftSiteTheme(state, siteId);
    if (draftTheme) {
      const record = buildSaasThemeDraft(site);
      draftTheme.templates = cloneJson(record.templates);
      draftTheme.settings = cloneJson(record.settings);
      draftTheme.updatedAt = new Date().toISOString();
    }
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_draft_reset_from_active",
      targetType: "theme",
      targetId: siteId,
      createdAt: new Date().toISOString(),
      metadata: { version: result?.sourceVersion ?? 1 }
    });
  });
  if (!result) throw new StoreError("theme_reset_failed", 500);
  return result;
}

export function restoreDraftThemeFromPublication(siteId: string, publicationId: string, actor = "site_admin_demo"): { site: Site; publication: ThemePublication } {
  let result: { site: Site; publication: ThemePublication } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const publication = state.themePublications.find((item) => item.siteId === siteId && item.id === publicationId);
    if (!publication) throw new StoreError("theme_publication_not_found", 404);
    const snapshotPages = new Map(publication.snapshot.pages.map((page) => [page.id, page.publishedJson]));
    for (const page of site.pages) {
      const snapshotPage = snapshotPages.get(page.id);
      if (snapshotPage) page.draftJson = cloneJson(snapshotPage);
    }
    site.themeSettings.draftJson = cloneJson(publication.snapshot.themeSettings);
    const draftTheme = getPrimaryDraftSiteTheme(state, siteId);
    if (draftTheme) {
      const record = publication.snapshot.saasTheme
        ? publication.snapshot.saasTheme as SaasThemeRecord
        : buildSaasThemeDraft(site);
      draftTheme.templates = cloneJson(record.templates);
      draftTheme.settings = cloneJson(record.settings);
      draftTheme.themeKey = record.themeKey ?? draftTheme.themeKey;
      draftTheme.updatedAt = new Date().toISOString();
    }
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_draft_restored_from_publication",
      targetType: "theme_publication",
      targetId: publication.id,
      createdAt: new Date().toISOString(),
      metadata: { version: publication.version }
    });
    result = { site, publication };
  });
  if (!result) throw new StoreError("theme_publication_restore_failed", 500);
  return result;
}

export function upsertProductPrice(siteId: string, productId: string, price: Price): PlatformState {
  return mutatePlatformState((state) => {
    const product = state.products.find((item) => item.siteId === siteId && item.id === productId);
    if (!product) throw new Error("product_not_found");
    const existingIndex = product.prices.findIndex((item) => item.id === price.id);
    if (existingIndex >= 0) product.prices[existingIndex] = price;
    else product.prices.push(price);
  });
}

export function createProductPrice(params: {
  siteId: string;
  productId: string;
  label: string;
  amountCents: number;
  currency: string;
  interval: Price["interval"];
  creditsGranted: number;
  stripePriceId?: string;
  metadata?: Price["metadata"];
}): { price: Price } {
  let result: { price: Price } | undefined;
  mutatePlatformState((state) => {
    const product = state.products.find((item) => item.siteId === params.siteId && item.id === params.productId);
    if (!product) throw new StoreError("product_not_found", 404);
    const label = params.label.trim();
    const currency = params.currency.trim().toLowerCase();
    if (!label) throw new StoreError("price_label_required", 400);
    if (!Number.isInteger(params.amountCents) || params.amountCents < 0) throw new StoreError("invalid_price_amount", 400);
    if (!currency) throw new StoreError("invalid_price_currency", 400);
    if (!["month", "year", "one_time"].includes(params.interval)) throw new StoreError("invalid_price_interval", 400);
    if (!Number.isInteger(params.creditsGranted) || params.creditsGranted < 0) throw new StoreError("invalid_credits_granted", 400);
    const priceId = uid("price");
    const price: Price = {
      id: priceId,
      siteId: params.siteId,
      productId: params.productId,
      label,
      amountCents: params.amountCents,
      currency,
      interval: params.interval,
      creditsGranted: params.creditsGranted,
      stripePriceId: params.stripePriceId?.trim() || `manual_${priceId}`,
      metadata: params.metadata
    };
    product.prices.push(price);
    result = { price };
  });
  if (!result) throw new StoreError("price_create_failed", 500);
  return result;
}

export function deleteProductPrice(params: {
  siteId: string;
  productId: string;
  priceId: string;
}): { deletedPrice: Price } {
  let result: { deletedPrice: Price } | undefined;
  mutatePlatformState((state) => {
    const product = state.products.find((item) => item.siteId === params.siteId && item.id === params.productId);
    if (!product) throw new StoreError("product_not_found", 404);
    const index = product.prices.findIndex((item) => item.id === params.priceId);
    if (index === -1) throw new StoreError("price_not_found", 404);
    if (product.prices.length <= 1) throw new StoreError("product_requires_at_least_one_price", 409);
    const [deletedPrice] = product.prices.splice(index, 1);
    result = { deletedPrice };
  });
  if (!result) throw new StoreError("price_delete_failed", 500);
  return result;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 42);
}

function rekeyPageJson(pageJson: ThemePageJson): ThemePageJson {
  return JSON.parse(JSON.stringify(pageJson)) as ThemePageJson;
}

export function createSite(params: {
  name: string;
  slug?: string;
  ownerEmail: string;
  ownerPassword?: string;
  sourceSiteId?: string;
  domain?: string;
}): {
  site: Site;
  domain: SiteDomain;
  admin: SiteAdmin;
  products: Product[];
  siteAiApps: SiteAiApp[];
  gatewayGroup: AiGatewayGroup;
} {
  let result:
    | {
        site: Site;
        domain: SiteDomain;
        admin: SiteAdmin;
        products: Product[];
        siteAiApps: SiteAiApp[];
        gatewayGroup: AiGatewayGroup;
      }
    | undefined;
  const slug = slugify(params.slug || params.name);
  if (!slug) throw new StoreError("invalid_site_slug", 400);
  const ownerEmail = params.ownerEmail.trim().toLowerCase();
  if (!ownerEmail.includes("@")) throw new StoreError("invalid_owner_email", 400);

  mutatePlatformState((state) => {
    if (state.sites.some((site) => site.slug === slug)) throw new StoreError("site_slug_exists", 409);
    const domainName = (params.domain || `${slug}.localhost`).trim().toLowerCase();
    if (state.siteDomains.some((domain) => domain.domain === domainName)) throw new StoreError("site_domain_exists", 409);
    const sourceSite = params.sourceSiteId
      ? state.sites.find((site) => site.id === params.sourceSiteId)
      : state.sites.find((site) => site.id === "site_lumen") ?? state.sites[0];
    if (!sourceSite) throw new StoreError("source_site_not_found", 404);
    const siteId = `site_${slug}`;
    const site: Site = {
      ...JSON.parse(JSON.stringify(sourceSite)),
      id: siteId,
      name: params.name.trim(),
      slug,
      status: "draft",
      primaryDomain: domainName,
      branding: {
        ...sourceSite.branding,
        logoText: params.name.trim().split(/\s+/)[0] ?? params.name.trim(),
        description: `New AI subscription site cloned from ${sourceSite.name}.`
      },
      connect: {
        stripeAccountId: `acct_pending_${slug}`,
        status: "pending",
        chargesEnabled: false,
        payoutsEnabled: false
      },
      themeSettings: cloneJson(sourceSite.themeSettings),
      pages: []
    };
    const usedPageIds = new Set<string>();
    site.pages = sourceSite.pages.map((page, index) => {
      const sourcePrefix = `${sourceSite.id}_`;
      const sourceSuffix = page.id.startsWith(sourcePrefix) ? page.id.slice(sourcePrefix.length) : "";
      const slugSuffix = slugify(page.slug.replaceAll("/", "-"));
      const templateSuffix = slugify(page.templateKey ?? "");
      const baseSuffix =
        sourceSuffix ||
        slugSuffix ||
        templateSuffix ||
        slugify(page.pageType) ||
        `page-${index + 1}`;
      let candidateId = `${siteId}_${baseSuffix}`;
      let duplicateIndex = 2;
      while (usedPageIds.has(candidateId)) {
        candidateId = `${siteId}_${baseSuffix}_${duplicateIndex}`;
        duplicateIndex += 1;
      }
      usedPageIds.add(candidateId);
      return {
        ...page,
        id: candidateId,
        siteId,
        draftJson: rekeyPageJson(page.draftJson),
        publishedJson: rekeyPageJson(page.publishedJson)
      };
    });
    const replacements = siteTextReplacements(sourceSite, site);
    site.themeSettings = deepReplaceText(site.themeSettings, replacements);
    site.pages = site.pages.map((page) => ({
      ...page,
      title: applyTextReplacements(page.title, replacements),
      draftJson: deepReplaceText(page.draftJson, replacements),
      publishedJson: deepReplaceText(page.publishedJson, replacements)
    }));
    state.sites.push(site);

    const domain: SiteDomain = {
      id: uid("dom"),
      siteId,
      domain: domainName,
      isPrimary: true,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    state.siteDomains.push(domain);

    const admin: SiteAdmin = {
      id: uid("admin"),
      siteId,
      email: ownerEmail,
      passwordHash: hashPassword(params.ownerPassword || `${slug}123`),
      displayName: ownerEmail.split("@")[0],
      role: "owner",
      createdAt: new Date().toISOString()
    };
    state.siteAdmins.push(admin);

    const sourceProducts = state.products.filter((product) => product.siteId === sourceSite.id);
    const products = sourceProducts.map((product) => {
      const productId = `prod_${slug}_${product.type}`;
      return {
        ...JSON.parse(JSON.stringify(product)),
        id: productId,
        siteId,
        status: "draft" as const,
        prices: product.prices.map((price) => ({
          ...price,
          id: `price_${slug}_${price.interval}_${price.creditsGranted}`,
          siteId,
          productId,
          stripePriceId: `manual_${slug}_${price.creditsGranted}`
        }))
      };
    });
    state.products.push(...products);

    const sourceApps = state.siteAiApps.filter((app) => app.siteId === sourceSite.id);
    const siteAiApps = sourceApps.map((app) => ({
      ...JSON.parse(JSON.stringify(app)),
      id: `sai_${slug}_${app.aiApp.slug}`,
      siteId,
      enabled: app.enabled,
      routeKey: app.routeKey
    })) as SiteAiApp[];
    state.siteAiApps.push(...siteAiApps);

    const sourcePacks = state.creativePacks.filter((pack) => pack.siteId === sourceSite.id);
    const creativePacks = sourcePacks.map((pack) => ({
      ...JSON.parse(JSON.stringify(pack)),
      id: `pack_${slug}_${slugify(pack.name)}`,
      siteId,
      generationCount: 0,
      conversionRate: 0,
      status: pack.status === "active" ? ("draft" as const) : pack.status,
      createdAt: new Date().toISOString()
    })) as CreativePack[];
    state.creativePacks.push(...creativePacks);

    const sourceMedia = state.mediaAssets.filter((asset) => asset.siteId === sourceSite.id);
    const mediaAssets = sourceMedia.map((asset) => ({
      ...JSON.parse(JSON.stringify(asset)),
      id: `media_${slug}_${slugify(asset.label)}`,
      siteId,
      storageKey: asset.storageKey.replace(`sites/${sourceSite.id}/`, `sites/${siteId}/`),
      previewUrl: asset.previewUrl,
      originUrl: asset.originUrl,
      createdAt: new Date().toISOString()
    })) as MediaAsset[];
    state.mediaAssets.push(...mediaAssets);

    const sourceThemes = state.siteThemes.filter((theme) => theme.siteId === sourceSite.id);
    const siteThemes = sourceThemes.map((theme) => ({
      ...deepReplaceText(cloneJson(theme), replacements),
      id: `theme_${siteId}_${theme.status}_${uid("seed").replace(/^seed_/, "")}`,
      siteId,
      name: `${params.name.trim()} ${theme.status === "active" ? "Active" : "Draft"} Theme`,
      themeId: `${siteId}_${theme.status}_${Date.now().toString(36)}`,
      source: "site" as const,
      createdBy: admin.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })) as SiteTheme[];
    state.siteThemes.push(...siteThemes);

    const sourceGateway = state.aiGatewayGroups.find((group) => group.siteId === sourceSite.id);
    const gatewayGroup: AiGatewayGroup = {
      ...(sourceGateway
        ? JSON.parse(JSON.stringify(sourceGateway))
        : {
            name: `${site.branding.logoText} primary quota`,
            modelAllowlist: ["gpt-image-2", "gpt-4.1-mini"],
            monthlyQuota: 3000,
            usedQuota: 0,
            retryStatusCodes: [429, 500, 502, 503],
            rateLimitPerMinute: 30,
            accountPoolMode: "shared"
          }),
      id: `gw_${slug}_primary`,
      siteId,
      name: `${site.branding.logoText} primary quota`,
      status: "paused",
      usedQuota: 0,
      unavailableReason: "Stripe Connect pending"
    };
    state.aiGatewayGroups.push(gatewayGroup);
    result = { site, domain, admin, products, siteAiApps, gatewayGroup };
  });
  if (!result) throw new StoreError("site_create_failed", 500);
  return result;
}

export function addSiteDomain(params: { siteId: string; domain: string; isPrimary?: boolean }): { domain: SiteDomain; site: Site } {
  let result: { domain: SiteDomain; site: Site } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const domainName = params.domain.trim().toLowerCase();
    if (!domainName.includes(".")) throw new StoreError("invalid_domain", 400);
    if (state.siteDomains.some((domain) => domain.domain === domainName)) throw new StoreError("site_domain_exists", 409);
    if (params.isPrimary) {
      state.siteDomains.forEach((domain) => {
        if (domain.siteId === params.siteId) domain.isPrimary = false;
      });
      site.primaryDomain = domainName;
    }
    const domain: SiteDomain = {
      id: uid("dom"),
      siteId: params.siteId,
      domain: domainName,
      isPrimary: Boolean(params.isPrimary),
      status: "pending",
      createdAt: new Date().toISOString()
    };
    state.siteDomains.push(domain);
    result = { domain, site };
  });
  if (!result) throw new StoreError("domain_create_failed", 500);
  return result;
}

export function updateSiteDomain(params: {
  siteId: string;
  domainId: string;
  isPrimary?: boolean;
  status?: SiteDomain["status"];
}): { domain: SiteDomain; site: Site } {
  let result: { domain: SiteDomain; site: Site } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const domain = state.siteDomains.find((item) => item.siteId === params.siteId && item.id === params.domainId);
    if (!domain) throw new StoreError("site_domain_not_found", 404);

    if (typeof params.status === "string") {
      domain.status = params.status;
    }

    if (params.isPrimary) {
      state.siteDomains.forEach((item) => {
        if (item.siteId === params.siteId) item.isPrimary = item.id === params.domainId;
      });
      site.primaryDomain = domain.domain;
      domain.status = "active";
    }

    result = { domain, site };
  });
  if (!result) throw new StoreError("domain_update_failed", 500);
  return result;
}

export function deleteSiteDomain(params: { siteId: string; domainId: string }): { deletedDomain: SiteDomain; site: Site } {
  let result: { deletedDomain: SiteDomain; site: Site } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const index = state.siteDomains.findIndex((item) => item.siteId === params.siteId && item.id === params.domainId);
    if (index === -1) throw new StoreError("site_domain_not_found", 404);
    const deletedDomain = state.siteDomains[index];
    const fallback = deletedDomain.isPrimary
      ? state.siteDomains.find((item) => item.siteId === params.siteId && item.id !== params.domainId) ?? null
      : null;

    if (deletedDomain.isPrimary && !fallback) {
      throw new StoreError("site_requires_primary_domain", 409);
    }

    state.siteDomains.splice(index, 1);

    if (deletedDomain.isPrimary && fallback) {
      fallback.isPrimary = true;
      fallback.status = fallback.status === "failed" ? "pending" : fallback.status;
      site.primaryDomain = fallback.domain;
    }

    result = { deletedDomain, site };
  });
  if (!result) throw new StoreError("domain_delete_failed", 500);
  return result;
}

export function updateSiteSettings(params: {
  siteId: string;
  actor?: string;
  actorType?: AuditLogEntry["actorType"];
  name: string;
  status: Site["status"];
  currency: string;
  timezone: string;
  branding: {
    logoText: string;
    market: string;
    description: string;
  };
  connect: {
    stripeAccountId: string;
    status: Site["connect"]["status"];
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  };
}): { site: Site } {
  let result: { site: Site } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);

    const name = params.name.trim();
    const logoText = params.branding.logoText.trim();
    const market = params.branding.market.trim();
    const description = params.branding.description.trim();
    const currency = params.currency.trim().toUpperCase();
    const timezone = params.timezone.trim();
    const stripeAccountId = params.connect.stripeAccountId.trim();

    if (!name) throw new StoreError("invalid_site_name", 400);
    if (!logoText) throw new StoreError("invalid_logo_text", 400);
    if (!market) throw new StoreError("invalid_market", 400);
    if (!description) throw new StoreError("invalid_site_description", 400);
    if (!currency) throw new StoreError("invalid_currency", 400);
    if (!timezone) throw new StoreError("invalid_timezone", 400);
    if (!stripeAccountId) throw new StoreError("invalid_stripe_account", 400);

    const previousLogoText = site.branding.logoText;
    site.name = name;
    site.status = params.status;
    site.currency = currency;
    site.timezone = timezone;
    site.branding = {
      logoText,
      market,
      description
    };
    site.connect = {
      stripeAccountId,
      status: params.connect.status,
      chargesEnabled: params.connect.chargesEnabled,
      payoutsEnabled: params.connect.payoutsEnabled
    };

    const syncBrandingIntoThemeSettings = (settings: Site["themeSettings"]["draftJson"]) => {
      settings.globalSections ??= {};
      settings.globalSections.header = normalizeGlobalSection("header", settings.globalSections.header);
      settings.globalSections.footer = normalizeGlobalSection("footer", settings.globalSections.footer);
      settings.globalSections.header.settings = {
        ...settings.globalSections.header.settings,
        title: logoText
      };
      settings.globalSections.footer.settings = {
        ...settings.globalSections.footer.settings,
        title: logoText,
        body: description
      };
      settings.seo = {
        siteTitle: settings.seo?.siteTitle?.trim() ? settings.seo.siteTitle : logoText,
        siteDescription: settings.seo?.siteDescription?.trim() ? settings.seo.siteDescription : description,
        titleTemplate: settings.seo?.titleTemplate?.trim() ? settings.seo.titleTemplate : `%s | ${logoText}`,
        defaultOgImage: settings.seo?.defaultOgImage,
        robots: settings.seo?.robots ?? {
          index: true,
          follow: true
        },
        pages: settings.seo?.pages ?? {}
      };
    };

    syncBrandingIntoThemeSettings(site.themeSettings.draftJson);
    syncBrandingIntoThemeSettings(site.themeSettings.publishedJson);

    const themeKey =
      getPrimaryDraftSiteTheme(state, site.id)?.themeKey ??
      getActiveSiteTheme(state, site.id)?.themeKey ??
      "theme1";
    site.themeSettings.draftJson = withNormalizedSiteThemeSettings(site, site.themeSettings.draftJson, themeKey);
    site.themeSettings.publishedJson = withNormalizedSiteThemeSettings(site, site.themeSettings.publishedJson, themeKey);

    const gateway = state.aiGatewayGroups.find((item) => item.siteId === site.id);
    if (gateway && gateway.name === `${previousLogoText} primary quota`) {
      gateway.name = `${logoText} primary quota`;
    }

    state.auditLogs.unshift({
      id: uid("audit"),
      siteId: site.id,
      actorType: params.actorType ?? "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "site_settings_updated",
      targetType: "site",
      targetId: site.id,
      createdAt: new Date().toISOString(),
      metadata: {
        status: site.status,
        currency: site.currency,
        timezone: site.timezone,
        connectStatus: site.connect.status,
        chargesEnabled: site.connect.chargesEnabled,
        payoutsEnabled: site.connect.payoutsEnabled
      }
    });

    result = { site };
  });
  if (!result) throw new StoreError("site_settings_update_failed", 500);
  return result;
}

export function createSiteAdmin(params: {
  siteId: string;
  email: string;
  password: string;
  displayName: string;
  role: SiteAdmin["role"];
  actor?: string;
}): { admin: SiteAdmin } {
  let result: { admin: SiteAdmin } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const email = params.email.trim().toLowerCase();
    const password = params.password.trim();
    const displayName = params.displayName.trim();
    if (!email || !email.includes("@")) throw new StoreError("invalid_site_admin_email", 400);
    if (password.length < 6) throw new StoreError("invalid_site_admin_password", 400);
    if (!displayName) throw new StoreError("invalid_site_admin_name", 400);
    if (!["owner", "admin", "support"].includes(params.role)) throw new StoreError("invalid_site_admin_role", 400);
    if (state.siteAdmins.some((item) => item.siteId === params.siteId && item.email === email)) {
      throw new StoreError("site_admin_exists", 409);
    }

    const admin: SiteAdmin = {
      id: uid("admin"),
      siteId: params.siteId,
      email,
      passwordHash: hashPassword(password),
      displayName,
      role: params.role,
      createdAt: new Date().toISOString()
    };

    state.siteAdmins.push(admin);
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "site_admin_created",
      targetType: "site_admin",
      targetId: admin.id,
      createdAt: new Date().toISOString(),
      metadata: {
        email: admin.email,
        role: admin.role
      }
    });

    result = { admin };
  });
  if (!result) throw new StoreError("site_admin_create_failed", 500);
  return result;
}

export function updateSiteAdmin(params: {
  siteId: string;
  adminId: string;
  displayName?: string;
  role?: SiteAdmin["role"];
  password?: string;
  actor?: string;
}): { admin: SiteAdmin } {
  let result: { admin: SiteAdmin } | undefined;
  mutatePlatformState((state) => {
    const admin = state.siteAdmins.find((item) => item.siteId === params.siteId && item.id === params.adminId);
    if (!admin) throw new StoreError("site_admin_not_found", 404);

    const metadata: Record<string, string | number | boolean> = {};

    if (params.displayName !== undefined) {
      const displayName = params.displayName.trim();
      if (!displayName) throw new StoreError("invalid_site_admin_name", 400);
      admin.displayName = displayName;
      metadata.displayName = displayName;
    }

    if (params.role !== undefined) {
      if (!["owner", "admin", "support"].includes(params.role)) throw new StoreError("invalid_site_admin_role", 400);
      if (admin.role === "owner" && params.role !== "owner") {
        const ownerCount = state.siteAdmins.filter((item) => item.siteId === params.siteId && item.role === "owner").length;
        if (ownerCount <= 1) throw new StoreError("site_requires_owner", 409);
      }
      admin.role = params.role;
      metadata.role = params.role;
    }

    if (params.password !== undefined) {
      const password = params.password.trim();
      if (password.length < 6) throw new StoreError("invalid_site_admin_password", 400);
      admin.passwordHash = hashPassword(password);
      metadata.passwordReset = true;
    }

    if (!Object.keys(metadata).length) throw new StoreError("site_admin_update_empty", 400);

    state.auditLogs.unshift({
      id: uid("audit"),
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "site_admin_updated",
      targetType: "site_admin",
      targetId: admin.id,
      createdAt: new Date().toISOString(),
      metadata
    });

    result = { admin };
  });
  if (!result) throw new StoreError("site_admin_update_failed", 500);
  return result;
}

export function deleteSiteAdmin(params: {
  siteId: string;
  adminId: string;
  actor?: string;
}): { deletedAdmin: SiteAdmin } {
  let result: { deletedAdmin: SiteAdmin } | undefined;
  mutatePlatformState((state) => {
    const index = state.siteAdmins.findIndex((item) => item.siteId === params.siteId && item.id === params.adminId);
    if (index === -1) throw new StoreError("site_admin_not_found", 404);
    const admin = state.siteAdmins[index];
    if (admin.role === "owner") {
      const ownerCount = state.siteAdmins.filter((item) => item.siteId === params.siteId && item.role === "owner").length;
      if (ownerCount <= 1) throw new StoreError("site_requires_owner", 409);
    }

    state.siteAdmins.splice(index, 1);
    state.siteAdminSessions = state.siteAdminSessions.filter((session) => session.siteAdminId !== admin.id);
    state.auditLogs.unshift({
      id: uid("audit"),
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "site_admin_deleted",
      targetType: "site_admin",
      targetId: admin.id,
      createdAt: new Date().toISOString(),
      metadata: {
        email: admin.email,
        role: admin.role
      }
    });
    result = { deletedAdmin: admin };
  });
  if (!result) throw new StoreError("site_admin_delete_failed", 500);
  return result;
}

export function createPlatformAdminSession(params: {
  email: string;
  password: string;
}): { platformAdmin: PublicPlatformAdmin; session: PlatformSession } {
  let result: { platformAdmin: PublicPlatformAdmin; session: PlatformSession } | undefined;
  const email = params.email.trim().toLowerCase();
  mutatePlatformState((state) => {
    const platformAdmin = state.platformAdmins.find((item) => item.email === email);
    if (!platformAdmin || !verifyPassword(params.password, platformAdmin.passwordHash)) {
      throw new StoreError("invalid_platform_credentials", 401);
    }
    const session: PlatformSession = {
      id: uid("psess"),
      platformAdminId: platformAdmin.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + sessionTtlMs).toISOString()
    };
    state.platformSessions.push(session);
    result = { platformAdmin: toPublicPlatformAdmin(platformAdmin), session };
  });
  if (!result) throw new StoreError("platform_session_create_failed", 500);
  return result;
}

export function deletePlatformAdminSession(sessionId: string): PlatformState {
  return mutatePlatformState((state) => {
    state.platformSessions = state.platformSessions.filter((session) => session.id !== sessionId);
  });
}

export function createSiteAdminSession(params: {
  siteId: string;
  email: string;
  password: string;
}): { siteAdmin: PublicSiteAdmin; session: SiteAdminSession } {
  let result: { siteAdmin: PublicSiteAdmin; session: SiteAdminSession } | undefined;
  const email = params.email.trim().toLowerCase();
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const siteAdmin = state.siteAdmins.find((item) => item.siteId === params.siteId && item.email === email);
    if (!siteAdmin || !verifyPassword(params.password, siteAdmin.passwordHash)) {
      throw new StoreError("invalid_site_admin_credentials", 401);
    }
    const session: SiteAdminSession = {
      id: uid("sasess"),
      siteId: params.siteId,
      siteAdminId: siteAdmin.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + sessionTtlMs).toISOString()
    };
    state.siteAdminSessions.push(session);
    result = { siteAdmin: toPublicSiteAdmin(siteAdmin), session };
  });
  if (!result) throw new StoreError("site_admin_session_create_failed", 500);
  return result;
}

export function createSiteAdminSessionByAdminId(params: {
  siteId: string;
  siteAdminId: string;
}): { siteAdmin: PublicSiteAdmin; session: SiteAdminSession } {
  let result: { siteAdmin: PublicSiteAdmin; session: SiteAdminSession } | undefined;
  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    const siteAdmin = state.siteAdmins.find((item) => item.siteId === params.siteId && item.id === params.siteAdminId);
    if (!siteAdmin) throw new StoreError("site_admin_not_found", 404);
    const session: SiteAdminSession = {
      id: uid("sasess"),
      siteId: params.siteId,
      siteAdminId: siteAdmin.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + sessionTtlMs).toISOString()
    };
    state.siteAdminSessions.push(session);
    result = { siteAdmin: toPublicSiteAdmin(siteAdmin), session };
  });
  if (!result) throw new StoreError("site_admin_session_create_failed", 500);
  return result;
}

export function deleteSiteAdminSession(sessionId: string): PlatformState {
  return mutatePlatformState((state) => {
    state.siteAdminSessions = state.siteAdminSessions.filter((session) => session.id !== sessionId);
  });
}

export function updateGatewayGroup(params: {
  siteId: string;
  groupId: string;
  status: AiGatewayGroup["status"];
  modelAllowlist: string[];
  monthlyQuota: number;
  retryStatusCodes: number[];
  rateLimitPerMinute: number;
  accountPoolMode: AiGatewayGroup["accountPoolMode"];
  unavailableReason?: string;
}): { gatewayGroup: AiGatewayGroup } {
  let result: { gatewayGroup: AiGatewayGroup } | undefined;
  mutatePlatformState((state) => {
    const group = state.aiGatewayGroups.find((item) => item.siteId === params.siteId && item.id === params.groupId);
    if (!group) throw new StoreError("gateway_group_not_found", 404);
    if (!Number.isInteger(params.monthlyQuota) || params.monthlyQuota < 0) throw new StoreError("invalid_monthly_quota", 400);
    if (!Number.isInteger(params.rateLimitPerMinute) || params.rateLimitPerMinute < 1) throw new StoreError("invalid_rate_limit", 400);
    group.status = params.status;
    group.modelAllowlist = params.modelAllowlist.map((model) => model.trim()).filter(Boolean);
    group.monthlyQuota = params.monthlyQuota;
    group.retryStatusCodes = params.retryStatusCodes.filter((code) => Number.isInteger(code));
    group.rateLimitPerMinute = params.rateLimitPerMinute;
    group.accountPoolMode = params.accountPoolMode;
    group.unavailableReason = params.unavailableReason?.trim() || undefined;
    result = { gatewayGroup: group };
  });
  if (!result) throw new StoreError("gateway_group_update_failed", 500);
  return result;
}

export function updateSiteAiApp(params: {
  siteId: string;
  siteAiAppId: string;
  enabled: boolean;
  creditCost: number;
  routeKey: string;
}): { siteAiApp: SiteAiApp } {
  let result: { siteAiApp: SiteAiApp } | undefined;
  mutatePlatformState((state) => {
    const siteAiApp = state.siteAiApps.find((item) => item.siteId === params.siteId && item.id === params.siteAiAppId);
    if (!siteAiApp) throw new StoreError("site_ai_app_not_found", 404);
    if (!Number.isInteger(params.creditCost) || params.creditCost < 0) {
      throw new StoreError("invalid_credit_cost", 400);
    }
    const routeKey = params.routeKey.trim();
    if (!routeKey) throw new StoreError("invalid_route_key", 400);
    siteAiApp.enabled = params.enabled;
    siteAiApp.creditCost = params.creditCost;
    siteAiApp.routeKey = routeKey;
    result = { siteAiApp };
  });
  if (!result) throw new StoreError("site_ai_app_update_failed", 500);
  return result;
}

export function updateCustomerStatus(params: {
  siteId: string;
  customerId: string;
  status: Customer["status"];
}): { customer: Customer } {
  let result: { customer: Customer } | undefined;
  mutatePlatformState((state) => {
    const customer = state.customers.find((item) => item.siteId === params.siteId && item.id === params.customerId);
    if (!customer) throw new StoreError("customer_not_found_for_site", 404);
    if (!["active", "past_due", "blocked"].includes(params.status)) {
      throw new StoreError("invalid_customer_status", 400);
    }
    customer.status = params.status;
    result = { customer };
  });
  if (!result) throw new StoreError("customer_status_update_failed", 500);
  return result;
}

export function adjustCustomerCredits(params: {
  siteId: string;
  customerId: string;
  amount: number;
  reason: string;
  actor?: string;
}): { customer: Customer; ledger: CreditLedgerEntry } {
  let result: { customer: Customer; ledger: CreditLedgerEntry } | undefined;
  mutatePlatformState((state) => {
    const customer = state.customers.find((item) => item.siteId === params.siteId && item.id === params.customerId);
    if (!customer) throw new StoreError("customer_not_found_for_site", 404);
    if (!Number.isInteger(params.amount) || params.amount === 0) {
      throw new StoreError("invalid_adjustment_amount", 400);
    }
    if (customer.balance.available + params.amount < 0) {
      throw new StoreError("adjustment_would_make_negative_balance", 409);
    }
    const reason = params.reason.trim();
    if (reason.length < 3) throw new StoreError("adjustment_reason_required", 400);
    const ledger = pushLedgerOnce(state, {
      siteId: params.siteId,
      customerId: params.customerId,
      amount: params.amount,
      type: "adjustment",
      sourceType: "site_admin_adjustment",
      sourceId: uid("adj")
    });
    applyBalance(customer, "adjustment", params.amount);
    ledger.sourceType = `site_admin_adjustment:${params.actor ?? "site_admin_demo"}:${reason.slice(0, 80)}`;
    result = { customer, ledger };
  });
  if (!result) throw new StoreError("credit_adjustment_failed", 500);
  return result;
}

function pushLedgerOnce(state: PlatformState, entry: Omit<CreditLedgerEntry, "id" | "createdAt">): CreditLedgerEntry {
  const existing = state.ledger.find(
    (item) => item.siteId === entry.siteId && item.customerId === entry.customerId && item.sourceId === entry.sourceId && item.type === entry.type
  );
  if (existing) return existing;
  const ledgerEntry: CreditLedgerEntry = {
    ...entry,
    id: uid("led"),
    createdAt: new Date().toISOString()
  };
  state.ledger.push(ledgerEntry);
  return ledgerEntry;
}

function findLedgerEntry(
  state: PlatformState,
  entry: Pick<CreditLedgerEntry, "siteId" | "customerId" | "sourceId" | "type">
): CreditLedgerEntry | undefined {
  return state.ledger.find(
    (item) => item.siteId === entry.siteId && item.customerId === entry.customerId && item.sourceId === entry.sourceId && item.type === entry.type
  );
}

function applyBalance(customer: Customer, type: LedgerType, amount: number) {
  const credits = Math.abs(amount);
  if (type === "grant") customer.balance.available += amount;
  if (type === "adjustment") customer.balance.available += amount;
  if (type === "reserve") {
    customer.balance.available -= credits;
    customer.balance.reserved += credits;
  }
  if (type === "consume") {
    customer.balance.reserved = Math.max(0, customer.balance.reserved - credits);
  }
  if (type === "release") {
    customer.balance.available += credits;
    customer.balance.reserved = Math.max(0, customer.balance.reserved - credits);
  }
}

export function createCustomerSession(params: { siteId: string; email: string; password: string; name?: string }): {
  customer: PublicCustomer;
  session: CustomerSession;
  createdCustomer: boolean;
} {
  let result:
    | {
        customer: PublicCustomer;
        session: CustomerSession;
        createdCustomer: boolean;
      }
    | undefined;
  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) throw new StoreError("invalid_email", 400);
  if (params.password.trim().length < 6) throw new StoreError("password_min_6_chars", 400);

  mutatePlatformState((state) => {
    const site = state.sites.find((item) => item.id === params.siteId);
    if (!site) throw new StoreError("site_not_found", 404);
    let customer = state.customers.find((item) => item.siteId === params.siteId && item.email === email);
    let createdCustomer = false;
    if (!customer) {
      createdCustomer = true;
      const signupCreditGrant = Math.max(0, Math.trunc(Number(site.signupCreditGrant ?? 0)));
      customer = {
        id: uid(`cust_${site.slug}`),
        siteId: params.siteId,
        email,
        passwordHash: hashPassword(params.password),
        name: params.name?.trim() || email.split("@")[0],
        status: "active",
        balance: { available: signupCreditGrant, reserved: 0 }
      };
      state.customers.push(customer);
      if (signupCreditGrant > 0) {
        pushLedgerOnce(state, {
          siteId: params.siteId,
          customerId: customer.id,
          amount: signupCreditGrant,
          type: "grant",
          sourceType: "signup_credit",
          sourceId: `signup_${customer.id}`
        });
      }
    } else if (!verifyPassword(params.password, customer.passwordHash)) {
      throw new StoreError("invalid_customer_credentials", 401);
    }
    const session: CustomerSession = {
      id: uid("sess"),
      siteId: params.siteId,
      customerId: customer.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + sessionTtlMs).toISOString()
    };
    state.customerSessions.push(session);
    result = { customer: toPublicCustomer(customer), session, createdCustomer };
  });

  if (!result) throw new StoreError("session_create_failed", 500);
  return result;
}

export function deleteCustomerSession(sessionId: string): PlatformState {
  return mutatePlatformState((state) => {
    state.customerSessions = state.customerSessions.filter((session) => session.id !== sessionId);
  });
}

function hasActiveCustomerSubscription(state: PlatformState, siteId: string, customerId: string): boolean {
  const now = Date.now();
  return state.subscriptions.some((subscription) => {
    if (subscription.siteId !== siteId || subscription.customerId !== customerId) return false;
    if (subscription.status !== "active" && subscription.status !== "trialing") return false;
    return new Date(subscription.currentPeriodEnd).getTime() > now;
  });
}

export function createGenerationJob(params: {
  siteId: string;
  customerId: string;
  aiAppSlug: string;
  requestJson?: Record<string, unknown>;
}): { job: GenerationJob; siteAiApp: SiteAiApp; ledger: CreditLedgerEntry; customer: Customer } {
  let result: { job: GenerationJob; siteAiApp: SiteAiApp; ledger: CreditLedgerEntry; customer: Customer } | undefined;
  mutatePlatformState((state) => {
    const customer = state.customers.find((item) => item.siteId === params.siteId && item.id === params.customerId);
    if (!customer) throw new StoreError("customer_not_found_for_site", 404);
    if (customer.status === "past_due") throw new StoreError("customer_past_due", 402);
    if (customer.status === "blocked") throw new StoreError("customer_blocked", 403);
    if (!hasActiveCustomerSubscription(state, params.siteId, params.customerId)) throw new StoreError("subscription_required", 402);
    const siteAiApp = state.siteAiApps.find(
      (item) => item.siteId === params.siteId && item.enabled && item.aiApp.slug === params.aiAppSlug
    );
    if (!siteAiApp) throw new StoreError("ai_app_not_enabled_for_site", 404);
    if (customer.balance.available < siteAiApp.creditCost) throw new StoreError("insufficient_credits", 402);
    const requestedAssetIds = Array.isArray(params.requestJson?.assetIds)
      ? params.requestJson.assetIds.filter((item): item is string => typeof item === "string")
      : [];
    if (requestedAssetIds.length) {
      const validAssetIds = new Set(
        state.assetUploads
          .filter((asset) => asset.siteId === params.siteId && asset.customerId === params.customerId && !asset.deletedAt)
          .map((asset) => asset.id)
      );
      const invalidAssetId = requestedAssetIds.find((assetId) => !validAssetIds.has(assetId));
      if (invalidAssetId) throw new StoreError("asset_not_found_for_customer", 404);
    }

    const now = new Date().toISOString();
    const job: GenerationJob = {
      id: uid("job"),
      siteId: params.siteId,
      customerId: customer.id,
      aiAppId: siteAiApp.aiApp.id,
      status: "queued",
      creditsReserved: siteAiApp.creditCost,
      createdAt: now,
      updatedAt: now,
      requestJson: {
        ...(params.requestJson ?? {}),
        worker: siteAiApp.routeKey
      }
    };
    state.jobs.unshift(job);
    const ledger = pushLedgerOnce(state, {
      siteId: params.siteId,
      customerId: customer.id,
      amount: -siteAiApp.creditCost,
      type: "reserve",
      sourceType: "generation_job",
      sourceId: job.id
    });
    applyBalance(customer, "reserve", siteAiApp.creditCost);
    result = { job, siteAiApp, ledger, customer };
  });

  if (!result) throw new StoreError("job_create_failed", 500);
  return result;
}

export function rerunGenerationJob(params: {
  siteId: string;
  jobId: string;
  actor?: string;
}): { sourceJob: GenerationJob; job: GenerationJob; siteAiApp: SiteAiApp; ledger: CreditLedgerEntry; customer: Customer } {
  const state = readPlatformState();
  const sourceJob = state.jobs.find((item) => item.siteId === params.siteId && item.id === params.jobId);
  if (!sourceJob) throw new StoreError("job_not_found", 404);
  if (sourceJob.status !== "failed" && sourceJob.status !== "refunded") {
    throw new StoreError("only_failed_or_refunded_jobs_can_be_rerun", 409);
  }
  const aiApp = state.aiApps.find((item) => item.id === sourceJob.aiAppId);
  if (!aiApp) throw new StoreError("ai_app_not_found", 404);
  const cleanRequest = { ...sourceJob.requestJson };
  delete cleanRequest.lastWorkerStatus;
  delete cleanRequest.lastWorkerStage;
  const rerun = createGenerationJob({
    siteId: params.siteId,
    customerId: sourceJob.customerId,
    aiAppSlug: aiApp.slug,
    requestJson: {
      ...cleanRequest,
      rerunOf: sourceJob.id,
      rerunBy: params.actor ?? "site_admin_demo"
    }
  });
  return { sourceJob, ...rerun };
}

export function updateGenerationJobStatus(params: {
  jobId: string;
  siteId: string;
  requestId: string;
  status: string;
  stage?: string;
}): { job: GenerationJob; alreadyFinal: boolean } {
  let result: { job: GenerationJob; alreadyFinal: boolean } | undefined;
  mutatePlatformState((state) => {
    const job = state.jobs.find((item) => item.id === params.jobId && item.siteId === params.siteId);
    if (!job) throw new StoreError("job_not_found", 404);
    const alreadyFinal = job.status === "succeeded" || job.status === "failed" || job.status === "refunded";
    if (!alreadyFinal && params.status !== "queued") {
      job.status = params.status === "failed" ? "failed" : "running";
    }
    job.updatedAt = new Date().toISOString();
    job.resultJson = {
      ...(job.resultJson ?? {}),
      lastWorkerStatus: params.status,
      lastWorkerStage: params.stage ?? "worker_update",
      requestId: params.requestId
    };
    result = { job, alreadyFinal };
  });
  if (!result) throw new StoreError("job_status_update_failed", 500);
  return result;
}

export function settleGenerationJob(params: {
  jobId: string;
  siteId: string;
  requestId: string;
  status: "succeeded" | "failed";
  outputs?: Array<{ storageKey: string; mimeType?: string }>;
  providerTrace?: Array<{ provider: string; attempts: number }>;
  costTrace?: { estimatedCostUsd?: number };
  error?: string;
}): { job: GenerationJob; ledger?: CreditLedgerEntry; alreadyProcessed: boolean; customer: Customer } {
  let result: { job: GenerationJob; ledger?: CreditLedgerEntry; alreadyProcessed: boolean; customer: Customer } | undefined;
  mutatePlatformState((state) => {
    const job = state.jobs.find((item) => item.id === params.jobId && item.siteId === params.siteId);
    if (!job) throw new StoreError("job_not_found", 404);
    const customer = state.customers.find((item) => item.id === job.customerId && item.siteId === job.siteId);
    if (!customer) throw new StoreError("customer_not_found_for_site", 404);
    const alreadyProcessed = job.status === "succeeded" || job.status === "failed" || job.status === "refunded";
    if (alreadyProcessed) {
      result = { job, alreadyProcessed, customer };
      return;
    }

    const ledgerType: LedgerType = params.status === "succeeded" ? "consume" : "release";
    const existingSettlementLedger = findLedgerEntry(state, {
      siteId: job.siteId,
      customerId: job.customerId,
      type: ledgerType,
      sourceId: job.id
    });
    const ledger =
      existingSettlementLedger ??
      pushLedgerOnce(state, {
        siteId: job.siteId,
        customerId: job.customerId,
        amount: params.status === "succeeded" ? -job.creditsReserved : job.creditsReserved,
        type: ledgerType,
        sourceType: "generation_job",
        sourceId: job.id
      });
    if (!existingSettlementLedger) {
      applyBalance(customer, ledgerType, job.creditsReserved);
    }
    job.status = params.status;
    job.updatedAt = new Date().toISOString();
    const outputs = params.outputs ?? [];
    job.resultJson = {
      requestId: params.requestId,
      outputs,
      providerTrace: params.providerTrace ?? [],
      costTrace: params.costTrace ?? {},
      error: params.error ?? null,
      settledAt: new Date().toISOString()
    };
    if (params.status === "succeeded") {
      outputs.forEach((output, index) => {
        const existing = state.assetUploads.find(
          (asset) => asset.siteId === job.siteId && asset.customerId === job.customerId && asset.jobId === job.id && asset.storageKey === output.storageKey
        );
        if (existing) return;
        state.assetUploads.unshift({
          id: uid("asset"),
          siteId: job.siteId,
          customerId: job.customerId,
          jobId: job.id,
          label: `Output ${index + 1}`,
          storageKey: output.storageKey,
          mimeType: output.mimeType ?? "image/webp",
          role: "output",
          visibility: "private",
          reviewStatus: "approved",
          createdAt: new Date().toISOString()
        });
      });
      const album = state.albums.find((item) => item.siteId === job.siteId && item.sourceJobId === job.id);
      const coverAsset = state.assetUploads.find(
        (asset) => asset.siteId === job.siteId && asset.customerId === job.customerId && asset.jobId === job.id && asset.role === "output"
      );
      const packId =
        typeof job.requestJson.creativePackId === "string"
          ? job.requestJson.creativePackId
          : state.creativePacks.find((pack) => pack.siteId === job.siteId && pack.aiAppSlug === state.aiApps.find((app) => app.id === job.aiAppId)?.slug)?.id;
      if (album) {
        album.status = "ready";
        album.outputCount = outputs.length || album.outputCount;
        album.coverAssetId = coverAsset?.id ?? album.coverAssetId;
        album.updatedAt = new Date().toISOString();
      } else {
        const pack = packId ? state.creativePacks.find((item) => item.siteId === job.siteId && item.id === packId) : undefined;
        state.albums.unshift({
          id: uid("album"),
          siteId: job.siteId,
          customerId: job.customerId,
          title: pack ? `${pack.name} album` : "Generated album",
          sourceJobId: job.id,
          creativePackId: packId,
          status: "ready",
          outputCount: outputs.length,
          coverAssetId: coverAsset?.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
    result = { job, ledger, alreadyProcessed: false, customer };
  });

  if (!result) throw new StoreError("job_settle_failed", 500);
  return result;
}

export function recordStripeWebhook(payload: {
  id?: string;
  type?: string;
  account?: string;
  data?: { object?: { metadata?: { siteId?: string; customerId?: string; priceId?: string; creditsGranted?: string } } };
}): { event: PaymentEvent; siteId: string; alreadyProcessed: boolean; ledger?: CreditLedgerEntry } {
  if (!payload.id || !payload.type) throw new StoreError("invalid_webhook_payload", 400);
  const providerEventId = payload.id;
  const eventType = payload.type;
  let result: { event: PaymentEvent; siteId: string; alreadyProcessed: boolean; ledger?: CreditLedgerEntry } | undefined;
  mutatePlatformState((state) => {
    const siteId =
      payload.data?.object?.metadata?.siteId ??
      state.sites.find((site) => site.connect.stripeAccountId === payload.account)?.id;
    if (!siteId) throw new StoreError("site_not_found_for_webhook", 400);
    const existing = state.paymentEvents.find(
      (event) => event.siteId === siteId && event.provider === "stripe" && event.providerEventId === providerEventId
    );
    if (existing) {
      result = { event: existing, siteId, alreadyProcessed: true };
      return;
    }
    const event: PaymentEvent = {
      id: uid("payevt"),
      siteId,
      provider: "stripe",
      providerEventId,
      eventType,
      processedAt: new Date().toISOString(),
      payload: payload as Record<string, unknown>
    };
    state.paymentEvents.push(event);

    const metadata = payload.data?.object?.metadata;
    const customer = metadata?.customerId
      ? state.customers.find((item) => item.siteId === siteId && item.id === metadata.customerId)
      : undefined;
    const price = metadata?.priceId
      ? state.products.flatMap((product) => product.prices).find((item) => item.siteId === siteId && (item.id === metadata.priceId || item.stripePriceId === metadata.priceId))
      : undefined;
    const credits = Number(metadata?.creditsGranted ?? price?.creditsGranted ?? 0);
    const paidEvent = ["checkout.session.completed", "invoice.paid", "payment_intent.succeeded"].includes(eventType);
    if (paidEvent && customer && credits > 0) {
      const ledger = pushLedgerOnce(state, {
        siteId,
        customerId: customer.id,
        amount: credits,
        type: "grant",
        sourceType: "stripe_webhook",
        sourceId: providerEventId
      });
      applyBalance(customer, "grant", credits);
      result = { event, siteId, alreadyProcessed: false, ledger };
      return;
    }
    result = { event, siteId, alreadyProcessed: false };
  });
  if (!result) throw new StoreError("webhook_record_failed", 500);
  return result;
}

export function getPlatformAiProviderFallbackQueue(): Array<Pick<PlatformAiProvider, "id" | "label" | "aiUrl" | "modelType" | "priority" | "preferred" | "supportsGenerationN" | "supportsEditN" | "maxImagesPerRequest">> {
  const state = readPlatformState();
  const providers = state.platformAiProviders ?? [];
  return providers
    .slice()
    .sort((left, right) => Number(right.preferred) - Number(left.preferred) || left.priority - right.priority)
    .map(({ id, label, aiUrl, modelType, priority, preferred, supportsGenerationN, supportsEditN, maxImagesPerRequest }) => ({
      id,
      label,
      aiUrl,
      modelType,
      priority,
      preferred,
      supportsGenerationN,
      supportsEditN,
      maxImagesPerRequest
    }));
}

export function updatePlatformEmailSettings(params: {
  apiKey?: string;
  fromEmail?: string;
  replyTo?: string;
  actor?: string;
}): PlatformState {
  return mutatePlatformState((state) => {
    const current = state.platformEmailSettings ?? { provider: "resend" as const };
    const nextApiKey = normalizeResendApiKey(params.apiKey);
    const fromEmail = params.fromEmail?.trim();
    const replyTo = params.replyTo?.trim();
    const now = new Date().toISOString();
    state.platformEmailSettings = {
      provider: "resend",
      apiKey: nextApiKey || current.apiKey,
      fromEmail: fromEmail ?? current.fromEmail,
      replyTo: replyTo ?? current.replyTo,
      updatedAt: now,
      updatedBy: params.actor
    };
    const configs = state.platformEmailConfigs ?? [];
    const defaultConfig = configs.find((config) => config.isDefault) ?? configs[0];
    const nextConfig = normalizePlatformEmailConfig(
      {
        ...(defaultConfig ?? { id: "resend_default", label: "Default Resend", isDefault: true }),
        apiKey: nextApiKey ?? defaultConfig?.apiKey ?? current.apiKey,
        fromEmail: fromEmail ?? defaultConfig?.fromEmail ?? current.fromEmail,
        replyTo: replyTo ?? defaultConfig?.replyTo ?? current.replyTo,
        isDefault: true,
        updatedAt: now,
        updatedBy: params.actor
      },
      state.platformEmailSettings
    );
    state.platformEmailConfigs = [nextConfig, ...configs.filter((config) => config.id !== nextConfig.id).map((config) => ({ ...config, isDefault: false }))];
    state.auditLogs.unshift({
      id: uid("audit"),
      actorType: "platform_admin",
      actorId: params.actor ?? "platform",
      action: "platform_email_settings_updated",
      targetType: "platform_email_settings",
      targetId: "resend",
      createdAt: now,
      metadata: {
        fromEmailConfigured: Boolean(state.platformEmailSettings.fromEmail),
        replyToConfigured: Boolean(state.platformEmailSettings.replyTo),
        apiKeyUpdated: Boolean(nextApiKey)
      }
    });
  });
}

export function upsertPlatformCloudflareAccount(params: {
  id?: string;
  label: string;
  email: string;
  accountId: string;
  apiToken?: string;
  makeCurrent?: boolean;
  actor?: string;
}): PlatformCloudflareAccount {
  let result: PlatformCloudflareAccount | undefined;
  mutatePlatformState((state) => {
    state.platformCloudflareAccounts ??= [];
    const now = new Date().toISOString();
    const accountId = params.accountId.trim();
    const existing = params.id
      ? state.platformCloudflareAccounts.find((account) => account.id === params.id)
      : state.platformCloudflareAccounts.find((account) => account.accountId === accountId);
    const account: PlatformCloudflareAccount = {
      id: existing?.id ?? uid("cf"),
      label: params.label.trim(),
      email: params.email.trim().toLowerCase(),
      accountId,
      apiToken: params.apiToken?.trim() || existing?.apiToken || "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedBy: params.actor
    };
    if (existing) {
      state.platformCloudflareAccounts = state.platformCloudflareAccounts.map((item) => (item.id === existing.id ? account : item));
    } else {
      state.platformCloudflareAccounts.push(account);
    }
    if (params.makeCurrent) {
      state.currentCloudflareAccountId = account.id;
    }
    state.auditLogs.unshift({
      id: uid("audit"),
      actorType: "platform_admin",
      actorId: params.actor ?? "platform",
      action: "platform_cloudflare_account_upserted",
      targetType: "platform_cloudflare_account",
      targetId: account.id,
      createdAt: now,
      metadata: {
        label: account.label ?? "",
        email: account.email ?? "",
        accountIdConfigured: Boolean(account.accountId),
        apiTokenUpdated: Boolean(params.apiToken?.trim())
      }
    });
    result = account;
  });
  if (!result) throw new StoreError("cloudflare_account_save_failed", 500);
  return result;
}

export function setCurrentPlatformCloudflareAccount(params: { accountId: string; actor?: string }): PlatformCloudflareAccount {
  let result: PlatformCloudflareAccount | undefined;
  mutatePlatformState((state) => {
    state.platformCloudflareAccounts ??= [];
    const account = state.platformCloudflareAccounts.find((item) => item.id === params.accountId);
    if (!account) throw new StoreError("cloudflare_account_not_found", 404);
    state.currentCloudflareAccountId = account.id;
    account.updatedAt = new Date().toISOString();
    account.updatedBy = params.actor;
    state.auditLogs.unshift({
      id: uid("audit"),
      actorType: "platform_admin",
      actorId: params.actor ?? "platform",
      action: "platform_cloudflare_current_account_changed",
      targetType: "platform_cloudflare_account",
      targetId: account.id,
      createdAt: account.updatedAt,
      metadata: {
        label: account.label ?? "",
        accountId: account.accountId
      }
    });
    result = account;
  });
  if (!result) throw new StoreError("cloudflare_account_not_found", 404);
  return result;
}

export function clearCurrentPlatformCloudflareAccount(params: { accountId?: string; actor?: string }): void {
  mutatePlatformState((state) => {
    state.platformCloudflareAccounts ??= [];
    const currentId = state.currentCloudflareAccountId;
    if (!currentId) return;
    if (params.accountId && params.accountId !== currentId) {
      throw new StoreError("cloudflare_account_not_current", 400);
    }
    const account = state.platformCloudflareAccounts.find((item) => item.id === currentId);
    delete state.currentCloudflareAccountId;
    const now = new Date().toISOString();
    state.auditLogs.unshift({
      id: uid("audit"),
      actorType: "platform_admin",
      actorId: params.actor ?? "platform",
      action: "platform_cloudflare_current_account_cleared",
      targetType: "platform_cloudflare_account",
      targetId: currentId,
      createdAt: now,
      metadata: {
        label: account?.label ?? "",
        accountId: account?.accountId ?? ""
      }
    });
  });
}

export function deletePlatformCloudflareAccount(params: { accountId: string; actor?: string }): PlatformCloudflareAccount {
  let removed: PlatformCloudflareAccount | undefined;
  mutatePlatformState((state) => {
    state.platformCloudflareAccounts ??= [];
    const account = state.platformCloudflareAccounts.find((item) => item.id === params.accountId);
    if (!account) throw new StoreError("cloudflare_account_not_found", 404);
    const wasCurrent = state.currentCloudflareAccountId === account.id;
    state.platformCloudflareAccounts = state.platformCloudflareAccounts.filter((item) => item.id !== account.id);
    if (wasCurrent) {
      delete state.currentCloudflareAccountId;
    }
    const now = new Date().toISOString();
    state.auditLogs.unshift({
      id: uid("audit"),
      actorType: "platform_admin",
      actorId: params.actor ?? "platform",
      action: "platform_cloudflare_account_deleted",
      targetType: "platform_cloudflare_account",
      targetId: account.id,
      createdAt: now,
      metadata: {
        label: account.label ?? "",
        email: account.email ?? "",
        accountId: account.accountId ?? "",
        wasCurrent
      }
    });
    removed = account;
  });
  if (!removed) throw new StoreError("cloudflare_account_not_found", 404);
  return removed;
}

export function upsertPlatformAiProvider(params: {
  id?: string;
  label: string;
  aiUrl: string;
  apiKey?: string;
  modelType: string;
  makeCurrent?: boolean;
  supportsGenerationN?: boolean;
  supportsEditN?: boolean;
  maxImagesPerRequest?: number;
  actor?: string;
}): PlatformAiProvider {
  let result: PlatformAiProvider | undefined;
  mutatePlatformState((state) => {
    const providers = state.platformAiProviders ?? [];
    state.platformAiProviders = providers;
    const now = new Date().toISOString();
    const existing = params.id ? providers.find((provider) => provider.id === params.id) : undefined;
    if (existing) {
      existing.label = params.label.trim();
      existing.aiUrl = params.aiUrl.trim();
      existing.apiKey = params.apiKey?.trim() || existing.apiKey;
      existing.modelType = params.modelType.trim();
      existing.supportsGenerationN = Boolean(params.supportsGenerationN);
      existing.supportsEditN = Boolean(params.supportsEditN);
      existing.maxImagesPerRequest = Math.max(1, Math.min(Math.trunc(Number(params.maxImagesPerRequest) || 1), 20));
      existing.updatedAt = now;
      existing.updatedBy = params.actor;
      result = existing;
    } else {
      result = {
        id: uid("aiprov"),
        label: params.label.trim(),
        aiUrl: params.aiUrl.trim(),
        apiKey: params.apiKey?.trim() || undefined,
        modelType: params.modelType.trim(),
        priority: providers.length + 1,
        preferred: providers.length === 0,
        supportsGenerationN: Boolean(params.supportsGenerationN),
        supportsEditN: Boolean(params.supportsEditN),
        maxImagesPerRequest: Math.max(1, Math.min(Math.trunc(Number(params.maxImagesPerRequest) || 1), 20)),
        createdAt: now,
        updatedAt: now,
        updatedBy: params.actor
      };
      providers.push(result);
    }
    if (params.makeCurrent || !state.currentAiProviderId) {
      state.currentAiProviderId = result.id;
      for (const provider of providers) provider.preferred = provider.id === result.id;
    }
  });
  if (!result) throw new StoreError("ai_provider_save_failed", 500);
  return result;
}

export function setCurrentPlatformAiProvider(params: { providerId: string; actor?: string }): PlatformAiProvider {
  let result: PlatformAiProvider | undefined;
  mutatePlatformState((state) => {
    const providers = state.platformAiProviders ?? [];
    state.platformAiProviders = providers;
    const provider = providers.find((item) => item.id === params.providerId);
    if (!provider) throw new StoreError("ai_provider_not_found", 404);
    state.currentAiProviderId = provider.id;
    for (const item of providers) item.preferred = item.id === provider.id;
    provider.updatedAt = new Date().toISOString();
    provider.updatedBy = params.actor;
    result = provider;
  });
  if (!result) throw new StoreError("ai_provider_not_found", 404);
  return result;
}
