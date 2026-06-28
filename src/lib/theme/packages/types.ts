import type { SectionBlockInstance, SectionType, ThemeSettingValue } from "@/lib/types";

export type ThemePackageTemplateKey =
  | "home"
  | "pricing"
  | "packages"
  | "tools"
  | "package-detail"
  | "tool-detail"
  | "login"
  | "app-home"
  | "job-progress"
  | "album"
  | "account-billing"
  | "job-detail"
  | "help"
  | "policy"
  | "blog-list"
  | "blog-detail"
  | "search"
  | "cart"
  | "404";

export type ThemePackageSiteSettings = {
  branding?: {
    logoText?: string;
    market?: string;
    description?: string;
  };
  themeSettings?: {
    colors?: {
      background?: string;
      foreground?: string;
      accent?: string;
      muted?: string;
    };
    typography?: {
      display?: string;
      body?: string;
    };
    radii?: {
      section?: number;
      control?: number;
    };
    navigation?: {
      headerLinks?: Array<{ label: string; href: string; group?: string }>;
      footerLinks?: Array<{ label: string; href: string; group?: string }>;
    };
    globalSections?: {
      header?: {
        settings?: Record<string, ThemeSettingValue>;
        blocks?: SectionBlockInstance[];
      };
      footer?: {
        settings?: Record<string, ThemeSettingValue>;
        blocks?: SectionBlockInstance[];
      };
    };
    seo?: {
      siteTitle?: string;
      siteDescription?: string;
      siteKeywords?: string;
      titleTemplate?: string;
      defaultOgImage?: string;
    };
    saasSettingsCurrent?: Record<string, string | number | boolean | null | Record<string, unknown> | unknown[]>;
  };
};

export type ThemePackageManifest = {
  key: string;
  name: string;
  description: string;
  audience: string;
  accent?: string;
  thumbnailUrl?: string;
  source?: "internal-theme-package";
  siteSettings?: ThemePackageSiteSettings;
  templates: Array<{
    key: string;
    label: string;
    pageType: string;
    sectionCount: number;
  }>;
  featuredSections: SectionType[];
};
