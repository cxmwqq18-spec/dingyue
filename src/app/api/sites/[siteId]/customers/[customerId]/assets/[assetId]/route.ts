import { NextResponse } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { deleteAssetUploadRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import type { NextRequest } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; customerId: string; assetId: string }> }
) {
  const { siteId, customerId, assetId } = await params;
  const guard = await requireCustomerMutation(request, siteId, customerId, { key: `${siteId}:${customerId}:asset-delete` });
  if (!guard.ok) return guard.response;
  try {
    const result = await deleteAssetUploadRelational({ siteId, customerId, assetId });
    return NextResponse.json({ ok: true, asset: toThemeRuntimeAssetRelational(result.asset) });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_delete_failed" }, { status });
  }
}
