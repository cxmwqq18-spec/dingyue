import {
  mydreamshootsCategoryUseCaseProfiles,
  type PhotoPackageUseCaseFaqItem,
  type PhotoPackageUseCaseProfile
} from "@/lib/photo-package-use-case-profiles";
import mydreamshootsThemeTaxonomy from "@/lib/mydreamshoots-theme-taxonomy.json";

export type MyDreamshootsPageCopy = PhotoPackageUseCaseProfile & {
  pageEntityId: string;
  copyRevision: string;
  seoTitle: string;
  galleryTitle: string;
  galleryIntro: string;
  ctaEyebrow: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaLabel: string;
  faqEyebrow: string;
  faqTitle: string;
  faqItems: PhotoPackageUseCaseFaqItem[];
  relatedEyebrow: string;
  relatedTitle: string;
  relatedSubtitle: string;
  relatedCtaLabel: string;
  ctaHref?: string;
  relatedLinks?: Array<{ label: string; href: string }>;
};

export type MyDreamshootsPageIndependenceResult = {
  independent: boolean;
  reasons: string[];
  pageRevision: string;
};

const genericPublishedCopyPatterns: Array<{ field: keyof MyDreamshootsPageCopy; pattern: RegExp }> = [
  { field: "galleryIntro", pattern: /^Review .+ examples before opening the .+ workflow\.$/i },
  { field: "ctaTitle", pattern: /^Create .+ images in your private studio\.$/i },
  { field: "ctaSubtitle", pattern: /^Turn approved source photos into .+ with visible credit cost and private gallery review\.$/i },
  { field: "relatedTitle", pattern: /^More .+ and nearby themes$/i },
  { field: "relatedSubtitle", pattern: /^Compare .+ and adjacent themes before opening (?:a|an) .+ set\.$/i }
];

function stableRevision(value: unknown): string {
  const serialized = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function assessMydreamshootsPageIndependence(
  copy: MyDreamshootsPageCopy,
  canonicalSlug: string
): MyDreamshootsPageIndependenceResult {
  const reasons: string[] = [];
  if (copy.pageEntityId !== `mydreamshoots:ai-image-theme:${canonicalSlug}`) reasons.push("PAGE_ENTITY_MISMATCH");
  if (!copy.copyRevision) reasons.push("COPY_REVISION_MISSING");

  for (const { field, pattern } of genericPublishedCopyPatterns) {
    const value = copy[field];
    if (typeof value === "string" && pattern.test(value.trim())) reasons.push(`GENERIC_${String(field).toUpperCase()}`);
  }

  const faqSignatures = new Set(copy.faqItems.map((item) => `${item.question.trim().toLowerCase()}\n${item.answer.trim().toLowerCase()}`));
  if (faqSignatures.size !== copy.faqItems.length) reasons.push("DUPLICATE_FAQ_WITHIN_PAGE");
  if (copy.bestFor.length < 3) reasons.push("USE_CASES_INCOMPLETE");
  if (copy.workflow.length < 3) reasons.push("WORKFLOW_INCOMPLETE");
  if ((copy.reviewPoints ?? copy.styleNotes).length < 3) reasons.push("REVIEW_CRITERIA_INCOMPLETE");
  if (!copy.ctaHref?.startsWith("/")) reasons.push("CTA_HREF_MISSING");
  if (!Array.isArray(copy.relatedLinks) || copy.relatedLinks.length < 2) reasons.push("RELATED_LINKS_INCOMPLETE");

  return {
    independent: reasons.length === 0,
    reasons,
    pageRevision: stableRevision({ canonicalSlug, copy })
  };
}

const requiredPageCopyFields: Array<keyof PhotoPackageUseCaseProfile> = [
  "pageEntityId",
  "copyRevision",
  "seoTitle",
  "galleryTitle",
  "galleryIntro",
  "ctaEyebrow",
  "ctaTitle",
  "ctaSubtitle",
  "ctaLabel",
  "faqEyebrow",
  "faqTitle",
  "relatedEyebrow",
  "relatedTitle",
  "relatedSubtitle",
  "relatedCtaLabel"
];

const requiredPageCopySlugs = new Set(
  (mydreamshootsThemeTaxonomy.items ?? [])
    .map((item) => normalizeSlug(item?.slug))
    .filter((slug): slug is string => Boolean(slug))
);

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

function expectedPageEntityId(slug: string): string {
  return `mydreamshoots:ai-image-theme:${slug}`;
}

function projectPageCopy(profile: PhotoPackageUseCaseProfile | undefined, slug: string): MyDreamshootsPageCopy | undefined {
  if (!profile) return undefined;
  if (!requiredPageCopyFields.every((field) => typeof profile[field] === "string" && String(profile[field]).trim())) return undefined;
  if (!isValidFaqItems(profile.faqItems)) return undefined;
  if (profile.pageEntityId !== expectedPageEntityId(slug)) return undefined;
  return profile as MyDreamshootsPageCopy;
}

export function mydreamshootsPageCopyForSlug(value: string | null | undefined): MyDreamshootsPageCopy | undefined {
  const slug = normalizeSlug(value);
  if (!slug) return undefined;
  return projectPageCopy(mydreamshootsCategoryUseCaseProfiles[slug], slug);
}

export function mydreamshootsPageCopyForRoute(input: {
  siteId?: string;
  routeKind?: string;
  canonicalSlug?: string | null;
  canonicalPath?: string | null;
}): MyDreamshootsPageCopy | undefined {
  if (input.siteId && input.siteId !== "site_dreamshoot") return undefined;
  if (input.routeKind && input.routeKind !== "ai-image-theme-leaf") return undefined;

  const canonicalSlug = normalizeSlug(input.canonicalSlug);
  if (!canonicalSlug) return undefined;
  const copy = mydreamshootsPageCopyForSlug(canonicalSlug);
  if (!copy) {
    if (requiredPageCopySlugs.has(canonicalSlug)) {
      throw new Error(`PAGE_COPY_REVIEW_REQUIRED:${canonicalSlug}`);
    }
    return undefined;
  }
  if (copy.pageEntityId !== expectedPageEntityId(canonicalSlug)) {
    throw new Error(`PAGE_COPY_ENTITY_MISMATCH:${canonicalSlug}`);
  }
  const canonicalPath = String(input.canonicalPath ?? "").trim().replace(/\/+$/, "");
  if (canonicalPath && canonicalPath !== `/ai-image-generation/${canonicalSlug}`) {
    throw new Error(`PAGE_COPY_CANONICAL_PATH_MISMATCH:${canonicalSlug}`);
  }
  return copy;
}

export function mydreamshootsPageCopySlugs(): string[] {
  return [...requiredPageCopySlugs];
}
