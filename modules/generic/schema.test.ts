import { test, expect } from "vitest";
import {
  isGenericModule,
  moduleAllowsExtraSources,
  parseSourceType,
} from "./schema";

test("moduleAllowsExtraSources: klantcase wel, propositie niet", () => {
  expect(moduleAllowsExtraSources("klantcase-analyse")).toBe(true);
  expect(moduleAllowsExtraSources("propositie-analyse")).toBe(false);
  expect(moduleAllowsExtraSources("bestaat-niet")).toBe(false);
});

test("isGenericModule blijft werken met config-objecten", () => {
  expect(isGenericModule("klantcase-analyse")).toBe(true);
  expect(isGenericModule("propositie-analyse")).toBe(true);
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
