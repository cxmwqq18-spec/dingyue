import "server-only";

import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma, runPrismaReadWithReconnect } from "@/lib/prisma";
import { aiProviderStatus } from "@/lib/ai-provider-config";
import { latestActivity, siteDemoSnapshot } from "@/lib/ops";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import {
  createPlatformAdminSession as createPlatformAdminSessionJsonFallback,
  deletePlatformAdminSession as deletePlatformAdminSessionJsonFallback,
  getPlatformAdminBySessionFromState,
  readPlatformState
} from "@/lib/server-store";
import type { AiGatewayGroup, AuditLogEntry, Order, PlatformAiProvider, PlatformCloudflareAccount, PlatformEmailConfig, PlatformEmailSettings, PlatformEmailTestResult, PublicSiteAdmin, Site, SiteDomain, SiteEmailConfigAssignment, Subscription } from "@/lib/types";
import { inferPlatformAiProviderType, normalizePlatformAiProviderType, platformAiProviderTypes, type PlatformAiProviderType } from "@/lib/ai-provider-type";
import { normalizeAiProviderProtocol } from "@/lib/video-provider-family";
import { normalizePlatformEmailConfig, normalizeResendApiKey } from "@/lib/resend-email";
import { normalizeImageProviderAspectRatio, normalizeImageProviderOutputFormat, normalizeImageProviderQuality, normalizeImageProviderResolution } from "@/lib/tokengo-image";
import { shouldFallbackRelationalRead, warnRelationalFallback } from "@/lib/stores/relational-fallback";

import {
  addAuditLogRelational,
  mapCreditLedger,
  mapCustomer,
  mapGenerationJob,
  mapProduct,
  relationalSessionTtlMs,
  relationalUid,
  RelationalStoreError,
  toPlatformSessionRelational,
  toPlatformAiProvider,
  toPlatformCloudflareAccount,
  toPlatformEmailConfig,
  toPlatformEmailSettings,
  toPublicPlatformAdminRelational,
  toPublicSiteAdminRelational,
  toAlbumRelational,
  toAssetUploadRelational,
  toCreativePack,
  toCustomerModelRelational,
  toGatewayGroup,
  toMediaAsset,
  toSiteEmailConfigAssignment,
  toSiteAiApp,
  toSite,
  toSiteDomain,
  uid,
  hashRelationalPassword,
  isLegacyRelationalPasswordHash,
  verifyRelationalPassword
} from "./prisma-mappers";

const cloudflareCurrentAccountSettingKey = "cloudflare_current_account_id";
const platformEmailTestResultsKey = "platform_email_test_results";
const platformReadCache = createServerTtlCache("platform-store", 30_000);
type PlatformSiteList = Array<Site & { domains: SiteDomain[]; admins: PublicSiteAdmin[]; gatewayGroups: AiGatewayGroup[] }>;

export function clearPlatformReadCache(): void {
  platformReadCache.clear();
}

function cloudflareCurrentAccountIdFromSetting(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const accountId = (value as { accountId?: unknown }).accountId;
  return typeof accountId === "string" && accountId.trim() ? accountId : undefined;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parsePlatformEmailTestResult(value: unknown): PlatformEmailTestResult | undefined {
  const record = objectRecord(value);
  const state = record.state === "passed" || record.state === "failed" ? record.state : undefined;
  const testedAt = typeof record.testedAt === "string" ? record.testedAt : undefined;
  if (!state || !testedAt) return undefined;
  return {
    state,
    testedAt,
    to: typeof record.to === "string" ? record.to : undefined,
    messageId: typeof record.messageId === "string" ? record.messageId : undefined,
    configId: typeof record.configId === "string" ? record.configId : undefined,
    configLabel: typeof record.configLabel === "string" ? record.configLabel : undefined,
    testedBy: typeof record.testedBy === "string" ? record.testedBy : undefined,
    error: typeof record.error === "string" ? record.error : undefined,
    providerStatus: typeof record.providerStatus === "number" ? record.providerStatus : undefined,
    providerMessage: typeof record.providerMessage === "string" ? record.providerMessage : undefined
  };
}

export async function readPlatformEmailTestResultsRelational(): Promise<Record<string, PlatformEmailTestResult>> {
  const setting = await prisma.platformSetting.findUnique({ where: { key: platformEmailTestResultsKey } });
  const sites = objectRecord(objectRecord(setting?.value).sites);
  return Object.fromEntries(
    Object.entries(sites)
      .map(([siteId, value]) => [siteId, parsePlatformEmailTestResult(value)] as const)
      .filter((entry): entry is [string, PlatformEmailTestResult] => Boolean(entry[1]))
  );
}

export async function writePlatformEmailTestResultRelational(siteId: string, result: PlatformEmailTestResult): Promise<void> {
  const current = await readPlatformEmailTestResultsRelational();
  const next = { ...current, [siteId]: result };
  const value = { sites: next } as unknown as Prisma.InputJsonValue;
  await prisma.platformSetting.upsert({
    where: { key: platformEmailTestResultsKey },
    create: {
      id: platformEmailTestResultsKey,
      key: platformEmailTestResultsKey,
      value,
      updatedBy: result.testedBy
    },
    update: {
      value,
      updatedBy: result.testedBy
    }
  });
  clearPlatformReadCache();
}

async function getCurrentCloudflareAccountIdRelational(): Promise<string | undefined> {
  const setting = await prisma.platformSetting.findUnique({ where: { key: cloudflareCurrentAccountSettingKey } });
  return cloudflareCurrentAccountIdFromSetting(setting?.value);
}

function shouldFallbackLegacyEmailConfig(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("P2021") ||
    message.includes("PlatformEmailConfig") ||
    message.includes("SiteEmailConfigAssignment")
  );
}

function defaultPlatformEmailConfig(settings?: PlatformEmailSettings): PlatformEmailConfig {
  return normalizePlatformEmailConfig({ id: "resend_default", label: "Default Resend", isDefault: true }, settings);
}

function toSubscriptionRelational(record: {
  id: string;
  siteId: string;
  customerId: string;
  productId: string;
  priceId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: Date | string;
  creditsPerCycle: number;
  createdAt: Date | string;
}): Subscription {
  return {
    id: record.id,
    siteId: record.siteId,
    customerId: record.customerId,
    productId: record.productId,
    priceId: record.priceId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    status: record.status as Subscription["status"],
    currentPeriodEnd: record.currentPeriodEnd instanceof Date ? record.currentPeriodEnd.toISOString() : record.currentPeriodEnd,
    creditsPerCycle: record.creditsPerCycle,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt
  };
}

function toOrderRelational(record: {
  id: string;
  siteId: string;
  customerId: string;
  status: string;
  amountCents: number;
  currency: string;
  credits: number;
  sourceId: string;
  createdAt: Date | string;
}): Order {
  return {
    id: record.id,
    siteId: record.siteId,
    customerId: record.customerId,
    status: record.status as Order["status"],
    amountCents: record.amountCents,
    currency: record.currency,
    credits: record.credits,
    sourceId: record.sourceId,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt
  };
}

function toAuditLogRelational(record: {
  id: string;
  siteId?: string | null;
  actorType: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: unknown;
  createdAt: Date | string;
}): AuditLogEntry {
  const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
    ? Object.fromEntries(Object.entries(record.metadata).filter((entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1])
      ))
    : undefined;
  return {
    id: record.id,
    siteId: record.siteId ?? undefined,
    actorType: record.actorType as AuditLogEntry["actorType"],
    actorId: record.actorId,
    action: record.action,
    targetType: record.targetType,
    targetId: record.targetId,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    metadata: metadata && Object.keys(metadata).length ? metadata : undefined
  };
}

export type PlatformDashboardSnapshot = {
  site: Site;
  ownerEmail: string;
  domains: SiteDomain[];
  customerCount: number;
  activeSubscriptions: number;
  revenueCents: number;
  productCount: number;
  jobCount: number;
  failedJobs: number;
  appCount: number;
  enabledAppCount: number;
  gateway?: AiGatewayGroup;
  publicationCount: number;
  healthScore: number;
};

type PlatformActivityItem = ReturnType<typeof latestActivity>[number];
export type PlatformStateCounts = {
  sites: number;
  customers: number;
  products: number;
  jobs: number;
  customerModels: number;
  albums: number;
};

function latestPlatformActivity(
  auditLogs: AuditLogEntry[],
  jobs: Array<{ id: string; status: string; aiAppId: string; updatedAt: Date | string }>,
  orders: Array<{ id: string; status: string; amountCents: number; currency: string; createdAt: Date | string }>,
  limit = 40
): PlatformActivityItem[] {
  return latestActivity(
    auditLogs,
    jobs.map((job) => ({
      id: job.id,
      siteId: "",
      customerId: "",
      aiAppId: job.aiAppId,
      status: job.status as ReturnType<typeof mapGenerationJob>["status"],
      creditsReserved: 0,
      requestJson: {},
      resultJson: undefined,
      createdAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : job.updatedAt,
      updatedAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : job.updatedAt
    })),
    orders.map((order) => ({
      id: order.id,
      siteId: "",
      customerId: "",
      status: order.status as Order["status"],
      amountCents: order.amountCents,
      currency: order.currency,
      credits: 0,
      sourceId: "",
      createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt
    })),
    limit
  );
}

function mapSiteWithCounts(
  site: {
    _count: {
      customers: number;
      products: number;
      aiApps: number;
      jobs: number;
    };
    admins?: Array<{ email?: string }>;
    domains?: Array<Parameters<typeof toSiteDomain>[0]>;
    gatewayGroups?: Array<Parameters<typeof toGatewayGroup>[0]>;
  } & Parameters<typeof toSite>[0],
  aggregates: {
    revenueBySiteId: Map<string, number>;
    activeSubscriptionsBySiteId: Map<string, number>;
    failedJobsBySiteId: Map<string, number>;
    enabledAppsBySiteId: Map<string, number>;
  }
): PlatformDashboardSnapshot {
  const mappedSite = toSite(site);
  const domains = (site.domains ?? []).map(toSiteDomain);
  const gateway = site.gatewayGroups?.[0] ? toGatewayGroup(site.gatewayGroups[0]) : undefined;
  const customerCount = site._count.customers;
  const failedJobs = aggregates.failedJobsBySiteId.get(site.id) ?? 0;
  // Publication snapshots were retired by the no-snapshot migration.
  const publicationCount = 0;
  const connectScore = mappedSite.connect.chargesEnabled ? 24 : 8;
  const customerScore = customerCount > 0 ? 18 : 6;
  const jobScore = site._count.jobs === 0 ? 12 : Math.max(8, 24 - failedJobs * 4);
  const gatewayScore = gateway?.status === "active" ? 18 : 6;
  const themeScore = publicationCount > 0 ? 16 : 8;
  return {
    site: mappedSite,
    ownerEmail: site.admins?.[0]?.email ?? "not assigned",
    domains,
    customerCount,
    activeSubscriptions: aggregates.activeSubscriptionsBySiteId.get(site.id) ?? 0,
    revenueCents: aggregates.revenueBySiteId.get(site.id) ?? 0,
    productCount: site._count.products,
    jobCount: site._count.jobs,
    failedJobs,
    appCount: site._count.aiApps,
    enabledAppCount: aggregates.enabledAppsBySiteId.get(site.id) ?? 0,
    gateway,
    publicationCount,
    healthScore: Math.min(100, connectScore + customerScore + jobScore + gatewayScore + themeScore)
  };
}

function sortedDomainsForSite(state: ReturnType<typeof readPlatformState>, siteId: string): SiteDomain[] {
  return state.siteDomains
    .filter((domain) => domain.siteId === siteId)
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.createdAt.localeCompare(right.createdAt));
}

function sortedPublicAdminsForSite(state: ReturnType<typeof readPlatformState>, siteId: string): PublicSiteAdmin[] {
  return state.siteAdmins
    .filter((admin) => admin.siteId === siteId)
    .sort((left, right) => left.role.localeCompare(right.role) || left.createdAt.localeCompare(right.createdAt))
    .map((admin) => toPublicSiteAdminRelational(admin as unknown as Record<string, unknown>));
}

function sortedGatewayGroupsForSite(state: ReturnType<typeof readPlatformState>, siteId: string): AiGatewayGroup[] {
  return state.aiGatewayGroups
    .filter((group) => group.siteId === siteId)
    .sort((left, right) => left.status.localeCompare(right.status) || left.name.localeCompare(right.name));
}

function getPlatformSnapshotsJsonFallback(mode: "overview" | "sites" | "billing" | "gateway"): PlatformDashboardSnapshot[] {
  const state = readPlatformState();
  return state.sites.map((site) => {
    const siteId = site.id;
    return siteDemoSnapshot({
      site,
      domains: mode === "gateway" ? sortedDomainsForSite(state, siteId) : sortedDomainsForSite(state, siteId).filter((domain) => domain.isPrimary).slice(0, 1),
      admins: mode === "billing" ? [] : sortedPublicAdminsForSite(state, siteId).slice(0, 1),
      customers: state.customers.filter((customer) => customer.siteId === siteId),
      products: state.products.filter((product) => product.siteId === siteId),
      subscriptions: state.subscriptions.filter((subscription) => subscription.siteId === siteId),
      orders: state.orders.filter((order) => order.siteId === siteId),
      jobs: state.jobs.filter((job) => job.siteId === siteId),
      ledger: state.ledger.filter((entry) => entry.siteId === siteId),
      apps: state.siteAiApps.filter((app) => app.siteId === siteId),
      gateway: mode === "billing" ? undefined : sortedGatewayGroupsForSite(state, siteId)[0],
      packs: state.creativePacks.filter((pack) => pack.siteId === siteId),
      media: state.mediaAssets.filter((asset) => asset.siteId === siteId),
      publications: [],
      assets: state.assetUploads.filter((asset) => asset.siteId === siteId),
      customerModels: state.customerModels.filter((model) => model.siteId === siteId),
      albums: state.albums.filter((album) => album.siteId === siteId)
    });
  });
}

async function getPlatformSnapshotsByModeRelational(mode: "overview" | "sites" | "billing" | "gateway") {
  try {
    const [
      sites,
      paidOrderRevenue,
      activeSubscriptionCounts,
      failedJobCounts,
      enabledAppCounts
    ] = await Promise.all([
      prisma.site.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          admins: mode === "billing" ? false : { orderBy: [{ role: "asc" }, { createdAt: "asc" }], take: 1 },
          domains: mode === "gateway" ? { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } : { where: { isPrimary: true }, take: 1 },
          pages: false,
          settings: false,
          connect: true,
          gatewayGroups: mode === "billing" ? false : { orderBy: [{ status: "asc" }, { name: "asc" }], take: 1 },
          _count: {
            select: {
              customers: true,
              products: true,
              aiApps: true,
              jobs: true
            }
          }
        }
      }),
      prisma.order.groupBy({
        by: ["siteId"],
        where: { status: { in: ["paid", "fulfilled"] } },
        _sum: { amountCents: true }
      }),
      prisma.subscription.groupBy({
        by: ["siteId"],
        where: { status: { in: ["active", "trialing"] } },
        _count: { _all: true }
      }),
      prisma.generationJob.groupBy({
        by: ["siteId"],
        where: { status: { in: ["failed", "refunded"] } },
        _count: { _all: true }
      }),
      prisma.siteAiApp.groupBy({
        by: ["siteId"],
        where: { enabled: true },
        _count: { _all: true }
      })
    ]);
    const aggregates = {
      revenueBySiteId: new Map(paidOrderRevenue.map((row) => [row.siteId, row._sum.amountCents ?? 0])),
      activeSubscriptionsBySiteId: new Map(activeSubscriptionCounts.map((row) => [row.siteId, row._count._all])),
      failedJobsBySiteId: new Map(failedJobCounts.map((row) => [row.siteId, row._count._all])),
      enabledAppsBySiteId: new Map(enabledAppCounts.map((row) => [row.siteId, row._count._all]))
    };
    return sites.map((site) => mapSiteWithCounts(site, aggregates));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback(`platform ${mode} snapshots`, error);
    return getPlatformSnapshotsJsonFallback(mode);
  }
}

async function listPlatformEmailConfigsRelational() {
  try {
    return await prisma.platformEmailConfig.findMany({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
  } catch (error) {
    if (!shouldFallbackLegacyEmailConfig(error)) throw error;
    warnRelationalFallback("platform email configs", error);
    return [];
  }
}

async function listSiteEmailConfigAssignmentsRelational() {
  try {
    return await prisma.siteEmailConfigAssignment.findMany({ orderBy: [{ siteId: "asc" }] });
  } catch (error) {
    if (!shouldFallbackLegacyEmailConfig(error)) throw error;
    warnRelationalFallback("site email config assignments", error);
    return [];
  }
}

export async function createPlatformAdminSessionRelational(params: { email: string; password: string }) {
  try {
    const email = params.email.trim().toLowerCase();
    let admin = await prisma.platformAdmin.findUnique({ where: { email } });
    if (!admin || !verifyRelationalPassword(params.password, admin.passwordHash)) {
      throw new RelationalStoreError("invalid_platform_credentials", 401);
    }
    if (isLegacyRelationalPasswordHash(admin.passwordHash)) {
      admin = await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { passwordHash: hashRelationalPassword(params.password) }
      });
    }
    const session = await prisma.platformSession.create({
      data: {
        id: relationalUid("psess"),
        platformAdminId: admin.id,
        expiresAt: new Date(Date.now() + relationalSessionTtlMs)
      }
    });
    return {
      platformAdmin: toPublicPlatformAdminRelational(admin),
      session: toPlatformSessionRelational(session)
    };
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("platform admin session create", error);
    return createPlatformAdminSessionJsonFallback(params);
  }
}

export async function deletePlatformAdminSessionRelational(sessionId: string): Promise<void> {
  try {
    await prisma.platformSession.deleteMany({ where: { id: sessionId } });
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("platform admin session delete", error);
    deletePlatformAdminSessionJsonFallback(sessionId);
  }
}

export async function getPlatformAdminBySessionRelational(sessionId?: string) {
  if (!sessionId) return undefined;
  let session;
  try {
    session = await prisma.platformSession.findFirst({
      where: { id: sessionId, expiresAt: { gt: new Date() } },
      include: { platformAdmin: true }
    });
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("platform session lookup", error);
    const fallback = getPlatformAdminBySessionFromState(readPlatformState(), sessionId);
    return fallback
      ? {
          platformAdmin: toPublicPlatformAdminRelational(fallback.platformAdmin as unknown as Record<string, unknown>),
          session: fallback.session
        }
      : undefined;
  }
  if (!session?.platformAdmin) return undefined;
  return {
    platformAdmin: toPublicPlatformAdminRelational(session.platformAdmin),
    session: toPlatformSessionRelational(session)
  };
}

async function loadPlatformOverviewRelational(): Promise<{
  sites: Site[];
  siteDomains: SiteDomain[];
  platformEmailSettings?: PlatformEmailSettings;
  platformEmailConfigs: PlatformEmailConfig[];
  siteEmailConfigAssignments: SiteEmailConfigAssignment[];
  platformCloudflareAccounts: PlatformCloudflareAccount[];
  currentCloudflareAccountId?: string;
  platformAiProviders: PlatformAiProvider[];
  currentAiProviderId?: string;
}> {
  const [sites, siteDomains, emailSettings, emailConfigs, emailAssignments, cloudflareAccounts, currentCloudflareSetting, aiProviders] = await Promise.all([
    prisma.site.findMany({
      orderBy: { createdAt: "asc" },
      include: { domains: true, connect: true }
    }),
    prisma.siteDomain.findMany({ orderBy: [{ siteId: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }] }),
    prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } }),
    listPlatformEmailConfigsRelational(),
    listSiteEmailConfigAssignmentsRelational(),
    prisma.platformCloudflareAccount.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.platformSetting.findUnique({ where: { key: cloudflareCurrentAccountSettingKey } }),
    prisma.platformAiProvider.findMany({ orderBy: [{ providerType: "asc" }, { enabled: "desc" }, { preferred: "desc" }, { priority: "asc" }] })
  ]);
  const preferredProvider = aiProviders.find((provider) => provider.providerType === "image" && provider.enabled && provider.preferred) ?? aiProviders.find((provider) => provider.providerType === "image" && provider.enabled) ?? aiProviders.find((provider) => provider.enabled);
  const currentCloudflareAccountId = cloudflareCurrentAccountIdFromSetting(currentCloudflareSetting?.value);
  const validCurrentCloudflareAccountId = cloudflareAccounts.some((account) => account.id === currentCloudflareAccountId)
    ? currentCloudflareAccountId
    : undefined;
  const emailSettingsValue = emailSettings ? toPlatformEmailSettings(emailSettings) : undefined;
  const platformEmailConfigs = emailConfigs.map((config) => normalizePlatformEmailConfig(toPlatformEmailConfig(config), emailSettingsValue));
  if (!platformEmailConfigs.length) {
    platformEmailConfigs.push(defaultPlatformEmailConfig(emailSettingsValue));
  }
  return {
    sites: sites.map(toSite),
    siteDomains: siteDomains.map((domain) => ({
      id: domain.id,
      siteId: domain.siteId,
      domain: domain.domain,
      isPrimary: domain.isPrimary,
      status: domain.status as SiteDomain["status"],
      allowedAiProviderIds: domain.allowedAiProviderIds ?? [],
      createdAt: domain.createdAt.toISOString()
    })),
    platformEmailSettings: emailSettingsValue,
    platformEmailConfigs,
    siteEmailConfigAssignments: emailAssignments.map(toSiteEmailConfigAssignment),
    platformCloudflareAccounts: cloudflareAccounts.map(toPlatformCloudflareAccount),
    currentCloudflareAccountId: validCurrentCloudflareAccountId,
    platformAiProviders: aiProviders.map(toPlatformAiProvider),
    currentAiProviderId: preferredProvider?.id
  };
}

export const getPlatformOverviewRelational = cache(() => platformReadCache.get("overview", loadPlatformOverviewRelational));

async function loadPlatformEmailOverviewRelational(): Promise<{
  sites: Site[];
  siteDomains: SiteDomain[];
  platformEmailSettings?: PlatformEmailSettings;
  platformEmailConfigs: PlatformEmailConfig[];
  siteEmailConfigAssignments: SiteEmailConfigAssignment[];
  emailTestResults: Record<string, PlatformEmailTestResult>;
}> {
  const [sites, siteDomains, emailSettings, emailConfigs, emailAssignments, emailTestResults] = await Promise.all([
    prisma.site.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        timezone: true,
        currency: true,
        signupCreditGrant: true,
        branding: true,
        primaryDomain: true,
        connect: {
          select: {
            stripeAccountId: true,
            onboardingStatus: true,
            chargesEnabled: true,
            payoutsEnabled: true
          }
        }
      }
    }),
    prisma.siteDomain.findMany({
      orderBy: [{ siteId: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }],
      select: { id: true, siteId: true, domain: true, isPrimary: true, status: true, allowedAiProviderIds: true, createdAt: true }
    }),
    prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } }),
    listPlatformEmailConfigsRelational(),
    listSiteEmailConfigAssignmentsRelational(),
    readPlatformEmailTestResultsRelational()
  ]);
  const emailSettingsValue = emailSettings ? toPlatformEmailSettings(emailSettings) : undefined;
  const platformEmailConfigs = emailConfigs.map((config) => normalizePlatformEmailConfig(toPlatformEmailConfig(config), emailSettingsValue));
  if (!platformEmailConfigs.length) {
    platformEmailConfigs.push(defaultPlatformEmailConfig(emailSettingsValue));
  }
  return {
    sites: sites.map(toSite),
    siteDomains: siteDomains.map(toSiteDomain),
    platformEmailSettings: emailSettingsValue,
    platformEmailConfigs,
    siteEmailConfigAssignments: emailAssignments.map(toSiteEmailConfigAssignment),
    emailTestResults
  };
}

export const getPlatformEmailOverviewRelational = cache(() =>
  platformReadCache.get("email-overview", loadPlatformEmailOverviewRelational)
);

export async function getSiteEmailOverviewRelational(siteId: string): Promise<{
  site?: Site;
  siteDomains: SiteDomain[];
  platformEmailSettings?: PlatformEmailSettings;
  platformEmailConfigs: PlatformEmailConfig[];
  siteEmailConfigAssignments: SiteEmailConfigAssignment[];
}> {
  return platformReadCache.get(`site-email:${siteId}`, async () => {
    const [site, siteDomains, emailSettings, emailConfigs, emailAssignments] = await Promise.all([
      prisma.site.findUnique({
        where: { id: siteId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          timezone: true,
          currency: true,
          signupCreditGrant: true,
          branding: true,
        connect: { select: { stripeAccountId: true, onboardingStatus: true, chargesEnabled: true, payoutsEnabled: true } }
      }
    }),
      prisma.siteDomain.findMany({
        where: { siteId },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: { id: true, siteId: true, domain: true, isPrimary: true, status: true, allowedAiProviderIds: true, createdAt: true }
      }),
      prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } }),
      prisma.platformEmailConfig.findMany({
        where: {
          OR: [
            { isDefault: true },
            { siteAssignments: { some: { siteId } } }
          ]
        },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
      }),
      prisma.siteEmailConfigAssignment.findMany({ where: { siteId } })
    ]);
    const emailSettingsValue = emailSettings ? toPlatformEmailSettings(emailSettings) : undefined;
    const platformEmailConfigs = emailConfigs.map((config) => normalizePlatformEmailConfig(toPlatformEmailConfig(config), emailSettingsValue));
    if (!platformEmailConfigs.length) {
      platformEmailConfigs.push(defaultPlatformEmailConfig(emailSettingsValue));
    }
    return {
      site: site ? toSite(site) : undefined,
      siteDomains: siteDomains.map(toSiteDomain),
      platformEmailSettings: emailSettingsValue,
      platformEmailConfigs,
      siteEmailConfigAssignments: emailAssignments.map(toSiteEmailConfigAssignment)
    };
  }, 15_000);
}

export async function getSiteEmailConfigStateRelational(siteId: string): Promise<{
  platformEmailSettings?: PlatformEmailSettings;
  platformEmailConfigs: PlatformEmailConfig[];
  siteEmailConfigAssignments: SiteEmailConfigAssignment[];
}> {
  return platformReadCache.get(`site-email-config:${siteId}`, async () => {
    type SiteEmailConfigStateRow = {
      platformEmailSettings: Parameters<typeof toPlatformEmailSettings>[0] | null;
      platformEmailConfigs: Array<Parameters<typeof toPlatformEmailConfig>[0]>;
      siteEmailConfigAssignments: Array<Parameters<typeof toSiteEmailConfigAssignment>[0]>;
    };
    const rows = await prisma.$queryRaw<SiteEmailConfigStateRow[]>`
      SELECT
        (SELECT row_to_json(pes) FROM "PlatformEmailSettings" pes WHERE pes."id" = 'platform_email_settings') AS "platformEmailSettings",
        COALESCE((
          SELECT jsonb_agg(to_jsonb(pec) ORDER BY pec."isDefault" DESC, pec."updatedAt" DESC)
          FROM "PlatformEmailConfig" pec
          WHERE pec."isDefault" = true OR EXISTS (
            SELECT 1
            FROM "SiteEmailConfigAssignment" sea
            WHERE sea."configId" = pec."id"
              AND sea."siteId" = ${siteId}
          )
        ), '[]'::jsonb) AS "platformEmailConfigs",
        COALESCE((
          SELECT jsonb_agg(to_jsonb(sea))
          FROM "SiteEmailConfigAssignment" sea
          WHERE sea."siteId" = ${siteId}
        ), '[]'::jsonb) AS "siteEmailConfigAssignments"
    `;
    const row = rows[0] ?? { platformEmailSettings: null, platformEmailConfigs: [], siteEmailConfigAssignments: [] };
    const emailSettings = row.platformEmailSettings;
    const emailConfigs = row.platformEmailConfigs;
    const emailAssignments = row.siteEmailConfigAssignments;
    const emailSettingsValue = emailSettings ? toPlatformEmailSettings(emailSettings) : undefined;
    const platformEmailConfigs = emailConfigs.map((config) => normalizePlatformEmailConfig(toPlatformEmailConfig(config), emailSettingsValue));
    if (!platformEmailConfigs.length) {
      platformEmailConfigs.push(defaultPlatformEmailConfig(emailSettingsValue));
    }
    return {
      platformEmailSettings: emailSettingsValue,
      platformEmailConfigs,
      siteEmailConfigAssignments: emailAssignments.map(toSiteEmailConfigAssignment)
    };
  }, 15_000);
}

async function loadPlatformCloudflareOverviewRelational(): Promise<{
  platformCloudflareAccounts: PlatformCloudflareAccount[];
  currentCloudflareAccountId?: string;
}> {
  const [cloudflareAccounts, currentCloudflareSetting] = await Promise.all([
    prisma.platformCloudflareAccount.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.platformSetting.findUnique({ where: { key: cloudflareCurrentAccountSettingKey } })
  ]);
  const currentCloudflareAccountId = cloudflareCurrentAccountIdFromSetting(currentCloudflareSetting?.value);
  return {
    platformCloudflareAccounts: cloudflareAccounts.map(toPlatformCloudflareAccount),
    currentCloudflareAccountId: cloudflareAccounts.some((account) => account.id === currentCloudflareAccountId)
      ? currentCloudflareAccountId
      : undefined
  };
}

export const getPlatformCloudflareOverviewRelational = cache(() =>
  platformReadCache.get("cloudflare-overview", loadPlatformCloudflareOverviewRelational)
);

async function loadPlatformDashboardSummaryRelational() {
  const [snapshots, gatewayCount, platformActivity] = await Promise.all([
    getPlatformSnapshotsByModeRelational("overview"),
    prisma.aiGatewayGroup.count({ where: { status: "active" } }).catch((error) => {
      if (!shouldFallbackRelationalRead(error)) throw error;
      warnRelationalFallback("platform active gateway count", error);
      return readPlatformState().aiGatewayGroups.filter((group) => group.status === "active").length;
    }),
    getPlatformActivityRelational(6)
  ]);
  return {
    sites: snapshots.map((snapshot) => snapshot.site),
    siteDomains: snapshots.flatMap((snapshot) => snapshot.domains),
    aiGatewayGroupCount: gatewayCount,
    snapshots,
    platformActivity
  };
}

export const getPlatformDashboardSummaryRelational = cache(() =>
  platformReadCache.get("dashboard-summary", loadPlatformDashboardSummaryRelational)
);

async function loadPlatformSiteRegistryRelational() {
  const snapshots = await getPlatformSnapshotsByModeRelational("sites");
  return {
    sites: snapshots.map((snapshot) => snapshot.site),
    siteDomains: snapshots.flatMap((snapshot) => snapshot.domains),
    snapshots
  };
}

export const getPlatformSiteRegistryRelational = cache(() =>
  platformReadCache.get("site-registry", loadPlatformSiteRegistryRelational)
);

async function loadPlatformBillingSummaryRelational() {
  const snapshots = await getPlatformSnapshotsByModeRelational("billing");
  return {
    sites: snapshots.map((snapshot) => snapshot.site),
    snapshots
  };
}

export const getPlatformBillingSummaryRelational = cache(() =>
  platformReadCache.get("billing-summary", loadPlatformBillingSummaryRelational)
);

async function loadPlatformGatewaySummaryRelational() {
  try {
    const [
      sites,
      paidOrderRevenue,
      activeSubscriptionCounts,
      failedJobCounts,
      enabledAppCounts
    ] = await Promise.all([
      prisma.site.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          timezone: true,
          currency: true,
          signupCreditGrant: true,
          branding: true,
          primaryDomain: true,
          connect: true,
          domains: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: {
              id: true,
              siteId: true,
              domain: true,
              isPrimary: true,
              status: true,
              allowedAiProviderIds: true,
              createdAt: true
            }
          },
          gatewayGroups: {
            orderBy: [{ status: "asc" }, { name: "asc" }],
            take: 1,
            select: {
              id: true,
              siteId: true,
              name: true,
              status: true,
              modelAllowlist: true,
              monthlyQuota: true,
              usedQuota: true,
              retryStatusCodes: true,
              rateLimitPerMinute: true,
              accountPoolMode: true,
              unavailableReason: true
            }
          },
          _count: {
            select: {
              customers: true,
              products: true,
              aiApps: true,
              jobs: true
            }
          }
        }
      }),
      prisma.order.groupBy({
        by: ["siteId"],
        where: { status: { in: ["paid", "fulfilled"] } },
        _sum: { amountCents: true }
      }),
      prisma.subscription.groupBy({
        by: ["siteId"],
        where: { status: { in: ["active", "trialing"] } },
        _count: { _all: true }
      }),
      prisma.generationJob.groupBy({
        by: ["siteId"],
        where: { status: { in: ["failed", "refunded"] } },
        _count: { _all: true }
      }),
      prisma.siteAiApp.groupBy({
        by: ["siteId"],
        where: { enabled: true },
        _count: { _all: true }
      })
    ]);
    const aggregates = {
      revenueBySiteId: new Map(paidOrderRevenue.map((row) => [row.siteId, row._sum.amountCents ?? 0])),
      activeSubscriptionsBySiteId: new Map(activeSubscriptionCounts.map((row) => [row.siteId, row._count._all])),
      failedJobsBySiteId: new Map(failedJobCounts.map((row) => [row.siteId, row._count._all])),
      enabledAppsBySiteId: new Map(enabledAppCounts.map((row) => [row.siteId, row._count._all]))
    };
    const snapshots = sites.map((site) => mapSiteWithCounts(site, aggregates));
    return {
      sites: snapshots.map((snapshot) => snapshot.site),
      siteDomains: snapshots.flatMap((snapshot) => snapshot.domains),
      aiGatewayGroups: snapshots.map((snapshot) => snapshot.gateway).filter((group): group is AiGatewayGroup => Boolean(group)),
      snapshots
    };
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("platform gateway summary", error);
    const snapshots = getPlatformSnapshotsJsonFallback("gateway");
    return {
      sites: snapshots.map((snapshot) => snapshot.site),
      siteDomains: snapshots.flatMap((snapshot) => snapshot.domains),
      aiGatewayGroups: snapshots.map((snapshot) => snapshot.gateway).filter((group): group is AiGatewayGroup => Boolean(group)),
      snapshots
    };
  }
}

export const getPlatformGatewaySummaryRelational = cache(() =>
  platformReadCache.get("gateway-summary", loadPlatformGatewaySummaryRelational)
);

async function loadPlatformActivityRelational(limit = 40): Promise<PlatformActivityItem[]> {
  const take = Math.max(limit, 1);
  try {
    const [auditLogs, jobs, orders] = await Promise.all([
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take }),
      prisma.generationJob.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true, status: true, aiAppId: true, updatedAt: true },
        take
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, amountCents: true, currency: true, createdAt: true },
        take
      })
    ]);
    return latestPlatformActivity(auditLogs.map(toAuditLogRelational), jobs, orders, limit);
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("platform activity", error);
    const state = readPlatformState();
    return latestActivity(state.auditLogs, state.jobs, state.orders, limit);
  }
}

export const getPlatformActivityRelational = cache((limit = 40) =>
  platformReadCache.get(`activity:${limit}`, () => loadPlatformActivityRelational(limit), 15_000)
);

function sortPlatformAiProviders(aiProviders: PlatformAiProvider[]): PlatformAiProvider[] {
  return [...aiProviders].sort((left, right) =>
    left.providerType.localeCompare(right.providerType) ||
    Number(right.enabled) - Number(left.enabled) ||
    left.priority - right.priority ||
    Number(right.preferred) - Number(left.preferred) ||
    left.label.localeCompare(right.label)
  );
}

function currentPlatformAiProviderForType(aiProviders: PlatformAiProvider[], providerType: PlatformAiProviderType) {
  const enabled = aiProviders.filter((provider) => provider.providerType === providerType && provider.enabled);
  return enabled[0];
}

function platformAiProviderSummaryForType(aiProviders: PlatformAiProvider[], providerType: PlatformAiProviderType) {
  const providers = aiProviders.filter((provider) => provider.providerType === providerType);
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const current = currentPlatformAiProviderForType(aiProviders, providerType);
  return {
    totalProviders: providers.length,
    enabledProviders: enabledProviders.length,
    configuredProviders: providers.filter((provider) => aiProviderStatus(provider).configured).length,
    runnableProviders: providers.filter((provider) => aiProviderStatus(provider).runnable).length,
    currentProviderId: current?.id ?? "",
    currentConfigured: aiProviderStatus(current).runnable
  };
}

function buildPlatformAiProviderStatus(inputProviders: PlatformAiProvider[], options: { ok?: boolean; source?: "relational" | "json-fallback"; message?: string } = {}) {
  const aiProviders = sortPlatformAiProviders(inputProviders);
  const enabledAiProviders = aiProviders.filter((provider) => provider.enabled);
  const currentProviderIds = Object.fromEntries(
    platformAiProviderTypes.map((providerType) => [providerType, currentPlatformAiProviderForType(aiProviders, providerType)?.id ?? ""])
  ) as Record<PlatformAiProviderType, string>;
  const currentAiProvider = currentPlatformAiProviderForType(aiProviders, "image") ?? enabledAiProviders[0];
  const summaryByType = Object.fromEntries(
    platformAiProviderTypes.map((providerType) => [providerType, platformAiProviderSummaryForType(aiProviders, providerType)])
  ) as Record<PlatformAiProviderType, ReturnType<typeof platformAiProviderSummaryForType>>;
  return {
    aiProviders,
    platformAiProviderStatus: {
      ok: options.ok ?? true,
      source: options.source ?? "relational",
      message: options.message,
      currentProviderId: currentAiProvider?.id ?? "",
      currentProviderIds,
      modelTypes: Array.from(new Set([
        "gpt-image-2",
        "gpt-5.5",
        "grok-video-3-pro",
        "grok-video-3-max",
        "grok-imagine-1.5",
        "grok-imagine-1.5-special",
        "grok-imagine-video",
        "grok-imagine-video-1.5-preview",
        "grok-imagine-video-1.5",
        ...aiProviders.map((provider) => provider.modelType).filter(Boolean)
      ])),
      providers: aiProviders.map((provider) => ({
        id: provider.id,
        label: provider.label,
        aiUrl: provider.aiUrl,
        modelType: provider.modelType,
        priority: provider.priority,
        providerType: provider.providerType,
        preferred: provider.preferred,
        enabled: provider.enabled,
        supportsGenerationN: provider.supportsGenerationN,
        supportsEditN: provider.supportsEditN,
        maxImagesPerRequest: provider.maxImagesPerRequest,
        imageAspectRatio: provider.imageAspectRatio,
        imageResolution: provider.imageResolution,
        imageQuality: provider.imageQuality,
        imageOutputFormat: provider.imageOutputFormat,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
        updatedBy: provider.updatedBy,
        isCurrent: provider.id === currentProviderIds[provider.providerType],
        status: {
          ...aiProviderStatus(provider),
          label: provider.label,
          aiUrl: provider.aiUrl,
          modelType: provider.modelType
        }
      })),
      summary: {
        totalProviders: aiProviders.length,
        enabledProviders: enabledAiProviders.length,
        configuredProviders: aiProviders.filter((provider) => aiProviderStatus(provider).configured).length,
        runnableProviders: aiProviders.filter((provider) => aiProviderStatus(provider).runnable).length,
        currentConfigured: aiProviderStatus(currentAiProvider).runnable,
        byType: summaryByType
      }
    }
  };
}

async function loadPlatformAiProviderStatusRelational() {
  try {
    const aiProviderRecords = await prisma.platformAiProvider.findMany({ orderBy: [{ providerType: "asc" }, { enabled: "desc" }, { preferred: "desc" }, { priority: "asc" }] });
    return buildPlatformAiProviderStatus(aiProviderRecords.map(toPlatformAiProvider));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("platform ai provider status", error);
    const aiProviders = sortPlatformAiProviders(readPlatformState().platformAiProviders ?? []);
    return buildPlatformAiProviderStatus(aiProviders, {
      ok: false,
      source: "json-fallback",
      message: "数据库暂不可用，当前显示本地降级状态；请恢复数据库连接后刷新。"
    });
  }
}

// AI provider config drives paid generation routes, so do not cache fallback reads as normal state.
export const getPlatformAiProviderStatusRelational = cache(loadPlatformAiProviderStatusRelational);

function loadPlatformSitesJsonFallback(): PlatformSiteList {
  const state = readPlatformState();
  return state.sites.map((site) => {
    const domains = state.siteDomains
      .filter((domain) => domain.siteId === site.id)
      .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.createdAt.localeCompare(right.createdAt));
    const admins = state.siteAdmins
      .filter((admin) => admin.siteId === site.id)
      .sort((left, right) => left.role.localeCompare(right.role) || left.createdAt.localeCompare(right.createdAt))
      .slice(0, 1)
      .map((admin) => toPublicSiteAdminRelational(admin as unknown as Record<string, unknown>));
    const gatewayGroups = state.aiGatewayGroups
      .filter((group) => group.siteId === site.id)
      .sort((left, right) => left.status.localeCompare(right.status) || left.name.localeCompare(right.name))
      .slice(0, 1);
    return {
      ...site,
      domains,
      admins,
      gatewayGroups
    };
  });
}

async function loadPlatformSitesRelational(): Promise<PlatformSiteList> {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        timezone: true,
        currency: true,
        signupCreditGrant: true,
        branding: true,
        connect: {
          select: {
            stripeAccountId: true,
            onboardingStatus: true,
            chargesEnabled: true,
            payoutsEnabled: true
          }
        },
        domains: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            siteId: true,
            domain: true,
            isPrimary: true,
            status: true,
            allowedAiProviderIds: true,
            createdAt: true
          }
        },
        admins: {
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          take: 1,
          select: {
            id: true,
            siteId: true,
            email: true,
            displayName: true,
            role: true,
            createdAt: true
          }
        },
        gatewayGroups: {
          orderBy: [{ status: "asc" }, { name: "asc" }],
          take: 1,
          select: {
            id: true,
            siteId: true,
            name: true,
            status: true,
            modelAllowlist: true,
            monthlyQuota: true,
            usedQuota: true,
            retryStatusCodes: true,
            rateLimitPerMinute: true,
            accountPoolMode: true,
            unavailableReason: true
          }
        }
      }
    });
    return sites.map((site) => ({
      ...toSite(site),
      domains: site.domains.map(toSiteDomain),
      admins: site.admins.map(toPublicSiteAdminRelational),
      gatewayGroups: site.gatewayGroups.map(toGatewayGroup)
    }));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("platform sites", error);
    return loadPlatformSitesJsonFallback();
  }
}

export const getPlatformSitesRelational = cache(() =>
  platformReadCache.get("platform-sites", loadPlatformSitesRelational)
);

async function loadPlatformStateCountsRelational(): Promise<PlatformStateCounts> {
  const [sites, customers, products, jobs, customerModels, albums] = await Promise.all([
    prisma.site.count(),
    prisma.customer.count(),
    prisma.product.count(),
    prisma.generationJob.count(),
    prisma.customerModel.count(),
    prisma.album.count()
  ]);
  return { sites, customers, products, jobs, customerModels, albums };
}

export const getPlatformStateCountsRelational = cache(() =>
  platformReadCache.get("state-counts", loadPlatformStateCountsRelational, Number(process.env.PLATFORM_STATE_COUNTS_CACHE_TTL_MS ?? 60_000))
);

export async function getPlatformDashboardAggregateRelational(): Promise<
  | {
      sites: Site[];
      siteDomains: SiteDomain[];
      aiGatewayGroups: AiGatewayGroup[];
      jobs: ReturnType<typeof mapGenerationJob>[];
      orders: Order[];
      snapshots: ReturnType<typeof siteDemoSnapshot>[];
      platformActivity: ReturnType<typeof latestActivity>;
    }
  | undefined
> {
  try {
    const [
      sites,
      siteDomains,
      customers,
      products,
      subscriptions,
      orders,
      jobs,
      ledger,
      siteApps,
      gatewayGroups,
      creativePacks,
      mediaAssets,
      assetUploads,
      customerModels,
      albums,
      auditLogs
    ] = await Promise.all([
      prisma.site.findMany({
        orderBy: { createdAt: "asc" },
        include: { domains: true, admins: true, pages: true, settings: true, connect: true }
      }),
      prisma.siteDomain.findMany({ orderBy: [{ siteId: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }] }),
      prisma.customer.findMany({ include: { balance: true }, orderBy: [{ siteId: "asc" }, { createdAt: "asc" }] }),
      prisma.product.findMany({ include: { prices: true }, orderBy: [{ siteId: "asc" }, { createdAt: "asc" }] }),
      prisma.subscription.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }] }),
      prisma.order.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "desc" }] }),
      prisma.generationJob.findMany({ orderBy: [{ siteId: "asc" }, { updatedAt: "desc" }] }),
      prisma.creditLedger.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "desc" }] }),
      prisma.siteAiApp.findMany({
        include: { aiApp: true },
        orderBy: [{ siteId: "asc" }, { routeKey: "asc" }]
      }),
      prisma.aiGatewayGroup.findMany({ orderBy: [{ siteId: "asc" }, { status: "asc" }, { name: "asc" }] }),
      prisma.creativePack.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }] }),
      prisma.mediaAsset.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }] }),
      prisma.assetUpload.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "desc" }] }),
      prisma.customerModel.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "desc" }] }),
      prisma.album.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "desc" }] }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 80 })
    ]);

    const mappedSites = sites.map(toSite);
    const mappedDomains = siteDomains.map(toSiteDomain);
    const mappedCustomers = customers.map(mapCustomer);
    const mappedProducts = products.map(mapProduct);
    const mappedSubscriptions = subscriptions.map(toSubscriptionRelational);
    const mappedOrders = orders.map(toOrderRelational);
    const mappedJobs = jobs.map(mapGenerationJob);
    const mappedLedger = ledger.map(mapCreditLedger);
    const mappedApps = siteApps.map(toSiteAiApp);
    const mappedGatewayGroups = gatewayGroups.map(toGatewayGroup);
    const mappedCreativePacks = creativePacks.map(toCreativePack);
    const mappedMediaAssets = mediaAssets.map(toMediaAsset);
    const mappedAssetUploads = assetUploads.map((asset) => toAssetUploadRelational(asset as unknown as Record<string, unknown>));
    const mappedCustomerModels = customerModels.map((model) => toCustomerModelRelational(model as unknown as Record<string, unknown>));
    const mappedAlbums = albums.map((album) => toAlbumRelational(album as unknown as Record<string, unknown>));
    const mappedAuditLogs = auditLogs.map(toAuditLogRelational);

    const snapshots = mappedSites.map((site) => {
      const siteId = site.id;
      return siteDemoSnapshot({
        site,
        domains: mappedDomains.filter((domain) => domain.siteId === siteId),
        admins: sites.find((record) => record.id === siteId)?.admins?.map(toPublicSiteAdminRelational) ?? [],
        customers: mappedCustomers.filter((customer) => customer.siteId === siteId),
        products: mappedProducts.filter((product) => product.siteId === siteId),
        subscriptions: mappedSubscriptions.filter((subscription) => subscription.siteId === siteId),
        orders: mappedOrders.filter((order) => order.siteId === siteId),
        jobs: mappedJobs.filter((job) => job.siteId === siteId),
        ledger: mappedLedger.filter((entry) => entry.siteId === siteId),
        apps: mappedApps.filter((app) => app.siteId === siteId),
        gateway: mappedGatewayGroups.find((group) => group.siteId === siteId),
        packs: mappedCreativePacks.filter((pack) => pack.siteId === siteId),
        media: mappedMediaAssets.filter((asset) => asset.siteId === siteId),
        publications: [],
        assets: mappedAssetUploads.filter((asset) => asset.siteId === siteId),
        customerModels: mappedCustomerModels.filter((model) => model.siteId === siteId),
        albums: mappedAlbums.filter((album) => album.siteId === siteId)
      });
    });

    return {
      sites: mappedSites,
      siteDomains: mappedDomains,
      aiGatewayGroups: mappedGatewayGroups,
      jobs: mappedJobs,
      orders: mappedOrders,
      snapshots,
      platformActivity: latestActivity(mappedAuditLogs, mappedJobs, mappedOrders, 40)
    };
  } catch (error) {
    warnRelationalFallback("platform dashboard aggregate", error);
    return undefined;
  }
}

export async function updatePlatformEmailSettingsRelational(params: {
  configId?: string;
  label?: string;
  apiKey?: string;
  fromEmail?: string;
  replyTo?: string;
  isDefault?: boolean;
  siteAssignments?: Array<{ siteId: string; configId: string }>;
  actor?: string;
}): Promise<PlatformEmailSettings> {
  const [current, relationalConfigs, relationalAssignments, sites] = await Promise.all([
    prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } }),
    listPlatformEmailConfigsRelational(),
    listSiteEmailConfigAssignmentsRelational(),
    prisma.site.findMany({ select: { id: true } })
  ]);
  const nextApiKey = normalizeResendApiKey(params.apiKey);
  const currentApiKey = normalizeResendApiKey(current?.apiKey);
  const currentSettings = current ? toPlatformEmailSettings(current) : undefined;
  const currentConfigs = relationalConfigs.length
    ? relationalConfigs.map((config) => normalizePlatformEmailConfig(toPlatformEmailConfig(config), currentSettings))
    : [defaultPlatformEmailConfig(currentSettings)];
  const targetId = params.configId?.trim() || currentConfigs.find((config) => config.isDefault)?.id || currentConfigs[0]?.id || "resend_default";
  const existingConfig = currentConfigs.find((config) => config.id === targetId);
  const updatedConfig = normalizePlatformEmailConfig(
    {
      ...(existingConfig ?? { id: targetId }),
      label: params.label ?? existingConfig?.label,
      apiKey: nextApiKey ?? existingConfig?.apiKey ?? currentSettings?.apiKey,
      fromEmail: params.fromEmail?.trim() ?? existingConfig?.fromEmail ?? currentSettings?.fromEmail,
      replyTo: params.replyTo?.trim() ?? existingConfig?.replyTo ?? currentSettings?.replyTo,
      isDefault: params.isDefault ?? existingConfig?.isDefault ?? !currentConfigs.some((config) => config.isDefault),
      updatedBy: params.actor,
      updatedAt: new Date().toISOString()
    },
    currentSettings
  );
  const nextConfigs = [
    updatedConfig,
    ...currentConfigs.filter((config) => config.id !== targetId)
  ].map((config) => ({
    ...config,
    isDefault: updatedConfig.isDefault ? config.id === updatedConfig.id : config.isDefault
  }));
  if (!nextConfigs.some((config) => config.isDefault)) nextConfigs[0].isDefault = true;
  const validConfigIds = new Set(nextConfigs.map((config) => config.id));
  const currentAssignments = relationalAssignments.map(toSiteEmailConfigAssignment);
  const validSiteIds = new Set(sites.map((site) => site.id));
  const nextAssignments = (params.siteAssignments ?? currentAssignments)
    .filter((assignment) => assignment.siteId && validConfigIds.has(assignment.configId))
    .filter((assignment) => validSiteIds.has(assignment.siteId))
    .map((assignment) => ({
      siteId: assignment.siteId,
      configId: assignment.configId,
      updatedAt: new Date().toISOString(),
      updatedBy: params.actor
    }));
  const defaultConfig = nextConfigs.find((config) => config.isDefault) ?? updatedConfig;
  let settingsRecord;
  try {
    settingsRecord = await prisma.$transaction(async (tx) => {
      await Promise.all(nextConfigs.map((config) =>
        tx.platformEmailConfig.upsert({
          where: { id: config.id },
          create: {
            id: config.id,
            label: config.label,
            provider: "resend",
            apiKey: config.apiKey,
            fromEmail: config.fromEmail,
            replyTo: config.replyTo,
            isDefault: Boolean(config.isDefault),
            updatedBy: params.actor
          },
          update: {
            label: config.label,
            apiKey: config.apiKey ?? null,
            fromEmail: config.fromEmail ?? null,
            replyTo: config.replyTo ?? null,
            isDefault: Boolean(config.isDefault),
            updatedBy: params.actor
          }
        })
      ));
      await tx.platformEmailConfig.deleteMany({ where: { id: { notIn: nextConfigs.map((config) => config.id) } } });
    if (params.siteAssignments) {
      await tx.siteEmailConfigAssignment.deleteMany({});
    }
      await Promise.all(nextAssignments.map((assignment) =>
        tx.siteEmailConfigAssignment.upsert({
          where: { siteId: assignment.siteId },
          create: {
            siteId: assignment.siteId,
            configId: assignment.configId,
            updatedBy: params.actor
          },
          update: {
            configId: assignment.configId,
            updatedBy: params.actor
          }
        })
      ));
      return tx.platformEmailSettings.upsert({
        where: { id: "platform_email_settings" },
        create: {
          provider: "resend",
          apiKey: defaultConfig.apiKey,
          fromEmail: defaultConfig.fromEmail,
          replyTo: defaultConfig.replyTo,
          updatedBy: params.actor
        },
        update: {
          apiKey: defaultConfig.apiKey ?? currentApiKey ?? null,
          fromEmail: defaultConfig.fromEmail ?? current?.fromEmail,
          replyTo: defaultConfig.replyTo ?? current?.replyTo,
          updatedBy: params.actor
        }
      });
    });
  } catch (error) {
    if (shouldFallbackLegacyEmailConfig(error)) warnRelationalFallback("platform email settings write", error);
    throw error;
  }
  const settings = toPlatformEmailSettings(settingsRecord);
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_email_settings_updated",
    targetType: "platform_email_settings",
    targetId: "resend",
    metadata: {
      fromEmailConfigured: Boolean(settings.fromEmail),
      replyToConfigured: Boolean(settings.replyTo),
      apiKeyUpdated: Boolean(nextApiKey),
      configId: updatedConfig.id,
      siteAssignmentsUpdated: Boolean(params.siteAssignments)
    }
  });
  clearPlatformReadCache();
  return settings;
}

export async function upsertPlatformCloudflareAccountRelational(params: {
  id?: string;
  label: string;
  email: string;
  accountId: string;
  apiToken?: string;
  makeCurrent?: boolean;
  actor?: string;
}): Promise<PlatformCloudflareAccount> {
  const accountId = params.accountId.trim();
  const accountRecord = await prisma.$transaction(async (tx) => {
    const existing = params.id
      ? await tx.platformCloudflareAccount.findUnique({ where: { id: params.id } })
      : await tx.platformCloudflareAccount.findFirst({ where: { accountId } });
    const accountCount = await tx.platformCloudflareAccount.count();
    const record = existing
      ? await tx.platformCloudflareAccount.update({
          where: { id: existing.id },
          data: {
            label: params.label.trim(),
            email: params.email.trim().toLowerCase(),
            accountId,
            apiToken: params.apiToken?.trim() || existing.apiToken,
            updatedBy: params.actor
          }
        })
      : await tx.platformCloudflareAccount.create({
          data: {
            id: params.id ?? uid("cf"),
            label: params.label.trim(),
            email: params.email.trim().toLowerCase(),
            accountId,
            apiToken: params.apiToken?.trim() || "",
            updatedBy: params.actor
          }
        });
    if (params.makeCurrent || accountCount === 0) {
      await tx.platformSetting.upsert({
        where: { key: cloudflareCurrentAccountSettingKey },
        create: {
          id: cloudflareCurrentAccountSettingKey,
          key: cloudflareCurrentAccountSettingKey,
          value: { accountId: record.id },
          updatedBy: params.actor
        },
        update: {
          value: { accountId: record.id },
          updatedBy: params.actor
        }
      });
    }
    return record;
  });
  const account = toPlatformCloudflareAccount(accountRecord);
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_cloudflare_account_upserted",
    targetType: "platform_cloudflare_account",
    targetId: account.id,
    metadata: {
      label: account.label,
      email: account.email,
      accountIdConfigured: Boolean(account.accountId),
      apiTokenUpdated: Boolean(params.apiToken?.trim())
    }
  });
  clearPlatformReadCache();
  return account;
}

export async function setCurrentPlatformCloudflareAccountRelational(params: {
  accountId: string;
  actor?: string;
}): Promise<PlatformCloudflareAccount> {
  const account = toPlatformCloudflareAccount(await prisma.$transaction(async (tx) => {
    const accountRecord = await tx.platformCloudflareAccount.findUnique({ where: { id: params.accountId } });
    if (!accountRecord) throw new RelationalStoreError("cloudflare_account_not_found", 404);
    await tx.platformSetting.upsert({
      where: { key: cloudflareCurrentAccountSettingKey },
      create: {
        id: cloudflareCurrentAccountSettingKey,
        key: cloudflareCurrentAccountSettingKey,
        value: { accountId: params.accountId },
        updatedBy: params.actor
      },
      update: {
        value: { accountId: params.accountId },
        updatedBy: params.actor
      }
    });
    return tx.platformCloudflareAccount.update({
      where: { id: params.accountId },
      data: { updatedBy: params.actor }
    });
  }));
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_cloudflare_current_account_changed",
    targetType: "platform_cloudflare_account",
    targetId: account.id,
    metadata: {
      label: account.label,
      accountId: account.accountId
    }
  });
  clearPlatformReadCache();
  return account;
}

export async function clearCurrentPlatformCloudflareAccountRelational(params: {
  accountId?: string;
  actor?: string;
}): Promise<void> {
  const currentAccountId = params.accountId ?? await getCurrentCloudflareAccountIdRelational();
  if (!currentAccountId) return;
  const account = await prisma.platformCloudflareAccount.findUnique({ where: { id: currentAccountId } });
  if (!account) throw new RelationalStoreError("cloudflare_account_not_found", 404);
  await prisma.platformSetting.deleteMany({ where: { key: cloudflareCurrentAccountSettingKey } });
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_cloudflare_current_account_cleared",
    targetType: "platform_cloudflare_account",
    targetId: account.id,
    metadata: {
      label: account.label,
      accountId: account.accountId
    }
  });
  clearPlatformReadCache();
}

export async function deletePlatformCloudflareAccountRelational(params: {
  accountId: string;
  actor?: string;
}): Promise<PlatformCloudflareAccount> {
  const account = await prisma.platformCloudflareAccount.findUnique({ where: { id: params.accountId } });
  if (!account) throw new RelationalStoreError("cloudflare_account_not_found", 404);
  const currentAccountId = await getCurrentCloudflareAccountIdRelational();
  await prisma.$transaction(async (tx) => {
    await tx.platformCloudflareAccount.delete({ where: { id: account.id } });
    if (currentAccountId === account.id) {
      await tx.platformSetting.deleteMany({ where: { key: cloudflareCurrentAccountSettingKey } });
    }
  });
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_cloudflare_account_deleted",
    targetType: "platform_cloudflare_account",
    targetId: account.id,
    metadata: {
      label: account.label,
      accountId: account.accountId
    }
  });
  clearPlatformReadCache();
  return toPlatformCloudflareAccount(account);
}

export type PlatformAiProviderFallbackQueue = Array<Pick<PlatformAiProvider, "id" | "label" | "aiUrl" | "modelType" | "providerType" | "priority" | "preferred" | "enabled" | "supportsGenerationN" | "supportsEditN" | "maxImagesPerRequest" | "imageAspectRatio" | "imageResolution" | "imageQuality" | "imageOutputFormat" | "apiProtocol" | "videoModelFamily" | "videoDurations" | "videoAspectRatios" | "videoNativeSpeech">>;

function normalizeProviderMaxImagesPerRequest(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.min(Math.trunc(numeric), 20)) : 1;
}

function normalizeProviderVideoDurations(value: unknown) {
  if (!Array.isArray(value)) return [6, 10, 15];
  const normalized = [...new Set(value.map(Number).filter((duration) => [6, 10, 15].includes(duration)))].sort((a, b) => a - b);
  return normalized.length ? normalized : [6, 10, 15];
}

function normalizeProviderVideoAspectRatios(value: unknown) {
  if (!Array.isArray(value)) return ["9:16", "1:1", "16:9"];
  const normalized = [...new Set(value.filter((aspect) => aspect === "9:16" || aspect === "1:1" || aspect === "16:9"))];
  return normalized.length ? normalized : ["9:16", "1:1", "16:9"];
}

const platformAiProviderOrderBy: Prisma.PlatformAiProviderOrderByWithRelationInput[] = [
  { providerType: "asc" },
  { enabled: "desc" },
  { priority: "asc" },
  { preferred: "desc" },
  { label: "asc" }
];
const platformAiProviderTransactionOptions = {
  maxWait: Number(process.env.PLATFORM_AI_PROVIDER_TX_MAX_WAIT_MS ?? 10_000),
  timeout: Number(process.env.PLATFORM_AI_PROVIDER_TX_TIMEOUT_MS ?? 30_000)
} as const;

function platformAiProviderTypeWhere(providerType?: PlatformAiProviderType) {
  return providerType ? { providerType } : {};
}

async function setPreferredPlatformAiProviderForType(
  tx: Prisma.TransactionClient,
  params: { providerId: string; providerType: PlatformAiProviderType; actor?: string; makeTopPriority?: boolean }
) {
  await tx.platformAiProvider.updateMany({
    where: { providerType: params.providerType, id: { not: params.providerId } },
    data: { preferred: false }
  });
  return tx.platformAiProvider.update({
    where: { id: params.providerId },
    data: {
      preferred: true,
      enabled: true,
      ...(params.makeTopPriority ? { priority: 0 } : {}),
      updatedBy: params.actor
    }
  });
}

async function repairPreferredPlatformAiProviderForType(
  tx: Prisma.TransactionClient,
  providerType: PlatformAiProviderType,
  actor?: string
) {
  const preferred = await tx.platformAiProvider.findFirst({
    where: { providerType, enabled: true, preferred: true },
    select: { id: true }
  });
  if (preferred) return;
  const fallback = await tx.platformAiProvider.findFirst({
    where: { providerType, enabled: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  });
  if (!fallback) return;
  await setPreferredPlatformAiProviderForType(tx, { providerId: fallback.id, providerType, actor });
}

export async function listPlatformAiProvidersRelational(params: { providerType?: PlatformAiProviderType } = {}): Promise<PlatformAiProvider[]> {
  const records = await runPrismaReadWithReconnect(
    () => prisma.platformAiProvider.findMany({
      where: platformAiProviderTypeWhere(params.providerType),
      orderBy: platformAiProviderOrderBy
    }),
    { label: "platform AI providers list" }
  );
  return records.map(toPlatformAiProvider);
}

export async function getPlatformAiProviderRelational(providerId?: string): Promise<PlatformAiProvider | undefined> {
  if (!providerId) return undefined;
  const record = await runPrismaReadWithReconnect(
    () => prisma.platformAiProvider.findUnique({ where: { id: providerId } }),
    { label: "platform AI provider lookup" }
  );
  return record ? toPlatformAiProvider(record) : undefined;
}

export async function getPlatformAiProviderFallbackQueueRelational(providerType?: PlatformAiProviderType): Promise<PlatformAiProviderFallbackQueue> {
  const providers = await listPlatformAiProvidersRelational({ providerType });
  return providers.filter((provider) => aiProviderStatus(provider).runnable).map(({ id, label, aiUrl, modelType, providerType: type, priority, preferred, enabled, supportsGenerationN, supportsEditN, maxImagesPerRequest, imageAspectRatio, imageResolution, imageQuality, imageOutputFormat, apiProtocol, videoModelFamily, videoDurations, videoAspectRatios, videoNativeSpeech }) => ({
    id,
    label,
    aiUrl,
    modelType,
    providerType: type,
    priority,
    preferred,
    enabled,
    supportsGenerationN,
    supportsEditN,
    maxImagesPerRequest,
    imageAspectRatio,
    imageResolution,
    imageQuality,
    imageOutputFormat,
    apiProtocol,
    videoModelFamily,
    videoDurations,
    videoAspectRatios,
    videoNativeSpeech
  }));
}

function normalizeProviderPriority(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : Math.max(0, Math.trunc(fallback));
}

/** 积分只接受非负整数。 */
function normalizePriceCredits(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.trunc(numeric));
}

/** 维度价格矩阵归一化：键值保留，非法项丢弃。 */
function normalizeProviderPriceMatrix(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!value || typeof value !== "object" || Array.isArray(value)) return Prisma.JsonNull;
  const matrix: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsed = typeof raw === "number" || typeof raw === "string" ? Number(raw) : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < 0) continue;
    const trimmed = key.trim();
    if (!trimmed) continue;
    matrix[trimmed] = Math.trunc(parsed);
  }
  return Object.keys(matrix).length ? matrix : Prisma.JsonNull;
}

async function nextPlatformAiProviderPriorityForType(tx: Prisma.TransactionClient, providerType: PlatformAiProviderType): Promise<number> {
  const provider = await tx.platformAiProvider.findFirst({
    where: { providerType },
    select: { priority: true },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
  });
  return provider ? provider.priority + 1 : 0;
}

export async function upsertPlatformAiProviderRelational(params: {
  id?: string;
  label: string;
  aiUrl: string;
  apiKey?: string;
  modelType: string;
  providerType?: PlatformAiProviderType;
  priority?: unknown;
  makeCurrent?: boolean;
  enabled?: boolean;
  supportsGenerationN?: boolean;
  supportsEditN?: boolean;
  maxImagesPerRequest?: number;
  imageAspectRatio?: string;
  imageResolution?: string;
  imageQuality?: string;
  imageOutputFormat?: string;
  apiProtocol?: string;
  videoModelFamily?: string;
  videoDurations?: number[];
  videoAspectRatios?: string[];
  videoNativeSpeech?: boolean | null;
  priceEnabled?: boolean;
  priceCredits?: number;
  priceVideoDurations?: unknown;
  priceVideoResolutions?: unknown;
  priceImageQualities?: unknown;
  priceImageResolutions?: unknown;
  priceImageInput?: number;
  priceVideoInput?: number;
  priceVideoInputPerSecond?: number;
  priceAudioInput?: number;
  priceAudioInputPerSecond?: number;
  actor?: string;
}): Promise<PlatformAiProvider> {
  const existing = params.id ? await prisma.platformAiProvider.findUnique({ where: { id: params.id } }) : null;
  const aiUrl = params.aiUrl.trim() || existing?.aiUrl || "";
  const modelType = params.modelType.trim();
  const providerType = normalizePlatformAiProviderType(params.providerType, existing?.providerType ? normalizePlatformAiProviderType(existing.providerType) : inferPlatformAiProviderType({ label: params.label, aiUrl, modelType }));
  const providerRecord = await prisma.$transaction(async (tx) => {
    const existingProviderType = existing ? normalizePlatformAiProviderType(existing.providerType) : providerType;
    const providerCount = await tx.platformAiProvider.count({ where: { providerType } });
    const defaultPriority = await nextPlatformAiProviderPriorityForType(tx, providerType);
    const currentForType = await tx.platformAiProvider.findFirst({
      where: { providerType, enabled: true, preferred: true, ...(existing ? { id: { not: existing.id } } : {}) },
      select: { id: true }
    });
    const nextEnabled = params.makeCurrent ? true : params.enabled;
    const shouldPrefer = Boolean(params.makeCurrent || (!existing && providerCount === 0) || (!currentForType && (nextEnabled ?? existing?.enabled ?? true)));
    // 显式勾选“设为该类型优先供应商”时必须真正排到队首：排序键是 priority 优先于 preferred，
    // 只置 preferred 会让同类型内 priority 更小的通道继续排在前面（历史缺陷）。
    const nextPriority = params.makeCurrent
      ? 0
      : params.priority === undefined
        ? existing
          ? existingProviderType !== providerType ? defaultPriority : existing.priority
          : defaultPriority
        : normalizeProviderPriority(params.priority, existing?.priority ?? defaultPriority);
    const updated = existing
      ? await tx.platformAiProvider.update({
          where: { id: existing.id },
          data: {
            label: params.label.trim(),
            aiUrl,
            apiKey: params.apiKey?.trim() || existing.apiKey,
            modelType,
            providerType,
            priority: nextPriority,
            preferred: false,
            enabled: nextEnabled ?? existing.enabled,
            supportsGenerationN: params.supportsGenerationN ?? existing.supportsGenerationN,
            supportsEditN: params.supportsEditN ?? existing.supportsEditN,
            maxImagesPerRequest: normalizeProviderMaxImagesPerRequest(params.maxImagesPerRequest ?? existing.maxImagesPerRequest),
            imageAspectRatio: normalizeImageProviderAspectRatio(params.imageAspectRatio ?? existing.imageAspectRatio),
            imageResolution: normalizeImageProviderResolution(params.imageResolution ?? existing.imageResolution),
            imageQuality: normalizeImageProviderQuality(params.imageQuality ?? existing.imageQuality),
            imageOutputFormat: normalizeImageProviderOutputFormat(params.imageOutputFormat ?? existing.imageOutputFormat),
            apiProtocol: normalizeAiProviderProtocol(params.apiProtocol ?? existing.apiProtocol),
            videoModelFamily: params.videoModelFamily === "grok" || params.videoModelFamily === "gemini" ? params.videoModelFamily : params.videoModelFamily === "auto" ? "auto" : existing.videoModelFamily,
            videoDurations: normalizeProviderVideoDurations(params.videoDurations ?? existing.videoDurations),
            videoAspectRatios: normalizeProviderVideoAspectRatios(params.videoAspectRatios ?? existing.videoAspectRatios),
            videoNativeSpeech: params.videoNativeSpeech !== undefined ? params.videoNativeSpeech : existing.videoNativeSpeech,
            priceEnabled: params.priceEnabled ?? existing.priceEnabled ?? false,
            priceCredits: normalizePriceCredits(params.priceCredits ?? existing.priceCredits),
            priceVideoDurations: normalizeProviderPriceMatrix(params.priceVideoDurations ?? existing.priceVideoDurations),
            priceVideoResolutions: normalizeProviderPriceMatrix(params.priceVideoResolutions ?? existing.priceVideoResolutions),
            priceImageQualities: normalizeProviderPriceMatrix(params.priceImageQualities ?? existing.priceImageQualities),
            priceImageResolutions: normalizeProviderPriceMatrix(params.priceImageResolutions ?? existing.priceImageResolutions),
            priceImageInput: normalizePriceCredits(params.priceImageInput ?? existing.priceImageInput),
            priceVideoInput: normalizePriceCredits(params.priceVideoInput ?? existing.priceVideoInput),
            priceVideoInputPerSecond: normalizePriceCredits(params.priceVideoInputPerSecond ?? existing.priceVideoInputPerSecond),
            priceAudioInput: normalizePriceCredits(params.priceAudioInput ?? existing.priceAudioInput),
            priceAudioInputPerSecond: normalizePriceCredits(params.priceAudioInputPerSecond ?? existing.priceAudioInputPerSecond),
            updatedBy: params.actor
          }
        })
      : await tx.platformAiProvider.create({
          data: {
            id: uid("aiprov"),
            label: params.label.trim(),
            aiUrl,
            apiKey: params.apiKey?.trim() || undefined,
            modelType,
            providerType,
            priority: nextPriority,
            preferred: false,
            enabled: nextEnabled ?? true,
            supportsGenerationN: Boolean(params.supportsGenerationN),
            supportsEditN: Boolean(params.supportsEditN),
            maxImagesPerRequest: normalizeProviderMaxImagesPerRequest(params.maxImagesPerRequest),
            imageAspectRatio: normalizeImageProviderAspectRatio(params.imageAspectRatio),
            imageResolution: normalizeImageProviderResolution(params.imageResolution),
            imageQuality: normalizeImageProviderQuality(params.imageQuality),
            imageOutputFormat: normalizeImageProviderOutputFormat(params.imageOutputFormat),
            apiProtocol: normalizeAiProviderProtocol(params.apiProtocol),
            videoModelFamily: params.videoModelFamily === "grok" || params.videoModelFamily === "gemini" ? params.videoModelFamily : "auto",
            videoDurations: normalizeProviderVideoDurations(params.videoDurations),
            videoAspectRatios: normalizeProviderVideoAspectRatios(params.videoAspectRatios),
            videoNativeSpeech: params.videoNativeSpeech ?? null,
            priceEnabled: params.priceEnabled ?? false,
            priceCredits: normalizePriceCredits(params.priceCredits),
            priceVideoDurations: normalizeProviderPriceMatrix(params.priceVideoDurations),
            priceVideoResolutions: normalizeProviderPriceMatrix(params.priceVideoResolutions),
            priceImageQualities: normalizeProviderPriceMatrix(params.priceImageQualities),
            priceImageResolutions: normalizeProviderPriceMatrix(params.priceImageResolutions),
            priceImageInput: normalizePriceCredits(params.priceImageInput),
            priceVideoInput: normalizePriceCredits(params.priceVideoInput),
            priceVideoInputPerSecond: normalizePriceCredits(params.priceVideoInputPerSecond),
            priceAudioInput: normalizePriceCredits(params.priceAudioInput),
            priceAudioInputPerSecond: normalizePriceCredits(params.priceAudioInputPerSecond),
            updatedBy: params.actor
          }
        });
    if (shouldPrefer && updated.enabled) {
      await setPreferredPlatformAiProviderForType(tx, { providerId: updated.id, providerType, actor: params.actor, makeTopPriority: Boolean(params.makeCurrent && params.priority === undefined) });
      return tx.platformAiProvider.findUniqueOrThrow({ where: { id: updated.id } });
    }
    await repairPreferredPlatformAiProviderForType(tx, providerType, params.actor);
    if (existing && existingProviderType !== providerType) {
      await repairPreferredPlatformAiProviderForType(tx, existingProviderType, params.actor);
    }
    return tx.platformAiProvider.findUniqueOrThrow({ where: { id: updated.id } });
  }, platformAiProviderTransactionOptions);
  const provider = toPlatformAiProvider(providerRecord);
  if (!provider.label || !provider.modelType || (!existing && !provider.aiUrl)) throw new RelationalStoreError("invalid_ai_provider", 400);
  clearPlatformReadCache();
  return provider;
}

export async function setCurrentPlatformAiProviderRelational(params: {
  providerId: string;
  actor?: string;
}): Promise<PlatformAiProvider> {
  const provider = await prisma.$transaction(async (tx) => {
    const existing = await tx.platformAiProvider.findUnique({ where: { id: params.providerId } });
    if (!existing) throw new RelationalStoreError("ai_provider_not_found", 404);
    return setPreferredPlatformAiProviderForType(tx, {
      providerId: params.providerId,
      providerType: normalizePlatformAiProviderType(existing.providerType),
      actor: params.actor,
      makeTopPriority: true
    });
  }, platformAiProviderTransactionOptions);
  clearPlatformReadCache();
  return toPlatformAiProvider(provider);
}

export async function setPlatformAiProviderEnabledRelational(params: {
  providerId: string;
  enabled: boolean;
  actor?: string;
}): Promise<PlatformAiProvider> {
  const provider = await prisma.$transaction(async (tx) => {
    const existing = await tx.platformAiProvider.findUnique({ where: { id: params.providerId } });
    if (!existing) throw new RelationalStoreError("ai_provider_not_found", 404);
    const providerType = normalizePlatformAiProviderType(existing.providerType);

    if (params.enabled && existing.preferred) {
      await tx.platformAiProvider.updateMany({
        where: { providerType, id: { not: existing.id } },
        data: { preferred: false }
      });
    }

    const updated = await tx.platformAiProvider.update({
      where: { id: existing.id },
      data: { enabled: params.enabled, preferred: params.enabled ? existing.preferred : false, updatedBy: params.actor }
    });

    if (params.enabled) {
      await repairPreferredPlatformAiProviderForType(tx, providerType, params.actor);
      return updated;
    }

    if (existing.preferred) {
      await repairPreferredPlatformAiProviderForType(tx, providerType, params.actor);
    }

    return updated;
  }, platformAiProviderTransactionOptions);

  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: params.enabled ? "platform_ai_provider_enabled" : "platform_ai_provider_disabled",
    targetType: "platform_ai_provider",
    targetId: provider.id,
    metadata: {
      label: provider.label,
      aiUrl: provider.aiUrl,
      modelType: provider.modelType,
      providerType: provider.providerType
    }
  });
  clearPlatformReadCache();
  return toPlatformAiProvider(provider);
}

export async function deletePlatformAiProviderRelational(params: {
  providerId: string;
  actor?: string;
}): Promise<PlatformAiProvider> {
  const deleted = await prisma.$transaction(async (tx) => {
    const providers = await tx.platformAiProvider.findMany({ orderBy: platformAiProviderOrderBy });
    const existing = providers.find((provider) => provider.id === params.providerId);
    if (!existing) throw new RelationalStoreError("ai_provider_not_found", 404);
    if (providers.length <= 1) throw new RelationalStoreError("ai_provider_delete_last", 400);

    const domains = await tx.siteDomain.findMany({
      where: { allowedAiProviderIds: { has: params.providerId } },
      select: { id: true, allowedAiProviderIds: true }
    });
    await Promise.all(domains.map((domain) =>
      tx.siteDomain.update({
        where: { id: domain.id },
        data: { allowedAiProviderIds: domain.allowedAiProviderIds.filter((providerId) => providerId !== params.providerId) }
      })
    ));

    const record = await tx.platformAiProvider.delete({ where: { id: existing.id } });
    if (existing.preferred) {
      await repairPreferredPlatformAiProviderForType(tx, normalizePlatformAiProviderType(existing.providerType), params.actor);
    }
    return record;
  }, platformAiProviderTransactionOptions);

  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_ai_provider_deleted",
    targetType: "platform_ai_provider",
    targetId: deleted.id,
    metadata: {
      label: deleted.label,
      aiUrl: deleted.aiUrl,
      modelType: deleted.modelType,
      providerType: deleted.providerType
    }
  });
  const removed = toPlatformAiProvider(deleted);
  clearPlatformReadCache();
  return removed;
}
