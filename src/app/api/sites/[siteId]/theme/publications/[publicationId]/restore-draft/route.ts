import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { restoreDraftThemeFromPublication, StoreError } from "@/lib/server-store";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; publicationId: string }> }
) {
  const { siteId, publicationId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-restore` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  try {
    const result = restoreDraftThemeFromPublication(siteId, publicationId, body.actor ?? "site_admin_demo");
    return NextResponse.json({
      ok: true,
      action: "theme_draft_restored_from_publication",
      publicationId: result.publication.id,
      sourceVersion: result.publication.version,
      pages: result.publication.snapshot.pages.length,
      liveMutated: false
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_publication_restore_failed" }, { status });
  }
}
