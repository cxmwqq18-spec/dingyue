import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { publishApprovedDraftSiteRelational } from "@/lib/stores/theme-store";
import { RelationalStoreError } from "@/lib/stores/prisma-mappers";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; pageId: string }> }) {
  const { siteId, pageId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-publish` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as {
    actor?: string;
    approvalId?: string;
  };
  try {
    if (!body.approvalId) return NextResponse.json({ error: "theme_publish_approval_required" }, { status: 409 });
    const result = await publishApprovedDraftSiteRelational({ siteId, approvalId: body.approvalId, actor: body.actor ?? "site_admin_demo" });
    return NextResponse.json({
      ok: true,
      siteId,
      pageId,
      action: "published",
      publishedVersion: result.publishedVersion,
      publicationId: result.publication.id
    });
  } catch (error) {
    const status = error instanceof StoreError || error instanceof RelationalStoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "publish_failed" }, { status });
  }
}
