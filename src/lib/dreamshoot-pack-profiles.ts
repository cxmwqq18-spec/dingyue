import profiles from "./dreamshoot-pack-profiles.json";
import type { PhotoPackageUseCaseFaqItem } from "@/lib/photo-package-use-case-profiles";
import { photoPackageSlug } from "@/lib/photo-package-taxonomy";

export type DreamshootPackProfile = {
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

type ProfilePackLike = {
  id?: string;
  name?: string;
  category?: string;
  categoryRecord?: {
    slug?: string | null;
    label?: string | null;
    parent?: {
      slug?: string | null;
      label?: string | null;
    } | null;
  } | null;
};

export const dreamshootPackProfiles = profiles as Record<string, DreamshootPackProfile>;

const profileSlugAliases: Record<string, string> = {
  "headshots": "headshot",
  "professional-headshots": "headshot",
  "professional-headshot": "headshot",
  "professional-headshot-maker": "headshot",
  "work-headshots": "headshot",
  "world-cup": "soccer",
  "worldcup": "soccer",
  "world-cup-fan-photos": "soccer",
  "football-fan": "soccer",
  "fan-photos": "soccer",
  "gala": "gala-photo",
  "gala-photos": "gala-photo",
  "noir": "mafia",
  "outdoor": "travel",
  "outdoor-portraits": "travel",
  "nature": "travel",
  "nature-adventure": "travel",
  "travel-scene-pack": "travel",
  "travel-scenes": "travel",
  "try-on": "virtual-try-on",
  "outfit-preview": "virtual-try-on",
  "creator": "portrait-photo",
  "creator-portrait": "portrait-photo",
  "creator-portraits": "portrait-photo",
  "fashion": "street-style",
  "fashion-editorial": "street-style",
  "product": "background-changer",
  "product-style": "background-changer",
  "social": "edit-by-prompt",
  "social-cards": "edit-by-prompt",
  "wedding": "wedding-photo",
  "wedding-portraits": "wedding-photo",
  "wedding-photos": "wedding-photo",
  "indian": "rich-lifestyle",
  "indian-wedding": "rich-lifestyle",
  "cultural": "rich-lifestyle",
  "desi-wedding": "cannes",
  "valentine": "valentines-photo",
  "valentine-photo": "valentines-photo",
  "valentine-photos": "valentines-photo",
  "engagement": "engagement-photo",
  "engagement-photos": "engagement-photo",
  "holiday-photos": "holiday",
  "christmas": "christmas-photo",
  "christmas-photos": "christmas-photo",
  "xmas": "christmas-photo",
  "couple-christmas": "nightlife",
  "christmas-couple": "nightlife",
  "thanksgiving": "thanksgiving-photo",
  "thanksgiving-photos": "thanksgiving-photo",
  "thanksgiving-group": "thanksgiving-photo",
  "thanksgiving-group-photos": "thanksgiving-photo",
  "halloween": "halloween-photo",
  "halloween-photos": "halloween-photo",
  "halloween-party": "halloween-photo",
  "halloween-party-photos": "halloween-photo",
  "video-add-ons": "motion-generator",
  "ai-video": "motion-generator",
  "ai-video-add-ons": "motion-generator",
  "upscaler": "photo-enhancer",
  "image-upscaler": "photo-enhancer",
  "magic-upscaler": "photo-enhancer",
  "anime-avatar": "black-friday"
};

function normalizeProfileSlug(value: string | null | undefined): string {
  if (!value) return "";
  const normalized = photoPackageSlug(value)
    .replace(/^pack-dreamshoot-/, "")
    .replace(/^dreamshoot-/, "")
    .replace(/^ai-/, "");
  return profileSlugAliases[normalized] ?? normalized;
}

export function dreamshootPackProfileSlug(value: string | null | undefined): string {
  const normalized = normalizeProfileSlug(value);
  if (dreamshootPackProfiles[normalized]) return normalized;
  return "";
}

export function dreamshootPackProfileForSlug(value: string | null | undefined): DreamshootPackProfile | undefined {
  const slug = dreamshootPackProfileSlug(value);
  return slug ? dreamshootPackProfiles[slug] : undefined;
}

export function dreamshootPackProfileForPack(pack: ProfilePackLike | null | undefined): DreamshootPackProfile | undefined {
  if (!pack) return undefined;
  const candidateValues = [
    pack.categoryRecord?.slug,
    pack.category,
    pack.id,
    pack.name,
    pack.categoryRecord?.label,
    pack.categoryRecord?.parent?.slug,
    pack.categoryRecord?.parent?.label
  ];
  for (const value of candidateValues) {
    const profile = dreamshootPackProfileForSlug(value);
    if (profile) return profile;
  }
  return undefined;
}
