import "server-only";

import { Prisma } from "@prisma/client";
import { cache } from "react";

import { canonicalSiteSlug, cleanHost, hostDomainCandidates, isPlatformHost, legacySiteSlugCandidates } from "@/lib/domain-routing";
import { suggestedCreativePackPrompt } from "@/lib/creative-pack-suggestions";
import { customerAssetRolesForSurface } from "@/lib/customer-asset-resource-agent";
import { runDbTasks } from "@/lib/db-concurrency";
import { isExplicitSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
import { prisma, runPrismaReadWithReconnect } from "@/lib/prisma";
import { mutateLocalPlatformStateFallback, readLocalPlatformStateFallback, readPlatformState } from "@/lib/server-store";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import { policyPageSlug } from "@/lib/site-route-canonical";
import { storefrontGalleryMediaPairs } from "@/lib/storefront-media-alt";
import { storefrontGlobalShellPageSlugs } from "@/lib/storefront-global-shell";
import { withStorefrontPublicWatermarkUrl } from "@/lib/storefront-public-watermark-url";
import { getPlatformAiProviderFallbackQueueRelational } from "@/lib/stores/platform-store";
import {
  isMydreamshootsVideoFrameworkSiteId,
  mydreamshootsVideoGenerationParentCategoriesForSite,
  parentVideoGenerationCategorySlugForChild,
  mydreamshootsVideoGenerationCategoriesForSite,
  mydreamshootsVideoGenerationThemeSeedsForSite
} from "@/lib/mydreamshoots-video-framework";
import { normalizePlatformAiProviderType, platformProviderTypeForAppType } from "@/lib/ai-provider-type";
import { shouldFallbackRelationalRead, shouldUseRelationalReadFallbackCircuit, warnRelationalFallback } from "@/lib/stores/relational-fallback";
import { isMydreamshootsContentSourceSiteId } from "@/lib/storefront-content-source-policy";
import { usesAiGenerationPublicRoutes } from "@/lib/storefront-context/capabilities";
import { videoProviderModelFamiliesForProviders } from "@/lib/video-provider-family";
import { runnableVideoProviderModelFamiliesForRequest } from "@/lib/video-provider-availability";
import { configuredVideoProviderFrameLimit, effectiveVideoFrameLimit, isVideoProviderModel } from "@/lib/video-provider-limits";
import { DEFAULT_VIDEO_FRAME_LIMIT, defaultVideoModelPricing, normalizeVideoFrameLimit, normalizeVideoModelPricing, type VideoModelPricing } from "@/lib/video-frame-config";
import { defaultVideoThemeExamplePrompt, normalizeVideoThemePromptOutputSettings, validateVideoPrompt } from "@/lib/video-prompt-format";
import { compileMydreamshootsVideoTopicPublication } from "@/lib/mydreamshoots-video-topic-publication";
import { resolvePublishedSaveTheDateGroups, resolvePublishedSaveTheDateNavigationGroups, type PublishedSaveTheDateGroup } from "@/lib/save-the-date-publication";
import type {
  AiGatewayGroup,
  AiProviderConfig,
  AiWorkflowConfig,
  AiWorkflowStep,
  AuditLogEntry,
  CreativePack,
  CreativePackCategory,
  GenerationJob,
  MediaAsset,
  PlatformState,
  Product,
  PublicSiteAdmin,
  PublicPlatformAdmin,
  Site,
  SiteAdmin,
  SiteAdminSession,
  SiteAiApp,
  SiteDomain,
  ThemePageJson,
  ThemePage,
  ThemePublication,
  PublishedVideoNavigationProjection,
  ToolMenuItem,
  VideoTheme,
  VideoThemeCategory,
  VideoThemeExample
} from "@/lib/types";
import type { PublishPreflightCreativePack, PublishPreflightMediaAsset, PublishPreflightProduct, PublishPreflightSiteAiApp } from "@/lib/theme/publish-preflight";

import {
  addAuditLogRelational,
  cloneJson,
  hashRelationalPassword,
  relationalSessionTtlMs,
  relationalUid,
  RelationalStoreError,
  slugify,
  toGatewayGroup,
  mapCreditLedger,
  mapCustomer,
  toCreativePack,
  toMediaAsset,
  toStorefrontProfile,
  toThemePage,
  toPublicSiteAdminRelational,
  toPublicPlatformAdminRelational,
  toAlbumRelational,
  toAssetUploadRelational,
  toCustomerModelRelational,
  mapGenerationJob,
  mapProduct,
  toSite,
  toSiteAdmin,
  toSiteAdminSessionRelational,
  toCustomerSessionRelational,
  toCreativePackCategory,
  toSiteAiApp,
  toSiteDomain,
  toToolCategory,
  toToolMenuItem,
  toVideoTheme,
  toVideoThemeExample,
  toVideoThemeCategory,
  uid,
  verifyRelationalPassword,
  type PrismaLike,
} from "./prisma-mappers";

const siteRuntimeInclude = {
  domains: true,
  pages: { orderBy: { slug: "asc" } },
  settings: true,
  storefrontProfile: true,
  connect: true
} satisfies Prisma.SiteInclude;

const liveStorefrontProfileSelect = {
  id: true,
  siteId: true,
  draftJson: true,
  draftMeta: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.StorefrontProfileSelect;

function envPositiveInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const siteAdminPrismaReadTimeoutMs = envPositiveInt(
  "SITE_ADMIN_PRISMA_READ_TIMEOUT_MS",
  process.env.NODE_ENV === "development" ? 10_000 : 3_000
);
const siteAdminSummaryReadTimeoutMs = envPositiveInt("SITE_ADMIN_SUMMARY_READ_TIMEOUT_MS", 8_000);
const siteAdminPrismaReadRetries = envPositiveInt("SITE_ADMIN_PRISMA_READ_RETRIES", 0);

const storefrontPublicTransactionConcurrency = envPositiveInt("STOREFRONT_PUBLIC_TX_CONCURRENCY", 6);
const storefrontPublicTransactionMaxWaitMs = envPositiveInt("STOREFRONT_PUBLIC_TX_MAX_WAIT_MS", 5_000);
const storefrontPublicTransactionTimeoutMs = envPositiveInt("STOREFRONT_PUBLIC_TX_TIMEOUT_MS", 30_000);

type StorefrontPublicTransactionGate = {
  active: number;
  waiters: Array<() => void>;
};

const storefrontPublicTransactionGate = (() => {
  const globalGate = globalThis as typeof globalThis & {
    __storefrontPublicTransactionGate?: StorefrontPublicTransactionGate;
  };
  globalGate.__storefrontPublicTransactionGate ??= { active: 0, waiters: [] };
  return globalGate.__storefrontPublicTransactionGate;
})();

async function withStorefrontPublicTransactionSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (storefrontPublicTransactionGate.active >= storefrontPublicTransactionConcurrency) {
    await new Promise<void>((resolve) => storefrontPublicTransactionGate.waiters.push(resolve));
  }
  storefrontPublicTransactionGate.active += 1;
  try {
    return await operation();
  } finally {
    storefrontPublicTransactionGate.active -= 1;
    storefrontPublicTransactionGate.waiters.shift()?.();
  }
}

function isStorefrontPublicTransactionStartTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code === "P2028" && error.message.includes("Unable to start a transaction");
}

async function runStorefrontPublicTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return withStorefrontPublicTransactionSlot(async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => operation(tx), {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          maxWait: storefrontPublicTransactionMaxWaitMs,
          timeout: storefrontPublicTransactionTimeoutMs
        });
      } catch (error) {
        if (attempt === 0 && isStorefrontPublicTransactionStartTimeout(error)) continue;
        throw error;
      }
    }
    throw new Error("Storefront public transaction retry exhausted.");
  });
}

type LocalSiteAdminSessionFallbackEntry = {
  site?: { id: string; slug: string };
  siteAdmin: PublicSiteAdmin;
  session: SiteAdminSession;
};

const localSiteAdminSessionFallbacks = new Map<string, LocalSiteAdminSessionFallbackEntry>();

function localSiteAdminSessionFallbackKey(siteId: string, sessionId: string): string {
  return `${siteId}:${sessionId}`;
}

function canUseLocalSiteAdminSessionFallback(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.PLATFORM_STATE_POSTGRES_STRICT !== "1";
}

function pruneLocalSiteAdminSessionFallbacks(now = Date.now()): void {
  for (const [key, entry] of localSiteAdminSessionFallbacks) {
    if (new Date(entry.session.expiresAt).getTime() <= now) {
      localSiteAdminSessionFallbacks.delete(key);
    }
  }
}

function rememberLocalSiteAdminSessionFallback(entry: LocalSiteAdminSessionFallbackEntry): void {
  if (!canUseLocalSiteAdminSessionFallback()) return;
  const expiresAt = new Date(entry.session.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return;
  pruneLocalSiteAdminSessionFallbacks();
  localSiteAdminSessionFallbacks.set(localSiteAdminSessionFallbackKey(entry.session.siteId, entry.session.id), entry);
  try {
    mutateLocalPlatformStateFallback((state) => {
      const siteAdmin = state.siteAdmins.find((item) => item.siteId === entry.session.siteId && item.id === entry.session.siteAdminId);
      if (!siteAdmin) return;
      state.siteAdminSessions = state.siteAdminSessions.filter((session) => session.id !== entry.session.id);
      state.siteAdminSessions.push(entry.session);
    });
  } catch {
    // JSON fallback mirroring is best-effort; the in-memory cache still covers the current dev server.
  }
}

function getLocalSiteAdminSessionFallback(siteId: string, sessionId?: string): LocalSiteAdminSessionFallbackEntry | undefined {
  if (!sessionId || !canUseLocalSiteAdminSessionFallback()) return undefined;
  pruneLocalSiteAdminSessionFallbacks();
  const entry = localSiteAdminSessionFallbacks.get(localSiteAdminSessionFallbackKey(siteId, sessionId));
  if (entry?.session.siteId === siteId) {
    const expiresAt = new Date(entry.session.expiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt > Date.now()) return entry;
    localSiteAdminSessionFallbacks.delete(localSiteAdminSessionFallbackKey(siteId, sessionId));
  }

  const state = readLocalPlatformStateFallback();
  const session = state?.siteAdminSessions.find((item) => item.siteId === siteId && item.id === sessionId && new Date(item.expiresAt).getTime() > Date.now());
  const siteAdmin = session ? state?.siteAdmins.find((item) => item.siteId === siteId && item.id === session.siteAdminId) : undefined;
  if (!state || !session || !siteAdmin) return undefined;
  const fallbackEntry: LocalSiteAdminSessionFallbackEntry = {
    site: state.sites.find((site) => site.id === siteId),
    siteAdmin: toPublicSiteAdminRelational({ ...siteAdmin }),
    session
  };
  localSiteAdminSessionFallbacks.set(localSiteAdminSessionFallbackKey(siteId, sessionId), fallbackEntry);
  return fallbackEntry;
}

function forgetLocalSiteAdminSessionFallback(siteId: string | undefined, sessionId: string): void {
  if (!canUseLocalSiteAdminSessionFallback()) return;
  if (siteId) {
    localSiteAdminSessionFallbacks.delete(localSiteAdminSessionFallbackKey(siteId, sessionId));
  } else {
    for (const [key, entry] of localSiteAdminSessionFallbacks) {
      if (entry.session.id === sessionId) localSiteAdminSessionFallbacks.delete(key);
    }
  }
  try {
    mutateLocalPlatformStateFallback((state) => {
      state.siteAdminSessions = state.siteAdminSessions.filter((session) =>
        siteId ? session.siteId !== siteId || session.id !== sessionId : session.id !== sessionId
      );
    });
  } catch {
    // Local fallback cleanup is best-effort.
  }
}

function runSiteAdminRead<T>(
  label: string,
  task: () => Promise<T>,
  options: { timeoutMs?: number } = {}
): Promise<T> {
  return runPrismaReadWithReconnect(task, {
    label,
    retries: siteAdminPrismaReadRetries,
    timeoutMs: options.timeoutMs ?? siteAdminPrismaReadTimeoutMs
  });
}

function isMissingToolMenuTableError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return code === "P2021" || /ToolCategory|ToolMenuItem/.test(message) && /does not exist|findMany/i.test(message);
}

function prismaErrorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
}

async function loadToolCategoriesForSite(siteId: string, options: { activeOnly?: boolean; take?: number } = {}) {
  const activeKey = options.activeOnly ? "active" : "all";
  const takeKey = options.take ?? "all";
  return siteReadCache.get(
    `tool-categories:${siteId}:${activeKey}:${takeKey}`,
    async () => {
      try {
        return await prisma.toolCategory.findMany({
          where: { siteId, ...(options.activeOnly ? { status: "active" } : {}) },
          include: { parent: true },
          orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
          ...(typeof options.take === "number" ? { take: options.take } : {})
        });
      } catch (error) {
        if (isMissingToolMenuTableError(error)) return [];
        if (shouldFallbackRelationalRead(error)) {
          warnRelationalFallback("storefront tool categories", error);
          const categories = readPlatformState().toolCategories
            .filter((category) => category.siteId === siteId && (!options.activeOnly || category.status === "active"))
            .sort((left, right) =>
              String(left.parentId ?? "").localeCompare(String(right.parentId ?? "")) ||
              left.sortOrder - right.sortOrder ||
              left.label.localeCompare(right.label)
            );
          return typeof options.take === "number" ? categories.slice(0, options.take) : categories;
        }
        throw error;
      }
    },
    0
  );
}

async function loadToolMenuItemsForSite(siteId: string, options: { activeOnly?: boolean; take?: number } = {}) {
  const activeKey = options.activeOnly ? "active" : "all";
  const takeKey = options.take ?? "all";
  return siteReadCache.get(
    `tool-menu-items:${siteId}:${activeKey}:${takeKey}`,
    async () => {
      try {
        return await prisma.toolMenuItem.findMany({
          where: { siteId, ...(options.activeOnly ? { status: "active" } : {}) },
          include: { category: { include: { parent: true } } },
          orderBy: options.activeOnly ? [{ sortOrder: "asc" }, { title: "asc" }] : [{ status: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
          ...(typeof options.take === "number" ? { take: options.take } : {})
        });
      } catch (error) {
        if (isMissingToolMenuTableError(error)) return [];
        if (shouldFallbackRelationalRead(error)) {
          warnRelationalFallback("storefront tool menu items", error);
          const categoriesById = new Map(readPlatformState().toolCategories.map((category) => [category.id, category]));
          const items = readPlatformState().toolMenuItems
            .filter((item) => item.siteId === siteId && (!options.activeOnly || item.status === "active"))
            .map((item) => ({
              ...item,
              category: item.category ?? (item.categoryId ? categoriesById.get(item.categoryId) : undefined)
            }))
            .sort((left, right) =>
              (options.activeOnly ? 0 : left.status.localeCompare(right.status)) ||
              left.sortOrder - right.sortOrder ||
              left.title.localeCompare(right.title)
            );
          return typeof options.take === "number" ? items.slice(0, options.take) : items;
        }
        throw error;
      }
    },
    0
  );
}

function isSynchronizedDreamshootNavigationSite(site: Pick<Site, "id" | "slug" | "name" | "primaryDomain"> & { branding: Pick<Site["branding"], "logoText"> } | { slug: string; name: string; branding: unknown; domains?: Array<{ domain: string; isPrimary: boolean }> }): boolean {
  const branding = typeof site.branding === "object" && site.branding ? site.branding as { logoText?: unknown } : {};
  const primaryDomain = "primaryDomain" in site
    ? site.primaryDomain
    : site.domains?.find((domain) => domain.isPrimary)?.domain ?? site.domains?.[0]?.domain ?? "";
  return usesAiGenerationPublicRoutes({ id: "id" in site ? site.id : "", slug: site.slug });
}

type StorefrontPublicNavigationData = {
  creativePackCategories: NonNullable<PlatformState["creativePackCategories"]>;
  creativePacks: NonNullable<PlatformState["creativePacks"]>;
  toolCategories: NonNullable<PlatformState["toolCategories"]>;
  toolMenuItems: NonNullable<PlatformState["toolMenuItems"]>;
  videoThemeCategories: NonNullable<PlatformState["videoThemeCategories"]>;
  videoThemes: NonNullable<PlatformState["videoThemes"]>;
};

type StorefrontPublicNavigationDataOptions = {
  creativePackTake?: number;
  toolMenuTake?: number;
};

export const getStorefrontPublicNavigationDataForSite = cache(async (siteId: string, options: StorefrontPublicNavigationDataOptions = {}): Promise<StorefrontPublicNavigationData> => {
  const creativePackTake = Number.isFinite(options.creativePackTake) ? Math.max(0, Math.floor(options.creativePackTake ?? 0)) : undefined;
  const toolMenuTake = Number.isFinite(options.toolMenuTake) ? Math.max(0, Math.floor(options.toolMenuTake ?? 0)) : undefined;
  const creativePackTakeKey = creativePackTake ?? "all";
  const toolMenuTakeKey = toolMenuTake ?? "all";
  return siteReadCache.get(
    `public-navigation:${siteId}:packs-${creativePackTakeKey}:tools-${toolMenuTakeKey}`,
    async () => {
      const [creativePacks, creativePackCategories, toolCategories, toolMenuItems, videoThemeCategories, videoThemes] = await runDbTasks([
        () => creativePackTake === 0 ? Promise.resolve([]) : getStorefrontPublicCreativePacksForSite(siteId, creativePackTake),
        () => getStorefrontPublicCreativePackCategoriesForSite(siteId),
        () => loadToolCategoriesForSite(siteId, { activeOnly: true }),
        () => toolMenuTake === 0 ? Promise.resolve([]) : loadToolMenuItemsForSite(siteId, { activeOnly: true, take: toolMenuTake }),
        () => getStorefrontPublicVideoThemeCategoriesForSite(siteId),
        () => getStorefrontPublicVideoThemesForSite(siteId)
      ]);
      return {
        creativePackCategories,
        creativePacks,
        toolCategories: toolCategories.map(toToolCategory),
        toolMenuItems: toolMenuItems.map(toToolMenuItem),
        videoThemeCategories,
        videoThemes
      };
    },
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 0)
  );
});

export const getStorefrontPublicVideoThemeCategoriesForSite = cache(async (siteId: string) => {
  return siteReadCache.get(
    `public-video-theme-categories:${siteId}`,
    async () => {
      try {
        const publicSlugWhere = isMydreamshootsVideoFrameworkSiteId(siteId)
          ? { slug: { notIn: ["text-to-video", "image-to-video"] } }
          : {};
        let rows = await prisma.videoThemeCategory.findMany({
          where: { siteId, status: "active", OR: [{ parentId: null }, { parent: { is: { status: "active" } } }], ...publicSlugWhere },
          include: { parent: true },
          orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
        });
        if (!rows.length && isMydreamshootsVideoFrameworkSiteId(siteId)) {
          await ensureDefaultVideoThemesRelational(siteId);
          rows = await prisma.videoThemeCategory.findMany({
            where: { siteId, status: "active", OR: [{ parentId: null }, { parent: { is: { status: "active" } } }], ...publicSlugWhere },
            include: { parent: true },
            orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
          });
        }
        return rows.map(toVideoThemeCategory);
      } catch (error) {
        if (isMydreamshootsContentSourceSiteId(siteId)) throw error;
        if (!shouldFallbackRelationalRead(error)) throw error;
        warnRelationalFallback("storefront public video theme categories", error);
        return (readPlatformState().videoThemeCategories ?? [])
          .filter((category) => category.siteId === siteId && category.status === "active" && (!category.parent || category.parent.status === "active") && !isBlockedPublicVideoTheme(siteId, category.slug))
          .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
      }
    },
    0
  );
});
const collectionDetailSiteSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  timezone: true,
  currency: true,
  signupCreditGrant: true,
  branding: true,
  domains: {
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
  livePages: {
    where: { slug: { in: ["/collections", "/ai-image-generation", "/404"] } },
    orderBy: { slug: "asc" },
    select: {
      id: true,
      siteId: true,
      pageType: true,
      templateKey: true,
      slug: true,
      title: true,
      contentJson: true
    }
  },
  connect: {
    select: {
      stripeAccountId: true,
      onboardingStatus: true,
      chargesEnabled: true,
      payoutsEnabled: true
    }
  },
  settings: {
    select: {
      draftJson: true,
    }
  },
  storefrontProfile: { select: liveStorefrontProfileSelect },
} satisfies Prisma.SiteSelect;
type CollectionDetailSiteRecord = Prisma.SiteGetPayload<{ select: typeof collectionDetailSiteSelect }>;
const publicRuntimeSiteSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  timezone: true,
  currency: true,
  signupCreditGrant: true,
  branding: true,
  domains: {
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
  livePages: {
    orderBy: { slug: "asc" },
    select: {
      id: true,
      siteId: true,
      pageType: true,
      templateKey: true,
      slug: true,
      title: true,
      contentJson: true
    }
  },
  connect: {
    select: {
      stripeAccountId: true,
      onboardingStatus: true,
      chargesEnabled: true,
      payoutsEnabled: true
    }
  },
  settings: {
    select: {
      draftJson: true,
    }
  },
  storefrontProfile: { select: liveStorefrontProfileSelect },
} satisfies Prisma.SiteSelect;
type PublicRuntimeSiteRecord = Prisma.SiteGetPayload<{ select: typeof publicRuntimeSiteSelect }>;
const customerRuntimeSiteSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  timezone: true,
  currency: true,
  signupCreditGrant: true,
  branding: true,
  domains: {
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
  livePages: {
    where: { slug: { in: ["/account", "/app", "/404"] } },
    orderBy: { slug: "asc" },
    select: {
      id: true,
      siteId: true,
      pageType: true,
      templateKey: true,
      slug: true,
      title: true,
      contentJson: true
    }
  },
  settings: {
    select: {
      draftJson: true
    }
  },
  connect: {
    select: {
      stripeAccountId: true,
      onboardingStatus: true,
      chargesEnabled: true,
      payoutsEnabled: true
    }
  },
  storefrontProfile: { select: liveStorefrontProfileSelect }
} satisfies Prisma.SiteSelect;
type CustomerRuntimeSiteRecord = Prisma.SiteGetPayload<{ select: typeof customerRuntimeSiteSelect }>;
const adminLoginSiteSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  timezone: true,
  currency: true,
  signupCreditGrant: true,
  primaryDomain: true,
  branding: true,
  pages: {
    select: {
      id: true,
      siteId: true,
      pageType: true,
      templateKey: true,
      slug: true,
      title: true
    }
  },
  connect: {
    select: {
      stripeAccountId: true,
      onboardingStatus: true,
      chargesEnabled: true,
      payoutsEnabled: true
    }
  },
  settings: {
    select: {
      draftJson: true,
    }
  },
  storefrontProfile: true
} satisfies Prisma.SiteSelect;
type AdminLoginSiteRecord = Prisma.SiteGetPayload<{ select: typeof adminLoginSiteSelect }>;
const publicMetadataSiteSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  timezone: true,
  currency: true,
  signupCreditGrant: true,
  primaryDomain: true,
  branding: true,
  domains: {
    select: {
      domain: true,
      isPrimary: true
    }
  },
  livePages: {
    select: {
      id: true,
      siteId: true,
      pageType: true,
      templateKey: true,
      slug: true,
      title: true,
      contentJson: true
    }
  },
  connect: {
    select: {
      stripeAccountId: true,
      onboardingStatus: true,
      chargesEnabled: true,
      payoutsEnabled: true
    }
  },
  settings: {
    select: {
      draftJson: true
    }
  },
  storefrontProfile: { select: liveStorefrontProfileSelect },
} satisfies Prisma.SiteSelect;
type PublicMetadataSiteRecord = Prisma.SiteGetPayload<{ select: typeof publicMetadataSiteSelect }>;
const collectionDetailCreativePackSelect = {
  id: true,
  siteId: true,
  categoryId: true,
  name: true,
  headline: true,
  description: true,
  prompt: true,
  category: true,
  aiAppSlug: true,
  status: true,
  creditCost: true,
  outputCount: true,
  trainingRequired: true,
  generationCount: true,
  conversionRate: true,
  imageUrl: true,
  galleryImages: true,
  galleryImageAlts: true,
  createdAt: true,
  categoryRecord: {
    select: {
      id: true,
      siteId: true,
      parentId: true,
      slug: true,
      label: true,
      description: true,
      heroTitle: true,
      heroSubtitle: true,
      icon: true,
      imageUrl: true,
      sortOrder: true,
      status: true,
      createdAt: true,
      parent: {
        select: {
          id: true,
          siteId: true,
          parentId: true,
          slug: true,
          label: true,
          description: true,
          heroTitle: true,
          heroSubtitle: true,
          icon: true,
          imageUrl: true,
          sortOrder: true,
          status: true,
          createdAt: true
        }
      }
    }
  }
} satisfies Prisma.CreativePackSelect;
const publicRuntimeCreativePackSelect = {
  id: true,
  siteId: true,
  categoryId: true,
  name: true,
  headline: true,
  description: true,
  category: true,
  aiAppSlug: true,
  status: true,
  creditCost: true,
  outputCount: true,
  trainingRequired: true,
  generationCount: true,
  conversionRate: true,
  imageUrl: true,
  galleryImages: true,
  galleryImageAlts: true,
  createdAt: true,
  categoryRecord: collectionDetailCreativePackSelect.categoryRecord
} satisfies Prisma.CreativePackSelect;
type PublicRuntimeCreativePackRecord = Prisma.CreativePackGetPayload<{ select: typeof publicRuntimeCreativePackSelect }>;
const publicRuntimeCreativePackCategorySelect = collectionDetailCreativePackSelect.categoryRecord.select satisfies Prisma.CreativePackCategorySelect;
const publicRuntimeSiteAiAppSelect = {
  id: true,
  siteId: true,
  enabled: true,
  creditCost: true,
  routeKey: true,
  aiApp: {
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      appType: true
    }
  }
} satisfies Prisma.SiteAiAppSelect;
type PublicRuntimeSiteAiAppRecord = Prisma.SiteAiAppGetPayload<{ select: typeof publicRuntimeSiteAiAppSelect }>;
const publicRuntimeMediaAssetSelect = {
  id: true,
  siteId: true,
  label: true,
  storageKey: true,
  mimeType: true,
  usageType: true,
  sourceType: true,
  previewUrl: true,
  originUrl: true,
  altText: true,
  createdAt: true
} satisfies Prisma.MediaAssetSelect;
const emptyThemePageJson = {
  pageType: "content",
  version: 1,
  sectionsOrder: [],
  sections: {}
} satisfies ThemePage["draftJson"];
const siteReadCache = createServerTtlCache("site-store", Number(process.env.SITE_READ_CACHE_TTL_MS ?? 120_000));
function instantDraftPreviewEnabled(): boolean {
  return process.env.DINGYUE_ENV === "local" && process.env.STOREFRONT_INSTANT_DRAFT_PREVIEW !== "0";
}
const customerRuntimeLimits = {
  products: 60,
  siteAiApps: 40,
  creativePacks: 60,
  mediaAssets: 120,
  subscriptions: 12,
  orders: 24,
  jobs: 80,
  assetUploads: 120,
  ledger: 80,
  customerModels: 12,
  albums: 40
} as const;
const workspaceCustomerRuntimeLimits = {
  products: 24,
  siteAiApps: 40,
  creativePacks: 60,
  mediaAssets: 80,
  subscriptions: 4,
  orders: 6,
  jobs: 8,
  assetUploads: 24,
  ledger: 12,
  customerModels: 4,
  albums: 8
} as const;

function localSiteBySlugForAdmin(slug: string): Site | undefined {
  const state = readLocalPlatformStateFallback();
  if (!state) return undefined;
  const candidates = new Set(
    legacySiteSlugCandidates(slug)
      .map((candidate) => candidate.trim().toLowerCase())
      .filter(Boolean)
  );
  candidates.add(canonicalSiteSlug(slug));
  const cleanedHost = cleanHost(slug);
  if (cleanedHost) candidates.add(cleanedHost);
  const site = state.sites.find((item) =>
    candidates.has(item.slug.trim().toLowerCase()) ||
    candidates.has(item.primaryDomain.trim().toLowerCase())
  );
  return site ? cloneJson(site) : undefined;
}

function localSiteByIdForAdmin(siteId: string): Site | undefined {
  const state = readLocalPlatformStateFallback();
  const site = state?.sites.find((item) => item.id === siteId);
  return site ? cloneJson(site) : undefined;
}

function localFirstSiteAdminEmail(siteId: string): string | undefined {
  const state = readLocalPlatformStateFallback();
  return state?.siteAdmins
    .filter((admin) => admin.siteId === siteId)
    .sort((left, right) => String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")))
    .at(0)?.email;
}
const accountCustomerRuntimeLimits = {
  products: 0,
  siteAiApps: 0,
  creativePacks: 0,
  mediaAssets: 0,
  subscriptions: 2,
  orders: 12,
  jobs: 12,
  assetUploads: 24,
  ledger: 4,
  customerModels: 0,
  albums: 12
} as const;
type CustomerRuntimeSection = "summary" | "plan" | "orders" | "jobs" | "albums" | "credits";
const fullSiteRuntimeLimits = {
  customers: 50,
  customerSessions: 50,
  subscriptions: 80,
  orders: 120,
  jobs: 120,
  assetUploads: 160,
  ledger: 120,
  customerModels: 60,
  albums: 80
} as const;

function toAdminShellThemeSettings(record?: { draftJson?: unknown; publishedJson?: unknown } | null): Site["themeSettings"] {
  const toShellSettings = (value: unknown): Site["themeSettings"]["draftJson"] => {
    const settings = cloneJson(value ?? {}) as Partial<Site["themeSettings"]["draftJson"]>;
    return {
      colors: {
        background: settings.colors?.background ?? "",
        foreground: settings.colors?.foreground ?? "",
        accent: settings.colors?.accent ?? "",
        muted: settings.colors?.muted ?? ""
      },
      typography: {
        display: settings.typography?.display ?? "",
        body: settings.typography?.body ?? ""
      },
      radii: {
        section: settings.radii?.section ?? 0,
        control: settings.radii?.control ?? 0
      },
      navigation: {
        headerLinks: settings.navigation?.headerLinks ?? [],
        footerLinks: settings.navigation?.footerLinks ?? []
      },
      aidreamcapesZipNavigation: settings.aidreamcapesZipNavigation,
      saveTheDateNavigation: settings.saveTheDateNavigation,
      globalSections: settings.globalSections,
      seo: settings.seo
        ? {
            siteTitle: settings.seo.siteTitle ?? "",
            siteDescription: settings.seo.siteDescription ?? "",
            titleTemplate: settings.seo.titleTemplate ?? "",
            defaultOgImage: settings.seo.defaultOgImage,
            robots: settings.seo.robots ?? { index: true, follow: true },
            pages: {}
          }
        : undefined,
      saasSettingsCurrent: settings.saasSettingsCurrent
    };
  };
  const publishedJson = record?.publishedJson ?? record?.draftJson;
  return {
    draftJson: toShellSettings(record?.draftJson ?? publishedJson),
    publishedJson: toShellSettings(publishedJson)
  };
}

export function clearSiteReadCache(): void {
  siteReadCache.clear();
}

export type StorefrontAccessSite = {
  id: string;
  name: string;
  slug: string;
  status: Site["status"];
  primaryDomain: string;
  branding: Site["branding"];
  adminEmail?: string;
  customerEmail?: string;
};

export type StorefrontAccessSummary = {
  sites: StorefrontAccessSite[];
  totalSites: number;
  activeSites: number;
  runningJobs: number;
  platformAdmin?: PublicPlatformAdmin;
};

function emptyPlatformState(overrides: Partial<PlatformState> = {}): PlatformState {
  return {
    platformAdmins: [],
    platformSessions: [],
    platformEmailConfigs: [],
    siteEmailConfigAssignments: [],
    platformCloudflareAccounts: [],
    sites: [],
    siteDomains: [],
    siteAdmins: [],
    siteAdminSessions: [],
    customers: [],
    customerSessions: [],
    products: [],
    subscriptions: [],
    orders: [],
    paymentEvents: [],
    aiApps: [],
    siteAiApps: [],
    toolCategories: [],
    toolMenuItems: [],
    aiGatewayGroups: [],
    creativePackCategories: [],
    creativePacks: [],
    videoThemeCategories: [],
    videoThemes: [],
    mediaAssets: [],
    themePublications: [],
    siteThemes: [],
    themeCopies: [],
    customerModels: [],
    albums: [],
    auditLogs: [],
    jobs: [],
    assetUploads: [],
    ledger: [],
    platformAiProviders: [],
    ...overrides
  };
}

function toPublicSiteShell(
  record: CollectionDetailSiteRecord | CustomerRuntimeSiteRecord | PublicRuntimeSiteRecord | PublicMetadataSiteRecord,
  mediaAssets: MediaAsset[] = []
): Site {
  const primaryDomain = record.domains.find((domain) => domain.isPrimary)?.domain ?? record.domains[0]?.domain ?? "";
  const settingsRecord = "settings" in record ? record.settings : undefined;
  const profileRecord = "storefrontProfile" in record ? record.storefrontProfile : undefined;
  const shellThemeSettings = toAdminShellThemeSettings(settingsRecord);
  // LivePage-backed public SSR treats the current relational draft as the
  // live navigation/settings projection too. Keeping the historical
  // `publishedJson` value here makes menus lag behind taxonomy updates even
  // after the page content has been synchronized.
  const publicThemeSettings = "livePages" in record
    ? { ...shellThemeSettings, publishedJson: shellThemeSettings.draftJson }
    : shellThemeSettings;
  const pageRecords = record.livePages.map((page) => ({
    ...page,
    draftJson: page.contentJson,
    publishedJson: page.contentJson
  }));
  const publicProfile = profileRecord
    ? "livePages" in record
      ? toStorefrontProfile({ ...profileRecord, publishedJson: profileRecord.draftJson })
      : toStorefrontProfile(profileRecord)
    : undefined;
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status as Site["status"],
    primaryDomain,
    currency: record.currency,
    timezone: record.timezone,
    signupCreditGrant: Math.max(0, Math.trunc(Number(record.signupCreditGrant ?? 0))),
    branding: cloneJson(record.branding) as Site["branding"],
    connect: {
      stripeAccountId: record.connect?.stripeAccountId ?? `acct_pending_${record.slug}`,
      status: (record.connect?.onboardingStatus ?? "pending") as Site["connect"]["status"],
      chargesEnabled: Boolean(record.connect?.chargesEnabled),
      payoutsEnabled: Boolean(record.connect?.payoutsEnabled)
    },
    themeSettings: publicThemeSettings,
    storefrontProfile: publicProfile,
    // ThemePage is an internal compatibility shape only. Public data comes
    // exclusively from LivePage.contentJson and has no fallback source.
    pages: pageRecords.map((page) => toThemePage(page)),
    mediaAssets
  };
}

function toAdminLoginSiteShell(record: AdminLoginSiteRecord): Site {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status as Site["status"],
    primaryDomain: record.primaryDomain,
    currency: record.currency,
    timezone: record.timezone,
    signupCreditGrant: Math.max(0, Math.trunc(Number(record.signupCreditGrant ?? 0))),
    branding: cloneJson(record.branding) as Site["branding"],
    connect: {
      stripeAccountId: record.connect?.stripeAccountId ?? `acct_pending_${record.slug}`,
      status: (record.connect?.onboardingStatus ?? "pending") as Site["connect"]["status"],
      chargesEnabled: Boolean(record.connect?.chargesEnabled),
      payoutsEnabled: Boolean(record.connect?.payoutsEnabled)
    },
    themeSettings: toAdminShellThemeSettings(record.settings),
    pages: record.pages.map((page) => ({
      id: page.id,
      siteId: page.siteId,
      pageType: page.pageType as ThemePage["pageType"],
      templateKey: page.templateKey ?? undefined,
      slug: page.slug,
      title: page.title,
      draftJson: emptyThemePageJson,
      publishedJson: emptyThemePageJson
    })),
    mediaAssets: []
  };
}

async function getSiteRelational(siteId: string): Promise<Site> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: siteRuntimeInclude
  });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  return toSite(site);
}

async function getSiteByHostRelational(host: string | null | undefined): Promise<Site | undefined> {
  const value = cleanHost(host);
  if (!value || isPlatformHost(value) || value === "localhost" || value === "127.0.0.1") return undefined;
  const candidates = hostDomainCandidates(value);

  const activeDomain = await prisma.siteDomain.findFirst({
    where: { domain: { in: candidates }, status: "active" },
    include: { site: { include: siteRuntimeInclude } }
  });
  if (activeDomain?.site) return toSite(activeDomain.site);

  const anyDomain = await prisma.siteDomain.findFirst({
    where: { domain: { in: candidates } },
    include: { site: { include: siteRuntimeInclude } }
  });
  if (anyDomain?.site) return toSite(anyDomain.site);

  const primaryDomainSite = await prisma.site.findFirst({
    where: { primaryDomain: { in: candidates } },
    include: siteRuntimeInclude
  });
  return primaryDomainSite ? toSite(primaryDomainSite) : undefined;
}

export const getStorefrontSiteByHostRelational = cache(async (host: string | null | undefined): Promise<Site | undefined> => {
  // Host resolution is part of the public SSR request. Keep only React's
  // per-request memoization; never reuse a cross-request site shell.
  return getSiteByHostRelational(host);
});

function publicRuntimePageSlugs(slug?: string): string[] | undefined {
  if (!slug) return undefined;
  const normalized = slug === "/" ? "/" : slug.startsWith("/") ? slug : `/${slug}`;
  const legacySlugs = normalized === "/faq" ? ["/help"] : [];
  const internalPolicySlug = policyPageSlug(normalized);
  const policySourceSlugs = normalized === "/privacy"
    ? ["/privacy", "/privacy-policy", "/policies/privacy", "/policies/privacy-policy"]
    : normalized === "/terms"
      ? ["/terms", "/terms-of-service", "/policies/terms", "/policies/terms-of-service"]
      : [];
  return Array.from(new Set([normalized, internalPolicySlug, ...legacySlugs, ...policySourceSlugs, "/404"]));
}

function publicRuntimePageWhere(pageSlugs?: string[]): Prisma.LivePageWhereInput | undefined {
  if (!pageSlugs) return undefined;
  const includeBlogPages = pageSlugs.some((slug) => slug === "/blog" || slug.startsWith("/blog/"));
  return includeBlogPages
    ? { OR: [{ slug: { in: pageSlugs } }, { slug: { startsWith: "/blog/" } }] }
    : { slug: { in: pageSlugs } };
}

function publicRuntimeNeeds(pageSlugs?: string[], contextSlug?: string, indexing = false) {
  if (indexing) {
    return {
      profile: "indexing" as const,
      products: true,
      siteAiApps: true,
      creativePacks: true,
      mediaAssets: true,
      toolMenus: true,
      videoThemes: true,
      contextSlug: ""
    };
  }
  const slugs = pageSlugs ?? [];
  const primary = slugs.find((slug) => slug !== "/404") ?? "/";
  const isHome = primary === "/";
  const isPricing = primary === "/pricing";
  const isCart = primary === "/cart";
  const isTools = primary === "/tools" || primary.startsWith("/tools/");
  const isToolDetail = primary.startsWith("/tools/") && Boolean(contextSlug);
  const isCollections =
    primary === "/collections" ||
    primary.startsWith("/collections/") ||
    primary === "/ai-image-generation" ||
    primary.startsWith("/ai-image-generation/");
  const isCollectionDetail = isCollections && Boolean(contextSlug);
  const isBestPackagePage = primary === "/best-packages";
  const isBestMediaPage = primary === "/best-ai-image" || primary === "/best-ai-video";
  const isBestSaveTheDatePage = primary === "/best-save-the-date";
  const isWorkspace = primary === "/app";
  const isEditorialThemeDetail = /^\/(?:ai-save-the-date|holidays-events)\//.test(primary);
  const needsVideoThemes =
    isHome ||
    isTools ||
    isWorkspace ||
    primary === "/ai-video-generation" ||
    primary.startsWith("/ai-video-generation/") ||
    isBestMediaPage ||
    isBestSaveTheDatePage ||
    isEditorialThemeDetail;
  return {
    profile: isHome ? "home" : isPricing || isCart ? "pricing" : isTools ? "tools" : isCollectionDetail ? "collection-detail" : isBestMediaPage ? "best-media" : isBestSaveTheDatePage ? "save-the-date" : isCollections || isBestPackagePage ? "collections" : isWorkspace ? "workspace" : isEditorialThemeDetail ? "editorial" : "page",
    products: isHome || isPricing || isCart || isCollectionDetail,
    siteAiApps: isTools || isWorkspace,
    creativePacks: isHome || (isTools && !isToolDetail) || isCollections || isBestPackagePage || isBestMediaPage || isWorkspace,
    // Public projections validate and render media manifests from the same
    // live SQL bundle.  A truncated asset set makes otherwise valid pages
    // look unpublished (and hides Save the Date navigation), so include the
    // complete public media set for catalogue and editorial pages.
    mediaAssets: isHome || isWorkspace || isBestSaveTheDatePage || isBestMediaPage || isEditorialThemeDetail,
    toolMenus: true,
    videoThemes: needsVideoThemes,
    contextSlug: contextSlug ? slugify(contextSlug) : ""
  };
}

function publicRuntimeLimits(profile: ReturnType<typeof publicRuntimeNeeds>["profile"]) {
  return {
    products: profile === "pricing" ? 12 : 8,
    siteAiApps: profile === "indexing" ? undefined : profile === "tools" ? 96 : profile === "home" ? 24 : 48,
    creativePacks: profile === "collection-detail" ? 12 : profile === "best-media" ? undefined : profile === "collections" ? 128 : profile === "tools" ? 96 : profile === "home" ? 8 : 24,
    mediaAssets: profile === "indexing" || profile === "home" || profile === "save-the-date" || profile === "best-media" || profile === "editorial"
      ? undefined
      : profile === "workspace" ? 40 : 0
  };
}

function toPublicRuntimeSiteAiApp(record: PublicRuntimeSiteAiAppRecord): SiteAiApp {
  return {
    id: record.id,
    siteId: record.siteId,
    enabled: record.enabled,
    creditCost: record.creditCost,
    routeKey: record.routeKey,
    workflowConfig: undefined,
    providerConfig: undefined,
    aiApp: {
      id: record.aiApp.id,
      slug: record.aiApp.slug,
      name: record.aiApp.name,
      description: record.aiApp.description,
      appType: record.aiApp.appType as SiteAiApp["aiApp"]["appType"],
      parameterSchema: []
    }
  };
}

function toPublicRuntimeCreativePack(record: PublicRuntimeCreativePackRecord): CreativePack {
  const pack = toCreativePack(record);
  const galleryMedia = storefrontGalleryMediaPairs(pack.galleryImages, pack.galleryImageAlts, 12);
  const categoryRecord = pack.categoryRecord
    ? {
        id: pack.categoryRecord.id,
        siteId: "",
        parentId: pack.categoryRecord.parentId,
        parent: pack.categoryRecord.parent
          ? {
              id: pack.categoryRecord.parent.id,
              siteId: "",
              parentId: pack.categoryRecord.parent.parentId,
              slug: pack.categoryRecord.parent.slug,
              label: pack.categoryRecord.parent.label,
              description: pack.categoryRecord.parent.description,
              icon: pack.categoryRecord.parent.icon,
              iconName: pack.categoryRecord.parent.iconName,
              sortOrder: 0,
              status: "active" as const,
              createdAt: ""
            }
          : undefined,
        slug: pack.categoryRecord.slug,
        label: pack.categoryRecord.label,
        description: pack.categoryRecord.description,
        icon: pack.categoryRecord.icon,
        iconName: pack.categoryRecord.iconName,
        imageUrl: pack.categoryRecord.imageUrl,
        sortOrder: 0,
        status: "active" as const,
        createdAt: ""
      }
    : undefined;
  return {
    ...pack,
    prompt: undefined,
    galleryImages: galleryMedia.galleryImages,
    galleryImageAlts: galleryMedia.galleryImageAlts,
    categoryRecord
  };
}

function fallbackPublicCreativePackCategoriesForSite(siteId: string): CreativePackCategory[] {
  const state = readPlatformState();
  const categories = state.creativePackCategories ?? [];
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  return categories
    .filter((category) => category.siteId === siteId && category.status === "active")
    .map((category) => ({
      ...category,
      parent: category.parent ?? (category.parentId ? categoriesById.get(category.parentId) : undefined)
    }))
    .sort((left, right) =>
      String(left.parentId ?? "").localeCompare(String(right.parentId ?? "")) ||
      left.sortOrder - right.sortOrder ||
      left.label.localeCompare(right.label)
    );
}

function fallbackPublicCreativePacksForSite(siteId: string, take?: number): CreativePack[] {
  const categoriesById = new Map(fallbackPublicCreativePackCategoriesForSite(siteId).map((category) => [category.id, category]));
  const packs = (readPlatformState().creativePacks ?? [])
    .filter((pack) => pack.siteId === siteId && pack.status === "active")
    .map((pack) => toPublicRuntimeCreativePack({
      ...pack,
      categoryRecord: pack.categoryRecord ?? (pack.categoryId ? categoriesById.get(pack.categoryId) : undefined)
    } as unknown as PublicRuntimeCreativePackRecord))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return typeof take === "number" ? packs.slice(0, take) : packs;
}

function fallbackSiteBySlug(slug: string): Site | undefined {
  const candidates = new Set(legacySiteSlugCandidates(slug));
  return readPlatformState().sites.find((site) => candidates.has(site.slug));
}

function fallbackCustomerWorkspaceSiteShell(slug: string): CustomerWorkspaceBootstrapRelational["site"] | undefined {
  const site = fallbackSiteBySlug(slug);
  if (!site) return undefined;
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    primaryDomain: site.primaryDomain,
    branding: cloneJson(site.branding) as Site["branding"]
  };
}

function fallbackCustomerWorkspaceSiteAiApps(siteId: string): SiteAiApp[] {
  return (readPlatformState().siteAiApps ?? [])
    .filter((siteAiApp) => siteAiApp.siteId === siteId && siteAiApp.enabled)
    .sort((left, right) => left.routeKey.localeCompare(right.routeKey))
    .slice(0, workspaceCustomerRuntimeLimits.siteAiApps);
}

function fallbackPublicVideoThemesForSite(siteId: string, take?: number): VideoTheme[] {
  const state = readPlatformState();
  const activeThemes = (state.videoThemes ?? [])
    .filter((theme) => theme.siteId === siteId && theme.status === "active" && !isBlockedPublicVideoTheme(siteId, theme.slug))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const themes = typeof take === "number" ? activeThemes.slice(0, take) : activeThemes;
  const providers = (state.platformAiProviders ?? []).filter((provider) =>
    provider.enabled !== false &&
    Boolean(provider.aiUrl?.trim()) &&
    Boolean(provider.apiKey?.trim()) &&
    (provider.providerType === "video" || isVideoProviderModel(provider.modelType))
  );
  const providerMaxFrames = configuredVideoProviderFrameLimit(providers);
  const providerModelFamilies = videoProviderModelFamiliesForProviders(providers);
  const textToVideoProviderModelFamilies = runnableVideoProviderModelFamiliesForRequest(providers, { referenceAssetCount: 0 });
  const imageToVideoProviderModelFamilies = runnableVideoProviderModelFamiliesForRequest(providers, { referenceAssetCount: 1 });
  return themes.map((theme) => ({
    ...theme,
    effectiveMaxFrames: effectiveVideoFrameLimit([], theme.maxFrames),
    providerMaxFrames,
    providerModelFamilies,
    textToVideoProviderModelFamilies,
    imageToVideoProviderModelFamilies
  }));
}

function isBlockedPublicVideoTheme(siteId: string, slug: string): boolean {
  return isMydreamshootsVideoFrameworkSiteId(siteId) && ["text-to-video", "image-to-video", "creator-scene-motion"].includes(slug);
}

function storefrontPerfMark(label: string, startedAt: number, meta: Record<string, unknown> = {}) {
  if (process.env.STOREFRONT_PROFILE !== "1") return;
  console.info("[storefront:public-runtime]", label, {
    ms: Date.now() - startedAt,
    ...meta
  });
}

export const getStorefrontPublicRuntimeStateForSite = cache(async (siteId: string, pageSlug?: string, contextSlug?: string): Promise<PlatformState | undefined> => {
  const pageSlugs = publicRuntimePageSlugs(pageSlug);
  const pageKey = pageSlugs?.join("|") ?? "all";
  const contextKey = contextSlug ? slugify(contextSlug) : "none";
  return siteReadCache.get(
    `public-runtime:${siteId}:${pageKey}:${contextKey}`,
    () => loadStorefrontPublicRuntimeState({ id: siteId }, pageSlugs, contextSlug),
    0
  );
});

export const getStorefrontPublicCreativePacksForSite = cache(async (siteId: string, take?: number) => {
  const takeKey = typeof take === "number" ? String(take) : "all";
  return siteReadCache.get(
    `public-creative-packs:${siteId}:${takeKey}`,
    async () => {
      try {
        const rows = await prisma.creativePack.findMany({
          where: { siteId, status: "active" },
          select: publicRuntimeCreativePackSelect,
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
          ...(typeof take === "number" ? { take } : {})
        });
        return rows.map(toPublicRuntimeCreativePack);
      } catch (error) {
        if (isMydreamshootsContentSourceSiteId(siteId)) throw error;
        if (!shouldFallbackRelationalRead(error)) throw error;
        warnRelationalFallback("storefront public creative packs", error);
        return fallbackPublicCreativePacksForSite(siteId, take);
      }
    },
    0
  );
});

export const getStorefrontPublicCreativePackCategoriesForSite = cache(async (siteId: string) => {
  return siteReadCache.get(
    `public-creative-pack-categories:${siteId}`,
    async () => {
      try {
        const rows = await prisma.creativePackCategory.findMany({
          where: { siteId, status: "active" },
          select: publicRuntimeCreativePackCategorySelect,
          orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
        });
        return rows.map(toCreativePackCategory);
      } catch (error) {
        if (isMydreamshootsContentSourceSiteId(siteId)) throw error;
        if (!shouldFallbackRelationalRead(error)) throw error;
        warnRelationalFallback("storefront public creative pack categories", error);
        return fallbackPublicCreativePackCategoriesForSite(siteId);
      }
    },
    0
  );
});

export const getStorefrontPublicVideoThemesForSite = cache(async (siteId: string, take?: number) => {
  const takeKey = typeof take === "number" ? String(take) : "all";
  const publicSlugWhere = isMydreamshootsVideoFrameworkSiteId(siteId)
    ? { slug: { notIn: ["text-to-video", "image-to-video"] } }
    : {};
  return siteReadCache.get(
    `public-video-themes:${siteId}:${takeKey}`,
    async () => {
      try {
        let rows = await prisma.videoTheme.findMany({
          where: {
            siteId,
            status: "active",
            ...publicSlugWhere,
            OR: [
              { categoryId: null },
              { category: { is: { status: "active", OR: [{ parentId: null }, { parent: { is: { status: "active" } } }] } } }
            ]
          },
          include: {
            category: true,
            examples: {
              where: { status: "active" },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
            }
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          ...(typeof take === "number" ? { take } : {})
        });
        if (!rows.length) {
          await ensureDefaultVideoThemesRelational(siteId);
          rows = await prisma.videoTheme.findMany({
            where: {
              siteId,
              status: "active",
              ...publicSlugWhere,
              OR: [
                { categoryId: null },
                { category: { is: { status: "active", OR: [{ parentId: null }, { parent: { is: { status: "active" } } }] } } }
              ]
            },
            include: {
              category: true,
              examples: {
                where: { status: "active" },
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
              }
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            ...(typeof take === "number" ? { take } : {})
          });
        }
        const providers = await getPlatformAiProviderFallbackQueueRelational("video");
        const providerMaxFrames = configuredVideoProviderFrameLimit(providers);
        const providerModelFamilies = videoProviderModelFamiliesForProviders(providers);
        const textToVideoProviderModelFamilies = runnableVideoProviderModelFamiliesForRequest(providers, { referenceAssetCount: 0, assumeApiKeyConfigured: true });
        const imageToVideoProviderModelFamilies = runnableVideoProviderModelFamiliesForRequest(providers, { referenceAssetCount: 1, assumeApiKeyConfigured: true });
        return rows.map((row) => {
          const theme = toVideoTheme(row);
          return {
            ...theme,
            effectiveMaxFrames: effectiveVideoFrameLimit(providers, theme.maxFrames),
            providerMaxFrames,
            providerModelFamilies,
            textToVideoProviderModelFamilies,
            imageToVideoProviderModelFamilies
          };
        });
      } catch (error) {
        if (isMydreamshootsContentSourceSiteId(siteId)) throw error;
        if (!shouldFallbackRelationalRead(error)) throw error;
        warnRelationalFallback("storefront public video themes", error);
        return fallbackPublicVideoThemesForSite(siteId, take);
      }
    },
    0
  );
});

export const getStorefrontPublicCollectionDetailStateBySlug = cache(async (slug: string, collectionSlug: string): Promise<PlatformState | undefined> => {
  const canonicalSlug = canonicalSiteSlug(slug);
  const normalizedCollectionSlug = slugify(collectionSlug);
  return siteReadCache.get(
    `public-collection-shell:${canonicalSlug}:${normalizedCollectionSlug}`,
    async () => {
      return loadStorefrontPublicCollectionDetailState(slug, normalizedCollectionSlug);
    },
    0
  );
});

export const getStorefrontPublicCollectionDirectoryStateBySlug = cache(async (slug: string): Promise<PlatformState | undefined> => {
  const canonicalSlug = canonicalSiteSlug(slug);
  if (instantDraftPreviewEnabled()) return loadStorefrontPublicCollectionDirectoryState(slug);
  return siteReadCache.get(
    `public-collection-directory-shell:${canonicalSlug}`,
    async () => loadStorefrontPublicCollectionDirectoryState(slug),
    0
  );
});

export const getStorefrontPublicCollectionMetadataStateBySlug = cache(async (slug: string): Promise<PlatformState | undefined> => {
  const canonicalSlug = canonicalSiteSlug(slug);
  return siteReadCache.get(
    `public-collection-metadata-shell:${canonicalSlug}`,
    async () => {
      const site = await getStorefrontPublicCollectionSiteShellBySlug(slug);
      if (!site) return undefined;
      const mappedSite = toPublicSiteShell(site, []);
      return emptyPlatformState({
        sites: [mappedSite],
        siteDomains: site.domains.map(toSiteDomain)
      });
    },
    0
  );
});

const getStorefrontPublicCollectionSiteShellBySlug = cache(async (slug: string): Promise<CollectionDetailSiteRecord | undefined> => {
  const canonicalSlug = canonicalSiteSlug(slug);
  return siteReadCache.get(
    `public-collection-site-shell:${canonicalSlug}`,
    async () => {
      const site = await prisma.site.findFirst({
        where: { slug: { in: legacySiteSlugCandidates(slug) } },
        orderBy: { updatedAt: "desc" },
        select: collectionDetailSiteSelect
      });
      if (!site) return undefined;

      // Collection directory/detail reads intentionally start with a small
      // page set. The header and footer are site-global, however, so include
      // every page referenced by that shell before the publication snapshot
      // computes publishedPaths. Otherwise detail pages hide valid guarded
      // footer links (privacy, refunds, terms, etc.) while the homepage shows
      // them from its broader runtime query.
      const loadedPageSlugs = new Set(site.livePages.map((page) => page.slug));
      const missingNavigationPageSlugs = Array.from(new Set(
        storefrontGlobalShellPageSlugs(site.settings?.draftJson)
          .flatMap((pageSlug) => publicRuntimePageSlugs(pageSlug) ?? [pageSlug])
      )).filter((pageSlug) => !loadedPageSlugs.has(pageSlug));
      if (!missingNavigationPageSlugs.length) return site;
      const navigationPages = await prisma.livePage.findMany({
        where: { siteId: site.id, slug: { in: missingNavigationPageSlugs } },
        orderBy: { slug: "asc" },
        select: publicRuntimeSiteSelect.livePages.select
      });
      return navigationPages.length
        ? { ...site, livePages: [...site.livePages, ...navigationPages].sort((left, right) => left.slug.localeCompare(right.slug)) }
        : site;
    },
    0
  );
});

async function loadStorefrontPublicCollectionDirectoryState(slug: string): Promise<PlatformState | undefined> {
  const startedAt = Date.now();
  const site = await getStorefrontPublicCollectionSiteShellBySlug(slug);
  if (!site) return undefined;
  const navigationData = isSynchronizedDreamshootNavigationSite(site)
    ? await getStorefrontPublicNavigationDataForSite(site.id)
    : {
        creativePackCategories: await getStorefrontPublicCreativePackCategoriesForSite(site.id),
        creativePacks: await getStorefrontPublicCreativePacksForSite(site.id, publicRuntimeLimits("collections").creativePacks),
        toolCategories: [],
        toolMenuItems: [],
        videoThemeCategories: []
      };
  storefrontPerfMark("collection-directory-shell:navigation", startedAt, {
    creativePacks: navigationData.creativePacks.length,
    creativePackCategories: navigationData.creativePackCategories.length,
    toolMenuItems: navigationData.toolMenuItems.length
  });
  const mediaAssets: MediaAsset[] = [];
  const mappedSite = toPublicSiteShell(site, mediaAssets);
  return emptyPlatformState({
    sites: [mappedSite],
    siteDomains: site.domains.map(toSiteDomain),
    creativePackCategories: navigationData.creativePackCategories,
    creativePacks: navigationData.creativePacks,
    toolCategories: navigationData.toolCategories,
    toolMenuItems: navigationData.toolMenuItems,
    videoThemeCategories: navigationData.videoThemeCategories,
    mediaAssets
  });
}

async function loadStorefrontPublicCollectionDetailState(slug: string, collectionSlug: string): Promise<PlatformState | undefined> {
  const startedAt = Date.now();
  const site = await getStorefrontPublicCollectionSiteShellBySlug(slug);
  if (!site) return undefined;
  storefrontPerfMark("collection-shell:site-shell", startedAt, { collectionSlug });
  const mappedSite = toPublicSiteShell(site, []);
  const explicitSeoCollection = isExplicitSeoDirectoryContentForSite(mappedSite, "collection", collectionSlug);

  const [selectedPacks, navigationData, products] = await Promise.all([
    explicitSeoCollection
      ? Promise.resolve([])
      : loadStorefrontPublicCollectionSelectedPacks(site.id, collectionSlug),
    isSynchronizedDreamshootNavigationSite(site)
      ? getStorefrontPublicNavigationDataForSite(site.id)
      : Promise.all([
          getStorefrontPublicCreativePacksForSite(site.id, publicRuntimeLimits("collections").creativePacks),
          getStorefrontPublicCreativePackCategoriesForSite(site.id)
        ]).then(([creativePacks, creativePackCategories]) => ({
          creativePackCategories,
          creativePacks,
          toolCategories: [],
          toolMenuItems: [],
          videoThemeCategories: []
        })),
    prisma.product.findMany({
      where: { siteId: site.id, status: "active" },
      include: { prices: true },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
      take: publicRuntimeLimits("collection-detail").products
    })
  ]);
  const creativePacks = Array.from(
    new Map([
      ...selectedPacks.map((pack) => toCreativePack(pack)),
      ...navigationData.creativePacks
    ].map((pack) => [pack.id, pack])).values()
  );
  storefrontPerfMark("collection-shell:packs", startedAt, {
    selectedPacks: selectedPacks.length,
    menuPacks: navigationData.creativePacks.length,
    creativePacks: creativePacks.length,
    toolMenuItems: navigationData.toolMenuItems.length
  });

  const mediaAssets: MediaAsset[] = [];
  const state = emptyPlatformState({
    sites: [{ ...mappedSite, mediaAssets }],
    siteDomains: site.domains.map(toSiteDomain),
    creativePackCategories: navigationData.creativePackCategories,
    creativePacks,
    products: products.map(mapProduct),
    toolCategories: navigationData.toolCategories,
    toolMenuItems: navigationData.toolMenuItems,
    videoThemeCategories: navigationData.videoThemeCategories,
    mediaAssets
  });
  storefrontPerfMark("collection-shell:done", startedAt);
  return state;
}

async function loadStorefrontPublicCollectionSelectedPacks(siteId: string, collectionSlug: string) {
  const category = await prisma.creativePackCategory.findUnique({
    where: { siteId_slug: { siteId, slug: collectionSlug } },
    select: {
      id: true,
      children: {
        select: { id: true }
      }
    }
  });
  const categoryIds = category ? [category.id, ...category.children.map((child) => child.id)] : [];
  if (categoryIds.length) {
    return prisma.creativePack.findMany({
      where: { siteId, status: "active", categoryId: { in: categoryIds } },
      select: collectionDetailCreativePackSelect,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: publicRuntimeLimits("collection-detail").creativePacks
    });
  }
  return prisma.creativePack.findMany({
    where: {
      siteId,
      status: "active",
      name: { equals: collectionSlug.replace(/-/g, " "), mode: "insensitive" }
    },
    select: collectionDetailCreativePackSelect,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: publicRuntimeLimits("collection-detail").creativePacks
  });
}

type PublicRuntimeSiteLookup =
  | { id: string }
  | { slugCandidates: string[] }
  | { hostCandidates: string[] };

type PublicRuntimeResolvedSiteLookup = Exclude<PublicRuntimeSiteLookup, { hostCandidates: string[] }>;

function getPublicRuntimeHostLookup(host: string | null | undefined): PublicRuntimeSiteLookup | undefined {
  const value = cleanHost(host);
  if (!value || isPlatformHost(value) || value === "localhost" || value === "127.0.0.1") return undefined;
  return { hostCandidates: hostDomainCandidates(value) };
}

async function getPublicRuntimeSiteLookupByHost(host: string | null | undefined): Promise<PublicRuntimeResolvedSiteLookup | undefined> {
  const lookup = getPublicRuntimeHostLookup(host);
  if (!lookup || !("hostCandidates" in lookup)) return undefined;
  const candidates = lookup.hostCandidates;

  const domain = await prisma.siteDomain.findFirst({
    where: { domain: { in: candidates } },
    orderBy: [{ status: "asc" }, { isPrimary: "desc" }],
    select: { siteId: true }
  });
  if (domain?.siteId) return { id: domain.siteId };

  const site = await prisma.site.findFirst({
    where: { primaryDomain: { in: candidates } },
    select: { id: true }
  });
  return site ? { id: site.id } : undefined;
}

async function loadStorefrontPublicRuntimeState(
  lookup: PublicRuntimeSiteLookup,
  pageSlugs?: string[],
  contextSlug?: string,
  options: { indexing?: boolean } = {}
): Promise<PlatformState | undefined> {
  const startedAt = Date.now();
  const needs = publicRuntimeNeeds(pageSlugs, contextSlug, options.indexing);
  // The homepage projection is compiled from all current public topic pages.
  // Restricting this read to `/` and `/404` silently removes the video and
  // Save the Date showcase groups even though their relational rows exist.
  // Directory pages compile their cards from the complete set of detail
  // pages. A route-scoped read containing only the directory page leaves the
  // published video/Save the Date projections with no owning entities, so
  // the renderer correctly (but misleadingly) shows an empty state.
  const pageWhere = ["home", "best-media", "save-the-date"].includes(needs.profile)
    ? undefined
    : publicRuntimePageWhere(pageSlugs);
  const select = {
      ...publicRuntimeSiteSelect,
      livePages: pageWhere
        ? { ...publicRuntimeSiteSelect.livePages, where: pageWhere }
        : publicRuntimeSiteSelect.livePages
    } satisfies Prisma.SiteSelect;
  return runStorefrontPublicTransaction(async (tx) => {
    const hostSiteId = "hostCandidates" in lookup
      ? (await tx.siteDomain.findFirst({
          where: { domain: { in: lookup.hostCandidates } },
          orderBy: [{ status: "asc" }, { isPrimary: "desc" }],
          select: { siteId: true }
        }))?.siteId
      : undefined;
    const site = "id" in lookup
      ? await tx.site.findUnique({ where: { id: lookup.id }, select })
      : "slugCandidates" in lookup
        ? await tx.site.findFirst({ where: { slug: { in: lookup.slugCandidates } }, orderBy: { updatedAt: "desc" }, select })
        : hostSiteId
          ? await tx.site.findUnique({ where: { id: hostSiteId }, select })
          : await tx.site.findFirst({ where: { primaryDomain: { in: lookup.hostCandidates } }, select });
    if (!site) return undefined;
    storefrontPerfMark("site", startedAt, { pageSlugs, profile: needs.profile });
    const siteId = site.id;
    const loadedPageSlugs = new Set(site.livePages.map((page) => page.slug));
    // Header and footer are site-global. Always hydrate the relational pages
    // referenced by that shared shell before publishedPaths is compiled, so a
    // route-specific body query cannot change global navigation visibility.
    const missingNavigationPageSlugs = Array.from(new Set(
      storefrontGlobalShellPageSlugs(site.settings?.draftJson)
        .flatMap((slug) => publicRuntimePageSlugs(slug) ?? [slug])
    ))
      .filter((slug) => !loadedPageSlugs.has(slug));
    const navigationPages = missingNavigationPageSlugs.length
      ? await tx.livePage.findMany({
          where: { siteId, slug: { in: missingNavigationPageSlugs } },
          orderBy: { slug: "asc" },
          select: publicRuntimeSiteSelect.livePages.select
        })
      : [];
    const siteWithNavigationPages = navigationPages.length
      ? { ...site, livePages: [...site.livePages, ...navigationPages].sort((left, right) => left.slug.localeCompare(right.slug)) }
      : site;
    const limits = publicRuntimeLimits(needs.profile);
    const [products, siteAiApps, creativePacks, creativePackCategories, mediaAssets, toolCategories, toolMenuItems, videoThemeCategories, videoThemes] = await Promise.all([
      needs.products ? tx.product.findMany({ where: { siteId, status: "active" }, include: { prices: true }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
      needs.siteAiApps ? tx.siteAiApp.findMany({ where: { siteId, enabled: true }, select: publicRuntimeSiteAiAppSelect, orderBy: [{ routeKey: "asc" }], ...(typeof limits.siteAiApps === "number" ? { take: limits.siteAiApps } : {}) }) : Promise.resolve([]),
      needs.creativePacks ? tx.creativePack.findMany({ where: { siteId, status: "active" }, select: publicRuntimeCreativePackSelect, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
      needs.creativePacks ? tx.creativePackCategory.findMany({ where: { siteId, status: "active" }, include: { parent: true }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }] }) : Promise.resolve([]),
      needs.mediaAssets ? tx.mediaAsset.findMany({ where: { siteId, usageType: { in: ["theme", "package", "sample"] } }, select: publicRuntimeMediaAssetSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }], ...(typeof limits.mediaAssets === "number" ? { take: limits.mediaAssets } : {}) }) : Promise.resolve([]),
      needs.toolMenus ? tx.toolCategory.findMany({ where: { siteId, status: "active" }, include: { parent: true }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }], ...(needs.profile === "indexing" ? {} : { take: 80 }) }) : Promise.resolve([]),
      needs.toolMenus ? tx.toolMenuItem.findMany({ where: { siteId, status: "active" }, include: { category: { include: { parent: true } } }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], ...(needs.profile === "indexing" ? {} : { take: 80 }) }) : Promise.resolve([]),
      needs.videoThemes ? tx.videoThemeCategory.findMany({ where: { siteId, status: "active" }, include: { parent: true }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }] }) : Promise.resolve([]),
      needs.videoThemes ? tx.videoTheme.findMany({ where: { siteId, status: "active" }, include: { category: { include: { parent: true } }, examples: { where: { status: "active" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([])
    ]);
    const runtimeCreativePackCategories = creativePackCategories.map(toCreativePackCategory);
    const runtimeCreativePacks = creativePacks.map(toPublicRuntimeCreativePack);
    const runtimeToolCategories = toolCategories.map(toToolCategory);
    const runtimeToolMenuItems = toolMenuItems.map(toToolMenuItem);
    const runtimeVideoThemeCategories = videoThemeCategories.map(toVideoThemeCategory);
    const runtimeVideoThemes = videoThemes.map(toVideoTheme);
    storefrontPerfMark("collections", startedAt, {
    products: products.length,
    siteAiApps: siteAiApps.length,
    creativePacks: runtimeCreativePacks.length,
    creativePackCategories: runtimeCreativePackCategories.length,
    mediaAssets: mediaAssets.length,
      toolMenuItems: runtimeToolMenuItems.length
    });

    const mappedMediaAssets = mediaAssets.map(toMediaAsset);
    const mappedSite = toPublicSiteShell(siteWithNavigationPages, mappedMediaAssets);
    const state = emptyPlatformState({
    sites: [mappedSite],
    siteDomains: site.domains.map(toSiteDomain),
    products: products.map(mapProduct),
    siteAiApps: siteAiApps.map(toPublicRuntimeSiteAiApp),
    toolCategories: runtimeToolCategories,
    toolMenuItems: runtimeToolMenuItems,
    videoThemeCategories: runtimeVideoThemeCategories,
    videoThemes: runtimeVideoThemes,
    creativePackCategories: runtimeCreativePackCategories,
    creativePacks: runtimeCreativePacks,
    mediaAssets: mappedMediaAssets
    });
    storefrontPerfMark("done", startedAt);
    return state;
  });
}

export const getStorefrontRuntimeStateForSite = cache(async (siteId: string): Promise<PlatformState | undefined> => {
  return siteReadCache.get(`runtime:${siteId}`, () => loadStorefrontRuntimeStateForSite(siteId), Number(process.env.STOREFRONT_PRIVATE_CACHE_TTL_MS ?? 30_000));
});

type StorefrontCustomerRuntimeParams = {
  siteId: string;
  sessionId?: string;
  customerId?: string;
  profile?: "full" | "workspace" | "account";
  section?: CustomerRuntimeSection;
};

export async function getStorefrontCustomerJobDetailStateForSite({
  jobId,
  sessionId,
  siteId
}: {
  jobId: string;
  sessionId: string;
  siteId: string;
}): Promise<PlatformState | undefined> {
  return siteReadCache.get(
    `customer-job-detail:${siteId}:${sessionId}:${jobId}`,
    async () => {
      const identity = await resolveCustomerRuntimeIdentity({ siteId, sessionId });
      if (!identity) return undefined;
      const [site, customer, job] = await Promise.all([
        prisma.site.findUnique({ where: { id: siteId }, select: customerRuntimeSiteSelect }),
        prisma.customer.findFirst({ where: { id: identity.customerId, siteId }, include: { balance: true } }),
        prisma.generationJob.findFirst({ where: { id: jobId, siteId, customerId: identity.customerId } })
      ]);
      if (!site || !customer || !job) return undefined;
      const [ledger, assetUploads, siteAiApps] = await Promise.all([
        prisma.creditLedger.findMany({
          where: { siteId, customerId: identity.customerId, sourceId: job.id },
          orderBy: { createdAt: "desc" },
          take: 24
        }),
        prisma.assetUpload.findMany({
          where: { siteId, customerId: identity.customerId, jobId: job.id, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 48
        }),
        prisma.siteAiApp.findMany({
          where: { siteId, aiAppId: job.aiAppId },
          include: { aiApp: true },
          take: 1
        })
      ]);
      const mappedMediaAssets: MediaAsset[] = [];
      const mappedSite = toPublicSiteShell(site as CustomerRuntimeSiteRecord, mappedMediaAssets);
      return emptyPlatformState({
        sites: [mappedSite],
        siteDomains: site.domains.map(toSiteDomain),
        customers: [mapCustomer(customer)],
        customerSessions: identity.session ? [toCustomerSessionRelational(identity.session)] : [],
        siteAiApps: siteAiApps.map(toSiteAiApp),
        jobs: [mapGenerationJob(job)],
        ledger: ledger.map(mapCreditLedger),
        assetUploads: assetUploads.map(toAssetUploadRelational)
      });
    },
    Number(process.env.STOREFRONT_JOB_DETAIL_CACHE_TTL_MS ?? 1_000)
  );
}

function mapSubscriptionRuntime(subscription: Prisma.SubscriptionGetPayload<object>): PlatformState["subscriptions"][number] {
  return {
    id: subscription.id,
    siteId: subscription.siteId,
    customerId: subscription.customerId,
    productId: subscription.productId,
    priceId: subscription.priceId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    status: subscription.status as PlatformState["subscriptions"][number]["status"],
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    creditsPerCycle: subscription.creditsPerCycle,
    createdAt: subscription.createdAt.toISOString()
  };
}

function mapOrderRuntime(order: Prisma.OrderGetPayload<object>): PlatformState["orders"][number] {
  return {
    id: order.id,
    siteId: order.siteId,
    customerId: order.customerId,
    status: order.status as PlatformState["orders"][number]["status"],
    amountCents: order.amountCents,
    currency: order.currency,
    credits: order.credits,
    sourceId: order.sourceId,
    createdAt: order.createdAt.toISOString()
  };
}

function storageKeysFromJobResult(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const outputs = (value as { outputs?: unknown }).outputs;
  if (!Array.isArray(outputs)) return [];
  return outputs.flatMap((output) => {
    if (!output || typeof output !== "object" || Array.isArray(output)) return [];
    const storageKey = (output as { storageKey?: unknown }).storageKey;
    return typeof storageKey === "string" && storageKey.trim() ? [storageKey.trim()] : [];
  });
}

export const getStorefrontCustomerRuntimeStateForSite = cache(async (params: StorefrontCustomerRuntimeParams): Promise<PlatformState | undefined> => {
  const identity = params.sessionId ? `session:${params.sessionId}` : params.customerId ? `customer:${params.customerId}` : "anonymous";
  const profile = params.profile ?? "full";
  const section = params.section ?? "summary";
  return siteReadCache.get(
    `customer-runtime:${params.siteId}:${identity}:${profile}:${section}`,
    () => loadStorefrontCustomerRuntimeStateForSite(params),
    Number(process.env.STOREFRONT_PRIVATE_CACHE_TTL_MS ?? 30_000)
  );
});

async function resolveCustomerRuntimeIdentity(
  params: StorefrontCustomerRuntimeParams
): Promise<{ customerId: string; session?: Prisma.CustomerSessionGetPayload<object> } | undefined> {
  if (params.sessionId) {
    const session = await prisma.customerSession.findFirst({
      where: {
        id: params.sessionId,
        siteId: params.siteId,
        expiresAt: { gt: new Date() }
      }
    });
    if (!session) return undefined;
    if (params.customerId && session.customerId !== params.customerId) return undefined;
    return { customerId: session.customerId, session };
  }
  return params.customerId ? { customerId: params.customerId } : undefined;
}

async function loadStorefrontCustomerRuntimeStateForSite(params: StorefrontCustomerRuntimeParams): Promise<PlatformState | undefined> {
  const identity = await resolveCustomerRuntimeIdentity(params);
  if (!identity) return undefined;

  const site = params.profile === "account" || params.profile === "workspace"
    ? await prisma.site.findUnique({
        where: { id: params.siteId },
        select: customerRuntimeSiteSelect
      })
    : await prisma.site.findUnique({
        where: { id: params.siteId },
        include: siteRuntimeInclude
      });
  if (!site) return undefined;

  const siteId = params.siteId;
  const customerId = identity.customerId;
  const section = params.section ?? "summary";
  const sectionedAccount = params.profile === "account";
  const wantsSubscriptions = !sectionedAccount || section === "summary" || section === "plan";
  const wantsOrders = !sectionedAccount || section === "summary" || section === "orders";
  const wantsJobs = !sectionedAccount || section === "summary" || section === "jobs";
  const wantsAssets = !sectionedAccount || section === "summary" || section === "albums";
  const assetRoles = params.profile === "workspace" ? customerAssetRolesForSurface("workspace-runtime") : undefined;
  const wantsLedger = !sectionedAccount || section === "summary" || section === "albums" || section === "credits";
  const wantsModels = !sectionedAccount || section === "summary";
  const wantsAlbums = !sectionedAccount || section === "summary" || section === "albums";
  const limits = params.profile === "account"
    ? accountCustomerRuntimeLimits
    : params.profile === "workspace"
      ? workspaceCustomerRuntimeLimits
      : customerRuntimeLimits;
  const [
    products,
    siteAiApps,
    creativePacks,
    mediaAssets,
    customer,
    subscriptions,
    orders,
    jobs,
    assetUploads,
    ledger,
    customerModels,
    albums
  ] = await runDbTasks([
    limits.products
      ? () => prisma.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: limits.products })
      : () => Promise.resolve([]),
    limits.siteAiApps
      ? () => prisma.siteAiApp.findMany({ where: { siteId }, include: { aiApp: true }, orderBy: [{ enabled: "desc" }, { routeKey: "asc" }], take: limits.siteAiApps })
      : () => Promise.resolve([]),
    limits.creativePacks
      ? () => prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: { include: { parent: true } } }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: limits.creativePacks })
      : () => Promise.resolve([]),
    limits.mediaAssets
      ? () => prisma.mediaAsset.findMany({ where: { siteId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: limits.mediaAssets })
      : () => Promise.resolve([]),
    () => prisma.customer.findFirst({ where: { id: customerId, siteId }, include: { balance: true } }),
    wantsSubscriptions && limits.subscriptions
      ? () => prisma.subscription.findMany({ where: { siteId, customerId }, orderBy: { createdAt: "desc" }, take: limits.subscriptions })
      : () => Promise.resolve([]),
    wantsOrders && limits.orders
      ? () => prisma.order.findMany({ where: { siteId, customerId }, orderBy: { createdAt: "desc" }, take: limits.orders })
      : () => Promise.resolve([]),
    wantsJobs && limits.jobs
      ? () => prisma.generationJob.findMany({ where: { siteId, customerId }, orderBy: { updatedAt: "desc" }, take: limits.jobs })
      : () => Promise.resolve([]),
    wantsAssets && limits.assetUploads
      ? () => prisma.assetUpload.findMany({ where: { siteId, customerId, deletedAt: null, role: assetRoles?.length ? { in: assetRoles } : undefined }, orderBy: { createdAt: "desc" }, take: limits.assetUploads })
      : () => Promise.resolve([]),
    wantsLedger && limits.ledger
      ? () => prisma.creditLedger.findMany({ where: { siteId, customerId }, orderBy: { createdAt: "desc" }, take: limits.ledger })
      : () => Promise.resolve([]),
    wantsModels && limits.customerModels
      ? () => prisma.customerModel.findMany({ where: { siteId, customerId }, orderBy: { updatedAt: "desc" }, take: limits.customerModels })
      : () => Promise.resolve([]),
    wantsAlbums && limits.albums
      ? () => prisma.album.findMany({ where: { siteId, customerId, status: "ready" }, orderBy: { updatedAt: "desc" }, take: limits.albums })
      : () => Promise.resolve([])
  ]);

  if (!customer) return undefined;

  const visibleJobs = [...jobs];
  const visibleAssets = [...assetUploads];
  const visibleAlbums = [...albums];
  const jobIds = new Set(visibleJobs.map((job) => job.id));
  const albumJobIds = new Set(visibleAlbums.flatMap((album) => album.sourceJobId ? [album.sourceJobId] : []));
  const missingAlbumJobIds = wantsJobs ? [...albumJobIds].filter((jobId) => !jobIds.has(jobId)) : [];
  if (missingAlbumJobIds.length) {
    const relatedJobs = await prisma.generationJob.findMany({
      where: { siteId, customerId, id: { in: missingAlbumJobIds } },
      orderBy: { updatedAt: "desc" },
      take: Math.max(missingAlbumJobIds.length, limits.jobs)
    });
    for (const job of relatedJobs) {
      if (!jobIds.has(job.id)) {
        visibleJobs.push(job);
        jobIds.add(job.id);
      }
    }
  }

  const outputStorageKeys = new Set(visibleJobs.flatMap((job) => storageKeysFromJobResult(job.resultJson)));
  const assetIds = new Set(visibleAssets.map((asset) => asset.id));
  const assetJobIds = new Set(visibleAssets.flatMap((asset) => asset.jobId ? [asset.jobId] : []));
  const coverAssetIds = new Set(visibleAlbums.flatMap((album) => album.coverAssetId ? [album.coverAssetId] : []));
  const relatedAssetOr: Prisma.AssetUploadWhereInput[] = [];
  const missingAssetJobIds = [...jobIds].filter((jobId) => !assetJobIds.has(jobId));
  const missingCoverAssetIds = [...coverAssetIds].filter((assetId) => !assetIds.has(assetId));
  if (missingAssetJobIds.length) relatedAssetOr.push({ jobId: { in: missingAssetJobIds } });
  if (missingCoverAssetIds.length) relatedAssetOr.push({ id: { in: missingCoverAssetIds } });
  if (outputStorageKeys.size) relatedAssetOr.push({ storageKey: { in: [...outputStorageKeys] } });
  if (wantsAssets && relatedAssetOr.length) {
    const relatedAssets = await prisma.assetUpload.findMany({
      where: { siteId, customerId, deletedAt: null, role: assetRoles?.length ? { in: assetRoles } : undefined, OR: relatedAssetOr },
      orderBy: { createdAt: "desc" },
      take: Math.max(limits.assetUploads || 24, relatedAssetOr.length * 12)
    });
    for (const asset of relatedAssets) {
      if (!assetIds.has(asset.id)) {
        visibleAssets.push(asset);
        assetIds.add(asset.id);
        if (asset.jobId) assetJobIds.add(asset.jobId);
      }
    }
  }

  const albumIds = new Set(visibleAlbums.map((album) => album.id));
  const missingAlbumJobIdsFromJobs = [...jobIds].filter((jobId) => !albumJobIds.has(jobId));
  const missingAlbumCoverAssetIds = [...assetIds].filter((assetId) => !coverAssetIds.has(assetId));
  const relatedAlbumOr: Prisma.AlbumWhereInput[] = [];
  if (missingAlbumJobIdsFromJobs.length) relatedAlbumOr.push({ sourceJobId: { in: missingAlbumJobIdsFromJobs } });
  if (missingAlbumCoverAssetIds.length) relatedAlbumOr.push({ coverAssetId: { in: missingAlbumCoverAssetIds } });
  if (wantsAlbums && relatedAlbumOr.length) {
    const relatedAlbums = await prisma.album.findMany({
      where: { siteId, customerId, status: "ready", OR: relatedAlbumOr },
      orderBy: { updatedAt: "desc" },
      take: Math.max(limits.albums || 12, relatedAlbumOr.length * 6)
    });
    for (const album of relatedAlbums) {
      if (!albumIds.has(album.id)) {
        visibleAlbums.push(album);
        albumIds.add(album.id);
      }
    }
  }

  const mappedMediaAssets = mediaAssets.map(toMediaAsset);
  const mappedSite = toPublicSiteShell(site as CustomerRuntimeSiteRecord, mappedMediaAssets);

  return emptyPlatformState({
    sites: [mappedSite],
    siteDomains: site.domains.map(toSiteDomain),
    products: products.map(mapProduct),
    siteAiApps: siteAiApps.map(toSiteAiApp),
    creativePacks: creativePacks.map(toCreativePack),
    mediaAssets: mappedMediaAssets,
    customers: [mapCustomer(customer)],
    customerSessions: identity.session ? [toCustomerSessionRelational(identity.session)] : [],
    subscriptions: subscriptions.map(mapSubscriptionRuntime),
    orders: orders.map(mapOrderRuntime),
    jobs: visibleJobs.map(mapGenerationJob),
    assetUploads: visibleAssets.map(toAssetUploadRelational),
    ledger: ledger.map(mapCreditLedger),
    customerModels: customerModels.map(toCustomerModelRelational),
    albums: visibleAlbums.map(toAlbumRelational)
  });
}

async function loadStorefrontRuntimeStateForSite(siteId: string): Promise<PlatformState | undefined> {
  // Public SSR is live-state only. Keep this compatibility entrypoint on the
  // same LivePage/ThemeSettings draft projection as the public runtime.
  return loadStorefrontPublicRuntimeState({ id: siteId });
}

export const getStorefrontRuntimeStateByHost = cache(async (host: string | null | undefined): Promise<PlatformState | undefined> => {
  const site = await getStorefrontSiteByHostRelational(host);
  return site ? getStorefrontRuntimeStateForSite(site.id) : undefined;
});

export const getStorefrontRuntimeStateBySlug = cache(async (slug: string): Promise<PlatformState | undefined> => {
  const siteId = await getSiteIdBySlugRelational(slug);
  return siteId ? getStorefrontRuntimeStateForSite(siteId) : undefined;
});

export const getStorefrontPublicRuntimeStateByHost = cache(async (host: string | null | undefined, pageSlug?: string, contextSlug?: string): Promise<PlatformState | undefined> => {
  const pageSlugs = publicRuntimePageSlugs(pageSlug);
  const lookup = getPublicRuntimeHostLookup(host);
  return lookup ? loadStorefrontPublicRuntimeState(lookup, pageSlugs, contextSlug) : undefined;
});

export const getStorefrontPublicIndexingStateByHost = cache(async (host: string | null | undefined): Promise<PlatformState | undefined> => {
  const lookup = getPublicRuntimeHostLookup(host);
  return lookup ? loadStorefrontPublicRuntimeState(lookup, undefined, undefined, { indexing: true }) : undefined;
});

export const getStorefrontPublicPageMetadataStateByHost = cache(async (host: string | null | undefined, pageSlug?: string): Promise<PlatformState | undefined> => {
  const key = cleanHost(host) || "empty";
  const normalizedPageSlug = pageSlug ? (pageSlug.startsWith("/") ? pageSlug : `/${pageSlug}`) : "";
  return siteReadCache.get(
    `public-page-metadata-host:${key}:${normalizedPageSlug || "site"}`,
    async () => {
      const lookup = await getPublicRuntimeSiteLookupByHost(host);
      if (!lookup) return undefined;
      const pageWhere = normalizedPageSlug ? { slug: { in: Array.from(new Set([normalizedPageSlug, "/404"])) } } : undefined;
      const select = {
        ...publicMetadataSiteSelect,
        livePages: pageWhere
          ? {
              ...publicMetadataSiteSelect.livePages,
              where: pageWhere
            }
          : publicMetadataSiteSelect.livePages
      } satisfies Prisma.SiteSelect;
      const site = "id" in lookup
        ? await prisma.site.findUnique({ where: { id: lookup.id }, select })
        : await prisma.site.findFirst({
            where: { slug: { in: lookup.slugCandidates } },
            orderBy: { updatedAt: "desc" },
            select
          });
      if (!site) return undefined;
      const mediaAssets = /^\/(?:ai-save-the-date|holidays-events)\//.test(normalizedPageSlug)
        ? await prisma.mediaAsset.findMany({
            where: { siteId: site.id, usageType: { in: ["theme", "package", "sample"] } },
            select: publicRuntimeMediaAssetSelect,
            orderBy: [{ createdAt: "desc" }, { id: "asc" }]
          })
        : [];
      const mappedMediaAssets = mediaAssets.map(toMediaAsset);
      return emptyPlatformState({
        sites: [toPublicSiteShell(site, mappedMediaAssets)],
        mediaAssets: mappedMediaAssets
      });
    },
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 0)
  );
});

export const getStorefrontPublicRuntimeStateBySlug = cache(async (slug: string, pageSlug?: string, contextSlug?: string): Promise<PlatformState | undefined> => {
  const canonicalSlug = canonicalSiteSlug(slug);
  const pageSlugs = publicRuntimePageSlugs(pageSlug);
  const pageKey = pageSlugs?.join("|") ?? "all";
  const contextKey = contextSlug ? slugify(contextSlug) : "none";
  if (instantDraftPreviewEnabled()) return loadStorefrontPublicRuntimeState({ slugCandidates: legacySiteSlugCandidates(slug) }, pageSlugs, contextSlug);
  return siteReadCache.get(
    `public-runtime-slug:${canonicalSlug}:${pageKey}:${contextKey}`,
    () => loadStorefrontPublicRuntimeState({ slugCandidates: legacySiteSlugCandidates(slug) }, pageSlugs, contextSlug),
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 0)
  );
});

export const getStorefrontPublicMetadataStateBySlug = cache(async (slug: string): Promise<PlatformState | undefined> => {
  const canonicalSlug = canonicalSiteSlug(slug);
  return siteReadCache.get(
    `public-metadata:${canonicalSlug}`,
    async () => {
      const site = await prisma.site.findFirst({
        where: { slug: { in: legacySiteSlugCandidates(slug) } },
        orderBy: { updatedAt: "desc" },
        select: publicMetadataSiteSelect
      });
      if (!site) return undefined;
      return emptyPlatformState({
        sites: [toPublicSiteShell(site)]
      });
    },
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 0)
  );
});

export const getStorefrontPublicPageMetadataStateBySlug = cache(async (slug: string, pageSlug?: string): Promise<PlatformState | undefined> => {
  const canonicalSlug = canonicalSiteSlug(slug);
  const normalizedPageSlug = pageSlug ? (pageSlug.startsWith("/") ? pageSlug : `/${pageSlug}`) : "";
  return siteReadCache.get(
    `public-page-metadata:${canonicalSlug}:${normalizedPageSlug || "site"}`,
    async () => {
      const site = await prisma.site.findFirst({
        where: { slug: { in: legacySiteSlugCandidates(slug) } },
        orderBy: { updatedAt: "desc" },
        select: {
          ...publicMetadataSiteSelect,
          livePages: normalizedPageSlug
            ? {
                ...publicMetadataSiteSelect.livePages,
                where: { slug: { in: Array.from(new Set([normalizedPageSlug, "/404"])) } }
              }
            : publicMetadataSiteSelect.livePages
        }
      });
      if (!site) return undefined;
      const mediaAssets = /^\/(?:ai-save-the-date|holidays-events)\//.test(normalizedPageSlug)
        ? await prisma.mediaAsset.findMany({
            where: { siteId: site.id, usageType: { in: ["theme", "package", "sample"] } },
            select: publicRuntimeMediaAssetSelect,
            orderBy: [{ createdAt: "desc" }, { id: "asc" }]
          })
        : [];
      const mappedMediaAssets = mediaAssets.map(toMediaAsset);
      return emptyPlatformState({
        sites: [toPublicSiteShell(site, mappedMediaAssets)],
        mediaAssets: mappedMediaAssets
      });
    },
    0
  );
});

export const getStorefrontAccessSummaryRelational = cache(async (): Promise<StorefrontAccessSummary> => {
  return siteReadCache.get("access-summary", loadStorefrontAccessSummaryRelational);
});

async function loadStorefrontAccessSummaryRelational(): Promise<StorefrontAccessSummary> {
  const [sites, totalSites, activeSites, runningJobs, platformAdmin] = await Promise.all([
    prisma.site.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        primaryDomain: true,
        branding: true,
        domains: { where: { isPrimary: true }, take: 1, select: { domain: true, isPrimary: true } },
        admins: { orderBy: [{ role: "asc" }, { createdAt: "asc" }], take: 1, select: { email: true } },
        customers: { orderBy: { createdAt: "asc" }, take: 1, select: { email: true } }
      }
    }),
    prisma.site.count(),
    prisma.site.count({ where: { status: "active" } }),
    prisma.generationJob.count({ where: { status: "running" } }),
    prisma.platformAdmin.findFirst({ orderBy: { createdAt: "asc" } })
  ]);

  return {
    sites: sites.map((site) => ({
      id: site.id,
      name: site.name,
      slug: site.slug,
      status: site.status as Site["status"],
      primaryDomain: site.domains[0]?.domain ?? site.primaryDomain,
      branding: cloneJson(site.branding) as Site["branding"],
      adminEmail: site.admins[0]?.email,
      customerEmail: site.customers[0]?.email
    })),
    totalSites,
    activeSites,
    runningJobs,
    platformAdmin: platformAdmin ? toPublicPlatformAdminRelational(platformAdmin) : undefined
  };
}

export async function createSiteAdminSessionRelational(params: { siteId: string; email: string; password: string }) {
  const email = params.email.trim().toLowerCase();
  let admin;
  if (shouldUseRelationalReadFallbackCircuit()) {
    return createLocalSiteAdminSessionFallback(params, new RelationalStoreError("relational_site_admin_login_unavailable", 503));
  }
  try {
    admin = await runSiteAdminRead(`site admin login:${params.siteId}`, () =>
      prisma.siteAdmin.findUnique({ where: { siteId_email: { siteId: params.siteId, email } } })
    );
  } catch (error) {
    return createLocalSiteAdminSessionFallback(params, error);
  }
  if (!admin || !verifyRelationalPassword(params.password, admin.passwordHash)) {
    throw new RelationalStoreError("invalid_site_admin_credentials", 401);
  }
  const session = await prisma.siteAdminSession.create({
    data: {
      id: relationalUid("sasess"),
      siteId: params.siteId,
      siteAdminId: admin.id,
      expiresAt: new Date(Date.now() + relationalSessionTtlMs)
    }
  });
  const siteAdmin = toPublicSiteAdminRelational(admin);
  const siteAdminSession = toSiteAdminSessionRelational(session);
  rememberLocalSiteAdminSessionFallback({ siteAdmin, session: siteAdminSession });
  return {
    siteAdmin,
    session: siteAdminSession
  };
}

function createLocalSiteAdminSessionFallback(
  params: { siteId: string; email: string; password: string },
  error: unknown
) {
  if (!shouldFallbackRelationalRead(error)) throw error;
  const state = readLocalPlatformStateFallback();
  if (!state) throw error;
  const email = params.email.trim().toLowerCase();
  const admin = state.siteAdmins.find((item) => item.siteId === params.siteId && item.email.trim().toLowerCase() === email);
  if (!admin || !verifyRelationalPassword(params.password, admin.passwordHash)) {
    throw new RelationalStoreError("invalid_site_admin_credentials", 401);
  }
  warnRelationalFallback("site admin login", error);
  const now = new Date();
  const session = {
    id: relationalUid("sasess"),
    siteId: params.siteId,
    siteAdminId: admin.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + relationalSessionTtlMs).toISOString()
  };
  const siteAdmin = toPublicSiteAdminRelational({ ...admin });
  const siteAdminSession = toSiteAdminSessionRelational(session);
  rememberLocalSiteAdminSessionFallback({
    site: state.sites.find((item) => item.id === params.siteId),
    siteAdmin,
    session: siteAdminSession
  });
  return {
    siteAdmin,
    session: siteAdminSession
  };
}

export async function createSiteAdminSessionByAdminIdRelational(params: { siteId: string; siteAdminId: string }) {
  const admin = await prisma.siteAdmin.findFirst({ where: { siteId: params.siteId, id: params.siteAdminId } });
  if (!admin) throw new RelationalStoreError("site_admin_not_found", 404);
  const session = await prisma.siteAdminSession.create({
    data: {
      id: relationalUid("sasess"),
      siteId: params.siteId,
      siteAdminId: admin.id,
      expiresAt: new Date(Date.now() + relationalSessionTtlMs)
    }
  });
  const siteAdmin = toPublicSiteAdminRelational(admin);
  const siteAdminSession = toSiteAdminSessionRelational(session);
  rememberLocalSiteAdminSessionFallback({ siteAdmin, session: siteAdminSession });
  return {
    siteAdmin,
    session: siteAdminSession
  };
}

export async function deleteSiteAdminSessionRelational(sessionId: string, client: PrismaLike = prisma): Promise<void> {
  try {
    await client.siteAdminSession.deleteMany({ where: { id: sessionId } });
  } finally {
    forgetLocalSiteAdminSessionFallback(undefined, sessionId);
  }
}

export async function getSiteAdminBySessionRelational(params: { siteId: string; sessionId?: string }) {
  if (!params.sessionId) return undefined;
  const localFallback = getLocalSiteAdminSessionFallback(params.siteId, params.sessionId);
  if (localFallback) {
    return {
      siteAdmin: localFallback.siteAdmin,
      session: localFallback.session
    };
  }
  let session;
  try {
    session = await runSiteAdminRead(`site admin session:${params.siteId}`, () =>
      prisma.siteAdminSession.findUnique({
        where: { id: params.sessionId },
        include: { siteAdmin: true }
      })
    );
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("site admin session lookup", error);
    return undefined;
  }
  if (!session?.siteAdmin || session.siteId !== params.siteId || session.expiresAt <= new Date()) return undefined;
  return {
    siteAdmin: toPublicSiteAdminRelational(session.siteAdmin),
    session: toSiteAdminSessionRelational(session)
  };
}

export async function getSiteAdminBridgeSessionRelational(params: { siteId: string; sessionId?: string }) {
  if (!params.sessionId) return undefined;
  const localFallback = getLocalSiteAdminSessionFallback(params.siteId, params.sessionId);
  if (localFallback) {
    const site = localFallback.site ?? readLocalPlatformStateFallback()?.sites.find((item) => item.id === params.siteId);
    if (site) {
      return {
        site: { id: site.id, slug: site.slug },
        result: {
          siteAdmin: localFallback.siteAdmin,
          session: localFallback.session
        }
      };
    }
  }
  let session;
  try {
    session = await runSiteAdminRead(`site admin bridge session:${params.siteId}`, () =>
      prisma.siteAdminSession.findFirst({
        where: { id: params.sessionId, siteId: params.siteId, expiresAt: { gt: new Date() } },
        include: {
          siteAdmin: true,
          site: { select: { id: true, slug: true } }
        }
      })
    );
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("site admin bridge session lookup", error);
    return undefined;
  }
  if (!session?.siteAdmin || !session.site) return undefined;
  return {
    site: session.site,
    result: {
      siteAdmin: toPublicSiteAdminRelational(session.siteAdmin),
      session: toSiteAdminSessionRelational(session)
    }
  };
}

export async function createSiteAdminBridgeSessionRelational(siteId: string) {
  const { site, admin } = await getSiteAdminBridgeTargetRelational(siteId);
  const session = await prisma.siteAdminSession.create({
    data: {
      id: relationalUid("sasess"),
      siteId,
      siteAdminId: admin.id,
      expiresAt: new Date(Date.now() + relationalSessionTtlMs)
    }
  });
  const siteAdminSession = toSiteAdminSessionRelational(session);
  rememberLocalSiteAdminSessionFallback({
    site,
    siteAdmin: admin,
    session: siteAdminSession
  });
  return {
    site,
    result: {
      siteAdmin: admin,
      session: siteAdminSession
    }
  };
}

export async function getSiteAdminBridgeTargetRelational(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, slug: true }
  });
  if (!site) throw new RelationalStoreError("site_not_found", 404);

  const admin =
    (await prisma.siteAdmin.findFirst({
      where: { siteId, role: "owner" },
      orderBy: { createdAt: "asc" }
    })) ??
    (await prisma.siteAdmin.findFirst({
      where: { siteId },
      orderBy: { createdAt: "asc" }
    }));
  if (!admin) throw new RelationalStoreError("site_admin_not_found", 404);

  return { site, admin: toPublicSiteAdminRelational(admin) };
}

export async function getSiteAdminBridgeSiteRelational(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, slug: true }
  });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  return site;
}

export async function getSiteBySlugRelational(slug: string): Promise<Site | undefined> {
  const canonicalSlug = canonicalSiteSlug(slug);
  return siteReadCache.get(`slug:${canonicalSlug}`, async () => {
    try {
      const site = await prisma.site.findFirst({
        where: { slug: { in: legacySiteSlugCandidates(slug) } },
        orderBy: { updatedAt: "desc" },
        include: siteRuntimeInclude
      });
      return site ? toSite(site) : undefined;
    } catch (error) {
      if (!shouldFallbackRelationalRead(error)) throw error;
      warnRelationalFallback("site lookup by slug", error);
      return fallbackSiteBySlug(slug);
    }
  });
}

export async function getSiteIdBySlugRelational(slug: string): Promise<string | undefined> {
  const canonicalSlug = canonicalSiteSlug(slug);
  return siteReadCache.get(`slug-id:${canonicalSlug}`, async () => {
    try {
      const site = await prisma.site.findFirst({
        where: { slug: { in: legacySiteSlugCandidates(slug) } },
        orderBy: { updatedAt: "desc" },
        select: { id: true }
      });
      return site?.id;
    } catch (error) {
      if (!shouldFallbackRelationalRead(error)) throw error;
      warnRelationalFallback("site id lookup by slug", error);
      return fallbackSiteBySlug(slug)?.id;
    }
  });
}

export type CustomerWorkspaceBootstrapRelational = {
  site: Pick<Site, "id" | "name" | "slug" | "branding" | "primaryDomain">;
  siteAiApps: SiteAiApp[];
  creativePackCategories: CreativePackCategory[];
  creativePacks: CreativePack[];
  toolMenuItems: ToolMenuItem[];
  videoThemeCategories: VideoThemeCategory[];
  videoThemes: VideoTheme[];
  publishedVideoGenerationTopics: PublishedVideoNavigationProjection[];
  publishedSaveTheDateGroups: PublishedSaveTheDateGroup[];
  publishedSaveTheDateMenuLabel: string;
};

export async function getPublishedVideoGenerationNavigationForSite(siteId: string): Promise<PublishedVideoNavigationProjection[]> {
  if (!isMydreamshootsVideoFrameworkSiteId(siteId) && siteId !== "site_aidreamcapes") return [];
  const pages = await prisma.livePage.findMany({
    where: { siteId },
    orderBy: { slug: "asc" },
    select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true }
  });
  return compileMydreamshootsVideoTopicPublication(
    pages.map((page) => toThemePage({ ...page, draftJson: page.contentJson, publishedJson: page.contentJson })),
    siteId as "site_dreamshoot" | "site_grownstride_test" | "site_aidreamcapes"
  ).navigation;
}

function watermarkedCreativePackCategoryForWorkspace(category: CreativePackCategory | undefined): CreativePackCategory | undefined {
  if (!category) return undefined;
  return {
    ...category,
    imageUrl: withStorefrontPublicWatermarkUrl(category.imageUrl),
    parent: watermarkedCreativePackCategoryForWorkspace(category.parent)
  };
}

function watermarkedCreativePackForWorkspace(pack: CreativePack): CreativePack {
  return {
    ...pack,
    imageUrl: withStorefrontPublicWatermarkUrl(pack.imageUrl),
    galleryImages: pack.galleryImages?.map((image) => withStorefrontPublicWatermarkUrl(image)),
    categoryRecord: pack.categoryRecord ? watermarkedCreativePackCategoryForWorkspace(pack.categoryRecord) : undefined
  };
}

function watermarkedToolMenuItemForWorkspace(item: ToolMenuItem): ToolMenuItem {
  return {
    ...item,
    imageUrl: withStorefrontPublicWatermarkUrl(item.imageUrl)
  };
}

function watermarkedVideoThemeCategoryForWorkspace(category: VideoThemeCategory | undefined): VideoThemeCategory | undefined {
  if (!category) return undefined;
  return {
    ...category,
    imageUrl: withStorefrontPublicWatermarkUrl(category.imageUrl)
  };
}

function watermarkedVideoThemeForWorkspace(theme: VideoTheme): VideoTheme {
  return {
    ...theme,
    imageUrl: withStorefrontPublicWatermarkUrl(theme.imageUrl),
    galleryImages: theme.galleryImages?.map((image) => withStorefrontPublicWatermarkUrl(image)),
    examples: theme.examples?.map((example) => ({
      ...example,
      imageUrl: withStorefrontPublicWatermarkUrl(example.imageUrl),
      galleryImages: example.galleryImages?.map((image) => withStorefrontPublicWatermarkUrl(image))
    })),
    category: watermarkedVideoThemeCategoryForWorkspace(theme.category)
  };
}

export async function getCustomerWorkspaceSiteShellRelational(slug: string): Promise<CustomerWorkspaceBootstrapRelational["site"] | undefined> {
  const canonicalSlug = canonicalSiteSlug(slug);
  return siteReadCache.get<CustomerWorkspaceBootstrapRelational["site"] | undefined>(`workspace-site-shell:${canonicalSlug}`, async () => {
    try {
      const site = await prisma.site.findFirst({
        where: { slug: { in: legacySiteSlugCandidates(slug) } },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          primaryDomain: true,
          branding: true
        }
      });
      return site
        ? {
            id: site.id,
            name: site.name,
            slug: site.slug,
            primaryDomain: site.primaryDomain,
            branding: cloneJson(site.branding) as Site["branding"]
          }
        : undefined;
    } catch (error) {
      if (!shouldFallbackRelationalRead(error)) throw error;
      warnRelationalFallback("customer workspace site shell", error);
      return fallbackCustomerWorkspaceSiteShell(slug);
    }
  }, Number(process.env.STOREFRONT_WORKSPACE_BOOTSTRAP_CACHE_TTL_MS ?? 60_000));
}

export async function getCustomerWorkspaceBootstrapRelational(slug: string): Promise<CustomerWorkspaceBootstrapRelational | undefined> {
  const canonicalSlug = canonicalSiteSlug(slug);
  return siteReadCache.get<CustomerWorkspaceBootstrapRelational | undefined>(`workspace-bootstrap:${canonicalSlug}`, async () => {
    const site = await getCustomerWorkspaceSiteShellRelational(slug);
    if (!site) return undefined;

    const [siteAiApps, navigationData, videoThemes, publishedVideoGenerationTopics, livePublicState] = await Promise.all([
      prisma.siteAiApp.findMany({
        where: { siteId: site.id, enabled: true },
        include: { aiApp: true },
        orderBy: [{ routeKey: "asc" }],
        take: workspaceCustomerRuntimeLimits.siteAiApps
      }).then((rows) => rows.map(toSiteAiApp)).catch((error) => {
        if (!shouldFallbackRelationalRead(error)) throw error;
        warnRelationalFallback("customer workspace site AI apps", error);
        return fallbackCustomerWorkspaceSiteAiApps(site.id);
      }),
      getStorefrontPublicNavigationDataForSite(site.id),
      getStorefrontPublicVideoThemesForSite(site.id),
      getPublishedVideoGenerationNavigationForSite(site.id),
      getStorefrontPublicRuntimeStateForSite(site.id)
    ]);
    const { createPublishedSiteSnapshot } = await import("@/lib/storefront-context");
    const liveSnapshot = livePublicState ? createPublishedSiteSnapshot(livePublicState, livePublicState.sites[0], { source: "postgres" }) : undefined;
    const publishedSaveTheDateGroups = resolvePublishedSaveTheDateGroups(liveSnapshot?.publishedHomepageShowcases ?? []);
    const configuredSaveTheDateGroups = resolvePublishedSaveTheDateNavigationGroups(
      liveSnapshot?.themeSettings?.saveTheDateNavigation?.groups
    );
    const publishedSaveTheDateItemCount = publishedSaveTheDateGroups.reduce((total, group) => total + group.items.length, 0);
    const configuredSaveTheDateItemCount = configuredSaveTheDateGroups.reduce((total, group) => total + group.items.length, 0);
    // Both projections come from current live relational rows and include only
    // published items. A partially compiled homepage showcase projection must
    // not remove a valid published navigation entry from account/workspace
    // headers, so prefer the complete projection by leaf count.
    const completeSaveTheDateGroups = configuredSaveTheDateItemCount > publishedSaveTheDateItemCount
      ? configuredSaveTheDateGroups
      : publishedSaveTheDateGroups;

    return {
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        primaryDomain: site.primaryDomain,
        branding: site.branding
      },
      siteAiApps,
      creativePackCategories: navigationData.creativePackCategories.map((category) => watermarkedCreativePackCategoryForWorkspace(category) ?? category),
      creativePacks: navigationData.creativePacks.map(watermarkedCreativePackForWorkspace),
      toolMenuItems: navigationData.toolMenuItems.map(watermarkedToolMenuItemForWorkspace),
      videoThemeCategories: navigationData.videoThemeCategories.map((category) => watermarkedVideoThemeCategoryForWorkspace(category) ?? category),
      videoThemes: videoThemes.map(watermarkedVideoThemeForWorkspace),
      publishedVideoGenerationTopics,
      publishedSaveTheDateGroups: completeSaveTheDateGroups,
      publishedSaveTheDateMenuLabel: String(
        liveSnapshot?.themeSettings?.saveTheDateNavigation?.menuLabel || "Save the Date"
      ).trim() || "Save the Date"
    };
  }, Number(process.env.STOREFRONT_WORKSPACE_BOOTSTRAP_CACHE_TTL_MS ?? 60_000));
}

export async function getSiteLoginShellBySlugForAdmin(slug: string): Promise<Site | undefined> {
  if (shouldUseRelationalReadFallbackCircuit()) {
    const fallback = localSiteBySlugForAdmin(slug);
    if (fallback) return fallback;
  }
  try {
    const canonicalSlug = canonicalSiteSlug(slug);
    return await siteReadCache.get(`admin-login-site:${canonicalSlug}`, () => runSiteAdminRead(`admin login site:${canonicalSlug}`, async () => {
      const site = await prisma.site.findFirst({
        where: { slug: { in: legacySiteSlugCandidates(slug) } },
        orderBy: { updatedAt: "desc" },
        select: adminLoginSiteSelect
      });
      return site ? toAdminLoginSiteShell(site) : undefined;
    }));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    const fallback = localSiteBySlugForAdmin(slug);
    if (fallback) {
      warnRelationalFallback("admin login site lookup", error);
      return fallback;
    }
    throw new RelationalStoreError("relational_site_lookup_unavailable", 503);
  }
}

export async function getSiteBySlugForAdmin(slug: string): Promise<Site | undefined> {
  if (shouldUseRelationalReadFallbackCircuit()) {
    const fallback = localSiteBySlugForAdmin(slug);
    if (fallback) return fallback;
  }
  try {
    const canonicalSlug = canonicalSiteSlug(slug);
    return await siteReadCache.get(`admin-site-full:${canonicalSlug}`, () => runSiteAdminRead(`admin site full:${canonicalSlug}`, async () => {
      const site = await prisma.site.findFirst({
        where: { slug: { in: legacySiteSlugCandidates(slug) } },
        orderBy: { updatedAt: "desc" },
        include: siteRuntimeInclude
      });
      return site ? toSite(site) : undefined;
    }));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    const fallback = localSiteBySlugForAdmin(slug);
    if (fallback) {
      warnRelationalFallback("admin site full lookup", error);
      return fallback;
    }
    throw new RelationalStoreError("relational_site_lookup_unavailable", 503);
  }
}

export async function getSiteByIdForAdmin(siteId: string): Promise<Site | undefined> {
  if (shouldUseRelationalReadFallbackCircuit()) {
    const fallback = localSiteByIdForAdmin(siteId);
    if (fallback) return fallback;
  }
  try {
    return await siteReadCache.get(`admin-site-id:${siteId}`, () => runSiteAdminRead(`admin site id:${siteId}`, async () => {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        include: siteRuntimeInclude
      });
      return site ? toSite(site) : undefined;
    }));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    const fallback = localSiteByIdForAdmin(siteId);
    if (fallback) {
      warnRelationalFallback("admin site id lookup", error);
      return fallback;
    }
    throw new RelationalStoreError("relational_site_lookup_unavailable", 503);
  }
}

function normalizePreflightThemeSettings(value: unknown): Site["themeSettings"]["draftJson"] {
  const settings = value as Partial<Site["themeSettings"]["draftJson"]> | null | undefined;
  return {
    colors: {
      background: settings?.colors?.background ?? "",
      foreground: settings?.colors?.foreground ?? "",
      accent: settings?.colors?.accent ?? "",
      muted: settings?.colors?.muted ?? ""
    },
    typography: {
      display: settings?.typography?.display ?? "",
      body: settings?.typography?.body ?? ""
    },
    radii: {
      section: settings?.radii?.section ?? 0,
      control: settings?.radii?.control ?? 0
    },
    navigation: {
      headerLinks: settings?.navigation?.headerLinks ?? [],
      footerLinks: settings?.navigation?.footerLinks ?? []
    },
    globalSections: settings?.globalSections,
    seo: settings?.seo,
    saasSettingsCurrent: settings?.saasSettingsCurrent
  };
}

export async function getThemePublishPreflightSiteRelational(siteId: string): Promise<{ site?: Site; dirtyPageIds: string[] }> {
  try {
    return await siteReadCache.get(`theme-preflight-site:${siteId}`, () => runSiteAdminRead(`theme preflight site:${siteId}`, async () => {
      type PreflightSiteRow = {
        id: string;
        name: string;
        slug: string;
        status: string;
        primaryDomain: string | null;
        timezone: string;
        currency: string;
        signupCreditGrant: number | null;
        branding: Prisma.JsonValue;
        domains: Array<{ domain: string; isPrimary: boolean }>;
        settings: { draftJson: unknown; publishedJson: unknown } | null;
        connect: {
          stripeAccountId: string;
          onboardingStatus: string;
          chargesEnabled: boolean;
          payoutsEnabled: boolean;
        } | null;
        pages: Array<{
          id: string;
          siteId: string;
          pageType: string;
          templateKey: string | null;
          slug: string;
          title: string;
          draftJson: unknown;
          publishedJson: unknown;
        }>;
        dirtyPageIds: string[];
      };
      const rows = await prisma.$queryRaw<PreflightSiteRow[]>`
        SELECT
          s."id",
          s."name",
          s."slug",
          s."status",
          s."primaryDomain",
          s."timezone",
          s."currency",
          s."signupCreditGrant",
          s."branding",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object('domain', d."domain", 'isPrimary', d."isPrimary") ORDER BY d."isPrimary" DESC, d."createdAt" ASC)
            FROM "SiteDomain" d
            WHERE d."siteId" = s."id"
          ), '[]'::jsonb) AS "domains",
          jsonb_build_object('draftJson', ts."draftJson", 'publishedJson', ts."publishedJson") AS "settings",
          CASE WHEN sc."id" IS NULL THEN NULL ELSE jsonb_build_object(
            'stripeAccountId', sc."stripeAccountId",
            'onboardingStatus', sc."onboardingStatus",
            'chargesEnabled', sc."chargesEnabled",
            'payoutsEnabled', sc."payoutsEnabled"
          ) END AS "connect",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', p."id",
              'siteId', p."siteId",
              'pageType', p."pageType",
              'templateKey', p."templateKey",
              'slug', p."slug",
              'title', p."title",
              'draftJson', p."draftJson",
              'publishedJson', p."publishedJson"
            ) ORDER BY p."slug" ASC)
            FROM "ThemePage" p
            WHERE p."siteId" = s."id"
          ), '[]'::jsonb) AS "pages",
          COALESCE((
            SELECT array_agg(p."id" ORDER BY p."slug" ASC)
            FROM "ThemePage" p
            WHERE p."siteId" = s."id"
              AND p."draftJson"::jsonb IS DISTINCT FROM p."publishedJson"::jsonb
          ), ARRAY[]::text[]) AS "dirtyPageIds"
        FROM "Site" s
        LEFT JOIN "ThemeSettings" ts ON ts."siteId" = s."id"
        LEFT JOIN "StripeConnectAccount" sc ON sc."siteId" = s."id"
        WHERE s."id" = ${siteId}
        LIMIT 1
      `;
      const site = rows[0];
      if (!site) return { site: undefined, dirtyPageIds: [] };
      const primaryDomain = site.domains.find((domain) => domain.isPrimary)?.domain ?? site.domains[0]?.domain ?? site.primaryDomain ?? "";
      return {
        dirtyPageIds: site.dirtyPageIds,
        site: {
          id: site.id,
          name: site.name,
          slug: site.slug,
          status: site.status as Site["status"],
          primaryDomain,
          currency: site.currency,
          timezone: site.timezone,
          signupCreditGrant: Math.max(0, Math.trunc(Number(site.signupCreditGrant ?? 0))),
          branding: site.branding as Site["branding"],
          connect: {
            stripeAccountId: site.connect?.stripeAccountId ?? `acct_pending_${site.slug}`,
            status: (site.connect?.onboardingStatus ?? "pending") as Site["connect"]["status"],
            chargesEnabled: Boolean(site.connect?.chargesEnabled),
            payoutsEnabled: Boolean(site.connect?.payoutsEnabled)
          },
          themeSettings: {
            draftJson: normalizePreflightThemeSettings(site.settings?.draftJson),
            publishedJson: normalizePreflightThemeSettings(site.settings?.publishedJson)
          },
          pages: site.pages.map((page) => ({
            id: page.id,
            siteId: page.siteId,
            pageType: page.pageType,
            templateKey: page.templateKey ?? undefined,
            slug: page.slug,
            title: page.title,
            draftJson: page.draftJson as unknown as ThemePageJson,
            publishedJson: page.publishedJson as unknown as ThemePageJson
          }))
        }
      };
    }, { timeoutMs: siteAdminSummaryReadTimeoutMs }), Number(process.env.SITE_ADMIN_PREFLIGHT_CACHE_TTL_MS ?? 15_000));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    throw new RelationalStoreError("relational_theme_preflight_site_unavailable", 503);
  }
}

export async function getThemePublishPreflightBundleRelational(siteId: string, existingPrisma?: PrismaLike): Promise<{
  site?: Site;
  dirtyPageIds: string[];
  products: PublishPreflightProduct[];
  creativePacks: PublishPreflightCreativePack[];
  storefrontProfile?: import("@/lib/types").StorefrontProfileJson;
  siteAiApps: PublishPreflightSiteAiApp[];
  mediaAssets: PublishPreflightMediaAsset[];
}> {
  try {
    const readBundle = async () => {
      type PreflightBundleRow = {
        id: string;
        name: string;
        slug: string;
        status: string;
        primaryDomain: string | null;
        timezone: string;
        currency: string;
        signupCreditGrant: number | null;
        branding: Prisma.JsonValue;
        domains: Array<{ domain: string; isPrimary: boolean }>;
        settings: { draftJson: unknown; publishedJson: unknown } | null;
        connect: {
          stripeAccountId: string;
          onboardingStatus: string;
          chargesEnabled: boolean;
          payoutsEnabled: boolean;
        } | null;
        pages: Array<{
          id: string;
          siteId: string;
          pageType: string;
          templateKey: string | null;
          slug: string;
          title: string;
          draftJson: unknown;
          publishedJson: unknown;
        }>;
        dirtyPageIds: string[];
        products: PublishPreflightProduct[];
        creativePacks: PublishPreflightCreativePack[];
        storefrontProfile?: import("@/lib/types").StorefrontProfileJson;
        siteAiApps: PublishPreflightSiteAiApp[];
        mediaAssets: PublishPreflightMediaAsset[];
      };
      const queryClient = existingPrisma ?? prisma;
      const rows = await queryClient.$queryRaw<PreflightBundleRow[]>`
        SELECT
          s."id",
          s."name",
          s."slug",
          s."status",
          s."primaryDomain",
          s."timezone",
          s."currency",
          s."signupCreditGrant",
          s."branding",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object('domain', d."domain", 'isPrimary', d."isPrimary") ORDER BY d."isPrimary" DESC, d."createdAt" ASC)
            FROM "SiteDomain" d
            WHERE d."siteId" = s."id"
          ), '[]'::jsonb) AS "domains",
          jsonb_build_object('draftJson', ts."draftJson", 'publishedJson', ts."publishedJson") AS "settings",
          CASE WHEN sc."id" IS NULL THEN NULL ELSE jsonb_build_object(
            'stripeAccountId', sc."stripeAccountId",
            'onboardingStatus', sc."onboardingStatus",
            'chargesEnabled', sc."chargesEnabled",
            'payoutsEnabled', sc."payoutsEnabled"
          ) END AS "connect",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', p."id",
              'siteId', p."siteId",
              'pageType', p."pageType",
              'templateKey', p."templateKey",
              'slug', p."slug",
              'title', p."title",
              'draftJson', p."draftJson",
              'publishedJson', p."publishedJson"
            ) ORDER BY p."slug" ASC)
            FROM "ThemePage" p
            WHERE p."siteId" = s."id"
          ), '[]'::jsonb) AS "pages",
          COALESCE((
            SELECT array_agg(p."id" ORDER BY p."slug" ASC)
            FROM "ThemePage" p
            WHERE p."siteId" = s."id"
              AND p."draftJson"::jsonb IS DISTINCT FROM p."publishedJson"::jsonb
          ), ARRAY[]::text[]) AS "dirtyPageIds",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', pr."id",
              'status', pr."status",
              'type', pr."type",
              'prices', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('stripePriceId', px."stripePriceId", 'amountCents', px."amountCents", 'status', px."status", 'currency', px."currency", 'interval', px."interval", 'providerVerifiedAt', px."providerVerifiedAt", 'providerFingerprint', px."providerFingerprint", 'effectiveFrom', px."effectiveFrom", 'effectiveTo', px."effectiveTo"))
                FROM "Price" px
                WHERE px."productId" = pr."id"
              ), '[]'::jsonb)
            ))
            FROM "Product" pr
            WHERE pr."siteId" = s."id"
          ), '[]'::jsonb) AS "products",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', cp."id",
              'status', cp."status",
              'creditCost', cp."creditCost",
              'outputCount', cp."outputCount",
              'category', cp."category",
              'categoryRecord', CASE WHEN c."id" IS NULL THEN NULL ELSE jsonb_build_object('slug', c."slug") END,
              'imageUrl', cp."imageUrl",
              'galleryImages', cp."galleryImages",
              'galleryImageAlts', cp."galleryImageAlts"
            ))
            FROM "CreativePack" cp
            LEFT JOIN "CreativePackCategory" c ON c."id" = cp."categoryId"
            WHERE cp."siteId" = s."id"
          ), '[]'::jsonb) AS "creativePacks",
          CASE WHEN sp."id" IS NULL THEN NULL ELSE sp."draftJson" END AS "storefrontProfile",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', sa."id",
              'enabled', sa."enabled",
              'aiApp', jsonb_build_object('id', aa."id", 'slug', aa."slug")
            ))
            FROM "SiteAiApp" sa
            JOIN "AiApp" aa ON aa."id" = sa."aiAppId"
            WHERE sa."siteId" = s."id"
          ), '[]'::jsonb) AS "siteAiApps",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', ma."id", 'ownerId', ma."siteId", 'entityRevision', md5(ma."id" || ':' || ma."updatedAt"::text)))
            FROM "MediaAsset" ma
            WHERE ma."siteId" = s."id"
          ), '[]'::jsonb) AS "mediaAssets"
        FROM "Site" s
        LEFT JOIN "ThemeSettings" ts ON ts."siteId" = s."id"
        LEFT JOIN "StripeConnectAccount" sc ON sc."siteId" = s."id"
        LEFT JOIN "StorefrontProfile" sp ON sp."siteId" = s."id"
        WHERE s."id" = ${siteId}
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) return { site: undefined, dirtyPageIds: [], products: [], creativePacks: [], storefrontProfile: undefined, siteAiApps: [], mediaAssets: [] };
      const primaryDomain = row.domains.find((domain) => domain.isPrimary)?.domain ?? row.domains[0]?.domain ?? row.primaryDomain ?? "";
      return {
        dirtyPageIds: row.dirtyPageIds,
        products: row.products.map((product) => ({
          id: product.id,
          status: product.status as PublishPreflightProduct["status"],
          type: product.type as PublishPreflightProduct["type"],
          prices: product.prices.map((price) => ({
              amountCents: price.amountCents,
              stripePriceId: price.stripePriceId ?? "",
              status: price.status,
              currency: price.currency,
              interval: price.interval,
              providerVerifiedAt: price.providerVerifiedAt,
              providerFingerprint: price.providerFingerprint,
              effectiveFrom: price.effectiveFrom,
              effectiveTo: price.effectiveTo
          }))
        })),
        creativePacks: row.creativePacks,
        storefrontProfile: row.storefrontProfile,
        siteAiApps: row.siteAiApps,
        mediaAssets: row.mediaAssets,
        site: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          status: row.status as Site["status"],
          primaryDomain,
          currency: row.currency,
          timezone: row.timezone,
          signupCreditGrant: Math.max(0, Math.trunc(Number(row.signupCreditGrant ?? 0))),
          branding: row.branding as Site["branding"],
          connect: {
            stripeAccountId: row.connect?.stripeAccountId ?? `acct_pending_${row.slug}`,
            status: (row.connect?.onboardingStatus ?? "pending") as Site["connect"]["status"],
            chargesEnabled: Boolean(row.connect?.chargesEnabled),
            payoutsEnabled: Boolean(row.connect?.payoutsEnabled)
          },
          themeSettings: {
            draftJson: normalizePreflightThemeSettings(row.settings?.draftJson),
            publishedJson: normalizePreflightThemeSettings(row.settings?.publishedJson)
          },
          pages: row.pages.map((page) => ({
            id: page.id,
            siteId: page.siteId,
            pageType: page.pageType,
            templateKey: page.templateKey ?? undefined,
            slug: page.slug,
            title: page.title,
            draftJson: page.draftJson as ThemePage["draftJson"],
            publishedJson: page.publishedJson as ThemePage["publishedJson"]
          }))
        }
      };
    };
    return existingPrisma
      ? await readBundle()
      : await siteReadCache.get(`theme-preflight-bundle:${siteId}`, () => runSiteAdminRead(`theme preflight bundle:${siteId}`, readBundle, { timeoutMs: siteAdminSummaryReadTimeoutMs }), Number(process.env.SITE_ADMIN_PREFLIGHT_CACHE_TTL_MS ?? 15_000));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    throw new RelationalStoreError("relational_theme_preflight_bundle_unavailable", 503);
  }
}

export async function getSiteShellBySlugForAdmin(slug: string): Promise<Site | undefined> {
  try {
    const canonicalSlug = canonicalSiteSlug(slug);
    return await siteReadCache.get(`admin-shell-v2:${canonicalSlug}`, () => runSiteAdminRead(`admin shell:${canonicalSlug}`, async () => {
      const slugCandidates = legacySiteSlugCandidates(slug);
      type AdminShellSiteRow = {
        id: string;
        name: string;
        slug: string;
        status: string;
        primaryDomain: string | null;
        timezone: string;
        currency: string;
        signupCreditGrant: number | null;
        branding: Prisma.JsonValue;
        settings: { draftJson: unknown; publishedJson: unknown } | null;
        connect: {
          stripeAccountId: string;
          onboardingStatus: string;
          chargesEnabled: boolean;
          payoutsEnabled: boolean;
        } | null;
        domains: Array<{ domain: string; isPrimary: boolean }>;
        pages: Array<{
          id: string;
          siteId: string;
          pageType: string;
          templateKey: string | null;
          slug: string;
          title: string;
        }>;
      };
      const rows = await prisma.$queryRaw<AdminShellSiteRow[]>`
        SELECT
          s."id",
          s."name",
          s."slug",
          s."status",
          s."primaryDomain",
          s."timezone",
          s."currency",
          s."signupCreditGrant",
          s."branding",
          jsonb_build_object('draftJson', ts."draftJson", 'publishedJson', ts."publishedJson") AS "settings",
          CASE WHEN sc."id" IS NULL THEN NULL ELSE jsonb_build_object(
            'stripeAccountId', sc."stripeAccountId",
            'onboardingStatus', sc."onboardingStatus",
            'chargesEnabled', sc."chargesEnabled",
            'payoutsEnabled', sc."payoutsEnabled"
          ) END AS "connect",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object('domain', d."domain", 'isPrimary', d."isPrimary") ORDER BY d."isPrimary" DESC, d."createdAt" ASC)
            FROM "SiteDomain" d
            WHERE d."siteId" = s."id"
          ), '[]'::jsonb) AS "domains",
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', p."id",
              'siteId', p."siteId",
              'pageType', p."pageType",
              'templateKey', p."templateKey",
              'slug', p."slug",
              'title', p."title"
            ) ORDER BY p."slug" ASC)
            FROM "ThemePage" p
            WHERE p."siteId" = s."id"
          ), '[]'::jsonb) AS "pages"
        FROM "Site" s
        LEFT JOIN "ThemeSettings" ts ON ts."siteId" = s."id"
        LEFT JOIN "StripeConnectAccount" sc ON sc."siteId" = s."id"
        LEFT JOIN "StorefrontProfile" sp ON sp."siteId" = s."id"
        WHERE s."slug" = ANY(${slugCandidates})
        ORDER BY s."updatedAt" DESC
        LIMIT 1
      `;
      const site = rows[0];
      if (!site) return undefined;
      const primaryDomain = site.domains.find((domain) => domain.isPrimary)?.domain ?? site.domains[0]?.domain ?? site.primaryDomain ?? "";
      return {
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status as Site["status"],
        primaryDomain,
        currency: site.currency,
        timezone: site.timezone,
        signupCreditGrant: Math.max(0, Math.trunc(Number(site.signupCreditGrant ?? 0))),
        branding: cloneJson(site.branding) as Site["branding"],
        connect: {
          stripeAccountId: site.connect?.stripeAccountId ?? `acct_pending_${site.slug}`,
          status: (site.connect?.onboardingStatus ?? "pending") as Site["connect"]["status"],
          chargesEnabled: Boolean(site.connect?.chargesEnabled),
          payoutsEnabled: Boolean(site.connect?.payoutsEnabled)
        },
        themeSettings: toAdminShellThemeSettings(site.settings),
        pages: site.pages.map((page) => ({
          ...page,
          templateKey: page.templateKey ?? undefined,
          draftJson: { ...emptyThemePageJson, pageType: page.pageType },
          publishedJson: { ...emptyThemePageJson, pageType: page.pageType }
        }))
      };
    }));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    throw new RelationalStoreError("relational_site_shell_lookup_unavailable", 503);
  }
}

export async function getSiteContentBySlugForAdmin(slug: string): Promise<Site | undefined> {
  try {
    return await siteReadCache.get(`admin-content:${slug}`, async () => {
      const shell = await getSiteShellBySlugForAdmin(slug);
      if (!shell) return undefined;
      const contentPages = await prisma.themePage.findMany({
        where: {
          siteId: shell.id,
          OR: [
            { pageType: { contains: "policy" } },
            { pageType: { contains: "faq" } },
            { pageType: { contains: "help" } },
            { pageType: { contains: "blog" } },
            { pageType: { contains: "content" } },
            { slug: { contains: "policy" } },
            { slug: { contains: "faq" } },
            { slug: { contains: "help" } },
            { slug: { contains: "blog" } },
            { slug: { contains: "content" } },
            { templateKey: { contains: "policy" } },
            { templateKey: { contains: "faq" } },
            { templateKey: { contains: "help" } },
            { templateKey: { contains: "blog" } },
            { templateKey: { contains: "content" } }
          ]
        },
        orderBy: { slug: "asc" }
      });
      const fullPagesById = new Map(contentPages.map((page) => [page.id, toThemePage(page)]));
      return {
        ...shell,
        pages: shell.pages.map((page) => fullPagesById.get(page.id) ?? page)
      };
    });
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    throw new RelationalStoreError("relational_site_content_lookup_unavailable", 503);
  }
}

export async function getSiteBySlugForPublicAuth(slug: string): Promise<Site | undefined> {
  try {
    return await getSiteBySlugRelational(slug);
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("public auth site slug lookup", error);
    throw new RelationalStoreError("relational_public_site_lookup_unavailable", 503);
  }
}

export async function getSiteByHostForPublicAuth(host: string | null | undefined): Promise<Site | undefined> {
  try {
    return await getSiteByHostRelational(host);
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("public auth site host lookup", error);
    throw new RelationalStoreError("relational_public_site_host_lookup_unavailable", 503);
  }
}

export type SiteAdminContextRelationalState = {
  products?: Product[];
  jobs?: GenerationJob[];
  apps?: SiteAiApp[];
  media?: MediaAsset[];
  publications?: ThemePublication[];
  auditLogs?: AuditLogEntry[];
  domains?: SiteDomain[];
  gateways?: AiGatewayGroup[];
  siteAdmins?: SiteAdmin[];
  summary?: SiteAdminContextRelationalSummary;
};

export type SiteAdminContextRelationalSummary = {
  productCount: number;
  activeProductCount: number;
  totalPriceCount: number;
  jobCount: number;
  failedJobCount: number;
  openJobCount: number;
  completedJobCount: number;
  appCount: number;
  activeAppCount: number;
  mediaCount: number;
  publicationCount: number;
  customerCount: number;
  availableCredits: number;
  reservedCredits: number;
  orderCount: number;
  paidOrderCount: number;
  subscriptionCount: number;
  ledgerCount: number;
  paymentEventCount: number;
  revenueCents: number;
  activeSubscriptionCount: number;
  activePackCount: number;
  draftPackCount: number;
  albumCount: number;
  readyAlbumCount: number;
  modelCount: number;
  readyModelCount: number;
  inputAssetCount: number;
  generatedAssetCount: number;
  dirtyPageCount: number;
  pendingOrderCount: number;
  monthOrderCount: number;
  monthPaidOrderCount: number;
  monthPendingOrderCount: number;
  monthRevenueCents: number;
  todayJobCount: number;
  monthJobCount: number;
  sevenDayOps: SiteAdminContextRelationalDailyOps[];
  gateway?: AiGatewayGroup;
};

export type SiteAdminContextRelationalDailyOps = {
  day: string;
  orderCount: number;
  paidOrderCount: number;
  pendingOrderCount: number;
  jobCount: number;
  revenueCents: number;
};

export type SiteMediaSummary = {
  total: number;
  usageCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
};

export function clearSiteMediaSummaryCache(siteId: string) {
  siteReadCache.clear(`media-summary:${siteId}`);
  siteReadCache.clear(`admin-summary:light:${siteId}`);
  siteReadCache.clear(`admin-summary:full:${siteId}`);
}

function toAuditLogEntryRelational(record: {
  id: string;
  siteId: string | null;
  actorType: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.JsonValue | null;
  createdAt: Date | string;
}): AuditLogEntry {
  return {
    id: record.id,
    siteId: record.siteId ?? undefined,
    actorType: record.actorType as AuditLogEntry["actorType"],
    actorId: record.actorId,
    action: record.action,
    targetType: record.targetType,
    targetId: record.targetId,
    metadata: cloneJson(record.metadata ?? {}) as Record<string, string | number | boolean>,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt)
  };
}

function toLightGenerationJobRelational(record: {
  id: string;
  siteId: string;
  customerId: string;
  aiAppId: string;
  status: string;
  creditsReserved: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}): GenerationJob {
  return {
    id: record.id,
    siteId: record.siteId,
    customerId: record.customerId,
    aiAppId: record.aiAppId,
    status: record.status as GenerationJob["status"],
    creditsReserved: record.creditsReserved,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
    requestJson: {},
    resultJson: undefined
  };
}

export async function getSiteAdminContextRelationalState(
  siteId: string,
  include: {
    products?: boolean;
    jobs?: boolean;
    lightJobs?: boolean;
    apps?: boolean;
    media?: boolean;
    publications?: boolean;
    auditLogs?: boolean;
    domains?: boolean;
    gateways?: boolean;
    siteAdmins?: boolean;
    summary?: boolean | "light" | "full";
    take?: Partial<Record<"products" | "jobs" | "apps" | "media" | "publications" | "auditLogs" | "domains" | "gateways" | "siteAdmins", number>>;
  }
): Promise<SiteAdminContextRelationalState> {
  const maxTake = (value: number | undefined, fallback: number, max: number) => Math.min(max, Math.max(0, Math.floor(Number(value ?? fallback) || fallback)));
  const take = {
    products: maxTake(include.take?.products, 80, 200),
    jobs: maxTake(include.take?.jobs, 50, 100),
    apps: maxTake(include.take?.apps, 50, 100),
    media: maxTake(include.take?.media, 80, 200),
    publications: maxTake(include.take?.publications, 50, 100),
    auditLogs: maxTake(include.take?.auditLogs, 50, 100),
    domains: maxTake(include.take?.domains, 20, 100),
    gateways: maxTake(include.take?.gateways, 20, 100),
    siteAdmins: maxTake(include.take?.siteAdmins, 20, 100)
  };
  const [
    products,
    jobs,
    apps,
    media,
    publications,
    auditLogs,
    domains,
    gateways,
    siteAdmins,
    summary
  ] = await Promise.all([
    include.products
      ? prisma.product
          .findMany({ where: { siteId }, include: { prices: true }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: take.products })
          .then((rows) => rows.map(mapProduct))
      : Promise.resolve(undefined),
    include.jobs
      ? include.lightJobs
        ? prisma.generationJob
            .findMany({
              where: { siteId },
              select: {
                id: true,
                siteId: true,
                customerId: true,
                aiAppId: true,
                status: true,
                creditsReserved: true,
                createdAt: true,
                updatedAt: true
              },
              orderBy: [{ createdAt: "desc" }, { id: "asc" }],
              take: take.jobs
            })
            .then((rows) => rows.map(toLightGenerationJobRelational))
        : prisma.generationJob
            .findMany({ where: { siteId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: take.jobs })
            .then((rows) => rows.map(mapGenerationJob))
      : Promise.resolve(undefined),
    include.apps
      ? prisma.siteAiApp
          .findMany({ where: { siteId }, include: { aiApp: true }, orderBy: [{ enabled: "desc" }, { routeKey: "asc" }], take: take.apps })
          .then((rows) => rows.map(toSiteAiApp))
      : Promise.resolve(undefined),
    include.media
      ? prisma.mediaAsset
          .findMany({ where: { siteId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: take.media })
          .then((rows) => rows.map(toMediaAsset))
      : Promise.resolve(undefined),
    include.publications
      ? Promise.resolve([])
      : Promise.resolve(undefined),
    include.auditLogs
      ? prisma.auditLog
          .findMany({ where: { siteId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: take.auditLogs })
          .then((rows) => rows.map(toAuditLogEntryRelational))
      : Promise.resolve(undefined),
    include.domains
      ? prisma.siteDomain
          .findMany({ where: { siteId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: take.domains })
          .then((rows) => rows.map(toSiteDomain))
      : Promise.resolve(undefined),
    include.gateways
      ? prisma.aiGatewayGroup
          .findMany({ where: { siteId }, orderBy: [{ status: "asc" }, { name: "asc" }], take: take.gateways })
          .then((rows) => rows.map(toGatewayGroup))
      : Promise.resolve(undefined),
    include.siteAdmins
      ? prisma.siteAdmin
          .findMany({ where: { siteId }, orderBy: [{ role: "asc" }, { createdAt: "asc" }], take: take.siteAdmins })
          .then((rows) => rows.map(toSiteAdmin))
      : Promise.resolve(undefined),
    include.summary ? getSiteAdminContextRelationalSummary(siteId, include.summary === "light" ? "light" : "full") : Promise.resolve(undefined)
  ]);

  return { products, jobs, apps, media, publications, auditLogs, domains, gateways, siteAdmins, summary };
}

export async function getThemePublishPreflightInputsRelational(siteId: string, mediaRefs?: string[]): Promise<{
  products: PublishPreflightProduct[];
  siteAiApps: PublishPreflightSiteAiApp[];
  mediaAssets: PublishPreflightMediaAsset[];
}> {
  const normalizedMediaRefs = mediaRefs ? [...new Set(mediaRefs)].sort() : undefined;
  const mediaCacheKey = normalizedMediaRefs ? normalizedMediaRefs.join(",") || "none" : "all";
  return siteReadCache.get(`theme-preflight-inputs:${siteId}:${mediaCacheKey}`, async () => {
    const [products, siteAiApps, mediaAssets] = await Promise.all([
      prisma.product.findMany({
        where: { siteId },
        select: {
          id: true,
          status: true,
          type: true,
          prices: { select: { stripePriceId: true, amountCents: true } }
        }
      }),
      prisma.siteAiApp.findMany({
        where: { siteId },
        select: {
          id: true,
          enabled: true,
          aiApp: { select: { id: true, slug: true } }
        }
      }),
      prisma.mediaAsset.findMany({
        where: normalizedMediaRefs ? { siteId, id: { in: normalizedMediaRefs } } : { siteId },
        select: { id: true }
      })
    ]);
    return {
      products: products.map((product) => ({
        id: product.id,
        status: product.status as PublishPreflightProduct["status"],
        type: product.type as PublishPreflightProduct["type"],
        prices: product.prices.map((price) => ({
          amountCents: price.amountCents,
          stripePriceId: price.stripePriceId ?? ""
        }))
      })),
      siteAiApps: siteAiApps.map((app) => ({
        id: app.id,
        enabled: app.enabled,
        aiApp: app.aiApp
      })),
      mediaAssets
    };
  }, Number(process.env.SITE_ADMIN_PREFLIGHT_CACHE_TTL_MS ?? 15_000));
}

export async function getSiteMediaSummaryRelational(siteId: string): Promise<SiteMediaSummary> {
  return siteReadCache.get(`media-summary:${siteId}`, async () => {
    const [usageGroups, sourceGroups] = await Promise.all([
      prisma.mediaAsset.groupBy({
        by: ["usageType"],
        where: { siteId },
        _count: { _all: true }
      }),
      prisma.mediaAsset.groupBy({
        by: ["sourceType"],
        where: { siteId },
        _count: { _all: true }
      })
    ]);
    const usageCounts = Object.fromEntries(usageGroups.map((group) => [group.usageType ?? "theme", group._count._all]));
    const sourceCounts = Object.fromEntries(sourceGroups.map((group) => [group.sourceType ?? "manual", group._count._all]));
    return {
      total: usageGroups.reduce((total, group) => total + group._count._all, 0),
      usageCounts,
      sourceCounts
    };
  }, Number(process.env.SITE_ADMIN_MEDIA_SUMMARY_CACHE_TTL_MS ?? 15_000));
}

async function getSiteAdminContextRelationalSummary(siteId: string, mode: "light" | "full" = "full"): Promise<SiteAdminContextRelationalSummary> {
  return siteReadCache.get(
    `admin-summary:${mode}:${siteId}`,
    () => runSiteAdminRead(
      `admin summary:${mode}:${siteId}`,
      () => mode === "light" ? loadLightSiteAdminContextRelationalSummary(siteId) : loadSiteAdminContextRelationalSummary(siteId),
      { timeoutMs: siteAdminSummaryReadTimeoutMs }
    ),
    Number(process.env.SITE_ADMIN_SUMMARY_CACHE_TTL_MS ?? 15_000)
  );
}

function numberFromDb(value: bigint | number | string | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function emptyDailyOps(): SiteAdminContextRelationalDailyOps[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    day.setHours(0, 0, 0, 0);
    return {
      day: day.toISOString(),
      orderCount: 0,
      paidOrderCount: 0,
      pendingOrderCount: 0,
      jobCount: 0,
      revenueCents: 0
    };
  });
}

async function loadLightSiteAdminContextRelationalSummary(siteId: string): Promise<SiteAdminContextRelationalSummary> {
  type LightSummaryRow = Record<
    | "productCount"
    | "activeProductCount"
    | "totalPriceCount"
    | "jobCount"
    | "failedJobCount"
    | "openJobCount"
    | "completedJobCount"
    | "appCount"
    | "activeAppCount"
    | "mediaCount"
    | "publicationCount"
    | "customerCount"
    | "availableCredits"
    | "reservedCredits"
    | "orderCount"
    | "paidOrderCount"
    | "subscriptionCount"
    | "activeSubscriptionCount"
    | "revenueCents",
    bigint | number | string | null
  >;
  const [summaryRows, gateway] = await Promise.all([
    prisma.$queryRaw<LightSummaryRow[]>`
      WITH
        product_summary AS (
          SELECT
            COUNT(*) AS "productCount",
            COUNT(*) FILTER (WHERE "status" = 'active') AS "activeProductCount"
          FROM "Product"
          WHERE "siteId" = ${siteId}
        ),
        price_summary AS (
          SELECT COUNT(*) AS "totalPriceCount"
          FROM "Price"
          WHERE "siteId" = ${siteId}
        ),
        job_summary AS (
          SELECT
            COUNT(*) AS "jobCount",
            COUNT(*) FILTER (WHERE "status" IN ('failed', 'refunded')) AS "failedJobCount",
            COUNT(*) FILTER (WHERE "status" IN ('running', 'queued')) AS "openJobCount",
            COUNT(*) FILTER (WHERE "status" = 'succeeded') AS "completedJobCount"
          FROM "GenerationJob"
          WHERE "siteId" = ${siteId}
        ),
        app_summary AS (
          SELECT
            COUNT(*) AS "appCount",
            COUNT(*) FILTER (WHERE "enabled" = true) AS "activeAppCount"
          FROM "SiteAiApp"
          WHERE "siteId" = ${siteId}
        ),
        media_summary AS (
          SELECT COUNT(*) AS "mediaCount"
          FROM "MediaAsset"
          WHERE "siteId" = ${siteId}
        ),
        publication_summary AS (
          SELECT 0::bigint AS "publicationCount"
        ),
        customer_summary AS (
          SELECT COUNT(*) AS "customerCount"
          FROM "Customer"
          WHERE "siteId" = ${siteId}
        ),
        balance_summary AS (
          SELECT
            COALESCE(SUM("balance"), 0) AS "availableCredits",
            COALESCE(SUM("reserved"), 0) AS "reservedCredits"
          FROM "CreditBalance"
          WHERE "siteId" = ${siteId}
        ),
        order_summary AS (
          SELECT
            COUNT(*) AS "orderCount",
            COUNT(*) FILTER (WHERE "status" IN ('paid', 'fulfilled')) AS "paidOrderCount",
            COALESCE(SUM("amountCents") FILTER (WHERE "status" IN ('paid', 'fulfilled')), 0) AS "revenueCents"
          FROM "Order"
          WHERE "siteId" = ${siteId}
        ),
        subscription_summary AS (
          SELECT
            COUNT(*) AS "subscriptionCount",
            COUNT(*) FILTER (WHERE "status" IN ('active', 'trialing')) AS "activeSubscriptionCount"
          FROM "Subscription"
          WHERE "siteId" = ${siteId}
        )
      SELECT
        product_summary."productCount",
        product_summary."activeProductCount",
        price_summary."totalPriceCount",
        job_summary."jobCount",
        job_summary."failedJobCount",
        job_summary."openJobCount",
        job_summary."completedJobCount",
        app_summary."appCount",
        app_summary."activeAppCount",
        media_summary."mediaCount",
        publication_summary."publicationCount",
        customer_summary."customerCount",
        balance_summary."availableCredits",
        balance_summary."reservedCredits",
        order_summary."orderCount",
        order_summary."paidOrderCount",
        subscription_summary."subscriptionCount",
        subscription_summary."activeSubscriptionCount",
        order_summary."revenueCents"
      FROM product_summary
      CROSS JOIN price_summary
      CROSS JOIN job_summary
      CROSS JOIN app_summary
      CROSS JOIN media_summary
      CROSS JOIN publication_summary
      CROSS JOIN customer_summary
      CROSS JOIN balance_summary
      CROSS JOIN order_summary
      CROSS JOIN subscription_summary
    `,
    prisma.aiGatewayGroup
      .findFirst({ where: { siteId }, orderBy: [{ status: "asc" }, { name: "asc" }] })
      .then((row) => (row ? toGatewayGroup(row) : undefined))
  ]);
  const summary = summaryRows[0];
  return {
    productCount: numberFromDb(summary?.productCount),
    activeProductCount: numberFromDb(summary?.activeProductCount),
    totalPriceCount: numberFromDb(summary?.totalPriceCount),
    jobCount: numberFromDb(summary?.jobCount),
    failedJobCount: numberFromDb(summary?.failedJobCount),
    openJobCount: numberFromDb(summary?.openJobCount),
    completedJobCount: numberFromDb(summary?.completedJobCount),
    appCount: numberFromDb(summary?.appCount),
    activeAppCount: numberFromDb(summary?.activeAppCount),
    mediaCount: numberFromDb(summary?.mediaCount),
    publicationCount: numberFromDb(summary?.publicationCount),
    customerCount: numberFromDb(summary?.customerCount),
    availableCredits: numberFromDb(summary?.availableCredits),
    reservedCredits: numberFromDb(summary?.reservedCredits),
    orderCount: numberFromDb(summary?.orderCount),
    paidOrderCount: numberFromDb(summary?.paidOrderCount),
    subscriptionCount: numberFromDb(summary?.subscriptionCount),
    ledgerCount: 0,
    paymentEventCount: 0,
    revenueCents: numberFromDb(summary?.revenueCents),
    activeSubscriptionCount: numberFromDb(summary?.activeSubscriptionCount),
    activePackCount: 0,
    draftPackCount: 0,
    albumCount: 0,
    readyAlbumCount: 0,
    modelCount: 0,
    readyModelCount: 0,
    inputAssetCount: 0,
    generatedAssetCount: 0,
    dirtyPageCount: 0,
    pendingOrderCount: 0,
    monthOrderCount: 0,
    monthPaidOrderCount: 0,
    monthPendingOrderCount: 0,
    monthRevenueCents: 0,
    todayJobCount: 0,
    monthJobCount: 0,
    sevenDayOps: emptyDailyOps(),
    gateway
  };
}

async function loadSiteAdminContextRelationalSummary(siteId: string): Promise<SiteAdminContextRelationalSummary> {
  type SummaryRow = Record<
    | "productCount"
    | "activeProductCount"
    | "totalPriceCount"
    | "jobCount"
    | "failedJobCount"
    | "openJobCount"
    | "completedJobCount"
    | "appCount"
    | "activeAppCount"
    | "mediaCount"
    | "publicationCount"
    | "customerCount"
    | "availableCredits"
    | "reservedCredits"
    | "orderCount"
    | "paidOrderCount"
    | "subscriptionCount"
    | "ledgerCount"
    | "paymentEventCount"
    | "revenueCents"
    | "activeSubscriptionCount"
    | "activePackCount"
    | "draftPackCount"
    | "albumCount"
    | "readyAlbumCount"
    | "modelCount"
    | "readyModelCount"
    | "inputAssetCount"
    | "generatedAssetCount"
    | "dirtyPageCount"
    | "pendingOrderCount"
    | "monthOrderCount"
    | "monthPaidOrderCount"
    | "monthPendingOrderCount"
    | "monthRevenueCents"
    | "todayJobCount"
    | "monthJobCount",
    bigint | number | string | null
  >;
  type DailyOpsRow = {
    day: Date | string | null;
    orderCount: bigint | number | string | null;
    paidOrderCount: bigint | number | string | null;
    pendingOrderCount: bigint | number | string | null;
    jobCount: bigint | number | string | null;
    revenueCents: bigint | number | string | null;
  };
  const [summaryRows, dailyOpsRows, gateway] = await Promise.all([
    prisma.$queryRaw<SummaryRow[]>`
      WITH
        product_summary AS (
          SELECT
            COUNT(*) AS "productCount",
            COUNT(*) FILTER (WHERE "status" = 'active') AS "activeProductCount"
          FROM "Product"
          WHERE "siteId" = ${siteId}
        ),
        price_summary AS (
          SELECT COUNT(*) AS "totalPriceCount"
          FROM "Price"
          WHERE "siteId" = ${siteId}
        ),
        job_summary AS (
          SELECT
            COUNT(*) AS "jobCount",
            COUNT(*) FILTER (WHERE "status" IN ('failed', 'refunded')) AS "failedJobCount",
            COUNT(*) FILTER (WHERE "status" IN ('running', 'queued')) AS "openJobCount",
            COUNT(*) FILTER (WHERE "status" = 'succeeded') AS "completedJobCount",
            COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '1 day') AS "todayJobCount",
            COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS "monthJobCount"
          FROM "GenerationJob"
          WHERE "siteId" = ${siteId}
        ),
        app_summary AS (
          SELECT
            COUNT(*) AS "appCount",
            COUNT(*) FILTER (WHERE "enabled" = true) AS "activeAppCount"
          FROM "SiteAiApp"
          WHERE "siteId" = ${siteId}
        ),
        media_summary AS (
          SELECT COUNT(*) AS "mediaCount"
          FROM "MediaAsset"
          WHERE "siteId" = ${siteId}
        ),
        publication_summary AS (
          SELECT 0::bigint AS "publicationCount"
        ),
        customer_summary AS (
          SELECT COUNT(*) AS "customerCount"
          FROM "Customer"
          WHERE "siteId" = ${siteId}
        ),
        balance_summary AS (
          SELECT
            COALESCE(SUM("balance"), 0) AS "availableCredits",
            COALESCE(SUM("reserved"), 0) AS "reservedCredits"
          FROM "CreditBalance"
          WHERE "siteId" = ${siteId}
        ),
        order_summary AS (
          SELECT
            COUNT(*) AS "orderCount",
            COUNT(*) FILTER (WHERE "status" IN ('paid', 'fulfilled')) AS "paidOrderCount",
            COUNT(*) FILTER (WHERE "status" IN ('created', 'checkout_started')) AS "pendingOrderCount",
            COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS "monthOrderCount",
            COUNT(*) FILTER (WHERE "status" IN ('paid', 'fulfilled') AND "createdAt" >= NOW() - INTERVAL '30 days') AS "monthPaidOrderCount",
            COUNT(*) FILTER (WHERE "status" IN ('created', 'checkout_started') AND "createdAt" >= NOW() - INTERVAL '30 days') AS "monthPendingOrderCount",
            COALESCE(SUM("amountCents") FILTER (WHERE "status" IN ('paid', 'fulfilled')), 0) AS "revenueCents",
            COALESCE(SUM("amountCents") FILTER (WHERE "status" IN ('paid', 'fulfilled') AND "createdAt" >= NOW() - INTERVAL '30 days'), 0) AS "monthRevenueCents"
          FROM "Order"
          WHERE "siteId" = ${siteId}
        ),
        subscription_summary AS (
          SELECT
            COUNT(*) AS "subscriptionCount",
            COUNT(*) FILTER (WHERE "status" IN ('active', 'trialing')) AS "activeSubscriptionCount"
          FROM "Subscription"
          WHERE "siteId" = ${siteId}
        ),
        ledger_summary AS (
          SELECT COUNT(*) AS "ledgerCount"
          FROM "CreditLedger"
          WHERE "siteId" = ${siteId}
        ),
        payment_event_summary AS (
          SELECT COUNT(*) AS "paymentEventCount"
          FROM "PaymentEvent"
          WHERE "siteId" = ${siteId}
        ),
        pack_summary AS (
          SELECT
            COUNT(*) FILTER (WHERE "status" = 'active') AS "activePackCount",
            COUNT(*) FILTER (WHERE "status" = 'draft') AS "draftPackCount"
          FROM "CreativePack"
          WHERE "siteId" = ${siteId}
        ),
        album_summary AS (
          SELECT
            COUNT(*) AS "albumCount",
            COUNT(*) FILTER (WHERE "status" = 'ready') AS "readyAlbumCount"
          FROM "Album"
          WHERE "siteId" = ${siteId}
        ),
        model_summary AS (
          SELECT
            COUNT(*) AS "modelCount",
            COUNT(*) FILTER (WHERE "status" = 'ready') AS "readyModelCount"
          FROM "CustomerModel"
          WHERE "siteId" = ${siteId}
        ),
        asset_summary AS (
          SELECT
            COUNT(*) FILTER (WHERE "role" = 'input' AND "deletedAt" IS NULL) AS "inputAssetCount",
            COUNT(*) FILTER (WHERE "role" = 'output' AND "deletedAt" IS NULL) AS "generatedAssetCount"
          FROM "AssetUpload"
          WHERE "siteId" = ${siteId}
        ),
        page_summary AS (
          SELECT COUNT(*) FILTER (WHERE "draftJson"::jsonb IS DISTINCT FROM "publishedJson"::jsonb) AS "dirtyPageCount"
          FROM "ThemePage"
          WHERE "siteId" = ${siteId}
        )
      SELECT
        product_summary."productCount",
        product_summary."activeProductCount",
        price_summary."totalPriceCount",
        job_summary."jobCount",
        job_summary."failedJobCount",
        job_summary."openJobCount",
        job_summary."completedJobCount",
        app_summary."appCount",
        app_summary."activeAppCount",
        media_summary."mediaCount",
        publication_summary."publicationCount",
        customer_summary."customerCount",
        balance_summary."availableCredits",
        balance_summary."reservedCredits",
        order_summary."orderCount",
        order_summary."paidOrderCount",
        subscription_summary."subscriptionCount",
        ledger_summary."ledgerCount",
        payment_event_summary."paymentEventCount",
        order_summary."revenueCents",
        subscription_summary."activeSubscriptionCount",
        pack_summary."activePackCount",
        pack_summary."draftPackCount",
        album_summary."albumCount",
        album_summary."readyAlbumCount",
        model_summary."modelCount",
        model_summary."readyModelCount",
        asset_summary."inputAssetCount",
        asset_summary."generatedAssetCount",
        page_summary."dirtyPageCount",
        order_summary."pendingOrderCount",
        order_summary."monthOrderCount",
        order_summary."monthPaidOrderCount",
        order_summary."monthPendingOrderCount",
        order_summary."monthRevenueCents",
        job_summary."todayJobCount",
        job_summary."monthJobCount"
      FROM product_summary
      CROSS JOIN price_summary
      CROSS JOIN job_summary
      CROSS JOIN app_summary
      CROSS JOIN media_summary
      CROSS JOIN publication_summary
      CROSS JOIN customer_summary
      CROSS JOIN balance_summary
      CROSS JOIN order_summary
      CROSS JOIN subscription_summary
      CROSS JOIN ledger_summary
      CROSS JOIN payment_event_summary
      CROSS JOIN pack_summary
      CROSS JOIN album_summary
      CROSS JOIN model_summary
      CROSS JOIN asset_summary
      CROSS JOIN page_summary
    `,
    prisma.$queryRaw<DailyOpsRow[]>`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', NOW()) - INTERVAL '6 days',
          date_trunc('day', NOW()),
          INTERVAL '1 day'
        ) AS "day"
      )
      SELECT
        days."day" AS "day",
        COALESCE(orders."orderCount", 0) AS "orderCount",
        COALESCE(orders."paidOrderCount", 0) AS "paidOrderCount",
        COALESCE(orders."pendingOrderCount", 0) AS "pendingOrderCount",
        COALESCE(jobs."jobCount", 0) AS "jobCount",
        COALESCE(orders."revenueCents", 0) AS "revenueCents"
      FROM days
      LEFT JOIN (
        SELECT
          date_trunc('day', "createdAt") AS "day",
          COUNT(*) AS "orderCount",
          COUNT(*) FILTER (WHERE "status" IN ('paid', 'fulfilled')) AS "paidOrderCount",
          COUNT(*) FILTER (WHERE "status" IN ('created', 'checkout_started')) AS "pendingOrderCount",
          COALESCE(SUM("amountCents") FILTER (WHERE "status" IN ('paid', 'fulfilled')), 0) AS "revenueCents"
        FROM "Order"
        WHERE "siteId" = ${siteId}
          AND "createdAt" >= date_trunc('day', NOW()) - INTERVAL '6 days'
        GROUP BY 1
      ) orders ON orders."day" = days."day"
      LEFT JOIN (
        SELECT date_trunc('day', "createdAt") AS "day", COUNT(*) AS "jobCount"
        FROM "GenerationJob"
        WHERE "siteId" = ${siteId}
          AND "createdAt" >= date_trunc('day', NOW()) - INTERVAL '6 days'
        GROUP BY 1
      ) jobs ON jobs."day" = days."day"
      ORDER BY days."day" ASC
    `,
    prisma.aiGatewayGroup
      .findFirst({ where: { siteId }, orderBy: [{ status: "asc" }, { name: "asc" }] })
      .then((row) => (row ? toGatewayGroup(row) : undefined))
  ]);
  const summary = summaryRows[0];
  const sevenDayOps = dailyOpsRows.map((row) => ({
    day: row.day instanceof Date ? row.day.toISOString() : String(row.day ?? ""),
    orderCount: numberFromDb(row.orderCount),
    paidOrderCount: numberFromDb(row.paidOrderCount),
    pendingOrderCount: numberFromDb(row.pendingOrderCount),
    jobCount: numberFromDb(row.jobCount),
    revenueCents: numberFromDb(row.revenueCents)
  }));

  return {
    productCount: numberFromDb(summary?.productCount),
    activeProductCount: numberFromDb(summary?.activeProductCount),
    totalPriceCount: numberFromDb(summary?.totalPriceCount),
    jobCount: numberFromDb(summary?.jobCount),
    failedJobCount: numberFromDb(summary?.failedJobCount),
    openJobCount: numberFromDb(summary?.openJobCount),
    completedJobCount: numberFromDb(summary?.completedJobCount),
    appCount: numberFromDb(summary?.appCount),
    activeAppCount: numberFromDb(summary?.activeAppCount),
    mediaCount: numberFromDb(summary?.mediaCount),
    publicationCount: numberFromDb(summary?.publicationCount),
    customerCount: numberFromDb(summary?.customerCount),
    availableCredits: numberFromDb(summary?.availableCredits),
    reservedCredits: numberFromDb(summary?.reservedCredits),
    orderCount: numberFromDb(summary?.orderCount),
    paidOrderCount: numberFromDb(summary?.paidOrderCount),
    subscriptionCount: numberFromDb(summary?.subscriptionCount),
    ledgerCount: numberFromDb(summary?.ledgerCount),
    paymentEventCount: numberFromDb(summary?.paymentEventCount),
    revenueCents: numberFromDb(summary?.revenueCents),
    activeSubscriptionCount: numberFromDb(summary?.activeSubscriptionCount),
    activePackCount: numberFromDb(summary?.activePackCount),
    draftPackCount: numberFromDb(summary?.draftPackCount),
    albumCount: numberFromDb(summary?.albumCount),
    readyAlbumCount: numberFromDb(summary?.readyAlbumCount),
    modelCount: numberFromDb(summary?.modelCount),
    readyModelCount: numberFromDb(summary?.readyModelCount),
    inputAssetCount: numberFromDb(summary?.inputAssetCount),
    generatedAssetCount: numberFromDb(summary?.generatedAssetCount),
    dirtyPageCount: numberFromDb(summary?.dirtyPageCount),
    pendingOrderCount: numberFromDb(summary?.pendingOrderCount),
    monthOrderCount: numberFromDb(summary?.monthOrderCount),
    monthPaidOrderCount: numberFromDb(summary?.monthPaidOrderCount),
    monthPendingOrderCount: numberFromDb(summary?.monthPendingOrderCount),
    monthRevenueCents: numberFromDb(summary?.monthRevenueCents),
    todayJobCount: numberFromDb(summary?.todayJobCount),
    monthJobCount: numberFromDb(summary?.monthJobCount),
    sevenDayOps,
    gateway
  };
}

export async function getFirstSiteAdminEmailRelational(siteId: string): Promise<string | undefined> {
  return siteReadCache.get(`first-admin:${siteId}`, () => runSiteAdminRead(`first site admin:${siteId}`, async () => {
    const admin = await prisma.siteAdmin.findFirst({
      where: { siteId },
      orderBy: { createdAt: "asc" },
      select: { email: true }
    });
    return admin?.email;
  }));
}

export async function getFirstSiteAdminEmail(siteId: string): Promise<string | undefined> {
  if (shouldUseRelationalReadFallbackCircuit()) {
    const fallback = localFirstSiteAdminEmail(siteId);
    if (fallback) return fallback;
  }
  try {
    return await getFirstSiteAdminEmailRelational(siteId);
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    const fallback = localFirstSiteAdminEmail(siteId);
    if (fallback) {
      warnRelationalFallback("first site admin email lookup", error);
      return fallback;
    }
    throw new RelationalStoreError("relational_site_admin_email_lookup_unavailable", 503);
  }
}

export async function createSiteRelational(params: {
  name: string;
  slug?: string;
  ownerEmail: string;
  ownerPassword?: string;
  sourceSiteId?: string;
  domain?: string;
}): Promise<{
  site: Site;
  domain: SiteDomain;
  admin: SiteAdmin;
  siteAiApps: SiteAiApp[];
  gatewayGroup: AiGatewayGroup;
}> {
  const slug = slugify(params.slug || params.name);
  if (!slug) throw new RelationalStoreError("invalid_site_slug", 400);
  const ownerEmail = params.ownerEmail.trim().toLowerCase();
  if (!ownerEmail.includes("@")) throw new RelationalStoreError("invalid_owner_email", 400);

  const result = await prisma.$transaction(async (tx) => {
    const existingSite = await tx.site.findUnique({ where: { slug } });
    if (existingSite) throw new RelationalStoreError("site_slug_exists", 409);
    const domainName = (params.domain || `${slug}.localhost`).trim().toLowerCase();
    const existingDomain = await tx.siteDomain.findUnique({ where: { domain: domainName } });
    if (existingDomain) throw new RelationalStoreError("site_domain_exists", 409);

    const sourceSite = await tx.site.findFirst({
      where: params.sourceSiteId ? { id: params.sourceSiteId } : undefined,
      include: {
        pages: true,
        settings: true,
        aiApps: { include: { aiApp: true } }
      }
    });
    if (!sourceSite) throw new RelationalStoreError("source_site_not_found", 404);

    const siteId = `site_${slug}`;
    const branding = cloneJson(sourceSite.branding) as Site["branding"];
    branding.logoText = params.name.trim().split(/\s+/)[0] || params.name.trim();
    branding.description = `New AI subscription site cloned from ${sourceSite.name}.`;

    await tx.site.create({
      data: {
        id: siteId,
        name: params.name.trim(),
        slug,
        status: "draft",
        primaryDomain: domainName,
        timezone: sourceSite.timezone,
        currency: sourceSite.currency,
        branding: branding as unknown as Prisma.InputJsonValue
      }
    });

    const domainRecord = await tx.siteDomain.create({
      data: {
        id: uid("dom"),
        siteId,
        domain: domainName,
        isPrimary: true,
        status: "pending"
      }
    });

    const adminRecord = await tx.siteAdmin.create({
      data: {
        id: uid("admin"),
        siteId,
        email: ownerEmail,
        passwordHash: hashRelationalPassword(params.ownerPassword || `${slug}123`),
        displayName: ownerEmail.split("@")[0] || ownerEmail,
        role: "owner"
      }
    });

    if (sourceSite.settings) {
      await tx.themeSettings.create({
        data: {
          id: `settings_${siteId}`,
          siteId,
          draftJson: cloneJson(sourceSite.settings.draftJson) as unknown as Prisma.InputJsonValue,
          publishedJson: cloneJson(sourceSite.settings.publishedJson) as unknown as Prisma.InputJsonValue
        }
      });
    }

    if (sourceSite.pages.length) {
      await tx.themePage.createMany({
        data: sourceSite.pages.map((page, index) => ({
          id: `${siteId}_${slugify(page.slug) || `page_${index + 1}`}`,
          siteId,
          pageType: page.pageType,
          templateKey: page.templateKey,
          slug: page.slug,
          title: page.title,
          draftJson: cloneJson(page.draftJson) as unknown as Prisma.InputJsonValue,
          publishedJson: cloneJson(page.publishedJson) as unknown as Prisma.InputJsonValue,
          draftMeta: page.draftMeta
            ? cloneJson(page.draftMeta) as unknown as Prisma.InputJsonValue
            : undefined
        }))
      });
    }

    if (sourceSite.aiApps.length) {
      await tx.siteAiApp.createMany({
        data: sourceSite.aiApps.map((app) => ({
          id: `sai_${slug}_${app.aiApp.slug}`,
          siteId,
          aiAppId: app.aiAppId,
          enabled: app.enabled,
          creditCost: app.creditCost,
          routeKey: app.routeKey,
          workflowConfig: app.workflowConfig
            ? cloneJson(app.workflowConfig) as unknown as Prisma.InputJsonValue
            : undefined,
          providerConfig: app.providerConfig
            ? cloneJson(app.providerConfig) as unknown as Prisma.InputJsonValue
            : undefined
        }))
      });
    }
    const siteAiAppRecords = await tx.siteAiApp.findMany({
      where: { siteId },
      include: { aiApp: true },
      orderBy: { createdAt: "asc" }
    });
    const siteAiApps = siteAiAppRecords.map(toSiteAiApp);

    const gatewayGroupRecord = await tx.aiGatewayGroup.create({
      data: {
        id: `gw_${slug}_primary`,
        siteId,
        name: `${branding.logoText} primary quota`,
        status: "paused",
        modelAllowlist: ["gpt-image-2", "gpt-4.1-mini"],
        monthlyQuota: 3000,
        usedQuota: 0,
        retryStatusCodes: [429, 500, 502, 503],
        rateLimitPerMinute: 30,
        accountPoolMode: "shared",
        unavailableReason: "Stripe Connect pending"
      }
    });
    const gatewayGroup = toGatewayGroup(gatewayGroupRecord);

    await addAuditLogRelational(
      tx,
      {
        siteId,
        actorType: "platform_admin",
        actorId: "platform",
        action: "site_created",
        targetType: "site",
        targetId: siteId,
        metadata: { slug, domain: domainName }
      },
      { syncPlatformState: false }
    );

    return {
      site: toSite(
        await tx.site.findUniqueOrThrow({
          where: { id: siteId },
          include: { domains: true, pages: true, settings: true, connect: true }
        })
      ),
      domain: toSiteDomain(domainRecord),
      admin: toSiteAdmin(adminRecord),
      siteAiApps,
      gatewayGroup
    };
  }, { maxWait: 15000, timeout: 120000 });
  clearSiteReadCache();
  const { clearPlatformReadCache } = await import("@/lib/stores/platform-store");
  clearPlatformReadCache();
  return result;
}

export async function addSiteDomainRelational(params: {
  siteId: string;
  domain: string;
  isPrimary?: boolean;
}): Promise<{ domain: SiteDomain; site: Site }> {
  const domainName = params.domain.trim().toLowerCase();
  if (!domainName.includes(".")) throw new RelationalStoreError("invalid_domain", 400);

  return prisma.$transaction(async (tx) => {
    const site = await tx.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
    if (!site) throw new RelationalStoreError("site_not_found", 404);
    const existingDomain = await tx.siteDomain.findUnique({ where: { domain: domainName } });
    if (existingDomain) throw new RelationalStoreError("site_domain_exists", 409);
    if (params.isPrimary) {
      await tx.siteDomain.updateMany({ where: { siteId: params.siteId }, data: { isPrimary: false } });
    }
    const domain = await tx.siteDomain.create({
      data: {
        id: uid("dom"),
        siteId: params.siteId,
        domain: domainName,
        isPrimary: Boolean(params.isPrimary),
        status: "pending"
      }
    });
    if (params.isPrimary) {
      await tx.site.update({ where: { id: params.siteId }, data: { primaryDomain: domainName } });
    }
    const updatedSite = await tx.site.findUniqueOrThrow({
      where: { id: params.siteId },
      include: { domains: true, pages: true, settings: true, connect: true }
    });
    return { domain: toSiteDomain(domain), site: toSite(updatedSite) };
  });
}

export async function updateSiteDomainRelational(params: {
  siteId: string;
  domainId: string;
  isPrimary?: boolean;
  status?: SiteDomain["status"];
  allowedAiProviderIds?: string[];
}): Promise<{ domain: SiteDomain; site: Site }> {
  return prisma.$transaction(async (tx) => {
    const domain = await tx.siteDomain.findFirst({ where: { siteId: params.siteId, id: params.domainId } });
    if (!domain) throw new RelationalStoreError("site_domain_not_found", 404);
    if (params.isPrimary) {
      await tx.siteDomain.updateMany({ where: { siteId: params.siteId }, data: { isPrimary: false } });
    }
    const updated = await tx.siteDomain.update({
      where: { id: domain.id },
      data: {
        status: params.isPrimary ? "active" : params.status,
        isPrimary: params.isPrimary ?? domain.isPrimary,
        allowedAiProviderIds: params.allowedAiProviderIds?.map((id) => id.trim()).filter(Boolean)
      }
    });
    return { domain: toSiteDomain(updated), site: await getSiteRelational(params.siteId) };
  });
}

export async function deleteSiteDomainRelational(params: { siteId: string; domainId: string }): Promise<{ deletedDomain: SiteDomain; site: Site }> {
  return prisma.$transaction(async (tx) => {
    const site = await tx.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
    if (!site) throw new RelationalStoreError("site_not_found", 404);
    const domain = await tx.siteDomain.findFirst({ where: { siteId: params.siteId, id: params.domainId } });
    if (!domain) throw new RelationalStoreError("site_domain_not_found", 404);
    const fallback = domain.isPrimary
      ? await tx.siteDomain.findFirst({
          where: { siteId: params.siteId, id: { not: params.domainId } },
          orderBy: { createdAt: "asc" }
        })
      : null;
    if (domain.isPrimary && !fallback) throw new RelationalStoreError("site_requires_primary_domain", 409);

    await tx.siteDomain.delete({ where: { id: domain.id } });
    if (domain.isPrimary && fallback) {
      const fallbackStatus = fallback.status === "failed" ? "pending" : fallback.status;
      await tx.siteDomain.update({
        where: { id: fallback.id },
        data: { isPrimary: true, status: fallbackStatus }
      });
      await tx.site.update({
        where: { id: params.siteId },
        data: { primaryDomain: fallback.domain }
      });
    }

    return {
      deletedDomain: toSiteDomain(domain),
      site: await getSiteRelational(params.siteId)
    };
  });
}

export async function updateSiteSettingsRelational(params: {
  siteId: string;
  actor?: string;
  actorType?: "platform_admin" | "site_admin" | "customer" | "system" | "worker";
  name: string;
  status: Site["status"];
  currency: string;
  timezone: string;
  signupCreditGrant?: number;
  branding: Site["branding"];
  connect: Site["connect"];
}): Promise<{ site: Site }> {
  const name = params.name.trim();
  const currency = params.currency.trim().toUpperCase();
  const timezone = params.timezone.trim();
  const branding = {
    logoText: params.branding.logoText.trim(),
    market: params.branding.market.trim(),
    description: params.branding.description.trim()
  };
  if (!name) throw new RelationalStoreError("invalid_site_name", 400);
  if (!currency) throw new RelationalStoreError("invalid_currency", 400);
  if (!timezone) throw new RelationalStoreError("invalid_timezone", 400);
  if (!branding.logoText || !branding.market || !branding.description) throw new RelationalStoreError("invalid_branding", 400);
  const signupCreditGrant =
    params.signupCreditGrant === undefined ? undefined : Math.trunc(Number(params.signupCreditGrant));
  if (signupCreditGrant !== undefined && (!Number.isFinite(signupCreditGrant) || signupCreditGrant < 0)) {
    throw new RelationalStoreError("invalid_signup_credit_grant", 400);
  }

  return prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id: params.siteId },
      data: {
        name,
        status: params.status,
        currency,
        timezone,
        ...(signupCreditGrant === undefined ? {} : { signupCreditGrant }),
        branding: branding as unknown as Prisma.InputJsonValue
      }
    });
    await tx.stripeConnectAccount.upsert({
      where: { siteId: params.siteId },
      create: {
        id: `connect_${params.siteId}`,
        siteId: params.siteId,
        stripeAccountId: params.connect.stripeAccountId.trim(),
        onboardingStatus: params.connect.status,
        chargesEnabled: params.connect.chargesEnabled,
        payoutsEnabled: params.connect.payoutsEnabled
      },
      update: {
        stripeAccountId: params.connect.stripeAccountId.trim(),
        onboardingStatus: params.connect.status,
        chargesEnabled: params.connect.chargesEnabled,
        payoutsEnabled: params.connect.payoutsEnabled
      }
    });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: params.actorType ?? "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "site_settings_updated",
      targetType: "site",
      targetId: params.siteId,
      metadata: {
        status: params.status,
        currency,
        timezone,
        connectStatus: params.connect.status,
        ...(signupCreditGrant === undefined ? {} : { signupCreditGrant: String(signupCreditGrant) })
      }
    });
    return { site: await getSiteRelational(params.siteId) };
  });
}

export async function updateSiteSignupCreditGrantRelational(params: {
  siteId: string;
  signupCreditGrant: number;
  actor?: string;
}): Promise<{ site: Site }> {
  const signupCreditGrant = Math.trunc(Number(params.signupCreditGrant));
  if (!Number.isFinite(signupCreditGrant) || signupCreditGrant < 0) {
    throw new RelationalStoreError("invalid_signup_credit_grant", 400);
  }

  return prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id: params.siteId },
      data: { signupCreditGrant }
    });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "site_signup_credit_grant_updated",
      targetType: "site",
      targetId: params.siteId,
      metadata: { signupCreditGrant: String(signupCreditGrant) }
    });
    return { site: await getSiteRelational(params.siteId) };
  });
}

export async function createSiteAdminRelational(params: {
  siteId: string;
  email: string;
  password: string;
  displayName: string;
  role: SiteAdmin["role"];
  actor?: string;
}): Promise<{ admin: SiteAdmin }> {
  const email = params.email.trim().toLowerCase();
  const displayName = params.displayName.trim();
  if (!email.includes("@")) throw new RelationalStoreError("invalid_site_admin_email", 400);
  if (params.password.trim().length < 6) throw new RelationalStoreError("invalid_site_admin_password", 400);
  if (!displayName) throw new RelationalStoreError("invalid_site_admin_name", 400);
  if (!["owner", "admin", "support"].includes(params.role)) throw new RelationalStoreError("invalid_site_admin_role", 400);
  const admin = await prisma.siteAdmin.create({
    data: { id: uid("admin"), siteId: params.siteId, email, passwordHash: hashRelationalPassword(params.password.trim()), displayName, role: params.role }
  });
  await addAuditLogRelational(prisma, {
    siteId: params.siteId,
    actorType: "site_admin",
    actorId: params.actor ?? "site_admin_demo",
    action: "site_admin_created",
    targetType: "site_admin",
    targetId: admin.id,
    metadata: { email, role: params.role }
  }, { syncPlatformState: false });
  return { admin: toSiteAdmin(admin) };
}

export async function updateSiteAdminRelational(params: {
  siteId: string;
  adminId: string;
  displayName?: string;
  role?: SiteAdmin["role"];
  password?: string;
  actor?: string;
}): Promise<{ admin: SiteAdmin }> {
  const data: { displayName?: string; role?: string; passwordHash?: string } = {};
  const metadata: Record<string, string | boolean> = {};
  if (params.displayName !== undefined) {
    data.displayName = params.displayName.trim();
    if (!data.displayName) throw new RelationalStoreError("invalid_site_admin_name", 400);
    metadata.displayName = data.displayName;
  }
  if (params.role !== undefined) {
    if (!["owner", "admin", "support"].includes(params.role)) throw new RelationalStoreError("invalid_site_admin_role", 400);
    data.role = params.role;
    metadata.role = params.role;
  }
  if (params.password !== undefined) {
    if (params.password.trim().length < 6) throw new RelationalStoreError("invalid_site_admin_password", 400);
    data.passwordHash = hashRelationalPassword(params.password.trim());
    metadata.passwordReset = true;
  }
  if (!Object.keys(metadata).length) throw new RelationalStoreError("site_admin_update_empty", 400);

  const existing = await prisma.siteAdmin.findFirst({ where: { siteId: params.siteId, id: params.adminId } });
  if (!existing) throw new RelationalStoreError("site_admin_not_found", 404);
  const admin = await prisma.siteAdmin.update({ where: { id: existing.id }, data });
  await addAuditLogRelational(prisma, {
    siteId: params.siteId,
    actorType: "site_admin",
    actorId: params.actor ?? "site_admin_demo",
    action: "site_admin_updated",
    targetType: "site_admin",
    targetId: admin.id,
    metadata
  }, { syncPlatformState: false });
  return { admin: toSiteAdmin(admin) };
}

export async function deleteSiteAdminRelational(params: {
  siteId: string;
  adminId: string;
  actor?: string;
}): Promise<{ deletedAdmin: SiteAdmin }> {
  const admin = await prisma.siteAdmin.findFirst({ where: { siteId: params.siteId, id: params.adminId } });
  if (!admin) throw new RelationalStoreError("site_admin_not_found", 404);
  if (admin.role === "owner") {
    const ownerCount = await prisma.siteAdmin.count({ where: { siteId: params.siteId, role: "owner" } });
    if (ownerCount <= 1) throw new RelationalStoreError("site_requires_owner", 409);
  }
  await prisma.siteAdmin.delete({ where: { id: admin.id } });
  await addAuditLogRelational(prisma, {
    siteId: params.siteId,
    actorType: "site_admin",
    actorId: params.actor ?? "site_admin_demo",
    action: "site_admin_deleted",
    targetType: "site_admin",
    targetId: admin.id,
    metadata: { email: admin.email, role: admin.role }
  }, { syncPlatformState: false });
  return { deletedAdmin: toSiteAdmin(admin) };
}

const defaultVideoThemeCategories = [
  {
    slug: "portrait-motion",
    label: "Portrait Motion",
    description: "Subtle cinematic movement for people, profile scenes, and expressive closeups.",
    imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "travel-story",
    label: "Travel Story",
    description: "Route, city, coast, resort, and scenic short clips from ordered frame references.",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "social-cards",
    label: "Social Cards",
    description: "Short social profile clips with clean camera motion and polished editorial timing.",
    imageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "wedding-memory",
    label: "Wedding Memory",
    description: "Romantic keepsake clips, vows, portraits, and soft celebration motion.",
    imageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "product-teaser",
    label: "Product Teaser",
    description: "Compact product reveal clips with controlled light, texture, and camera travel.",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "seasonal-mood",
    label: "Seasonal Mood",
    description: "Holiday, festival, and atmospheric clips with warm environmental motion.",
    imageUrl: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1200&q=80"
  }
] as const;

const defaultVideoThemes = [
  {
    slug: "prompt-directed-motion",
    categorySlug: "portrait-motion",
    name: "Prompt Directed Motion",
    headline: "A neutral image-to-video preset that follows the written direction.",
    description: "Uses the selected frame order and customer prompt as the creative source without adding a themed setting.",
    prompt: "Follow the selected ordered frame images and the customer's written direction exactly. Use this preset only as a neutral image-to-video container for duration, cost, and frame limits. Do not add a holiday, travel, wedding, studio, walking, seasonal, or lifestyle story unless the customer explicitly asks for it. Preserve the selected people and requested action, relationship, pose, camera transition, and story beat before any preset styling.",
    creditCost: 24,
    durationSeconds: 6,
    imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "cinematic-portrait-motion",
    categorySlug: "portrait-motion",
    name: "Cinematic Portrait Motion",
    headline: "A refined moving portrait from customer frames.",
    description: "Adds natural breathing motion, subtle hair and fabric movement, and a slow cinematic push-in.",
    prompt: "Create a realistic cinematic portrait video from the supplied ordered image frames. Preserve the people, wardrobe cues, face-safe broad likeness cues, lighting direction, and composition from the frames while adding subtle natural motion, soft parallax, gentle hair and fabric movement, and a slow polished camera push-in. Keep the result elegant, private, and editorial.",
    creditCost: 24,
    durationSeconds: 6,
    imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "travel-route-story",
    categorySlug: "travel-story",
    name: "Travel Route Story",
    headline: "A short travel scene that follows the uploaded frame order.",
    description: "Turns ordered frame images into a cohesive travel moment with natural scene motion.",
    prompt: "Create a realistic travel short video using the supplied image frames in their exact order as visual beats. Preserve all clear people and scene details represented across the frames, then blend them into one continuous travel moment with cinematic camera movement, natural wind, light, and environment motion. If different frames show different people, include every clear adult person as part of the final travel group unless the user note says otherwise.",
    creditCost: 28,
    durationSeconds: 6,
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "social-profile-clip",
    categorySlug: "social-cards",
    name: "Social Profile Clip",
    headline: "A clean short clip for profile and social cards.",
    description: "Polished motion for social headers, profile moments, and creator cards.",
    prompt: "Create a polished social profile video from the ordered image frames. Keep the subject presentation clean, confident, and realistic, with a subtle camera slide, natural expression movement, and crisp editorial lighting. Preserve the ordered frame references and avoid adding text, logos, UI, borders, or collage layouts.",
    creditCost: 22,
    durationSeconds: 5,
    imageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "wedding-memory-film",
    categorySlug: "wedding-memory",
    name: "Wedding Memory Film",
    headline: "A soft romantic keepsake clip from frame references.",
    description: "Creates a warm wedding or couple-memory moment with gentle motion.",
    prompt: "Create a soft romantic keepsake video from the supplied ordered frames. Preserve couple and guest cues represented in the frames, use warm natural light, elegant camera drift, and gentle fabric, flower, and background movement. Keep the tone tasteful, realistic, intimate, and celebratory without text or artificial overlays.",
    creditCost: 30,
    durationSeconds: 6,
    imageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "product-showcase-motion",
    categorySlug: "product-teaser",
    name: "Product Showcase Motion",
    headline: "A compact product reveal from image frames.",
    description: "Uses one or more product frames to create a realistic reveal clip.",
    prompt: "Create a realistic product showcase video using the supplied image frames as ordered visual beats. Preserve the product shape, material, color, packaging, and key details while adding controlled studio light movement, soft reflections, and a smooth reveal camera move. Do not invent text, claims, labels, logos, or extra product details not present in the references.",
    creditCost: 26,
    durationSeconds: 6,
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80"
  },
  {
    slug: "holiday-card-motion",
    categorySlug: "seasonal-mood",
    name: "Holiday Card Motion",
    headline: "A warm seasonal clip from customer frames.",
    description: "Adds festive atmosphere, gentle camera movement, and cozy light.",
    prompt: "Create a warm seasonal short video from the supplied ordered frames. Preserve the people, outfits, and key visual references while adding gentle festive atmosphere, soft light movement, subtle background motion, and a cozy cinematic camera drift. Keep it realistic, tasteful, and free of text overlays, watermarks, or UI.",
    creditCost: 24,
    durationSeconds: 6,
    imageUrl: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1200&q=80"
  }
] as const;

function clampInteger(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function videoThemeStatus(value: unknown): VideoTheme["status"] {
  return value === "active" || value === "paused" || value === "draft" ? value : "draft";
}

function videoThemeCategoryStatus(value: unknown): VideoThemeCategory["status"] {
  return value === "active" || value === "paused" || value === "draft" ? value : "active";
}

function defaultVideoWorkflowConfig(): AiWorkflowConfig {
  return {
    version: 1,
    flowName: "Image to Video",
    description: "Upload optional ordered image frames or write a text-only prompt, choose a video theme, and generate one private video clip.",
    submitLabel: "Generate video",
    promptTemplate: "Create one private video for {{flowName}} using the selected video theme and {{assetCount}} ordered frame images.",
    steps: [
      {
        id: "video_frames",
        title: "Select video frames",
        kind: "asset_select",
        assetRules: { min: 0, max: DEFAULT_VIDEO_FRAME_LIMIT, roles: ["input", "training_input"], accept: ["image/*"], required: false }
      },
      {
        id: "video_theme",
        title: "Choose video theme",
        kind: "fields",
        fields: [
          { id: "videoThemeId", label: "Video theme", type: "text", required: true },
          { id: "promptNote", label: "Optional note", type: "textarea", required: false }
        ]
      },
      { id: "review_request", title: "Review request", kind: "review" }
    ]
  };
}

function videoWorkflowConfigWithCurrentFrameLimit(value: unknown): AiWorkflowConfig {
  const fallback = defaultVideoWorkflowConfig();
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? cloneJson(value as Partial<AiWorkflowConfig>)
    : fallback;
  const sourceSteps = Array.isArray(source.steps) && source.steps.length
    ? source.steps
    : fallback.steps;
  let hasAssetSelectStep = false;
  const steps = sourceSteps.map((step): AiWorkflowStep => {
    if (step.kind !== "asset_select") return step;
    hasAssetSelectStep = true;
    return {
      ...step,
      assetRules: {
        ...(step.assetRules ?? {}),
        min: 0,
        max: DEFAULT_VIDEO_FRAME_LIMIT,
        roles: step.assetRules?.roles?.length ? step.assetRules.roles : ["input", "training_input"],
        accept: step.assetRules?.accept?.length ? step.assetRules.accept : ["image/*"],
        required: false
      }
    };
  });
  return {
    ...fallback,
    ...(source as Partial<AiWorkflowConfig>),
    steps: hasAssetSelectStep ? steps : [fallback.steps[0], ...steps]
  };
}

const ensureDefaultVideoThemesInFlight = new Map<string, Promise<void>>();

export async function ensureVideoGeneratorAppForSiteRelational(siteId: string): Promise<{ siteAiApp: SiteAiApp }> {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  const aiApp = await prisma.aiApp.upsert({
    where: { slug: "video_generator" },
    create: {
      id: "ai_video_generator",
      slug: "video_generator",
      name: "Image to Video",
      description: "Generate a private video clip from ordered customer frame images and a maintained video theme.",
      appType: "video",
      parameterSchema: []
    },
    update: {
      name: "Image to Video",
      description: "Generate a private video clip from ordered customer frame images and a maintained video theme.",
      appType: "video"
    }
  });
  const siteAiAppData = {
    enabled: true,
    creditCost: 24,
    routeKey: "local.video.grok",
    workflowConfig: defaultVideoWorkflowConfig() as unknown as Prisma.InputJsonValue,
    providerConfig: { mode: "platform_fallback", fallbackEnabled: true } as Prisma.InputJsonValue
  };
  const siteAiApp = await prisma.siteAiApp
    .upsert({
      where: { siteId_aiAppId: { siteId, aiAppId: aiApp.id } },
      create: {
        id: uid("sai"),
        siteId,
        aiAppId: aiApp.id,
        ...siteAiAppData
      },
      update: siteAiAppData,
      include: { aiApp: true }
    })
    .catch(async (error) => {
      if (prismaErrorCode(error) !== "P2002") throw error;
      const existingByApp = await prisma.siteAiApp.findUnique({
        where: { siteId_aiAppId: { siteId, aiAppId: aiApp.id } },
        include: { aiApp: true }
      });
      if (existingByApp) {
        return prisma.siteAiApp.update({
          where: { id: existingByApp.id },
          data: siteAiAppData,
          include: { aiApp: true }
        });
      }
      const existingByRoute = await prisma.siteAiApp.findUnique({
        where: { siteId_routeKey: { siteId, routeKey: "local.video.grok" } },
        include: { aiApp: true }
      });
      if (!existingByRoute) throw error;
      return prisma.siteAiApp.update({
        where: { id: existingByRoute.id },
        data: { aiAppId: aiApp.id, ...siteAiAppData },
        include: { aiApp: true }
      });
    });
  clearSiteReadCache();
  return { siteAiApp: toSiteAiApp(siteAiApp) };
}

export async function ensureDefaultVideoThemesRelational(siteId: string): Promise<void> {
  const inFlight = ensureDefaultVideoThemesInFlight.get(siteId);
  if (inFlight) return inFlight;
  const ensurePromise = ensureDefaultVideoThemesRelationalInner(siteId).finally(() => {
    if (ensureDefaultVideoThemesInFlight.get(siteId) === ensurePromise) {
      ensureDefaultVideoThemesInFlight.delete(siteId);
    }
  });
  ensureDefaultVideoThemesInFlight.set(siteId, ensurePromise);
  return ensurePromise;
}

async function ensureMydreamshootsVideoGenerationFrameworkRelational(siteId: string): Promise<void> {
  await ensureVideoGeneratorAppForSiteRelational(siteId);
  const categoryIdBySlug = new Map<string, string>();
  const parentIdBySlug = new Map<string, string>();
  for (const parent of mydreamshootsVideoGenerationParentCategoriesForSite(siteId)) {
    const row = await prisma.videoThemeCategory.upsert({
      where: { siteId_slug: { siteId, slug: parent.slug } },
      create: { id: uid("video_cat"), siteId, slug: parent.slug, label: parent.label, description: parent.description, sortOrder: parent.sortOrder, status: "active" },
      update: { label: parent.label, description: parent.description, sortOrder: parent.sortOrder, status: "active", parentId: null }
    });
    parentIdBySlug.set(parent.slug, row.id);
  }
  for (const category of mydreamshootsVideoGenerationCategoriesForSite(siteId)) {
    const parentSlug = parentVideoGenerationCategorySlugForChild(category.slug);
    const row = await prisma.videoThemeCategory.upsert({
      where: { siteId_slug: { siteId, slug: category.slug } },
      create: {
        id: uid("video_cat"),
        siteId,
        slug: category.slug,
        label: category.label,
        description: category.description,
        sortOrder: category.sortOrder,
        status: "active",
        parentId: parentSlug ? parentIdBySlug.get(parentSlug) ?? categoryIdBySlug.get(parentSlug) ?? null : null
      },
      update: {
        label: category.label,
        description: category.description,
        sortOrder: category.sortOrder,
        status: "active",
        parentId: parentSlug ? parentIdBySlug.get(parentSlug) ?? categoryIdBySlug.get(parentSlug) ?? null : null
      }
    });
    categoryIdBySlug.set(category.slug, row.id);
  }
  for (const theme of mydreamshootsVideoGenerationThemeSeedsForSite(siteId)) {
    const seededPrompt = theme.prompt;
    const existingTheme = await prisma.videoTheme.findUnique({
      where: { siteId_slug: { siteId, slug: theme.slug } },
      select: { prompt: true, imageUrl: true, galleryImages: true }
    });
    const shouldUpgradePrompt = !existingTheme
      || !validateVideoPrompt(existingTheme.prompt).valid
      || !/highest-priority output settings/i.test(existingTheme.prompt);
    const savedTheme = await prisma.videoTheme.upsert({
      where: { siteId_slug: { siteId, slug: theme.slug } },
      create: {
        id: uid("video_theme"),
        siteId,
        categoryId: categoryIdBySlug.get(theme.categorySlug) ?? null,
        slug: theme.slug,
        name: theme.name,
        headline: theme.headline,
        description: theme.description,
        prompt: seededPrompt,
        status: "active",
        creditCost: theme.creditCost,
        modelPricing: defaultVideoModelPricing(theme.creditCost) as Prisma.InputJsonValue,
        durationSeconds: theme.durationSeconds,
        maxFrames: theme.maxFrames,
        sortOrder: theme.sortOrder,
        imageUrl: theme.imageUrl || null,
        galleryImages: theme.imageUrl ? [theme.imageUrl] : []
      },
      update: {
        categoryId: categoryIdBySlug.get(theme.categorySlug) ?? null,
        name: theme.name,
        headline: theme.headline,
        description: theme.description,
        ...(shouldUpgradePrompt && validateVideoPrompt(seededPrompt).valid
          ? { prompt: seededPrompt, durationSeconds: theme.durationSeconds }
          : {}),
        imageUrl: theme.imageUrl || null,
        galleryImages: normalizeSeededVideoThemeGallery(theme.imageUrl, existingTheme?.imageUrl, existingTheme?.galleryImages)
      }
    });
    await ensureVideoThemePageRelational({
      siteId,
      slug: savedTheme.slug,
      name: savedTheme.name,
      headline: savedTheme.headline,
      description: savedTheme.description,
      imageUrl: savedTheme.imageUrl
    });
  }
  await dedupeMydreamshootsVideoThemeMedia(siteId);
  clearSiteReadCache();
}

function normalizeSeededVideoThemeGallery(
  canonicalImageUrl: string,
  previousImageUrl: string | null | undefined,
  galleryImages: Prisma.JsonValue | null | undefined
): string[] {
  const previous = typeof previousImageUrl === "string" ? previousImageUrl.trim() : "";
  const gallery = Array.isArray(galleryImages)
    ? galleryImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
  const normalized = gallery.map((item) => previous && item === previous ? canonicalImageUrl : item);
  if (!normalized.length && canonicalImageUrl) normalized.push(canonicalImageUrl);
  return [...new Set(normalized)];
}

async function dedupeMydreamshootsVideoThemeMedia(siteId: string): Promise<void> {
  const themes = await prisma.videoTheme.findMany({
    where: { siteId },
    select: { id: true, imageUrl: true, galleryImages: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  const claimed = new Set<string>();
  for (const theme of themes) {
    const primary = typeof theme.imageUrl === "string" ? theme.imageUrl.trim() : "";
    if (primary) claimed.add(primary);
  }
  for (const theme of themes) {
    const primary = typeof theme.imageUrl === "string" ? theme.imageUrl.trim() : "";
    const gallery = Array.isArray(theme.galleryImages)
      ? theme.galleryImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
      : [];
    const nextGallery = gallery.filter((item, index) => {
      if (!item || item === primary) return false;
      const firstIndex = gallery.indexOf(item);
      if (firstIndex !== index || claimed.has(item)) return false;
      claimed.add(item);
      return true;
    });
    if (JSON.stringify(gallery) !== JSON.stringify(nextGallery)) {
      await prisma.videoTheme.update({ where: { id: theme.id }, data: { galleryImages: nextGallery } });
    }
  }
}

async function ensurePromptDirectedDefaultVideoThemeRelational(siteId: string): Promise<void> {
  if (isMydreamshootsVideoFrameworkSiteId(siteId)) return;
  const theme = defaultVideoThemes.find((item) => item.slug === "prompt-directed-motion");
  if (!theme) return;
  const category = defaultVideoThemeCategories.find((item) => item.slug === theme.categorySlug) ?? defaultVideoThemeCategories[0];
  const categoryRow = await prisma.videoThemeCategory.upsert({
    where: { siteId_slug: { siteId, slug: category.slug } },
    create: {
      id: uid("video_cat"),
      siteId,
      slug: category.slug,
      label: category.label,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: 0,
      status: "active"
    },
    update: {}
  });
  const savedTheme = await prisma.videoTheme.upsert({
    where: { siteId_slug: { siteId, slug: theme.slug } },
    create: {
      id: uid("video_theme"),
      siteId,
      categoryId: categoryRow.id,
      slug: theme.slug,
      name: theme.name,
      headline: theme.headline,
      description: theme.description,
      prompt: theme.prompt,
      status: "active",
      creditCost: theme.creditCost,
      modelPricing: defaultVideoModelPricing(theme.creditCost) as Prisma.InputJsonValue,
      durationSeconds: theme.durationSeconds,
      maxFrames: DEFAULT_VIDEO_FRAME_LIMIT,
      imageUrl: theme.imageUrl,
      galleryImages: [theme.imageUrl]
    },
    update: {}
  });
  await ensureVideoThemePageRelational({
    siteId,
    slug: savedTheme.slug,
    name: savedTheme.name,
    headline: savedTheme.headline,
    description: savedTheme.description,
    imageUrl: savedTheme.imageUrl
  });
}

function defaultVideoThemePageJson(theme: {
  name: string;
  headline: string;
  description: string;
  imageUrl: string | null;
  slug: string;
}): Prisma.InputJsonValue {
  return {
    pageType: "ai_tool",
    version: 1,
    sectionsOrder: ["entry_1", "details_1", "faq_1"],
    sections: {
      entry_1: {
        type: "ai_tool_entry",
        settings: {
          aiAppSlug: "video_generator",
          eyebrow: "AI Video Theme",
          title: theme.name,
          subtitle: theme.headline || theme.description,
          description: theme.description,
          imageUrl: theme.imageUrl ?? "",
          toolSlug: theme.slug,
          ctaLabel: "Open video workspace",
          ctaHref: "/app/create#step-video"
        }
      },
      details_1: {
        type: "rich_text",
        settings: {
          eyebrow: "Theme details",
          title: theme.headline || theme.name,
          body: theme.description,
          layout: "compact"
        }
      },
      faq_1: {
        type: "faq",
        settings: {
          title: "About this video theme"
        },
        blocks: [
          {
            id: "video_theme_faq_credits",
            type: "faq_item",
            settings: {
              question: "How many credits does this theme use?",
              answer: "The current credit cost is shown in the video workspace before generation."
            }
          },
          {
            id: "video_theme_faq_inputs",
            type: "faq_item",
            settings: {
              question: "What should I upload?",
              answer: "Upload clear source frames that match the subject and motion direction you want to create."
            }
          }
        ]
      }
    },
    seo: {
      title: theme.name,
      description: theme.description,
      canonicalPath: `/ai-video-generation/${theme.slug}`,
      robots: { index: true, follow: true }
    }
  };
}

async function ensureVideoThemePageRelational(params: {
  siteId: string;
  slug: string;
  previousSlug?: string;
  name: string;
  headline: string;
  description: string;
  imageUrl: string | null;
}): Promise<void> {
  const nextPageSlug = `/ai-video-generation/${params.slug}`;
  const existingNextPage = await prisma.themePage.findUnique({
    where: { siteId_slug: { siteId: params.siteId, slug: nextPageSlug } },
    select: { id: true }
  });
  if (!existingNextPage && params.previousSlug && params.previousSlug !== params.slug) {
    await prisma.themePage.updateMany({
      where: { siteId: params.siteId, slug: `/ai-video-generation/${params.previousSlug}` },
      data: { slug: nextPageSlug, title: params.name }
    });
  }
  const existingPage = await prisma.themePage.findUnique({
    where: { siteId_slug: { siteId: params.siteId, slug: nextPageSlug } }
  });
  if (existingPage) {
    if (existingPage.pageType === "ai_tool") {
      await prisma.themePage.update({
        where: { id: existingPage.id },
        data: { title: params.name }
      });
    }
    return;
  }
  const pageJson = defaultVideoThemePageJson(params);
  await prisma.themePage.create({
    data: {
      id: uid("page_video_theme"),
      siteId: params.siteId,
      pageType: "ai_tool",
      templateKey: "tool-detail",
      slug: nextPageSlug,
      title: params.name,
      draftJson: pageJson,
      publishedJson: pageJson
    }
  });
}

async function ensureVideoThemeExampleFallbacksRelational(siteId: string): Promise<void> {
  const themes = await prisma.videoTheme.findMany({
    where: { siteId },
    select: { id: true, name: true, description: true, prompt: true, imageUrl: true, galleryImages: true, status: true }
  });
  for (const theme of themes) {
    const existing = await prisma.videoThemeExample.findFirst({
      where: { siteId, themeId: theme.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    const promptValidation = validateVideoPrompt(theme.prompt);
    const prompt = promptValidation.valid
      ? theme.prompt
      : `${defaultVideoThemeExamplePrompt}\n\nExisting theme direction: ${theme.prompt.slice(0, 1200)}`;
    if (existing) {
      const isDefaultReference = existing.sortOrder === 0 && existing.name.toLowerCase().endsWith(" reference");
      const needsCoverSync = isDefaultReference && (existing.imageUrl !== theme.imageUrl || JSON.stringify(existing.galleryImages ?? []) !== JSON.stringify(theme.imageUrl ? [theme.imageUrl] : []));
      const needsPromptUpgrade = isDefaultReference && existing.prompt !== prompt;
      if (needsCoverSync || needsPromptUpgrade) {
        await prisma.videoThemeExample.update({
          where: { id: existing.id },
          data: {
            imageUrl: theme.imageUrl,
            galleryImages: theme.imageUrl ? [theme.imageUrl] : [],
            prompt,
            status: theme.status === "active" ? "active" : "draft"
          }
        });
      }
      continue;
    }
    await prisma.videoThemeExample.create({
      data: {
        id: uid("video_example"),
        siteId,
        themeId: theme.id,
        name: `${theme.name} reference`,
        description: theme.description,
        imageUrl: theme.imageUrl,
        galleryImages: theme.galleryImages ?? undefined,
        prompt,
        status: theme.status === "active" ? "active" : "draft",
        sortOrder: 0
      }
    });
  }
}

async function ensureDefaultVideoThemesRelationalInner(siteId: string): Promise<void> {
  if (isMydreamshootsVideoFrameworkSiteId(siteId)) {
    await ensureMydreamshootsVideoGenerationFrameworkRelational(siteId);
    await ensureVideoThemeExampleFallbacksRelational(siteId);
    return;
  }
  const existingTheme = await prisma.videoTheme.findFirst({ where: { siteId }, select: { id: true } });
  if (existingTheme) {
    const existingApp = await prisma.siteAiApp.findFirst({
      where: { siteId, aiApp: { slug: "video_generator" } },
      select: { id: true, workflowConfig: true }
    });
    if (existingApp) {
      await prisma.videoTheme.updateMany({
        where: { siteId, maxFrames: { lt: DEFAULT_VIDEO_FRAME_LIMIT } },
        data: { maxFrames: DEFAULT_VIDEO_FRAME_LIMIT }
      });
      const workflowConfig = videoWorkflowConfigWithCurrentFrameLimit(existingApp.workflowConfig);
      if (JSON.stringify(workflowConfig) !== JSON.stringify(existingApp.workflowConfig)) {
        await prisma.siteAiApp.update({
          where: { id: existingApp.id },
          data: { workflowConfig: workflowConfig as unknown as Prisma.InputJsonValue }
        });
      }
      await ensurePromptDirectedDefaultVideoThemeRelational(siteId);
      await ensureVideoThemeExampleFallbacksRelational(siteId);
      clearSiteReadCache();
      return;
    }
  }
  await ensureVideoGeneratorAppForSiteRelational(siteId);
  if (existingTheme) {
    await ensurePromptDirectedDefaultVideoThemeRelational(siteId);
    await ensureVideoThemeExampleFallbacksRelational(siteId);
    clearSiteReadCache();
    return;
  }
  const categoriesBySlug = new Map<string, string>();
  for (const [index, category] of defaultVideoThemeCategories.entries()) {
    const row = await prisma.videoThemeCategory.upsert({
      where: { siteId_slug: { siteId, slug: category.slug } },
      create: {
        id: uid("video_cat"),
        siteId,
        slug: category.slug,
        label: category.label,
        description: category.description,
        imageUrl: category.imageUrl,
        sortOrder: index,
        status: "active"
      },
      update: {}
    });
    categoriesBySlug.set(category.slug, row.id);
  }
  for (const theme of defaultVideoThemes) {
    const categoryId = categoriesBySlug.get(theme.categorySlug);
    const savedTheme = await prisma.videoTheme.upsert({
      where: { siteId_slug: { siteId, slug: theme.slug } },
      create: {
        id: uid("video_theme"),
        siteId,
        categoryId,
        slug: theme.slug,
        name: theme.name,
        headline: theme.headline,
        description: theme.description,
        prompt: theme.prompt,
        status: "active",
        creditCost: theme.creditCost,
        modelPricing: defaultVideoModelPricing(theme.creditCost) as Prisma.InputJsonValue,
        durationSeconds: theme.durationSeconds,
        maxFrames: DEFAULT_VIDEO_FRAME_LIMIT,
        imageUrl: theme.imageUrl,
        galleryImages: [theme.imageUrl]
      },
      update: {}
    });
    await ensureVideoThemePageRelational({
      siteId,
      slug: savedTheme.slug,
      name: savedTheme.name,
      headline: savedTheme.headline,
      description: savedTheme.description,
      imageUrl: savedTheme.imageUrl
    });
  }
  await ensureVideoThemeExampleFallbacksRelational(siteId);
  clearSiteReadCache();
}

export async function upsertVideoThemeCategoryRelational(params: {
  siteId: string;
  categoryId?: string;
  slug?: string;
  label: string;
  description?: string;
  icon?: string;
  accentColor?: string;
  imageUrl?: string;
  sortOrder?: number;
  status?: VideoThemeCategory["status"];
  parentId?: string;
}): Promise<{ category: VideoThemeCategory; created: boolean }> {
  const site = await prisma.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  const label = params.label.trim();
  if (label.length < 2) throw new RelationalStoreError("video_theme_category_label_required", 400);
  const slug = slugify(params.slug || label);
  if (!slug) throw new RelationalStoreError("video_theme_category_slug_required", 400);
  const existing = params.categoryId
    ? await prisma.videoThemeCategory.findFirst({ where: { id: params.categoryId, siteId: params.siteId } })
    : null;
  const parent = params.parentId
    ? await prisma.videoThemeCategory.findFirst({ where: { id: params.parentId, siteId: params.siteId }, select: { id: true, parentId: true } })
    : null;
  if (params.parentId && !parent) throw new RelationalStoreError("video_theme_category_parent_not_found", 400);
  if (existing && parent && (parent.id === existing.id || parent.parentId === existing.id)) {
    throw new RelationalStoreError("video_theme_category_parent_invalid", 400);
  }
  const data = {
    slug,
    label,
    description: params.description?.trim() || null,
    icon: params.icon?.trim() || null,
    accentColor: params.accentColor?.trim() || null,
    imageUrl: params.imageUrl?.trim() || null,
    sortOrder: clampInteger(Number(params.sortOrder ?? 0), 0, -10000, 10000),
    status: videoThemeCategoryStatus(params.status),
    parentId: parent?.id ?? null
  };
  const category = existing
    ? await prisma.videoThemeCategory.update({ where: { id: existing.id }, data })
    : await prisma.videoThemeCategory.create({
        data: { id: params.categoryId ?? uid("video_cat"), siteId: params.siteId, ...data }
      });
  clearSiteReadCache();
  const hydrated = await prisma.videoThemeCategory.findUnique({ where: { id: category.id }, include: { parent: true } });
  return { category: toVideoThemeCategory(hydrated ?? category), created: !existing };
}

export async function deleteVideoThemeCategoryRelational(params: {
  siteId: string;
  categoryId: string;
}): Promise<{ deletedCategory: VideoThemeCategory }> {
  const category = await prisma.videoThemeCategory.findFirst({ where: { siteId: params.siteId, id: params.categoryId } });
  if (!category) throw new RelationalStoreError("video_theme_category_not_found", 404);
  await prisma.videoThemeCategory.delete({ where: { id: category.id } });
  clearSiteReadCache();
  return { deletedCategory: toVideoThemeCategory(category) };
}

export async function upsertVideoThemeRelational(params: {
  siteId: string;
  themeId?: string;
  categoryId?: string;
  slug?: string;
  name: string;
  headline?: string;
  description: string;
  prompt: string;
  status?: VideoTheme["status"];
  creditCost: number;
  modelPricing?: VideoModelPricing;
  durationSeconds: number;
  maxFrames: number;
  sortOrder?: number;
  imageUrl?: string;
  galleryImages?: string[];
}): Promise<{ theme: VideoTheme; created: boolean }> {
  await ensureVideoGeneratorAppForSiteRelational(params.siteId);
  const name = params.name.trim();
  if (name.length < 2) throw new RelationalStoreError("video_theme_name_required", 400);
  const slug = slugify(params.slug || name);
  if (!slug) throw new RelationalStoreError("video_theme_slug_required", 400);
  const description = params.description.trim();
  if (description.length < 8) throw new RelationalStoreError("video_theme_description_required", 400);
  // Persist the administrator's prompt verbatim (after trimming). Output settings
  // are metadata owned by the form, not a reason to rewrite prompt content.
  const prompt = params.prompt.trim();
  if (prompt.length < 12) throw new RelationalStoreError("video_theme_prompt_required", 400);
  if (prompt.length > 6000) throw new RelationalStoreError("video_theme_prompt_too_long", 400);
  const status = videoThemeStatus(params.status);
  const promptValidation = validateVideoPrompt(prompt);
  if (status === "active" && !promptValidation.valid) {
    throw new RelationalStoreError(`video_theme_prompt_invalid: ${promptValidation.errors.join(" ")}`, 400);
  }
  const creditCost = clampInteger(Number(params.creditCost), 24, 0, 10000);
  const modelPricing = normalizeVideoModelPricing(params.modelPricing, creditCost);
  const durationSeconds = clampInteger(Number(params.durationSeconds), 6, 1, 15);
  const maxFrames = normalizeVideoFrameLimit(params.maxFrames, DEFAULT_VIDEO_FRAME_LIMIT);
  const sortOrder = clampInteger(Number(params.sortOrder ?? 0), 0, -10000, 10000);
  const galleryImages = Array.isArray(params.galleryImages) ? params.galleryImages.map((item) => item.trim()).filter(Boolean).slice(0, 12) : [];
  const imageUrl = params.imageUrl?.trim() || galleryImages[0] || null;
  const category = params.categoryId
    ? await prisma.videoThemeCategory.findFirst({ where: { siteId: params.siteId, id: params.categoryId }, select: { id: true } })
    : null;
  if (params.categoryId && !category) throw new RelationalStoreError("video_theme_category_not_found", 404);
  const existing = params.themeId
    ? await prisma.videoTheme.findFirst({ where: { siteId: params.siteId, id: params.themeId } })
    : null;
  const conflictingTheme = await prisma.videoTheme.findFirst({
    where: {
      siteId: params.siteId,
      slug,
      ...(existing ? { id: { not: existing.id } } : {})
    },
    select: { id: true }
  });
  if (conflictingTheme) throw new RelationalStoreError("video_theme_slug_taken", 409);
  const conflictingRedirect = await prisma.videoThemeSlugRedirect.findFirst({
    where: {
      siteId: params.siteId,
      oldSlug: slug,
      ...(existing ? { themeId: { not: existing.id } } : {})
    },
    select: { id: true }
  });
  if (conflictingRedirect) throw new RelationalStoreError("video_theme_slug_redirect_taken", 409);
  const data = {
    slug,
    name,
    headline: params.headline?.trim() || name,
    description,
    prompt,
    status,
    creditCost,
    modelPricing: modelPricing as Prisma.InputJsonValue,
    durationSeconds,
    maxFrames,
    sortOrder,
    categoryId: category?.id ?? null,
    imageUrl,
    galleryImages
  };
  const theme = existing
    ? await prisma.videoTheme.update({
        where: { id: existing.id },
        include: { category: true },
        data
      })
    : await prisma.videoTheme.create({
        include: { category: true },
        data: {
          id: params.themeId ?? uid("video_theme"),
          siteId: params.siteId,
          generationCount: 0,
          ...data
        }
      });
  if (existing) {
    await prisma.videoThemeSlugRedirect.deleteMany({
      where: { siteId: params.siteId, themeId: existing.id, oldSlug: slug }
    });
  }
  if (existing && existing.slug !== slug) {
    await prisma.videoThemeSlugRedirect.upsert({
      where: { siteId_oldSlug: { siteId: params.siteId, oldSlug: existing.slug } },
      create: {
        id: uid("video_redirect"),
        siteId: params.siteId,
        themeId: existing.id,
        oldSlug: existing.slug
      },
      update: { themeId: existing.id }
    });
  }
  await ensureVideoThemeExampleFallbacksRelational(params.siteId);
  await ensureVideoThemePageRelational({
    siteId: params.siteId,
    previousSlug: existing?.slug,
    slug: theme.slug,
    name: theme.name,
    headline: theme.headline,
    description: theme.description,
    imageUrl: theme.imageUrl
  });
  clearSiteReadCache();
  return { theme: toVideoTheme(theme), created: !existing };
}

export async function listVideoThemeExamplesRelational(params: {
  siteId: string;
  themeId: string;
  includeInactive?: boolean;
}): Promise<VideoThemeExample[]> {
  const theme = await prisma.videoTheme.findFirst({ where: { id: params.themeId, siteId: params.siteId }, select: { id: true, status: true } });
  if (!theme) throw new RelationalStoreError("video_theme_not_found", 404);
  if (!params.includeInactive && theme.status !== "active") throw new RelationalStoreError("video_theme_not_found", 404);
  const rows = await prisma.videoThemeExample.findMany({
    where: {
      siteId: params.siteId,
      themeId: params.themeId,
      ...(params.includeInactive ? {} : { status: "active" })
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  return rows.map(toVideoThemeExample);
}

export async function upsertVideoThemeExampleRelational(params: {
  siteId: string;
  themeId: string;
  exampleId?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  galleryImages?: string[];
  prompt: string;
  status?: VideoThemeExample["status"];
  sortOrder?: number;
}): Promise<{ example: VideoThemeExample; created: boolean }> {
  const theme = await prisma.videoTheme.findFirst({ where: { id: params.themeId, siteId: params.siteId }, select: { id: true } });
  if (!theme) throw new RelationalStoreError("video_theme_not_found", 404);
  const name = params.name.trim();
  if (name.length < 2) throw new RelationalStoreError("video_theme_example_name_required", 400);
  const prompt = params.prompt.trim();
  const validation = validateVideoPrompt(prompt);
  const status = videoThemeStatus(params.status);
  if (status === "active" && !validation.valid) {
    throw new RelationalStoreError(`video_theme_example_prompt_invalid: ${validation.errors.join(" ")}`, 400);
  }
  const galleryImages = Array.isArray(params.galleryImages)
    ? params.galleryImages.map((item) => item.trim()).filter(Boolean).slice(0, 12)
    : [];
  const existing = params.exampleId
    ? await prisma.videoThemeExample.findFirst({ where: { id: params.exampleId, siteId: params.siteId, themeId: params.themeId } })
    : null;
  if (params.exampleId && !existing) throw new RelationalStoreError("video_theme_example_not_found", 404);
  const data = {
    name,
    description: params.description?.trim() || null,
    imageUrl: params.imageUrl?.trim() || galleryImages[0] || null,
    galleryImages: galleryImages as unknown as Prisma.InputJsonValue,
    prompt,
    status,
    sortOrder: clampInteger(Number(params.sortOrder ?? 0), 0, -10000, 10000)
  };
  const row = existing
    ? await prisma.videoThemeExample.update({ where: { id: existing.id }, data })
    : await prisma.videoThemeExample.create({
        data: { id: params.exampleId ?? uid("video_example"), siteId: params.siteId, themeId: params.themeId, ...data }
      });
  clearSiteReadCache();
  return { example: toVideoThemeExample(row), created: !existing };
}

export async function deleteVideoThemeExampleRelational(params: {
  siteId: string;
  themeId: string;
  exampleId: string;
}): Promise<{ deletedExample: VideoThemeExample }> {
  const row = await prisma.videoThemeExample.findFirst({ where: { id: params.exampleId, siteId: params.siteId, themeId: params.themeId } });
  if (!row) throw new RelationalStoreError("video_theme_example_not_found", 404);
  await prisma.videoThemeExample.delete({ where: { id: row.id } });
  clearSiteReadCache();
  return { deletedExample: toVideoThemeExample(row) };
}

export async function getVideoThemeSlugRedirectRelational(siteId: string, oldSlug: string) {
  const normalizedSlug = oldSlug.trim().toLowerCase();
  if (!normalizedSlug) return undefined;
  return prisma.videoThemeSlugRedirect.findUnique({
    where: { siteId_oldSlug: { siteId, oldSlug: normalizedSlug } },
    include: { theme: true }
  });
}

export async function deleteVideoThemeRelational(params: {
  siteId: string;
  themeId: string;
}): Promise<{ deletedTheme: VideoTheme }> {
  const theme = await prisma.videoTheme.findFirst({ where: { siteId: params.siteId, id: params.themeId }, include: { category: true } });
  if (!theme) throw new RelationalStoreError("video_theme_not_found", 404);
  await prisma.videoTheme.delete({ where: { id: theme.id } });
  clearSiteReadCache();
  return { deletedTheme: toVideoTheme(theme) };
}

export async function upsertCreativePackRelational(params: {
  siteId: string;
  packId?: string;
  name: string;
  headline: string;
  description: string;
  prompt?: string;
  category: string;
  categoryId?: string;
  aiAppSlug: string;
  status: CreativePack["status"];
  creditCost: number;
  outputCount: number;
  trainingRequired: boolean;
  imageUrl?: string;
  galleryImages?: string[];
  galleryImageAlts?: string[];
}): Promise<{ pack: CreativePack; created: boolean }> {
  const site = await prisma.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  const name = params.name.trim();
  if (name.length < 2) throw new RelationalStoreError("creative_pack_name_required", 400);
  const headline = params.headline.trim() || name;
  const description = params.description.trim();
  const prompt = params.prompt?.trim() || suggestedCreativePackPrompt({
    name,
    headline,
    description,
    category: params.category,
    outputCount: params.outputCount,
    trainingRequired: params.trainingRequired
  });
  const galleryMedia = storefrontGalleryMediaPairs(params.galleryImages, params.galleryImageAlts, 24);
  const galleryImages = galleryMedia.galleryImages;
  const galleryImageAlts = galleryMedia.galleryImageAlts;
  const imageUrl = params.imageUrl?.trim() || galleryImages[0] || null;
  if (description.length < 8) throw new RelationalStoreError("creative_pack_description_required", 400);
  if (prompt && prompt.length > 6000) throw new RelationalStoreError("creative_pack_prompt_too_long", 400);
  const aiApp = await prisma.aiApp.findUnique({ where: { slug: params.aiAppSlug }, select: { id: true } });
  if (!aiApp) throw new RelationalStoreError("ai_app_not_found", 404);
  if (!Number.isInteger(params.creditCost) || params.creditCost < 1) throw new RelationalStoreError("invalid_credit_cost", 400);
  if (!Number.isInteger(params.outputCount) || params.outputCount < 1) throw new RelationalStoreError("invalid_output_count", 400);
  const categoryRecord = params.categoryId
    ? await prisma.creativePackCategory.findFirst({ where: { id: params.categoryId, siteId: params.siteId }, select: { id: true, slug: true } })
    : null;
  if (params.categoryId && !categoryRecord) throw new RelationalStoreError("creative_pack_category_not_found", 404);
  const category = categoryRecord?.slug ?? (params.category.trim() || "headshots");

  const existing = params.packId
    ? await prisma.creativePack.findFirst({ where: { siteId: params.siteId, id: params.packId } })
    : null;
  const pack = existing
    ? await prisma.creativePack.update({
        where: { id: existing.id },
        include: { categoryRecord: { include: { parent: true } } },
        data: {
          name,
          headline,
          description,
          prompt,
          category,
          categoryId: categoryRecord?.id ?? null,
          aiAppSlug: params.aiAppSlug,
          status: params.status,
          creditCost: params.creditCost,
          outputCount: params.outputCount,
          trainingRequired: params.trainingRequired,
          imageUrl,
          galleryImages,
          galleryImageAlts
        }
      })
    : await prisma.creativePack.create({
        include: { categoryRecord: { include: { parent: true } } },
        data: {
          id: params.packId ?? uid("pack"),
          siteId: params.siteId,
          name,
          headline,
          description,
          prompt,
          category,
          categoryId: categoryRecord?.id ?? null,
          aiAppSlug: params.aiAppSlug,
          status: params.status,
          creditCost: params.creditCost,
          outputCount: params.outputCount,
          trainingRequired: params.trainingRequired,
          imageUrl,
          galleryImages,
          galleryImageAlts,
          generationCount: 0,
          conversionRate: 0
        }
      });

  clearSiteReadCache();
  return { pack: toCreativePack(pack), created: !existing };
}

export async function deleteCreativePackRelational(params: {
  siteId: string;
  packId: string;
}): Promise<{ deletedPack: CreativePack }> {
  const pack = await prisma.creativePack.findFirst({ where: { siteId: params.siteId, id: params.packId } });
  if (!pack) throw new RelationalStoreError("creative_pack_not_found", 404);
  await prisma.$transaction(async (tx) => {
    await tx.album.updateMany({ where: { siteId: params.siteId, creativePackId: pack.id }, data: { creativePackId: null } });
    await tx.creativePack.delete({ where: { id: pack.id } });
  });
  clearSiteReadCache();
  return { deletedPack: toCreativePack(pack) };
}

export async function updateGatewayGroupRelational(params: {
  siteId: string;
  groupId: string;
  status: AiGatewayGroup["status"];
  modelAllowlist: string[];
  monthlyQuota: number;
  retryStatusCodes: number[];
  rateLimitPerMinute: number;
  accountPoolMode: AiGatewayGroup["accountPoolMode"];
  unavailableReason?: string;
}): Promise<{ gatewayGroup: AiGatewayGroup }> {
  if (!Number.isInteger(params.monthlyQuota) || params.monthlyQuota < 0) throw new RelationalStoreError("invalid_monthly_quota", 400);
  if (!Number.isInteger(params.rateLimitPerMinute) || params.rateLimitPerMinute < 1) throw new RelationalStoreError("invalid_rate_limit", 400);
  const existing = await prisma.aiGatewayGroup.findFirst({ where: { id: params.groupId, siteId: params.siteId } });
  if (!existing) throw new RelationalStoreError("gateway_group_not_found", 404);
  const gatewayGroup = await prisma.aiGatewayGroup.update({
    where: { id: params.groupId },
    data: {
      status: params.status,
      modelAllowlist: params.modelAllowlist.map((model) => model.trim()).filter(Boolean),
      monthlyQuota: params.monthlyQuota,
      retryStatusCodes: params.retryStatusCodes.filter((code) => Number.isInteger(code)),
      rateLimitPerMinute: params.rateLimitPerMinute,
      accountPoolMode: params.accountPoolMode,
      unavailableReason: params.unavailableReason?.trim() || null
    }
  });
  return { gatewayGroup: toGatewayGroup(gatewayGroup) };
}

export async function updateSiteAiAppRelational(params: {
  siteId: string;
  siteAiAppId: string;
  enabled: boolean;
  creditCost: number;
  routeKey: string;
  workflowConfig?: AiWorkflowConfig;
  providerConfig?: AiProviderConfig;
}): Promise<{ siteAiApp: SiteAiApp }> {
  if (!Number.isInteger(params.creditCost) || params.creditCost < 0) throw new RelationalStoreError("invalid_credit_cost", 400);
  const routeKey = params.routeKey.trim();
  if (!routeKey) throw new RelationalStoreError("invalid_route_key", 400);
  const workflowConfig = validateAiWorkflowConfig(params.workflowConfig);
  const existing = await prisma.siteAiApp.findFirst({ where: { id: params.siteAiAppId, siteId: params.siteId }, include: { aiApp: true } });
  if (!existing) throw new RelationalStoreError("site_ai_app_not_found", 404);
  const providerConfig = await validateAiProviderConfig(params.providerConfig, existing.aiApp.appType);
  const siteAiApp = await prisma.siteAiApp.update({
    where: { id: params.siteAiAppId },
    data: {
      enabled: params.enabled,
      creditCost: params.creditCost,
      routeKey,
      workflowConfig: workflowConfig === undefined ? undefined : (workflowConfig as unknown as Prisma.InputJsonValue),
      providerConfig: providerConfig === undefined ? undefined : (providerConfig as unknown as Prisma.InputJsonValue)
    },
    include: { aiApp: true }
  });
  return { siteAiApp: toSiteAiApp(siteAiApp) };
}

function validateAiWorkflowConfig(value: AiWorkflowConfig | undefined): AiWorkflowConfig | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || !Array.isArray(value.steps)) throw new RelationalStoreError("invalid_workflow_config", 400);
  if (JSON.stringify(value).length > 24_000) throw new RelationalStoreError("workflow_config_too_large", 400);
  const seen = new Set<string>();
  const steps = value.steps.slice(0, 8).map((step) => {
    const id = String(step.id ?? "").trim();
    if (!id || seen.has(id)) throw new RelationalStoreError("invalid_workflow_step_id", 400);
    seen.add(id);
    if (step.kind !== "asset_select" && step.kind !== "fields" && step.kind !== "review") throw new RelationalStoreError("invalid_workflow_step_kind", 400);
    return {
      ...step,
      id,
      title: String(step.title ?? id).trim().slice(0, 80),
      description: step.description ? String(step.description).trim().slice(0, 240) : undefined
    };
  });
  return {
    ...value,
    version: Number.isInteger(value.version) ? value.version : 1,
    flowName: value.flowName ? String(value.flowName).trim().slice(0, 80) : undefined,
    description: value.description ? String(value.description).trim().slice(0, 240) : undefined,
    promptTemplate: value.promptTemplate ? String(value.promptTemplate).trim().slice(0, 4000) : undefined,
    negativePrompt: value.negativePrompt ? String(value.negativePrompt).trim().slice(0, 1200) : undefined,
    materialRules: Array.isArray(value.materialRules) ? value.materialRules.slice(0, 6).map((rule) => String(rule).trim().slice(0, 180)).filter(Boolean) : undefined,
    submitLabel: value.submitLabel ? String(value.submitLabel).trim().slice(0, 48) : undefined,
    steps
  };
}

async function validateAiProviderConfig(value: AiProviderConfig | undefined, appType: string): Promise<AiProviderConfig | undefined> {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") throw new RelationalStoreError("invalid_provider_config", 400);
  const mode = value.mode === "fixed_provider" || value.mode === "preferred_provider" ? value.mode : "platform_fallback";
  const providerId = value.providerId ? String(value.providerId).trim().slice(0, 80) : undefined;
  if (mode !== "platform_fallback" && providerId) {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: providerId },
      select: { providerType: true }
    });
    if (!provider) throw new RelationalStoreError("ai_provider_not_found", 404);
    if (normalizePlatformAiProviderType(provider.providerType) !== platformProviderTypeForAppType(appType)) {
      throw new RelationalStoreError("ai_provider_type_mismatch", 400);
    }
  }
  return {
    mode,
    providerId,
    modelType: value.modelType ? String(value.modelType).trim().slice(0, 120) : undefined,
    fallbackEnabled: value.fallbackEnabled !== false
  };
}
