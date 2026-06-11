import "dotenv/config";

import express, { type NextFunction, type Request, type Response } from "express";
import { nanoid } from "nanoid";
import OpenAI from "openai";
import { apiError, sendApiError } from "./api-error.js";
import { requireToken } from "./auth.js";
import { getMissingRuntimeConfig, getOpenAIApiKey } from "./config.js";
import { openAIErrorToApiError, polishWithFallback } from "./openai-polish.js";
import { buildPolishCacheKey, getOrCreateCachedPolish } from "./polish-cache.js";
import { parsePolishRequest } from "./polish-request.js";
import { rateLimitPolish } from "./rate-limit.js";

let openAIClient: OpenAI | undefined;
let openAIClientApiKey: string | undefined;

export const app = express();

app.disable("x-powered-by");
// Create the request ID before body parsing so JSON syntax errors can still be traced.
app.use((_req, res, next) => {
  const requestId = nanoid();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  const missing = getMissingRuntimeConfig();

  if (missing.length > 0) {
    res.status(503).json({
      ok: false,
      missing,
    });
    return;
  }

  res.json({ ok: true });
});

app.post("/polish", requireToken, rateLimitPolish, async (req, res) => {
  const startedAt = Date.now();
  const createdAt = new Date(startedAt).toISOString();
  const requestId = res.locals.requestId as string | undefined;
  const parsed = parsePolishRequest(req.body);

  if (!parsed.ok) {
    sendApiError(res, parsed.status, parsed.error);
    return;
  }

  const openAIApiKey = getOpenAIApiKey();

  if (!openAIApiKey) {
    sendApiError(res, 500, apiError("missing_config", "OPENAI_API_KEY is not configured."));
    return;
  }

  try {
    const cacheKey = buildPolishCacheKey(parsed.value);
    const cached = await getOrCreateCachedPolish(cacheKey, () =>
      polishWithFallback(getOpenAIClient(openAIApiKey), {
        ...parsed.value,
        requestId,
      }),
    );
    const result = cached.value;

    res.json({
      text: result.text,
      meta: {
        requestId,
        style: parsed.value.style,
        quality: parsed.value.quality,
        model: result.model,
        durationMs: Date.now() - startedAt,
        fallbackUsed: result.fallbackUsed,
        attemptCount: result.attemptCount,
        cacheHit: cached.cacheHit,
        inFlightHit: cached.inFlightHit,
        hasNote: Boolean(parsed.value.note),
        inputChars: parsed.value.text.length,
        outputChars: result.text.length,
        createdAt,
      },
    });
  } catch (error) {
    const apiFailure = openAIErrorToApiError(error);
    sendApiError(res, apiFailure.status, apiFailure.error);
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (isBodyTooLargeError(err)) {
    sendApiError(res, 413, apiError("request_too_large", "Request body is too large."));
    return;
  }

  if (err instanceof SyntaxError) {
    sendApiError(res, 400, apiError("invalid_json", "Invalid JSON body."));
    return;
  }

  sendApiError(res, 500, apiError("unexpected_error", "Unexpected server error."));
});

function isBodyTooLargeError(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as Record<string, unknown>).type === "entity.too.large");
}

function getOpenAIClient(apiKey: string) {
  if (!openAIClient || openAIClientApiKey !== apiKey) {
    openAIClient = new OpenAI({ apiKey });
    openAIClientApiKey = apiKey;
  }

  return openAIClient;
}
