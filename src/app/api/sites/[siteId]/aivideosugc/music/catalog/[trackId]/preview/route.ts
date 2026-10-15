import { NextResponse, type NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { getMusicCatalogTrackForCustomer } from "@/lib/aidreamcapes-workspace/music-catalog";
import { aidreamcapesMusicPreviewRoot, MusicPreviewPathError, readContainedMusicPreviewFile } from "@/lib/aidreamcapes-workspace/music-catalog-preview";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ siteId: string; trackId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, trackId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    const { track } = await getMusicCatalogTrackForCustomer(siteId, auth.current.customer.id, trackId);
    if (!track.previewAssetKey) throw new WorkspaceError("music_preview_missing", 404);
    const preview = await readContainedMusicPreviewFile(aidreamcapesMusicPreviewRoot(), track.previewAssetKey);
    return new NextResponse(new Uint8Array(preview.bytes), {
      status: 200,
      headers: {
        "Content-Type": preview.contentType,
        "Content-Length": String(preview.bytes.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    if (error instanceof MusicPreviewPathError) {
      const status = error.code === "music_preview_missing" ? 404 : error.code === "unsafe_music_preview_path" ? 404 : 503;
      return workspaceFailure(new WorkspaceError(error.code, status));
    }
    return workspaceFailure(error);
  }
}
