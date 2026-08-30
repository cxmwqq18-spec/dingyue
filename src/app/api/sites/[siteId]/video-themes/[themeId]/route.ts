import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import {
  deleteVideoThemeRelational,
  upsertVideoThemeRelational
} from "@/lib/stores/site-store";
import type { VideoTheme } from "@/lib/types";
import { normalizeVideoModelPricing } from "@/lib/video-frame-config";
import { clearPublicVideoThemeCache } from "@/lib/video-theme-cache";

function themeBody(body: Record<string, unknown>): Partial<VideoTheme> {
  return {
    categoryId: typeof body.categoryId === "string" && body.categoryId.trim() ? body.categoryId.trim() : undefined,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    name: typeof body.name === "string" ? body.name : "",
    headline: typeof body.headline === "string" ? body.headline : undefined,
    description: typeof body.description === "string" ? body.description : "",
    prompt: typeof body.prompt === "string" ? body.prompt : "",
    status: body.status === "active" || body.status === "paused" || body.status === "draft" ? body.status : "draft",
    creditCost: Number(body.creditCost),
    modelPricing: normalizeVideoModelPricing(body.modelPricing, Number(body.creditCost)),
    durationSeconds: Number(body.durationSeconds),
    maxFrames: Number(body.maxFrames),
    sortOrder: Number(body.sortOrder),
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
    galleryImages: Array.isArray(body.galleryImages)
      ? body.galleryImages.filter((item): item is string => typeof item === "string")
      : undefined
  };
}

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string; themeId: string }> }) {
  const { siteId, themeId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = themeBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
  try {
    const result = await upsertVideoThemeRelational({
      siteId,
      themeId,
      categoryId: body.categoryId,
      slug: body.slug,
      name: body.name ?? "",
      headline: body.headline,
      description: body.description ?? "",
      prompt: body.prompt ?? "",
      status: body.status,
      creditCost: Number(body.creditCost),
      modelPricing: body.modelPricing,
      durationSeconds: Number(body.durationSeconds),
      maxFrames: Number(body.maxFrames),
      sortOrder: Number(body.sortOrder),
      imageUrl: body.imageUrl,
      galleryImages: body.galleryImages
    });
    clearPublicVideoThemeCache(siteId);
    return NextResponse.json({ ok: true, theme: result.theme, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_save_failed" }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteId: string; themeId: string }> }) {
  const { siteId, themeId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  try {
    const result = await deleteVideoThemeRelational({ siteId, themeId });
    clearPublicVideoThemeCache(siteId);
    return NextResponse.json({ ok: true, deletedTheme: result.deletedTheme });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_delete_failed" }, { status });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "PUT,DELETE,OPTIONS" }
  });
}
