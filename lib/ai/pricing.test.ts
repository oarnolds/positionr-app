import { describe, it, expect } from "vitest";
import { calculateCostCents, PRICING } from "./pricing";

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
