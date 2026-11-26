import type { NextRequest } from "next/server";
import { hasCustomerSession } from "@/lib/api-auth";
import { AIDREAMCAPES_CREATE_INTENT_SITE_ID } from "@/lib/aidreamcapes-create-intent";
import { importImageFromUrl, ProductUrlImportError } from "@/lib/product-url-import";

export const runtime = "nodejs";

/**
 * Same-origin preview for product photos detected on a shop page.
 *
 * Several stores (IKEA among them) block cross-site hotlinking, so showing the
 * detected https image URLs directly leaves the import grid blank. This route
 * re-uses the importer's SSRF/MIME/size guards and serves the bytes from our
 * origin. It is customer-session scoped and only ever reads public images.
 */

type CachedImage = { bytes: Buffer; mimeType: string; expiresAt: number };

const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 120;
const cache = new Map<string, CachedImage>();

function cached(url: string): CachedImage | undefined {
  const hit = cache.get(url);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) { cache.delete(url); return undefined; }
  return hit;
}

function remember(url: string, image: CachedImage) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(url, image);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  if (siteId !== AIDREAMCAPES_CREATE_INTENT_SITE_ID) return new Response(null, { status: 404 });
  if (!(await hasCustomerSession(siteId, customerId))) return new Response(null, { status: 401 });

  const url = request.nextUrl.searchParams.get("url") ?? "";
  const hit = cached(url);
  if (hit) return imageResponse(hit);

  try {
    const image = await importImageFromUrl(url);
    const entry: CachedImage = { bytes: image.bytes, mimeType: image.mimeType, expiresAt: Date.now() + CACHE_TTL_MS };
    remember(url, entry);
    return imageResponse(entry);
  } catch (error) {
    const status = error instanceof ProductUrlImportError ? error.status : 502;
    return new Response(null, { status, headers: { "cache-control": "no-store" } });
  }
}

function imageResponse(image: CachedImage) {
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "content-type": image.mimeType,
      "content-length": String(image.bytes.length),
      "cache-control": "private, max-age=600",
      "x-content-type-options": "nosniff"
    }
  });
}
