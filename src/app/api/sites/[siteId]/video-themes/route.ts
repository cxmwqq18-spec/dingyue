import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { photoPackageSlug } from "@/lib/photo-package-taxonomy";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { readLocalJsonPlatformState } from "@/lib/storefront-local-state";
import { isAnyLocalStorefrontReadPreference, isExplicitLocalPreviewReadPreference, isMydreamshootsContentSourceSiteId } from "@/lib/storefront-content-source-policy";
import { getPlatformAiProviderFallbackQueueRelational } from "@/lib/stores/platform-store";
import { toVideoTheme, toVideoThemeCategory } from "@/lib/stores/prisma-mappers";
import {
  ensureDefaultVideoThemesRelational,
  upsertVideoThemeRelational
} from "@/lib/stores/site-store";
import type { PlatformState, VideoTheme, VideoThemeCategory } from "@/lib/types";
import { normalizeVideoModelPricing } from "@/lib/video-frame-config";
import { isBlockedPublicVideoThemeSlugForSite, publicVideoThemeSlugListForSite } from "@/lib/video-theme-public-scope";
import { videoProviderModelFamiliesForProviders } from "@/lib/video-provider-family";
import { runnableVideoProviderModelFamiliesForRequest } from "@/lib/video-provider-availability";
import { configuredVideoProviderFrameLimit, effectiveVideoFrameLimit, isVideoProviderModel } from "@/lib/video-provider-limits";

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
      { category: { is: { label: { equals: rawCategory, mode: "insensitive" } } } },
      { category: { is: { parent: { is: { slug: normalizedCategory } } } } },
      { category: { is: { parent: { is: { label: { equals: rawCategory, mode: "insensitive" } } } } } }
    ]
  };
}

function publicVideoThemeWhere(siteId: string): Prisma.VideoThemeWhereInput {
  const slugList = publicVideoThemeSlugListForSite(siteId);
  return {
    siteId,
    status: "active",
    ...(slugList?.length
      ? { slug: { in: [...slugList] } }
      : isBlockedPublicVideoThemeSlugForSite(siteId, "creator-scene-motion")
        ? { slug: { not: "creator-scene-motion" } }
        : {}),
    OR: [
      { categoryId: null },
      { category: { is: { status: "active" } } }
    ]
  };
}

function publicVideoThemeCategoryWhere(siteId: string): Prisma.VideoThemeCategoryWhereInput {
  const slugList = publicVideoThemeSlugListForSite(siteId);
  return {
    siteId,
    status: "active",
    ...(slugList?.length ? { slug: { in: [...slugList] } } : {})
  };
}

function shouldUseLocalPublicVideoThemeReads(siteId: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const preference = (process.env.STOREFRONT_PATH_MODE_READS ?? "").trim().toLowerCase();
  if (isMydreamshootsContentSourceSiteId(siteId)) return isExplicitLocalPreviewReadPreference(preference);
  return isAnyLocalStorefrontReadPreference(preference);
}

function localCategoryMap(state: PlatformState, siteId: string): Map<string, VideoThemeCategory> {
  return new Map((state.videoThemeCategories ?? [])
    .filter((category) => category.siteId === siteId)
    .map((category) => [category.id, category]));
}

function localThemeMatchesQuery(theme: VideoTheme, category: VideoThemeCategory | undefined, query?: string): boolean {
  const rawQuery = query?.trim().toLowerCase();
  if (!rawQuery) return true;
  return [
    theme.name,
    theme.headline,
    theme.description,
    theme.category?.label,
    category?.label
  ].some((value) => typeof value === "string" && value.toLowerCase().includes(rawQuery));
}

function localThemeMatchesCategory(theme: VideoTheme, category: VideoThemeCategory | undefined, rawCategory?: string): boolean {
  const trimmedCategory = rawCategory?.trim();
  if (!trimmedCategory) return true;
  const normalizedCategory = photoPackageSlug(trimmedCategory);
  return theme.category?.slug === normalizedCategory ||
    category?.slug === normalizedCategory ||
    theme.category?.label?.toLowerCase() === trimmedCategory.toLowerCase() ||
    category?.label.toLowerCase() === trimmedCategory.toLowerCase();
}

async function localVideoThemePayload(params: {
  category?: string;
  includeCategories: boolean;
  page: number;
  pageSize: number;
  query?: string;
  siteId: string;
}) {
  const state = readLocalJsonPlatformState();
  if (!state) return undefined;
  if (!state.sites.some((site) => site.id === params.siteId)) return undefined;
  const categoriesById = localCategoryMap(state, params.siteId);
  const siteThemes = (state.videoThemes ?? []).filter((theme) => theme.siteId === params.siteId);
  const themes = siteThemes
    .filter((theme) => theme.status === "active")
    .filter((theme) => localThemeMatchesCategory(theme, theme.categoryId ? categoriesById.get(theme.categoryId) : undefined, params.category))
    .filter((theme) => localThemeMatchesQuery(theme, theme.categoryId ? categoriesById.get(theme.categoryId) : undefined, params.query))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, params.pageSize);
  const providers = (state.platformAiProviders ?? []).filter((provider) =>
    provider.enabled !== false &&
    Boolean(provider.aiUrl?.trim()) &&
    Boolean(provider.apiKey?.trim()) &&
    (provider.providerType === "video" || isVideoProviderModel(provider.modelType))
  );
  const providerMaxFrames = configuredVideoProviderFrameLimit(providers);
  const providerModelFamilies = videoProviderModelFamiliesForProviders(providers);
  const textToVideoProviderModelFamilies = runnableVideoProviderModelFamiliesForRequest(providers, { referenceAssetCount: 0 });
  const imageToVideoProviderModelFamilies = runnableVideoProviderModelFamiliesForRequest(providers, { referenceAssetCount: 1 });
  const categories = params.includeCategories
    ? Array.from(categoriesById.values())
        .filter((category) => category.status === "active")
        .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
    : [];
  return {
    ok: true,
    themes: themes.map((theme) => ({
      ...theme,
      category: theme.category ?? (theme.categoryId ? categoriesById.get(theme.categoryId) : undefined),
      effectiveMaxFrames: effectiveVideoFrameLimit(providers, theme.maxFrames),
      providerMaxFrames,
      providerModelFamilies,
      textToVideoProviderModelFamilies,
      imageToVideoProviderModelFamilies
    })),
    categories,
    total: themes.length,
    page: params.page,
    pageSize: params.pageSize,
    counts: {
      all: siteThemes.length,
      active: siteThemes.filter((theme) => theme.status === "active").length,
      draft: siteThemes.filter((theme) => theme.status === "draft").length,
      paused: siteThemes.filter((theme) => theme.status === "paused").length
    }
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

async function videoThemeProviderFrameLimits() {
  const providers = await getPlatformAiProviderFallbackQueueRelational("video");
  return {
    effectiveMaxFrames: (theme: Pick<VideoTheme, "maxFrames">) => effectiveVideoFrameLimit(providers, theme.maxFrames),
    providerMaxFrames: configuredVideoProviderFrameLimit(providers),
    providerModelFamilies: videoProviderModelFamiliesForProviders(providers),
    textToVideoProviderModelFamilies: runnableVideoProviderModelFamiliesForRequest(providers, { referenceAssetCount: 0, assumeApiKeyConfigured: true }),
    imageToVideoProviderModelFamilies: runnableVideoProviderModelFamiliesForRequest(providers, { referenceAssetCount: 1, assumeApiKeyConfigured: true })
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
  const publicScope = admin && url.searchParams.get("scope") === "public";
  const page = numberParam(url.searchParams.get("page"), 1, 1, 10000);
  const pageSize = numberParam(url.searchParams.get("pageSize"), admin ? 20 : 100, 1, 100);
  const query = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const baseWhere: Prisma.VideoThemeWhereInput = publicScope
    ? publicVideoThemeWhere(siteId)
    : {
        siteId,
        status: admin && status ? status : admin ? undefined : "active"
      };
  const where: Prisma.VideoThemeWhereInput = {
    AND: [
      baseWhere,
      publicScope && status ? { status } : undefined,
      categoryWhere(category),
      searchWhere(query)
    ].filter(Boolean) as Prisma.VideoThemeWhereInput[]
  };

  if (!admin && shouldUseLocalPublicVideoThemeReads(siteId)) {
    const payload = await localVideoThemePayload({ category, includeCategories, page, pageSize, query, siteId });
    return payload
      ? NextResponse.json(payload)
      : NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }

  if (!withCounts) {
    if (!(await ensurePublicVideoThemeDefaults(siteId, !category && !query))) {
      return NextResponse.json({ error: "site_not_found" }, { status: 404 });
    }
    const cacheKey = publicCacheKey({ category, includeCategories, pageSize, query, siteId, status });
    const cached = publicVideoThemeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.payload);
    let themes = await prisma.videoTheme.findMany({
      where,
      include: { category: { include: { parent: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
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
        include: { category: { include: { parent: true } } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: pageSize
      });
    }
    const categories = includeCategories
      ? await prisma.videoThemeCategory.findMany({
          where: publicVideoThemeCategoryWhere(siteId),
          include: { parent: true },
          orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
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
          providerMaxFrames: frameLimits.providerMaxFrames,
          providerModelFamilies: frameLimits.providerModelFamilies,
          textToVideoProviderModelFamilies: frameLimits.textToVideoProviderModelFamilies,
          imageToVideoProviderModelFamilies: frameLimits.imageToVideoProviderModelFamilies
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
  const countScopeWhere: Prisma.VideoThemeWhereInput = publicScope ? publicVideoThemeWhere(siteId) : { siteId };
  const [themes, total, activeCount, draftCount, pausedCount, backendAllCount, publicAllCount] = await prisma.$transaction([
    prisma.videoTheme.findMany({
      where,
      include: { category: { include: { parent: true } } },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      skip: admin ? (page - 1) * pageSize : undefined,
      take: pageSize
    }),
    prisma.videoTheme.count({ where }),
    prisma.videoTheme.count({ where: { AND: [countScopeWhere, { status: "active" }] } }),
    prisma.videoTheme.count({ where: { AND: [countScopeWhere, { status: "draft" }] } }),
    prisma.videoTheme.count({ where: { AND: [countScopeWhere, { status: "paused" }] } }),
    prisma.videoTheme.count({ where: { siteId } }),
    prisma.videoTheme.count({ where: publicVideoThemeWhere(siteId) })
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
      paused: pausedCount,
      backendAll: backendAllCount,
      publicAll: publicAllCount
    },
    ...(includeCategories
      ? {
          categories: (await prisma.videoThemeCategory.findMany({
            where: publicScope
              ? publicVideoThemeCategoryWhere(siteId)
              : { siteId, status: admin ? undefined : "active" },
            include: { parent: true },
            orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_create_failed" }, { status });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET,POST,OPTIONS" }
  });
}
