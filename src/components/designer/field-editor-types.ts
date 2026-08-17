import type { CreativePack, MediaAsset, Product, SiteAiApp, ThemePage } from "@/lib/types";

export type DesignerResourceKind = "products" | "siteAiApps" | "creativePacks" | "mediaAssets";

export type DesignerResourceStatus = "idle" | "loading" | "ready" | "error";

export type FieldOptions = {
  pages: ThemePage[];
  products: Product[];
  siteAiApps: SiteAiApp[];
  mediaAssets: MediaAsset[];
  creativePacks: CreativePack[];
  requestResource?: (kind: DesignerResourceKind, options?: { signal?: AbortSignal }) => Promise<void>;
  upsertMediaAsset?: (asset: MediaAsset) => void;
  removeMediaAsset?: (assetId: string) => void;
  resourceStatus?: Partial<Record<DesignerResourceKind, DesignerResourceStatus>>;
};

export type ResourceSelectorKind = "media" | "collection" | "product" | "page" | "url";

export type ResourceSelectorOption = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  value: string;
  preview?: string;
  previewType?: "image" | "video";
  meta?: string[];
  tone?: "good" | "warn" | "neutral";
};

export type SaasSelectorValue = {
  id: string;
  title: string;
  url: string;
  type: string;
};
