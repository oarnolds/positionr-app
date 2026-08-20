import Link from "next/link";

import { PLANS } from "@/lib/plans/registry";
import { formatPriceEur } from "@/lib/plans/format";

export function PlansTeaser() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-12 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Pakketten.
        </div>
        <h2
          className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl"
          style={{ lineHeight: 1.1 }}
        >
          Eén jaarbedrag, alle modules in je pakket.
        </h2>
        <p className="mt-4 text-lg text-ink-mid">
          Geen uurtarieven, geen consultancy-add-ons. Een fractie van wat één
          bureau-traject kost.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.slug}
            className={`relative rounded-2xl bg-cream-tint/40 p-8 ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 ${
              p.popular ? "-translate-y-1 border-t-2 border-primary" : ""
            }`}
          >
            {p.popular && (
              <div className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
                Populair
              </div>
            )}
            <div className="font-display text-2xl font-bold text-ink-high">
              {p.name}
            </div>
            <p className="mt-1 text-sm text-ink-mid">{p.tagline}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold text-ink-high">
                {formatPriceEur(p.yearlyPriceCents)}
              </span>
              <span className="text-sm text-ink-mut">/jaar</span>
            </div>
            <Link
              href="/prijzen"
              className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-[15px] font-semibold ${
                p.popular
                  ? "bg-coral text-white hover:bg-coral-hover"
                  : "border border-black/10 text-ink-high hover:bg-white"
              }`}
            >
              Kies dit pakket
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-10 text-center text-sm text-ink-mid">
        <Link
          href="/prijzen"
          className="font-semibold text-primary hover:underline"
        >
          Bekijk alle features en modules per pakket →
        </Link>
      </p>
    </section>
  );
}
