type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  scopeId?: string | null;
};

const cache = new Map<string, CacheEntry<unknown>>();

export const DEFAULT_ASYNC_CACHE_TTL_MS = 120_000;

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttlMs?: number; scopeId?: string | null; forceRefresh?: boolean }
): Promise<T> {
  const ttlMs = options?.ttlMs ?? DEFAULT_ASYNC_CACHE_TTL_MS;
  const now = Date.now();
  const cached = cache.get(key) as CacheEntry<T> | undefined;

  if (!options?.forceRefresh && cached && cached.expiresAt > now) {
    if (!options?.scopeId || cached.scopeId === options.scopeId) {
      return cached.value;
    }
  }

  const value = await fetcher();
  cache.set(key, {
    value,
    expiresAt: now + ttlMs,
    scopeId: options?.scopeId ?? null,
  });

  return value;
}

export function invalidateAsyncCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    cache.clear();
    return;
  }

  for (const key of [...cache.keys()]) {
    if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
      cache.delete(key);
    }
  }
}
