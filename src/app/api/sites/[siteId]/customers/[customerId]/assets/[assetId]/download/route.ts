import { NextResponse } from "next/server";
import { hasCustomerSession, requireCustomerMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import {
  createAssetDownloadLinkRelational,
  getCustomerAssetRelational,
  readCustomerAssetFileByStorageKey
} from "@/lib/stores/asset-store";
import { signWorkerAssetDownload } from "@/lib/worker";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; customerId: string; assetId: string }> }
) {
  const { siteId, customerId, assetId } = await params;
  const guard = await requireCustomerMutation(request, siteId, customerId, { key: `${siteId}:${customerId}:asset-download` });
  if (!guard.ok) return guard.response;
  try {
    const result = await createAssetDownloadLinkRelational({ siteId, customerId, assetId });
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
  const url = new URL(request.url);
  const isWorkerDownload = url.searchParams.get("worker") === "1";
  const isInlinePreview = url.searchParams.get("preview") === "1";
  const expiresAt = url.searchParams.get("expiresAt") ?? "";
  const signature = url.searchParams.get("signature") ?? "";
  const workerSignatureValid = Boolean(
    isWorkerDownload &&
    expiresAt &&
    signature &&
    Date.parse(expiresAt) > Date.now() &&
    signature === signWorkerAssetDownload({ siteId, customerId, assetId, expiresAt })
  );
  if (!workerSignatureValid && !(await hasCustomerSession(siteId, customerId))) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  const token = url.searchParams.get("token");
  try {
    if (!token && !workerSignatureValid && !isInlinePreview) {
      return NextResponse.json({ error: "missing_download_token" }, { status: 400 });
    }
    const { asset } = await getCustomerAssetRelational({ siteId, customerId, assetId });
    const result = await readCustomerAssetFileByStorageKey({ siteId, customerId, asset });
    const mimeType = result.mimeType || result.asset.mimeType;
    const extension = mimeType.split("/")[1]?.replace(/[^a-z0-9]+/gi, "") || "bin";
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${isInlinePreview ? "inline" : "attachment"}; filename="${result.asset.id}.${extension}"`,
        ...(isInlinePreview ? { "Cache-Control": "private, max-age=600" } : {})
      }
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_download_failed" }, { status });
  }
}
