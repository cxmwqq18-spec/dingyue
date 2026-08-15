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
  pauseOverlay?: boolean;
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
  onPause,
  onCanPlay,
  onError,
  "aria-label": ariaLabel,
  className,
  poster,
  pauseOverlay = false,
  ...props
}: LazyStorefrontVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [preloadMode, setPreloadMode] = useState<"none" | "metadata" | "auto">("none");
  const [posterOverlayDismissed, setPosterOverlayDismissed] = useState(false);
  const [posterOverlayLoading, setPosterOverlayLoading] = useState(false);
  const [hasPlayableVideo, setHasPlayableVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

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
    void video?.play().catch(() => {
      setPosterOverlayLoading(false);
    });
  }, [src]);

  useEffect(() => {
    setShouldLoad(false);
    setPreloadMode("none");
    setPosterOverlayDismissed(false);
    setPosterOverlayLoading(false);
    setHasPlayableVideo(false);
    setIsPlaying(false);
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
        setIsPlaying(true);
        onPlay?.(event);
      }}
      onPause={(event) => {
        setIsPlaying(false);
        onPause?.(event);
      }}
      onCanPlay={(event) => {
        setPosterOverlayLoading(false);
        setPosterOverlayDismissed(true);
        setHasPlayableVideo(true);
        onCanPlay?.(event);
      }}
      onError={(event) => {
        setPosterOverlayLoading(false);
        setPosterOverlayDismissed(false);
        setHasPlayableVideo(false);
        setIsPlaying(false);
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

  const showPosterOverlay = Boolean(posterOverlay && poster && !posterOverlayDismissed);
  const showPauseOverlay = Boolean(pauseOverlay && hasPlayableVideo && !isPlaying && !showPosterOverlay);

  if (!showPosterOverlay && !showPauseOverlay) return video;

  return (
    <div className="relative block w-full">
      {video}
      {showPosterOverlay ? (
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
      ) : (
        <button
          aria-label={ariaLabel ? `Play ${ariaLabel.replace(/^Watch\s+/i, "")}` : "Play tutorial video"}
          className="absolute inset-0 z-10 flex items-center justify-center"
          onClick={() => requestLoad(interactionPreload, true)}
          type="button"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-zinc-950 shadow-[0_18px_60px_-28px_rgba(255,255,255,0.8)] transition-transform hover:scale-105">
            <PlayCircle className="h-11 w-11" strokeWidth={1.8} />
          </span>
        </button>
      )}
    </div>
  );
}
