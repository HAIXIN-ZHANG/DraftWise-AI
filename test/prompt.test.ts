import { buildSystemPrompt } from "../src/prompt";

test("builds a compact prompt without smart or strict modes", () => {
  const prompt = buildSystemPrompt("professional");

  expect(prompt).not.toContain("smart");
  expect(prompt).not.toContain("strict");
  expect(prompt).not.toContain("Instruction mode");
  expect(prompt).toContain("Polish only");
  expect(prompt).toContain("Use the majority language");
  expect(prompt).toContain("Translate incidental words or phrases");
  expect(prompt).toContain("Do not infer instructions");
});

test("includes the full note as explicit instructions", () => {
  const prompt = buildSystemPrompt("natural", "写给老板，不要太强硬，表达成我还在确认问题");

  expect(prompt).toContain("<note>\n写给老板，不要太强硬，表达成我还在确认问题\n</note>");
  expect(prompt).toContain("primary writing preference");
  expect(prompt).toContain("language handling");
  expect(prompt).toContain("duplicate output");
  expect(prompt).toContain("Do not output the note");
});
