"use client";

import { PlayCircle, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LazyStorefrontVideo } from "@/components/storefront/lazy-storefront-video";

type AidreamcapesVideoPreviewProps = {
  alt: string;
  className?: string;
  /** Show the browser's native video controls. The ambient loop stays muted
   * autoplay either way; controls let the visitor pause, scrub and unmute the
   * hero clip directly instead of only through the sound-on dialog. */
  controls?: boolean;
  /** Source for the sound-on dialog. Defaults to `src`; pass the full-quality
   * file here when `src` is a lightweight ambient loop (the 10s preview). */
  dialogSrc?: string;
  deferLoading?: boolean;
  height?: number;
  nearViewportPreload?: "metadata" | "auto";
  poster?: string;
  src: string;
  videoClassName?: string;
  width?: number;
};

export function AidreamcapesVideoPreview({
  alt,
  className = "",
  controls = false,
  dialogSrc,
  deferLoading = false,
  height = 720,
  nearViewportPreload = "metadata",
  poster,
  src,
  videoClassName = "h-full w-full object-cover",
  width = 1280
}: AidreamcapesVideoPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const video = dialogVideoRef.current;
    if (video) {
      void video.play().catch(() => undefined);
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const openPreview = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsOpen(true);
  };

  return (
    <>
      <div
        aria-label={`Open ${alt} with sound`}
        className={`group relative cursor-zoom-in ${className}`}
        data-aidreamcapes-video-preview-trigger
        onClick={openPreview}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") openPreview(event);
        }}
        role="button"
        tabIndex={0}
      >
        <LazyStorefrontVideo
          aria-label={alt}
          autoPlay
          className={videoClassName}
          {...(controls ? {
            // Native controls receive their own clicks; without stopping the
            // propagation here, every tap on play or mute also bubbles to the
            // wrapper and pops the sound-on dialog open over the visitor.
            onClick: (event: React.MouseEvent) => event.stopPropagation(),
            controls: true
          } : {})}
          deferLoading={deferLoading}
          height={height}
          loop
          muted
          nearViewportPreload={nearViewportPreload}
          playsInline
          poster={poster}
          src={src}
          width={width}
        />
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/20">
          {/* With native controls the click toggles playback in place, so the
              sound dialog is reached with Enter instead; the hover hint that
              promised a click would lie about that. */}
          {!controls && (
            <span className="flex items-center gap-2 rounded-full border border-white/35 bg-black/55 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white opacity-0 backdrop-blur-md transition group-hover:opacity-100">
              <PlayCircle aria-hidden="true" className="h-4 w-4" strokeWidth={1.7} />
              Preview with sound
            </span>
          )}
        </span>
      </div>

      {isOpen ? (
        <div
          aria-label={`${alt} video preview`}
          aria-modal="true"
          className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-4 backdrop-blur-md sm:p-8"
          data-aidreamcapes-video-preview-dialog
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
          role="dialog"
        >
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[22px] border border-white/15 bg-[#09090d] shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-white sm:px-5">
              <div className="flex min-w-0 items-center gap-2">
                <Volume2 aria-hidden="true" className="h-4 w-4 shrink-0 text-[#d8b4fe]" strokeWidth={1.8} />
                <span className="truncate text-xs font-semibold uppercase tracking-[0.14em]">{alt}</span>
              </div>
              <button
                aria-label="Close video preview"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/75 transition hover:border-white/35 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
            <video
              autoPlay
              className="max-h-[78vh] w-full bg-black object-contain"
              controls
              height={height}
              loop
              playsInline
              poster={poster}
              ref={dialogVideoRef}
              src={dialogSrc ?? src}
              width={width}
            />
            <div className="border-t border-white/10 px-4 py-3 text-[11px] text-white/55 sm:px-5">
              Sound is on by default. Use the native controls to mute or pause.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
