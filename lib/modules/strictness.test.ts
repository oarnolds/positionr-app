import { describe, expect, it } from "vitest";
import {
  clampStrictness,
  strictnessInstruction,
  strictnessLabel,
  DEFAULT_STRICTNESS,
} from "./strictness";

describe("clampStrictness", () => {
  it("laat geldige niveaus 1..5 ongemoeid", () => {
    expect(clampStrictness(1)).toBe(1);
    expect(clampStrictness(5)).toBe(5);
  });
  it("rondt af op heel getal", () => {
    expect(clampStrictness(3.4)).toBe(3);
    expect(clampStrictness(3.6)).toBe(4);
  });
  it("klemt buiten bereik", () => {
    expect(clampStrictness(0)).toBe(1);
    expect(clampStrictness(6)).toBe(5);
    expect(clampStrictness(-2)).toBe(1);
  });
  it("valt terug op default bij NaN/oneindig", () => {
    expect(clampStrictness(Number.NaN)).toBe(DEFAULT_STRICTNESS);
    expect(clampStrictness(Number.POSITIVE_INFINITY)).toBe(DEFAULT_STRICTNESS);
  });
});

describe("strictnessLabel", () => {
  it("geeft het juiste label per niveau", () => {
    expect(strictnessLabel(1)).toBe("Mild");
    expect(strictnessLabel(3)).toBe("Evenwichtig");
    expect(strictnessLabel(5)).toBe("Zeer streng");
  });
});

describe("strictnessInstruction", () => {
  it("bevat de niveau-specifieke tekst", () => {
    expect(strictnessInstruction(5)).toContain("zeer streng");
    expect(strictnessInstruction(1)).toContain("welwillend");
  });
  it("plakt altijd de gedeelde grens erachter", () => {
    for (const lvl of [1, 2, 3, 4, 5]) {
      expect(strictnessInstruction(lvl)).toContain(
        "ongeacht de gekozen strengheid",
      );
    }
  });
  it("klemt buiten bereik naar een geldig niveau", () => {
    expect(strictnessInstruction(99)).toContain("zeer streng");
  });
});
