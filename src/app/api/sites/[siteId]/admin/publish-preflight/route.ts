import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { getThemePublishPreflightBundleRelational } from "@/lib/stores/site-store";
import { runThemePublishPreflight } from "@/lib/theme/publish-preflight";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const bundle = await getThemePublishPreflightBundleRelational(siteId);
  const { site, dirtyPageIds } = bundle;
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  const preflight = runThemePublishPreflight({
    site,
    products: bundle.products,
    siteAiApps: bundle.siteAiApps,
    mediaAssets: bundle.mediaAssets,
    dirtyPageIds
  });
  return NextResponse.json({
    ok: true,
    canPublish: preflight.canPublish,
    score: preflight.score,
    blockerCount: preflight.summary.blockers,
    warningCount: preflight.summary.warnings
  });
}
