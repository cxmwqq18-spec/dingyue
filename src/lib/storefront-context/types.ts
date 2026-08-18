import type { CreativePack, Price, Product, Site, StorefrontProfileJson, ThemePage, ThemePublication, ThemeSettings } from "@/lib/types";

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
};

export type ResolvedOffer = {
  product: Product;
  price: Price;
  formattedPrice: string;
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

export interface StorefrontContextAdapter {
  loadPublishedBundle(siteId: string, path: string): Promise<StorefrontContextBundle>;
  loadDraftBundle(siteId: string, pageId: string): Promise<StorefrontContextBundle>;
}
