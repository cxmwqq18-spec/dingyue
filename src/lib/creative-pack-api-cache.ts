import "server-only";

import { createServerTtlCache } from "@/lib/server-ttl-cache";

export const publicCreativePacksCache = createServerTtlCache(
  "public-creative-packs-api",
  Number(process.env.PUBLIC_CREATIVE_PACKS_API_CACHE_TTL_MS ?? 30_000)
);

export const publicCreativePackCategoriesCache = createServerTtlCache(
  "public-creative-pack-categories-api",
  Number(process.env.PUBLIC_CREATIVE_PACK_CATEGORIES_API_CACHE_TTL_MS ?? 30_000)
);

export function clearPublicCreativePacksCache() {
  publicCreativePacksCache.clear();
}

export function clearPublicCreativePackCategoriesCache(siteId?: string) {
  if (!siteId) {
    publicCreativePackCategoriesCache.clear();
    return;
  }
  publicCreativePackCategoriesCache.clear(siteId);
}
