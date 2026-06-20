import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { publishDraftPage } from "@/lib/server-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string; pageId: string }> }) {
  const { siteId, pageId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  try {
    const state = publishDraftPage(siteId, pageId, body.actor ?? "site_admin_demo");
    const site = state.sites.find((item) => item.id === siteId);
    const page = site?.pages.find((item) => item.id === pageId);
    return NextResponse.json({
      ok: true,
      siteId,
      pageId,
      action: "published",
      publishedVersion: page?.publishedJson.version
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "publish_failed" }, { status: 404 });
  }
}
