const SAVE_THE_DATE_ROUTE_PREFIX = "/ai-save-the-date/";
export const MYDREAMSHOOTS_WEDDING_INVITATION_PATH = "/ai-save-the-date/wedding-invitation";
export const MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH = "/ai-video-generation/wedding-invitation";
export const MYDREAMSHOOTS_WEDDING_INVITATION_RETIRED_PATH = "/holidays-events/wedding-invitation";

/**
 * Save the Date owns every route previously published below /holidays-events.
 * Keeping this mapping in one place lets runtime links and legacy requests
 * converge on the same canonical URL while old bookmarks remain recoverable.
 */
export function canonicalSaveTheDatePath(pathname: string): string {
  const normalized = !pathname || pathname === "/"
    ? "/"
    : pathname.startsWith("/")
      ? pathname
      : `/${pathname}`;
  const sourcePrefix = normalized === MYDREAMSHOOTS_WEDDING_INVITATION_RETIRED_PATH
    ? ""
    : normalized === MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH
      ? ""
      : normalized.startsWith("/holidays-events/")
    ? "/holidays-events/"
    : (normalized === "/ai-video-generation/wedding-ceremony" || normalized.startsWith("/ai-video-generation/wedding-ceremony/"))
      ? "/ai-video-generation/"
      : "";
  if (!sourcePrefix) return normalized;
  const slug = normalized.slice(sourcePrefix.length).split(/[?#]/)[0]?.replace(/\/+$/, "");
  return slug ? `${SAVE_THE_DATE_ROUTE_PREFIX}${slug}` : normalized;
}

export function legacySaveTheDatePath(pathname: string): string | undefined {
  const normalized = !pathname || pathname === "/"
    ? "/"
    : pathname.startsWith("/")
      ? pathname
      : `/${pathname}`;
  if (!normalized.startsWith(SAVE_THE_DATE_ROUTE_PREFIX)) return undefined;
  const suffix = normalized.slice(SAVE_THE_DATE_ROUTE_PREFIX.length).split(/[?#]/)[0]?.replace(/\/+$/, "");
  if (!suffix) return undefined;
  return suffix === "wedding-invitation"
    ? MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH
    : suffix === "wedding-ceremony"
    ? "/ai-video-generation/wedding-ceremony"
    : `/holidays-events/${suffix}`;
}

export function isSaveTheDatePath(pathname: string): boolean {
  const normalized = !pathname || pathname === "/"
    ? "/"
    : pathname.startsWith("/")
      ? pathname
      : `/${pathname}`;
  return normalized.startsWith(SAVE_THE_DATE_ROUTE_PREFIX) || normalized.startsWith("/holidays-events/");
}
