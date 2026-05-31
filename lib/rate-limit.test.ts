import { describe, it, expect } from "vitest";
import { exceedsLimit, FREE_CHECK_DAILY_LIMIT } from "./rate-limit";

describe("FREE_CHECK_DAILY_LIMIT", () => {
  it("is 3 (per e-mail per 24 uur)", () => {
    expect(FREE_CHECK_DAILY_LIMIT).toBe(3);
  });
});

describe("exceedsLimit", () => {
  it("staat tellingen onder de limiet toe", () => {
    expect(exceedsLimit(0)).toBe(false);
    expect(exceedsLimit(1)).toBe(false);
    expect(exceedsLimit(2)).toBe(false);
  });

  it("weigert bij of boven de limiet", () => {
    expect(exceedsLimit(3)).toBe(true);
    expect(exceedsLimit(4)).toBe(true);
    expect(exceedsLimit(100)).toBe(true);
  });
});
