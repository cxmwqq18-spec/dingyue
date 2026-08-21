import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import {
  deleteVideoThemeCategoryRelational,
  upsertVideoThemeCategoryRelational
} from "@/lib/stores/site-store";
import type { VideoThemeCategory } from "@/lib/types";

function bodyFromRequest(body: Record<string, unknown>): Partial<VideoThemeCategory> {
  return {
    label: typeof body.label === "string" ? body.label : "",
    parentId: typeof body.parentId === "string" && body.parentId ? body.parentId : undefined,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    icon: typeof body.icon === "string" ? body.icon : undefined,
    accentColor: typeof body.accentColor === "string" ? body.accentColor : undefined,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    status: body.status === "draft" || body.status === "paused" || body.status === "active" ? body.status : "active"
  };
}

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string; categoryId: string }> }) {
  const { siteId, categoryId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = bodyFromRequest((await request.json().catch(() => ({}))) as Record<string, unknown>);
  try {
    const result = await upsertVideoThemeCategoryRelational({
      siteId,
      categoryId,
      label: body.label ?? "",
      slug: body.slug,
      description: body.description,
      icon: body.icon,
      accentColor: body.accentColor,
      imageUrl: body.imageUrl,
      sortOrder: body.sortOrder,
      status: body.status,
      parentId: body.parentId
    });
    return NextResponse.json({ ok: true, category: result.category, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_category_save_failed" }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteId: string; categoryId: string }> }) {
  const { siteId, categoryId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  try {
    const result = await deleteVideoThemeCategoryRelational({ siteId, categoryId });
    return NextResponse.json({ ok: true, deletedCategory: result.deletedCategory });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_category_delete_failed" }, { status });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "PUT,DELETE,OPTIONS" }
  });
}
