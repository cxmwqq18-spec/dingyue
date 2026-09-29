import mydreamshootsThemeTaxonomy from "@/lib/mydreamshoots-theme-taxonomy.json";
import type { CreativePack, CreativePackCategory, Site } from "@/lib/types";
import { isAidreamcapesSite as isAidreamcapesCapabilitySite, isPrimaryMydreamshootsSite as isPrimaryMydreamshootsCapabilitySite } from "@/lib/storefront-context/capabilities";
import { canonicalSpanishXbyCollectionSlug, isAidreamshootsStorefrontSite, isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { isAidreamcapesPublicVideoGenerationSlug } from "@/lib/aidreamcapes-navigation";

export type PhotoPackageMegaGroup = {
  label: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  items: Array<{
    label: string;
    slug: string;
    href: string;
    packId?: string;
    icon?: string;
    sortOrder?: number;
  }>;
};

export type PhotoPackageCategoryOption = {
  label: string;
  slug: string;
  sortOrder?: number;
};

type CollectionRouteSiteIdentity = Partial<Pick<Site, "id" | "slug" | "name" | "primaryDomain">> & {
  siteId?: string;
  branding?: Partial<Pick<Site["branding"], "logoText">>;
};

type MyDreamShootsThemeTaxonomy = {
  roots: Array<{ slug: string; label: string; description?: string; icon?: string; sortOrder?: number }>;
  items: Array<{ slug: string; groupSlug: string; label: string }>;
};

export type PublicCollectionRoute = {
  root: "ai-image-generation" | "collections";
  rootSlug?: string;
  itemSlug?: string;
  collectionSlug: string;
  canonicalPath: string;
  kind: "directory" | "group" | "item";
};

const mydreamshootsThemeTaxonomyData = mydreamshootsThemeTaxonomy as MyDreamShootsThemeTaxonomy;
export const MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT = "ai-image-generation";
export const MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT_PATH = `/${MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT}`;
export const MYDREAMSHOOTS_AI_PHOTOSHOOT_ROOT = MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT;
export const MYDREAMSHOOTS_AI_PHOTOSHOOT_ROOT_PATH = MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT_PATH;
export const MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT = "ai-video-generation";
export const MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT_PATH = `/${MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT}`;
export const MYDREAMSHOOTS_AI_VIDEO_GENERATION_SLUGS = [
  "profile-clip",
  "fan-poster-motion",
  "creator-intro-video",
  "product-teaser-clip",
  "animated-avatar",
  "fashion-reel",
  "album-story-video",
  "talking-photo",
  "motion-generator",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video",
  "product-ad-video",
  "promo-video",
  "ugc-ad-video",
  "video-ad",
  "brand-video",
  "music-video",
  "fashion-video",
  "food-video",
  "pet-video",
  "explainer-video",
  "how-to-video",
  "talking-head-video"
] as const;

export const MYDREAMSHOOTS_PUBLIC_AI_VIDEO_GENERATION_SLUGS = [
  "talking-photo",
  "motion-generator",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video",
  "product-ad-video",
  "promo-video",
  "ugc-ad-video",
  "video-ad",
  "brand-video",
  "music-video",
  "fashion-video",
  "food-video",
  "pet-video",
  "explainer-video",
  "how-to-video",
  "talking-head-video"
] as const;

export type MyDreamShootsVideoGenerationSlug = typeof MYDREAMSHOOTS_AI_VIDEO_GENERATION_SLUGS[number];

export type PublicVideoGenerationRoute = {
  root: "ai-video-generation";
  itemSlug?: string;
  canonicalPath: string;
  kind: "directory" | "item";
};
const COLLECTIONS_ROOT_PATH = "/collections";

const mydreamshootsThemeRootSlugs = new Set(mydreamshootsThemeTaxonomyData.roots.map((root) => root.slug));
const mydreamshootsThemeItemsBySlug = new Map(mydreamshootsThemeTaxonomyData.items.map((item) => [item.slug, item]));
const mydreamshootsVideoGenerationSlugs = new Set<string>(MYDREAMSHOOTS_AI_VIDEO_GENERATION_SLUGS);
const mydreamshootsPublicVideoGenerationSlugs = new Set<string>(MYDREAMSHOOTS_PUBLIC_AI_VIDEO_GENERATION_SLUGS);

function siteIdentityToken(site: CollectionRouteSiteIdentity | undefined): string {
  if (!site) return "";
  return `${site.id ?? ""} ${site.siteId ?? ""} ${site.slug ?? ""} ${site.name ?? ""} ${site.primaryDomain ?? ""} ${site.branding?.logoText ?? ""}`.toLowerCase();
}

function isAidreamcapesRouteSite(site: CollectionRouteSiteIdentity | undefined): boolean {
  return Boolean(site && isAidreamcapesCapabilitySite({ id: site.siteId ?? site.id ?? "", slug: site.slug ?? "" }));
}

function isPrimaryAidreamcapesRouteSite(site: CollectionRouteSiteIdentity | undefined): boolean {
  if (!site) return false;
  const siteId = site.siteId ?? site.id ?? "";
  const slug = (site.slug ?? "").trim().toLowerCase();
  const domain = (site.primaryDomain ?? "").trim().toLowerCase();
  return siteId === "site_aidreamcapes" || slug === "aidreamcapes" || domain === "aidreamcapes.com" || domain === "www.aidreamcapes.com";
}

export function isMydreamshootsCollectionRouteSite(site: CollectionRouteSiteIdentity | undefined): boolean {
  if (!site || isAidreamcapesRouteSite(site)) return false;
  const siteId = site.siteId ?? site.id ?? "";
  const slug = site.slug ?? "";
  const domain = site.primaryDomain ?? "";
  if (siteId === "site_mydreamshoots_xby" || slug === "mydreamshoots-xby" || domain === "aidreamshoots.eu") return false;
  return isPrimaryMydreamshootsCapabilitySite({ id: site.siteId ?? site.id ?? "", slug: site.slug ?? "" });
}

export function mydreamshootsCollectionGroupSlugForItem(slug: string | undefined): string | undefined {
  return mydreamshootsThemeItemsBySlug.get(photoPackageSlug(slug))?.groupSlug;
}

export function mydreamshootsCollectionGroupForItem(slug: string | undefined) {
  const groupSlug = mydreamshootsCollectionGroupSlugForItem(slug);
  if (!groupSlug) return undefined;
  return mydreamshootsThemeTaxonomyData.roots.find((root) => root.slug === groupSlug);
}

export function isMydreamshootsCollectionRootSlug(slug: string | undefined): boolean {
  return mydreamshootsThemeRootSlugs.has(photoPackageSlug(slug));
}

export function isMydreamshootsCollectionItemSlug(slug: string | undefined): boolean {
  return mydreamshootsThemeItemsBySlug.has(photoPackageSlug(slug));
}

export function isMydreamshootsVideoGenerationSlug(slug: string | undefined): slug is MyDreamShootsVideoGenerationSlug {
  return mydreamshootsVideoGenerationSlugs.has(photoPackageSlug(slug));
}

export function isMydreamshootsPublicVideoGenerationSlug(slug: string | undefined): slug is typeof MYDREAMSHOOTS_PUBLIC_AI_VIDEO_GENERATION_SLUGS[number] {
  return mydreamshootsPublicVideoGenerationSlugs.has(photoPackageSlug(slug));
}

export function publicCollectionRootPathForSite(site: CollectionRouteSiteIdentity | undefined): string {
  return isMydreamshootsCollectionRouteSite(site) || isAidreamcapesRouteSite(site) || isAidreamshootsStorefrontSite(site)
    ? MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT_PATH
    : COLLECTIONS_ROOT_PATH;
}

export function publicCollectionPathForSite(site: CollectionRouteSiteIdentity | undefined, rawSlug?: string): string {
  const rootPath = publicCollectionRootPathForSite(site);
  const slug = photoPackageSlug(rawSlug);
  if (!slug || slug === "all" || slug === "todo" || slug === "todos") return rootPath;
  if (!isMydreamshootsCollectionRouteSite(site)) return `${rootPath}/${slug}`;
  if (isMydreamshootsCollectionRootSlug(slug)) return rootPath;
  return `${rootPath}/${slug}`;
}

export function publicVideoGenerationPathForSite(site: CollectionRouteSiteIdentity | undefined, rawSlug?: string): string {
  const slug = photoPackageSlug(rawSlug);
  if (!slug || slug === "all" || slug === "todo" || slug === "todos") return MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT_PATH;
  if (isPrimaryAidreamcapesRouteSite(site) && !isAidreamcapesPublicVideoGenerationSlug(slug)) return MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT_PATH;
  if (isAidreamcapesRouteSite(site)) return `${MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT_PATH}/${slug}`;
  if (!isMydreamshootsPublicVideoGenerationSlug(slug)) return MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT_PATH;
  return `${MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT_PATH}/${slug}`;
}

export function publicCollectionSlugFromPath(site: CollectionRouteSiteIdentity | undefined, rawPath: string): string {
  return parsePublicCollectionRouteForSite(site, rawPath)?.collectionSlug ?? "";
}

export function isPublicCollectionPathForSite(site: CollectionRouteSiteIdentity | undefined, rawPath: string): boolean {
  return Boolean(parsePublicCollectionRouteForSite(site, rawPath));
}

export function isPublicVideoGenerationPathForSite(site: CollectionRouteSiteIdentity | undefined, rawPath: string): boolean {
  return Boolean(parsePublicVideoGenerationRouteForSite(site, rawPath));
}

function pathSegments(rawPath: string): string[] {
  const path = rawPath.split(/[?#]/)[0] ?? "";
  return path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parsePublicCollectionRouteForSite(site: CollectionRouteSiteIdentity | undefined, rawPath: string | string[]): PublicCollectionRoute | undefined {
  const segments = Array.isArray(rawPath) ? rawPath.filter(Boolean) : pathSegments(rawPath);
  if (isMydreamshootsCollectionRouteSite(site)) {
    const isCanonicalRoot = segments[0] === MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT;
    const isLegacyRoot = segments[0] === "collections";
    if (!isCanonicalRoot && !isLegacyRoot) return undefined;
    if (segments.length === 1) {
      return {
        root: isCanonicalRoot ? MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT : "collections",
        collectionSlug: "",
        canonicalPath: isCanonicalRoot ? MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT_PATH : COLLECTIONS_ROOT_PATH,
        kind: "directory"
      };
    }
    if (segments.length === 2) {
      const itemSlug = photoPackageSlug(segments[1]);
      const item = mydreamshootsThemeItemsBySlug.get(itemSlug);
      if (item) {
        return {
          root: isCanonicalRoot ? MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT : "collections",
          rootSlug: item.groupSlug,
          itemSlug,
          collectionSlug: itemSlug,
          canonicalPath: isCanonicalRoot ? publicCollectionPathForSite(site, itemSlug) : `${COLLECTIONS_ROOT_PATH}/${itemSlug}`,
          kind: "item"
        };
      }
    }
    return undefined;
  }
  if (isAidreamcapesRouteSite(site)) {
    const isCanonicalRoot = segments[0] === MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT;
    const isLegacyRoot = segments[0] === "collections";
    if (!isCanonicalRoot && !isLegacyRoot) return undefined;
    if (segments.length === 1) {
      return {
        root: isCanonicalRoot ? MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT : "collections",
        collectionSlug: "",
        canonicalPath: MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT_PATH,
        kind: "directory"
      };
    }
    if (segments.length === 2) {
      const itemSlug = photoPackageSlug(segments[1]);
      return {
        root: isCanonicalRoot ? MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT : "collections",
        itemSlug,
        collectionSlug: itemSlug,
        canonicalPath: `${MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT_PATH}/${itemSlug}`,
        kind: "item"
      };
    }
    return undefined;
  }
  if (isSpanishStorefrontSite(site)) {
    const isCanonicalRoot = segments[0] === MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT;
    const isLegacyRoot = segments[0] === "collections";
    if (!isCanonicalRoot && !isLegacyRoot) return undefined;
    if (segments.length === 1) {
      return {
        root: isCanonicalRoot ? MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT : "collections",
        collectionSlug: "",
        canonicalPath: publicCollectionPathForSite(site, ""),
        kind: "directory"
      };
    }
    if (segments.length === 2) {
      const rawItemSlug = photoPackageSlug(segments[1]);
      const itemSlug = canonicalSpanishXbyCollectionSlug(rawItemSlug);
      return {
        root: isCanonicalRoot ? MYDREAMSHOOTS_AI_IMAGE_GENERATION_ROOT : "collections",
        itemSlug,
        collectionSlug: itemSlug,
        canonicalPath: publicCollectionPathForSite(site, itemSlug),
        kind: "item"
      };
    }
    return undefined;
  }
  if (segments[0] !== "collections") return undefined;
  if (segments.length === 1) {
    return {
      root: "collections",
      collectionSlug: "",
      canonicalPath: COLLECTIONS_ROOT_PATH,
      kind: "directory"
    };
  }
  if (segments.length === 2) {
    const rawItemSlug = photoPackageSlug(segments[1]);
    const itemSlug = isSpanishStorefrontSite(site) ? canonicalSpanishXbyCollectionSlug(rawItemSlug) : rawItemSlug;
    return {
      root: "collections",
      itemSlug,
      collectionSlug: itemSlug,
      canonicalPath: `${COLLECTIONS_ROOT_PATH}/${itemSlug}`,
      kind: "item"
    };
  }
  return undefined;
}

export function parsePublicVideoGenerationRouteForSite(site: CollectionRouteSiteIdentity | undefined, rawPath: string | string[]): PublicVideoGenerationRoute | undefined {
  const segments = Array.isArray(rawPath) ? rawPath.filter(Boolean) : pathSegments(rawPath);
  if (isAidreamcapesRouteSite(site)) {
    if (segments[0] !== MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT) return undefined;
    if (segments.length === 1) return { root: MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT, canonicalPath: MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT_PATH, kind: "directory" };
    if (segments.length === 2) {
      const itemSlug = photoPackageSlug(segments[1]);
      if (isPrimaryAidreamcapesRouteSite(site) && !isAidreamcapesPublicVideoGenerationSlug(itemSlug)) return undefined;
      return { root: MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT, itemSlug, canonicalPath: publicVideoGenerationPathForSite(site, itemSlug), kind: "item" };
    }
    return undefined;
  }
  // The Spanish AIdreamshoots storefront keeps the shared video-generation
  // URL family, while its localized collection URLs intentionally use
  // `/collections`. Keep this route parser separate from the image-collection
  // capability check so the target storefront's video directory and topic
  // pages remain reachable without changing the English or Aidreamcapes
  // routing rules.
  if (isSpanishStorefrontSite(site)) {
    if (segments[0] !== MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT) return undefined;
    if (segments.length === 1) {
      return {
        root: MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT,
        canonicalPath: MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT_PATH,
        kind: "directory"
      };
    }
    if (segments.length === 2) {
      const itemSlug = photoPackageSlug(segments[1]);
      if (!isMydreamshootsVideoGenerationSlug(itemSlug)) return undefined;
      return {
        root: MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT,
        itemSlug,
        canonicalPath: publicVideoGenerationPathForSite(site, itemSlug),
        kind: "item"
      };
    }
    return undefined;
  }
  if (!isMydreamshootsCollectionRouteSite(site)) return undefined;
  if (segments[0] !== MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT) return undefined;
  if (segments.length === 1) {
    return {
      root: MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT,
      canonicalPath: MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT_PATH,
      kind: "directory"
    };
  }
  if (segments.length === 2) {
    const itemSlug = photoPackageSlug(segments[1]);
    if (!isMydreamshootsPublicVideoGenerationSlug(itemSlug)) return undefined;
    return {
      root: MYDREAMSHOOTS_AI_VIDEO_GENERATION_ROOT,
      itemSlug,
      canonicalPath: publicVideoGenerationPathForSite(site, itemSlug),
      kind: "item"
    };
  }
  return undefined;
}

export function photoPackageSlug(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all";
}

export function photoPackageLabel(value: string | undefined): string {
  const normalized = (value ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!normalized || normalized === "all") return "All";
  if (normalized === "headshots") return "Headshots";
  if (normalized === "sports") return "Sports";
  if (normalized === "creator") return "Creator";
  if (normalized === "creative") return "Creative";
  if (normalized === "beauty") return "Beauty";
  if (normalized === "avatar") return "Avatar";
  if (normalized === "seasonal") return "Seasonal";
  if (normalized === "couple") return "Couple";
  if (normalized === "wedding") return "Wedding";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function photoPackageMenuLabel(value: string | undefined): string {
  const normalized = (value ?? "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return photoPackageLabel(value);
  // Preserve already-localized labels. The old ASCII word-boundary rule
  // treated the ASCII letters inside accented French words as new word
  // starts (for example, "Générateur" became "GéNéRateur") and also
  // title-cased French connectors such as "de".
  if (/[À-ÖØ-öø-ÿ]/.test(normalized) || /\b(?:de|des|du|la|le|les|et|pour|avec|à|d')\b/i.test(normalized)) {
    return normalized;
  }
  return normalized.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

const aidreamcapesCollectionHrefSlugAliases: Record<string, string> = {
  "adventure": "game-day-group-photos",
  "city": "premiere-style-portraits",
  "coastal": "christmas-group-albums",
  "costero": "christmas-group-albums",
  "destination": "fan-scene-albums",
  "destino": "fan-scene-albums",
  "postcard": "seasonal-celebration-photos",
  "postal": "seasonal-celebration-photos",
  "cafe-street-stories": "premiere-style-portraits",
  "professional-headshots": "premiere-style-portraits",
  "road-trip-frames": "game-day-group-photos",
  "route-portrait-albums": "fan-scene-albums",
  "destination-portrait-albums": "fan-scene-albums",
  "coastal-light-sets": "christmas-group-albums",
  "coastal-getaways": "christmas-group-albums",
  "old-quarter-walks": "premiere-style-portraits",
  "old-city-walks": "premiere-style-portraits",
  "island-resort-scenes": "seasonal-celebration-photos",
  "scenic-overlooks": "game-day-group-photos",
  "alpine-trail-frames": "seasonal-celebration-photos",
  "mountain-trails": "game-day-group-photos",
  "cinematic-travel": "game-day-group-photos",
  "itinerary-moodboards": "seasonal-celebration-photos",
  "route-moodboards": "seasonal-celebration-photos",
  "postcard-social-sets": "seasonal-celebration-photos",
  "postcard-story-sets": "seasonal-celebration-photos",
  "travel-profile-stories": "fan-scene-albums",
  "solo-traveler-profiles": "fan-scene-albums",
  "family-travel-keepsakes": "thanksgiving-memory-sets",
  "travel-journal-covers": "seasonal-celebration-photos"
};

const dreamshootCollectionHrefSlugAliases: Record<string, string> = {};

const dreamshootPackageGroupSlugOverrides: Record<string, string> = {};

function shouldUseAidreamcapesCollectionAliases(siteIds: Array<string | undefined>): boolean {
  return siteIds.some((siteId) => ["site_aidreamcapes", "site_aidreamcapes_xby"].includes(siteId ?? ""));
}

export function photoPackageCollectionHrefForSlug(
  slug: string | undefined,
  aliases: Record<string, string> = dreamshootCollectionHrefSlugAliases,
  site?: CollectionRouteSiteIdentity
): string {
  const normalizedSlug = photoPackageSlug(slug);
  const hrefSlug = aliases[normalizedSlug] ?? normalizedSlug;
  return publicCollectionPathForSite(site, hrefSlug);
}

export function creativePackCollectionHref(pack: CreativePack, aliases?: Record<string, string>): string {
  const scopedAliases = aliases ?? (shouldUseAidreamcapesCollectionAliases([pack.siteId, pack.categoryRecord?.siteId]) ? aidreamcapesCollectionHrefSlugAliases : dreamshootCollectionHrefSlugAliases);
  const slug = photoPackageSlug(pack.categoryRecord?.slug || pack.category || pack.name);
  if (isMydreamshootsCollectionRouteSite(pack) && slug === "motion-generator") {
    return publicVideoGenerationPathForSite(pack, slug);
  }
  return photoPackageCollectionHrefForSlug(slug, scopedAliases, pack);
}

export function creativePackCategoryOption(pack: CreativePack): PhotoPackageCategoryOption {
  const parent = pack.categoryRecord?.parent;
  const label = parent?.label || pack.categoryRecord?.label || photoPackageLabel(pack.category);
  const slug = parent?.slug || pack.categoryRecord?.slug || pack.category || label;
  return {
    label,
    slug: photoPackageSlug(slug),
    sortOrder: parent?.sortOrder ?? pack.categoryRecord?.sortOrder
  };
}

export function creativePackCategoryTokens(pack: CreativePack): string[] {
  return Array.from(new Set([
    pack.categoryRecord?.id,
    pack.categoryRecord?.slug,
    pack.categoryRecord?.label,
    pack.categoryRecord?.parent?.id,
    pack.categoryRecord?.parent?.slug,
    pack.categoryRecord?.parent?.label,
    pack.category,
    pack.name,
    pack.aiAppSlug,
    publicCollectionSlugFromPath(pack, creativePackCollectionHref(pack))
  ].filter(Boolean).map((value) => photoPackageSlug(String(value)))));
}

export function creativePackMatchesCategory(pack: CreativePack, category: string): boolean {
  const selectedSlug = photoPackageSlug(category);
  if (!selectedSlug || selectedSlug === "all") return true;
  return creativePackCategoryTokens(pack).includes(selectedSlug);
}

export function photoPackageCategoryOptions(creativePacks: CreativePack[]): PhotoPackageCategoryOption[] {
  const optionBySlug = new Map<string, PhotoPackageCategoryOption>();
  creativePacks
    .filter((pack) => pack.status === "active")
    .forEach((pack) => {
      const option = creativePackCategoryOption(pack);
      const existing = optionBySlug.get(option.slug);
      if (!existing) {
        optionBySlug.set(option.slug, option);
        return;
      }
      optionBySlug.set(option.slug, {
        ...existing,
        label: existing.label || option.label,
        sortOrder: Math.min(sortValue(existing.sortOrder), sortValue(option.sortOrder))
      });
    });
  return Array.from(optionBySlug.values())
    .sort((a, b) => sortValue(a.sortOrder) - sortValue(b.sortOrder) || a.label.localeCompare(b.label));
}

function sortValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 9999;
}

const dreamshootPackageGroupOrder = new Map([
  "best-themes-presets",
  "professional",
  "lifestyle-creative",
  "magic",
  "photo-tools"
].map((slug, index) => [slug, index]));

function groupOrderValue(group: Pick<PhotoPackageMegaGroup, "label" | "slug" | "sortOrder">): number {
  const preferred = dreamshootPackageGroupOrder.get(photoPackageSlug(group.slug || group.label));
  return preferred ?? sortValue(group.sortOrder);
}

export function getPhotoPackageMegaGroups(
  creativePacks: CreativePack[],
  creativePackCategories: CreativePackCategory[] = []
): PhotoPackageMegaGroup[] {
  const groups = new Map<string, PhotoPackageMegaGroup>();
  const isMydreamshootsCatalog = [...creativePacks, ...creativePackCategories]
    .some((record) => record.siteId === "site_dreamshoot");
  const canonicalRootBySlug = new Map(
    mydreamshootsThemeTaxonomyData.roots.map((root) => [photoPackageSlug(root.slug), root])
  );
  const canonicalItemBySlug = mydreamshootsThemeItemsBySlug;
  const collectionHrefAliases = shouldUseAidreamcapesCollectionAliases([
    ...creativePacks.map((pack) => pack.siteId),
    ...creativePackCategories.map((category) => category.siteId)
  ]) ? aidreamcapesCollectionHrefSlugAliases : dreamshootCollectionHrefSlugAliases;
  const ensureGroup = (groupSlug: string, groupLabel: string, description?: string, icon?: string, sortOrder?: number) => {
    const existing = groups.get(groupSlug);
    if (existing) {
      const group = {
        ...existing,
        description: existing.description || description,
        icon: existing.icon || icon,
        sortOrder: Math.min(sortValue(existing.sortOrder), sortValue(sortOrder))
      };
      groups.set(groupSlug, group);
      return group;
    }
    const group: PhotoPackageMegaGroup = { label: groupLabel, slug: groupSlug, description, icon, sortOrder: sortValue(sortOrder), items: [] };
    groups.set(groupSlug, group);
    return group;
  };
  const addGroupItem = (group: PhotoPackageMegaGroup, item: PhotoPackageMegaGroup["items"][number]) => {
    if (item.packId) {
      if (!group.items.some((existing) => existing.packId === item.packId)) {
        group.items.push(item);
      }
      return;
    }
    if (!group.items.some((existing) => !existing.packId && existing.slug === item.slug)) {
      group.items.push(item);
    }
  };
  const activeCategories = creativePackCategories.filter((category) => {
    if (category.status !== "active") return false;
    if (!isMydreamshootsCatalog) return true;
    const slug = photoPackageSlug(category.slug || category.label);
    return canonicalRootBySlug.has(slug) || canonicalItemBySlug.has(slug);
  });
  const categoryById = new Map(activeCategories.map((category) => [category.id, category]));
  const activePacks = creativePacks.filter((pack) => pack.status === "active");
  const canonicalParentForCategory = (category: CreativePackCategory) => {
    if (!isMydreamshootsCatalog) return undefined;
    const item = canonicalItemBySlug.get(photoPackageSlug(category.slug || category.label));
    if (!item) return undefined;
    return activeCategories.find((candidate) =>
      !candidate.parentId && photoPackageSlug(candidate.slug || candidate.label) === item.groupSlug
    );
  };
  const addActivePackItems = () => {
    activePacks.forEach((pack) => {
      const packSlug = photoPackageSlug(pack.categoryRecord?.slug || pack.category || pack.name);
      const overrideGroupSlug = shouldUseAidreamcapesCollectionAliases([pack.siteId, pack.categoryRecord?.siteId])
        ? undefined
        : dreamshootPackageGroupSlugOverrides[packSlug];
      const overrideParent = overrideGroupSlug
        ? activeCategories.find((category) => !category.parentId && photoPackageSlug(category.slug || category.label) === overrideGroupSlug)
        : undefined;
      const canonicalCategory = pack.categoryRecord?.id ? categoryById.get(pack.categoryRecord.id) : undefined;
      const canonicalTaxonomyItem = isMydreamshootsCatalog ? canonicalItemBySlug.get(packSlug) : undefined;
      const canonicalParent = canonicalTaxonomyItem
        ? activeCategories.find((category) => !category.parentId && photoPackageSlug(category.slug || category.label) === canonicalTaxonomyItem.groupSlug)
        : undefined;
      const parent = overrideParent ?? canonicalParent ?? canonicalCategory?.parent ?? (canonicalCategory?.parentId ? categoryById.get(canonicalCategory.parentId) : undefined) ?? pack.categoryRecord?.parent;
      const groupLabel = parent?.label || canonicalCategory?.label || pack.categoryRecord?.label || pack.name || photoPackageLabel(pack.categoryRecord?.slug || pack.category);
      const groupSlug = parent?.slug || photoPackageSlug(groupLabel);
      const group = ensureGroup(groupSlug, groupLabel, parent?.description ?? canonicalCategory?.description ?? pack.categoryRecord?.description, parent?.icon ?? parent?.iconName ?? canonicalCategory?.icon ?? canonicalCategory?.iconName ?? pack.categoryRecord?.icon ?? pack.categoryRecord?.iconName, parent?.sortOrder ?? canonicalCategory?.sortOrder ?? pack.categoryRecord?.sortOrder);
      addGroupItem(group, {
        label: photoPackageMenuLabel(pack.name || pack.categoryRecord?.label),
        slug: pack.id,
        href: creativePackCollectionHref(pack, collectionHrefAliases),
        packId: pack.id,
        icon: canonicalCategory?.icon ?? canonicalCategory?.iconName ?? pack.categoryRecord?.icon ?? pack.categoryRecord?.iconName,
        sortOrder: sortValue(canonicalCategory?.sortOrder ?? pack.categoryRecord?.sortOrder)
      });
    });
  };
  const rootCategories = activeCategories
    .filter((category) => !category.parentId && !category.parent)
    .sort((a, b) => sortValue(a.sortOrder) - sortValue(b.sortOrder) || a.label.localeCompare(b.label));
  if (rootCategories.length) {
    const rootIds = new Set(rootCategories.map((category) => category.id));
    rootCategories.forEach((category) => {
      const groupSlug = category.slug || photoPackageSlug(category.label);
      ensureGroup(groupSlug, category.label, category.description, category.icon ?? category.iconName, sortValue(category.sortOrder));
    });
    if (activePacks.length) {
      addActivePackItems();
      return sortedMegaGroups(groups);
    }
    activeCategories
      .filter((category) => !rootIds.has(category.id))
      .sort((a, b) => sortValue(a.sortOrder) - sortValue(b.sortOrder) || a.label.localeCompare(b.label))
      .forEach((category) => {
        const parent = canonicalParentForCategory(category) ?? category.parent ?? (category.parentId ? categoryById.get(category.parentId) : undefined);
        const groupLabel = parent?.label || category.label;
        const groupSlug = parent?.slug || photoPackageSlug(groupLabel);
        const group = ensureGroup(groupSlug, groupLabel, parent?.description || category.description, parent?.icon ?? parent?.iconName ?? category.icon ?? category.iconName, sortValue(parent?.sortOrder));
        const itemSlug = category.slug || photoPackageSlug(category.label);
        addGroupItem(group, { label: photoPackageMenuLabel(category.label), slug: itemSlug, href: photoPackageCollectionHrefForSlug(itemSlug, collectionHrefAliases, category), icon: category.icon ?? category.iconName, sortOrder: sortValue(category.sortOrder) });
      });
    addActivePackItems();
    return sortedMegaGroups(groups);
  }
  if (activePacks.length) {
    addActivePackItems();
  } else {
    activeCategories.forEach((category) => {
      const parent = canonicalParentForCategory(category) ?? category.parent;
      const groupLabel = parent?.label || category.label;
      const groupSlug = parent?.slug || photoPackageSlug(groupLabel);
      const group = ensureGroup(groupSlug, groupLabel, parent?.description || category.description, parent?.icon ?? parent?.iconName ?? category.icon ?? category.iconName, sortValue(parent?.sortOrder ?? category.sortOrder));
      const itemSlug = category.slug || photoPackageSlug(category.label);
      addGroupItem(group, { label: photoPackageMenuLabel(category.label), slug: itemSlug, href: photoPackageCollectionHrefForSlug(itemSlug, collectionHrefAliases, category), icon: category.icon ?? category.iconName, sortOrder: sortValue(category.sortOrder) });
    });
  }
  return sortedMegaGroups(groups);
}

function sortedMegaGroups(groups: Map<string, PhotoPackageMegaGroup>): PhotoPackageMegaGroup[] {
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => sortValue(a.sortOrder) - sortValue(b.sortOrder) || a.label.localeCompare(b.label))
    }))
    .filter((group) => group.items.length > 0)
    .sort((a, b) => groupOrderValue(a) - groupOrderValue(b) || sortValue(a.sortOrder) - sortValue(b.sortOrder) || a.label.localeCompare(b.label));
}
