import { test, expect } from "vitest";
import {
  isGenericModule,
  moduleAllowsExtraSources,
  parseSourceType,
} from "./schema";

test("moduleAllowsExtraSources: upload/URL-bron per module", () => {
  expect(moduleAllowsExtraSources("klantcase-analyse")).toBe(true);
  // Flyercheck draait op een geüploade flyer, LinkedIn op aangeleverde
  // LinkedIn-data (PDF-export of case-URL) — beide hebben de bronkeuze nodig.
  expect(moduleAllowsExtraSources("flyercheck")).toBe(true);
  expect(moduleAllowsExtraSources("linkedin-analyse")).toBe(true);
  // Markttrends en propositie draaien op het website-snapshot uit de bibliotheek.
  expect(moduleAllowsExtraSources("markttrends-rapport")).toBe(false);
  expect(moduleAllowsExtraSources("propositie-analyse")).toBe(false);
  expect(moduleAllowsExtraSources("bestaat-niet")).toBe(false);
});

test("isGenericModule blijft werken met config-objecten", () => {
  expect(isGenericModule("klantcase-analyse")).toBe(true);
  expect(isGenericModule("propositie-analyse")).toBe(true);
  expect(isGenericModule("flyercheck")).toBe(true);
  expect(isGenericModule("linkedin-analyse")).toBe(true);
  expect(isGenericModule("markttrends-rapport")).toBe(true);
  expect(isGenericModule("website-check")).toBe(false);
});

test("parseSourceType: geldige waarden komen door, rest valt terug op library", () => {
  expect(parseSourceType("library")).toBe("library");
  expect(parseSourceType("url")).toBe("url");
  expect(parseSourceType("file")).toBe("file");
  expect(parseSourceType(null)).toBe("library");
  expect(parseSourceType(undefined)).toBe("library");
  expect(parseSourceType("iets-anders")).toBe("library");
});
