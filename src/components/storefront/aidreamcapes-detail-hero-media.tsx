"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AidreamcapesResponsiveImage } from "@/components/storefront/aidreamcapes-responsive-image";
import { AidreamcapesVideoPreview } from "@/components/storefront/aidreamcapes-video-preview";
import type { AidreamcapesAdsTestingImage, AiVideoTopicVideo } from "@/lib/ai-video-topic-content";

type HeroSlide = {
  image: AidreamcapesAdsTestingImage;
  label: string;
};

export function AidreamcapesDetailHeroMedia({
  imageNote,
  outputImage,
  outputLabel,
  productImage,
  productLabel,
  video
}: {
  imageNote: string;
  outputImage: AidreamcapesAdsTestingImage;
  outputLabel: string;
  productImage: AidreamcapesAdsTestingImage;
  productLabel: string;
  video?: AiVideoTopicVideo;
}) {
  const slides = useMemo<HeroSlide[]>(() => [
    { image: outputImage, label: outputLabel },
    { image: productImage, label: productLabel }
  ], [outputImage, outputLabel, productImage, productLabel]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex] ?? slides[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [slides]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      setActiveIndex((current) => {
        const direction = event.key === "ArrowRight" ? 1 : -1;
        return (current + direction + slides.length) % slides.length;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slides.length]);

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-stretch" data-aidreamcapes-detail-hero-media>
      <div className="rounded-[22px] border border-white/10 bg-[#08080b] p-3 sm:p-4">
        <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-[#101117]">
          <AidreamcapesResponsiveImage
            alt={activeSlide.image.alt}
            className="aspect-[4/5] h-full w-full object-cover"
            decoding="async"
            fetchPriority="high"
            height={activeSlide.image.height}
            loading="eager"
            sizes="(max-width: 1024px) 100vw, 320px"
            src={activeSlide.image.src}
            width={activeSlide.image.width}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80 backdrop-blur-md">
              {String(activeIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </span>
            <span className="rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80 backdrop-blur-md">
              {activeSlide.label}
            </span>
          </div>
          <div className="absolute inset-x-3 bottom-3 flex justify-between gap-2">
            <button
              aria-label="Previous hero image"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-md transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]"
              onClick={() => move(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <span className="rounded-full border border-white/20 bg-black/55 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 backdrop-blur-md">
              {imageNote}
            </span>
            <button
              aria-label="Next hero image"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-md transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]"
              onClick={() => move(1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2" role="tablist" aria-label="Hero image carousel">
          {slides.map((slide, index) => (
            <button
              aria-label={`Show ${slide.label}`}
              aria-selected={index === activeIndex}
              className={`overflow-hidden rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd] ${index === activeIndex ? "border-[#b8a7ff] shadow-[0_0_0_1px_rgba(184,167,255,0.35)]" : "border-white/10 opacity-55 hover:opacity-90"}`}
              key={slide.label}
              onClick={() => setActiveIndex(index)}
              role="tab"
              type="button"
            >
              <AidreamcapesResponsiveImage
                alt=""
                className="aspect-[4/3] h-full w-full object-cover"
                decoding="async"
                height={slide.image.height}
                loading="lazy"
                sizes="(max-width: 1024px) 50vw, 160px"
                src={slide.image.src}
                width={slide.image.width}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-[#ec4899]/30 bg-[#0d0a14] shadow-[0_0_42px_rgba(236,72,153,0.13)]">
        {video ? (
          <AidreamcapesVideoPreview
            alt={video.alt ?? video.label}
            className="relative aspect-video h-full min-h-[280px] w-full lg:min-h-full"
            nearViewportPreload="auto"
            poster={video.poster}
            src={video.src}
            videoClassName="aspect-video h-full min-h-[280px] w-full object-cover lg:min-h-full"
          />
        ) : (
          <AidreamcapesResponsiveImage
            alt={outputImage.alt}
            className="aspect-video h-full min-h-[280px] w-full object-cover lg:min-h-full"
            decoding="async"
            fetchPriority="high"
            height={outputImage.height}
            loading="eager"
            sizes="(max-width: 1024px) 100vw, 800px"
            src={outputImage.src}
            width={outputImage.width}
          />
        )}
        {video ? (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-white/50">
            <span className="text-[#f2b4ff]">{video.label}</span>
            <span>Click to preview with sound · {video.width}:{video.height}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
