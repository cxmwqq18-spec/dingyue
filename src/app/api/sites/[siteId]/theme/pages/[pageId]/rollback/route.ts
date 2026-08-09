import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { rollbackThemePageDraftRelational } from "@/lib/stores/theme-store";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; pageId: string }> }) {
  const { siteId, pageId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-rollback` });
  if (!guard.ok) return guard.response;
  try {
    const result = await rollbackThemePageDraftRelational({ siteId, pageId });
    return NextResponse.json({ ok: true, siteId, pageId, action: "draft_rolled_back", draftVersion: result.draftVersion });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 404;
    return NextResponse.json({ error: error instanceof Error ? error.message : "rollback_failed" }, { status });
  }
}
