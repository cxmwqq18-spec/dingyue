import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError, upsertCreativePack } from "@/lib/server-store";
import type { CreativePack } from "@/lib/types";

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
    const result = upsertCreativePack({
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
