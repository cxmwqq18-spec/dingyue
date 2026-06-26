import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import { readPlatformState, getSiteAppsFromState, getSiteCreativePacksFromState, getSiteMediaAssetsFromState, getSiteProductsFromState } from "@/lib/server-store";
import { mapProduct, toCreativePack, toMediaAsset, toSiteAiApp } from "@/lib/stores/prisma-mappers";
import type { CreativePack, MediaAsset, Product, SiteAiApp } from "@/lib/types";

type DesignResourceKind = "products" | "siteAiApps" | "creativePacks" | "mediaAssets";

type DesignResourcesPayload = {
  ok: true;
  kind: DesignResourceKind;
  products?: Product[];
  siteAiApps?: SiteAiApp[];
  creativePacks?: CreativePack[];
  mediaAssets?: MediaAsset[];
};

const designResourcesCache = createServerTtlCache("admin-design-resources", Number(process.env.SITE_ADMIN_DESIGN_RESOURCES_CACHE_TTL_MS ?? 15_000));

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const adminProductListTake = envInt("SITE_ADMIN_PRODUCT_LIST_TAKE", 100);
const adminPackListTake = envInt("SITE_ADMIN_PACK_LIST_TAKE", 100);
const adminMediaListTake = envInt("SITE_ADMIN_MEDIA_LIST_TAKE", 100);
const adminAiAppListTake = envInt("SITE_ADMIN_AI_APP_LIST_TAKE", 100);
const adminPriceListTake = envInt("SITE_ADMIN_PRICE_LIST_TAKE", 100);

function resourceKind(request: Request): DesignResourceKind | undefined {
  const kind = new URL(request.url).searchParams.get("kind");
  return kind === "products" || kind === "siteAiApps" || kind === "creativePacks" || kind === "mediaAssets" ? kind : undefined;
}

async function loadResource(siteId: string, kind: DesignResourceKind): Promise<DesignResourcesPayload> {
  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    const state = readPlatformState();
    if (!state.sites.some((site) => site.id === siteId)) throw new Error("site_not_found");
    if (kind === "products") return { ok: true, kind, products: getSiteProductsFromState(state, siteId).slice(0, adminProductListTake) };
    if (kind === "siteAiApps") return { ok: true, kind, siteAiApps: getSiteAppsFromState(state, siteId).slice(0, adminAiAppListTake) };
    if (kind === "creativePacks") return { ok: true, kind, creativePacks: getSiteCreativePacksFromState(state, siteId).slice(0, adminPackListTake) };
    return { ok: true, kind, mediaAssets: getSiteMediaAssetsFromState(state, siteId).slice(0, adminMediaListTake) };
  }

  if (kind === "products") {
    const rows = await prisma.product.findMany({
      where: { siteId },
      include: { prices: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: adminPriceListTake } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: adminProductListTake
    });
    return { ok: true, kind, products: rows.map(mapProduct) };
  }

  if (kind === "siteAiApps") {
    const rows = await prisma.siteAiApp.findMany({
      where: { siteId },
      include: { aiApp: true },
      orderBy: [{ enabled: "desc" }, { routeKey: "asc" }],
      take: adminAiAppListTake
    });
    return { ok: true, kind, siteAiApps: rows.map(toSiteAiApp) };
  }

  if (kind === "creativePacks") {
    const rows = await prisma.creativePack.findMany({
      where: { siteId },
      include: { categoryRecord: { include: { parent: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: adminPackListTake
    });
    return { ok: true, kind, creativePacks: rows.map(toCreativePack) };
  }

  const rows = await prisma.mediaAsset.findMany({
    where: { siteId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: adminMediaListTake
  });
  return { ok: true, kind, mediaAssets: rows.map(toMediaAsset) };
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const kind = resourceKind(request);
  const perf = createAdminPerfTracker("admin-design-resources", { siteId, kind: kind ?? "invalid" });

  if (!kind) return adminPerfJson(perf, { error: "invalid_resource_kind" }, { status: 400 });
  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }

  try {
    const payload = await perf.measure("cache", () => designResourcesCache.get(`${siteId}:${kind}`, () => loadResource(siteId, kind)));
    return adminPerfJson(perf, payload);
  } catch (error) {
    if (error instanceof Error && error.message === "site_not_found") {
      return adminPerfJson(perf, { error: "site_not_found" }, { status: 404 });
    }
    throw error;
  }
}
