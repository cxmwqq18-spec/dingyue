import theme1PackageJson from "../../../data/saas-theme1-package.json";
import themePackagesJson from "../../../data/saas-theme-packages.json";
import type {
  SectionInstance,
  SectionBlockInstance,
  SectionType,
  ThemePageJson,
  ThemeBlockSchema,
  ThemeFieldOption,
  ThemeFieldSchema,
  ThemeFieldType,
  ThemeSectionSchema,
  ThemeSettingValue
} from "@/lib/types";

type LocaleString = string | { "zh-CN"?: string; "en-US"?: string; [key: string]: string | undefined };

interface RawSaasField {
  type: string;
  id?: string;
  label?: LocaleString;
  content?: LocaleString;
  default?: ThemeSettingValue;
  info?: LocaleString;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: Array<{ value: string; label?: LocaleString }>;
}

interface RawSaasSettingsGroup {
  name: LocaleString;
  settings?: RawSaasField[];
  theme_name?: string;
  theme_author?: string;
  theme_version?: string;
}

interface RawSaasBlock {
  type: string;
  name?: LocaleString;
  settings?: RawSaasField[];
}

interface RawSaasPreset {
  name: string;
  cname?: LocaleString;
  category?: LocaleString;
  ccategory?: LocaleString;
  blocks?: Array<{
    type: string;
    name?: LocaleString;
    settings?: Record<string, ThemeSettingValue>;
  }>;
}

interface RawSaasSectionSchema {
  name: string;
  max_blocks?: number;
  settings?: RawSaasField[];
  blocks?: RawSaasBlock[];
  presets?: RawSaasPreset[];
}

export interface ImportedSaasSection {
  file: string;
  schema: RawSaasSectionSchema;
  liquid: string;
}

export interface SaasThemePackage {
  themeKey: string;
  sourceRoot: string;
  extractedAt: string;
  counts: {
    templates: number;
    sections: number;
    skippedSections: number;
    settingsGroups: number;
  };
  thumbnailUrl?: string | null;
  supportedFieldTypes: string[];
  templateNames: string[];
  sectionNames: string[];
  skippedSections: Array<{ file: string; reason: string }>;
  templates: Record<string, unknown>;
  settingsSchema: RawSaasSettingsGroup[];
  settingsData: {
    current?: Record<string, ThemeSettingValue>;
    presets?: unknown[];
  };
  sections: Record<string, ImportedSaasSection>;
}

export const saasTheme1Package = theme1PackageJson as unknown as SaasThemePackage;

export interface SaasThemePackageRegistry {
  summary: {
    sourceRoot: string;
    extractedAt: string;
    themeKeys: string[];
    counts: {
      themes: number;
      templates: number;
      sections: number;
      skippedSections: number;
    };
  };
  packages: Record<string, SaasThemePackage>;
}

export const saasThemePackageRegistry = themePackagesJson as unknown as SaasThemePackageRegistry;

export function getSaasThemePackage(themeKey = "theme1"): SaasThemePackage {
  return saasThemePackageRegistry.packages[themeKey] ?? saasTheme1Package;
}

export function getSaasThemePackageList() {
  return saasThemePackageRegistry.summary.themeKeys.map((themeKey) => {
    const theme = getSaasThemePackage(themeKey);
    return {
      themeKey,
      sourceRoot: theme.sourceRoot,
      counts: theme.counts,
      thumbnailUrl: theme.thumbnailUrl ?? null,
      templateNames: theme.templateNames,
      sectionNames: theme.sectionNames,
      skippedSections: theme.skippedSections
    };
  });
}

export function getSaasThemePackageSummaryList() {
  return saasThemePackageRegistry.summary.themeKeys.map((themeKey) => {
    const theme = getSaasThemePackage(themeKey);
    return {
      themeKey,
      sourceRoot: theme.sourceRoot,
      counts: theme.counts,
      thumbnailUrl: theme.thumbnailUrl ?? null,
      templateNames: theme.templateNames.slice(0, 8),
      sectionNames: theme.sectionNames.slice(0, 8),
      skippedSections: theme.skippedSections.slice(0, 3)
    };
  });
}

interface RawSaasTemplateSection {
  type: string;
  settings?: Record<string, ThemeSettingValue>;
  blocks?: Array<{
    id?: string;
    type: string;
    name?: string;
    settings?: Record<string, ThemeSettingValue>;
  }>;
}

interface RawSaasTemplate {
  content_for_page?: Array<string | number>;
  sections?: Record<string, RawSaasTemplateSection>;
  liquid?: string;
}

function localeText(value: LocaleString | undefined, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value["zh-CN"] ?? value["en-US"] ?? Object.values(value).find(Boolean) ?? fallback;
}

function normalizeFieldType(type: string): ThemeFieldType {
  const supported = new Set<ThemeFieldType>([
    "header",
    "paragraph",
    "text",
    "textarea",
    "richtext",
    "html",
    "video_url",
    "checkbox",
    "color",
    "image_picker",
    "font_picker",
    "range",
    "select",
    "custom_select",
    "collection",
    "url",
    "product",
    "price",
    "ai_app",
    "media_asset",
    "page",
    "blog",
    "link_list",
    "menu",
    "popover"
  ]);
  return supported.has(type as ThemeFieldType) ? type as ThemeFieldType : "text";
}

function fieldSource(type: ThemeFieldType): ThemeFieldSchema["source"] | undefined {
  if (type === "product") return "products";
  if (type === "collection") return "creative_packs";
  if (type === "page") return "pages";
  if (type === "link_list" || type === "menu") return "menus";
  return undefined;
}

function toOptions(options?: RawSaasField["options"]): ThemeFieldOption[] | undefined {
  return options?.map((option) => ({
    value: String(option.value),
    label: localeText(option.label, String(option.value))
  }));
}

function toField(field: RawSaasField, index: number): ThemeFieldSchema {
  const type = normalizeFieldType(field.type);
  const label = localeText(field.label ?? field.content, field.id ?? field.type);
  return {
    id: field.id ?? `__${type}_${index}`,
    label,
    type,
    default: field.default,
    helpText: localeText(field.info, ""),
    min: field.min,
    max: field.max,
    step: field.step,
    unit: field.unit,
    options: toOptions(field.options),
    source: fieldSource(type)
  };
}

export interface ImportedSaasSettingsGroup {
  id: string;
  label: string;
  fields: ThemeFieldSchema[];
}

function defaultBlockFromRaw(block: RawSaasBlock, index: number): ThemeBlockSchema {
  const fields = (block.settings ?? []).map(toField);
  const label = localeText(block.name, block.type);
  return {
    type: block.type,
    label,
    sourceName: label,
    settings: fields,
    preset: {
      label,
      settings: Object.fromEntries(fields.filter((field) => !field.id.startsWith("__")).map((field) => [field.id, field.default ?? ""]))
    }
  };
}

function presetBlocks(preset: RawSaasPreset): SectionBlockInstance[] {
  return (preset.blocks ?? []).map((block, index) => ({
    id: `${block.type}_${index + 1}`,
    type: block.type,
    settings: block.settings ?? {}
  }));
}

function categoryFor(schema: RawSaasSectionSchema): ThemeSectionSchema["category"] {
  if (schema.name.includes("product") || schema.name.includes("collection")) return "Commerce";
  if (["blog", "page_detail", "rich_text", "html", "newsletter"].includes(schema.name)) return "Content";
  if (["header_plus", "footer_plus"].includes(schema.name)) return "Global";
  return "Storefront";
}

export function toThemeSectionSchema(section: ImportedSaasSection, themeKey = "theme1"): ThemeSectionSchema {
  const schema = section.schema;
  const fields = (schema.settings ?? []).map(toField);
  const presets = (schema.presets ?? []).map((preset) => ({
    label: localeText(preset.cname, preset.name),
    category: localeText(preset.category ?? preset.ccategory, ""),
    name: preset.name,
    settings: Object.fromEntries(fields.filter((field) => !field.id.startsWith("__")).map((field) => [field.id, field.default ?? ""])),
    blocks: presetBlocks(preset)
  }));
  const presetLabel = localeText(schema.presets?.[0]?.cname, "");
  const presetCategory = localeText(schema.presets?.[0]?.category ?? schema.presets?.[0]?.ccategory, "");
  return {
    type: schema.name,
    label: presetLabel || schema.name,
    category: categoryFor(schema),
    description: `Imported from SaaS ${themeKey} ${section.file}.`,
    source: themeKey === "theme1" ? "saas-theme1" : "saas-theme",
    sourceFile: `${themeKey}/${section.file}`,
    saasPresetName: presetLabel || schema.name,
    saasPresetCategory: presetCategory,
    saasRawName: schema.name,
    maxBlocks: schema.max_blocks,
    settings: fields,
    blocks: schema.blocks?.map(defaultBlockFromRaw),
    presets
  };
}

export function getImportedSaasSectionSchemas(): Record<string, ThemeSectionSchema> {
  return Object.fromEntries(
    Object.entries(saasTheme1Package.sections).map(([name, section]) => [name, toThemeSectionSchema(section)])
  );
}

export function getImportedSaasSectionSchemasForTheme(themeKey = "theme1"): Record<string, ThemeSectionSchema> {
  const theme = getSaasThemePackage(themeKey);
  return Object.fromEntries(
    Object.entries(theme.sections).map(([name, section]) => [name, toThemeSectionSchema(section, themeKey)])
  );
}

export function getAllImportedSaasSectionSchemas(): Record<string, ThemeSectionSchema> {
  const entries: Array<[string, ThemeSectionSchema]> = [];
  for (const theme of getSaasThemePackageList()) {
    for (const [name, schema] of Object.entries(getImportedSaasSectionSchemasForTheme(theme.themeKey))) {
      entries.push([`${theme.themeKey}:${name}`, schema]);
    }
  }
  return Object.fromEntries(entries);
}

export function getImportedSaasTemplateNames(): string[] {
  return saasTheme1Package.templateNames;
}

function deepCloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getImportedSaasSettingsGroups(): ImportedSaasSettingsGroup[] {
  return saasTheme1Package.settingsSchema
    .filter((group) => Array.isArray(group.settings))
    .map((group, index) => {
      const label = localeText(group.name, `Settings ${index + 1}`);
      return {
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `settings_${index + 1}`,
        label,
        fields: (group.settings ?? []).map(toField)
      };
    });
}

export function getImportedSaasSettingsGroupsForTheme(themeKey = "theme1"): ImportedSaasSettingsGroup[] {
  return getSaasThemePackage(themeKey).settingsSchema
    .filter((group) => Array.isArray(group.settings))
    .map((group, index) => {
      const label = localeText(group.name, `Settings ${index + 1}`);
      return {
        id: `${themeKey}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `settings_${index + 1}`}`,
        label,
        fields: (group.settings ?? []).map(toField)
      };
    });
}

export function getImportedSaasSettingsCurrent(): Record<string, ThemeSettingValue> {
  return deepCloneValue(saasTheme1Package.settingsData.current ?? {});
}

export function getImportedSaasSettingsCurrentForTheme(themeKey = "theme1"): Record<string, ThemeSettingValue> {
  return deepCloneValue(getSaasThemePackage(themeKey).settingsData.current ?? {});
}

export function normalizeSaasSettingsCurrent(
  current?: Record<string, ThemeSettingValue>
): Record<string, ThemeSettingValue> {
  const defaults = getImportedSaasSettingsCurrent();
  return {
    ...defaults,
    ...(current ?? {}),
    sections: {
      ...((defaults.sections as Record<string, ThemeSettingValue> | undefined) ?? {}),
      ...((current?.sections as Record<string, ThemeSettingValue> | undefined) ?? {})
    }
  };
}

export function normalizeSaasSettingsCurrentForTheme(
  themeKey: string,
  current?: Record<string, ThemeSettingValue>
): Record<string, ThemeSettingValue> {
  const defaults = getImportedSaasSettingsCurrentForTheme(themeKey);
  return {
    ...defaults,
    ...(current ?? {}),
    sections: {
      ...((defaults.sections as Record<string, ThemeSettingValue> | undefined) ?? {}),
      ...((current?.sections as Record<string, ThemeSettingValue> | undefined) ?? {})
    }
  };
}

export function resetSaasSettingsCurrentForTheme(
  themeKey: string,
  current?: Record<string, ThemeSettingValue>
): Record<string, ThemeSettingValue> {
  const defaults = getImportedSaasSettingsCurrentForTheme(themeKey);
  const currentSections = (current?.sections as Record<string, ThemeSettingValue> | undefined) ?? {};
  const defaultSections = (defaults.sections as Record<string, ThemeSettingValue> | undefined) ?? {};
  return {
    ...defaults,
    sections: {
      ...defaultSections,
      header_plus: currentSections.header_plus ?? defaultSections.header_plus,
      footer_plus: currentSections.footer_plus ?? defaultSections.footer_plus
    }
  };
}

function normalizeBlockId(block: { id?: string; type: string }, index: number): string {
  return block.id ?? `${block.type}_${index + 1}`;
}

function normalizeTemplateSection(section: RawSaasTemplateSection): SectionInstance {
  return {
    type: section.type as SectionType,
    settings: section.settings ?? {},
    blocks: (section.blocks ?? []).map((block, index) => ({
      id: normalizeBlockId(block, index),
      type: block.type,
      settings: block.settings ?? {}
    }))
  };
}

export function getImportedSaasTemplate(templateName: string): RawSaasTemplate | undefined {
  return saasTheme1Package.templates[templateName] as RawSaasTemplate | undefined;
}

export function getImportedSaasTemplateForTheme(themeKey: string, templateName: string): RawSaasTemplate | undefined {
  return getSaasThemePackage(themeKey).templates[templateName] as RawSaasTemplate | undefined;
}

export function importedSaasTemplateToPageJson(templateName: string, pageType = templateName, version = 1): ThemePageJson | undefined {
  const template = getImportedSaasTemplate(templateName);
  if (!template?.content_for_page || !template.sections) return undefined;
  const sections = Object.fromEntries(
    Object.entries(template.sections).map(([id, section]) => [id, normalizeTemplateSection(section)])
  );
  const sectionsOrder = template.content_for_page.map(String).filter((id) => Boolean(sections[id]));
  return {
    pageType,
    version,
    sectionsOrder,
    sections
  };
}

export function importedSaasTemplateToPageJsonForTheme(themeKey: string, templateName: string, pageType = templateName, version = 1): ThemePageJson | undefined {
  const template = getImportedSaasTemplateForTheme(themeKey, templateName);
  if (!template?.content_for_page || !template.sections) return undefined;
  const sections = Object.fromEntries(
    Object.entries(template.sections).map(([id, section]) => [id, normalizeTemplateSection(section)])
  );
  const sectionsOrder = template.content_for_page.map(String).filter((id) => Boolean(sections[id]));
  return {
    pageType,
    version,
    sectionsOrder,
    sections
  };
}

export function getImportedSaasPackageStats() {
  return {
    themeKey: saasTheme1Package.themeKey,
    sourceRoot: saasTheme1Package.sourceRoot,
    counts: saasTheme1Package.counts,
    templateNames: saasTheme1Package.templateNames,
    sectionNames: saasTheme1Package.sectionNames,
    supportedFieldTypes: saasTheme1Package.supportedFieldTypes,
    skippedSections: saasTheme1Package.skippedSections
  };
}

export function getImportedSaasPackageStatsForTheme(themeKey = "theme1") {
  const theme = getSaasThemePackage(themeKey);
  return {
    themeKey: theme.themeKey,
    sourceRoot: theme.sourceRoot,
    counts: theme.counts,
    templateNames: theme.templateNames,
    sectionNames: theme.sectionNames,
    supportedFieldTypes: theme.supportedFieldTypes,
    skippedSections: theme.skippedSections
  };
}
