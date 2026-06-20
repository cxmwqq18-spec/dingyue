import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { duplicateSiteTheme, StoreError } from "@/lib/server-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    source?: "draft" | "active";
    sourceThemeId?: string;
    actor?: string;
  };
  try {
    const result = duplicateSiteTheme({
      siteId,
      name: body.name,
      source: body.source,
      sourceThemeId: body.sourceThemeId,
      actor: body.actor
    });
    return NextResponse.json({ ok: true, action: "theme_duplicated", ...result });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_duplicate_failed" }, { status });
  }
}
