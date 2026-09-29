import type { SectionBlockInstance, SectionInstance, Site } from "@/lib/types";
import type { StorefrontContext } from "@/lib/storefront-context/types";
import { AidreamcapesResponsiveImage } from "@/components/storefront/aidreamcapes-responsive-image";
import { AidreamcapesVideoPreview } from "@/components/storefront/aidreamcapes-video-preview";
import { isRetiredAidreamcapesPublicPath } from "@/lib/aidreamcapes-image-theme-routes";

type SqlProduct = ReturnType<typeof import("@/lib/data").getSiteProducts>[number];

type AidreamcapesZipHomepageProps = {
  id: string;
  section: SectionInstance;
  site: Site;
  products?: SqlProduct[];
  storefrontContext?: StorefrontContext;
  resolveAsset: (value: string) => string;
  resolveHref: (value: string) => string;
};

const read = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return fallback;
};

const setting = (section: SectionInstance, key: string, fallback = "") =>
  read(section.settings[key], fallback);
const blockValue = (block: SectionBlockInstance, key: string, fallback = "") =>
  read(block.settings[key], fallback);
const blocks = (section: SectionInstance) => section.blocks ?? [];

function Media({
  alt,
  className,
  fetchPriority,
  height,
  loading = "lazy",
  resolveAsset,
  src,
  width,
}: {
  alt: string;
  className: string;
  fetchPriority?: "high" | "low" | "auto";
  height: string;
  loading?: "eager" | "lazy";
  resolveAsset: (value: string) => string;
  src: string;
  width: string;
}) {
  if (!src) return null;
  const resolvedSrc = resolveAsset(src);
  const numericWidth = Number(width);
  const numericHeight = Number(height);
  return (
    <AidreamcapesResponsiveImage
      alt={alt}
      className={className}
      decoding="async"
      fetchPriority={fetchPriority ?? (loading === "eager" ? "high" : "auto")}
      height={numericHeight > 1 ? numericHeight : undefined}
      loading={loading}
      sizes="(max-width: 1023px) 100vw, 50vw"
      src={resolvedSrc}
      width={numericWidth > 1 ? numericWidth : undefined}
    />
  );
}

function BlockImage({
  className,
  eager = false,
  fetchPriority,
  resolveAsset,
  source,
}: {
  className: string;
  eager?: boolean;
  fetchPriority?: "high" | "low" | "auto";
  resolveAsset: (value: string) => string;
  source: SectionInstance | SectionBlockInstance;
}) {
  const sourceSettings = source.settings;
  const src = read(sourceSettings.imageUrl);
  const alt = read(sourceSettings.imageAlt);
  const width = read(sourceSettings.imageWidth, "1");
  const height = read(sourceSettings.imageHeight, "1");
  if (!src) return null;
  return (
    <Media
      alt={alt}
      className={className}
      fetchPriority={fetchPriority}
      height={height}
      loading={eager ? "eager" : "lazy"}
      resolveAsset={resolveAsset}
      src={src}
      width={width}
    />
  );
}

function BlockVideo({
  className,
  eager = false,
  resolveAsset,
  source,
}: {
  className: string;
  eager?: boolean;
  resolveAsset: (value: string) => string;
  source: SectionInstance | SectionBlockInstance;
}) {
  const sourceSettings = source.settings;
  const src = read(sourceSettings.videoUrl);
  if (!src) return null;
  const poster = read(sourceSettings.videoPosterUrl) || read(sourceSettings.imageUrl);
  const triggerClassName = className.includes("absolute") ? "absolute inset-0 min-h-[200px]" : "relative h-full w-full";
  return (
    <AidreamcapesVideoPreview
      alt={read(sourceSettings.videoAlt) || read(sourceSettings.imageAlt) || "Aidreamcapes video preview"}
      className={triggerClassName}
      deferLoading={!eager}
      nearViewportPreload={eager ? "auto" : "metadata"}
      poster={poster ? resolveAsset(poster) : undefined}
      src={resolveAsset(src)}
      videoClassName={className}
    />
  );
}

function BlockMedia({
  className,
  eager = false,
  resolveAsset,
  source,
}: {
  className: string;
  eager?: boolean;
  resolveAsset: (value: string) => string;
  source: SectionInstance | SectionBlockInstance;
}) {
  return read(source.settings.videoUrl)
    ? <BlockVideo className={className} eager={eager} resolveAsset={resolveAsset} source={source} />
    : <BlockImage className={className} eager={eager} resolveAsset={resolveAsset} source={source} />;
}

function LinkButton({
  children,
  href,
  primary,
  resolveHref,
}: {
  children: string;
  href: string;
  primary?: boolean;
  resolveHref: (value: string) => string;
}) {
  return (
    <a
      className={
        primary
          ? "relative inline-block overflow-hidden rounded-full p-[1px] group"
          : "rounded-full border border-white/10 bg-white/5 px-8 py-3.5 text-center font-medium text-white transition-colors hover:bg-white/10"
      }
      href={resolveHref(href)}
    >
      {primary ? (
        <>
          <span className="absolute inset-0 bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#3b82f6] opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="relative block rounded-full bg-[#050505] px-8 py-3.5 text-center font-medium text-white transition-all group-hover:bg-opacity-0">
            {children}
          </span>
        </>
      ) : (
        children
      )}
    </a>
  );
}

function HeroTrustCard({
  section,
  resolveHref,
}: {
  section: SectionInstance;
  resolveHref: (value: string) => string;
}) {
  const trustItems = blocks(section).filter((block) => block.type === "trust_item");
  return (
    <div className="glass-card max-w-md rounded-2xl border border-white/10 p-5">
      <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500">
        <span className="h-1.5 w-1.5 rounded-full bg-[#8b5cf6]" />
        {setting(section, "trustEyebrow")}
      </div>
      <a
        className="mb-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black transition-colors hover:bg-gray-100"
        href={resolveHref(setting(section, "googleHref"))}
      >
        <svg aria-hidden="true" height="18" viewBox="0 0 48 48" width="18">
          <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" fill="#FFC107" />
          <path d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.1 4 9.2 8.5 6.3 14.7z" fill="#FF3D00" />
          <path d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 36 26.8 37 24 37c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.1 39.4 16 44 24 44z" fill="#4CAF50" />
          <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l.1.1 6.3 5.2C39.2 37.3 44 32 44 24c0-1.3-.1-2.5-.4-3.5z" fill="#1976D2" />
        </svg>
        {setting(section, "googleCta")}
      </a>
      <div className="mb-3 text-center text-xs text-gray-500">{setting(section, "emailSeparator")}</div>
      <div className="flex gap-2">
        <input
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#8b5cf6]/50"
          placeholder={setting(section, "emailPlaceholder")}
          type="email"
        />
        <a
          className="flex h-11 items-center whitespace-nowrap rounded-xl bg-[#8b5cf6] px-4 text-sm font-semibold text-white hover:bg-[#8b5cf6]/90"
          href={resolveHref(setting(section, "emailHref"))}
        >
          {setting(section, "emailCta")}
        </a>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-gray-500">
        {trustItems.map((item, index) => (
          <span key={item.id}>
            {index ? "· " : ""}{blockValue(item, "label")}
          </span>
        ))}
      </div>
    </div>
  );
}

function Hero({
  section,
  resolveAsset,
  resolveHref,
}: {
  section: SectionInstance;
  resolveAsset: (value: string) => string;
  resolveHref: (value: string) => string;
}) {
  const outputImage: SectionBlockInstance = {
    id: "hero-output-image",
    type: "media",
    settings: {
      imageUrl: setting(section, "outputImageUrl"),
      imageAlt: setting(section, "outputImageAlt"),
      imageWidth: setting(section, "outputImageWidth"),
      imageHeight: setting(section, "outputImageHeight"),
      videoUrl: setting(section, "outputVideoUrl"),
      videoPosterUrl: setting(section, "outputVideoPosterUrl", setting(section, "outputImageUrl")),
      videoAlt: setting(section, "outputVideoAlt", setting(section, "outputImageAlt")),
    },
  };
  return (
    <>
      <div className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center overflow-hidden bg-[#050505] px-6 pb-20 pt-32 text-white" data-aidreamcapes-section="hero">
        <div className="pointer-events-none absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-[#8b5cf6]/20 blur-[120px] mix-blend-screen" />
        <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-[#3b82f6]/20 blur-[100px] mix-blend-screen" />
        <div className="relative z-10 mt-10 grid items-center gap-16 lg:grid-cols-2">
          <div className="max-w-xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#8b5cf6]" />
              {setting(section, "eyebrow")}
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-[1.1] tracking-tight lg:text-7xl">
              <span>{setting(section, "titleLine1")}</span>
              <br />
              <span className="text-gradient">{setting(section, "titleAccent")}</span>
              <br />
              <span>{setting(section, "titleLine3")}</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg leading-relaxed text-gray-400">
              {setting(section, "intro")}
            </p>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row">
              <LinkButton
                href={setting(section, "primaryHref")}
                primary
                resolveHref={resolveHref}
              >
                {setting(section, "primaryCta")}
              </LinkButton>
              <LinkButton
                href={setting(section, "secondaryHref")}
                resolveHref={resolveHref}
              >
                {setting(section, "secondaryCta")}
              </LinkButton>
            </div>
            <HeroTrustCard section={section} resolveHref={resolveHref} />
          </div>
          <div className="relative mt-12 rounded-3xl bg-gradient-to-b from-white/10 to-transparent p-1 shadow-2xl lg:mt-0 lg:h-[600px]">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#3b82f6] opacity-20 blur-xl" />
            <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[23px] border border-white/5 bg-[#0a0a0a]">
              <div className="flex h-12 items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4">
                <span className="h-3 w-3 rounded-full bg-gray-600" />
                <span className="h-3 w-3 rounded-full bg-gray-600" />
                <span className="h-3 w-3 rounded-full bg-gray-600" />
                <span className="mx-auto font-mono text-xs text-gray-500">
                  {setting(section, "studioUrl")}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-[#8b5cf6]">
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  {setting(section, "studioWorkflowLabel")}
                </div>
                <p className="mb-2 text-[11px] text-gray-500">
                  {setting(section, "studioWorkflowIntro")}
                </p>
                <div className="grid flex-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                  <div className="relative flex min-h-[200px] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-gray-200">
                      {setting(section, "studioProductLabel")}
                    </span>
                    <BlockImage
                      className="h-full min-h-[200px] w-full flex-1 object-cover"
                      eager
                      resolveAsset={resolveAsset}
                      source={section}
                    />
                    <div className="border-t border-white/5 p-2 text-[10px] text-gray-400">
                      {setting(section, "studioProductFilename")}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2 px-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/20 text-sm text-[#8b5cf6]">
                      →
                    </div>
                    <div className="hidden w-16 flex-col items-center gap-1 sm:flex">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#3b82f6]" />
                      </div>
                      <span className="text-[9px] text-gray-500">
                        {setting(section, "studioProcessLabel")}
                      </span>
                    </div>
                  </div>
                  <div className="relative flex min-h-[200px] flex-col overflow-hidden rounded-xl border border-[#8b5cf6]/30 bg-white/5 shadow-[0_0_24px_rgba(139,92,246,0.15)]">
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-[#8b5cf6] px-2 py-0.5 text-[10px] text-white">
                      {setting(section, "studioOutputLabel")}
                    </span>
                    <BlockMedia
                      className="absolute inset-0 h-full w-full object-cover opacity-80"
                      eager
                      resolveAsset={resolveAsset}
                      source={outputImage}
                    />
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <span className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/20 text-white">
                        <svg aria-hidden="true" className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    </div>
                    <div className="relative mt-auto bg-gradient-to-t from-black/80 to-transparent p-2 text-[10px] text-white">
                      {setting(section, "studioOutputMeta")}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-500">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center">
                    {setting(section, "studioStep1")}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center">
                    {setting(section, "studioStep2")}
                  </div>
                  <div className="rounded-lg border border-white/[0.03] bg-white/[0.03] px-2 py-1.5 text-center">
                    {setting(section, "studioStep3")}
                  </div>
                </div>
                <a
                  className="mt-auto flex h-12 items-center justify-center rounded-lg bg-[#8b5cf6] text-sm font-medium text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-colors hover:bg-[#8b5cf6]/90"
                  href={resolveHref(
                    setting(section, "outputHref"),
                  )}
                >
                  {setting(section, "outputCta")}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-6 px-6 py-10 text-center md:grid-cols-4 md:text-left">
          {blocks(section).filter((block) => block.type === "stat").map((block) => (
            <div key={block.id}>
              <div className="text-2xl font-bold">{blockValue(block, "value")}</div>
              <div className="mt-1 text-xs text-gray-500">{blockValue(block, "label")}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SectionHeading({
  cta,
  ctaHref,
  intro,
  resolveHref,
  title,
}: {
  cta?: string;
  ctaHref?: string;
  intro: string;
  resolveHref: (value: string) => string;
  title: string;
}) {
  return (
    <div className="mb-12 flex items-end justify-between gap-5">
      <div>
        <h2 className="mb-2 text-3xl font-bold">{title}</h2>
        <p className="text-gray-400">{intro}</p>
      </div>
      {cta && ctaHref ? (
        <a
          className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          href={resolveHref(ctaHref)}
        >
          {cta} <span className="text-[#8b5cf6]">→</span>
        </a>
      ) : null}
    </div>
  );
}

function VideoGrid({
  id,
  resolveAsset,
  resolveHref,
  section,
}: AidreamcapesZipHomepageProps) {
  return (
    <section
      className="border-t border-white/5 bg-[#050505] px-6 py-24 text-white"
      data-aidreamcapes-section="video-grid"
      id={id}
    >
      <div className="mx-auto max-w-[1400px]">
        <SectionHeading
          cta={setting(section, "ctaLabel")}
          ctaHref={setting(section, "ctaHref")}
          intro={setting(section, "intro")}
          resolveHref={resolveHref}
          title={setting(section, "title")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {blocks(section).filter((block) => block.type === "video_card").map((block) => (
            <a
              className="glass-card group relative block aspect-[4/5] cursor-pointer overflow-hidden rounded-xl"
              href={resolveHref(blockValue(block, "href"))}
              key={block.id}
            >
              <BlockMedia
                className="h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                resolveAsset={resolveAsset}
                source={block}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              {blockValue(block, "badge") ? (
                <div className="absolute left-3 top-3 rounded-full bg-[#ec4899]/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {blockValue(block, "badge")}
                </div>
              ) : null}
              <div className="absolute bottom-0 left-0 p-4">
                <h3 className="text-sm font-medium text-white">{blockValue(block, "title")}</h3>
                <p className="mt-1 text-xs text-gray-400">{blockValue(block, "description")}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function AdTesting({
  id,
  resolveAsset,
  resolveHref,
  section,
}: AidreamcapesZipHomepageProps) {
  const urlCard = blocks(section).find((block) => block.type === "url_to_ad");
  const outputCards = blocks(section).filter((block) => block.type === "workflow_output");
  const featureCards = blocks(section).filter((block) => block.type === "ad_feature");
  const hookCard = featureCards[0];
  const actorCard = featureCards[1];
  return (
    <section
      className="relative overflow-hidden border-t border-white/5 bg-[#0a0a0a] px-6 py-24 text-white"
      data-aidreamcapes-section="ad-testing"
      id={id}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-[#ec4899]/10 blur-[150px]" />
      <div className="relative mx-auto max-w-[1400px]">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <span className="mb-3 block text-sm font-semibold uppercase tracking-wider text-[#ec4899]">
            {setting(section, "eyebrow")}
          </span>
          <h2 className="mb-4 text-3xl font-bold md:text-5xl">
            {setting(section, "title")}
          </h2>
          <p className="text-gray-400">
            {setting(section, "intro")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="glass-card group relative overflow-hidden rounded-2xl border border-white/10 p-8 md:col-span-2">
            <div className="absolute right-0 top-0 h-64 w-64 bg-[#8b5cf6]/20 blur-[80px]" />
            <h3 className="relative mb-2 text-2xl font-semibold">
              {setting(section, "workflowTitle")}
            </h3>
            <p className="relative mb-7 max-w-2xl text-sm text-gray-400">
              {setting(section, "workflowIntro")}
            </p>
            <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.2fr)]">
              <div className="flex min-h-[300px] flex-col rounded-xl border border-white/10 bg-[#050505] p-5 shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/20 font-semibold text-[#8b5cf6]">
                    1
                  </span>
                  <div>
                    <div className="text-sm font-semibold">
                      {urlCard ? blockValue(urlCard, "title") : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      {urlCard ? blockValue(urlCard, "description") : null}
                    </div>
                  </div>
                </div>
                <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-gray-400">
                  {urlCard ? blockValue(urlCard, "urlPlaceholder") : null}
                </div>
                {urlCard ? <BlockImage
                  className="mt-auto h-44 w-full rounded-lg border border-white/10 object-cover"
                  resolveAsset={resolveAsset}
                  source={urlCard}
                /> : null}
              </div>
              <div className="hidden items-center justify-center px-1 lg:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/20 text-xl text-[#8b5cf6]">
                  →
                </div>
              </div>
              <div className="flex min-h-[300px] flex-col rounded-xl border border-[#8b5cf6]/30 bg-[#050505] p-5 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8b5cf6] font-semibold text-white">
                    2
                  </span>
                  <div>
                    <div className="text-sm font-semibold">
                      {setting(section, "outputTitle")}
                    </div>
                    <div className="text-xs text-gray-500">
                      {setting(section, "outputIntro")}
                    </div>
                  </div>
                </div>
                <div className="grid flex-1 grid-cols-3 gap-3">
                  {outputCards.map((block) => <BlockMedia
                    className="h-full min-h-[210px] w-full rounded-lg border border-white/10 object-cover"
                    resolveAsset={resolveAsset}
                    source={block}
                    key={block.id}
                  />)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="glass-card flex-1 rounded-2xl border border-white/10 p-6">
              <h3 className="mb-2 text-lg font-semibold text-white">
                {hookCard ? blockValue(hookCard, "title") : null}
              </h3>
              <p className="mb-4 text-xs text-gray-400">
                {hookCard ? blockValue(hookCard, "description") : null}
              </p>
              {hookCard ? <BlockMedia
                className="h-36 w-full rounded-xl border border-white/10 object-cover"
                resolveAsset={resolveAsset}
                source={hookCard}
              /> : null}
            </div>
            <div className="glass-card flex-1 rounded-2xl border border-white/10 p-6">
              <h3 className="mb-2 text-lg font-semibold text-white">
                {actorCard ? blockValue(actorCard, "title") : null}
              </h3>
              <p className="mb-4 text-xs text-gray-400">
                {actorCard ? blockValue(actorCard, "description") : null}
              </p>
              {actorCard ? <BlockMedia
                className="mb-4 h-40 w-full rounded-xl border border-white/10 object-cover"
                resolveAsset={resolveAsset}
                source={actorCard}
              /> : null}
              <a
                className="text-sm text-[#3b82f6] transition-colors hover:text-white"
                href={resolveHref(actorCard ? blockValue(actorCard, "href") : "")}
              >
                {actorCard ? blockValue(actorCard, "ctaLabel") : null}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhotoGrid({
  id,
  resolveAsset,
  resolveHref,
  section,
}: AidreamcapesZipHomepageProps) {
  return (
    <section
      className="border-t border-white/5 bg-[#050505] px-6 py-24 text-white"
      data-aidreamcapes-section="photo-grid"
      id={id}
    >
      <div className="mx-auto max-w-[1400px]">
        <SectionHeading
          cta={setting(section, "ctaLabel")}
          ctaHref={setting(section, "ctaHref")}
          intro={setting(section, "intro")}
          resolveHref={resolveHref}
          title={setting(section, "title")}
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {blocks(section).filter((block) => block.type === "photo_card").map((block) => {
            const card = (
              <>
                <BlockImage
                  className="h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-105"
                  resolveAsset={resolveAsset}
                  source={block}
                />
                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black to-transparent p-3">
                  <p className="text-xs font-medium text-white">{blockValue(block, "title")}</p>
                </div>
              </>
            );
            return blockValue(block, "href") ? (
              <a
                className="glass-card group relative block aspect-square overflow-hidden rounded-xl"
                href={resolveHref(blockValue(block, "href"))}
                key={block.id}
              >
                {card}
              </a>
            ) : (
              <div
                className="glass-card group relative aspect-square overflow-hidden rounded-xl"
                key={block.id}
              >
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ScenarioGrid({ id, resolveHref, section, site }: AidreamcapesZipHomepageProps) {
  const isAidreamcapesCom = site.id === "site_aidreamcapes";
  const configuredCtaHref = setting(section, "ctaHref");
  const ctaHref = isAidreamcapesCom && isRetiredAidreamcapesPublicPath("aidreamcapes", configuredCtaHref) ? "" : configuredCtaHref;
  const scenarioCards = blocks(section)
    .filter((block) => block.type === "scenario_card")
    .filter((block) => !isAidreamcapesCom || !isRetiredAidreamcapesPublicPath("aidreamcapes", blockValue(block, "href")));
  return (
    <section
      className="border-t border-white/5 bg-[#050505] px-6 py-24 text-white"
      data-aidreamcapes-section="scenarios"
      id={id}
    >
      <div className="mx-auto max-w-[1400px]">
        <SectionHeading
          cta={setting(section, "ctaLabel")}
          ctaHref={ctaHref}
          intro={setting(section, "intro")}
          resolveHref={resolveHref}
          title={setting(section, "title")}
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {scenarioCards.map((block) => {
            const tone = blockValue(block, "tone");
            return <a
              className="glass-card block rounded-2xl border border-white/10 p-5 transition-colors hover:border-white/20"
              href={resolveHref(blockValue(block, "href"))}
              key={block.id}
            >
              <div
                className={`mb-2 text-xs ${tone === "purple" ? "text-[#8b5cf6]" : tone === "pink" ? "text-[#ec4899]" : "text-[#3b82f6]"}`}
              >
                {blockValue(block, "category")}
              </div>
              <h3 className="mb-1 font-semibold">{blockValue(block, "title")}</h3>
              <p className="text-xs text-gray-400">{blockValue(block, "description")}</p>
            </a>
          })}
        </div>
      </div>
    </section>
  );
}

function NumberedCards({
  id,
  section,
  tone = "dark",
}: {
  id: string;
  section: SectionInstance;
  tone?: "dark" | "black";
}) {
  return (
    <section
      className={`border-t border-white/5 px-6 py-24 text-white ${tone === "dark" ? "bg-[#0a0a0a]" : "bg-[#050505]"}`}
      data-aidreamcapes-section={id}
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            {setting(section, "title")}
          </h2>
          <p className="text-gray-400">{setting(section, "intro")}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {blocks(section).map((block, index) => (
            <div
              className="glass-card rounded-2xl border border-white/10 p-6"
              key={block.id}
            >
              <div className="mb-4 font-mono text-xs text-[#8b5cf6]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <h3 className="mb-2 font-semibold">{blockValue(block, "title")}</h3>
              <p className="text-sm text-gray-400">{blockValue(block, "description")}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({
  products = [],
  resolveHref,
  section,
  storefrontContext,
}: {
  products?: SqlProduct[];
  resolveHref: (value: string) => string;
  section: SectionInstance;
  storefrontContext?: StorefrontContext;
}) {
  const configuredPlans = blocks(section).filter((block) => block.type === "plan");
  const activeOffers = storefrontContext?.offers.active ?? [];
  const priceFor = (productId: string) => {
    const offer = activeOffers.find((item) => item.product.id === productId && item.price.interval === "month");
    if (offer) return offer.price;
    const product = products.find((item) => item.id === productId);
    return product?.prices?.find((price) => price.interval === "month" && price.status !== "archived") ?? product?.prices?.[0];
  };
  const formatPrice = (productId: string) => {
    const price = priceFor(productId);
    if (!price) return "";
    return new Intl.NumberFormat("en-US", { currency: price.currency.toUpperCase(), style: "currency" }).format(price.amountCents / 100);
  };
  return (
    <section
      className="relative border-t border-white/5 bg-[#050505] px-6 py-24 text-white"
      data-aidreamcapes-section="pricing"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            {setting(section, "title")}
          </h2>
          <p className="text-gray-400">
            {setting(section, "subtitle")}
          </p>
          <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            <span className="rounded-full bg-white px-6 py-2 text-sm font-medium text-black">
              {setting(section, "billingMonthlyLabel")}
            </span>
            <a
              className="px-6 py-2 text-sm font-medium text-gray-400 transition-colors hover:text-white"
              href={resolveHref(setting(section, "pricingHref"))}
            >
              {setting(section, "billingYearlyLabel")} <span className="ml-1 text-[#ec4899]">{setting(section, "billingDiscountLabel")}</span>
            </a>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {configuredPlans.map((plan, index) => {
            const productId = blockValue(plan, "productId");
            const features = blockValue(plan, "features").split("|").filter(Boolean);
            const featured = blockValue(plan, "featured") === "true";
            return (
            <div
              className={`glass-card flex flex-col rounded-3xl border p-8 ${featured ? "relative -translate-y-4 border-[#8b5cf6]/50 shadow-[0_0_40px_rgba(139,92,246,0.1)]" : "border-white/10"}`}
              key={plan.id}
            >
              {featured ? (
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#8b5cf6] to-transparent" />
              ) : null}
              <div
                className={`mb-4 flex justify-between text-sm font-medium ${featured ? "text-[#8b5cf6]" : "text-gray-400"}`}
              >
                {blockValue(plan, "name")}
                {featured ? <span>{blockValue(plan, "badge")}</span> : null}
              </div>
              <div className="mb-2 text-4xl font-bold">
                {formatPrice(productId)}
                <span className="text-lg font-normal text-gray-500">{setting(section, "billingPeriodLabel")}</span>
              </div>
              <p className="mb-8 border-b border-white/5 pb-8 text-sm text-gray-400">
                {blockValue(plan, "description")}
              </p>
              <ul className="mb-8 flex-1 space-y-4 text-sm text-gray-300">
                {features.map((feature, featureIndex) => (
                  <li className="flex items-start gap-3" key={`${plan.id}-${featureIndex}`}>
                    <span className="text-[#8b5cf6]">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                className={`w-full rounded-full py-3 text-center text-sm font-medium transition-colors ${index === 1 ? "bg-white text-black hover:bg-gray-200" : "border border-white/10 bg-white/10 text-white hover:bg-white/20"}`}
                href={resolveHref(blockValue(plan, "href") || setting(section, "pricingHref"))}
              >
                {blockValue(plan, "cta")}
              </a>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Testimonials({
  resolveAsset,
  section,
}: {
  resolveAsset: (value: string) => string;
  section: SectionInstance;
}) {
  const reviewBlocks = blocks(section).filter(
    (block) => block.type === "testimonial",
  );
  return (
    <section
      className="mx-auto my-12 max-w-[1400px] overflow-hidden rounded-[3rem] bg-[#f8f9fa] px-6 py-24 text-[#111827]"
      data-aidreamcapes-section="testimonials"
    >
      <div className="relative z-10 mb-16 text-center">
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-400">
          Example workflows
        </div>
        <h2 className="mb-4 text-3xl font-bold md:text-4xl">
          {setting(section, "title")}
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-gray-500">
          {setting(section, "subtitle")}
        </p>
        <div aria-hidden="true" className="mt-6 flex justify-center gap-2">
          <div className="h-1 w-10 rounded-full bg-black" />
          <div className="h-1 w-2 rounded-full bg-gray-300" />
          <div className="h-1 w-2 rounded-full bg-gray-300" />
        </div>
      </div>
      <div className="relative z-10 mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
        {reviewBlocks.slice(0, 6).map((block, index) => {
          const name = blockValue(block, "name");
          const initials = name.split(/\s+/).map((part) => part.slice(0, 1)).join("").slice(0, 2).toUpperCase();
          const rating = Number.parseInt(blockValue(block, "rating"), 10) || 0;
          const avatarUrl = blockValue(block, "avatarUrl");
          const resultImageUrl = blockValue(block, "resultImageUrl");
          const themeLabel = blockValue(block, "role", "Theme");
          const resultLabel = blockValue(block, "location", "Generated result");
          const resultAlt = blockValue(block, "resultImageAlt") || `${name}'s ${resultLabel.toLowerCase()} generated with Aidreamcapes`;
          return (
          <div
            className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            data-review-card={block.id}
            key={block.id}
          >
            {resultImageUrl ? (
              <div className="relative aspect-[1.55] overflow-hidden bg-gray-100" data-review-result>
                <Media
                  alt={resultAlt}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  height="720"
                  resolveAsset={resolveAsset}
                  src={resultImageUrl}
                  width="1120"
                />
                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                  <span className="rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">Generated result</span>
                  <span className="rounded-full bg-white/85 px-2.5 py-1 text-gray-700 backdrop-blur-sm">{resultLabel}</span>
                </div>
              </div>
            ) : null}
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                {avatarUrl ? (
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm" data-review-avatar>
                    <Media
                      alt={`${name} avatar`}
                      className="h-full w-full object-cover"
                      height="96"
                      resolveAsset={resolveAsset}
                      src={avatarUrl}
                      width="96"
                    />
                  </div>
                ) : (
                  <div
                    aria-label={`${name} initials`}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${index % 3 === 0 ? "from-purple-500 to-indigo-500" : index % 3 === 1 ? "from-blue-500 to-cyan-500" : "from-pink-500 to-rose-500"} text-xs font-semibold text-white`}
                    data-review-avatar="fallback"
                  >
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{name}</div>
                  <div
                    aria-label={`${rating} out of 5 stars`}
                    className="text-xs text-yellow-400"
                  >
                    {"★".repeat(rating)}
                  </div>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">{themeLabel}</span>
                <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] text-gray-500">{resultLabel}</span>
              </div>
              <p className="text-sm leading-relaxed text-gray-600">“{blockValue(block, "quote")}"</p>
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}

function Faq({ resolveHref, section }: { resolveHref: (value: string) => string; section: SectionInstance }) {
  const faqBlocks = blocks(section).filter((block) => block.type === "faq_item");
  return (
    <section
      className="border-t border-white/5 bg-[#050505] px-6 py-24 text-white"
      data-aidreamcapes-section="faq"
      id="faq"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">{setting(section, "title")}</h2>
          <p className="text-sm text-gray-400">
            {setting(section, "subtitle")}
          </p>
        </div>
        <div className="space-y-3">
          {faqBlocks.map((block, index) => (
            <details
              className="glass-card rounded-2xl border border-white/10 p-5"
              key={block.id}
              open={index === 0}
            >
              <summary className="cursor-pointer list-none font-semibold">
                {blockValue(block, "question")}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                {blockValue(block, "answer") || blockValue(block, "body")}
              </p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center">
          <a
            className="text-sm text-[#8b5cf6] hover:text-white"
            href={resolveHref(setting(section, "fullFaqHref"))}
          >
            {setting(section, "fullFaqLabel")}
          </a>
        </p>
      </div>
    </section>
  );
}

function Conversion({
  resolveHref,
  section,
}: {
  resolveHref: (value: string) => string;
  section: SectionInstance;
}) {
  const audienceItems = blocks(section).filter((block) => block.type === "audience_item");
  return (
    <>
      <section
        className="border-t border-white/5 bg-[#050505] px-6 py-16 text-white"
        data-aidreamcapes-section="audience"
      >
        <div className="mx-auto max-w-[1400px] text-center">
          <p className="mb-6 text-sm text-gray-500">{setting(section, "audienceLabel")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {audienceItems.map((item) => (
              <span
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300"
                key={item.id}
              >
                {blockValue(item, "label")}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section
        className="mx-auto max-w-5xl bg-[#050505] px-6 py-24 text-white"
        data-aidreamcapes-section="cta"
      >
        <div className="flex flex-col items-center justify-between rounded-3xl bg-[#f8f9fa] p-12 text-[#111827] shadow-2xl md:flex-row md:p-16">
          <div className="mb-8 text-center md:mb-0 md:text-left">
            <h2 className="mb-2 text-3xl font-bold">
              {setting(section, "title")}
            </h2>
            <p className="text-gray-600">
              {setting(section, "subtitle")}
            </p>
          </div>
          <a
            className="rounded-full bg-[#050505] px-8 py-3 font-medium text-white transition-colors hover:bg-[#0a0a0a]"
            href={resolveHref(setting(section, "primaryHref"))}
          >
            {setting(section, "primaryCta")}
          </a>
        </div>
      </section>
    </>
  );
}

function SectionRenderer({
  id,
  products,
  resolveAsset,
  resolveHref,
  section,
  site,
  storefrontContext,
}: AidreamcapesZipHomepageProps) {
  if (section.type === "aidreamcapes_home_hero")
    return (
      <Hero
        section={section}
        resolveAsset={resolveAsset}
        resolveHref={resolveHref}
      />
    );
  if (section.type === "aidreamcapes_video_grid")
    return (
      <VideoGrid
        id={id}
        resolveAsset={resolveAsset}
        resolveHref={resolveHref}
        section={section}
        site={site}
      />
    );
  if (section.type === "aidreamcapes_ad_testing")
    return (
      <AdTesting
        id={id}
        resolveAsset={resolveAsset}
        resolveHref={resolveHref}
        section={section}
        site={site}
      />
    );
  if (section.type === "aidreamcapes_photo_grid")
    return (
      <PhotoGrid
        id={id}
        resolveAsset={resolveAsset}
        resolveHref={resolveHref}
        section={section}
        site={site}
      />
    );
  if (section.type === "aidreamcapes_scenario_grid")
    return (
      <ScenarioGrid
        id={id}
        resolveAsset={resolveAsset}
        resolveHref={resolveHref}
        section={section}
        site={site}
      />
    );
  if (section.type === "aidreamcapes_how_it_works")
    return (
      <NumberedCards
        id="how-it-works"
        section={section}
      />
    );
  if (section.type === "aidreamcapes_credit_rules")
    return (
      <NumberedCards
        id="credits"
        section={section}
        tone="black"
      />
    );
  if (section.type === "pricing_table")
    return <Pricing products={products} resolveHref={resolveHref} section={section} storefrontContext={storefrontContext} />;
  if (section.type === "testimonial_wall")
    return <Testimonials resolveAsset={resolveAsset} section={section} />;
  if (section.type === "faq") return <Faq resolveHref={resolveHref} section={section} />;
  if (section.type === "conversion_panel")
    return <Conversion resolveHref={resolveHref} section={section} />;
  return null;
}

export function AidreamcapesZipHomepageSection(
  props: AidreamcapesZipHomepageProps,
) {
  return (
    <div className="aidreamcapes-zip-homepage">
      <SectionRenderer {...props} />
    </div>
  );
}
