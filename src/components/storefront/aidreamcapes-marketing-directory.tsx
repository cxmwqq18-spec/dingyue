"use client";

import { ArrowUpRight, ChevronRight, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { AidreamcapesZipNavigation, Site } from "@/lib/types";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import type { AidreamcapesImageDirectoryCard } from "@/components/storefront/aidreamcapes-image-directory";
import type { AidreamcapesVideoThemeCover } from "@/components/storefront/aidreamcapes-video-directory";
import { AidreamcapesProjectedImage as AidreamcapesResponsiveImage } from "./aidreamcapes-projected-image.client";

export type AidreamcapesMarketingDirectoryCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  directoryNote: string;
  openLabel: string;
  featuredLabel: string;
  filterLabels: {
    all: string;
    image: string;
    video: string;
  };
  imageSection: {
    eyebrow: string;
    title: string;
    body: string;
  };
  videoSection: {
    eyebrow: string;
    title: string;
    body: string;
  };
  workflow: {
    eyebrow: string;
    title: string;
    body: string;
    steps: Array<{ title: string; body: string }>;
  };
  finalCta: {
    eyebrow: string;
    title: string;
    body: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
  fallbackImages?: Record<string, string>;
};

type RoutedSite = Site & { __storefrontBasePath?: string };

type MarketingCard = {
  id: string;
  kind: "image" | "video";
  title: string;
  href: string;
  groupLabel: string;
  description: string;
  imageUrl?: string;
  imageAlt: string;
  width: number;
  height: number;
  tags: string[];
};

function resolveHref(site: Site, href: string): string {
  if (/^https?:\/\//i.test(href) || href.startsWith("#")) return href;
  const basePath = (site as RoutedSite).__storefrontBasePath;
  return typeof basePath === "string" ? `${basePath}${href}` : href;
}

function normalizedPath(value: string): string {
  return value.trim().split(/[?#]/)[0] ?? "";
}

function routeSlug(value: string): string {
  return normalizedPath(value).split("/").filter(Boolean).at(-1) ?? "";
}

function marketingCards({
  imageCards,
  navigation,
  themeCovers,
  fallbackImages = {}
}: {
  imageCards: AidreamcapesImageDirectoryCard[];
  navigation: AidreamcapesZipNavigation;
  themeCovers: Record<string, AidreamcapesVideoThemeCover>;
  fallbackImages?: Record<string, string>;
}): MarketingCard[] {
  const imageBySlug = new Map(imageCards.map((card) => [card.slug, card]));
  const seen = new Set<string>();
  const cards: MarketingCard[] = [];

  for (const group of navigation.marketing.groups) {
    for (const item of group.items) {
      const href = normalizedPath(item.href);
      const kind = href.startsWith("/ai-image-generation/") ? "image" : "video";
      const key = `${kind}:${href}`;
      if (!href || seen.has(key)) continue;
      seen.add(key);
      if (kind === "image") {
        const source = imageBySlug.get(routeSlug(href));
        cards.push({
          id: key,
          kind,
          title: item.label,
          href,
          groupLabel: group.label,
          description: source?.description ?? "A focused image workflow for product pages, campaigns, and catalog moments.",
          imageUrl: source?.imageUrl ?? fallbackImages[href],
          imageAlt: source?.imageAlt || `${item.label} marketing image workflow`,
          width: 1600,
          height: 1200,
          tags: source?.tags ?? []
        });
        continue;
      }
      const cover = themeCovers[href];
      cards.push({
        id: key,
        kind,
        title: item.label,
        href,
        groupLabel: group.label,
        description: "A focused video workflow for testing, explaining, or promoting a product.",
        imageUrl: cover?.src ?? fallbackImages[href],
        imageAlt: cover?.alt || `${item.label} marketing video workflow`,
        width: 1600,
        height: 900,
        tags: [group.label]
      });
    }
  }

  return cards;
}

function DirectoryCard({
  card,
  copy,
  site,
  featured = false
}: {
  card: MarketingCard;
  copy: AidreamcapesMarketingDirectoryCopy;
  site: Site;
  featured?: boolean;
}) {
  return (
    <StorefrontInstantLink
      className={`group relative block overflow-hidden rounded-[22px] border border-white/[0.12] bg-white/[0.045] transition duration-300 hover:-translate-y-1 hover:border-white/[0.28] hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd] ${featured ? "min-h-[300px] sm:min-h-[340px] lg:h-[420px] lg:min-h-0 lg:max-w-[460px] lg:justify-self-end" : ""}`}
      href={resolveHref(site, card.href)}
    >
      <span className={`relative block overflow-hidden bg-[#15131b] ${featured ? "absolute inset-0 h-full" : "aspect-[16/10]"}`}>
        {card.imageUrl ? (
          <AidreamcapesResponsiveImage
            alt={card.imageAlt}
            className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-[1.045] group-hover:opacity-100"
            decoding="async"
            fetchPriority={featured ? "high" : "low"}
            height={card.height}
            loading={featured ? "eager" : "lazy"}
            sizes={featured ? "(max-width: 1023px) 100vw, 44vw" : "(max-width: 767px) 100vw, 33vw"}
            src={card.imageUrl}
            width={card.width}
          />
        ) : (
          <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(196,181,253,0.26),transparent_38%),linear-gradient(135deg,#1c1727,#10151d)]" />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-[#07080c]/95 via-[#07080c]/15 to-transparent" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/[0.16] bg-black/[0.28] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.72] backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${card.kind === "image" ? "bg-[#f5b46d]" : "bg-[#a78bfa]"}`} />
          {card.kind === "image" ? "Image workflow" : "Video workflow"}
        </span>
        <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-white/[0.62] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" strokeWidth={1.8} />
      </span>
      <span className={`relative block ${featured ? "absolute inset-x-0 bottom-0 p-6 sm:p-7" : "p-5"}`}>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.42]">{card.groupLabel}</span>
        <span className={`mt-2 block font-semibold leading-tight tracking-[-0.035em] text-white/[0.92] ${featured ? "text-3xl sm:text-4xl" : "text-xl"}`}>{card.title}</span>
        <span className={`mt-3 block leading-6 text-white/[0.58] ${featured ? "max-w-xl text-sm" : "line-clamp-2 text-sm"}`}>{card.description}</span>
        <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-white/[0.48] transition group-hover:text-white">
          {copy.openLabel}
          <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" strokeWidth={1.8} />
        </span>
      </span>
    </StorefrontInstantLink>
  );
}

export function AidreamcapesMarketingDirectory({
  copy,
  imageCards,
  navigation,
  sectionId,
  site,
  themeCovers = {}
}: {
  copy: AidreamcapesMarketingDirectoryCopy;
  imageCards: AidreamcapesImageDirectoryCard[];
  navigation: AidreamcapesZipNavigation;
  sectionId: string;
  site: Site;
  themeCovers?: Record<string, AidreamcapesVideoThemeCover>;
}) {
  const [activeKind, setActiveKind] = useState<"all" | "image" | "video">("all");
  const [query, setQuery] = useState("");
  const cards = useMemo(() => marketingCards({ imageCards, navigation, themeCovers, fallbackImages: copy.fallbackImages }), [copy.fallbackImages, imageCards, navigation, themeCovers]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCards = useMemo(() => cards.filter((card) => {
    const matchesKind = activeKind === "all" || card.kind === activeKind;
    const searchText = [card.title, card.groupLabel, card.description, ...card.tags].join(" ").toLowerCase();
    return matchesKind && (!normalizedQuery || searchText.includes(normalizedQuery));
  }), [activeKind, cards, normalizedQuery]);
  const featured = filteredCards[0];
  const groups = useMemo(() => navigation.marketing.groups.map((group) => ({
    ...group,
    items: filteredCards.filter((card) => card.groupLabel === group.label)
  })).filter((group) => group.items.length > 0), [filteredCards, navigation.marketing.groups]);
  const imageCount = cards.filter((card) => card.kind === "image").length;
  const videoCount = cards.filter((card) => card.kind === "video").length;

  return (
    <section className="relative isolate overflow-hidden bg-[#06070b] px-5 pb-24 pt-12 text-white sm:px-8 sm:pb-32 sm:pt-16 lg:pt-20" data-aidreamcapes-marketing-directory="true" id={sectionId}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-14rem] h-[38rem] w-[38rem] rounded-full bg-[#8b5cf6]/[0.13] blur-[140px]" />
        <div className="absolute right-[-12rem] top-[14rem] h-[34rem] w-[34rem] rounded-full bg-[#f05a8b]/[0.1] blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_92%)]" />
      </div>

      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-10 border-b border-white/[0.11] pb-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.55fr)] lg:items-center lg:gap-12 lg:pb-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.045] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/[0.62]">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f5b46d] shadow-[0_0_16px_rgba(139,92,246,0.95)]" />
              {copy.eyebrow}
            </div>
            <h1 className="mt-7 max-w-4xl text-balance text-[clamp(3.2rem,7.4vw,7.4rem)] font-semibold leading-[0.88] tracking-[-0.075em] text-white [font-family:var(--site-title-font)]">{copy.title}</h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/[0.62] sm:text-lg">{copy.subtitle}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/[0.42]">
              <span><strong className="text-white">{cards.length}</strong> {copy.directoryNote}</span>
              <span><strong className="text-white">{imageCount}</strong> image routes</span>
              <span><strong className="text-white">{videoCount}</strong> video routes</span>
            </div>
          </div>

          {featured ? (
            <DirectoryCard card={featured} copy={copy} featured site={site} />
          ) : (
            <div className="grid min-h-[260px] place-items-center rounded-[28px] border border-dashed border-white/[0.16] bg-white/[0.035] p-8 text-center text-sm text-white/[0.52]">No workflows match this search.</div>
          )}
        </div>

        <div className="sticky top-0 z-20 -mx-5 border-b border-white/[0.1] bg-[#06070b]/90 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8" data-aidreamcapes-marketing-controls>
          <div className="mx-auto flex max-w-[1440px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              <SlidersHorizontal className="mr-1 h-4 w-4 shrink-0 text-white/[0.45]" strokeWidth={1.7} />
              {(["all", "image", "video"] as const).map((kind) => {
                const label = kind === "all" ? copy.filterLabels.all : kind === "image" ? copy.filterLabels.image : copy.filterLabels.video;
                return <button className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${activeKind === kind ? "border-white bg-white text-[#08090d]" : "border-white/[0.14] bg-white/[0.04] text-white/[0.62] hover:border-white/[0.3] hover:text-white"}`} key={kind} onClick={() => setActiveKind(kind)} type="button">{label}</button>;
              })}
            </div>
            <label className="flex min-w-0 items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.05] px-4 py-2.5 text-sm text-white/[0.75] focus-within:border-white/[0.4] lg:w-[290px]">
              <Search className="h-4 w-4 shrink-0 text-white/[0.45]" strokeWidth={1.8} />
              <span className="sr-only">Search marketing workflows</span>
              <input className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/[0.38]" onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows" value={query} />
            </label>
          </div>
        </div>

        <div className="mt-14 grid gap-3 md:grid-cols-2" data-marketing-directory-overview>
          {[copy.imageSection, copy.videoSection].map((section, index) => (
            <article className="rounded-[24px] border border-white/[0.1] bg-white/[0.035] p-6 sm:p-7" key={section.title}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${index === 0 ? "text-[#f5c58f]" : "text-[#c4b5fd]"}`}>{section.eyebrow}</p>
              <h2 className="mt-4 max-w-lg text-2xl font-semibold leading-tight tracking-[-0.04em] text-white">{section.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/[0.56]">{section.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-16 lg:gap-20">
          {groups.map((group, groupIndex) => (
            <section className="scroll-mt-24" data-marketing-directory-group={group.label} id={`marketing-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} key={group.label}>
              <div className="grid gap-5 border-b border-white/[0.1] pb-6 lg:grid-cols-[minmax(260px,0.45fr)_minmax(0,0.55fr)] lg:items-end">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#c4b5fd]">{String(groupIndex + 1).padStart(2, "0")}</span>
                    <span className="rounded-full border border-white/[0.14] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/[0.52]">{group.items.length} routes</span>
                  </div>
                  <h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">{group.label}</h2>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-white/[0.56] lg:justify-self-end">{group.label.toLowerCase().includes("listing") ? copy.imageSection.body : copy.videoSection.body}</p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((card) => <DirectoryCard card={card} copy={copy} key={card.id} site={site} />)}
              </div>
            </section>
          ))}
        </div>

        {filteredCards.length > 0 ? (
          <section className="mt-24 grid gap-8 rounded-[30px] border border-white/[0.12] bg-white/[0.045] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-10" data-marketing-directory-workflow>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c4b5fd]">{copy.workflow.eyebrow}</p>
              <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-4xl">{copy.workflow.title}</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/[0.58]">{copy.workflow.body}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {copy.workflow.steps.map((step, index) => (
                <article className="rounded-[22px] border border-white/[0.1] bg-black/[0.2] p-5" key={`${step.title}-${index}`}>
                  <div className="flex items-center justify-between gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] text-xs font-semibold text-[#ddd6fe]">{String(index + 1).padStart(2, "0")}</span><Sparkles className="h-4 w-4 text-[#a7f3d0]" strokeWidth={1.8} /></div>
                  <h3 className="mt-6 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/[0.55]">{step.body}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="relative mt-10 overflow-hidden rounded-[30px] border border-white/[0.1] bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#fce7f3] p-7 text-[#0f172a] sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10" data-marketing-directory-cta>
          <div className="absolute right-[-3rem] top-[-4rem] h-44 w-44 rounded-full bg-[#8b5cf6]/[0.16] blur-[55px]" />
          <div className="relative"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6d28d9]">{copy.finalCta.eyebrow}</p><h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">{copy.finalCta.title}</h2><p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{copy.finalCta.body}</p></div>
          <div className="relative mt-7 flex shrink-0 flex-wrap gap-3 lg:mt-0">
            <StorefrontInstantLink className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0f172a] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#1e293b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8b5cf6]" href={resolveHref(site, copy.finalCta.primaryHref)}>{copy.finalCta.primaryLabel}<ArrowUpRight className="h-4 w-4" strokeWidth={1.8} /></StorefrontInstantLink>
            <StorefrontInstantLink className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white/[0.6] px-6 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8b5cf6]" href={resolveHref(site, copy.finalCta.secondaryHref)}>{copy.finalCta.secondaryLabel}<Sparkles className="h-4 w-4" strokeWidth={1.8} /></StorefrontInstantLink>
          </div>
        </section>
      </div>
    </section>
  );
}
