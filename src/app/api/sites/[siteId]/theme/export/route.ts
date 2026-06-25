import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { RelationalStoreError } from "@/lib/stores/prisma-mappers";
import { exportSiteThemePackageRelational } from "@/lib/stores/theme-store";

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const sourceParam = new URL(request.url).searchParams.get("source");
  const source = sourceParam === "active" ? "active" : "draft";
  try {
    const pkg = await exportSiteThemePackageRelational(siteId, source);
    return NextResponse.json({ ok: true, package: pkg });
  } catch (error) {
    const status = error instanceof RelationalStoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_export_failed" }, { status });
  }
}
