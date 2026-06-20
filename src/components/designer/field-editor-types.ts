import type { CreativePack, MediaAsset, Product, SiteAiApp, ThemePage } from "@/lib/types";

export type FieldOptions = {
  pages: ThemePage[];
  products: Product[];
  siteAiApps: SiteAiApp[];
  mediaAssets: MediaAsset[];
  creativePacks: CreativePack[];
};

export type ResourceSelectorKind = "media" | "collection" | "product" | "page" | "url";

export type ResourceSelectorOption = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  value: string;
  preview?: string;
  meta?: string[];
  tone?: "good" | "warn" | "neutral";
};

export type SaasSelectorValue = {
  id: string;
  title: string;
  url: string;
  type: string;
};
