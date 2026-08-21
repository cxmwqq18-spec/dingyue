import { Prisma } from "@prisma/client";
import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { hasSiteAdminSession } from "@/lib/api-auth";
import {
  adminProcessViewFromJob,
  isTerminatedGenerationJob,
  type AdminProcessFilter
} from "@/lib/admin-processes";
import { prisma } from "@/lib/prisma";
import { isPostgresPlatformStateEnabled } from "@/lib/platform-state-store";
import {
  getSiteCustomersFromState,
  getSiteJobsFromState,
  readPlatformState
} from "@/lib/server-store";
import type { GenerationJob, PlatformState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProcessRow = {
  id: string;
  siteId: string;
  customerId: string;
  aiAppId: string;
  status: string;
  creditsReserved: number;
  requestJson: unknown;
  resultJson: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
  customerEmail?: string | null;
  aiAppName?: string | null;
  totalCount?: bigint | number | string;
};

type SummaryRow = {
  queuedCount: bigint | number | string;
  runningCount: bigint | number | string;
  terminatedCount: bigint | number | string;
  failedCount: bigint | number | string;
  activeReservedCredits: bigint | number | string | null;
};

function intParam(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), max);
}

function processFilter(value: string | null): AdminProcessFilter {
  if (value === "terminated" || value === "failed" || value === "all") return value;
  return "active";
}

function numberFromRaw(value: bigint | number | string | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function mapProcessRow(row: ProcessRow): GenerationJob {
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    aiAppId: row.aiAppId,
    status: row.status as GenerationJob["status"],
    creditsReserved: row.creditsReserved,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    requestJson: jsonRecord(row.requestJson) ?? {},
    resultJson: jsonRecord(row.resultJson)
  };
}

function terminatedSql(alias = Prisma.sql`g`) {
  return Prisma.sql`(${alias}."status" = 'failed' AND (${alias}."resultJson"->>'error' = 'generation_job_terminated_by_admin' OR ${alias}."resultJson"->'termination' IS NOT NULL))`;
}

function filterSql(filter: AdminProcessFilter) {
  const terminated = terminatedSql();
  if (filter === "active") return Prisma.sql`AND g."status" IN ('queued', 'running')`;
  if (filter === "terminated") return Prisma.sql`AND ${terminated}`;
  if (filter === "failed") return Prisma.sql`AND g."status" = 'failed' AND NOT ${terminated}`;
  return Prisma.empty;
}

function searchSql(search: string) {
  if (!search) return Prisma.empty;
  const pattern = `%${search}%`;
  return Prisma.sql`
    AND (
      g.id ILIKE ${pattern}
      OR c.email ILIKE ${pattern}
      OR a.name ILIKE ${pattern}
      OR g."requestJson"::text ILIKE ${pattern}
      OR g."resultJson"::text ILIKE ${pattern}
    )
  `;
}

async function readProcessRows(params: {
  filter: AdminProcessFilter;
  page: number;
  pageSize: number;
  search: string;
  siteId: string;
}): Promise<ProcessRow[]> {
  const offset = (params.page - 1) * params.pageSize;
  return prisma.$queryRaw<ProcessRow[]>`
    SELECT
      g.id,
      g."siteId",
      g."customerId",
      g."aiAppId",
      g.status,
      g."creditsReserved",
      g."requestJson",
      g."resultJson",
      g."createdAt",
      g."updatedAt",
      c.email AS "customerEmail",
      a.name AS "aiAppName",
      COUNT(*) OVER() AS "totalCount"
    FROM "GenerationJob" g
    LEFT JOIN "Customer" c ON c.id = g."customerId" AND c."siteId" = g."siteId"
    LEFT JOIN "AiApp" a ON a.id = g."aiAppId"
    WHERE g."siteId" = ${params.siteId}
    ${filterSql(params.filter)}
    ${searchSql(params.search)}
    ORDER BY g."updatedAt" DESC, g.id ASC
    LIMIT ${params.pageSize}
    OFFSET ${offset}
  `;
}

async function readProcessSummary(siteId: string): Promise<SummaryRow> {
  const terminated = terminatedSql();
  const [row] = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE g."status" = 'queued') AS "queuedCount",
      COUNT(*) FILTER (WHERE g."status" = 'running') AS "runningCount",
      COUNT(*) FILTER (WHERE ${terminated}) AS "terminatedCount",
      COUNT(*) FILTER (WHERE g."status" = 'failed' AND NOT ${terminated}) AS "failedCount",
      COALESCE(SUM(g."creditsReserved") FILTER (WHERE g."status" IN ('queued', 'running')), 0) AS "activeReservedCredits"
    FROM "GenerationJob" g
    WHERE g."siteId" = ${siteId}
  `;
  return row ?? {
    activeReservedCredits: 0,
    failedCount: 0,
    queuedCount: 0,
    runningCount: 0,
    terminatedCount: 0
  };
}

function legacyPayload(state: PlatformState, siteId: string, filter: AdminProcessFilter, page: number, pageSize: number, search: string) {
  const now = Date.now();
  const customers = new Map(getSiteCustomersFromState(state, siteId).map((customer) => [customer.id, customer.email]));
  const aiApps = new Map(state.aiApps.map((app) => [app.id, app.name]));
  const searchLower = search.toLowerCase();
  const jobs = getSiteJobsFromState(state, siteId)
    .filter((job) => {
      const terminated = isTerminatedGenerationJob(job);
      if (filter === "active") return job.status === "queued" || job.status === "running";
      if (filter === "terminated") return terminated;
      if (filter === "failed") return job.status === "failed" && !terminated;
      return true;
    })
    .map((job) => adminProcessViewFromJob({
      aiAppName: aiApps.get(job.aiAppId),
      customerEmail: customers.get(job.customerId),
      job,
      now
    }))
    .filter((process) => !searchLower || [
      process.alias,
      process.customerEmail,
      process.id,
      process.stageLabel
    ].join(" ").toLowerCase().includes(searchLower));
  const start = (page - 1) * pageSize;
  const allJobs = getSiteJobsFromState(state, siteId);
  const queuedCount = allJobs.filter((job) => job.status === "queued").length;
  const runningCount = allJobs.filter((job) => job.status === "running").length;
  const terminatedCount = allJobs.filter(isTerminatedGenerationJob).length;
  const failedCount = allJobs.filter((job) => job.status === "failed" && !isTerminatedGenerationJob(job)).length;
  return {
    ok: true,
    processes: jobs.slice(start, start + pageSize),
    pageInfo: {
      page,
      pageSize,
      total: jobs.length,
      hasMore: start + pageSize < jobs.length
    },
    summary: {
      activeCount: queuedCount + runningCount,
      queuedCount,
      runningCount,
      terminatedCount,
      failedCount,
      activeReservedCredits: allJobs
        .filter((job) => job.status === "queued" || job.status === "running")
        .reduce((sum, job) => sum + job.creditsReserved, 0)
    }
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const filter = processFilter(url.searchParams.get("filter"));
  const page = intParam(url.searchParams.get("page"), 1, 10_000);
  const pageSize = intParam(url.searchParams.get("pageSize"), 30, 100);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 120);
  const perf = createAdminPerfTracker("admin-processes-page", { siteId, filter, page, pageSize });

  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }

  if (!isPostgresPlatformStateEnabled()) {
    const payload = perf.measureSync("context", () => legacyPayload(readPlatformState(), siteId, filter, page, pageSize, search), { source: "state" });
    return adminPerfJson(perf, payload);
  }

  try {
    const [summary, rows] = await perf.measure("db", () => Promise.all([
      readProcessSummary(siteId),
      readProcessRows({ filter, page, pageSize, search, siteId })
    ]));
    const now = Date.now();
    const processes = rows.map((row) => adminProcessViewFromJob({
      aiAppName: row.aiAppName ?? undefined,
      customerEmail: row.customerEmail ?? undefined,
      job: mapProcessRow(row),
      now
    }));
    const total = numberFromRaw(rows[0]?.totalCount);
    return adminPerfJson(perf, {
      ok: true,
      processes,
      pageInfo: {
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total
      },
      summary: {
        activeCount: numberFromRaw(summary.queuedCount) + numberFromRaw(summary.runningCount),
        queuedCount: numberFromRaw(summary.queuedCount),
        runningCount: numberFromRaw(summary.runningCount),
        terminatedCount: numberFromRaw(summary.terminatedCount),
        failedCount: numberFromRaw(summary.failedCount),
        activeReservedCredits: numberFromRaw(summary.activeReservedCredits)
      }
    });
  } catch (error) {
    return adminPerfJson(perf, { error: error instanceof Error ? error.message : "processes_page_failed" }, { status: 500 });
  }
}
