import { describe, expect, it } from "vitest";
import {
  clampStrictness,
  strictnessInstruction,
  strictnessLabel,
  strictnessScoreOffset,
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

describe("strictnessScoreOffset", () => {
  it("is 0 op neutraal (stand 3)", () => {
    expect(strictnessScoreOffset(3)).toBe(0);
  });
  it("verschuift 0,5 per stap, gecentreerd op 3", () => {
    expect(strictnessScoreOffset(1)).toBe(1);
    expect(strictnessScoreOffset(2)).toBe(0.5);
    expect(strictnessScoreOffset(4)).toBe(-0.5);
    expect(strictnessScoreOffset(5)).toBe(-1);
  });
  it("klemt buiten bereik", () => {
    expect(strictnessScoreOffset(0)).toBe(1); // → stand 1
    expect(strictnessScoreOffset(99)).toBe(-1); // → stand 5
  });
});

describe("strictnessInstruction", () => {
  it("stuurt de toon per stand", () => {
    expect(strictnessInstruction(5)).toContain("streng en veeleisend");
    expect(strictnessInstruction(1)).toContain("welwillend en bemoedigend");
    expect(strictnessInstruction(3)).toContain("neutraal en evenwichtig");
  });
  it("zet de cijfers altijd op de vaste maatstaf", () => {
    for (const lvl of [1, 2, 3, 4, 5]) {
      expect(strictnessInstruction(lvl)).toContain("vaste, eerlijke maatstaf");
    }
  });
  it("klemt buiten bereik naar een geldig niveau", () => {
    expect(strictnessInstruction(99)).toContain("streng en veeleisend");
  });
});
