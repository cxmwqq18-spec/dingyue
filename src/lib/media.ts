import type { MediaAsset, Site } from "@/lib/types";

// Missing media is a publication error. Keep the compatibility helper for
// draft templates, but never synthesize a public image from a seed.
export function fallbackImageForSeed(_seed: string): string {
  return "";
}

export function siteMediaAssets(site: Site): MediaAsset[] {
  return (site.mediaAssets ?? []).filter((asset) =>
    !(site.id === "site_aidreamcapes_xby" && String(asset.sourceType ?? "") === "aidreamcapes-eu-seo-isolated")
  );
}

export function findSiteMediaAsset(site: Site, value: string | undefined): MediaAsset | undefined {
  const lookup = value?.trim();
  if (!lookup) return undefined;
  return siteMediaAssets(site).find((asset) => asset.id === lookup || asset.storageKey === lookup || asset.previewUrl === lookup || asset.originUrl === lookup);
}

function customerAssetPublicUrl(storageKey: string): string {
  const normalized = storageKey.replace(/^customer-assets\//, "").replace(/^\/+/, "");
  const path = `/api/local-assets/${normalized}`;
  if (process.env.NODE_ENV !== "production" || process.env.CUSTOMER_ASSET_FORCE_LOCAL_PUBLIC_URL === "1") {
    return path;
  }
  const rawBaseUrl = process.env.NEXT_PUBLIC_CUSTOMER_ASSET_READ_BASE_URL || process.env.CUSTOMER_ASSET_READ_BASE_URL || process.env.CUSTOMER_ASSET_SHARED_BASE_URL || "";
  let baseUrl = "";
  try {
    baseUrl = rawBaseUrl ? new URL(rawBaseUrl).origin : "";
  } catch {
    baseUrl = "";
  }
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
  if (lookup.startsWith("/themes/theme1/")) return "";
  if (lookup.startsWith("http")) return lookup;
  if (lookup.startsWith("/")) return lookup;
  if (lookup.startsWith(`sites/${site.id}/`)) return "";
  return "";
}
