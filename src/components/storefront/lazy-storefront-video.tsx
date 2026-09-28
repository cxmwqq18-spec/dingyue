"use client";

import { PlayCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

type LazyStorefrontVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "preload" | "src"> & {
  src: string;
  autoPlayOnInteraction?: boolean;
  interactionPreload?: "metadata" | "auto";
  nearViewportPreload?: "metadata" | "auto";
  observerRootMargin?: string;
  deferLoading?: boolean;
  posterOverlay?: boolean;
  pauseOverlay?: boolean;
};

function videoMimeTypeForUrl(value: string): "video/mp4" | "video/webm" | undefined {
  if (/\.webm(?:[?#]|$)/i.test(value)) return "video/webm";
  if (/\.(?:mp4|m4v|mov)(?:[?#]|$)/i.test(value)) return "video/mp4";
  return undefined;
}

export function LazyStorefrontVideo({
  src,
  autoPlayOnInteraction = false,
  interactionPreload = "auto",
  nearViewportPreload = "metadata",
  observerRootMargin = "200px",
  deferLoading = false,
  posterOverlay = false,
  pauseOverlay = false,
  onClick,
  onFocus,
  onPointerEnter,
  onTouchStart,
  onPlay,
  onPlaying,
  onPause,
  onEnded,
  onCanPlay,
  onError,
  "aria-label": ariaLabel,
  className,
  poster,
  children,
  ...props
}: LazyStorefrontVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [posterOverlayDismissed, setPosterOverlayDismissed] = useState(false);
  const [posterOverlayLoading, setPosterOverlayLoading] = useState(false);
  const [hasPlayableVideo, setHasPlayableVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!deferLoading);
  const [playRequested, setPlayRequested] = useState(false);

  const requestLoad = useCallback(() => setShouldLoad(true), []);

  useEffect(() => {
    setPosterOverlayDismissed(false);
    setPosterOverlayLoading(false);
    setHasPlayableVideo(false);
    setIsPlaying(false);
    setShouldLoad(!deferLoading);
    setPlayRequested(false);
  }, [deferLoading, src]);

  useEffect(() => {
    if (!deferLoading || shouldLoad) return;
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: observerRootMargin });
    observer.observe(video);
    return () => observer.disconnect();
  }, [deferLoading, observerRootMargin, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || !playRequested) return;
    const video = videoRef.current;
    if (!video) return;
    const play = () => {
      setPosterOverlayLoading(true);
      void video.play().then(() => {
        setPosterOverlayDismissed(true);
        setHasPlayableVideo(true);
        setIsPlaying(true);
        setPosterOverlayLoading(false);
      }).catch(() => {
        setPosterOverlayLoading(false);
        setIsPlaying(false);
      });
    };
    if (video.readyState >= 2) {
      play();
      return;
    }
    video.addEventListener("canplay", play, { once: true });
    return () => video.removeEventListener("canplay", play);
  }, [playRequested, shouldLoad]);

  const requestPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setPlayRequested(true);
    setShouldLoad(true);
    if (!deferLoading) {
      setPosterOverlayLoading(true);
      void video.play().then(() => {
        setPosterOverlayDismissed(true);
        setHasPlayableVideo(true);
        setIsPlaying(true);
        setPosterOverlayLoading(false);
      }).catch(() => {
        setPosterOverlayLoading(false);
        setIsPlaying(false);
      });
    }
  }, [deferLoading]);

  const markVideoPlaying = useCallback(() => {
    setPosterOverlayDismissed(true);
    setHasPlayableVideo(true);
    setIsPlaying(true);
    setPosterOverlayLoading(false);
  }, []);

  const playButtonLabel = ariaLabel
    ? `Play ${ariaLabel.replace(/^Watch\s+/i, "")}`
    : "Play tutorial video";
  const showPosterOverlay = Boolean(posterOverlay && poster && !posterOverlayDismissed);
  const showPauseOverlay = Boolean(pauseOverlay && hasPlayableVideo && !isPlaying && !showPosterOverlay);
  const videoMimeType = videoMimeTypeForUrl(src);

  const video = (
    <video
      {...props}
      aria-label={ariaLabel}
      className={className}
      onCanPlay={(event) => {
        setHasPlayableVideo(true);
        setPosterOverlayLoading(false);
        onCanPlay?.(event);
      }}
      onClick={(event) => {
        if (autoPlayOnInteraction) requestPlay();
        else if (deferLoading) requestLoad();
        onClick?.(event);
      }}
      onEnded={(event) => {
        setIsPlaying(false);
        onEnded?.(event);
      }}
      onError={(event) => {
        setPosterOverlayLoading(false);
        setPosterOverlayDismissed(false);
        setHasPlayableVideo(false);
        setIsPlaying(false);
        onError?.(event);
      }}
      onFocus={(event) => {
        if (deferLoading) requestLoad();
        onFocus?.(event);
      }}
      onPause={(event) => {
        setIsPlaying(false);
        onPause?.(event);
      }}
      onPlay={(event) => {
        markVideoPlaying();
        onPlay?.(event);
      }}
      onPlaying={(event) => {
        markVideoPlaying();
        onPlaying?.(event);
      }}
      onPointerEnter={(event) => {
        if (deferLoading) requestLoad();
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        if (deferLoading) requestLoad();
        onTouchStart?.(event);
      }}
      poster={poster}
      preload={deferLoading ? (shouldLoad ? (playRequested ? interactionPreload : nearViewportPreload) : "none") : "metadata"}
      ref={videoRef}
      {...(videoMimeType && shouldLoad ? {} : videoMimeType ? {} : shouldLoad ? { src } : {})}
    >
      {videoMimeType && shouldLoad ? <source src={src} type={videoMimeType} /> : null}
      {children}
    </video>
  );

  if (!posterOverlay && !pauseOverlay) return video;

  return (
    <div className="relative block w-full">
      {video}
      {showPosterOverlay ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-[inherit]">
          <button
            aria-label={playButtonLabel}
            aria-busy={posterOverlayLoading}
            className={`pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-black/45 text-white shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-sm transition-transform hover:scale-105 ${posterOverlayLoading ? "animate-pulse" : ""}`}
            onClick={requestPlay}
            type="button"
          >
            <PlayCircle className="h-9 w-9" strokeWidth={1.7} />
          </button>
        </div>
      ) : null}
      {showPauseOverlay ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <button
            aria-label={playButtonLabel}
            className="pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-zinc-950 shadow-[0_18px_60px_-28px_rgba(255,255,255,0.8)] transition-transform hover:scale-105"
            onClick={requestPlay}
            type="button"
          >
            <PlayCircle className="h-11 w-11" strokeWidth={1.8} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
