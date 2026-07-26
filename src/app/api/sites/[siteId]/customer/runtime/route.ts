import { NextResponse } from "next/server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { getCustomerAdminAccessForSite } from "@/lib/customer-admin-access";
import { ensureCustomerCsrfCookie } from "@/lib/customer-csrf";
import { isTransientPrismaConnectionError, prisma, runPrismaReadWithReconnect } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import { getThemeRuntimeForCustomer } from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";
import { readStorefrontCustomerRuntimeStateForSiteFromDatabase } from "@/lib/storefront-state";
import { releaseStaleActiveGenerationJobsRelational } from "@/lib/stores/job-store";
import { toAssetUploadRelational, toCustomerModelRelational, toCustomerSessionRelational, toPublicCustomerRelational } from "@/lib/stores/prisma-mappers";
import { toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { readWorkspaceJobSummariesRelational, WORKSPACE_RELATED_JOB_SUMMARY_LIMIT } from "@/lib/workspace-runtime-jobs";
import { cookies } from "next/headers";
import type { CustomerAdminAccess, CustomerSession, PublicCustomer, ThemeRuntimeData } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const customerRuntimeCache = createServerTtlCache(
  "customer-runtime-api",
  Number(process.env.STOREFRONT_CUSTOMER_RUNTIME_API_TTL_MS ?? 30_000)
);
const staleActiveJobReleaseCache = createServerTtlCache(
  "customer-runtime-stale-active-release",
  Number(process.env.STOREFRONT_CUSTOMER_RUNTIME_STALE_RELEASE_TTL_MS ?? 30_000)
);
const workspaceDirectSqlEnabled = process.env.CUSTOMER_WORKSPACE_RUNTIME_DIRECT_SQL === "1";
const staleActiveJobReleaseWaitMs = Math.max(0, Number(process.env.STOREFRONT_CUSTOMER_RUNTIME_STALE_RELEASE_WAIT_MS ?? 150));

function emptyRuntime(): ThemeRuntimeData {
  return {
    jobs: [],
    assets: [],
    albums: [],
    ledger: [],
    subscriptions: [],
    orders: [],
    customerModels: []
  };
}

type CustomerRuntimeSection = "summary" | "plan" | "orders" | "jobs" | "albums" | "credits";
type RuntimeSubscription = NonNullable<ThemeRuntimeData["subscriptions"]>[number];
type RuntimeOrder = NonNullable<ThemeRuntimeData["orders"]>[number];
type RuntimeJob = ThemeRuntimeData["jobs"][number];
type RuntimeAlbum = ThemeRuntimeData["albums"][number];
type RuntimeLedgerEntry = ThemeRuntimeData["ledger"][number];
type AccountCurrentCustomer = { customer: PublicCustomer; session: CustomerSession; sessionId: string };
type WorkspaceRuntimeQueryRow = {
  customer: unknown;
  jobs: unknown;
  assets: unknown;
  subscriptions: unknown;
  customerModels: unknown;
};

function objectFromJson(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function rowsFromJson(value: unknown): Record<string, unknown>[] {
  const parsed = typeof value === "string"
    ? (() => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return undefined;
        }
      })()
    : value;
  return Array.isArray(parsed)
    ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function numberFromRaw(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isoFromRaw(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return new Date(0).toISOString();
}

function timeFromRaw(value: unknown): number {
  return new Date(isoFromRaw(value)).getTime();
}

function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringArrayFromRaw(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function runtimeJobFrameAssetIds(job: Pick<RuntimeJob, "requestJson">): string[] {
  const request = jsonRecord(job.requestJson) ?? {};
  const fields = jsonRecord(request.fields) ?? {};
  return Array.from(new Set([
    ...stringArrayFromRaw(fields.frameAssetIds),
    ...stringArrayFromRaw(request.assetIds)
  ]));
}

function publicCustomerFromWorkspaceRow(row: Record<string, unknown>): PublicCustomer {
  const status = row.status === "past_due" || row.status === "blocked" ? row.status : "active";
  return {
    id: String(row.id),
    siteId: String(row.siteId),
    email: String(row.email),
    name: String(row.name),
    status,
    balance: {
      available: numberFromRaw(row.balanceAvailable),
      reserved: numberFromRaw(row.balanceReserved)
    }
  };
}

function runtimeJobFromWorkspaceRow(job: Record<string, unknown>): RuntimeJob {
  return {
    id: String(job.id),
    aiAppId: String(job.aiAppId),
    status: String(job.status) as RuntimeJob["status"],
    creditsReserved: numberFromRaw(job.creditsReserved),
    createdAt: isoFromRaw(job.createdAt),
    updatedAt: isoFromRaw(job.updatedAt),
    requestJson: jsonRecord(job.requestJson),
    resultJson: jsonRecord(job.resultJson)
  };
}

function runtimeSubscriptionFromWorkspaceRow(subscription: Record<string, unknown>): RuntimeSubscription {
  return {
    id: String(subscription.id),
    productId: String(subscription.productId),
    priceId: String(subscription.priceId),
    status: String(subscription.status) as RuntimeSubscription["status"],
    currentPeriodEnd: isoFromRaw(subscription.currentPeriodEnd),
    creditsPerCycle: numberFromRaw(subscription.creditsPerCycle),
    createdAt: isoFromRaw(subscription.createdAt)
  };
}

async function readWorkspaceRuntimeDirect(siteId: string, sessionId: string): Promise<{ customer: PublicCustomer; runtime: ThemeRuntimeData } | undefined> {
  const [row] = await prisma.$queryRaw<WorkspaceRuntimeQueryRow[]>`
    WITH "currentCustomer" AS (
      SELECT
        c.id,
        c."siteId",
        c.email,
        c.name,
        c.status,
        COALESCE(b.balance, 0) AS "balanceAvailable",
        COALESCE(b.reserved, 0) AS "balanceReserved"
      FROM "CustomerSession" s
      JOIN "Customer" c
        ON c.id = s."customerId"
        AND c."siteId" = s."siteId"
      LEFT JOIN "CreditBalance" b
        ON b."siteId" = c."siteId"
        AND b."customerId" = c.id
      WHERE s.id = ${sessionId}
        AND s."siteId" = ${siteId}
        AND s."expiresAt" > (NOW() AT TIME ZONE 'UTC')
      LIMIT 1
    ),
    "recentJobs" AS (
      SELECT j.*
      FROM "GenerationJob" j
      JOIN "currentCustomer" cc
        ON cc.id = j."customerId"
        AND cc."siteId" = j."siteId"
      ORDER BY j."updatedAt" DESC
      LIMIT 8
    ),
    "workspaceAssets" AS (
      SELECT *
      FROM (
        (
          SELECT a.*
          FROM "AssetUpload" a
          JOIN "currentCustomer" cc
            ON cc.id = a."customerId"
            AND cc."siteId" = a."siteId"
          WHERE a."role" IN ('input', 'training_input', 'output')
            AND a."deletedAt" IS NULL
          ORDER BY a."createdAt" DESC
          LIMIT 48
        )
        UNION
        (
          SELECT a.*
          FROM "AssetUpload" a
          JOIN "currentCustomer" cc
            ON cc.id = a."customerId"
            AND cc."siteId" = a."siteId"
          WHERE a."role" = 'output'
            AND a."deletedAt" IS NULL
            AND (
              a."validationReport"->>'isFavorite' = 'true'
              OR NULLIF(a."validationReport"->>'favoriteAt', '') IS NOT NULL
            )
        )
      ) AS assets
    ),
    "relatedJobs" AS (
      SELECT j.*
      FROM "GenerationJob" j
      JOIN "currentCustomer" cc
        ON cc.id = j."customerId"
        AND cc."siteId" = j."siteId"
      WHERE j.id IN (
        SELECT DISTINCT "jobId"
        FROM "workspaceAssets"
        WHERE "jobId" IS NOT NULL
      )
        AND j.id NOT IN (SELECT id FROM "recentJobs")
      ORDER BY j."updatedAt" DESC
      LIMIT ${WORKSPACE_RELATED_JOB_SUMMARY_LIMIT}
    ),
    "workspaceJobs" AS (
      SELECT * FROM "recentJobs"
      UNION
      SELECT * FROM "relatedJobs"
    )
    SELECT
      json_build_object(
        'id', cc.id,
        'siteId', cc."siteId",
        'email', cc.email,
        'name', cc.name,
        'status', cc.status,
        'balanceAvailable', cc."balanceAvailable",
        'balanceReserved', cc."balanceReserved"
      ) AS customer,
      COALESCE((
        SELECT json_agg(row_to_json(j) ORDER BY j."updatedAt" DESC)
        FROM "workspaceJobs" j
      ), '[]'::json) AS jobs,
      COALESCE((
        SELECT json_agg(row_to_json(a) ORDER BY a."createdAt" DESC)
        FROM "workspaceAssets" a
      ), '[]'::json) AS assets,
      COALESCE((
        SELECT json_agg(row_to_json(s) ORDER BY s."createdAt" DESC)
        FROM (
          SELECT s.*
          FROM "Subscription" s
          JOIN "currentCustomer" subscription_customer
            ON subscription_customer.id = s."customerId"
            AND subscription_customer."siteId" = s."siteId"
          ORDER BY s."createdAt" DESC
          LIMIT 4
        ) s
      ), '[]'::json) AS subscriptions,
      COALESCE((
        SELECT json_agg(row_to_json(m) ORDER BY m."updatedAt" DESC)
        FROM (
          SELECT m.*
          FROM "CustomerModel" m
          JOIN "currentCustomer" model_customer
            ON model_customer.id = m."customerId"
            AND model_customer."siteId" = m."siteId"
          ORDER BY m."updatedAt" DESC
          LIMIT 4
        ) m
      ), '[]'::json) AS "customerModels"
    FROM "currentCustomer" cc
  `;
  const customerRow = objectFromJson(row?.customer);
  if (!customerRow) return undefined;
  const customer = publicCustomerFromWorkspaceRow(customerRow);
  const jobs = rowsFromJson(row?.jobs);
  const assets = rowsFromJson(row?.assets)
    .map((asset) => toAssetUploadRelational(asset));
  const subscriptions = rowsFromJson(row?.subscriptions);
  const customerModels = rowsFromJson(row?.customerModels);
  return {
    customer,
    runtime: {
      ...emptyRuntime(),
      customer,
      jobs: jobs.map(runtimeJobFromWorkspaceRow),
      assets: assets.map((asset) => toThemeRuntimeAssetRelational(asset)),
      subscriptions: subscriptions.map(runtimeSubscriptionFromWorkspaceRow),
      customerModels: customerModels.map((model) => {
        const mapped = toCustomerModelRelational(model);
        return {
          id: mapped.id,
          label: mapped.label,
          modelType: mapped.modelType,
          status: mapped.status,
          inputAssetCount: mapped.inputAssetCount,
          minInputAssets: mapped.minInputAssets,
          createdAt: mapped.createdAt,
          updatedAt: mapped.updatedAt
        };
      })
    }
  };
}

async function readWorkspaceRuntimeSegmented(
  siteId: string,
  sessionId: string,
  current?: AccountCurrentCustomer
): Promise<{ customer: PublicCustomer; runtime: ThemeRuntimeData } | undefined> {
  const customer = current?.sessionId === sessionId && current.customer.siteId === siteId
    ? current.customer
    : undefined;
  const resolvedCustomer = customer ?? await (async () => {
    const session = await prisma.customerSession.findFirst({
      where: {
        id: sessionId,
        siteId,
        expiresAt: { gt: new Date() }
      },
      include: {
        customer: { include: { balance: true } }
      }
    });
    return session?.customer ? toPublicCustomerRelational(session.customer as Record<string, unknown>) : undefined;
  })();
  if (!resolvedCustomer) return undefined;

  const [recentJobs, recentAssets, subscriptions, customerModels] = await Promise.all([
    readWorkspaceJobSummariesRelational({ siteId, customerId: resolvedCustomer.id, take: 8 }),
    prisma.assetUpload.findMany({
      where: {
        siteId,
        customerId: resolvedCustomer.id,
        deletedAt: null,
        role: { in: ["input", "training_input", "output"] }
      },
      orderBy: { createdAt: "desc" },
      take: 48
    }),
    prisma.subscription.findMany({
      where: { siteId, customerId: resolvedCustomer.id },
      orderBy: { createdAt: "desc" },
      take: 4
    }),
    prisma.customerModel.findMany({
      where: { siteId, customerId: resolvedCustomer.id },
      orderBy: { updatedAt: "desc" },
      take: 4
    })
  ]);

  const recentJobIds = new Set(recentJobs.map((job) => job.id));
  const relatedJobIds = Array.from(new Set(
    recentAssets
      .map((asset) => asset.jobId)
      .filter((jobId): jobId is string => typeof jobId === "string" && !recentJobIds.has(jobId))
  )).slice(0, WORKSPACE_RELATED_JOB_SUMMARY_LIMIT);
  const relatedJobs = relatedJobIds.length
    ? await readWorkspaceJobSummariesRelational({ siteId, customerId: resolvedCustomer.id, ids: relatedJobIds, includeJson: false })
    : [];
  const jobs = [...recentJobs, ...relatedJobs]
    .sort((left, right) => timeFromRaw(right.updatedAt) - timeFromRaw(left.updatedAt));
  const recentAssetIds = new Set(recentAssets.map((asset) => asset.id));
  const referencedFrameAssetIds = Array.from(new Set(jobs.flatMap(runtimeJobFrameAssetIds)))
    .filter((assetId) => !recentAssetIds.has(assetId));
  const referencedFrameAssets = referencedFrameAssetIds.length
    ? await prisma.assetUpload.findMany({
        where: {
          siteId,
          customerId: resolvedCustomer.id,
          id: { in: referencedFrameAssetIds },
          deletedAt: null
        },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const assets = [...recentAssets, ...referencedFrameAssets]
    .map((asset) => toAssetUploadRelational(asset as unknown as Record<string, unknown>))
    .map((asset) => toThemeRuntimeAssetRelational(asset));

  return {
    customer: resolvedCustomer,
    runtime: {
      ...emptyRuntime(),
      customer: resolvedCustomer,
      jobs,
      assets,
      subscriptions: subscriptions.map((subscription) => runtimeSubscriptionFromWorkspaceRow(subscription as unknown as Record<string, unknown>)),
      customerModels: customerModels.map((model) => {
        const mapped = toCustomerModelRelational(model as unknown as Record<string, unknown>);
        return {
          id: mapped.id,
          label: mapped.label,
          modelType: mapped.modelType,
          status: mapped.status,
          inputAssetCount: mapped.inputAssetCount,
          minInputAssets: mapped.minInputAssets,
          createdAt: mapped.createdAt,
          updatedAt: mapped.updatedAt
        };
      })
    }
  };
}

async function readWorkspaceRuntime(
  siteId: string,
  sessionId: string,
  current?: AccountCurrentCustomer
): Promise<{ customer: PublicCustomer; runtime: ThemeRuntimeData } | undefined> {
  if (!workspaceDirectSqlEnabled) {
    return runPrismaReadWithReconnect(
      () => readWorkspaceRuntimeSegmented(siteId, sessionId, current),
      { label: "customer workspace runtime segmented", retries: 2, timeoutMs: 20_000 }
    );
  }
  try {
    return await runPrismaReadWithReconnect(
      () => readWorkspaceRuntimeDirect(siteId, sessionId),
      { label: "customer workspace runtime direct", retries: 1, timeoutMs: 30_000 }
    );
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) throw error;
    console.warn("[customer-runtime] workspace direct read unavailable; retrying with segmented relational read.");
    return runPrismaReadWithReconnect(
      () => readWorkspaceRuntimeSegmented(siteId, sessionId, current),
      { label: "customer workspace runtime segmented", retries: 1, timeoutMs: 20_000 }
    );
  }
}

function shortRuntimeError(error: unknown): string {
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

async function releaseStaleActiveJobsForRuntimeRefresh(params: { siteId: string; customerId: string }): Promise<void> {
  const release = staleActiveJobReleaseCache
    .get(`${params.siteId}:${params.customerId}`, () => releaseStaleActiveGenerationJobsRelational(params))
    .catch((error) => {
      console.error("customer_runtime_stale_job_release_failed", error);
    });
  if (staleActiveJobReleaseWaitMs <= 0) {
    void release;
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    release,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, staleActiveJobReleaseWaitMs);
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function getCurrentCustomerForRuntimeRefresh(siteId: string): Promise<NonNullable<Awaited<ReturnType<typeof getCurrentCustomerForSite>>> | undefined> {
  try {
    return await getCurrentCustomerForSite(siteId);
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) throw error;
    console.warn("[customer-runtime] current customer refresh lookup skipped after transient DB error:", shortRuntimeError(error));
    return undefined;
  }
}

async function getSafeCustomerAdminAccess(params: { siteId: string; customer: PublicCustomer }): Promise<CustomerAdminAccess> {
  try {
    return await getCustomerAdminAccessForSite(params);
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) throw error;
    console.warn("[customer-runtime] admin access lookup skipped after transient DB error:", shortRuntimeError(error));
    return { canBypassBilling: false };
  }
}

function normalizeSection(value: string | null): CustomerRuntimeSection {
  if (value === "plan" || value === "orders" || value === "jobs" || value === "albums" || value === "credits") return value;
  return "summary";
}

function sectionRuntime(runtime: ThemeRuntimeData, section: CustomerRuntimeSection): ThemeRuntimeData {
  const base = emptyRuntime();
  if (section === "plan") {
    return {
      ...base,
      customer: runtime.customer,
      subscriptions: runtime.subscriptions ?? []
    };
  }
  if (section === "orders") {
    return {
      ...base,
      orders: runtime.orders ?? [],
      jobs: runtime.jobs ?? []
    };
  }
  if (section === "jobs") {
    return {
      ...base,
      jobs: runtime.jobs ?? [],
      assets: runtime.assets ?? [],
      albums: runtime.albums ?? []
    };
  }
  if (section === "albums") {
    return {
      ...base,
      albums: runtime.albums ?? [],
      assets: runtime.assets ?? [],
      ledger: runtime.ledger ?? []
    };
  }
  if (section === "credits") {
    return {
      ...base,
      customer: runtime.customer,
      ledger: runtime.ledger ?? []
    };
  }
  return runtime;
}

function trimRuntime(runtime: ThemeRuntimeData, profile: string, section: CustomerRuntimeSection): ThemeRuntimeData {
  if (profile === "workspace") {
    return {
      ...runtime,
      jobs: (runtime.jobs ?? []).slice(0, 8),
      assets: (runtime.assets ?? []).slice(0, 96),
      albums: (runtime.albums ?? []).slice(0, 8),
      ledger: (runtime.ledger ?? []).slice(0, 12),
      subscriptions: (runtime.subscriptions ?? []).slice(0, 4),
      orders: (runtime.orders ?? []).slice(0, 6),
      customerModels: (runtime.customerModels ?? []).slice(0, 4)
    };
  }
  const trimmed = {
    ...runtime,
    jobs: (runtime.jobs ?? []).slice(0, 12),
    assets: (runtime.assets ?? []).slice(0, 24),
    albums: (runtime.albums ?? []).slice(0, 12),
    ledger: (runtime.ledger ?? []).slice(0, 16),
    subscriptions: (runtime.subscriptions ?? []).slice(0, 6),
    orders: (runtime.orders ?? []).slice(0, 12),
    customerModels: (runtime.customerModels ?? []).slice(0, 8)
  };
  return profile === "account" ? sectionRuntime(trimmed, section) : trimmed;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

async function readAccountSectionRuntime({
  customer,
  section,
  siteId
}: {
  customer: NonNullable<Awaited<ReturnType<typeof getCurrentCustomerForSite>>>["customer"];
  section: CustomerRuntimeSection;
  siteId: string;
}): Promise<ThemeRuntimeData> {
  const base = emptyRuntime();
  if (section === "plan") {
    const subscriptions = await prisma.subscription.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 2
    });
    return {
      ...base,
      customer,
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        productId: subscription.productId,
        priceId: subscription.priceId,
        status: subscription.status as RuntimeSubscription["status"],
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        creditsPerCycle: subscription.creditsPerCycle,
        createdAt: subscription.createdAt.toISOString()
      }))
    };
  }
  if (section === "orders") {
    const orders = await prisma.order.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 12
    });
    return {
      ...base,
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status as RuntimeOrder["status"],
        amountCents: order.amountCents,
        currency: order.currency,
        credits: order.credits,
        sourceId: order.sourceId,
        createdAt: order.createdAt.toISOString()
      }))
    };
  }
  if (section === "jobs") {
    const jobs = await prisma.generationJob.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { updatedAt: "desc" },
      take: 12
    });
    return {
      ...base,
      jobs: jobs.map((job) => ({
        id: job.id,
        aiAppId: job.aiAppId,
        status: job.status as RuntimeJob["status"],
        creditsReserved: job.creditsReserved,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        requestJson: job.requestJson && typeof job.requestJson === "object" && !Array.isArray(job.requestJson)
          ? job.requestJson as Record<string, unknown>
          : undefined
      }))
    };
  }
  if (section === "albums") {
    const [albums, ledger] = await Promise.all([
      prisma.album.findMany({
        where: { siteId, customerId: customer.id },
        orderBy: { updatedAt: "desc" },
        take: 12
      }),
      prisma.creditLedger.findMany({
        where: { siteId, customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 4
      })
    ]);
    return {
      ...base,
      albums: albums.map((album) => ({
        id: album.id,
        title: album.title,
        sourceJobId: album.sourceJobId ?? undefined,
        creativePackId: album.creativePackId ?? undefined,
        status: album.status as RuntimeAlbum["status"],
        outputCount: album.outputCount,
        coverAssetId: album.coverAssetId ?? undefined,
        createdAt: album.createdAt.toISOString(),
        updatedAt: album.updatedAt.toISOString()
      })),
      ledger: ledger.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        type: entry.type as RuntimeLedgerEntry["type"],
        createdAt: entry.createdAt.toISOString()
      }))
    };
  }
  if (section === "credits") {
    const ledger = await prisma.creditLedger.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 16
    });
    return {
      ...base,
      customer,
      ledger: ledger.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        type: entry.type as RuntimeLedgerEntry["type"],
        createdAt: iso(entry.createdAt)
      }))
    };
  }
  return {
    ...base,
    customer
  };
}

function accountSectionInclude(section: CustomerRuntimeSection) {
  const customerBase = {
    balance: true
  };
  if (section === "plan") {
    return {
      customer: {
        include: {
          ...customerBase,
          subscriptions: { orderBy: { createdAt: "desc" as const }, take: 2 }
        }
      }
    };
  }
  if (section === "orders") {
    return {
      customer: {
        include: {
          ...customerBase,
          orders: { orderBy: { createdAt: "desc" as const }, take: 12 }
        }
      }
    };
  }
  if (section === "jobs") {
    return {
      customer: {
        include: {
          ...customerBase,
          jobs: { orderBy: { updatedAt: "desc" as const }, take: 12 }
        }
      }
    };
  }
  if (section === "albums") {
    return {
      customer: {
        include: {
          ...customerBase,
          albums: { orderBy: { updatedAt: "desc" as const }, take: 12 },
          ledger: { orderBy: { createdAt: "desc" as const }, take: 4 }
        }
      }
    };
  }
  if (section === "credits") {
    return {
      customer: {
        include: {
          ...customerBase,
          ledger: { orderBy: { createdAt: "desc" as const }, take: 16 }
        }
      }
    };
  }
  return { customer: { include: customerBase } };
}

async function readAccountSectionRuntimeForSession({
  section,
  sessionId,
  siteId
}: {
  section: CustomerRuntimeSection;
  sessionId: string;
  siteId: string;
}): Promise<{ current: AccountCurrentCustomer; runtime: ThemeRuntimeData } | undefined> {
  const session = await prisma.customerSession.findFirst({
    where: {
      id: sessionId,
      siteId,
      expiresAt: { gt: new Date() }
    },
    include: accountSectionInclude(section)
  });
  if (!session?.customer) return undefined;
  const customer = toPublicCustomerRelational(session.customer as Record<string, unknown>);
  const current = {
    customer,
    session: toCustomerSessionRelational(session as Record<string, unknown>),
    sessionId: session.id
  };
  const base = emptyRuntime();
  const customerRecord = session.customer as {
    albums?: Array<RuntimeAlbum & { createdAt: Date | string; updatedAt: Date | string }>;
    jobs?: Array<RuntimeJob & { createdAt: Date | string; updatedAt: Date | string; requestJson?: unknown }>;
    ledger?: Array<RuntimeLedgerEntry & { createdAt: Date | string }>;
    orders?: Array<RuntimeOrder & { createdAt: Date | string }>;
    subscriptions?: Array<RuntimeSubscription & { createdAt: Date | string; currentPeriodEnd: Date | string }>;
  };

  if (section === "plan") {
    return {
      current,
      runtime: {
        ...base,
        customer,
        subscriptions: (customerRecord.subscriptions ?? []).map((subscription) => ({
          id: subscription.id,
          productId: subscription.productId,
          priceId: subscription.priceId,
          status: subscription.status as RuntimeSubscription["status"],
          currentPeriodEnd: iso(subscription.currentPeriodEnd),
          creditsPerCycle: subscription.creditsPerCycle,
          createdAt: iso(subscription.createdAt)
        }))
      }
    };
  }
  if (section === "orders") {
    return {
      current,
      runtime: {
        ...base,
        orders: (customerRecord.orders ?? []).map((order) => ({
          id: order.id,
          status: order.status as RuntimeOrder["status"],
          amountCents: order.amountCents,
          currency: order.currency,
          credits: order.credits,
          sourceId: order.sourceId,
          createdAt: iso(order.createdAt)
        }))
      }
    };
  }
  if (section === "jobs") {
    return {
      current,
      runtime: {
        ...base,
        jobs: (customerRecord.jobs ?? []).map((job) => ({
          id: job.id,
          aiAppId: job.aiAppId,
          status: job.status as RuntimeJob["status"],
          creditsReserved: job.creditsReserved,
          createdAt: iso(job.createdAt),
          updatedAt: iso(job.updatedAt),
          requestJson: job.requestJson && typeof job.requestJson === "object" && !Array.isArray(job.requestJson)
            ? job.requestJson as Record<string, unknown>
            : undefined,
          resultJson: job.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson)
            ? job.resultJson as Record<string, unknown>
            : undefined
        }))
      }
    };
  }
  if (section === "albums") {
    return {
      current,
      runtime: {
        ...base,
        albums: (customerRecord.albums ?? []).map((album) => ({
          id: album.id,
          title: album.title,
          sourceJobId: album.sourceJobId ?? undefined,
          creativePackId: album.creativePackId ?? undefined,
          status: album.status as RuntimeAlbum["status"],
          outputCount: album.outputCount,
          coverAssetId: album.coverAssetId ?? undefined,
          createdAt: iso(album.createdAt),
          updatedAt: iso(album.updatedAt)
        })),
        ledger: (customerRecord.ledger ?? []).map((entry) => ({
          id: entry.id,
          amount: entry.amount,
          type: entry.type as RuntimeLedgerEntry["type"],
          createdAt: iso(entry.createdAt)
        }))
      }
    };
  }
  if (section === "credits") {
    return {
      current,
      runtime: {
        ...base,
        customer,
        ledger: (customerRecord.ledger ?? []).map((entry) => ({
          id: entry.id,
          amount: entry.amount,
          type: entry.type as RuntimeLedgerEntry["type"],
          createdAt: iso(entry.createdAt)
        }))
      }
    };
  }
  return {
    current,
    runtime: {
      ...base,
      customer
    }
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "customer_login_required", runtime: emptyRuntime() }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const profile = searchParams.get("profile") ?? "account";
  const section = normalizeSection(searchParams.get("section"));
  const refreshToken = searchParams.get("refresh") ?? "";
  const normalizedProfile = profile === "workspace" ? "workspace" : profile === "account" ? "account" : "full";
  const currentForRefresh = normalizedProfile === "workspace" || refreshToken
    ? await getCurrentCustomerForRuntimeRefresh(siteId)
    : undefined;
  if (currentForRefresh) {
    await releaseStaleActiveJobsForRuntimeRefresh({
      siteId,
      customerId: currentForRefresh.customer.id
    });
  }
  let result: { customer: NonNullable<Awaited<ReturnType<typeof getCurrentCustomerForSite>>>["customer"]; runtime: ThemeRuntimeData } | undefined;
  try {
    result = await customerRuntimeCache.get(
      `${siteId}:${sessionId}:${normalizedProfile}:${section}:${refreshToken}`,
      async (): Promise<{ customer: NonNullable<Awaited<ReturnType<typeof getCurrentCustomerForSite>>>["customer"]; runtime: ThemeRuntimeData } | undefined> => {
        if (normalizedProfile === "account") {
          const accountRuntime = await readAccountSectionRuntimeForSession({ section, sessionId, siteId });
          if (!accountRuntime) return undefined;
          return {
            customer: accountRuntime.current.customer,
            runtime: accountRuntime.runtime
          };
        }
        if (normalizedProfile === "workspace") {
          return readWorkspaceRuntime(siteId, sessionId, currentForRefresh);
        }
        const current = await getCurrentCustomerForSite(siteId);
        if (!current) return undefined;
        const state = await readStorefrontCustomerRuntimeStateForSiteFromDatabase({
          siteId,
          sessionId: current.sessionId,
          profile: normalizedProfile
        });
        if (!state) return undefined;
        return {
          customer: current.customer,
          runtime: trimRuntime(getThemeRuntimeForCustomer(state, siteId, current.customer.id), normalizedProfile, section)
        };
      },
      normalizedProfile === "workspace" ? 8_000 : normalizedProfile === "account" ? 30_000 : 12_000
    );
  } catch (error) {
    const transient = isTransientPrismaConnectionError(error);
    console.error("customer_runtime_load_failed", error);
    return NextResponse.json(
      { ok: false, error: transient ? "customer_runtime_db_unavailable" : "customer_runtime_unavailable", runtime: emptyRuntime() },
      { status: transient ? 503 : 500 }
    );
  }
  if (!result) {
    return NextResponse.json({ ok: false, error: "customer_runtime_unavailable", runtime: emptyRuntime() }, { status: 404 });
  }

  const [adminAccess, current] = await Promise.all([
    getSafeCustomerAdminAccess({ siteId, customer: result.customer }),
    currentForRefresh ? Promise.resolve(currentForRefresh) : getCurrentCustomerForRuntimeRefresh(siteId)
  ]);
  const response = NextResponse.json({
    ok: true,
    runtime: {
      ...result.runtime,
      customer: result.customer,
      adminAccess
    }
  }, {
    headers: { "Cache-Control": refreshToken ? "private, no-store" : "private, max-age=20" }
  });
  return current ? ensureCustomerCsrfCookie(response, request, siteId, current) : response;
}
