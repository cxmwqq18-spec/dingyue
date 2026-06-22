import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { publishDraftPageRelational } from "@/lib/stores/theme-store";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; pageId: string }> }) {
  const { siteId, pageId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-publish` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as { actor?: string; expectedRevision?: number; expectedEtag?: string };
  try {
    const result = await publishDraftPageRelational(siteId, pageId, body.actor ?? "site_admin_demo", {
      expectedRevision: body.expectedRevision,
      expectedEtag: body.expectedEtag
    });
    return NextResponse.json({
      ok: true,
      siteId,
      pageId,
      action: "published",
      publishedVersion: result.publishedVersion,
      draftVersion: result.draftVersion
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 404;
    return NextResponse.json({ error: error instanceof Error ? error.message : "publish_failed" }, { status });
  }
}
