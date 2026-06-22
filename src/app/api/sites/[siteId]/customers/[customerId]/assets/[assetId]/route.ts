import { NextResponse } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { deleteAssetUpload, readPlatformState, StoreError, toThemeRuntimeAsset } from "@/lib/server-store";
import type { NextRequest } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; customerId: string; assetId: string }> }
) {
  const { siteId, customerId, assetId } = await params;
  const guard = await requireCustomerMutation(request, siteId, customerId, { key: `${siteId}:${customerId}:asset-delete` });
  if (!guard.ok) return guard.response;
  try {
    const result = deleteAssetUpload({ siteId, customerId, assetId });
    const state = readPlatformState();
    return NextResponse.json({ ok: true, asset: toThemeRuntimeAsset(state, result.asset) });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_delete_failed" }, { status });
  }
}
