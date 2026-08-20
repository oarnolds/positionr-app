import { Clock, Coins, Hand } from "lucide-react";

const COLS = [
  {
    Icon: Clock,
    title: "Tijd",
    left: "Bureau: dagen tot weken.",
    right: "Positionr: minuten.",
  },
  {
    Icon: Coins,
    title: "Prijs",
    left: "Bureau: € 5.000 – € 30.000+.",
    right: "Positionr: één jaarbedrag.",
  },
  {
    Icon: Hand,
    title: "Controle",
    left: "Bureau: extern advies.",
    right: "Positionr: in eigen handen.",
  },
] as const;

export function AgencyComparison() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-10">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Wat het verschil maakt.
        </div>
        <h3 className="mt-3 font-display text-2xl font-bold text-ink-high md:text-3xl">
          Bureau of Positionr — dit weegt anders.
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {COLS.map((c) => (
          <div key={c.title}>
            <c.Icon className="h-8 w-8 text-primary" strokeWidth={1.5} />
            <h4 className="mt-4 font-display text-xl font-bold text-ink-high">
              {c.title}
            </h4>
            <p className="mt-2 text-sm text-ink-mid">{c.left}</p>
            <p className="mt-1 text-sm font-medium text-ink-high">{c.right}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
