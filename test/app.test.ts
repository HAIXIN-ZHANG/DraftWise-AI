import request from "supertest";
import { app } from "../src/app";
import * as openaiPolish from "../src/openai-polish";
import { clearPolishCache } from "../src/polish-cache";

const originalEnv = { ...process.env };

afterAll(() => {
  process.env = originalEnv;
});

beforeEach(() => {
  process.env = {
    ...originalEnv,
    API_TOKEN: "test-token",
    OPENAI_API_KEY: "test-openai-key",
  };
  clearPolishCache();
  jest.restoreAllMocks();
});

test("health reports missing runtime config", async () => {
  delete process.env.API_TOKEN;
  delete process.env.OPENAI_API_KEY;

  const response = await request(app).get("/health");
  const body = response.body as { ok: boolean; missing: string[] };

  expect(response.status).toBe(503);
  expect(body).toEqual({
    ok: false,
    missing: ["API_TOKEN", "OPENAI_API_KEY"],
  });
});

test("health succeeds when required config is present", async () => {
  const response = await request(app).get("/health");
  const body = response.body as { ok: boolean };

  expect(response.status).toBe(200);
  expect(body).toEqual({ ok: true });
});

test("polish requires the API token", async () => {
  const response = await request(app).post("/polish").set("X-API-Token", "wrong-token").send({
    text: "raw text",
    style: "professional",
    quality: "balanced",
  });
  const body = response.body as { error: { code: string } };

  expect(response.status).toBe(401);
  expect(body.error.code).toBe("unauthorized");
});

test("polish rejects invalid text before calling OpenAI", async () => {
  const polishSpy = jest.spyOn(openaiPolish, "polishWithFallback");

  const response = await request(app).post("/polish").set("X-API-Token", "test-token").send({
    text: "   ",
    style: "professional",
    quality: "balanced",
  });
  const body = response.body as { error: { code: string } };

  expect(response.status).toBe(400);
  expect(body.error.code).toBe("invalid_text");
  expect(polishSpy).not.toHaveBeenCalled();
});

test("polish returns text, request ID, and response metadata", async () => {
  const polishSpy = jest.spyOn(openaiPolish, "polishWithFallback").mockResolvedValue({
    text: "I checked this issue, and the backend is not returning data yet.",
    model: "gpt-5.4-mini",
    fallbackUsed: false,
    attemptCount: 1,
  });

  const response = await request(app).post("/polish").set("X-API-Token", "test-token").send({
    text: "I check this issue and backend not return data yet",
    style: "professional",
    quality: "balanced",
  });
  const body = response.body as {
    text: string;
    meta: {
      requestId: string;
      style: string;
      quality: string;
      model: string;
      cacheHit: boolean;
      inFlightHit: boolean;
      inputChars: number;
      outputChars: number;
    };
  };

  expect(response.status).toBe(200);
  expect(body.text).toBe("I checked this issue, and the backend is not returning data yet.");
  expect(body.meta.requestId).toBe(response.headers["x-request-id"]);
  expect(body.meta.style).toBe("professional");
  expect(body.meta.quality).toBe("balanced");
  expect(body.meta.model).toBe("gpt-5.4-mini");
  expect(body.meta.cacheHit).toBe(false);
  expect(body.meta.inFlightHit).toBe(false);
  expect(body.meta.inputChars).toBe(50);
  expect(body.meta.outputChars).toBe(body.text.length);
  expect(polishSpy).toHaveBeenCalledTimes(1);
});
