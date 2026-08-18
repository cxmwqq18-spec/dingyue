import {
  mydreamshootsCategoryUseCaseProfiles,
  type PhotoPackageUseCaseFaqItem,
  type PhotoPackageUseCaseProfile
} from "@/lib/photo-package-use-case-profiles";

export type MyDreamshootsPageCopy = PhotoPackageUseCaseProfile & {
  pageEntityId: string;
  copyRevision: string;
  seoTitle: string;
  galleryTitle: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaLabel: string;
  faqTitle: string;
  faqItems: PhotoPackageUseCaseFaqItem[];
  relatedTitle: string;
  relatedSubtitle: string;
  relatedCtaLabel: string;
};

const requiredPageCopyFields: Array<keyof MyDreamshootsPageCopy> = [
  "pageEntityId",
  "copyRevision",
  "seoTitle",
  "galleryTitle",
  "ctaTitle",
  "ctaSubtitle",
  "ctaLabel",
  "faqTitle",
  "relatedTitle",
  "relatedSubtitle",
  "relatedCtaLabel"
];

function normalizeSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^collections\//, "")
    .replace(/^ai-image-generation\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidFaqItems(value: PhotoPackageUseCaseFaqItem[] | undefined): value is PhotoPackageUseCaseFaqItem[] {
  return Array.isArray(value) && value.length >= 4 && value.every((item) => Boolean(item?.id?.trim() && item?.question?.trim() && item?.answer?.trim()));
}

function projectPageCopy(profile: PhotoPackageUseCaseProfile | undefined, slug: string): MyDreamshootsPageCopy | undefined {
  if (!profile) return undefined;
  if (!requiredPageCopyFields.every((field) => typeof profile[field] === "string" && String(profile[field]).trim())) return undefined;
  if (!isValidFaqItems(profile.faqItems)) return undefined;
  const canonicalSlug = normalizeSlug(slug);
  if (!canonicalSlug || profile.pageEntityId !== `mydreamshoots:ai-image-theme:${canonicalSlug}`) return undefined;
  return profile as MyDreamshootsPageCopy;
}

export function mydreamshootsPageCopyForSlug(value: string | null | undefined): MyDreamshootsPageCopy | undefined {
  const slug = normalizeSlug(value);
  if (!slug) return undefined;
  return projectPageCopy(mydreamshootsCategoryUseCaseProfiles[slug], slug);
}

export function mydreamshootsPageCopySlugs(): string[] {
  return Object.entries(mydreamshootsCategoryUseCaseProfiles)
    .map(([slug, profile]) => projectPageCopy(profile, slug) ? slug : "")
    .filter(Boolean);
}
