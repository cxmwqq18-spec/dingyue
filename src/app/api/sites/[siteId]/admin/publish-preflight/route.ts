import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { getThemePublishPreflightBundleRelational } from "@/lib/stores/site-store";
import { runThemePublishPreflight } from "@/lib/theme/publish-preflight";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const perf = createAdminPerfTracker("admin-publish-preflight", { siteId });
  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }
  const bundle = await perf.measure("db", () => getThemePublishPreflightBundleRelational(siteId));
  const { site, dirtyPageIds } = bundle;
  if (!site) return adminPerfJson(perf, { error: "site_not_found" }, { status: 404 });
  const preflight = perf.measureSync("preflight", () => runThemePublishPreflight({
    site,
    products: bundle.products,
    siteAiApps: bundle.siteAiApps,
    mediaAssets: bundle.mediaAssets,
    dirtyPageIds
  }));
  return adminPerfJson(perf, {
    ok: true,
    canPublish: preflight.canPublish,
    score: preflight.score,
    blockerCount: preflight.summary.blockers,
    warningCount: preflight.summary.warnings
  });
}
