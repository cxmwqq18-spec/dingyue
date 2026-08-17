import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { settingsPageCache } from "@/lib/admin-settings-page-cache";
import { runDbTasks } from "@/lib/db-concurrency";
import { prisma } from "@/lib/prisma";
import {
  getSiteAuditLogsFromState,
  getSiteDomainsFromState,
  getSiteGatewayGroupsFromState,
  readPlatformState,
  toPublicSiteAdmin
} from "@/lib/server-store";
import { latestActivity } from "@/lib/ops";
import { toGatewayGroup, toSiteAdmin, toSiteDomain } from "@/lib/stores/prisma-mappers";

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 2);
const adminDomainListTake = envInt("SITE_ADMIN_DOMAIN_LIST_TAKE", 50);
const adminSiteAdminListTake = envInt("SITE_ADMIN_SITE_ADMIN_LIST_TAKE", 50);

function readSection(request: Request) {
  return new URL(request.url).searchParams.get("section") ?? "core";
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const section = readSection(request);
  const perf = createAdminPerfTracker("admin-settings-page", { siteId, section });
  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }

  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    const state = perf.measureSync("context", () => readPlatformState(), { source: "state" });
    if (section === "audit") {
      const auditLogs = getSiteAuditLogsFromState(state, siteId);
      return adminPerfJson(perf, {
        ok: true,
        feed: latestActivity(auditLogs, [], [], 8),
        auditLogCount: auditLogs.length
      });
    }
    if (section === "gateway") {
      return adminPerfJson(perf, {
        ok: true,
        gateway: getSiteGatewayGroupsFromState(state, siteId)[0]
      });
    }
    if (section === "domains") {
      return adminPerfJson(perf, {
        ok: true,
        domains: getSiteDomainsFromState(state, siteId).slice(0, adminDomainListTake)
      });
    }
    if (section === "admins") {
      return adminPerfJson(perf, {
        ok: true,
        siteAdmins: state.siteAdmins.filter((admin) => admin.siteId === siteId).slice(0, adminSiteAdminListTake).map(toPublicSiteAdmin)
      });
    }
    return adminPerfJson(perf, {
      ok: true,
      domains: [],
      siteAdmins: []
    });
  }

  const payload = await perf.measure("cache", () => settingsPageCache.get(`${section}:${siteId}`, async () => {
    if (section === "audit") {
      const [auditLogs, auditLogCount] = await perf.measure("db", () => runDbTasks([
        () => prisma.auditLog.findMany({
          where: { siteId },
          select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: 8
        }),
        () => prisma.auditLog.count({ where: { siteId } })
      ], siteAdminReadConcurrency));
      return {
        ok: true,
        feed: auditLogs.map((item) => ({
          id: item.id,
          label: item.action,
          detail: `${item.targetType}:${item.targetId}`,
          at: item.createdAt.toISOString()
        })),
        auditLogCount
      };
    }

    if (section === "gateway") {
      const gateway = await perf.measure("db", () => prisma.aiGatewayGroup.findFirst({
        where: { siteId },
        orderBy: [{ status: "asc" }, { name: "asc" }]
      }));
      return {
        ok: true,
        gateway: gateway ? toGatewayGroup(gateway) : undefined
      };
    }

    if (section === "domains") {
      const domains = await perf.measure("db", () => prisma.siteDomain.findMany({
        where: { siteId },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: adminDomainListTake
      }));
      return {
        ok: true,
        domains: domains.map(toSiteDomain)
      };
    }

    if (section === "admins") {
      const siteAdmins = await perf.measure("db", () => prisma.siteAdmin.findMany({
        where: { siteId },
        select: { id: true, siteId: true, email: true, displayName: true, role: true, createdAt: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        take: adminSiteAdminListTake
      }));
      return {
        ok: true,
        siteAdmins: siteAdmins.map((admin) => toPublicSiteAdmin(toSiteAdmin(admin)))
      };
    }

    return {
      ok: true,
      domains: [],
      siteAdmins: []
    };
  }));

  if (!payload) {
    return adminPerfJson(perf, { error: "site_admin_data_unavailable" }, { status: 503 });
  }

  return adminPerfJson(perf, payload);
}
