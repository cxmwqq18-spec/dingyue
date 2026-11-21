"use client";

// Ambient card preview.
//
// Visitors expect the catalog clips to play by themselves — the pre-watch-page
// split site did exactly that — while Google must not find a <video> in the
// crawlable markup of a listing page ("video not on a watch page" reports).
// The poster ships in the SSR document; the player mounts once the card
// approaches the viewport and plays muted and looping while it is visible.
// Leaving the viewport pauses the player but keeps it mounted, so the media
// keeps the exact media ratio (posters and players share one aspect-ratio)
// and nothing jumps when the visitor scrolls back.

import { useEffect, useRef, useState } from "react";

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

export function Adc2VideoPreview({ media, ariaLabel, showDuration = false, posterEager = true, forceAspectRatio }: { media: Adc2VideoPreviewMedia; ariaLabel?: string; showDuration?: boolean; posterEager?: boolean; forceAspectRatio?: string }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const label = ariaLabel ?? media.name;
  const ratio = forceAspectRatio ?? (media.width && media.height ? `${media.width} / ${media.height}` : undefined);
  const mediaStyle = {
    display: "block",
    width: "100%",
    height: "auto",
    objectFit: "cover" as const,
    ...(ratio ? { aspectRatio: ratio } : {})
  };

  useEffect(() => {
    const element = boxRef.current;
    // Mount once and keep the player: unmounting it on scroll makes mobile
    // browsers create/destroy media elements continuously, which crashes them
    // (see PosterSwapVideo). Leaving the viewport only pauses playback.
    // The first visible row must play without waiting for an observer
    // callback: cards above the fold mount immediately after hydration.
    if (posterEager) {
      setMounted(true);
      setVisible(true);
    }
    if (!element || typeof IntersectionObserver === "undefined") {
      setMounted(true);
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((entry) => entry.isIntersecting);
        if (intersecting) {
          setMounted(true);
          setVisible(true);
        } else {
          setVisible(false);
        }
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [posterEager]);

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
    <div
      className="v-preview-box notranslate"
      onBlur={() => setVisible(false)}
      onFocus={() => {
        setMounted(true);
        setVisible(true);
      }}
      ref={boxRef}
      translate="no"
    >
      {/* The poster stays mounted for the life of the card: mobile browsers
          with built-in translation rewrite the DOM, and removing a rewritten
          node makes React throw NotFoundError from removeChild. */}
      {media.poster ? (
        <img
          alt={label ?? ""}
          decoding="async"
          height={media.height}
          loading={posterEager ? "eager" : "lazy"}
          src={media.poster}
          style={{ ...mediaStyle, display: mounted ? "none" : "block" }}
          width={media.width}
        />
      ) : !mounted ? (
        <span aria-hidden="true" style={{ display: "block", width: "100%", aspectRatio: ratio ?? "16 / 9", background: "#111" }} />
      ) : null}
      {mounted ? (
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
          ref={videoRef}
          src={media.previewSrc ?? media.src}
          style={mediaStyle}
          width={media.width}
        />
      ) : null}
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
