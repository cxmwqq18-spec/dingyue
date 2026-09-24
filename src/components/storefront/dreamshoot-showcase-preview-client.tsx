"use client";

import { ExternalLink, X } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type PreviewMedia = {
  kind: "image" | "video";
  meta: string;
  poster: string;
  src: string;
  title: string;
};

function previewTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("[data-dreamshoot-showcase-preview][data-dreamshoot-preview-src]")
    || target.closest<HTMLImageElement>("img[src]:not([data-dreamshoot-preview-disabled])");
}

function previewMediaFor(target: HTMLElement): PreviewMedia | null {
  const image = target instanceof HTMLImageElement ? target : target.querySelector<HTMLImageElement>("img[src]");
  const src = target.dataset.dreamshootPreviewSrc?.trim() || image?.currentSrc || image?.src || "";
  if (!src) return null;
  return {
    kind: target.dataset.dreamshootShowcasePreview === "video" ? "video" : "image",
    meta: target.dataset.dreamshootPreviewMeta?.trim() || "",
    poster: target.dataset.dreamshootPreviewPoster?.trim() || image?.currentSrc || image?.src || "",
    src,
    title: target.dataset.dreamshootPreviewTitle?.trim() || image?.alt.trim() || target.getAttribute("alt")?.trim() || "Media preview"
  };
}

export function DreamshootShowcasePreviewClient({ children, className, locale = "en" }: { children: ReactNode; className?: string; locale?: "en" | "fr" }) {
  const [preview, setPreview] = useState<PreviewMedia | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const closePreview = () => {
    setPreview(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  const openPreview = (target: HTMLElement) => {
    const media = previewMediaFor(target);
    if (!media) return;
    openerRef.current = target;
    setPreview(media);
  };

  const isNearestScope = (target: HTMLElement, currentTarget: HTMLElement) =>
    target.closest<HTMLElement>("[data-dreamshoot-preview-root]") === currentTarget;

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = previewTarget(event.target);
    if (!target || !isNearestScope(target, event.currentTarget)) return;
    event.preventDefault();
    event.stopPropagation();
    openPreview(target);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = previewTarget(event.target);
    if (!target || !isNearestScope(target, event.currentTarget)) return;
    event.preventDefault();
    event.stopPropagation();
    openPreview(target);
  };

  useEffect(() => {
    if (!preview) return;
    closeRef.current?.focus();
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [preview]);

  const mediaLabel = preview?.kind === "video" ? (locale === "fr" ? "vidéo" : "video") : "image";
  const previewTitle = locale === "fr" ? "Aperçu" : "Preview";
  const openOriginalLabel = locale === "fr" ? `Ouvrir la ${mediaLabel} originale` : `Open original ${mediaLabel}`;
  const closeLabel = locale === "fr" ? `Fermer l’aperçu ${mediaLabel}` : `Close ${mediaLabel} preview`;

  return (
    <div className={`${className || ""} [&_img:not([data-dreamshoot-preview-disabled])]:cursor-zoom-in [&_video:not([data-dreamshoot-preview-disabled])]:cursor-zoom-in`.trim()} data-dreamshoot-preview-root="true" onClick={onClick} onKeyDown={onKeyDown}>
      {children}
      {preview ? (
        <div aria-describedby={preview.meta ? "dreamshoot-media-preview-meta" : undefined} aria-label={`${previewTitle} : ${preview.title}`} aria-modal="true" className="fixed inset-0 z-[160] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8" onClick={closePreview} role="dialog">
          <div className="relative flex max-h-full w-full max-w-6xl flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex min-h-9 items-center justify-between gap-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{preview.title}</p>
                {preview.meta ? <p className="truncate text-xs text-white/68" id="dreamshoot-media-preview-meta">{preview.meta}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a aria-label={openOriginalLabel} className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/35 text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" href={preview.src} rel="noreferrer" target="_blank" title={openOriginalLabel}><ExternalLink aria-hidden="true" className="h-4 w-4" /></a>
                <button aria-label={closeLabel} className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/35 text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={closePreview} ref={closeRef} title={locale === "fr" ? "Fermer l’aperçu" : "Close preview"} type="button"><X aria-hidden="true" className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="flex min-h-0 justify-center overflow-hidden rounded-[8px] bg-transparent">
              {preview.kind === "video" ? <video autoPlay className="h-auto max-h-[calc(100vh-9rem)] w-auto max-w-full object-contain" controls playsInline poster={preview.poster || undefined} preload="metadata" src={preview.src} /> : <img alt={preview.title} className="h-auto max-h-[calc(100vh-9rem)] w-auto max-w-full object-contain" src={preview.src} />}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
