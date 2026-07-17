import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { clearPublicCreativePacksCache, publicCreativePacksCache } from "@/lib/creative-pack-api-cache";
import { photoPackageSlug } from "@/lib/photo-package-taxonomy";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { toCreativePack } from "@/lib/stores/prisma-mappers";
import { upsertCreativePackRelational } from "@/lib/stores/site-store";
import type { CreativePack } from "@/lib/types";

const publicCreativePackCategorySelect = {
  id: true,
  siteId: true,
  parentId: true,
  slug: true,
  label: true,
  description: true,
  heroTitle: true,
  heroSubtitle: true,
  icon: true,
  imageUrl: true,
  sortOrder: true,
  status: true,
  createdAt: true
} satisfies Prisma.CreativePackCategorySelect;

const publicCreativePackSelect = {
  id: true,
  siteId: true,
  categoryId: true,
  name: true,
  headline: true,
  description: true,
  category: true,
  aiAppSlug: true,
  status: true,
  creditCost: true,
  outputCount: true,
  trainingRequired: true,
  generationCount: true,
  conversionRate: true,
  imageUrl: true,
  galleryImages: true,
  createdAt: true,
  categoryRecord: {
    select: {
      ...publicCreativePackCategorySelect,
      parent: { select: publicCreativePackCategorySelect }
    }
  }
} satisfies Prisma.CreativePackSelect;

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function categoryWhere(category?: string): Prisma.CreativePackWhereInput | undefined {
  const rawCategory = category?.trim();
  if (!rawCategory) return undefined;
  const normalizedCategory = photoPackageSlug(rawCategory);
  return {
    OR: [
      { category: { equals: rawCategory, mode: "insensitive" } },
      { category: normalizedCategory },
      { categoryRecord: { is: { slug: normalizedCategory } } },
      { categoryRecord: { is: { label: { equals: rawCategory, mode: "insensitive" } } } },
      { categoryRecord: { is: { parent: { is: { slug: normalizedCategory } } } } },
      { categoryRecord: { is: { parent: { is: { label: { equals: rawCategory, mode: "insensitive" } } } } } }
    ]
  };
}

function searchWhere(query?: string): Prisma.CreativePackWhereInput | undefined {
  if (!query) return undefined;
  return {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { headline: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { aiAppSlug: { contains: query, mode: "insensitive" } },
      { category: { contains: query, mode: "insensitive" } },
      { categoryRecord: { label: { contains: query, mode: "insensitive" } } }
    ]
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const adminRequested = url.searchParams.get("admin") === "1";
  const admin = adminRequested && await hasSiteAdminSession(siteId);
  const page = numberParam(url.searchParams.get("page"), 1, 1, 10000);
  const pageSize = numberParam(url.searchParams.get("pageSize"), admin ? 10 : 100, 1, 100);
  const query = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const app = url.searchParams.get("app")?.trim();
  if (!admin) {
    const cacheKey = `${siteId}:${page}:${pageSize}:${query ?? ""}:${category ?? ""}:${app ?? ""}`;
    const payload = await publicCreativePacksCache.get(cacheKey, async () => {
      const publicWhere: Prisma.CreativePackWhereInput = {
        siteId,
        status: "active",
        aiAppSlug: app || undefined,
        AND: [categoryWhere(category), searchWhere(query)].filter(Boolean) as Prisma.CreativePackWhereInput[]
      };
      const [site, packs, total] = await Promise.all([
        prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
        prisma.creativePack.findMany({
          where: publicWhere,
          select: publicCreativePackSelect,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.creativePack.count({ where: publicWhere })
      ]);
      if (!site) return { ok: false as const, error: "site_not_found" };
      return {
        ok: true,
        packs: packs.map((pack) => ({ ...toCreativePack(pack), prompt: undefined })),
        total,
        page,
        pageSize,
        counts: {
          all: total,
          active: total,
          draft: 0,
          paused: 0
        }
      };
    });
    if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: 404 });
    return NextResponse.json(payload);
  }
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }
  const where: Prisma.CreativePackWhereInput = {
    siteId,
    status: admin && status ? status : admin ? undefined : "active",
    aiAppSlug: admin && app ? app : undefined,
    AND: [admin ? categoryWhere(category) : undefined, admin ? searchWhere(query) : undefined].filter(Boolean) as Prisma.CreativePackWhereInput[]
  };
  const [packs, total, activeCount, draftCount, pausedCount] = await prisma.$transaction([
    prisma.creativePack.findMany({
      where,
      include: { categoryRecord: { include: { parent: true } } },
      orderBy: { createdAt: "desc" },
      skip: admin ? (page - 1) * pageSize : undefined,
      take: admin ? pageSize : undefined
    }),
    prisma.creativePack.count({ where }),
    prisma.creativePack.count({ where: { siteId, status: "active" } }),
    prisma.creativePack.count({ where: { siteId, status: "draft" } }),
    prisma.creativePack.count({ where: { siteId, status: "paused" } })
  ]);
  return NextResponse.json({
    ok: true,
    packs: packs.map((pack) => {
      const creativePack = toCreativePack(pack);
      return admin ? creativePack : { ...creativePack, prompt: undefined };
    }),
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

export async function HEAD(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  return new Response(null, { status: site ? 200 : 404 });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET,HEAD,POST,OPTIONS" }
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<CreativePack>;
  try {
    const result = await upsertCreativePackRelational({
      siteId,
      name: body.name ?? "",
      headline: body.headline ?? "",
      description: body.description ?? "",
      prompt: body.prompt,
      category: body.category ?? "headshots",
      aiAppSlug: body.aiAppSlug ?? "",
      status: body.status ?? "draft",
      creditCost: Number(body.creditCost),
      outputCount: Number(body.outputCount),
      trainingRequired: Boolean(body.trainingRequired),
      imageUrl: body.imageUrl,
      categoryId: body.categoryId,
      galleryImages: body.galleryImages
    });
    clearPublicCreativePacksCache();
    return NextResponse.json({ ok: true, pack: result.pack, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "creative_pack_create_failed" }, { status });
  }
}
