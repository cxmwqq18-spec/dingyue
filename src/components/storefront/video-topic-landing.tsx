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
  };
  useCases: {
    eyebrow: string;
    title: string;
    intro: string;
    items: VideoTopicUseCase[];
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
  };
  guidance: {
    eyebrow: string;
    title: string;
    intro?: string;
    cards: VideoTopicSupportingCard[];
  };
  supportingGroups: Array<{
    eyebrow: string;
    title: string;
    intro: string;
    items: VideoTopicSupportingCard[];
  }>;
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
      <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${light ? "text-[#6652bd]" : "text-[#b8a7ff]"}`}>{eyebrow}</p>
      <h2 className={`mt-4 text-balance text-3xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-5xl ${light ? "text-[#191622]" : "text-white"}`}>{title}</h2>
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
          loading="lazy"
          decoding="async"
        />
        <span className="absolute left-4 top-4 rounded-full border border-white/25 bg-[#17151f]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="flex min-h-[22rem] flex-1 flex-col p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#b8a7ff]">{label}</p>
        {item.problem ? <p className="mt-3 min-h-[4.5rem] text-sm leading-6 text-white/65">{item.problem}</p> : null}
        <h3 className={`${item.problem ? "mt-6" : "mt-3"} min-h-[3.5rem] text-xl font-semibold leading-tight text-white`}>{item.title}</h3>
        <p className="mt-3 flex-1 text-sm leading-6 text-white/68">{item.body}</p>
        {noteLabel && noteBody ? (
          <div className="mt-5 min-h-[6.5rem] rounded-2xl border border-[#c4b5fd]/20 bg-[#c4b5fd]/[0.07] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#c4b5fd]">{noteLabel}</p>
            <p className="mt-2 text-sm leading-6 text-white/82">{noteBody}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SupportingCard({ card, light = false }: { card: VideoTopicSupportingCard; light?: boolean }) {
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
          <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${light ? "text-[#6652bd]" : "text-[#b8a7ff]"}`}>{card.exampleLabel}</p>
          <p className={`mt-2 text-sm leading-6 ${light ? "text-[#3f3b4c]" : "text-white/82"}`}>{card.exampleBody}</p>
        </div>
      ) : null}
    </article>
  );
}

function SectionCards({ cards, light = false }: { cards: VideoTopicSupportingCard[]; light?: boolean }) {
  return (
    <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3" data-video-topic-supporting-cards>
      {cards.map((card) => <SupportingCard card={card} key={card.title} light={light} />)}
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

function ValueSection({ section }: { section: VideoTopicContent["value"] }) {
  return (
    <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="value" data-video-topic-section="value">
      <div className="mx-auto max-w-[var(--site-content-width)]">
        <SectionHeader eyebrow={section.eyebrow} title={section.title} body={section.intro} />
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
            <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6 sm:p-7" key={item.title}>
              <Sparkles className="h-5 w-5 text-[#c4b5fd]" strokeWidth={1.8} />
              <h3 className="mt-5 text-xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
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
      image: content.hero.image
    },
    useCases: {
      ...content.useCases,
      items: content.useCases.items.map((item) => ({ ...item }))
    },
    foundation: content.foundation,
    guidance: content.guidance,
    supportingGroups,
    steps: content.steps,
    value: content.value,
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

function VideoTopicLanding({ content, contentKey, section, site }: { content: VideoTopicContent; contentKey: string; section: SectionInstance; site: Site }) {
  const primaryHref = `/app/create?videoMode=${encodeURIComponent(contentKey)}#step-video`;
  const productAdVideo = contentKey === "product-ad-video";
  return (
    <main className="overflow-hidden bg-[#0d0b13] text-white" id={String(section.settings.anchor ?? contentKey)} data-video-topic-page={contentKey}>
      <section className="relative border-b border-white/10 bg-[#0d0b13]" data-video-topic-section="hero">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c4b5fd]">{content.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-[720px] text-balance text-4xl font-semibold leading-[0.96] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref} label={content.hero.primaryCta} site={site} />
              <ActionLink href="#use-cases" label={content.hero.secondaryCta} site={site} variant="secondary" />
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 text-white/50">{content.hero.availabilityNote}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">{content.hero.rightsCopy}</p>
          </div>
          <figure className="relative lg:justify-self-end">
            <div className="overflow-hidden rounded-[28px] border border-[#c4b5fd]/25 bg-[#221d30] p-2 shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[21px]">
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

      <section className="border-b border-white/10 bg-[#12101a] px-5 py-16 sm:px-8 sm:py-24" id="use-cases" data-video-topic-section="use-cases">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.useCases.eyebrow} title={content.useCases.title} body={content.useCases.intro} />
          <div className="mt-12 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
            {content.useCases.items.map((item, index) => <UseCaseCard index={index} item={item} key={item.title} />)}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="foundation" data-video-topic-section="foundation">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-16">
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

      <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="guidance" data-video-topic-section="guidance">
        <div className="mx-auto max-w-[var(--site-content-width)]">
          <SectionHeader eyebrow={content.guidance.eyebrow} title={content.guidance.title} body={content.guidance.intro} light />
          <SectionCards cards={content.guidance.cards} light />
        </div>
      </section>

      {productAdVideo ? <ValueSection section={content.value} /> : null}

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
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b8a7ff]">{group.eyebrow}</p>
                  <h3 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight text-white sm:text-3xl">{group.title}</h3>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-white/68">{group.intro}</p>
                  <SectionCards cards={group.items} />
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

      {!productAdVideo ? <ValueSection section={content.value} /> : null}

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

export function AiVideoTopicLanding({ section, site }: { section: SectionInstance; site: Site }) {
  const contentKey = String(section.settings.contentKey ?? section.settings.anchor ?? "").trim();
  const content = aiVideoTopicLandingContentByKey[contentKey];
  if (!content) notFound();
  return <VideoTopicLanding content={normalizeAiContent(content)} contentKey={contentKey} section={section} site={site} />;
}

export function TalkingPhotoLanding({ section, site }: { section: SectionInstance; site: Site }) {
  return <VideoTopicLanding content={normalizeTalkingContent(talkingPhotoContent)} contentKey="talking-photo" section={section} site={site} />;
}
