"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AidreamcapesImageAsset } from "@/components/storefront/aidreamcapes-image-theme-media";
import type { AidreamcapesImageThemeDetailContent } from "@/lib/aidreamcapes-image-theme-content";

type GalleryItems = AidreamcapesImageThemeDetailContent["examples"]["items"];
type GalleryItem = GalleryItems[number];
export type AidreamcapesImageThemeGalleryMode = "masonry" | "storyboard" | "portrait-set" | "comparison" | "catalog";

type GalleryProps = {
  items: GalleryItems;
  mode: AidreamcapesImageThemeGalleryMode;
};

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function columnCountForWidth(width: number, mode: AidreamcapesImageThemeGalleryMode): number {
  if (width < 640) return 2;
  if (width < 1024) return 3;
  return mode === "storyboard" ? 3 : 4;
}

function gridClass(mode: AidreamcapesImageThemeGalleryMode): string {
  if (mode === "storyboard") return "grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-3";
  if (mode === "portrait-set") return "grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4";
  return "grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4";
}

function estimatedCardHeight(item: GalleryItem): number {
  return (item.image.height / item.image.width) * 320 + Math.min(160, item.body.length * 1.8) + 72;
}

function balancedColumns(items: GalleryItems, count: number): Array<Array<{ item: GalleryItem; index: number }>> {
  const columnCount = Math.max(2, Math.min(4, count));
  const columns = Array.from({ length: columnCount }, () => ({ items: [] as Array<{ item: GalleryItem; index: number }>, height: 0 }));
  const indexedItems = items.map((item, index) => ({ item, index, height: estimatedCardHeight(item) }));
  const first = indexedItems.shift();
  if (first) {
    columns[0].items.push(first);
    columns[0].height += first.height;
  }
  indexedItems.sort((left, right) => right.height - left.height);
  for (const entry of indexedItems) {
    const target = columns.reduce((shortest, column) => column.height < shortest.height ? column : shortest, columns[0]);
    target.items.push(entry);
    target.height += entry.height;
  }
  return columns.map((column) => column.items);
}

function GalleryCard({ item, index, className = "", onOpen }: { item: GalleryItem; index: number; className?: string; onOpen: (index: number, trigger: HTMLElement) => void }) {
  return (
    <figure className={`group h-fit min-w-0 self-start overflow-hidden rounded-[20px] border border-white/10 bg-[#0b0c10] ${className}`}>
      <button
        aria-label={`Open ${item.title}`}
        className="relative block w-full cursor-zoom-in text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#c4b5fd]"
        onClick={(event) => onOpen(index, event.currentTarget)}
        type="button"
      >
        <div className="relative overflow-hidden bg-[#111217]">
          <AidreamcapesImageAsset className="block h-auto w-full object-contain transition duration-700 group-hover:scale-[1.02]" image={item.image} />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-4 pb-4 pt-14 text-white">
            <span className="min-w-0 truncate text-sm font-semibold tracking-[-0.01em]">{item.title}</span>
            <span className="shrink-0 font-mono text-[10px] tracking-[0.2em] text-white/55">{String(index + 1).padStart(2, "0")}</span>
          </span>
        </div>
      </button>
      <figcaption className="border-t border-white/10 px-4 py-3">
        <p className="text-xs leading-5 text-white/48">{item.body}</p>
      </figcaption>
    </figure>
  );
}

export function AidreamcapesImageThemeGallery({ items, mode }: GalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Desktop is the SSR-safe default. The previous default of two columns
  // painted a visibly incomplete desktop gallery before the resize effect ran.
  const [galleryColumnCount, setGalleryColumnCount] = useState(4);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (activeIndex === null) return undefined;
    scrollYRef.current = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((current) => current === null ? null : (current + items.length - 1) % items.length);
      if (event.key === "ArrowRight") setActiveIndex((current) => current === null ? null : (current + 1) % items.length);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [activeIndex, items.length]);

  useIsomorphicLayoutEffect(() => {
    const updateColumnCount = () => {
      setGalleryColumnCount(columnCountForWidth(window.innerWidth, mode));
    };
    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, [mode]);

  useEffect(() => {
    if (activeIndex === null) triggerRef.current?.focus();
  }, [activeIndex]);

  const openImage = (index: number, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setActiveIndex(index);
  };

  return (
    <>
      <div data-image-gallery-layout="balanced-columns" data-image-gallery-mode={mode}>
        <div className={gridClass(mode)}>
          {balancedColumns(items, galleryColumnCount).map((column, columnIndex) => (
            <div className="min-w-0 space-y-3" key={`${mode}-column-${columnIndex}`}>
              {column.map(({ item, index }) => (
                <GalleryCard index={index} item={item} key={`${item.title}-${index}`} onOpen={openImage} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {activeIndex !== null ? (
        <div aria-label={items[activeIndex].title} aria-modal="true" className="fixed inset-0 z-[260] grid place-items-center bg-black/90 p-5 backdrop-blur-md sm:p-10" onClick={() => setActiveIndex(null)} role="dialog">
          <button aria-label="Close image preview" className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/40 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4b5fd]" onClick={() => setActiveIndex(null)} ref={closeButtonRef} type="button"><X className="h-5 w-5" strokeWidth={1.8} /></button>
          <button aria-label="Previous image" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/45 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4b5fd] sm:left-6" onClick={(event) => { event.stopPropagation(); setActiveIndex((activeIndex + items.length - 1) % items.length); }} type="button"><ChevronLeft className="h-5 w-5" strokeWidth={1.8} /></button>
          <figure className="max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <AidreamcapesImageAsset className="max-h-[82vh] w-auto max-w-full rounded-[18px] object-contain shadow-2xl" fallbackLabel="Preview unavailable" image={items[activeIndex].image} priority />
            <figcaption className="mt-4 text-center text-sm text-white/70">{items[activeIndex].title}</figcaption>
          </figure>
          <button aria-label="Next image" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4b5fd] sm:right-6" onClick={(event) => { event.stopPropagation(); setActiveIndex((activeIndex + 1) % items.length); }} type="button"><ChevronRight className="h-5 w-5" strokeWidth={1.8} /></button>
        </div>
      ) : null}
    </>
  );
}
