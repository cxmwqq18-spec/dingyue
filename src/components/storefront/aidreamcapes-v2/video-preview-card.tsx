"use client";

// Silent grid preview for list cards. The card ships only its poster: the
// <video> mounts without a src, so a page of cards downloads and decodes
// nothing until a card scrolls into view. While visible it plays a short
// muted loop; when it leaves the viewport the source is dropped again, which
// releases the decoder and its buffers — the memory cost of a long list stays
// flat no matter how far the visitor scrolls.
//
// The whole card remains a plain link; playback is decoration, never an
// editing surface. Click still opens the detail page.

import { useEffect, useRef } from "react";

/** Seconds of the source a preview loops over before returning to the start. */
const PREVIEW_LOOP_SECONDS = 10;
const MAX_PLAYING_DESKTOP = 12;
const MAX_PLAYING_MOBILE = 6;
const MOBILE_MAX_QUERY = "(max-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** Distance at which a preview clip is silently fetched into the browser
 * cache, so playback starts the moment the card scrolls into view. */
const PREFETCH_ROOT_MARGIN = "1200px 0px";

export type Adc2VideoPreviewMedia = {
  src: string;
  /** 10s low-bitrate clip; when present it replaces src for playback and is
   * prefetched ahead of the viewport. */
  previewSrc?: string;
  poster: string;
  width?: number;
  height?: number;
  duration?: number;
  name?: string;
};

type ReleasePreview = () => void;

// One silent download per clip URL, shared by every card on the page.
const prefetchedClips = new Set<string>();

function prefetchClip(url: string): void {
  if (!url || prefetchedClips.has(url)) return;
  prefetchedClips.add(url);
  fetch(url, { priority: "low" }).catch(() => prefetchedClips.delete(url));
}

// Cards play in insertion order; when more previews request a slot than the
// device budget allows, the longest-playing one is released back to its poster.
const playingPreviews: HTMLVideoElement[] = [];
const releaseByVideo = new WeakMap<HTMLVideoElement, ReleasePreview>();

function maxPlayingPreviews(): number {
  return window.matchMedia(MOBILE_MAX_QUERY).matches ? MAX_PLAYING_MOBILE : MAX_PLAYING_DESKTOP;
}

function unregisterPlaying(video: HTMLVideoElement): void {
  const index = playingPreviews.indexOf(video);
  if (index >= 0) playingPreviews.splice(index, 1);
}

function enforcePlayingBudget(): void {
  while (playingPreviews.length > maxPlayingPreviews()) {
    const oldest = playingPreviews.shift();
    if (oldest) releaseByVideo.get(oldest)?.();
  }
}

// One observer for every preview on the page; a card can only afford to play
// when it is actually seen, so visibility — not autoplay — gates loading.
const visibilityCallbacks = new WeakMap<Element, (visible: boolean) => void>();
let sharedObserver: IntersectionObserver | null = null;

function observePreviewVisibility(element: Element, callback: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver === "undefined") {
    callback(true);
    return () => {};
  }
  sharedObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) visibilityCallbacks.get(entry.target)?.(entry.isIntersecting);
  }, { threshold: 0.35 });
  visibilityCallbacks.set(element, callback);
  sharedObserver.observe(element);
  return () => {
    visibilityCallbacks.delete(element);
    sharedObserver?.unobserve(element);
  };
}

export function Adc2VideoPreview({ media, ariaLabel, showDuration = true }: { media: Adc2VideoPreviewMedia; ariaLabel?: string; showDuration?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    let failed = false;

    const release = () => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // No metadata yet — nothing to rewind.
      }
      video.removeAttribute("src");
      video.load();
      unregisterPlaying(video);
    };
    releaseByVideo.set(video, release);

    const play = () => {
      // A release may have raced this callback; only play a card that still
      // carries its source.
      if (!video.getAttribute("src")) return;
      video.play().then(() => {
        if (!playingPreviews.includes(video)) playingPreviews.push(video);
        enforcePlayingBudget();
      }).catch(() => {
        // Autoplay refused (for example iOS Low Power Mode): stay on the poster.
      });
    };

    const activate = () => {
      if (failed || reducedMotion.matches || video.getAttribute("src")) return;
      video.muted = true;
      // The low-bitrate clip (when generated) is the playback source: tiny,
      // fully cached by the prefetcher, and loop-seamless.
      video.src = media.previewSrc ?? media.src;
      video.load();
      if (video.readyState >= 2) play();
      else video.addEventListener("loadeddata", play, { once: true });
    };

    const stopObserving = observePreviewVisibility(video, (visible) => {
      if (visible) activate();
      else release();
    });

    // Cache-warm the clip one screen ahead of the viewport so playback starts
    // from the browser cache instead of a cold stream.
    let stopPrefetching: (() => void) | undefined;
    if (media.previewSrc) {
      if (typeof IntersectionObserver === "undefined") prefetchClip(media.previewSrc);
      else {
        const prefetchObserver = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            prefetchClip(media.previewSrc!);
            prefetchObserver.disconnect();
            stopPrefetching = undefined;
          }
        }, { rootMargin: PREFETCH_ROOT_MARGIN });
        prefetchObserver.observe(video);
        stopPrefetching = () => prefetchObserver.disconnect();
      }
    }

    const onTimeUpdate = () => {
      if (video.currentTime > PREVIEW_LOOP_SECONDS) video.currentTime = 0;
    };
    const onError = () => {
      failed = true;
      release();
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("error", onError);
      stopObserving();
      stopPrefetching?.();
      release();
      releaseByVideo.delete(video);
    };
  }, [media.previewSrc, media.src]);

  return (
    <div className="v-preview-box">
      <video
        aria-label={ariaLabel ?? media.name}
        data-adc2-preview=""
        height={media.height}
        loop
        muted
        playsInline
        poster={media.poster}
        preload="none"
        ref={videoRef}
        width={media.width}
      />
      {showDuration && media.duration ? <div className="v-preview-dur">{formatPreviewDuration(media.duration)}</div> : null}
    </div>
  );
}

function formatPreviewDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
