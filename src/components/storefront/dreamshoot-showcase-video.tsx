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
      if (cancelled || !shouldLoadRef.current) return;
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

    video.addEventListener("loadedmetadata", handleCanPlay);
    video.addEventListener("loadeddata", handleCanPlay);
    video.addEventListener("canplay", handleCanPlay);

    const observeTarget = video.closest(".dreamshoot-showcase-rail") ?? video;
    const observer = typeof IntersectionObserver === "undefined"
      ? undefined
      : new IntersectionObserver(
          (entries) => {
            const visible = entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0);
            if (visible) {
              revealAndPlay();
            } else {
              if (!shouldLoadRef.current && revealTimer !== undefined) {
                window.clearTimeout(revealTimer);
                revealTimer = undefined;
              }
              if (video.readyState >= 2) video.pause();
            }
          },
          { rootMargin: "360px 0px" }
        );
    observer?.observe(observeTarget);
    if (!observer) revealAndPlay();

    return () => {
      cancelled = true;
      if (revealTimer !== undefined) window.clearTimeout(revealTimer);
      observer?.disconnect();
      video.removeEventListener("loadedmetadata", handleCanPlay);
      video.removeEventListener("loadeddata", handleCanPlay);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [src]);

  useEffect(() => {
    if (!shouldLoad) return;
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;

    let cancelled = false;
    const playWhenReady = () => {
      if (cancelled) return;
      void video.play().catch(() => {
        // A later media event or visibility pass will retry muted playback.
      });
    };
    const frame = window.requestAnimationFrame(playWhenReady);
    const retryTimer = window.setTimeout(playWhenReady, 350);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retryTimer);
    };
  }, [shouldLoad, src]);

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
      preload={shouldLoad ? "auto" : "none"}
      src={shouldLoad ? src : undefined}
      title={label}
    />
  );
}
