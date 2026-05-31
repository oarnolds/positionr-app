"use client";

import { useState } from "react";

import { BillingToggle } from "./BillingToggle";
import { PricingCard } from "./PricingCard";
import { PLANS, type BillingInterval } from "@/lib/plans/registry";

export function PricingSection() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex justify-center">
        <BillingToggle value={interval} onChange={setInterval} />
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PricingCard key={plan.slug} plan={plan} interval={interval} />
        ))}
      </div>
    </section>
  );
}
