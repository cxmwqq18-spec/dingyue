const publicVideoThemeCache = new Map<string, { expiresAt: number; payload: unknown }>();

export const PUBLIC_VIDEO_THEME_CACHE_MS = 60_000;

export function getPublicVideoThemeCache(key: string) {
  const cached = publicVideoThemeCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) return undefined;
  return cached.payload;
}

export function setPublicVideoThemeCache(key: string, payload: unknown) {
  publicVideoThemeCache.set(key, { expiresAt: Date.now() + PUBLIC_VIDEO_THEME_CACHE_MS, payload });
}

export function clearPublicVideoThemeCache(siteId: string) {
  for (const key of publicVideoThemeCache.keys()) {
    if (key.startsWith(`${siteId}:`)) publicVideoThemeCache.delete(key);
  }
}
