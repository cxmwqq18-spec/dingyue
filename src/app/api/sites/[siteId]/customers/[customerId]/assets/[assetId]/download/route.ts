import { NextResponse } from "next/server";
import { hasCustomerSession, hasSiteAdminSession, requireCustomerMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import {
  createAssetDownloadLinkRelational,
  getCustomerAssetRelational,
  readCustomerAssetFileByStorageKey,
  recordCustomerAssetDownloadRelational
} from "@/lib/stores/asset-store";
import { generateVideoPosterBytes } from "@/lib/media-watermark";
import { signWorkerAssetDownload } from "@/lib/worker";
import type { NextRequest } from "next/server";

function parseByteRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | undefined {
  if (!header?.startsWith("bytes=") || size <= 0) return undefined;
  const range = header.slice("bytes=".length).split(",")[0]?.trim();
  if (!range || !range.includes("-")) return undefined;
  const [startValue, endValue] = range.split("-", 2);
  if (!startValue) {
    const suffixLength = Number(endValue);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "unsatisfiable";
    return { start: Math.max(size - Math.trunc(suffixLength), 0), end: size - 1 };
  }
  const start = Number(startValue);
  const end = endValue ? Number(endValue) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "unsatisfiable";
  const normalizedStart = Math.trunc(start);
  const normalizedEnd = Math.min(Math.trunc(end), size - 1);
  if (normalizedStart < 0 || normalizedStart >= size || normalizedEnd < normalizedStart) return "unsatisfiable";
  return { start: normalizedStart, end: normalizedEnd };
}

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
  const wantsPoster = url.searchParams.get("poster") === "1";
  const expiresAt = url.searchParams.get("expiresAt") ?? "";
  const signature = url.searchParams.get("signature") ?? "";
  const workerSignatureValid = Boolean(
    isWorkerDownload &&
    expiresAt &&
    signature &&
    Date.parse(expiresAt) > Date.now() &&
    signature === signWorkerAssetDownload({ siteId, customerId, assetId, expiresAt })
  );
  const customerSessionValid = workerSignatureValid || (await hasCustomerSession(siteId, customerId));
  const siteAdminSessionValid = customerSessionValid ? false : await hasSiteAdminSession(siteId);
  if (!customerSessionValid && !siteAdminSessionValid) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  try {
    const { asset } = await getCustomerAssetRelational({ siteId, customerId, assetId });
    const result = await readCustomerAssetFileByStorageKey({ siteId, customerId, asset });
    const mimeType = result.mimeType || result.asset.mimeType;
    if (wantsPoster && mimeType.startsWith("video/")) {
      const poster = await generateVideoPosterBytes({ bytes: result.bytes });
      return new Response(new Uint8Array(poster), {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(poster.length),
          "Content-Disposition": `inline; filename="${result.asset.id}.jpg"`,
          "Cache-Control": "private, max-age=600"
        }
      });
    }
    const extension = mimeType.split("/")[1]?.replace(/[^a-z0-9]+/gi, "") || "bin";
    const range = parseByteRange(request.headers.get("range"), result.bytes.length);
    const shouldRecordCustomerDownload = customerSessionValid && !workerSignatureValid && !siteAdminSessionValid && !isInlinePreview && !wantsPoster && !range;
    if (range === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${result.bytes.length}`
        }
      });
    }
    const contentDisposition = `${isInlinePreview ? "inline" : "attachment"}; filename="${result.asset.id}.${extension}"`;
    if (range) {
      const chunk = result.bytes.subarray(range.start, range.end + 1);
      return new Response(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${range.start}-${range.end}/${result.bytes.length}`,
          "Accept-Ranges": "bytes",
          "Content-Disposition": contentDisposition,
          ...(isInlinePreview ? { "Cache-Control": "private, max-age=600" } : {})
        }
      });
    }
    if (shouldRecordCustomerDownload) {
      await recordCustomerAssetDownloadRelational({ siteId, customerId, asset: result.asset, source: "download" }).catch((error) => {
        console.error("customer_asset_download_record_failed", error);
      });
    }
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(result.bytes.length),
        "Accept-Ranges": "bytes",
        "Content-Disposition": contentDisposition,
        ...(isInlinePreview ? { "Cache-Control": "private, max-age=600" } : {})
      }
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_download_failed" }, { status });
  }
}
