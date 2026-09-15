import { ArrowRight, Check, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { AidreamcapesImageThemeGallery, type AidreamcapesImageThemeGalleryMode } from "@/components/storefront/aidreamcapes-image-theme-gallery";
import { AidreamcapesImageAsset } from "@/components/storefront/aidreamcapes-image-theme-media";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import {
  imageThemeDetailContentFromSection,
  type AidreamcapesImageThemeDetailContent,
  type AidreamcapesImageThemeImage
} from "@/lib/aidreamcapes-image-theme-content";
import type { SectionInstance, Site } from "@/lib/types";

type RoutedSite = Site & { __storefrontBasePath?: string };

type ThemeTone = {
  accent: string;
  border: string;
  glow: string;
  surface: string;
};

const DEFAULT_TONE: ThemeTone = {
  accent: "#b8a7ff",
  border: "rgba(139, 92, 246, 0.42)",
  glow: "rgba(139, 92, 246, 0.2)",
  surface: "#111019"
};

const TONE_BY_VARIANT: Record<string, ThemeTone> = {
  "ecommerce-main-image-detail": { accent: "#b8a7ff", border: "rgba(139, 92, 246, 0.48)", glow: "rgba(139, 92, 246, 0.23)", surface: "#111019" },
  "lifestyle-scene-detail": { accent: "#67e8f9", border: "rgba(34, 211, 238, 0.4)", glow: "rgba(34, 211, 238, 0.18)", surface: "#0d1719" },
  "packshot-multi-angle-detail": { accent: "#a5b4fc", border: "rgba(99, 102, 241, 0.44)", glow: "rgba(99, 102, 241, 0.2)", surface: "#11121b" },
  "macro-details-detail": { accent: "#f0abfc", border: "rgba(236, 72, 153, 0.42)", glow: "rgba(236, 72, 153, 0.2)", surface: "#170f17" },
  "bundle-sets-detail": { accent: "#67e8f9", border: "rgba(34, 211, 238, 0.38)", glow: "rgba(34, 211, 238, 0.16)", surface: "#0d171b" },
  "size-reference-detail": { accent: "#fcd34d", border: "rgba(245, 158, 11, 0.42)", glow: "rgba(245, 158, 11, 0.17)", surface: "#18130d" },
  "feature-infographic-detail": { accent: "#67e8f9", border: "rgba(34, 211, 238, 0.42)", glow: "rgba(34, 211, 238, 0.19)", surface: "#0b171d" },
  "comparison-chart-detail": { accent: "#c4b5fd", border: "rgba(167, 139, 250, 0.4)", glow: "rgba(167, 139, 250, 0.17)", surface: "#13111a" },
  "feed-ad-still-detail": { accent: "#f9a8d4", border: "rgba(236, 72, 153, 0.4)", glow: "rgba(236, 72, 153, 0.18)", surface: "#180f18" },
  "ugc-still-ad-detail": { accent: "#fdba74", border: "rgba(249, 115, 22, 0.4)", glow: "rgba(249, 115, 22, 0.18)", surface: "#19120d" },
  "story-ad-vertical-detail": { accent: "#c4b5fd", border: "rgba(139, 92, 246, 0.46)", glow: "rgba(139, 92, 246, 0.2)", surface: "#13101d" },
  "carousel-set-detail": { accent: "#93c5fd", border: "rgba(59, 130, 246, 0.42)", glow: "rgba(59, 130, 246, 0.18)", surface: "#0e151f" },
  "sale-campaign-key-visual-detail": { accent: "#fda4af", border: "rgba(244, 63, 94, 0.42)", glow: "rgba(244, 63, 94, 0.18)", surface: "#1a1014" },
  "lookbook-cover-detail": { accent: "#f0abfc", border: "rgba(217, 70, 239, 0.38)", glow: "rgba(217, 70, 239, 0.16)", surface: "#170f18" },
  "on-model-generation-detail": { accent: "#67e8f9", border: "rgba(34, 211, 238, 0.4)", glow: "rgba(34, 211, 238, 0.18)", surface: "#0d171b" },
  "virtual-try-on-detail": { accent: "#f0abfc", border: "rgba(236, 72, 153, 0.42)", glow: "rgba(236, 72, 153, 0.19)", surface: "#180f18" },
  "hair-makeup-preview-detail": { accent: "#f9a8d4", border: "rgba(244, 114, 182, 0.4)", glow: "rgba(244, 114, 182, 0.17)", surface: "#190f17" },
  "jewelry-positioning-detail": { accent: "#fde68a", border: "rgba(234, 179, 8, 0.4)", glow: "rgba(234, 179, 8, 0.16)", surface: "#18140d" },
  "ghost-mannequin-detail": { accent: "#c4b5fd", border: "rgba(167, 139, 250, 0.4)", glow: "rgba(167, 139, 250, 0.16)", surface: "#131119" },
  "colorway-variations-detail": { accent: "#86efac", border: "rgba(34, 197, 94, 0.38)", glow: "rgba(34, 197, 94, 0.16)", surface: "#0f1713" },
  "background-remove-replace-detail": { accent: "#c4b5fd", border: "rgba(139, 92, 246, 0.44)", glow: "rgba(139, 92, 246, 0.19)", surface: "#13101a" },
  "enhance-upscale-detail": { accent: "#67e8f9", border: "rgba(34, 211, 238, 0.42)", glow: "rgba(34, 211, 238, 0.18)", surface: "#0d171a" },
  "old-photo-restore-detail": { accent: "#fcd34d", border: "rgba(245, 158, 11, 0.4)", glow: "rgba(245, 158, 11, 0.16)", surface: "#17130d" },
  "commercial-lighting-detail": { accent: "#fde68a", border: "rgba(251, 191, 36, 0.4)", glow: "rgba(251, 191, 36, 0.18)", surface: "#17140d" },
  "packaging-mockup-detail": { accent: "#fdba74", border: "rgba(249, 115, 22, 0.4)", glow: "rgba(249, 115, 22, 0.18)", surface: "#19120d" },
  "professional-headshot-detail": { accent: "#93c5fd", border: "rgba(59, 130, 246, 0.4)", glow: "rgba(59, 130, 246, 0.17)", surface: "#0f151d" },
  "creator-portrait-detail": { accent: "#f9a8d4", border: "rgba(236, 72, 153, 0.4)", glow: "rgba(236, 72, 153, 0.17)", surface: "#180f17" },
  "team-directory-detail": { accent: "#a5b4fc", border: "rgba(99, 102, 241, 0.4)", glow: "rgba(99, 102, 241, 0.17)", surface: "#11121a" },
  "social-profile-photo-detail": { accent: "#67e8f9", border: "rgba(34, 211, 238, 0.4)", glow: "rgba(34, 211, 238, 0.17)", surface: "#0d171a" },
  "fashion-editorial-detail": { accent: "#f0abfc", border: "rgba(217, 70, 239, 0.4)", glow: "rgba(217, 70, 239, 0.17)", surface: "#170f18" }
};

function hrefFor(site: Site, href: string): string {
  const routedSite = site as RoutedSite;
  const basePath = routedSite.__storefrontBasePath;
  if (typeof basePath === "string") return basePath ? `${basePath}${href}` : href;
  return hostAwareSitePath(site, href);
}

function InternalLink({ site, href, children, className }: { site: Site; href: string; children: ReactNode; className: string }) {
  return <StorefrontInstantLink className={className} href={hrefFor(site, href)}>{children}</StorefrontInstantLink>;
}

function ActionLink({ site, href, label, variant = "primary" }: { site: Site; href: string; label: string; variant?: "primary" | "secondary" }) {
  const className = variant === "primary"
    ? "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#f7f2eb] px-6 text-sm font-semibold text-[#090909] shadow-[0_18px_44px_-24px_rgba(255,255,255,0.65)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd]"
    : "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/[0.045] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd]";
  return <InternalLink className={className} href={href} site={site}>{label}<ArrowRight className="h-4 w-4" strokeWidth={1.8} /></InternalLink>;
}

function Eyebrow({ children, tone }: { children: ReactNode; tone?: ThemeTone }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: tone?.accent ?? DEFAULT_TONE.accent }}>{children}</p>;
}

function SectionHeading({ eyebrow, title, intro, tone }: { eyebrow: string; title: string; intro?: string; tone?: ThemeTone }) {
  return <div className="max-w-3xl"><Eyebrow tone={tone}>{eyebrow}</Eyebrow><h2 className="mt-4 text-balance text-3xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl">{title}</h2>{intro ? <p className="mt-5 max-w-2xl text-base leading-7 text-white/60">{intro}</p> : null}</div>;
}

function ImageFrame({ image, className = "" }: { image: AidreamcapesImageThemeImage; className?: string }) {
  return <div className={`relative overflow-hidden bg-[#111217] ${className}`} style={{ aspectRatio: `${image.width} / ${image.height}` }}><AidreamcapesImageAsset className="block h-full w-full object-contain" image={image} /></div>;
}

function galleryModeForVariant(variant: string): AidreamcapesImageThemeGalleryMode {
  if (variant.includes("story") || variant.includes("carousel") || variant.includes("editorial") || variant.includes("lookbook")) return "storyboard";
  if (variant.includes("headshot") || variant.includes("portrait") || variant.includes("model") || variant.includes("jewelry") || variant.includes("mannequin")) return "portrait-set";
  if (variant.includes("comparison") || variant.includes("background") || variant.includes("enhance") || variant.includes("restore") || variant.includes("lighting")) return "comparison";
  if (variant.includes("bundle") || variant.includes("colorway") || variant.includes("packaging")) return "catalog";
  return "masonry";
}

function HeroVisual({ content, tone }: { content: AidreamcapesImageThemeDetailContent; tone: ThemeTone }) {
  return <div className="relative min-w-0 lg:-translate-x-8 lg:w-[calc(100%+4.5rem)]" data-image-theme-hero-visual><div className="relative rounded-[28px] border bg-[#0a0a0d] p-3 shadow-[0_40px_100px_-52px_rgba(139,92,246,0.8)] sm:p-5" style={{ borderColor: tone.border, boxShadow: `0 40px 100px -52px ${tone.glow}` }}><div className="flex items-center justify-between gap-4 border-b border-white/10 px-2 pb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35"><span>{content.hero.outputLabel}</span><span>01 / 02</span></div><figure className="mt-3 overflow-hidden rounded-[18px] border bg-[#111217]" style={{ borderColor: tone.border }}><ImageFrame image={content.hero.outputImage} /><figcaption className="grid gap-3 border-t border-white/10 px-4 py-4 sm:grid-cols-3">{content.proof.cards.slice(0, 3).map((item, index) => <span className="text-xs text-white/55" key={`${item.title}-${index}`}><span className="mr-2 font-mono text-[10px]" style={{ color: tone.accent }}>0{index + 1}</span>{item.title}</span>)}</figcaption></figure></div><figure className="relative z-10 mt-[-3.25rem] w-[58%] max-w-[260px] rounded-[20px] border bg-[#100d18] p-2 shadow-[0_28px_60px_-28px_rgba(0,0,0,0.95)] sm:mt-[-7rem] sm:w-[42%] lg:absolute lg:bottom-[-1.5rem] lg:left-0 lg:mt-0" style={{ borderColor: tone.border }}><ImageFrame image={content.hero.productImage} /><figcaption className="flex items-center justify-between gap-2 px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55"><span className="truncate">{content.hero.productLabel}</span><ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: tone.accent }} /></figcaption></figure><div className="pointer-events-none absolute bottom-3 right-3 hidden h-16 w-16 rounded-full border sm:block" style={{ borderColor: tone.border }} /><Sparkles className="absolute bottom-8 right-8 hidden h-5 w-5 sm:block" style={{ color: tone.accent }} strokeWidth={1.4} /></div>;
}

function ProofSection({ content, tone }: { content: AidreamcapesImageThemeDetailContent; tone: ThemeTone }) {
  return <section className="border-b border-white/10 bg-[#080808] px-5 py-16 sm:px-8 sm:py-24" data-image-theme-section="proof"><div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20"><SectionHeading eyebrow={content.proof.eyebrow} title={content.proof.title} intro={content.proof.intro} tone={tone} /><div className="grid gap-px overflow-hidden rounded-[22px] border border-white/10 bg-white/10 sm:grid-cols-2">{content.proof.cards.map((item, index) => <article className="bg-[#0b0b0b] p-6 transition-colors hover:bg-[#111017]" key={`${item.title}-${index}`}><div className="flex items-center justify-between gap-4"><span className="font-mono text-[11px] tracking-[0.18em] text-white/35">0{index + 1}</span><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone.accent, boxShadow: `0 0 18px ${tone.accent}` }} /></div><h3 className="mt-9 text-lg font-semibold text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/55">{item.body}</p></article>)}</div></div></section>;
}

function WorkflowSection({ content, tone }: { content: AidreamcapesImageThemeDetailContent; tone: ThemeTone }) {
  return <section className="border-b border-white/10 bg-[#050505] px-5 py-16 sm:px-8 sm:py-24" data-image-theme-section="workflow"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.workflow.eyebrow} title={content.workflow.title} intro={content.workflow.intro} tone={tone} /><ol className="relative mt-12 grid gap-3 before:absolute before:bottom-6 before:left-[1.65rem] before:top-6 before:w-px before:bg-gradient-to-b before:from-white/35 before:via-white/10 before:to-transparent md:grid-cols-5 md:gap-2 md:before:left-0 md:before:right-0 md:before:top-[1.65rem] md:before:h-px md:before:w-auto md:before:bg-gradient-to-r md:before:from-white/35 md:before:via-white/10 md:before:to-transparent">{content.workflow.steps.map((step, index) => <li className="group relative grid grid-cols-[3.3rem_1fr] gap-4 md:block md:pr-4" key={`${step.title}-${index}`}><span className="relative z-10 grid h-[3.3rem] w-[3.3rem] place-items-center rounded-full border bg-[#100d18] font-mono text-xs shadow-[0_0_26px_-10px_currentColor] transition group-hover:text-white" style={{ borderColor: tone.border, color: tone.accent }}>{String(index + 1).padStart(2, "0")}</span><div className="pb-7 md:pt-7"><h3 className="text-base font-semibold text-white">{step.title}</h3><p className="mt-2 text-sm leading-6 text-white/52">{step.body}</p></div></li>)}</ol></div></section>;
}

function DirectionsSection({ content, tone }: { content: AidreamcapesImageThemeDetailContent; tone: ThemeTone }) {
  return <section className="border-b border-white/10 bg-[#080808] px-5 py-16 sm:px-8 sm:py-24" data-image-theme-section="directions"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.directions.eyebrow} title={content.directions.title} intro={content.directions.intro} tone={tone} /><div className="mt-12 divide-y divide-white/10 border-y border-white/10">{content.directions.cards.map((item, index) => <article className="group grid gap-4 py-6 md:grid-cols-[4rem_1fr_1.25fr] md:items-center md:gap-8" key={`${item.title}-${index}`}><span className="font-mono text-sm" style={{ color: tone.accent }}>/{String(index + 1).padStart(2, "0")}</span><h3 className="text-xl font-medium tracking-[-0.02em] text-white">{item.title}</h3><p className="text-sm leading-6 text-white/55">{item.body}</p></article>)}</div></div></section>;
}

function ExamplesSection({ content, tone }: { content: AidreamcapesImageThemeDetailContent; tone: ThemeTone }) {
  const mode = galleryModeForVariant(content.layoutVariant);
  return <section className="border-b border-white/10 bg-[#050505] px-5 py-16 sm:px-8 sm:py-24" id="examples" data-image-theme-section="examples"><div className="mx-auto max-w-[var(--site-content-width)]"><div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading eyebrow={content.examples.eyebrow} title={content.examples.title} intro={content.examples.intro} tone={tone} /><span className="font-mono text-xs tracking-[0.18em] text-white/35">{String(content.examples.items.length).padStart(2, "0")} VIEWS / {mode.replace("-", " ")}</span></div><div className="mt-10 rounded-[26px] border border-white/10 bg-[#0b0c10] p-3 sm:p-5" style={{ boxShadow: `0 32px 90px -68px ${tone.glow}` }}><div className="mb-4 flex items-center justify-between border-b border-white/10 px-2 pb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35"><span>{content.hero.outputLabel}</span><span>Click any image to inspect</span></div><AidreamcapesImageThemeGallery items={content.examples.items} mode={mode} /></div></div></section>;
}

function FormatsSection({ content, tone }: { content: AidreamcapesImageThemeDetailContent; tone: ThemeTone }) {
  return <section className="border-b border-white/10 bg-[#080808] px-5 py-16 sm:px-8 sm:py-24" data-image-theme-section="formats"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.formats.eyebrow} title={content.formats.title} intro={content.formats.intro} tone={tone} /><div className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><div className="grid gap-3 sm:grid-cols-2">{content.formats.items.map((item, index) => <article className="rounded-[20px] border border-white/10 bg-[#0b0b0b] p-5 transition hover:-translate-y-0.5" key={`${item.title}-${index}`}><div className="flex items-center justify-between gap-3"><span className="font-mono text-[11px] tracking-[0.16em] text-white/35">USE / 0{index + 1}</span><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.accent }} /></div><h3 className="mt-8 text-lg font-semibold text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-white/55">{item.body}</p></article>)}</div><aside className="relative overflow-hidden rounded-[20px] border bg-[#12101b] p-6" style={{ borderColor: tone.border, backgroundColor: tone.surface }}><div className="absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: tone.glow }} /><Eyebrow tone={tone}>{content.hero.outputLabel}</Eyebrow><p className="relative mt-5 max-w-sm text-2xl font-medium leading-tight tracking-[-0.035em] text-white">{content.formats.intro}</p><div className="relative mt-10 grid grid-cols-2 gap-2">{content.proof.cards.slice(0, 4).map((item, index) => <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3" key={`${item.title}-${index}`}><span className="block text-[10px] uppercase tracking-[0.14em] text-white/35">0{index + 1}</span><span className="mt-2 block text-xs font-medium leading-5 text-white/75">{item.title}</span></div>)}</div></aside></div></div></section>;
}

function ChecklistSection({ content, tone }: { content: AidreamcapesImageThemeDetailContent; tone: ThemeTone }) {
  return <section className="border-b border-white/10 bg-[#050505] px-5 py-16 sm:px-8 sm:py-24" data-image-theme-section="checklist"><div className="mx-auto grid max-w-[var(--site-content-width)] gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div className="rounded-[22px] border bg-[#0c111a] p-6 sm:p-8" style={{ borderColor: tone.border }}><div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5"><span className="font-mono text-[11px] tracking-[0.16em] text-white/45">BEFORE YOU SHARE</span><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone.accent, boxShadow: `0 0 18px ${tone.accent}` }} /></div><h2 className="mt-8 text-2xl font-semibold tracking-[-0.035em] text-white">{content.checklist.title}</h2><p className="mt-4 text-sm leading-6 text-white/55">{content.checklist.intro}</p></div><ul className="grid gap-2 sm:grid-cols-2">{content.checklist.items.map((item, index) => <li className="flex items-start gap-4 rounded-[18px] border border-white/10 bg-[#0b0b0b] p-5 text-sm leading-6 text-white/65" key={item}><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border bg-white/[0.04]" style={{ borderColor: tone.border, color: tone.accent }}><Check className="h-3.5 w-3.5" strokeWidth={2.2} /></span><span><span className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-white/30">CHECK 0{index + 1}</span>{item}</span></li>)}</ul></div></section>;
}

function FaqSection({ content, tone }: { content: AidreamcapesImageThemeDetailContent; tone: ThemeTone }) {
  return <section className="border-b border-white/10 bg-[#080808] px-5 py-16 sm:px-8 sm:py-24" data-image-theme-section="faq"><div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.faq.eyebrow} title={content.faq.title} intro={content.faq.intro} tone={tone} /><div className="mt-12 divide-y divide-white/10 border-y border-white/10">{content.faq.items.map((item, index) => <details className="group py-5" key={item.question}><summary className="flex cursor-pointer list-none items-start gap-5 text-base font-semibold text-white marker:hidden [&::-webkit-details-marker]:hidden"><span className="font-mono text-xs" style={{ color: tone.accent }}>0{index + 1}</span><span className="flex-1">{item.question}</span><ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-white/45 transition group-open:rotate-90" strokeWidth={1.8} /></summary><p className="ml-9 mt-4 max-w-2xl text-sm leading-6 text-white/55">{item.answer}</p></details>)}</div></div></section>;
}

function FinalCtaSection({ content, site, tone }: { content: AidreamcapesImageThemeDetailContent; site: Site; tone: ThemeTone }) {
  return <section className="bg-[#050505] px-5 py-16 sm:px-8 sm:py-24" data-image-theme-section="final-cta"><div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 rounded-[26px] border bg-[#0d0c12] p-7 shadow-[0_34px_90px_-58px_rgba(139,92,246,0.9)] sm:p-12 lg:grid-cols-[1fr_auto] lg:items-end" style={{ borderColor: tone.border, background: `radial-gradient(circle at 82% 10%, ${tone.glow}, transparent 30%), #0d0c12` }}><div><Eyebrow tone={tone}>{content.finalCta.eyebrow}</Eyebrow><h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl">{content.finalCta.title}</h2><p className="mt-5 max-w-2xl text-base leading-7 text-white/60">{content.finalCta.body}</p><p className="mt-5 flex max-w-xl items-start gap-2 text-xs leading-5 text-white/40"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tone.accent }} strokeWidth={1.8} />{content.finalCta.microcopy}</p></div><ActionLink href={content.finalCta.ctaHref} label={content.finalCta.cta} site={site} /></div></section>;
}

export function EcommerceStyleImageThemeDetail({ content, site }: { content: AidreamcapesImageThemeDetailContent; site: Site }) {
  const tone = TONE_BY_VARIANT[content.layoutVariant] ?? DEFAULT_TONE;
  const themeStyle = { "--theme-accent": tone.accent, "--theme-border": tone.border } as CSSProperties;

  return <div className="aidreamcapes-image-theme-detail overflow-hidden bg-[#050505] text-white" data-aidreamcapes-detail-variant={content.layoutVariant} data-image-theme-architecture="ecommerce-style" style={themeStyle}><section className="relative border-b border-white/10 bg-[#050505]" data-image-theme-section="hero"><div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 78% 18%, ${tone.glow}, transparent 28%), radial-gradient(circle at 92% 78%, rgba(34,211,238,0.08), transparent 24%)` }} /><div className="relative mx-auto max-w-[var(--site-content-width)] px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-12"><div className="flex items-center justify-between gap-6 border-b border-white/10 pb-5"><Eyebrow tone={tone}>{content.hero.eyebrow}</Eyebrow><span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35 sm:flex"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.accent }} />{content.hero.imageNote}</span></div><div className="mt-10 grid items-start gap-10 lg:grid-cols-[0.84fr_1.16fr] lg:gap-12"><div data-commerce-reveal="copy"><h1 className="max-w-[680px] text-balance text-4xl font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-6xl lg:text-[4.2rem]">{content.hero.title}</h1><p className="mt-6 max-w-[38rem] text-base leading-7 text-white/62 sm:text-lg sm:leading-8">{content.hero.body}</p><div className="mt-7 flex flex-wrap gap-3"><ActionLink href={content.hero.primaryCtaHref} label={content.hero.primaryCta} site={site} /><ActionLink href={content.hero.secondaryCtaHref} label={content.hero.secondaryCta} site={site} variant="secondary" /></div><div className="mt-5 grid max-w-[38rem] gap-2 sm:grid-cols-2"><p className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 text-xs leading-5 text-white/42">{content.hero.availabilityNote}</p><p className="rounded-xl border border-white/10 bg-white/[0.018] px-3 py-2.5 text-xs leading-5 text-white/35">{content.hero.rightsCopy}</p></div><div className="mt-7 grid max-w-[38rem] grid-cols-2 gap-2 border-t border-white/10 pt-4">{content.proof.cards.slice(0, 2).map((item, index) => <div key={`${item.title}-${index}`}><span className="block font-mono text-[10px] tracking-[0.16em] text-white/30">KEY POINT / 0{index + 1}</span><span className="mt-2 block text-sm font-medium text-white/75">{item.title}</span></div>)}</div></div><div className="lg:pt-8" data-commerce-reveal="canvas"><HeroVisual content={content} tone={tone} /></div></div></div></section><ProofSection content={content} tone={tone} /><WorkflowSection content={content} tone={tone} /><DirectionsSection content={content} tone={tone} /><ExamplesSection content={content} tone={tone} /><FormatsSection content={content} tone={tone} /><ChecklistSection content={content} tone={tone} /><FaqSection content={content} tone={tone} /><FinalCtaSection content={content} site={site} tone={tone} /></div>;
}

export function EcommerceMainImageDetail({ section, site }: { section: SectionInstance; site: Site }) {
  const content = imageThemeDetailContentFromSection(section);
  return content ? <EcommerceStyleImageThemeDetail content={content} site={site} /> : null;
}
