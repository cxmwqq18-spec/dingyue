import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { toVideoThemeCategory } from "@/lib/stores/prisma-mappers";
import {
  ensureDefaultVideoThemesRelational,
  upsertVideoThemeCategoryRelational
} from "@/lib/stores/site-store";
import type { VideoThemeCategory } from "@/lib/types";

function bodyFromRequest(body: Record<string, unknown>): Partial<VideoThemeCategory> {
  return {
    label: typeof body.label === "string" ? body.label : "",
    slug: typeof body.slug === "string" ? body.slug : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    status: body.status === "draft" || body.status === "paused" || body.status === "active" ? body.status : "active"
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const adminRequested = url.searchParams.get("admin") === "1";
  const admin = adminRequested && await hasSiteAdminSession(siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  await ensureDefaultVideoThemesRelational(siteId);
  const categories = await prisma.videoThemeCategory.findMany({
    where: { siteId, status: admin ? undefined : "active" },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
  });
  return NextResponse.json({ ok: true, categories: categories.map(toVideoThemeCategory) });
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = bodyFromRequest((await request.json().catch(() => ({}))) as Record<string, unknown>);
  try {
    const result = await upsertVideoThemeCategoryRelational({
      siteId,
      label: body.label ?? "",
      slug: body.slug,
      description: body.description,
      imageUrl: body.imageUrl,
      sortOrder: body.sortOrder,
      status: body.status
    });
    return NextResponse.json({ ok: true, category: result.category, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_category_create_failed" }, { status });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET,POST,OPTIONS" }
  });
}
