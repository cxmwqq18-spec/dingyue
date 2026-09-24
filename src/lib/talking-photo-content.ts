import type { SectionInstance, ThemeSettingValue } from "@/lib/types";

export type TalkingPhotoImage = {
  src: string;
  alt: string;
  objectPosition?: string;
};

export type TalkingPhotoVideo = {
  src: string;
  poster: string;
  /** Optional accessible description for the rendered video element. */
  alt?: string;
  label: string;
  width: number;
  height: number;
  fit: "cover" | "contain";
  subtitleUrl?: string;
  subtitleLanguage?: string;
  subtitleLabel?: string;
};

export type TalkingPhotoUseCase = {
  title: string;
  problem: string;
  body: string;
  script: string;
  cta: string;
  image: TalkingPhotoImage;
};

export type TalkingPhotoFaq = {
  question: string;
  answer: string;
};

export type TalkingPhotoContent = {
  seo: { title: string; description: string; keywords: string; canonicalPath: string };
  hero: { eyebrow: string; title: string; body: string; primaryCta: string; secondaryCta: string; rightsCopy: string; caption: string; availabilityNote: string; image: TalkingPhotoImage; video?: TalkingPhotoVideo };
  useCases: { eyebrow: string; title: string; intro: string; items: TalkingPhotoUseCase[] };
  sourcePhoto: { eyebrow: string; title: string; intro: string; useTitle: string; useItems: string[]; avoidTitle: string; avoidItems: string[]; expertTip: string };
  script: { eyebrow: string; title: string; intro: string; rules: Array<{ title: string; body: string; exampleTitle?: string; exampleBody?: string }> };
  steps: { eyebrow: string; title: string; items: Array<{ title: string; body: string }>; cta: string };
  value: { eyebrow: string; title: string; items: Array<{ title: string; body: string }> };
  trust: { eyebrow: string; title: string; body: string; items: Array<{ title: string; body: string }> };
  faq: { eyebrow: string; title: string; items: TalkingPhotoFaq[] };
  finalCta: { eyebrow: string; title: string; body: string; cta: string; microcopy: string };
};

function record(value: ThemeSettingValue | undefined): Record<string, ThemeSettingValue> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, ThemeSettingValue> : undefined;
}

function text(value: ThemeSettingValue | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function video(value: ThemeSettingValue | undefined): boolean {
  const candidate = record(value);
  return Boolean(
    candidate && text(candidate.src) && text(candidate.poster) && text(candidate.label) &&
    typeof candidate.width === "number" && typeof candidate.height === "number" &&
    (candidate.fit === "cover" || candidate.fit === "contain")
  );
}

function content(value: ThemeSettingValue | undefined): TalkingPhotoContent | undefined {
  const candidate = record(value);
  const seo = candidate && record(candidate.seo);
  const hero = candidate && record(candidate.hero);
  const useCases = candidate && record(candidate.useCases);
  const sourcePhoto = candidate && record(candidate.sourcePhoto);
  const script = candidate && record(candidate.script);
  const steps = candidate && record(candidate.steps);
  const valueSection = candidate && record(candidate.value);
  const trust = candidate && record(candidate.trust);
  const faq = candidate && record(candidate.faq);
  const finalCta = candidate && record(candidate.finalCta);
  const image = hero && record(hero.image);
  const valid = Boolean(
    candidate && seo && hero && useCases && sourcePhoto && script && steps && valueSection && trust && faq && finalCta && image &&
    text(seo.title) && text(seo.description) && text(seo.keywords) && text(seo.canonicalPath) &&
    text(hero.title) && text(image.src) && text(image.alt) && (!hero.video || video(hero.video)) &&
    Array.isArray(useCases.items) && Array.isArray(sourcePhoto.useItems) && Array.isArray(sourcePhoto.avoidItems) &&
    Array.isArray(script.rules) && Array.isArray(steps.items) && Array.isArray(valueSection.items) && Array.isArray(trust.items) && Array.isArray(faq.items)
  );
  return valid ? value as unknown as TalkingPhotoContent : undefined;
}

export function talkingPhotoContentFromSection(section: SectionInstance): TalkingPhotoContent | undefined {
  return content(section.settings.content);
}
