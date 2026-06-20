import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError, upsertThemeMediaAsset } from "@/lib/server-store";
import type { MediaAsset } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<MediaAsset>;
  try {
    const result = upsertThemeMediaAsset({
      siteId,
      label: body.label ?? "",
      storageKey: body.storageKey ?? "",
      mimeType: body.mimeType ?? "",
      usage: body.usage ?? "theme",
      sourceType: body.sourceType ?? "manual",
      previewUrl: body.previewUrl,
      originUrl: body.originUrl,
      altText: body.altText,
      notes: body.notes
    });
    return NextResponse.json({ ok: true, asset: result.asset, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_media_create_failed" }, { status });
  }
}
