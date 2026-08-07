type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  scopeId?: string | null;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export const DEFAULT_ASYNC_CACHE_TTL_MS = 120_000;

/** Chave física: base + escopo — evita vazar permissão entre usuários no mesmo browser/app. */
function resolveCacheStorageKey(key: string, scopeId?: string | null): string {
  const scope = scopeId?.trim();
  return scope ? `${key}@@${scope}` : key;
}

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttlMs?: number; scopeId?: string | null; forceRefresh?: boolean }
): Promise<T> {
  const ttlMs = options?.ttlMs ?? DEFAULT_ASYNC_CACHE_TTL_MS;
  const now = Date.now();
  const storageKey = resolveCacheStorageKey(key, options?.scopeId);
  const cached = cache.get(storageKey) as CacheEntry<T> | undefined;

  if (!options?.forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (!options?.forceRefresh) {
    const pending = inflight.get(storageKey) as Promise<T> | undefined;

    if (pending) {
      return pending;
    }
  }

  const promise = (async () => {
    const value = await fetcher();
    cache.set(storageKey, {
      value,
      expiresAt: Date.now() + ttlMs,
      scopeId: options?.scopeId ?? null,
    });
    return value;
  })();

  inflight.set(storageKey, promise);

  try {
    return await promise;
  } finally {
    if (inflight.get(storageKey) === promise) {
      inflight.delete(storageKey);
    }
  }
}

export function invalidateAsyncCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    cache.clear();
    return;
  }

  // Aceita 'acl' ou 'acl:' — ambos limpam chaves `acl:<id>:...` e `acl:...@@scope`
  const normalized = keyOrPrefix.endsWith(':') ? keyOrPrefix.slice(0, -1) : keyOrPrefix;

  const matches = (entryKey: string) =>
    entryKey === keyOrPrefix
    || entryKey === normalized
    || entryKey.startsWith(`${normalized}:`)
    || entryKey.startsWith(`${normalized}@@`)
    || entryKey.startsWith(`${keyOrPrefix}@@`);

  for (const entryKey of [...cache.keys()]) {
    if (matches(entryKey)) {
      cache.delete(entryKey);
    }
  }

  for (const inflightKey of [...inflight.keys()]) {
    if (matches(inflightKey)) {
      inflight.delete(inflightKey);
    }
  }
}
