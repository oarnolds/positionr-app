// modules/website-check/components/WebsiteCheckResultView.tsx
import type { WebsiteCheckOutput } from "../schema";

function scoreColor(score: number): { bg: string; text: string; bar: string } {
  if (score >= 7.5) return { bg: "bg-emerald-100", text: "text-emerald-700", bar: "bg-emerald-500" };
  if (score >= 5) return { bg: "bg-amber-100", text: "text-amber-700", bar: "bg-amber-500" };
  return { bg: "bg-rose-100", text: "text-rose-700", bar: "bg-rose-500" };
}

function impactBadge(impact: "hoog" | "middel" | "laag") {
  const cls =
    impact === "hoog"
      ? "bg-purple-600 text-white"
      : impact === "middel"
      ? "bg-amber-500 text-white"
      : "bg-gray-300 text-gray-800";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${cls}`}>
      {impact}
    </span>
  );
}

export function WebsiteCheckResultView({
  data,
}: {
  data: WebsiteCheckOutput;
  readOnly?: boolean;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Hero */}
      <div className="flex items-center gap-5 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 p-6">
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-[7px] border-purple-600 text-purple-700">
          <div className="text-2xl font-extrabold leading-none">
            {data.overallScore.toFixed(1)}
          </div>
          <div className="text-[10px] text-purple-500">/ 10</div>
        </div>
        <div>
          <h1 className="text-2xl font-bold">{data.companyName}</h1>
          <p className="text-gray-600">{data.websiteUrl}</p>
          <p className="mt-2 text-gray-800">
            <strong>Samenvatting:</strong> {data.executiveSummary}
          </p>
        </div>
      </div>

      {/* Onderdelen */}
      <h2 className="mt-8 mb-3 text-lg font-bold">Onderdelen ({data.onderdelen.length})</h2>
      <div className="space-y-2">
        {data.onderdelen.map((o, i) => {
          const c = scoreColor(o.score);
          return (
            <div key={i} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <strong>
                  {i + 1}. {o.naam}
                </strong>
                <span className={`rounded-md px-2.5 py-0.5 text-sm font-extrabold ${c.bg} ${c.text}`}>
                  {o.score}/10
                </span>
              </div>
              <div className="my-2 h-1.5 w-full rounded bg-gray-200">
                <div
                  className={`h-1.5 rounded ${c.bar}`}
                  style={{ width: `${(o.score / 10) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-700">{o.toelichting}</p>
              {o.verbeterpunten.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm text-gray-600">
                  {o.verbeterpunten.map((vp, j) => (
                    <li key={j}>{vp}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Sterk / Verbeter */}
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="font-bold text-emerald-700">Top 3 sterke punten</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
            {data.sterkePunten.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-bold text-amber-700">Top 3 verbeterpunten</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
            {data.verbeterpunten.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      </div>

      {/* Acties */}
      <h2 className="mt-8 mb-3 text-lg font-bold">Top 5 prioriteitsacties</h2>
      <ol className="space-y-2">
        {data.topActies.map((a, i) => (
          <li key={i} className="rounded-xl border p-3">
            <div className="flex items-start gap-2">
              {impactBadge(a.impact)}
              <strong>{a.actie}</strong>
            </div>
            <p className="mt-1 text-sm text-gray-700">{a.toelichting}</p>
          </li>
        ))}
      </ol>

    </div>
  );
}
