import profiles from "./dreamshoot-pack-profiles.json";
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
  "headshots": "professional-headshots",
  "professional": "professional-headshots",
  "professional-headshot": "professional-headshots",
  "professional-headshot-maker": "professional-headshots",
  "work-headshots": "professional-headshots",
  "world-cup": "world-cup-fan-photos",
  "worldcup": "world-cup-fan-photos",
  "football-fan": "world-cup-fan-photos",
  "fan-photos": "world-cup-fan-photos",
  "gala": "gala-photos",
  "noir": "mafia",
  "outdoor": "nature",
  "outdoor-portraits": "nature",
  "nature-adventure": "nature",
  "travel": "outdoor-creator-scenes",
  "travel-scene-pack": "outdoor-creator-scenes",
  "travel-scenes": "outdoor-creator-scenes",
  "try-on": "virtual-try-on",
  "outfit-preview": "virtual-try-on",
  "creator": "creator-portraits",
  "creator-portrait": "creator-portraits",
  "fashion": "fashion-editorial",
  "product": "product-style",
  "social": "social-cards",
  "wedding": "wedding-portraits",
  "wedding-photos": "wedding-portraits",
  "indian": "indian-wedding",
  "cultural": "indian-wedding",
  "valentine": "valentine-photos",
  "valentine-photo": "valentine-photos",
  "engagement-photos": "engagement",
  "holiday-photos": "holiday",
  "christmas": "christmas-photos",
  "christmas-photo": "christmas-photos",
  "xmas": "christmas-photos",
  "couple-christmas": "christmas-couple",
  "thanksgiving": "thanksgiving-group-photos",
  "thanksgiving-photos": "thanksgiving-group-photos",
  "thanksgiving-group": "thanksgiving-group-photos",
  "halloween": "halloween-party-photos",
  "halloween-photos": "halloween-party-photos",
  "halloween-party": "halloween-party-photos",
  "video-add-ons": "ai-video-add-ons",
  "ai-video": "ai-video-add-ons",
  "upscaler": "magic-upscaler",
  "image-upscaler": "magic-upscaler"
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
