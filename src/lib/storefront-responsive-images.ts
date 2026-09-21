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
};

const imageManifest = manifest as Record<string, StorefrontResponsiveImageEntry>;

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
  return {
        ...entry,
        avifSrcSet: srcSet(variants.map((variant) => ({ url: variant.avif, width: variant.width }))),
        webpSrcSet: srcSet(variants.map((variant) => ({ url: variant.webp, width: variant.width }))),
        fallbackSrcSet: entry.original
      };
}

export function storefrontResponsiveImageDimensions(src: string): { width: number; height: number } | undefined {
  const entry = imageManifest[imagePath(src)];
  return entry ? { width: entry.width, height: entry.height } : undefined;
}
