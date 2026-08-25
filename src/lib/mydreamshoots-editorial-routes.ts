export const MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES = [
  "/ai-save-the-date/valentines-day",
  "/holidays-events/engagement",
  "/holidays-events/proposal",
  "/holidays-events/save-the-date",
  "/holidays-events/wedding-invitation",
  "/ai-video-generation/wedding-ceremony",
  "/holidays-events/wedding-anniversary",
  "/holidays-events/christmas",
  "/holidays-events/thanksgiving",
  "/holidays-events/new-year",
  "/holidays-events/mothers-day",
  "/holidays-events/fathers-day",
  "/holidays-events/halloween"
] as const;

// These routes were previously treated as legacy content, but they are part
// of the approved Save the Date taxonomy and must remain publishable.
export const MYDREAMSHOOTS_REMOVED_LEGACY_ROUTES = [] as const;

export function isMydreamshootsRemovedLegacyRoute(path: string): boolean {
  return MYDREAMSHOOTS_REMOVED_LEGACY_ROUTES.includes(path as (typeof MYDREAMSHOOTS_REMOVED_LEGACY_ROUTES)[number]);
}

export const MYDREAMSHOOTS_STANDARD_SEO_ROUTES = [
  "/about-us",
  "/best-packages",
  "/best-ai-image",
  "/best-ai-video",
  "/best-save-the-date",
  "/pricing",
  "/faq",
  "/workflow",
  ...MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES
] as const;

export const MYDREAMSHOOTS_STANDARD_SEO_INVENTORY = MYDREAMSHOOTS_STANDARD_SEO_ROUTES.map((canonicalPath) => ({
  canonicalPath,
  routeKind: "standard-content" as const,
  disposition: "render" as const,
  indexable: true,
  sitemapEligible: true,
  requiredProjectionKinds: ["page", "copy", "media", "links"] as const
}));

export function isMydreamshootsEditorialThemeRoute(path: string): boolean {
  return MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES.includes(path as (typeof MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES)[number]);
}
