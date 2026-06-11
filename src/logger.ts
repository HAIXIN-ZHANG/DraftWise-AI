import type { PolishModel, PolishQuality, PolishStyle } from "./polish-options.js";

export type SafeError = {
  name?: string;
  status?: number;
  code?: string;
  type?: string;
  requestId?: string;
};

export type PolishMetadata = {
  requestId?: string;
  style: PolishStyle;
  quality: PolishQuality;
  model: PolishModel;
  durationMs: number;
  success: boolean;
  error?: SafeError;
  attempt?: number;
  fallback?: boolean;
  willFallback?: boolean;
  hasNote?: boolean;
};

export function logPolishMetadata(metadata: PolishMetadata) {
  console.info(
    JSON.stringify({
      event: "polish",
      requestId: metadata.requestId,
      style: metadata.style,
      quality: metadata.quality,
      model: metadata.model,
      durationMs: metadata.durationMs,
      success: metadata.success,
      error: metadata.error,
      attempt: metadata.attempt,
      fallback: metadata.fallback,
      willFallback: metadata.willFallback,
      hasNote: metadata.hasNote,
    }),
  );
}

export function sanitizeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { name: typeof error };
  }

  const errorRecord = error as Record<string, unknown>;

  return {
    name: error instanceof Error ? error.name : optionalString(errorRecord.name),
    status: optionalNumber(errorRecord.status),
    code: optionalString(errorRecord.code),
    type: optionalString(errorRecord.type),
    requestId: optionalString(errorRecord.request_id) ?? optionalString(errorRecord.requestID),
  };
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
