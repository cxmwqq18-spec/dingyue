import { NextResponse } from "next/server";
import { hasCustomerSession, requireCustomerMutation } from "@/lib/api-auth";
import { createAssetDownloadLink, readCustomerAssetFile, StoreError } from "@/lib/server-store";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; customerId: string; assetId: string }> }
) {
  const { siteId, customerId, assetId } = await params;
  const guard = await requireCustomerMutation(request, siteId, customerId, { key: `${siteId}:${customerId}:asset-download` });
  if (!guard.ok) return guard.response;
  try {
    const result = createAssetDownloadLink({ siteId, customerId, assetId });
    return NextResponse.json({ ok: true, asset: result.asset, downloadUrl: result.downloadUrl, expiresAt: result.expiresAt });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_download_link_failed" }, { status });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string; customerId: string; assetId: string }> }
) {
  const { siteId, customerId, assetId } = await params;
  if (!(await hasCustomerSession(siteId, customerId))) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  const token = new URL(request.url).searchParams.get("token");
  try {
    if (!token) {
      return NextResponse.json({ error: "missing_download_token" }, { status: 400 });
    }
    const result = readCustomerAssetFile({ siteId, customerId, assetId });
    const extension = result.asset.mimeType.split("/")[1]?.replace(/[^a-z0-9]+/gi, "") || "bin";
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "Content-Type": result.asset.mimeType,
        "Content-Disposition": `attachment; filename="${result.asset.id}.${extension}"`
      }
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_download_failed" }, { status });
  }
}
