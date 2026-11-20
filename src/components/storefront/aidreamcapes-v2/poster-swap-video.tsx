"use client";

import { useState } from "react";

/**
 * Poster-first media slot for indexable landing sections.
 *
 * Google reports any <video> it finds on a page that is not the clip's watch
 * page as "video not on a watch page", so the server-rendered HTML of a
 * landing section must stay poster-only. Visitors still get the clip: pointing
 * at (or focusing) the slot mounts the <video> and plays it. Because the swap
 * happens after hydration, the crawlable markup never contains a video
 * element, and the dedicated /watch/<slug> page stays the single indexable
 * player. The wrapper is display:contents so the slot keeps the exact layout
 * contract of the element it replaces.
 */
export function PosterSwapVideo({
  alt,
  className,
  eager = false,
  height,
  poster,
  src,
  width
}: {
  alt: string;
  className?: string;
  eager?: boolean;
  height?: number;
  poster: string;
  src: string;
  width?: number;
}) {
  const [active, setActive] = useState(false);
  return (
    <span
      onBlur={() => setActive(false)}
      onFocus={() => setActive(true)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") setActive(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") setActive(false);
      }}
      style={{ display: "contents" }}
    >
      {active ? (
        <video
          aria-label={alt}
          autoPlay
          className={className}
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
          src={poster}
          width={width}
        />
      )}
    </span>
  );
}
