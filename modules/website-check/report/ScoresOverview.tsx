import type { Onderdeel } from "./parseReport";
import { scoreBand } from "@/lib/modules/score";

const BAR: Record<string, string> = {
  rood: "bg-rose-600",
  amber: "bg-amber-600",
  groen: "bg-green-600",
};
const TXT: Record<string, string> = {
  rood: "text-rose-700",
  amber: "text-amber-700",
  groen: "text-green-700",
};

export function ScoresOverview({ onderdelen }: { onderdelen: Onderdeel[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        📊 Scores in één oogopslag
      </p>
      <div className="space-y-2">
        {onderdelen.map((o) => {
          const band = o.score != null ? scoreBand(o.score) : "amber";
          const pct = o.score != null ? Math.round((o.score / 10) * 100) : 0;
          return (
            <div
              key={o.slug}
              className="grid grid-cols-[minmax(0,150px)_1fr_2.5rem] items-center gap-3 text-sm"
            >
              <span className="truncate text-gray-700">
                {o.nr}. {o.titel}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-gray-100">
                <span
                  className={`block h-full rounded-full ${BAR[band]}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span
                className={`text-right font-bold tabular-nums ${
                  o.score != null ? TXT[band] : "text-gray-400"
                }`}
              >
                {o.score != null ? o.score.toString().replace(".", ",") : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
