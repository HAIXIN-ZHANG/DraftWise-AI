import { maxEmbeddedNoteCharacters, maxTextCharacters } from "../src/polish-options";
import { parsePolishRequest } from "../src/polish-request";

test("parses a basic polish request", () => {
  const result = parsePolishRequest({
    text: "I check this issue and backend not return data yet",
    style: "professional",
    quality: "balanced",
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  expect(result.value.text).toBe("I check this issue and backend not return data yet");
  expect(result.value.style).toBe("professional");
  expect(result.value.quality).toBe("balanced");
  expect(result.value.note).toBeUndefined();
});

test("extracts the final note and uses recognized style and quality", () => {
  const result = parsePolishRequest({
    text: "I check this issue and backend not return data yet\n\n备注：写给 PM，专业，高质量",
    style: "natural",
    quality: "balanced",
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  expect(result.value.text).toBe("I check this issue and backend not return data yet");
  expect(result.value.note).toBe("写给 PM，专业，高质量");
  expect(result.value.style).toBe("professional");
  expect(result.value.quality).toBe("quality");
});

test("extracts a final note after a single newline", () => {
  const result = parsePolishRequest({
    text: "I check this issue and backend not return data yet\nnote: make it concise for Slack",
    style: "natural",
    quality: "balanced",
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  expect(result.value.text).toBe("I check this issue and backend not return data yet");
  expect(result.value.note).toBe("make it concise for Slack");
  expect(result.value.style).toBe("concise");
  expect(result.value.quality).toBe("balanced");
});

test("passes unrecognized note text through without overriding style or quality", () => {
  const result = parsePolishRequest({
    text: "Can you check this issue?\n\n备注：写给老板，不要太强硬，表达成我还在确认问题",
    style: "natural",
    quality: "balanced",
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  expect(result.value.note).toBe("写给老板，不要太强硬，表达成我还在确认问题");
  expect(result.value.style).toBe("natural");
  expect(result.value.quality).toBe("balanced");
});

test("does not treat inline note text as an embedded note", () => {
  const result = parsePolishRequest({
    text: "备注：this should be polished as normal content",
    style: "natural",
    quality: "balanced",
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  expect(result.value.text).toBe("备注：this should be polished as normal content");
  expect(result.value.note).toBeUndefined();
});

test("rejects a final note without body text", () => {
  const result = parsePolishRequest({
    text: "\n\n备注：专业，高质量",
    style: "natural",
    quality: "balanced",
  });

  if (result.ok) {
    throw new Error("Expected request parsing to fail.");
  }

  expect(result.error.code).toBe("invalid_text");
  expect(result.error.message).toBe("`text` must be a non-empty string after removing the note.");
});

test("rejects text over the character limit after note extraction", () => {
  const result = parsePolishRequest({
    text: `${"a".repeat(maxTextCharacters + 1)}\n\n备注：专业`,
    style: "natural",
    quality: "balanced",
  });

  if (result.ok) {
    throw new Error("Expected request parsing to fail.");
  }

  expect(result.error.code).toBe("text_too_long");
});

test("rejects notes over the character limit", () => {
  const result = parsePolishRequest({
    text: `Main text\n\n备注：${"a".repeat(maxEmbeddedNoteCharacters + 1)}`,
    style: "natural",
    quality: "balanced",
  });

  if (result.ok) {
    throw new Error("Expected request parsing to fail.");
  }

  expect(result.error.code).toBe("note_too_long");
});

test("rejects unsupported style and quality values", () => {
  const badStyle = parsePolishRequest({
    text: "Main text",
    style: "slack",
    quality: "balanced",
  });
  const badQuality = parsePolishRequest({
    text: "Main text",
    style: "natural",
    quality: "fast",
  });

  if (badStyle.ok || badQuality.ok) {
    throw new Error("Expected request parsing to fail.");
  }

  expect(badStyle.error.code).toBe("invalid_style");
  expect(badQuality.error.code).toBe("invalid_quality");
});
