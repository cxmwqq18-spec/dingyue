import type { CreativePack, MediaAsset, Price, Product, Site, StorefrontProfileJson, ThemePage, ThemePublication, ThemeSettings } from "@/lib/types";

export type StorefrontContextMode = "draft" | "published";

export type ResolvedPageSeo = {
  title: string;
  description: string;
  keywords?: string;
  canonicalPath: string;
  canonicalUrl: string;
  ogImage?: string;
  index: boolean;
  follow: boolean;
  sitemapEligible: boolean;
};

export type ResolvedOffer = {
  product: Product;
  price: Price;
  formattedPrice: string;
  checkoutEnabled: boolean;
};

export type EntityReference = {
  entityType: "page" | "product" | "price" | "creative_pack" | "media";
  entityId: string;
  ownerId: string;
  revision: string;
};

export type RouteDisposition =
  | { kind: "render"; path: string; pageId: string }
  | { kind: "redirect"; path: string; targetPath: string; targetPageId: string }
  | { kind: "not_found"; path: string };

export type SiteCapability = {
  usesAiGenerationPublicRoutes: boolean;
  usesCollectionDirectory: boolean;
  usesPricingDirectory: boolean;
};

export type EffectiveIndexability = {
  index: boolean;
  follow: boolean;
  sitemapEligible: boolean;
};

export type PublicCollectionItem = {
  id: string;
  ownerId: string;
  revision: string;
  name: string;
  description: string;
  categorySlug?: string;
  imageUrl: string;
  imageAlt: string;
  creditCost: number;
  outputCount: number;
  source: CreativePack;
};

export type PublicPricingOffer = ResolvedOffer & {
  checkoutEnabled: boolean;
};

export type PublicPageMediaProjection = {
  id: string;
  ownerId: string;
  entityRevision: string;
  usage: MediaAsset["usage"];
  url: string;
  alt: string;
  required: boolean;
};

export type StorefrontPublishScope = {
  type: "page" | "site";
  pageIds: string[];
  includeThemeSettings: boolean;
  includeStorefrontProfile: boolean;
};

export type StorefrontContext = {
  mode: StorefrontContextMode;
  site: Pick<Site, "id" | "name" | "slug" | "primaryDomain" | "currency" | "branding">;
  page: ThemePage;
  pageJson: ThemePage["publishedJson"];
  settings: ThemeSettings;
  seo: ResolvedPageSeo;
  profile?: StorefrontProfileJson;
  offers: {
    active: ResolvedOffer[];
    lowestPublicMonthlySubscriptionPrice?: ResolvedOffer;
    lowestPublicOneTimeCreditPrice?: ResolvedOffer;
    selectedOfferPrice?: ResolvedOffer;
  };
  catalog: {
    activePacks: CreativePack[];
    invalidPacks: CreativePack[];
    activeImageWorkflowCount: number;
  };
  revisions: {
    publicationId?: string;
    factsRevision: string;
    buildId: string;
  };
  capability: SiteCapability;
  indexability: EffectiveIndexability;
  missingFacts: string[];
};

export type StorefrontContextBundle = {
  site: Site;
  page: ThemePage;
  products: Product[];
  creativePacks: CreativePack[];
  publication?: ThemePublication;
  buildId?: string;
};

export interface PublishedStorefrontContextAdapter {
  loadPublishedBundle(siteId: string, path: string): Promise<StorefrontContextBundle>;
}

export interface DraftStorefrontContextAdapter {
  loadDraftBundle(siteId: string, pageId: string): Promise<StorefrontContextBundle>;
}

export interface StorefrontContextAdapter extends PublishedStorefrontContextAdapter, DraftStorefrontContextAdapter {}

export type PublishedSiteSnapshot = {
  site: Site;
  publication?: ThemePublication;
  publicationVersion?: number;
  publicationId?: string;
  factsRevision: string;
  buildId: string;
  pages: ThemePage[];
  publishedPaths: string[];
  products: Product[];
  creativePacks: CreativePack[];
  mediaAssets: MediaAsset[];
  profile?: StorefrontProfileJson;
  capability: SiteCapability;
  entityReferences: EntityReference[];
};

export type EffectivePublishedPage = {
  page: ThemePage;
  context: StorefrontContext;
  routeDisposition: RouteDisposition;
  indexability: EffectiveIndexability;
};
