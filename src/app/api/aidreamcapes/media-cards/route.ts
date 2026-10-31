// Public pagination for the /ai-video-generation picker grid.
//
// The hub page server-renders the first page of picker cards; this endpoint
// serves the remaining pages as lightweight card DTOs. It reads the same
// LivePage row the SSR renderer reads, so the two stay in lockstep, and only
// slices the `visual.picker.cards` array — no media is queried.
//
// Cache headers mirror the hub page's public storefront caching; the response
// is also whitelisted in next.config.mjs ahead of the private /api default.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mediaCardHref } from "@/lib/aidreamcapes-workspace/media-detail";
import { mediaCardCanonicalSlug } from "@/lib/aidreamcapes-workspace/media-card-canonical";
import { pickerPresetHref, presetSourcePage } from "@/lib/aidreamcapes-workspace/preset-contract";
import type { V2Data, V2Visual, V2VisualPickerCard } from "@/components/storefront/aidreamcapes-v2/types";

export const dynamic = "force-dynamic";

const AIVIDEOSUGC_SITE_ID = "site_aidreamcapes";
const VIDEO_HUB_SLUG = "/ai-video-generation";
const AIVIDEOSUGC_V2_SECTION_TYPE = "aidreamcapes_v2_page";
const MAX_LIMIT = 50;

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800"
};

type HubCardDto = {
  key: string;
  label: string;
  href: string;
  kind: "photo" | "video";
  chips: string;
  filterIndexes: string;
  image: { src: string; alt: string; w: number; h: number };
  video: null | { src: string; poster: string; width?: number; height?: number; duration?: number; name?: string };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset"))) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(url.searchParams.get("limit"))) || 20));

  const row = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: AIVIDEOSUGC_SITE_ID, slug: VIDEO_HUB_SLUG } },
    select: { contentJson: true }
  });
  const picker = readVideoHubPicker(row?.contentJson);
  if (!picker) {
    return NextResponse.json({ items: [] as HubCardDto[], total: 0, nextOffset: null }, { headers: CACHE_HEADERS });
  }

  // Same href resolution the SSR picker uses (visual.tsx): detail slug first,
  // then the preset tool path. sourcePage follows pickerSourcePage() in the
  // v2 page module — the hub is never "home", so it reads the last crumb.
  const crumbs = Array.isArray(picker.data.breadcrumbs) ? picker.data.breadcrumbs : [];
  const sourcePage = presetSourcePage(crumbs.at(-1)?.href);
  const chipIndex = (chipId: string) => picker.chips.findIndex((chip) => chip.id === chipId) + 1;

  const items = picker.cards.slice(offset, offset + limit).map((card, index): HubCardDto => ({
    key: `${card.image.src}-${offset + index}`,
    label: card.label,
    href: mediaCardHref(card.kind, mediaCardCanonicalSlug(card), pickerPresetHref(card, sourcePage)),
    kind: card.kind,
    chips: card.chips.join(" "),
    filterIndexes: card.chips.map(chipIndex).filter((index) => index > 0).join(" "),
    image: { src: card.image.src, alt: card.image.alt, w: card.image.w, h: card.image.h },
    video: card.video ? {
      // These hub assets are plain public paths; the SSR asset resolver's
      // rewrite chain is an identity for them (every rewrite is guarded by
      // another site or a legacy path), so the raw stored path is served.
      src: card.video.src,
      poster: card.video.poster.src,
      ...(card.video.width ? { width: card.video.width } : {}),
      ...(card.video.height ? { height: card.video.height } : {}),
      ...(card.video.duration ? { duration: card.video.duration } : {}),
      ...(card.video.name ? { name: card.video.name } : {})
    } : null
  }));

  const total = picker.cards.length;
  return NextResponse.json({
    items,
    total,
    nextOffset: offset + limit < total ? offset + limit : null
  }, { headers: CACHE_HEADERS });
}

/** The `visual.picker` of the hub page row, with its owning V2Data for sourcePage. */
function readVideoHubPicker(contentJson: unknown): { data: V2Data; chips: { id: string }[]; cards: V2VisualPickerCard[] } | undefined {
  const content = contentJson as { sections?: Record<string, { type?: string; settings?: { data?: unknown } }> } | undefined;
  for (const section of Object.values(content?.sections ?? {})) {
    if (section?.type !== AIVIDEOSUGC_V2_SECTION_TYPE) continue;
    const data = section.settings?.data as V2Data | undefined;
    const visual = data?.visual as V2Visual | undefined;
    const chips = visual?.picker?.chips;
    const cards = visual?.picker?.cards;
    if (data && chips && Array.isArray(cards) && cards.length) {
      return { data, chips, cards };
    }
  }
  return undefined;
}
