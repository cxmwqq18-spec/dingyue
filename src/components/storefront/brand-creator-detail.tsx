/* eslint-disable @next/next/no-img-element */

import { ArrowRight, Check, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { AdsTestingDetailGallery } from "@/components/storefront/ads-testing-detail-gallery";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import type { AidreamcapesAdsTestingImage, AidreamcapesBrandCreatorDetailContent } from "@/lib/ai-video-topic-content";
import type { SectionInstance, Site } from "@/lib/types";

type RoutedSite = Site & { __storefrontBasePath?: string };

function hrefFor(site: Site, href: string): string {
  const routedSite = site as RoutedSite;
  const basePath = routedSite.__storefrontBasePath;
  if (href.startsWith("#")) return href;
  if (typeof basePath === "string") return basePath ? `${basePath}${href}` : href;
  return hostAwareSitePath(site, href);
}

function InternalLink({ site, href, children, className }: { site: Site; href: string; children: ReactNode; className: string }) {
  return <StorefrontInstantLink className={className} href={hrefFor(site, href)}>{children}</StorefrontInstantLink>;
}

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="aidreamcapes-detail-eyebrow text-xs font-semibold uppercase tracking-[0.18em] text-[#b8a7ff]">{eyebrow}</p>
      <h2 className="mt-4 text-balance text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl">{title}</h2>
      {intro ? <p className="mt-5 max-w-2xl text-base leading-7 text-white/65">{intro}</p> : null}
    </div>
  );
}

function ActionLink({ site, href, label, variant = "primary" }: { site: Site; href: string; label: string; variant?: "primary" | "secondary" }) {
  const className = variant === "primary"
    ? "aidreamcapes-detail-primary-action inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#3b82f6] px-6 text-sm font-semibold text-white shadow-[0_14px_34px_-18px_rgba(139,92,246,0.95)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd]"
    : "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.045] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd]";
  return <InternalLink className={className} href={href} site={site}>{label}<ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></InternalLink>;
}

function GuidanceCards({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <article className="rounded-[22px] border border-white/10 bg-white/[0.045] p-6" key={`${item.title}-${index}`}>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b8a7ff]">0{index + 1}</span>
          <h3 className="mt-7 text-xl font-semibold leading-tight text-white">{item.title}</h3>
          <p className="mt-3 text-sm leading-6 text-white/62">{item.body}</p>
        </article>
      ))}
    </div>
  );
}

function Media({ image, className = "" }: { image: AidreamcapesAdsTestingImage; className?: string }) {
  return <img alt={image.alt} className={className} decoding="async" fetchPriority={image.fetchPriority} height={image.height} loading={image.loading} sizes={image.sizes} src={image.src} width={image.width} />;
}

export function BrandCreatorDetail({ content, section, site }: { content: AidreamcapesBrandCreatorDetailContent; section: SectionInstance; site: Site }) {
  const rootId = String(section.settings.anchor ?? content.contentKey ?? content.seo.canonicalPath.split("/").at(-1) ?? "brand-creator");
  return (
    <div className="aidreamcapes-brand-creator-detail overflow-hidden bg-[#050505] text-white" id={rootId} data-aidreamcapes-detail-variant="brand-creator-detail" data-aidreamcapes-brand-creator-key={content.contentKey}>
      <section className="relative border-b border-white/10 bg-[#050505]" data-brand-creator-section="hero">
        <div className="aidreamcapes-detail-hero-glow pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[70rem] -translate-x-1/2 rounded-full bg-[#8b5cf6]/10 blur-[130px]" />
        <div className="relative mx-auto grid max-w-[var(--site-content-width)] gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b8a7ff]">{content.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-[720px] text-balance text-4xl font-semibold leading-[0.96] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">{content.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ActionLink href={content.hero.primaryCtaHref} label={content.hero.primaryCta} site={site} />
              <ActionLink href={content.hero.secondaryCtaHref} label={content.hero.secondaryCta} site={site} variant="secondary" />
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 text-white/48">{content.hero.availabilityNote}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">{content.hero.rightsCopy}</p>
          </div>
          <figure className="relative min-w-0">
            <div className="aidreamcapes-detail-hero-frame rounded-[30px] border border-[#8b5cf6]/30 bg-gradient-to-br from-[#171225] via-[#0d1020] to-[#121018] p-3 shadow-[0_42px_110px_-56px_rgba(139,92,246,0.9)]">
              <div className="grid grid-cols-[minmax(0,0.82fr)_3.25rem_minmax(0,1fr)] items-center gap-3 rounded-[22px] border border-white/10 bg-[#08080b] p-3 sm:gap-5 sm:p-5">
                <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#101117]">
                  <Media className="aspect-square h-full w-full object-cover" image={content.hero.productImage} />
                  <p className="border-t border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/54">{content.hero.productLabel}</p>
                </div>
                <div className="grid place-items-center text-[#b8a7ff]">
                  <div className="grid h-11 w-11 place-items-center rounded-full border border-[#8b5cf6]/45 bg-[#8b5cf6]/15"><ArrowRight aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} /></div>
                  <span className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-white/42">{content.hero.imageNote}</span>
                </div>
                <div className="overflow-hidden rounded-[18px] border border-[#ec4899]/30 bg-[#151020]">
                  <Media className="aspect-square h-full w-full object-cover" image={content.hero.outputImage} />
                  <p className="border-t border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/54">{content.hero.outputLabel}</p>
                </div>
              </div>
            </div>
            <figcaption className="mt-4 flex items-start gap-3 text-sm leading-6 text-white/58"><Sparkles aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[#c4b5fd]" strokeWidth={1.8} /><span>{content.hero.imageNote}</span></figcaption>
          </figure>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0a0a0a] px-5 py-16 sm:px-8 sm:py-24" data-brand-creator-section="workflow-output">
        <div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.workflowOutput.eyebrow} title={content.workflowOutput.title} intro={content.workflowOutput.intro} /><GuidanceCards items={content.workflowOutput.cards} /></div>
      </section>

      <section className="border-b border-white/10 bg-[#050505] px-5 py-16 sm:px-8 sm:py-24" data-brand-creator-section="workflow">
        <div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.workflow.eyebrow} title={content.workflow.title} intro={content.workflow.intro} /><GuidanceCards items={content.workflow.cards} /></div>
      </section>

      <section className="border-b border-white/10 bg-[#0a0a0a] px-5 py-16 sm:px-8 sm:py-24" data-brand-creator-section="creative-directions">
        <div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.creativeDirections.eyebrow} title={content.creativeDirections.title} intro={content.creativeDirections.intro} /><GuidanceCards items={content.creativeDirections.cards} /></div>
      </section>

      <section className="border-b border-white/10 bg-[#050505] px-5 py-16 sm:px-8 sm:py-24" id="topic-examples" data-brand-creator-section="examples">
        <div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.examples.eyebrow} title={content.examples.title} intro={content.examples.intro} /><div className="mt-12"><AdsTestingDetailGallery items={content.examples.items} /></div></div>
      </section>

      <section className="border-b border-white/10 bg-[#0a0a0a] px-5 py-16 sm:px-8 sm:py-24" data-brand-creator-section="ad-testing">
        <div className="mx-auto grid max-w-[var(--site-content-width)] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16"><SectionHeading eyebrow={content.adTesting.eyebrow} title={content.adTesting.title} intro={content.adTesting.intro} /><div><div className="grid gap-3 sm:grid-cols-3">{content.adTesting.platforms.map((platform) => <div className="aidreamcapes-detail-platform-card rounded-[18px] border border-[#8b5cf6]/30 bg-[#14111d] px-4 py-5 text-center text-sm font-semibold text-white" key={platform}>{platform}</div>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-2">{content.adTesting.checklist.map((item) => <div className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-white/[0.035] px-4 py-4 text-sm leading-6 text-white/68" key={item}><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#b8a7ff]" strokeWidth={2} />{item}</div>)}</div></div></div>
      </section>

      <section className="border-b border-white/10 bg-[#050505] px-5 py-16 sm:px-8 sm:py-24" data-brand-creator-section="requirements">
        <div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.requirements.eyebrow} title={content.requirements.title} intro={content.requirements.intro} /><GuidanceCards items={content.requirements.cards} /></div>
      </section>

      <section className="border-b border-white/10 bg-[#0a0a0a] px-5 py-16 sm:px-8 sm:py-24" data-brand-creator-section="related-workflows">
        <div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.relatedWorkflows.eyebrow} title={content.relatedWorkflows.title} intro={content.relatedWorkflows.intro} /><div className="mt-12 grid gap-4 md:grid-cols-3">{content.relatedWorkflows.items.map((item) => <article className="flex flex-col rounded-[22px] border border-white/10 bg-white/[0.045] p-6" key={item.title}><h3 className="text-xl font-semibold text-white">{item.title}</h3><p className="mt-3 flex-1 text-sm leading-6 text-white/62">{item.body}</p><InternalLink className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#c4b5fd] transition hover:text-white" href={item.href} site={site}>{item.linkLabel}<ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} /></InternalLink></article>)}</div></div>
      </section>

      <section className="border-b border-white/10 bg-[#141414] px-5 py-16 sm:px-8 sm:py-24" data-brand-creator-section="faq">
        <div className="mx-auto max-w-[var(--site-content-width)]"><SectionHeading eyebrow={content.faq.eyebrow} title={content.faq.title} /><div className="mt-10 grid gap-4 lg:grid-cols-2">{content.faq.items.map((item) => <details className="group rounded-[20px] border border-white/10 bg-white/[0.045] p-5 open:bg-white/[0.08]" key={item.question}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white"><span>{item.question}</span><ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[#c4b5fd] transition group-open:rotate-90" strokeWidth={1.8} /></summary><p className="mt-4 max-w-2xl text-sm leading-6 text-white/62">{item.answer}</p></details>)}</div></div>
      </section>

      <section className="bg-[#050505] px-5 py-16 sm:px-8 sm:py-24" data-brand-creator-section="final-cta">
        <div className="aidreamcapes-detail-final-cta mx-auto max-w-[var(--site-content-width)] rounded-[28px] border border-[#8b5cf6]/35 bg-gradient-to-br from-[#191329] via-[#101321] to-[#111018] px-6 py-12 text-center shadow-[0_34px_90px_-58px_rgba(139,92,246,0.9)] sm:px-10 sm:py-16"><p className="aidreamcapes-detail-eyebrow text-xs font-semibold uppercase tracking-[0.18em] text-[#b8a7ff]">{content.finalCta.eyebrow}</p><h2 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold leading-[1.03] tracking-[-0.045em] text-white sm:text-5xl">{content.finalCta.title}</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/65">{content.finalCta.body}</p><div className="mt-8 flex justify-center"><ActionLink href={content.finalCta.ctaHref} label={content.finalCta.cta} site={site} /></div><p className="mt-5 text-xs leading-5 text-white/45">{content.finalCta.microcopy}</p><div className="mx-auto mt-7 flex max-w-md items-center justify-center gap-2 text-xs text-white/42"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-[#b8a7ff]" strokeWidth={1.8} />{content.hero.rightsCopy}</div></div>
      </section>
    </div>
  );
}
