import { Clock, Coins, Hand, type LucideIcon } from "lucide-react";

import type { AgencyKey } from "./keys";

const COLS: ReadonlyArray<{
  Icon: LucideIcon;
  titleLabel: "Tijd" | "Prijs" | "Controle";
  leftKey: AgencyKey;
  rightKey: AgencyKey;
}> = [
  {
    Icon: Clock,
    titleLabel: "Tijd",
    leftKey: "homepage.agency.tijd.left",
    rightKey: "homepage.agency.tijd.right",
  },
  {
    Icon: Coins,
    titleLabel: "Prijs",
    leftKey: "homepage.agency.prijs.left",
    rightKey: "homepage.agency.prijs.right",
  },
  {
    Icon: Hand,
    titleLabel: "Controle",
    leftKey: "homepage.agency.controle.left",
    rightKey: "homepage.agency.controle.right",
  },
];

export function AgencyComparison({
  content,
}: {
  content: Record<AgencyKey, string>;
}) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-10">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {content["homepage.agency.eyebrow"]}
        </div>
        <h3 className="mt-3 font-display text-2xl font-bold text-ink-high md:text-3xl">
          {content["homepage.agency.title"]}
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {COLS.map((c) => (
          <div key={c.titleLabel}>
            <c.Icon className="h-8 w-8 text-primary" strokeWidth={1.5} />
            <h4 className="mt-4 font-display text-xl font-bold text-ink-high">
              {c.titleLabel}
            </h4>
            <p className="mt-2 text-sm text-ink-mid">{content[c.leftKey]}</p>
            <p className="mt-1 text-sm font-medium text-ink-high">
              {content[c.rightKey]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
