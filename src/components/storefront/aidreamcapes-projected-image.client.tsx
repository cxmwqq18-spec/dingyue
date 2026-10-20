"use client";

/* eslint-disable @next/next/no-img-element */
import { createContext, useContext, type ComponentProps, type ReactNode } from "react";

export type AidreamcapesImageProjection = {
  width?: number;
  height?: number;
  avifSrcSet?: string;
  webpSrcSet?: string;
  fallbackSrcSet?: string;
  responsive: boolean;
};
export type AidreamcapesImageProjections = Record<string, AidreamcapesImageProjection>;
const ImageProjections = createContext<AidreamcapesImageProjections>({});

export function AidreamcapesImageProjectionProvider({ images, children }: { images: AidreamcapesImageProjections; children: ReactNode }) {
  return <ImageProjections.Provider value={images}>{children}</ImageProjections.Provider>;
}

type Props = Omit<ComponentProps<"img">, "src" | "srcSet" | "width" | "height"> & { src: string; width?: number; height?: number };

/** Consume only this island's SSR-resolved image attributes, without a browser data request. */
export function AidreamcapesProjectedImage({ alt, height, sizes = "100vw", src, width, ...props }: Props) {
  const projection = useContext(ImageProjections)[src.trim().split(/[?#]/, 1)[0]];
  const image = <img {...props} alt={alt} height={height ?? projection?.height} sizes={sizes} src={src} srcSet={projection?.fallbackSrcSet ?? src} width={width ?? projection?.width} />;
  if (!projection?.responsive) return image;
  return <picture>
    {projection.avifSrcSet ? <source sizes={sizes} srcSet={projection.avifSrcSet} type="image/avif" /> : null}
    {projection.webpSrcSet ? <source sizes={sizes} srcSet={projection.webpSrcSet} type="image/webp" /> : null}
    {image}
  </picture>;
}
