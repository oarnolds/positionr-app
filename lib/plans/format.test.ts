import { describe, it, expect } from "vitest";
import { formatPriceEur, formatPeriod, priceFor } from "./format";
import { getPlan } from "./registry";

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

describe("formatPeriod", () => {
  it("vertaalt 'monthly' naar 'per maand'", () => {
    expect(formatPeriod("monthly")).toBe("per maand");
  });

  it("vertaalt 'yearly' naar 'per jaar'", () => {
    expect(formatPeriod("yearly")).toBe("per jaar");
  });
});

describe("priceFor", () => {
  it("kiest maandprijs bij interval 'monthly'", () => {
    const basis = getPlan("basis")!;
    expect(priceFor(basis, "monthly")).toBe(basis.monthlyPriceCents);
  });

  it("kiest jaarprijs bij interval 'yearly'", () => {
    const pro = getPlan("pro")!;
    expect(priceFor(pro, "yearly")).toBe(pro.yearlyPriceCents);
  });
});
