"use client";

import { PlayCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

type LazyStorefrontVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "preload" | "src"> & {
  src: string;
  autoPlayOnInteraction?: boolean;
  interactionPreload?: "metadata" | "auto";
  nearViewportPreload?: "metadata" | "auto";
  observerRootMargin?: string;
  posterOverlay?: boolean;
};

export function LazyStorefrontVideo({
  src,
  autoPlayOnInteraction = false,
  interactionPreload = "auto",
  nearViewportPreload = "metadata",
  observerRootMargin = "240px 0px",
  posterOverlay = false,
  onClick,
  onFocus,
  onPointerEnter,
  onTouchStart,
  onPlay,
  onCanPlay,
  onError,
  "aria-label": ariaLabel,
  className,
  poster,
  ...props
}: LazyStorefrontVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [preloadMode, setPreloadMode] = useState<"none" | "metadata" | "auto">("none");
  const [posterOverlayDismissed, setPosterOverlayDismissed] = useState(false);
  const [posterOverlayLoading, setPosterOverlayLoading] = useState(false);

  const requestLoad = useCallback((mode: "metadata" | "auto", shouldPlay = false) => {
    const video = videoRef.current;
    if (video && !video.getAttribute("src")) {
      video.preload = mode;
      video.src = src;
    }
    setShouldLoad(true);
    setPreloadMode((current) => (current === "auto" ? current : mode));
    if (!shouldPlay) return;
    setPosterOverlayLoading(true);
    window.requestAnimationFrame(() => {
      void videoRef.current?.play().catch(() => {
        setPosterOverlayLoading(false);
      });
    });
  }, [src]);

  useEffect(() => {
    setShouldLoad(false);
    setPreloadMode("none");
    setPosterOverlayDismissed(false);
    setPosterOverlayLoading(false);
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

  const video = (
    <video
      {...props}
      aria-label={ariaLabel}
      className={className}
      ref={videoRef}
      onClick={(event) => {
        requestLoad(interactionPreload, autoPlayOnInteraction);
        onClick?.(event);
      }}
      onFocus={(event) => {
        requestLoad(interactionPreload);
        onFocus?.(event);
      }}
      onPlay={(event) => {
        onPlay?.(event);
      }}
      onCanPlay={(event) => {
        setPosterOverlayLoading(false);
        setPosterOverlayDismissed(true);
        onCanPlay?.(event);
      }}
      onError={(event) => {
        setPosterOverlayLoading(false);
        setPosterOverlayDismissed(false);
        onError?.(event);
      }}
      onPointerEnter={(event) => {
        requestLoad(interactionPreload);
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        requestLoad(interactionPreload);
        onTouchStart?.(event);
      }}
      poster={poster}
      preload={shouldLoad ? preloadMode : "none"}
      src={shouldLoad ? src : undefined}
    />
  );

  if (!posterOverlay || !poster || posterOverlayDismissed) return video;

  return (
    <div className="relative block w-full">
      {video}
      <button
        aria-label={ariaLabel ? `Play ${ariaLabel.replace(/^Watch\s+/i, "")}` : "Play tutorial video"}
        aria-busy={posterOverlayLoading}
        className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-[inherit] bg-black"
        onClick={() => requestLoad(interactionPreload, true)}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-contain"
          decoding="async"
          src={poster}
        />
        <span className={`relative flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-black/45 text-white shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-sm transition-transform hover:scale-105 ${posterOverlayLoading ? "animate-pulse" : ""}`}>
          <PlayCircle className="h-9 w-9" strokeWidth={1.7} />
        </span>
      </button>
    </div>
  );
}
