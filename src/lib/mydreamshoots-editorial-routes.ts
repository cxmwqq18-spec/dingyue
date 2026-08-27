export const MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES = [
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-invitation",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/wedding-anniversary",
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day",
  "/ai-save-the-date/halloween"
] as const;

// These routes stay available by direct URL, but are temporarily suppressed
// from the public Save the Date navigation while their catalogue status is reviewed.
export const MYDREAMSHOOTS_REMOVED_LEGACY_ROUTES = [
  "/ai-save-the-date/wedding-anniversary"
] as const;

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
  // Wedding Invitation is a complete public page. Wedding Anniversary remains
  // directly reachable but is temporarily excluded from indexing and sitemap.
  indexable: canonicalPath !== "/ai-save-the-date/wedding-anniversary",
  sitemapEligible: canonicalPath !== "/ai-save-the-date/wedding-anniversary",
  requiredProjectionKinds: ["page", "copy", "media", "links"] as const
}));

export function isMydreamshootsEditorialThemeRoute(path: string): boolean {
  return MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES.includes(path as (typeof MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES)[number]);
}
