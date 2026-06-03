/**
 * Statische mockup van een Website-Check-resultaat voor de marketing-hero.
 * Geen echte data — alle waarden zijn hard-coded "demo"-waarden bedoeld om
 * te illustreren wat een bezoeker krijgt. Geen interactie, geen DB-calls.
 */
import { Check, TrendingUp } from "lucide-react";

const subScores = [
  { label: "Waardepropositie", score: 7.5, tone: "good" as const },
  { label: "Klantvoordelen", score: 6.0, tone: "meh" as const },
  { label: "Actieknoppen (CTA's)", score: 8.0, tone: "good" as const },
];

function ScoreBar({ score, tone }: { score: number; tone: "good" | "meh" }) {
  const pct = (score / 10) * 100;
  const color = tone === "good" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function HeroMockup() {
  return (
    <div className="relative">
      {/* Soft glow achter de mockup voor wat diepte */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 bg-gradient-to-tr from-purple-200/40 via-blue-200/30 to-transparent blur-3xl"
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Browser-frame top bar */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-xs text-slate-500">
            positionr.nl/gratis-check
          </div>
        </div>

        {/* Score-banner */}
        <div className="border-b border-slate-100 bg-gradient-to-br from-purple-600 to-blue-600 px-6 py-5 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-white/40 bg-white/10">
              <div className="text-xl font-bold leading-none">7.2</div>
              <div className="text-[9px] opacity-80">/ 10</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider opacity-80">
                Website Check
              </div>
              <div className="mt-0.5 text-base font-semibold">
                Sterke basis, drie quick wins
              </div>
            </div>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="space-y-3 px-6 py-5">
          {subScores.map((s) => (
            <div key={s.label}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-800">{s.label}</span>
                <span className="text-xs tabular-nums text-slate-500">
                  {s.score.toFixed(1)} / 10
                </span>
              </div>
              <ScoreBar score={s.score} tone={s.tone} />
            </div>
          ))}
        </div>

        {/* Top actie */}
        <div className="mx-6 mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Top actie
              </div>
              <div className="mt-0.5 text-sm text-slate-800">
                Maak je belofte concreet: vervang "wij helpen B2B-bedrijven
                groeien" door een resultaat met getal.
              </div>
            </div>
          </div>
        </div>

        {/* Voettekst */}
        <div className="flex items-center gap-1.5 border-t border-slate-100 bg-slate-50 px-6 py-2.5 text-xs text-slate-500">
          <Check className="h-3 w-3 text-emerald-600" />
          Analyse afgerond in 42 seconden
        </div>
      </div>
    </div>
  );
}
