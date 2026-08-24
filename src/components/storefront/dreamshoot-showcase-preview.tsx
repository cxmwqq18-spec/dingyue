"use client";

import { type KeyboardEvent, type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type ShowcasePreviewKind = "image" | "video";

type ShowcasePreview = {
  kind: ShowcasePreviewKind;
  src: string;
  poster?: string;
  title: string;
  meta: string;
};

type DreamshootShowcasePreviewProps = {
  children: ReactNode;
  className?: string;
};

const PREVIEW_TRIGGER_SELECTOR = "[data-dreamshoot-showcase-preview]";
const FALLBACK_IMAGE_SELECTOR = "img";

function previewFromTrigger(trigger: HTMLElement): ShowcasePreview | null {
  const kind = trigger.dataset.dreamshootShowcasePreview;
  const src = trigger.dataset.dreamshootPreviewSrc;
  if ((kind !== "image" && kind !== "video") || !src) return null;

  const embeddedImage = trigger.querySelector<HTMLImageElement>("img[alt]");
  const embeddedVideo = trigger.querySelector<HTMLVideoElement>("video[aria-label], video[title]");
  const embeddedTitle = kind === "image"
    ? embeddedImage?.alt?.trim()
    : embeddedVideo?.getAttribute("aria-label")?.trim() || embeddedVideo?.title?.trim();
  return {
    kind,
    src,
    poster: trigger.dataset.dreamshootPreviewPoster,
    title: trigger.dataset.dreamshootPreviewTitle || embeddedTitle || (kind === "image" ? "Image example preview" : "Video example preview"),
    meta: trigger.dataset.dreamshootPreviewMeta || ""
  };
}

function canPreviewFallbackImage(image: HTMLImageElement): boolean {
  if (image.closest("[data-dreamshoot-preview-disabled='true'], header, footer, nav")) return false;
  if (image.closest("button")) return false;
  if (image.getAttribute("aria-hidden") === "true" || image.getAttribute("role") === "presentation") return false;
  const src = image.currentSrc || image.src || image.getAttribute("src") || "";
  if (!src || /\.(?:svg|ico)(?:[?#]|$)/i.test(src)) return false;
  const alt = image.alt || "";
  if (/\b(?:logo|icon|wordmark|avatar)\b/i.test(alt)) return false;
  const rect = image.getBoundingClientRect();
  return rect.width >= 80 && rect.height >= 80;
}

function previewFromFallbackImage(image: HTMLImageElement): ShowcasePreview | null {
  if (!canPreviewFallbackImage(image)) return null;
  const src = image.currentSrc || image.src || image.getAttribute("src");
  if (!src) return null;
  const title = image.alt?.trim() || image.title?.trim() || "Image preview";
  return {
    kind: "image",
    src,
    title,
    meta: ""
  };
}

function previewFromEventTarget(target: EventTarget | null): ShowcasePreview | null {
  if (!(target instanceof Element)) return null;
  if (target.closest("[role='dialog']")) return null;
  const trigger = target.closest<HTMLElement>(PREVIEW_TRIGGER_SELECTOR);
  if (trigger) return previewFromTrigger(trigger);
  const image = target.closest<HTMLImageElement>(FALLBACK_IMAGE_SELECTOR);
  return image ? previewFromFallbackImage(image) : null;
}

export function DreamshootShowcasePreview({ children, className = "block" }: DreamshootShowcasePreviewProps) {
  const [gallery, setGallery] = useState<{ items: ShowcasePreview[]; index: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previewIndex = gallery?.index ?? 0;
  const preview = gallery?.items[previewIndex] ?? null;
  const total = gallery?.items.length ?? 0;

  const closePreview = () => setGallery(null);
  const stepPreview = (direction: -1 | 1) => {
    setGallery((current) => {
      if (!current?.items.length) return current;
      return {
        ...current,
        index: (current.index + direction + current.items.length) % current.items.length
      };
    });
  };

  const collectTriggerItems = useCallback((kind: ShowcasePreviewKind) => Array.from(rootRef.current?.querySelectorAll<HTMLElement>(PREVIEW_TRIGGER_SELECTOR) ?? [])
    .map(previewFromTrigger)
    .filter((item): item is ShowcasePreview => item !== null && item.kind === kind), []);

  const openPreview = useCallback((target: EventTarget | null) => {
    const nextPreview = previewFromEventTarget(target);
    if (!nextPreview) return false;
    const triggerItems = collectTriggerItems(nextPreview.kind);
    const index = Math.max(0, triggerItems.findIndex((item) => item.kind === nextPreview.kind && item.src === nextPreview.src));
    setGallery({ items: triggerItems.length ? triggerItems : [nextPreview], index });
    return true;
  }, [collectTriggerItems]);

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (openPreview(event.target)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (openPreview(event.target)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  useEffect(() => {
    if (!gallery) return;

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
      if (event.key === "ArrowLeft") stepPreview(-1);
      if (event.key === "ArrowRight") stepPreview(1);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleDocumentKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [gallery]);

  useEffect(() => {
    if (preview?.kind !== "video") return;
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;
    const frame = window.requestAnimationFrame(() => {
      void video.play().catch(() => {
        // The controls stay visible if the browser requires a second explicit play action.
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      video.pause();
    };
  }, [preview]);

  return (
    <div className={className} onClickCapture={handleClickCapture} onKeyDownCapture={handleKeyDownCapture} ref={rootRef}>
      {children}
      {preview ? (
        <div
          aria-label={preview.kind === "image" ? "Image example preview" : "Video example preview"}
          aria-modal="true"
          className="fixed inset-0 z-[160] bg-black text-white"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
          role="dialog"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_36%),linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.72))]" />
          <div
            className="absolute inset-0 flex items-center justify-center px-4 pb-16 pt-20 sm:px-20 sm:py-20"
            onClick={(event) => {
              if (event.target === event.currentTarget) closePreview();
            }}
          >
            {preview.kind === "image" ? (
              <img
                alt={preview.title}
                className="max-h-[calc(100vh-8.5rem)] max-w-[calc(100vw-2rem)] object-contain sm:max-h-[calc(100vh-10rem)] sm:max-w-[calc(100vw-10rem)]"
                data-dreamshoot-preview-media="image"
                decoding="async"
                src={preview.src}
              />
            ) : (
              <video
                key={preview.src}
                ref={videoRef}
                autoPlay
                className="max-h-[calc(100vh-8.5rem)] max-w-[calc(100vw-2rem)] bg-black object-contain sm:max-h-[calc(100vh-10rem)] sm:max-w-[calc(100vw-10rem)]"
                controls
                data-dreamshoot-preview-media="video"
                playsInline
                poster={preview.poster}
                preload="auto"
                src={preview.src}
                title={preview.title}
              />
            )}
          </div>
          <div className="pointer-events-none absolute inset-0">
            <div className="pointer-events-auto absolute left-3 top-3 rounded-r-[18px] bg-black/72 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_60px_-36px_rgba(0,0,0,0.95)] backdrop-blur sm:left-4 sm:top-4 sm:rounded-[18px]">
              {previewIndex + 1}/{total}
            </div>
            <button
              aria-label="Close preview"
              className="pointer-events-auto absolute right-3 top-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-black/72 text-white shadow-[0_18px_60px_-36px_rgba(0,0,0,0.95)] backdrop-blur transition hover:bg-white/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4 sm:top-4"
              onClick={closePreview}
              ref={closeButtonRef}
              type="button"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
            {total > 1 ? (
              <>
                <button
                  aria-label="Previous preview"
                  className="pointer-events-auto absolute left-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/58 text-white shadow-[0_18px_58px_-34px_rgba(0,0,0,0.95)] backdrop-blur transition hover:bg-white/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
                  onClick={() => stepPreview(-1)}
                  type="button"
                >
                  <ChevronLeft className="h-6 w-6" strokeWidth={1.8} />
                </button>
                <button
                  aria-label="Next preview"
                  className="pointer-events-auto absolute right-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/58 text-white shadow-[0_18px_58px_-34px_rgba(0,0,0,0.95)] backdrop-blur transition hover:bg-white/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
                  onClick={() => stepPreview(1)}
                  type="button"
                >
                  <ChevronRight className="h-6 w-6" strokeWidth={1.8} />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
