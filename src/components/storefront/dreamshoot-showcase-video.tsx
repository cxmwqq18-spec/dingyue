"use client";

import { useEffect, useRef } from "react";

type DreamshootShowcaseVideoProps = { src: string; poster: string; label: string; className?: string; priority?: boolean };

export function DreamshootShowcaseVideo({ src, poster, label, className, priority = false }: DreamshootShowcaseVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;

    let cancelled = false;
    const play = () => {
      if (cancelled) return;
      void video.play().catch(() => undefined);
    };
    const pause = () => {
      if (video.readyState >= 2) video.pause();
    };
    const observer = typeof IntersectionObserver === "undefined"
      ? undefined
      : new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) play();
            else pause();
          },
          { rootMargin: "180px 0px" }
        );

    video.addEventListener("loadeddata", play);
    video.addEventListener("canplay", play);
    observer?.observe(video);
    if (!observer) play();

    return () => {
      cancelled = true;
      observer?.disconnect();
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("canplay", play);
    };
  }, [src]);

  return <video ref={videoRef} aria-label={label} autoPlay className={className} loop muted playsInline poster={poster} preload={priority ? "auto" : "metadata"} src={src} title={label} />;
}
