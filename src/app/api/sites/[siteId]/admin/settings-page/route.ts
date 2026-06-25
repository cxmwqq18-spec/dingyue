import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { runDbTasks } from "@/lib/db-concurrency";
import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import {
  getSiteAuditLogsFromState,
  getSiteDomainsFromState,
  getSiteGatewayGroupsFromState,
  readPlatformState,
  toPublicSiteAdmin
} from "@/lib/server-store";
import { latestActivity } from "@/lib/ops";
import { toGatewayGroup, toSiteAdmin, toSiteDomain } from "@/lib/stores/prisma-mappers";

const settingsPageCache = createServerTtlCache("site-admin-settings-page", Number(process.env.SITE_ADMIN_SETTINGS_PAGE_CACHE_TTL_MS ?? 15_000));

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 4);
const adminDomainListTake = envInt("SITE_ADMIN_DOMAIN_LIST_TAKE", 50);
const adminSiteAdminListTake = envInt("SITE_ADMIN_SITE_ADMIN_LIST_TAKE", 50);

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const perf = createAdminPerfTracker("admin-settings-page", { siteId });
  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }

  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    const state = perf.measureSync("context", () => readPlatformState(), { source: "state" });
    const auditLogs = getSiteAuditLogsFromState(state, siteId);
    return adminPerfJson(perf, {
      ok: true,
      domains: getSiteDomainsFromState(state, siteId).slice(0, adminDomainListTake),
      siteAdmins: state.siteAdmins.filter((admin) => admin.siteId === siteId).slice(0, adminSiteAdminListTake).map(toPublicSiteAdmin),
      feed: latestActivity(auditLogs, [], [], 8),
      auditLogCount: auditLogs.length,
      gateway: getSiteGatewayGroupsFromState(state, siteId)[0]
    });
  }

  const payload = await perf.measure("cache", () => settingsPageCache.get(siteId, async () => {
    const [domains, siteAdmins, auditLogs, auditLogCount, gateway] = await perf.measure("db", () => runDbTasks([
      () => prisma.siteDomain.findMany({
        where: { siteId },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: adminDomainListTake
      }),
      () => prisma.siteAdmin.findMany({
        where: { siteId },
        select: { id: true, siteId: true, email: true, displayName: true, role: true, createdAt: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        take: adminSiteAdminListTake
      }),
      () => prisma.auditLog.findMany({
        where: { siteId },
        select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 8
      }),
      () => prisma.auditLog.count({ where: { siteId } }),
      () => prisma.aiGatewayGroup.findFirst({
        where: { siteId },
        orderBy: [{ status: "asc" }, { name: "asc" }]
      })
    ], siteAdminReadConcurrency));

    return {
      ok: true,
      domains: domains.map(toSiteDomain),
      siteAdmins: siteAdmins.map((admin) => toPublicSiteAdmin(toSiteAdmin(admin))),
      feed: auditLogs.map((item) => ({
        id: item.id,
        label: item.action,
        detail: `${item.targetType}:${item.targetId}`,
        at: item.createdAt.toISOString()
      })),
      auditLogCount,
      gateway: gateway ? toGatewayGroup(gateway) : undefined
    };
  }));

  if (!payload) {
    return adminPerfJson(perf, { error: "site_admin_data_unavailable" }, { status: 503 });
  }

  return adminPerfJson(perf, payload);
}
