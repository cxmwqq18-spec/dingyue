import type { VideoModelFamily, VideoModelPricing } from "@/lib/video-frame-config";
import type { ImageProviderAspectRatio, ImageProviderOutputFormat, ImageProviderQuality, ImageProviderResolution } from "@/lib/tokengo-image";

export type SiteStatus = "active" | "draft" | "suspended";
export type ConnectStatus = "not_started" | "pending" | "enabled" | "restricted";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "refunded";
export type LedgerType = "grant" | "reserve" | "consume" | "release" | "adjustment";
export type GenerationEntryPoint = "customer_workspace" | "site_admin" | "platform_admin" | "external_api" | "rerun";

export type PlatformAiProviderType = "image" | "video" | "text" | "audio";

export type SectionType =
  | "aidreamcapes_home_hero"
  | "aidreamcapes_video_grid"
  | "aidreamcapes_ad_testing"
  | "aidreamcapes_photo_grid"
  | "aidreamcapes_scenario_grid"
  | "aidreamcapes_how_it_works"
  | "aidreamcapes_credit_rules"
  | "aidreamcapes_v2_page"
  | "hero"
  | "story_mosaic"
  | "video_feature"
  | "mobile_video_showcase"
  | "brand_logo_strip"
  | "email_start_panel"
  | "feature_grid"
  | "photo_package_wall"
  | "dreamshoot_generation_showcase"
  | "occasion_showcase"
  | "ai_feature_launcher"
  | "sample_strip"
  | "studio_steps"
  | "conversion_panel"
  | "dreamshoot_feature_tabs"
  | "dreamshoot_tool_collection"
  | "dreamshoot_package_taxonomy"
  | "login_method_panel"
  | "shoot_pack_marquee"
  | "trust_signal_bar"
  | "pricing_table"
  | "ai_tool_grid"
  | "ai_tool_entry"
  | "upload_panel"
  | "generation_form"
  | "job_progress"
  | "album_gallery"
  | "testimonial_wall"
  | "faq"
  | "policy_content"
  | "blog_list"
  | "blog_article"
  | "rich_text"
  | "media_banner"
  | "talking_photo_landing"
  | "ai_video_topic_landing"
  | "ai_image_theme_landing"
  | "before_after_gallery"
  | "header"
  | "footer"
  | string;

export type ThemeSettingPrimitive = string | number | boolean | null;
export type ThemeSettingValue =
  | ThemeSettingPrimitive
  | ThemeSettingPrimitive[]
  | { [key: string]: ThemeSettingValue }
  | ThemeSettingValue[];

export interface ThemeNavLink {
  label: string;
  href: string;
  group?: string;
  /** Optional one-line customer-facing summary shown under the label (Aidreamcapes v2 menus). */
  description?: string;
  /** Optional thumbnail image path shown next to the label (Aidreamcapes v2 menus). */
  image?: string;
}

/** Aidreamcapes.com v2 header/footer navigation, stored in ThemeSettings. */
export interface AidreamcapesV2NavigationMenu {
  label: string;
  groups: AidreamcapesZipNavigationGroup[];
  popular?: ThemeNavLink[];
  /** The menu's hub page, linked once at the bottom of the panel instead of among the tools. */
  hubLink?: ThemeNavLink;
  footerLink?: ThemeNavLink;
}

export interface AidreamcapesV2Navigation {
  version: 2;
  menus: AidreamcapesV2NavigationMenu[];
  links: ThemeNavLink[];
  actions: {
    login: ThemeNavLink;
    getStarted: ThemeNavLink;
  };
  footer: {
    tagline: string;
    groups: AidreamcapesZipNavigationGroup[];
    legal: ThemeNavLink[];
    copyright: string;
    partnerBadges?: AidreamcapesPartnerBadge[];
  };
}

/** Friend-link badge shown at the bottom of the Aidreamcapes v2 footer (data-driven). */
export interface AidreamcapesPartnerBadge {
  key: string;
  label: string;
  href: string;
  imageUrl: string;
  imageHeight?: number;
}

export interface AidreamcapesZipNavigationGroup {
  label: string;
  items: ThemeNavLink[];
  /** A long link column may split its items into a second sub-column ("2"). */
  columns?: string;
  /** Hub directory page for this group; when present the group title links to it. */
  hubHref?: string;
}

export interface AidreamcapesZipNavigationMenu {
  label: string;
  groups: AidreamcapesZipNavigationGroup[];
  collection?: ThemeNavLink;
}

export interface AidreamcapesZipNavigation {
  actions: {
    pricing: ThemeNavLink;
    login: ThemeNavLink;
    getStarted: ThemeNavLink;
  };
  video: AidreamcapesZipNavigationMenu;
  image: AidreamcapesZipNavigationMenu;
  marketing: AidreamcapesZipNavigationMenu;
  scenarios: AidreamcapesZipNavigationMenu;
  footerGroups: AidreamcapesZipNavigationGroup[];
}

export interface SaveTheDateNavigationItem {
  label: string;
  slug: string;
  href: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  videoUrl?: string;
  status: "published" | "draft" | "review_required";
  sortOrder: number;
}

export interface SaveTheDateNavigationGroup {
  label: string;
  slug: string;
  sortOrder: number;
  items: SaveTheDateNavigationItem[];
}

export interface SaveTheDateNavigationConfig {
  menuLabel: string;
  groups: SaveTheDateNavigationGroup[];
}

export interface SectionBlockInstance {
  id: string;
  type: string;
  settings: Record<string, ThemeSettingValue>;
}

export interface SectionInstance {
  type: SectionType;
  settings: Record<string, ThemeSettingValue>;
  blocks?: SectionBlockInstance[];
}

export interface ContextualLink {
  before?: string;
  label: string;
  href: string;
  after?: string;
}

export interface ThemePageJson {
  pageType: string;
  version: number;
  sectionsOrder: string[];
  sections: Record<string, SectionInstance>;
  relatedLinks?: Array<{ label: string; href: string }>;
  contextualLinks?: ContextualLink[];
  /** Route-owned copy for catalogue detail views backed by this live page. */
  contextualLinksByPath?: Record<string, ContextualLink[]>;
  seo?: {
    title?: string;
    description?: string;
    twitterDescription?: string;
    keywords?: string;
    ogImage?: string;
    ogImageAlt?: string;
    canonical?: string;
    canonicalPath?: string;
    robots?: {
      index?: boolean;
      follow?: boolean;
      maxImagePreview?: "none" | "standard" | "large";
    };
    index?: boolean;
    follow?: boolean;
  };
  mediaManifest?: Array<{
    src: string;
    alt: string;
    role?: "hero" | "content";
    loading?: "eager" | "lazy";
    fetchPriority?: "high" | "low" | "auto";
    width?: number;
    height?: number;
  }>;
  contentContract?: {
    schema: "editorial-page-v1";
    requiredSections: string[];
    sectionTypes?: string[];
    faqCount?: number;
    mediaCount?: number;
    pageKey?: string;
    sourceRevision?: string;
  };
}

export interface ThemeDraftMeta {
  revision: number;
  updatedAt: string;
  etag: string;
}

export interface StorefrontAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface StorefrontProfileJson {
  identity: {
    legalName?: string;
    entityType?: string;
    address?: StorefrontAddress;
    supportEmail?: string;
    phone?: string;
    sameAs: string[];
  };
  policyFacts: {
    usesCustomerMediaForTraining?: boolean;
    sourceMediaRetentionDays?: number;
    refundReviewRequired?: boolean;
    refundWindowDays?: number;
    effectiveDate?: string;
    creditLifecycle?: { reserve?: string; consume?: string; release?: string };
    security?: { checkoutProvider?: string; transportClaimKey?: string; storageClaimKey?: string };
  };
}

export interface StorefrontProfile {
  id: string;
  siteId: string;
  draftJson: StorefrontProfileJson;
  publishedJson: StorefrontProfileJson;
  draftMeta?: ThemeDraftMeta;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThemePage {
  id: string;
  siteId: string;
  pageType: string;
  templateKey?: string;
  slug: string;
  title: string;
  draftJson: ThemePageJson;
  publishedJson: ThemePageJson;
  draftMeta?: ThemeDraftMeta;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThemeSettings {
  colors: {
    background: string;
    foreground: string;
    accent: string;
    muted: string;
  };
  typography: {
    display: string;
    body: string;
  };
  radii: {
    section: number;
    control: number;
  };
  navigation: {
    headerLinks: ThemeNavLink[];
    footerLinks: ThemeNavLink[];
  };
  aidreamcapesZipNavigation?: AidreamcapesZipNavigation;
  aidreamcapesV2Navigation?: AidreamcapesV2Navigation;
  saveTheDateNavigation?: SaveTheDateNavigationConfig;
  globalSections?: {
    header?: SectionInstance;
    footer?: SectionInstance;
  };
  seo?: {
    siteTitle: string;
    siteDescription: string;
    siteKeywords?: string;
    titleTemplate: string;
    defaultOgImage?: string;
    robots: {
      index: boolean;
      follow: boolean;
    };
    /** @deprecated Page SEO is stored on ThemePage draftJson/publishedJson. */
    pages?: Record<
      string,
      {
        title: string;
        description: string;
        twitterDescription?: string;
        keywords?: string;
        ogImage?: string;
        ogImageAlt?: string;
        canonicalPath?: string;
        index?: boolean;
        follow?: boolean;
      }
    >;
  };
  saasSettingsCurrent?: Record<string, ThemeSettingValue>;
  draftMeta?: ThemeDraftMeta;
}

export type ThemeFieldType =
  | "header"
  | "paragraph"
  | "text"
  | "textarea"
  | "richtext"
  | "html"
  | "video_url"
  | "checkbox"
  | "color"
  | "image_picker"
  | "font_picker"
  | "range"
  | "select"
  | "custom_select"
  | "collection"
  | "url"
  | "product"
  | "price"
  | "ai_app"
  | "media_asset"
  | "page"
  | "blog"
  | "link_list"
  | "menu"
  | "popover";

export interface ThemeFieldOption {
  label: string;
  value: string;
}

export interface ThemeFieldSchema {
  id: string;
  aliases?: string[];
  label: string;
  type: ThemeFieldType;
  default?: ThemeSettingValue;
  helpText?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: ThemeFieldOption[];
  source?: "products" | "prices" | "site_ai_apps" | "media_assets" | "pages" | "menus" | "creative_packs";
}

export interface ThemeBlockSchema {
  type: string;
  aliases?: string[];
  label: string;
  maxBlocks?: number;
  sourceName?: string;
  settings: ThemeFieldSchema[];
  preset?: {
    label: string;
    settings: Record<string, ThemeSettingValue>;
  };
}

export interface ThemeSectionSchema {
  type: SectionType;
  aliases?: string[];
  label: string;
  category: "Storefront" | "AI business" | "Commerce" | "Content" | "Global";
  description: string;
  source?: "saas-theme" | "saas-theme1" | "ai-subscription";
  sourceFile?: string;
  saasPresetName?: string;
  saasPresetCategory?: string;
  saasRawName?: string;
  maxBlocks?: number;
  settings: ThemeFieldSchema[];
  blocks?: ThemeBlockSchema[];
  presets?: Array<{
    label: string;
    category?: string;
    name?: string;
    settings: Record<string, ThemeSettingValue>;
    blocks?: SectionBlockInstance[];
  }>;
}

export interface Site {
  id: string;
  name: string;
  slug: string;
  status: SiteStatus;
  primaryDomain: string;
  currency: string;
  timezone: string;
  signupCreditGrant: number;
  branding: {
    logoText: string;
    market: string;
    description: string;
  };
  connect: {
    stripeAccountId: string;
    status: ConnectStatus;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  };
  themeSettings: {
    draftJson: ThemeSettings;
    publishedJson: ThemeSettings;
    draftMeta?: ThemeDraftMeta;
  };
  storefrontProfile?: StorefrontProfile;
  currentPublishedState?: SitePublishedState;
  activePublication?: ThemePublication;
  latestHistoricalPublication?: ThemePublication;
  /** @deprecated Public runtime must use activePublication. */
  latestPublication?: ThemePublication;
  pages: ThemePage[];
  mediaAssets?: MediaAsset[];
}

export interface SiteDomain {
  id: string;
  siteId: string;
  domain: string;
  isPrimary: boolean;
  status: "active" | "pending" | "failed";
  allowedAiProviderIds?: string[];
  createdAt: string;
}

export interface SiteAdmin {
  id: string;
  siteId: string;
  email: string;
  passwordHash?: string;
  displayName: string;
  role: "owner" | "admin" | "support";
  createdAt: string;
}

export type PublicSiteAdmin = Omit<SiteAdmin, "passwordHash">;

export interface CustomerAdminAccess {
  canBypassBilling: boolean;
  siteAdminId?: string;
  role?: PublicSiteAdmin["role"];
  displayName?: string;
  source?: "platform_admin_session" | "site_admin_session" | "site_admin_email";
}

export type PartnerApplicationStatus = "pending" | "approved" | "rejected" | "archived";

export interface PartnerApplication {
  id: string;
  siteId: string;
  email: string;
  name: string;
  company?: string;
  website?: string;
  socialLinks?: string[];
  audience?: string;
  cadence?: string;
  campaignIdeas?: string;
  message?: string;
  status: PartnerApplicationStatus;
  source?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type PublicPartnerApplicationReceipt = Pick<PartnerApplication, "id" | "status" | "createdAt">;

export type CreditApplicationStatus = "pending" | "approved" | "rejected" | "archived";

export interface CreditApplication {
  id: string;
  siteId: string;
  customerId: string;
  email: string;
  canonicalEmail: string;
  platform: string;
  profileUrl: string;
  followerTier: string;
  evidencePosts: Array<{ url: string; urlHash: string }>;
  audience?: string;
  message?: string;
  status: CreditApplicationStatus;
  grantCredits?: number;
  riskFlags: string[];
  submitIp?: string;
  submitUa?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditApplicationReviewContext {
  customerId: string;
  accountAgeDays: number;
  signupIp?: string;
  submitIp?: string;
  sameSubnetHistoryCount: number;
  generationCount: number;
  paidOrderCount: number;
}

export interface Customer {
  id: string;
  siteId: string;
  email: string;
  passwordHash?: string;
  name: string;
  status: "active" | "past_due" | "blocked";
  balance: {
    available: number;
    reserved: number;
  };
  profile?: CustomerProfileRuntime;
}

export type PublicCustomer = Omit<Customer, "passwordHash">;

export interface CustomerProfileRuntime {
  avatarAssetId?: string;
  avatarUrl?: string;
  updatedAt?: string;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  passwordHash?: string;
  displayName: string;
  role: "super_admin" | "ops" | "support";
  createdAt: string;
}

export type PublicPlatformAdmin = Omit<PlatformAdmin, "passwordHash">;

export interface PlatformCloudflareAccount {
  id: string;
  label: string;
  email: string;
  accountId: string;
  apiToken: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PlatformEmailSettings {
  provider: "resend";
  apiKey?: string;
  fromEmail?: string;
  replyTo?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PlatformEmailConfig extends PlatformEmailSettings {
  id: string;
  label: string;
  isDefault?: boolean;
}

export interface PlatformEmailTestResult {
  state: "passed" | "failed";
  to?: string;
  messageId?: string;
  configId?: string;
  configLabel?: string;
  testedAt: string;
  testedBy?: string;
  error?: string;
  providerStatus?: number;
  providerMessage?: string;
}

export interface SiteEmailConfigAssignment {
  siteId: string;
  configId: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PlatformSession {
  id: string;
  platformAdminId: string;
  createdAt: string;
  expiresAt: string;
}

export interface SiteAdminSession {
  id: string;
  siteId: string;
  siteAdminId: string;
  createdAt: string;
  expiresAt: string;
}

export interface CustomerSession {
  id: string;
  siteId: string;
  customerId: string;
  createdAt: string;
  expiresAt: string;
}

export type PriceInterval = "month" | "quarter" | "half_year" | "year" | "one_time";

export interface Price {
  id: string;
  siteId: string;
  productId: string;
  label: string;
  amountCents: number;
  currency: string;
  interval: PriceInterval;
  creditsGranted: number;
  stripePriceId: string;
  metadata?: Record<string, string | number | boolean>;
  status: "draft" | "active" | "archived";
  effectiveFrom?: string;
  effectiveTo?: string;
  replacesPriceId?: string;
  providerVerifiedAt?: string;
  providerFingerprint?: string;
}

export interface ProductMetadata {
  summary?: string;
  features?: string[];
  sidePanelItems?: Array<string | [string, string]>;
  capabilities?: Record<string, boolean | string | number>;
  badgeLabel?: string;
  buttonLabel?: string;
  sortOrder?: number;
}

export interface Product {
  id: string;
  siteId: string;
  name: string;
  type: "subscription" | "credit_pack";
  status: "active" | "draft";
  metadata?: ProductMetadata;
  prices: Price[];
}

export interface Subscription {
  id: string;
  siteId: string;
  customerId: string;
  productId: string;
  priceId: string;
  stripeSubscriptionId: string;
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodEnd: string;
  creditsPerCycle: number;
  createdAt: string;
}

export interface AiApp {
  id: string;
  slug: string;
  name: string;
  description: string;
  appType: "image" | "copy" | "avatar" | "video";
  parameterSchema: Array<{ id: string; label: string; type: "text" | "select"; options?: string[] }>;
}

export type AiWorkflowField =
  | { id: string; label: string; type: "text" | "textarea"; required?: boolean; placeholder?: string; default?: string; helpText?: string }
  | { id: string; label: string; type: "select" | "radio"; required?: boolean; options: Array<{ label: string; value: string }>; default?: string; helpText?: string }
  | { id: string; label: string; type: "number"; required?: boolean; min?: number; max?: number; step?: number; default?: number; helpText?: string }
  | { id: string; label: string; type: "boolean"; required?: boolean; default?: boolean; helpText?: string };

export interface AiWorkflowStep {
  id: string;
  title: string;
  description?: string;
  kind: "asset_select" | "fields" | "review";
  fields?: AiWorkflowField[];
  assetRules?: {
    min?: number;
    max?: number;
    roles?: string[];
    accept?: string[];
    required?: boolean;
    /** 按素材类型的独立数量上限；键为 MIME 通配，如 "video/*"、"audio/*"。 */
    typeLimits?: Record<string, { min?: number; max?: number }>;
  };
}

export interface AiWorkflowConfig {
  version: number;
  flowName?: string;
  description?: string;
  materialRules?: string[];
  submitLabel?: string;
  promptTemplate?: string;
  negativePrompt?: string;
  steps: AiWorkflowStep[];
}

export interface AiProviderConfig {
  mode: "platform_fallback" | "preferred_provider" | "fixed_provider";
  providerId?: string;
  modelType?: string;
  fallbackEnabled?: boolean;
}

export interface SiteAiApp {
  id: string;
  siteId: string;
  aiApp: AiApp;
  enabled: boolean;
  creditCost: number;
  routeKey: string;
  workflowConfig?: AiWorkflowConfig;
  providerConfig?: AiProviderConfig;
}

export interface SiteApiKey {
  id: string;
  siteId: string;
  label: string;
  keyPreview: string;
  scopes: string[];
  enabled: boolean;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolCategory {
  id: string;
  siteId: string;
  parentId?: string;
  parent?: ToolCategory;
  slug: string;
  label: string;
  description?: string;
  icon?: string;
  iconName?: string;
  sortOrder: number;
  status: "active" | "draft" | "paused";
  createdAt: string;
  updatedAt?: string;
}

export interface ToolMenuItem {
  id: string;
  siteId: string;
  categoryId?: string;
  category?: ToolCategory;
  slug: string;
  title: string;
  description?: string;
  badge?: string;
  icon?: string;
  imageUrl?: string;
  href: string;
  detailJson?: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    guideTitle?: string;
    guideBody?: string;
    detailTitle?: string;
    detailBody?: string;
    useCases?: string[];
    workflow?: string[];
  };
  sortOrder: number;
  status: "active" | "draft" | "paused";
  createdAt: string;
  updatedAt?: string;
}

export interface AiGatewayGroup {
  id: string;
  siteId: string;
  name: string;
  status: "active" | "paused";
  modelAllowlist: string[];
  monthlyQuota: number;
  usedQuota: number;
  retryStatusCodes: number[];
  rateLimitPerMinute: number;
  accountPoolMode: "shared" | "dedicated";
  unavailableReason?: string;
}

export interface PlatformAiProvider {
  id: string;
  label: string;
  aiUrl: string;
  apiKey?: string;
  modelType: "gpt-image-2" | "gpt-5.5" | string;
  providerType: PlatformAiProviderType;
  priority: number;
  preferred: boolean;
  enabled: boolean;
  supportsGenerationN: boolean;
  supportsEditN: boolean;
  maxImagesPerRequest: number;
  /** 单次请求可携带的参考视频数量上限；0 表示不支持参考视频。 */
  maxVideoInputs?: number;
  /** 单次请求可携带的参考音频数量上限；0 表示不支持参考音频。 */
  maxAudioInputs?: number;
  imageAspectRatio: ImageProviderAspectRatio;
  imageResolution: ImageProviderResolution;
  imageQuality: ImageProviderQuality;
  imageOutputFormat: ImageProviderOutputFormat;
  apiProtocol?: "auto" | "lk888-media" | "openai-videos" | "huitu-openapi" | "tokengo-media" | "tokengo-image" | "openai-compatible";
  videoModelFamily?: "auto" | "grok" | "gemini";
  videoDurations?: number[];
  videoAspectRatios?: string[];
  /** 该通道支持的视频分辨率档位，例如 480p / 720p / 1080p。 */
  videoResolutions?: string[];
  videoNativeSpeech?: boolean | null;
  relayId?: string;
  upstreamModelId?: string;
  syncState?: "manual" | "synced" | "upstream_removed";
  priceEnabled?: boolean;
  priceCredits?: number;
  priceVideoDurations?: Record<string, number>;
  priceVideoResolutions?: Record<string, number>;
  priceImageQualities?: Record<string, number>;
  priceImageResolutions?: Record<string, number>;
  priceImageInput?: number;
  priceVideoInput?: number;
  priceVideoInputPerSecond?: number;
  priceAudioInput?: number;
  priceAudioInputPerSecond?: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface PlatformAiRelay {
  id: string;
  label: string;
  baseUrl: string;
  apiKey?: string;
  protocol: "newapi";
  enabled: boolean;
  lastSyncedAt?: string;
  lastSyncStatus?: "succeeded" | "failed";
  lastSyncError?: string;
  lastSyncModelCount: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface GenerationJob {
  id: string;
  siteId: string;
  customerId: string;
  aiAppId: string;
  status: JobStatus;
  creditsReserved: number;
  entryPoint?: GenerationEntryPoint;
  idempotencyKey?: string;
  requestHash?: string;
  createdAt: string;
  updatedAt: string;
  requestJson: Record<string, unknown>;
  resultJson?: Record<string, unknown>;
}

export interface Order {
  id: string;
  siteId: string;
  customerId: string;
  priceId?: string;
  status: "created" | "checkout_started" | "paid" | "fulfilled" | "expired" | "refunded";
  amountCents: number;
  currency: string;
  credits: number;
  sourceId: string;
  createdAt: string;
}

export interface CreativePack {
  id: string;
  siteId: string;
  categoryId?: string;
  name: string;
  headline: string;
  description: string;
  prompt?: string;
  category: string;
  aiAppSlug: string;
  status: "active" | "draft" | "paused";
  creditCost: number;
  outputCount: number;
  trainingRequired: boolean;
  generationCount: number;
  conversionRate: number;
  createdAt: string;
  updatedAt?: string;
  imageUrl?: string;
  galleryImages?: string[];
  galleryImageAlts?: string[];
  categoryRecord?: CreativePackCategory;
}

export interface CreativePackCategory {
  id: string;
  siteId: string;
  parentId?: string;
  parent?: CreativePackCategory;
  slug: string;
  label: string;
  description?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  icon?: string;
  iconName?: string;
  imageUrl?: string;
  sortOrder: number;
  status: "active" | "draft" | "paused";
  createdAt: string;
}

export interface VideoThemeCategory {
  id: string;
  siteId: string;
  parentId?: string;
  parent?: VideoThemeCategory;
  children?: VideoThemeCategory[];
  slug: string;
  label: string;
  description?: string;
  icon?: string;
  accentColor?: string;
  imageUrl?: string;
  sortOrder: number;
  status: "active" | "draft" | "paused";
  createdAt: string;
  updatedAt?: string;
}

export interface VideoTheme {
  id: string;
  siteId: string;
  categoryId?: string;
  category?: VideoThemeCategory;
  slug: string;
  name: string;
  headline: string;
  description: string;
  prompt: string;
  status: "active" | "draft" | "paused";
  creditCost: number;
  modelPricing?: VideoModelPricing;
  durationSeconds: number;
  maxFrames: number;
  sortOrder: number;
  effectiveMaxFrames?: number;
  providerMaxFrames?: number;
  providerModelFamilies?: VideoModelFamily[];
  textToVideoProviderModelFamilies?: VideoModelFamily[];
  imageToVideoProviderModelFamilies?: VideoModelFamily[];
  generationCount: number;
  createdAt: string;
  imageUrl?: string;
  galleryImages?: string[];
  examples?: VideoThemeExample[];
}

export interface VideoThemeExample {
  id: string;
  siteId: string;
  themeId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  galleryImages?: string[];
  prompt: string;
  status: "active" | "draft" | "paused";
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MediaAsset {
  id: string;
  siteId: string;
  label: string;
  storageKey: string;
  mimeType: string;
  usage: "theme" | "pack_cover" | "policy" | "brand";
  sourceType?: "site_upload" | "external_url" | "theme_seed" | "manual";
  previewUrl?: string;
  originUrl?: string;
  altText?: string;
  notes?: string;
  createdAt: string;
}

export interface PublishedOfferProjection {
  productId: string;
  priceId: string;
  siteId: string;
  productName: string;
  productType: "subscription" | "credit_pack";
  productMetadata?: ProductMetadata;
  priceLabel: string;
  interval: PriceInterval;
  amountCents: number;
  currency: string;
  creditsGranted: number;
  stripePriceId: string;
  priceMetadata?: Price["metadata"];
  checkoutEnabled: boolean;
  revision: string;
}

export interface PublishedFactsProjection {
  identity?: StorefrontProfileJson["identity"];
  creditLifecycle?: { reserve?: string; consume?: string; release?: string };
  privacy?: { customerMediaTraining?: boolean; sourceMediaRetentionDays?: number };
  refund?: { reviewRequired?: boolean; windowDays?: number; effectiveDate?: string };
  security?: { checkoutProvider?: string; transportClaimKey?: string; storageClaimKey?: string };
  claimRevision: string;
}

export interface PublishedPageEntityContent {
  h1: string;
  heroIntro: string;
  metaLabel: string;
  tags: string[];
  detailTags: string[];
  detailIntro: string;
  whatCreates: string;
  bestFor: string[];
  workflow: string[];
  styleNotes: string[];
  reviewCriteria: string[];
  coverNote: string;
  safetyNote?: string;
  galleryTitle: string;
  galleryIntro: string;
  ctaEyebrow: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaLinkEntityId: string;
  faqEyebrow: string;
  faqTitle: string;
  faqItems: Array<{ id: string; question: string; answer: string }>;
  relatedEyebrow: string;
  relatedTitle: string;
  relatedSubtitle: string;
  relatedCtaLabel: string;
  relatedLinkEntityIds: string[];
}

export interface PublishedPageEntityProjection {
  pageEntityId: string;
  canonicalPath: string;
  pageType: string;
  status: "published" | "review_required";
  indexable: boolean;
  sitemapEligible: boolean;
  metadata: {
    title: string;
    description: string;
    keywords?: string;
    canonicalPath: string;
    robots: { index: boolean; follow: boolean; maxImagePreview?: "none" | "standard" | "large" };
  };
  content: PublishedPageEntityContent;
  mediaEntityId: string;
  pageRevision: string;
  copyRevision: string;
  reviewReasons: string[];
}

export interface PublishedPageCopyProjection {
  pageEntityId: string;
  copyRevision: string;
  canonicalSlug: string;
  sourceHash: string;
}

export interface PublishedPageMediaProjection {
  mediaEntityId: string;
  ownerPageEntityId: string;
  sourcePackId: string;
  role: "hero";
  /**
   * Older image-theme publications predate this field. New video-topic
   * publications set it explicitly so media ownership is independently
   * verifiable from the route projection.
   */
  routeKind?: "ai-image-theme-leaf" | "ai-video-topic-leaf";
  pageEntityId: string;
  entityRevision: string;
  packId: string;
  primaryImage: string;
  galleryImages: string[];
  imageAlts: string[];
  status: "ready" | "review_required";
  reviewReason?: string;
}

export interface PublishedStandardPageMediaProjection {
  pageEntityId: string;
  pageId: string;
  canonicalPath: string;
  mediaEntityId: string;
  primaryImage: string;
  primaryImageAlt: string;
  ogImage: string;
  twitterImage: string;
  jsonLdImage: string;
  sitemapImages: string[];
  status: "ready" | "review_required";
  revision: string;
  reviewReason?: string;
}

export interface PublishedLeafRouteProjection {
  disposition: "render";
  siteId: "site_dreamshoot" | "site_grownstride_test" | "site_aidreamcapes";
  routeKind: "ai-image-theme-leaf";
  canonicalSlug: string;
  canonicalPath: string;
  pageEntityId: string;
  pageRevision: string;
  copyRevision: string;
  copySource: "page-copy" | "missing";
  fallbackUsed: false;
  deferred: boolean;
  status: "published" | "review_required";
  indexable: boolean;
  sitemapEligible: boolean;
  expectedPackId: string;
  mediaEntityId: string;
  reviewReason?: string;
}

export interface PublishedVideoTopicRouteProjection {
  disposition: "render";
  siteId: "site_dreamshoot" | "site_grownstride_test" | "site_aidreamcapes" | "site_aidreamcapes_xby" | "site_mydreamshoots_xby";
  routeKind: "ai-video-topic-leaf";
  canonicalSlug: string;
  canonicalPath: string;
  pageId: string;
  pageEntityId: string;
  pageRevision: string;
  copyRevision: string;
  copySource: "theme-page";
  fallbackUsed: false;
  deferred: false;
  status: "published" | "review_required";
  indexable: boolean;
  sitemapEligible: boolean;
  mediaEntityId: string;
  reviewReason?: string;
}

export interface PublishedPolicyRouteProjection {
  disposition: "render";
  siteId: "site_dreamshoot" | "site_grownstride_test" | "site_aidreamcapes";
  routeKind: "policy";
  canonicalPath: string;
  pageEntityId: string;
  pageId: string;
  pageRevision: string;
  status: "published";
  indexable: true;
  sitemapEligible: true;
}

export interface PublishedStandardRouteProjection {
  disposition: "render";
  siteId: "site_dreamshoot" | "site_grownstride_test" | "site_aidreamcapes";
  routeKind: "standard-content";
  canonicalPath: string;
  pageEntityId: string;
  pageId: string;
  pageRevision: string;
  status: "published" | "review_required";
  indexable: boolean;
  sitemapEligible: boolean;
  mediaEntityId: string;
  reviewReason?: string;
}

export interface PublishedRedirectRouteProjection {
  disposition: "redirect";
  siteId: "site_dreamshoot" | "site_grownstride_test" | "site_aidreamcapes";
  routeKind: "policy-alias" | "legacy-public-alias";
  aliasPath: string;
  targetPath: string;
  statusCode: 301;
  indexable: false;
  sitemapEligible: false;
  routeRevision: string;
}

export type PublishedRouteProjection =
  | PublishedLeafRouteProjection
  | PublishedVideoTopicRouteProjection
  | PublishedPolicyRouteProjection
  | PublishedStandardRouteProjection
  | PublishedRedirectRouteProjection;

export interface PublishedVideoNavigationProjection {
  id: string;
  pageEntityId: string;
  canonicalPath: string;
  slug: string;
  label: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  parentSlug: string;
  parentLabel: string;
  parentSortOrder: number;
  sortOrder: number;
  revision: string;
}

export type PublishedHomepageShowcaseKind = "video" | "save_the_date" | "photo";

export interface PublishedHomepageShowcaseItem {
  id: string;
  kind: PublishedHomepageShowcaseKind;
  pageEntityId: string;
  canonicalPath: string;
  title: string;
  subtitle: string;
  category?: string;
  sortOrder: number;
  imageUrl: string;
  imageAlt: string;
  videoUrl?: string;
  status: "published";
  indexable: true;
  sitemapEligible: true;
  entityRevision: string;
  mediaRevision: string;
}

export interface PublishedCollectionRef {
  ownerPageEntityId: string;
  collectionEntityId: string;
  collectionSlug: string;
  sourcePackId: string;
  pageEntityId: string;
  canonicalPath: string;
  label: string;
  summary: string;
  image: string;
  imageAlt: string;
  imageMediaEntityId: string;
  mediaEntityId: string;
  categorySlug?: string;
  creditCost: number;
  outputCount: number;
  revision: string;
  entityRevision: string;
  status: "published" | "review_required";
}

export type PublishedLinkRef = {
  linkEntityId: string;
  ownerPageEntityId: string;
  kind: "cta" | "related";
  label: string;
  href: string;
  revision: string;
} & (
  | { targetType: "published_render"; targetPageEntityId: string }
  | { targetType: "private_action"; targetPageEntityId?: never }
);

export interface PublishedSeoSnapshotRevisions {
  factsRevision: string;
  routeRevision: string;
  pageRevision: string;
  copyRevision: string;
  mediaRevision: string;
  packRevision: string;
  offerRevision: string;
  collectionRevision: string;
  policyRevision: string;
  linkRevision: string;
  navigationRevision: string;
  homepageShowcaseRevision?: string;
  snapshotHash: string;
}

export type PublishedPackFactProjection = {
  packId: string;
  creditCost: number;
  outputCount: number;
  revision: string;
};

export type PublishedSeoSnapshotPage = {
  id: string;
  siteId?: string;
  pageType?: string;
  templateKey?: string;
  slug: string;
  title?: string;
  publishedJson: ThemePageJson;
  createdAt?: string;
  updatedAt?: string;
};

export interface PublishedSeoSnapshot {
  pages: PublishedSeoSnapshotPage[];
  themeSettings: ThemeSettings;
  storefrontProfile?: StorefrontProfileJson;
  saasTheme?: unknown;
  seoProjectionVersion: 1;
  publishedRoutes: PublishedRouteProjection[];
  publishedPageEntities: PublishedPageEntityProjection[];
  publishedPageCopy: PublishedPageCopyProjection[];
  publishedPageMedia: PublishedPageMediaProjection[];
  publishedStandardPageMedia: PublishedStandardPageMediaProjection[];
  publishedPackFacts: PublishedPackFactProjection[];
  publishedOffers: PublishedOfferProjection[];
  publishedFacts: PublishedFactsProjection;
  publishedCollectionRefs: PublishedCollectionRef[];
  publishedLinkRefs: PublishedLinkRef[];
  publishedVideoNavigation: PublishedVideoNavigationProjection[];
  publishedHomepageShowcases: PublishedHomepageShowcaseItem[];
  revisions: PublishedSeoSnapshotRevisions;
  snapshotHash: string;
  buildId: string;
}

export interface LegacyThemePublicationSnapshot {
  pages: PublishedSeoSnapshotPage[];
  themeSettings: ThemeSettings;
  storefrontProfile?: StorefrontProfileJson;
  saasTheme?: unknown;
  seoProjectionVersion?: undefined;
  publishedRoutes?: PublishedRouteProjection[];
  publishedPageEntities?: PublishedPageEntityProjection[];
  publishedPageCopy?: PublishedPageCopyProjection[];
  publishedPageMedia?: PublishedPageMediaProjection[];
  publishedStandardPageMedia?: PublishedStandardPageMediaProjection[];
  publishedPackFacts?: PublishedPackFactProjection[];
  publishedOffers?: PublishedOfferProjection[];
  publishedFacts?: PublishedFactsProjection;
  publishedCollectionRefs?: PublishedCollectionRef[];
  publishedLinkRefs?: PublishedLinkRef[];
  publishedVideoNavigation?: PublishedVideoNavigationProjection[];
  publishedHomepageShowcases?: PublishedHomepageShowcaseItem[];
  revisions?: Partial<PublishedSeoSnapshotRevisions>;
  snapshotHash?: string;
  buildId?: string;
}

export type ThemePublicationSnapshot = PublishedSeoSnapshot | LegacyThemePublicationSnapshot;

export interface ThemePublication {
  id: string;
  siteId: string;
  version: number;
  snapshot: ThemePublicationSnapshot;
  pageCount?: number;
  sectionCount?: number;
  snapshotBytes?: number;
  scope?: {
    type: "page" | "site";
    pageIds: string[];
    includeThemeSettings: boolean;
    includeStorefrontProfile: boolean;
  };
  manifestHash?: string;
  factsRevision?: string;
  publishedBy: string;
  publishedAt: string;
}

/**
 * The only public runtime projection allowed after current-state migration.
 * The payload is complete for the site; it is not an append-only snapshot.
 */
export interface SitePublishedState {
  siteId: string;
  payload: PublishedSeoSnapshot;
  contentHash: string;
  revision: string;
  publishedAt: string;
  publishedBy: string;
}

export interface VerifiedBackupReceipt {
  target: string;
  databaseIdentity: string;
  backupPath: string;
  byteSize: number;
  sha256: string;
  createdAt: string;
  archiveListVerifiedAt: string;
  isolatedRestoreVerifiedAt: string;
  criticalReadbackHash: string;
}

export interface SiteTheme {
  id: string;
  siteId: string;
  name: string;
  themeId: string;
  themeKey: string;
  status: "draft" | "active";
  templates: unknown;
  settings: unknown;
  source: "site" | "saas-theme" | "saas-theme1" | "copy" | "imported";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeCopy {
  id: string;
  siteId: string;
  name: string;
  themeKey: string;
  source: "draft" | "active" | "imported";
  templates: unknown;
  settings: unknown;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerModel {
  id: string;
  siteId: string;
  customerId: string;
  label: string;
  modelType: "solo" | "couple" | "brand";
  status: "collecting_uploads" | "training" | "ready" | "failed" | "archived";
  inputAssetCount: number;
  minInputAssets: number;
  providerModelId?: string;
  trainingJobId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Album {
  id: string;
  siteId: string;
  customerId: string;
  title: string;
  sourceJobId?: string;
  creativePackId?: string;
  status: "processing" | "ready" | "hidden";
  outputCount: number;
  coverAssetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  siteId?: string;
  actorType: "platform_admin" | "site_admin" | "customer" | "system" | "worker";
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PaymentEvent {
  id: string;
  siteId: string;
  provider: "stripe";
  providerEventId: string;
  eventType: string;
  processedAt: string;
  payload: Record<string, unknown>;
}

export interface AssetUpload {
  id: string;
  siteId: string;
  customerId: string;
  customerModelId?: string;
  subjectRole?: "primary" | "partner" | "product" | "reference" | string;
  jobId?: string;
  label: string;
  storageKey: string;
  mimeType: string;
  role: "input" | "output" | "training_input";
  visibility: "private";
  reviewStatus: "pending" | "approved" | "rejected";
  validationStatus?: "pending" | "passed" | "failed";
  validationReport?: Record<string, string | number | boolean>;
  isFavorite?: boolean;
  favoriteAt?: string;
  createdAt: string;
  deletedAt?: string;
}

export interface CreditLedgerEntry {
  id: string;
  siteId: string;
  customerId: string;
  amount: number;
  type: LedgerType;
  sourceType: string;
  sourceId: string;
  createdAt: string;
}

export interface ThemeRuntimeJob {
  id: string;
  aiAppId: string;
  status: JobStatus;
  creditsReserved: number;
  createdAt: string;
  updatedAt: string;
  requestJson?: Record<string, unknown>;
  resultJson?: Record<string, unknown>;
}

export interface ThemeRuntimeAsset {
  id: string;
  jobId?: string;
  subjectRole?: string;
  altText?: string;
  label: string;
  storageKey?: string;
  previewUrl: string;
  previewStatus?: "ready" | "loading";
  downloadUrl?: string;
  mimeType: string;
  role: AssetUpload["role"];
  reviewStatus: AssetUpload["reviewStatus"];
  isFavorite?: boolean;
  favoriteAt?: string;
  createdAt: string;
}

export interface ThemeRuntimeAlbum {
  id: string;
  title: string;
  sourceJobId?: string;
  creativePackId?: string;
  status: Album["status"];
  outputCount: number;
  coverAssetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeRuntimeLedgerEntry {
  id: string;
  amount: number;
  type: LedgerType;
  sourceType?: string;
  sourceId?: string;
  sourceLabel?: string;
  createdAt: string;
}

export interface ThemeRuntimeCustomerModel {
  id: string;
  label: string;
  modelType: CustomerModel["modelType"];
  status: CustomerModel["status"];
  inputAssetCount: number;
  minInputAssets: number;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeRuntimeSubscription {
  id: string;
  productId: string;
  priceId: string;
  productName?: string;
  priceLabel?: string;
  interval?: Price["interval"];
  amountCents?: number;
  currency?: string;
  status: Subscription["status"];
  currentPeriodStart?: string;
  currentPeriodEnd: string;
  creditsPerCycle: number;
  createdAt: string;
}

export interface ThemeRuntimeOrder {
  id: string;
  status: Order["status"];
  amountCents: number;
  currency: string;
  credits: number;
  sourceId: string;
  createdAt: string;
}

export interface ThemeRuntimeDownloadEntry {
  id: string;
  assetId: string;
  jobId?: string;
  albumId?: string;
  source: string;
  label: string;
  previewUrl?: string;
  previewStatus?: ThemeRuntimeAsset["previewStatus"];
  downloadUrl?: string;
  fileAvailable?: boolean;
  mimeType?: string;
  createdAt: string;
}

export interface ThemeRuntimePagination {
  list: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  firstItem: number;
  lastItem: number;
}

export interface ThemeRuntimeData {
  customer?: PublicCustomer;
  adminAccess?: CustomerAdminAccess;
  profile?: CustomerProfileRuntime;
  jobs: ThemeRuntimeJob[];
  assets: ThemeRuntimeAsset[];
  albums: ThemeRuntimeAlbum[];
  ledger: ThemeRuntimeLedgerEntry[];
  subscriptions?: ThemeRuntimeSubscription[];
  orders?: ThemeRuntimeOrder[];
  downloads?: ThemeRuntimeDownloadEntry[];
  jobDetail?: {
    job: ThemeRuntimeJob;
    ledger: ThemeRuntimeLedgerEntry[];
    assets: ThemeRuntimeAsset[];
  };
  customerModels?: ThemeRuntimeCustomerModel[];
  auth?: {
    defaultEmail?: string;
    defaultPassword?: string;
    defaultName?: string;
    initialMessage?: string;
  };
  pagination?: ThemeRuntimePagination;
  isPreview?: boolean;
  clientBootstrapCustomer?: boolean;
}

export interface PlatformState {
  platformAdmins: PlatformAdmin[];
  platformSessions: PlatformSession[];
  platformEmailSettings?: PlatformEmailSettings;
  platformEmailConfigs?: PlatformEmailConfig[];
  siteEmailConfigAssignments?: SiteEmailConfigAssignment[];
  platformCloudflareAccounts?: PlatformCloudflareAccount[];
  currentCloudflareAccountId?: string;
  sites: Site[];
  siteDomains: SiteDomain[];
  siteAdmins: SiteAdmin[];
  siteAdminSessions: SiteAdminSession[];
  customers: Customer[];
  customerSessions: CustomerSession[];
  products: Product[];
  subscriptions: Subscription[];
  orders: Order[];
  paymentEvents: PaymentEvent[];
  aiApps: AiApp[];
  siteAiApps: SiteAiApp[];
  aiGatewayGroups: AiGatewayGroup[];
  creativePackCategories?: CreativePackCategory[];
  toolCategories: ToolCategory[];
  toolMenuItems: ToolMenuItem[];
  creativePacks: CreativePack[];
  videoThemeCategories?: VideoThemeCategory[];
  videoThemes?: VideoTheme[];
  mediaAssets: MediaAsset[];
  themePublications: ThemePublication[];
  siteThemes: SiteTheme[];
  themeCopies: ThemeCopy[];
  customerModels: CustomerModel[];
  albums: Album[];
  auditLogs: AuditLogEntry[];
  jobs: GenerationJob[];
  assetUploads: AssetUpload[];
  ledger: CreditLedgerEntry[];
  platformAiProviders?: PlatformAiProvider[];
  currentAiProviderId?: string;
}
