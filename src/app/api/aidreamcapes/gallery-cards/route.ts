// Public pagination for the /templates example gallery.
//
// The page server-renders the first page of gallery cards; this endpoint
// serves the remaining pages as lightweight card DTOs. It reuses the same
// enumeration the SSR gallery reads (single-owner media detail cards,
// newest first), so the two stay in lockstep.
//
// Cache headers mirror the storefront page's public caching; the response is
// also whitelisted in next.config.mjs ahead of the private /api default.

import { NextResponse } from "next/server";
import { listAidreamcapesExampleGalleryEntries } from "@/lib/aidreamcapes-workspace/media-cards.server";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800"
};

type GalleryCardDto = {
  key: string;
  kind: "photo" | "video";
  slug: string;
  label: string;
  href: string;
  image: { src: string; alt?: string; w?: number; h?: number };
  video: null | { src: string; poster: string; width?: number; height?: number; duration?: number; name?: string };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset"))) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(url.searchParams.get("limit"))) || 20));
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam === "video" || kindParam === "photo" ? kindParam : undefined;

  // Same enumeration the SSR gallery renders, so deep-linked ?page URLs and
  // client-loaded pages always agree.
  const all = (await listAidreamcapesExampleGalleryEntries()).filter((entry) => !kind || entry.kind === kind);
  const items = all.slice(offset, offset + limit).map((entry): GalleryCardDto => ({
    key: entry.slug,
    kind: entry.kind,
    slug: entry.slug,
    label: entry.label,
    href: entry.href,
    image: { src: entry.image.src, ...(entry.image.alt ? { alt: entry.image.alt } : {}), w: entry.image.w, h: entry.image.h },
    video: entry.video?.src ? {
      // These gallery assets are plain public paths; the SSR asset resolver's
      // rewrite chain is an identity for them, so raw stored paths are served.
      src: entry.video.src,
      poster: entry.video.poster?.src ?? entry.image.src,
      ...(entry.video.width ? { width: entry.video.width } : {}),
      ...(entry.video.height ? { height: entry.video.height } : {}),
      ...(entry.duration ? { duration: entry.duration } : {}),
      name: entry.label
    } : null
  }));

  const total = all.length;
  return NextResponse.json({
    items,
    total,
    nextOffset: offset + limit < total ? offset + limit : null
  }, { headers: CACHE_HEADERS });
}
