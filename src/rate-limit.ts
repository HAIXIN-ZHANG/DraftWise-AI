import type { NextFunction, Request, Response } from "express";
import objectHash from "object-hash";
import { apiError, sendApiError } from "./api-error.js";

type Bucket = {
  windowStartMs: number;
  count: number;
};

const buckets = new Map<string, Bucket>();
const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 20;

export function rateLimitPolish(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = getRequestKey(req);
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartMs >= rateLimitWindowMs) {
    buckets.set(key, {
      windowStartMs: now,
      count: 1,
    });
    cleanupBuckets(now);
    next();
    return;
  }

  if (bucket.count >= rateLimitMaxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStartMs + rateLimitWindowMs - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    sendApiError(
      res,
      429,
      apiError("rate_limited", "Too many requests. Please try again later.", {
        retryable: true,
        retryAfterSeconds,
      }),
    );
    return;
  }

  bucket.count += 1;
  next();
}

function getRequestKey(req: Request) {
  // Never store the raw API token in memory, even temporarily for rate limiting.
  const token = req.header("X-API-Token") ?? req.ip ?? "unknown";
  return objectHash(token, { algorithm: "sha256" });
}

function cleanupBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartMs > rateLimitWindowMs * 2) {
      buckets.delete(key);
    }
  }
}
