import type { ReactNode } from "react";
import { storefrontResponsiveImageDimensions, storefrontResponsiveImageSet } from "@/lib/storefront-responsive-images";
import { AidreamcapesImageProjectionProvider, type AidreamcapesImageProjections } from "./aidreamcapes-projected-image.client";

/** Keep the complete asset manifest on the server; serialize attributes for supplied media only. */
export function AidreamcapesImageProjection({ value, children }: { value: unknown; children: ReactNode }) {
  const images: AidreamcapesImageProjections = {};
  const seen = new WeakSet<object>();
  const visit = (entry: unknown): void => {
    if (typeof entry === "string") {
      if (!entry.startsWith("/") && !/^https?:\/\//.test(entry)) return;
      const key = entry.trim().split(/[?#]/, 1)[0];
      if (Object.hasOwn(images, key)) return;
      const responsive = storefrontResponsiveImageSet(entry);
      const dimensions = storefrontResponsiveImageDimensions(entry);
      if (responsive || dimensions) images[key] = {
        width: dimensions?.width,
        height: dimensions?.height,
        responsive: Boolean(responsive),
        ...(responsive ? { avifSrcSet: responsive.avifSrcSet, webpSrcSet: responsive.webpSrcSet, fallbackSrcSet: responsive.fallbackSrcSet } : {})
      };
      return;
    }
    if (!entry || typeof entry !== "object" || seen.has(entry)) return;
    seen.add(entry);
    for (const child of Object.values(entry)) visit(child);
  };
  visit(value);
  return <AidreamcapesImageProjectionProvider images={images}>{children}</AidreamcapesImageProjectionProvider>;
}
