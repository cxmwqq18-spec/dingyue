import crypto from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  AiApp,
  Album,
  AssetUpload,
  CreditLedgerEntry,
  CreativePack,
  CreativePackCategory,
  Customer,
  CustomerModel,
  CustomerSession,
  GenerationJob,
  LedgerType,
  PaymentEvent,
  PartnerApplication,
  Price,
  Product,
  PublicCustomer,
  PublicPlatformAdmin,
  PublicSiteAdmin,
  SiteAiApp,
  ToolCategory,
  ToolMenuItem,
  VideoTheme,
  VideoThemeCategory
} from "@/lib/types";
import { StoreError } from "@/lib/server-store";

type ProductWithPrices = Prisma.ProductGetPayload<{ include: { prices: true } }>;
type CustomerWithBalance = Prisma.CustomerGetPayload<{ include: { balance: true } }>;
type SiteAiAppWithAiApp = Prisma.SiteAiAppGetPayload<{ include: { aiApp: true } }>;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function jsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function primitiveRecord(value: Prisma.JsonValue | null | undefined): Record<string, string | number | boolean> | undefined {
  const record = jsonRecord(value);
  if (!record) return undefined;
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string | number | boolean] =>
      typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean"
    )
  );
}

function jsonObject<T>(value: Prisma.JsonValue | null | undefined): T | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return cloneJson(value) as T;
}

function jsonArray<T>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function mapPrice(row: Prisma.PriceGetPayload<object>, fallback?: Partial<Price>): Price {
  const record = row as Prisma.PriceGetPayload<object> & { label?: string; metadata?: Prisma.JsonValue | null };
  return {
    id: row.id,
    siteId: row.siteId,
    productId: row.productId,
    label: fallback?.label ?? record.label ?? row.id,
    amountCents: row.amountCents,
    currency: row.currency,
    interval: row.interval === "year" ? "year" : row.interval === "one_time" ? "one_time" : "month",
    creditsGranted: row.creditsGranted,
    stripePriceId: row.stripePriceId ?? fallback?.stripePriceId ?? `manual_${row.id}`,
    metadata: fallback?.metadata ?? (jsonRecord(record.metadata) as Price["metadata"] | undefined)
  };
}

export function mapProduct(row: ProductWithPrices): Product {
  return {
    id: row.id,
    siteId: row.siteId,
    name: row.name,
    type: row.type === "credit_pack" ? "credit_pack" : "subscription",
    status: row.status === "draft" ? "draft" : "active",
    prices: row.prices.map((price) => mapPrice(price))
  };
}

export function mapCustomer(row: CustomerWithBalance): Customer {
  return {
    id: row.id,
    siteId: row.siteId,
    email: row.email,
    name: row.name,
    status: row.status === "past_due" || row.status === "blocked" ? row.status : "active",
    balance: {
      available: row.balance?.balance ?? 0,
      reserved: row.balance?.reserved ?? 0
    }
  };
}

export function mapCreditLedger(row: Prisma.CreditLedgerGetPayload<object>): CreditLedgerEntry {
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    amount: row.amount,
    type: row.type as LedgerType,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    createdAt: iso(row.createdAt)
  };
}

export function mapPaymentEvent(row: Prisma.PaymentEventGetPayload<object>): PaymentEvent {
  return {
    id: row.id,
    siteId: row.siteId,
    provider: row.provider === "stripe" ? "stripe" : "stripe",
    providerEventId: row.providerEventId,
    eventType: row.eventType,
    processedAt: toIsoString(row.processedAt) ?? new Date().toISOString(),
    payload: cloneJson(row.payload) as Record<string, unknown>
  };
}

export function mapAiApp(row: Prisma.AiAppGetPayload<object>): AiApp {
  const appType = row.appType === "copy" || row.appType === "avatar" || row.appType === "video" ? row.appType : "image";
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    appType,
    parameterSchema: jsonArray(row.parameterSchema)
  };
}

export function mapSiteAiApp(row: SiteAiAppWithAiApp): SiteAiApp {
  const record = row as SiteAiAppWithAiApp & {
    providerConfig?: Prisma.JsonValue | null;
    workflowConfig?: Prisma.JsonValue | null;
  };
  return {
    id: row.id,
    siteId: row.siteId,
    aiApp: mapAiApp(row.aiApp),
    enabled: row.enabled,
    creditCost: row.creditCost,
    routeKey: row.routeKey,
    workflowConfig: jsonObject<SiteAiApp["workflowConfig"]>(record.workflowConfig),
    providerConfig: jsonObject<SiteAiApp["providerConfig"]>(record.providerConfig)
  };
}

export function mapGenerationJob(row: Prisma.GenerationJobGetPayload<object>): GenerationJob {
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    aiAppId: row.aiAppId,
    status: row.status as GenerationJob["status"],
    creditsReserved: row.creditsReserved,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    requestJson: jsonRecord(row.requestJson) ?? {},
    resultJson: jsonRecord(row.resultJson)
  };
}

export function mapAlbum(row: Prisma.AlbumGetPayload<object>): Album {
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    title: row.title,
    sourceJobId: row.sourceJobId ?? undefined,
    creativePackId: row.creativePackId ?? undefined,
    status: row.status === "hidden" || row.status === "processing" ? row.status : "ready",
    outputCount: row.outputCount,
    coverAssetId: row.coverAssetId ?? undefined,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

export function mapAssetUpload(row: Prisma.AssetUploadGetPayload<object>): AssetUpload {
  const validationReport = primitiveRecord(row.validationReport);
  const favoriteAt = typeof validationReport?.favoriteAt === "string" ? validationReport.favoriteAt : undefined;
  const isFavorite = validationReport?.isFavorite === true || Boolean(favoriteAt);
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    customerModelId: row.customerModelId ?? undefined,
    subjectRole: row.subjectRole ?? undefined,
    jobId: row.jobId ?? undefined,
    label: row.label,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    role: row.role as AssetUpload["role"],
    visibility: "private",
    reviewStatus: row.reviewStatus === "pending" || row.reviewStatus === "rejected" ? row.reviewStatus : "approved",
    validationStatus: row.validationStatus as AssetUpload["validationStatus"],
    validationReport,
    isFavorite,
    favoriteAt,
    deletedAt: row.deletedAt ? iso(row.deletedAt) : undefined,
    createdAt: iso(row.createdAt)
  };
}

export const relationalSessionTtlMs = 1000 * 60 * 60 * 24 * 30;

export function relationalUid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function hashRelationalPassword(password: string): string {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

export function verifyRelationalPassword(password: string, passwordHash?: string | null): boolean {
  return Boolean(passwordHash) && hashRelationalPassword(password) === passwordHash;
}

export function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

export function toPublicCustomerRelational(customer: Record<string, unknown>): PublicCustomer {
  return {
    id: String(customer.id),
    siteId: String(customer.siteId),
    email: String(customer.email),
    name: String(customer.name),
    status: customer.status as Customer["status"],
    balance: {
      available: numberFromUnknown((customer.balance as { balance?: unknown } | null | undefined)?.balance, 0),
      reserved: numberFromUnknown((customer.balance as { reserved?: unknown } | null | undefined)?.reserved, 0)
    }
  };
}

export function toPublicPlatformAdminRelational(admin: Record<string, unknown>): PublicPlatformAdmin {
  return {
    id: String(admin.id),
    email: String(admin.email),
    displayName: String(admin.displayName),
    role: admin.role as PublicPlatformAdmin["role"],
    createdAt: toIsoString(admin.createdAt as Date | string | undefined) ?? new Date(0).toISOString()
  };
}

export function toPlatformSessionRelational(session: Record<string, unknown>) {
  const createdAt = toIsoString(session.createdAt as Date | string | undefined) ?? new Date().toISOString();
  const expiresAt = toIsoString(session.expiresAt as Date | string | undefined) ?? createdAt;
  return {
    id: String(session.id),
    platformAdminId: String(session.platformAdminId),
    createdAt,
    expiresAt
  };
}

export function toPublicSiteAdminRelational(admin: Record<string, unknown>): PublicSiteAdmin {
  return {
    id: String(admin.id),
    siteId: String(admin.siteId),
    email: String(admin.email),
    displayName: String(admin.displayName),
    role: admin.role as PublicSiteAdmin["role"],
    createdAt: toIsoString(admin.createdAt as Date | string | undefined) ?? new Date(0).toISOString()
  };
}

export function toSiteAdminSessionRelational(session: Record<string, unknown>) {
  const createdAt = toIsoString(session.createdAt as Date | string | undefined) ?? new Date().toISOString();
  const expiresAt = toIsoString(session.expiresAt as Date | string | undefined) ?? createdAt;
  return {
    id: String(session.id),
    siteId: String(session.siteId),
    siteAdminId: String(session.siteAdminId),
    createdAt,
    expiresAt
  };
}

export function toCustomerSessionRelational(session: Record<string, unknown>): CustomerSession {
  const createdAt = toIsoString(session.createdAt as Date | string | undefined) ?? new Date().toISOString();
  const expiresAt = toIsoString(session.expiresAt as Date | string | undefined) ?? createdAt;
  return {
    id: String(session.id),
    siteId: String(session.siteId),
    customerId: String(session.customerId),
    createdAt,
    expiresAt
  };
}

export function toAssetUploadRelational(asset: Record<string, unknown>): AssetUpload {
  const createdAt = toIsoString(asset.createdAt as Date | string | undefined) ?? new Date(0).toISOString();
  const deletedAt = toIsoString(asset.deletedAt as Date | string | undefined);
  const validationReport = objectRecord(asset.validationReport);
  const favoriteAt = typeof validationReport?.favoriteAt === "string" ? validationReport.favoriteAt : undefined;
  const isFavorite = validationReport?.isFavorite === true || Boolean(favoriteAt);
  return {
    id: String(asset.id),
    siteId: String(asset.siteId),
    customerId: String(asset.customerId),
    customerModelId: optionalString(asset.customerModelId),
    subjectRole: optionalString(asset.subjectRole),
    jobId: optionalString(asset.jobId),
    label: optionalString(asset.label) ?? String(asset.id),
    storageKey: String(asset.storageKey),
    mimeType: optionalString(asset.mimeType) ?? "application/octet-stream",
    role: (optionalString(asset.role) ?? "input") as AssetUpload["role"],
    visibility: (optionalString(asset.visibility) ?? "private") as AssetUpload["visibility"],
    reviewStatus: (optionalString(asset.reviewStatus) ?? "approved") as AssetUpload["reviewStatus"],
    validationStatus: optionalString(asset.validationStatus) as AssetUpload["validationStatus"],
    validationReport,
    isFavorite,
    favoriteAt,
    createdAt,
    deletedAt
  };
}

export function toPartnerApplicationRelational(application: Record<string, unknown>): PartnerApplication {
  const socialLinks = Array.isArray(application.socialLinks)
    ? application.socialLinks.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const status = optionalString(application.status);
  return {
    id: String(application.id),
    siteId: String(application.siteId),
    email: String(application.email),
    name: String(application.name),
    company: optionalString(application.company),
    website: optionalString(application.website),
    socialLinks,
    audience: optionalString(application.audience),
    cadence: optionalString(application.cadence),
    campaignIdeas: optionalString(application.campaignIdeas),
    message: optionalString(application.message),
    status: (status === "approved" || status === "rejected" || status === "archived" ? status : "pending") as PartnerApplication["status"],
    source: optionalString(application.source),
    reviewedBy: optionalString(application.reviewedBy),
    reviewedAt: toIsoString(application.reviewedAt as Date | string | undefined),
    reviewNote: optionalString(application.reviewNote),
    metadata: objectRecord(application.metadata),
    createdAt: toIsoString(application.createdAt as Date | string | undefined) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(application.updatedAt as Date | string | undefined) ?? new Date(0).toISOString()
  };
}

export function toCustomerModelRelational(model: Record<string, unknown>): CustomerModel {
  return {
    id: String(model.id),
    siteId: String(model.siteId),
    customerId: String(model.customerId),
    label: String(model.label),
    modelType: model.modelType as CustomerModel["modelType"],
    status: model.status as CustomerModel["status"],
    inputAssetCount: numberFromUnknown(model.inputAssetCount, 0),
    minInputAssets: numberFromUnknown(model.minInputAssets, 0),
    providerModelId: optionalString(model.providerModelId),
    trainingJobId: optionalString(model.trainingJobId),
    failureReason: optionalString(model.failureReason),
    createdAt: toIsoString(model.createdAt as Date | string | undefined) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(model.updatedAt as Date | string | undefined) ?? new Date(0).toISOString()
  };
}

export function toAlbumRelational(album: Record<string, unknown>): Album {
  return {
    id: String(album.id),
    siteId: String(album.siteId),
    customerId: String(album.customerId),
    title: String(album.title),
    sourceJobId: optionalString(album.sourceJobId),
    creativePackId: optionalString(album.creativePackId),
    status: album.status as Album["status"],
    outputCount: numberFromUnknown(album.outputCount, 0),
    coverAssetId: optionalString(album.coverAssetId),
    createdAt: toIsoString(album.createdAt as Date | string | undefined) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(album.updatedAt as Date | string | undefined) ?? new Date(0).toISOString()
  };
}

export async function getModelFields(client: PrismaClient, modelName: string): Promise<Set<string>> {
  const dmmf = (client as unknown as { _runtimeDataModel: { models: Record<string, { fields: Array<{ name: string }> }> } })
    ._runtimeDataModel;
  const model = dmmf.models[modelName];
  return new Set(model?.fields.map((field) => field.name) ?? []);
}

export async function requireModelFields(client: PrismaClient, modelName: string, fields: string[]): Promise<void> {
  const available = await getModelFields(client, modelName);
  const missing = fields.filter((field) => !available.has(field));
  if (missing.length) {
    throw new StoreError(`relational_schema_missing_${modelName}_${missing.join("_")}`, 500);
  }
}

export async function requireDelegate(client: PrismaClient, delegateName: string): Promise<void> {
  if (!(delegateName in client)) {
    throw new StoreError(`relational_schema_missing_${delegateName}`, 500);
  }
}

export function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export function prismaJsonObject(value: Record<string, unknown> | undefined): Prisma.InputJsonObject | undefined {
  return value ? (value as Prisma.InputJsonObject) : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberFromUnknown(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function objectRecord(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).filter((entry): entry is [string, string | number | boolean] => {
    return ["string", "number", "boolean"].includes(typeof entry[1]);
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const PLATFORM_DOCUMENT_ID = "platform";

export const RelationalStoreError = StoreError;

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const uid = relationalUid;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function makeThemeDraftMeta(page: Pick<import("@/lib/types").ThemePage, "draftJson" | "draftMeta">): import("@/lib/types").ThemeDraftMeta {
  const revision = (page.draftMeta?.revision ?? page.draftJson.version ?? 0) + 1;
  const updatedAt = new Date().toISOString();
  return {
    revision,
    updatedAt,
    etag: `W/"${revision}-${Date.parse(updatedAt).toString(36)}"`
  };
}

export function assertThemeDraftVersion(
  page: Pick<import("@/lib/types").ThemePage, "draftMeta">,
  expected?: { expectedRevision?: number; expectedEtag?: string }
) {
  if (!expected) return;
  if (expected.expectedRevision !== undefined && page.draftMeta?.revision !== expected.expectedRevision) {
    throw new StoreError("theme_draft_revision_conflict", 409);
  }
  if (expected.expectedEtag !== undefined && page.draftMeta?.etag !== expected.expectedEtag) {
    throw new StoreError("theme_draft_etag_conflict", 409);
  }
}

export function toThemePage(record: {
  id: string;
  siteId: string;
  pageType: string;
  slug: string;
  title: string;
  draftJson: unknown;
  publishedJson: unknown;
}): import("@/lib/types").ThemePage {
  const draftJson = cloneJson(record.draftJson) as import("@/lib/types").ThemePageJson & {
    draftMeta?: import("@/lib/types").ThemeDraftMeta;
  };
  const draftMeta = draftJson.draftMeta;
  if (draftMeta) delete draftJson.draftMeta;
  return {
    id: record.id,
    siteId: record.siteId,
    pageType: record.pageType,
    slug: record.slug,
    title: record.title,
    draftJson,
    publishedJson: cloneJson(record.publishedJson) as import("@/lib/types").ThemePageJson,
    draftMeta
  };
}

export function draftJsonWithMeta(page: import("@/lib/types").ThemePage): Prisma.InputJsonValue {
  return cloneJson({
    ...page.draftJson,
    draftMeta: page.draftMeta
  }) as unknown as Prisma.InputJsonValue;
}

export function toThemeSettings(record?: { draftJson: unknown; publishedJson: unknown } | null): import("@/lib/types").Site["themeSettings"] {
  return {
    draftJson: cloneJson(record?.draftJson ?? {}) as import("@/lib/types").ThemeSettings,
    publishedJson: cloneJson(record?.publishedJson ?? {}) as import("@/lib/types").ThemeSettings
  };
}

export function toSite(record: {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  currency: string;
  signupCreditGrant?: number | null;
  branding: unknown;
  domains?: Array<{ domain: string; isPrimary: boolean }>;
  pages?: Array<Parameters<typeof toThemePage>[0]>;
  settings?: { draftJson: unknown; publishedJson: unknown } | null;
  connect?: { stripeAccountId: string; onboardingStatus: string; chargesEnabled: boolean; payoutsEnabled: boolean } | null;
}): import("@/lib/types").Site {
  const primaryDomain = record.domains?.find((domain) => domain.isPrimary)?.domain ?? record.domains?.[0]?.domain ?? "";
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status as import("@/lib/types").Site["status"],
    primaryDomain,
    currency: record.currency,
    timezone: record.timezone,
    signupCreditGrant: Math.max(0, Math.trunc(Number(record.signupCreditGrant ?? 0))),
    branding: cloneJson(record.branding) as import("@/lib/types").Site["branding"],
    connect: {
      stripeAccountId: record.connect?.stripeAccountId ?? `acct_pending_${record.slug}`,
      status: (record.connect?.onboardingStatus ?? "pending") as import("@/lib/types").Site["connect"]["status"],
      chargesEnabled: Boolean(record.connect?.chargesEnabled),
      payoutsEnabled: Boolean(record.connect?.payoutsEnabled)
    },
    themeSettings: toThemeSettings(record.settings),
    pages: (record.pages ?? []).map(toThemePage)
  };
}

export function toSiteDomain(record: {
  id: string;
  siteId: string;
  domain: string;
  isPrimary: boolean;
  status: string;
  allowedAiProviderIds?: string[] | null;
  createdAt?: Date | string;
}): import("@/lib/types").SiteDomain {
  return {
    id: record.id,
    siteId: record.siteId,
    domain: record.domain,
    isPrimary: record.isPrimary,
    status: record.status as import("@/lib/types").SiteDomain["status"],
    allowedAiProviderIds: record.allowedAiProviderIds ?? [],
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString()
  };
}

export function toSiteAdmin(record: {
  id: string;
  siteId: string;
  email: string;
  displayName: string;
  role: string;
  createdAt?: Date | string;
}): import("@/lib/types").SiteAdmin {
  return {
    id: record.id,
    siteId: record.siteId,
    email: record.email,
    displayName: record.displayName,
    role: record.role as import("@/lib/types").SiteAdmin["role"],
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString()
  };
}

export function toCreativePack(record: {
  id: string;
  siteId: string;
  categoryId?: string | null;
  name: string;
  headline: string;
  description: string;
  prompt?: string | null;
  category: string;
  aiAppSlug: string;
  status: string;
  creditCost: number;
  outputCount: number;
  trainingRequired: boolean;
  generationCount: number;
  conversionRate: number;
  imageUrl?: string | null;
  galleryImages?: unknown;
  categoryRecord?: {
    id: string;
    siteId: string;
    parentId?: string | null;
    parent?: {
      id: string;
      siteId: string;
      parentId?: string | null;
      slug: string;
      label: string;
      description?: string | null;
      heroTitle?: string | null;
      heroSubtitle?: string | null;
      icon?: string | null;
      imageUrl?: string | null;
      sortOrder: number;
      status: string;
      createdAt?: Date | string;
    } | null;
    slug: string;
    label: string;
    description?: string | null;
    heroTitle?: string | null;
    heroSubtitle?: string | null;
    imageUrl?: string | null;
    sortOrder: number;
    status: string;
    createdAt?: Date | string;
  } | null;
  createdAt?: Date | string;
}): CreativePack {
  return {
    id: record.id,
    siteId: record.siteId,
    categoryId: record.categoryId ?? undefined,
    name: record.name,
    headline: record.headline,
    description: record.description,
    prompt: record.prompt ?? undefined,
    category: record.category,
    aiAppSlug: record.aiAppSlug,
    status: record.status as CreativePack["status"],
    creditCost: record.creditCost,
    outputCount: record.outputCount,
    trainingRequired: record.trainingRequired,
    generationCount: record.generationCount,
    conversionRate: record.conversionRate,
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
    imageUrl: record.imageUrl ?? undefined,
    galleryImages: Array.isArray(record.galleryImages) ? record.galleryImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined,
    categoryRecord: record.categoryRecord ? toCreativePackCategory(record.categoryRecord) : undefined
  };
}

export function toCreativePackCategory(record: {
  id: string;
  siteId: string;
  parentId?: string | null;
  parent?: {
    id: string;
    siteId: string;
    parentId?: string | null;
    slug: string;
    label: string;
    description?: string | null;
    heroTitle?: string | null;
    heroSubtitle?: string | null;
    imageUrl?: string | null;
    sortOrder: number;
    status: string;
    createdAt?: Date | string;
  } | null;
  slug: string;
  label: string;
  description?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  status: string;
  createdAt?: Date | string;
}): CreativePackCategory {
  return {
    id: record.id,
    siteId: record.siteId,
    parentId: record.parentId ?? undefined,
    parent: record.parent ? toCreativePackCategory(record.parent) : undefined,
    slug: record.slug,
    label: record.label,
    description: record.description ?? undefined,
    heroTitle: record.heroTitle ?? undefined,
    heroSubtitle: record.heroSubtitle ?? undefined,
    icon: record.icon ?? undefined,
    iconName: record.icon ?? undefined,
    imageUrl: record.imageUrl ?? undefined,
    sortOrder: record.sortOrder,
    status: record.status as CreativePackCategory["status"],
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString()
  };
}

export function toVideoThemeCategory(record: {
  id: string;
  siteId: string;
  slug: string;
  label: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  status: string;
  createdAt?: Date | string;
}): VideoThemeCategory {
  return {
    id: record.id,
    siteId: record.siteId,
    slug: record.slug,
    label: record.label,
    description: record.description ?? undefined,
    imageUrl: record.imageUrl ?? undefined,
    sortOrder: record.sortOrder,
    status: record.status as VideoThemeCategory["status"],
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString()
  };
}

export function toVideoTheme(record: {
  id: string;
  siteId: string;
  categoryId?: string | null;
  category?: Parameters<typeof toVideoThemeCategory>[0] | null;
  slug: string;
  name: string;
  headline: string;
  description: string;
  prompt: string;
  status: string;
  creditCost: number;
  durationSeconds: number;
  maxFrames: number;
  generationCount: number;
  imageUrl?: string | null;
  galleryImages?: unknown;
  createdAt?: Date | string;
}): VideoTheme {
  return {
    id: record.id,
    siteId: record.siteId,
    categoryId: record.categoryId ?? undefined,
    category: record.category ? toVideoThemeCategory(record.category) : undefined,
    slug: record.slug,
    name: record.name,
    headline: record.headline,
    description: record.description,
    prompt: record.prompt,
    status: record.status as VideoTheme["status"],
    creditCost: record.creditCost,
    durationSeconds: record.durationSeconds,
    maxFrames: record.maxFrames,
    generationCount: record.generationCount,
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
    imageUrl: record.imageUrl ?? undefined,
    galleryImages: Array.isArray(record.galleryImages)
      ? record.galleryImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined
  };
}

export function toToolCategory(record: {
  id: string;
  siteId: string;
  parentId?: string | null;
  parent?: {
    id: string;
    siteId: string;
    parentId?: string | null;
    slug: string;
    label: string;
    description?: string | null;
    icon?: string | null;
    sortOrder: number;
    status: string;
    createdAt?: Date | string;
  } | null;
  slug: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  sortOrder: number;
  status: string;
  createdAt?: Date | string;
}): ToolCategory {
  return {
    id: record.id,
    siteId: record.siteId,
    parentId: record.parentId ?? undefined,
    parent: record.parent ? toToolCategory(record.parent) : undefined,
    slug: record.slug,
    label: record.label,
    description: record.description ?? undefined,
    icon: record.icon ?? undefined,
    iconName: record.icon ?? undefined,
    sortOrder: record.sortOrder,
    status: record.status as ToolCategory["status"],
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString()
  };
}

export function toToolMenuItem(record: {
  id: string;
  siteId: string;
  categoryId?: string | null;
  category?: Parameters<typeof toToolCategory>[0] | null;
  slug: string;
  title: string;
  description?: string | null;
  badge?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  href: string;
  detailJson?: unknown;
  sortOrder: number;
  status: string;
  createdAt?: Date | string;
}): ToolMenuItem {
  return {
    id: record.id,
    siteId: record.siteId,
    categoryId: record.categoryId ?? undefined,
    category: record.category ? toToolCategory(record.category) : undefined,
    slug: record.slug,
    title: record.title,
    description: record.description ?? undefined,
    badge: record.badge ?? undefined,
    icon: record.icon ?? undefined,
    imageUrl: record.imageUrl ?? undefined,
    href: record.href,
    detailJson: jsonObject<ToolMenuItem["detailJson"]>(record.detailJson as Prisma.JsonValue | null | undefined),
    sortOrder: record.sortOrder,
    status: record.status as ToolMenuItem["status"],
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString()
  };
}

export function toMediaAsset(record: {
  id: string;
  siteId: string;
  label: string;
  storageKey: string;
  mimeType: string;
  usageType?: string;
  usage?: string;
  sourceType?: string | null;
  previewUrl?: string | null;
  originUrl?: string | null;
  altText?: string | null;
  notes?: string | null;
  createdAt: Date | string;
}): import("@/lib/types").MediaAsset {
  return {
    id: record.id,
    siteId: record.siteId,
    label: record.label,
    storageKey: record.storageKey,
    mimeType: record.mimeType,
    usage: (record.usageType ?? record.usage ?? "theme") as import("@/lib/types").MediaAsset["usage"],
    sourceType: (record.sourceType ?? "manual") as import("@/lib/types").MediaAsset["sourceType"],
    previewUrl: record.previewUrl ?? undefined,
    originUrl: record.originUrl ?? undefined,
    altText: record.altText ?? undefined,
    notes: record.notes ?? undefined,
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString()
  };
}

export function toSiteAiApp(record: {
  id: string;
  siteId: string;
  enabled: boolean;
  creditCost: number;
  routeKey: string;
  workflowConfig?: unknown;
  providerConfig?: unknown;
  aiApp: {
    id: string;
    slug: string;
    name: string;
    description: string;
    appType: string;
    parameterSchema: unknown;
  };
}): import("@/lib/types").SiteAiApp {
  return {
    id: record.id,
    siteId: record.siteId,
    enabled: record.enabled,
    creditCost: record.creditCost,
    routeKey: record.routeKey,
    workflowConfig: jsonObject<import("@/lib/types").SiteAiApp["workflowConfig"]>(record.workflowConfig as Prisma.JsonValue | null | undefined),
    providerConfig: jsonObject<import("@/lib/types").SiteAiApp["providerConfig"]>(record.providerConfig as Prisma.JsonValue | null | undefined),
    aiApp: {
      id: record.aiApp.id,
      slug: record.aiApp.slug,
      name: record.aiApp.name,
      description: record.aiApp.description,
      appType: record.aiApp.appType as import("@/lib/types").AiApp["appType"],
      parameterSchema: Array.isArray(record.aiApp.parameterSchema)
        ? (cloneJson(record.aiApp.parameterSchema) as import("@/lib/types").AiApp["parameterSchema"])
        : []
    }
  };
}

export function toThemePublication(record: {
  id: string;
  siteId: string;
  version: number;
  snapshot: unknown;
  pageCount?: number | null;
  sectionCount?: number | null;
  snapshotBytes?: number | null;
  publishedBy: string;
  publishedAt: Date | string;
}): import("@/lib/types").ThemePublication {
  const snapshot = cloneJson(record.snapshot) as import("@/lib/types").ThemePublication["snapshot"];
  const pageCount = record.pageCount ?? snapshot.pages.length;
  const sectionCount =
    record.sectionCount ??
    snapshot.pages.reduce((sum, page) => sum + (page.publishedJson.sectionsOrder?.length ?? 0), 0);
  const snapshotBytes = record.snapshotBytes ?? Buffer.byteLength(JSON.stringify(snapshot), "utf8");
  return {
    id: record.id,
    siteId: record.siteId,
    version: record.version,
    snapshot,
    pageCount,
    sectionCount,
    snapshotBytes,
    publishedBy: record.publishedBy,
    publishedAt: toIsoString(record.publishedAt) ?? new Date().toISOString()
  };
}

export function toSiteTheme(record: {
  id: string;
  siteId: string;
  name: string;
  themeId: string;
  themeKey: string;
  status: string;
  templates: unknown;
  settings: unknown;
  source: string;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): import("@/lib/types").SiteTheme {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    themeId: record.themeId,
    themeKey: record.themeKey,
    status: record.status as import("@/lib/types").SiteTheme["status"],
    templates: cloneJson(record.templates),
    settings: cloneJson(record.settings),
    source: record.source as import("@/lib/types").SiteTheme["source"],
    createdBy: record.createdBy,
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(record.updatedAt) ?? new Date().toISOString()
  };
}

export function toThemeCopy(record: {
  id: string;
  siteId: string;
  name: string;
  themeKey: string;
  source: string;
  templates: unknown;
  settings: unknown;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): import("@/lib/types").ThemeCopy {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    themeKey: record.themeKey,
    source: record.source as import("@/lib/types").ThemeCopy["source"],
    templates: cloneJson(record.templates),
    settings: cloneJson(record.settings),
    createdBy: record.createdBy,
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(record.updatedAt) ?? new Date().toISOString()
  };
}

export function toGatewayGroup(record: {
  id: string;
  siteId: string;
  name: string;
  status: string;
  modelAllowlist: string[];
  monthlyQuota: number;
  usedQuota: number;
  retryStatusCodes: number[];
  rateLimitPerMinute: number;
  accountPoolMode: string;
  unavailableReason?: string | null;
}): import("@/lib/types").AiGatewayGroup {
  return {
    id: record.id,
    siteId: record.siteId,
    name: record.name,
    status: record.status as import("@/lib/types").AiGatewayGroup["status"],
    modelAllowlist: record.modelAllowlist,
    monthlyQuota: record.monthlyQuota,
    usedQuota: record.usedQuota,
    retryStatusCodes: record.retryStatusCodes,
    rateLimitPerMinute: record.rateLimitPerMinute,
    accountPoolMode: record.accountPoolMode as import("@/lib/types").AiGatewayGroup["accountPoolMode"],
    unavailableReason: record.unavailableReason ?? undefined
  };
}

export function toPlatformEmailSettings(record: {
  provider: string;
  apiKey?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  updatedBy?: string | null;
  updatedAt: Date | string;
}): import("@/lib/types").PlatformEmailSettings {
  return {
    provider: "resend",
    apiKey: record.apiKey ?? undefined,
    fromEmail: record.fromEmail ?? undefined,
    replyTo: record.replyTo ?? undefined,
    updatedAt: toIsoString(record.updatedAt),
    updatedBy: record.updatedBy ?? undefined
  };
}

export function toPlatformEmailConfig(record: {
  id: string;
  label: string;
  provider: string;
  apiKey?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  isDefault: boolean;
  updatedBy?: string | null;
  updatedAt: Date | string;
}): import("@/lib/types").PlatformEmailConfig {
  return {
    id: record.id,
    label: record.label,
    provider: "resend",
    apiKey: record.apiKey ?? undefined,
    fromEmail: record.fromEmail ?? undefined,
    replyTo: record.replyTo ?? undefined,
    isDefault: record.isDefault,
    updatedAt: toIsoString(record.updatedAt),
    updatedBy: record.updatedBy ?? undefined
  };
}

export function toSiteEmailConfigAssignment(record: {
  siteId: string;
  configId: string;
  updatedBy?: string | null;
  updatedAt: Date | string;
}): import("@/lib/types").SiteEmailConfigAssignment {
  return {
    siteId: record.siteId,
    configId: record.configId,
    updatedAt: toIsoString(record.updatedAt),
    updatedBy: record.updatedBy ?? undefined
  };
}

export function toPlatformCloudflareAccount(record: {
  id: string;
  label: string;
  email: string;
  accountId: string;
  apiToken: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  updatedBy?: string | null;
}): import("@/lib/types").PlatformCloudflareAccount {
  return {
    id: record.id,
    label: record.label,
    email: record.email,
    accountId: record.accountId,
    apiToken: record.apiToken,
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(record.updatedAt),
    updatedBy: record.updatedBy ?? undefined
  };
}

export function toPlatformAiProvider(record: {
  id: string;
  label: string;
  aiUrl: string;
  apiKey?: string | null;
  modelType: string;
  priority: number;
  preferred: boolean;
  supportsGenerationN?: boolean | null;
  supportsEditN?: boolean | null;
  maxImagesPerRequest?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  updatedBy?: string | null;
}): import("@/lib/types").PlatformAiProvider {
  const maxImagesPerRequest = Number(record.maxImagesPerRequest);
  return {
    id: record.id,
    label: record.label,
    aiUrl: record.aiUrl,
    apiKey: record.apiKey ?? undefined,
    modelType: record.modelType,
    priority: record.priority,
    preferred: record.preferred,
    supportsGenerationN: Boolean(record.supportsGenerationN),
    supportsEditN: Boolean(record.supportsEditN),
    maxImagesPerRequest: Number.isFinite(maxImagesPerRequest) ? Math.max(1, Math.min(Math.trunc(maxImagesPerRequest), 20)) : 1,
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(record.updatedAt) ?? new Date().toISOString(),
    updatedBy: record.updatedBy ?? undefined
  };
}

export async function getPlatformDocumentState(db: PrismaLike): Promise<Partial<import("@/lib/types").PlatformState>> {
  const document = await db.platformStateDocument.findUnique({ where: { id: PLATFORM_DOCUMENT_ID } });
  return cloneJson((document?.state ?? {}) as Partial<import("@/lib/types").PlatformState>);
}

export async function updatePlatformDocumentState<T>(
  db: PrismaLike,
  mutator: (state: Partial<import("@/lib/types").PlatformState>) => T
): Promise<T> {
  const state = await getPlatformDocumentState(db);
  const result = mutator(state);
  await db.platformStateDocument.upsert({
    where: { id: PLATFORM_DOCUMENT_ID },
    create: { id: PLATFORM_DOCUMENT_ID, state: state as unknown as Prisma.InputJsonValue },
    update: { state: state as unknown as Prisma.InputJsonValue }
  });
  return result;
}

export async function addAuditLogRelational(
  db: PrismaLike,
  entry: Omit<import("@/lib/types").AuditLogEntry, "id" | "createdAt"> & { id?: string; createdAt?: string }
) {
  const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
  const id = entry.id ?? relationalUid("audit");
  const auditDelegate = "auditLog" in db ? db.auditLog : (db as unknown as { adminAuditLog: Prisma.TransactionClient["auditLog"] }).adminAuditLog;
  await auditDelegate.create({
    data: {
      id,
      siteId: entry.siteId,
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: (entry.metadata ?? {}) as unknown as Prisma.InputJsonValue,
      createdAt
    }
  });
  await updatePlatformDocumentState(db, (state) => {
    state.auditLogs ??= [];
    state.auditLogs.unshift({
      id,
      siteId: entry.siteId,
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      createdAt: createdAt.toISOString(),
      metadata: entry.metadata
    });
  });
}
