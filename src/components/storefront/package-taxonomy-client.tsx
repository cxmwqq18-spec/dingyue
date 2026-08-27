import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { DreamshootShowcasePreviewClient as DreamshootShowcasePreview } from "@/components/storefront/dreamshoot-showcase-preview-client";
import { storefrontCardImageAlt } from "@/lib/storefront-media-alt";

export type PackageTaxonomyCard = {
  brand?: string;
  id: string;
  groupKey?: string;
  groupLabel?: string;
  title: string;
  description: string;
  meta: string;
  keywords: string[];
  imageUrl: string;
  imageAlt?: string;
  imageAlts?: string[];
  imageUrls?: string[];
  href: string;
  appHref: string;
  chips: string[];
  detailBestFor?: string[];
  detailCreates?: string;
  detailReviewPoints?: string[];
  detailStats?: string[];
  detailWorkflow?: string[];
  layout?: "split" | "mosaic";
  photoCountLabel?: string;
  tags?: string[];
  usesLabel?: string;
};

function cardLinkLabel(action: string, title: string) {
  return `${action}: ${title || "this package"}`;
}

function taxonomyImageAlt(
  card: PackageTaxonomyCard,
  imageUrl: string,
  imageIndex: number,
  locale: "en" | "es",
  role: "cover" | "gallery" | "card" = "card"
) {
  return storefrontCardImageAlt({
    brand: card.brand,
    category: card.meta,
    description: card.description,
    explicitAlt: imageIndex === 0 ? card.imageAlt : undefined,
    imageAlts: card.imageAlts,
    imageUrl,
    index: imageIndex,
    locale,
    meta: card.chips[0],
    role,
    title: card.title
  });
}

function slugFromHref(href: string) {
  const clean = href.split("?")[0]?.split("#")[0] ?? "";
  return clean.split("/").filter(Boolean).pop() ?? "";
}

function comparableImageUrl(value: string): string {
  return value.trim().split("?")[0] ?? value.trim();
}

function cardImageUrls(card: PackageTaxonomyCard): string[] {
  const seen = new Set<string>();
  return [...(card.imageUrls ?? []), card.imageUrl]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = comparableImageUrl(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function detailPreviewImages(card: PackageTaxonomyCard): string[] {
  return cardImageUrls(card).slice(0, 1);
}

function SafeTaxonomyImage({
  alt,
  className = "",
  decoding = "async",
  fetchPriority,
  loading,
  src
}: {
  alt: string;
  className?: string;
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
  loading?: "eager" | "lazy";
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
      src={src}
    />
  );
}

const splitCardClass =
  "group relative block overflow-hidden rounded-[14px] border border-white/[0.11] bg-[#111827]/[0.82] text-white shadow-[0_22px_62px_-48px_rgba(0,0,0,0.92)] transition duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,rgba(255,166,68,0.74),rgba(236,75,221,0.52),rgba(22,220,240,0.68))] before:opacity-70 before:content-[''] hover:-translate-y-1 hover:border-cyan-200/24 hover:shadow-[0_24px_74px_-50px_rgba(22,220,240,0.42)]";
const splitImageShellClass = "bg-[#0B1020]/[0.70]";
const splitImageFrameClass = "relative aspect-[4/3] overflow-hidden rounded-[9px] bg-[#070B14]";
const splitSingleImageFrameClass = "relative aspect-[8/3] overflow-hidden rounded-[9px] bg-[#070B14]";
const splitContentClass = "flex min-h-[184px] flex-col bg-[#111827]/[0.46] p-4";
const splitTitleClass = "line-clamp-1 text-base font-semibold leading-5 text-white [font-family:var(--site-title-font)]";
const splitDescriptionClass = "mt-3 line-clamp-2 min-h-[2.45rem] text-xs leading-[1.625] text-slate-300/70";
const splitArrowClass = "mt-1 h-5 w-5 shrink-0 text-slate-300/70 transition group-hover:translate-x-1 group-hover:text-cyan-100";
const splitTagClass =
  "rounded-[8px] border border-white/[0.13] bg-[#101827]/[0.76] px-2.5 py-1 text-[11px] font-semibold leading-5 text-white/[0.78] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
const splitFooterClass = "mt-auto flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3";
const splitPhotoCountClass =
  "rounded-[8px] border border-cyan-200/18 bg-[#0D2B2C]/70 px-2.5 py-1 text-xs font-semibold leading-5 text-[#58E6D9] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]";
const splitUsesClass = "truncate text-xs leading-5 text-slate-500";

function SplitPackageTaxonomyCard({
  card,
  index,
  locale
}: {
  card: PackageTaxonomyCard;
  index: number;
  locale: "en" | "es";
}) {
  const images = cardImageUrls(card);
  const tags = (card.tags?.length ? card.tags : card.keywords).filter(Boolean).slice(0, 3);
  return (
    <a
      aria-label={cardLinkLabel("View collection", card.title)}
      className={splitCardClass}
      href={card.href}
    >
      <div className={splitImageShellClass}>
        <div className={images.length > 1 ? "grid grid-cols-2 items-stretch gap-0.5 p-3" : "grid items-stretch p-3"}>
          {images.slice(0, 2).map((image, imageIndex) => (
            <div className={images.length > 1 ? splitImageFrameClass : splitSingleImageFrameClass} key={`${card.id}_taxonomy_${imageIndex}`}>
	              <SafeTaxonomyImage
	                alt={taxonomyImageAlt(card, image, imageIndex, locale, imageIndex === 0 ? "card" : "gallery")}
                className="h-full object-cover transition duration-500"
                decoding="async"
                fetchPriority={index === 0 && imageIndex === 0 ? "high" : "low"}
                loading={index === 0 && imageIndex === 0 ? "eager" : "lazy"}
                src={image}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={splitContentClass}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className={splitTitleClass}>{card.title}</h2>
            <p className={splitDescriptionClass} title={card.description}>{card.description}</p>
          </div>
          <ArrowRight className={splitArrowClass} strokeWidth={1.8} />
        </div>
        {tags.length ? (
          <div className="mt-4 flex min-h-[4.1rem] flex-wrap content-start items-start gap-2">
            {tags.map((tag) => (
              <span className={splitTagClass} key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className={splitFooterClass}>
          <span className={splitPhotoCountClass}>{card.photoCountLabel || card.chips[0] || "20 Photos"}</span>
          <span className={splitUsesClass}>{card.usesLabel || card.meta}</span>
        </div>
      </div>
    </a>
  );
}

export function PackageTaxonomyClient({
  cards,
  grouped = false,
  initialSlug = "",
  locale = "en",
  variant = "dark"
}: {
  cards: PackageTaxonomyCard[];
  grouped?: boolean;
  initialSlug?: string;
  locale?: "en" | "es";
  variant?: "dark" | "cream";
}) {
  const initialCard = (() => {
    const normalized = initialSlug.trim().toLowerCase();
    if (!normalized) return null;
    return cards.find((card) => slugFromHref(card.href).toLowerCase() === normalized) ?? null;
  })();
  const selected = initialCard;
  const taxonomyGroups = (() => {
    const groups = new Map<string, { key: string; label: string; cards: PackageTaxonomyCard[] }>();
    cards.forEach((card) => {
      const key = card.groupKey?.trim() || "all-packages";
      const label = card.groupLabel?.trim() || (locale === "es" ? "Todos los paquetes" : "All photo packages");
      const group = groups.get(key);
      if (group) {
        group.cards.push(card);
      } else {
        groups.set(key, { key, label, cards: [card] });
      }
    });
    return Array.from(groups.values());
  })();

  if (selected) {
    const spanish = locale === "es";
    const detailBestFor = selected.detailBestFor ?? [];
    const detailReviewPoints = selected.detailReviewPoints ?? [];
    const detailStats = selected.detailStats ?? [];
    const detailWorkflow = selected.detailWorkflow ?? [];
    const hasDetailBlocks = Boolean(selected.detailCreates || detailBestFor.length || detailWorkflow.length || detailReviewPoints.length);
    const hasLeftDetailBlocks = Boolean(selected.detailCreates || detailReviewPoints.length);
    const hasRightDetailBlocks = Boolean(detailBestFor.length || detailWorkflow.length);
    const selectedImages = detailPreviewImages(selected);
    const selectedPanelClass = variant === "cream"
      ? "flex flex-col rounded-[24px] border border-[#E6D8C3] bg-[#FFF8ED] p-5 shadow-[0_28px_90px_-64px_rgba(70,46,24,0.28)] sm:p-6 lg:p-7"
      : "flex flex-col rounded-[24px] border border-white/12 bg-white/[0.07] p-5 shadow-[0_28px_90px_-60px_rgba(0,0,0,0.9)] sm:p-6 lg:p-7";
    const selectedImageFrameClass = variant === "cream"
      ? "w-full overflow-hidden rounded-[24px] border border-[#E6D8C3] bg-[#FFF8ED] p-3 shadow-[0_28px_90px_-64px_rgba(70,46,24,0.28)] lg:max-w-[540px] lg:justify-self-end"
      : "w-full overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.06] p-3 shadow-[0_28px_90px_-60px_rgba(0,0,0,0.9)] lg:max-w-[540px] lg:justify-self-end";
    const selectedImageBgClass = variant === "cream" ? "bg-[#EADFCF]" : "bg-zinc-900";
    return (
      <DreamshootShowcasePreview>
      <div data-package-taxonomy-client="ready">
        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.75fr)] lg:items-start">
          <div className={selectedPanelClass}>
            <p className={variant === "cream" ? "text-xs font-semibold uppercase tracking-[0.18em] text-[#9B7A5D]" : "text-xs font-semibold uppercase tracking-[0.18em] text-white/[0.44]"}>{spanish ? "Paquete seleccionado" : "Selected package"}</p>
            <h2 className={variant === "cream" ? "mt-4 text-[clamp(1.7rem,2.7vw,2.85rem)] font-semibold leading-[1.02] tracking-tight text-[#1E1712] [font-family:var(--site-title-font)]" : "mt-4 text-[clamp(1.7rem,2.7vw,2.85rem)] font-semibold leading-[1.02] tracking-tight text-white [font-family:var(--site-title-font)]"}>
              {selected.title}
            </h2>
            <p className={variant === "cream" ? "mt-4 max-w-2xl text-sm leading-7 text-[#6F6257]" : "mt-4 max-w-2xl text-sm leading-7 text-white/[0.66]"}>
              {selected.description || (spanish ? "Revisa la direccion del paquete, las fotos fuente, el uso de creditos y el album privado antes de iniciar la generacion." : "Review this package direction, source-photo needs, credit use, and the private album experience before starting a generation request.")}
            </p>
            {detailStats.length ? (
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {detailStats.map((stat) => (
                  <span className={variant === "cream" ? "rounded-[14px] border border-[#E3D3BE] bg-white/70 px-3 py-2 text-center text-xs font-semibold text-[#7B5C40]" : "rounded-[14px] border border-white/12 bg-white/[0.06] px-3 py-2 text-center text-xs font-semibold text-white/[0.74]"} key={stat}>
                    {stat}
                  </span>
                ))}
              </div>
            ) : null}
            {selected.chips.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {selected.chips.map((chip) => (
                  <span className={variant === "cream" ? "rounded-[8px] border border-[#E3D3BE] bg-white/70 px-2.5 py-1 text-[11px] font-semibold leading-5 text-[#7B5C40]" : splitTagClass} key={chip}>
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            <a className={variant === "cream" ? "mt-7 inline-flex items-center gap-2 self-start rounded-full bg-[#1E1712] px-5 py-3 text-sm font-semibold text-[#FFF8ED] transition hover:-translate-y-0.5 hover:bg-[#2A211A]" : "mt-7 inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#101114] transition hover:-translate-y-0.5 hover:bg-white/90"} href={selected.appHref}>
              {spanish ? "Empezar este paquete" : "Start this package"}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </a>
          </div>
          <div className={selectedImageFrameClass}>
            <div className={selectedImages.length > 1 ? "grid grid-cols-2 items-start gap-3" : "grid items-start"}>
              {selectedImages.map((image, index) => (
                <div className={`overflow-hidden rounded-[18px] ${selectedImageBgClass}`} key={`${selected.id}_detail_${image}_${index}`}>
	                  <SafeTaxonomyImage
	                    alt={taxonomyImageAlt(selected, image, index, locale, "cover")}
                    className="transition duration-500"
                    decoding="async"
                    fetchPriority={index === 0 ? "low" : "auto"}
                    loading={index === 0 ? "eager" : "lazy"}
                    src={image}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        {hasDetailBlocks ? (
          <div className={variant === "cream" ? "mt-6 rounded-[24px] border border-[#E6D8C3] bg-[#FFF8ED] p-5 shadow-[0_28px_90px_-64px_rgba(70,46,24,0.24)] sm:p-6 lg:p-7" : "mt-6 rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_90px_-68px_rgba(0,0,0,0.85)] sm:p-6 lg:p-7"}>
            <div className={`grid gap-6 ${hasLeftDetailBlocks && hasRightDetailBlocks ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : ""}`}>
              {hasLeftDetailBlocks ? (
                <div className="grid content-start gap-6">
                  {selected.detailCreates ? (
                    <div>
                      <h2 className={variant === "cream" ? "text-sm font-semibold text-[#1E1712]" : "text-sm font-semibold text-white"}>{spanish ? "Que crea" : "What this creates"}</h2>
                      <p className={variant === "cream" ? "mt-2 text-sm leading-7 text-[#6F6257]" : "mt-2 text-sm leading-7 text-white/[0.58]"}>
                        {selected.detailCreates}
                      </p>
                    </div>
                  ) : null}
                  {detailReviewPoints.length ? (
                    <div>
                      <h2 className={variant === "cream" ? "text-sm font-semibold text-[#1E1712]" : "text-sm font-semibold text-white"}>{spanish ? "Puntos de revision" : "Review points"}</h2>
                      <ul className="mt-3 grid gap-2">
                        {detailReviewPoints.map((item) => (
                          <li className={variant === "cream" ? "flex gap-2 text-sm leading-6 text-[#6F6257]" : "flex gap-2 text-sm leading-6 text-white/[0.58]"} key={item}>
                            <Sparkles className={variant === "cream" ? "mt-0.5 h-4 w-4 shrink-0 text-[#B86E36]" : "mt-0.5 h-4 w-4 shrink-0 text-blue-300"} strokeWidth={2} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {hasRightDetailBlocks ? (
                <div className="grid content-start gap-6 xl:grid-cols-2">
                  {detailBestFor.length ? (
                    <div>
                      <h2 className={variant === "cream" ? "text-sm font-semibold text-[#1E1712]" : "text-sm font-semibold text-white"}>{spanish ? "Mejor para" : "Best for"}</h2>
                      <ul className="mt-3 grid gap-2">
                        {detailBestFor.map((item) => (
                          <li className={variant === "cream" ? "flex gap-2 text-sm leading-6 text-[#6F6257]" : "flex gap-2 text-sm leading-6 text-white/[0.58]"} key={item}>
                            <CheckCircle2 className={variant === "cream" ? "mt-0.5 h-4 w-4 shrink-0 text-[#B86E36]" : "mt-0.5 h-4 w-4 shrink-0 text-[#16dcf0]"} strokeWidth={2} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {detailWorkflow.length ? (
                    <div>
                      <h2 className={variant === "cream" ? "text-sm font-semibold text-[#1E1712]" : "text-sm font-semibold text-white"}>{spanish ? "Como funciona" : "How it works"}</h2>
                      <ol className="mt-3 grid gap-2">
                        {detailWorkflow.map((item, index) => (
                          <li className={variant === "cream" ? "grid grid-cols-[24px_1fr] gap-2 text-sm leading-6 text-[#6F6257]" : "grid grid-cols-[24px_1fr] gap-2 text-sm leading-6 text-white/[0.58]"} key={item}>
                            <span className={variant === "cream" ? "grid h-6 w-6 place-items-center rounded-full bg-[#1E1712]/10 text-[11px] font-bold text-[#1E1712]/[0.78]" : "grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-white/[0.78]"}>{index + 1}</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      </DreamshootShowcasePreview>
    );
  }

  if (cards.some((card) => card.layout === "split")) {
    if (grouped) {
      return (
        <DreamshootShowcasePreview>
          <div className="mt-10 grid gap-12" data-package-taxonomy-client="ready" data-package-taxonomy-groups="ready">
            {taxonomyGroups.map((group) => (
              <section className="grid gap-5" data-package-taxonomy-group={group.key} key={group.key}>
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/[0.42]">{locale === "es" ? "Categoria principal" : "Top-level category"}</p>
                    <h2 className="mt-2 text-[clamp(1.6rem,2.5vw,2.55rem)] font-semibold leading-tight tracking-tight text-white [font-family:var(--site-title-font)]">{group.label}</h2>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/[0.42]">{group.cards.length} {locale === "es" ? "temas" : "themes"}</span>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {group.cards.map((card, index) => (
                    <SplitPackageTaxonomyCard card={card} index={index} key={card.id} locale={locale} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DreamshootShowcasePreview>
      );
    }
    return (
      <DreamshootShowcasePreview>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" data-package-taxonomy-client="ready">
        {cards.map((card, index) => (
          <SplitPackageTaxonomyCard card={card} index={index} key={card.id} locale={locale} />
        ))}
      </div>
      </DreamshootShowcasePreview>
    );
  }

  if (grouped) {
    return (
      <DreamshootShowcasePreview>
        <div className="mt-10 grid gap-12" data-package-taxonomy-client="ready" data-package-taxonomy-groups="ready">
          {taxonomyGroups.map((group) => (
            <section className="grid gap-5" data-package-taxonomy-group={group.key} key={group.key}>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/[0.42]">{locale === "es" ? "Categoria principal" : "Top-level category"}</p>
                  <h2 className="mt-2 text-[clamp(1.6rem,2.5vw,2.55rem)] font-semibold leading-tight tracking-tight text-white [font-family:var(--site-title-font)]">{group.label}</h2>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/[0.42]">{group.cards.length} {locale === "es" ? "temas" : "themes"}</span>
              </div>
              <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-12">
                {group.cards.map((card, index) => {
                  const spanish = locale === "es";
                  const mosaicVariant = index % 10;
                  const cardSpanClass = mosaicVariant === 0
                    ? "lg:col-span-7"
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
                  const cardClass = variant === "cream"
                    ? `group relative block overflow-hidden rounded-[18px] border border-[#E3D3BE] bg-[#FFF8ED] text-[#1E1712] shadow-[0_22px_48px_-42px_rgba(70,46,24,0.42)] transition hover:-translate-y-1 hover:border-[#B86E36]/45 sm:col-span-1 ${cardSpanClass}`
                    : `group relative block overflow-hidden rounded-[18px] border border-white/12 bg-white/[0.07] text-white shadow-[0_22px_46px_-38px_rgba(0,0,0,0.82)] transition hover:-translate-y-1 hover:border-white/24 sm:col-span-1 ${cardSpanClass}`;
                  return (
                    <a
                      aria-label={cardLinkLabel(spanish ? "Ver coleccion" : "View collection", card.title)}
                      className={cardClass}
                      href={card.href}
                      key={card.id}
                    >
                      <div className="relative overflow-hidden bg-white/[0.035]">
                        <SafeTaxonomyImage
                          alt={taxonomyImageAlt(card, card.imageUrl, 0, locale, "card")}
                          className="transition duration-700"
                          decoding="async"
                          fetchPriority="low"
                          loading="lazy"
                          src={card.imageUrl}
                        />
                      </div>
                      <div className="flex min-h-[220px] w-full flex-col p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <span className={variant === "cream" ? "max-w-[78%] rounded-[8px] border border-[#E3D3BE] bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[#7B5C40]" : "max-w-[78%] rounded-[8px] border border-white/[0.13] bg-[#101827]/[0.76] px-2.5 py-1 text-[11px] font-semibold text-white/[0.78] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"}>{card.meta}</span>
                          <ArrowRight className={variant === "cream" ? "h-4 w-4 shrink-0 text-[#7B5C40]/72 transition group-hover:translate-x-1 group-hover:text-[#1E1712]" : "h-4 w-4 shrink-0 text-white/78 transition group-hover:translate-x-1 group-hover:text-white"} strokeWidth={1.8} />
                        </div>
                        <div className="mt-auto">
                          <h2 className="text-[clamp(1.25rem,1.8vw,1.72rem)] font-semibold leading-tight tracking-[-0.03em] text-balance">{card.title}</h2>
                          <p className={variant === "cream" ? "mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-[#6F6257]" : "mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-white/68"}>{card.description}</p>
                          {card.keywords.length ? (
                            <div className="mt-5 flex flex-wrap gap-2">
                              {card.keywords.slice(0, 4).map((keyword) => (
                                <span className={variant === "cream" ? "rounded-[8px] border border-white/20 bg-[#1E1712]/[0.38] px-2.5 py-1 text-[11px] font-semibold text-white/[0.82] backdrop-blur" : "rounded-[8px] border border-white/[0.13] bg-[#101827]/[0.76] px-2.5 py-1 text-[11px] font-semibold text-white/[0.78] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur"} key={keyword}>
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
            </section>
          ))}
        </div>
      </DreamshootShowcasePreview>
    );
  }

  return (
    <DreamshootShowcasePreview>
    <div className="mt-10 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-12" data-package-taxonomy-client="ready">
      {cards.map((card, index) => {
        const spanish = locale === "es";
        const mosaicVariant = index % 10;
        const cardSpanClass = mosaicVariant === 0
          ? "lg:col-span-7"
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
        const cardClass = variant === "cream"
          ? `group relative block overflow-hidden rounded-[18px] border border-[#E3D3BE] bg-[#FFF8ED] text-[#1E1712] shadow-[0_22px_48px_-42px_rgba(70,46,24,0.42)] transition hover:-translate-y-1 hover:border-[#B86E36]/45 sm:col-span-1 ${cardSpanClass}`
          : `group relative block overflow-hidden rounded-[18px] border border-white/12 bg-white/[0.07] text-white shadow-[0_22px_46px_-38px_rgba(0,0,0,0.82)] transition hover:-translate-y-1 hover:border-white/24 sm:col-span-1 ${cardSpanClass}`;
        return (
          <a
            aria-label={cardLinkLabel(spanish ? "Ver coleccion" : "View collection", card.title)}
            className={cardClass}
            href={card.href}
            key={card.id}
          >
            <div className="relative overflow-hidden bg-white/[0.035]">
	              <SafeTaxonomyImage
	                alt={taxonomyImageAlt(card, card.imageUrl, 0, locale, "card")}
                className="transition duration-700"
                decoding="async"
                fetchPriority="low"
                loading="lazy"
                src={card.imageUrl}
              />
              {index === 0 ? <span className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(90deg,#ffa644,#ec4bdd,#16dcf0)" }} /> : null}
            </div>
            <div className="flex min-h-[220px] w-full flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <span className={variant === "cream" ? "max-w-[78%] rounded-[8px] border border-[#E3D3BE] bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[#7B5C40]" : "max-w-[78%] rounded-[8px] border border-white/[0.13] bg-[#101827]/[0.76] px-2.5 py-1 text-[11px] font-semibold text-white/[0.78] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"}>{card.meta}</span>
                <ArrowRight className={variant === "cream" ? "h-4 w-4 shrink-0 text-[#7B5C40]/72 transition group-hover:translate-x-1 group-hover:text-[#1E1712]" : "h-4 w-4 shrink-0 text-white/78 transition group-hover:translate-x-1 group-hover:text-white"} strokeWidth={1.8} />
              </div>
              <div className="mt-auto">
                <h2 className="text-[clamp(1.25rem,1.8vw,1.72rem)] font-semibold leading-tight tracking-[-0.03em] text-balance">{card.title}</h2>
                <p className={variant === "cream" ? "mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-[#6F6257]" : "mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-white/68"}>{card.description}</p>
                {card.keywords.length ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {card.keywords.slice(0, 4).map((keyword) => (
                      <span className={variant === "cream" ? "rounded-[8px] border border-white/20 bg-[#1E1712]/[0.38] px-2.5 py-1 text-[11px] font-semibold text-white/[0.82] backdrop-blur" : "rounded-[8px] border border-white/[0.13] bg-[#101827]/[0.76] px-2.5 py-1 text-[11px] font-semibold text-white/[0.78] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur"} key={keyword}>
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
    </DreamshootShowcasePreview>
  );
}
