import manifest from "./storefront-responsive-image-manifest.json";

export type StorefrontResponsiveImageVariant = {
  width: number;
  avif?: string;
  webp?: string;
};

export type StorefrontResponsiveImageEntry = {
  site?: string;
  width: number;
  height: number;
  format?: string;
  bytes?: number;
  sha256?: string;
  original: string;
  variants: StorefrontResponsiveImageVariant[];
};

export type StorefrontResponsiveImageSet = StorefrontResponsiveImageEntry & {
  avifSrcSet: string;
  webpSrcSet: string;
  fallbackSrcSet: string;
  fallbackSrc: string;
};

const imageManifest = manifest as Record<string, StorefrontResponsiveImageEntry>;

// These published Spanish storefront media files are served by the asset
// layer but are not part of the generated image manifest. Keep their intrinsic
// dimensions here so SSR does not emit layout-shifting images.
const aidreamshootsPublishedMediaDimensions: Record<string, { width: number; height: number }> = {
  "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-poster.jpg": { width: 1280, height: 720 },
  "/assets/sites/site_aidreamshoots/visuals/cinematic-video/cinematic-video-poster.jpg": { width: 1920, height: 1080 },
  "/assets/sites/site_aidreamshoots/visuals/music-video/music-video-poster.jpg": { width: 1920, height: 1080 },
  "/assets/sites/site_aidreamshoots/visuals/tiktok-video/tiktok-video-poster.jpg": { width: 1920, height: 1080 },
  "/assets/sites/site_aidreamshoots/visuals/instagram-reels/instagram-reels-poster.jpg": { width: 1920, height: 1080 },
  "/assets/sites/site_aidreamshoots/visuals/product-video/product-video-poster.jpg": { width: 1344, height: 768 },
  "/assets/sites/site_aidreamshoots/visuals/product-ad-video/product-ad-video-poster.jpg": { width: 1344, height: 768 },
  "/assets/sites/site_aidreamshoots/visuals/promo-video/promo-video-poster.jpg": { width: 1280, height: 720 },
  "/assets/sites/site_aidreamshoots/visuals/save-the-date/christmas/save-the-date-themes-vendor-no-crop-20260915-v1/christmas-01-christmas-family-gift.jpg": { width: 3840, height: 2560 },
  "/assets/sites/site_aidreamshoots/visuals/save-the-date/engagement/save-the-date-themes-vendor-no-crop-20260915-v1/engagement-01-engaged-couple-garden-portrait.jpg": { width: 3840, height: 2560 },
  "/assets/sites/site_aidreamshoots/visuals/save-the-date/halloween/save-the-date-themes-vendor-no-crop-20260915-v1/halloween-01-halloween-costume-party.jpg": { width: 3840, height: 2560 },
  "/assets/sites/site_aidreamshoots/visuals/save-the-date/proposal/save-the-date-themes-vendor-no-crop-20260915-v1/proposal-01-proposal-rooftop-surprise-night.jpg": { width: 3840, height: 2560 },
  "/assets/sites/site_aidreamshoots/visuals/save-the-date/thanksgiving/save-the-date-themes-vendor-no-crop-20260915-v1/thanksgiving-01-thanksgiving-family-dinner.jpg": { width: 3840, height: 2560 }
};

function imagePath(value: string): string {
  return value.trim().split(/[?#]/, 1)[0] ?? "";
}

function srcSet(entries: Array<{ url?: string; width: number }>): string {
  return entries
    .filter((entry): entry is { url: string; width: number } => Boolean(entry.url))
    .map((entry) => `${entry.url} ${entry.width}w`)
    .join(", ");
}

export function storefrontResponsiveImageSet(src: string): StorefrontResponsiveImageSet | undefined {
  const entry = imageManifest[imagePath(src)];
  if (!entry || !entry.variants.length) return undefined;

  const variants = entry.variants.slice().sort((left, right) => left.width - right.width);
  const fallbackVariants = variants.map((variant) => ({ url: variant.webp ?? variant.avif, width: variant.width }));
  const fallbackSrc = fallbackVariants.at(-1)?.url ?? entry.original;
  return {
        ...entry,
        avifSrcSet: srcSet(variants.map((variant) => ({ url: variant.avif, width: variant.width }))),
        webpSrcSet: srcSet(variants.map((variant) => ({ url: variant.webp, width: variant.width }))),
        fallbackSrcSet: entry.site === "aidreamshoots-eu" ? srcSet(fallbackVariants) : entry.original,
        fallbackSrc
      };
}

export function storefrontResponsiveImageDimensions(src: string): { width: number; height: number } | undefined {
  const entry = imageManifest[imagePath(src)];
  return entry ? { width: entry.width, height: entry.height } : aidreamshootsPublishedMediaDimensions[imagePath(src)];
}
