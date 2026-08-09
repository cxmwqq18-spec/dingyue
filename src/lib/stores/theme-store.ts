import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import { getSectionSchema } from "@/lib/section-schema";
import { clearSiteMediaSummaryCache } from "@/lib/stores/site-store";
import {
  buildSaasThemeDraft,
  buildSaasThemePublication,
  fromSaasSettings,
  fromSaasTemplate,
  toSaasTemplate,
  type SaasThemeRecord,
  type SaasThemeSettingsRecord,
  type SaasThemeTemplates
} from "@/lib/theme/saas-theme-model";
import {
  getImportedSaasSectionSchemasForTheme,
  getSaasThemePackage,
  normalizeSaasSettingsCurrentForTheme,
  resetSaasSettingsCurrentForTheme
} from "@/lib/theme/saas-theme-package";
import {
  getThemePackages,
  themePackageTemplateToPageJson,
  type ThemePackageSiteSettings,
  type ThemePackageTemplateKey
} from "@/lib/theme/packages";
import { normalizeGlobalSection } from "@/lib/theme/section-normalize";
import type {
  MediaAsset,
  SectionBlockInstance,
  SectionInstance,
  Site,
  SiteTheme,
  ThemeBlockSchema,
  ThemeCopy,
  ThemeDraftMeta,
  ThemePage,
  ThemePublication,
  ThemeSectionSchema,
  ThemeSettings,
  ThemeSettingValue
} from "@/lib/types";

import {
  addAuditLogRelational,
  assertThemeDraftVersion,
  cloneJson,
  draftJsonWithMeta,
  makeThemeDraftMeta,
  RelationalStoreError,
  themeSettingsDraftJsonWithMeta,
  toMediaAsset,
  toSite,
  toSiteTheme,
  toThemeCopy,
  toThemePage,
  toThemeSettings,
  toThemePublication,
  uid,
  type PrismaLike
} from "./prisma-mappers";

type ThemeState = {
  site: Site;
  mediaAssets: MediaAsset[];
  publications: ThemePublication[];
  siteThemes: SiteTheme[];
  themeCopies: ThemeCopy[];
};

const themeReadCache = createServerTtlCache("theme-store", Number(process.env.SITE_THEME_CACHE_TTL_MS ?? 10_000));

function clearSiteThemeReadCache(siteId: string) {
  themeReadCache.clear(`theme-state:${siteId}`);
  themeReadCache.clear(`theme-record-summary:${siteId}`);
  themeReadCache.clear(`publication-meta:${siteId}`);
  themeReadCache.clear(`publication-count:${siteId}`);
  themeReadCache.clear(`theme-labels:${siteId}`);
}

export type SaasThemeAction =
  | ({ type: "change"; scope: "page_section"; pageId: string; sectionId: string; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; scope: "page_block"; pageId: string; sectionId: string; blockId: string; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; scope: "global"; globalType: "header" | "footer"; name: string; value: ThemeSettingValue } & { themeKey?: string })
  | ({ type: "change"; scope: "global_setting"; name: string; value: ThemeSettingValue } & { themeKey?: string })
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

async function getSiteWithThemeRecords(db: PrismaLike, siteId: string) {
  const site = await db.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      connect: true
    }
  });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  return site;
}

function buildPublicationSnapshot(site: Site, siteTheme?: SiteTheme): ThemePublication["snapshot"] {
  return {
    pages: site.pages.map((page) => ({
      id: page.id,
      slug: page.slug,
      publishedJson: cloneJson(page.publishedJson)
    })),
    themeSettings: cloneJson(site.themeSettings.publishedJson),
    saasTheme: siteTheme
      ? {
          name: siteTheme.name,
          themeId: siteTheme.themeId,
          themeKey: siteTheme.themeKey,
          status: siteTheme.status,
          templates: cloneJson(siteTheme.templates),
          settings: cloneJson(siteTheme.settings),
          updatedAt: siteTheme.updatedAt
        }
      : undefined
  };
}

function buildPublicationSnapshotStats(snapshot: ThemePublication["snapshot"]) {
  const pageCount = snapshot.pages.length;
  const sectionCount = snapshot.pages.reduce((sum, page) => sum + (page.publishedJson.sectionsOrder?.length ?? 0), 0);
  const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");
  return { pageCount, sectionCount, snapshotBytes };
}

function activeThemeFromDraft(siteId: string, draftTheme: SiteTheme | undefined, actor: string): SiteTheme {
  const now = new Date().toISOString();
  return {
    id: `theme_${siteId}_active`,
    siteId,
    name: draftTheme?.name ?? "Active theme",
    themeId: draftTheme?.themeId ?? `${siteId}_active`,
    themeKey: draftTheme?.themeKey ?? "theme1",
    status: "active",
    templates: cloneJson(draftTheme?.templates ?? {}),
    settings: cloneJson(draftTheme?.settings ?? {}),
    source: draftTheme?.source ?? "site",
    createdBy: draftTheme?.createdBy ?? actor,
    createdAt: draftTheme?.createdAt ?? now,
    updatedAt: now
  };
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

function pageTypeToSaasTemplateName(pageType: string): string {
  const mapped: Record<string, string> = {
    home: "index",
    pricing: "page",
    tool: "product",
    account: "account",
    legal: "privacy",
    blog: "blog",
    search: "search"
  };
  return mapped[pageType] ?? pageType;
}

function pageSaasTemplateKey(page: Pick<ThemePage, "pageType" | "templateKey">): string {
  return page.templateKey?.trim() || pageTypeToSaasTemplateName(page.pageType);
}

function mapInternalTemplateKey(templateKey: string): ThemePackageTemplateKey {
  const mapped: Record<string, ThemePackageTemplateKey> = {
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
    account: "app-home"
  };
  return mapped[templateKey] ?? "home";
}

function applyInternalThemePackageSiteSettings(base: ThemeSettings, siteSettings?: ThemePackageSiteSettings): ThemeSettings {
  const next = cloneJson(base);
  const themeSettings = siteSettings?.themeSettings;
  if (!themeSettings) return next;
  if (themeSettings.colors) next.colors = { ...next.colors, ...themeSettings.colors };
  if (themeSettings.typography) next.typography = { ...next.typography, ...themeSettings.typography };
  if (themeSettings.radii) next.radii = { ...next.radii, ...themeSettings.radii };
  if (themeSettings.navigation) next.navigation = { ...next.navigation, ...themeSettings.navigation };
  if (themeSettings.seo) {
    next.seo = {
      siteTitle: themeSettings.seo.siteTitle ?? next.seo?.siteTitle ?? "",
      siteDescription: themeSettings.seo.siteDescription ?? next.seo?.siteDescription ?? "",
      titleTemplate: themeSettings.seo.titleTemplate ?? next.seo?.titleTemplate ?? "%s",
      defaultOgImage: themeSettings.seo.defaultOgImage ?? next.seo?.defaultOgImage,
      robots: next.seo?.robots ?? { index: true, follow: true },
      pages: next.seo?.pages ?? {}
    };
  }
  return next;
}

function themeScopedSectionSchema(sectionType: string, themeKey?: string): ThemeSectionSchema {
  const scoped = getImportedSaasSectionSchemasForTheme(themeKey ?? "theme1")[sectionType];
  return scoped ?? getSectionSchema(sectionType);
}

function defaultBlock(blockSchema: ThemeBlockSchema, index = 1): SectionBlockInstance {
  return {
    id: `${blockSchema.type}_${Date.now().toString(36)}_${index}`,
    type: blockSchema.type,
    settings: cloneJson(blockSchema.preset?.settings ?? Object.fromEntries(blockSchema.settings.map((field) => [field.id, field.default ?? ""])))
  };
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
  if (!blockSchema) throw new RelationalStoreError("theme_block_schema_not_found", 404);
  return defaultBlock(blockSchema, section.blocks?.length ?? 0);
}

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

function normalizeThemeScopedSettings(site: Site, themeKey: string, shouldResetDefaults = false) {
  site.themeSettings.draftJson.saasSettingsCurrent = shouldResetDefaults
    ? resetSaasSettingsCurrentForTheme(themeKey, site.themeSettings.draftJson.saasSettingsCurrent)
    : normalizeSaasSettingsCurrentForTheme(themeKey, site.themeSettings.draftJson.saasSettingsCurrent);
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

function themeKeyFromAction(action: SaasThemeAction): string {
  return action.themeKey?.trim() || "theme1";
}

function themeKeyFromXfcartPayload(payload: XfcartThemeEditPayload, editedTheme?: SiteTheme): string {
  return payload.themeKey?.trim() || payload.theme_key?.trim() || editedTheme?.themeKey || "theme1";
}

function pageFromXfcartIdentifier(site: Site, pageIdentifier?: string): ThemePage | undefined {
  const identifier = pageIdentifier || "index";
  const matched = site.pages.find(
    (item) => item.id === identifier || item.slug === identifier || item.pageType === identifier || pageSaasTemplateKey(item) === identifier
  );
  const templateName = matched ? pageSaasTemplateKey(matched) : identifier;
  return site.pages.find((page) => pageSaasTemplateKey(page) === templateName || page.pageType === pageIdentifier || page.id === pageIdentifier || page.slug === pageIdentifier);
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
  if (byIndex.length) return byIndex.map((item) => blocks[item]).filter((block): block is SectionBlockInstance => Boolean(block));
  const byId = new Map(blocks.map((block) => [block.id, block]));
  return sort.map((id) => byId.get(id)).filter((block): block is SectionBlockInstance => Boolean(block));
}

async function persistDraftThemeState(
  tx: PrismaLike,
  site: Site,
  themeKey: string,
  actor: string,
  existingDraft?: SiteTheme
): Promise<SiteTheme> {
  const record = buildSaasThemeDraft(site, themeKey);
  const existing =
    existingDraft ??
    (await tx.siteTheme.findFirst({ where: { siteId: site.id, status: "draft" }, orderBy: { updatedAt: "desc" } }).then((row) => (row ? toSiteTheme(row) : undefined)));
  const data = {
    name: existing?.name ?? record.name,
    themeKey,
    status: "draft",
    templates: cloneJson(record.templates) as unknown as Prisma.InputJsonValue,
    settings: cloneJson(record.settings) as unknown as Prisma.InputJsonValue,
    source: existing?.source ?? "site",
    createdBy: existing?.createdBy ?? actor
  };
  const row = existing
    ? await tx.siteTheme.update({ where: { id: existing.id }, data })
    : await tx.siteTheme.create({
        data: {
          id: uid("site_theme"),
          siteId: site.id,
          themeId: record.themeId,
          ...data
        }
      });
  return toSiteTheme(row);
}

async function persistSiteDraft(tx: PrismaLike, site: Site) {
  const nextSettings = {
    ...site.themeSettings,
    draftMeta: makeThemeDraftMeta(site.themeSettings)
  };
  await tx.themeSettings.upsert({
    where: { siteId: site.id },
    create: {
      id: `settings_${site.id}`,
      siteId: site.id,
      draftJson: themeSettingsDraftJsonWithMeta(nextSettings),
      publishedJson: cloneJson(site.themeSettings.publishedJson) as unknown as Prisma.InputJsonValue
    },
    update: { draftJson: themeSettingsDraftJsonWithMeta(nextSettings) }
  });
  for (const page of site.pages) {
    page.draftMeta = makeThemeDraftMeta(page);
    await tx.themePage.update({
      where: { id: page.id },
      data: { draftJson: draftJsonWithMeta(page) }
    });
  }
}

export async function getSiteThemeStateRelational(siteId: string): Promise<ThemeState> {
  return themeReadCache.get(`theme-state:${siteId}`, () => loadSiteThemeStateRelational(siteId));
}

async function loadSiteThemeStateRelational(siteId: string): Promise<ThemeState> {
  const [siteRecord, mediaAssets, publications, siteThemes, themeCopies] = await Promise.all([
    getSiteWithThemeRecords(prisma, siteId),
    prisma.mediaAsset.findMany({ where: { siteId }, orderBy: { createdAt: "desc" } }),
    prisma.themePublication.findMany({ where: { siteId }, orderBy: [{ version: "desc" }, { publishedAt: "desc" }] }),
    prisma.siteTheme.findMany({ where: { siteId }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] }),
    prisma.themeCopy.findMany({ where: { siteId }, orderBy: { updatedAt: "desc" } })
  ]);
  return {
    site: toSite(siteRecord),
    mediaAssets: mediaAssets.map(toMediaAsset),
    publications: publications.map(toThemePublication),
    siteThemes: siteThemes.map(toSiteTheme),
    themeCopies: themeCopies.map(toThemeCopy)
  };
}

function themeRecordFromSiteTheme(record: SiteTheme): SaasThemeRecord {
  return {
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status,
    templates: cloneJson(record.templates) as SaasThemeRecord["templates"],
    settings: cloneJson(record.settings) as SaasThemeRecord["settings"],
    updatedAt: record.updatedAt
  };
}

export type ThemeRecordStats = {
  templateCount: number;
  sectionCount: number;
  blockCount: number;
  templateNames: string[];
  settingsFieldCount: number;
  settingsGlobalSections: string[];
  hasSettingsData: boolean;
};

export type SaasThemeRecordSummary = Omit<SaasThemeRecord, "templates" | "settings"> & {
  templates?: undefined;
  settings?: undefined;
  stats: ThemeRecordStats;
};

export type SiteThemeSummaryRecord = Omit<SiteTheme, "templates" | "settings"> & {
  templates?: undefined;
  settings?: undefined;
  stats: ThemeRecordStats;
};

export type ThemeCopySummaryRecord = Omit<ThemeCopy, "templates" | "settings"> & {
  templates?: undefined;
  settings?: undefined;
  stats: ThemeRecordStats;
};

type SiteThemeSummaryRow = {
  id: string;
  siteId: string;
  name: string;
  themeId: string;
  themeKey: string;
  status: string;
  templates: unknown;
  settings: unknown;
  source: string;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ThemeStatsSummaryRow = {
  templateCount: bigint | number | string | null;
  sectionCount: bigint | number | string | null;
  blockCount: bigint | number | string | null;
  templateNames: unknown;
  settingsFieldCount: bigint | number | string | null;
  settingsGlobalSections: unknown;
  hasSettingsData: boolean | null;
};

type SiteThemeStatsSummaryRow = Omit<SiteThemeSummaryRow, "templates" | "settings"> & ThemeStatsSummaryRow;

type ThemeCopySummaryRow = {
  id: string;
  siteId: string;
  name: string;
  themeKey: string;
  source: string;
  templates: unknown;
  settings: unknown;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ThemeCopyStatsSummaryRow = Omit<ThemeCopySummaryRow, "templates" | "settings"> & ThemeStatsSummaryRow;

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function getTemplateStats(templates: unknown) {
  if (!templates || typeof templates !== "object" || Array.isArray(templates)) {
    return { templateCount: 0, sectionCount: 0, blockCount: 0, templateNames: [] as string[] };
  }
  const entries = Object.entries(templates as Record<string, { sections?: unknown }>);
  let sectionCount = 0;
  let blockCount = 0;
  for (const [, template] of entries) {
    const sections = template?.sections && typeof template.sections === "object" ? (template.sections as Record<string, unknown>) : {};
    sectionCount += Object.keys(sections).length;
    for (const section of Object.values(sections)) {
      const blocks = section && typeof section === "object" ? (section as { blocks?: unknown }).blocks : undefined;
      blockCount += Array.isArray(blocks) ? blocks.length : 0;
    }
  }
  return { templateCount: entries.length, sectionCount, blockCount, templateNames: entries.map(([name]) => name) };
}

function getSettingsStats(settings: unknown) {
  const current =
    settings && typeof settings === "object" && "settings_data" in settings
      ? (settings as { settings_data?: { current?: Record<string, unknown> } }).settings_data?.current
      : undefined;
  const sections = current?.sections && typeof current.sections === "object" ? (current.sections as Record<string, unknown>) : {};
  const settingsFieldCount = current ? Object.keys(current).filter((key) => key !== "sections").length : 0;
  return {
    settingsFieldCount,
    settingsGlobalSections: Object.keys(sections),
    hasSettingsData: Boolean(current)
  };
}

function getThemeRecordStats(templates: unknown, settings: unknown): ThemeRecordStats {
  return {
    ...getTemplateStats(templates),
    ...getSettingsStats(settings)
  };
}

function numberFromDb(value: bigint | number | string | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

function stringArrayFromDb(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getThemeRecordStatsFromSummaryRow(record: ThemeStatsSummaryRow): ThemeRecordStats {
  return {
    templateCount: numberFromDb(record.templateCount),
    sectionCount: numberFromDb(record.sectionCount),
    blockCount: numberFromDb(record.blockCount),
    templateNames: stringArrayFromDb(record.templateNames),
    settingsFieldCount: numberFromDb(record.settingsFieldCount),
    settingsGlobalSections: stringArrayFromDb(record.settingsGlobalSections),
    hasSettingsData: Boolean(record.hasSettingsData)
  };
}

function _toSiteThemeSummary(record: SiteThemeSummaryRow): SiteThemeSummaryRecord {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status as SiteTheme["status"],
    source: record.source as SiteTheme["source"],
    createdBy: record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStats(record.templates, record.settings)
  };
}

function toSiteThemeStatsSummary(record: SiteThemeStatsSummaryRow): SiteThemeSummaryRecord {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status as SiteTheme["status"],
    source: record.source as SiteTheme["source"],
    createdBy: record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStatsFromSummaryRow(record)
  };
}

function _toThemeCopySummary(record: ThemeCopySummaryRow): ThemeCopySummaryRecord {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    themeKey: record.themeKey,
    source: record.source as ThemeCopy["source"],
    createdBy: record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStats(record.templates, record.settings)
  };
}

function toThemeCopyStatsSummary(record: ThemeCopyStatsSummaryRow): ThemeCopySummaryRecord {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    themeKey: record.themeKey,
    source: record.source as ThemeCopy["source"],
    createdBy: record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStatsFromSummaryRow(record)
  };
}

function _saasRecordSummaryFromSiteTheme(record: SiteThemeSummaryRow): SaasThemeRecordSummary {
  return {
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status as SaasThemeRecord["status"],
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStats(record.templates, record.settings)
  };
}

function saasRecordSummaryFromSiteThemeStats(record: SiteThemeStatsSummaryRow): SaasThemeRecordSummary {
  return {
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status as SaasThemeRecord["status"],
    updatedAt: toIso(record.updatedAt),
    stats: getThemeRecordStatsFromSummaryRow(record)
  };
}

function saasRecordSummaryFromFull(record: SaasThemeRecord): SaasThemeRecordSummary {
  return {
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status,
    updatedAt: record.updatedAt,
    stats: getThemeRecordStats(record.templates, record.settings)
  };
}

export async function getSiteSaasThemeRecordsRelational(siteId: string) {
  const state = await getSiteThemeStateRelational(siteId);
  const latestPublication = state.publications[0];
  const draft = state.siteThemes.find((theme) => theme.status === "draft");
  const active = state.siteThemes.find((theme) => theme.status === "active");
  const activeTheme =
    (active ? themeRecordFromSiteTheme(active) : undefined) ??
    (latestPublication?.snapshot.saasTheme as SaasThemeRecord | undefined) ??
    buildSaasThemePublication(state.site, latestPublication?.version ?? state.site.pages[0]?.publishedJson.version ?? 1).theme;
  const activeUpdatedAt = active?.updatedAt ?? latestPublication?.publishedAt ?? activeTheme.updatedAt;
  return {
    site: state.site,
    draft: draft ? themeRecordFromSiteTheme(draft) : buildSaasThemeDraft(state.site),
    active: {
      ...activeTheme,
      status: "active" as const,
      themeId: activeTheme.themeId || `${state.site.id}_active_v${latestPublication?.version ?? 1}`,
      updatedAt: activeUpdatedAt
    },
    themes: state.siteThemes,
    publications: state.publications,
    copies: state.themeCopies
  };
}

export async function getSiteSaasThemeRecordsSummaryRelational(siteId: string) {
  return themeReadCache.get(`theme-record-summary:${siteId}`, async () => {
    const [siteThemes, themeCopies, publications] = await Promise.all([
      prisma.$queryRaw<SiteThemeStatsSummaryRow[]>`
        SELECT
          "id",
          "siteId",
          "name",
          "themeId",
          "themeKey",
          "status",
          "source",
          "createdBy",
          "createdAt",
          "updatedAt",
          COALESCE((SELECT COUNT(*) FROM jsonb_each("templates"::jsonb)), 0) AS "templateCount",
          COALESCE((
            SELECT SUM((SELECT COUNT(*) FROM jsonb_each(COALESCE(template -> 'sections', '{}'::jsonb))))
            FROM jsonb_each("templates"::jsonb) AS templates(name, template)
          ), 0) AS "sectionCount",
          COALESCE((
            SELECT SUM(jsonb_array_length(COALESCE(section -> 'blocks', '[]'::jsonb)))
            FROM jsonb_each("templates"::jsonb) AS templates(name, template)
            CROSS JOIN jsonb_each(COALESCE(template -> 'sections', '{}'::jsonb)) AS sections(name, section)
          ), 0) AS "blockCount",
          COALESCE((
            SELECT jsonb_agg(name ORDER BY name)
            FROM jsonb_object_keys("templates"::jsonb) AS name
          ), '[]'::jsonb) AS "templateNames",
          CASE
            WHEN "settings"::jsonb ? 'settings_data'
              AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current') = 'object'
            THEN GREATEST(
              (SELECT COUNT(*) FROM jsonb_object_keys("settings"::jsonb -> 'settings_data' -> 'current')) -
                CASE WHEN "settings"::jsonb -> 'settings_data' -> 'current' ? 'sections' THEN 1 ELSE 0 END,
              0
            )
            ELSE 0
          END AS "settingsFieldCount",
          CASE
            WHEN "settings"::jsonb ? 'settings_data'
              AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current' -> 'sections') = 'object'
            THEN (
              SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb)
              FROM jsonb_object_keys("settings"::jsonb -> 'settings_data' -> 'current' -> 'sections') AS name
            )
            ELSE '[]'::jsonb
          END AS "settingsGlobalSections",
          ("settings"::jsonb ? 'settings_data'
            AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current') = 'object') AS "hasSettingsData"
        FROM "SiteTheme"
        WHERE "siteId" = ${siteId}
        ORDER BY "status" ASC, "updatedAt" DESC
      `,
      prisma.$queryRaw<ThemeCopyStatsSummaryRow[]>`
        SELECT
          "id",
          "siteId",
          "name",
          "themeKey",
          "source",
          "createdBy",
          "createdAt",
          "updatedAt",
          COALESCE((SELECT COUNT(*) FROM jsonb_each("templates"::jsonb)), 0) AS "templateCount",
          COALESCE((
            SELECT SUM((SELECT COUNT(*) FROM jsonb_each(COALESCE(template -> 'sections', '{}'::jsonb))))
            FROM jsonb_each("templates"::jsonb) AS templates(name, template)
          ), 0) AS "sectionCount",
          COALESCE((
            SELECT SUM(jsonb_array_length(COALESCE(section -> 'blocks', '[]'::jsonb)))
            FROM jsonb_each("templates"::jsonb) AS templates(name, template)
            CROSS JOIN jsonb_each(COALESCE(template -> 'sections', '{}'::jsonb)) AS sections(name, section)
          ), 0) AS "blockCount",
          COALESCE((
            SELECT jsonb_agg(name ORDER BY name)
            FROM jsonb_object_keys("templates"::jsonb) AS name
          ), '[]'::jsonb) AS "templateNames",
          CASE
            WHEN "settings"::jsonb ? 'settings_data'
              AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current') = 'object'
            THEN GREATEST(
              (SELECT COUNT(*) FROM jsonb_object_keys("settings"::jsonb -> 'settings_data' -> 'current')) -
                CASE WHEN "settings"::jsonb -> 'settings_data' -> 'current' ? 'sections' THEN 1 ELSE 0 END,
              0
            )
            ELSE 0
          END AS "settingsFieldCount",
          CASE
            WHEN "settings"::jsonb ? 'settings_data'
              AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current' -> 'sections') = 'object'
            THEN (
              SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb)
              FROM jsonb_object_keys("settings"::jsonb -> 'settings_data' -> 'current' -> 'sections') AS name
            )
            ELSE '[]'::jsonb
          END AS "settingsGlobalSections",
          ("settings"::jsonb ? 'settings_data'
            AND jsonb_typeof("settings"::jsonb -> 'settings_data' -> 'current') = 'object') AS "hasSettingsData"
        FROM "ThemeCopy"
        WHERE "siteId" = ${siteId}
        ORDER BY "updatedAt" DESC
      `,
      getSiteThemePublicationMetaRelational(siteId)
    ]);

    let fallbackSite: Site | undefined;
    async function getFallbackSite() {
      if (!fallbackSite) fallbackSite = toSite(await getSiteWithThemeRecords(prisma, siteId));
      return fallbackSite;
    }

    const latestPublication = publications[0];
    const draftRow = siteThemes.find((theme) => theme.status === "draft");
    const activeRow = siteThemes.find((theme) => theme.status === "active");
    const draft = draftRow
      ? saasRecordSummaryFromSiteThemeStats(draftRow)
      : saasRecordSummaryFromFull(buildSaasThemeDraft(await getFallbackSite()));
    const active = activeRow
      ? { ...saasRecordSummaryFromSiteThemeStats(activeRow), status: "active" as const }
      : {
          ...saasRecordSummaryFromFull(buildSaasThemePublication(await getFallbackSite(), latestPublication?.version ?? 1).theme),
          status: "active" as const,
          updatedAt: latestPublication?.publishedAt ?? new Date().toISOString()
        };

    return {
      site: fallbackSite,
      draft,
      active,
      themes: siteThemes.map(toSiteThemeStatsSummary),
      copies: themeCopies.map(toThemeCopyStatsSummary),
      publications
    };
  });
}

export async function getSiteSaasThemeLabelsRelational(siteId: string) {
  return themeReadCache.get(`theme-labels:${siteId}`, async () => {
    const rows = await prisma.siteTheme.findMany({
      where: { siteId, status: { in: ["active", "draft"] } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: {
        name: true,
        themeKey: true,
        status: true,
        updatedAt: true
      }
    });
    const active = rows.find((row) => row.status === "active");
    const draft = rows.find((row) => row.status === "draft");
    return {
      active: active
        ? { name: active.name, themeKey: active.themeKey, updatedAt: active.updatedAt.toISOString() }
        : undefined,
      draft: draft
        ? { name: draft.name, themeKey: draft.themeKey, updatedAt: draft.updatedAt.toISOString() }
        : undefined
    };
  });
}

export async function getSiteThemePublicationCountRelational(siteId: string): Promise<number> {
  return themeReadCache.get(`publication-count:${siteId}`, () => prisma.themePublication.count({ where: { siteId } }));
}

export type SiteThemePublicationMeta = {
  id: string;
  version: number;
  publishedAt: string;
  publishedBy: string;
  pageCount: number;
  sectionCount: number;
  snapshotBytes: number;
};

export async function getSiteThemePublicationMetaRelational(siteId: string): Promise<SiteThemePublicationMeta[]> {
  return themeReadCache.get(`publication-meta:${siteId}`, async () => {
    type PublicationMetaRow = {
      id: string;
      version: number;
      publishedAt: Date | string;
      publishedBy: string;
      pageCount: bigint | number | string | null;
      sectionCount: bigint | number | string | null;
      snapshotBytes: bigint | number | string | null;
    };
    const rows = await prisma.$queryRaw<PublicationMetaRow[]>`
      SELECT
        "id",
        "version",
        "publishedAt",
        "publishedBy",
        COALESCE("pageCount", jsonb_array_length("snapshot"::jsonb -> 'pages'), 0) AS "pageCount",
        COALESCE("sectionCount", (
          SELECT SUM(jsonb_array_length(COALESCE(page -> 'publishedJson' -> 'sectionsOrder', '[]'::jsonb)))
          FROM jsonb_array_elements(COALESCE("snapshot"::jsonb -> 'pages', '[]'::jsonb)) AS page
        ), 0) AS "sectionCount",
        COALESCE("snapshotBytes", octet_length("snapshot"::text), 0) AS "snapshotBytes"
      FROM "ThemePublication"
      WHERE "siteId" = ${siteId}
      ORDER BY "version" DESC, "publishedAt" DESC
    `;
    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      publishedAt: row.publishedAt instanceof Date ? row.publishedAt.toISOString() : String(row.publishedAt),
      publishedBy: row.publishedBy,
      pageCount: typeof row.pageCount === "bigint" ? Number(row.pageCount) : Number(row.pageCount ?? 0),
      sectionCount: typeof row.sectionCount === "bigint" ? Number(row.sectionCount) : Number(row.sectionCount ?? 0),
      snapshotBytes: typeof row.snapshotBytes === "bigint" ? Number(row.snapshotBytes) : Number(row.snapshotBytes ?? 0)
    }));
  });
}

export async function saveThemePageDraftRelational(params: {
  siteId: string;
  pageId: string;
  draftJson: ThemePage["draftJson"];
  title?: string;
  actor?: string;
  expected?: { expectedRevision?: number; expectedEtag?: string };
}): Promise<{ page: ThemePage; draftVersion: ThemeDraftMeta }> {
  clearSiteThemeReadCache(params.siteId);
  const pageRecord = await prisma.themePage.findFirst({ where: { siteId: params.siteId, id: params.pageId } });
  if (!pageRecord) throw new RelationalStoreError("theme_page_not_found", 404);
  const page = toThemePage(pageRecord);
  assertThemeDraftVersion(page, params.expected);
  page.draftJson = cloneJson(params.draftJson);
  page.draftMeta = makeThemeDraftMeta(page);
  if (params.title !== undefined) page.title = params.title.trim() || page.title;
  const updated = await prisma.themePage.update({
    where: { id: page.id },
    data: {
      title: page.title,
      draftJson: draftJsonWithMeta(page)
    }
  });
  return { page: toThemePage(updated), draftVersion: page.draftMeta };
}

type ThemeDraftVersionExpectation = { expectedRevision?: number; expectedEtag?: string };

function hasDraftVersionExpectation(expected?: ThemeDraftVersionExpectation): boolean {
  return expected?.expectedRevision !== undefined || expected?.expectedEtag !== undefined;
}

export async function saveThemeSettingsDraftRelational(params: {
  siteId: string;
  draftJson: ThemeSettings;
  actor?: string;
  expected?: ThemeDraftVersionExpectation;
  requireExpected?: boolean;
}): Promise<{ site: Site; draftVersion: ThemeDraftMeta }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const current = await tx.themeSettings.findUnique({ where: { siteId: params.siteId } });
    const currentSettings = toThemeSettings(current);
    if (current && params.requireExpected && !hasDraftVersionExpectation(params.expected)) {
      throw new RelationalStoreError("theme_draft_version_required", 428);
    }
    if (current) assertThemeDraftVersion({ draftMeta: currentSettings.draftMeta }, params.expected);
    const nextSettings = {
      draftJson: cloneJson(params.draftJson),
      publishedJson: current ? currentSettings.publishedJson : cloneJson(params.draftJson),
      draftMeta: makeThemeDraftMeta(currentSettings)
    };
    await tx.themeSettings.upsert({
      where: { siteId: params.siteId },
      create: {
        id: `settings_${params.siteId}`,
        siteId: params.siteId,
        draftJson: themeSettingsDraftJsonWithMeta(nextSettings),
        publishedJson: cloneJson(nextSettings.publishedJson) as unknown as Prisma.InputJsonValue
      },
      update: {
        draftJson: themeSettingsDraftJsonWithMeta(nextSettings)
      }
    });
    return { site: toSite(await getSiteWithThemeRecords(tx, params.siteId)), draftVersion: nextSettings.draftMeta };
  }, { timeout: 60000 });
}

export type ThemeFooterSocialLinks = {
  socialHeading: string;
  socialBody: string;
  instagramUrl: string;
  facebookUrl: string;
  pinterestUrl: string;
  youtubeUrl: string;
  twitterUrl: string;
};

function applyFooterSocialLinks(settings: ThemeSettings, socialLinks: ThemeFooterSocialLinks): ThemeSettings {
  const next = cloneJson(settings);
  next.globalSections ??= {};
  next.globalSections.footer = normalizeGlobalSection("footer", next.globalSections.footer);
  next.globalSections.footer.settings = {
    ...next.globalSections.footer.settings,
    ...socialLinks
  };
  return next;
}

export async function updateThemeFooterSocialLinksRelational(params: {
  siteId: string;
  socialLinks: ThemeFooterSocialLinks;
  actor?: string;
}): Promise<{ site: Site }> {
  clearSiteThemeReadCache(params.siteId);
  const current = await prisma.themeSettings.findUnique({ where: { siteId: params.siteId } });
  if (!current) {
    throw new RelationalStoreError("theme_settings_not_found", 404);
  }
  const currentSettings = toThemeSettings(current);
  const draftJson = applyFooterSocialLinks(currentSettings.draftJson, params.socialLinks);
  const publishedJson = applyFooterSocialLinks(currentSettings.publishedJson, params.socialLinks);
  const nextSettings = {
    draftJson,
    publishedJson,
    draftMeta: makeThemeDraftMeta(currentSettings)
  };
  await prisma.themeSettings.update({
    where: { siteId: params.siteId },
    data: {
      draftJson: themeSettingsDraftJsonWithMeta(nextSettings),
      publishedJson: cloneJson(publishedJson) as unknown as Prisma.InputJsonValue
    }
  });
  return { site: toSite(await getSiteWithThemeRecords(prisma, params.siteId)) };
}

export async function rollbackThemePageDraftRelational(params: {
  siteId: string;
  pageId: string;
}): Promise<{ page: ThemePage; draftVersion: ThemeDraftMeta }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const pageRecord = await tx.themePage.findFirst({ where: { siteId: params.siteId, id: params.pageId } });
    if (!pageRecord) throw new RelationalStoreError("theme_page_not_found", 404);
    const page = toThemePage(pageRecord);
    page.draftJson = cloneJson(page.publishedJson);
    page.draftMeta = makeThemeDraftMeta(page);
    const updated = await tx.themePage.update({
      where: { id: page.id },
      data: { draftJson: draftJsonWithMeta(page) }
    });
    const settings = await tx.themeSettings.findUnique({ where: { siteId: params.siteId } });
    if (settings) {
      const currentSettings = toThemeSettings(settings);
      const nextSettings = {
        ...currentSettings,
        draftJson: cloneJson(currentSettings.publishedJson),
        draftMeta: makeThemeDraftMeta(currentSettings)
      };
      await tx.themeSettings.update({
        where: { siteId: params.siteId },
        data: { draftJson: themeSettingsDraftJsonWithMeta(nextSettings) }
      });
    }
    return { page: toThemePage(updated), draftVersion: page.draftMeta };
  });
}

export async function resetDraftThemeFromActiveRelational(
  siteId: string,
  actor = "site_admin_demo"
): Promise<{ site: Site; sourceVersion: number }> {
  clearSiteThemeReadCache(siteId);
  return prisma.$transaction(async (tx) => {
    const siteRecord = await getSiteWithThemeRecords(tx, siteId);
    const site = toSite(siteRecord);
    const latestPublicationRecord = await tx.themePublication.findFirst({
      where: { siteId },
      orderBy: [{ version: "desc" }, { publishedAt: "desc" }]
    });
    const latestPublication = latestPublicationRecord ? toThemePublication(latestPublicationRecord) : undefined;
    const sourceVersion = latestPublication?.version ?? site.pages[0]?.publishedJson.version ?? 1;
    const publishedByPage = new Map(latestPublication?.snapshot.pages.map((page) => [page.id, page.publishedJson]) ?? []);

    for (const page of site.pages) {
      const published = publishedByPage.get(page.id) ?? page.publishedJson;
      page.draftJson = cloneJson(published);
      page.draftMeta = makeThemeDraftMeta(page);
      await tx.themePage.update({
        where: { id: page.id },
        data: { draftJson: draftJsonWithMeta(page) }
      });
    }

    const settingsDraft = cloneJson(latestPublication?.snapshot.themeSettings ?? site.themeSettings.publishedJson);
    const nextSettings = {
      ...site.themeSettings,
      draftJson: settingsDraft,
      draftMeta: makeThemeDraftMeta(site.themeSettings)
    };
    await tx.themeSettings.upsert({
      where: { siteId },
      create: {
        id: `settings_${siteId}`,
        siteId,
        draftJson: themeSettingsDraftJsonWithMeta(nextSettings),
        publishedJson: cloneJson(settingsDraft) as unknown as Prisma.InputJsonValue
      },
      update: {
        draftJson: themeSettingsDraftJsonWithMeta(nextSettings)
      }
    });

    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_draft_reset_from_active",
      targetType: "theme",
      targetId: siteId,
      metadata: { version: sourceVersion }
    });

    return { site: toSite(await getSiteWithThemeRecords(tx, siteId)), sourceVersion };
  }, { timeout: 60000 });
}

export async function publishDraftPageRelational(
  siteId: string,
  pageId: string,
  actor = "site_admin_demo",
  expected?: ThemeDraftVersionExpectation & {
    pageVersions?: Record<string, ThemeDraftVersionExpectation | undefined>;
    settingsVersion?: ThemeDraftVersionExpectation;
    expectedPublishedVersion?: number;
    requireSnapshotVersions?: boolean;
  }
): Promise<{
  site: Site;
  draftVersion?: ThemeDraftMeta;
  pageDraftVersions: Record<string, ThemeDraftMeta>;
  settingsDraftVersion?: ThemeDraftMeta;
  publication: ThemePublication;
  publishedVersion: number;
}> {
  clearSiteThemeReadCache(siteId);
  return prisma.$transaction(async (tx) => {
    const siteRecord = await getSiteWithThemeRecords(tx, siteId);
    const site = toSite(siteRecord);
    const targetPage = site.pages.find((page) => page.id === pageId);
    if (!targetPage) throw new RelationalStoreError("theme_page_not_found", 404);
    const currentPublishedVersion = Math.max(0, ...site.pages.map((page) => page.publishedJson.version ?? 0));
    if (expected?.expectedPublishedVersion !== undefined && currentPublishedVersion !== expected.expectedPublishedVersion) {
      throw new RelationalStoreError("theme_publish_conflict", 409);
    }
    if (expected?.requireSnapshotVersions) {
      if (expected.expectedPublishedVersion === undefined) {
        throw new RelationalStoreError("theme_publish_review_scope_incomplete", 409);
      }
      if (!hasDraftVersionExpectation(expected.settingsVersion)) {
        throw new RelationalStoreError("theme_publish_review_scope_incomplete", 409);
      }
      for (const page of site.pages) {
        if (!hasDraftVersionExpectation(expected.pageVersions?.[page.id])) {
          throw new RelationalStoreError("theme_publish_review_scope_incomplete", 409);
        }
      }
    }
    const targetExpectation = expected?.pageVersions?.[pageId] ?? {
      expectedRevision: expected?.expectedRevision,
      expectedEtag: expected?.expectedEtag
    };
    assertThemeDraftVersion(targetPage, targetExpectation);
    for (const page of site.pages) {
      const pageExpectation = expected?.pageVersions?.[page.id];
      if (pageExpectation && page.id !== pageId) assertThemeDraftVersion(page, pageExpectation);
    }
    if (expected?.settingsVersion) {
      assertThemeDraftVersion({ draftMeta: site.themeSettings.draftMeta }, expected.settingsVersion);
    }

    const publishedVersion = currentPublishedVersion + 1;
    let draftVersion: ThemeDraftMeta | undefined;
    const pageDraftVersions: Record<string, ThemeDraftMeta> = {};

    await tx.themeSettings.upsert({
      where: { siteId },
      create: {
        id: `settings_${siteId}`,
        siteId,
        draftJson: themeSettingsDraftJsonWithMeta(site.themeSettings),
        publishedJson: cloneJson(site.themeSettings.draftJson) as unknown as Prisma.InputJsonValue
      },
      update: {
        publishedJson: cloneJson(site.themeSettings.draftJson) as unknown as Prisma.InputJsonValue
      }
    });
    site.themeSettings.publishedJson = cloneJson(site.themeSettings.draftJson);

    for (const page of site.pages) {
      page.publishedJson = cloneJson(page.draftJson);
      page.publishedJson.version = publishedVersion;
      page.draftJson.version = publishedVersion;
      page.draftMeta = makeThemeDraftMeta(page);
      if (page.id === pageId) draftVersion = page.draftMeta;
      pageDraftVersions[page.id] = page.draftMeta;
      await tx.themePage.update({
        where: { id: page.id },
        data: {
          draftJson: draftJsonWithMeta(page),
          publishedJson: cloneJson(page.publishedJson) as unknown as Prisma.InputJsonValue
        }
      });
    }

    const draftThemeRecord = await tx.siteTheme.findFirst({
      where: { siteId, status: "draft" },
      orderBy: { updatedAt: "desc" }
    });
    const draftTheme = draftThemeRecord ? toSiteTheme(draftThemeRecord) : undefined;
    const nextActive = activeThemeFromDraft(siteId, draftTheme, actor);
    await tx.siteTheme.updateMany({ where: { siteId, status: "active" }, data: { status: "draft" } });
    const activeThemeRecord = draftThemeRecord
      ? await tx.siteTheme.update({
          where: { id: draftThemeRecord.id },
          data: {
            name: nextActive.name,
            themeKey: nextActive.themeKey,
            status: "active",
            templates: cloneJson(nextActive.templates) as unknown as Prisma.InputJsonValue,
            settings: cloneJson(nextActive.settings) as unknown as Prisma.InputJsonValue,
            source: nextActive.source,
            createdBy: nextActive.createdBy
          }
        })
      : await tx.siteTheme.upsert({
          where: { siteId_themeId: { siteId, themeId: nextActive.themeId } },
          create: {
            id: nextActive.id,
            siteId,
            name: nextActive.name,
            themeId: nextActive.themeId,
            themeKey: nextActive.themeKey,
            status: "active",
            templates: cloneJson(nextActive.templates) as unknown as Prisma.InputJsonValue,
            settings: cloneJson(nextActive.settings) as unknown as Prisma.InputJsonValue,
            source: nextActive.source,
            createdBy: nextActive.createdBy
          },
          update: {
            name: nextActive.name,
            themeKey: nextActive.themeKey,
            status: "active",
            templates: cloneJson(nextActive.templates) as unknown as Prisma.InputJsonValue,
            settings: cloneJson(nextActive.settings) as unknown as Prisma.InputJsonValue,
            source: nextActive.source,
            createdBy: nextActive.createdBy
          }
        });
    const activeTheme = toSiteTheme(activeThemeRecord);

    const snapshot = buildPublicationSnapshot(site, activeTheme);
    const snapshotStats = buildPublicationSnapshotStats(snapshot);
    const publicationRecord = await tx.themePublication.create({
      data: {
        id: `pub_${siteId}_${Date.now().toString(36)}`,
        siteId,
        version: publishedVersion,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        pageCount: snapshotStats.pageCount,
        sectionCount: snapshotStats.sectionCount,
        snapshotBytes: snapshotStats.snapshotBytes,
        publishedBy: actor
      } as unknown as Prisma.ThemePublicationUncheckedCreateInput
    });
    const publication = toThemePublication(publicationRecord);
    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_published",
      targetType: "theme",
      targetId: siteId,
      metadata: { version: publishedVersion, pageId }
    });
    return { site, draftVersion, pageDraftVersions, settingsDraftVersion: site.themeSettings.draftMeta, publication, publishedVersion };
  }, { timeout: 120000 });
}

export async function restoreDraftThemeFromPublicationRelational(
  siteId: string,
  publicationId: string,
  actor = "site_admin_demo"
): Promise<{ site: Site; publication: ThemePublication }> {
  clearSiteThemeReadCache(siteId);
  return prisma.$transaction(async (tx) => {
    const publicationRecord = await tx.themePublication.findFirst({ where: { siteId, id: publicationId } });
    if (!publicationRecord) throw new RelationalStoreError("theme_publication_not_found", 404);
    const publication = toThemePublication(publicationRecord);
    const snapshotPages = new Map(publication.snapshot.pages.map((page) => [page.id, page.publishedJson]));

    const siteRecord = await getSiteWithThemeRecords(tx, siteId);
    const site = toSite(siteRecord);
    for (const page of site.pages) {
      const snapshotPage = snapshotPages.get(page.id);
      if (!snapshotPage) continue;
      page.draftJson = cloneJson(snapshotPage);
      page.draftMeta = makeThemeDraftMeta(page);
      await tx.themePage.update({
        where: { id: page.id },
        data: { draftJson: draftJsonWithMeta(page) }
      });
    }
    await tx.themeSettings.upsert({
      where: { siteId },
      create: {
        id: `settings_${siteId}`,
        siteId,
        draftJson: themeSettingsDraftJsonWithMeta({
          draftJson: cloneJson(publication.snapshot.themeSettings) as ThemeSettings,
          publishedJson: cloneJson(publication.snapshot.themeSettings) as ThemeSettings,
          draftMeta: makeThemeDraftMeta(site.themeSettings)
        }),
        publishedJson: cloneJson(publication.snapshot.themeSettings) as unknown as Prisma.InputJsonValue
      },
      update: {
        draftJson: themeSettingsDraftJsonWithMeta({
          draftJson: cloneJson(publication.snapshot.themeSettings) as ThemeSettings,
          publishedJson: cloneJson(publication.snapshot.themeSettings) as ThemeSettings,
          draftMeta: makeThemeDraftMeta(site.themeSettings)
        })
      }
    });
    site.themeSettings.draftJson = cloneJson(publication.snapshot.themeSettings);

    const draftTheme = await tx.siteTheme.findFirst({ where: { siteId, status: "draft" }, orderBy: { updatedAt: "desc" } });
    if (draftTheme && publication.snapshot.saasTheme && typeof publication.snapshot.saasTheme === "object") {
      const record = publication.snapshot.saasTheme as Partial<SiteTheme>;
      await tx.siteTheme.update({
        where: { id: draftTheme.id },
        data: {
          templates: cloneJson(record.templates ?? draftTheme.templates) as unknown as Prisma.InputJsonValue,
          settings: cloneJson(record.settings ?? draftTheme.settings) as unknown as Prisma.InputJsonValue,
          themeKey: record.themeKey ?? draftTheme.themeKey
        }
      });
    }

    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_draft_restored_from_publication",
      targetType: "theme_publication",
      targetId: publication.id,
      metadata: { version: publication.version }
    });

    return { site, publication };
  }, { timeout: 20000 });
}

export async function upsertThemeMediaAssetRelational(params: {
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
}): Promise<{ asset: MediaAsset; created: boolean }> {
  clearSiteThemeReadCache(params.siteId);
  clearSiteMediaSummaryCache(params.siteId);
  const site = await prisma.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  const label = params.label.trim();
  const storageKey = params.storageKey.trim();
  const mimeType = params.mimeType.trim();
  if (label.length < 2) throw new RelationalStoreError("media_label_required", 400);
  if (!storageKey.startsWith(`sites/${params.siteId}/`)) throw new RelationalStoreError("media_storage_key_must_be_site_scoped", 400);
  if (!mimeType.includes("/")) throw new RelationalStoreError("invalid_mime_type", 400);

  const existing = params.assetId
    ? await prisma.mediaAsset.findFirst({ where: { siteId: params.siteId, id: params.assetId } })
    : null;
  const assetData = {
    label,
    storageKey,
    mimeType,
    usageType: params.usage,
    sourceType: params.sourceType ?? "manual",
    previewUrl: params.previewUrl?.trim() || null,
    originUrl: params.originUrl?.trim() || null,
    altText: params.altText?.trim() || null,
    notes: params.notes?.trim() || null
  };
  const record = existing
    ? await prisma.mediaAsset.update({
        where: { id: existing.id },
        data: assetData
      })
    : await prisma.mediaAsset.create({
        data: {
          id: params.assetId ?? uid("media"),
          siteId: params.siteId,
          ...assetData
        }
      });
  return { asset: toMediaAsset(record), created: !existing };
}

export async function deleteThemeMediaAssetRelational(params: {
  siteId: string;
  assetId: string;
}): Promise<{ asset: MediaAsset }> {
  clearSiteThemeReadCache(params.siteId);
  clearSiteMediaSummaryCache(params.siteId);
  const existing = await prisma.mediaAsset.findFirst({ where: { siteId: params.siteId, id: params.assetId } });
  if (!existing) throw new RelationalStoreError("theme_media_not_found", 404);
  await prisma.mediaAsset.delete({ where: { id: existing.id } });
  return { asset: toMediaAsset(existing) };
}

export async function applySiteThemeToDraftRelational(params: {
  siteId: string;
  themeId: string;
  actor?: string;
}): Promise<{ theme: SiteTheme; site: Site }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const theme = await tx.siteTheme.findFirst({ where: { siteId: params.siteId, id: params.themeId } });
    if (!theme) throw new RelationalStoreError("theme_not_found", 404);
    await tx.siteTheme.update({ where: { id: theme.id }, data: { status: "draft" } });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "theme_applied_to_draft",
      targetType: "site_theme",
      targetId: theme.id,
      metadata: { themeKey: theme.themeKey }
    });
    return {
      theme: toSiteTheme({ ...theme, status: "draft", updatedAt: new Date() }),
      site: toSite(await getSiteWithThemeRecords(tx, params.siteId))
    };
  });
}

export async function activateSiteThemeRelational(params: {
  siteId: string;
  themeId: string;
  actor?: string;
}): Promise<{ theme: SiteTheme; publication: ThemePublication }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const siteRecord = await getSiteWithThemeRecords(tx, params.siteId);
    const site = toSite(siteRecord);
    const theme = await tx.siteTheme.findFirst({ where: { siteId: params.siteId, id: params.themeId } });
    if (!theme) throw new RelationalStoreError("theme_not_found", 404);
    const currentMax = await tx.themePublication.aggregate({
      where: { siteId: params.siteId },
      _max: { version: true }
    });
    const version = (currentMax._max.version ?? 0) + 1;
    await tx.siteTheme.updateMany({ where: { siteId: params.siteId, status: "active" }, data: { status: "draft" } });
    const activeThemeRecord = await tx.siteTheme.update({ where: { id: theme.id }, data: { status: "active" } });
    for (const page of site.pages) {
      const publishedJson = cloneJson(page.draftJson);
      publishedJson.version = version;
      await tx.themePage.update({
        where: { id: page.id },
        data: { publishedJson: publishedJson as unknown as Prisma.InputJsonValue }
      });
      page.publishedJson = publishedJson;
    }
    await tx.themeSettings.upsert({
      where: { siteId: params.siteId },
      create: {
        id: `settings_${params.siteId}`,
        siteId: params.siteId,
        draftJson: themeSettingsDraftJsonWithMeta(site.themeSettings),
        publishedJson: cloneJson(site.themeSettings.draftJson) as unknown as Prisma.InputJsonValue
      },
      update: { publishedJson: cloneJson(site.themeSettings.draftJson) as unknown as Prisma.InputJsonValue }
    });
    site.themeSettings.publishedJson = cloneJson(site.themeSettings.draftJson);
    const activeTheme = toSiteTheme(activeThemeRecord);
    const snapshot = buildPublicationSnapshot(site, activeTheme);
    const snapshotStats = buildPublicationSnapshotStats(snapshot);
    const publicationRecord = await tx.themePublication.create({
      data: {
        id: `pub_${params.siteId}_${Date.now().toString(36)}`,
        siteId: params.siteId,
        version,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        pageCount: snapshotStats.pageCount,
        sectionCount: snapshotStats.sectionCount,
        snapshotBytes: snapshotStats.snapshotBytes,
        publishedBy: params.actor ?? "site_admin_demo"
      } as unknown as Prisma.ThemePublicationUncheckedCreateInput
    });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "theme_activated",
      targetType: "site_theme",
      targetId: activeTheme.id,
      metadata: { version, themeKey: activeTheme.themeKey }
    });
    return { theme: activeTheme, publication: toThemePublication(publicationRecord) };
  }, { timeout: 20000 });
}

export async function deleteSiteThemeRelational(params: {
  siteId: string;
  themeId: string;
  actor?: string;
}): Promise<{ deletedThemeId: string }> {
  clearSiteThemeReadCache(params.siteId);
  const theme = await prisma.siteTheme.findFirst({ where: { siteId: params.siteId, id: params.themeId } });
  if (!theme) throw new RelationalStoreError("theme_not_found", 404);
  if (theme.status === "active") throw new RelationalStoreError("cannot_delete_active_theme", 409);
  await prisma.$transaction(async (tx) => {
    await tx.siteTheme.delete({ where: { id: theme.id } });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "theme_deleted",
      targetType: "site_theme",
      targetId: theme.id,
      metadata: { themeKey: theme.themeKey }
    });
  });
  return { deletedThemeId: theme.id };
}

export async function duplicateSiteThemeRelational(params: {
  siteId: string;
  name?: string;
  source?: "draft" | "active";
  sourceThemeId?: string;
  actor?: string;
}): Promise<{ themeCopy: ThemeCopy; siteTheme: SiteTheme }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const site = await tx.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
    if (!site) throw new RelationalStoreError("site_not_found", 404);
    const source = params.source ?? "draft";
    const sourceTheme = params.sourceThemeId
      ? await tx.siteTheme.findFirst({ where: { siteId: params.siteId, id: params.sourceThemeId } })
      : await tx.siteTheme.findFirst({
          where: { siteId: params.siteId, status: source === "active" ? "active" : "draft" },
          orderBy: { updatedAt: "desc" }
        });
    if (!sourceTheme) throw new RelationalStoreError("theme_not_found", 404);
    const now = new Date();
    const createdBy = params.actor ?? "site_admin_demo";
    const themeCopyRecord = await tx.themeCopy.create({
      data: {
        id: uid("theme_copy"),
        siteId: params.siteId,
        name: params.name?.trim() || `${sourceTheme.name} copy`,
        themeKey: sourceTheme.themeKey,
        source,
        templates: cloneJson(sourceTheme.templates) as unknown as Prisma.InputJsonValue,
        settings: cloneJson(sourceTheme.settings) as unknown as Prisma.InputJsonValue,
        createdBy
      }
    });
    const siteThemeRecord = await tx.siteTheme.create({
      data: {
        id: uid("site_theme"),
        siteId: params.siteId,
        name: themeCopyRecord.name,
        themeId: `theme_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        themeKey: sourceTheme.themeKey,
        status: "draft",
        templates: cloneJson(sourceTheme.templates) as unknown as Prisma.InputJsonValue,
        settings: cloneJson(sourceTheme.settings) as unknown as Prisma.InputJsonValue,
        source: "copy",
        createdBy,
        createdAt: now
      }
    });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: createdBy,
      action: "theme_duplicated",
      targetType: "site_theme",
      targetId: siteThemeRecord.id,
      metadata: { source, themeCopyId: themeCopyRecord.id }
    });
    return {
      themeCopy: toThemeCopy(themeCopyRecord),
      siteTheme: toSiteTheme(siteThemeRecord)
    };
  });
}

export async function exportSiteThemePackageRelational(siteId: string, source: "draft" | "active" = "draft") {
  const records = await getSiteSaasThemeRecordsRelational(siteId);
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

export async function installSaasThemeForSiteRelational(params: {
  siteId: string;
  name?: string;
  actor?: string;
  themeKey?: string;
}): Promise<{ theme: SiteTheme }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const site = toSite(await getSiteWithThemeRecords(tx, params.siteId));
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
    const settings = { settings_data: cloneJson(sourcePackage.settingsData) } as SaasThemeSettingsRecord;
    const actor = params.actor ?? "site_admin_demo";
    const record: SaasThemeRecord = {
      name: params.name?.trim() || `${site.name} imported SaaS ${sourcePackage.themeKey}`,
      themeId: `theme_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      themeKey: sourcePackage.themeKey,
      status: "draft",
      templates,
      settings,
      updatedAt: now
    };
    const themeRecord = await tx.siteTheme.create({
      data: {
        id: uid("site_theme"),
        siteId: site.id,
        name: record.name,
        themeId: record.themeId,
        themeKey: record.themeKey,
        status: "draft",
        templates: cloneJson(record.templates) as unknown as Prisma.InputJsonValue,
        settings: cloneJson(record.settings) as unknown as Prisma.InputJsonValue,
        source: sourcePackage.themeKey === "theme1" ? "saas-theme1" : "saas-theme",
        createdBy: actor,
        createdAt: new Date(now)
      }
    });
    await addAuditLogRelational(tx, {
      siteId: site.id,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_installed",
      targetType: "site_theme",
      targetId: themeRecord.id,
      metadata: { themeKey: themeRecord.themeKey }
    });
    return { theme: toSiteTheme(themeRecord) };
  });
}

export async function installInternalThemePackageForSiteRelational(params: {
  siteId: string;
  packageKey: string;
  name?: string;
  actor?: string;
}): Promise<{ theme: SiteTheme }> {
  clearSiteThemeReadCache(params.siteId);
  return prisma.$transaction(async (tx) => {
    const site = toSite(await getSiteWithThemeRecords(tx, params.siteId));
    const themePackage = getThemePackages().find((item) => item.key === params.packageKey);
    if (!themePackage) throw new RelationalStoreError("internal_theme_package_not_found", 404);
    const templates = Object.fromEntries(
      site.pages.map((page) => {
        const templateName = mapInternalTemplateKey(pageSaasTemplateKey(page));
        const template = themePackageTemplateToPageJson(themePackage.key, templateName, page.pageType, page.draftJson.version);
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
    const actor = params.actor ?? "site_admin_demo";
    const record: SaasThemeRecord = {
      name: params.name?.trim() || `${site.name} ${themePackage.name}`,
      themeId: `theme_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      themeKey: themePackage.key,
      status: "draft",
      templates,
      settings: cloneJson(baseDraft.settings),
      updatedAt: new Date().toISOString()
    };
    const themeRecord = await tx.siteTheme.create({
      data: {
        id: uid("site_theme"),
        siteId: site.id,
        name: record.name,
        themeId: record.themeId,
        themeKey: record.themeKey,
        status: "draft",
        templates: cloneJson(record.templates) as unknown as Prisma.InputJsonValue,
        settings: cloneJson(record.settings) as unknown as Prisma.InputJsonValue,
        source: "imported",
        createdBy: actor
      }
    });
    await addAuditLogRelational(tx, {
      siteId: site.id,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_installed",
      targetType: "site_theme",
      targetId: themeRecord.id,
      metadata: { themeKey: themeRecord.themeKey, packageKey: themePackage.key }
    });
    return { theme: toSiteTheme(themeRecord) };
  });
}

export async function applySaasThemeActionRelational(
  siteId: string,
  action: SaasThemeAction,
  actor = "site_admin_demo"
): Promise<{ site: Site; sectionId?: string; responseType: "reload" | "th1" | "add" | "del" }> {
  clearSiteThemeReadCache(siteId);
  return prisma.$transaction(async (tx) => {
    const site = toSite(await getSiteWithThemeRecords(tx, siteId));
    const draftThemeRow = await tx.siteTheme.findFirst({ where: { siteId, status: "draft" }, orderBy: { updatedAt: "desc" } });
    const draftTheme = draftThemeRow ? toSiteTheme(draftThemeRow) : undefined;
    let sectionId: string | undefined = "sectionId" in action ? action.sectionId : undefined;
    let responseType: "reload" | "th1" | "add" | "del" = "reload";
    const themeKey = themeKeyFromAction(action);
    normalizeThemeScopedSettings(site, themeKey, draftTheme?.themeKey !== themeKey);
    const page = "pageId" in action ? site.pages.find((item) => item.id === action.pageId) : undefined;
    if ("pageId" in action && !page) throw new RelationalStoreError("theme_page_not_found", 404);

    if (action.type === "change") {
      if (action.scope === "page_section") {
        const section = page?.draftJson.sections[action.sectionId];
        if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
        section.settings[action.name] = action.value;
        responseType = "th1";
      } else if (action.scope === "page_block") {
        const block = page?.draftJson.sections[action.sectionId]?.blocks?.find((item) => item.id === action.blockId);
        if (!block) throw new RelationalStoreError("theme_block_not_found", 404);
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
        if (!block) throw new RelationalStoreError("theme_block_not_found", 404);
        block.settings[action.name] = action.value;
        sectionId = action.globalType === "header" ? "header_plus" : "footer_plus";
        responseType = "th1";
      }
    }

    if (action.type === "dropition") {
      if (!page) throw new RelationalStoreError("theme_page_not_found", 404);
      const validIds = new Set(Object.keys(page.draftJson.sections));
      page.draftJson.sectionsOrder = action.sectionsOrder.filter((id) => validIds.has(id));
    }
    if (action.type === "dropitem") {
      const blockIds = new Set(action.blockIds);
      const section = action.scope === "global" ? requireGlobalSection(site, action.globalType) : page?.draftJson.sections[action.sectionId];
      if (!section?.blocks) throw new RelationalStoreError("theme_section_not_found", 404);
      const byId = new Map(section.blocks.map((block) => [block.id, block]));
      section.blocks = action.blockIds.map((id) => byId.get(id)).filter((block): block is SectionBlockInstance => Boolean(block));
      for (const block of byId.values()) if (!blockIds.has(block.id)) section.blocks.push(block);
      sectionId = action.scope === "global" ? action.globalType === "header" ? "header_plus" : "footer_plus" : action.sectionId;
      responseType = "th1";
    }
    if (action.type === "delition") {
      if (!page) throw new RelationalStoreError("theme_page_not_found", 404);
      page.draftJson.sectionsOrder = page.draftJson.sectionsOrder.filter((id) => id !== action.sectionId);
      delete page.draftJson.sections[action.sectionId];
      responseType = "del";
    }
    if (action.type === "delitem") {
      const section = action.scope === "global" ? requireGlobalSection(site, action.globalType) : page?.draftJson.sections[action.sectionId];
      if (!section?.blocks) throw new RelationalStoreError("theme_section_not_found", 404);
      section.blocks = section.blocks.filter((block) => block.id !== action.blockId);
      sectionId = action.scope === "global" ? action.globalType === "header" ? "header_plus" : "footer_plus" : action.sectionId;
      responseType = "th1";
    }
    if (action.type === "addition") {
      if (!page) throw new RelationalStoreError("theme_page_not_found", 404);
      sectionId = action.sectionId ?? `${action.sectionType}_${Date.now().toString(36)}`;
      page.draftJson.sections[sectionId] = action.section ?? xfcartDefaultSection(action.sectionType, undefined, themeKey);
      if (action.sectionsOrder?.length) {
        const validIds = new Set(Object.keys(page.draftJson.sections));
        const normalizedOrder = action.sectionsOrder.filter((id) => validIds.has(id));
        page.draftJson.sectionsOrder = normalizedOrder.includes(sectionId) ? normalizedOrder : [...normalizedOrder, sectionId];
      } else {
        page.draftJson.sectionsOrder.push(sectionId);
      }
      responseType = "add";
    }
    if (action.type === "additem") {
      const section = action.scope === "global" ? requireGlobalSection(site, action.globalType) : page?.draftJson.sections[action.sectionId];
      if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
      const blockSchema = themeScopedSectionSchema(section.type, themeKey).blocks?.find((block) => block.type === action.blockType);
      if (!blockSchema) throw new RelationalStoreError("theme_block_schema_not_found", 404);
      section.blocks ??= [];
      section.blocks.push(action.block ?? defaultBlock(blockSchema, section.blocks.length + 1));
      sectionId = action.scope === "global" ? action.globalType === "header" ? "header_plus" : "footer_plus" : action.sectionId;
      responseType = "th1";
    }

    await persistSiteDraft(tx, site);
    await persistDraftThemeState(tx, site, themeKey, actor, draftTheme);
    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: `theme_saas_${action.type}`,
      targetType: "theme_draft",
      targetId: "pageId" in action ? action.pageId : action.scope,
      metadata: {
        actionType: action.type,
        scope: "scope" in action ? action.scope : "page",
        pageId: "pageId" in action ? action.pageId : "",
        sectionId: "sectionId" in action ? action.sectionId ?? "" : "",
        globalType: "globalType" in action ? action.globalType : "",
        themeKey
      }
    });
    return { site, sectionId, responseType };
  }, { timeout: 20000 });
}

export async function applyXfcartThemeEditRelational(
  siteId: string,
  payload: XfcartThemeEditPayload,
  actor = "site_admin_demo"
): Promise<{ site: Site; sectionId?: string; responseType: "reload" | "th1" | "add" | "del"; pageId?: string }> {
  clearSiteThemeReadCache(siteId);
  return prisma.$transaction(async (tx) => {
    const site = toSite(await getSiteWithThemeRecords(tx, siteId));
    const explicit = payload.theme_id?.trim()
      ? await tx.siteTheme.findFirst({
          where: { siteId, status: { not: "active" }, OR: [{ id: payload.theme_id.trim() }, { themeId: payload.theme_id.trim() }] }
        })
      : null;
    const fallbackDraft = await tx.siteTheme.findFirst({ where: { siteId, status: "draft" }, orderBy: { updatedAt: "desc" } });
    const editedTheme = explicit ? toSiteTheme(explicit) : fallbackDraft ? toSiteTheme(fallbackDraft) : undefined;
    if (editedTheme) syncSiteFromThemeRecord(site, themeRecordFromSiteTheme(editedTheme), "draft");
    const themeKey = themeKeyFromXfcartPayload(payload, editedTheme);
    normalizeThemeScopedSettings(site, themeKey, editedTheme?.themeKey !== themeKey);
    const page = pageFromXfcartIdentifier(site, payload.page);
    const pageId = page?.id;
    let sectionId = payload.i;
    let responseType: "reload" | "th1" | "add" | "del" = "reload";
    const x = payload.x ?? "";
    const index = parseXfcartIndex(payload.k);
    const value = normalizeXfcartValue(payload.v);

    if (payload.t === "change") {
      if (!payload.n) throw new RelationalStoreError("theme_field_name_required", 400);
      if (x === "global_setting") {
        syncSaasGlobalSetting(site, payload.n, value ?? "", themeKey);
      } else if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        sectionId = x;
        if (index >= 0) {
          const block = section.blocks?.[index];
          if (!block) throw new RelationalStoreError("theme_block_not_found", 404);
          block.settings[payload.n] = value ?? "";
        } else {
          section.settings[payload.n] = value ?? "";
        }
        responseType = "th1";
      } else {
        if (!page || !payload.i) throw new RelationalStoreError("theme_page_or_section_required", 400);
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
        if (index >= 0) {
          const block = section.blocks?.[index];
          if (!block) throw new RelationalStoreError("theme_block_not_found", 404);
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
      if (!sort.length) throw new RelationalStoreError("theme_sort_required", 400);
      if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        section.blocks = reorderXfcartBlocks(section.blocks ?? [], sort);
        sectionId = x;
      } else {
        if (!page || !payload.i) throw new RelationalStoreError("theme_page_or_section_required", 400);
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
        section.blocks = reorderXfcartBlocks(section.blocks ?? [], sort);
        sectionId = payload.i;
      }
      responseType = "th1";
    }
    if (payload.t === "dropition") {
      if (!page) throw new RelationalStoreError("theme_page_not_found", 404);
      const sort = parseXfcartSort(value);
      const validIds = new Set(Object.keys(page.draftJson.sections));
      page.draftJson.sectionsOrder = sort.filter((id) => validIds.has(id));
    }
    if (payload.t === "delitem") {
      if (x === "header_plus" || x === "footer_plus") {
        const section = requireGlobalSection(site, x === "header_plus" ? "header" : "footer");
        section.blocks = (section.blocks ?? []).filter((_, blockIndex) => blockIndex !== index);
        sectionId = x;
      } else {
        if (!page || !payload.i) throw new RelationalStoreError("theme_page_or_section_required", 400);
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
        section.blocks = (section.blocks ?? []).filter((_, blockIndex) => blockIndex !== index);
        sectionId = payload.i;
      }
      responseType = "th1";
    }
    if (payload.t === "delition") {
      if (!page || !payload.i) throw new RelationalStoreError("theme_page_or_section_required", 400);
      page.draftJson.sectionsOrder = page.draftJson.sectionsOrder.filter((id) => id !== payload.i);
      delete page.draftJson.sections[payload.i];
      sectionId = payload.i;
      responseType = "del";
    }
    if (payload.t === "addition") {
      if (!page || !x) throw new RelationalStoreError("theme_page_or_section_required", 400);
      sectionId = payload.i || `${x}_${Date.now().toString(36)}`;
      page.draftJson.sections[sectionId] = xfcartDefaultSection(x, payload.section, themeKey);
      if (payload.sectionsOrder?.length) {
        const validIds = new Set(Object.keys(page.draftJson.sections));
        const normalizedOrder = payload.sectionsOrder.filter((id) => validIds.has(id));
        page.draftJson.sectionsOrder = normalizedOrder.includes(sectionId) ? normalizedOrder : [...normalizedOrder, sectionId];
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
        if (!page || !payload.i) throw new RelationalStoreError("theme_page_or_section_required", 400);
        const section = page.draftJson.sections[payload.i];
        if (!section) throw new RelationalStoreError("theme_section_not_found", 404);
        section.blocks ??= [];
        section.blocks.push(xfcartDefaultBlock(section, readString(value) ?? payload.block?.type ?? "", payload.block, themeKey));
        sectionId = payload.i;
      }
      responseType = "th1";
    }

    await persistSiteDraft(tx, site);
    const theme = await persistDraftThemeState(tx, site, themeKey, actor, editedTheme);
    if (payload.theme_id && (theme.id === payload.theme_id || theme.themeId === payload.theme_id) && theme.themeId !== payload.theme_id) {
      await tx.siteTheme.update({ where: { id: theme.id }, data: { themeId: payload.theme_id } });
    }
    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: `theme_xfcart_${payload.t}`,
      targetType: "theme_draft",
      targetId: pageId ?? x,
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
    return { site, sectionId, responseType, pageId };
  }, { timeout: 20000 });
}
