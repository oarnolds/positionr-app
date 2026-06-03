import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans/registry";
import { formatPriceEur } from "@/lib/plans/format";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compacte 3-tier-teaser onder de landing. Leest dezelfde PLANS-registry als
 * de volledige prijzenpagina; toont alleen de maandprijs en de eerste drie
 * features. Volledig overzicht: /prijzen.
 */
export function PricingTeaser() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Pakketten
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            Eén abonnement, alle modules
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Geen credits, geen losse modules. Maand- of jaarbetaling, opzegbaar
            per einde periode.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={cn(
                "flex flex-col rounded-2xl border bg-white p-6",
                plan.popular
                  ? "border-primary shadow-lg ring-2 ring-primary/15"
                  : "border-slate-200",
              )}
            >
              {plan.popular && (
                <div className="mb-3 inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Populair
                </div>
              )}
              <h3 className="text-lg font-semibold text-slate-900">
                {plan.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900">
                  {formatPriceEur(plan.monthlyPriceCents)}
                </span>
                <span className="text-sm text-slate-500">/ maand</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-700">
                {plan.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/prijzen">
            <Button size="lg" variant="outline">
              Bekijk alle details <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
