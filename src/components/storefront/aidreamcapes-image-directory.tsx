"use client";

import { ArrowUpRight, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AidreamcapesProjectedImage as AidreamcapesResponsiveImage } from "./aidreamcapes-projected-image.client";

export type AidreamcapesImageDirectoryCard = {
  slug: string;
  href: string;
  title: string;
  description: string;
  group: string;
  groupLabel: string;
  imageUrl: string;
  fallbackImageUrl?: string;
  imageAlt: string;
  width: number;
  height: number;
  tags: string[];
};

type AidreamcapesImageDirectoryProps = {
  cards: AidreamcapesImageDirectoryCard[];
  sectionId: string;
};

const groupAccents: Record<string, { dot: string; text: string; wash: string }> = {
  commerce: { dot: "#f5b46d", text: "text-[#f5c58f]", wash: "bg-[#f5b46d]/[0.12]" },
  campaign: { dot: "#f48ba8", text: "text-[#f6b1c4]", wash: "bg-[#f48ba8]/[0.12]" },
  people: { dot: "#9eb4ff", text: "text-[#bdc9ff]", wash: "bg-[#9eb4ff]/[0.12]" },
  utility: { dot: "#7ee4d2", text: "text-[#a3f1e3]", wash: "bg-[#7ee4d2]/[0.12]" }
};

function coverAlt(card: AidreamcapesImageDirectoryCard): string {
  return card.imageAlt.trim() || `${card.title} example from Aidreamcapes`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function DirectoryImage({
  alt,
  className,
  fallbackImageUrl,
  loading,
  priority,
  src,
  sizes,
  width,
  height
}: {
  alt: string;
  className: string;
  fallbackImageUrl?: string;
  loading: "eager" | "lazy";
  priority?: boolean;
  src: string;
  sizes: string;
  width: number;
  height: number;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setFailed(false);
  }, [src]);

  const useFallback = () => {
    if (fallbackImageUrl && currentSrc !== fallbackImageUrl) {
      setCurrentSrc(fallbackImageUrl);
      return;
    }
    setFailed(true);
  };

  if (failed) {
    return (
      <div
        aria-label={`${alt} unavailable`}
        className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(245,180,109,0.16),transparent_42%),#151821] px-6 text-center"
        role="img"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.42]">Image preview unavailable</span>
      </div>
    );
  }

  return (
    <AidreamcapesResponsiveImage
      alt={alt}
      className={className}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      height={height}
      loading={loading}
      onError={useFallback}
      sizes={sizes}
      src={currentSrc}
      width={width}
    />
  );
}

export function AidreamcapesImageDirectory({ cards, sectionId }: AidreamcapesImageDirectoryProps) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");
  const normalizedQuery = normalize(query);
  const groups = useMemo(() => Array.from(new Map(cards.map((card) => [card.group, card.groupLabel])).entries()), [cards]);
  const filteredCards = useMemo(() => {
    if (!normalizedQuery && activeGroup === "all") return cards;
    return cards.filter((card) => {
      const matchesGroup = activeGroup === "all" || card.group === activeGroup;
      const searchText = normalize([card.title, card.description, card.groupLabel, ...card.tags].join(" "));
      return matchesGroup && (!normalizedQuery || searchText.includes(normalizedQuery));
    });
  }, [activeGroup, cards, normalizedQuery]);
  const featured = filteredCards[0];
  const remaining = featured ? filteredCards.slice(1) : [];

  return (
    <section className="relative isolate overflow-hidden bg-[#08090d] px-5 pb-24 pt-12 text-white sm:px-8 sm:pb-32 sm:pt-16 lg:pt-20" data-aidreamcapes-image-directory="true" id={sectionId}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-14rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#e58b55]/[0.12] blur-[130px]" />
        <div className="absolute right-[-12rem] top-[12rem] h-[34rem] w-[34rem] rounded-full bg-[#6e7bff]/[0.13] blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_92%)]" />
      </div>

      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-10 border-b border-white/[0.11] pb-12 lg:grid-cols-[minmax(0,0.96fr)_minmax(390px,0.8fr)] lg:items-end lg:gap-20 lg:pb-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.045] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/[0.62]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f5b46d] shadow-[0_0_16px_rgba(245,180,109,0.95)]" />
              Live visual index
            </div>
            <h1 className="mt-7 max-w-4xl text-balance text-[clamp(3.35rem,7.8vw,7.8rem)] font-semibold leading-[0.88] tracking-[-0.075em] text-white [font-family:var(--site-title-font)]">
              Find the image system for the next brief.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/[0.62] sm:text-lg">
              Browse live Aidreamcapes themes for product pages, campaign moments, creator profiles, and the visual details that make a catalog feel considered.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/[0.42]">
              <span><strong className="text-white">{cards.length}</strong> live themes</span>
              <span><strong className="text-white">{groups.length}</strong> creative lanes</span>
              <span>Published detail pages</span>
            </div>
          </div>

          {featured ? (
            <a className="group relative min-h-[330px] overflow-hidden rounded-[28px] border border-white/[0.14] bg-[#12141b] shadow-[0_38px_100px_-62px_rgba(245,180,109,0.5)]" data-image-theme-featured={featured.slug} href={featured.href}>
              <DirectoryImage alt={coverAlt(featured)} className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-[1.035] group-hover:opacity-100" fallbackImageUrl={featured.fallbackImageUrl} height={featured.height} loading="eager" priority sizes="(max-width: 1023px) 100vw, 40vw" src={featured.imageUrl} width={featured.width} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,10,0.05)_20%,rgba(5,6,10,0.9)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.68]">
                  <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#f5b46d]" /> Featured direction</span>
                  <ArrowUpRight className="h-4 w-4 text-white/[0.7] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.8} />
                </div>
                <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-4xl">{featured.title}</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/[0.7]">{featured.description}</p>
              </div>
            </a>
          ) : null}
        </div>

        <div className="sticky top-0 z-20 -mx-5 border-b border-white/[0.1] bg-[#08090d]/90 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8" data-aidreamcapes-image-directory-controls>
          <div className="mx-auto flex max-w-[1440px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              <SlidersHorizontal className="mr-1 h-4 w-4 shrink-0 text-white/[0.45]" strokeWidth={1.7} />
              <button className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${activeGroup === "all" ? "border-white bg-white text-[#08090d]" : "border-white/[0.14] bg-white/[0.04] text-white/[0.62] hover:border-white/[0.3] hover:text-white"}`} onClick={() => setActiveGroup("all")} type="button">All themes</button>
              {groups.map(([key, label]) => {
                const accent = groupAccents[key] ?? groupAccents.utility;
                return <button className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${activeGroup === key ? `${accent.wash} border-white/[0.38] ${accent.text}` : "border-white/[0.14] bg-white/[0.04] text-white/[0.62] hover:border-white/[0.3] hover:text-white"}`} key={key} onClick={() => setActiveGroup(key)} type="button">{label}</button>;
              })}
            </div>
            <label className="flex min-w-0 items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.05] px-4 py-2.5 text-sm text-white/[0.75] focus-within:border-white/[0.4] lg:w-[280px]">
              <Search className="h-4 w-4 shrink-0 text-white/[0.45]" strokeWidth={1.8} />
              <span className="sr-only">Search image themes</span>
              <input className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/[0.38]" onChange={(event) => setQuery(event.target.value)} placeholder="Search themes" value={query} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/[0.35]">{filteredCards.length}</span>
            </label>
          </div>
        </div>

        <div className="mt-12">
          {filteredCards.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {remaining.map((card, index) => {
                const accent = groupAccents[card.group] ?? groupAccents.utility;
                return (
                  <a className="group relative overflow-hidden rounded-[22px] border border-white/[0.12] bg-white/[0.045] transition duration-300 hover:-translate-y-1 hover:border-white/[0.28] hover:bg-white/[0.07]" data-image-theme-card={card.slug} data-image-theme-group={card.group} href={card.href} key={card.slug}>
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#151821]">
                      <DirectoryImage alt={coverAlt(card)} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" fallbackImageUrl={card.fallbackImageUrl} height={card.height} loading="lazy" sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw" src={card.imageUrl} width={card.width} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/[0.62] via-transparent to-transparent" />
                      <span className={`absolute left-4 top-4 rounded-full border border-white/[0.18] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/[0.82] ${accent.wash}`}>{card.groupLabel}</span>
                      <span className="absolute bottom-4 right-4 grid h-8 w-8 place-items-center rounded-full border border-white/[0.2] bg-black/[0.28] text-white/[0.8] backdrop-blur transition group-hover:bg-white group-hover:text-[#11131a]"><ArrowUpRight className="h-4 w-4" strokeWidth={1.8} /></span>
                    </div>
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${accent.text}`}>{String(index + 2).padStart(2, "0")} / {card.tags[0] ?? "AI image"}</p>
                          <h2 className="mt-3 text-xl font-semibold leading-tight tracking-[-0.03em] text-white">{card.title}</h2>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/[0.56]">{card.description}</p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {card.tags.slice(0, 2).map((tag) => <span className="rounded-full border border-white/[0.11] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/[0.55]" key={tag}>{tag}</span>)}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/[0.18] px-6 py-16 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-[#f5b46d]" strokeWidth={1.6} />
              <p className="mt-4 text-lg font-semibold text-white">No themes match that search.</p>
              <button className="mt-4 text-sm font-semibold text-white/[0.62] underline decoration-white/[0.25] underline-offset-4 hover:text-white" onClick={() => { setActiveGroup("all"); setQuery(""); }} type="button">Clear filters</button>
            </div>
          )}
        </div>

        <div className="mt-16 grid gap-5 border-t border-white/[0.1] pt-8 sm:grid-cols-3">
          {[
            ["01", "Start with the job", "Choose the output before you choose the look."],
            ["02", "Open the detail page", "See the cover, examples, formats, and review notes."],
            ["03", "Make the next cut", "Bring the direction into your private workspace when it is ready."]
          ].map(([number, title, body]) => (
            <div className="rounded-[20px] border border-white/[0.1] bg-white/[0.035] p-5" key={number}>
              <span className="text-[11px] font-semibold tracking-[0.18em] text-[#f5b46d]">{number}</span>
              <h2 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/[0.5]">{body}</p>
            </div>
          ))}
        </div>

        <section className="mt-10 rounded-[24px] border border-white/[0.1] bg-white/[0.03] p-6 sm:p-8" aria-labelledby="image-directory-guides">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f5c58f]">Continue the workflow</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white" id="image-directory-guides">Guides for better AI image decisions</h2>
          <nav aria-label="Aidreamcapes image guides" className="mt-5 flex flex-wrap gap-3">
            {[
              ["AI product photography guide", "/blog/ai-image-generator-tutorial-product-photos-from-one-shot"],
              ["Ecommerce image workflow", "/blog/ecommerce-product-image-workflow"],
              ["Safe AI content guide", "/blog/ai-content-disclosure-safe-usage"]
            ].map(([label, href]) => <a className="inline-flex min-h-10 items-center rounded-full border border-white/[0.16] bg-white/[0.04] px-4 text-sm font-medium text-white/[0.78] transition hover:border-white/[0.32] hover:bg-white/[0.08] hover:text-white" href={href} key={href}>{label}</a>)}
          </nav>
        </section>
      </div>
    </section>
  );
}
