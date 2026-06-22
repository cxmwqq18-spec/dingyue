import fs from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { hasCustomerSession } from "@/lib/api-auth";

const assetRoot = path.join(process.cwd(), "data", "customer-assets");

const mimeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

async function resolveAsset(params: Promise<{ path: string[] }>) {
  const { path: segments } = await params;
  const safeSegments = segments.filter((segment) => segment && segment !== ".." && !segment.includes("\\"));
  if (safeSegments.length !== segments.length) {
    return { error: "unsafe_asset_path", status: 400 as const };
  }
  const siteIndex = safeSegments.indexOf("sites");
  const customerIndex = safeSegments.indexOf("customers");
  if (siteIndex >= 0 && customerIndex >= 0) {
    const siteId = safeSegments[siteIndex + 1];
    const customerId = safeSegments[customerIndex + 1];
    if (!siteId || !customerId || !(await hasCustomerSession(siteId, customerId))) {
      return { error: "customer_login_required", status: 401 as const };
    }
  }
  const filePath = path.join(assetRoot, ...safeSegments);
  if (!filePath.startsWith(assetRoot)) {
    return { error: "asset_not_found", status: 404 as const };
  }
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return { error: "asset_not_found", status: 404 as const };
  }
  const extension = path.extname(filePath).toLowerCase();
  return {
    filePath,
    size: fileStat.size,
    contentType: mimeByExtension[extension] ?? "application/octet-stream"
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const asset = await resolveAsset(params);
  if ("error" in asset) {
    return NextResponse.json({ error: asset.error }, { status: asset.status });
  }
  return new Response(Readable.toWeb(fs.createReadStream(asset.filePath)) as BodyInit, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.size),
      "Cache-Control": "private, max-age=60"
    }
  });
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const asset = await resolveAsset(params);
  if ("error" in asset) {
    return new Response(null, { status: asset.status });
  }
  return new Response(null, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.size),
      "Cache-Control": "private, max-age=60"
    }
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET,HEAD,OPTIONS" }
  });
}
