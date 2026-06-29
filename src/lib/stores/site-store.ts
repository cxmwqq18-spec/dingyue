import "server-only";

import type { Prisma } from "@prisma/client";
import { cache } from "react";

import { canonicalSiteSlug, cleanHost, isPlatformHost, legacySiteSlugCandidates } from "@/lib/domain-routing";
import { suggestedCreativePackPrompt } from "@/lib/creative-pack-suggestions";
import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import { shouldFallbackRelationalRead, warnRelationalFallback } from "@/lib/stores/relational-fallback";
import type {
  AiGatewayGroup,
  AiProviderConfig,
  AiWorkflowConfig,
  AuditLogEntry,
  CreativePack,
  GenerationJob,
  MediaAsset,
  PlatformState,
  Product,
  PublicPlatformAdmin,
  Site,
  SiteAdmin,
  SiteAiApp,
  SiteDomain,
  ThemePageJson,
  ThemePage,
  ThemePublication
} from "@/lib/types";
import type { PublishPreflightMediaAsset, PublishPreflightProduct, PublishPreflightSiteAiApp } from "@/lib/theme/publish-preflight";

import {
  addAuditLogRelational,
  cloneJson,
  hashRelationalPassword,
  relationalSessionTtlMs,
  relationalUid,
  PrismaLike,
  RelationalStoreError,
  slugify,
  toGatewayGroup,
  mapCreditLedger,
  mapCustomer,
  toCreativePack,
  toMediaAsset,
  toThemePublication,
  toThemePage,
  toThemeSettings,
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
  toSiteAiApp,
  toSiteDomain,
  toToolCategory,
  toToolMenuItem,
  uid,
  verifyRelationalPassword,
} from "./prisma-mappers";

const siteRuntimeInclude = {
  domains: true,
  pages: { orderBy: { slug: "asc" } },
  settings: true,
  connect: true
} satisfies Prisma.SiteInclude;

function isMissingToolMenuTableError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return code === "P2021" || /ToolCategory|ToolMenuItem/.test(message) && /does not exist|findMany/i.test(message);
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
          ...(options.take ? { take: options.take } : {})
        });
      } catch (error) {
        if (isMissingToolMenuTableError(error)) return [];
        throw error;
      }
    },
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 120_000)
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
          ...(options.take ? { take: options.take } : {})
        });
      } catch (error) {
        if (isMissingToolMenuTableError(error)) return [];
        throw error;
      }
    },
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 120_000)
  );
}
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
  pages: {
    where: { slug: { in: ["/collections", "/404"] } },
    orderBy: { slug: "asc" },
    select: {
      id: true,
      siteId: true,
      pageType: true,
      templateKey: true,
      slug: true,
      title: true,
      draftJson: true,
      publishedJson: true
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
      publishedJson: true
    }
  },
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
  pages: {
    orderBy: { slug: "asc" },
    select: {
      id: true,
      siteId: true,
      pageType: true,
      templateKey: true,
      slug: true,
      title: true,
      publishedJson: true
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
      publishedJson: true
    }
  }
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
  pages: {
    where: { slug: { in: ["/account", "/app", "/404"] } },
    orderBy: { slug: "asc" },
    select: {
      id: true,
      siteId: true,
      pageType: true,
      templateKey: true,
      slug: true,
      title: true,
      draftJson: true,
      publishedJson: true,
      draftMeta: true
    }
  },
  settings: {
    select: {
      draftJson: true,
      publishedJson: true
    }
  },
  connect: {
    select: {
      stripeAccountId: true,
      onboardingStatus: true,
      chargesEnabled: true,
      payoutsEnabled: true
    }
  }
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
      publishedJson: true
    }
  }
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
  pages: {
    select: {
      id: true,
      siteId: true,
      pageType: true,
      templateKey: true,
      slug: true,
      title: true,
      publishedJson: true
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
      publishedJson: true
    }
  }
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
  createdAt: true,
  categoryRecord: collectionDetailCreativePackSelect.categoryRecord
} satisfies Prisma.CreativePackSelect;
const publicRuntimeSiteAiAppSelect = {
  id: true,
  siteId: true,
  enabled: true,
  creditCost: true,
  routeKey: true,
  workflowConfig: true,
  providerConfig: true,
  aiApp: {
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      appType: true,
      parameterSchema: true
    }
  }
} satisfies Prisma.SiteAiAppSelect;
type PublicRuntimeSiteAiAppRecord = Prisma.SiteAiAppGetPayload<{ select: typeof publicRuntimeSiteAiAppSelect }>;
const emptyThemePageJson = {
  pageType: "content",
  version: 1,
  sectionsOrder: [],
  sections: {}
} satisfies ThemePage["draftJson"];
const siteReadCache = createServerTtlCache("site-store", Number(process.env.SITE_READ_CACHE_TTL_MS ?? 120_000));
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
const accountCustomerRuntimeLimits = {
  products: 0,
  siteAiApps: 0,
  creativePacks: 0,
  mediaAssets: 0,
  subscriptions: 2,
  orders: 4,
  jobs: 4,
  assetUploads: 0,
  ledger: 4,
  customerModels: 0,
  albums: 3
} as const;
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

function toAdminShellThemeSettings(record?: { draftJson: unknown; publishedJson: unknown } | null): Site["themeSettings"] {
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
  return {
    draftJson: toShellSettings(record?.draftJson),
    publishedJson: toShellSettings(record?.publishedJson)
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
    creativePacks: [],
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
    themeSettings: toAdminShellThemeSettings(settingsRecord),
    pages: record.pages.map((page) => toThemePage({
      ...page,
      draftJson: page.publishedJson
    })),
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

  const activeDomain = await prisma.siteDomain.findFirst({
    where: { domain: value, status: "active" },
    include: { site: { include: siteRuntimeInclude } }
  });
  if (activeDomain?.site) return toSite(activeDomain.site);

  const anyDomain = await prisma.siteDomain.findUnique({
    where: { domain: value },
    include: { site: { include: siteRuntimeInclude } }
  });
  if (anyDomain?.site) return toSite(anyDomain.site);

  const primaryDomainSite = await prisma.site.findFirst({
    where: { primaryDomain: value },
    include: siteRuntimeInclude
  });
  return primaryDomainSite ? toSite(primaryDomainSite) : undefined;
}

export const getStorefrontSiteByHostRelational = cache(async (host: string | null | undefined): Promise<Site | undefined> => {
  const key = cleanHost(host) || "empty";
  return siteReadCache.get(`host:${key}`, () => getSiteByHostRelational(host));
});

function publicRuntimePageSlugs(slug?: string): string[] | undefined {
  if (!slug) return undefined;
  const normalized = slug === "/" ? "/" : slug.startsWith("/") ? slug : `/${slug}`;
  return Array.from(new Set([normalized, "/404"]));
}

function publicRuntimeNeeds(pageSlugs?: string[], contextSlug?: string) {
  const slugs = pageSlugs ?? [];
  const primary = slugs.find((slug) => slug !== "/404") ?? "/";
  const isHome = primary === "/";
  const isPricing = primary === "/pricing";
  const isTools = primary === "/tools" || primary.startsWith("/tools/");
  const isToolDetail = primary.startsWith("/tools/") && Boolean(contextSlug);
  const isCollections = primary === "/collections" || primary.startsWith("/collections/");
  const isCollectionDetail = isCollections && Boolean(contextSlug);
  const isWorkspace = primary === "/app";
  return {
    profile: isHome ? "home" : isPricing ? "pricing" : isTools ? "tools" : isCollectionDetail ? "collection-detail" : isCollections ? "collections" : isWorkspace ? "workspace" : "page",
    products: isHome || isPricing,
    siteAiApps: isHome || (isTools && !isToolDetail) || isWorkspace,
    creativePacks: isHome || (isTools && !isToolDetail) || isCollections || isWorkspace,
    mediaAssets: isHome || isWorkspace,
    toolMenus: isHome || isPricing || isTools || isCollections || isWorkspace,
    contextSlug: contextSlug ? slugify(contextSlug) : ""
  };
}

function publicRuntimeLimits(profile: ReturnType<typeof publicRuntimeNeeds>["profile"]) {
  return {
    products: profile === "pricing" ? 12 : 8,
    siteAiApps: profile === "tools" ? 8 : profile === "home" ? 6 : 12,
    creativePacks: profile === "collection-detail" ? 4 : profile === "collections" ? 48 : profile === "tools" ? 18 : profile === "home" ? 48 : 12,
    mediaAssets: profile === "home" ? 24 : profile === "workspace" ? 40 : 0
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
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 120_000)
  );
});

export const getStorefrontPublicCreativePacksForSite = cache(async (siteId: string, take = 48) => {
  const rows = await prisma.creativePack.findMany({
    where: { siteId, status: "active" },
    select: publicRuntimeCreativePackSelect,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take
  });
  return rows.map(toCreativePack);
});

export const getStorefrontPublicCollectionDetailStateBySlug = cache(async (slug: string, collectionSlug: string): Promise<PlatformState | undefined> => {
  const canonicalSlug = canonicalSiteSlug(slug);
  const normalizedCollectionSlug = slugify(collectionSlug);
  return siteReadCache.get(
    `public-collection-shell:${canonicalSlug}:${normalizedCollectionSlug}`,
    async () => {
      return loadStorefrontPublicCollectionDetailState(slug, normalizedCollectionSlug);
    },
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 120_000)
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
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 120_000)
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
      return site ?? undefined;
    },
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 120_000)
  );
});

async function loadStorefrontPublicCollectionDetailState(slug: string, collectionSlug: string): Promise<PlatformState | undefined> {
  const startedAt = Date.now();
  const site = await getStorefrontPublicCollectionSiteShellBySlug(slug);
  if (!site) return undefined;
  storefrontPerfMark("collection-shell:site-shell", startedAt, { collectionSlug });

  const [selectedPacks, menuPacks] = await Promise.all([
    prisma.creativePack.findMany({
      where: {
        siteId: site.id,
        status: "active",
        OR: [
          { categoryRecord: { is: { slug: collectionSlug } } },
          { categoryRecord: { is: { parent: { is: { slug: collectionSlug } } } } },
          { name: { equals: collectionSlug, mode: "insensitive" } },
          { name: { contains: collectionSlug.replace(/-/g, " "), mode: "insensitive" } }
        ]
      },
      select: collectionDetailCreativePackSelect,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: publicRuntimeLimits("collection-detail").creativePacks
    }),
    prisma.creativePack.findMany({
      where: { siteId: site.id, status: "active" },
      select: collectionDetailCreativePackSelect,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: publicRuntimeLimits("collections").creativePacks
    })
  ]);
  const creativePacks = Array.from(new Map([...selectedPacks, ...menuPacks].map((pack) => [pack.id, pack])).values());
  storefrontPerfMark("collection-shell:packs", startedAt, {
    selectedPacks: selectedPacks.length,
    menuPacks: menuPacks.length,
    creativePacks: creativePacks.length
  });

  const mediaAssets: MediaAsset[] = [];
  const mappedSite = toPublicSiteShell(site, mediaAssets);
  const state = emptyPlatformState({
    sites: [mappedSite],
    siteDomains: site.domains.map(toSiteDomain),
    creativePacks: creativePacks.map(toCreativePack),
    mediaAssets
  });
  storefrontPerfMark("collection-shell:done", startedAt);
  return state;
}

type PublicRuntimeSiteLookup =
  | { id: string }
  | { slugCandidates: string[] };

async function getPublicRuntimeSiteLookupByHost(host: string | null | undefined): Promise<PublicRuntimeSiteLookup | undefined> {
  const value = cleanHost(host);
  if (!value || isPlatformHost(value) || value === "localhost" || value === "127.0.0.1") return undefined;

  const domain = await prisma.siteDomain.findFirst({
    where: { domain: value },
    orderBy: [{ status: "asc" }, { isPrimary: "desc" }],
    select: { siteId: true }
  });
  if (domain?.siteId) return { id: domain.siteId };

  const site = await prisma.site.findFirst({
    where: { primaryDomain: value },
    select: { id: true }
  });
  return site ? { id: site.id } : undefined;
}

async function loadStorefrontPublicRuntimeState(lookup: PublicRuntimeSiteLookup, pageSlugs?: string[], contextSlug?: string): Promise<PlatformState | undefined> {
  const startedAt = Date.now();
  const needs = publicRuntimeNeeds(pageSlugs, contextSlug);
  const select = {
      ...publicRuntimeSiteSelect,
      pages: pageSlugs
        ? { ...publicRuntimeSiteSelect.pages, where: { slug: { in: pageSlugs } } }
        : publicRuntimeSiteSelect.pages
    } satisfies Prisma.SiteSelect;
  const site = "id" in lookup
    ? await prisma.site.findUnique({ where: { id: lookup.id }, select })
    : await prisma.site.findFirst({
        where: { slug: { in: lookup.slugCandidates } },
        orderBy: { updatedAt: "desc" },
        select
      });
  if (!site) return undefined;
  storefrontPerfMark("site", startedAt, { pageSlugs, profile: needs.profile });
  const siteId = site.id;
  const limits = publicRuntimeLimits(needs.profile);

  const [products, siteAiApps, creativePacks, mediaAssets, toolCategories, toolMenuItems] = await Promise.all([
    needs.products
      ? prisma.product.findMany({
          where: { siteId, status: "active" },
          include: { prices: true },
          orderBy: [{ type: "asc" }, { createdAt: "asc" }],
          take: limits.products
        })
      : Promise.resolve([]),
    needs.siteAiApps
      ? prisma.siteAiApp.findMany({
          where: { siteId, enabled: true },
          select: publicRuntimeSiteAiAppSelect,
          orderBy: [{ routeKey: "asc" }],
          take: limits.siteAiApps
        })
      : Promise.resolve([]),
    needs.creativePacks
      ? prisma.creativePack.findMany({
          where: needs.contextSlug
            ? {
                siteId,
                status: "active",
                OR: [
                  { categoryRecord: { is: { slug: needs.contextSlug } } },
                  { name: { equals: needs.contextSlug, mode: "insensitive" } },
                  { name: { contains: needs.contextSlug.replace(/-/g, " "), mode: "insensitive" } }
                ]
              }
            : { siteId, status: { in: ["active", "draft"] } },
          select: publicRuntimeCreativePackSelect,
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
          take: limits.creativePacks
        })
      : Promise.resolve([]),
    needs.mediaAssets
      ? prisma.mediaAsset.findMany({
          where: { siteId, usageType: { in: ["theme", "package", "sample"] } },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: limits.mediaAssets
        })
      : Promise.resolve([]),
    needs.toolMenus
      ? loadToolCategoriesForSite(siteId, { activeOnly: true, take: 80 })
      : Promise.resolve([]),
    needs.toolMenus
      ? loadToolMenuItemsForSite(siteId, { activeOnly: true, take: 80 })
      : Promise.resolve([])
  ]);
  storefrontPerfMark("collections", startedAt, {
    products: products.length,
    siteAiApps: siteAiApps.length,
    creativePacks: creativePacks.length,
    mediaAssets: mediaAssets.length,
    toolMenuItems: toolMenuItems.length
  });

  const mappedMediaAssets = mediaAssets.map(toMediaAsset);
  const mappedSite = toPublicSiteShell(site, mappedMediaAssets);

  const state = emptyPlatformState({
    sites: [mappedSite],
    siteDomains: site.domains.map(toSiteDomain),
    products: products.map(mapProduct),
    siteAiApps: siteAiApps.map(toPublicRuntimeSiteAiApp),
    toolCategories: toolCategories.map(toToolCategory),
    toolMenuItems: toolMenuItems.map(toToolMenuItem),
    creativePacks: creativePacks.map(toCreativePack),
    mediaAssets: mappedMediaAssets
  });
  storefrontPerfMark("done", startedAt);
  return state;
}

export const getStorefrontRuntimeStateForSite = cache(async (siteId: string): Promise<PlatformState | undefined> => {
  return siteReadCache.get(`runtime:${siteId}`, () => loadStorefrontRuntimeStateForSite(siteId), Number(process.env.STOREFRONT_PRIVATE_CACHE_TTL_MS ?? 30_000));
});

type StorefrontCustomerRuntimeParams = {
  siteId: string;
  sessionId?: string;
  customerId?: string;
  profile?: "full" | "workspace" | "account";
};

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

export const getStorefrontCustomerRuntimeStateForSite = cache(async (params: StorefrontCustomerRuntimeParams): Promise<PlatformState | undefined> => {
  const identity = params.sessionId ? `session:${params.sessionId}` : params.customerId ? `customer:${params.customerId}` : "anonymous";
  const profile = params.profile ?? "full";
  return siteReadCache.get(
    `customer-runtime:${params.siteId}:${identity}:${profile}`,
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
  ] = await Promise.all([
    limits.products
      ? prisma.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: limits.products })
      : Promise.resolve([]),
    limits.siteAiApps
      ? prisma.siteAiApp.findMany({ where: { siteId }, include: { aiApp: true }, orderBy: [{ enabled: "desc" }, { routeKey: "asc" }], take: limits.siteAiApps })
      : Promise.resolve([]),
    limits.creativePacks
      ? prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: { include: { parent: true } } }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: limits.creativePacks })
      : Promise.resolve([]),
    limits.mediaAssets
      ? prisma.mediaAsset.findMany({ where: { siteId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: limits.mediaAssets })
      : Promise.resolve([]),
    prisma.customer.findFirst({ where: { id: customerId, siteId }, include: { balance: true } }),
    prisma.subscription.findMany({ where: { siteId, customerId }, orderBy: { createdAt: "desc" }, take: limits.subscriptions }),
    prisma.order.findMany({ where: { siteId, customerId }, orderBy: { createdAt: "desc" }, take: limits.orders }),
    prisma.generationJob.findMany({ where: { siteId, customerId }, orderBy: { updatedAt: "desc" }, take: limits.jobs }),
    prisma.assetUpload.findMany({ where: { siteId, customerId }, orderBy: { createdAt: "desc" }, take: limits.assetUploads }),
    prisma.creditLedger.findMany({ where: { siteId, customerId }, orderBy: { createdAt: "desc" }, take: limits.ledger }),
    prisma.customerModel.findMany({ where: { siteId, customerId }, orderBy: { updatedAt: "desc" }, take: limits.customerModels }),
    prisma.album.findMany({ where: { siteId, customerId }, orderBy: { updatedAt: "desc" }, take: limits.albums })
  ]);

  if (!customer) return undefined;

  const mappedMediaAssets = mediaAssets.map(toMediaAsset);
  const mappedSite = params.profile === "account" || params.profile === "workspace"
    ? toPublicSiteShell(site as CustomerRuntimeSiteRecord, mappedMediaAssets)
    : {
        ...toSite(site),
        mediaAssets: mappedMediaAssets
      };

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
    jobs: jobs.map(mapGenerationJob),
    assetUploads: assetUploads.map(toAssetUploadRelational),
    ledger: ledger.map(mapCreditLedger),
    customerModels: customerModels.map(toCustomerModelRelational),
    albums: albums.map(toAlbumRelational)
  });
}

async function loadStorefrontRuntimeStateForSite(siteId: string): Promise<PlatformState | undefined> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: siteRuntimeInclude
  });
  if (!site) return undefined;

  const [
    siteDomains,
    products,
    siteAiApps,
    toolCategories,
    toolMenuItems,
    creativePacks,
    mediaAssets,
    customers,
    customerSessions,
    subscriptions,
    orders,
    jobs,
    assetUploads,
    ledger,
    customerModels,
    albums
  ] = await Promise.all([
    prisma.siteDomain.findMany({ where: { siteId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
    prisma.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
    prisma.siteAiApp.findMany({ where: { siteId }, include: { aiApp: true }, orderBy: [{ enabled: "desc" }, { routeKey: "asc" }] }),
    loadToolCategoriesForSite(siteId),
    loadToolMenuItemsForSite(siteId),
    prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: { include: { parent: true } } }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
    prisma.mediaAsset.findMany({ where: { siteId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
    prisma.customer.findMany({ where: { siteId }, include: { balance: true }, orderBy: [{ createdAt: "asc" }], take: fullSiteRuntimeLimits.customers }),
    prisma.customerSession.findMany({ where: { siteId }, orderBy: { createdAt: "desc" }, take: fullSiteRuntimeLimits.customerSessions }),
    prisma.subscription.findMany({ where: { siteId }, orderBy: { createdAt: "desc" }, take: fullSiteRuntimeLimits.subscriptions }),
    prisma.order.findMany({ where: { siteId }, orderBy: { createdAt: "desc" }, take: fullSiteRuntimeLimits.orders }),
    prisma.generationJob.findMany({ where: { siteId }, orderBy: { updatedAt: "desc" }, take: fullSiteRuntimeLimits.jobs }),
    prisma.assetUpload.findMany({ where: { siteId }, orderBy: { createdAt: "desc" }, take: fullSiteRuntimeLimits.assetUploads }),
    prisma.creditLedger.findMany({ where: { siteId }, orderBy: { createdAt: "desc" }, take: fullSiteRuntimeLimits.ledger }),
    prisma.customerModel.findMany({ where: { siteId }, orderBy: { updatedAt: "desc" }, take: fullSiteRuntimeLimits.customerModels }),
    prisma.album.findMany({ where: { siteId }, orderBy: { updatedAt: "desc" }, take: fullSiteRuntimeLimits.albums })
  ]);

  const mappedMediaAssets = mediaAssets.map(toMediaAsset);
  const mappedSite = {
    ...toSite(site),
    mediaAssets: mappedMediaAssets
  };

  return emptyPlatformState({
    sites: [mappedSite],
    siteDomains: siteDomains.map(toSiteDomain),
    products: products.map(mapProduct),
    siteAiApps: siteAiApps.map(toSiteAiApp),
    toolCategories: toolCategories.map(toToolCategory),
    toolMenuItems: toolMenuItems.map(toToolMenuItem),
    creativePacks: creativePacks.map(toCreativePack),
    mediaAssets: mappedMediaAssets,
    customers: customers.map(mapCustomer),
    customerSessions: customerSessions.map(toCustomerSessionRelational),
    subscriptions: subscriptions.map(mapSubscriptionRuntime),
    orders: orders.map(mapOrderRuntime),
    jobs: jobs.map(mapGenerationJob),
    assetUploads: assetUploads.map(toAssetUploadRelational),
    ledger: ledger.map(mapCreditLedger),
    customerModels: customerModels.map(toCustomerModelRelational),
    albums: albums.map(toAlbumRelational)
  });
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
  const key = cleanHost(host) || "empty";
  const pageSlugs = publicRuntimePageSlugs(pageSlug);
  const pageKey = pageSlugs?.join("|") ?? "all";
  const contextKey = contextSlug ? slugify(contextSlug) : "none";
  return siteReadCache.get(
    `public-runtime-host:${key}:${pageKey}:${contextKey}`,
    async () => {
      const lookup = await getPublicRuntimeSiteLookupByHost(host);
      return lookup ? loadStorefrontPublicRuntimeState(lookup, pageSlugs, contextSlug) : undefined;
    },
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 120_000)
  );
});

export const getStorefrontPublicRuntimeStateBySlug = cache(async (slug: string, pageSlug?: string, contextSlug?: string): Promise<PlatformState | undefined> => {
  const canonicalSlug = canonicalSiteSlug(slug);
  const pageSlugs = publicRuntimePageSlugs(pageSlug);
  const pageKey = pageSlugs?.join("|") ?? "all";
  const contextKey = contextSlug ? slugify(contextSlug) : "none";
  return siteReadCache.get(
    `public-runtime-slug:${canonicalSlug}:${pageKey}:${contextKey}`,
    () => loadStorefrontPublicRuntimeState({ slugCandidates: legacySiteSlugCandidates(slug) }, pageSlugs, contextSlug),
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 120_000)
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
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 120_000)
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
          pages: normalizedPageSlug
            ? {
                ...publicMetadataSiteSelect.pages,
                where: { slug: { in: Array.from(new Set([normalizedPageSlug, "/404"])) } }
              }
            : publicMetadataSiteSelect.pages
        }
      });
      if (!site) return undefined;
      return emptyPlatformState({
        sites: [toPublicSiteShell(site)]
      });
    },
    Number(process.env.STOREFRONT_PUBLIC_CACHE_TTL_MS ?? 120_000)
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
  const admin = await prisma.siteAdmin.findUnique({ where: { siteId_email: { siteId: params.siteId, email } } });
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
  return {
    siteAdmin: toPublicSiteAdminRelational(admin),
    session: toSiteAdminSessionRelational(session)
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
  return {
    siteAdmin: toPublicSiteAdminRelational(admin),
    session: toSiteAdminSessionRelational(session)
  };
}

export async function deleteSiteAdminSessionRelational(sessionId: string, client: PrismaLike = prisma): Promise<void> {
  await client.siteAdminSession.deleteMany({ where: { id: sessionId } });
}

export async function getSiteAdminBySessionRelational(params: { siteId: string; sessionId?: string }) {
  if (!params.sessionId) return undefined;
  let session;
  try {
    session = await prisma.siteAdminSession.findUnique({
      where: { id: params.sessionId },
      include: { siteAdmin: true }
    });
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
  let session;
  try {
    session = await prisma.siteAdminSession.findFirst({
      where: { id: params.sessionId, siteId: params.siteId, expiresAt: { gt: new Date() } },
      include: {
        siteAdmin: true,
        site: { select: { id: true, slug: true } }
      }
    });
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
  return {
    site,
    result: {
      siteAdmin: admin,
      session: toSiteAdminSessionRelational(session)
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
    const site = await prisma.site.findFirst({
      where: { slug: { in: legacySiteSlugCandidates(slug) } },
      orderBy: { updatedAt: "desc" },
      include: siteRuntimeInclude
    });
    return site ? toSite(site) : undefined;
  });
}

export async function getSiteIdBySlugRelational(slug: string): Promise<string | undefined> {
  const canonicalSlug = canonicalSiteSlug(slug);
  return siteReadCache.get(`slug-id:${canonicalSlug}`, async () => {
    const site = await prisma.site.findFirst({
      where: { slug: { in: legacySiteSlugCandidates(slug) } },
      orderBy: { updatedAt: "desc" },
      select: { id: true }
    });
    return site?.id;
  });
}

export type CustomerWorkspaceBootstrapRelational = {
  site: Pick<Site, "id" | "name" | "slug" | "branding" | "primaryDomain">;
  siteAiApps: SiteAiApp[];
  creativePacks: CreativePack[];
};

export async function getCustomerWorkspaceSiteShellRelational(slug: string): Promise<CustomerWorkspaceBootstrapRelational["site"] | undefined> {
  const canonicalSlug = canonicalSiteSlug(slug);
  return siteReadCache.get<CustomerWorkspaceBootstrapRelational["site"] | undefined>(`workspace-site-shell:${canonicalSlug}`, async () => {
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
  }, Number(process.env.STOREFRONT_WORKSPACE_BOOTSTRAP_CACHE_TTL_MS ?? 60_000));
}

export async function getCustomerWorkspaceBootstrapRelational(slug: string): Promise<CustomerWorkspaceBootstrapRelational | undefined> {
  const canonicalSlug = canonicalSiteSlug(slug);
  return siteReadCache.get<CustomerWorkspaceBootstrapRelational | undefined>(`workspace-bootstrap:${canonicalSlug}`, async () => {
    const site = await getCustomerWorkspaceSiteShellRelational(slug);
    if (!site) return undefined;

    const [siteAiApps, creativePacks] = await Promise.all([
      prisma.siteAiApp.findMany({
        where: { siteId: site.id, enabled: true },
        include: { aiApp: true },
        orderBy: [{ routeKey: "asc" }],
        take: workspaceCustomerRuntimeLimits.siteAiApps
      }),
      prisma.creativePack.findMany({
        where: { siteId: site.id, status: "active" },
        orderBy: [{ createdAt: "asc" }],
        take: workspaceCustomerRuntimeLimits.creativePacks
      })
    ]);

    return {
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        primaryDomain: site.primaryDomain,
        branding: site.branding
      },
      siteAiApps: siteAiApps.map(toSiteAiApp),
      creativePacks: creativePacks.map(toCreativePack)
    };
  }, Number(process.env.STOREFRONT_WORKSPACE_BOOTSTRAP_CACHE_TTL_MS ?? 60_000));
}

export async function getSiteBySlugForAdmin(slug: string): Promise<Site | undefined> {
  try {
    const canonicalSlug = canonicalSiteSlug(slug);
    return await siteReadCache.get(`admin-login-site:${canonicalSlug}`, async () => {
      const site = await prisma.site.findFirst({
        where: { slug: { in: legacySiteSlugCandidates(slug) } },
        orderBy: { updatedAt: "desc" },
        select: adminLoginSiteSelect
      });
      return site ? toAdminLoginSiteShell(site) : undefined;
    });
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    throw new RelationalStoreError("relational_site_lookup_unavailable", 503);
  }
}

export async function getSiteByIdForAdmin(siteId: string): Promise<Site | undefined> {
  try {
    return await siteReadCache.get(`admin-site-id:${siteId}`, async () => {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        include: siteRuntimeInclude
      });
      return site ? toSite(site) : undefined;
    });
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
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
    return await siteReadCache.get(`theme-preflight-site:${siteId}`, async () => {
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
    }, Number(process.env.SITE_ADMIN_PREFLIGHT_CACHE_TTL_MS ?? 15_000));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    throw new RelationalStoreError("relational_theme_preflight_site_unavailable", 503);
  }
}

export async function getThemePublishPreflightBundleRelational(siteId: string): Promise<{
  site?: Site;
  dirtyPageIds: string[];
  products: PublishPreflightProduct[];
  siteAiApps: PublishPreflightSiteAiApp[];
  mediaAssets: PublishPreflightMediaAsset[];
}> {
  try {
    return await siteReadCache.get(`theme-preflight-bundle:${siteId}`, async () => {
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
        siteAiApps: PublishPreflightSiteAiApp[];
        mediaAssets: PublishPreflightMediaAsset[];
      };
      const rows = await prisma.$queryRaw<PreflightBundleRow[]>`
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
                SELECT jsonb_agg(jsonb_build_object('stripePriceId', px."stripePriceId", 'amountCents', px."amountCents"))
                FROM "Price" px
                WHERE px."productId" = pr."id"
              ), '[]'::jsonb)
            ))
            FROM "Product" pr
            WHERE pr."siteId" = s."id"
          ), '[]'::jsonb) AS "products",
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
            SELECT jsonb_agg(jsonb_build_object('id', ma."id"))
            FROM "MediaAsset" ma
            WHERE ma."siteId" = s."id"
          ), '[]'::jsonb) AS "mediaAssets"
        FROM "Site" s
        LEFT JOIN "ThemeSettings" ts ON ts."siteId" = s."id"
        LEFT JOIN "StripeConnectAccount" sc ON sc."siteId" = s."id"
        WHERE s."id" = ${siteId}
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) return { site: undefined, dirtyPageIds: [], products: [], siteAiApps: [], mediaAssets: [] };
      const primaryDomain = row.domains.find((domain) => domain.isPrimary)?.domain ?? row.domains[0]?.domain ?? row.primaryDomain ?? "";
      return {
        dirtyPageIds: row.dirtyPageIds,
        products: row.products.map((product) => ({
          id: product.id,
          status: product.status as PublishPreflightProduct["status"],
          type: product.type as PublishPreflightProduct["type"],
          prices: product.prices.map((price) => ({
            amountCents: price.amountCents,
            stripePriceId: price.stripePriceId ?? ""
          }))
        })),
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
    }, Number(process.env.SITE_ADMIN_PREFLIGHT_CACHE_TTL_MS ?? 15_000));
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    throw new RelationalStoreError("relational_theme_preflight_bundle_unavailable", 503);
  }
}

export async function getSiteShellBySlugForAdmin(slug: string): Promise<Site | undefined> {
  try {
    const canonicalSlug = canonicalSiteSlug(slug);
    return await siteReadCache.get(`admin-shell-v2:${canonicalSlug}`, async () => {
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
    });
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
      ? prisma.themePublication
          .findMany({ where: { siteId }, orderBy: [{ publishedAt: "asc" }, { version: "asc" }], take: take.publications })
          .then((rows) => rows.map(toThemePublication))
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
    () => mode === "light" ? loadLightSiteAdminContextRelationalSummary(siteId) : loadSiteAdminContextRelationalSummary(siteId),
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
      SELECT
        (SELECT COUNT(*) FROM "Product" WHERE "siteId" = ${siteId}) AS "productCount",
        (SELECT COUNT(*) FROM "Product" WHERE "siteId" = ${siteId} AND "status" = 'active') AS "activeProductCount",
        (SELECT COUNT(*) FROM "Price" WHERE "siteId" = ${siteId}) AS "totalPriceCount",
        (SELECT COUNT(*) FROM "GenerationJob" WHERE "siteId" = ${siteId}) AS "jobCount",
        (SELECT COUNT(*) FROM "GenerationJob" WHERE "siteId" = ${siteId} AND "status" IN ('failed', 'refunded')) AS "failedJobCount",
        (SELECT COUNT(*) FROM "GenerationJob" WHERE "siteId" = ${siteId} AND "status" IN ('running', 'queued')) AS "openJobCount",
        (SELECT COUNT(*) FROM "GenerationJob" WHERE "siteId" = ${siteId} AND "status" = 'succeeded') AS "completedJobCount",
        (SELECT COUNT(*) FROM "SiteAiApp" WHERE "siteId" = ${siteId}) AS "appCount",
        (SELECT COUNT(*) FROM "SiteAiApp" WHERE "siteId" = ${siteId} AND "enabled" = true) AS "activeAppCount",
        (SELECT COUNT(*) FROM "MediaAsset" WHERE "siteId" = ${siteId}) AS "mediaCount",
        (SELECT COUNT(*) FROM "ThemePublication" WHERE "siteId" = ${siteId}) AS "publicationCount",
        (SELECT COUNT(*) FROM "Customer" WHERE "siteId" = ${siteId}) AS "customerCount",
        (SELECT COALESCE(SUM("balance"), 0) FROM "CreditBalance" WHERE "siteId" = ${siteId}) AS "availableCredits",
        (SELECT COALESCE(SUM("reserved"), 0) FROM "CreditBalance" WHERE "siteId" = ${siteId}) AS "reservedCredits",
        (SELECT COUNT(*) FROM "Order" WHERE "siteId" = ${siteId}) AS "orderCount",
        (SELECT COUNT(*) FROM "Order" WHERE "siteId" = ${siteId} AND "status" IN ('paid', 'fulfilled')) AS "paidOrderCount",
        (SELECT COUNT(*) FROM "Subscription" WHERE "siteId" = ${siteId}) AS "subscriptionCount",
        (SELECT COUNT(*) FROM "Subscription" WHERE "siteId" = ${siteId} AND "status" IN ('active', 'trialing')) AS "activeSubscriptionCount",
        (SELECT COALESCE(SUM("amountCents"), 0) FROM "Order" WHERE "siteId" = ${siteId} AND "status" IN ('paid', 'fulfilled')) AS "revenueCents"
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
      SELECT
        (SELECT COUNT(*) FROM "Product" WHERE "siteId" = ${siteId}) AS "productCount",
        (SELECT COUNT(*) FROM "Product" WHERE "siteId" = ${siteId} AND "status" = 'active') AS "activeProductCount",
        (SELECT COUNT(*) FROM "Price" WHERE "siteId" = ${siteId}) AS "totalPriceCount",
        (SELECT COUNT(*) FROM "GenerationJob" WHERE "siteId" = ${siteId}) AS "jobCount",
        (SELECT COUNT(*) FROM "GenerationJob" WHERE "siteId" = ${siteId} AND "status" IN ('failed', 'refunded')) AS "failedJobCount",
        (SELECT COUNT(*) FROM "GenerationJob" WHERE "siteId" = ${siteId} AND "status" IN ('running', 'queued')) AS "openJobCount",
        (SELECT COUNT(*) FROM "GenerationJob" WHERE "siteId" = ${siteId} AND "status" = 'succeeded') AS "completedJobCount",
        (SELECT COUNT(*) FROM "SiteAiApp" WHERE "siteId" = ${siteId}) AS "appCount",
        (SELECT COUNT(*) FROM "SiteAiApp" WHERE "siteId" = ${siteId} AND "enabled" = true) AS "activeAppCount",
        (SELECT COUNT(*) FROM "MediaAsset" WHERE "siteId" = ${siteId}) AS "mediaCount",
        (SELECT COUNT(*) FROM "ThemePublication" WHERE "siteId" = ${siteId}) AS "publicationCount",
        (SELECT COUNT(*) FROM "Customer" WHERE "siteId" = ${siteId}) AS "customerCount",
        (SELECT COALESCE(SUM("balance"), 0) FROM "CreditBalance" WHERE "siteId" = ${siteId}) AS "availableCredits",
        (SELECT COALESCE(SUM("reserved"), 0) FROM "CreditBalance" WHERE "siteId" = ${siteId}) AS "reservedCredits",
        (SELECT COUNT(*) FROM "Order" WHERE "siteId" = ${siteId}) AS "orderCount",
        (SELECT COUNT(*) FROM "Order" WHERE "siteId" = ${siteId} AND "status" IN ('paid', 'fulfilled')) AS "paidOrderCount",
        (SELECT COUNT(*) FROM "Subscription" WHERE "siteId" = ${siteId}) AS "subscriptionCount",
        (SELECT COUNT(*) FROM "CreditLedger" WHERE "siteId" = ${siteId}) AS "ledgerCount",
        (SELECT COUNT(*) FROM "PaymentEvent" WHERE "siteId" = ${siteId}) AS "paymentEventCount",
        (SELECT COALESCE(SUM("amountCents"), 0) FROM "Order" WHERE "siteId" = ${siteId} AND "status" IN ('paid', 'fulfilled')) AS "revenueCents",
        (SELECT COUNT(*) FROM "Subscription" WHERE "siteId" = ${siteId} AND "status" IN ('active', 'trialing')) AS "activeSubscriptionCount",
        (SELECT COUNT(*) FROM "CreativePack" WHERE "siteId" = ${siteId} AND "status" = 'active') AS "activePackCount",
        (SELECT COUNT(*) FROM "CreativePack" WHERE "siteId" = ${siteId} AND "status" = 'draft') AS "draftPackCount",
        (SELECT COUNT(*) FROM "Album" WHERE "siteId" = ${siteId}) AS "albumCount",
        (SELECT COUNT(*) FROM "Album" WHERE "siteId" = ${siteId} AND "status" = 'ready') AS "readyAlbumCount",
        (SELECT COUNT(*) FROM "CustomerModel" WHERE "siteId" = ${siteId}) AS "modelCount",
        (SELECT COUNT(*) FROM "CustomerModel" WHERE "siteId" = ${siteId} AND "status" = 'ready') AS "readyModelCount",
        (SELECT COUNT(*) FROM "AssetUpload" WHERE "siteId" = ${siteId} AND "role" = 'input' AND "deletedAt" IS NULL) AS "inputAssetCount",
        (SELECT COUNT(*) FROM "AssetUpload" WHERE "siteId" = ${siteId} AND "role" = 'output' AND "deletedAt" IS NULL) AS "generatedAssetCount",
        (SELECT COUNT(*) FROM "ThemePage" WHERE "siteId" = ${siteId} AND "draftJson"::jsonb IS DISTINCT FROM "publishedJson"::jsonb) AS "dirtyPageCount",
        (SELECT COUNT(*) FROM "Order" WHERE "siteId" = ${siteId} AND "status" IN ('created', 'checkout_started')) AS "pendingOrderCount",
        (SELECT COUNT(*) FROM "Order" WHERE "siteId" = ${siteId} AND "createdAt" >= NOW() - INTERVAL '30 days') AS "monthOrderCount",
        (SELECT COUNT(*) FROM "Order" WHERE "siteId" = ${siteId} AND "status" IN ('paid', 'fulfilled') AND "createdAt" >= NOW() - INTERVAL '30 days') AS "monthPaidOrderCount",
        (SELECT COUNT(*) FROM "Order" WHERE "siteId" = ${siteId} AND "status" IN ('created', 'checkout_started') AND "createdAt" >= NOW() - INTERVAL '30 days') AS "monthPendingOrderCount",
        (SELECT COALESCE(SUM("amountCents"), 0) FROM "Order" WHERE "siteId" = ${siteId} AND "status" IN ('paid', 'fulfilled') AND "createdAt" >= NOW() - INTERVAL '30 days') AS "monthRevenueCents",
        (SELECT COUNT(*) FROM "GenerationJob" WHERE "siteId" = ${siteId} AND "createdAt" >= NOW() - INTERVAL '1 day') AS "todayJobCount",
        (SELECT COUNT(*) FROM "GenerationJob" WHERE "siteId" = ${siteId} AND "createdAt" >= NOW() - INTERVAL '30 days') AS "monthJobCount"
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
  return siteReadCache.get(`first-admin:${siteId}`, async () => {
    const admin = await prisma.siteAdmin.findFirst({
      where: { siteId },
      orderBy: { createdAt: "asc" },
      select: { email: true }
    });
    return admin?.email;
  });
}

export async function getFirstSiteAdminEmail(siteId: string): Promise<string | undefined> {
  try {
    return await getFirstSiteAdminEmailRelational(siteId);
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
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

    for (const [index, page] of sourceSite.pages.entries()) {
      await tx.themePage.create({
        data: {
          id: `${siteId}_${slugify(page.slug) || `page_${index + 1}`}`,
          siteId,
          pageType: page.pageType,
          slug: page.slug,
          title: page.title,
          draftJson: cloneJson(page.draftJson) as unknown as Prisma.InputJsonValue,
          publishedJson: cloneJson(page.publishedJson) as unknown as Prisma.InputJsonValue
        }
      });
    }

    const siteAiApps = [];
    for (const app of sourceSite.aiApps) {
      const record = await tx.siteAiApp.create({
        data: {
          id: `sai_${slug}_${app.aiApp.slug}`,
          siteId,
          aiAppId: app.aiAppId,
          enabled: app.enabled,
          creditCost: app.creditCost,
          routeKey: app.routeKey
        },
        include: { aiApp: true }
      });
      siteAiApps.push(toSiteAiApp(record));
    }

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

    await addAuditLogRelational(tx, {
      siteId,
      actorType: "platform_admin",
      actorId: "platform",
      action: "site_created",
      targetType: "site",
      targetId: siteId,
      metadata: { slug, domain: domainName }
    });

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
  });
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
  });
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
  });
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
  });
  return { deletedAdmin: toSiteAdmin(admin) };
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
  const galleryImages = Array.isArray(params.galleryImages) ? params.galleryImages.map((item) => item.trim()).filter(Boolean).slice(0, 24) : [];
  const imageUrl = params.imageUrl?.trim() || galleryImages[0] || null;
  if (description.length < 8) throw new RelationalStoreError("creative_pack_description_required", 400);
  if (prompt && prompt.length > 6000) throw new RelationalStoreError("creative_pack_prompt_too_long", 400);
  const aiApp = await prisma.aiApp.findUnique({ where: { slug: params.aiAppSlug }, select: { id: true } });
  if (!aiApp) throw new RelationalStoreError("ai_app_not_found", 404);
  if (!Number.isInteger(params.creditCost) || params.creditCost < 0) throw new RelationalStoreError("invalid_credit_cost", 400);
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
          galleryImages
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
          generationCount: 0,
          conversionRate: 0
        }
      });

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
  const providerConfig = validateAiProviderConfig(params.providerConfig);
  const existing = await prisma.siteAiApp.findFirst({ where: { id: params.siteAiAppId, siteId: params.siteId } });
  if (!existing) throw new RelationalStoreError("site_ai_app_not_found", 404);
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

function validateAiProviderConfig(value: AiProviderConfig | undefined): AiProviderConfig | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") throw new RelationalStoreError("invalid_provider_config", 400);
  const mode = value.mode === "fixed_provider" || value.mode === "preferred_provider" ? value.mode : "platform_fallback";
  return {
    mode,
    providerId: value.providerId ? String(value.providerId).trim().slice(0, 80) : undefined,
    modelType: value.modelType ? String(value.modelType).trim().slice(0, 120) : undefined,
    fallbackEnabled: value.fallbackEnabled !== false
  };
}
