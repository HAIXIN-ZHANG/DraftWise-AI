import "dotenv/config";

import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import OpenAI from "openai";

const supportedStyles = [
  "default",
  "slack",
  "email",
  "note",
  "shorter",
  "polite",
  "direct",
] as const;

const qualityToModel = {
  fast: "gpt-5.4-nano",
  balanced: "gpt-5.4-mini",
  quality: "gpt-5.5",
} as const;

const maxTextCharacters = 8_000;
const openaiTimeoutMs = 20_000;

type PolishStyle = (typeof supportedStyles)[number];
type PolishQuality = keyof typeof qualityToModel;

type PolishRequest = {
  text?: unknown;
  style?: unknown;
  quality?: unknown;
};

const styleGuidance: Record<PolishStyle, string> = {
  default: "Make the text clear, natural, and concise without changing the tone more than necessary.",
  slack: "Make the text suitable for a short, friendly, practical Slack message.",
  email: "Make the text suitable for a clear, professional email.",
  note: "Make the text suitable for a concise personal or work note.",
  shorter: "Make the text shorter while preserving the original meaning and important details.",
  polite: "Make the text more polite while preserving the original meaning and strength of claims.",
  direct: "Make the text more direct and practical while preserving the original meaning.",
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/polish", requireToken, async (req, res) => {
  const parsed = parsePolishRequest(req.body as PolishRequest);

  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
    return;
  }

  const { text, style, quality } = parsed.value;
  const model = qualityToModel[quality];
  const startedAt = Date.now();

  try {
    const response = await openai.responses.create(
      {
        model,
        input: [
          {
            role: "system",
            content: buildSystemPrompt(style),
          },
          {
            role: "user",
            content: text,
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
      throw new Error("OpenAI returned an empty response.");
    }

    logPolishMetadata({
      style,
      quality,
      model,
      durationMs: Date.now() - startedAt,
      success: true,
    });

    res.json({ text: polishedText });
  } catch (error) {
    logPolishMetadata({
      style,
      quality,
      model,
      durationMs: Date.now() - startedAt,
      success: false,
      error: sanitizeError(error),
    });

    res.status(502).json({ error: "Failed to polish text." });
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }

  res.status(500).json({ error: "Unexpected server error." });
});

function requireToken(req: Request, res: Response, next: NextFunction) {
  const expectedToken = process.env.API_TOKEN;
  const providedToken = req.header("X-API-Token");

  if (!expectedToken) {
    res.status(500).json({ error: "API_TOKEN is not configured." });
    return;
  }

  if (!providedToken || !safeTokenEqual(providedToken, expectedToken)) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  next();
}

function parsePolishRequest(body: PolishRequest):
  | {
      ok: true;
      value: {
        text: string;
        style: PolishStyle;
        quality: PolishQuality;
      };
    }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return { ok: false, error: "`text` must be a non-empty string." };
  }

  if (body.text.length > maxTextCharacters) {
    return { ok: false, error: "`text` must be 8000 characters or fewer." };
  }

  const style = body.style ?? "default";
  if (!isSupportedStyle(style)) {
    return {
      ok: false,
      error: "`style` must be one of: default, slack, email, note, shorter, polite, direct.",
    };
  }

  const quality = body.quality ?? "balanced";
  if (!isSupportedQuality(quality)) {
    return {
      ok: false,
      error: "`quality` must be one of: fast, balanced, quality.",
    };
  }

  return {
    ok: true,
    value: {
      text: body.text,
      style,
      quality,
    },
  };
}

function isSupportedStyle(value: unknown): value is PolishStyle {
  return typeof value === "string" && supportedStyles.includes(value as PolishStyle);
}

function isSupportedQuality(value: unknown): value is PolishQuality {
  return typeof value === "string" && value in qualityToModel;
}

function buildSystemPrompt(style: PolishStyle) {
  return [
    "You are PolishKit, a text polishing backend.",
    "Your only task is to polish the user's text. Do not answer the content.",
    "If the text is mostly English, polish in English.",
    "If the text is mostly Chinese, polish in Chinese.",
    "If the text is mixed, use the language that appears most.",
    "Preserve technical terms, names, Jira keys, PR links, API names, code identifiers, and error messages.",
    "Preserve the original meaning.",
    "Do not add extra context.",
    "Do not make claims stronger than the original.",
    "Return only the polished text.",
    `Style guidance: ${styleGuidance[style]}`,
  ].join("\n");
}

function safeTokenEqual(providedToken: string, expectedToken: string) {
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

function logPolishMetadata(metadata: {
  style: PolishStyle;
  quality: PolishQuality;
  model: string;
  durationMs: number;
  success: boolean;
  error?: {
    name?: string;
    status?: number;
    code?: string;
    type?: string;
    requestId?: string;
  };
}) {
  console.info(
    JSON.stringify({
      event: "polish",
      style: metadata.style,
      quality: metadata.quality,
      model: metadata.model,
      durationMs: metadata.durationMs,
      success: metadata.success,
      error: metadata.error,
    }),
  );
}

function sanitizeError(error: unknown) {
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

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  const port = Number(process.env.PORT ?? 3000);

  app.listen(port, () => {
    console.info(`PolishKit listening on http://localhost:${port}`);
  });
}
