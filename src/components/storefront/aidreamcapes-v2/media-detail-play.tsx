"use client";

// Detail-page media figure for video examples.
//
// The server-rendered markup carries only the poster: a <video> element in the
// crawlable HTML made Google report the video as "not on a watch page". The
// dedicated /watch/<slug> page owns the indexable player and the VideoObject.
// Visitors still get the example playing by default — the player mounts when
// the figure approaches the viewport, autoplays muted and looping (controls
// let them unmute or pause), and keeps the media's own aspect ratio so the
// poster and the player never change shape.

import { useEffect, useRef, useState } from "react";

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
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ratio = width && height ? `${width} / ${height}` : undefined;
  const mediaStyle = {
    display: "block",
    width: "100%",
    height: "auto",
    ...(ratio ? { aspectRatio: ratio } : {})
  };

  useEffect(() => {
    const element = boxRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setMounted(true);
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((entry) => entry.isIntersecting);
        if (intersecting) setMounted(true);
        setVisible(intersecting);
      },
      { rootMargin: "160px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (visible) {
      const attempt = video.play();
      if (attempt && typeof attempt.catch === "function") attempt.catch(() => undefined);
    } else {
      video.pause();
    }
  }, [visible, mounted]);

  return (
    <div className="v-detail-play" ref={boxRef}>
      {mounted ? (
        <video
          aria-label={label}
          autoPlay
          controls
          height={height}
          loop
          muted
          playsInline
          poster={posterSrc || undefined}
          preload="metadata"
          ref={videoRef}
          src={videoSrc}
          style={mediaStyle}
          width={width}
        />
      ) : (
        <button aria-label={`Play ${label}`} className="v-detail-play-poster" onClick={() => { setMounted(true); setVisible(true); }} type="button">
          <img
            alt={posterAlt}
            decoding="async"
            height={height}
            loading="eager"
            src={posterSrc}
            style={mediaStyle}
            width={width}
          />
          <span className="v-detail-play-cta">▶ Play video</span>
        </button>
      )}
      {watchHref ? <a className="v-detail-play-link" href={watchHref}>Open the standalone watch page →</a> : null}
    </div>
  );
}
