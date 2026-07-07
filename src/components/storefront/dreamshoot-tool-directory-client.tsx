"use client";

import { useMemo } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";

export type DreamshootToolDirectoryCard = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  href: string;
};

function cardLinkLabel(action: string, title: string) {
  const cleanTitle = title.replace(/\s+/g, " ").trim() || "this tool";
  return `${action} ${cleanTitle}`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tools";
}

export function DreamshootToolDirectoryClient({
  cards,
  categories,
  dark = false,
  primaryCta,
  primaryHref,
  secondaryCta,
  secondaryHref,
  sectionId
}: {
  cards: DreamshootToolDirectoryCard[];
  categories: string[];
  dark?: boolean;
  primaryCta: string;
  primaryHref: string;
  secondaryCta: string;
  secondaryHref: string;
  sectionId: string;
}) {
  const allCategories = useMemo(
    () => Array.from(new Set([...categories, ...cards.map((card) => card.category)])),
    [categories, cards]
  );

  return (
    <>
      <div className="mt-10 grid gap-12">
        {allCategories.map((category) => {
          const grouped = cards.filter((card) => card.category === category);
          if (!grouped.length) return null;
          return (
            <div id={`${sectionId}-${slugify(category)}`} key={category}>
              <div className={dark ? "mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4" : "mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#d3e0dc] pb-4"}>
                <div>
                  <h3 className={dark ? "text-2xl font-bold tracking-tight text-white sm:text-3xl" : "text-2xl font-bold tracking-tight text-[#18202d] sm:text-3xl"}>{category}</h3>
                  <p className={dark ? "mt-2 text-sm text-white/52" : "mt-2 text-sm text-[#637077]"}>{grouped.length} tools with clear pages and guided next steps.</p>
                </div>
                <span className={dark ? "rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white/50" : "rounded-full border border-[#c6d8d3] bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#57706a]"}>
                  {grouped.length} entries
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {grouped.map((tool) => (
                  <a
                    aria-label={cardLinkLabel("Open", tool.title)}
                    className={dark ? "group flex min-h-[240px] flex-col rounded-[18px] border border-white/10 bg-white/[0.04] p-5 text-white transition hover:-translate-y-1 hover:bg-white/[0.08]" : "group flex min-h-[240px] flex-col rounded-[18px] border border-[#d9e5e1] bg-white p-5 text-[#151a24] shadow-[0_20px_60px_-56px_rgba(23,74,67,0.48)] transition hover:-translate-y-1 hover:border-[#88bdb2] hover:shadow-[0_26px_76px_-58px_rgba(23,74,67,0.65)]"}
                    href={tool.href}
                    key={tool.id}
                  >
                    <div className="flex flex-wrap gap-2">
                      {tool.tags.map((tag) => (
                        <span className={dark ? "rounded-[8px] border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white/72" : "rounded-[8px] border border-[#cfe1dc] bg-[#eff7f4] px-2.5 py-1 text-xs font-semibold text-[#287066]"} key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h4 className="mt-6 text-[1.18rem] font-bold leading-tight">{tool.title}</h4>
                    <p className={dark ? "mt-4 line-clamp-4 text-sm leading-6 text-white/64" : "mt-4 line-clamp-4 text-sm leading-6 text-[#56636b]"}>
                      {tool.description}
                    </p>
                    <span className={dark ? "mt-auto inline-flex items-center gap-2 pt-6 text-sm font-bold text-[#ffa45d]" : "mt-auto inline-flex items-center gap-2 pt-6 text-sm font-bold text-[#1d6f64]"}>
                      Open tool
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={1.8} />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <a className={dark ? "inline-flex items-center gap-2 rounded-[16px] bg-white px-5 py-3 text-sm font-semibold text-[#101114] transition hover:-translate-y-0.5 active:scale-[0.98]" : "inline-flex items-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98]"} href={primaryHref}>
          {primaryCta}
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </a>
        <a className={dark ? "inline-flex items-center gap-2 rounded-[16px] border border-white/14 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1] active:scale-[0.98]" : "inline-flex items-center gap-2 rounded-[16px] border border-[#ded5ca] bg-white px-5 py-3 text-sm font-semibold text-[#14161a] transition hover:-translate-y-0.5 hover:bg-[#fbfaf7] active:scale-[0.98]"} href={secondaryHref}>
          {secondaryCta}
          <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
        </a>
      </div>
    </>
  );
}
