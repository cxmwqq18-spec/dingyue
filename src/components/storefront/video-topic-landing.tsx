import { ArrowRight, Check, ChevronRight, ShieldCheck, Sparkles, X } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { SectionInstance, Site } from "@/lib/types";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { DreamshootShowcasePreviewClient as DreamshootShowcasePreview } from "@/components/storefront/dreamshoot-showcase-preview-client";
import { hostAwareSitePath } from "@/lib/domain-routing";
import { aiVideoTopicLandingContentFromSection, type AiVideoTopicLandingContent } from "@/lib/ai-video-topic-content";
import { talkingPhotoContentFromSection, type TalkingPhotoContent } from "@/lib/talking-photo-content";

type RoutedSite = Site & { __storefrontBasePath?: string };

const defaultObjectPosition = "50% 38%";
// Generated topic-media files use a 4:3 canvas with a 16:9 scene and
// letterbox bars baked into the pixels. Keep the source dimensions accurate;
// embedded media uses a 16:9 cover frame to remove those bars without scaling
// distortion.
const talkingPhotoImageSize = { width: 1600, height: 1200 };

type VideoTopicImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  objectPosition?: string;
};

type VideoTopicVideo = {
  src: string;
  poster: string;
  label: string;
  width: number;
  height: number;
  fit: "cover" | "contain";
};

type VideoTopicUseCase = {
  title: string;
  problem?: string;
  body: string;
  script?: string;
  noteLabel?: string;
  noteBody?: string;
  scenarioLabel?: string;
  image?: VideoTopicImage;
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
    video?: VideoTopicVideo;
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
  return { objectPosition: image.height / image.width > 1.3 ? "50% 50%" : defaultObjectPosition };
}

/** Keep media frames aligned with the real asset or its embedded scene crop. */
function intrinsicAspectRatio(image: VideoTopicImage): string {
  const width = Number(image.width);
  const height = Number(image.height);
  return width > 0 && height > 0 ? `${width} / ${height}` : "16 / 9";
}

function hasEmbeddedVideoLetterbox(image: VideoTopicImage): boolean {
  return image.src.includes("/assets/dreamshoot/generated/video-topic-media/") || image.src.includes("/assets/dreamshoot/generated/video-topic-clean/");
}

function mediaAspectRatio(image: VideoTopicImage): string {
  return hasEmbeddedVideoLetterbox(image) ? "16 / 9" : intrinsicAspectRatio(image);
}

function cardMediaAspectRatio(image: VideoTopicImage): string {
  const ratio = image.width > 0 ? image.height / image.width : 1;
  return ratio > 1.15 ? "4 / 3" : mediaAspectRatio(image);
}

function mediaObjectFit(image: VideoTopicImage): "object-cover" | "object-contain" {
  // Detail-page media should fill its frame. Containment exposes baked-in
  // letterbox/blurred background pixels on portrait source assets.
  return "object-cover";
}

function optimizedTopicImageSrc(src: string): string {
  if (!src.startsWith("/assets/dreamshoot/")) return src;
  const youtubeMap: Record<string, string> = {
    "youtube-card-01": "youtube-card-01",
    "youtube-card-02": "youtube-card-02",
    "youtube-card-03": "youtube-card-03",
    "youtube-card-04": "youtube-card-04",
    "youtube-card-05": "youtube-card-05",
    "youtube-card-06": "youtube-card-06",
    "youtube-video-full-tutorial": "youtube-video-03",
    "youtube-video-review-comparison": "youtube-video-05",
    "youtube-video-interview-conversation": "youtube-video-04",
    "youtube-video-case-study": "youtube-video-01",
    "youtube-video-webinar-recap": "youtube-video-07",
    "youtube-video-series-episode": "youtube-video-06"
  };
  const cleanYoutube = src.match(/^\/assets\/dreamshoot\/youtube-video\/(youtube-video-[^./?#]+)\.(?:png|webp)(?:[?#].*)?$/i);
  if (cleanYoutube && youtubeMap[cleanYoutube[1]]) return `/assets/dreamshoot/generated/video-topic-clean/youtube-video/${youtubeMap[cleanYoutube[1]]}.webp`;
  return src.replace(/\.png(?=[?#]|$)/i, ".webp");
}

function heroPreviewImages(content: Pick<VideoTopicContent, "hero">): VideoTopicImage[] {
  const seen = new Set<string>();
  return [content.hero.image, ...(content.hero.images ?? [])]
    .filter((image) => {
      if (!image?.src || seen.has(image.src)) return false;
      seen.add(image.src);
      return true;
    })
    .slice(0, 3);
}

function sceneHeroPreviewImages(content: VideoTopicContent, contentKey: string): VideoTopicImage[] {
  const images = heroPreviewImages(content);
  if (contentKey === "pet-video") {
    const portrait = images.find((image) => image.src.includes("hero-pet-video-portrait-frame"));
    const training = images.find((image) => image.src.includes("hero-pet-video-training-frame"));
    const owner = images.find((image) => image.src.includes("hero-pet-video-owner-frame"));
    if (portrait && training && owner) return [portrait, training, owner];
  }
  if (contentKey === "music-video" && images.length >= 2) {
    return [images[0], { src: "/assets/dreamshoot/music-video/hero-music-video-performance.jpg", alt: "Female vocalist singing into a studio microphone under red and blue cinematic lighting, used as the dedicated hero performance frame.", width: 1800, height: 1200, objectPosition: "50% 42%" }, ...images.slice(2)];
  }
  return images;
}

function isPortraitVideo(video?: VideoTopicVideo): boolean {
  return Boolean(video && video.height > video.width);
}

function heroMediaSizingClass(video?: VideoTopicVideo): string {
  return isPortraitVideo(video) ? "w-full max-w-full md:w-fit" : "w-full";
}

function TopicHeroVideo({ video }: { video: VideoTopicVideo }) {
  return (
    <DreamshootShowcasePreview className="h-full">
      <div
        aria-label={`Open ${video.label}`}
        className="group relative h-full w-full cursor-pointer overflow-hidden bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd] focus-visible:ring-inset"
        data-dreamshoot-preview-poster={video.poster}
        data-dreamshoot-preview-src={video.src}
        data-dreamshoot-preview-title={video.label}
        data-dreamshoot-showcase-preview="video"
        role="button"
        tabIndex={0}
      >
        <video
          aria-label={video.label}
          autoPlay
          className={`absolute inset-0 h-full w-full ${video.fit === "contain" ? "object-contain" : "object-cover"}`}
          height={video.height}
          loop
          muted
          playsInline
          poster={video.poster}
          preload="auto"
          src={video.src}
          width={video.width}
        />
        <span aria-hidden="true" className="absolute inset-0 bg-black/0 transition group-hover:bg-black/[0.08]" />
      </div>
    </DreamshootShowcasePreview>
  );
}

function DirectTopicHeroCards({ images, video, cropPetHero = false, containSecondaryImages = false, leadAspectRatio }: { images: VideoTopicImage[]; video?: VideoTopicVideo; cropPetHero?: boolean; containSecondaryImages?: boolean; leadAspectRatio?: string }) {
  const cards = images.slice(0, 3);
  const hasThreeCards = cards.length >= 3;
  return (
    <div
      className="grid gap-2 bg-[#17151f] p-2"
      style={{ gridTemplateColumns: cards.length > 1 ? "repeat(2, minmax(0, 1fr))" : "1fr" }}
      data-video-topic-hero-collage={hasThreeCards ? "stacked" : cards.length === 2 ? "split" : "single"}
    >
      {cards.map((item, index) => {
        const shouldContainImage = containSecondaryImages && hasThreeCards && index > 0;
        return (
        <div
          className="relative min-w-0 overflow-hidden rounded-[6px] bg-[#292438]"
          key={item.src}
          style={{
            ...(hasThreeCards && index === 0 ? { gridColumn: "1 / -1" } : {}),
            // Keep the lead frame prominent while preserving two compact side-by-side previews below.
            aspectRatio: shouldContainImage ? intrinsicAspectRatio(item) : video && index === 0 ? `${video.width} / ${video.height}` : index === 0 && leadAspectRatio ? leadAspectRatio : "16 / 9"
          }}
          {...(hasThreeCards && index === 0 && !video
            ? {
                "data-dreamshoot-showcase-preview": "image",
                "data-dreamshoot-preview-src": optimizedTopicImageSrc(item.src),
                "data-dreamshoot-preview-title": item.alt,
                "aria-label": `View ${item.alt} full image`,
                role: "button",
                tabIndex: 0
              }
            : {})}
        >
          {video && index === 0 ? <TopicHeroVideo video={video} /> : <img
              src={optimizedTopicImageSrc(item.src)}
              alt={item.alt}
              className={`absolute ${hasThreeCards && index === 0 && hasEmbeddedVideoLetterbox(item) ? "top-0 left-1/2 h-auto max-w-none" : "inset-0 h-full w-full"} ${shouldContainImage ? "object-contain object-center" : hasThreeCards && index === 0 && !hasEmbeddedVideoLetterbox(item) ? "object-cover object-top" : hasThreeCards ? "object-cover object-center" : `${mediaObjectFit(item)} object-center`}`}
              style={
                hasThreeCards && index === 0 && hasEmbeddedVideoLetterbox(item)
                  ? { width: "200%", transform: cropPetHero ? "translate(-50%, -18%)" : "translateX(-50%)", objectPosition: cropPetHero ? "50% 50%" : "50% 0%" }
                  : hasThreeCards && index === 0
                    ? { objectPosition: "50% 0%" }
                    : imageStyle(item)
              }
              width={item.width}
              height={item.height}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : undefined}
              decoding="async"
            />}
        </div>
        );
      })}
    </div>
  );
}

function TopicHeroMedia({ images, video, cropPetHero = false, displayAspectRatio, containSecondaryImages = false, leadAspectRatio }: { images: VideoTopicImage[]; video?: VideoTopicVideo; cropPetHero?: boolean; displayAspectRatio?: string; containSecondaryImages?: boolean; leadAspectRatio?: string }) {
  if (video && images.length < 3) {
    const portraitSizing = isPortraitVideo(video);
    // Some landscape exports are delivered on a 4:3 canvas with 16:9 content
    // letterboxed into the pixels. A 16:9 viewport lets object-cover crop those
    // baked-in bars while keeping the actual video frame undistorted.
    const videoAspectRatio = displayAspectRatio ?? (portraitSizing ? `${video.width} / ${video.height}` : "16 / 9");
    return (
      <div className={`mx-auto max-w-full ${portraitSizing ? "h-auto max-h-full w-auto md:h-[min(78vh,54rem)]" : "w-full"}`} style={{ aspectRatio: videoAspectRatio }}>
        <TopicHeroVideo video={video} />
      </div>
    );
  }
  return <DirectTopicHeroCards images={images} video={video} cropPetHero={cropPetHero} containSecondaryImages={containSecondaryImages} leadAspectRatio={leadAspectRatio} />;
}

function UseCaseCard({ item, index }: { item: VideoTopicUseCase; index: number }) {
  const label = item.scenarioLabel ?? "Customer problem";
  const noteLabel = item.noteLabel ?? (item.script ? "Example script" : undefined);
  const noteBody = item.noteBody ?? (item.script ? `“${item.script}”` : undefined);
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#17151f] shadow-[0_28px_70px_-54px_rgba(0,0,0,0.92)]" data-video-topic-use-case-card>
      {item.image ? (
        <div className="relative overflow-hidden bg-[#292438]" data-video-topic-media style={{ aspectRatio: cardMediaAspectRatio(item.image) }}>
          <img
            src={optimizedTopicImageSrc(item.image.src)}
            alt={item.image.alt}
            className={`absolute inset-0 h-full w-full ${mediaObjectFit(item.image)} object-center`}
            style={{ objectPosition: "50% 50%" }}
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
      ) : null}
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-normal text-[#b8a7ff]">{label}</p>
        {item.problem ? <p className="mt-3 text-sm leading-6 text-white/65">{item.problem}</p> : null}
        <h3 className={`${item.problem ? "mt-6" : "mt-3"} text-xl font-semibold leading-tight text-white`}>{item.title}</h3>
        <p className="mt-3 text-sm leading-6 text-white/68">{item.body}</p>
        {noteLabel && noteBody ? (
          <div className="mt-5 rounded-2xl border border-[#c4b5fd]/20 bg-[#c4b5fd]/[0.07] p-4">
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
        <div className="relative mb-6 overflow-hidden rounded-[16px] bg-[#292438]" style={{ aspectRatio: cardMediaAspectRatio(card.image) }}>
          <img
            src={optimizedTopicImageSrc(card.image.src)}
            alt={card.image.alt}
            className={`h-full w-full ${mediaObjectFit(card.image)} object-center`}
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
          {card.details.map((detail, index) => (
            <div className="grid grid-cols-[4.5rem_1fr] gap-3" key={`${detail.label}-${index}`}>
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
      {cards.map((card, index) => <SupportingCard card={card} key={`${card.title}-${index}`} light={light} site={site} />)}
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
        {items.map((item, index) => (
          <li className="flex items-start gap-3 text-sm leading-6 text-white/72" key={`${item}-${index}`}>
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
          <figure className="relative mt-12 overflow-hidden rounded-[22px] border border-white/10 bg-[#17151f]" style={{ aspectRatio: mediaAspectRatio(section.image) }}>
            <img
              src={optimizedTopicImageSrc(section.image.src)}
              alt={section.image.alt}
              className={`absolute inset-0 h-full w-full ${mediaObjectFit(section.image)} object-center`}
              style={imageStyle(section.image)}
              width={section.image.width}
              height={section.image.height}
              loading="lazy"
              decoding="async"
            />
          </figure>
        ) : null}
        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2">
          {section.items.map((item, index) => (
            <article className={`h-full rounded-[22px] p-6 sm:p-7 ${light ? "border border-[#d2c9ef] bg-white/55" : "border border-white/10 bg-[#17151f]"}`} key={`${item.title}-${index}`}>
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
            <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.hero.eyebrow}</p>
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
          <figure className="relative min-w-0 w-full lg:justify-self-end" data-video-topic-hero-media>
            <div className="relative w-full overflow-hidden rounded-[8px] border border-[#c4b5fd]/25 bg-[#17151f] shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]">
              <DirectTopicHeroCards images={heroPreview.map((item) => item.image)} />
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
              {content.quickAnswer.cards.map((card, index) => <SupportingCard card={card} key={`${card.title}-${index}`} site={site} />)}
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
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-video-ad-step key={`${item.title}-${index}`}>
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
              {galleryItems.map((item, index) => (
                <article className="flex h-full flex-col overflow-hidden rounded-[22px] border border-[#d2c9ef] bg-white/65" data-video-ad-scene key={`${item.title}-${index}`}>
                  <div className="relative overflow-hidden bg-[#d9d1f6]" style={{ aspectRatio: mediaAspectRatio(item.image) }}>
                    <img src={optimizedTopicImageSrc(item.image.src)} alt={item.image.alt} className={`absolute inset-0 h-full w-full ${mediaObjectFit(item.image)} object-center`} style={imageStyle(item.image)} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
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
            {content.guidance.cards.map((card, index) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-video-ad-guide-card key={`${card.title}-${index}`}>
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
              {content.value.items.map((item, index) => (
                <article className="rounded-[18px] border border-[#d2c9ef] bg-[#f7f4ff] p-5" key={`${item.title}-${index}`}>
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
              {content.comparison.items.map((card, index) => <SupportingCard card={card} key={`${card.title}-${index}`} light site={site} />)}
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
          <figure className="relative min-w-0 w-full lg:justify-self-end">
            <div className="overflow-hidden rounded-[28px] border border-[#c4b5fd]/25 bg-[#221d30] p-2 shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]">
              <div className="relative aspect-video overflow-hidden rounded-[21px]" data-video-topic-hero-media>
                <img
                  src={optimizedTopicImageSrc(content.hero.image.src)}
                  alt={content.hero.image.alt}
                  className={`absolute inset-0 h-full w-full ${mediaObjectFit(content.hero.image)} object-center`}
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
            {content.useCases.items.map((item, index) => <UseCaseCard index={index} item={item} key={`${item.title}-${index}`} />)}
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
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" key={`${item.title}-${index}`}>
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
              {content.trust.items.map((item, index) => (
                <article className="h-full rounded-[22px] border border-white/10 bg-white/[0.045] p-6" key={`${item.title}-${index}`}>
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
          <figure className="relative min-w-0 w-full lg:justify-self-end">
            <div className="overflow-hidden rounded-[28px] border border-[#c4b5fd]/25 bg-[#221d30] p-2 shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]">
              <div className="relative aspect-video overflow-hidden rounded-[21px]" data-video-topic-hero-media>
                <img
                  src={content.hero.image.src}
                  alt={content.hero.image.alt}
                  className={`absolute inset-0 h-full w-full ${mediaObjectFit(content.hero.image)} object-center`}
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
            {content.useCases.items.map((item, index) => <UseCaseCard index={index} item={item} key={`${item.title}-${index}`} />)}
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
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" key={`${item.title}-${index}`}>
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
              {content.trust.items.map((item, index) => (
                <article className="h-full rounded-[22px] border border-white/10 bg-white/[0.045] p-6" key={`${item.title}-${index}`}>
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
      video: content.hero.video,
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
            <p className="text-xs font-semibold uppercase tracking-normal text-[#c4b5fd]">{content.hero.eyebrow}</p>
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
          <figure className="relative min-w-0 w-full lg:justify-self-end" data-video-topic-hero-media>
            <div className="relative w-full overflow-hidden rounded-[8px] border border-[#c4b5fd]/25 bg-[#17151f] shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]">
              <DirectTopicHeroCards images={heroPreview.map((item) => item.image)} />
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
              {content.quickAnswer.cards.map((card, index) => <SupportingCard card={card} key={`${card.title}-${index}`} site={site} />)}
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
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-brand-video-step key={`${item.title}-${index}`}>
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
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-brand-video-gallery>
              {galleryItems.map((item, index) => (
                <article className="flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#d2c9ef] bg-white/70 shadow-[0_10px_28px_-20px_rgba(42,33,78,0.45)]" data-brand-video-scene key={`${item.title}-${index}`}>
                  <div className="relative h-44 overflow-hidden bg-[#d9d1f6] sm:h-48" style={{ aspectRatio: "16 / 10" }}>
                    <img src={optimizedTopicImageSrc(item.image.src)} alt={item.image.alt} className="absolute inset-0 h-full w-full object-cover object-center" style={imageStyle(item.image)} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
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
            {content.guidance.cards.map((card, index) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-brand-video-guide-card key={`${card.title}-${index}`}>
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
              {content.evidence.cards.map((card, index) => (
                <article className="h-full rounded-[22px] border border-[#d2c9ef] bg-white/55 p-6" key={`${card.title}-${index}`}>
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
              {content.value.items.map((item, index) => (
                <article className="rounded-[18px] border border-white/10 bg-white/[0.035] p-5" key={`${item.title}-${index}`}>
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
            {content.trust.items.map((item, index) => (
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-brand-video-review-card key={`${item.title}-${index}`}>
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
  const isFashion = contentKey === "fashion-video";
  const isPet = contentKey === "pet-video";
  const topicLabel = isMusic ? "Music Video" : isFashion ? "Fashion Video" : isPet ? "Pet Video" : "Food Video";
  const heroVideo = isMusic ? content.hero.video : undefined;
  const primaryHref = `/app/create?videoMode=${encodeURIComponent(contentKey)}#step-video`;
  const heroLeadAspectRatio = isFashion ? "4 / 3" : undefined;
  // Music Video has a dedicated motion asset for the hero. Keep the two
  // supporting stills in the gallery below, but let the hero stay focused on
  // the single playable video.
  const heroImages = isMusic && heroVideo ? [] : sceneHeroPreviewImages(content, contentKey);
  const galleryItems = content.gallery?.items.filter((item): item is VideoTopicSupportingCard & { image: VideoTopicImage } => Boolean(item.image)) ?? [];
  const petHeroExtras = isPet ? (content.hero.images?.slice(1) ?? []).map((image, index) => ({
    title: index === 0 ? "Owner and pet portrait" : "Pet portrait frame",
    body: "Additional approved reference kept with the scene list for continuity review.",
    image
  })) : [];
  const sceneGalleryItems = [...galleryItems, ...petHeroExtras];
  const visualMap = content.platformExamples?.items ?? [];
  const accentClass = isMusic ? "text-fuchsia-300" : isFashion ? "text-pink-300" : isPet ? "text-cyan-300" : "text-orange-300";
  const accentBorder = isMusic ? "border-fuchsia-300/25" : isFashion ? "border-pink-300/25" : isPet ? "border-cyan-300/25" : "border-orange-300/25";
  const panelTone = isMusic ? "bg-[#15101f]" : isFashion ? "bg-[#11161d]" : isPet ? "bg-[#101c1d]" : "bg-[#1b1512]";
  return (
    <main className="overflow-hidden bg-[#0d0b13] text-white" id={String(section.settings.anchor ?? contentKey)} data-video-topic-page={contentKey}>
      <section className="border-b border-white/10 bg-[#0d0b13]" data-video-topic-section="hero">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:py-24">
          <div className="min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-normal ${accentClass}`}>{content.hero.eyebrow}</p>
            <h1 className="mt-5 min-w-0 max-w-[760px] break-words text-balance text-4xl font-semibold leading-[0.96] tracking-normal text-white sm:text-6xl lg:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={primaryHref} label={content.hero.primaryCta} site={site} />
              <ActionLink href="/ai-video-generation" label={content.hero.secondaryCta} site={site} variant="secondary" />
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 text-white/50">{content.hero.availabilityNote}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">{content.hero.rightsCopy}</p>
            {content.hero.highlights?.length ? <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-white/62">{content.hero.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}</div> : null}
          </div>
          <figure className={`relative min-w-0 ${heroMediaSizingClass(heroVideo)} lg:justify-self-end`} data-video-topic-hero-media>
            <div className={`relative ${heroMediaSizingClass(heroVideo)} overflow-hidden rounded-[8px] border ${accentBorder} bg-[#17151f] shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]`}>
              <TopicHeroMedia containSecondaryImages cropPetHero={isPet} images={heroImages} video={heroVideo} leadAspectRatio={heroLeadAspectRatio} />
            </div>
            <figcaption className="mt-4 flex items-start gap-3 text-sm leading-6 text-white/60"><Sparkles className={`mt-1 h-4 w-4 shrink-0 ${accentClass}`} strokeWidth={1.8} /><span>{content.hero.caption}</span></figcaption>
          </figure>
        </div>
      </section>

      {content.quickAnswer ? <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="what-this-creates" data-video-topic-section="what-this-creates"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.quickAnswer.eyebrow} title={content.quickAnswer.title} body={content.quickAnswer.intro} /><div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">{content.quickAnswer.cards.map((card, index) => <SupportingCard card={card} key={`${card.title}-${index}`} site={site} />)}</div></div></section> : null}

      {visualMap.length ? <section className={`border-b border-white/10 ${panelTone} px-5 py-16 sm:px-8 sm:py-24`} id="visual-map" data-video-topic-section="visual-map"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.platformExamples?.eyebrow ?? "VISUAL MAP"} title={content.platformExamples?.title ?? "Six Decisions Before You Generate"} body={content.platformExamples?.intro} /><ol className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-6">{visualMap.map((item, index) => <li className="min-w-0 rounded-[22px] border border-white/10 bg-[#17151f] p-5" data-scene-topic-map-item key={`${item.title}-${index}`}><p className={`text-xs font-semibold uppercase tracking-normal ${accentClass}`}>0{index + 1}</p><h3 className="mt-4 text-lg font-semibold leading-tight text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p></li>)}</ol></div></section> : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="how-it-works" data-video-topic-section="how-it-works"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.steps.eyebrow} title={content.steps.title} /><div className="mt-12 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">{content.steps.items.map((item, index) => <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-scene-topic-step key={`${item.title}-${index}`}><span className={`text-xs font-semibold uppercase tracking-normal ${accentClass}`}>0{index + 1}</span><h3 className="mt-7 text-xl font-semibold leading-tight text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p></article>)}</div><div className="mt-10"><ActionLink href={primaryHref} label={content.steps.cta} site={site} /></div></div></section>

      {sceneGalleryItems.length ? <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="scene-gallery" data-video-topic-section="scene-gallery"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.gallery?.eyebrow ?? "SCENE REFERENCES"} title={content.gallery?.title ?? "Eight Directions for the Next Shot"} body={content.gallery?.intro} light /><div className="mt-12 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4" data-scene-topic-gallery>{sceneGalleryItems.map((item, index) => <article className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#d2c9ef] bg-white/65" data-scene-topic-scene key={`${item.title}-${index}`}><div className="relative aspect-[4/3] overflow-hidden bg-[#d9d1f6]"><img src={optimizedTopicImageSrc(item.image.src)} alt={item.image.alt} className={`absolute inset-0 h-full w-full ${mediaObjectFit(item.image)} object-center`} style={imageStyle(item.image)} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" /></div><div className="flex flex-1 flex-col p-5"><h3 className="text-lg font-semibold leading-tight text-[#191622]">{item.title}</h3><p className="mt-3 flex-1 text-sm leading-6 text-[#625e6f]">{item.body}</p></div></article>)}</div></div></section> : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="sequence-guide" data-video-topic-section="sequence-guide"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.guidance.eyebrow} title={content.guidance.title} body={content.guidance.intro} /><div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">{content.guidance.cards.map((card, index) => <SupportingCard card={card} key={`${card.title}-${index}`} site={site} />)}</div></div></section>

      <section className={`border-b border-white/10 ${panelTone} px-5 py-16 sm:px-8 sm:py-24`} id="product-boundary" data-video-topic-section="product-boundary"><div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.74fr_1.26fr] lg:items-start lg:gap-16"><SectionHeader eyebrow={content.foundation.eyebrow} title={content.foundation.title} body={content.foundation.intro} /><div className="grid gap-5 sm:grid-cols-2"><DirectionList items={content.foundation.leftItems} title={content.foundation.leftTitle} tone="positive" /><DirectionList items={content.foundation.rightItems} title={content.foundation.rightTitle} tone={content.foundation.rightTone === "neutral" ? "neutral" : "avoid"} /><div className="sm:col-span-2 rounded-[22px] border border-white/10 bg-[#191525] p-6 sm:p-7"><p className={`text-xs font-semibold uppercase tracking-normal ${accentClass}`}>{content.foundation.expertLabel ?? "Expert tip"}</p><p className="mt-3 max-w-3xl text-base leading-7 text-white/78">{content.foundation.expertTip}</p></div></div></div></section>

      {content.evidence ? <section className="border-b border-[#d9d1f6] bg-[#e9e5f7] px-5 py-16 text-[#191622] sm:px-8 sm:py-24" id="product-evidence" data-video-topic-section="product-evidence"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.evidence.eyebrow} title={content.evidence.title} body={content.evidence.intro} light /><SectionCards cards={content.evidence.cards} light site={site} /></div></section> : null}

      <section className="border-b border-white/10 bg-[#0d0b13] px-5 py-16 sm:px-8 sm:py-24" id="workflow" data-video-topic-section="workflow"><div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-16"><div><SectionHeader eyebrow={content.value.eyebrow} title={content.value.title} body={content.value.intro} /><div className="mt-8"><ActionLink href={primaryHref} label={content.finalCta.cta} site={site} /></div></div><div className="grid gap-4 sm:grid-cols-2">{content.value.items.map((item, index) => <article className="rounded-[22px] border border-white/10 bg-[#17151f] p-6" data-scene-topic-workflow key={`${item.title}-${index}`}><Sparkles className={`h-5 w-5 ${accentClass}`} strokeWidth={1.8} /><h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p></article>)}</div></div></section>

      <section className="border-b border-white/10 bg-[#191525] px-5 py-16 sm:px-8 sm:py-24" id="integrity-review" data-video-topic-section="integrity-review"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeader eyebrow={content.trust.eyebrow} title={content.trust.title} body={content.trust.intro} /><div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">{content.trust.items.map((item, index) => <article className="h-full rounded-[22px] border border-white/10 bg-white/[0.045] p-6" data-scene-topic-review-card key={`${item.title}-${index}`}><ShieldCheck className={`h-5 w-5 ${accentClass}`} strokeWidth={1.8} /><h3 className="mt-5 text-lg font-semibold leading-tight text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{item.body}</p></article>)}</div></div></section>

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
  if (contentKey === "music-video" || contentKey === "fashion-video" || contentKey === "food-video" || contentKey === "pet-video") {
    return <SceneTopicLanding content={content} contentKey={contentKey} section={section} site={site} />;
  }
  if (contentKey === "ugc-ad-video") {
    return <UgcVideoTopicLanding content={content} section={section} site={site} />;
  }
  if (contentKey === "promo-video") {
    return <PromoVideoTopicLanding content={content} section={section} site={site} />;
  }
  const primaryHref = `/app/create?videoMode=${encodeURIComponent(contentKey)}#step-video`;
  const heroImages = heroPreviewImages(content);
  const heroVideo = content.hero.video;
  const heroDisplayAspectRatio = contentKey === "product-video" || contentKey === "product-ad-video" ? "9 / 16" : undefined;
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
          <figure className={`relative min-w-0 ${heroMediaSizingClass(heroVideo)} lg:justify-self-end`}>
            <div className={`relative ${heroMediaSizingClass(heroVideo)} overflow-hidden rounded-[8px] border border-[#c4b5fd]/25 bg-[#17151f] shadow-[0_40px_100px_-54px_rgba(196,181,253,0.72)]`} data-video-topic-hero-media>
              <TopicHeroMedia displayAspectRatio={heroDisplayAspectRatio} images={heroImages} video={heroVideo} />
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
            {content.useCases.items.map((item, index) => <UseCaseCard index={index} item={item} key={`${item.title}-${index}`} />)}
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
              <article className="h-full rounded-[22px] border border-white/10 bg-[#17151f] p-6" key={`${item.title}-${index}`}>
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
              {content.trust.items.map((item, index) => (
                <article className="h-full rounded-[22px] border border-white/10 bg-white/[0.045] p-6" key={`${item.title}-${index}`}>
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
  const content = aiVideoTopicLandingContentFromSection(section);
  if (!content) notFound();
  return (
    <DreamshootShowcasePreview>
      <VideoTopicLanding content={normalizeAiContent(content)} contentKey={contentKey} section={section} site={site} />
    </DreamshootShowcasePreview>
  );
}

export function TalkingPhotoLanding({ section, site }: { section: SectionInstance; site: Site }) {
  const content = talkingPhotoContentFromSection(section);
  if (!content) notFound();
  return (
    <DreamshootShowcasePreview>
      <VideoTopicLanding content={normalizeTalkingContent(content)} contentKey="talking-photo" section={section} site={site} />
    </DreamshootShowcasePreview>
  );
}
