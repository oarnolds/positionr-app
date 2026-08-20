/**
 * Statische mockup van een Website Check-rapport voor de hero-illustratie.
 * Inline SVG-achtig markup — later te vervangen door echte screenshot-render.
 */
export function MockupReport() {
  return (
    <div className="overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-2xl shadow-black/10">
      {/* Traffic-light dots */}
      <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-cream/60 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 rounded bg-black/[0.05] px-2 py-0.5 font-mono text-[10px] text-ink-mut">
          positionr.nl/rapport/voorbeeld-bv
        </span>
      </div>
      {/* Content */}
      <div className="space-y-3 p-5">
        {/* Score-banner */}
        <div className="flex items-center gap-4 rounded-lg bg-primary/10 p-4">
          <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full border-4 border-primary text-primary">
            <div className="text-lg font-extrabold leading-none">8.2</div>
            <div className="text-[8px] opacity-70">/ 10</div>
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg font-bold text-ink-high">
              Voorbeeld B.V.
            </div>
            <div className="truncate text-xs text-ink-mut">voorbeeldbv.nl</div>
          </div>
        </div>
        {/* Onderdelen-card */}
        <div className="rounded-lg border border-black/[0.06] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-ink-high">
              Score per onderdeel
            </div>
            <span className="rounded bg-mint/20 px-1.5 py-0.5 text-[10px] font-bold text-mint">
              7.4 GEM.
            </span>
          </div>
          {(
            [
              { label: "Eerste indruk", pct: 75, score: 7.5 },
              { label: "Propositie", pct: 58, score: 5.8 },
              { label: "Call to actions", pct: 62, score: 6.2 },
            ] as const
          ).map((row) => (
            <div key={row.label} className="mt-2 flex items-center gap-3">
              <div className="w-32 text-xs text-ink-mid">{row.label}</div>
              <div className="h-1.5 flex-1 rounded-full bg-black/[0.05]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${row.pct}%` }}
                />
              </div>
              <div className="w-8 text-right text-xs font-semibold text-ink-high">
                {row.score}
              </div>
            </div>
          ))}
        </div>
        {/* Fade-out onderin */}
        <div className="-mb-5 h-8 bg-gradient-to-t from-white to-transparent" />
      </div>
    </div>
  );
}
