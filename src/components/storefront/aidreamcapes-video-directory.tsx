import { ArrowUpRight, Check, ChevronRight, Layers3, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { AidreamcapesZipNavigation, Site } from "@/lib/types";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { AidreamcapesResponsiveImage } from "@/components/storefront/aidreamcapes-responsive-image";

export type AidreamcapesVideoDirectoryCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  directoryNote: string;
  statLabels: {
    lanes: string;
    themes: string;
    routes: string;
  };
  browseLabel: string;
  openLabel: string;
  laneCountLabel: string;
  laneCopy: Array<{
    groupLabel: string;
    intro: string;
    focusLabel: string;
    focus: string;
  }>;
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
};

export type AidreamcapesVideoThemeCover = {
  src: string;
  alt: string;
};

type RoutedSite = Site & { __storefrontBasePath?: string };

const laneAccents = [
  {
    edge: "border-[#8b5cf6]/45",
    glow: "bg-[#8b5cf6]/18",
    number: "text-[#c4b5fd]",
    chip: "border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#ddd6fe]"
  },
  {
    edge: "border-[#3b82f6]/45",
    glow: "bg-[#3b82f6]/16",
    number: "text-[#bfdbfe]",
    chip: "border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#dbeafe]"
  },
  {
    edge: "border-[#ec4899]/45",
    glow: "bg-[#ec4899]/15",
    number: "text-[#fbcfe8]",
    chip: "border-[#ec4899]/30 bg-[#ec4899]/10 text-[#fce7f3]"
  },
  {
    edge: "border-[#a78bfa]/45",
    glow: "bg-[#a78bfa]/15",
    number: "text-[#ddd6fe]",
    chip: "border-[#a78bfa]/30 bg-[#a78bfa]/10 text-[#ede9fe]"
  }
];

function resolveHref(site: Site, href: string, localBasePath?: string): string {
  if (href.startsWith("#")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (typeof localBasePath === "string") return localBasePath ? `${localBasePath}${href}` : href;
  const routedSite = site as RoutedSite;
  const basePath = routedSite.__storefrontBasePath;
  if (typeof basePath === "string") return basePath ? `${basePath}${href}` : href;
  return href;
}

function AnchorLink({
  children,
  className,
  dataVideoThemeCard,
  href,
  site,
  localBasePath
}: {
  children: ReactNode;
  className: string;
  dataVideoThemeCard?: string;
  href: string;
  site: Site;
  localBasePath?: string;
}) {
  return (
    <StorefrontInstantLink className={className} data-video-theme-card={dataVideoThemeCard} href={resolveHref(site, href, localBasePath)}>
      {children}
    </StorefrontInstantLink>
  );
}

function laneAnchor(groupLabel: string): string {
  return `video-lane-${groupLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function normalizedPath(value: string): string {
  const clean = value.trim().split(/[?#]/)[0] ?? "";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

export function AidreamcapesVideoDirectory({
  copy,
  navigation,
  sectionId,
  site,
  themeCovers = {}
}: {
  copy: AidreamcapesVideoDirectoryCopy;
  navigation: AidreamcapesZipNavigation;
  sectionId: string;
  site: Site;
  themeCovers?: Record<string, AidreamcapesVideoThemeCover>;
}) {
  const groups = navigation.video.groups;
  const items = groups.flatMap((group) => group.items);
  const localBasePath = (site as RoutedSite).__storefrontBasePath;
  const optimizeImages = site.id === "site_aidreamcapes";
  const getLaneCopy = (groupLabel: string) => copy.laneCopy.find((item) => item.groupLabel === groupLabel);

  return (
    <section
      className="relative isolate overflow-hidden bg-[#050505] px-5 pb-20 pt-12 text-white sm:px-8 sm:pb-28 sm:pt-16 lg:pt-20"
      data-aidreamcapes-video-directory="true"
      id={sectionId}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[10%] top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-[#8b5cf6]/12 blur-[130px]" />
        <div className="absolute right-[-8rem] top-[28rem] h-[30rem] w-[30rem] rounded-full bg-[#3b82f6]/10 blur-[130px]" />
        <div className="absolute bottom-[-10rem] left-[38%] h-[24rem] w-[24rem] rounded-full bg-[#ec4899]/8 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>

      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.96fr)] lg:items-end lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.045] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">
              <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#3b82f6] shadow-[0_0_14px_rgba(139,92,246,0.9)]" />
              {copy.eyebrow}
            </div>
            <h1 className="mt-7 max-w-4xl text-balance text-[clamp(3rem,7vw,6.7rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-white [font-family:var(--site-title-font)]">
              {copy.title}
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/62 sm:text-lg">
              {copy.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <AnchorLink
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#3b82f6] px-6 text-sm font-semibold text-white shadow-[0_18px_45px_-22px_rgba(139,92,246,0.95)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd]"
                href="#video-theme-directory"
                localBasePath={localBasePath}
                site={site}
              >
                {copy.browseLabel}
                <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
              </AnchorLink>
              <AnchorLink
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.045] px-6 text-sm font-semibold text-white/84 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b5fd]"
                href={navigation.actions.getStarted.href}
                localBasePath={localBasePath}
                site={site}
              >
                {navigation.actions.getStarted.label}
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
              </AnchorLink>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[28px] border border-white/12 bg-white/[0.045] p-5 shadow-[0_35px_100px_-65px_rgba(139,92,246,0.75)] sm:p-7">
            <div className="absolute right-[-4rem] top-[-5rem] h-40 w-40 rounded-full bg-[#8b5cf6]/18 blur-[60px]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/78">
                  <Layers3 className="h-4 w-4 text-[#c4b5fd]" strokeWidth={1.8} />
                  {copy.directoryNote}
                </div>
                <span className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
                  {items.length}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-2xl font-semibold tracking-tight text-white">{groups.length}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/42">{copy.statLabels.lanes}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-2xl font-semibold tracking-tight text-white">{items.length}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/42">{copy.statLabels.themes}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-2xl font-semibold tracking-tight text-white">{new Set(items.map((item) => item.href)).size}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/42">{copy.statLabels.routes}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-2">
                {groups.map((group, index) => {
                  const accent = laneAccents[index % laneAccents.length];
                  return (
                    <a
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3.5 transition hover:border-white/25 hover:bg-white/[0.075]"
                      href={`#${laneAnchor(group.label)}`}
                      key={group.label}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`text-xs font-semibold ${accent.number}`}>{String(index + 1).padStart(2, "0")}</span>
                        <span className="truncate text-sm font-semibold text-white/78">{group.label}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-white/42">
                        {group.items.length}
                        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-white" strokeWidth={1.8} />
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-20 border-y border-white/10 py-5" id="video-theme-directory">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
            <span>{copy.directoryNote}</span>
            <span>{items.length} {copy.statLabels.themes}</span>
          </div>
        </div>

        <div className="mt-10 grid gap-12 lg:gap-16">
          {groups.map((group, groupIndex) => {
            const accent = laneAccents[groupIndex % laneAccents.length];
            const groupCopy = getLaneCopy(group.label);
            return (
              <section className="scroll-mt-24" data-video-directory-group={group.label} id={laneAnchor(group.label)} key={group.label}>
                <div className="grid gap-6 border-b border-white/10 pb-6 lg:grid-cols-[minmax(260px,0.42fr)_minmax(0,0.58fr)] lg:items-end">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${accent.number}`}>{String(groupIndex + 1).padStart(2, "0")}</span>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${accent.chip}`}>
                        {copy.laneCountLabel}
                      </span>
                    </div>
                    <h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">{group.label}</h2>
                  </div>
                  <div className="max-w-2xl lg:justify-self-end">
                    {groupCopy ? <p className="text-base leading-7 text-white/60">{groupCopy.intro}</p> : null}
                    {groupCopy ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/38">{groupCopy.focusLabel} <span className="text-white/70">{groupCopy.focus}</span></p> : null}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((item, itemIndex) => {
                    const cover = themeCovers[normalizedPath(item.href)];
                    return (
                    <AnchorLink
                      className={`group relative overflow-hidden rounded-[20px] border ${accent.edge} bg-white/[0.035] transition duration-300 hover:-translate-y-1 hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]`}
                      dataVideoThemeCard={item.href}
                      href={item.href}
                      key={`${group.label}-${item.label}-${item.href}-${itemIndex}`}
                      localBasePath={localBasePath}
                      site={site}
                    >
                      <span className="relative block aspect-[16/9] overflow-hidden bg-[#17131f]" data-video-theme-cover={item.href}>
                        {cover ? optimizeImages ? <AidreamcapesResponsiveImage alt={cover.alt || `${item.label} theme cover`} className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100" decoding="async" fetchPriority={groupIndex === 0 && itemIndex === 0 ? "high" : "low"} loading={groupIndex === 0 && itemIndex === 0 ? "eager" : "lazy"} sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw" src={cover.src} /> : <img alt={cover.alt || `${item.label} theme cover`} className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100" decoding="async" loading={groupIndex === 0 && itemIndex < 3 ? "eager" : "lazy"} src={cover.src} /> : null}
                        <span className={`absolute inset-0 ${cover ? "bg-gradient-to-t from-[#08090d]/80 via-transparent to-transparent" : accent.glow}`} />
                        <span className="absolute left-4 top-4 rounded-full border border-white/[0.16] bg-black/[0.28] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.74] backdrop-blur">{String(itemIndex + 1).padStart(2, "0")}</span>
                        <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-white/[0.62] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" strokeWidth={1.8} />
                      </span>
                      <span className="relative block p-5">
                        <span className="block text-lg font-semibold leading-tight tracking-[-0.02em] text-white/90">{item.label}</span>
                        <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-white/48 transition group-hover:text-white">
                          {copy.openLabel}
                          <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" strokeWidth={1.8} />
                        </span>
                      </span>
                    </AnchorLink>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-24 grid gap-8 rounded-[30px] border border-white/12 bg-white/[0.045] p-6 sm:p-8 lg:grid-cols-[0.86fr_1.14fr] lg:p-10" data-video-directory-workflow>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c4b5fd]">{copy.workflow.eyebrow}</p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-4xl">{copy.workflow.title}</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/60">{copy.workflow.body}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {copy.workflow.steps.map((step, index) => (
              <article className="rounded-[22px] border border-white/10 bg-black/20 p-5" key={`${step.title}-${index}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] text-xs font-semibold text-[#ddd6fe]">{String(index + 1).padStart(2, "0")}</span>
                  <Check className="h-4 w-4 text-[#a7f3d0]" strokeWidth={2} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="relative mt-10 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#e0f2fe] p-7 text-[#0f172a] sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10" data-video-directory-cta>
          <div className="absolute right-[-3rem] top-[-4rem] h-44 w-44 rounded-full bg-[#8b5cf6]/15 blur-[55px]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6d28d9]">{copy.finalCta.eyebrow}</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">{copy.finalCta.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{copy.finalCta.body}</p>
          </div>
          <div className="relative mt-7 flex shrink-0 flex-wrap gap-3 lg:mt-0">
            <AnchorLink
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0f172a] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#1e293b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8b5cf6]"
              href={copy.finalCta.primaryHref}
              localBasePath={localBasePath}
              site={site}
            >
              {copy.finalCta.primaryLabel}
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
            </AnchorLink>
            <AnchorLink
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white/60 px-6 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8b5cf6]"
              href={copy.finalCta.secondaryHref}
              localBasePath={localBasePath}
              site={site}
            >
              {copy.finalCta.secondaryLabel}
              <Sparkles className="h-4 w-4" strokeWidth={1.8} />
            </AnchorLink>
          </div>
        </section>
      </div>
    </section>
  );
}
