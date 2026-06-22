import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { activateSiteThemeRelational } from "@/lib/stores/theme-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string; themeRecordId: string }> }) {
  const { siteId, themeRecordId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  try {
    const result = await activateSiteThemeRelational({
      siteId,
      themeId: themeRecordId,
      actor: body.actor
    });
    return NextResponse.json({ ok: true, action: "theme_activated", ...result });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_activate_failed" }, { status });
  }
}
