import { test, expect } from "vitest";
import { FALLBACK_PROMPT } from "./prompt";

test("FALLBACK_PROMPT eist Nederlands en delegeert output-format aan FORMAT-TEMPLATE", () => {
  expect(FALLBACK_PROMPT).toMatch(/Nederlands/);
  // Output-structuur komt uit het FORMAT-TEMPLATE (toegevoegd door service.ts),
  // dus de prompt zelf mag GEEN JSON-instructies bevatten — die spraken eerder
  // de FORMAT-TEMPLATE tegen en zorgden voor JSON-output bij Perplexity.
  expect(FALLBACK_PROMPT.toLowerCase()).not.toMatch(/json/);
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
