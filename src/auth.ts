import type { NextFunction, Request, Response } from "express";
import safeCompare from "tsscmp";
import { apiError, sendApiError } from "./api-error.js";
import { getApiToken } from "./config.js";

export function requireToken(req: Request, res: Response, next: NextFunction) {
  const expectedToken = getApiToken();
  const providedToken = req.header("X-API-Token");

  if (!expectedToken) {
    sendApiError(res, 500, apiError("missing_config", "API_TOKEN is not configured."));
    return;
  }

  if (!providedToken || !safeTokenEqual(providedToken, expectedToken)) {
    sendApiError(res, 401, apiError("unauthorized", "Unauthorized."));
    return;
  }

  next();
}

function safeTokenEqual(providedToken: string, expectedToken: string) {
  return safeCompare(providedToken, expectedToken);
}
