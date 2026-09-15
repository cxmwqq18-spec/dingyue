import type { SectionInstance, ThemeSettingValue } from "@/lib/types";

export type AiVideoTopicImage = {
  src: string;
  /** Raw provider asset used for the full-size preview/download. */
  imageOriginalUrl?: string;
  alt: string;
  width: number;
  height: number;
  objectPosition?: string;
};

export type AidreamcapesAdsTestingImage = AiVideoTopicImage & {
  loading: "eager" | "lazy";
  fetchPriority: "high" | "low" | "auto";
  sizes: string;
};

export type AiVideoTopicVideo = {
  src: string;
  poster: string;
  label: string;
  width: number;
  height: number;
  fit: "cover" | "contain";
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

export type AidreamcapesAdsTestingDetailContent = {
  layoutVariant: "ads-testing-detail" | "conversion-seeding-detail" | "promo-category-detail";
  seo: {
    title: string;
    description: string;
    keywords: string;
    canonicalPath: string;
    canonical: string;
    twitterDescription: string;
    ogImage: string;
    ogImageAlt: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: string;
    primaryCtaHref: string;
    secondaryCta: string;
    secondaryCtaHref: string;
    availabilityNote: string;
    rightsCopy: string;
    imageNote: string;
    productLabel: string;
    outputLabel: string;
    productImage: AidreamcapesAdsTestingImage;
    outputImage: AidreamcapesAdsTestingImage;
  };
  workflowOutput: AiVideoTopicGuidance;
  workflow: AiVideoTopicGuidance;
  creativeDirections: AiVideoTopicGuidance;
  examples: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<AiVideoTopicCard & { image: AidreamcapesAdsTestingImage }>;
  };
  adTesting: {
    eyebrow: string;
    title: string;
    intro: string;
    platforms: string[];
    checklist: string[];
  };
  requirements: AiVideoTopicGuidance;
  relatedWorkflows: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<AiVideoTopicCard & { href: string; linkLabel: string }>;
  };
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
    ctaHref: string;
    microcopy: string;
  };
};

export type AidreamcapesBrandCreatorDetailContent = Omit<AidreamcapesAdsTestingDetailContent, "layoutVariant"> & {
  layoutVariant: "brand-creator-detail";
  contentKey: string;
};

type LegacyUgcAdDetailImage = AiVideoTopicImage & {
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
};

export type AidreamcapesUgcAdDetailContent = {
  layoutVariant: "ugc-ad-detail" | "ads-testing-detail";
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    imageNote: string;
    primaryCta: string;
    primaryHref: string;
    secondaryCta: string;
    secondaryHref: string;
    availabilityNote: string;
    footnote: string;
    product: { label: string; image: LegacyUgcAdDetailImage };
    output: { label: string; image: LegacyUgcAdDetailImage };
  };
  workflowOutput: { eyebrow: string; title: string; ctaHref?: string; items: Array<{ title: string; body: string }> };
  workflow: { eyebrow: string; title: string; leadBody?: string; steps: Array<{ title: string; body: string }> };
  creativeDirections: { eyebrow: string; title: string; intro: string; items: Array<{ title: string; body: string }> };
  examples: { eyebrow: string; title: string; intro: string; ctaLabel?: string; ctaHref?: string; items: Array<{ label: string; title: string; image: LegacyUgcAdDetailImage }> };
  adTesting: { eyebrow: string; title: string; focusBody: string; formats: Array<{ label: string; value: string }>; checks: string[] };
  requirements: { eyebrow: string; title: string; intro: string; items: Array<{ label: string; body: string }> };
  relatedWorkflows: { eyebrow: string; title: string; items: Array<{ label: string; title: string; body: string; href: string; cta: string }> };
  faq: { eyebrow: string; title: string; intro?: string; items: AiVideoTopicFaqItem[] };
  finalCta: { eyebrow: string; title: string; body: string; cta: string; href: string; microcopy: string };
};

/**
 * The complete topic body is stored in ThemePage JSON. This type defines the
 * published contract rendered by the shared landing component.
 */
export type AiVideoTopicLandingContent = {
  layoutVariant?: "standard" | "ads-testing-detail" | "conversion-seeding-detail" | "promo-category-detail" | "ugc-ad-detail" | "brand-creator-detail";
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
    video?: AiVideoTopicVideo;
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
  adsTestingDetail?: AidreamcapesUgcAdDetailContent;
  ugcAdDetail?: AidreamcapesUgcAdDetailContent;
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

function adsTestingImage(value: ThemeSettingValue | undefined): boolean {
  const candidate = record(value);
  return Boolean(
    image(value) && candidate &&
    (candidate.loading === "eager" || candidate.loading === "lazy") &&
    (candidate.fetchPriority === "high" || candidate.fetchPriority === "low" || candidate.fetchPriority === "auto") &&
    text(candidate.sizes)
  );
}

function video(value: ThemeSettingValue | undefined): boolean {
  const candidate = record(value);
  return Boolean(
    candidate && text(candidate.src) && text(candidate.poster) && text(candidate.label) &&
    typeof candidate.width === "number" && typeof candidate.height === "number" &&
    (candidate.fit === "cover" || candidate.fit === "contain")
  );
}

function card(value: ThemeSettingValue | undefined, requireImage = false): boolean {
  const candidate = record(value);
  return Boolean(
    candidate && text(candidate.title) && text(candidate.body) &&
    (!requireImage || image(candidate.image))
  );
}

function guidance(value: ThemeSettingValue | undefined): boolean {
  const candidate = record(value);
  const items = candidate && (Array.isArray(candidate.items) ? candidate.items : candidate.cards);
  return Boolean(
    candidate && text(candidate.eyebrow) && text(candidate.title) &&
    Array.isArray(items) && items.every((item) => card(item))
  );
}

function legacyUgcAdDetailContent(value: ThemeSettingValue | undefined): value is AidreamcapesUgcAdDetailContent {
  const candidate = record(value);
  const hero = candidate && record(candidate.hero);
  const workflowOutput = candidate && record(candidate.workflowOutput);
  const workflow = candidate && record(candidate.workflow);
  const creativeDirections = candidate && record(candidate.creativeDirections);
  const examples = candidate && record(candidate.examples);
  const adTesting = candidate && record(candidate.adTesting);
  const requirements = candidate && record(candidate.requirements);
  const relatedWorkflows = candidate && record(candidate.relatedWorkflows);
  const faq = candidate && record(candidate.faq);
  const finalCta = candidate && record(candidate.finalCta);
  return Boolean(
    (candidate?.layoutVariant === "ugc-ad-detail" || candidate?.layoutVariant === "ads-testing-detail") && hero && workflowOutput && workflow && creativeDirections && examples && adTesting && requirements && relatedWorkflows && faq && finalCta &&
    text(hero.eyebrow) && text(hero.title) && text(hero.body) && text(hero.primaryCta) && text(hero.primaryHref) && text(hero.secondaryCta) && text(hero.secondaryHref) &&
    record(hero.product) && record(hero.output) && image(record(hero.product)?.image) && image(record(hero.output)?.image) &&
    Array.isArray(workflowOutput.items) && workflowOutput.items.length > 0 && Array.isArray(workflow.steps) && workflow.steps.length > 0 &&
    Array.isArray(creativeDirections.items) && creativeDirections.items.length > 0 && Array.isArray(examples.items) && examples.items.length > 0 &&
    examples.items.every((item) => record(item) && image(record(item)?.image)) && Array.isArray(adTesting.formats) && adTesting.formats.length > 0 &&
    Array.isArray(adTesting.checks) && adTesting.checks.length > 0 && Array.isArray(requirements.items) && requirements.items.length > 0 &&
    Array.isArray(relatedWorkflows.items) && relatedWorkflows.items.length > 0 && Array.isArray(faq.items) && faq.items.length > 0 &&
    text(finalCta.eyebrow) && text(finalCta.title) && text(finalCta.body) && text(finalCta.cta) && text(finalCta.href) && text(finalCta.microcopy)
  );
}

function adsTestingDetailContent(value: ThemeSettingValue | undefined): value is ThemeSettingValue {
  const candidate = record(value);
  const seo = candidate && record(candidate.seo);
  const hero = candidate && record(candidate.hero);
  const examples = candidate && record(candidate.examples);
  const adTesting = candidate && record(candidate.adTesting);
  const requirements = candidate && record(candidate.requirements);
  const relatedWorkflows = candidate && record(candidate.relatedWorkflows);
  const faq = candidate && record(candidate.faq);
  const finalCta = candidate && record(candidate.finalCta);
  return Boolean(
    (candidate?.layoutVariant === "ads-testing-detail" || candidate?.layoutVariant === "conversion-seeding-detail" || candidate?.layoutVariant === "promo-category-detail" || candidate?.layoutVariant === "brand-creator-detail") && seo && hero && examples && adTesting && requirements && relatedWorkflows && faq && finalCta &&
    text(seo.title) && text(seo.description) && text(seo.keywords) && text(seo.canonicalPath) && text(seo.canonical) &&
    text(seo.twitterDescription) && text(seo.ogImage) && text(seo.ogImageAlt) &&
    text(hero.eyebrow) && text(hero.title) && text(hero.body) && text(hero.primaryCta) && text(hero.primaryCtaHref) && text(hero.secondaryCta) && text(hero.secondaryCtaHref) &&
    text(hero.availabilityNote) && text(hero.rightsCopy) && text(hero.imageNote) && text(hero.productLabel) && text(hero.outputLabel) &&
    adsTestingImage(hero.productImage) && adsTestingImage(hero.outputImage) &&
    guidance(candidate.workflowOutput) && guidance(candidate.workflow) && guidance(candidate.creativeDirections) &&
    text(examples.eyebrow) && text(examples.title) && text(examples.intro) && Array.isArray(examples.items) &&
    examples.items.length > 0 && examples.items.every((item) => {
      const example = record(item);
      return Boolean(card(item, true) && example && adsTestingImage(example.image));
    }) &&
    text(adTesting.eyebrow) && text(adTesting.title) && text(adTesting.intro) && Array.isArray(adTesting.platforms) && adTesting.platforms.length > 0 &&
    Array.isArray(adTesting.checklist) && adTesting.checklist.length > 0 &&
    guidance(requirements) && text(relatedWorkflows.eyebrow) && text(relatedWorkflows.title) && text(relatedWorkflows.intro) &&
    Array.isArray(relatedWorkflows.items) && relatedWorkflows.items.length > 0 && relatedWorkflows.items.every((item) => {
      const related = record(item);
      return Boolean(related && card(related) && text(related.href) && text(related.linkLabel));
    }) &&
    text(faq.eyebrow) && text(faq.title) && Array.isArray(faq.items) && faq.items.length > 0 && faq.items.every((item) => {
      const faqItem = record(item);
      return Boolean(faqItem && text(faqItem.question) && text(faqItem.answer));
    }) &&
    text(finalCta.eyebrow) && text(finalCta.title) && text(finalCta.body) && text(finalCta.cta) && text(finalCta.ctaHref) && text(finalCta.microcopy)
  );
}

function topicContent(value: ThemeSettingValue | undefined): AiVideoTopicLandingContent | undefined {
  const candidate = record(value);
  if (adsTestingDetailContent(value)) return value as unknown as AiVideoTopicLandingContent;
  if (candidate?.layoutVariant === "ads-testing-detail" && legacyUgcAdDetailContent(candidate.adsTestingDetail)) return value as unknown as AiVideoTopicLandingContent;
  if (legacyUgcAdDetailContent(value)) return value as unknown as AiVideoTopicLandingContent;
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
    text(hero.title) && image(hero.image) && (!hero.video || video(hero.video)) &&
    Array.isArray(useCases.items) && Array.isArray(guidance.cards) && Array.isArray(steps.items) &&
    Array.isArray(valueSection.items) && Array.isArray(trust.items) && Array.isArray(faq.items)
  );
  return valid ? value as unknown as AiVideoTopicLandingContent : undefined;
}

export function aiVideoTopicLandingContentFromSection(section: SectionInstance): AiVideoTopicLandingContent | undefined {
  return topicContent(section.settings.content);
}

export function adsTestingDetailFromLegacyUgcContent(content: AiVideoTopicLandingContent): AidreamcapesAdsTestingDetailContent | undefined {
  const legacyValue = content.layoutVariant === "ugc-ad-detail"
    ? content.ugcAdDetail
    : content.layoutVariant === "ads-testing-detail" && content.adsTestingDetail
      ? content.adsTestingDetail
      : undefined;
  if (!legacyValue || !legacyUgcAdDetailContent(legacyValue)) return undefined;
  const legacy = legacyValue;
  const seo = content.seo as AiVideoTopicLandingContent["seo"] & Partial<AidreamcapesAdsTestingDetailContent["seo"]>;
  const media = (value: LegacyUgcAdDetailImage, eager: boolean) => ({
    ...value,
    loading: value.loading ?? (eager ? "eager" : "lazy"),
    fetchPriority: value.fetchPriority ?? (eager ? "high" : "auto"),
    sizes: value.sizes ?? "(max-width: 1024px) 100vw, 640px"
  });
  const productImage = media(legacy.hero.product.image, true);
  const outputImage = media(legacy.hero.output.image, true);
  return {
    layoutVariant: "ads-testing-detail",
    seo: {
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords,
      canonicalPath: seo.canonicalPath,
      canonical: seo.canonical ?? seo.canonicalPath,
      twitterDescription: seo.twitterDescription ?? seo.description,
      ogImage: seo.ogImage ?? outputImage.src,
      ogImageAlt: seo.ogImageAlt ?? outputImage.alt
    },
    hero: {
      eyebrow: legacy.hero.eyebrow,
      title: legacy.hero.title,
      body: legacy.hero.body,
      primaryCta: legacy.hero.primaryCta,
      primaryCtaHref: legacy.hero.primaryHref,
      secondaryCta: legacy.hero.secondaryCta,
      secondaryCtaHref: legacy.hero.secondaryHref,
      availabilityNote: legacy.hero.availabilityNote,
      rightsCopy: legacy.hero.footnote,
      imageNote: legacy.hero.imageNote,
      productLabel: legacy.hero.product.label,
      outputLabel: legacy.hero.output.label,
      productImage,
      outputImage
    },
    workflowOutput: {
      eyebrow: legacy.workflowOutput.eyebrow,
      title: legacy.workflowOutput.title,
      intro: legacy.workflowOutput.items.map((item) => item.body).join(" "),
      cards: legacy.workflowOutput.items.map((item) => ({ title: item.title, body: item.body }))
    },
    workflow: {
      eyebrow: legacy.workflow.eyebrow,
      title: legacy.workflow.title,
      intro: legacy.workflow.leadBody,
      cards: legacy.workflow.steps.map((item) => ({ title: item.title, body: item.body }))
    },
    creativeDirections: {
      eyebrow: legacy.creativeDirections.eyebrow,
      title: legacy.creativeDirections.title,
      intro: legacy.creativeDirections.intro,
      cards: legacy.creativeDirections.items.map((item) => ({ title: item.title, body: item.body }))
    },
    examples: {
      eyebrow: legacy.examples.eyebrow,
      title: legacy.examples.title,
      intro: legacy.examples.intro,
      items: legacy.examples.items.map((item) => ({ title: item.title, body: item.label, image: media(item.image, false) }))
    },
    adTesting: {
      eyebrow: legacy.adTesting.eyebrow,
      title: legacy.adTesting.title,
      intro: legacy.adTesting.focusBody,
      platforms: legacy.adTesting.formats.map((item) => `${item.label} · ${item.value}`),
      checklist: legacy.adTesting.checks
    },
    requirements: {
      eyebrow: legacy.requirements.eyebrow,
      title: legacy.requirements.title,
      intro: legacy.requirements.intro,
      cards: legacy.requirements.items.map((item) => ({ title: item.label, body: item.body }))
    },
    relatedWorkflows: {
      eyebrow: legacy.relatedWorkflows.eyebrow,
      title: legacy.relatedWorkflows.title,
      intro: "Keep the product context and creative review connected as you explore adjacent Ads Testing workflows.",
      items: legacy.relatedWorkflows.items.map((item) => ({ title: item.title, body: item.body, href: item.href, linkLabel: item.cta }))
    },
    faq: {
      eyebrow: legacy.faq.eyebrow,
      title: legacy.faq.title,
      items: legacy.faq.items
    },
    finalCta: {
      eyebrow: legacy.finalCta.eyebrow,
      title: legacy.finalCta.title,
      body: legacy.finalCta.body,
      cta: legacy.finalCta.cta,
      ctaHref: legacy.finalCta.href,
      microcopy: legacy.finalCta.microcopy
    }
  };
}
