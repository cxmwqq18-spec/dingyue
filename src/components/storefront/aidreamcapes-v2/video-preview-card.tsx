"use client";

// Poster-first preview for list cards.
//
// Google discovers a <video> element on every indexable page and reports it as
// "video not on a watch page" when the page is not a dedicated watch page.
// Cards, hubs, articles and landing pages are not watch pages, so their SSR
// markup contains only the poster image. A real <video> mounts on pointer or
// keyboard focus, which keeps the hover preview for visitors without putting a
// video element in the crawlable HTML. The dedicated /watch/<slug> page owns
// the indexable player and VideoObject.

import { useState } from "react";

export type Adc2VideoPreviewMedia = {
  src: string;
  /** 10s low-bitrate clip; when present it replaces src for playback. */
  previewSrc?: string;
  poster: string;
  width?: number;
  height?: number;
  duration?: number;
  name?: string;
};

export function Adc2VideoPreview({ media, ariaLabel, showDuration = false, posterEager = true }: { media: Adc2VideoPreviewMedia; ariaLabel?: string; showDuration?: boolean; posterEager?: boolean }) {
  const [active, setActive] = useState(false);
  const label = ariaLabel ?? media.name;
  const ratio = media.width && media.height ? `${media.width} / ${media.height}` : undefined;

  return (
    <div
      className="v-preview-box"
      onBlur={() => setActive(false)}
      onFocus={() => setActive(true)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setActive(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setActive(false);
      }}
    >
      {active ? (
        <video
          aria-label={label}
          autoPlay
          data-adc2-preview=""
          height={media.height}
          loop
          muted
          playsInline
          poster={media.poster || undefined}
          preload="metadata"
          src={media.previewSrc ?? media.src}
          width={media.width}
        />
      ) : media.poster ? (
        <img
          alt={label ?? ""}
          decoding="async"
          height={media.height}
          loading={posterEager ? "eager" : "lazy"}
          src={media.poster}
          style={{ display: "block", width: "100%", height: "auto", objectFit: "cover", ...(ratio ? { aspectRatio: ratio } : {}) }}
          width={media.width}
        />
      ) : (
        <span aria-hidden="true" style={{ display: "block", width: "100%", aspectRatio: ratio ?? "16 / 9", background: "#111" }} />
      )}
      {showDuration && media.duration ? <div className="v-preview-dur">{formatPreviewDuration(media.duration)}</div> : null}
    </div>
  );
}

function formatPreviewDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
