export const MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS = [
  { aliasPath: "/ai-image-generation/motion-generator", targetPath: "/ai-video-generation/motion-generator" }
] as const;

// These routes were retired rather than migrated. Keep this explicit so a
// future page or publication record cannot make them crawlable again.
export const MYDREAMSHOOTS_RETIRED_PUBLIC_PATHS = [
  "/ai-video-generation/ai-avatar-video",
  "/corporate-video",
  "/fitness-video",
  "/partner-registration"
] as const;

export type MydreamshootsLegacyPublicRedirect = (typeof MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS)[number];

export function mydreamshootsLegacyPublicRedirectTarget(pathname: string): string | undefined {
  return MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS.find((item) => item.aliasPath === pathname)?.targetPath;
}

export function isMydreamshootsRetiredPublicPath(pathname: string): boolean {
  const normalized = pathname.split(/[?#]/)[0]?.replace(/\/+$/, "") || "/";
  return MYDREAMSHOOTS_RETIRED_PUBLIC_PATHS.includes(normalized as (typeof MYDREAMSHOOTS_RETIRED_PUBLIC_PATHS)[number]);
}
