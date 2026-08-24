export const MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES = [
  "/ai-save-the-date/valentines-day",
  "/holidays-events/engagement",
  "/holidays-events/proposal",
  "/holidays-events/save-the-date",
  "/ai-video-generation/wedding-ceremony",
  "/holidays-events/mothers-day",
  "/holidays-events/fathers-day",
  "/holidays-events/halloween"
] as const;

export const MYDREAMSHOOTS_REMOVED_LEGACY_ROUTES = [
  "/holidays-events/christmas",
  "/holidays-events/thanksgiving",
  "/holidays-events/new-year"
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

export function isMydreamshootsEditorialThemeRoute(path: string): boolean {
  return MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES.includes(path as (typeof MYDREAMSHOOTS_EDITORIAL_THEME_ROUTES)[number]);
}
