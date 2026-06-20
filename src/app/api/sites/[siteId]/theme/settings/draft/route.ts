import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { saveDraftThemeSettings } from "@/lib/server-store";
import type { ThemeSettings } from "@/lib/types";

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { draftJson?: ThemeSettings } | null;
  if (!body?.draftJson?.colors || !body.draftJson.typography || !body.draftJson.navigation) {
    return NextResponse.json({ error: "invalid_theme_settings_json" }, { status: 400 });
  }
  try {
    saveDraftThemeSettings(siteId, body.draftJson);
    return NextResponse.json({ ok: true, siteId, action: "theme_settings_draft_saved" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_settings_save_failed" }, { status: 404 });
  }
}
