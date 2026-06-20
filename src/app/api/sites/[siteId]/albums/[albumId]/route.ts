import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError, updateAlbum } from "@/lib/server-store";
import type { Album } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; albumId: string }> }
) {
  const { siteId, albumId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<Album>;
  try {
    const result = updateAlbum({
      siteId,
      albumId,
      status: body.status ?? "processing",
      title: body.title,
      outputCount: body.outputCount,
      coverAssetId: body.coverAssetId
    });
    return NextResponse.json({ ok: true, album: result.album });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "album_update_failed" }, { status });
  }
}
