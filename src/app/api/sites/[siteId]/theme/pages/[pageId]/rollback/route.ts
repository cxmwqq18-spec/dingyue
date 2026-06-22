import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { rollbackThemePageDraftRelational } from "@/lib/stores/theme-store";

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string; pageId: string }> }) {
  const { siteId, pageId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  try {
    await rollbackThemePageDraftRelational({ siteId, pageId });
    return NextResponse.json({ ok: true, siteId, pageId, action: "draft_rolled_back" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "rollback_failed" }, { status: 404 });
  }
}
