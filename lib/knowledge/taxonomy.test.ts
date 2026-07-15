import { describe, expect, it } from "vitest";
import { TAXONOMY, THEME_SLUGS, filterValidThemes } from "./taxonomy";

describe("taxonomy", () => {
  it("heeft unieke, kebab-case slugs", () => {
    const slugs = TAXONOMY.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(THEME_SLUGS.size).toBe(slugs.length);
  });

  it("filterValidThemes houdt alleen geldige slugs, genormaliseerd en ontdubbeld", () => {
    expect(filterValidThemes(["bewijsvoering", "onzin", "BEWIJSVOERING", " cta-conversie "]))
      .toEqual(["bewijsvoering", "cta-conversie"]);
  });

  it("filterValidThemes op lege/rommelige input → lege lijst", () => {
    expect(filterValidThemes([])).toEqual([]);
    expect(filterValidThemes(["", "  ", "bestaat-niet"])).toEqual([]);
  });
});
