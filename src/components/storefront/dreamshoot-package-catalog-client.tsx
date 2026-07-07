"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ArrowRight } from "lucide-react";

export type DreamshootPackageCatalogCard = {
  id: string;
  title: string;
  description: string;
  category: string;
  meta: string;
  credits: string;
  imageUrl: string;
  href: string;
  filterTokens?: string[];
};

function categorySlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all";
}

function categoryLabel(value: string): string {
  const normalized = value.toLowerCase().replace(/[_-]+/g, " ");
  if (normalized === "headshots") return "Headshots";
  if (normalized === "sports") return "Sports";
  if (normalized === "creator") return "Creator";
  if (normalized === "creative") return "Creative";
  if (normalized === "beauty") return "Beauty";
  if (normalized === "avatar") return "Avatar";
  if (normalized === "seasonal") return "Seasonal";
  if (normalized === "couple") return "Couple";
  if (normalized === "wedding") return "Wedding";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cardLinkLabel(action: string, title: string) {
  const cleanTitle = title.replace(/\s+/g, " ").trim() || "this package";
  return `${action} ${cleanTitle}`;
}

function imageAlt(card: DreamshootPackageCatalogCard) {
  return `${card.title} preview`;
}

function hrefForCategory(siteBasePath: string, tab: string) {
  const slug = categorySlug(tab);
  const path = tab === "All" || slug === "all" ? "/collections" : `/collections/${slug}`;
  return siteBasePath && siteBasePath !== "/" ? `${siteBasePath}${path}` : path;
}

function cardHref(siteBasePath: string, href: string) {
  if (!href || href.startsWith("http") || href.startsWith("#")) return href || "#";
  const path = href.startsWith("/") ? href : `/${href}`;
  return siteBasePath && siteBasePath !== "/" ? `${siteBasePath}${path}` : path;
}

function categoryMatches(card: DreamshootPackageCatalogCard, selectedCategory: string) {
  if (!selectedCategory || selectedCategory === "all") return true;
  const tokens = [card.category, card.href, card.title, card.meta, ...(card.filterTokens ?? [])]
    .filter(Boolean)
    .map((value) => categorySlug(value.replace(/^\/?collections\/?/, "")))
    .flatMap((token) => [token, ...inferredGroupTokens(token)]);
  return tokens.includes(selectedCategory);
}

function inferredGroupTokens(token: string): string[] {
  const groups: string[] = [];
  const add = (group: string) => groups.push(group);
  if (/(world-cup|sports?|fan|stadium|match)/.test(token)) add("sports");
  if (/(headshot|linkedin|resume|work-profile|professional)/.test(token)) add("headshots");
  if (/(beauty|hairstyle|hair|fashion|boudoir|glam|try-on)/.test(token)) add("beauty");
  if (/(cyberpunk|gala|mafia|noir|creative|editorial)/.test(token)) add("creative");
  if (/(creator|profile|social|product-style|personal-brand)/.test(token)) add("creator");
  if (/(avatar|anime)/.test(token)) add("avatar");
  if (/(travel|nature|adventure|route|coastal|city|resort|scenic|postcard|trail)/.test(token)) add("travel");
  if (/(christmas|holiday|seasonal|valentine|graduation)/.test(token)) add("seasonal");
  if (/(wedding|couple|save-the-date)/.test(token)) add("wedding");
  if (/(cultural|indian)/.test(token)) add("cultural");
  return groups;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function updateBrowserUrl(href: string) {
  if (!href || typeof window === "undefined") return;
  const target = new URL(href, window.location.href);
  if (target.origin !== window.location.origin) return;
  window.history.pushState({}, "", `${target.pathname}${target.search}${target.hash}`);
}

function categoryFromLocation() {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  const collectionsIndex = parts.indexOf("collections");
  if (collectionsIndex < 0) return "";
  return parts[collectionsIndex + 1] ?? "all";
}

export function DreamshootPackageCatalogClient({
  activePackageLabel,
  aidreamcapes = false,
  cards,
  creditLabel,
  directoryTitle,
  featuredCount,
  initialCategory = "",
  openCollectionsHref,
  sectionId,
  siteBasePath,
  steps,
  subtitle,
  tabs,
  title
}: {
  activePackageLabel: string;
  aidreamcapes?: boolean;
  cards: DreamshootPackageCatalogCard[];
  creditLabel: string;
  directoryTitle: string;
  featuredCount: number;
  initialCategory?: string;
  openCollectionsHref: string;
  sectionId: string;
  siteBasePath: string;
  steps: string[];
  subtitle: string;
  tabs: string[];
  title: string;
}) {
  const [selectedCategory, setSelectedCategory] = useState(() => categorySlug(initialCategory || "all"));
  const visibleCards = useMemo(
    () => cards.filter((card) => categoryMatches(card, selectedCategory)),
    [cards, selectedCategory]
  );
  const displayCards = visibleCards.length ? visibleCards : cards;
  const featured = displayCards.slice(0, featuredCount);
  const directory = displayCards;
  const activeCount = displayCards.length;
  const brandGradient = aidreamcapes
    ? "linear-gradient(90deg,#D88A4B 0%,#B86E36 100%)"
    : "linear-gradient(90deg,#ff9f43 0%,#ff5ebd 45%,#16dcf0 100%)";
  const accentGradient = aidreamcapes
    ? "linear-gradient(90deg,#16dcf0,#D88A4B)"
    : brandGradient;

  useEffect(() => {
    function handlePopState() {
      setSelectedCategory(categorySlug(categoryFromLocation() || "all"));
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function chooseCategory(tab: string, event: MouseEvent<HTMLAnchorElement>) {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    const nextCategory = categorySlug(tab);
    setSelectedCategory(nextCategory);
    updateBrowserUrl(hrefForCategory(siteBasePath, tab));
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function chooseCard(card: DreamshootPackageCatalogCard, event: MouseEvent<HTMLAnchorElement>) {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    const nextCategory = categorySlug(card.category);
    setSelectedCategory(nextCategory);
    updateBrowserUrl(cardHref(siteBasePath, card.href));
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  return (
    <section className="relative overflow-hidden bg-[#05070E] px-5 py-16 text-white md:py-24" id={sectionId} data-dreamshoot-catalog-count={directory.length}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(122,76,255,0.28),transparent_31%),radial-gradient(circle_at_82%_18%,rgba(22,220,240,0.2),transparent_31%),radial-gradient(circle_at_54%_92%,rgba(255,166,68,0.24),transparent_39%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:94px_94px]" />
      <div className="relative mx-auto max-w-[var(--site-content-width)]">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-[0.08em] text-white/62">
          <span>{activePackageLabel}</span>
        </div>
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)] lg:items-end">
          <div>
            <h2 className="max-w-[46rem] text-[clamp(2.8rem,7vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-balance [font-family:var(--site-title-font)]">
              {title}
            </h2>
            <div className="mt-10 flex flex-wrap gap-3">
              {tabs.map((tab) => {
                const active = selectedCategory === categorySlug(tab);
                return (
                  <a
                    className="rounded-full border border-white/18 px-4 py-2 text-sm font-semibold text-white/78 transition hover:border-white/35 hover:text-white"
                    data-storefront-instant-filter="true"
                    href={hrefForCategory(siteBasePath, tab)}
                    key={tab}
                    onClick={(event) => chooseCategory(tab, event)}
                    style={active ? { background: brandGradient, borderColor: "transparent", color: "white" } : undefined}
                  >
                    {tab}
                  </a>
                );
              })}
            </div>
          </div>
          <div className="lg:pb-4">
            <p className="max-w-[42rem] text-[clamp(1.12rem,1.7vw,1.55rem)] leading-[1.25] text-white/72">{subtitle}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/72">
                {activeCount} active packages
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/72">
                {creditLabel}
              </span>
            </div>
            <div className="mt-8 rounded-[26px] border border-white/14 bg-white/[0.05] p-4 shadow-[0_28px_90px_-70px_rgba(0,0,0,0.95)]">
              <div className="flex flex-wrap items-center gap-4">
                {steps.map((step, index) => (
                  <div className="flex items-center gap-3" key={step}>
                    <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: brandGradient }}>{index + 1}</span>
                    <span className="text-[clamp(1rem,1.45vw,1.35rem)] font-semibold text-white">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className={aidreamcapes ? "mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" : "mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-5"}>
          {featured.map((card, index) => (
            <a
              aria-label={cardLinkLabel("Choose package", card.title)}
              className="group flex min-h-[386px] flex-col overflow-hidden rounded-[26px] border border-white/14 bg-[#11121C]/80 shadow-[0_34px_105px_-72px_rgba(0,0,0,0.98)] transition hover:-translate-y-1 hover:border-white/24"
              data-storefront-instant-filter="true"
              href={cardHref(siteBasePath, card.href)}
              key={card.id}
              onClick={(event) => chooseCard(card, event)}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.04]">
                <img
                  alt={imageAlt(card)}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"
                  decoding="async"
                  fetchPriority={index === 0 ? "auto" : "low"}
                  loading={index === 0 ? "eager" : "lazy"}
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 20vw"
                  src={card.imageUrl}
                />
                <span className="absolute left-4 top-4 rounded-full border border-white/18 bg-black/28 px-3 py-1.5 text-xs font-semibold text-white/88 backdrop-blur">{categoryLabel(card.category)}</span>
                {index === 0 ? <span className="absolute inset-x-0 top-0 h-1" style={{ background: accentGradient }} /> : null}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-[1.42rem] font-semibold leading-tight tracking-[-0.035em] text-white">{card.title}</h3>
                <p className="mt-3 line-clamp-2 min-h-[3rem] text-sm leading-6 text-white/62" title={card.description}>{card.description}</p>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
                  <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/82">{card.meta}</span>
                  <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/82">{card.credits}</span>
                  <ArrowRight className="ml-auto h-5 w-5 text-white/82 transition group-hover:translate-x-1" strokeWidth={1.8} />
                </div>
              </div>
            </a>
          ))}
        </div>
        {directory.length ? (
          <div className="mt-9">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Full directory</p>
                <h3 className="mt-2 text-[clamp(1.65rem,3vw,2.45rem)] font-semibold tracking-[-0.045em] text-white">{directoryTitle}</h3>
              </div>
              <a className="inline-flex items-center gap-2 rounded-full border border-white/14 px-4 py-2 text-sm font-semibold text-white/78 transition hover:border-white/28 hover:text-white" href={openCollectionsHref}>
                Open collections
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {directory.map((card, index) => (
                <a
                  aria-label={cardLinkLabel("Choose package", card.title)}
                  className="group overflow-hidden rounded-[22px] border border-white/10 bg-[#10121a]/74 shadow-[0_24px_74px_-64px_rgba(0,0,0,0.96)] transition hover:-translate-y-0.5 hover:border-white/24 hover:bg-white/[0.075]"
                  data-storefront-instant-filter="true"
                  href={cardHref(siteBasePath, card.href)}
                  key={`rest_${card.id}`}
                  onClick={(event) => chooseCard(card, event)}
                >
                  <div className="relative aspect-[1.42] overflow-hidden bg-white/[0.04]">
                    <img
                      alt={imageAlt(card)}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]"
                      decoding="async"
                      fetchPriority="low"
                      loading="lazy"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
                      src={card.imageUrl}
                    />
                    <span className="absolute left-3 top-3 rounded-full border border-white/18 bg-black/32 px-2.5 py-1 text-[11px] font-semibold text-white/84 backdrop-blur">{categoryLabel(card.category)}</span>
                    {index < 3 ? <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#10121a]">Popular</span> : null}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 text-base font-semibold tracking-[-0.025em] text-white">{card.title}</h3>
                        <p className="mt-2 line-clamp-2 min-h-[2.6rem] text-sm leading-5 text-white/56" title={card.description}>{card.description}</p>
                      </div>
                      <ArrowRight className="mt-1 h-4.5 w-4.5 shrink-0 text-white/46 transition group-hover:translate-x-1 group-hover:text-white/82" strokeWidth={1.8} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/76">{card.meta}</span>
                      <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/76">{card.credits}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
