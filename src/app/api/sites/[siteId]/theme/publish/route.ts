import { NextResponse } from "next/server";

import { requireSiteMutation } from "@/lib/api-auth";
import { RelationalStoreError } from "@/lib/stores/prisma-mappers";
import { publishApprovedDraftSiteRelational } from "@/lib/stores/theme-store";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-site-publish` });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null) as { approvalId?: string; actor?: string } | null;
  if (!body?.approvalId?.trim()) return NextResponse.json({ error: "publish_approval_required" }, { status: 409 });
  try {
    const result = await publishApprovedDraftSiteRelational({ siteId, approvalId: body.approvalId.trim(), actor: body.actor ?? "site_admin" });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_site_publish_failed" }, { status: error instanceof RelationalStoreError ? error.status : 500 });
  }
}
