import { describe, it, expect } from "vitest";
import { activeTier, type SubscriptionState } from "./subscription";

const NOW = new Date("2026-06-01T12:00:00Z");
const FUTURE = new Date("2026-07-01T12:00:00Z");
const PAST = new Date("2026-05-01T12:00:00Z");

function sub(partial: Partial<SubscriptionState>): SubscriptionState {
  return {
    tier: "pro",
    status: "active",
    currentPeriodEnd: FUTURE,
    ...partial,
  };
}

describe("activeTier", () => {
  it("geeft de tier bij status=active en periode in de toekomst", () => {
    expect(activeTier(sub({ tier: "pro" }), NOW)).toBe("pro");
    expect(activeTier(sub({ tier: "premium" }), NOW)).toBe("premium");
  });

  it("geeft null wanneer de periode verlopen is (bv. jaar afgelopen)", () => {
    expect(activeTier(sub({ currentPeriodEnd: PAST }), NOW)).toBeNull();
  });

  it("geeft null bij status past_due (mislukte incasso)", () => {
    expect(activeTier(sub({ status: "past_due" }), NOW)).toBeNull();
  });

  it("geeft null bij status canceled of expired", () => {
    expect(activeTier(sub({ status: "canceled" }), NOW)).toBeNull();
    expect(activeTier(sub({ status: "expired" }), NOW)).toBeNull();
  });

  it("behandelt periode-einde exact op nu als verlopen", () => {
    expect(activeTier(sub({ currentPeriodEnd: NOW }), NOW)).toBeNull();
  });
});
