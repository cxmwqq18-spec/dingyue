/**
 * Public routes retired from the local Aidreamcapes EU storefront.
 *
 * Keep this list site-scoped: the same path can still be valid for another
 * storefront and must not be retired globally.
 */
export const AIDREAMCAPES_EU_SITE_ID = "site_aidreamcapes_xby";
export const AIDREAMCAPES_EU_RETIRED_PUBLIC_PATHS = new Set<string>([
  "/ai-save-the-date/easter"
]);

export function isAidreamcapesEuRetiredPublicPath(siteIdOrSlug: string | null | undefined, path: string): boolean {
  const site = String(siteIdOrSlug ?? "").trim().toLowerCase();
  const normalizedPath = String(path || "").split(/[?#]/, 1)[0].replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return (site === AIDREAMCAPES_EU_SITE_ID || site === "aidreamcapes-eu" || site === "aidreamcapes.eu") &&
    AIDREAMCAPES_EU_RETIRED_PUBLIC_PATHS.has(normalizedPath);
}
