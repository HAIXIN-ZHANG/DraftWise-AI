import { polishWithFallback } from "../src/openai-polish";

const originalConsoleInfo = console.info;

beforeAll(() => {
  console.info = () => undefined;
});

afterAll(() => {
  console.info = originalConsoleInfo;
});

test("uses the requested quality model and returns metadata", async () => {
  let requestBody: unknown;
  const openai = {
    responses: {
      create: async (body: unknown) => {
        requestBody = body;
        return { output_text: "Polished text" };
      },
    },
  };

  const result = await polishWithFallback(openai as never, {
    requestId: "req_test",
    text: "raw text",
    style: "professional",
    quality: "balanced",
    note: "concise",
  });

  expect(result).toEqual({
    text: "Polished text",
    model: "gpt-5.4-mini",
    fallbackUsed: false,
    attemptCount: 1,
  });
  expect((requestBody as { model: string }).model).toBe("gpt-5.4-mini");
  expect((requestBody as { store: boolean }).store).toBe(false);
});

test("falls back on retryable OpenAI errors", async () => {
  const attemptedModels: string[] = [];
  const openai = {
    responses: {
      create: async (body: { model: string }) => {
        attemptedModels.push(body.model);

        if (attemptedModels.length === 1) {
          const error = new Error("rate limited") as Error & { status: number };
          error.status = 429;
          throw error;
        }

        return { output_text: "Fallback polished text" };
      },
    },
  };

  const result = await polishWithFallback(openai as never, {
    text: "raw text",
    style: "natural",
    quality: "balanced",
  });

  expect(attemptedModels).toEqual(["gpt-5.4-mini", "gpt-5.4-nano"]);
  expect(result.text).toBe("Fallback polished text");
  expect(result.model).toBe("gpt-5.4-nano");
  expect(result.fallbackUsed).toBe(true);
  expect(result.attemptCount).toBe(2);
});

test("rejects empty OpenAI responses", async () => {
  const openai = {
    responses: {
      create: async () => ({ output_text: "" }),
    },
  };

  await expect(
    polishWithFallback(openai as never, {
      text: "raw text",
      style: "natural",
      quality: "cheap",
    }),
  ).rejects.toThrow("OpenAI returned an empty response");
});
