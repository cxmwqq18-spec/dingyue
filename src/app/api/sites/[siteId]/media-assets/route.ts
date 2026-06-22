import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { getSiteMediaAssetsFromState, readPlatformState, StoreError } from "@/lib/server-store";
import { upsertThemeMediaAssetRelational } from "@/lib/stores/theme-store";
import type { MediaAsset } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const state = readPlatformState();
  if (!state.sites.some((site) => site.id === siteId)) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    assets: getSiteMediaAssetsFromState(state, siteId)
  });
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const state = readPlatformState();
  return new Response(null, { status: state.sites.some((site) => site.id === siteId) ? 200 : 404 });
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
