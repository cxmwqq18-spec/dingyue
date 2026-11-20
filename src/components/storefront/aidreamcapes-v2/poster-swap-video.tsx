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
 * the dedicated /watch/<slug> page stays the single indexable player. The
 * wrapper is display:contents so the slot keeps the exact layout contract of
 * the element it replaces.
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
    // Low-end phones: release the player back to its poster once the slot
    // leaves the 240px margin, so a long landing page never keeps dozens of
    // decoders alive. Desktops keep the paused player for instant resume.
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const observer = new IntersectionObserver((entries) => {
      const intersecting = entries.some((entry) => entry.isIntersecting);
      if (intersecting) {
        setActive(true);
      } else if (mobile) {
        setActive(false);
      }
    }, { rootMargin: "240px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      onFocus={() => setActive(true)}
      onPointerEnter={() => setActive(true)}
      style={{ display: "contents" }}
    >
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
      ) : (
        <img
          alt={alt}
          className={className}
          decoding="async"
          height={height}
          loading={eager ? "eager" : "lazy"}
          ref={imageRef}
          src={poster}
          width={width}
        />
      )}
    </span>
  );
}
