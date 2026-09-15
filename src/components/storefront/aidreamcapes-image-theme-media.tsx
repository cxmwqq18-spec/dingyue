"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { AidreamcapesImageThemeImage } from "@/lib/aidreamcapes-image-theme-content";

type AidreamcapesImageAssetProps = {
  image: AidreamcapesImageThemeImage;
  className?: string;
  fallbackLabel?: string;
};

export function AidreamcapesImageAsset({ image, className = "", fallbackLabel = "Image preview pending" }: AidreamcapesImageAssetProps) {
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
    <img
      alt={image.alt}
      className={className}
      decoding="async"
      fetchPriority={image.fetchPriority}
      height={image.height}
      loading={image.loading}
      onError={() => setFailedSrc(versionedSrc)}
      sizes={image.sizes}
      src={versionedSrc}
      width={image.width}
    />
  );
}
