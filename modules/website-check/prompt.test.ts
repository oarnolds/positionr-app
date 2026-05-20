import { test, expect } from "vitest";
import { SYSTEM_PROMPT, buildUserPrompt, ONDERDELEN } from "./prompt";

test("11 vaste onderdelen in juiste volgorde", () => {
  expect(ONDERDELEN).toHaveLength(11);
  expect(ONDERDELEN[0]).toBe("Waardepropositie");
  expect(ONDERDELEN[6]).toBe("CTA's");
  expect(ONDERDELEN[10]).toBe("Contactpagina");
});

test("SYSTEM_PROMPT eist Nederlands + JSON", () => {
  expect(SYSTEM_PROMPT).toMatch(/Nederlands/);
  expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/json/);
});

test("buildUserPrompt bevat input + alle 11 onderdelen", () => {
  const p = buildUserPrompt({
    companyName: "Datapas B.V.",
    websiteUrl: "https://datapas.nl",
    scrapedContent: "Onze homepage tekst…",
  });
  expect(p).toContain("Datapas B.V.");
  expect(p).toContain("https://datapas.nl");
  expect(p).toContain("Onze homepage tekst…");
  for (const naam of ONDERDELEN) expect(p).toContain(naam);
});
