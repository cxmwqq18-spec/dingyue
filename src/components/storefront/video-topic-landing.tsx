import { ArrowRight, Check, ChevronRight, ShieldCheck, Sparkles, X } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { SectionInstance, Site } from "@/lib/types";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import { aiVideoTopicLandingContentByKey, type AiVideoTopicLandingContent } from "@/lib/ai-video-topic-content";
import { talkingPhotoContent, type TalkingPhotoContent } from "@/lib/talking-photo-content";

type RoutedSite = Site & { __storefrontBasePath?: string };

const defaultObjectPosition = "50% 38%";
const talkingPhotoImageSize = { width: 1672, height: 941 };

type VideoTopicImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  objectPosition?: string;
};

type VideoTopicUseCase = {
  title: string;
  problem?: string;
  body: string;
  script?: string;
  noteLabel?: string;
  noteBody?: string;
  scenarioLabel?: string;
  image: VideoTopicImage;
};

type VideoTopicSupportingCard = {
  title: string;
  body: string;
  image?: VideoTopicImage;
  exampleLabel?: string;
  exampleBody?: string;
  details?: Array<{ label: string; body: string }>;
  href?: string;
  linkLabel?: string;
};

type VideoTopicContent = {
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    availabilityNote: string;
    rightsCopy: string;
    caption: string;
    image: VideoTopicImage;
    images?: VideoTopicImage[];
    highlights?: string[];
  };
  quickAnswer?: {
    eyebrow: string;
    title: string;
    intro?: string;
    cards: VideoTopicSupportingCard[];
  };
  useCases: {
    eyebrow: string;
    title: string;
    intro: string;
    items: VideoTopicUseCase[];
  };
  gallery?: {
    eyebrow: string;
    title: string;
    intro: string;
    items: VideoTopicSupportingCard[];
    cta?: string;
    ctaHref?: string;
  };
  foundation: {
    eyebrow: string;
    title: string;
    intro: string;
    leftTitle: string;
    leftItems: string[];
    rightTitle: string;
    rightItems: string[];
    rightTone?: "avoid" | "neutral";
    expertLabel?: string;
    expertTip: string;
    cards?: VideoTopicSupportingCard[];
  };
  guidance: {
    eyebrow: string;
    title: string;
    intro?: string;
    cards: VideoTopicSupportingCard[];
  };
  platformExamples?: {
    eyebrow: string;
    title: string;
    intro?: string;
    items: VideoTopicSupportingCard[];
  };
  supportingGroups: Array<{
    eyebrow: string;
    title: string;
    intro: string;
    items: VideoTopicSupportingCard[];
  }>;
  comparison?: {
    eyebrow: string;
    title: string;
    intro?: string;
    items: VideoTopicSupportingCard[];
  };
  steps: {
    eyebrow: string;
    title: string;
    items: Array<{ title: string; body: string }>;
    cta: string;
  };
  value: {
    eyebrow: string;
    title: string;
    intro?: string;
    items: Array<{ title: string; body: string }>;
    image?: VideoTopicImage;
  };
  evidence?: {
    eyebrow: string;
    title: string;
    intro?: string;
    cards: VideoTopicSupportingCard[];
  };
  examples?: {
    eyebrow: string;
    title: string;
    intro?: string;
    cards: VideoTopicSupportingCard[];
  };
  trust: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<{ title: string; body: string }>;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: Array<{ question: string; answer: string }>;
  };
  finalCta: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    microcopy: string;
  };
};

function hrefFor(site: Site, href: string): string {
  if (href.startsWith("#")) return href;
  const routedSite = site as RoutedSite;
  const basePath = routedSite.__storefrontBasePath;
  if (typeof basePath === "string") return basePath ? `${basePath}${href}` : href;
  return hostAwareSitePath(site, href);
}

function InternalLink({ site, href, children, className }: { site: Site; href: string; children: ReactNode; className: string }) {
  return (
    <StorefrontInstantLink className={className} href={hrefFor(site, href)}>
      {children}
    </StorefrontInstantLink>
  );
}

function SectionHeader({ eyebrow, title, body, light = false }: { eyebrow: string; title: string; body?: string; light?: boolean }) {
  return (
    <div className="max-w-3xl">
      <p className={`text-xs font-semibold uppercase tracking-normal ${light ? "text-[#6652bd]" : "text-[#b8a7ff]"}`}>{eyebrow}</p>
      <h2 className={`mt-4 text-balance text-3xl font-semibold leading-[1.02] tracking-normal sm:text-5xl ${light ? "text-[#191622]" : "text-white"}`}>{title}</h2>
      {body ? <p className={`mt-5 max-w-2xl text-base leading-7 ${light ? "text-[#625e6f]" : "text-white/68"}`}>{body}</p> : null}
    </div>
  );
}

function ActionLink({ site, href, label, variant = "primary" }: { site: Site; href: string; label: string; variant?: "primary" | "secondary" | "dark" }) {
  const className =
    variant === "primary"
      ? "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#c4b5fd] px-6 text-sm font-semibold text-[#191622] transition hover:-translate-y-0.5 hover:bg-[#d4ccff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd]"
      : variant === "dark"
        ? "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#17151f] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#272232] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#17151f]"
        : "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/[0.06] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd]";
  return (
    <InternalLink className={className} href={href} site={site}>
      {label}
      <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.8} />
    </InternalLink>
  );
}

function imageStyle(image: VideoTopicImage): { objectPosition: string } {
  if (image.objectPosition) return { objectPosition: image.objectPosition };
  return { objectPosition: image.height / image.width > 1.3 ? "50% 32%" : defaultObjectPosition };
}

function UseCaseCard({ item, index }: { item: VideoTopicUseCase; index: number }) {
  const label = item.scenarioLabel ?? "Customer problem";
  const noteLabel = item.noteLabel ?? (item.script ? "Example script" : undefined);
  const noteBody = item.noteBody ?? (item.script ? `“${item.script}”` : undefined);
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#17151f] shadow-[0_28px_70px_-54px_rgba(0,0,0,0.92)]" data-video-topic-use-case-card>
      <div className="relative aspect-[16/9] overflow-hidden bg-[#292438]" data-video-topic-media>
        <img
          src={item.image.src}
          alt={item.image.alt}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          style={imageStyle(item.image)}
          width={item.image.width}
          height={item.image.height}
          loading="eager"
          fetchPriority={index < 2 ? "high" : "auto"}
          decoding="async"
        />
        <span className="absolute left-4 top-4 rounded-full border border-white/25 bg-[#17151f]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-normal text-white/80 backdrop-blur">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="flex min-h-[22rem] flex-1 flex-col p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-normal text-[#b8a7ff]">{label}</p>
        {item.problem ? <p className="mt-3 min-h-[4.5rem] text-sm leading-6 text-white/65">{item.problem}</p> : null}
        <h3 className={`${item.problem ? "mt-6" : "mt-3"} min-h-[3.5rem] text-xl font-semibold leading-tight text-white`}>{item.title}</h3>
        <p className="mt-3 flex-1 text-sm leading-6 text-white/68">{item.body}</p>
        {noteLabel && noteBody ? (
          <div className="mt-5 min-h-[6.5rem] rounded-2xl border border-[#c4b5fd]/20 bg-[#c4b5fd]/[0.07] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-normal text-[#c4b5fd]">{noteLabel}</p>
            <p className="mt-2 text-sm leading-6 text-white/82">{noteBody}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SupportingCard({ card, light = false, site }: { card: VideoTopicSupportingCard; light?: boolean; site?: Site }) {
  return (
    <article className={`flex h-full flex-col rounded-[22px] border p-6 sm:p-7 ${light ? "border-[#d2c9ef] bg-white/55" : "border-white/10 bg-[#17151f]"}`}>
      {card.image ? (
        <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-[16px] bg-[#292438]">
          <img
            src={card.image.src}
            alt={card.image.alt}
            className="h-full w-full object-cover"
            style={imageStyle(card.image)}
            width={card.image.width}
            height={card.image.height}
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}
      <h3 className={`text-lg font-semibold ${light ? "text-[#191622]" : "text-white"}`}>{card.title}</h3>
      <p className={`mt-3 flex-1 text-sm leading-6 ${light ? "text-[#625e6f]" : "text-white/65"}`}>{card.body}</p>
      {card.exampleLabel && card.exampleBody ? (
        <div className={`mt-5 rounded-2xl border p-4 ${light ? "border-[#d2c9ef] bg-[#f5f2ff]" : "border-white/10 bg-white/[0.04]"}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-normal ${light ? "text-[#6652bd]" : "text-[#b8a7ff]"}`}>{card.exampleLabel}</p>
          <p className={`mt-2 text-sm leading-6 ${light ? "text-[#3f3b4c]" : "text-white/82"}`}>{card.exampleBody}</p>
        </div>
      ) : null}
      {card.details?.length ? (
        <dl className={`mt-5 space-y-3 border-t pt-4 ${light ? "border-[#d2c9ef]" : "border-white/10"}`}>
          {card.details.map((detail) => (
            <div className="grid grid-cols-[4.5rem_1fr] gap-3" key={detail.label}>
              <dt className={`text-[11px] font-semibold uppercase tracking-normal ${light ? "text-[#6652bd]" : "text-[#b8a7ff]"}`}>{detail.label}</dt>
              <dd className={`text-sm leading-6 ${light ? "text-[#625e6f]" : "text-white/68"}`}>{detail.body}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {card.href && card.linkLabel && site ? (
        <div className="mt-5">
          <InternalLink className={`inline-flex items-center gap-2 text-sm font-semibold ${light ? "text-[#6652bd]" : "text-[#c4b5fd]"}`} href={card.href} site={site}>
            {card.linkLabel}
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </InternalLink>
        </div>
      ) : null}
    </article>
  );
}

function SectionCards({ cards, light = false, site }: { cards: VideoTopicSupportingCard[]; light?: boolean; site?: Site }) {
  return (
    <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3" data-video-topic-supporting-cards>
      {cards.map((card) => <SupportingCard card={card} key={card.title} light={light} site={site} />)}
    </div>
  );
}

function DirectionList({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "avoid" | "neutral" }) {
  const toneClass = tone === "positive" ? "border-[#c4b5fd]/25 bg-[#c4b5fd]/[0.08]" : "border-white/10 bg-white/[0.04]";
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

function ValueSection({ section, light = false }: { section: VideoTopicContent["value"]; light?: boolean }) {
  return (
    <section className={`border-b px-5 py-16 sm:px-8 sm:py-24 ${light ? "border-[#d9d1f6] bg-[#e9e5f7] text-[#191622]" : "border-white/10 bg-[#0d0b13] text-white"}`} id="value" data-video-topic-section="value">
      <div className="mx-auto max-w-[var(--site-content-width)]">
        <SectionHeader eyebrow={section.eyebrow} title={section.title} body={section.intro} light={light} />
        {section.image ? (
          <figure className="relative mt-12 aspect-[16/9] overflow-hidden rounded-[22px] border border-white/10 bg-[#17151f]">
            <img
              src={section.image.src}
              alt={section.image.alt}
              className="absolute inset-0 h-full w-full object-cover"
              style={imageStyle(section.image)}
              width={section.image.width}
              height={section.image.height}
              loading="lazy"
              decoding="async"
            />
          </figure>
        ) : null}
        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2">
          {section.items.map((item) => (
            <article className={`h-full rounded-[22px] p-6 sm:p-7 ${light ? "border border-[#d2c9ef] bg-white/55" : "border border-white/10 bg-[#17151f]"}`} key={item.title}>
              <Sparkles className="h-5 w-5 text-[#c4b5fd]" strokeWidth={1.8} />
              <h3 className={`mt-5 text-xl font-semibold ${light ? "text-[#191622]" : "text-white"}`}>{item.title}</h3>
              <p className={`mt-3 text-sm leading-6 ${light ? "text-[#625e6f]" : "text-white/65"}`}>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoAdTopicLanding({ content, section, site }: { content: VideoTopicContent; section: SectionInstance; site: Site }) {
  const primaryHref = `/app/create?videoMode=${encodeURIComponent("video-ad")}#step-video`;
  const galleryItems = content.gallery?.items.filter((item): item is VideoTopicSupportingCard & { image: VideoTopicImage } => Boolean(item.image)) ?? [];
  const heroPreview = [galleryItems[0], galleryItems[5], galleryItems[6]].filter((item): item is VideoTopicSupportingCard & { image: VideoTopicImage } => Boolean(item));
  return (
    <main className="overflow-hidden bg-[#0d0b13] text-white" id={String(section.settings.anchor ?? "video-ad")} data-video-topic-page="video-ad">
      <section className="border-b border-white/10 bg-[#0d0b13]" data-video-topic-section="hero">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-normal text-white/45" aria-label="Breadcrumb">
              <InternalLink className="text-[#c4b5fd] transition hover:text-white" href="/ai-video-generation" site={site}>AI Video Generation</InternalLink>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>Marketing & Commerce</span>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="text-white/68">Video Ad</span>
            </nav>
            <p className="mt-8 text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-[760px] text-balance text-4xl font-semibold leading-[0.96] tracking-normal text-white sm:text-6xl lg:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref} label={content.hero.primaryCta} site={site} />
              <ActionLink href="/ai-video-generation" label={content.hero.secondaryCta} site={site} variant="secondary" />
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 text-white/50">{content.hero.availabilityNote}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">{content.hero.rightsCopy}</p>
            {content.hero.highlights?.length ? (
              <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-white/62">
                {content.hero.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}
              </div>
            ) : null}
          </div>
          <figure className="relative lg:justify-self-end" data-video-topic-hero-media>
            <div className="relative aspect-[4/5] min-h-[420px] overflow-hidden rounded-[30px] border border-[#c4b5fd]/25 bg-[#17151f] p-3 shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)] sm:min-h-[560px]">
              {heroPreview.map((item, index) => (
                <div
                  className={`absolute overflow-hidden rounded-[24px] border border-white/10 bg-[#292438] ${index === 0 ? "inset-x-[8%] top-[5%] aspect-[4/5]" : index === 1 ? "bottom-[8%] left-[6%] w-[52%] aspect-[4/5]" : "bottom-[16%] right-[6%] w-[44%] aspect-[4/5]"}`}
                  key={item.title}
                >
                  <img
                    src={item.image.src}
                    alt={item.image.alt}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={imageStyle(item.image)}
                    width={item.image.width}
                    height={item.image.height}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : undefined}
                    decoding="async"
                  />
                </div>
              ))}
              <div className="absolute bottom-5 left-5 right-5 rounded-[22px] border border-white/12 bg-[#0d0b13]/78 p-5 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-[#c4b5fd]">Creative brief</p>
                <p className="mt-3 text-xl font-semibold leading-tight text-white">{"Hook -> Product moment -> Proof -> Placement -> CTA"}</p>
              </div>
            </div>
            <figcaption className="mt-4 flex items-start gap-3 text-sm leading-6 text-white/60">
              <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#c4b5fd]" strokeWidth={1.8} />
              <span>{content.hero.caption}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {content.quickAnswer ? (
        <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="what-this-creates" data-video-topic-section="what-this-creates">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.quickAnswer.eyebrow} title={content.quickAnswer.title} body={content.quickAnswer.intro} />
            <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
              {content.quickAnswer.cards.map((card) => <SupportingCard card={card} key={card.title} site={site} />)}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="style-cues" data-video-topic-section="style-cues">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.74fr_1.26fr] lg:items-start lg:gap-16">
          <SectionHeader eyebrow={content.foundation.eyebrow} title={content.foundation.title} body={content.foundation.intro} />
          <div className="grid gap-5 sm:grid-cols-2">
            <DirectionList items={content.foundation.leftItems} title={content.foundation.leftTitle} tone="positive" />
            <DirectionList items={content.foundation.rightItems} title={content.foundation.rightTitle} tone="neutral" />
            <div className="sm:col-span-2 rounded-[22px] border border-[#c4b5fd]/25 bg-[#191525] p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.foundation.expertLabel ?? "Expert tip"}</p>
              <p className="mt-3 max-w-3xl text-base leading-7 text-white/78">{content.foundation.expertTip}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="how-it-works" data-video-topic-section="how-it-works">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.steps.eyebrow} title={content.steps.title} />
          <div className="mt-12 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
            {content.steps.items.map((item, index) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-video-ad-step key={item.title}>
                <span className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">0{index + 1}</span>
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

      {content.gallery ? (
        <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="scene-gallery" data-video-topic-section="scene-gallery">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.gallery.eyebrow} title={content.gallery.title} body={content.gallery.intro} light />
            <div className="mt-12 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {galleryItems.map((item) => (
                <article className="flex h-full flex-col overflow-hidden rounded-[22px] border border-[#d2c9ef] bg-white/65" data-video-ad-scene key={item.title}>
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#d9d1f6]">
                    <img src={item.image.src} alt={item.image.alt} className="absolute inset-0 h-full w-full object-cover" style={imageStyle(item.image)} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg font-semibold leading-tight text-[#191622]">{item.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-[#625e6f]">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="guide" data-video-topic-section="guide">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.guidance.eyebrow} title={content.guidance.title} body={content.guidance.intro} />
          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-5">
            {content.guidance.cards.map((card) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-video-ad-guide-card key={card.title}>
                <Sparkles className="h-5 w-5 text-[#c4b5fd]" strokeWidth={1.8} />
                <h3 className="mt-5 text-lg font-semibold leading-tight text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="workflow" data-video-topic-section="workflow">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16">
          <div>
            <SectionHeader eyebrow={content.value.eyebrow} title={content.value.title} body={content.value.intro} light />
            <div className="mt-8">
              <ActionLink href={primaryHref} label={content.finalCta.cta} site={site} variant="dark" />
            </div>
          </div>
          <div className="rounded-[24px] border border-[#d2c9ef] bg-white/65 p-6 sm:p-7" data-video-ad-workspace>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#6652bd]">Workspace evidence model</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {content.value.items.map((item) => (
                <article className="rounded-[18px] border border-[#d2c9ef] bg-[#f7f4ff] p-5" key={item.title}>
                  <h3 className="text-base font-semibold text-[#191622]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#625e6f]">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="faq" data-video-topic-section="faq">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.faq.eyebrow} title={content.faq.title} />
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {content.faq.items.map((item) => (
              <details className="group rounded-[20px] border border-white/10 bg-[#17151f] p-5 open:bg-[#211c2e]" key={item.question}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                  <span>{item.question}</span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#c4b5fd] transition group-open:rotate-90" strokeWidth={1.8} />
                </summary>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {content.comparison ? (
        <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="related-pages" data-video-topic-section="related-pages">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.comparison.eyebrow} title={content.comparison.title} body={content.comparison.intro} light />
            <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-5">
              {content.comparison.items.map((card) => <SupportingCard card={card} key={card.title} light site={site} />)}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" data-video-topic-section="final-cta">
        <div className="mx-auto max-w-[var(--site-content-width)] rounded-[28px] border border-[#c4b5fd]/25 bg-[#191525] px-6 py-12 text-center sm:px-10 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.finalCta.eyebrow}</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold leading-[1.03] tracking-normal text-white sm:text-5xl">{content.finalCta.title}</h2>
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

function UgcVideoTopicLanding({ content, section, site }: { content: VideoTopicContent; section: SectionInstance; site: Site }) {
  const primaryHref = `/app/create?videoMode=${encodeURIComponent("ugc-ad-video")}#step-video`;
  return (
    <main className="overflow-hidden bg-[#0d0b13] text-white" id={String(section.settings.anchor ?? "ugc-ad-video")} data-video-topic-page="ugc-ad-video">
      <section className="relative border-b border-white/10 bg-[#0d0b13]" data-video-topic-section="hero">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-[720px] text-balance text-4xl font-semibold leading-[0.96] tracking-normal text-white sm:text-6xl lg:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref} label={content.hero.primaryCta} site={site} />
              <ActionLink href="#examples" label={content.hero.secondaryCta} site={site} variant="secondary" />
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 text-white/50">{content.hero.availabilityNote}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">{content.hero.rightsCopy}</p>
            {content.hero.highlights?.length ? (
              <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-white/62">
                {content.hero.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}
              </div>
            ) : null}
          </div>
          <figure className="relative lg:justify-self-end">
            <div className="overflow-hidden rounded-[28px] border border-[#c4b5fd]/25 bg-[#221d30] p-2 shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[21px]" data-video-topic-hero-media>
                <img
                  src={content.hero.image.src}
                  alt={content.hero.image.alt}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={imageStyle(content.hero.image)}
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
              <span>{content.hero.caption}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {content.quickAnswer ? (
        <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="quick-answer" data-video-topic-section="quick-answer">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.quickAnswer.eyebrow} title={content.quickAnswer.title} body={content.quickAnswer.intro} />
            <SectionCards cards={content.quickAnswer.cards} site={site} />
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="use-cases" data-video-topic-section="use-cases">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.useCases.eyebrow} title={content.useCases.title} body={content.useCases.intro} />
          <div className="mt-12 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
            {content.useCases.items.map((item, index) => <UseCaseCard index={index} item={item} key={item.title} />)}
          </div>
        </div>
      </section>

      {content.evidence ? (
        <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="evidence" data-video-topic-section="evidence">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.evidence.eyebrow} title={content.evidence.title} body={content.evidence.intro} light />
            <SectionCards cards={content.evidence.cards} light site={site} />
          </div>
        </section>
      ) : null}

      {content.examples ? (
        <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="examples" data-video-topic-section="examples">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.examples.eyebrow} title={content.examples.title} body={content.examples.intro} />
            <SectionCards cards={content.examples.cards} site={site} />
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="foundation" data-video-topic-section="foundation">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.foundation.eyebrow} title={content.foundation.title} body={content.foundation.intro} />
          {content.foundation.cards?.length ? (
            <div className="mt-12">
              <SectionCards cards={content.foundation.cards} site={site} />
              <div className="mt-5 rounded-[22px] border border-[#c4b5fd]/25 bg-[#191525] p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.foundation.expertLabel ?? "Expert tip"}</p>
                <p className="mt-3 max-w-3xl text-base leading-7 text-white/78">{content.foundation.expertTip}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="guidance" data-video-topic-section="guidance">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.guidance.eyebrow} title={content.guidance.title} body={content.guidance.intro} />
          <SectionCards cards={content.guidance.cards} site={site} />
        </div>
      </section>

      {content.platformExamples ? (
        <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="creator-native-framing" data-video-topic-section="creator-native-framing">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.platformExamples.eyebrow} title={content.platformExamples.title} body={content.platformExamples.intro} light />
            <SectionCards cards={content.platformExamples.items} light site={site} />
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="how-it-works" data-video-topic-section="how-it-works">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.steps.eyebrow} title={content.steps.title} />
          <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-5">
            {content.steps.items.map((item, index) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" key={item.title}>
                <span className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">0{index + 1}</span>
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

      <ValueSection section={content.value} light />

      {content.comparison ? (
        <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="comparison" data-video-topic-section="comparison">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.comparison.eyebrow} title={content.comparison.title} body={content.comparison.intro} />
            <SectionCards cards={content.comparison.items} site={site} />
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#191525] px-5 py-16 sm:px-8 sm:py-24" id="trust" data-video-topic-section="trust">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <SectionHeader eyebrow={content.trust.eyebrow} title={content.trust.title} body={content.trust.intro} />
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              {content.trust.items.map((item) => (
                <article className="h-full rounded-[22px] border border-white/10 bg-white/[0.045] p-6" key={item.title}>
                  <ShieldCheck className="h-5 w-5 text-[#c4b5fd]" strokeWidth={1.8} />
                  <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="faq" data-video-topic-section="faq">
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

      <section className="bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" data-video-topic-section="final-cta">
        <div className="mx-auto max-w-[var(--site-content-width)] rounded-[28px] border border-[#c4b5fd]/25 bg-[#191525] px-6 py-12 text-center sm:px-10 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.finalCta.eyebrow}</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold leading-[1.03] tracking-normal text-white sm:text-5xl">{content.finalCta.title}</h2>
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

function PromoVideoTopicLanding({ content, section, site }: { content: VideoTopicContent; section: SectionInstance; site: Site }) {
  const primaryHref = `/app/create?videoMode=${encodeURIComponent("promo-video")}#step-video`;
  return (
    <main className="overflow-hidden bg-[#0d0b13] text-white" id={String(section.settings.anchor ?? "promo-video")} data-video-topic-page="promo-video">
      <section className="relative border-b border-white/10 bg-[#0d0b13]" data-video-topic-section="hero">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-[720px] text-balance text-4xl font-semibold leading-[0.96] tracking-normal text-white sm:text-6xl lg:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref} label={content.hero.primaryCta} site={site} />
              <ActionLink href="#examples" label={content.hero.secondaryCta} site={site} variant="secondary" />
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 text-white/50">{content.hero.availabilityNote}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">{content.hero.rightsCopy}</p>
            {content.hero.highlights?.length ? (
              <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-white/62">
                {content.hero.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}
              </div>
            ) : null}
          </div>
          <figure className="relative lg:justify-self-end">
            <div className="overflow-hidden rounded-[28px] border border-[#c4b5fd]/25 bg-[#221d30] p-2 shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[21px]" data-video-topic-hero-media>
                <img
                  src={content.hero.image.src}
                  alt={content.hero.image.alt}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={imageStyle(content.hero.image)}
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
              <span>{content.hero.caption}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {content.quickAnswer ? (
        <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="quick-answer" data-video-topic-section="quick-answer">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.quickAnswer.eyebrow} title={content.quickAnswer.title} body={content.quickAnswer.intro} />
            <SectionCards cards={content.quickAnswer.cards} site={site} />
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="use-cases" data-video-topic-section="use-cases">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.useCases.eyebrow} title={content.useCases.title} body={content.useCases.intro} />
          <div className="mt-12 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
            {content.useCases.items.map((item, index) => <UseCaseCard index={index} item={item} key={item.title} />)}
          </div>
        </div>
      </section>

      {content.evidence ? (
        <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="evidence" data-video-topic-section="evidence">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.evidence.eyebrow} title={content.evidence.title} body={content.evidence.intro} light />
            <SectionCards cards={content.evidence.cards} light site={site} />
          </div>
        </section>
      ) : null}

      {content.examples ? (
        <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="examples" data-video-topic-section="examples">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.examples.eyebrow} title={content.examples.title} body={content.examples.intro} />
            <SectionCards cards={content.examples.cards} site={site} />
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="foundation" data-video-topic-section="foundation">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-16">
          <SectionHeader eyebrow={content.foundation.eyebrow} title={content.foundation.title} body={content.foundation.intro} />
          {content.foundation.cards?.length ? (
            <div>
              <SectionCards cards={content.foundation.cards} site={site} />
              <div className="mt-5 rounded-[22px] border border-[#c4b5fd]/25 bg-[#191525] p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.foundation.expertLabel ?? "Expert tip"}</p>
                <p className="mt-3 max-w-3xl text-base leading-7 text-white/78">{content.foundation.expertTip}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <DirectionList items={content.foundation.leftItems} title={content.foundation.leftTitle} tone="positive" />
              <DirectionList items={content.foundation.rightItems} title={content.foundation.rightTitle} tone="avoid" />
              <div className="sm:col-span-2 rounded-[22px] border border-[#c4b5fd]/25 bg-[#191525] p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.foundation.expertLabel ?? "Expert tip"}</p>
                <p className="mt-3 max-w-3xl text-base leading-7 text-white/78">{content.foundation.expertTip}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="guidance" data-video-topic-section="guidance">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.guidance.eyebrow} title={content.guidance.title} body={content.guidance.intro} light />
          <SectionCards cards={content.guidance.cards} light site={site} />
        </div>
      </section>

      {content.platformExamples ? (
        <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="urgency" data-video-topic-section="urgency">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.platformExamples.eyebrow} title={content.platformExamples.title} body={content.platformExamples.intro} />
            <SectionCards cards={content.platformExamples.items} site={site} />
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="how-it-works" data-video-topic-section="how-it-works">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.steps.eyebrow} title={content.steps.title} />
          <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-5">
            {content.steps.items.map((item, index) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" key={item.title}>
                <span className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">0{index + 1}</span>
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

      {content.comparison ? (
        <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="comparison" data-video-topic-section="comparison">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.comparison.eyebrow} title={content.comparison.title} body={content.comparison.intro} />
            <SectionCards cards={content.comparison.items} site={site} />
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#191525] px-5 py-16 sm:px-8 sm:py-24" id="trust" data-video-topic-section="trust">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <SectionHeader eyebrow={content.trust.eyebrow} title={content.trust.title} body={content.trust.intro} />
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              {content.trust.items.map((item) => (
                <article className="h-full rounded-[22px] border border-white/10 bg-white/[0.045] p-6" key={item.title}>
                  <ShieldCheck className="h-5 w-5 text-[#c4b5fd]" strokeWidth={1.8} />
                  <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="faq" data-video-topic-section="faq">
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

      <section className="bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" data-video-topic-section="final-cta">
        <div className="mx-auto max-w-[var(--site-content-width)] rounded-[28px] border border-[#c4b5fd]/25 bg-[#191525] px-6 py-12 text-center sm:px-10 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.finalCta.eyebrow}</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold leading-[1.03] tracking-normal text-white sm:text-5xl">{content.finalCta.title}</h2>
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

function normalizeAiContent(content: AiVideoTopicLandingContent): VideoTopicContent {
  const supportingGroups = [content.platformExamples, content.comparison]
    .filter(Boolean)
    .map((group) => ({
      eyebrow: group!.eyebrow,
      title: group!.title,
      intro: group!.intro,
      items: group!.items
    }));
  return {
    hero: {
      eyebrow: content.hero.eyebrow,
      title: content.hero.title,
      body: content.hero.body,
      primaryCta: content.hero.primaryCta,
      secondaryCta: content.hero.secondaryCta,
      availabilityNote: content.hero.availabilityNote,
      rightsCopy: content.hero.rightsCopy,
      caption: content.hero.imageNote,
      image: content.hero.image,
      images: content.hero.images,
      highlights: content.hero.highlights
    },
    quickAnswer: content.quickAnswer ? { ...content.quickAnswer, cards: content.quickAnswer.cards.map((card) => ({ ...card })) } : undefined,
    useCases: {
      ...content.useCases,
      items: content.useCases.items.map((item) => ({ ...item }))
    },
    gallery: content.gallery ? { ...content.gallery, items: content.gallery.items.map((item) => ({ ...item })) } : undefined,
    foundation: content.foundation,
    guidance: content.guidance,
    platformExamples: content.platformExamples ? { ...content.platformExamples, items: content.platformExamples.items.map((item) => ({ ...item })) } : undefined,
    supportingGroups,
    comparison: content.comparison ? { ...content.comparison, items: content.comparison.items.map((item) => ({ ...item })) } : undefined,
    steps: content.steps,
    value: content.value,
    evidence: content.evidence ? { ...content.evidence, cards: content.evidence.cards.map((card) => ({ ...card })) } : undefined,
    examples: content.examples ? { ...content.examples, cards: content.examples.cards.map((card) => ({ ...card })) } : undefined,
    trust: {
      eyebrow: content.trust.eyebrow,
      title: content.trust.title,
      intro: content.trust.intro ?? "",
      items: content.trust.items
    },
    faq: content.faq,
    finalCta: content.finalCta
  };
}

function normalizeTalkingContent(content: TalkingPhotoContent): VideoTopicContent {
  return {
    hero: {
      ...content.hero,
      caption: content.hero.caption,
      image: { ...content.hero.image, ...talkingPhotoImageSize }
    },
    useCases: {
      ...content.useCases,
      items: content.useCases.items.map((item) => ({
        title: item.title,
        problem: item.problem,
        body: item.body,
        script: item.script,
        image: { ...item.image, ...talkingPhotoImageSize }
      }))
    },
    foundation: {
      eyebrow: content.sourcePhoto.eyebrow,
      title: content.sourcePhoto.title,
      intro: content.sourcePhoto.intro,
      leftTitle: content.sourcePhoto.useTitle,
      leftItems: content.sourcePhoto.useItems,
      rightTitle: content.sourcePhoto.avoidTitle,
      rightItems: content.sourcePhoto.avoidItems,
      rightTone: "avoid",
      expertLabel: "Expert tip",
      expertTip: content.sourcePhoto.expertTip
    },
    guidance: {
      eyebrow: content.script.eyebrow,
      title: content.script.title,
      intro: content.script.intro,
      cards: content.script.rules.map((rule) => ({
        title: rule.title,
        body: rule.body,
        exampleLabel: rule.exampleTitle,
        exampleBody: rule.exampleBody
      }))
    },
    supportingGroups: [],
    steps: content.steps,
    value: content.value,
    trust: {
      eyebrow: content.trust.eyebrow,
      title: content.trust.title,
      intro: content.trust.body,
      items: content.trust.items
    },
    faq: content.faq,
    finalCta: content.finalCta
  };
}

function BrandVideoTopicLanding({ content, section, site }: { content: VideoTopicContent; section: SectionInstance; site: Site }) {
  const primaryHref = `/app/create?videoMode=${encodeURIComponent("brand-video")}#step-video`;
  const galleryItems = content.gallery?.items.filter((item): item is VideoTopicSupportingCard & { image: VideoTopicImage } => Boolean(item.image)) ?? [];
  const heroPreview = [galleryItems[0], galleryItems[4], galleryItems[7]].filter((item): item is VideoTopicSupportingCard & { image: VideoTopicImage } => Boolean(item));
  const storyBeats = content.platformExamples?.items ?? [];

  return (
    <main className="overflow-hidden bg-[#0d0b13] text-white" id={String(section.settings.anchor ?? "brand-video")} data-video-topic-page="brand-video">
      <section className="border-b border-white/10 bg-[#0d0b13]" data-video-topic-section="hero">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-normal text-white/45" aria-label="Breadcrumb">
              <InternalLink className="text-[#c4b5fd] transition hover:text-white" href="/ai-video-generation" site={site}>AI Video Generation</InternalLink>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>Marketing &amp; Commerce</span>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="text-white/68">Brand Video</span>
            </nav>
            <p className="mt-8 text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-[760px] text-balance text-4xl font-semibold leading-[0.96] tracking-normal text-white sm:text-6xl lg:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref} label={content.hero.primaryCta} site={site} />
              <ActionLink href="/ai-video-generation" label={content.hero.secondaryCta} site={site} variant="secondary" />
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 text-white/50">{content.hero.availabilityNote}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">{content.hero.rightsCopy}</p>
            {content.hero.highlights?.length ? (
              <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-white/62">
                {content.hero.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}
              </div>
            ) : null}
          </div>
          <figure className="relative lg:justify-self-end" data-video-topic-hero-media>
            <div className="relative aspect-[4/5] min-h-[420px] overflow-hidden rounded-[30px] border border-[#c4b5fd]/25 bg-[#17151f] p-3 shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)] sm:min-h-[560px]">
              {heroPreview.map((item, index) => (
                <div
                  className={`absolute overflow-hidden rounded-[24px] border border-white/10 bg-[#292438] ${index === 0 ? "inset-x-[10%] top-[5%] aspect-[4/5]" : index === 1 ? "bottom-[9%] left-[5%] w-[48%] aspect-[3/4]" : "bottom-[16%] right-[5%] w-[43%] aspect-[3/4]"}`}
                  key={item.title}
                >
                  <img
                    src={item.image.src}
                    alt={item.image.alt}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={imageStyle(item.image)}
                    width={item.image.width}
                    height={item.image.height}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : undefined}
                    decoding="async"
                  />
                </div>
              ))}
              <div className="absolute bottom-5 left-5 right-5 rounded-[22px] border border-white/12 bg-[#0d0b13]/78 p-5 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-[#c4b5fd]">Brand story frame</p>
                <p className="mt-3 text-xl font-semibold leading-tight text-white">{"Origin -> Point of view -> Proof -> People -> Promise"}</p>
              </div>
            </div>
            <figcaption className="mt-4 flex items-start gap-3 text-sm leading-6 text-white/60">
              <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#c4b5fd]" strokeWidth={1.8} />
              <span>{content.hero.caption}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {content.quickAnswer ? (
        <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="what-this-creates" data-video-topic-section="what-this-creates">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.quickAnswer.eyebrow} title={content.quickAnswer.title} body={content.quickAnswer.intro} />
            <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
              {content.quickAnswer.cards.map((card) => <SupportingCard card={card} key={card.title} site={site} />)}
            </div>
          </div>
        </section>
      ) : null}

      {storyBeats.length ? (
        <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="brand-story-map" data-video-topic-section="brand-story-map">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.platformExamples?.eyebrow ?? "BRAND STORY MAP"} title={content.platformExamples?.title ?? "Six Story Beats"} body={content.platformExamples?.intro} />
            <ol className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-6" data-brand-video-story-map>
              {storyBeats.map((beat) => (
                <li className="min-w-0 rounded-[22px] border border-white/10 bg-[#17151f] p-5" data-brand-video-beat key={beat.title}>
                  <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{beat.title}</p>
                  <p className="mt-4 text-sm leading-6 text-white/68">{beat.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="brand-signals" data-video-topic-section="brand-signals">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.74fr_1.26fr] lg:items-start lg:gap-16">
          <SectionHeader eyebrow={content.foundation.eyebrow} title={content.foundation.title} body={content.foundation.intro} />
          <div className="grid gap-5 sm:grid-cols-2">
            <DirectionList items={content.foundation.leftItems} title={content.foundation.leftTitle} tone="positive" />
            <DirectionList items={content.foundation.rightItems} title={content.foundation.rightTitle} tone="neutral" />
            <div className="sm:col-span-2 rounded-[22px] border border-[#c4b5fd]/25 bg-[#191525] p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.foundation.expertLabel ?? "Expert tip"}</p>
              <p className="mt-3 max-w-3xl text-base leading-7 text-white/78">{content.foundation.expertTip}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="how-it-works" data-video-topic-section="how-it-works">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.steps.eyebrow} title={content.steps.title} />
          <div className="mt-12 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
            {content.steps.items.map((item, index) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-brand-video-step key={item.title}>
                <span className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">0{index + 1}</span>
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

      {content.gallery ? (
        <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="scene-gallery" data-video-topic-section="scene-gallery">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.gallery.eyebrow} title={content.gallery.title} body={content.gallery.intro} light />
            <div className="mt-12 grid auto-rows-[minmax(16rem,auto)] gap-5 sm:grid-cols-2 lg:grid-cols-4" data-brand-video-gallery>
              {galleryItems.map((item, index) => (
                <article className={`flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#d2c9ef] bg-white/65 ${index === 0 ? "sm:col-span-2 lg:row-span-2" : index === 3 ? "lg:col-span-2" : ""}`} data-brand-video-scene key={item.title}>
                  <div className={`relative overflow-hidden bg-[#d9d1f6] ${index === 0 ? "aspect-[16/10] lg:h-full lg:aspect-auto" : index === 3 ? "aspect-[16/9]" : "aspect-[4/5]"}`}>
                    <img src={item.image.src} alt={item.image.alt} className="absolute inset-0 h-full w-full object-cover" style={imageStyle(item.image)} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg font-semibold leading-tight text-[#191622]">{item.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-[#625e6f]">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="brand-consistency-guide" data-video-topic-section="brand-consistency-guide">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.guidance.eyebrow} title={content.guidance.title} body={content.guidance.intro} />
          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
            {content.guidance.cards.map((card) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-brand-video-guide-card key={card.title}>
                <Sparkles className="h-5 w-5 text-[#c4b5fd]" strokeWidth={1.8} />
                <h3 className="mt-5 text-lg font-semibold leading-tight text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {content.evidence ? (
        <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="product-evidence" data-video-topic-section="product-evidence">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.evidence.eyebrow} title={content.evidence.title} body={content.evidence.intro} light />
            <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-5" data-brand-video-evidence>
              {content.evidence.cards.map((card) => (
                <article className="h-full rounded-[22px] border border-[#d2c9ef] bg-white/55 p-6" key={card.title}>
                  <ShieldCheck className="h-5 w-5 text-[#6652bd]" strokeWidth={1.8} />
                  <h3 className="mt-5 text-lg font-semibold leading-tight text-[#191622]">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#625e6f]">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="workflow" data-video-topic-section="workflow">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16">
          <div>
            <SectionHeader eyebrow={content.value.eyebrow} title={content.value.title} body={content.value.intro} />
            <div className="mt-8">
              <ActionLink href={primaryHref} label={content.finalCta.cta} site={site} />
            </div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#17151f] p-6 sm:p-7" data-brand-video-workspace>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">Workspace review model</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {content.value.items.map((item) => (
                <article className="rounded-[18px] border border-white/10 bg-white/[0.035] p-5" key={item.title}>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="brand-integrity-review" data-video-topic-section="brand-integrity-review">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.trust.eyebrow} title={content.trust.title} body={content.trust.intro} />
          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
            {content.trust.items.map((item) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-brand-video-review-card key={item.title}>
                <Check className="h-5 w-5 text-[#c4b5fd]" strokeWidth={1.8} />
                <h3 className="mt-5 text-lg font-semibold leading-tight text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="faq" data-video-topic-section="faq">
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

      {content.comparison ? (
        <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="related-pages" data-video-topic-section="related-pages">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.comparison.eyebrow} title={content.comparison.title} body={content.comparison.intro} />
            <SectionCards cards={content.comparison.items} site={site} />
          </div>
        </section>
      ) : null}

      <section className="bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" data-video-topic-section="final-cta">
        <div className="mx-auto max-w-[var(--site-content-width)] rounded-[28px] border border-[#c4b5fd]/25 bg-[#191525] px-6 py-12 text-center sm:px-10 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.finalCta.eyebrow}</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold leading-[1.03] tracking-normal text-white sm:text-5xl">{content.finalCta.title}</h2>
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

function SceneTopicLanding({ content, contentKey, section, site }: { content: VideoTopicContent; contentKey: string; section: SectionInstance; site: Site }) {
  const isMusic = contentKey === "music-video";
  const topicLabel = isMusic ? "Music Video" : "Fashion Video";
  const primaryHref = `/app/create?videoMode=${encodeURIComponent(contentKey)}#step-video`;
  const heroImages = content.hero.images?.length ? content.hero.images : [content.hero.image];
  const galleryItems = content.gallery?.items.filter((item): item is VideoTopicSupportingCard & { image: VideoTopicImage } => Boolean(item.image)) ?? [];
  const visualMap = content.platformExamples?.items ?? [];
  const accentClass = isMusic ? "text-fuchsia-300" : "text-pink-300";
  const accentBorder = isMusic ? "border-fuchsia-300/25" : "border-pink-300/25";
  const panelTone = isMusic ? "bg-[#15101f]" : "bg-[#11161d]";
  return (
    <main className="overflow-hidden bg-[#0d0b13] text-white" id={String(section.settings.anchor ?? contentKey)} data-video-topic-page={contentKey}>
      <section className="border-b border-white/10 bg-[#0d0b13]" data-video-topic-section="hero">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-normal text-white/45" aria-label="Breadcrumb">
              <InternalLink className="text-[#c4b5fd] transition hover:text-white" href="/ai-video-generation" site={site}>AI Video Generation</InternalLink>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>Creative &amp; Lifestyle</span>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="text-white/68">{topicLabel}</span>
            </nav>
            <p className={`mt-8 text-xs font-semibold uppercase tracking-normal ${accentClass}`}>{content.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-[760px] text-balance text-4xl font-semibold leading-[0.96] tracking-normal text-white sm:text-6xl lg:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref} label={content.hero.primaryCta} site={site} />
              <ActionLink href="/ai-video-generation" label={content.hero.secondaryCta} site={site} variant="secondary" />
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 text-white/50">{content.hero.availabilityNote}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">{content.hero.rightsCopy}</p>
            {content.hero.highlights?.length ? <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-white/62">{content.hero.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}</div> : null}
          </div>
          <figure className="relative lg:justify-self-end" data-video-topic-hero-media>
            <div className={`relative aspect-[4/3] min-h-[390px] overflow-hidden rounded-[30px] border ${accentBorder} bg-[#17151f] p-3 shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)] sm:min-h-[550px]`}>
              {heroImages.slice(0, 3).map((item, index) => <div className={`absolute overflow-hidden rounded-[24px] border border-white/15 bg-[#292438] ${index === 0 ? "inset-y-[7%] left-[5%] w-[48%]" : index === 1 ? "right-[5%] top-[7%] w-[42%] aspect-[4/5]" : "bottom-[7%] right-[13%] w-[42%] aspect-[4/5]"}`} key={item.src}>
                <img src={item.src} alt={item.alt} className="absolute inset-0 h-full w-full object-cover" style={imageStyle(item)} width={item.width} height={item.height} loading="eager" fetchPriority={index === 0 ? "high" : undefined} decoding="async" />
              </div>)}
              <div className="absolute bottom-5 left-5 right-5 rounded-[22px] border border-white/15 bg-[#0d0b13]/80 p-5 backdrop-blur">
                <p className={`text-[11px] font-semibold uppercase tracking-normal ${accentClass}`}>{isMusic ? "Visual system" : "Fashion system"}</p>
                <p className="mt-3 text-xl font-semibold leading-tight text-white">{isMusic ? "Artist -> Motif -> Motion -> Sequence" : "Garment -> Styling -> Movement -> Continuity"}</p>
              </div>
            </div>
            <figcaption className="mt-4 flex items-start gap-3 text-sm leading-6 text-white/60"><Sparkles className={`mt-1 h-4 w-4 shrink-0 ${accentClass}`} strokeWidth={1.8} /><span>{content.hero.caption}</span></figcaption>
          </figure>
        </div>
      </section>

      {content.quickAnswer ? <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="what-this-creates" data-video-topic-section="what-this-creates"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.quickAnswer.eyebrow} title={content.quickAnswer.title} body={content.quickAnswer.intro} /><div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">{content.quickAnswer.cards.map((card) => <SupportingCard card={card} key={card.title} site={site} />)}</div></div></section> : null}

      {visualMap.length ? <section className={`border-b border-white/10 ${panelTone} px-5 py-16 sm:px-8 sm:py-24`} id="visual-map" data-video-topic-section="visual-map"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.platformExamples?.eyebrow ?? "VISUAL MAP"} title={content.platformExamples?.title ?? "Six Decisions Before You Generate"} body={content.platformExamples?.intro} /><ol className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-6">{visualMap.map((item, index) => <li className="min-w-0 rounded-[22px] border border-white/10 bg-[#17151f] p-5" data-scene-topic-map-item key={item.title}><p className={`text-xs font-semibold uppercase tracking-normal ${accentClass}`}>0{index + 1}</p><h3 className="mt-4 text-lg font-semibold leading-tight text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p></li>)}</ol></div></section> : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="how-it-works" data-video-topic-section="how-it-works"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.steps.eyebrow} title={content.steps.title} /><div className="mt-12 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">{content.steps.items.map((item, index) => <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-scene-topic-step key={item.title}><span className={`text-xs font-semibold uppercase tracking-normal ${accentClass}`}>0{index + 1}</span><h3 className="mt-7 text-xl font-semibold leading-tight text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p></article>)}</div><div className="mt-10"><ActionLink href={primaryHref} label={content.steps.cta} site={site} /></div></div></section>

      {galleryItems.length ? <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="scene-gallery" data-video-topic-section="scene-gallery"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.gallery?.eyebrow ?? "SCENE REFERENCES"} title={content.gallery?.title ?? "Eight Directions for the Next Shot"} body={content.gallery?.intro} light /><div className="mt-12 grid auto-rows-[minmax(16rem,auto)] gap-5 sm:grid-cols-2 lg:grid-cols-4" data-scene-topic-gallery>{galleryItems.map((item, index) => <article className={`flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#d2c9ef] bg-white/65 ${index === 0 ? "sm:col-span-2 lg:row-span-2" : index === 3 ? "lg:col-span-2" : ""}`} data-scene-topic-scene key={item.title}><div className={`relative overflow-hidden bg-[#d9d1f6] ${index === 0 ? "aspect-[16/10] lg:h-full lg:aspect-auto" : index === 3 ? "aspect-[16/9]" : "aspect-[4/5]"}`}><img src={item.image.src} alt={item.image.alt} className="absolute inset-0 h-full w-full object-cover" style={imageStyle(item.image)} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" /></div><div className="flex flex-1 flex-col p-5"><h3 className="text-lg font-semibold leading-tight text-[#191622]">{item.title}</h3><p className="mt-3 flex-1 text-sm leading-6 text-[#625e6f]">{item.body}</p></div></article>)}</div></div></section> : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="sequence-guide" data-video-topic-section="sequence-guide"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.guidance.eyebrow} title={content.guidance.title} body={content.guidance.intro} /><div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">{content.guidance.cards.map((card) => <SupportingCard card={card} key={card.title} site={site} />)}</div></div></section>

      <section className={`border-b border-white/10 ${panelTone} px-5 py-16 sm:px-8 sm:py-24`} id="product-boundary" data-video-topic-section="product-boundary"><div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.74fr_1.26fr] lg:items-start lg:gap-16"><SectionHeader eyebrow={content.foundation.eyebrow} title={content.foundation.title} body={content.foundation.intro} /><div className="grid gap-5 sm:grid-cols-2"><DirectionList items={content.foundation.leftItems} title={content.foundation.leftTitle} tone="positive" /><DirectionList items={content.foundation.rightItems} title={content.foundation.rightTitle} tone={content.foundation.rightTone === "neutral" ? "neutral" : "avoid"} /><div className="sm:col-span-2 rounded-[22px] border border-white/10 bg-[#191525] p-6 sm:p-7"><p className={`text-xs font-semibold uppercase tracking-normal ${accentClass}`}>{content.foundation.expertLabel ?? "Expert tip"}</p><p className="mt-3 max-w-3xl text-base leading-7 text-white/78">{content.foundation.expertTip}</p></div></div></div></section>

      {content.evidence ? <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="product-evidence" data-video-topic-section="product-evidence"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.evidence.eyebrow} title={content.evidence.title} body={content.evidence.intro} light /><SectionCards cards={content.evidence.cards} light site={site} /></div></section> : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="workflow" data-video-topic-section="workflow"><div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-16"><div><SectionHeader eyebrow={content.value.eyebrow} title={content.value.title} body={content.value.intro} /><div className="mt-8"><ActionLink href={primaryHref} label={content.finalCta.cta} site={site} /></div></div><div className="grid gap-4 sm:grid-cols-2">{content.value.items.map((item) => <article className="rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-scene-topic-workflow key={item.title}><Sparkles className={`h-5 w-5 ${accentClass}`} strokeWidth={1.8} /><h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p></article>)}</div></div></section>

      <section className="border-b border-white/10 bg-[#191525] px-5 py-16 sm:px-8 sm:py-24" id="integrity-review" data-video-topic-section="integrity-review"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.trust.eyebrow} title={content.trust.title} body={content.trust.intro} /><div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">{content.trust.items.map((item) => <article className="h-full rounded-[22px] border border-white/10 bg-white/[0.045] p-6" data-scene-topic-review-card key={item.title}><ShieldCheck className={`h-5 w-5 ${accentClass}`} strokeWidth={1.8} /><h3 className="mt-5 text-lg font-semibold leading-tight text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p></article>)}</div></div></section>

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="faq" data-video-topic-section="faq"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.faq.eyebrow} title={content.faq.title} light /><div className="mt-10 grid gap-4 lg:grid-cols-2">{content.faq.items.map((item) => <details className="group rounded-[20px] border border-[#d2c9ef] bg-white/55 p-5 open:bg-white/80" key={item.question}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-[#191622]"><span>{item.question}</span><ChevronRight className="h-5 w-5 shrink-0 text-[#6652bd] transition group-open:rotate-90" strokeWidth={1.8} /></summary><p className="mt-4 max-w-2xl text-sm leading-6 text-[#625e6f]">{item.answer}</p></details>)}</div></div></section>
      {content.comparison ? <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="related-pages" data-video-topic-section="related-pages"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.comparison.eyebrow} title={content.comparison.title} body={content.comparison.intro} /><SectionCards cards={content.comparison.items} site={site} /></div></section> : null}
      <section className="bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" data-video-topic-section="final-cta"><div className="mx-auto max-w-[var(--site-content-width)] rounded-[28px] border border-[#c4b5fd]/25 bg-[#191525] px-6 py-12 text-center sm:px-10 sm:py-16"><p className={`text-xs font-semibold uppercase tracking-normal ${accentClass}`}>{content.finalCta.eyebrow}</p><h2 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold leading-[1.03] tracking-normal text-white sm:text-5xl">{content.finalCta.title}</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/68">{content.finalCta.body}</p><div className="mt-8 flex justify-center"><ActionLink href={primaryHref} label={content.finalCta.cta} site={site} /></div><p className="mt-5 text-xs leading-5 text-white/48">{content.finalCta.microcopy}</p></div></section>
    </main>
  );
}

function VideoTopicLanding({ content, contentKey, section, site }: { content: VideoTopicContent; contentKey: string; section: SectionInstance; site: Site }) {
  if (contentKey === "video-ad") {
    return <VideoAdTopicLanding content={content} section={section} site={site} />;
  }
  if (contentKey === "brand-video") {
    return <BrandVideoTopicLanding content={content} section={section} site={site} />;
  }
  if (contentKey === "music-video" || contentKey === "fashion-video") {
    return <SceneTopicLanding content={content} contentKey={contentKey} section={section} site={site} />;
  }
  if (contentKey === "ugc-ad-video") {
    return <UgcVideoTopicLanding content={content} section={section} site={site} />;
  }
  if (contentKey === "promo-video") {
    return <PromoVideoTopicLanding content={content} section={section} site={site} />;
  }
  const primaryHref = `/app/create?videoMode=${encodeURIComponent(contentKey)}#step-video`;
  return (
    <main className="overflow-hidden bg-[#0d0b13] text-white" id={String(section.settings.anchor ?? contentKey)} data-video-topic-page={contentKey}>
      <section className="relative border-b border-white/10 bg-[#0d0b13]" data-video-topic-section="hero">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-[720px] text-balance text-4xl font-semibold leading-[0.96] tracking-normal text-white sm:text-6xl lg:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref} label={content.hero.primaryCta} site={site} />
              <ActionLink href="#use-cases" label={content.hero.secondaryCta} site={site} variant="secondary" />
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 text-white/50">{content.hero.availabilityNote}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">{content.hero.rightsCopy}</p>
            {content.hero.highlights?.length ? (
              <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-white/62">
                {content.hero.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}
              </div>
            ) : null}
          </div>
          <figure className="relative lg:justify-self-end">
            <div className="overflow-hidden rounded-[28px] border border-[#c4b5fd]/25 bg-[#221d30] p-2 shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[21px]" data-video-topic-hero-media>
                <img
                  src={content.hero.image.src}
                  alt={content.hero.image.alt}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={imageStyle(content.hero.image)}
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
              <span>{content.hero.caption}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {content.quickAnswer ? (
        <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="quick-answer" data-video-topic-section="quick-answer">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.quickAnswer.eyebrow} title={content.quickAnswer.title} body={content.quickAnswer.intro} />
            <SectionCards cards={content.quickAnswer.cards} site={site} />
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="use-cases" data-video-topic-section="use-cases">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.useCases.eyebrow} title={content.useCases.title} body={content.useCases.intro} />
          <div className="mt-12 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
            {content.useCases.items.map((item, index) => <UseCaseCard index={index} item={item} key={item.title} />)}
          </div>
        </div>
      </section>

      {content.evidence ? (
        <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="evidence" data-video-topic-section="evidence">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.evidence.eyebrow} title={content.evidence.title} body={content.evidence.intro} light />
            <SectionCards cards={content.evidence.cards} light site={site} />
          </div>
        </section>
      ) : null}

      {content.examples ? (
        <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="examples" data-video-topic-section="examples">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader eyebrow={content.examples.eyebrow} title={content.examples.title} body={content.examples.intro} />
            <SectionCards cards={content.examples.cards} site={site} />
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="foundation" data-video-topic-section="foundation">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-16">
          <SectionHeader eyebrow={content.foundation.eyebrow} title={content.foundation.title} body={content.foundation.intro} />
          {content.foundation.cards?.length ? (
            <div>
              <SectionCards cards={content.foundation.cards} site={site} />
              <div className="mt-5 rounded-[22px] border border-[#c4b5fd]/25 bg-[#191525] p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.foundation.expertLabel ?? "Expert tip"}</p>
                <p className="mt-3 max-w-3xl text-base leading-7 text-white/78">{content.foundation.expertTip}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <DirectionList items={content.foundation.leftItems} title={content.foundation.leftTitle} tone="positive" />
              <DirectionList items={content.foundation.rightItems} title={content.foundation.rightTitle} tone={content.foundation.rightTone === "neutral" ? "neutral" : "avoid"} />
              <div className="sm:col-span-2 rounded-[22px] border border-[#c4b5fd]/25 bg-[#191525] p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.foundation.expertLabel ?? "Expert tip"}</p>
                <p className="mt-3 max-w-3xl text-base leading-7 text-white/78">{content.foundation.expertTip}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="guidance" data-video-topic-section="guidance">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.guidance.eyebrow} title={content.guidance.title} body={content.guidance.intro} light />
          <SectionCards cards={content.guidance.cards} light site={site} />
        </div>
      </section>

      {content.supportingGroups.length ? (
        <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="supporting" data-video-topic-section="supporting">
          <div className="mx-auto max-w-[var(--site-content-width)]">
            <SectionHeader
              eyebrow="ADDITIONAL VIDEO GUIDANCE"
              title="Keep the video job clear from the first frame to the final cut"
              body="Use the supporting notes below when the same creative idea needs a more specific platform, buyer, or campaign decision."
            />
            <div className="mt-12 space-y-16">
              {content.supportingGroups.map((group) => (
                <div key={group.title}>
                  <p className="text-xs font-semibold uppercase tracking-normal text-[#b8a7ff]">{group.eyebrow}</p>
                  <h3 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight text-white sm:text-3xl">{group.title}</h3>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-white/68">{group.intro}</p>
                  <SectionCards cards={group.items} site={site} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="how-it-works" data-video-topic-section="steps">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.steps.eyebrow} title={content.steps.title} />
          <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-4">
            {content.steps.items.map((item, index) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" key={item.title}>
                <span className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">0{index + 1}</span>
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

      <ValueSection section={content.value} />

      <section className="border-b border-white/10 bg-[#191525] px-5 py-16 sm:px-8 sm:py-24" id="trust" data-video-topic-section="trust">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <SectionHeader eyebrow={content.trust.eyebrow} title={content.trust.title} body={content.trust.intro} />
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              {content.trust.items.map((item) => (
                <article className="h-full rounded-[22px] border border-white/10 bg-white/[0.045] p-6" key={item.title}>
                  <ShieldCheck className="h-5 w-5 text-[#c4b5fd]" strokeWidth={1.8} />
                  <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="faq" data-video-topic-section="faq">
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

      <section className="bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" data-video-topic-section="final-cta">
        <div className="mx-auto max-w-[var(--site-content-width)] rounded-[28px] border border-[#c4b5fd]/25 bg-[#191525] px-6 py-12 text-center sm:px-10 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.finalCta.eyebrow}</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold leading-[1.03] tracking-normal text-white sm:text-5xl">{content.finalCta.title}</h2>
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

export function AiVideoTopicLanding({ section, site }: { section: SectionInstance; site: Site }) {
  const contentKey = String(section.settings.contentKey ?? section.settings.anchor ?? "").trim();
  const content = aiVideoTopicLandingContentByKey[contentKey];
  if (!content) notFound();
  return <VideoTopicLanding content={normalizeAiContent(content)} contentKey={contentKey} section={section} site={site} />;
}

export function TalkingPhotoLanding({ section, site }: { section: SectionInstance; site: Site }) {
  return <VideoTopicLanding content={normalizeTalkingContent(talkingPhotoContent)} contentKey="talking-photo" section={section} site={site} />;
}
