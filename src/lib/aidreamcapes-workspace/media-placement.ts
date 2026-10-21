// Public media placement types and route-safe helpers.
//
// A card's `placement` is a sorted, unique list of canonical directory page
// slugs. The directory pages themselves are the taxonomy: there is no separate
// tag table and no label-to-slug mapping at runtime.
//
// This module is client-safe: no Prisma, no server-only imports.

export type PlacementKind = "industry" | "platform" | "occasion";

export type MediaPlacementGroup = {
  kind: PlacementKind | "catalog";
  /** Public group label: Industry / Platform / Occasion / Catalog. */
  label: string;
  links: { label: string; href: string }[];
};

export type DirectoryMediaCard = {
  slug: string;
  label: string;
  kind: "photo" | "video";
  href: string;
  image: { src: string; alt?: string; w?: number; h?: number };
};

export type PlacementDirectory = {
  slug: string;
  kind: PlacementKind;
  label: string;
  /** Template owner paths this directory currently lists. */
  paths: string[];
};

export type PlacementCatalog = {
  slug: string;
  kind: "catalog";
  label: string;
  paths: string[];
};

/** Path prefix -> directory kind. Only the 17 facet pages are placement targets. */
export const PLACEMENT_PREFIX_KIND: Record<string, PlacementKind> = {
  industries: "industry",
  platforms: "platform",
  occasions: "occasion"
};

export const PLACEMENT_GROUP_LABEL: Record<PlacementKind | "catalog", string> = {
  industry: "Industry",
  platform: "Platform",
  occasion: "Occasion",
  catalog: "Catalog"
};

/** Canonical facet page slug: /industries/<slug>, /platforms/<slug>, /occasions/<slug>. */
export const MEDIA_PLACEMENT_PATTERN = /^\/(industries|platforms|occasions)\/[a-z0-9][a-z0-9-]*$/;

export type MediaProductIdentity = {
  /** Stable within the current content revision: kind + media type + source. */
  key: string;
  kind: "photo" | "video";
  mediaType: "image" | "video";
  src: string;
};

function normalizedMediaSrc(value: string | undefined): string | undefined {
  const src = value?.trim();
  if (!src) return undefined;
  // Cache-busting query strings and fragments do not change the media identity.
  return src.split(/[?#]/, 1)[0];
}

/**
 * One image/video asset is one product. Page-local cards are references to that
 * product, so placement and deduplication must use this identity rather than
 * `publicSlug` (a page may contain 20 copies of the same asset under different
 * slugs). `video.src` wins over the still image when both are present.
 */
export function productIdentityOf(input: {
  kind: "photo" | "video";
  imageSrc?: string;
  videoSrc?: string;
  posterSrc?: string;
}): MediaProductIdentity | undefined {
  const videoSrc = normalizedMediaSrc(input.videoSrc);
  if (videoSrc) {
    return { key: `${input.kind}|video|${videoSrc}`, kind: input.kind, mediaType: "video", src: videoSrc };
  }
  const imageSrc = normalizedMediaSrc(input.imageSrc) ?? normalizedMediaSrc(input.posterSrc);
  if (imageSrc) {
    return { key: `${input.kind}|image|${imageSrc}`, kind: input.kind, mediaType: "image", src: imageSrc };
  }
  return undefined;
}

export function placementKind(slug: string): PlacementKind | undefined {
  const match = slug.match(/^\/(industries|platforms|occasions)\//);
  return match ? PLACEMENT_PREFIX_KIND[match[1]] : undefined;
}

/**
 * Runtime-safe placement reader. Invalid values are dropped so a dirty content
 * row can never become a public dead link; the audit script reports them.
 */
export function placementValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const values = value.filter((item): item is string => typeof item === "string" && MEDIA_PLACEMENT_PATTERN.test(item));
  return [...new Set(values)].sort();
}
