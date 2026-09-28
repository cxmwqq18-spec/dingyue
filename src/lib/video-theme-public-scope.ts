import { isMydreamshootsVideoFrameworkSiteId, mydreamshootsPublicVideoGenerationTopicSlugs, mydreamshootsVideoGenerationParentCategories } from "@/lib/mydreamshoots-video-framework";

const blockedPublicVideoThemeSlugsBySite: Readonly<Record<string, ReadonlySet<string>>> = {
  // The original Aidreamcapes site only has this retired public theme.
  site_aidreamcapes: new Set(["creator-scene-motion"]),
  // These legacy themes are still present in some section settings, but their
  // public landing pages are not part of the 117-page EU storefront contract.
  // Keep them out of cards, navigation, APIs, and structured data together so
  // a stale setting cannot create an internal link to a 404/noindex route.
  site_aidreamcapes_xby: new Set([
    "creator-scene-motion",
    "cinematic-portrait-motion",
    "creator-intro-motion",
    "holiday-card-motion",
    "product-showcase-motion",
    "prompt-directed-motion",
    "social-profile-clip",
    "travel-route-story",
    "wedding-memory-film"
  ])
};

export function publicVideoThemeSlugListForSite(siteId: string): readonly string[] | undefined {
  return isMydreamshootsVideoFrameworkSiteId(siteId)
    ? mydreamshootsPublicVideoGenerationTopicSlugs
    : undefined;
}

export function publicVideoThemeCategorySlugListForSite(siteId: string): readonly string[] | undefined {
  return isMydreamshootsVideoFrameworkSiteId(siteId)
    ? [...mydreamshootsPublicVideoGenerationTopicSlugs, ...mydreamshootsVideoGenerationParentCategories.map((category) => category.slug)]
    : undefined;
}

export function isBlockedPublicVideoThemeSlugForSite(siteId: string, slug: string): boolean {
  return blockedPublicVideoThemeSlugsBySite[siteId]?.has(slug) ?? false;
}
