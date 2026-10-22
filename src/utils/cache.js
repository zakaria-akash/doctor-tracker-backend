export function createTtlCache(ttlMs = 60_000, maxEntries = 100) {
  // Keep small process-local caches in insertion order for inexpensive expiry and eviction.
  const store = new Map();

  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return undefined;

      // Expire on the boundary as well as after it so entries never outlive their configured TTL.
      if (hit.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }

      return hit.value;
    },
    set(key, value) {
      // Drop the oldest inserted entry before adding a new key to bound memory use.
      if (store.size >= maxEntries) store.delete(store.keys().next().value);
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    clear() {
      store.clear();
    },
  };
}

// Dashboard aggregates and dropdown metadata each stay warm for at most one minute.
export const analyticsCache = createTtlCache(60_000);
export const optionsCache = createTtlCache(60_000);

/** Clear derived reads together after doctor or patient writes change their source data. */
export function invalidateReadCaches() {
  analyticsCache.clear();
  optionsCache.clear();
}
