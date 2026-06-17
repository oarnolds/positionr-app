export function StrengthsImprovements({
  strengths,
  improvements,
}: {
  strengths: string[];
  improvements: string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 px-10 py-6">
      <section className="rounded-r-md border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
          Sterke punten
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-emerald-950">
          {strengths.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="rounded-r-md border-l-4 border-amber-600 bg-amber-50 px-4 py-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
          Grootste verbeterpunten
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-amber-950">
          {improvements.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
