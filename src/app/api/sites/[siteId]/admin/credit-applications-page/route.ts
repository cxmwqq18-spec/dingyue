import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { getCreditProgramQuotaRelational, listCreditApplicationsRelational } from "@/lib/stores/credit-application-store";

function takeFromUrl(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(100, Math.floor(parsed)) : 60;
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const query = url.searchParams.get("q") ?? "";
  const perf = createAdminPerfTracker("admin-credit-applications-page", { siteId, status });
  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }

  try {
    const payload = await perf.measure("db", () => listCreditApplicationsRelational({ siteId, status, query, take: takeFromUrl(url.searchParams.get("take")) }));
    const quota = await perf.measure("quota", () => getCreditProgramQuotaRelational({ siteId }));
    return adminPerfJson(perf, { ok: true, ...payload, quota });
  } catch (error) {
    const responseStatus = error instanceof StoreError ? error.status : 500;
    return adminPerfJson(perf, { error: error instanceof Error ? error.message : "credit_applications_page_failed" }, { status: responseStatus });
  }
}
