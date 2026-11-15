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

import { useEffect, useRef, useState } from "react";

/** Seconds of the source a preview loops over before returning to the start. */
const PREVIEW_LOOP_SECONDS = 10;
const MAX_PLAYING_DESKTOP = 12;
const MAX_PLAYING_MOBILE = 2;
const MOBILE_MAX_QUERY = "(max-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** Distance at which a preview clip is silently fetched into the browser
 * cache, so playback starts the moment the card scrolls into view. Mobile
 * connections share the pipe with the gallery's poster images and the LCP
 * element, so the prefetch stays close to the viewport there. */
const PREFETCH_ROOT_MARGIN = "1200px 0px";
const PREFETCH_ROOT_MARGIN_MOBILE = "400px 0px";
/** Root margin for the deferred poster images below the first rows: close
 * enough that scrolling never shows an empty card, far enough that a page of
 * cards does not request every poster at parse time. */
const POSTER_ROOT_MARGIN = "600px 0px";

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

// One silent download per clip URL, shared by every card on the page, and one
// at a time: four clips streaming together on a throttled mobile connection is
// exactly the bandwidth burst that delays the gallery's poster paint.
const prefetchedClips = new Set<string>();
let clipDownloadChain: Promise<unknown> = Promise.resolve();

function prefetchRootMargin(): string {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_MAX_QUERY).matches
    ? PREFETCH_ROOT_MARGIN_MOBILE
    : PREFETCH_ROOT_MARGIN;
}

function prefetchClip(url: string): void {
  if (!url || prefetchedClips.has(url)) return;
  prefetchedClips.add(url);
  const download = clipDownloadChain.then(() => fetch(url, { priority: "low" }));
  clipDownloadChain = download.then(() => undefined, () => {
    prefetchedClips.delete(url);
  });
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

type WaitingPreview = { activate: () => void; isVisible: () => boolean };

// Cards whose activation is deferred because every playback slot is taken.
// The budget has to hold at activation time, not after play() resolves —
// otherwise every visible card mounts its source the moment the page loads
// and the device downloads them all at once.
const waitingPreviews = new Map<HTMLVideoElement, WaitingPreview>();

function activateWithBudget(video: HTMLVideoElement, activate: () => void, isVisible: () => boolean): void {
  if (playingPreviews.length < maxPlayingPreviews()) {
    activate();
    return;
  }
  waitingPreviews.set(video, { activate, isVisible });
}

/** Start one deferred activation when a playback slot has opened. */
function pumpWaitingPreviews(): void {
  if (!waitingPreviews.size) return;
  for (const [video, waiting] of [...waitingPreviews]) {
    if (playingPreviews.length >= maxPlayingPreviews()) return;
    waitingPreviews.delete(video);
    if (waiting.isVisible()) {
      waiting.activate();
      return;
    }
  }
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

// Playback and clip prefetching are decoration. Gating them on the window
// load event keeps the network pipe free for the gallery's LCP poster during
// the first seconds on throttled mobile connections; on fast connections the
// delay is a fraction of a second. A timeout bounds the wait for visitors
// whose load event stalls on a slow third-party asset.
function runAfterWindowLoad(run: () => void): void {
  if (document.readyState === "complete") {
    run();
    return;
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener("load", finish);
    run();
  };
  window.addEventListener("load", finish, { once: true });
  setTimeout(finish, 2500);
}

export function Adc2VideoPreview({ media, ariaLabel, showDuration = false, posterEager = true }: { media: Adc2VideoPreviewMedia; ariaLabel?: string; showDuration?: boolean; posterEager?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Poster images on a <video> are requested as soon as the attribute parses —
  // unlike <img loading="lazy"> there is no native gate. Cards below the first
  // rows therefore mount without a poster and pick it up on approach, so a
  // page of cards does not fetch every poster at parse time. The SSR markup
  // still publishes the poster address in data-deferred-poster so crawlers
  // see the same reference a visitor's video eventually renders.
  const [posterSrc, setPosterSrc] = useState(posterEager ? media.poster : "");

  useEffect(() => {
    if (posterEager || !media.poster) return;
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") {
      setPosterSrc(media.poster);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setPosterSrc(media.poster);
        observer.disconnect();
      }
    }, { rootMargin: POSTER_ROOT_MARGIN });
    observer.observe(video);
    return () => observer.disconnect();
  }, [posterEager, media.poster]);

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
      waitingPreviews.delete(video);
      pumpWaitingPreviews();
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

    const activateNow = () => {
      if (failed || reducedMotion.matches || video.getAttribute("src")) return;
      video.muted = true;
      // The low-bitrate clip (when generated) is the playback source: tiny,
      // fully cached by the prefetcher, and loop-seamless.
      video.src = media.previewSrc ?? media.src;
      video.load();
      if (video.readyState >= 2) play();
      else video.addEventListener("loadeddata", play, { once: true });
    };

    // LCP gating: the latest visibility is remembered while the load gate is
    // closed, so a card that is already on screen starts previewing the
    // moment the gate opens, and one scrolled away meanwhile does not.
    let latestVisible = false;
    let ready = false;
    runAfterWindowLoad(() => {
      ready = true;
      if (latestVisible) activateWithBudget(video, activateNow, () => latestVisible);
    });

    const stopObserving = observePreviewVisibility(video, (visible) => {
      latestVisible = visible;
      if (visible) {
        if (ready) activateWithBudget(video, activateNow, () => latestVisible);
      } else release();
    });

    // Cache-warm the clip one screen ahead of the viewport so playback starts
    // from the browser cache instead of a cold stream.
    let stopPrefetching: (() => void) | undefined;
    if (media.previewSrc) {
      if (typeof IntersectionObserver === "undefined") runAfterWindowLoad(() => prefetchClip(media.previewSrc!));
      else {
        const prefetchObserver = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            runAfterWindowLoad(() => prefetchClip(media.previewSrc!));
            prefetchObserver.disconnect();
            stopPrefetching = undefined;
          }
        }, { rootMargin: prefetchRootMargin() });
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
        data-deferred-poster={posterEager || !media.poster ? undefined : media.poster}
        height={media.height}
        loop
        muted
        playsInline
        poster={posterSrc || undefined}
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
