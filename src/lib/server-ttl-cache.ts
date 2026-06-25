import "server-only";

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
      const now = Date.now();
      const scopedKey = keyFor(key);
      const cached = store.get(scopedKey) as CacheEntry<T> | undefined;
      if (cached && cached.expiresAt > now) return cached.value;
      const value = loader()
        .then((result) => {
          const current = store.get(scopedKey);
          if (current?.value === value) {
            store.set(scopedKey, { expiresAt: Date.now() + ttlMs, value });
          }
          return result;
        })
        .catch((error) => {
          store.delete(scopedKey);
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
