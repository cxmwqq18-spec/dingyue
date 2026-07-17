import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { photoPackageSlug } from "@/lib/photo-package-taxonomy";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { getPlatformAiProviderFallbackQueueRelational } from "@/lib/stores/platform-store";
import { toVideoTheme, toVideoThemeCategory } from "@/lib/stores/prisma-mappers";
import {
  ensureDefaultVideoThemesRelational,
  upsertVideoThemeRelational
} from "@/lib/stores/site-store";
import type { VideoTheme } from "@/lib/types";
import { configuredVideoProviderFrameLimit, effectiveVideoFrameLimit } from "@/lib/video-provider-limits";

const publicVideoThemeCache = new Map<string, { expiresAt: number; payload: unknown }>();
const publicVideoThemeDefaultsEnsured = new Set<string>();
const PUBLIC_VIDEO_THEME_CACHE_MS = 60_000;

function publicCacheKey(params: {
  category?: string;
  includeCategories: boolean;
  pageSize: number;
  query?: string;
  siteId: string;
  status?: string;
}) {
  return [
    params.siteId,
    params.includeCategories ? "with-categories" : "themes-only",
    params.pageSize,
    params.query || "",
    params.status || "",
    params.category || ""
  ].join(":");
}

function clearPublicVideoThemeCache(siteId: string) {
  for (const key of publicVideoThemeCache.keys()) {
    if (key.startsWith(`${siteId}:`)) publicVideoThemeCache.delete(key);
  }
}

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

function categoryWhere(category?: string): Prisma.VideoThemeWhereInput | undefined {
  const rawCategory = category?.trim();
  if (!rawCategory) return undefined;
  const normalizedCategory = photoPackageSlug(rawCategory);
  return {
    OR: [
      { category: { is: { slug: normalizedCategory } } },
      { category: { is: { label: { equals: rawCategory, mode: "insensitive" } } } }
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

async function videoThemeProviderFrameLimits() {
  const providers = await getPlatformAiProviderFallbackQueueRelational();
  return {
    effectiveMaxFrames: (theme: Pick<VideoTheme, "maxFrames">) => effectiveVideoFrameLimit(providers, theme.maxFrames),
    providerMaxFrames: configuredVideoProviderFrameLimit(providers)
  };
}

async function ensurePublicVideoThemeDefaults(siteId: string, shouldEnsure: boolean) {
  if (!shouldEnsure || publicVideoThemeDefaultsEnsured.has(siteId)) return true;
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) return false;
  await ensureDefaultVideoThemesRelational(siteId);
  publicVideoThemeDefaultsEnsured.add(siteId);
  clearPublicVideoThemeCache(siteId);
  return true;
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const adminRequested = url.searchParams.get("admin") === "1";
  const admin = adminRequested && await hasSiteAdminSession(siteId);
  const includeCategories = url.searchParams.get("includeCategories") === "1";
  const withCounts = admin || url.searchParams.get("withCounts") === "1";
  const page = numberParam(url.searchParams.get("page"), 1, 1, 10000);
  const pageSize = numberParam(url.searchParams.get("pageSize"), admin ? 20 : 100, 1, 100);
  const query = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const where: Prisma.VideoThemeWhereInput = {
    siteId,
    status: admin && status ? status : admin ? undefined : "active",
    AND: [categoryWhere(category), searchWhere(query)].filter(Boolean) as Prisma.VideoThemeWhereInput[]
  };

  if (!withCounts) {
    if (!(await ensurePublicVideoThemeDefaults(siteId, !category && !query))) {
      return NextResponse.json({ error: "site_not_found" }, { status: 404 });
    }
    const cacheKey = publicCacheKey({ category, includeCategories, pageSize, query, siteId, status });
    const cached = publicVideoThemeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.payload);
    let themes = await prisma.videoTheme.findMany({
      where,
      include: { category: true },
      orderBy: [{ createdAt: "desc" }],
      take: pageSize
    });
    if (!themes.length) {
      const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
      if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
    }
    if (!themes.length && !category && !query) {
      await ensureDefaultVideoThemesRelational(siteId);
      themes = await prisma.videoTheme.findMany({
        where,
        include: { category: true },
        orderBy: [{ createdAt: "desc" }],
        take: pageSize
      });
    }
    const categories = includeCategories
      ? await prisma.videoThemeCategory.findMany({
          where: { siteId, status: "active" },
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
        })
      : [];
    const frameLimits = await videoThemeProviderFrameLimits();
    const payload = {
      ok: true,
      themes: themes.map((theme) => {
        const mapped = toVideoTheme(theme);
        return {
          ...mapped,
          effectiveMaxFrames: frameLimits.effectiveMaxFrames(mapped),
          providerMaxFrames: frameLimits.providerMaxFrames
        };
      }),
      categories: categories.map(toVideoThemeCategory),
      total: themes.length,
      page,
      pageSize,
      counts: {
        all: themes.length,
        active: themes.length,
        draft: 0,
        paused: 0
      }
    };
    publicVideoThemeCache.set(cacheKey, { expiresAt: Date.now() + PUBLIC_VIDEO_THEME_CACHE_MS, payload });
    return NextResponse.json(payload);
  }

  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  await ensureDefaultVideoThemesRelational(siteId);
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
  const frameLimits = await videoThemeProviderFrameLimits();
  return NextResponse.json({
    ok: true,
    themes: themes.map((theme) => {
      const mapped = toVideoTheme(theme);
      return {
        ...mapped,
        effectiveMaxFrames: frameLimits.effectiveMaxFrames(mapped),
        providerMaxFrames: frameLimits.providerMaxFrames
      };
    }),
    total,
    page,
    pageSize,
    counts: {
      all: activeCount + draftCount + pausedCount,
      active: activeCount,
      draft: draftCount,
      paused: pausedCount
    },
    ...(includeCategories
      ? {
          categories: (await prisma.videoThemeCategory.findMany({
            where: { siteId, status: admin ? undefined : "active" },
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
          })).map(toVideoThemeCategory)
        }
      : {})
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
    clearPublicVideoThemeCache(siteId);
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
