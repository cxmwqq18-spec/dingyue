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
  "cafe-street-stories": "cafe-corner-stories",
  "professional-headshots": "headshots",
  "road-trip-frames": "cinematic-travel"
};

function photoPackageCollectionHrefForSlug(slug: string | undefined): string {
  const normalizedSlug = photoPackageSlug(slug);
  const hrefSlug = aidreamcapesCollectionHrefSlugAliases[normalizedSlug] ?? normalizedSlug;
  return hrefSlug ? `/collections/${hrefSlug}` : "/collections";
}

export function creativePackCollectionHref(pack: CreativePack): string {
  return photoPackageCollectionHrefForSlug(pack.categoryRecord?.slug || pack.category || pack.name);
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
  "creator",
  "avatar",
  "wedding",
  "cultural",
  "couple",
  "creative",
  "beauty",
  "sports",
  "video",
  "utility",
  "headshots",
  "seasonal"
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
    if (!group.items.some((existing) => existing.slug === item.slug)) {
      group.items.push(item);
    }
  };
  const activeCategories = creativePackCategories.filter((category) => category.status === "active");
  const categoryById = new Map(activeCategories.map((category) => [category.id, category]));
  const rootCategories = activeCategories
    .filter((category) => !category.parentId && !category.parent)
    .sort((a, b) => sortValue(a.sortOrder) - sortValue(b.sortOrder) || a.label.localeCompare(b.label));
  if (rootCategories.length) {
    const rootIds = new Set(rootCategories.map((category) => category.id));
    rootCategories.forEach((category) => {
      const groupSlug = category.slug || photoPackageSlug(category.label);
      ensureGroup(groupSlug, category.label, category.description, category.icon ?? category.iconName, sortValue(category.sortOrder));
    });
    activeCategories
      .filter((category) => !rootIds.has(category.id))
      .sort((a, b) => sortValue(a.sortOrder) - sortValue(b.sortOrder) || a.label.localeCompare(b.label))
      .forEach((category) => {
        const parent = category.parent ?? (category.parentId ? categoryById.get(category.parentId) : undefined);
        const groupLabel = parent?.label || category.label;
        const groupSlug = parent?.slug || photoPackageSlug(groupLabel);
        const group = ensureGroup(groupSlug, groupLabel, parent?.description || category.description, parent?.icon ?? parent?.iconName ?? category.icon ?? category.iconName, sortValue(parent?.sortOrder));
        const itemSlug = category.slug || photoPackageSlug(category.label);
        addGroupItem(group, { label: photoPackageMenuLabel(category.label), slug: itemSlug, href: photoPackageCollectionHrefForSlug(itemSlug), icon: category.icon ?? category.iconName, sortOrder: sortValue(category.sortOrder) });
      });
    return sortedMegaGroups(groups);
  }
  activeCategories.forEach((category) => {
    const parent = category.parent;
    const groupLabel = parent?.label || category.label;
    const groupSlug = parent?.slug || photoPackageSlug(groupLabel);
    const group = ensureGroup(groupSlug, groupLabel, parent?.description || category.description, parent?.icon ?? parent?.iconName ?? category.icon ?? category.iconName, sortValue(parent?.sortOrder ?? category.sortOrder));
    const itemSlug = category.slug || photoPackageSlug(category.label);
    addGroupItem(group, { label: photoPackageMenuLabel(category.label), slug: itemSlug, href: photoPackageCollectionHrefForSlug(itemSlug), icon: category.icon ?? category.iconName, sortOrder: sortValue(category.sortOrder) });
  });
  creativePacks
    .filter((pack) => pack.status === "active")
    .forEach((pack) => {
      const parent = pack.categoryRecord?.parent;
      const groupLabel = parent?.label || pack.categoryRecord?.label || pack.name || photoPackageLabel(pack.categoryRecord?.slug || pack.category);
      const groupSlug = parent?.slug || photoPackageSlug(groupLabel);
      const group = ensureGroup(groupSlug, groupLabel, parent?.description ?? undefined, parent?.icon ?? parent?.iconName, sortValue(parent?.sortOrder));
      const itemLabel = photoPackageMenuLabel(pack.categoryRecord?.label || pack.name);
      const itemSlug = pack.categoryRecord?.slug || photoPackageSlug(pack.name);
      addGroupItem(group, {
        label: itemLabel,
        slug: itemSlug,
        href: creativePackCollectionHref(pack),
        icon: pack.categoryRecord?.icon ?? pack.categoryRecord?.iconName,
        sortOrder: sortValue(pack.categoryRecord?.sortOrder)
      });
    });
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
