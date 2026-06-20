import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError, updateSiteAiApp } from "@/lib/server-store";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ siteId: string; siteAiAppId: string }> }
) {
  const { siteId, siteAiAppId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    enabled?: boolean;
    creditCost?: number;
    routeKey?: string;
  };

  try {
    const result = updateSiteAiApp({
      siteId,
      siteAiAppId,
      enabled: Boolean(body.enabled),
      creditCost: Number(body.creditCost),
      routeKey: body.routeKey ?? ""
    });
    return NextResponse.json({ ok: true, siteAiApp: result.siteAiApp });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_ai_app_update_failed" }, { status });
  }
}
