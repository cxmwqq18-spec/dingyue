import type { MediaAsset, Site } from "@/lib/types";

const fallbackImages = [
  "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
  "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png",
  "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png",
  "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png",
  "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png",
  "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png"
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

function customerAssetPublicUrl(storageKey: string): string {
  const normalized = storageKey.replace(/^customer-assets\//, "").replace(/^\/+/, "");
  const rawBaseUrl = process.env.NEXT_PUBLIC_CUSTOMER_ASSET_READ_BASE_URL || process.env.CUSTOMER_ASSET_READ_BASE_URL || process.env.CUSTOMER_ASSET_SHARED_BASE_URL || "";
  let baseUrl = "";
  try {
    baseUrl = rawBaseUrl ? new URL(rawBaseUrl).origin : "";
  } catch {
    baseUrl = "";
  }
  const path = `/api/local-assets/${normalized}`;
  return baseUrl ? `${baseUrl}${path}` : path;
}

export function resolveMediaAssetUrl(site: Site, value: string | undefined): string {
  const lookup = value?.trim();
  if (!lookup) return "";
  const asset = findSiteMediaAsset(site, lookup);
  if (asset?.previewUrl) return asset.previewUrl;
  if (asset?.originUrl) return asset.originUrl;
  if (lookup.startsWith("/assets/dreamshoot/")) return lookup;
  if (lookup.startsWith("customer-assets/")) return customerAssetPublicUrl(lookup);
  if (lookup.startsWith("sites/") && lookup.includes("/customers/")) return customerAssetPublicUrl(lookup);
  if (lookup.startsWith("/themes/theme1/")) return fallbackImageForSeed(lookup);
  if (lookup.startsWith("http")) return lookup;
  if (lookup.startsWith("/")) return lookup;
  if (lookup.startsWith(`sites/${site.id}/`)) return fallbackImageForSeed(`${site.slug}-${lookup}`);
  return fallbackImageForSeed(`${site.slug}-${lookup}`.replace(/[^a-z0-9-]/gi, "-"));
}
