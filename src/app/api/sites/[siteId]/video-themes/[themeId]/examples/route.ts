import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import {
  listVideoThemeExamplesRelational,
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

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string; themeId: string }> }) {
  const { siteId, themeId } = await params;
  const admin = await hasSiteAdminSession(siteId);
  try {
    const examples = await listVideoThemeExamplesRelational({ siteId, themeId, includeInactive: admin && new URL(request.url).searchParams.get("admin") === "1" });
    return NextResponse.json({ ok: true, examples });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_examples_read_failed" }, { status });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string; themeId: string }> }) {
  const { siteId, themeId } = await params;
  if (!(await hasSiteAdminSession(siteId))) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  const body = exampleBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
  try {
    const result = await upsertVideoThemeExampleRelational({ siteId, themeId, ...body });
    return NextResponse.json({ ok: true, example: result.example, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_example_save_failed" }, { status });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "GET,POST,OPTIONS" } });
}
