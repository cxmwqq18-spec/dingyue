"use client";

import { useEffect, useRef, useState } from "react";

type DreamshootShowcaseVideoProps = {
  src: string;
  poster: string;
  label: string;
  className?: string;
};

const SHOWCASE_VIDEO_LOAD_DELAY_MS = 900;

export function DreamshootShowcaseVideo({ src, poster, label, className }: DreamshootShowcaseVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldLoadRef = useRef(false);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    shouldLoadRef.current = false;
    setShouldLoad(false);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;

    let cancelled = false;
    let revealTimer: number | undefined;
    const playWhenAllowed = () => {
      if (cancelled) return;
      void video.play().catch(() => {
        // Muted autoplay is allowed in modern browsers, but failures are non-fatal.
      });
    };
    const revealAndPlay = () => {
      if (shouldLoadRef.current) {
        playWhenAllowed();
        return;
      }
      if (revealTimer !== undefined) return;
      revealTimer = window.setTimeout(() => {
        if (cancelled) return;
        shouldLoadRef.current = true;
        setShouldLoad(true);
        window.requestAnimationFrame(playWhenAllowed);
      }, SHOWCASE_VIDEO_LOAD_DELAY_MS);
    };
    const handleCanPlay = () => playWhenAllowed();

    video.addEventListener("loadeddata", handleCanPlay);
    video.addEventListener("canplay", handleCanPlay);

    const observer = typeof IntersectionObserver === "undefined"
      ? undefined
      : new IntersectionObserver(
          (entries) => {
            const visible = entries.some((entry) => entry.isIntersecting);
            if (visible) {
              revealAndPlay();
            } else {
              if (!shouldLoadRef.current && revealTimer !== undefined) {
                window.clearTimeout(revealTimer);
                revealTimer = undefined;
              }
              video.pause();
            }
          },
          { rootMargin: "0px" }
        );
    observer?.observe(video);
    if (!observer) revealAndPlay();

    return () => {
      cancelled = true;
      if (revealTimer !== undefined) window.clearTimeout(revealTimer);
      observer?.disconnect();
      video.removeEventListener("loadeddata", handleCanPlay);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      aria-label={label}
      autoPlay={shouldLoad}
      className={className}
      loop
      muted
      playsInline
      poster={poster}
      preload="metadata"
      src={shouldLoad ? src : undefined}
      title={label}
    />
  );
}
