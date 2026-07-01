import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { runDbTasks } from "@/lib/db-concurrency";
import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import {
  getSiteAppsFromState,
  getSiteCustomersFromState,
  getSiteGatewayGroupsFromState,
  getSiteJobsFromState,
  readPlatformState
} from "@/lib/server-store";
import { aiProviderStatus } from "@/lib/ai-provider-config";
import { mapAiApp, toPlatformAiProvider, toSiteAiApp, toToolCategory, toToolMenuItem } from "@/lib/stores/prisma-mappers";
import { ensureDefaultToolMenuTaxonomy, isMissingToolMenuTableError } from "@/lib/tool-menu-taxonomy";
import type { GenerationJob, PlatformAiProvider, PlatformState } from "@/lib/types";

const aiPageCache = createServerTtlCache("site-admin-ai-page", Number(process.env.SITE_ADMIN_AI_PAGE_CACHE_TTL_MS ?? 15_000));

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const adminListTake = envInt("SITE_ADMIN_LIST_TAKE", 50);
const adminActivityTake = envInt("SITE_ADMIN_ACTIVITY_TAKE", 80);
const adminAiAppListTake = envInt("SITE_ADMIN_AI_APP_LIST_TAKE", 100);
const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 2);

type JobCountRow = { status: string; _count?: true | { _all?: number } };

function boundedTake(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function summarizeJobs(jobs: GenerationJob[]) {
  let failedJobs = 0;
  let openJobs = 0;
  let completedJobs = 0;
  for (const job of jobs) {
    if (job.status === "failed" || job.status === "refunded") failedJobs += 1;
    if (job.status === "running" || job.status === "queued") openJobs += 1;
    if (job.status === "succeeded") completedJobs += 1;
  }
  return { failedJobs, openJobs, completedJobs, jobCount: jobs.length };
}

function mapJobListItemForAdmin(row: {
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
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    aiAppId: row.aiAppId,
    status: row.status as GenerationJob["status"],
    creditsReserved: row.creditsReserved,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    requestJson: {}
  };
}

function countGroupedJobs(row: JobCountRow): number {
  return typeof row._count === "object" ? row._count._all ?? 0 : 0;
}

function publicAiProvider(provider: PlatformAiProvider) {
  const status = aiProviderStatus(provider);
  return {
    id: provider.id,
    label: provider.label,
    aiUrl: provider.aiUrl,
    modelType: provider.modelType,
    priority: provider.priority,
    preferred: provider.preferred,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
    updatedBy: provider.updatedBy,
    status: {
      configured: status.configured,
      aiUrlConfigured: status.aiUrlConfigured,
      apiKeyConfigured: status.apiKeyConfigured,
      label: status.label,
      aiUrl: status.aiUrl,
      modelType: status.modelType
    }
  };
}

async function readToolCategories(siteId: string) {
  try {
    return await prisma.toolCategory.findMany({
      where: { siteId },
      include: { parent: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
    });
  } catch (error) {
    if (isMissingToolMenuTableError(error)) return [];
    throw error;
  }
}

async function readToolMenuItems(siteId: string) {
  try {
    return await prisma.toolMenuItem.findMany({
      where: { siteId },
      include: { category: { include: { parent: true } } },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { title: "asc" }]
    });
  } catch (error) {
    if (isMissingToolMenuTableError(error)) return [];
    throw error;
  }
}

function legacyPayload(state: PlatformState, siteId: string) {
  const jobs = getSiteJobsFromState(state, siteId).slice(0, Math.min(adminListTake, adminActivityTake));
  const customers = getSiteCustomersFromState(state, siteId).map((customer) => ({
    id: customer.id,
    email: customer.email,
    name: customer.name,
    status: customer.status
  }));
  return {
    ok: true,
    apps: getSiteAppsFromState(state, siteId).slice(0, adminAiAppListTake),
    toolCategories: state.toolCategories.filter((item) => item.siteId === siteId),
    toolMenuItems: state.toolMenuItems.filter((item) => item.siteId === siteId),
    jobs,
    customers,
    platformAiApps: state.aiApps.slice(0, adminAiAppListTake),
    platformAiProviders: (state.platformAiProviders ?? []).map(publicAiProvider),
    gateway: getSiteGatewayGroupsFromState(state, siteId)[0],
    ...summarizeJobs(jobs)
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const detail = url.searchParams.get("detail") ?? "summary";
  const jobTake = boundedTake(url.searchParams.get("take"), Math.min(adminListTake, adminActivityTake), Math.min(adminListTake, adminActivityTake));
  const jobCursor = url.searchParams.get("cursor") || undefined;
  const perf = createAdminPerfTracker("admin-ai-page", { siteId, detail });
  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }

  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    const payload = perf.measureSync("context", () => legacyPayload(readPlatformState(), siteId), { source: "state" });
    return adminPerfJson(perf, payload);
  }

  const cacheKey = detail === "summary" ? `summary:${siteId}` : `${detail}:${siteId}:${jobTake}:${jobCursor ?? "first"}`;
  const payload = await perf.measure("cache", () => aiPageCache.get(cacheKey, async () => {
    if (detail === "summary") {
      const [apps, jobCounts, gateway, platformAiProviders] = await perf.measure("db-summary", () => runDbTasks([
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
        }),
        () => (
          prisma.generationJob.groupBy({ by: ["status"], where: { siteId }, _count: { _all: true }, orderBy: { status: "asc" } }) as unknown as Promise<JobCountRow[]>
        ),
        () => prisma.aiGatewayGroup.findFirst({
          where: { siteId },
          select: {
            id: true,
            siteId: true,
            name: true,
            status: true,
            accountPoolMode: true,
            rateLimitPerMinute: true,
            monthlyQuota: true,
            usedQuota: true
          },
          orderBy: [{ status: "asc" }, { name: "asc" }]
        }),
        () => prisma.platformAiProvider.findMany({ orderBy: [{ preferred: "desc" }, { priority: "asc" }] })
      ], siteAdminReadConcurrency));

      const failedJobs = jobCounts
        .filter((row) => row.status === "failed" || row.status === "refunded")
        .reduce((sum, row) => sum + countGroupedJobs(row), 0);
      const openJobs = jobCounts
        .filter((row) => row.status === "running" || row.status === "queued")
        .reduce((sum, row) => sum + countGroupedJobs(row), 0);
      const completedJobs = jobCounts
        .filter((row) => row.status === "succeeded")
        .reduce((sum, row) => sum + countGroupedJobs(row), 0);
      const jobCount = jobCounts.reduce((sum, row) => sum + countGroupedJobs(row), 0);
      return {
        ok: true,
        apps: apps.map(toSiteAiApp),
        toolCategories: [],
        toolMenuItems: [],
        jobs: [],
        customers: [],
        platformAiApps: [],
        platformAiProviders: platformAiProviders.map(toPlatformAiProvider).map(publicAiProvider),
        gateway,
        pageInfo: { nextJobCursor: null },
        jobCount,
        failedJobs,
        openJobs,
        completedJobs
      };
    }

    const [apps, initialToolCategories, initialToolMenuItems, jobCounts, gateway, jobs, customers, platformAiApps, platformAiProviders] = await perf.measure("db", () => runDbTasks([
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
      }),
      () => readToolCategories(siteId),
      () => readToolMenuItems(siteId),
      () => (
        prisma.generationJob.groupBy({ by: ["status"], where: { siteId }, _count: { _all: true }, orderBy: { status: "asc" } }) as unknown as Promise<JobCountRow[]>
      ),
      () => prisma.aiGatewayGroup.findFirst({
        where: { siteId },
        select: {
          id: true,
          siteId: true,
          name: true,
          status: true,
          accountPoolMode: true,
          rateLimitPerMinute: true,
          monthlyQuota: true,
          usedQuota: true
        },
        orderBy: [{ status: "asc" }, { name: "asc" }]
      }),
      detail === "jobs"
        ? () => prisma.generationJob.findMany({
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
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            take: jobTake + 1,
            ...(jobCursor ? { cursor: { id: jobCursor }, skip: 1 } : {})
          })
        : () => Promise.resolve([]),
      detail === "jobs"
        ? () => prisma.customer.findMany({
            where: { siteId },
            select: { id: true, email: true, name: true, status: true },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take: adminListTake
          })
        : () => Promise.resolve([]),
      detail === "jobs"
        ? () => prisma.aiApp.findMany({ orderBy: [{ appType: "asc" }, { name: "asc" }], take: adminAiAppListTake })
        : () => Promise.resolve([]),
      () => prisma.platformAiProvider.findMany({ orderBy: [{ preferred: "desc" }, { priority: "asc" }] })
    ], siteAdminReadConcurrency));

    let toolCategories = initialToolCategories;
    let toolMenuItems = initialToolMenuItems;
    if (toolCategories.length === 0 || toolMenuItems.length === 0) {
      await perf.measure("tool-taxonomy", () => ensureDefaultToolMenuTaxonomy(siteId));
      [toolCategories, toolMenuItems] = await perf.measure("tool-taxonomy-read", () => runDbTasks([
        () => readToolCategories(siteId),
        () => readToolMenuItems(siteId)
      ], 2));
    }

    const visibleJobs = detail === "jobs" ? jobs.slice(0, jobTake) : jobs;
    const mappedJobs = visibleJobs.map(mapJobListItemForAdmin);
    const failedJobs = jobCounts
      .filter((row) => row.status === "failed" || row.status === "refunded")
      .reduce((sum, row) => sum + countGroupedJobs(row), 0);
    const openJobs = jobCounts
      .filter((row) => row.status === "running" || row.status === "queued")
      .reduce((sum, row) => sum + countGroupedJobs(row), 0);
    const completedJobs = jobCounts
      .filter((row) => row.status === "succeeded")
      .reduce((sum, row) => sum + countGroupedJobs(row), 0);
    const jobCount = jobCounts.reduce((sum, row) => sum + countGroupedJobs(row), 0);
    return {
      ok: true,
      apps: apps.map(toSiteAiApp),
      toolCategories: toolCategories.map(toToolCategory),
      toolMenuItems: toolMenuItems.map(toToolMenuItem),
      jobs: mappedJobs,
      customers,
      platformAiApps: platformAiApps.map(mapAiApp),
      platformAiProviders: platformAiProviders.map(toPlatformAiProvider).map(publicAiProvider),
      gateway,
      pageInfo: {
        nextJobCursor: detail === "jobs" && jobs.length > jobTake ? jobs[jobTake]?.id ?? null : null
      },
      jobCount,
      failedJobs,
      openJobs,
      completedJobs
    };
  }));

  if (!payload) {
    return adminPerfJson(perf, { error: "site_admin_data_unavailable" }, { status: 503 });
  }

  return adminPerfJson(perf, payload);
}
