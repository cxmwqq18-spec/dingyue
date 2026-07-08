import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { hasCustomerSession, hasSiteAdminSession } from "@/lib/api-auth";
import { contentTypeForCustomerAssetPath, customerAssetFilePathFromSegments, hasRemoteCustomerAssetReadSource, readCustomerAssetFileRemote } from "@/lib/customer-asset-storage";

const missingAssetPlaceholder = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" role="img" aria-label="Asset unavailable">
  <rect width="320" height="320" rx="28" fill="#f4f7f6"/>
  <path d="M78 219l52-63 39 47 25-31 48 47H78z" fill="#cbd8d4"/>
  <circle cx="215" cy="112" r="23" fill="#dbe5e2"/>
  <rect x="65" y="65" width="190" height="190" rx="22" fill="none" stroke="#b9cbc6" stroke-width="10"/>
</svg>`
);

async function resolveAsset(params: Promise<{ path: string[] }>) {
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
    const hasAccess = siteId && customerId
      ? (await hasCustomerSession(siteId, customerId)) || (await hasSiteAdminSession(siteId))
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
    const asset = await resolveAsset(params);
    if ("error" in asset) {
      const headers = asset.status === 404 ? { "Cache-Control": "private, max-age=30" } : undefined;
      return NextResponse.json({ error: asset.error }, { status: asset.status, headers });
    }
    const bytes = "bytes" in asset && asset.bytes
      ? new Uint8Array(asset.bytes)
      : new Uint8Array(await readFile(asset.filePath));
    return new Response(bytes, {
      headers: {
        "Content-Type": asset.contentType,
        "Content-Length": String(asset.size),
        "Cache-Control": asset.placeholder ? "private, max-age=300" : "private, max-age=60",
        ...(asset.placeholder ? { "X-Asset-Placeholder": "missing" } : {})
      }
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
    const asset = await resolveAsset(params);
    if ("error" in asset) {
      const headers = asset.status === 404 ? { "Cache-Control": "private, max-age=30" } : undefined;
      return new Response(null, { status: asset.status, headers });
    }
    return new Response(null, {
      headers: {
        "Content-Type": asset.contentType,
        "Content-Length": String(asset.size),
        "Cache-Control": asset.placeholder ? "private, max-age=300" : "private, max-age=60",
        ...(asset.placeholder ? { "X-Asset-Placeholder": "missing" } : {})
      }
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
