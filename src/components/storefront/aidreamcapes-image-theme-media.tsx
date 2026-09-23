"use client";

import { useState } from "react";
import { AidreamcapesResponsiveImage } from "@/components/storefront/aidreamcapes-responsive-image";
import type { AidreamcapesImageThemeImage } from "@/lib/aidreamcapes-image-theme-content";

type AidreamcapesImageAssetProps = {
  image: AidreamcapesImageThemeImage;
  className?: string;
  fallbackLabel?: string;
  priority?: boolean;
};

export function AidreamcapesImageAsset({ image, className = "", fallbackLabel = "Image preview pending", priority = false }: AidreamcapesImageAssetProps) {
  const versionedSrc = `${image.src}${image.src.includes("?") ? "&" : "?"}v=${image.width}x${image.height}`;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const aspectRatio = `${image.width} / ${image.height}`;

  if (failedSrc === versionedSrc) {
    return (
      <div
        aria-label={image.alt}
        className={`grid min-h-24 place-items-center bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent),#111217] px-4 text-center ${className}`}
        role="img"
        style={{ aspectRatio }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <AidreamcapesResponsiveImage
      alt={image.alt}
      className={className}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      height={image.height}
      loading={priority ? "eager" : "lazy"}
      onError={() => setFailedSrc(versionedSrc)}
      sizes={image.sizes}
      src={versionedSrc}
      width={image.width}
    />
  );
}
