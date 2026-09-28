import type { SectionInstance, ThemePage, ThemeSettingValue } from "@/lib/types";
import {
  AIDREAMCAPES_IMAGE_THEME_ROOT_PATH,
  aidreamcapesImageThemeDefinitionForPath,
  type AidreamcapesImageThemeLayoutVariant
} from "@/lib/aidreamcapes-image-theme-routes";

export type AidreamcapesImageThemeImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  loading: "eager" | "lazy";
  fetchPriority: "high" | "low" | "auto";
  sizes: string;
};

export type AidreamcapesImageThemeCard = {
  title: string;
  body: string;
};

export type AidreamcapesImageThemeInternalLink = {
  label: string;
  href: string;
};

export type AidreamcapesImageThemeDetailContent = {
  subject: string;
  layoutVariant: AidreamcapesImageThemeLayoutVariant;
  schema: {
    applicationName: string;
    applicationSubCategory: string;
    serviceType: string;
  };
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
    productImage: AidreamcapesImageThemeImage;
    outputImage: AidreamcapesImageThemeImage;
  };
  proof: {
    eyebrow: string;
    title: string;
    intro: string;
    cards: AidreamcapesImageThemeCard[];
  };
  workflow: {
    eyebrow: string;
    title: string;
    intro: string;
    steps: AidreamcapesImageThemeCard[];
  };
  directions: {
    eyebrow: string;
    title: string;
    intro: string;
    cards: AidreamcapesImageThemeCard[];
  };
  examples: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<AidreamcapesImageThemeCard & { image: AidreamcapesImageThemeImage }>;
  };
  formats: {
    eyebrow: string;
    title: string;
    intro: string;
    items: AidreamcapesImageThemeCard[];
  };
  checklist: {
    eyebrow: string;
    title: string;
    intro: string;
    items: string[];
  };
  faq: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<{ question: string; answer: string }>;
  };
  internalLinks: AidreamcapesImageThemeInternalLink[];
  finalCta: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    ctaHref: string;
    microcopy: string;
  };
};

function record(value: ThemeSettingValue | undefined): Record<string, ThemeSettingValue> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, ThemeSettingValue>
    : undefined;
}

function text(value: ThemeSettingValue | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: ThemeSettingValue | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function localAsset(value: ThemeSettingValue | undefined): value is string {
  return typeof value === "string" && value.startsWith("/assets/sites/site_aidreamcapes/") && !value.includes("://") && !value.includes("..");
}

function image(value: ThemeSettingValue | undefined, assetPrefix: string): boolean {
  const candidate = record(value);
  if (!candidate) return false;
  const width = candidate.width;
  const height = candidate.height;
  return Boolean(
    localAsset(candidate.src) && candidate.src.startsWith(assetPrefix) && text(candidate.alt) &&
    positiveInteger(width) && positiveInteger(height) &&
    (candidate.loading === "eager" || candidate.loading === "lazy") &&
    (candidate.fetchPriority === "high" || candidate.fetchPriority === "low" || candidate.fetchPriority === "auto") &&
    text(candidate.sizes)
  );
}

function cards(value: ThemeSettingValue | undefined, minimum = 1): boolean {
  if (!Array.isArray(value) || value.length < minimum) return false;
  return value.every((item) => {
    const candidate = record(item);
    return Boolean(candidate && text(candidate.title) && text(candidate.body));
  });
}

function guidance(value: ThemeSettingValue | undefined): boolean {
  const candidate = record(value);
  return Boolean(candidate && text(candidate.eyebrow) && text(candidate.title) && text(candidate.intro) && cards(candidate.cards, 1));
}

function workflow(value: ThemeSettingValue | undefined): boolean {
  const candidate = record(value);
  return Boolean(candidate && text(candidate.eyebrow) && text(candidate.title) && text(candidate.intro) && cards(candidate.steps, 5));
}

function faq(value: ThemeSettingValue | undefined): boolean {
  const candidate = record(value);
  return Boolean(
    candidate && text(candidate.eyebrow) && text(candidate.title) && text(candidate.intro) &&
    Array.isArray(candidate.items) && candidate.items.length === 6 && candidate.items.every((item) => {
      const faqItem = record(item);
      return Boolean(faqItem && text(faqItem.question) && text(faqItem.answer));
    })
  );
}

export function imageThemeDetailContentFromSection(section: SectionInstance): AidreamcapesImageThemeDetailContent | undefined {
  const candidate = record(section.settings.content);
  const hero = candidate && record(candidate.hero);
  const examples = candidate && record(candidate.examples);
  const formats = candidate && record(candidate.formats);
  const checklist = candidate && record(candidate.checklist);
  const finalCta = candidate && record(candidate.finalCta);
  const seo = candidate && record(candidate.seo);
  const schema = candidate && record(candidate.schema);
  if (
    !candidate || typeof candidate.layoutVariant !== "string" ||
    !aidreamcapesImageThemeDefinitionForPath(`${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${candidate.layoutVariant.replace(/-detail$/, "")}`) ||
    !hero || !examples || !formats || !checklist || !finalCta || !seo || !schema
  ) return undefined;
  const canonicalPath = seo.canonicalPath;
  if (typeof canonicalPath !== "string") return undefined;
  const slug = canonicalPath.split("/").filter(Boolean).pop();
  const assetPrefix = slug
    ? `/assets/sites/site_aidreamcapes/${slug}-v1/${slug}/`
    : "";
  if (
    !text(seo.title) || !text(seo.description) || !text(seo.keywords) ||
    !aidreamcapesImageThemeDefinitionForPath(canonicalPath) ||
    typeof seo.canonical !== "string" ||
    seo.canonical !== `https://aidreamcapes.com${seo.canonicalPath}` ||
    !text(seo.twitterDescription) || !localAsset(seo.ogImage) || !seo.ogImage.startsWith(assetPrefix) || !text(seo.ogImageAlt) ||
    !text(schema.applicationName) || !text(schema.applicationSubCategory) || !text(schema.serviceType)
  ) return undefined;
  if (
    !text(hero.eyebrow) || !text(hero.title) || !text(hero.body) || !text(hero.primaryCta) ||
    hero.primaryCtaHref !== "/app/create?tool_id=image_generator" || !text(hero.secondaryCta) ||
    hero.secondaryCtaHref !== "#examples" || !text(hero.availabilityNote) || !text(hero.rightsCopy) ||
    !text(hero.imageNote) || !text(hero.productLabel) || !text(hero.outputLabel) ||
    !image(hero.productImage, assetPrefix) || !image(hero.outputImage, assetPrefix)
  ) return undefined;
  if (!guidance(candidate.proof) || !workflow(candidate.workflow) || !guidance(candidate.directions)) return undefined;
  if (!text(examples.eyebrow) || !text(examples.title) || !text(examples.intro) || !Array.isArray(examples.items) || examples.items.length < 3 || !examples.items.every((item) => {
    const example = record(item);
    return Boolean(example && text(example.title) && text(example.body) && image(example.image, assetPrefix));
  })) return undefined;
  if (!text(formats.eyebrow) || !text(formats.title) || !text(formats.intro) || !cards(formats.items, 4)) return undefined;
  if (!text(checklist.eyebrow) || !text(checklist.title) || !text(checklist.intro) || !Array.isArray(checklist.items) || checklist.items.length < 4 || !checklist.items.every(text)) return undefined;
  if (!faq(candidate.faq) || !text(finalCta.eyebrow) || !text(finalCta.title) || !text(finalCta.body) || !text(finalCta.cta) || !text(finalCta.ctaHref) || !text(finalCta.microcopy)) return undefined;
  if (!Array.isArray(candidate.internalLinks) || candidate.internalLinks.length < 3 || !candidate.internalLinks.every((item) => {
    const link = record(item);
    return Boolean(link && text(link.label) && typeof link.href === "string" && link.href.startsWith("/") && !/collections|\/tools(?:\/|$)/i.test(link.href));
  })) return undefined;
  return candidate as unknown as AidreamcapesImageThemeDetailContent;
}

export function imageThemeDetailContentFromPage(page: Pick<ThemePage, "publishedJson">): AidreamcapesImageThemeDetailContent | undefined {
  const section = page.publishedJson.sectionsOrder
    .map((sectionId) => page.publishedJson.sections[sectionId])
    .find((candidate) => candidate?.type === "ai_image_theme_landing");
  return section ? imageThemeDetailContentFromSection(section) : undefined;
}
