import type { PublishedHomepageShowcaseItem, SaveTheDateNavigationGroup, SaveTheDateNavigationItem } from "@/lib/types";
import { canonicalSaveTheDatePath } from "@/lib/save-the-date-routes";

export type PublishedSaveTheDateItem = SaveTheDateNavigationItem & Required<Pick<SaveTheDateNavigationItem, "description" | "imageUrl" | "imageAlt">>;

export type PublishedSaveTheDateGroup = Omit<SaveTheDateNavigationGroup, "items"> & {
  items: PublishedSaveTheDateItem[];
};

function groupSlug(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "save-the-date";
}

function isPublishedSaveTheDateShowcase(item: PublishedHomepageShowcaseItem): boolean {
  return item.kind === "save_the_date" && item.status === "published" && item.indexable && item.sitemapEligible && Boolean(
    item.canonicalPath.trim() && item.title.trim() && item.subtitle.trim() && item.imageUrl.trim() && item.imageAlt.trim()
  );
}

// Public cards, category totals, and header links are all projected from the
// same immutable publication collection. Draft navigation is not a runtime owner.
export function resolvePublishedSaveTheDateGroups(showcases: PublishedHomepageShowcaseItem[]): PublishedSaveTheDateGroup[] {
  const byCategory = new Map<string, PublishedSaveTheDateItem[]>();
  for (const item of showcases.filter(isPublishedSaveTheDateShowcase).sort((left, right) => left.sortOrder - right.sortOrder || left.canonicalPath.localeCompare(right.canonicalPath))) {
    const category = item.category?.trim() || "Save the Date";
    const items = byCategory.get(category) ?? [];
    items.push({
      label: item.title,
      slug: item.canonicalPath.split("/").filter(Boolean).at(-1) || item.id,
      href: canonicalSaveTheDatePath(item.canonicalPath),
      description: item.subtitle,
      imageUrl: item.imageUrl,
      imageAlt: item.imageAlt,
      status: "published",
      sortOrder: item.sortOrder
    });
    byCategory.set(category, items);
  }
  return Array.from(byCategory.entries())
    .map(([label, items]) => ({ label, slug: groupSlug(label), sortOrder: items[0]?.sortOrder ?? 0, items }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
}
