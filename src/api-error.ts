import type { Response } from "express";

export type ApiErrorCode =
  | "invalid_json"
  | "invalid_request"
  | "invalid_text"
  | "text_too_long"
  | "note_too_long"
  | "invalid_style"
  | "invalid_quality"
  | "unauthorized"
  | "rate_limited"
  | "missing_config"
  | "request_too_large"
  | "openai_timeout"
  | "openai_rate_limited"
  | "openai_empty_response"
  | "openai_error"
  | "unexpected_error";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  options: Pick<ApiError, "retryable" | "retryAfterSeconds"> = {},
): ApiError {
  return {
    code,
    message,
    ...options,
  };
}

export function sendApiError(res: Response, status: number, error: ApiError) {
  // Echo the request ID on errors so Shortcut output can be matched with server logs.
  const requestId = typeof res.locals.requestId === "string" ? res.locals.requestId : undefined;
  res.status(status).json({
    error,
    ...(requestId ? { requestId } : {}),
  });
}
