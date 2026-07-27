import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { customersPageCache } from "@/lib/admin-customers-page-cache";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { runDbTasks } from "@/lib/db-concurrency";
import { prisma } from "@/lib/prisma";
import {
  getSiteAlbumsFromState,
  getSiteCreativePacksFromState,
  getSiteCustomerModelsFromState,
  getSiteCustomersFromState,
  readPlatformState,
  toPublicCustomer
} from "@/lib/server-store";
import { toAlbumRelational, toAssetUploadRelational, toCreativePack, toCustomerModelRelational, toPublicCustomerRelational, toSiteAdmin } from "@/lib/stores/prisma-mappers";
import type { AssetUpload } from "@/lib/types";
import type { JobStatus } from "@/lib/types";

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const adminCustomerAssetTake = envInt("SITE_ADMIN_CUSTOMER_ASSET_TAKE", 80);
const adminCustomerListTake = envInt("SITE_ADMIN_CUSTOMER_LIST_TAKE", 50);
const adminPackListTake = envInt("SITE_ADMIN_PACK_LIST_TAKE", 100);
const adminSiteAdminListTake = envInt("SITE_ADMIN_SITE_ADMIN_LIST_TAKE", 50);
const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 2);

type CustomersPageDetail = "all" | "customers" | "models" | "delivery" | "assets";

function normalizeDetail(value: string | null): CustomersPageDetail {
  if (value === "customers" || value === "models" || value === "delivery" || value === "assets") return value;
  return value === "all" ? "all" : "customers";
}

function includeDetail(detail: CustomersPageDetail, target: CustomersPageDetail): boolean {
  return detail === "all" || detail === target;
}

function includeCustomers(detail: CustomersPageDetail): boolean {
  return detail === "all" || detail === "customers" || detail === "assets";
}

type AdminCustomerAsset = AssetUpload & {
  previewUrl: string;
  downloadUrl: string;
  sourceAssetIds?: string[];
};

type AdminCustomerAssetJob = {
  id: string;
  customerId: string;
  status: JobStatus;
  sourceAssetIds: string[];
  outputStorageKeys: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};
type AdminCustomerAssetJobSummaryRow = {
  id: string;
  customerId: string;
  status: string;
  requestJson: unknown;
  resultJson: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function adminCustomerAssetUrl(asset: Pick<AssetUpload, "storageKey">): string {
  const storageKey = asset.storageKey.replace(/^customer-assets\//, "").replace(/^\/+/, "");
  if (!storageKey || storageKey.includes("..") || storageKey.includes("\\")) return "";
  return `/api/local-assets/${storageKey}`;
}

function toAdminCustomerAsset(asset: AssetUpload, sourceAssetIds?: string[]): AdminCustomerAsset {
  return {
    ...asset,
    previewUrl: adminCustomerAssetUrl(asset),
    downloadUrl: `/api/sites/${asset.siteId}/customers/${asset.customerId}/assets/${asset.id}/download`,
    ...(sourceAssetIds?.length ? { sourceAssetIds } : {})
  };
}

function sourceAssetIdsFromRequestJson(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const assetIds = (value as { assetIds?: unknown }).assetIds;
  return Array.isArray(assetIds) ? assetIds.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function outputStorageKeysFromResultJson(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const outputs = (value as { outputs?: unknown }).outputs;
  if (!Array.isArray(outputs)) return [];
  return outputs.flatMap((output) => {
    if (!output || typeof output !== "object" || Array.isArray(output)) return [];
    const storageKey = (output as { storageKey?: unknown }).storageKey;
    return typeof storageKey === "string" && storageKey.length > 0 ? [storageKey] : [];
  });
}

function errorFromResultJson(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const error = (value as { error?: unknown }).error;
  return typeof error === "string" && error.trim().length > 0 ? error : undefined;
}

async function readCustomerAssetJobSummaries(siteId: string, take: number): Promise<AdminCustomerAssetJobSummaryRow[]> {
  return prisma.$queryRaw<AdminCustomerAssetJobSummaryRow[]>`
    SELECT
      id,
      "customerId",
      status,
      jsonb_strip_nulls(jsonb_build_object('assetIds', "requestJson"->'assetIds')) AS "requestJson",
      CASE
        WHEN "resultJson" IS NULL THEN NULL
        ELSE jsonb_strip_nulls(jsonb_build_object(
          'outputs', "resultJson"->'outputs',
          'error', "resultJson"->'error'
        ))
      END AS "resultJson",
      "createdAt",
      "updatedAt"
    FROM "GenerationJob"
    WHERE "siteId" = ${siteId}
    ORDER BY "createdAt" DESC, id ASC
    LIMIT ${take}
  `;
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const detail = normalizeDetail(url.searchParams.get("detail"));
  const perf = createAdminPerfTracker("admin-customers-page", { siteId, detail });
  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }

  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    const state = perf.measureSync("context", () => readPlatformState(), { source: "state" });
    const customerAssets = state.assetUploads.filter((asset) => asset.siteId === siteId && !asset.deletedAt).slice(0, adminCustomerAssetTake);
    return adminPerfJson(perf, {
      ok: true,
      customers: getSiteCustomersFromState(state, siteId).map(toPublicCustomer),
      customerModels: getSiteCustomerModelsFromState(state, siteId),
      albums: getSiteAlbumsFromState(state, siteId),
      packs: getSiteCreativePacksFromState(state, siteId).slice(0, adminPackListTake),
      customerAssets: customerAssets.map((asset) => toAdminCustomerAsset(asset)),
      siteAdmins: state.siteAdmins.filter((admin) => admin.siteId === siteId).slice(0, adminSiteAdminListTake),
      signupCreditGrant: state.sites.find((site) => site.id === siteId)?.signupCreditGrant ?? 0
    });
  }

  const loadPayload = async () => {
    const [site, customers, customerModels, albums, packs, customerAssets, generationJobs, siteAdmins] = await perf.measure("db", () => runDbTasks([
      includeDetail(detail, "customers")
        ? () => prisma.site.findUnique({ where: { id: siteId }, select: { id: true, signupCreditGrant: true } })
        : () => Promise.resolve({ id: siteId, signupCreditGrant: 0 }),
      includeCustomers(detail)
        ? () => prisma.customer.findMany({
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
      })
        : () => Promise.resolve([]),
      includeDetail(detail, "models") || includeDetail(detail, "assets")
        ? () => prisma.customerModel.findMany({
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
      })
        : () => Promise.resolve([]),
      includeDetail(detail, "delivery")
        ? () => prisma.album.findMany({
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
      })
        : () => Promise.resolve([]),
      includeDetail(detail, "delivery")
        ? () => prisma.creativePack.findMany({
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
      })
        : () => Promise.resolve([]),
      includeDetail(detail, "delivery") || includeDetail(detail, "assets")
        ? () => prisma.assetUpload.findMany({
        where: {
          siteId,
          deletedAt: null,
          ...(detail === "delivery" ? { role: "output" } : {})
        },
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
      })
        : () => Promise.resolve([]),
      includeDetail(detail, "assets")
        ? () => readCustomerAssetJobSummaries(siteId, adminCustomerAssetTake)
        : () => Promise.resolve([]),
      includeDetail(detail, "customers")
        ? () => prisma.siteAdmin.findMany({
        where: { siteId },
        select: { id: true, siteId: true, email: true, displayName: true, role: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { email: "asc" }],
        take: adminSiteAdminListTake
      })
        : () => Promise.resolve([])
    ], siteAdminReadConcurrency));

    if (!site) return undefined;
    const sourceAssetIdsByJobId = new Map(
      generationJobs.map((job) => [String(job.id), sourceAssetIdsFromRequestJson(job.requestJson)])
    );
    const customerAssetJobs: AdminCustomerAssetJob[] = generationJobs
      .map((job) => ({
        id: String(job.id),
        customerId: String(job.customerId),
        status: job.status as JobStatus,
        sourceAssetIds: sourceAssetIdsFromRequestJson(job.requestJson),
        outputStorageKeys: outputStorageKeysFromResultJson(job.resultJson),
        error: errorFromResultJson(job.resultJson),
        createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : String(job.createdAt),
        updatedAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : String(job.updatedAt)
      }))
      .filter((job) => job.sourceAssetIds.length > 0 || job.outputStorageKeys.length > 0);
    return {
      ok: true,
      ...(includeCustomers(detail) ? { customers: customers.map((customer) => toPublicCustomerRelational(customer as unknown as Record<string, unknown>)) } : {}),
      ...(includeDetail(detail, "models") || includeDetail(detail, "assets") ? { customerModels: customerModels.map((model) => toCustomerModelRelational(model as unknown as Record<string, unknown>)) } : {}),
      ...(includeDetail(detail, "delivery") ? { albums: albums.map((album) => toAlbumRelational(album as unknown as Record<string, unknown>)) } : {}),
      ...(includeDetail(detail, "delivery") ? { packs: packs.map(toCreativePack) } : {}),
      ...(includeDetail(detail, "delivery") || includeDetail(detail, "assets") ? {
        customerAssets: customerAssets.map((asset) => {
          const mapped = toAssetUploadRelational(asset as unknown as Record<string, unknown>);
          return toAdminCustomerAsset(mapped, mapped.jobId ? sourceAssetIdsByJobId.get(mapped.jobId) : undefined);
        }),
        customerAssetJobs
      } : {}),
      ...(includeDetail(detail, "customers") ? { siteAdmins: siteAdmins.map(toSiteAdmin) } : {}),
      signupCreditGrant: site.signupCreditGrant
    };
  };

  const shouldBypassCache = includeDetail(detail, "assets") || includeDetail(detail, "delivery");
  const payload = shouldBypassCache
    ? await perf.measure("db-live", loadPayload)
    : await perf.measure("cache", () => customersPageCache.get(`${siteId}:${detail}`, loadPayload));

  if (!payload) {
    return adminPerfJson(perf, { error: "site_not_found" }, { status: 404 });
  }

  return adminPerfJson(perf, payload);
}
