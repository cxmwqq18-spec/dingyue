"use client";

import { useEffect, useRef } from "react";

type DreamshootShowcaseVideoProps = {
  src: string;
  poster: string;
  label: string;
  className?: string;
};

export function DreamshootShowcaseVideo({ src, poster, label, className }: DreamshootShowcaseVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;

    let cancelled = false;
    const playWhenAllowed = () => {
      if (cancelled) return;
      void video.play().catch(() => {
        // Muted autoplay is allowed in modern browsers, but failures are non-fatal.
      });
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
              playWhenAllowed();
            } else {
              video.pause();
            }
          },
          { rootMargin: "180px" }
        );
    observer?.observe(video);
    playWhenAllowed();

    return () => {
      cancelled = true;
      observer?.disconnect();
      video.removeEventListener("loadeddata", handleCanPlay);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      aria-label={label}
      autoPlay
      className={className}
      loop
      muted
      playsInline
      poster={poster}
      preload="auto"
      src={src}
      title={label}
    />
  );
}
