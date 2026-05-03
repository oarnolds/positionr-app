export function FactGrid({
  title,
  facts,
}: {
  title: string;
  facts: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {f.label}
            </dt>
            <dd className="text-sm text-gray-900">{f.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
