import fs from "fs";
import path from "path";
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

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const safeSegments = segments.filter((segment) => segment && segment !== ".." && !segment.includes("\\"));
  if (safeSegments.length !== segments.length) {
    return NextResponse.json({ error: "unsafe_asset_path" }, { status: 400 });
  }
  const siteIndex = safeSegments.indexOf("sites");
  const customerIndex = safeSegments.indexOf("customers");
  if (siteIndex >= 0 && customerIndex >= 0) {
    const siteId = safeSegments[siteIndex + 1];
    const customerId = safeSegments[customerIndex + 1];
    if (!siteId || !customerId || !(await hasCustomerSession(siteId, customerId))) {
      return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
    }
  }
  const filePath = path.join(assetRoot, ...safeSegments);
  if (!filePath.startsWith(assetRoot) || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
  }
  const extension = path.extname(filePath).toLowerCase();
  return new Response(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": mimeByExtension[extension] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60"
    }
  });
}
