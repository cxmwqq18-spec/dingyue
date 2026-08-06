"use client";

import type { GlobalSettingsNodeDefinition, Selection } from "@/components/designer/designer-types";
import { getSectionSchema } from "@/lib/section-schema";
import {
  normalizeSaasSettingsCurrent,
  normalizeSaasSettingsCurrentForTheme,
  resetSaasSettingsCurrentForTheme
} from "@/lib/theme/saas-theme-package";
import { normalizeGlobalSection } from "@/lib/theme/section-normalize";
import { themeValueToString } from "@/lib/theme-values";
import type {
  SectionBlockInstance,
  SectionInstance,
  ThemeNavLink,
  ThemeBlockSchema,
  ThemePageJson,
  ThemeSectionSchema,
  ThemeSettings,
  ThemeSettingValue
} from "@/lib/types";

export type SelectionMeta = {
  scope: string;
  detail: string;
};

const fallbackThemeSettings = {
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
  }
};

export function clonePage(page: ThemePageJson): ThemePageJson {
  return JSON.parse(JSON.stringify(page)) as ThemePageJson;
}

export function cloneSettings(settings: ThemeSettings): ThemeSettings {
  return JSON.parse(JSON.stringify(settings)) as ThemeSettings;
}

function stringifyValue(value: ThemeSettingValue | undefined): string {
  return themeValueToString(value);
}

function resolveBlockSchema(section: SectionInstance, blockType: string): ThemeBlockSchema | undefined {
  return getSectionSchema(section.type).blocks?.find((schema) => schema.type === blockType);
}

export function resolveBlockSchemaFromSchemas(
  schemas: Record<string, ThemeSectionSchema>,
  section: SectionInstance,
  blockType: string
): ThemeBlockSchema | undefined {
  return schemas[section.type]?.blocks?.find((schema) => schema.type === blockType) ?? resolveBlockSchema(section, blockType);
}

export function safeBlocks(section?: SectionInstance): SectionBlockInstance[] {
  return section?.blocks ?? [];
}

export function instanceKey(item: { id?: string; type?: string }, index: number, prefix: string): string {
  return item.id?.trim() ? item.id : `${prefix}_${item.type ?? "item"}_${index}`;
}

export function settingLinkString(links: ThemeSettings["navigation"]["headerLinks"]): string {
  return (links ?? [])
    .map((link) => {
      const base = `${link.label}|${link.href}`;
      return link.group?.trim() ? `${base}|${link.group.trim()}` : base;
    })
    .join("\n");
}

export function parseLinks(value: string): ThemeNavLink[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "Link", href = "#", group = ""] = line.split("|");
      const normalizedGroup = group.trim();
      return {
        label: label.trim(),
        href: href.trim() || "#",
        ...(normalizedGroup ? { group: normalizedGroup } : {})
      };
    });
}

export function navigationBlocks(
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

function ensureGlobalSectionBlocks(settings: ThemeSettings, globalType: "header" | "footer") {
  settings.globalSections ??= {};
  settings.navigation ??= { headerLinks: [], footerLinks: [] };
  settings.navigation.headerLinks ??= [];
  settings.navigation.footerLinks ??= [];
  const section = normalizeGlobalSection(globalType, settings.globalSections[globalType]);
  const menuBlocks = safeBlocks(section).filter((block) => block.type === "menu_link");
  if (!menuBlocks.length) {
    section.blocks = navigationBlocks(
      globalType === "header" ? settings.navigation.headerLinks : settings.navigation.footerLinks,
      globalType === "header" ? "global_header" : "global_footer"
    );
  }
  settings.globalSections[globalType] = section;
}

export function globalTypeFromPreviewId(id: string): "header" | "footer" | undefined {
  if (id === "header_plus") return "header";
  if (id === "footer_plus") return "footer";
  return undefined;
}

export function normalizeGlobalSections(settings: ThemeSettings): ThemeSettings {
  const normalized = {
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
    },
    saasSettingsCurrent: normalizeSaasSettingsCurrent(settings.saasSettingsCurrent)
  };
  ensureGlobalSectionBlocks(normalized, "header");
  ensureGlobalSectionBlocks(normalized, "footer");
  return normalized;
}

export function syncThemeSettingFromSaasField(
  settings: ThemeSettings,
  fieldId: string,
  value: ThemeSettingValue,
  themeKey = "theme1"
): ThemeSettings {
  const stringValue = stringifyValue(value);
  const next = normalizeGlobalSections(settings);
  next.saasSettingsCurrent = normalizeSaasSettingsCurrentForTheme(themeKey, next.saasSettingsCurrent);
  next.saasSettingsCurrent[fieldId] = value;
  if (fieldId === "skin_bg") next.colors.background = stringValue;
  if (fieldId === "skin_title_color") next.colors.foreground = stringValue;
  if (fieldId === "skin_price_color" || fieldId === "skin_primary_btn_bg_color") next.colors.accent = stringValue;
  if (fieldId === "skin_muted_color") next.colors.muted = stringValue;
  if (fieldId === "skin_title_font_family") next.typography.display = stringValue;
  if (fieldId === "skin_text_font_family") next.typography.body = stringValue;
  return next;
}

export function normalizeThemeSettingsForPackage(settings: ThemeSettings, themeKey: string): ThemeSettings {
  const normalized = normalizeGlobalSections(cloneSettings(settings));
  normalized.saasSettingsCurrent = resetSaasSettingsCurrentForTheme(themeKey, normalized.saasSettingsCurrent);
  return normalized;
}

export function selectionSummary(
  selection: Selection,
  activeSection?: SectionInstance,
  activeBlock?: SectionBlockInstance,
  activeGlobalBlock?: SectionBlockInstance,
  activeGlobalNode?: GlobalSettingsNodeDefinition
): SelectionMeta {
  if (selection.kind === "global") {
    return {
      scope: selection.globalType === "header" ? "页眉模块" : "页脚模块",
      detail: "全站共享模块，发布后会同步到所有前台页面。"
    };
  }
  if (selection.kind === "globalSettings") {
    return {
      scope: "全局配置",
      detail: activeGlobalNode?.description ?? "整站共享的主题配置与品牌设定。"
    };
  }
  if (selection.kind === "globalBlock") {
    return {
      scope: selection.globalType === "header" ? "页眉子块" : "页脚子块",
      detail: "全站共享的导航、按钮或内容子项。"
    };
  }
  if (selection.kind === "block") {
    return {
      scope: "模块子块",
      detail: "当前页面模块中的子项字段与资源绑定。"
    };
  }
  return {
    scope: "页面模块",
    detail: "当前页面中的主模块字段、子块和排序动作。"
  };
}
