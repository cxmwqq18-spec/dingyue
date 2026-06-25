import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { canPublishPaidProducts } from "@/lib/billing";
import { runDbTasks } from "@/lib/db-concurrency";
import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import type { AiApp, CreativePack, Price, Product, SiteAiApp } from "@/lib/types";

const productsPageCache = createServerTtlCache("site-admin-products-page", Number(process.env.SITE_ADMIN_PRODUCTS_PAGE_CACHE_TTL_MS ?? 15_000));

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 4);
const adminProductListTake = envInt("SITE_ADMIN_PRODUCT_LIST_TAKE", 100);
const adminPackListTake = envInt("SITE_ADMIN_PACK_LIST_TAKE", 100);
const adminAiAppListTake = envInt("SITE_ADMIN_AI_APP_LIST_TAKE", 100);
const adminPriceListTake = envInt("SITE_ADMIN_PRICE_LIST_TAKE", 100);

function jsonRecord(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, string | number | boolean>;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  const payload = await productsPageCache.get(siteId, async () => {
    const [site, products, packs, siteAiApps] = await runDbTasks([
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
      () => prisma.creativePack.findMany({
        where: { siteId },
        select: {
          id: true,
          siteId: true,
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
          createdAt: true
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        take: adminPackListTake
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
    ], siteAdminReadConcurrency);

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
          interval: price.interval === "one_time" ? "one_time" : "month",
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
    return {
      ok: true,
      currency: site.currency,
      products: mappedProducts,
      packs: packs.map(
        (pack): CreativePack => ({
          id: pack.id,
          siteId: pack.siteId,
          name: pack.name,
          headline: pack.headline,
          description: pack.description,
          prompt: pack.prompt ?? undefined,
          category: pack.category as CreativePack["category"],
          aiAppSlug: pack.aiAppSlug,
          status: pack.status as CreativePack["status"],
          creditCost: pack.creditCost,
          outputCount: pack.outputCount,
          trainingRequired: pack.trainingRequired,
          generationCount: pack.generationCount,
          conversionRate: pack.conversionRate,
          createdAt: toIso(pack.createdAt),
          imageUrl: pack.imageUrl ?? undefined
        })
      ),
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
  });

  if (!payload) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
