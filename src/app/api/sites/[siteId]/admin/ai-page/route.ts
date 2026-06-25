import { NextResponse } from "next/server";
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
import { mapAiApp, toSiteAiApp } from "@/lib/stores/prisma-mappers";
import type { GenerationJob, PlatformState } from "@/lib/types";

const aiPageCache = createServerTtlCache("site-admin-ai-page", Number(process.env.SITE_ADMIN_AI_PAGE_CACHE_TTL_MS ?? 15_000));

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const adminListTake = envInt("SITE_ADMIN_LIST_TAKE", 50);
const adminActivityTake = envInt("SITE_ADMIN_ACTIVITY_TAKE", 80);
const adminAiAppListTake = envInt("SITE_ADMIN_AI_APP_LIST_TAKE", 100);
const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 4);

type JobCountRow = { status: string; _count?: true | { _all?: number } };

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
    jobs,
    customers,
    platformAiApps: state.aiApps.slice(0, adminAiAppListTake),
    gateway: getSiteGatewayGroupsFromState(state, siteId)[0],
    ...summarizeJobs(jobs)
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const detail = url.searchParams.get("detail") ?? "summary";
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    return NextResponse.json(legacyPayload(readPlatformState(), siteId));
  }

  const payload = await aiPageCache.get(`${detail}:${siteId}`, async () => {
    const [apps, jobCounts, gateway, jobs, customers, platformAiApps] = await runDbTasks([
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
            take: Math.min(adminListTake, adminActivityTake)
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
        : () => Promise.resolve([])
    ], siteAdminReadConcurrency);

    const mappedJobs = jobs.map(mapJobListItemForAdmin);
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
      jobs: mappedJobs,
      customers,
      platformAiApps: platformAiApps.map(mapAiApp),
      gateway,
      jobCount,
      failedJobs,
      openJobs,
      completedJobs
    };
  });

  if (!payload) {
    return NextResponse.json({ error: "site_admin_data_unavailable" }, { status: 503 });
  }

  return NextResponse.json(payload);
}
