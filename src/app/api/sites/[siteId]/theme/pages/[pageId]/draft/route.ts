import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { saveDraftPage } from "@/lib/server-store";
import type { ThemePageJson } from "@/lib/types";

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string; pageId: string }> }) {
  const { siteId, pageId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { draftJson?: ThemePageJson } | null;
  if (!body?.draftJson?.sectionsOrder || !body.draftJson.sections) {
    return NextResponse.json({ error: "invalid_theme_page_json" }, { status: 400 });
  }
  try {
    saveDraftPage(siteId, pageId, body.draftJson);
    return NextResponse.json({ ok: true, siteId, pageId, action: "draft_saved" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "draft_save_failed" }, { status: 404 });
  }
}
