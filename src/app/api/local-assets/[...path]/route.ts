import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { hasCustomerSession, hasSiteAdminSession } from "@/lib/api-auth";
import { contentTypeForCustomerAssetPath, customerAssetFilePathFromSegments, hasRemoteCustomerAssetReadSource, readCustomerAssetFileRemote } from "@/lib/customer-asset-storage";
import { verifyWorkerLocalAssetDownload } from "@/lib/worker";

const missingAssetPlaceholder = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" role="img" aria-label="Asset unavailable">
  <rect width="320" height="320" rx="28" fill="#f4f7f6"/>
  <path d="M78 219l52-63 39 47 25-31 48 47H78z" fill="#cbd8d4"/>
  <circle cx="215" cy="112" r="23" fill="#dbe5e2"/>
  <rect x="65" y="65" width="190" height="190" rx="22" fill="none" stroke="#b9cbc6" stroke-width="10"/>
</svg>`
);

type ResolvedAsset = {
  filePath?: string;
  size: number;
  contentType: string;
  bytes?: Buffer;
  placeholder?: boolean;
};

function parseByteRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | undefined {
  if (!header?.startsWith("bytes=") || size <= 0) return undefined;
  const range = header.slice("bytes=".length).split(",")[0]?.trim();
  if (!range || !range.includes("-")) return undefined;
  const [startValue, endValue] = range.split("-", 2);
  if (!startValue) {
    const suffixLength = Number(endValue);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "unsatisfiable";
    const start = Math.max(size - Math.trunc(suffixLength), 0);
    return { start, end: size - 1 };
  }
  const start = Number(startValue);
  const end = endValue ? Number(endValue) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "unsatisfiable";
  const normalizedStart = Math.trunc(start);
  const normalizedEnd = Math.min(Math.trunc(end), size - 1);
  if (normalizedStart < 0 || normalizedStart >= size || normalizedEnd < normalizedStart) return "unsatisfiable";
  return { start: normalizedStart, end: normalizedEnd };
}

function assetHeaders(asset: ResolvedAsset, contentLength: number, extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": asset.contentType,
    "Content-Length": String(contentLength),
    "Accept-Ranges": "bytes",
    "Cache-Control": asset.placeholder ? "private, max-age=300" : "private, max-age=60",
    ...(asset.placeholder ? { "X-Asset-Placeholder": "missing" } : {}),
    ...extra
  };
}

async function resolveAsset(request: Request, params: Promise<{ path: string[] }>) {
  const { path: segments } = await params;
  const safeSegments = segments.filter((segment) => segment && segment !== ".." && !segment.includes("\\"));
  if (safeSegments.length !== segments.length) {
    return { error: "unsafe_asset_path", status: 400 as const };
  }
  let filePath = "";
  try {
    filePath = customerAssetFilePathFromSegments(safeSegments);
  } catch {
    return { error: "asset_not_found", status: 404 as const };
  }
  const siteIndex = safeSegments.indexOf("sites");
  const customerIndex = safeSegments.indexOf("customers");
  if (siteIndex >= 0 && customerIndex >= 0) {
    const siteId = safeSegments[siteIndex + 1];
    const customerId = safeSegments[customerIndex + 1];
    const storageKey = safeSegments.join("/");
    const url = new URL(request.url);
    const workerSignatureValid = url.searchParams.get("worker") === "1" && verifyWorkerLocalAssetDownload({
      storageKey,
      expiresAt: url.searchParams.get("expiresAt") ?? "",
      signature: url.searchParams.get("signature") ?? ""
    });
    const hasAccess = siteId && customerId
      ? workerSignatureValid || (await hasCustomerSession(siteId, customerId)) || (await hasSiteAdminSession(siteId))
      : false;
    if (!hasAccess) {
      return { error: "customer_login_required", status: 401 as const };
    }
  }
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    if (siteIndex >= 0 && customerIndex >= 0) {
      if (hasRemoteCustomerAssetReadSource()) {
        try {
          const remote = await readCustomerAssetFileRemote({ storageKey: safeSegments.join("/") });
          return {
            filePath: undefined,
            size: remote.bytes.length,
            contentType: remote.mimeType,
            bytes: remote.bytes
          };
        } catch {
          // Fall through to the placeholder so broken remote assets do not crash the workspace.
        }
      }
      return {
        filePath: undefined,
        size: missingAssetPlaceholder.length,
        contentType: "image/svg+xml",
        bytes: missingAssetPlaceholder,
        placeholder: true
      };
    }
    return { error: "asset_not_found", status: 404 as const };
  }
  return {
    filePath,
    size: fileStat.size,
    contentType: contentTypeForCustomerAssetPath(filePath)
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const asset = await resolveAsset(_request, params);
    if ("error" in asset) {
      const headers = asset.status === 404 ? { "Cache-Control": "private, max-age=30" } : undefined;
      return NextResponse.json({ error: asset.error }, { status: asset.status, headers });
    }
    const bytes = "bytes" in asset && asset.bytes
      ? new Uint8Array(asset.bytes)
      : new Uint8Array(await readFile(asset.filePath));
    const range = parseByteRange(_request.headers.get("range"), asset.size);
    if (range === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${asset.size}`,
          "Accept-Ranges": "bytes"
        }
      });
    }
    if (range) {
      const chunk = bytes.subarray(range.start, range.end + 1);
      return new Response(chunk, {
        status: 206,
        headers: assetHeaders(asset, chunk.byteLength, {
          "Content-Range": `bytes ${range.start}-${range.end}/${asset.size}`
        })
      });
    }
    return new Response(bytes, {
      headers: assetHeaders(asset, asset.size)
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "asset_read_failed" },
      { status: 500 }
    );
  }
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const asset = await resolveAsset(_request, params);
    if ("error" in asset) {
      const headers = asset.status === 404 ? { "Cache-Control": "private, max-age=30" } : undefined;
      return new Response(null, { status: asset.status, headers });
    }
    return new Response(null, {
      headers: assetHeaders(asset, asset.size)
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET,HEAD,OPTIONS" }
  });
}
