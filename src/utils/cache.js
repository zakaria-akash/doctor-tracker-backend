export function createTtlCache(ttlMs = 60_000, maxEntries = 100) {
  const store = new Map();

  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return undefined;

      if (hit.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
      }

      return hit.value;
    },
    set(key, value) {
      if (store.size >= maxEntries) store.delete(store.keys().next().value);
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    clear() {
      store.clear();
    },
  };
}

export const analyticsCache = createTtlCache(60_000);
export const optionsCache = createTtlCache(60_000);

/** Call after every write so dashboards and dropdowns never show stale data. */
export function invalidateReadCaches() {
  analyticsCache.clear();
  optionsCache.clear();
}
