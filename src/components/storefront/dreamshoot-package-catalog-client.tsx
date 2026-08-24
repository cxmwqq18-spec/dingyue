"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { DreamshootShowcasePreview } from "@/components/storefront/dreamshoot-showcase-preview";
import { photoPackageLabel, photoPackageSlug } from "@/lib/photo-package-taxonomy";
import { storefrontCardImageAlt } from "@/lib/storefront-media-alt";

export type DreamshootPackageCatalogCard = {
  id: string;
  title: string;
  description: string;
  category: string;
  meta: string;
  credits?: string;
  imageAlt?: string;
  imageAlts?: string[];
  imageUrl: string;
  imageUrls?: string[];
  href: string;
  filterTokens?: string[];
  kind?: "package" | "collection";
  metaLabel?: string;
  photoCountLabel?: string;
  tags?: string[];
  trainingLabel?: string;
  usesLabel?: string;
};

export type DreamshootCategoryHrefOverrides = Record<string, string>;

function categorySlug(value: string): string {
  return photoPackageSlug(value);
}

function categoryLabel(value: string): string {
  return photoPackageLabel(value);
}

function categoryLabelForLocale(value: string, locale: "en" | "es"): string {
  const label = categoryLabel(value);
  if (locale !== "es") return label;
  const normalized = label.toLowerCase();
  const labels: Record<string, string> = {
    "all": "Todos",
    "headshots": "Retratos profesionales",
    "sports": "Deportes",
    "creator": "Creador",
    "creative": "Creativo",
    "beauty": "Belleza",
    "avatar": "Avatar",
    "seasonal": "Temporada",
    "couple": "Pareja",
    "wedding": "Boda",
    "travel": "Viaje",
    "cultural": "Cultural"
  };
  return labels[normalized] ?? label;
}

function cardLinkLabel(action: string, title: string) {
  const cleanTitle = title.replace(/\s+/g, " ").trim() || "this package";
  return `${action} ${cleanTitle}`;
}

function cardActionLabel(card: DreamshootPackageCatalogCard, packageAction: string, locale: "en" | "es") {
  if (card.kind === "collection") return locale === "es" ? "Abrir coleccion" : "Open collection";
  return packageAction;
}

function imageAlt(card: DreamshootPackageCatalogCard, imageUrl: string, imageIndex: number, locale: "en" | "es", brand: string) {
  return storefrontCardImageAlt({
    brand,
    category: card.category,
    description: card.description,
    explicitAlt: imageIndex === 0 ? card.imageAlt : undefined,
    imageAlts: card.imageAlts,
    imageUrl,
    index: imageIndex,
    locale,
    meta: card.metaLabel || card.meta,
    role: imageIndex === 0 ? "card" : "gallery",
    title: card.title
  });
}

function comparableImageUrl(value: string): string {
  return value.trim().split("?")[0] ?? value.trim();
}

function cardImageUrls(card: DreamshootPackageCatalogCard): string[] {
  const seen = new Set<string>();
  const urls = [...(card.imageUrls ?? []), card.imageUrl]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = comparableImageUrl(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (urls.length >= 2) return urls;

  // A stale published card can leave only one numbered gallery URL. Recover
  // adjacent published gallery variants so the split cover never renders the
  // same image twice.
  const source = urls[0] || card.imageUrl.trim();
  const match = source.match(/^(.*\/[^/?#]+-)(\d{2})(\.webp(?:[?#].*)?)$/i);
  if (!match) return urls;
  for (let index = 1; index <= 12 && urls.length < 2; index += 1) {
    const candidate = `${match[1]}${String(index).padStart(2, "0")}${match[3]}`;
    const key = comparableImageUrl(candidate);
    if (key && !seen.has(key)) {
      seen.add(key);
      urls.push(candidate);
    }
  }
  return urls;
}

function meaningfulUsesLabel(value: string | undefined): string | undefined {
  const label = value?.trim();
  if (!label || /^0\s+uses?$/i.test(label)) return undefined;
  return label;
}

function SafeCatalogImage({
  alt,
  className = "",
  decoding = "async",
  fetchPriority,
  loading,
  sizes,
  src
}: {
  alt: string;
  className?: string;
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
  loading?: "eager" | "lazy";
  sizes?: string;
  src: string;
}) {
  const safeAlt = alt.trim() || "AI-generated private package visual showing a styled subject and intended gallery use";
  return (
    <img
      alt={safeAlt}
      aria-label={`View ${safeAlt} full screen`}
      className={`block w-full cursor-zoom-in object-center ${className}`}
      data-dreamshoot-preview-meta=""
      data-dreamshoot-preview-src={src}
      data-dreamshoot-preview-title={safeAlt}
      data-dreamshoot-showcase-preview="image"
      decoding={decoding}
      fetchPriority={fetchPriority}
      loading={loading}
      sizes={sizes}
      src={src}
    />
  );
}

const referenceCardClass =
  "group relative block overflow-hidden rounded-[14px] border border-white/[0.11] bg-[#111827]/[0.82] text-white shadow-[0_22px_62px_-48px_rgba(0,0,0,0.92)] transition duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,rgba(255,166,68,0.74),rgba(236,75,221,0.52),rgba(22,220,240,0.68))] before:opacity-70 before:content-[''] hover:-translate-y-1 hover:border-cyan-200/24 hover:shadow-[0_24px_74px_-50px_rgba(22,220,240,0.42)]";
const referenceImageShellClass = "bg-[#0B1020]/[0.70]";
const referenceImageFrameClass = "relative aspect-[4/3] overflow-hidden rounded-[9px] bg-[#070B14]";
const referenceContentClass = "flex min-h-[184px] flex-col bg-[#111827]/[0.46] p-4";
const referenceTitleClass = "line-clamp-1 text-base font-semibold leading-5 text-white [font-family:var(--site-title-font)]";
const referenceDescriptionClass = "mt-3 line-clamp-2 min-h-[2.45rem] text-xs leading-[1.625] text-slate-300/70";
const referenceArrowClass = "mt-1 h-5 w-5 shrink-0 text-slate-300/70 transition group-hover:translate-x-1 group-hover:text-cyan-100";
const referenceTagClass =
  "rounded-[8px] border border-white/[0.13] bg-[#101827]/[0.76] px-2.5 py-1 text-[11px] font-semibold leading-5 text-white/[0.78] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
const compactTagClass =
  "rounded-[8px] border border-white/[0.13] bg-[#101827]/[0.76] px-2.5 py-1 text-[11px] font-semibold leading-5 text-white/[0.78] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
const referenceFooterClass = "mt-auto flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3";
const referencePhotoCountClass =
  "rounded-[8px] border border-cyan-200/18 bg-[#0D2B2C]/70 px-2.5 py-1 text-xs font-semibold leading-5 text-[#58E6D9] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]";
const referenceUsesClass = "truncate text-xs leading-5 text-slate-500";

function ReferencePackageCard({
  brandName,
  card,
  categoryHrefOverrides,
  index,
  locale,
  packageAction,
  prioritizeFirstImage = true,
  siteBasePath
}: {
  brandName: string;
  card: DreamshootPackageCatalogCard;
  categoryHrefOverrides?: DreamshootCategoryHrefOverrides;
  index: number;
  locale: "en" | "es";
  packageAction: string;
  prioritizeFirstImage?: boolean;
  siteBasePath: string;
}) {
  const cardImages = cardImageUrls(card);
  // Homepage recommendation cards always reserve two equal cover slots. A pack
  // with a single published asset reuses it so the grid does not collapse.
  const images = cardImages.length === 1 ? [cardImages[0], cardImages[0]] : cardImages.slice(0, 2);
  const tags = (card.tags?.length ? card.tags : [card.metaLabel || card.meta, card.category]).filter(Boolean).slice(0, 3);
  const photoCountLabel = card.photoCountLabel || card.credits || (locale === "es" ? "20 fotos" : "20 Photos");
  const usesLabel = meaningfulUsesLabel(card.usesLabel) || card.trainingLabel || card.metaLabel || card.meta;
  return (
    <a
      aria-label={cardLinkLabel(cardActionLabel(card, packageAction, locale), card.title)}
      className={referenceCardClass}
      href={resolvedCardHref(siteBasePath, card, categoryHrefOverrides)}
    >
      <div className={referenceImageShellClass}>
        <div className="grid grid-cols-2 items-stretch gap-0.5 p-3" data-dreamshoot-catalog-cover="split">
          {images.map((image, imageIndex) => (
            <div className={referenceImageFrameClass} key={`${card.id}_split_${imageIndex}`}>
	              <SafeCatalogImage
                alt={imageAlt(card, image, imageIndex, locale, brandName)}
                className="h-full object-cover transition duration-500"
                decoding="async"
                fetchPriority={prioritizeFirstImage && index === 0 && imageIndex === 0 ? "high" : "low"}
                loading={prioritizeFirstImage && index === 0 && imageIndex === 0 ? "eager" : "lazy"}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 12vw"
                src={image}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={referenceContentClass}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className={referenceTitleClass}>{card.title}</h2>
            <p className={referenceDescriptionClass} title={card.description}>{card.description}</p>
          </div>
          <ArrowRight className={referenceArrowClass} strokeWidth={1.8} />
        </div>
        {tags.length ? (
          <div className="mt-4 flex min-h-[4.1rem] flex-wrap content-start items-start gap-2">
            {tags.map((tag) => (
              <span className={referenceTagClass} key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className={referenceFooterClass}>
          <span className={referencePhotoCountClass}>{photoCountLabel}</span>
          <span className={referenceUsesClass}>{usesLabel}</span>
        </div>
      </div>
    </a>
  );
}

function hrefForCategory(siteBasePath: string, tab: string, overrides?: DreamshootCategoryHrefOverrides) {
  const slug = categorySlug(tab);
  const override = overrides?.[slug] ?? overrides?.[tab.trim().toLowerCase()];
  const path = override ?? (tab === "All" || tab === "Todos" || slug === "all" || slug === "todo" || slug === "todos" ? "/collections" : `/collections/${slug}`);
  return cardHref(siteBasePath, path);
}

function cardHref(siteBasePath: string, href: string) {
  if (!href || href.startsWith("http") || href.startsWith("#")) return href || "#";
  const path = href.startsWith("/") ? href : `/${href}`;
  return siteBasePath && siteBasePath !== "/" ? `${siteBasePath}${path}` : path;
}

function isLoginHref(href: string): boolean {
  const pathname = href.trim().replace(/^https?:\/\/[^/]+/i, "");
  return /(?:^|\/)login(?:[/?#]|$)/i.test(pathname);
}

function resolvedCardHref(siteBasePath: string, card: DreamshootPackageCatalogCard, overrides?: DreamshootCategoryHrefOverrides) {
  const href = card.href?.trim() ?? "";
  if (href && !isLoginHref(href)) return cardHref(siteBasePath, href);
  const candidates = [card.id, card.title, card.category, card.meta, ...(card.filterTokens ?? []), href]
    .filter(Boolean)
    .map((value) => categorySlug(String(value).replace(/^\/?collections\/?/, "")));
  const override = candidates.map((candidate) => overrides?.[candidate]).find(Boolean);
  return cardHref(siteBasePath, override ?? `/collections/${categorySlug(card.title || card.category || "packages")}`);
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
  if (/(world-cup|sports?|fan|stadium|match)/.test(token)) {
    add("sports");
    add("fan-photos");
    add("sports-stars");
  }
  if (/(headshot|linkedin|resume|work-profile|professional)/.test(token)) add("headshots");
  if (/(beauty|hairstyle|hair|fashion|boudoir|glam|try-on)/.test(token)) add("beauty");
  if (/(cyberpunk|gala|mafia|noir|creative|editorial)/.test(token)) add("creative");
  if (/(gala|red-carpet|vip)/.test(token)) add("vip-looks");
  if (/(creator|profile|social|product-style|personal-brand)/.test(token)) add("creator");
  if (/(avatar|anime)/.test(token)) add("avatar");
  if (/(travel|nature|adventure|route|coastal|city|resort|scenic|postcard|trail)/.test(token)) add("travel");
  if (/(christmas|holiday|seasonal|valentine|graduation|thanksgiving|halloween)/.test(token)) add("seasonal");
  if (/christmas/.test(token)) add("christmas");
  if (/thanksgiving/.test(token)) add("thanksgiving");
  if (/halloween/.test(token)) add("halloween");
  if (/(wedding|couple|save-the-date)/.test(token)) add("wedding");
  if (/(cultural|indian)/.test(token)) add("cultural");
  return groups;
}

export function DreamshootPackageCatalogClient({
  activePackageLabel,
  aidreamcapes = false,
  cards,
  categoryHrefOverrides,
  creditLabel,
  directoryLabel,
  directorySubtitle,
  directoryTitle,
  featuredCount,
  initialCategory = "",
  openCollectionsHref,
  prioritizeFirstImage = true,
  showDirectory = true,
  locale = "en",
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
  categoryHrefOverrides?: DreamshootCategoryHrefOverrides;
  creditLabel: string;
  directoryLabel?: string;
  directorySubtitle?: string;
  directoryTitle: string;
  featuredCount: number;
  initialCategory?: string;
  openCollectionsHref: string;
  prioritizeFirstImage?: boolean;
  showDirectory?: boolean;
  locale?: "en" | "es";
  sectionId: string;
  siteBasePath: string;
  steps: string[];
  subtitle: string;
  tabs: string[];
  title: string;
}) {
  const selectedCategory = categorySlug(initialCategory || "all");
  const visibleCards = useMemo(
    () => cards.filter((card) => categoryMatches(card, selectedCategory)),
    [cards, selectedCategory]
  );
  const displayCards = visibleCards.length ? visibleCards : cards;
  const useReferenceCards = locale === "en";
  const featuredLimit = Math.max(1, Math.min(featuredCount, displayCards.length || featuredCount));
  const featured = displayCards.slice(0, featuredLimit);
  const directory = showDirectory ? displayCards.slice(featured.length) : [];
  const activeCount = displayCards.length;
  const activeCountLabel = displayCards.some((card) => card.kind === "collection")
    ? locale === "es" ? "temas" : "themes"
    : locale === "es" ? "paquetes activos" : "active packages";
  const brandGradient = aidreamcapes
    ? "linear-gradient(90deg,#D88A4B 0%,#B86E36 100%)"
    : "linear-gradient(90deg,#ff9f43 0%,#ff5ebd 45%,#16dcf0 100%)";
  const accentGradient = aidreamcapes
    ? "linear-gradient(90deg,#16dcf0,#D88A4B)"
    : brandGradient;
  const choosePackageLabel = locale === "es" ? "Elegir paquete" : "Choose package";
  const brandName = aidreamcapes ? "AIdreamcapes" : locale === "es" ? "AIdreamshoots" : "myDreamshoots";
  const resolvedDirectoryLabel = directoryLabel?.trim() || (locale === "es" ? "Directorio completo" : "Full theme directory");
  const resolvedDirectorySubtitle = directorySubtitle?.trim() || (locale === "es" ? "Explora todas las categorias y temas disponibles." : "Browse every available theme by category on the full collections page.");

  return (
    <DreamshootShowcasePreview>
      <section className="relative overflow-hidden bg-[#05070E] px-5 py-16 text-white md:py-24" id={sectionId} data-dreamshoot-catalog-count={displayCards.length}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(122,76,255,0.28),transparent_31%),radial-gradient(circle_at_82%_18%,rgba(22,220,240,0.2),transparent_31%),radial-gradient(circle_at_54%_92%,rgba(255,166,68,0.24),transparent_39%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:94px_94px]" />
      <div className="relative mx-auto max-w-[var(--site-content-width)]">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-[0.08em] text-white/62">
          <span>{activePackageLabel}</span>
        </div>
        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="flex h-full flex-col">
            <h2 className="max-w-[46rem] text-[clamp(2.8rem,7vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-balance [font-family:var(--site-title-font)]">
              {title}
            </h2>
            <div className="mt-10 flex flex-wrap gap-3 lg:mt-auto lg:pt-10">
              {tabs.map((tab) => {
                const active = selectedCategory === categorySlug(tab);
                return (
                  <a
                    className="rounded-full border border-white/18 px-4 py-2 text-sm font-semibold text-white/78 transition hover:border-white/35 hover:text-white"
                    href={hrefForCategory(siteBasePath, tab, categoryHrefOverrides)}
                    key={tab}
                    style={active ? { background: brandGradient, borderColor: "transparent", color: "white" } : undefined}
                  >
                    {categoryLabelForLocale(tab, locale)}
                  </a>
                );
              })}
            </div>
          </div>
          <div className="flex h-full flex-col justify-end">
            <p className="max-w-[42rem] text-[clamp(1.12rem,1.7vw,1.55rem)] leading-[1.25] text-white/72">{subtitle}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/72">
                {activeCount} {activeCountLabel}
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/72">
                {creditLabel}
              </span>
            </div>
            <div className="mt-8 rounded-[26px] border border-white/14 bg-white/[0.05] p-4 shadow-[0_28px_90px_-70px_rgba(0,0,0,0.95)]">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {steps.map((step, index) => (
                  <div className="grid min-h-[72px] grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.045] px-3 py-3" key={step}>
                    <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: brandGradient }}>{index + 1}</span>
                    <span className="min-w-0 text-[clamp(0.95rem,1.05vw,1.12rem)] font-semibold leading-tight text-white">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className={useReferenceCards ? "mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" : aidreamcapes ? "mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" : "mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
          {featured.map((card, index) => (
            useReferenceCards ? (
	              <ReferencePackageCard
	                brandName={brandName}
	                card={card}
                categoryHrefOverrides={categoryHrefOverrides}
                index={index}
                key={card.id}
                locale={locale}
                packageAction={choosePackageLabel}
                prioritizeFirstImage={prioritizeFirstImage}
                siteBasePath={siteBasePath}
              />
            ) : (
            <a
              aria-label={cardLinkLabel(cardActionLabel(card, choosePackageLabel, locale), card.title)}
              className="group flex min-h-[386px] flex-col overflow-hidden rounded-[26px] border border-white/14 bg-[#11121C]/80 shadow-[0_34px_105px_-72px_rgba(0,0,0,0.98)] transition hover:-translate-y-1 hover:border-white/24"
              href={resolvedCardHref(siteBasePath, card, categoryHrefOverrides)}
              key={card.id}
            >
              <div className="relative overflow-hidden bg-white/[0.04]">
	                <SafeCatalogImage
		                  alt={imageAlt(card, card.imageUrl, 0, locale, brandName)}
                  className="transition duration-700"
                  decoding="async"
                  fetchPriority={prioritizeFirstImage && index === 0 ? "auto" : "low"}
                  loading={prioritizeFirstImage && index === 0 ? "eager" : "lazy"}
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 20vw"
                  src={card.imageUrl}
                />
                {index === 0 ? <span className="absolute inset-x-0 top-0 h-1" style={{ background: accentGradient }} /> : null}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={compactTagClass}>{categoryLabelForLocale(card.category, locale)}</span>
                  <span className={compactTagClass}>{card.meta}</span>
                </div>
                <h2 className="text-[1.42rem] font-semibold leading-tight tracking-[-0.035em] text-white">{card.title}</h2>
                <p className="mt-3 line-clamp-2 min-h-[3rem] text-sm leading-6 text-white/62" title={card.description}>{card.description}</p>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
                  {card.credits ? <span className={compactTagClass}>{card.credits}</span> : null}
                  <ArrowRight className="ml-auto h-5 w-5 text-white/82 transition group-hover:translate-x-1" strokeWidth={1.8} />
                </div>
              </div>
            </a>
            )
          ))}
        </div>
        {showDirectory && directory.length ? (
          <div className="mt-9">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">{resolvedDirectoryLabel}</p>
                <h2 className="mt-2 text-[clamp(1.65rem,3vw,2.45rem)] font-semibold tracking-[-0.045em] text-white">{directoryTitle}</h2>
                {resolvedDirectorySubtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-white/56">{resolvedDirectorySubtitle}</p> : null}
              </div>
              <a className="inline-flex items-center gap-2 rounded-full border border-white/14 px-4 py-2 text-sm font-semibold text-white/78 transition hover:border-white/28 hover:text-white" href={openCollectionsHref}>
                {locale === "es" ? "Abrir colecciones" : "Open collections"}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </a>
            </div>
            <div className={useReferenceCards ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
              {directory.map((card, index) => (
                useReferenceCards ? (
	                  <ReferencePackageCard
	                    brandName={brandName}
	                    card={card}
                    categoryHrefOverrides={categoryHrefOverrides}
                    index={index}
                    key={`rest_${card.id}`}
                    locale={locale}
                    packageAction={choosePackageLabel}
                    prioritizeFirstImage={false}
                    siteBasePath={siteBasePath}
                  />
                ) : (
                <a
                  aria-label={cardLinkLabel(cardActionLabel(card, choosePackageLabel, locale), card.title)}
                  className="group overflow-hidden rounded-[22px] border border-white/10 bg-[#10121a]/74 shadow-[0_24px_74px_-64px_rgba(0,0,0,0.96)] transition hover:-translate-y-0.5 hover:border-white/24 hover:bg-white/[0.075]"
                  href={resolvedCardHref(siteBasePath, card, categoryHrefOverrides)}
                  key={`rest_${card.id}`}
                >
                  <div className="relative overflow-hidden bg-white/[0.04]">
	                    <SafeCatalogImage
	                      alt={imageAlt(card, card.imageUrl, 0, locale, brandName)}
                      className="transition duration-500"
                      decoding="async"
                      fetchPriority="low"
                      loading="lazy"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
                      src={card.imageUrl}
                    />
                  </div>
                  <div className="p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className={compactTagClass}>{categoryLabelForLocale(card.category, locale)}</span>
                      {index < 3 ? <span className={compactTagClass}>{locale === "es" ? "Popular" : "Popular"}</span> : null}
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0">
                        <h2 className="line-clamp-1 text-base font-semibold tracking-[-0.025em] text-white">{card.title}</h2>
                        <p className="mt-2 line-clamp-2 min-h-[2.6rem] text-sm leading-5 text-white/56" title={card.description}>{card.description}</p>
                      </div>
                      <ArrowRight className="mt-1 h-4.5 w-4.5 shrink-0 text-white/46 transition group-hover:translate-x-1 group-hover:text-white/82" strokeWidth={1.8} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={compactTagClass}>{card.meta}</span>
                      {card.credits ? <span className={compactTagClass}>{card.credits}</span> : null}
                    </div>
                  </div>
                </a>
                )
              ))}
            </div>
          </div>
        ) : !showDirectory ? (
          <div className="mt-9 flex flex-col gap-4 rounded-[22px] border border-white/12 bg-white/[0.045] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                {resolvedDirectoryLabel}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/62">
                {resolvedDirectorySubtitle}
              </p>
            </div>
            <a className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[16px] border border-white/14 px-4 py-3 text-sm font-semibold text-white/82 transition hover:border-white/28 hover:text-white" href={openCollectionsHref}>
              {locale === "es" ? "Ver todos los temas" : "View all themes"}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </a>
          </div>
        ) : null}
      </div>
      </section>
    </DreamshootShowcasePreview>
  );
}
