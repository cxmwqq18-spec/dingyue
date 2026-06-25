import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { deleteCreativePackRelational, upsertCreativePackRelational } from "@/lib/stores/site-store";
import type { CreativePack } from "@/lib/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ siteId: string; packId: string }> }
) {
  const { siteId, packId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<CreativePack>;
  try {
    const result = await upsertCreativePackRelational({
      siteId,
      packId,
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
      imageUrl: body.imageUrl
    });
    return NextResponse.json({ ok: true, pack: result.pack, created: result.created });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "creative_pack_save_failed" }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; packId: string }> }
) {
  const { siteId, packId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  try {
    const result = await deleteCreativePackRelational({ siteId, packId });
    return NextResponse.json({ ok: true, deletedPack: result.deletedPack });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "creative_pack_delete_failed" }, { status });
  }
}
