import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { runDbTasks } from "@/lib/db-concurrency";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import { isPostgresPlatformStateEnabled } from "@/lib/platform-state-store";
import {
  getSiteAppsFromState,
  getSiteCreativePacksFromState,
  getSiteMediaAssetsFromState,
  getSiteProductsFromState,
  getSiteThemePublicationsFromState,
  readPlatformState
} from "@/lib/server-store";
import { prisma } from "@/lib/prisma";
import { mapProduct, toCreativePack, toMediaAsset, toSite, toSiteAiApp } from "@/lib/stores/prisma-mappers";
import type { Site, ThemePage, ThemePageJson } from "@/lib/types";

const contentPageCache = createServerTtlCache("admin-content-page", 15_000);

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 2);
const adminContentPageTake = envInt("SITE_ADMIN_CONTENT_PAGE_TAKE", 100);
const adminDomainListTake = envInt("SITE_ADMIN_DOMAIN_LIST_TAKE", 50);
const adminPackListTake = envInt("SITE_ADMIN_PACK_LIST_TAKE", 100);
const adminMediaListTake = envInt("SITE_ADMIN_MEDIA_LIST_TAKE", 100);
const adminProductListTake = envInt("SITE_ADMIN_PRODUCT_LIST_TAKE", 100);
const adminAiAppListTake = envInt("SITE_ADMIN_AI_APP_LIST_TAKE", 100);
const adminPriceListTake = envInt("SITE_ADMIN_PRICE_LIST_TAKE", 100);

function wantsEditor(request: Request) {
  return new URL(request.url).searchParams.get("editor") === "1";
}

function readSection(request: Request) {
  return new URL(request.url).searchParams.get("section") ?? "core";
}

function pageSummaryJson(value: unknown): ThemePageJson {
  const json = value && typeof value === "object" ? value as Partial<ThemePageJson> & { draftMeta?: unknown } : {};
  return {
    pageType: typeof json.pageType === "string" ? json.pageType : "content",
    version: typeof json.version === "number" ? json.version : 1,
    sectionsOrder: Array.isArray(json.sectionsOrder) ? json.sectionsOrder.filter((item): item is string => typeof item === "string") : [],
    sections: {}
  };
}

type BlogSummaryArticle = {
  id: string;
  slug: string;
  title: string;
  author: string;
  publishedAt: string;
  readMinutes: string;
  draftStatus: "dirty" | "live";
  seoStatus: "ready" | "needs_review";
};

type BlogSummary = {
  homeSlug: string;
  articleCount: number;
  footerLinkPresent: boolean;
  articles: BlogSummaryArticle[];
};

function sectionSetting(entry: { settings?: Record<string, unknown> } | undefined, key: string, fallback = ""): string {
  const value = entry?.settings?.[key];
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function blogArticleSection(page: ThemePage) {
  const orderedSections = page.publishedJson.sectionsOrder
    .map((sectionId) => page.publishedJson.sections[sectionId])
    .filter(Boolean);
  return orderedSections.find((section) => section.type === "blog_article") ??
    orderedSections.find((section) => section.type === "rich_text");
}

function pageSeoReady(page: ThemePage): boolean {
  const seo = page.publishedJson.seo;
  return Boolean(seo?.title?.trim() && seo.description?.trim() && seo.canonicalPath?.trim() && seo.robots?.index !== false);
}

function footerHasBlogLink(site: Site): boolean {
  const footerBlocks = site.themeSettings.publishedJson.globalSections?.footer?.blocks ?? [];
  const footerLinks = site.themeSettings.publishedJson.navigation?.footerLinks ?? [];
  return [
    ...footerLinks.map((link) => link.href),
    ...footerBlocks.map((block) => sectionSetting(block, "href"))
  ].some((href) => href === "/blog" || href.startsWith("/blog?") || href.startsWith("/blog#"));
}

function buildBlogSummary(site: Site): BlogSummary {
  const articles = site.pages
    .filter((page) => page.slug.startsWith("/blog/"))
    .map((page): BlogSummaryArticle => {
      const article = blogArticleSection(page);
      return {
        id: page.id,
        slug: page.slug,
        title: sectionSetting(article, "title", page.title),
        author: sectionSetting(article, "author", site.name),
        publishedAt: sectionSetting(article, "publishedAt"),
        readMinutes: sectionSetting(article, "readMinutes"),
        draftStatus: JSON.stringify(page.draftJson) === JSON.stringify(page.publishedJson) ? "live" : "dirty",
        seoStatus: pageSeoReady(page) ? "ready" : "needs_review"
      };
    })
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt) || left.title.localeCompare(right.title));
  return {
    homeSlug: site.pages.some((page) => page.slug === "/blog") ? "/blog" : "",
    articleCount: articles.length,
    footerLinkPresent: footerHasBlogLink(site),
    articles
  };
}

function lightSite(record: {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  currency: string;
  signupCreditGrant?: number | null;
  branding: unknown;
  domains?: Array<{ domain: string; isPrimary: boolean }>;
  connect?: { stripeAccountId: string; onboardingStatus: string; chargesEnabled: boolean; payoutsEnabled: boolean } | null;
  settings?: { draftJson: unknown; publishedJson: unknown } | null;
  pages?: Array<{
    id: string;
    siteId: string;
    pageType: string;
    templateKey?: string | null;
    slug: string;
    title: string;
    draftJson?: unknown;
    publishedJson?: unknown;
  }>;
}): Site {
  const site = toSite({
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status,
    timezone: record.timezone,
    currency: record.currency,
    signupCreditGrant: record.signupCreditGrant,
    branding: record.branding,
    domains: record.domains,
    connect: record.connect,
    settings: record.settings,
    pages: []
  });
  site.pages = (record.pages ?? []).map((page) => ({
    id: page.id,
    siteId: page.siteId,
    pageType: page.pageType,
    templateKey: page.templateKey ?? undefined,
    slug: page.slug,
    title: page.title,
    draftJson: pageSummaryJson(page.draftJson),
    publishedJson: pageSummaryJson(page.publishedJson)
  }));
  return site;
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const section = readSection(request);
  const editor = section === "editor" || wantsEditor(request);
  const perf = createAdminPerfTracker("admin-content-page", { siteId, editor, section });

  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }

  if (!isPostgresPlatformStateEnabled()) {
    const state = perf.measureSync("context", () => readPlatformState(), { source: "state" });
    const site = state.sites.find((item) => item.id === siteId);
    if (!site) {
      return adminPerfJson(perf, { error: "site_not_found" }, { status: 404 });
    }
    if (section === "editor") {
      return adminPerfJson(perf, {
        ok: true,
        packs: getSiteCreativePacksFromState(state, siteId).slice(0, adminPackListTake),
        media: getSiteMediaAssetsFromState(state, siteId).slice(0, adminMediaListTake),
        products: getSiteProductsFromState(state, siteId).slice(0, adminProductListTake),
        apps: getSiteAppsFromState(state, siteId).slice(0, adminAiAppListTake)
      });
    }
    if (section === "publication") {
      return adminPerfJson(perf, {
        ok: true,
        publicationCount: getSiteThemePublicationsFromState(state, siteId).length,
        publications: []
      });
    }
    const corePayload = {
      ok: true,
      blogSummary: buildBlogSummary(site),
      site: editor
        ? { ...site, pages: site.pages.slice(0, adminContentPageTake) }
        : {
            ...site,
            pages: site.pages.slice(0, adminContentPageTake).map((page) => ({
              ...page,
              draftJson: pageSummaryJson(page.draftJson),
              publishedJson: pageSummaryJson(page.publishedJson)
            }))
          },
      publications: []
    };
    return adminPerfJson(perf, corePayload);
  }

  const loadCore = async () => {
    const siteRecord = await perf.measure("db", () =>
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
          connect: true,
          settings: { select: { draftJson: true, publishedJson: true } },
          domains: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            take: adminDomainListTake,
            select: { domain: true, isPrimary: true }
          },
          pages: {
            orderBy: { slug: "asc" },
            take: adminContentPageTake,
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
        }
      })
    );

    if (!siteRecord) return undefined;
    const fullSite = toSite(siteRecord);

    return {
      ok: true,
      blogSummary: buildBlogSummary(fullSite),
      site: editor ? fullSite : lightSite(siteRecord),
      publications: []
    };
  };

  const loadPublicationSummary = async () => {
    return {
      ok: true,
      publicationCount: 0,
      publications: []
    };
  };

  const loadEditorResources = async () => {
    const [packs, media, products, apps] = await perf.measure("db", () => runDbTasks([
      () => prisma.creativePack.findMany({
        where: { siteId },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        take: adminPackListTake
      }),
      () => prisma.mediaAsset.findMany({
        where: { siteId },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: adminMediaListTake
      }),
      () => prisma.product.findMany({
        where: { siteId },
        select: {
          id: true,
          siteId: true,
          name: true,
          type: true,
          status: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          prices: {
            select: {
              id: true,
              siteId: true,
              productId: true,
              amountCents: true,
              currency: true,
              interval: true,
              creditsGranted: true,
              stripePriceId: true,
              label: true,
              metadata: true,
              status: true,
              effectiveFrom: true,
              effectiveTo: true,
              replacesPriceId: true,
              providerVerifiedAt: true,
              providerFingerprint: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: adminPriceListTake
          }
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        take: adminProductListTake
      }),
      () => prisma.siteAiApp.findMany({
        where: { siteId },
        select: {
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
        },
        orderBy: [{ enabled: "desc" }, { routeKey: "asc" }],
        take: adminAiAppListTake
      })
    ], siteAdminReadConcurrency));

    return {
      ok: true,
      packs: packs.map(toCreativePack),
      media: media.map(toMediaAsset),
      products: products.map(mapProduct),
      apps: apps.map(toSiteAiApp)
    };
  };

  const payload = section === "editor"
    ? await perf.measure("cache", () => contentPageCache.get(`editor-resources:${siteId}`, async () => loadEditorResources()))
    : section === "publication"
      ? await perf.measure("cache", () => contentPageCache.get(`publication:${siteId}`, async () => loadPublicationSummary()))
      : await perf.measure("cache", () => contentPageCache.get(`${editor ? "editor-core" : "summary"}:${siteId}`, async () => loadCore()));

  if (!payload) {
    return adminPerfJson(perf, { error: "site_not_found" }, { status: 404 });
  }

  return adminPerfJson(perf, payload);
}
