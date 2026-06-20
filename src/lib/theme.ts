import type { SectionInstance, Site, ThemePageJson, ThemeSettings } from "./types";
import { themeValueToString } from "@/lib/theme-values";

export function getSectionEntries(pageJson: ThemePageJson): Array<[string, SectionInstance]> {
  return pageJson.sectionsOrder
    .map((id) => [id, pageJson.sections[id]] as [string, SectionInstance | undefined])
    .filter((entry): entry is [string, SectionInstance] => Boolean(entry[1]));
}

export function getPublishedTheme(site: Site): ThemeSettings {
  return site.themeSettings.publishedJson;
}

export function getDraftTheme(site: Site): ThemeSettings {
  return site.themeSettings.draftJson;
}

export function themeStyleVars(settings: ThemeSettings): Record<string, string> {
  const saas = settings.saasSettingsCurrent ?? {};
  const background = themeValueToString(saas.skin_bg, settings.colors.background);
  const foreground = themeValueToString(saas.skin_title_color, settings.colors.foreground);
  const body = themeValueToString(saas.skin_text_color, foreground);
  const accent = themeValueToString(saas.skin_price_color ?? saas.skin_primary_btn_bg_color, settings.colors.accent);
  const muted = themeValueToString(saas.skin_muted_color, settings.colors.muted);
  const primaryButton = themeValueToString(saas.skin_primary_btn_bg_color, foreground);
  const primaryButtonText = themeValueToString(saas.skin_primary_btn_text_color, "#ffffff");
  const secondaryButton = themeValueToString(saas.skin_secondary_btn_bg_color, "#ffffff");
  const secondaryButtonText = themeValueToString(saas.skin_secondary_btn_text_color, foreground);
  const titleFont = themeValueToString(saas.skin_title_font_family, settings.typography.display);
  const textFont = themeValueToString(saas.skin_text_font_family, settings.typography.body);
  const contentWidth = themeValueToString(saas.general_layout_width, "1280");
  const layoutSpacing = themeValueToString(saas.general_layout_spacing, "56");
  return {
    "--site-bg": background,
    "--site-fg": foreground,
    "--site-body": body,
    "--site-accent": accent,
    "--site-muted": muted,
    "--site-primary-button": primaryButton,
    "--site-primary-button-text": primaryButtonText,
    "--site-secondary-button": secondaryButton,
    "--site-secondary-button-text": secondaryButtonText,
    "--site-title-font": titleFont,
    "--site-text-font": textFont,
    "--site-content-width": `${Number(contentWidth) || 1280}px`,
    "--site-layout-spacing": `${Number(layoutSpacing) || 56}px`
  };
}
