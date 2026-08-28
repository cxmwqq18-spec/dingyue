const SAVE_THE_DATE_ROUTE_PREFIX = "/ai-save-the-date/";
const WEDDING_INVITATION_CANONICAL_PATH = "/holidays-events/wedding-invitation";
const WEDDING_INVITATION_LEGACY_PATH = "/ai-save-the-date/wedding-invitation";

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
  // Wedding Invitation has its own documented holidays-events canonical. Keep
  // the old Save the Date URL recoverable, but never make it the canonical URL.
  if (normalized === WEDDING_INVITATION_LEGACY_PATH || normalized.startsWith(`${WEDDING_INVITATION_LEGACY_PATH}/`)) {
    return `${WEDDING_INVITATION_CANONICAL_PATH}${normalized.slice(WEDDING_INVITATION_LEGACY_PATH.length)}`;
  }
  if (normalized === WEDDING_INVITATION_CANONICAL_PATH || normalized.startsWith(`${WEDDING_INVITATION_CANONICAL_PATH}/`)) return normalized;
  const sourcePrefix = normalized.startsWith("/holidays-events/")
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
  if (suffix === "wedding-invitation") return WEDDING_INVITATION_CANONICAL_PATH;
  return suffix === "wedding-ceremony"
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
