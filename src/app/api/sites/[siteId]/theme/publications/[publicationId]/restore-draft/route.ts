import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { restoreDraftThemeFromPublication, StoreError } from "@/lib/server-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string; publicationId: string }> }
) {
  const { siteId, publicationId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  try {
    const result = restoreDraftThemeFromPublication(siteId, publicationId, body.actor ?? "site_admin_demo");
    return NextResponse.json({
      ok: true,
      action: "theme_draft_restored_from_publication",
      publicationId: result.publication.id,
      sourceVersion: result.publication.version,
      pages: result.publication.snapshot.pages.length
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_publication_restore_failed" }, { status });
  }
}
