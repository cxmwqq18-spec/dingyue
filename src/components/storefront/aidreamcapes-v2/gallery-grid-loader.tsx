"use client";

// Grid continuation for the /templates example gallery. The server renders
// the first page of gallery cards inside the SSR grid; this component mounts
// as the grid's last cell block and appends the remaining pages into the SAME
// grid — an observer near the bottom fetches the next page automatically and
// a button does the same on demand. No navigation, no history entries, no
// scroll reset. Without JavaScript nothing renders here: the SSR page keeps
// its first page (and any deep-linked ?page content) as the no-JS experience.

import { useCallback, useEffect, useRef, useState } from "react";
import { Adc2VideoPreview, type Adc2VideoPreviewMedia } from "./video-preview-card";

const GALLERY_CARDS_ENDPOINT = "/api/aidreamcapes/gallery-cards";
const SENTINEL_ROOT_MARGIN = "600px";

export type GalleryCard = {
  key: string;
  kind: "photo" | "video";
  slug: string;
  label: string;
  href: string;
  image: { src: string; alt?: string; w?: number; h?: number };
  video: null | (Adc2VideoPreviewMedia & { name?: string });
};

type GalleryCardsResponse = { items: GalleryCard[]; total: number; nextOffset: number | null };

export function GalleryGridLoader({ total, initialOffset, pageSize, kind, hrefPrefix }: {
  total: number;
  /** How many cards the server already rendered (page 1 size, or more on deep-linked ?page URLs). */
  initialOffset: number;
  pageSize: number;
  kind?: "photo" | "video";
  /** Storefront base path ("", or "/site/<slug>" in path mode) prefixed onto API hrefs. */
  hrefPrefix: string;
}) {
  const [cards, setCards] = useState<GalleryCard[]>([]);
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
      const query = new URLSearchParams({ offset: String(offsetRef.current), limit: String(pageSize) });
      if (kind) query.set("kind", kind);
      const response = await fetch(`${GALLERY_CARDS_ENDPOINT}?${query.toString()}`);
      if (!response.ok) return;
      const body = (await response.json()) as GalleryCardsResponse;
      setCards((previous) => [...previous, ...body.items]);
      offsetRef.current = body.nextOffset ?? body.total;
      setLoadedOffset(offsetRef.current);
    } catch {
      // Network hiccup: the button stays available for a manual retry.
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [kind, pageSize, total]);

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
      {cards.map((card) => (
        <article className="tc" data-media-slug={card.slug} key={card.key}>
          <a className="ti" href={`${hrefPrefix}${card.href}`}>
            {card.video ? (
              <Adc2VideoPreview ariaLabel={card.video.name ?? card.label} media={card.video} />
            ) : <img alt={card.image.alt || card.label} decoding="async" height={card.image.h ?? 640} loading="lazy" src={card.image.src} width={card.image.w ?? 640} />}
          </a>
          <div className="tb"><span>{card.kind === "photo" ? "Photo example" : "Video example"}</span><h3><a href={`${hrefPrefix}${card.href}`}>{card.label}</a></h3></div>
        </article>
      ))}
      {exhausted ? null : (
        <div className="v-picker-more">
          <div className="v-picker-sentinel" ref={sentinelRef} />
          <button className="btn btn-ghost v-picker-more-btn" disabled={loading} onClick={() => void loadMore()} type="button">
            {loading ? "Loading…" : "Load more examples"}
          </button>
        </div>
      )}
    </>
  );
}
