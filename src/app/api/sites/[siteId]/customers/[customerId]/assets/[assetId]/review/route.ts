import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { mutatePlatformState, readPlatformState, StoreError, toThemeRuntimeAsset } from "@/lib/server-store";
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
    let reviewedAsset: AssetUpload | undefined;
    mutatePlatformState((state) => {
      const customer = state.customers.find((item) => item.siteId === siteId && item.id === customerId);
      if (!customer) throw new StoreError("customer_not_found_for_site", 404);
      const asset = state.assetUploads.find(
        (item) => item.siteId === siteId && item.customerId === customerId && item.id === assetId && !item.deletedAt
      );
      if (!asset) throw new StoreError("asset_not_found_for_customer", 404);
      asset.reviewStatus = body.reviewStatus!;
      reviewedAsset = asset;
    });
    const state = readPlatformState();
    reviewedAsset = state.assetUploads.find(
      (item) => item.siteId === siteId && item.customerId === customerId && item.id === assetId && !item.deletedAt
    );
    if (!reviewedAsset) throw new StoreError("asset_review_failed", 500);
    return NextResponse.json({ ok: true, asset: toThemeRuntimeAsset(state, reviewedAsset) });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_review_failed" }, { status });
  }
}
