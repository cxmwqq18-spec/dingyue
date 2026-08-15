import type { Site, VideoThemeCategory } from "@/lib/types";

export const mydreamshootsVideoFrameworkSiteIds = ["site_dreamshoot", "site_grownstride_test"] as const;

export const mydreamshootsVideoGenerationCategories = [
  {
    slug: "text-to-video",
    label: "Text to video",
    description: "Video themes created from written prompts.",
    sortOrder: 10
  },
  {
    slug: "image-to-video",
    label: "Image to Video",
    description: "Video themes created from uploaded or selected images.",
    sortOrder: 20
  }
] as const;

type VideoFrameworkSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;

export function isMydreamshootsVideoFrameworkSiteId(siteId: string | null | undefined): boolean {
  return mydreamshootsVideoFrameworkSiteIds.includes(String(siteId ?? "") as (typeof mydreamshootsVideoFrameworkSiteIds)[number]);
}

export function isMydreamshootsVideoFrameworkSite(site: VideoFrameworkSite): boolean {
  if (isMydreamshootsVideoFrameworkSiteId(site.id)) return true;
  const identity = `${site.slug} ${site.name} ${site.primaryDomain} ${site.branding?.logoText ?? ""}`.toLowerCase();
  return /\bmydreamshoots\b/.test(identity) && !/aidream/i.test(identity);
}

export function videoGenerationCreatePath(_slug?: string): string {
  return "/app/create#step-video";
}

export function activeVideoGenerationCategories(categories: VideoThemeCategory[] = []): Array<Pick<VideoThemeCategory, "id" | "slug" | "label" | "sortOrder"> & { href: string }> {
  const configuredBySlug = new Map(
    categories
      .filter((category) => category.status === "active")
      .map((category) => [category.slug, category])
  );
  const source = mydreamshootsVideoGenerationCategories
    .map((category) => {
      const configured = configuredBySlug.get(category.slug);
      return configured
        ? {
            ...configured,
            label: category.label,
            description: category.description,
            sortOrder: category.sortOrder
          }
        : {
            id: `video_framework_${category.slug}`,
            siteId: "site_dreamshoot",
            slug: category.slug,
            label: category.label,
            description: category.description,
            sortOrder: category.sortOrder,
            status: "active" as const,
            createdAt: new Date(0).toISOString()
          };
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
  return source.map((category) => ({
    id: category.id,
    slug: category.slug,
    label: category.label,
    sortOrder: category.sortOrder,
    href: videoGenerationCreatePath(category.slug)
  }));
}
