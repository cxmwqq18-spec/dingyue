import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { toMediaAsset } from "@/lib/stores/prisma-mappers";
import { getSiteMediaSummaryRelational } from "@/lib/stores/site-store";
import { upsertThemeMediaAssetRelational } from "@/lib/stores/theme-store";
import type { MediaAsset } from "@/lib/types";

function boundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }
  const url = new URL(request.url);
  const limit = boundedInt(url.searchParams.get("limit"), 40, 1, 200);
  const offset = boundedInt(url.searchParams.get("offset"), 0, 0, 10_000);
  const usage = url.searchParams.get("usage");
  const source = url.searchParams.get("source");
  const query = url.searchParams.get("q")?.trim();
  const where = {
    siteId,
    ...(usage && usage !== "all" ? { usageType: usage } : {}),
    ...(source && source !== "all" ? { sourceType: source } : {}),
    ...(query
      ? {
          OR: [
            { label: { contains: query, mode: "insensitive" as const } },
            { storageKey: { contains: query, mode: "insensitive" as const } },
            { mimeType: { contains: query, mode: "insensitive" as const } },
            { previewUrl: { contains: query, mode: "insensitive" as const } },
            { originUrl: { contains: query, mode: "insensitive" as const } },
            { altText: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {})
  };
  const [assets, total, summary] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: offset,
      take: limit
    }),
    prisma.mediaAsset.count({ where }),
    getSiteMediaSummaryRelational(siteId)
  ]);
  return NextResponse.json({
    ok: true,
    assets: assets.map(toMediaAsset),
    pageInfo: {
      limit,
      offset,
      total,
      hasMore: offset + assets.length < total
    },
    summary
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
  const body = (await request.json().catch(() => ({}))) as Partial<MediaAsset>;
  try {
    const result = await upsertThemeMediaAssetRelational({
      siteId,
      label: body.label ?? "",
      storageKey: body.storageKey ?? "",
      mimeType: body.mimeType ?? "",
      usage: body.usage ?? "theme",
      sourceType: body.sourceType ?? "manual",
      previewUrl: body.previewUrl,
      originUrl: body.originUrl,
      altText: body.altText,
      notes: body.notes
    });
    return NextResponse.json({ ok: true, asset: result.asset, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_media_create_failed" }, { status });
  }
}
