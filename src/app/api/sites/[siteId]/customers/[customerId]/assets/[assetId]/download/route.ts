import { NextResponse } from "next/server";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { hasCustomerSession, hasSiteAdminSession, requireCustomerMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import {
  createAssetDownloadLinkRelational,
  getCustomerAssetRelational,
  readCustomerAssetFileByStorageKey,
  recordCustomerAssetDownloadRelational
} from "@/lib/stores/asset-store";
import { customerAssetFilePath, customerAssetRoot } from "@/lib/customer-asset-storage";
import { generateVideoPosterBytes } from "@/lib/media-watermark";
import { previewXAccelPathFor, resolveVideoPosterFile, resolveWebVideo } from "@/lib/media-web-transcode";
import { signWorkerAssetDownload } from "@/lib/worker";
import type { NextRequest } from "next/server";

const previewImmutableCache = "private, max-age=86400, immutable";

function customerAssetAccelPath(filePath: string): string | undefined {
  const configured = process.env.CUSTOMER_ASSET_X_ACCEL_PREFIX?.trim();
  if (!configured) return undefined;
  const root = customerAssetRoot();
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  const prefix = configured.endsWith("/") ? configured : `${configured}/`;
  return `${prefix}${relative.split(path.sep).map(encodeURIComponent).join("/")}`;
}

/** Serve a cached sidecar (poster/web copy) with range support and X-Accel. */
async function serveAssetFile(request: Request, filePath: string, contentType: string, size: number, disposition: string): Promise<Response> {
  const range = parseByteRange(request.headers.get("range"), size);
  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${size}`, "Cache-Control": previewImmutableCache }
    });
  }
  const accel = customerAssetAccelPath(filePath) ?? previewXAccelPathFor(filePath);
  if (accel) {
    return new Response(null, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Accept-Ranges": "bytes",
        "Cache-Control": previewImmutableCache,
        "X-Robots-Tag": "noindex, nofollow",
        "X-Accel-Redirect": accel
      }
    });
  }
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "Accept-Ranges": "bytes",
    "Cache-Control": previewImmutableCache,
    "X-Robots-Tag": "noindex, nofollow"
  };
  if (range) {
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${size}`;
    headers["Content-Length"] = String(range.end - range.start + 1);
  } else {
    headers["Content-Length"] = String(size);
  }
  const handle = await fsp.open(filePath, "r");
  const stream = handle.createReadStream(range ? { start: range.start, end: range.end, autoClose: true } : { autoClose: true });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
}

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
  const wantsWeb = url.searchParams.get("web") === "1";
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
    // When the file is local, posters and 720p playback copies are generated
    // once and cached next to it; the full file is only read for downloads.
    const localPath = asset.storageKey ? customerAssetFilePath(asset.storageKey) : undefined;
    const localVideo = localPath && asset.mimeType.startsWith("video/") && fs.existsSync(localPath) ? localPath : undefined;
    if (localVideo && wantsPoster) {
      const poster = await resolveVideoPosterFile(localVideo);
      return await serveAssetFile(request, poster.filePath, "image/jpeg", poster.size, `inline; filename="${asset.id}.jpg"`);
    }
    if (localVideo && wantsWeb) {
      const web = await resolveWebVideo(localVideo);
      return await serveAssetFile(request, web.filePath, "video/mp4", web.size, `inline; filename="${asset.id}-preview.mp4"`);
    }
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
