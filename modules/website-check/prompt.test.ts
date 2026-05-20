import { test, expect } from "vitest";
import { FALLBACK_PROMPT } from "./prompt";

test("FALLBACK_PROMPT eist Nederlands + JSON", () => {
  expect(FALLBACK_PROMPT).toMatch(/Nederlands/);
  expect(FALLBACK_PROMPT.toLowerCase()).toMatch(/json/);
});

test("FALLBACK_PROMPT bevat alle 11 onderdelen", () => {
  const onderdelen = [
    "Waardepropositie",
    "Klantvoordelen",
    "Diensten/Features",
    "Proces",
    "Bewijsvoering",
    "Klantcases",
    "CTA's",
    "Content",
    "Schrijfstijl",
    "Actualiteit",
    "Contactpagina",
  ];
  for (const naam of onderdelen) {
    expect(FALLBACK_PROMPT).toContain(naam);
  }
});

test("FALLBACK_PROMPT bevat placeholders {websiteUrl}, {companyName}, {scrapedContent}", () => {
  expect(FALLBACK_PROMPT).toContain("{websiteUrl}");
  expect(FALLBACK_PROMPT).toContain("{companyName}");
  expect(FALLBACK_PROMPT).toContain("{scrapedContent}");
});
