import { test, expect } from "vitest";
import {
  GENERIC_MODULES,
  isGenericModule,
  moduleSourceTypes,
  parseSourceType,
} from "./schema";

test("moduleSourceTypes: toegestane bronnen per module", () => {
  expect(moduleSourceTypes("klantcase-analyse")).toEqual([
    "library",
    "url",
    "file",
  ]);
  expect(moduleSourceTypes("flyercheck")).toEqual(["library", "url", "file"]);
  // LinkedIn-analyse: bedrijfspagina-URL (gastpagina-scrape) óf een geüploade
  // analytics-export.
  expect(moduleSourceTypes("linkedin-analyse")).toEqual(["url", "file"]);
  // Markttrends, propositie en onbekende slugs: alleen bibliotheek.
  expect(moduleSourceTypes("markttrends-rapport")).toEqual(["library"]);
  expect(moduleSourceTypes("propositie-analyse")).toEqual(["library"]);
  expect(moduleSourceTypes("bestaat-niet")).toEqual(["library"]);
});

test("linkedin-analyse: urlPattern accepteert alleen LinkedIn-bedrijfspagina's", () => {
  const pattern = GENERIC_MODULES["linkedin-analyse"].urlPattern;
  expect(pattern?.test("https://www.linkedin.com/company/biqql/")).toBe(true);
  expect(pattern?.test("https://linkedin.com/company/acme")).toBe(true);
  expect(pattern?.test("https://biqql.com/")).toBe(false);
  expect(pattern?.test("https://www.linkedin.com/in/persoon/")).toBe(false);
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
