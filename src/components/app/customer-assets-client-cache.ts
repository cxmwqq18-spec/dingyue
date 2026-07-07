"use client";

import type { ThemeRuntimeAsset } from "@/lib/types";

type AssetRoleQuery = ThemeRuntimeAsset["role"] | "all" | "workspace-gallery" | "source-picker";

type AssetCacheEntry = {
  expiresAt: number;
  promise: Promise<ThemeRuntimeAsset[]>;
};

const assetCache = new Map<string, AssetCacheEntry>();
const ASSET_CACHE_TTL_MS = 8_000;

function cacheKey(siteId: string, customerId: string, limit: number) {
  return `${siteId}:${customerId}:all:${limit}`;
}

function roleCacheKey(siteId: string, customerId: string, role: AssetRoleQuery, limit: number) {
  return `${siteId}:${customerId}:${role}:${limit}`;
}

export function invalidateCustomerAssets(siteId: string, customerId: string) {
  const prefix = `${siteId}:${customerId}:`;
  for (const key of assetCache.keys()) {
    if (key.startsWith(prefix)) assetCache.delete(key);
  }
}

export function loadCustomerAssets(siteId: string, customerId: string, limit = 100, role: AssetRoleQuery = "all"): Promise<ThemeRuntimeAsset[]> {
  const key = role === "all" ? cacheKey(siteId, customerId, limit) : roleCacheKey(siteId, customerId, role, limit);
  const now = Date.now();
  const cached = assetCache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;

  const roleParam = role === "all" ? "" : `&role=${encodeURIComponent(role)}`;
  const promise = fetch(`/api/sites/${siteId}/customers/${customerId}/assets?limit=${limit}${roleParam}`, { credentials: "same-origin" })
    .then(async (response) => {
      const result = (await response.json().catch(() => ({}))) as { assets?: ThemeRuntimeAsset[] };
      if (!response.ok || !Array.isArray(result.assets)) return [];
      return result.assets;
    })
    .catch(() => []);

  assetCache.set(key, { expiresAt: now + ASSET_CACHE_TTL_MS, promise });
  return promise;
}
