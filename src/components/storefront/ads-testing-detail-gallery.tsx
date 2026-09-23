"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AidreamcapesResponsiveImage } from "@/components/storefront/aidreamcapes-responsive-image";
import type { AidreamcapesAdsTestingImage } from "@/lib/ai-video-topic-content";

export type AdsTestingGalleryImage = AidreamcapesAdsTestingImage;

export function AdsTestingDetailGallery({
  items,
}: {
  items: Array<{ title: string; body: string; image: AdsTestingGalleryImage }>;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const modalScrollY = useRef<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalOpen = activeIndex !== null;

  const openPreview = (index: number) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalScrollY.current = window.scrollY;
    setActiveIndex(index);
  };

  useEffect(() => {
    if (!modalOpen) return undefined;
    const scrollY = modalScrollY.current ?? window.scrollY;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((current) => current === null ? null : (current + items.length - 1) % items.length);
      if (event.key === "ArrowRight") setActiveIndex((current) => current === null ? null : (current + 1) % items.length);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyStyle.overflow;
      document.body.style.position = previousBodyStyle.position;
      document.body.style.top = previousBodyStyle.top;
      document.body.style.width = previousBodyStyle.width;
      window.scrollTo(0, scrollY);
    };
  }, [modalOpen, items.length]);

  useEffect(() => {
    if (activeIndex !== null) {
      closeButtonRef.current?.focus();
      return undefined;
    }
    triggerRef.current?.focus();
    triggerRef.current = null;
    if (modalScrollY.current !== null) {
      window.scrollTo(0, modalScrollY.current);
      modalScrollY.current = null;
    }
    return undefined;
  }, [activeIndex]);

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-ads-testing-gallery>
        {items.map((item, index) => (
          <article className="group overflow-hidden rounded-[24px] border border-white/10 bg-[#12101a]" key={`${item.title}-${index}`}>
            <button
              aria-label={item.title}
              className="relative block aspect-[16/10] w-full cursor-zoom-in overflow-hidden text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#c4b5fd]"
              onClick={() => openPreview(index)}
              type="button"
            >
              <AidreamcapesResponsiveImage
                alt={item.image.alt}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                decoding="async"
                fetchPriority={item.image.fetchPriority}
                height={item.image.height}
                loading={item.image.loading}
                sizes={item.image.sizes}
                src={item.image.src}
                width={item.image.width}
              />
              <span className="pointer-events-none absolute bottom-3 left-3 inline-flex max-w-[calc(100%-1.5rem)] rounded-full border border-white/25 bg-black/65 px-3 py-1.5 text-[11px] font-semibold leading-4 text-white shadow-lg backdrop-blur-md">
                {item.title}
              </span>
            </button>
            <p className="px-5 pb-5 pt-4 text-sm leading-6 text-white/62">{item.body}</p>
          </article>
        ))}
      </div>

      {activeIndex !== null ? (
        <div
          aria-labelledby="aidreamcapes-image-preview-title"
          aria-modal="true"
          className="fixed inset-0 z-[260] grid place-items-center overflow-y-auto overscroll-contain bg-black/90 p-5 backdrop-blur-md sm:p-10"
          onClick={() => setActiveIndex(null)}
          role="dialog"
        >
          <button
            aria-label="Close image preview"
            className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/40 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4b5fd]"
            onClick={() => setActiveIndex(null)}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <button
            aria-label="Previous image"
            className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/45 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4b5fd] sm:left-6"
            onClick={(event) => { event.stopPropagation(); setActiveIndex((activeIndex + items.length - 1) % items.length); }}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <figure className="max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <img
              alt={items[activeIndex].image.alt}
              className="max-h-[82vh] w-auto max-w-full rounded-[18px] object-contain shadow-2xl"
              decoding="async"
              fetchPriority="high"
              height={items[activeIndex].image.height}
              loading="eager"
              sizes={items[activeIndex].image.sizes}
              src={items[activeIndex].image.src}
              width={items[activeIndex].image.width}
            />
            <figcaption className="mt-4 text-center text-sm text-white/70" id="aidreamcapes-image-preview-title">{items[activeIndex].title}</figcaption>
          </figure>
          <button
            aria-label="Next image"
            className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/45 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4b5fd] sm:right-6"
            onClick={(event) => { event.stopPropagation(); setActiveIndex((activeIndex + 1) % items.length); }}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>
      ) : null}
    </>
  );
}
