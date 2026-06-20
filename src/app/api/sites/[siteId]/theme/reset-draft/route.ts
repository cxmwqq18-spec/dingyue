import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { resetDraftThemeFromActive, StoreError } from "@/lib/server-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  try {
    const result = resetDraftThemeFromActive(siteId, body.actor ?? "site_admin_demo");
    return NextResponse.json({ ok: true, action: "theme_draft_reset_from_active", sourceVersion: result.sourceVersion });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_reset_failed" }, { status });
  }
}
