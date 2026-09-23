/**
 * Public routes retired from the local Aidreamcapes EU storefront.
 *
 * Keep this list site-scoped: the same path can still be valid for another
 * storefront and must not be retired globally.
 */
export const AIDREAMCAPES_EU_SITE_ID = "site_aidreamcapes_xby";
export const AIDREAMCAPES_EU_RETIRED_PUBLIC_PATHS = new Set<string>([
  "/ai-save-the-date/easter",
  "/ai-save-the-date/wedding-anniversary",
  "/ai-image-generation/estilo-y-fantasia",
  "/ai-image-generation/urbano",
  "/collections/soccer",
  "/collections/christmas-photo",
  "/collections/thanksgiving-photo",
  "/tools/image-studio",
  "/tools/seasonal-celebration-album-maker"
]);

/**
 * Routes that must not be emitted as EU internal navigation. They remain
 * unavailable for this storefront; this list is intentionally site-scoped so
 * another storefront can keep using the same path when it is published there.
 */
export const AIDREAMCAPES_EU_REMOVED_PUBLIC_NAVIGATION_PATHS = new Set<string>([
  "/ai-image-generation/estilo-y-fantasia",
  "/ai-image-generation/urbano",
  "/collections/soccer",
  "/collections/christmas-photo",
  "/collections/thanksgiving-photo",
  "/tools/image-studio",
  "/tools/seasonal-celebration-album-maker"
]);

/**
 * Dynamic EU tool leaves are rendered by the storefront tool renderer rather
 * than by one LivePage row each. Keep their public inventory explicit so the
 * sitemap cannot silently fall back to the smaller database projection.
 */
export const AIDREAMCAPES_EU_PUBLIC_DETAIL_PATHS = new Set<string>([
  "/ai-image-generation/motion-generator",
  "/tools/fan-scene-album-builder",
  "/tools/backstage-meetup-scene-builder",
  "/tools/supporter-photo-wall-maker",
  "/tools/fan-keepsake-card-maker",
  "/tools/game-day-group-portrait-maker",
  "/tools/stadium-night-fan-set-maker",
  "/tools/watch-party-album-builder",
  "/tools/premiere-portrait-set-builder",
  "/tools/vip-arrival-photo-maker",
  "/tools/award-night-album-studio",
  "/tools/new-year-countdown-album-maker",
  "/tools/christmas-group-album-studio",
  "/tools/cozy-card-portrait-maker",
  "/tools/winter-fan-greeting-maker",
  "/tools/thanksgiving-keepsake-set-maker",
  "/tools/friendsgiving-memory-maker",
  "/tools/halloween-party-portrait-maker",
  "/tools/costume-cast-album-builder",
  "/tools/birthday-fan-moment-maker"
]);

/**
 * Legacy EU homepage showcase targets that still exist in older catalog
 * records. Keep the catalog records intact and normalize only the public EU
 * link projection to the current canonical detail routes.
 */
export const AIDREAMCAPES_EU_LEGACY_PUBLIC_PATH_TARGETS = new Map<string, string>([
  ["/ai-image-generation/engagement", "/ai-image-generation/engagement-photo"],
  ["/ai-image-generation/valentine-photos", "/ai-image-generation/valentines-photo"],
  ["/ai-image-generation/christmas-photos", "/ai-image-generation/christmas-photo"],
  ["/ai-image-generation/halloween-party-photos", "/ai-image-generation/halloween-photo"],
  ["/ai-image-generation/thanksgiving-group-photos", "/ai-image-generation/thanksgiving-photo"],
  ["/ai-image-generation/profile-cards", "/ai-image-generation/avatar"],
  ["/ai-image-generation/professional-headshots", "/ai-image-generation/professional"]
]);

function normalizeAidreamcapesEuPath(path: string): string {
  return String(path || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .split(/[?#]/, 1)[0]
    .replace(/^\/site\/aidreamcapes-eu(?=\/|$)/i, "")
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "") || "/";
}

export function canonicalAidreamcapesEuPublicPath(path: string): string {
  const normalizedPath = normalizeAidreamcapesEuPath(path);
  return AIDREAMCAPES_EU_LEGACY_PUBLIC_PATH_TARGETS.get(normalizedPath) ?? normalizedPath;
}

export function isAidreamcapesEuRetiredPublicPath(siteIdOrSlug: string | null | undefined, path: string): boolean {
  const site = String(siteIdOrSlug ?? "").trim().toLowerCase();
  const normalizedPath = normalizeAidreamcapesEuPath(path);
  return (site === AIDREAMCAPES_EU_SITE_ID || site === "aidreamcapes-eu" || site === "aidreamcapes.eu") &&
    AIDREAMCAPES_EU_RETIRED_PUBLIC_PATHS.has(normalizedPath);
}

export function isAidreamcapesEuRemovedPublicNavigationPath(
  siteIdentity: string | { id?: string | null; slug?: string | null; primaryDomain?: string | null } | null | undefined,
  path: string
): boolean {
  const explicitEuPath = /(?:^|\/)site\/aidreamcapes-eu(?:\/|$)/i.test(String(path || ""))
    || /(?:^|\/)aidreamcapes\.eu(?:\/|$)/i.test(String(path || ""));
  const identities = typeof siteIdentity === "string" || siteIdentity == null
    ? [String(siteIdentity ?? "")]
    : [siteIdentity.id, siteIdentity.slug, siteIdentity.primaryDomain];
  const isAidreamcapesEu = identities.some((identity) => {
    const value = String(identity ?? "").trim().toLowerCase();
    return value === AIDREAMCAPES_EU_SITE_ID || value === "aidreamcapes-eu" || value === "aidreamcapes.eu";
  });
  return (isAidreamcapesEu || explicitEuPath) &&
    AIDREAMCAPES_EU_REMOVED_PUBLIC_NAVIGATION_PATHS.has(normalizeAidreamcapesEuPath(path));
}
