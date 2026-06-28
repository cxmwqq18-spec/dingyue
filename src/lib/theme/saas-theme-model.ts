import { sectionSchemas } from "@/lib/section-schema";
import { getImportedSaasSectionSchemas, normalizeSaasSettingsCurrentForTheme } from "@/lib/theme/saas-theme-package";
import { normalizeGlobalSection } from "@/lib/theme/section-normalize";
import type {
  SectionBlockInstance,
  SectionInstance,
  SectionType,
  Site,
  ThemeBlockSchema,
  ThemeFieldOption,
  ThemeFieldSchema,
  ThemeNavLink,
  ThemePageJson,
  ThemeSectionSchema,
  ThemeSettings,
  ThemeSettingValue
} from "@/lib/types";

export interface SaasThemeTemplate {
  content_for_page: string[];
  sections: Record<string, SaasThemeSectionInstance>;
}

export type SaasThemeTemplates = Record<string, SaasThemeTemplate>;

export interface SaasThemeSectionInstance {
  type: string;
  version: string;
  card_name: string;
  settings: Record<string, ThemeSettingValue>;
  blocks: SectionBlockInstance[];
}

export interface SaasThemeSettingsRecord {
  settings_data: {
    current: Record<string, ThemeSettingValue | Record<string, SaasThemeSectionInstance>> & {
      sections: {
        header_plus: SaasThemeSectionInstance;
        footer_plus: SaasThemeSectionInstance;
      };
    };
    presets: unknown[];
  };
}

function fontFamilyName(value: ThemeSettingValue | undefined, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const family = value.family;
    if (typeof family === "string" && family.trim()) return family;
  }
  return fallback;
}

function globalSectionFromSaasSettings(
  current: Record<string, ThemeSettingValue>,
  type: "header" | "footer",
  fallback: ThemeSettings
): SectionInstance {
  const sections = current.sections as unknown as Record<string, SaasThemeSectionInstance> | undefined;
  const sectionKey = type === "header" ? "header_plus" : "footer_plus";
  const section = sections?.[sectionKey];
  if (section) return fromSaasSection(section);
  return normalizeGlobalSection(type, fallback.globalSections?.[type]);
}

const fallbackThemeSettings: Pick<ThemeSettings, "colors" | "typography" | "radii" | "navigation"> = {
  colors: {
    background: "#ffffff",
    foreground: "#171717",
    accent: "#2563eb",
    muted: "#f4f4f5"
  },
  typography: {
    display: "Inter",
    body: "Inter"
  },
  radii: {
    section: 20,
    control: 12
  },
  navigation: {
    headerLinks: [],
    footerLinks: []
  }
};

function normalizeThemeSettingsInput(settings: ThemeSettings): ThemeSettings {
  return {
    ...settings,
    colors: {
      ...fallbackThemeSettings.colors,
      ...(settings.colors ?? {})
    },
    typography: {
      ...fallbackThemeSettings.typography,
      ...(settings.typography ?? {})
    },
    radii: {
      ...fallbackThemeSettings.radii,
      ...(settings.radii ?? {})
    },
    navigation: {
      headerLinks: settings.navigation?.headerLinks ?? [],
      footerLinks: settings.navigation?.footerLinks ?? []
    },
    globalSections: {
      header: normalizeGlobalSection("header", settings.globalSections?.header),
      footer: normalizeGlobalSection("footer", settings.globalSections?.footer)
    }
  };
}

export interface SaasThemeRecord {
  name: string;
  themeId: string;
  themeKey: string;
  status: "draft" | "active";
  templates: SaasThemeTemplates;
  settings: SaasThemeSettingsRecord;
  updatedAt: string;
}

export interface SaasFieldSchema {
  type: string;
  id?: string;
  label?: Record<"zh-CN" | "en-US", string>;
  content?: Record<"zh-CN" | "en-US", string>;
  default?: ThemeSettingValue;
  info?: Record<"zh-CN" | "en-US", string>;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: Record<"zh-CN" | "en-US", string> }>;
}

export interface SaasBlockSchema {
  type: string;
  name: Record<"zh-CN" | "en-US", string>;
  settings: SaasFieldSchema[];
}

export interface SaasSectionSchema {
  name: string;
  max_blocks?: number;
  settings: SaasFieldSchema[];
  blocks?: SaasBlockSchema[];
  presets: Array<{
    name: string;
    cname: Record<"zh-CN" | "en-US", string>;
    blocks: SectionBlockInstance[];
  }>;
}

export interface SaasThemePublicationSnapshot {
  theme: SaasThemeRecord;
  pages: Array<{ id: string; slug: string; publishedJson: ThemePageJson }>;
  themeSettings: ThemeSettings;
}

function cardName(type: string): string {
  return sectionSchemas[type as SectionType]?.label ?? type;
}

function toSaasSection(id: string, section: SectionInstance): SaasThemeSectionInstance {
  return {
    type: section.type,
    version: "1",
    card_name: cardName(section.type),
    settings: section.settings,
    blocks: section.blocks ?? []
  };
}

function fromSaasSection(section: SaasThemeSectionInstance): SectionInstance {
  return {
    type: section.type as SectionType,
    settings: section.settings ?? {},
    blocks: section.blocks ?? []
  };
}

export function toSaasTemplate(pageJson: ThemePageJson): SaasThemeTemplate {
  const sections = Object.fromEntries(
    Object.entries(pageJson.sections)
      .filter(([, section]) => Boolean(section?.type))
      .map(([id, section]) => [id, toSaasSection(id, section)])
  );
  return {
    content_for_page: pageJson.sectionsOrder.filter((id) => Boolean(sections[id])),
    sections
  };
}

export function fromSaasTemplate(template: SaasThemeTemplate, pageType = "home", version = 1): ThemePageJson {
  return {
    pageType,
    version,
    sectionsOrder: template.content_for_page.map(String),
    sections: Object.fromEntries(
      Object.entries(template.sections).map(([id, section]) => [id, fromSaasSection(section)])
    )
  };
}

export function toSaasSettings(settings: ThemeSettings, themeKey = "theme1"): SaasThemeSettingsRecord {
  const safeSettings = normalizeThemeSettingsInput(settings);
  const normalizedCurrent = normalizeSaasSettingsCurrentForTheme(themeKey, safeSettings.saasSettingsCurrent);
  const persistedThemeState: Record<string, ThemeSettingValue> = {
    navigation: safeSettings.navigation as unknown as ThemeSettingValue
  };
  if (safeSettings.seo) persistedThemeState.seo = safeSettings.seo as unknown as ThemeSettingValue;
  const header = normalizeGlobalSection("header", safeSettings.globalSections?.header ?? {
    settings: { title: "Header", sticky: true },
    blocks: safeSettings.navigation.headerLinks.map((link, index) => ({
      id: `header_link_${index + 1}`,
      type: "menu_link",
      settings: {
        label: link.label,
        href: link.href,
        ...(link.group?.trim() ? { group: link.group.trim() } : {})
      }
    }))
  });
  const footer = normalizeGlobalSection("footer", safeSettings.globalSections?.footer ?? {
    settings: { title: "Footer" },
    blocks: safeSettings.navigation.footerLinks.map((link, index) => ({
      id: `footer_link_${index + 1}`,
      type: "menu_link",
      settings: {
        label: link.label,
        href: link.href,
        ...(link.group?.trim() ? { group: link.group.trim() } : {})
      }
    }))
  });
  return {
    settings_data: {
      current: {
        ...normalizedCurrent,
        ...persistedThemeState,
        general_layout_width: normalizedCurrent.general_layout_width ?? 1280,
        general_layout_spacing: normalizedCurrent.general_layout_spacing ?? 56,
        skin_bg: normalizedCurrent.skin_bg ?? safeSettings.colors.background,
        skin_title_color: normalizedCurrent.skin_title_color ?? safeSettings.colors.foreground,
        skin_text_color: normalizedCurrent.skin_text_color ?? safeSettings.colors.foreground,
        skin_primary_btn_bg_color: normalizedCurrent.skin_primary_btn_bg_color ?? safeSettings.colors.foreground,
        skin_primary_btn_text_color: normalizedCurrent.skin_primary_btn_text_color ?? "#ffffff",
        skin_accent_color: normalizedCurrent.skin_accent_color ?? safeSettings.colors.accent,
        skin_muted_color: normalizedCurrent.skin_muted_color ?? safeSettings.colors.muted,
        skin_title_font_family: normalizedCurrent.skin_title_font_family ?? safeSettings.typography.display,
        skin_text_font_family: normalizedCurrent.skin_text_font_family ?? safeSettings.typography.body,
        sections: {
          ...((normalizedCurrent.sections as Record<string, ThemeSettingValue> | undefined) ?? {}),
          header_plus: {
            ...toSaasSection("header_plus", header),
            type: "header_plus",
            card_name: "头部配置"
          },
          footer_plus: {
            ...toSaasSection("footer_plus", footer),
            type: "footer_plus",
            card_name: "尾部配置"
          }
        }
      },
      presets: []
    }
  };
}

export function fromSaasSettings(record: SaasThemeSettingsRecord, fallback: ThemeSettings, themeKey = "theme1"): ThemeSettings {
  const current = record.settings_data.current;
  const normalizedCurrent = normalizeSaasSettingsCurrentForTheme(themeKey, current as Record<string, ThemeSettingValue>);
  const navigation = current.navigation && typeof current.navigation === "object" && !Array.isArray(current.navigation)
    ? current.navigation as unknown as ThemeSettings["navigation"]
    : fallback.navigation;
  const normalizedNavigation = {
    headerLinks: (navigation.headerLinks ?? []).map((link) => ({
      label: String(link.label ?? "").trim(),
      href: String(link.href ?? "").trim() || "#",
      ...(typeof link.group === "string" && link.group.trim() ? { group: link.group.trim() } : {})
    })) as ThemeNavLink[],
    footerLinks: (navigation.footerLinks ?? []).map((link) => ({
      label: String(link.label ?? "").trim(),
      href: String(link.href ?? "").trim() || "#",
      ...(typeof link.group === "string" && link.group.trim() ? { group: link.group.trim() } : {})
    })) as ThemeNavLink[]
  };
  const seo = current.seo && typeof current.seo === "object" && !Array.isArray(current.seo)
    ? current.seo as ThemeSettings["seo"]
    : fallback.seo;
  return {
    ...fallback,
    colors: {
      background: typeof normalizedCurrent.skin_bg === "string" ? normalizedCurrent.skin_bg : fallback.colors.background,
      foreground: typeof normalizedCurrent.skin_title_color === "string" ? normalizedCurrent.skin_title_color : fallback.colors.foreground,
      accent: typeof normalizedCurrent.skin_accent_color === "string" ? normalizedCurrent.skin_accent_color : fallback.colors.accent,
      muted: typeof normalizedCurrent.skin_muted_color === "string" ? normalizedCurrent.skin_muted_color : fallback.colors.muted
    },
    typography: {
      display: fontFamilyName(normalizedCurrent.skin_title_font_family, fallback.typography.display),
      body: fontFamilyName(normalizedCurrent.skin_text_font_family, fallback.typography.body)
    },
    globalSections: {
      header: globalSectionFromSaasSettings(normalizedCurrent, "header", fallback),
      footer: globalSectionFromSaasSettings(normalizedCurrent, "footer", fallback)
    },
    navigation: normalizedNavigation,
    seo,
    saasSettingsCurrent: normalizedCurrent
  };
}

export function buildSaasThemeDraft(site: Site, themeKey = "ai_subscription_theme1"): SaasThemeRecord {
  const settingsThemeKey = themeKey === "ai_subscription_theme1" ? "theme1" : themeKey;
  return {
    name: `${site.name} Theme`,
    themeId: `${site.id}_draft`,
    themeKey,
    status: "draft",
    templates: Object.fromEntries(site.pages.map((page) => [page.templateKey || page.pageType, toSaasTemplate(page.draftJson)])),
    settings: toSaasSettings(site.themeSettings.draftJson, settingsThemeKey),
    updatedAt: new Date().toISOString()
  };
}

export function buildSaasThemePublication(site: Site, version: number, themeKey = "ai_subscription_theme1"): SaasThemePublicationSnapshot {
  const settingsThemeKey = themeKey === "ai_subscription_theme1" ? "theme1" : themeKey;
  return {
    theme: {
      name: `${site.name} Theme`,
      themeId: `${site.id}_active_v${version}`,
      themeKey,
      status: "active",
      templates: Object.fromEntries(site.pages.map((page) => [page.templateKey || page.pageType, toSaasTemplate(page.publishedJson)])),
      settings: toSaasSettings(site.themeSettings.publishedJson, settingsThemeKey),
      updatedAt: new Date().toISOString()
    },
    pages: site.pages.map((page) => ({ id: page.id, slug: page.slug, publishedJson: page.publishedJson })),
    themeSettings: site.themeSettings.publishedJson
  };
}

function localeLabel(label: string): Record<"zh-CN" | "en-US", string> {
  return { "zh-CN": label, "en-US": label };
}

function toSaasField(field: ThemeFieldSchema): SaasFieldSchema {
  return {
    type: field.type,
    id: field.id,
    label: localeLabel(field.label),
    default: field.default,
    info: field.helpText ? localeLabel(field.helpText) : undefined,
    min: field.min,
    max: field.max,
    step: field.step,
    options: field.options?.map((option: ThemeFieldOption) => ({ value: option.value, label: localeLabel(option.label) }))
  };
}

function toSaasBlock(block: ThemeBlockSchema): SaasBlockSchema {
  return {
    type: block.type,
    name: localeLabel(block.label),
    settings: block.settings.map(toSaasField)
  };
}

export function getSaasSectionSchemas(): Record<string, SaasSectionSchema> {
  const schemas = {
    ...getImportedSaasSectionSchemas(),
    ...sectionSchemas
  };
  return Object.fromEntries(
    Object.values(schemas).map((schema: ThemeSectionSchema) => [
      schema.type,
      {
        name: schema.type,
        max_blocks: schema.maxBlocks,
        settings: schema.settings.map(toSaasField),
        blocks: schema.blocks?.map(toSaasBlock),
        presets: (schema.presets ?? []).map((preset) => ({
          name: schema.type,
          cname: localeLabel(preset.label),
          blocks: preset.blocks ?? []
        }))
      }
    ])
  );
}
