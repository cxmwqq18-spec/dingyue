export type SiteStatus = "active" | "draft" | "suspended";
export type ConnectStatus = "not_started" | "pending" | "enabled" | "restricted";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "refunded";
export type LedgerType = "grant" | "reserve" | "consume" | "release" | "adjustment";

export type SectionType =
  | "hero"
  | "story_mosaic"
  | "video_feature"
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
  | "rich_text"
  | "media_banner"
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

export interface ThemePageJson {
  pageType: string;
  version: number;
  sectionsOrder: string[];
  sections: Record<string, SectionInstance>;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string;
    ogImage?: string;
    canonical?: string;
    canonicalPath?: string;
    robots?: {
      index?: boolean;
      follow?: boolean;
    };
    index?: boolean;
    follow?: boolean;
  };
}

export interface ThemeDraftMeta {
  revision: number;
  updatedAt: string;
  etag: string;
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
    pages: Record<
      string,
      {
        title: string;
        description: string;
        keywords?: string;
        ogImage?: string;
        canonicalPath?: string;
        index?: boolean;
        follow?: boolean;
      }
    >;
  };
  saasSettingsCurrent?: Record<string, ThemeSettingValue>;
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
  };
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
}

export type PublicCustomer = Omit<Customer, "passwordHash">;

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

export interface Price {
  id: string;
  siteId: string;
  productId: string;
  label: string;
  amountCents: number;
  currency: string;
  interval: "month" | "year" | "one_time";
  creditsGranted: number;
  stripePriceId: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface Product {
  id: string;
  siteId: string;
  name: string;
  type: "subscription" | "credit_pack";
  status: "active" | "draft";
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
  priority: number;
  preferred: boolean;
  supportsGenerationN: boolean;
  supportsEditN: boolean;
  maxImagesPerRequest: number;
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
  createdAt: string;
  updatedAt: string;
  requestJson: Record<string, unknown>;
  resultJson?: Record<string, unknown>;
}

export interface Order {
  id: string;
  siteId: string;
  customerId: string;
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
  slug: string;
  label: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  status: "active" | "draft" | "paused";
  createdAt: string;
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
  durationSeconds: number;
  maxFrames: number;
  effectiveMaxFrames?: number;
  providerMaxFrames?: number;
  generationCount: number;
  createdAt: string;
  imageUrl?: string;
  galleryImages?: string[];
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

export interface ThemePublication {
  id: string;
  siteId: string;
  version: number;
  snapshot: {
    pages: Array<{ id: string; slug: string; publishedJson: ThemePageJson }>;
    themeSettings: ThemeSettings;
    saasTheme?: unknown;
  };
  pageCount?: number;
  sectionCount?: number;
  snapshotBytes?: number;
  publishedBy: string;
  publishedAt: string;
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
  status: Subscription["status"];
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

export interface ThemeRuntimeData {
  customer?: PublicCustomer;
  adminAccess?: CustomerAdminAccess;
  jobs: ThemeRuntimeJob[];
  assets: ThemeRuntimeAsset[];
  albums: ThemeRuntimeAlbum[];
  ledger: ThemeRuntimeLedgerEntry[];
  subscriptions?: ThemeRuntimeSubscription[];
  orders?: ThemeRuntimeOrder[];
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
