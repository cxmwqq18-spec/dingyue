import type { CreativePack, CreativePackCategory } from "@/lib/types";

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
  return siteIds.some((siteId) => (siteId ?? "").toLowerCase().includes("aidreamcapes"));
}

function photoPackageCollectionHrefForSlug(slug: string | undefined, aliases: Record<string, string> = dreamshootCollectionHrefSlugAliases): string {
  const normalizedSlug = photoPackageSlug(slug);
  const hrefSlug = aliases[normalizedSlug] ?? normalizedSlug;
  return hrefSlug ? `/collections/${hrefSlug}` : "/collections";
}

export function creativePackCollectionHref(pack: CreativePack, aliases?: Record<string, string>): string {
  const scopedAliases = aliases ?? (shouldUseAidreamcapesCollectionAliases([pack.siteId, pack.categoryRecord?.siteId]) ? aidreamcapesCollectionHrefSlugAliases : dreamshootCollectionHrefSlugAliases);
  return photoPackageCollectionHrefForSlug(pack.categoryRecord?.slug || pack.category || pack.name, scopedAliases);
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
    creativePackCollectionHref(pack).replace(/^\/collections\//, "")
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
  const activeCategories = creativePackCategories.filter((category) => category.status === "active");
  const categoryById = new Map(activeCategories.map((category) => [category.id, category]));
  const activePacks = creativePacks.filter((pack) => pack.status === "active");
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
      const parent = overrideParent ?? canonicalCategory?.parent ?? (canonicalCategory?.parentId ? categoryById.get(canonicalCategory.parentId) : undefined) ?? pack.categoryRecord?.parent;
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
        const parent = category.parent ?? (category.parentId ? categoryById.get(category.parentId) : undefined);
        const groupLabel = parent?.label || category.label;
        const groupSlug = parent?.slug || photoPackageSlug(groupLabel);
        const group = ensureGroup(groupSlug, groupLabel, parent?.description || category.description, parent?.icon ?? parent?.iconName ?? category.icon ?? category.iconName, sortValue(parent?.sortOrder));
        const itemSlug = category.slug || photoPackageSlug(category.label);
        addGroupItem(group, { label: photoPackageMenuLabel(category.label), slug: itemSlug, href: photoPackageCollectionHrefForSlug(itemSlug, collectionHrefAliases), icon: category.icon ?? category.iconName, sortOrder: sortValue(category.sortOrder) });
      });
    addActivePackItems();
    return sortedMegaGroups(groups);
  }
  if (activePacks.length) {
    addActivePackItems();
  } else {
    activeCategories.forEach((category) => {
      const parent = category.parent;
      const groupLabel = parent?.label || category.label;
      const groupSlug = parent?.slug || photoPackageSlug(groupLabel);
      const group = ensureGroup(groupSlug, groupLabel, parent?.description || category.description, parent?.icon ?? parent?.iconName ?? category.icon ?? category.iconName, sortValue(parent?.sortOrder ?? category.sortOrder));
      const itemSlug = category.slug || photoPackageSlug(category.label);
      addGroupItem(group, { label: photoPackageMenuLabel(category.label), slug: itemSlug, href: photoPackageCollectionHrefForSlug(itemSlug, collectionHrefAliases), icon: category.icon ?? category.iconName, sortOrder: sortValue(category.sortOrder) });
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
