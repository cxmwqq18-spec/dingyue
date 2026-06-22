import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { toThemeRuntimeAssetRelational, updateAssetReviewRelational } from "@/lib/stores/asset-store";
import type { NextRequest } from "next/server";
import type { AssetUpload } from "@/lib/types";

const reviewStatuses = new Set<AssetUpload["reviewStatus"]>(["pending", "approved", "rejected"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; customerId: string; assetId: string }> }
) {
  const { siteId, customerId, assetId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:asset-review` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { reviewStatus?: AssetUpload["reviewStatus"] };
  if (!body.reviewStatus || !reviewStatuses.has(body.reviewStatus)) {
    return NextResponse.json({ error: "invalid_asset_review_status" }, { status: 400 });
  }

  try {
    const result = await updateAssetReviewRelational({ siteId, customerId, assetId, reviewStatus: body.reviewStatus });
    return NextResponse.json({ ok: true, asset: toThemeRuntimeAssetRelational(result.asset) });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_review_failed" }, { status });
  }
}
