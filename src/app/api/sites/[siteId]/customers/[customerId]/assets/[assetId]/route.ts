import { NextResponse } from "next/server";
import { hasCustomerSession } from "@/lib/api-auth";
import { deleteAssetUpload, readPlatformState, StoreError, toThemeRuntimeAsset } from "@/lib/server-store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; customerId: string; assetId: string }> }
) {
  const { siteId, customerId, assetId } = await params;
  if (!(await hasCustomerSession(siteId, customerId))) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  try {
    const result = deleteAssetUpload({ siteId, customerId, assetId });
    const state = readPlatformState();
    return NextResponse.json({ ok: true, asset: toThemeRuntimeAsset(state, result.asset) });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_delete_failed" }, { status });
  }
}
