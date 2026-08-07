import { describe, test, expect } from "vitest";
import { aggregateUsage } from "./image-description";

describe("aggregateUsage", () => {
  test("sums input+output tokens across batches", () => {
    const usages = [
      { inputTokens: 1000, outputTokens: 100 },
      { inputTokens: 2000, outputTokens: 200 },
      { inputTokens: 500, outputTokens: 50 },
    ];
    expect(aggregateUsage(usages)).toEqual({
      inputTokens: 3500,
      outputTokens: 350,
    });
  });

  test("empty array returns zero", () => {
    expect(aggregateUsage([])).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
