import type { MediaAsset, Site } from "@/lib/types";

const fallbackImages = [
  "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
  "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png",
  "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png",
  "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png",
  "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png",
  "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png"
] as const;

export function fallbackImageForSeed(seed: string): string {
  const hash = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
  return fallbackImages[hash % fallbackImages.length];
}

export function siteMediaAssets(site: Site): MediaAsset[] {
  return site.mediaAssets ?? [];
}

export function findSiteMediaAsset(site: Site, value: string | undefined): MediaAsset | undefined {
  const lookup = value?.trim();
  if (!lookup) return undefined;
  return siteMediaAssets(site).find((asset) => asset.id === lookup || asset.storageKey === lookup || asset.previewUrl === lookup || asset.originUrl === lookup);
}

export function resolveMediaAssetUrl(site: Site, value: string | undefined): string {
  const lookup = value?.trim();
  if (!lookup) return "";
  const asset = findSiteMediaAsset(site, lookup);
  if (asset?.previewUrl) return asset.previewUrl;
  if (asset?.originUrl) return asset.originUrl;
  if (lookup.startsWith("/assets/dreamshoot/")) return lookup;
  if (lookup.startsWith("/themes/theme1/")) return fallbackImageForSeed(lookup);
  if (lookup.startsWith("http")) return lookup;
  if (lookup.startsWith("/")) return lookup;
  if (lookup.startsWith(`sites/${site.id}/`)) return fallbackImageForSeed(`${site.slug}-${lookup}`);
  return fallbackImageForSeed(`${site.slug}-${lookup}`.replace(/[^a-z0-9-]/gi, "-"));
}
