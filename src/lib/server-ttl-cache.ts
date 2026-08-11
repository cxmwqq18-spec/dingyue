import "server-only";

import { createAdminPerfTracker } from "@/lib/admin-perf";

type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

export function createServerTtlCache(scope: string, defaultTtlMs: number) {
  const store = new Map<string, CacheEntry<unknown>>();

  function keyFor(key: string): string {
    return `${scope}:${key}`;
  }

  return {
    get<T>(key: string, loader: () => Promise<T>, ttlMs = defaultTtlMs): Promise<T> {
      const perf = createAdminPerfTracker("server-ttl-cache", { scope, ttlMs });
      const now = Date.now();
      const scopedKey = keyFor(key);
      const cached = store.get(scopedKey) as CacheEntry<T> | undefined;
      if (cached && cached.expiresAt > now) {
        perf.mark("cache", 0, { hit: true });
        perf.finish({ hit: true });
        return cached.value;
      }
      const value = perf.measure("cache_loader", loader, { hit: false })
        .then((result) => {
          const current = store.get(scopedKey);
          if (result === undefined) {
            store.delete(scopedKey);
          } else if (current?.value === value) {
            store.set(scopedKey, { expiresAt: Date.now() + ttlMs, value });
          }
          perf.finish({ hit: false });
          return result;
        })
        .catch((error) => {
          store.delete(scopedKey);
          perf.finish({ hit: false, error: error instanceof Error ? error.message : "unknown" });
          throw error;
        });
      store.set(scopedKey, { expiresAt: now + ttlMs, value });
      return value;
    },
    clear(key?: string): void {
      if (!key) {
        store.clear();
        return;
      }
      store.delete(keyFor(key));
    }
  };
}
