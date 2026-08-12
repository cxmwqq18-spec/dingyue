"use client";

import { useCallback, useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

type LazyStorefrontVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "preload" | "src"> & {
  src: string;
  autoPlayOnInteraction?: boolean;
  interactionPreload?: "metadata" | "auto";
  nearViewportPreload?: "metadata" | "auto";
  observerRootMargin?: string;
};

export function LazyStorefrontVideo({
  src,
  autoPlayOnInteraction = false,
  interactionPreload = "auto",
  nearViewportPreload = "metadata",
  observerRootMargin = "240px 0px",
  onClick,
  onFocus,
  onPointerEnter,
  onTouchStart,
  ...props
}: LazyStorefrontVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [preloadMode, setPreloadMode] = useState<"none" | "metadata" | "auto">("none");

  const requestLoad = useCallback((mode: "metadata" | "auto", shouldPlay = false) => {
    const video = videoRef.current;
    if (video && !video.getAttribute("src")) {
      video.preload = mode;
      video.src = src;
    }
    setShouldLoad(true);
    setPreloadMode((current) => (current === "auto" ? current : mode));
    if (!shouldPlay) return;
    window.requestAnimationFrame(() => {
      void videoRef.current?.play().catch(() => {
        // User intent has already started loading; native controls can retry playback.
      });
    });
  }, [src]);

  useEffect(() => {
    setShouldLoad(false);
    setPreloadMode("none");
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (typeof IntersectionObserver === "undefined") {
      requestLoad(nearViewportPreload);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          requestLoad(nearViewportPreload);
          observer.disconnect();
        }
      },
      { rootMargin: observerRootMargin }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [nearViewportPreload, observerRootMargin, requestLoad, src]);

  return (
    <video
      {...props}
      ref={videoRef}
      onClick={(event) => {
        requestLoad(interactionPreload, autoPlayOnInteraction);
        onClick?.(event);
      }}
      onFocus={(event) => {
        requestLoad(interactionPreload);
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        requestLoad(interactionPreload);
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        requestLoad(interactionPreload);
        onTouchStart?.(event);
      }}
      preload={shouldLoad ? preloadMode : "none"}
      src={shouldLoad ? src : undefined}
    />
  );
}
