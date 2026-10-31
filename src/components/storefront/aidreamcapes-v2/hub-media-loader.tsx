"use client";

// Video-hub pagination. The server renders the first page of picker cards;
// this loader appends the remaining pages client-side: an observer near the
// bottom fetches the next page automatically, and a button does the same on
// demand. Without JavaScript nothing renders here — the SSR page stays the
// complete no-JS experience.
//
// The extra grid sits inside the picker's filter scope, so the chip filter
// keeps covering appended cards (a hidden card never intersects, so it never
// plays). Cards reuse the Adc2VideoPreview poster-first behavior.

import { useCallback, useEffect, useRef, useState } from "react";
import { Adc2VideoPreview, type Adc2VideoPreviewMedia } from "./video-preview-card";

const MEDIA_CARDS_ENDPOINT = "/api/aidreamcapes/media-cards";
const SENTINEL_ROOT_MARGIN = "600px";

export type HubMediaCard = {
  key: string;
  label: string;
  href: string;
  kind: "photo" | "video";
  chips: string;
  filterIndexes: string;
  image: { src: string; alt: string };
  video: null | (Adc2VideoPreviewMedia & { name?: string });
};

type MediaCardsResponse = { items: HubMediaCard[]; total: number; nextOffset: number | null };

export function HubMediaLoader({ total, initialOffset, pageSize, hrefPrefix }: {
  total: number;
  initialOffset: number;
  pageSize: number;
  /** Storefront base path ("", or "/site/<slug>" in path mode) prefixed onto API hrefs. */
  hrefPrefix: string;
}) {
  const [cards, setCards] = useState<HubMediaCard[]>([]);
  const [loadedOffset, setLoadedOffset] = useState(initialOffset);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const offsetRef = useRef(initialOffset);

  useEffect(() => setMounted(true), []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || offsetRef.current >= total) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const response = await fetch(`${MEDIA_CARDS_ENDPOINT}?offset=${offsetRef.current}&limit=${pageSize}`);
      if (!response.ok) return;
      const body = (await response.json()) as MediaCardsResponse;
      setCards((previous) => [...previous, ...body.items]);
      offsetRef.current = body.nextOffset ?? body.total;
      setLoadedOffset(offsetRef.current);
    } catch {
      // Network hiccup: the button stays available for a manual retry.
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [pageSize, total]);

  useEffect(() => {
    if (!mounted) return;
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: SENTINEL_ROOT_MARGIN });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, mounted]);

  if (!mounted || initialOffset >= total) return null;
  const exhausted = loadedOffset >= total;
  return (
    <>
      <div className="v-picker-grid">
        {cards.map((card) => (
          <a className="v-pick-card" data-chips={card.chips} data-filter-indexes={card.filterIndexes} href={`${hrefPrefix}${card.href}`} key={card.key}>
            {card.video ? (
              <Adc2VideoPreview ariaLabel={card.video.name ?? card.label} media={card.video} />
            ) : <img alt={card.image.alt} loading="lazy" src={card.image.src} />}
            <span>{card.label}</span>
          </a>
        ))}
      </div>
      <div className="v-picker-more">
        {exhausted ? null : (
          <>
            <div className="v-picker-sentinel" ref={sentinelRef} />
            <button className="btn btn-grad v-picker-more-btn" disabled={loading} onClick={() => void loadMore()} type="button">
              {loading ? "加载中…" : "加载更多"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
