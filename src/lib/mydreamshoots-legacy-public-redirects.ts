export const MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS = [
  { aliasPath: "/ai-image-generation/motion-generator", targetPath: "/ai-video-generation/motion-generator" },
  { aliasPath: "/ai-video-generation/ai-avatar-video", targetPath: "/ai-video-generation" },
  { aliasPath: "/corporate-video", targetPath: "/ai-video-generation" },
  { aliasPath: "/fitness-video", targetPath: "/ai-video-generation" },
  { aliasPath: "/partner-registration", targetPath: "/creators-circle" }
] as const;

export type MydreamshootsLegacyPublicRedirect = (typeof MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS)[number];

export function mydreamshootsLegacyPublicRedirectTarget(pathname: string): string | undefined {
  return MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS.find((item) => item.aliasPath === pathname)?.targetPath;
}
