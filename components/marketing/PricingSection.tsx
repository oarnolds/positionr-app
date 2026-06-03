import { PricingCard } from "./PricingCard";
import { PLANS } from "@/lib/plans/registry";

/**
 * Drie tier-kaarten naast elkaar. Nu een server-component (geen toggle-state
 * meer; alle plannen zijn jaarbasis).
 */
export function PricingSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PricingCard key={plan.slug} plan={plan} />
        ))}
      </div>
    </section>
  );
}
