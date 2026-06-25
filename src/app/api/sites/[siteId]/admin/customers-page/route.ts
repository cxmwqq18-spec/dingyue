import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { runDbTasks } from "@/lib/db-concurrency";
import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import {
  getSiteAlbumsFromState,
  getSiteCreativePacksFromState,
  getSiteCustomerModelsFromState,
  getSiteCustomersFromState,
  readPlatformState,
  toPublicCustomer
} from "@/lib/server-store";
import { toAlbumRelational, toAssetUploadRelational, toCreativePack, toCustomerModelRelational, toPublicCustomerRelational, toSiteAdmin } from "@/lib/stores/prisma-mappers";

const customersPageCache = createServerTtlCache("site-admin-customers-page", Number(process.env.SITE_ADMIN_CUSTOMERS_PAGE_CACHE_TTL_MS ?? 15_000));

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const adminCustomerAssetTake = envInt("SITE_ADMIN_CUSTOMER_ASSET_TAKE", 80);
const adminCustomerListTake = envInt("SITE_ADMIN_CUSTOMER_LIST_TAKE", 50);
const adminPackListTake = envInt("SITE_ADMIN_PACK_LIST_TAKE", 100);
const adminSiteAdminListTake = envInt("SITE_ADMIN_SITE_ADMIN_LIST_TAKE", 50);
const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 4);

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    const state = readPlatformState();
    const customerAssets = state.assetUploads.filter((asset) => asset.siteId === siteId && !asset.deletedAt).slice(0, adminCustomerAssetTake);
    return NextResponse.json({
      ok: true,
      customers: getSiteCustomersFromState(state, siteId).map(toPublicCustomer),
      customerModels: getSiteCustomerModelsFromState(state, siteId),
      albums: getSiteAlbumsFromState(state, siteId),
      packs: getSiteCreativePacksFromState(state, siteId).slice(0, adminPackListTake),
      customerAssets,
      siteAdmins: state.siteAdmins.filter((admin) => admin.siteId === siteId).slice(0, adminSiteAdminListTake),
      signupCreditGrant: state.sites.find((site) => site.id === siteId)?.signupCreditGrant ?? 0
    });
  }

  const payload = await customersPageCache.get(siteId, async () => {
    const [site, customers, customerModels, albums, packs, customerAssets, siteAdmins] = await runDbTasks([
      () => prisma.site.findUnique({ where: { id: siteId }, select: { id: true, signupCreditGrant: true } }),
      () => prisma.customer.findMany({
        where: { siteId },
        select: {
          id: true,
          siteId: true,
          email: true,
          name: true,
          status: true,
          balance: { select: { balance: true, reserved: true } }
        },
        orderBy: [{ createdAt: "asc" }, { email: "asc" }],
        take: adminCustomerListTake
      }),
      () => prisma.customerModel.findMany({
        where: { siteId },
        select: {
          id: true,
          siteId: true,
          customerId: true,
          label: true,
          modelType: true,
          status: true,
          inputAssetCount: true,
          minInputAssets: true,
          providerModelId: true,
          trainingJobId: true,
          failureReason: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: adminCustomerListTake
      }),
      () => prisma.album.findMany({
        where: { siteId },
        select: {
          id: true,
          siteId: true,
          customerId: true,
          title: true,
          sourceJobId: true,
          creativePackId: true,
          status: true,
          outputCount: true,
          coverAssetId: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: adminCustomerListTake
      }),
      () => prisma.creativePack.findMany({
        where: { siteId },
        select: {
          id: true,
          siteId: true,
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
          createdAt: true
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        take: adminPackListTake
      }),
      () => prisma.assetUpload.findMany({
        where: { siteId, deletedAt: null },
        select: {
          id: true,
          siteId: true,
          customerId: true,
          customerModelId: true,
          subjectRole: true,
          jobId: true,
          label: true,
          storageKey: true,
          mimeType: true,
          role: true,
          visibility: true,
          reviewStatus: true,
          validationStatus: true,
          validationReport: true,
          createdAt: true,
          deletedAt: true
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: adminCustomerAssetTake
      }),
      () => prisma.siteAdmin.findMany({
        where: { siteId },
        select: { id: true, siteId: true, email: true, displayName: true, role: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { email: "asc" }],
        take: adminSiteAdminListTake
      })
    ], siteAdminReadConcurrency);

    if (!site) return undefined;
    return {
      ok: true,
      customers: customers.map((customer) => toPublicCustomerRelational(customer as unknown as Record<string, unknown>)),
      customerModels: customerModels.map((model) => toCustomerModelRelational(model as unknown as Record<string, unknown>)),
      albums: albums.map((album) => toAlbumRelational(album as unknown as Record<string, unknown>)),
      packs: packs.map(toCreativePack),
      customerAssets: customerAssets.map((asset) => toAssetUploadRelational(asset as unknown as Record<string, unknown>)),
      siteAdmins: siteAdmins.map(toSiteAdmin),
      signupCreditGrant: site.signupCreditGrant
    };
  });

  if (!payload) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
