import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { toMediaAsset } from "@/lib/stores/prisma-mappers";
import { getSiteMediaSummaryRelational } from "@/lib/stores/site-store";
import { upsertThemeMediaAssetRelational } from "@/lib/stores/theme-store";
import type { MediaAsset } from "@/lib/types";

const maxImageUploadBytes = 12 * 1024 * 1024;
const maxVideoUploadBytes = 80 * 1024 * 1024;
const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const allowedVideoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const allowedMediaMimeTypes = new Set([...allowedImageMimeTypes, ...allowedVideoMimeTypes]);

function boundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function extensionFor(file: File) {
  const existing = extname(file.name).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov"].includes(existing)) return existing;
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/gif") return ".gif";
  if (file.type === "video/mp4") return ".mp4";
  if (file.type === "video/webm") return ".webm";
  if (file.type === "video/quicktime") return ".mov";
  return ".bin";
}

function safeName(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function usageFromValue(value: FormDataEntryValue | null): MediaAsset["usage"] {
  if (typeof value === "string" && ["theme", "pack_cover", "policy", "brand"].includes(value)) {
    return value as MediaAsset["usage"];
  }
  return "theme";
}

async function handleMultipartUpload(siteId: string, request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "upload_file_required" }, { status: 400 });
  }
  if (!allowedMediaMimeTypes.has(file.type)) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }
  const maxUploadBytes = allowedVideoMimeTypes.has(file.type) ? maxVideoUploadBytes : maxImageUploadBytes;
  if (file.size > maxUploadBytes) {
    return NextResponse.json({ error: allowedVideoMimeTypes.has(file.type) ? "video_too_large" : "image_too_large" }, { status: 413 });
  }

  const isVideo = allowedVideoMimeTypes.has(file.type);
  const labelValue = form.get("label");
  const label = typeof labelValue === "string" && labelValue.trim().length >= 2 ? labelValue.trim() : file.name || (isVideo ? "站点视频" : "站点图片");
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName(file.name) || (isVideo ? "video" : "image")}${extensionFor(file)}`;
  const storageKey = `sites/${siteId}/creative-packs/${filename}`;
  const publicUrl = `/assets/${storageKey}`;
  const directory = join(process.cwd(), "public", "assets", "sites", siteId, "creative-packs");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), Buffer.from(await file.arrayBuffer()));

  const result = await upsertThemeMediaAssetRelational({
    siteId,
    label,
    storageKey,
    mimeType: file.type,
    usage: usageFromValue(form.get("usage")),
    sourceType: "site_upload",
    previewUrl: publicUrl,
    originUrl: publicUrl,
    altText: label
  });
  return NextResponse.json({ ok: true, asset: result.asset, created: result.created, url: publicUrl });
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
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    try {
      return await handleMultipartUpload(siteId, request);
    } catch (error) {
      const status = error instanceof StoreError ? error.status : 500;
      return NextResponse.json({ error: error instanceof Error ? error.message : "theme_media_upload_failed" }, { status });
    }
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
