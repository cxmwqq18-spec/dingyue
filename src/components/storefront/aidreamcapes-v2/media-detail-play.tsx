"use client";

// Detail-page media figure for video examples.
//
// The server-rendered markup carries only the poster: a <video> element in the
// crawlable HTML made Google report the video as "not on a watch page". The
// dedicated /watch/<slug> page owns the indexable player and the VideoObject.
// Visitors still get playback here — the player mounts on the first click,
// which never appears in the SSR document.

import { useState } from "react";

export function MediaDetailPlay({
  posterSrc,
  posterAlt,
  videoSrc,
  width,
  height,
  label,
  watchHref
}: {
  posterSrc: string;
  posterAlt: string;
  videoSrc: string;
  width?: number;
  height?: number;
  label: string;
  watchHref?: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="v-detail-play">
      {playing ? (
        <video
          aria-label={label}
          autoPlay
          controls
          height={height}
          playsInline
          poster={posterSrc || undefined}
          preload="metadata"
          src={videoSrc}
          width={width}
        />
      ) : (
        <button aria-label={`Play ${label}`} className="v-detail-play-poster" onClick={() => setPlaying(true)} type="button">
          <img
            alt={posterAlt}
            decoding="async"
            height={height}
            loading="eager"
            src={posterSrc}
            width={width}
          />
          <span className="v-detail-play-cta">▶ Play video</span>
        </button>
      )}
      {watchHref ? <a className="v-detail-play-link" href={watchHref}>Open the standalone watch page →</a> : null}
    </div>
  );
}
