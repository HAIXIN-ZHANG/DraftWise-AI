import { maxPolishCacheEntries, polishCacheTtlMs } from "../src/polish-options";
import { buildPolishCacheKey, clearPolishCache, getOrCreateCachedPolish } from "../src/polish-cache";

afterEach(() => {
  clearPolishCache();
});

test("builds different cache keys for different request inputs", () => {
  const first = buildPolishCacheKey({
    text: "same text",
    style: "natural",
    quality: "balanced",
  });
  const second = buildPolishCacheKey({
    text: "same text",
    style: "professional",
    quality: "balanced",
  });

  expect(first).not.toBe(second);
  expect(first).toHaveLength(64);
});

test("returns a short-lived exact-match cache hit after a successful request", async () => {
  const key = buildPolishCacheKey({
    text: "same text",
    style: "natural",
    quality: "balanced",
  });
  let callCount = 0;

  const first = await getOrCreateCachedPolish(key, async () => {
    callCount += 1;
    return { text: "Polished text" };
  });
  const second = await getOrCreateCachedPolish(key, async () => {
    callCount += 1;
    return { text: "Should not be used" };
  });

  expect(callCount).toBe(1);
  expect(first.cacheHit).toBe(false);
  expect(first.inFlightHit).toBe(false);
  expect(second.cacheHit).toBe(true);
  expect(second.inFlightHit).toBe(false);
  expect(second.value).toEqual({ text: "Polished text" });
});

test("deduplicates concurrent in-flight requests", async () => {
  const key = buildPolishCacheKey({
    text: "same text",
    style: "natural",
    quality: "balanced",
  });
  let callCount = 0;
  let resolveRequest: (value: { text: string }) => void = () => undefined;

  const firstPromise = getOrCreateCachedPolish(key, async () => {
    callCount += 1;
    return new Promise<{ text: string }>((resolve) => {
      resolveRequest = resolve;
    });
  });
  const secondPromise = getOrCreateCachedPolish(key, async () => {
    callCount += 1;
    return { text: "Should not be used" };
  });

  resolveRequest({ text: "Polished text" });

  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  expect(callCount).toBe(1);
  expect(first.cacheHit).toBe(false);
  expect(first.inFlightHit).toBe(false);
  expect(second.cacheHit).toBe(false);
  expect(second.inFlightHit).toBe(true);
  expect(second.value).toEqual({ text: "Polished text" });
});

test("does not cache failed requests", async () => {
  const key = buildPolishCacheKey({
    text: "same text",
    style: "natural",
    quality: "balanced",
  });
  let callCount = 0;

  await expect(
    getOrCreateCachedPolish(key, async () => {
      callCount += 1;
      throw new Error("OpenAI failed");
    }),
  ).rejects.toThrow("OpenAI failed");

  const result = await getOrCreateCachedPolish(key, async () => {
    callCount += 1;
    return { text: "Recovered" };
  });

  expect(callCount).toBe(2);
  expect(result.cacheHit).toBe(false);
  expect(result.value).toEqual({ text: "Recovered" });
});

test("removes cached responses after the TTL", async () => {
  jest.useFakeTimers({
    doNotFake: ["performance"],
  });

  try {
    const key = buildPolishCacheKey({
      text: "same text",
      style: "natural",
      quality: "balanced",
    });
    let callCount = 0;

    await getOrCreateCachedPolish(key, async () => {
      callCount += 1;
      return { text: "First response" };
    });

    jest.advanceTimersByTime(polishCacheTtlMs);

    const result = await getOrCreateCachedPolish(key, async () => {
      callCount += 1;
      return { text: "Second response" };
    });

    expect(callCount).toBe(2);
    expect(result.cacheHit).toBe(false);
    expect(result.value).toEqual({ text: "Second response" });
  } finally {
    jest.useRealTimers();
  }
});

test("clears old cached responses when the entry limit is reached", async () => {
  const firstKey = buildPolishCacheKey({
    text: "first text",
    style: "natural",
    quality: "balanced",
  });

  await getOrCreateCachedPolish(firstKey, async () => ({ text: "First response" }));

  for (let index = 1; index < maxPolishCacheEntries; index += 1) {
    await getOrCreateCachedPolish(`cache-key-${index}`, async () => ({ text: `Cached response ${index}` }));
  }

  await getOrCreateCachedPolish("cache-key-after-limit", async () => ({ text: "Fresh response" }));

  const result = await getOrCreateCachedPolish(firstKey, async () => ({ text: "First response after cache clear" }));

  expect(result.cacheHit).toBe(false);
  expect(result.value).toEqual({ text: "First response after cache clear" });
});
