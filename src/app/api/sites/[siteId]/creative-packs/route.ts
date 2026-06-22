import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { getSiteCreativePacksFromState, readPlatformState, StoreError } from "@/lib/server-store";
import { upsertCreativePackRelational } from "@/lib/stores/site-store";
import type { CreativePack } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const state = readPlatformState();
  if (!state.sites.some((site) => site.id === siteId)) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    packs: getSiteCreativePacksFromState(state, siteId).filter((pack) => pack.status === "active")
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

  const body = (await request.json().catch(() => ({}))) as Partial<CreativePack>;
  try {
    const result = await upsertCreativePackRelational({
      siteId,
      name: body.name ?? "",
      headline: body.headline ?? "",
      description: body.description ?? "",
      category: body.category ?? "headshots",
      aiAppSlug: body.aiAppSlug ?? "",
      status: body.status ?? "draft",
      creditCost: Number(body.creditCost),
      outputCount: Number(body.outputCount),
      trainingRequired: Boolean(body.trainingRequired)
    });
    return NextResponse.json({ ok: true, pack: result.pack, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "creative_pack_create_failed" }, { status });
  }
}
