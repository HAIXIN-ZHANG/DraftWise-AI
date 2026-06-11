import { apiError, type ApiError } from "./api-error.js";
import { extractEmbeddedNote } from "./embedded-note.js";
import {
  maxTextCharacters,
  qualityToModel,
  supportedStyles,
  type PolishQuality,
  type PolishStyle,
} from "./polish-options.js";

type PolishRequest = {
  text?: unknown;
  style?: unknown;
  quality?: unknown;
};

export type ParsedPolishRequest = {
  text: string;
  style: PolishStyle;
  quality: PolishQuality;
  note?: string;
};

type ParsePolishRequestResult =
  | { ok: true; value: ParsedPolishRequest }
  | { ok: false; status: number; error: ApiError };

export function parsePolishRequest(body: unknown): ParsePolishRequestResult {
  if (!body || typeof body !== "object") {
    return invalid("invalid_request", "Request body must be a JSON object.");
  }

  const requestBody = body as PolishRequest;

  if (typeof requestBody.text !== "string" || requestBody.text.trim().length === 0) {
    return invalid("invalid_text", "`text` must be a non-empty string.");
  }

  const embeddedNote = extractEmbeddedNote(requestBody.text);

  if (embeddedNote.text.trim().length === 0) {
    return invalid("invalid_text", "`text` must be a non-empty string after removing the note.");
  }

  if (embeddedNote.text.length > maxTextCharacters) {
    return invalid("text_too_long", "`text` must be 8000 characters or fewer.");
  }

  if (embeddedNote.noteTooLong) {
    return invalid("note_too_long", "`note` must be 1000 characters or fewer.");
  }

  const requestedStyle = resolveStyle(requestBody.style ?? "natural");
  if (!requestedStyle) {
    return invalid("invalid_style", "`style` must be one of: natural, professional, concise.");
  }

  const requestedQuality = requestBody.quality ?? "balanced";
  if (!isSupportedQuality(requestedQuality)) {
    return invalid("invalid_quality", "`quality` must be one of: cheap, balanced, quality.");
  }

  return {
    ok: true,
    value: {
      text: embeddedNote.text,
      style: embeddedNote.noteStyle ?? requestedStyle,
      quality: embeddedNote.noteQuality ?? requestedQuality,
      note: embeddedNote.note,
    },
  };
}

function resolveStyle(value: unknown): PolishStyle | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  if (supportedStyles.includes(value as PolishStyle)) {
    return value as PolishStyle;
  }
}

function isSupportedQuality(value: unknown): value is PolishQuality {
  return typeof value === "string" && value in qualityToModel;
}

function invalid(code: ApiError["code"], message: string): ParsePolishRequestResult {
  return {
    ok: false,
    status: 400,
    error: apiError(code, message),
  };
}
