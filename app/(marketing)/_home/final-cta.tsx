import Link from "next/link";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="rounded-3xl bg-cream-tint p-12 text-center md:p-20">
        <h2
          className="font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl"
          style={{ lineHeight: 1.1 }}
        >
          Klaar om zelf grip te krijgen?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-mid">
          Begin met een gratis Website Check. Geen account, ± 2 minuten.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/gratis-check"
            className="inline-flex items-center justify-center rounded-lg bg-coral px-5 py-3 text-[15px] font-semibold text-white hover:bg-coral-hover"
          >
            Doe de gratis check →
          </Link>
          <Link
            href="/prijzen"
            className="inline-flex items-center justify-center px-2 py-3 text-[15px] font-semibold text-ink-high underline-offset-4 hover:underline"
          >
            Of bekijk eerst de pakketten
          </Link>
        </div>
        <p className="mt-6 text-xs text-ink-mut">
          In de meeste gevallen heb je binnen 5 minuten een rapport in handen.
        </p>
      </div>
    </section>
  );
}
