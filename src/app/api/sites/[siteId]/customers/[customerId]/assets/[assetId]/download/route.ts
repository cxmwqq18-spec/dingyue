import { NextResponse } from "next/server";
import { hasCustomerSession } from "@/lib/api-auth";
import { createAssetDownloadLink, StoreError } from "@/lib/server-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; customerId: string; assetId: string }> }
) {
  const { siteId, customerId, assetId } = await params;
  if (!(await hasCustomerSession(siteId, customerId))) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
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
    const result = createAssetDownloadLink({ siteId, customerId, assetId });
    if (!token) {
      return NextResponse.json({ error: "missing_download_token" }, { status: 400 });
    }
    return new Response(`dev-download:${result.asset.storageKey}\n`, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.asset.id}.txt"`
      }
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_download_failed" }, { status });
  }
}
