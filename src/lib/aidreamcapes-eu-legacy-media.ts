const legacyMirrorCoverPattern = /^\/assets\/sites\/site_aidreamcapes_eu\/mirror\/aidreamcapes\/dreamshoot\/generated\/pack-covers\/([^/]+)\/\1-cover\.(?:png|jpe?g|webp|avif)$/i;
const legacyMirrorGalleryPattern = /^\/assets\/sites\/site_aidreamcapes_eu\/mirror\/aidreamcapes\/dreamshoot\/generated\/pack-galleries\/([^/]+)\/\1-01\.(?:png|jpe?g|webp|avif)$/i;

function withoutQuery(value: string | undefined): string {
  return String(value ?? "").trim().split(/[?#]/, 1)[0] ?? "";
}

/**
 * The first EU legacy gallery slot was exported from the same source frame as
 * the dedicated cover. The files have different paths/aspect ratios, so URL
 * de-duplication alone cannot protect the public detail page from showing the
 * same visual twice.
 */
export function isAidreamcapesEuLegacyCoverGalleryDerivative(
  coverUrl: string | undefined,
  galleryUrl: string | undefined
): boolean {
  const coverMatch = withoutQuery(coverUrl).match(legacyMirrorCoverPattern);
  const galleryMatch = withoutQuery(galleryUrl).match(legacyMirrorGalleryPattern);
  return Boolean(coverMatch && galleryMatch && coverMatch[1] === galleryMatch[1]);
}
