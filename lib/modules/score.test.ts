import { describe, expect, it } from "vitest";
import { scoreBand } from "./score";

describe("scoreBand", () => {
  it("rood onder 5", () => {
    expect(scoreBand(4.9)).toBe("rood");
    expect(scoreBand(0)).toBe("rood");
  });
  it("amber 5 t/m <6,5", () => {
    expect(scoreBand(5)).toBe("amber");
    expect(scoreBand(6.4)).toBe("amber");
  });
  it("groen vanaf 6,5", () => {
    expect(scoreBand(6.5)).toBe("groen");
    expect(scoreBand(9)).toBe("groen");
  });
});
