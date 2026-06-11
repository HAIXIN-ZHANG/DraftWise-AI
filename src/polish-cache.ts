import objectHash from "object-hash";
import { maxPolishCacheEntries, polishCacheTtlMs, type PolishQuality, type PolishStyle } from "./polish-options.js";

export const polishCacheVersion = "v1";

export type PolishCacheKeyParams = {
  text: string;
  style: PolishStyle;
  quality: PolishQuality;
  note?: string;
};

export type CachedPolishResult<T> = {
  value: T;
  cacheHit: boolean;
  inFlightHit: boolean;
};

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
  timeout: ReturnType<typeof setTimeout>;
};

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export function buildPolishCacheKey(params: PolishCacheKeyParams) {
  return objectHash(
    {
      version: polishCacheVersion,
      text: params.text,
      style: params.style,
      quality: params.quality,
      note: params.note ?? "",
    },
    { algorithm: "sha256" },
  );
}

export async function getOrCreateCachedPolish<T>(
  key: string,
  factory: () => Promise<T>,
): Promise<CachedPolishResult<T>> {
  const now = Date.now();
  const cached = responseCache.get(key);

  if (cached && cached.expiresAtMs > now) {
    return {
      value: cached.value as T,
      cacheHit: true,
      inFlightHit: false,
    };
  }

  if (cached) {
    deleteResponseCacheEntry(key);
  }

  const inFlight = inFlightRequests.get(key);

  if (inFlight) {
    return {
      value: (await inFlight) as T,
      cacheHit: false,
      inFlightHit: true,
    };
  }

  const request = factory();
  inFlightRequests.set(key, request);

  try {
    const value = await request;

    if (responseCache.size >= maxPolishCacheEntries) {
      clearResponseCache();
    }

    const timeout = setTimeout(() => {
      responseCache.delete(key);
    }, polishCacheTtlMs);
    timeout.unref?.();

    responseCache.set(key, {
      value,
      expiresAtMs: Date.now() + polishCacheTtlMs,
      timeout,
    });

    return {
      value,
      cacheHit: false,
      inFlightHit: false,
    };
  } finally {
    inFlightRequests.delete(key);
  }
}

export function clearPolishCache() {
  clearResponseCache();
  inFlightRequests.clear();
}

function clearResponseCache() {
  for (const entry of responseCache.values()) {
    clearTimeout(entry.timeout);
  }

  responseCache.clear();
}

function deleteResponseCacheEntry(key: string) {
  const entry = responseCache.get(key);
  if (entry) {
    clearTimeout(entry.timeout);
  }
  responseCache.delete(key);
}
