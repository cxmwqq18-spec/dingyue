import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { getSiteSaasThemeRecords, StoreError } from "@/lib/server-store";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  try {
    const records = getSiteSaasThemeRecords(siteId);
    return NextResponse.json({
      ok: true,
      site: records.site,
      draft: records.draft,
      active: records.active,
      themes: records.themes,
      copies: records.copies,
      publications: records.publications
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_records_failed" }, { status });
  }
}
