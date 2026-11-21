"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Poster-first media slot for indexable landing sections.
 *
 * Google reports any <video> it finds on a page that is not the clip's watch
 * page as "video not on a watch page", so the server-rendered HTML of a
 * landing section must stay poster-only. Visitors still get the clip playing
 * by default: the <video> mounts and autoplays as soon as the slot scrolls
 * into view (and immediately on hover or focus). Because the swap happens
 * after hydration, the crawlable markup never contains a video element, and
 * the dedicated /watch/<slug> page stays the single indexable player.
 *
 * The poster <img> is never removed. Mobile browsers with built-in
 * translation (UC Browser, Quark, and translated Safari pages) rewrite the
 * DOM and can move a React-managed node under a wrapper element; React then
 * throws `NotFoundError` from removeChild and the app error page replaces the
 * document. Keeping both nodes mounted and toggling `display` means React only
 * updates attributes and appends the player, operations that survive a
 * rewritten tree. The wrapper is display:contents so the slot keeps the exact
 * layout contract of the element it replaces.
 */
export function PosterSwapVideo({
  alt,
  className,
  controls = false,
  eager = false,
  height,
  poster,
  src,
  width
}: {
  alt: string;
  className?: string;
  /** Keep the native control bar on the mounted player (seek / mute). */
  controls?: boolean;
  eager?: boolean;
  height?: number;
  poster: string;
  src: string;
  width?: number;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = imageRef.current;
    // Without IntersectionObserver the visitor still gets the clip: mount it
    // rather than leaving a static poster behind.
    if (!element || typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      // Mount once; never unmount. Repeatedly creating and destroying media
      // elements while scrolling is what makes mobile browsers crash, and the
      // browser already pauses off-screen video on its own.
      if (entries.some((entry) => entry.isIntersecting)) {
        setActive(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      className="notranslate"
      onFocus={() => setActive(true)}
      onPointerEnter={() => setActive(true)}
      style={{ display: "contents" }}
      translate="no"
    >
      <img
        alt={alt}
        className={className}
        decoding="async"
        height={height}
        loading={eager ? "eager" : "lazy"}
        ref={imageRef}
        src={poster}
        style={active ? { display: "none" } : undefined}
        width={width}
      />
      {active ? (
        <video
          aria-label={alt}
          autoPlay
          className={className}
          controls={controls || undefined}
          height={height}
          loop
          muted
          playsInline
          poster={poster}
          preload="metadata"
          src={src}
          width={width}
        />
      ) : null}
    </span>
  );
}
