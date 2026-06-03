import { describe, it, expect } from "vitest";
import {
  PLANS,
  TIER_ORDER,
  tierAllows,
  getPlan,
  type Tier,
} from "./registry";

describe("PLANS registry", () => {
  it("bevat precies drie tiers: fundament, groei, strategie", () => {
    expect(PLANS.map((p) => p.slug)).toEqual(["fundament", "groei", "strategie"]);
  });

  it("heeft voor elk plan een positieve jaarprijs en minstens 1 feature", () => {
    for (const plan of PLANS) {
      expect(plan.yearlyPriceCents).toBeGreaterThan(0);
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.name.length).toBeGreaterThan(0);
    }
  });

  it("getPlan vindt een plan op slug en geeft undefined voor onbekend", () => {
    expect(getPlan("groei")?.name).toBeDefined();
    expect(getPlan("onbekend" as Tier)).toBeUndefined();
  });
});

describe("tierAllows", () => {
  it("staat gelijke tier toe", () => {
    expect(tierAllows("fundament", "fundament")).toBe(true);
    expect(tierAllows("strategie", "strategie")).toBe(true);
  });

  it("staat hogere tier toe bij lagere eis (cumulatief)", () => {
    expect(tierAllows("strategie", "fundament")).toBe(true);
    expect(tierAllows("groei", "fundament")).toBe(true);
    expect(tierAllows("strategie", "groei")).toBe(true);
  });

  it("weigert lagere tier bij hogere eis", () => {
    expect(tierAllows("fundament", "groei")).toBe(false);
    expect(tierAllows("groei", "strategie")).toBe(false);
  });

  it("weigert wanneer de gebruiker geen tier heeft (null)", () => {
    expect(tierAllows(null, "fundament")).toBe(false);
  });

  it("TIER_ORDER is oplopend van goedkoop naar duur", () => {
    expect(TIER_ORDER).toEqual(["fundament", "groei", "strategie"]);
  });
});

describe("popular-vlag", () => {
  it("er is precies één populair plan en dat is 'groei'", () => {
    const popular = PLANS.filter((p) => p.popular);
    expect(popular).toHaveLength(1);
    expect(popular[0].slug).toBe("groei");
  });
});
