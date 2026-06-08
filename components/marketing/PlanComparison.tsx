import { Check, Minus } from "lucide-react";

import { MODULES } from "@/lib/modules/registry";
import { PLANS, TIER_ORDER, tierAllows } from "@/lib/plans/registry";
import { cn } from "@/lib/utils";

/**
 * Matrix-overzicht: welke modules zitten in welk pakket?
 * Leest modules + tiers uit de canonical registries (lib/modules/registry +
 * lib/plans/registry). Verandering van tier-grenzen elders → matrix update't
 * automatisch.
 *
 * Mobiel: horizontaal scrollbaar zodat de tabel niet verspringt.
 */
export function PlanComparison() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Vergelijking
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            Welke modules zitten in welk pakket?
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Hogere pakketten ontgrendelen meer modules. Alles cumulatief —
            Premium krijgt alles uit Pro, Pro krijgt alles uit Basis.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-4 pr-4 text-left font-semibold text-slate-900">
                  Module
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.slug}
                    className={cn(
                      "w-32 py-4 text-center font-semibold",
                      plan.popular ? "text-primary" : "text-slate-900",
                    )}
                  >
                    {plan.name}
                    {plan.popular && (
                      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-primary/70">
                        Populair
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.filter((m) => !m.parentSlug).map((module) => (
                <tr
                  key={module.slug}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <td className="py-3.5 pr-4 align-top">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-medium",
                          module.status === "soon"
                            ? "text-slate-500"
                            : "text-slate-900",
                        )}
                      >
                        {module.name}
                      </span>
                      {module.status === "soon" && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          Binnenkort
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {module.description}
                    </p>
                  </td>
                  {TIER_ORDER.map((tier) => {
                    const included = tierAllows(tier, module.minTier);
                    return (
                      <td key={tier} className="py-3.5 text-center align-middle">
                        {included ? (
                          <Check className="mx-auto h-5 w-5 text-primary" />
                        ) : (
                          <Minus className="mx-auto h-4 w-4 text-slate-300" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          "Binnenkort" = module is in ontwikkeling. Zodra hij live gaat, krijg
          je 'm vanzelf in jouw pakket.
        </p>
      </div>
    </section>
  );
}
