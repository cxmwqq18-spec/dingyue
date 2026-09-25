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

function videoMimeTypeForUrl(value: string): "video/mp4" | "video/webm" | undefined {
  if (/\.webm(?:[?#]|$)/i.test(value)) return "video/webm";
  if (/\.(?:mp4|m4v|mov)(?:[?#]|$)/i.test(value)) return "video/mp4";
  return undefined;
}

export function LazyStorefrontVideo({
  src,
  autoPlayOnInteraction = false,
  interactionPreload: _interactionPreload,
  nearViewportPreload: _nearViewportPreload,
  observerRootMargin: _observerRootMargin,
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
  ...props
}: LazyStorefrontVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [posterOverlayDismissed, setPosterOverlayDismissed] = useState(false);
  const [posterOverlayLoading, setPosterOverlayLoading] = useState(false);
  const [hasPlayableVideo, setHasPlayableVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setPosterOverlayDismissed(false);
    setPosterOverlayLoading(false);
    setHasPlayableVideo(false);
    setIsPlaying(false);
  }, [src]);

  const requestPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

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
  }, []);

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
      onFocus={(event) => onFocus?.(event)}
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
      onPointerEnter={(event) => onPointerEnter?.(event)}
      onTouchStart={(event) => onTouchStart?.(event)}
      poster={poster}
      preload="metadata"
      ref={videoRef}
      {...(videoMimeType ? {} : { src })}
    >
      {videoMimeType ? <source src={src} type={videoMimeType} /> : null}
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
