import { ArrowRight, Check, ChevronRight, Sparkles, ShieldCheck, X } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { SectionInstance, Site } from "@/lib/types";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import { aiVideoTopicLandingContentByKey, type AiVideoTopicCard, type AiVideoTopicLandingContent } from "@/lib/ai-video-topic-content";

type RoutedSite = Site & { __storefrontBasePath?: string };
const displayMediaAspectRatio = "16 / 9";

function hrefFor(site: Site, href: string): string {
  if (href.startsWith("#")) return href;
  const routedSite = site as RoutedSite;
  const basePath = routedSite.__storefrontBasePath;
  if (typeof basePath === "string") return basePath ? `${basePath}${href}` : href;
  return hostAwareSitePath(site, href);
}

function InternalLink({
  site,
  href,
  children,
  className
}: {
  site: Site;
  href: string;
  children: ReactNode;
  className: string;
}) {
  return (
    <StorefrontInstantLink className={className} href={hrefFor(site, href)}>
      {children}
    </StorefrontInstantLink>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
  light = false
}: {
  eyebrow: string;
  title: string;
  body?: string;
  light?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${light ? "text-[#6652bd]" : "text-[#b8a7ff]"}`}>{eyebrow}</p>
      <h2 className={`mt-4 text-balance text-3xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-5xl ${light ? "text-[#191622]" : "text-white"}`}>{title}</h2>
      {body ? <p className={`mt-5 max-w-2xl text-base leading-7 ${light ? "text-[#625e6f]" : "text-white/68"}`}>{body}</p> : null}
    </div>
  );
}

function ActionLink({
  site,
  href,
  label,
  variant = "primary"
}: {
  site: Site;
  href: string;
  label: string;
  variant?: "primary" | "secondary" | "dark";
}) {
  const className =
    variant === "primary"
      ? "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#c4b5fd] px-6 text-sm font-semibold text-[#191622] transition hover:-translate-y-0.5 hover:bg-[#d4ccff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd]"
      : variant === "dark"
        ? "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#17151f] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#272232] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#17151f]"
        : "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/[0.06] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd]";
  return (
    <InternalLink className={className} href={href} site={site}>
      {label}
      <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.8} />
    </InternalLink>
  );
}

function ImageCard({
  item,
  index,
  site
}: {
  item: AiVideoTopicLandingContent["useCases"]["items"][number];
  index: number;
  site: Site;
  }) {
  return (
    <article className="group overflow-hidden rounded-[22px] border border-white/10 bg-[#17151f] shadow-[0_28px_70px_-54px_rgba(0,0,0,0.92)]">
      <div className="relative aspect-video overflow-hidden bg-[#292438]" style={{ aspectRatio: displayMediaAspectRatio }}>
        <img
          src={item.image.src}
          alt={item.image.alt}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          width={item.image.width}
          height={item.image.height}
          loading="lazy"
          decoding="async"
        />
        <span className="absolute left-4 top-4 rounded-full border border-white/25 bg-[#17151f]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#b8a7ff]">Customer problem</p>
        <p className="mt-3 text-sm leading-6 text-white/65">{item.problem}</p>
        <h3 className="mt-6 text-xl font-semibold leading-tight text-white">{item.title}</h3>
        <p className="mt-3 text-sm leading-6 text-white/68">{item.body}</p>
        {item.noteLabel && item.noteBody ? (
          <div className="mt-5 rounded-2xl border border-[#c4b5fd]/20 bg-[#c4b5fd]/[0.07] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#c4b5fd]">{item.noteLabel}</p>
            <p className="mt-2 text-sm leading-6 text-white/82">{item.noteBody}</p>
          </div>
        ) : null}
        <InternalLink className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#ddd7ff] transition hover:text-white" href="#how-it-works" site={site}>
          {item.cta}
          <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        </InternalLink>
      </div>
    </article>
  );
}

function SupportingCard({ card }: { card: AiVideoTopicCard }) {
  return (
    <article className="rounded-[22px] border border-white/10 bg-[#17151f] p-6 sm:p-7">
      {card.image ? (
        <div className="relative -mx-2 -mt-2 mb-6 overflow-hidden rounded-[16px] bg-[#292438]" style={{ aspectRatio: `${card.image.width} / ${card.image.height}` }}>
          <img
            src={card.image.src}
            alt={card.image.alt}
            className="h-full w-full object-cover"
            width={card.image.width}
            height={card.image.height}
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-white">{card.title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/65">{card.body}</p>
      {card.exampleLabel && card.exampleBody ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b8a7ff]">{card.exampleLabel}</p>
          <p className="mt-2 text-sm leading-6 text-white/82">{card.exampleBody}</p>
        </div>
      ) : null}
    </article>
  );
}

function DirectionList({
  title,
  items,
  tone
}: {
  title: string;
  items: string[];
  tone: "positive" | "avoid" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "border-[#c4b5fd]/25 bg-[#c4b5fd]/[0.08]"
      : tone === "avoid"
        ? "border-white/10 bg-white/[0.04]"
        : "border-white/10 bg-white/[0.04]";
  const iconClass = tone === "positive" ? "text-[#c4b5fd]" : tone === "avoid" ? "text-white/40" : "text-[#b8a7ff]";
  const Icon = tone === "positive" ? Check : tone === "avoid" ? X : Sparkles;
  return (
    <div className={`rounded-[22px] border p-6 sm:p-7 ${toneClass}`}>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li className="flex items-start gap-3 text-sm leading-6 text-white/72" key={item}>
            <Icon className={`mt-1 h-4 w-4 shrink-0 ${iconClass}`} strokeWidth={2} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionCards({
  cards
}: {
  cards: AiVideoTopicCard[];
}) {
  return (
    <div
      className="mt-12 grid gap-4"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(min(16rem, 100%), 1fr))"
      }}
    >
      {cards.map((card) => (
        <SupportingCard card={card} key={card.title} />
      ))}
    </div>
  );
}

export function AiVideoTopicLanding({ section, site }: { section: SectionInstance; site: Site }) {
  const contentKey = String(section.settings.contentKey ?? section.settings.anchor ?? "").trim();
  const content = aiVideoTopicLandingContentByKey[contentKey];
  if (!content) notFound();
  const primaryHref = `/app/create?videoMode=${encodeURIComponent(contentKey)}#step-video`;
  const heroImageFitClass = content.hero.imageFit === "contain" ? "object-contain" : "object-cover";

  return (
    <main className="overflow-hidden bg-[#0d0b13] text-white" id={String(section.settings.anchor ?? contentKey)}>
      <section className="relative border-b border-white/10 bg-[#0d0b13]">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.94fr_1.06fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c4b5fd]">{content.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-[720px] text-balance text-4xl font-semibold leading-[0.96] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref} label={content.hero.primaryCta} site={site} />
              <ActionLink href="#use-cases" label={content.hero.secondaryCta} site={site} variant="secondary" />
            </div>
            {content.hero.highlights?.length ? (
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3">
                {content.hero.highlights.map((highlight) => (
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-white/68" key={highlight}>
                    <Sparkles className="h-4 w-4 shrink-0 text-[#c4b5fd]" strokeWidth={1.8} />
                    {highlight}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-5 max-w-xl text-xs leading-5 text-white/50">{content.hero.availabilityNote}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">{content.hero.rightsCopy}</p>
          </div>
          <figure className="relative lg:justify-self-end">
            <div className="overflow-hidden rounded-[28px] border border-[#c4b5fd]/25 bg-[#221d30] p-2 shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]">
              <div className="relative overflow-hidden rounded-[21px]" style={{ aspectRatio: content.hero.mediaAspectRatio ?? displayMediaAspectRatio }}>
                <img
                  src={content.hero.image.src}
                  alt={content.hero.image.alt}
                  className={`absolute inset-0 h-full w-full ${heroImageFitClass}`}
                  width={content.hero.image.width}
                  height={content.hero.image.height}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            </div>
            <figcaption className="mt-4 flex items-start gap-3 text-sm leading-6 text-white/60">
              <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#c4b5fd]" strokeWidth={1.8} />
              <span>{content.hero.imageNote}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="use-cases">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.useCases.eyebrow} title={content.useCases.title} body={content.useCases.intro} />
          <div className="mt-12 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {content.useCases.items.map((item, index) => <ImageCard index={index} item={item} key={item.title} site={site} />)}
          </div>
        </div>
      </section>

      {content.gallery ? (
        <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="examples">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.gallery.eyebrow} title={content.gallery.title} body={content.gallery.intro} />
            <SectionCards cards={content.gallery.items} />
            {content.gallery.cta && content.gallery.ctaHref ? (
              <div className="mt-10 flex justify-center">
                <ActionLink href={content.gallery.ctaHref} label={content.gallery.cta} site={site} variant="secondary" />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="foundation">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-16">
          <SectionHeader eyebrow={content.foundation.eyebrow} title={content.foundation.title} body={content.foundation.intro} />
          <div className="grid gap-5 sm:grid-cols-2">
            <DirectionList items={content.foundation.leftItems} title={content.foundation.leftTitle} tone="positive" />
            <DirectionList items={content.foundation.rightItems} title={content.foundation.rightTitle} tone={content.foundation.rightTone === "neutral" ? "neutral" : "avoid"} />
            <div className="sm:col-span-2 rounded-[22px] border border-[#c4b5fd]/25 bg-[#191525] p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#c4b5fd]">{content.foundation.expertLabel ?? "Expert tip"}</p>
              <p className="mt-3 max-w-3xl text-base leading-7 text-white/78">{content.foundation.expertTip}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="guidance">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.guidance.eyebrow} title={content.guidance.title} body={content.guidance.intro} light />
          <SectionCards cards={content.guidance.cards} />
        </div>
      </section>

      {content.platformExamples ? (
        <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="platform-examples">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.platformExamples.eyebrow} title={content.platformExamples.title} body={content.platformExamples.intro} />
            <div
              className="mt-12 grid gap-4"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(min(16rem, 100%), 1fr))"
              }}
            >
              {content.platformExamples.items.map((card) => (
                <SupportingCard card={card} key={card.title} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="how-it-works">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.steps.eyebrow} title={content.steps.title} />
          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {content.steps.items.map((item, index) => (
              <article className="relative rounded-[22px] border border-white/10 bg-[#17151f] p-6" key={item.title}>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c4b5fd]">0{index + 1}</span>
                <h3 className="mt-7 text-xl font-semibold leading-tight text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-10">
            <ActionLink href={primaryHref} label={content.steps.cta} site={site} />
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="value">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.value.eyebrow} title={content.value.title} />
          {content.value.image ? (
            <figure className="mt-12 overflow-hidden rounded-[22px] border border-white/10 bg-[#17151f]">
              <img
                src={content.value.image.src}
                alt={content.value.image.alt}
                className="aspect-video h-auto w-full object-cover"
                width={content.value.image.width}
                height={content.value.image.height}
                loading="lazy"
                decoding="async"
              />
            </figure>
          ) : null}
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {content.value.items.map((item) => (
              <article className="rounded-[22px] border border-white/10 bg-[#17151f] p-6 sm:p-7" key={item.title}>
                <Sparkles className="h-5 w-5 text-[#c4b5fd]" strokeWidth={1.8} />
                <h3 className="mt-5 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#191525] px-5 py-16 sm:px-8 sm:py-24" id="trust">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <SectionHeader eyebrow={content.trust.eyebrow} title={content.trust.title} body={content.trust.intro} />
            <div className="grid gap-4 sm:grid-cols-2">
              {content.trust.items.map((item) => (
                <article className="rounded-[22px] border border-white/10 bg-white/[0.045] p-6" key={item.title}>
                  <ShieldCheck className="h-5 w-5 text-[#c4b5fd]" strokeWidth={1.8} />
                  <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="faq">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.faq.eyebrow} title={content.faq.title} light />
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {content.faq.items.map((item) => (
              <details className="group rounded-[20px] border border-[#d2c9ef] bg-white/55 p-5 open:bg-white/80" key={item.question}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-[#191622]">
                  <span>{item.question}</span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#6652bd] transition group-open:rotate-90" strokeWidth={1.8} />
                </summary>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[#625e6f]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[var(--site-content-width)] rounded-[28px] border border-[#c4b5fd]/25 bg-[#191525] px-6 py-12 text-center sm:px-10 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c4b5fd]">{content.finalCta.eyebrow}</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold leading-[1.03] tracking-[-0.035em] text-white sm:text-5xl">{content.finalCta.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/68">{content.finalCta.body}</p>
          <div className="mt-8 flex justify-center">
            <ActionLink href={primaryHref} label={content.finalCta.cta} site={site} />
          </div>
          <p className="mt-5 text-xs leading-5 text-white/48">{content.finalCta.microcopy}</p>
        </div>
      </section>
    </main>
  );
}
