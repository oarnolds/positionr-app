import type { Onderdeel } from "./parseReport";
import { scoreBand } from "@/lib/modules/score";

const BADGE: Record<string, string> = {
  rood: "bg-rose-600",
  amber: "bg-amber-500",
  groen: "bg-green-600",
};

export function OnderdeelCard({ onderdeel }: { onderdeel: Onderdeel }) {
  const band = onderdeel.score != null ? scoreBand(onderdeel.score) : null;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`rounded-lg px-2.5 py-0.5 text-sm font-extrabold tabular-nums text-white ${
            band ? BADGE[band] : "bg-gray-400"
          }`}
        >
          {onderdeel.score != null
            ? onderdeel.score.toFixed(1).replace(".", ",")
            : "—"}
        </span>
        <h3 className="text-[15px] font-bold text-gray-900">
          {onderdeel.nr}. {onderdeel.titel}
        </h3>
      </div>
      {onderdeel.watWeZien && (
        <div className="mt-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Wat we zien
          </p>
          <p className="text-[13px] text-gray-800">{onderdeel.watWeZien}</p>
        </div>
      )}
      {onderdeel.waaromDitTelt && (
        <div className="mt-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Waarom dit telt
          </p>
          <p className="text-[13px] text-gray-800">{onderdeel.waaromDitTelt}</p>
        </div>
      )}
      {onderdeel.watJeKuntDoen.length > 0 && (
        <div className="mt-2.5 rounded-xl bg-blue-50/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Wat je kunt doen
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-gray-800">
            {onderdeel.watJeKuntDoen.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
