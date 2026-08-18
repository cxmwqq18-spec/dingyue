import { isMydreamshootsVideoFrameworkSiteId, mydreamshootsPublicVideoGenerationTopicSlugs } from "@/lib/mydreamshoots-video-framework";

const blockedPublicVideoThemeSlugs = new Set(["creator-scene-motion"]);

export function publicVideoThemeSlugListForSite(siteId: string): readonly string[] | undefined {
  return isMydreamshootsVideoFrameworkSiteId(siteId)
    ? mydreamshootsPublicVideoGenerationTopicSlugs
    : undefined;
}

export function isBlockedPublicVideoThemeSlugForSite(siteId: string, slug: string): boolean {
  return (siteId === "site_dreamshoot" || siteId === "site_aidreamcapes") && blockedPublicVideoThemeSlugs.has(slug);
}
