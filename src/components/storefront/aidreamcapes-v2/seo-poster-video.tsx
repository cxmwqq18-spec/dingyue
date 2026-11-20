"use client";

// Poster-first video for article, guide and landing-page embeds.
//
// Google indexes a <video> element on any page and reports it as "video not on
// a watch page" when that page is not a dedicated watch page, so the server
// renders only the poster. Visitors still get default playback: the player
// mounts and autoplays (muted, so browsers allow it) as soon as the embed
// reaches the viewport, and native controls stay for seeking and unmuting.
// Pressing the poster still starts playback immediately. The dedicated
// /watch/<slug> page remains the only server-rendered player and the only page
// with VideoObject.

import { useEffect, useRef, useState } from "react";

export function SeoPosterVideo({
  src,
  poster,
  alt,
  width,
  height,
  className,
  posterClassName,
  controls = true,
  autoPlay = true,
  loop = false,
  muted = false,
  tracks
}: {
  src: string;
  poster?: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  posterClassName?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  tracks?: Array<{ src: string; srcLang: string; label: string; default?: boolean }>;
}) {
  const posterRef = useRef<HTMLButtonElement | null>(null);
  const [active, setActive] = useState(false);
  // Observer-started playback must stay muted or browsers refuse to autoplay;
  // a click is a user gesture and may start with sound when the caller asked
  // for it. Looping keeps the ambient embed alive like the rest of the site.
  const [autoStarted, setAutoStarted] = useState(false);

  useEffect(() => {
    if (active) return;
    const element = posterRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setAutoStarted(true);
      setActive(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        setAutoStarted(true);
        setActive(true);
      }
    }, { rootMargin: "240px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  if (active) {
    return (
      <video
        aria-label={alt}
        autoPlay={autoPlay}
        className={className}
        controls={controls}
        height={height}
        loop={loop || autoStarted}
        muted={muted || autoStarted}
        playsInline
        poster={poster}
        preload="metadata"
        src={src}
        width={width}
      >
        {tracks?.map((track) => (
          <track default={track.default} key={track.src} kind="subtitles" label={track.label} src={track.src} srcLang={track.srcLang} />
        ))}
      </video>
    );
  }

  return (
    <button
      aria-label={`Play ${alt}`}
      className={posterClassName ?? className}
      onClick={() => setActive(true)}
      ref={posterRef}
      style={{ position: "relative", display: "block", width: "100%", padding: 0, border: 0, background: "transparent", cursor: "pointer", overflow: "hidden", borderRadius: "inherit" }}
      type="button"
    >
      {poster ? (
        <img
          alt={alt}
          decoding="async"
          height={height}
          loading="lazy"
          src={poster}
          style={{ display: "block", width: "100%", height: "auto", objectFit: "cover" }}
          width={width}
        />
      ) : (
        <span aria-hidden="true" style={{ display: "block", width: "100%", aspectRatio: width && height ? `${width} / ${height}` : "16 / 9", background: "#111" }} />
      )}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: "rgba(0,0,0,.12)"
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 54,
            height: 54,
            borderRadius: "50%",
            background: "rgba(8,12,24,.82)",
            color: "#fff",
            fontSize: 20,
            paddingLeft: 4,
            backdropFilter: "blur(8px)"
          }}
        >
          ▶
        </span>
      </span>
    </button>
  );
}
