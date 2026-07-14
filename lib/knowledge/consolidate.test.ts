import { test, expect } from "vitest";
import { buildConsolidatePrompt } from "./consolidate";

test("buildConsolidatePrompt: bevat kandidaten, doelaantal en JSON-instructie", () => {
  const prompt = buildConsolidatePrompt([
    { title: "Wederkerigheid", kern: "geven en nemen", toepassing: "geef eerst", tags: ["cta"] },
    { title: "Schaarste", kern: "verlies weegt zwaar", toepassing: "toon verlies", tags: ["urgentie"] },
  ]);
  expect(prompt).toContain("Wederkerigheid");
  expect(prompt).toContain("Schaarste");
  expect(prompt).toMatch(/10/);
  expect(prompt).toMatch(/20/);
  expect(prompt).toMatch(/JSON/);
  expect(prompt).toMatch(/ontdubbel|samen|dubbel/i);
});
