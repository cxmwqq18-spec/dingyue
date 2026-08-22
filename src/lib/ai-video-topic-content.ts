import type { SectionInstance, ThemeSettingValue } from "@/lib/types";

export type AiVideoTopicImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  objectPosition?: string;
};

export type AiVideoTopicCard = {
  title: string;
  body: string;
  image?: AiVideoTopicImage;
  noteLabel?: string;
  noteBody?: string;
  exampleLabel?: string;
  exampleBody?: string;
  details?: Array<{ label: string; body: string }>;
  href?: string;
  linkLabel?: string;
};

export type AiVideoTopicUseCase = AiVideoTopicCard & {
  problem: string;
  cta: string;
  image: AiVideoTopicImage;
  scenarioLabel?: string;
};

export type AiVideoTopicFoundation = {
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
  cards?: AiVideoTopicCard[];
};

export type AiVideoTopicGuidance = {
  eyebrow: string;
  title: string;
  intro?: string;
  cards: AiVideoTopicCard[];
};

export type AiVideoTopicSection = {
  eyebrow: string;
  title: string;
  intro?: string;
  items: Array<{ title: string; body: string }>;
  image?: AiVideoTopicImage;
};

export type AiVideoTopicFaqItem = {
  question: string;
  answer: string;
};

/**
 * The complete topic body is stored in ThemePage JSON. This type defines the
 * published contract rendered by the shared landing component.
 */
export type AiVideoTopicLandingContent = {
  seo: {
    title: string;
    description: string;
    keywords: string;
    canonicalPath: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    availabilityNote: string;
    rightsCopy: string;
    imageNote: string;
    image: AiVideoTopicImage;
    images?: AiVideoTopicImage[];
    highlights?: string[];
    mediaAspectRatio?: string;
    imageFit?: "cover" | "contain";
  };
  quickAnswer?: AiVideoTopicGuidance;
  useCases: {
    eyebrow: string;
    title: string;
    intro: string;
    items: AiVideoTopicUseCase[];
  };
  gallery?: {
    eyebrow: string;
    title: string;
    intro: string;
    items: AiVideoTopicCard[];
    cta?: string;
    ctaHref?: string;
  };
  foundation: AiVideoTopicFoundation;
  guidance: AiVideoTopicGuidance;
  platformExamples?: {
    eyebrow: string;
    title: string;
    intro: string;
    items: AiVideoTopicCard[];
  };
  comparison?: {
    eyebrow: string;
    title: string;
    intro: string;
    items: AiVideoTopicCard[];
  };
  evidence?: AiVideoTopicGuidance;
  examples?: AiVideoTopicGuidance;
  steps: {
    eyebrow: string;
    title: string;
    items: Array<{ title: string; body: string }>;
    cta: string;
  };
  value: AiVideoTopicSection;
  trust: AiVideoTopicSection;
  faq: {
    eyebrow: string;
    title: string;
    items: AiVideoTopicFaqItem[];
  };
  finalCta: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    microcopy: string;
  };
};

function record(value: ThemeSettingValue | undefined): Record<string, ThemeSettingValue> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, ThemeSettingValue> : undefined;
}

function text(value: ThemeSettingValue | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function image(value: ThemeSettingValue | undefined): boolean {
  const candidate = record(value);
  return Boolean(candidate && text(candidate.src) && text(candidate.alt) && typeof candidate.width === "number" && typeof candidate.height === "number");
}

function topicContent(value: ThemeSettingValue | undefined): AiVideoTopicLandingContent | undefined {
  const candidate = record(value);
  const seo = candidate && record(candidate.seo);
  const hero = candidate && record(candidate.hero);
  const useCases = candidate && record(candidate.useCases);
  const foundation = candidate && record(candidate.foundation);
  const guidance = candidate && record(candidate.guidance);
  const steps = candidate && record(candidate.steps);
  const valueSection = candidate && record(candidate.value);
  const trust = candidate && record(candidate.trust);
  const faq = candidate && record(candidate.faq);
  const finalCta = candidate && record(candidate.finalCta);
  const valid = Boolean(
    candidate && seo && hero && useCases && foundation && guidance && steps && valueSection && trust && faq && finalCta &&
    text(seo.title) && text(seo.description) && text(seo.keywords) && text(seo.canonicalPath) &&
    text(hero.title) && image(hero.image) &&
    Array.isArray(useCases.items) && Array.isArray(guidance.cards) && Array.isArray(steps.items) &&
    Array.isArray(valueSection.items) && Array.isArray(trust.items) && Array.isArray(faq.items)
  );
  return valid ? value as unknown as AiVideoTopicLandingContent : undefined;
}

export function aiVideoTopicLandingContentFromSection(section: SectionInstance): AiVideoTopicLandingContent | undefined {
  return topicContent(section.settings.content);
}
