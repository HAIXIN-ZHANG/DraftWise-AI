import type OpenAI from "openai";
import { apiError, type ApiError } from "./api-error.js";
import { logPolishMetadata, sanitizeError, type SafeError } from "./logger.js";
import {
  openaiTimeoutMs,
  qualityModelFallbacks,
  type PolishModel,
  type PolishQuality,
  type PolishStyle,
} from "./polish-options.js";
import { buildSystemPrompt } from "./prompt.js";

export type PolishWithFallbackParams = {
  requestId?: string;
  text: string;
  style: PolishStyle;
  quality: PolishQuality;
  note?: string;
};

export type PolishWithFallbackResult = {
  text: string;
  model: PolishModel;
  fallbackUsed: boolean;
  attemptCount: number;
};

class EmptyOpenAIResponseError extends Error {
  code = "empty_response";

  constructor() {
    super("OpenAI returned an empty response.");
    this.name = "EmptyOpenAIResponseError";
  }
}

export async function polishWithFallback(
  openai: OpenAI,
  params: PolishWithFallbackParams,
): Promise<PolishWithFallbackResult> {
  const models = qualityModelFallbacks[params.quality];
  let lastError: unknown;

  // Fallbacks are for transient/provider issues, not for validation errors.
  for (const [index, model] of models.entries()) {
    const attemptStartedAt = Date.now();

    try {
      const response = await openai.responses.create(
        {
          model,
          input: [
            {
              role: "system",
              content: buildSystemPrompt(params.style, params.note),
            },
            {
              role: "user",
              content: params.text,
            },
          ],
          store: false,
        },
        {
          timeout: openaiTimeoutMs,
          maxRetries: 0,
        },
      );

      const polishedText = response.output_text?.trim();

      if (!polishedText) {
        throw new EmptyOpenAIResponseError();
      }

      logPolishMetadata({
        requestId: params.requestId,
        style: params.style,
        quality: params.quality,
        model,
        durationMs: Date.now() - attemptStartedAt,
        success: true,
        attempt: index + 1,
        fallback: index > 0,
        hasNote: Boolean(params.note),
      });

      return {
        text: polishedText,
        model,
        fallbackUsed: index > 0,
        attemptCount: index + 1,
      };
    } catch (error) {
      lastError = error;
      const safeError = sanitizeError(error);
      const willFallback = index < models.length - 1 && shouldFallback(safeError);

      logPolishMetadata({
        requestId: params.requestId,
        style: params.style,
        quality: params.quality,
        model,
        durationMs: Date.now() - attemptStartedAt,
        success: false,
        error: safeError,
        attempt: index + 1,
        fallback: index > 0,
        willFallback,
        hasNote: Boolean(params.note),
      });

      if (!willFallback) {
        throw error;
      }
    }
  }

  throw lastError;
}

export function openAIErrorToApiError(error: unknown): { status: number; error: ApiError } {
  const safeError = sanitizeError(error);

  if (safeError.code === "empty_response") {
    return {
      status: 502,
      error: apiError("openai_empty_response", "OpenAI returned an empty response.", { retryable: true }),
    };
  }

  if (isTimeoutError(safeError)) {
    return {
      status: 504,
      error: apiError("openai_timeout", "OpenAI request timed out. Please try again.", { retryable: true }),
    };
  }

  if (safeError.status === 429) {
    return {
      status: 429,
      error: apiError("openai_rate_limited", "OpenAI rate limit was reached. Please try again later.", {
        retryable: true,
      }),
    };
  }

  return {
    status: 502,
    error: apiError("openai_error", "Failed to polish text.", {
      retryable: shouldFallback(safeError),
    }),
  };
}

function shouldFallback(error: SafeError) {
  // Keep this conservative so bad requests fail quickly instead of spending extra calls.
  if (error.status === 408 || error.status === 409 || error.status === 429) {
    return true;
  }

  if (typeof error.status === "number" && error.status >= 500) {
    return true;
  }

  if (error.code === "model_not_found") {
    return true;
  }

  return isTimeoutError(error) || isConnectionError(error);
}

function isTimeoutError(error: SafeError) {
  const name = error.name?.toLowerCase() ?? "";
  const code = error.code?.toLowerCase() ?? "";
  return name.includes("timeout") || code.includes("timeout");
}

function isConnectionError(error: SafeError) {
  const name = error.name?.toLowerCase() ?? "";
  const code = error.code?.toLowerCase() ?? "";
  return name.includes("connection") || code.includes("connection");
}
