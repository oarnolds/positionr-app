import Link from "next/link";

import type { FinalCtaKey } from "./keys";

export function FinalCta({
  content,
}: {
  content: Record<FinalCtaKey, string>;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="rounded-3xl bg-cream-tint p-12 text-center md:p-20">
        <h2
          className="font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl"
          style={{ lineHeight: 1.1 }}
        >
          {content["homepage.finalcta.title"]}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-mid">
          {content["homepage.finalcta.subtitle"]}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/gratis-check"
            className="inline-flex items-center justify-center rounded-lg bg-coral px-5 py-3 text-[15px] font-semibold text-white hover:bg-coral-hover"
          >
            {content["homepage.finalcta.cta_primary_label"]}
          </Link>
          <Link
            href="/prijzen"
            className="inline-flex items-center justify-center px-2 py-3 text-[15px] font-semibold text-ink-high underline-offset-4 hover:underline"
          >
            {content["homepage.finalcta.cta_secondary_label"]}
          </Link>
        </div>
        <p className="mt-6 text-xs text-ink-mut">
          {content["homepage.finalcta.micro_copy"]}
        </p>
      </div>
    </section>
  );
}
