import { describe, it, test, expect } from "vitest";
import {
  calculateCostCents,
  PRICING,
  calculateModelCostCents,
  MODEL_PRICING,
} from "./pricing";

describe("calculateCostCents", () => {
  it("Claude Sonnet 4.5: $3/MTok input + $15/MTok output", () => {
    // 1M input + 1M output = $3 + $15 = $18 = 1800 cents
    expect(calculateCostCents("claude", 1_000_000, 1_000_000)).toBe(1800);
  });

  it("Perplexity sonar-pro: $3/MTok input + $15/MTok output", () => {
    expect(calculateCostCents("perplexity", 1_000_000, 1_000_000)).toBe(1800);
  });

  it("rondt cents af op gehele getallen", () => {
    // 1000 input tokens at $3/MTok = $0.003 = 0.3 cents → afgerond 0
    expect(calculateCostCents("claude", 1000, 0)).toBe(0);
  });

  it("exposes PRICING object voor admin-display", () => {
    expect(PRICING.claude.inputPerMTokUsd).toBe(3);
    expect(PRICING.perplexity.outputPerMTokUsd).toBe(15);
  });
});

describe("calculateModelCostCents", () => {
  test("haiku 4.5: 100k input + 10k output tokens → correct cents", () => {
    // Haiku 4.5: $1/M input, $5/M output → 100_000 * 1 / 1M = $0.10 input
    // 10_000 * 5 / 1M = $0.05 output → Totaal $0.15 = 15 cent
    const cents = calculateModelCostCents(
      "claude-haiku-4-5-20251001",
      100_000,
      10_000,
    );
    expect(cents).toBe(15);
  });

  test("opus 5: 100k input + 10k output tokens → correct cents", () => {
    // Opus 5: $5/M input, $25/M output → $0.50 + $0.25 = $0.75 = 75 cent
    const cents = calculateModelCostCents("claude-opus-5", 100_000, 10_000);
    expect(cents).toBe(75);
  });

  test("unknown model falls back to Sonnet pricing", () => {
    const knownCents = calculateModelCostCents(
      "claude-sonnet-4-6",
      1_000_000,
      100_000,
    );
    const unknownCents = calculateModelCostCents(
      "does-not-exist",
      1_000_000,
      100_000,
    );
    expect(unknownCents).toBe(knownCents);
  });

  test("all three vergelijk-modellen exist in MODEL_PRICING", () => {
    expect(MODEL_PRICING["claude-haiku-4-5-20251001"]).toBeDefined();
    expect(MODEL_PRICING["claude-opus-5"]).toBeDefined();
    expect(MODEL_PRICING["claude-fable-5"]).toBeDefined();
  });
});
