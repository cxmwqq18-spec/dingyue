import { NextResponse } from "next/server";

import { requireSiteMutation } from "@/lib/api-auth";
import { RelationalStoreError } from "@/lib/stores/prisma-mappers";
import { refreshCurrentPublishedStateRelational } from "@/lib/stores/site-published-state";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-site-publish` });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null) as { actor?: string } | null;
  try {
    const result = await refreshCurrentPublishedStateRelational(siteId, body?.actor ?? "site_admin");
    return NextResponse.json({ ok: true, noOp: result.noOp, currentState: result.state });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_site_publish_failed" }, { status: error instanceof RelationalStoreError ? error.status : 500 });
  }
}
