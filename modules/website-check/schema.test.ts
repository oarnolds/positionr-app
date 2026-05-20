import { test, expect } from "vitest";
import { WebsiteCheckOutputSchema, WebsiteCheckInputSchema } from "./schema";

const validOutput = {
  companyName: "Datapas B.V.",
  websiteUrl: "https://datapas.nl",
  overallScore: 7.4,
  executiveSummary: "Sterke propositie, zwakke CTA's.",
  onderdelen: Array.from({ length: 11 }, (_, i) => ({
    naam: `Onderdeel ${i + 1}`,
    score: 7,
    toelichting: "ok",
    verbeterpunten: ["punt"],
  })),
  sterkePunten: ["a", "b", "c"],
  verbeterpunten: ["x", "y", "z"],
  topActies: [
    { actie: "fix CTA", impact: "hoog" as const, toelichting: "primair" },
  ],
};

test("output schema accepteert geldige analyse", () => {
  expect(() => WebsiteCheckOutputSchema.parse(validOutput)).not.toThrow();
});

test("output schema weigert ongeldige impact", () => {
  const bad = { ...validOutput, topActies: [{ actie: "x", impact: "extreem", toelichting: "y" }] };
  expect(() => WebsiteCheckOutputSchema.parse(bad)).toThrow();
});

test("input schema vereist URL", () => {
  expect(() => WebsiteCheckInputSchema.parse({ websiteUrl: "" })).toThrow();
  expect(() => WebsiteCheckInputSchema.parse({ websiteUrl: "https://x.nl" })).not.toThrow();
});
