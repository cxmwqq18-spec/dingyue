import { NextResponse } from "next/server";

import { hasSiteAdminSession, requireSiteMutation } from "@/lib/api-auth";
import { RelationalStoreError } from "@/lib/stores/prisma-mappers";
import { getStorefrontProfileRelational, saveStorefrontProfileDraftRelational } from "@/lib/stores/storefront-profile-store";
import type { StorefrontProfileJson } from "@/lib/types";
import type { NextRequest } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  return NextResponse.json({ ok: true, profile: await getStorefrontProfileRelational(siteId) });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:storefront-profile` });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null) as { draftJson?: StorefrontProfileJson; expectedRevision?: number; expectedEtag?: string } | null;
  if (!body?.draftJson) return NextResponse.json({ error: "invalid_storefront_profile" }, { status: 400 });
  try {
    const profile = await saveStorefrontProfileDraftRelational({ siteId, draftJson: body.draftJson, expectedRevision: body.expectedRevision, expectedEtag: body.expectedEtag });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "storefront_profile_save_failed" }, { status: error instanceof RelationalStoreError ? error.status : 500 });
  }
}
