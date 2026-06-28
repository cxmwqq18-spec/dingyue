"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { ArrowRight } from "lucide-react";

export type PackageTaxonomyCard = {
  id: string;
  title: string;
  description: string;
  meta: string;
  keywords: string[];
  imageUrl: string;
  href: string;
  appHref: string;
  chips: string[];
};

function cardLinkLabel(action: string, title: string) {
  return `${action}: ${title || "this package"}`;
}

function slugFromHref(href: string) {
  const clean = href.split("?")[0]?.split("#")[0] ?? "";
  return clean.split("/").filter(Boolean).pop() ?? "";
}

function updateBrowserUrl(href: string) {
  if (!href || typeof window === "undefined") return;
  const target = new URL(href, window.location.href);
  if (target.origin !== window.location.origin) return;
  window.history.pushState({}, "", `${target.pathname}${target.search}${target.hash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function PackageTaxonomyClient({
  cards,
  initialSlug = "",
  variant = "dark"
}: {
  cards: PackageTaxonomyCard[];
  initialSlug?: string;
  variant?: "dark" | "cream";
}) {
  const initialCard = useMemo(() => {
    const normalized = initialSlug.trim().toLowerCase();
    if (!normalized) return null;
    return cards.find((card) => slugFromHref(card.href).toLowerCase() === normalized) ?? null;
  }, [cards, initialSlug]);
  const [selected, setSelected] = useState<PackageTaxonomyCard | null>(initialCard);

  function openCard(card: PackageTaxonomyCard, event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    setSelected(card);
    updateBrowserUrl(card.href);
    requestAnimationFrame(() => {
      document.getElementById("package-taxonomy")?.scrollIntoView({ block: "start" });
    });
  }

  if (selected) {
    const selectedPanelClass = variant === "cream"
      ? "rounded-[24px] border border-[#E6D8C3] bg-[#FFF8ED] p-5 shadow-[0_28px_90px_-64px_rgba(70,46,24,0.28)] sm:p-7"
      : "rounded-[24px] border border-white/12 bg-white/[0.07] p-5 shadow-[0_28px_90px_-60px_rgba(0,0,0,0.9)] sm:p-7";
    const selectedImageFrameClass = variant === "cream"
      ? "min-h-[360px] overflow-hidden rounded-[24px] border border-[#E6D8C3] bg-[#FFF8ED] p-3"
      : "min-h-[360px] overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.06] p-3";
    const selectedImageBgClass = variant === "cream" ? "bg-[#EADFCF]" : "bg-zinc-900";
    return (
      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" data-package-taxonomy-client="ready">
        <div className={selectedPanelClass}>
          <p className={variant === "cream" ? "text-xs font-semibold uppercase tracking-[0.18em] text-[#9B7A5D]" : "text-xs font-semibold uppercase tracking-[0.18em] text-white/44"}>Selected package</p>
          <h3 className={variant === "cream" ? "mt-4 text-[clamp(1.8rem,3vw,3.2rem)] font-semibold leading-none tracking-tight text-[#1E1712] [font-family:var(--site-title-font)]" : "mt-4 text-[clamp(1.8rem,3vw,3.2rem)] font-semibold leading-none tracking-tight text-white [font-family:var(--site-title-font)]"}>
            {selected.title}
          </h3>
          <p className={variant === "cream" ? "mt-4 max-w-2xl text-sm leading-7 text-[#6F6257]" : "mt-4 max-w-2xl text-sm leading-7 text-white/66"}>
            {selected.description || "Review this package direction, source-photo needs, credit use, and the private album experience before starting a generation request."}
          </p>
          {selected.chips.length ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {selected.chips.map((chip) => (
                <span className={variant === "cream" ? "rounded-full border border-[#E3D3BE] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#7B5C40]" : "rounded-full border border-white/12 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/68"} key={chip}>
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
          <a className={variant === "cream" ? "mt-7 inline-flex items-center gap-2 rounded-full bg-[#1E1712] px-5 py-3 text-sm font-semibold text-[#FFF8ED] transition hover:-translate-y-0.5 hover:bg-[#2A211A]" : "mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#101114] transition hover:-translate-y-0.5 hover:bg-white/90"} href={selected.appHref}>
            Start this package
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </a>
        </div>
        <div className={selectedImageFrameClass}>
          <div className={`relative h-full min-h-[336px] overflow-hidden rounded-[18px] ${selectedImageBgClass}`}>
            <img
              alt={`${selected.title} preview`}
              className="h-full min-h-[336px] w-full object-cover"
              decoding="async"
              fetchPriority="low"
              loading="lazy"
              src={selected.imageUrl}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10 grid auto-rows-[minmax(230px,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-12" data-package-taxonomy-client="ready">
      {cards.map((card, index) => {
        const mosaicVariant = index % 10;
        const cardSpanClass = mosaicVariant === 0
          ? "lg:col-span-7 lg:row-span-2"
          : mosaicVariant === 1
          ? "lg:col-span-5"
          : mosaicVariant === 2
          ? "lg:col-span-5"
          : mosaicVariant === 3
          ? "lg:col-span-6"
          : mosaicVariant === 4
          ? "lg:col-span-6"
          : mosaicVariant === 5
          ? "lg:col-span-4"
          : mosaicVariant === 6
          ? "lg:col-span-4"
          : mosaicVariant === 7
          ? "lg:col-span-4"
          : mosaicVariant === 8
          ? "lg:col-span-5"
          : "lg:col-span-7";
        const cardHeightClass = mosaicVariant === 0
          ? "min-h-[560px] lg:min-h-[600px]"
          : mosaicVariant === 1 || mosaicVariant === 2 || mosaicVariant === 9
          ? "min-h-[300px] lg:min-h-[320px]"
          : "min-h-[330px]";
        const cardClass = variant === "cream"
          ? `group relative flex overflow-hidden rounded-[18px] border border-[#E3D3BE] bg-[#FFF8ED] text-[#1E1712] shadow-[0_22px_48px_-42px_rgba(70,46,24,0.42)] transition hover:-translate-y-1 hover:border-[#B86E36]/45 sm:col-span-1 ${cardSpanClass} ${cardHeightClass}`
          : `group relative flex overflow-hidden rounded-[18px] border border-white/12 bg-white/[0.07] text-white shadow-[0_22px_46px_-38px_rgba(0,0,0,0.82)] transition hover:-translate-y-1 hover:border-white/24 sm:col-span-1 ${cardSpanClass} ${cardHeightClass}`;
        return (
          <a
            aria-label={cardLinkLabel("View collection", card.title)}
            className={cardClass}
            href={card.href}
            key={card.id}
            onClick={(event) => openCard(card, event)}
          >
            <img
              alt={card.title}
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"
              decoding="async"
              fetchPriority="low"
              loading="lazy"
              src={card.imageUrl}
            />
            <div className={variant === "cream" ? "absolute inset-0 bg-[linear-gradient(180deg,rgba(30,23,18,0.02)_0%,rgba(30,23,18,0.36)_48%,rgba(30,23,18,0.84)_100%)]" : "absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,10,0.08)_0%,rgba(8,8,10,0.45)_42%,rgba(8,8,10,0.92)_100%)]"} />
            <div className={variant === "cream" ? "absolute inset-0 bg-[linear-gradient(130deg,rgba(216,138,75,0.24),rgba(255,248,237,0)_52%)] opacity-0 transition group-hover:opacity-100" : "absolute inset-0 bg-[linear-gradient(130deg,rgba(201,88,242,0.2),rgba(22,220,240,0)_48%)] opacity-0 transition group-hover:opacity-100"} />
            <div className={`relative flex w-full flex-col p-5 sm:p-6 ${cardHeightClass}`}>
              <div className="flex items-start justify-between gap-3">
                <span className={variant === "cream" ? "max-w-[78%] rounded-full border border-white/38 bg-[#1E1712]/44 px-3 py-1 text-xs font-semibold text-[#FFF8ED] backdrop-blur" : "max-w-[78%] rounded-full border border-white/18 bg-black/34 px-3 py-1 text-xs font-semibold text-white/86 backdrop-blur"}>{card.meta}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/78 transition group-hover:translate-x-1 group-hover:text-white" strokeWidth={1.8} />
              </div>
              <div className="mt-auto">
                <h3 className="text-[clamp(1.35rem,2.1vw,1.9rem)] font-semibold leading-tight tracking-[-0.03em] text-balance">{card.title}</h3>
                <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-white/78">{card.description}</p>
                {card.keywords.length ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {card.keywords.slice(0, 4).map((keyword) => (
                      <span className={variant === "cream" ? "rounded-full bg-[#FFF8ED]/20 px-2.5 py-1 text-[11px] font-medium text-white/82 backdrop-blur" : "rounded-full bg-white/[0.12] px-2.5 py-1 text-[11px] font-medium text-white/72 backdrop-blur"} key={keyword}>
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
