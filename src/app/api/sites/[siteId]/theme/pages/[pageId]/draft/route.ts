import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { saveThemePageDraftRelational } from "@/lib/stores/theme-store";
import type { ThemePageJson } from "@/lib/types";
import type { NextRequest } from "next/server";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ siteId: string; pageId: string }> }) {
  const { siteId, pageId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-draft` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => null)) as { draftJson?: ThemePageJson; expectedRevision?: number; expectedEtag?: string } | null;
  if (!body?.draftJson?.sectionsOrder || !body.draftJson.sections) {
    return NextResponse.json({ error: "invalid_theme_page_json" }, { status: 400 });
  }
  try {
    const result = await saveThemePageDraftRelational({
      siteId,
      pageId,
      draftJson: body.draftJson,
      expected: { expectedRevision: body.expectedRevision, expectedEtag: body.expectedEtag },
      actor: guard.current.siteAdmin.id
    });
    return NextResponse.json({ ok: true, siteId, pageId, action: "draft_saved", draftVersion: result.draftVersion });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 404;
    return NextResponse.json({ error: error instanceof Error ? error.message : "draft_save_failed" }, { status });
  }
}
