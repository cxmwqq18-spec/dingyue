import rawProfiles from "./photo-package-use-case-profiles.json";

export type PhotoPackageUseCaseFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type PhotoPackageUseCaseProfile = {
  headline: string;
  cardDescription: string;
  metaLabel: string;
  tags: string[];
  detailTags: string[];
  detailIntro: string;
  whatCreates: string;
  bestFor: string[];
  workflow: string[];
  styleNotes: string[];
  reviewPoints?: string[];
  coverNote: string;
  safetyNote?: string;
  pageEntityId?: string;
  copyRevision?: string;
  seoTitle?: string;
  galleryTitle?: string;
  galleryIntro?: string;
  ctaEyebrow?: string;
  ctaTitle?: string;
  ctaSubtitle?: string;
  ctaLabel?: string;
  faqEyebrow?: string;
  faqTitle?: string;
  faqItems?: PhotoPackageUseCaseFaqItem[];
  relatedEyebrow?: string;
  relatedTitle?: string;
  relatedSubtitle?: string;
  relatedCtaLabel?: string;
};

type PhotoPackageUseCaseProfileBundle = {
  mydreamshootsCategories: Record<string, PhotoPackageUseCaseProfile>;
  aidreamcapesCategories: Record<string, PhotoPackageUseCaseProfile>;
};

const profiles = rawProfiles as PhotoPackageUseCaseProfileBundle;

export const mydreamshootsCategoryUseCaseProfiles = profiles.mydreamshootsCategories;
export const aidreamcapesCategoryUseCaseProfiles = profiles.aidreamcapesCategories;

const mydreamshootsCategoryAliases: Record<string, string> = {
  "best-themes": "best-themes-presets",
  "best-themes-presets": "best-themes-presets",
  professional: "professional",
  "lifestyle": "lifestyle-creative",
  "lifestyle-creative": "lifestyle-creative",
  creative: "lifestyle-creative",
  magic: "magic",
  "photo-tool": "photo-tools",
  "photo-tools": "photo-tools"
};

const aidreamcapesCategoryAliases: Record<string, string> = {
  "fan-scene": "fan-scene-albums",
  "fan-scenes": "fan-scene-albums",
  "fan-scene-album": "fan-scene-albums",
  "fan-scene-albums": "fan-scene-albums",
  "private-fan-scene-albums": "fan-scene-albums",
  "backstage-meetup-portraits": "fan-scene-albums",
  "supporter-photo-walls": "fan-scene-albums",
  "fan-keepsake-card-sets": "fan-scene-albums",
  fan: "fan-scene-albums",
  "game-day": "game-day-group-photos",
  "game-day-group-photo": "game-day-group-photos",
  "game-day-group-photos": "game-day-group-photos",
  "game-day-group-portraits": "game-day-group-photos",
  "stadium-night-fan-sets": "game-day-group-photos",
  "watch-party-albums": "game-day-group-photos",
  sports: "game-day-group-photos",
  premiere: "premiere-style-portraits",
  "premiere-style": "premiere-style-portraits",
  "premiere-style-portrait": "premiere-style-portraits",
  "premiere-style-portraits": "premiere-style-portraits",
  "premiere-flash-portraits": "premiere-style-portraits",
  "vip-arrival-photo-sets": "premiere-style-portraits",
  "award-night-keepsake-albums": "premiere-style-portraits",
  christmas: "christmas-group-albums",
  "christmas-holiday-albums": "christmas-group-albums",
  "christmas-group-album": "christmas-group-albums",
  "christmas-group-albums": "christmas-group-albums",
  "cozy-card-portrait-sets": "christmas-group-albums",
  "winter-fan-greeting-albums": "christmas-group-albums",
  thanksgiving: "thanksgiving-memory-sets",
  "thanksgiving-memory-set": "thanksgiving-memory-sets",
  "thanksgiving-memory-sets": "thanksgiving-memory-sets",
  "thanksgiving-table-keepsakes": "thanksgiving-memory-sets",
  "gratitude-group-portraits": "thanksgiving-memory-sets",
  "friendsgiving-memory-sets": "thanksgiving-memory-sets",
  halloween: "halloween-party-portraits",
  "halloween-party-portrait": "halloween-party-portraits",
  "halloween-party-portraits": "halloween-party-portraits",
  "halloween-party-portrait-sets": "halloween-party-portraits",
  "costume-cast-photo-albums": "halloween-party-portraits",
  seasonal: "seasonal-celebration-photos",
  celebration: "seasonal-celebration-photos",
  "seasonal-celebration": "seasonal-celebration-photos",
  "seasonal-celebration-photo": "seasonal-celebration-photos",
  "seasonal-celebration-photos": "seasonal-celebration-photos",
  "birthday-fan-moment-sets": "seasonal-celebration-photos",
  "new-year-countdown-albums": "seasonal-celebration-photos"
};

function normalizeSlug(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^collections\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function mydreamshootsCategoryUseCaseProfileForSlug(
  value: string | null | undefined
): PhotoPackageUseCaseProfile | undefined {
  const slug = normalizeSlug(value);
  if (!slug) {
    return undefined;
  }

  const canonicalSlug = mydreamshootsCategoryAliases[slug] ?? slug;
  return mydreamshootsCategoryUseCaseProfiles[canonicalSlug];
}

export function aidreamcapesCategoryUseCaseProfileForSlug(
  value: string | null | undefined
): PhotoPackageUseCaseProfile | undefined {
  const slug = normalizeSlug(value);
  if (!slug) {
    return undefined;
  }

  const canonicalSlug = aidreamcapesCategoryAliases[slug] ?? slug;
  return aidreamcapesCategoryUseCaseProfiles[canonicalSlug];
}

export function photoPackageUseCaseDescription(profile: PhotoPackageUseCaseProfile): string {
  const bestFor = profile.bestFor.slice(0, 4).join(", ");
  const sections = [
    profile.detailIntro,
    profile.whatCreates,
    bestFor ? `Best for ${bestFor}.` : "",
    profile.safetyNote ?? ""
  ];

  return sections.filter(Boolean).join(" ");
}
