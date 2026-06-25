import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { toCreativePack } from "@/lib/stores/prisma-mappers";
import { upsertCreativePackRelational } from "@/lib/stores/site-store";
import type { CreativePack } from "@/lib/types";

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }
  const url = new URL(request.url);
  const admin = await hasSiteAdminSession(siteId);
  const page = numberParam(url.searchParams.get("page"), 1, 1, 10000);
  const pageSize = numberParam(url.searchParams.get("pageSize"), admin ? 10 : 100, 1, 100);
  const query = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const app = url.searchParams.get("app")?.trim();
  const where: Prisma.CreativePackWhereInput = {
    siteId,
    status: admin && status ? status : admin ? undefined : "active",
    category: admin && category ? category : undefined,
    aiAppSlug: admin && app ? app : undefined,
    OR: admin && query
      ? [
          { name: { contains: query, mode: "insensitive" } },
          { headline: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { aiAppSlug: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { categoryRecord: { label: { contains: query, mode: "insensitive" } } }
        ]
      : undefined
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
    return NextResponse.json({ ok: true, pack: result.pack, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "creative_pack_create_failed" }, { status });
  }
}
