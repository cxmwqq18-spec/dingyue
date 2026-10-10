export const MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS = [
  { aliasPath: "/ai-image-generation/motion-generator", targetPath: "/ai-video-generation/motion-generator" },
  { aliasPath: "/ai-image-generation/estilo-y-fantasia", targetPath: "/ai-image-generation/travel" },
  { aliasPath: "/ai-image-generation/urbano", targetPath: "/ai-image-generation/urban" },
  { aliasPath: "/ai-image-generation/couple", targetPath: "/ai-image-generation/engagement-photo" },
  { aliasPath: "/ai-image-generation/cultural", targetPath: "/ai-image-generation" },
  { aliasPath: "/ai-image-generation/wedding", targetPath: "/ai-image-generation/wedding-photo" },
  { aliasPath: "/ai-image-generation/sports", targetPath: "/ai-image-generation/soccer" },
  { aliasPath: "/ai-image-generation/creator", targetPath: "/ai-image-generation/avatar" },
  { aliasPath: "/ai-image-generation/video", targetPath: "/ai-video-generation" },
  { aliasPath: "/ai-video-generation/christmas", targetPath: "/ai-save-the-date/christmas" },
  { aliasPath: "/ai-video-generation/halloween", targetPath: "/ai-save-the-date/halloween" },
  { aliasPath: "/ai-video-generation/fathers-day", targetPath: "/ai-save-the-date/fathers-day" },
  { aliasPath: "/ai-video-generation/engagement", targetPath: "/ai-save-the-date/engagement" }
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
