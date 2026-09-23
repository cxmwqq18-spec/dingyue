/* eslint-disable @next/next/no-img-element */

import type { ComponentProps } from "react";
import { storefrontResponsiveImageDimensions, storefrontResponsiveImageSet } from "@/lib/storefront-responsive-images";

type AidreamcapesResponsiveImageProps = Omit<ComponentProps<"img">, "src" | "srcSet" | "width" | "height"> & {
  src: string;
  width?: number;
  height?: number;
};

export function AidreamcapesResponsiveImage({
  alt,
  height,
  sizes = "100vw",
  src,
  width,
  ...props
}: AidreamcapesResponsiveImageProps) {
  const responsive = storefrontResponsiveImageSet(src);
  const dimensions = storefrontResponsiveImageDimensions(src);
  const resolvedWidth = width ?? dimensions?.width;
  const resolvedHeight = height ?? dimensions?.height;
  const image = (
    <img
      {...props}
      alt={alt}
      height={resolvedHeight}
      sizes={sizes}
      src={src}
      srcSet={responsive?.fallbackSrcSet ?? src}
      width={resolvedWidth}
    />
  );

  if (!responsive) return image;
  return (
    <picture>
      {responsive.avifSrcSet ? <source sizes={sizes} srcSet={responsive.avifSrcSet} type="image/avif" /> : null}
      {responsive.webpSrcSet ? <source sizes={sizes} srcSet={responsive.webpSrcSet} type="image/webp" /> : null}
      {image}
    </picture>
  );
}
