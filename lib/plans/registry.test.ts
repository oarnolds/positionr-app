import { describe, it, expect } from "vitest";
import {
  PLANS,
  TIER_ORDER,
  tierAllows,
  getPlan,
  type Tier,
} from "./registry";

describe("PLANS registry", () => {
  it("bevat precies drie tiers: basis, pro, premium", () => {
    expect(PLANS.map((p) => p.slug)).toEqual(["basis", "pro", "premium"]);
  });

  it("heeft voor elk plan positieve maand- en jaarprijzen en minstens 1 feature", () => {
    for (const plan of PLANS) {
      expect(plan.monthlyPriceCents).toBeGreaterThan(0);
      expect(plan.yearlyPriceCents).toBeGreaterThan(0);
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.name.length).toBeGreaterThan(0);
    }
  });

  it("jaarprijs is voordeliger dan 12x de maandprijs (incentive)", () => {
    for (const plan of PLANS) {
      expect(plan.yearlyPriceCents).toBeLessThan(plan.monthlyPriceCents * 12);
    }
  });

  it("getPlan vindt een plan op slug en geeft undefined voor onbekend", () => {
    expect(getPlan("pro")?.name).toBeDefined();
    expect(getPlan("onbekend" as Tier)).toBeUndefined();
  });
});

describe("tierAllows", () => {
  it("staat gelijke tier toe", () => {
    expect(tierAllows("basis", "basis")).toBe(true);
    expect(tierAllows("premium", "premium")).toBe(true);
  });

  it("staat hogere tier toe bij lagere eis (cumulatief)", () => {
    expect(tierAllows("premium", "basis")).toBe(true);
    expect(tierAllows("pro", "basis")).toBe(true);
    expect(tierAllows("premium", "pro")).toBe(true);
  });

  it("weigert lagere tier bij hogere eis", () => {
    expect(tierAllows("basis", "pro")).toBe(false);
    expect(tierAllows("pro", "premium")).toBe(false);
  });

  it("weigert wanneer de gebruiker geen tier heeft (null)", () => {
    expect(tierAllows(null, "basis")).toBe(false);
  });

  it("TIER_ORDER is oplopend van goedkoop naar duur", () => {
    expect(TIER_ORDER).toEqual(["basis", "pro", "premium"]);
  });
});
