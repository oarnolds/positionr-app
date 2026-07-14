import type { Actie } from "./parseReport";

const IMP: Record<string, string> = {
  hoog: "bg-rose-100 text-rose-700",
  middel: "bg-amber-100 text-amber-700",
  laag: "bg-gray-100 text-gray-600",
};

export function ActiesCard({ acties }: { acties: Actie[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        🎯 De belangrijkste acties
      </p>
      <div className="divide-y divide-gray-100">
        {acties.map((a, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 py-2.5 text-[13px]"
          >
            <span className="font-semibold text-gray-900">{a.titel}</span>
            {a.impact && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${IMP[a.impact]}`}
              >
                {a.impact}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
