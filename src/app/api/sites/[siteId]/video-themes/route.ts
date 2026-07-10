import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { toVideoTheme } from "@/lib/stores/prisma-mappers";
import {
  ensureDefaultVideoThemesRelational,
  upsertVideoThemeRelational
} from "@/lib/stores/site-store";
import type { VideoTheme } from "@/lib/types";

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function searchWhere(query?: string): Prisma.VideoThemeWhereInput | undefined {
  if (!query) return undefined;
  return {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { headline: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { category: { is: { label: { contains: query, mode: "insensitive" } } } }
    ]
  };
}

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
    durationSeconds: Number(body.durationSeconds),
    maxFrames: Number(body.maxFrames),
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
    galleryImages: Array.isArray(body.galleryImages)
      ? body.galleryImages.filter((item): item is string => typeof item === "string")
      : undefined
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const adminRequested = url.searchParams.get("admin") === "1";
  const admin = adminRequested && await hasSiteAdminSession(siteId);
  const page = numberParam(url.searchParams.get("page"), 1, 1, 10000);
  const pageSize = numberParam(url.searchParams.get("pageSize"), admin ? 20 : 100, 1, 100);
  const query = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  await ensureDefaultVideoThemesRelational(siteId);
  const where: Prisma.VideoThemeWhereInput = {
    siteId,
    status: admin && status ? status : admin ? undefined : "active",
    category: category ? { is: { slug: category } } : undefined,
    AND: [searchWhere(query)].filter(Boolean) as Prisma.VideoThemeWhereInput[]
  };
  const [themes, total, activeCount, draftCount, pausedCount] = await prisma.$transaction([
    prisma.videoTheme.findMany({
      where,
      include: { category: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: admin ? (page - 1) * pageSize : undefined,
      take: pageSize
    }),
    prisma.videoTheme.count({ where }),
    prisma.videoTheme.count({ where: { siteId, status: "active" } }),
    prisma.videoTheme.count({ where: { siteId, status: "draft" } }),
    prisma.videoTheme.count({ where: { siteId, status: "paused" } })
  ]);
  return NextResponse.json({
    ok: true,
    themes: themes.map(toVideoTheme),
    total,
    page,
    pageSize,
    counts: {
      all: activeCount + draftCount + pausedCount,
      active: activeCount,
      draft: draftCount,
      paused: pausedCount
    }
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = themeBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
  try {
    const result = await upsertVideoThemeRelational({
      siteId,
      categoryId: body.categoryId,
      slug: body.slug,
      name: body.name ?? "",
      headline: body.headline,
      description: body.description ?? "",
      prompt: body.prompt ?? "",
      status: body.status,
      creditCost: Number(body.creditCost),
      durationSeconds: Number(body.durationSeconds),
      maxFrames: Number(body.maxFrames),
      imageUrl: body.imageUrl,
      galleryImages: body.galleryImages
    });
    return NextResponse.json({ ok: true, theme: result.theme, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_create_failed" }, { status });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET,POST,OPTIONS" }
  });
}
