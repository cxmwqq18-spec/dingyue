import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { runDbTasks } from "@/lib/db-concurrency";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
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
import type { Site, ThemePageJson } from "@/lib/types";

const contentPageCache = createServerTtlCache("admin-content-page", 15_000);

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 4);
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

function pageSummaryJson(value: unknown): ThemePageJson {
  const json = value && typeof value === "object" ? value as Partial<ThemePageJson> & { draftMeta?: unknown } : {};
  return {
    pageType: typeof json.pageType === "string" ? json.pageType : "content",
    version: typeof json.version === "number" ? json.version : 1,
    sectionsOrder: Array.isArray(json.sectionsOrder) ? json.sectionsOrder.filter((item): item is string => typeof item === "string") : [],
    sections: {}
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
  const editor = wantsEditor(request);

  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    const state = readPlatformState();
    const site = state.sites.find((item) => item.id === siteId);
    if (!site) {
      return NextResponse.json({ error: "site_not_found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
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
      publicationCount: getSiteThemePublicationsFromState(state, siteId).length,
      publications: [],
      packs: editor ? getSiteCreativePacksFromState(state, siteId).slice(0, adminPackListTake) : [],
      media: editor ? getSiteMediaAssetsFromState(state, siteId).slice(0, adminMediaListTake) : [],
      products: editor ? getSiteProductsFromState(state, siteId).slice(0, adminProductListTake) : [],
      apps: editor ? getSiteAppsFromState(state, siteId).slice(0, adminAiAppListTake) : []
    });
  }

  const load = async () => {
    const [siteRecord, publicationCount, packs, media, products, apps] = await runDbTasks([
      () => prisma.site.findUnique({
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
              ...(editor ? { draftJson: true, publishedJson: true } : {})
            }
          },
          ...(editor ? { settings: { select: { draftJson: true, publishedJson: true } } } : {})
        }
      }),
      () => prisma.themePublication.count({ where: { siteId } }),
      editor
        ? () => prisma.creativePack.findMany({
            where: { siteId },
            orderBy: [{ status: "asc" }, { createdAt: "asc" }],
            take: adminPackListTake
          })
        : () => Promise.resolve([]),
      editor
        ? () => prisma.mediaAsset.findMany({
            where: { siteId },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take: adminMediaListTake
          })
        : () => Promise.resolve([]),
      editor
        ? () => prisma.product.findMany({
            where: { siteId },
            select: {
              id: true,
              siteId: true,
              name: true,
              type: true,
              status: true,
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
                  createdAt: true,
                  updatedAt: true
                },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                take: adminPriceListTake
              }
            },
            orderBy: [{ status: "asc" }, { createdAt: "asc" }],
            take: adminProductListTake
          })
        : () => Promise.resolve([]),
      editor
        ? () => prisma.siteAiApp.findMany({
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
        : () => Promise.resolve([])
    ], siteAdminReadConcurrency);

    if (!siteRecord) return undefined;

    return {
      ok: true,
      site: editor ? toSite(siteRecord) : lightSite(siteRecord),
      publicationCount,
      publications: [],
      packs: packs.map(toCreativePack),
      media: media.map(toMediaAsset),
      products: products.map(mapProduct),
      apps: apps.map(toSiteAiApp)
    };
  };

  const payload = editor
    ? await contentPageCache.get(`editor:${siteId}`, load)
    : await contentPageCache.get(`summary:${siteId}`, load);

  if (!payload) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
