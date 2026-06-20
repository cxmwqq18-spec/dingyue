import {
  cloneSettings,
  navigationBlocks,
  normalizeGlobalSections,
  parseLinks,
  syncThemeSettingFromSaasField
} from "@/components/designer/designer-theme-utils";
import type { ThemeNavLink, ThemeSettings, ThemeSettingValue } from "@/lib/types";

export function updateThemeColorValue(
  settings: ThemeSettings,
  key: keyof ThemeSettings["colors"],
  value: string,
  themeKey: string
): ThemeSettings {
  const saasKeyByColor: Record<keyof ThemeSettings["colors"], string> = {
    background: "skin_bg",
    foreground: "skin_title_color",
    accent: "skin_price_color",
    muted: "skin_muted_color"
  };
  return syncThemeSettingFromSaasField(
    { ...settings, colors: { ...settings.colors, [key]: value } },
    saasKeyByColor[key],
    value,
    themeKey
  );
}

export function updateThemeTypographyValue(
  settings: ThemeSettings,
  key: keyof ThemeSettings["typography"],
  value: string,
  themeKey: string
): ThemeSettings {
  const saasKey = key === "display" ? "skin_title_font_family" : "skin_text_font_family";
  return syncThemeSettingFromSaasField(
    { ...settings, typography: { ...settings.typography, [key]: value } },
    saasKey,
    value,
    themeKey
  );
}

export function updateThemeRadiiValue(
  settings: ThemeSettings,
  key: keyof ThemeSettings["radii"],
  value: string
): ThemeSettings {
  const parsed = Number(value);
  return {
    ...settings,
    radii: {
      ...settings.radii,
      [key]: Number.isFinite(parsed) ? parsed : settings.radii[key]
    }
  };
}

export function updateThemeLinksValue(
  settings: ThemeSettings,
  key: keyof ThemeSettings["navigation"],
  value: string
): ThemeSettings {
  const parsedLinks = parseLinks(value) as ThemeNavLink[];
  const next = normalizeGlobalSections(cloneSettings(settings));
  next.navigation = { ...next.navigation, [key]: parsedLinks };
  const globalType = key === "headerLinks" ? "header" : "footer";
  const prefix = key === "headerLinks" ? "global_header" : "global_footer";
  const section = next.globalSections?.[globalType];
  if (section) section.blocks = navigationBlocks(parsedLinks, prefix);
  return next;
}

export function updateThemeSettingFromSaasField(
  settings: ThemeSettings,
  fieldId: string,
  value: ThemeSettingValue,
  themeKey: string
): ThemeSettings {
  return syncThemeSettingFromSaasField(cloneSettings(settings), fieldId, value, themeKey);
}
