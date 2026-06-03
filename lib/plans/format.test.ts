import { describe, it, expect } from "vitest";
import { formatPriceEur } from "./format";

describe("formatPriceEur", () => {
  it("toont hele euro's zonder decimalen", () => {
    expect(formatPriceEur(14900)).toBe("€149");
    expect(formatPriceEur(39900)).toBe("€399");
  });

  it("toont cents als ze niet 0 zijn (met komma)", () => {
    expect(formatPriceEur(14950)).toBe("€149,50");
    expect(formatPriceEur(199)).toBe("€1,99");
  });

  it("werkt met 0", () => {
    expect(formatPriceEur(0)).toBe("€0");
  });
});
