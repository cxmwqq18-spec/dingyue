"use client";

// Grid continuation for the /templates example gallery. The server renders
// the first page of gallery cards inside the SSR grid; this component mounts
// as the grid's last cell block and appends the remaining pages into the SAME
// grid — an observer near the bottom fetches the next chunk automatically and
// a button does the same on demand. No navigation, no history entries, no
// scroll reset. Without JavaScript nothing renders here: the SSR page keeps
// its first page (and any deep-linked ?page content) as the no-JS experience.
//
// Returning from a detail page: the browser restores scroll natively, but the
// client-appended cards would be gone. The loaded offset is mirrored to
// sessionStorage; on a back/forward navigation this component refetches the
// difference before the browser clamps the restored scroll position.

import { useCallback, useEffect, useRef, useState } from "react";
import { Adc2VideoPreview, type Adc2VideoPreviewMedia } from "./video-preview-card";

const GALLERY_CARDS_ENDPOINT = "/api/aidreamcapes/gallery-cards";
const SENTINEL_ROOT_MARGIN = "600px";
// Chain continuation while the sentinel stays inside the (margin-extended)
// viewport, so fast scrolling never shows an empty gap. Capped defensively.
const MAX_CHAINED_PAGES = 20;
const RESTORE_BATCH = 50;
const SESSION_KEY_PREFIX = "adc2-gallery-offset-";

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

type GallerySessionState = { offset: number; y: number };

function sessionKey(kind?: "photo" | "video"): string {
  return `${SESSION_KEY_PREFIX}${window.location.pathname}#${kind ?? "all"}`;
}

function readSessionState(kind?: "photo" | "video"): GallerySessionState | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GallerySessionState>;
    if (typeof parsed.offset !== "number" || !Number.isFinite(parsed.offset)) return null;
    return { offset: Math.floor(parsed.offset), y: typeof parsed.y === "number" && Number.isFinite(parsed.y) ? Math.floor(parsed.y) : 0 };
  } catch {
    return null;
  }
}

function writeSessionState(state: GallerySessionState, kind?: "photo" | "video"): void {
  try {
    sessionStorage.setItem(sessionKey(kind), JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode); continuation still works.
  }
}

export function GalleryGridLoader({ total, initialOffset, pageSize, increment = 8, kind, hrefPrefix }: {
  total: number;
  /** How many cards the server already rendered (page 1 size, or more on deep-linked ?page URLs). */
  initialOffset: number;
  pageSize: number;
  /** Cards added per scroll continuation (smaller than the SSR first page on purpose). */
  increment?: number;
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

  const loadMore = useCallback(async (requestedLimit?: number) => {
    if (loadingRef.current || offsetRef.current >= total) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const limit = Math.max(1, requestedLimit ?? increment);
      const query = new URLSearchParams({ offset: String(offsetRef.current), limit: String(limit) });
      if (kind) query.set("kind", kind);
      const response = await fetch(`${GALLERY_CARDS_ENDPOINT}?${query.toString()}`);
      if (!response.ok) return;
      const body = (await response.json()) as GalleryCardsResponse;
      offsetRef.current = body.nextOffset ?? body.total;
      setLoadedOffset(offsetRef.current);
      setCards((previous) => [...previous, ...body.items]);
      writeSessionState({ offset: offsetRef.current, y: readSessionState(kind)?.y ?? 0 }, kind);
    } catch {
      // Network hiccup: the button stays available for a manual retry.
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [increment, kind, total]);

  // The IntersectionObserver callback can fire while a request is still in
  // flight (loadingRef true), and after that request settles no new
  // intersection event arrives — the sentinel never loads again. Instead of
  // relying solely on observer events, chain continuation: after each settled
  // page, wait one frame (so the freshly appended cards shift the sentinel
  // down in layout), then re-measure; if the sentinel is still inside the
  // margin-extended viewport, fetch the next chunk immediately.
  const chainIfNeeded = useCallback(async (depth: number) => {
    if (depth >= MAX_CHAINED_PAGES || loadingRef.current) return;
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const top = sentinel.getBoundingClientRect().top;
    if (top > window.innerHeight + 600) return;
    await loadMore();
    await chainIfNeeded(depth + 1);
  }, [loadMore]);

  const onObserverTick = useCallback(() => {
    if (loadingRef.current) {
      // A request is settling; chainIfNeeded will resume from its completion.
      return;
    }
    void chainIfNeeded(0);
  }, [chainIfNeeded]);

  // Back/forward restoration: refetch everything between the SSR first page
  // and the offset mirrored before the user navigated away, then re-apply the
  // saved scroll position — the browser clamps scroll to the short SSR
  // document before client cards exist.
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const restore = async () => {
      const saved = readSessionState(kind);
      if (!saved || saved.offset <= offsetRef.current || saved.offset > total) return;
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const isBackForward = nav ? nav.type === "back_forward" : false;
      if (!isBackForward) {
        // Fresh visit: keep the saved offset as a floor only when the SSR
        // page already carries it (deep-linked ?page URLs).
        if (saved.offset > initialOffset) return;
      }
      try {
        sessionStorage.removeItem(sessionKey(kind));
      } catch { /* ignore */ }
      loadingRef.current = true;
      setLoading(true);
      try {
        while (!cancelled && offsetRef.current < saved.offset) {
          const limit = Math.min(RESTORE_BATCH, saved.offset - offsetRef.current);
          const query = new URLSearchParams({ offset: String(offsetRef.current), limit: String(limit) });
          if (kind) query.set("kind", kind);
          const response = await fetch(`${GALLERY_CARDS_ENDPOINT}?${query.toString()}`);
          if (!response.ok) break;
          const body = (await response.json()) as GalleryCardsResponse;
          if (!body.items.length) break;
          offsetRef.current = body.nextOffset ?? body.total;
          setLoadedOffset(offsetRef.current);
          setCards((previous) => [...previous, ...body.items]);
          // Give React a frame to append the batch so the document grows
          // before the next range request and the final scroll re-apply.
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        }
        if (!cancelled && saved.y > 0) window.scrollTo(0, saved.y);
      } catch {
        // Partial restore still beats a blank tail; the button covers the rest.
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [initialOffset, kind, mounted, total]);

  // Mirror the live scroll position so a back/forward navigation can land the
  // user exactly where they were, even after client-appended cards.
  useEffect(() => {
    if (!mounted) return;
    const onPagehide = () => {
      if (offsetRef.current <= initialOffset) return;
      writeSessionState({ offset: offsetRef.current, y: Math.round(window.scrollY) }, kind);
    };
    window.addEventListener("pagehide", onPagehide);
    return () => window.removeEventListener("pagehide", onPagehide);
  }, [initialOffset, kind, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onObserverTick();
    }, { rootMargin: SENTINEL_ROOT_MARGIN });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mounted, onObserverTick]);

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
          <button className="btn btn-ghost v-picker-more-btn" disabled={loading} onClick={() => void chainIfNeeded(0)} type="button">
            {loading ? "Loading…" : "Load more examples"}
          </button>
        </div>
      )}
    </>
  );
}
