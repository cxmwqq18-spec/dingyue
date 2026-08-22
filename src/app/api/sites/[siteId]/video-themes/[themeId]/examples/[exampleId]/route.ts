import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import {
  deleteVideoThemeExampleRelational,
  upsertVideoThemeExampleRelational
} from "@/lib/stores/site-store";
import type { VideoThemeExample } from "@/lib/types";

function exampleBody(body: Record<string, unknown>) {
  return {
    name: typeof body.name === "string" ? body.name : "",
    description: typeof body.description === "string" ? body.description : undefined,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
    galleryImages: Array.isArray(body.galleryImages)
      ? body.galleryImages.filter((item): item is string => typeof item === "string")
      : undefined,
    prompt: typeof body.prompt === "string" ? body.prompt : "",
    status: body.status === "active" || body.status === "paused" || body.status === "draft" ? body.status as VideoThemeExample["status"] : "draft" as const,
    sortOrder: Number(body.sortOrder)
  };
}

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string; themeId: string; exampleId: string }> }) {
  const { siteId, themeId, exampleId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  const body = exampleBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
  try {
    const result = await upsertVideoThemeExampleRelational({ siteId, themeId, exampleId, ...body });
    return NextResponse.json({ ok: true, example: result.example, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_example_save_failed" }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteId: string; themeId: string; exampleId: string }> }) {
  const { siteId, themeId, exampleId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  try {
    const result = await deleteVideoThemeExampleRelational({ siteId, themeId, exampleId });
    return NextResponse.json({ ok: true, deletedExample: result.deletedExample });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_example_delete_failed" }, { status });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "PUT,DELETE,OPTIONS" } });
}
