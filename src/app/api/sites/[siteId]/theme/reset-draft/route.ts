import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { resetDraftThemeFromActiveRelational } from "@/lib/stores/theme-store";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-reset-draft` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  try {
    const result = await resetDraftThemeFromActiveRelational(siteId, body.actor ?? "site_admin_demo");
    return NextResponse.json({ ok: true, action: "theme_draft_reset_from_active", sourceVersion: result.sourceVersion, site: result.site });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_reset_failed" }, { status });
  }
}
