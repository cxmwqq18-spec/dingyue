import type {
  CreativePack,
  CreativePackCategory,
  MediaAsset,
  Price,
  Product,
  PublishedCollectionRef,
  PublishedFactsProjection,
  PublishedLinkRef,
  PublishedOfferProjection,
  PublishedPageEntityProjection,
  PublishedPageMediaProjection,
  PublishedStandardPageMediaProjection,
  PublishedRouteProjection,
  PublishedVideoNavigationProjection,
  PublishedHomepageShowcaseItem,
  Site,
  StorefrontProfileJson,
  ThemePage,
  ThemePageJson,
  ThemePublication,
  ThemeSettings,
  VideoTheme
} from "@/lib/types";
import type { MyDreamshootsPageCopy } from "@/lib/mydreamshoots-page-copy";

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
  maxImagePreview?: "none" | "standard" | "large";
  sitemapEligible: boolean;
};

export type ResolvedOffer = {
  product: Product;
  price: Price;
  formattedPrice: string;
  checkoutEnabled: boolean;
};

export type EntityReference = {
  entityType: "page" | "page_copy" | "route_manifest" | "page_media" | "theme_settings" | "product" | "price" | "creative_pack" | "video_theme" | "media";
  entityId: string;
  ownerId: string;
  revision: string;
  updatedAt?: string;
};

export type PublicationBoundary = {
  siteId: string;
  source: "postgres" | "platform-state";
  publicationId: string | null;
  publicationVersion: number | null;
};

export type RouteDisposition =
  | { kind: "render"; status: 200; path: string; pageId: string }
  | { kind: "redirect"; status: 301 | 302 | 307 | 308; path: string; targetPath: string; targetUrl: string; targetPageId: string }
  | { kind: "not_found"; status: 404; path: string };

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
    publicationVersion?: number;
    factsRevision: string;
    buildId: string;
    pageEntityId?: string;
    copyRevision?: string;
    pageMediaRevision?: string;
    standardPageMediaRevision?: string;
    canonicalSlug?: string;
    snapshotRevision?: string;
    routeRevision?: string;
    pageRevision?: string;
    offerRevision?: string;
    collectionRevision?: string;
    linkRevision?: string;
    policyRevision?: string;
  };
  capability: SiteCapability;
  indexability: EffectiveIndexability;
  missingFacts: string[];
  publishedFacts?: PublishedFactsProjection;
  publishedPageMedia?: PublishedPageMediaProjection;
  publishedStandardPageMedia?: PublishedStandardPageMediaProjection;
  publishedPageEntity?: PublishedPageEntityProjection;
  snapshotIntegrity: "valid" | "invalid" | "legacy";
  pageCopy?: MyDreamshootsPageCopy;
  publishedPaths?: string[];
};

export type StorefrontContextBundle = {
  site: Site;
  page: ThemePage;
  products: Product[];
  creativePacks: CreativePack[];
  publication?: ThemePublication;
  factsRevision?: string;
  buildId?: string;
  publishedPageEntities?: Record<string, PublishedPageEntityProjection>;
  publishedFacts?: PublishedFactsProjection;
  publishedPageMedia?: Record<string, PublishedPageMediaProjection>;
  publishedStandardPageMedia?: Record<string, PublishedStandardPageMediaProjection>;
  publishedLinkRefs?: PublishedLinkRef[];
  snapshotIntegrity?: "valid" | "invalid" | "legacy";
};

export interface PublishedStorefrontContextAdapter {
  loadPublishedBundle(siteId: string, path: string): Promise<StorefrontContextBundle>;
}

export interface DraftStorefrontContextAdapter {
  loadDraftBundle(siteId: string, pageId: string): Promise<StorefrontContextBundle>;
}

export interface StorefrontContextAdapter extends PublishedStorefrontContextAdapter, DraftStorefrontContextAdapter {}

export type PublishedSiteSnapshot = {
  boundary: PublicationBoundary;
  site: Site;
  themeSettings: ThemeSettings;
  publication?: ThemePublication;
  publicationVersion?: number;
  publicationId?: string;
  factsRevision: string;
  buildId: string;
  pages: ThemePage[];
  publishedPaths: string[];
  publishedRoutes: PublishedRouteProjection[];
  publishedPageEntities: PublishedPageEntityProjection[];
  publishedPageCopy: Array<{ pageEntityId: string; copyRevision: string; canonicalSlug: string; sourceHash: string }>;
  publishedPageMedia: PublishedPageMediaProjection[];
  publishedStandardPageMedia: PublishedStandardPageMediaProjection[];
  publishedPackFacts: Array<{ packId: string; creditCost: number; outputCount: number; revision: string }>;
  publishedOffers: PublishedOfferProjection[];
  publishedFacts?: PublishedFactsProjection;
  publishedCollectionRefs: PublishedCollectionRef[];
  publishedLinkRefs: PublishedLinkRef[];
  publishedVideoNavigation: PublishedVideoNavigationProjection[];
  publishedHomepageShowcases: PublishedHomepageShowcaseItem[];
  snapshotRevisions: NonNullable<ThemePublication["snapshot"]["revisions"]>;
  legacyProjectionRequired: boolean;
  snapshotIntegrity: "valid" | "invalid" | "legacy";
  products: Product[];
  creativePacks: CreativePack[];
  creativePackCategories: CreativePackCategory[];
  videoThemes: VideoTheme[];
  mediaAssets: MediaAsset[];
  profile?: StorefrontProfileJson;
  capability: SiteCapability;
  entityReferences: EntityReference[];
};

export type EffectivePublishedPage = {
  boundary: PublicationBoundary;
  siteId: string;
  pageId: string | null;
  requestedPath: string;
  publicPath: string;
  pageJson: ThemePageJson | null;
  page: ThemePage;
  context: StorefrontContext;
  routeDisposition: RouteDisposition;
  indexability: EffectiveIndexability;
};
