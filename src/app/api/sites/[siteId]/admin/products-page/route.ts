import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { canPublishPaidProducts } from "@/lib/billing";
import { runDbTasks } from "@/lib/db-concurrency";
import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import type { AiApp, Price, Product, SiteAiApp } from "@/lib/types";

const productsPageCache = createServerTtlCache("site-admin-products-page", Number(process.env.SITE_ADMIN_PRODUCTS_PAGE_CACHE_TTL_MS ?? 15_000));

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 2);
const adminProductListTake = envInt("SITE_ADMIN_PRODUCT_LIST_TAKE", 100);
const adminAiAppListTake = envInt("SITE_ADMIN_AI_APP_LIST_TAKE", 100);
const adminPriceListTake = envInt("SITE_ADMIN_PRICE_LIST_TAKE", 100);

function jsonRecord(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, string | number | boolean>;
}

function priceInterval(value: string): Price["interval"] {
  return value === "year" || value === "quarter" || value === "half_year" || value === "one_time" ? value : "month";
}

function countGroupRow(row: { _count?: unknown }): number {
  const count = row._count;
  if (!count || typeof count !== "object") return 0;
  const all = (count as { _all?: unknown })._all;
  return typeof all === "number" ? all : 0;
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const perf = createAdminPerfTracker("admin-products-page", { siteId });
  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }

  const payload = await perf.measure("cache", () => productsPageCache.get(siteId, async () => {
    const [site, products, packCounts, siteAiApps] = await perf.measure("db", () => runDbTasks([
      () => prisma.site.findUnique({
        where: { id: siteId },
        select: {
          currency: true,
          connect: { select: { chargesEnabled: true } }
        }
      }),
      () => prisma.product.findMany({
        where: { siteId },
        select: {
          id: true,
          siteId: true,
          name: true,
          type: true,
          status: true,
          prices: {
            select: {
              id: true,
              siteId: true,
              productId: true,
              label: true,
              amountCents: true,
              currency: true,
              interval: true,
              creditsGranted: true,
              stripePriceId: true,
              metadata: true
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: adminPriceListTake
          }
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        take: adminProductListTake
      }),
      () => prisma.creativePack.groupBy({
        by: ["status"],
        where: { siteId },
        _count: { _all: true },
        orderBy: { status: "asc" }
      }),
      () => prisma.siteAiApp.findMany({
        where: { siteId },
        select: {
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
        },
        orderBy: [{ enabled: "desc" }, { routeKey: "asc" }],
        take: adminAiAppListTake
      })
    ], siteAdminReadConcurrency));

    if (!site) return undefined;
    const mappedProducts: Product[] = products.map((product) => ({
      id: product.id,
      siteId: product.siteId,
      name: product.name,
      type: product.type === "credit_pack" ? "credit_pack" : "subscription",
      status: product.status === "draft" ? "draft" : "active",
      prices: product.prices.map(
        (price): Price => ({
          id: price.id,
          siteId: price.siteId,
          productId: price.productId,
          label: price.label,
          amountCents: price.amountCents,
          currency: price.currency,
          interval: priceInterval(price.interval),
          creditsGranted: price.creditsGranted,
          stripePriceId: price.stripePriceId ?? `manual_${price.id}`,
          metadata: jsonRecord(price.metadata)
        })
      )
    }));
    const publishProducts = products.map(
      (product): Product => ({
        id: product.id,
        siteId: product.siteId,
        name: product.name,
        type: product.type === "credit_pack" ? "credit_pack" : "subscription",
        status: product.status === "draft" ? "draft" : "active",
        prices: []
      })
    );
    const packStatusCounts = packCounts.reduce(
      (memo, row) => {
        const status = row.status as "active" | "draft" | "paused";
        const count = countGroupRow(row);
        if (status === "active" || status === "draft" || status === "paused") memo[status] = count;
        memo.all += count;
        return memo;
      },
      { all: 0, active: 0, draft: 0, paused: 0 }
    );
    return {
      ok: true,
      currency: site.currency,
      products: mappedProducts,
      packCounts: packStatusCounts,
      packTotal: packStatusCounts.all,
      siteAiApps: siteAiApps.map(
        (siteAiApp): SiteAiApp => ({
          id: siteAiApp.id,
          siteId: siteAiApp.siteId,
          enabled: siteAiApp.enabled,
          creditCost: siteAiApp.creditCost,
          routeKey: siteAiApp.routeKey,
          aiApp: {
            id: siteAiApp.aiApp.id,
            slug: siteAiApp.aiApp.slug,
            name: siteAiApp.aiApp.name,
            description: siteAiApp.aiApp.description,
            appType: siteAiApp.aiApp.appType as AiApp["appType"],
            parameterSchema: []
          }
        })
      ),
      publishState: canPublishPaidProducts(Boolean(site.connect?.chargesEnabled), publishProducts)
    };
  }));

  if (!payload) {
    return adminPerfJson(perf, { error: "site_not_found" }, { status: 404 });
  }

  return adminPerfJson(perf, payload);
}
