import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { deleteThemeMediaAssetRelational, upsertThemeMediaAssetRelational } from "@/lib/stores/theme-store";
import type { MediaAsset } from "@/lib/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ siteId: string; assetId: string }> }
) {
  const { siteId, assetId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<MediaAsset>;
  try {
    const result = await upsertThemeMediaAssetRelational({
      siteId,
      assetId,
      label: body.label ?? "",
      storageKey: body.storageKey ?? "",
      mimeType: body.mimeType ?? "",
      usage: body.usage ?? "theme",
      sourceType: body.sourceType,
      previewUrl: body.previewUrl,
      originUrl: body.originUrl,
      altText: body.altText,
      notes: body.notes
    });
    return NextResponse.json({ ok: true, asset: result.asset, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_media_save_failed" }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; assetId: string }> }
) {
  const { siteId, assetId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  try {
    const result = await deleteThemeMediaAssetRelational({ siteId, assetId });
    return NextResponse.json({ ok: true, asset: result.asset });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_media_delete_failed" }, { status });
  }
}
