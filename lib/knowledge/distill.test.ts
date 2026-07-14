import { test, expect } from "vitest";
import { buildDistillPrompt } from "./distill";

test("buildDistillPrompt: vraagt Nederlandse output ongeacht brontaal", () => {
  const prompt = buildDistillPrompt({
    chapterText: "Reciprocity: people repay favors.",
    sourceLabel: "Robert Cialdini — Influence",
    language: "en",
  });
  expect(prompt).toContain("Robert Cialdini — Influence");
  expect(prompt).toMatch(/Nederlands/i);
  expect(prompt).toContain("Reciprocity: people repay favors.");
  expect(prompt).toMatch(/JSON/);
});

test("buildDistillPrompt: instrueert om niet-inhoudelijke secties over te slaan", () => {
  const prompt = buildDistillPrompt({ chapterText: "x", sourceLabel: "b", language: "nl" });
  expect(prompt).toMatch(/lege array|\[\]/);
  expect(prompt).toMatch(/noten|voorwerk|register/i);
});

test("buildDistillPrompt: benoemt anderstalige bron als die niet NL is", () => {
  const en = buildDistillPrompt({ chapterText: "x", sourceLabel: "b", language: "en" });
  expect(en).toMatch(/anderstalig/i);
  const nl = buildDistillPrompt({ chapterText: "x", sourceLabel: "b", language: "nl" });
  expect(nl).toMatch(/Nederlands/i);
});
