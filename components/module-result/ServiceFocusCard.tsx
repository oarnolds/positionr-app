export function ServiceFocusCard({
  kernBelofte,
  prijsindicatie,
  onderscheidend,
}: {
  kernBelofte: string;
  prijsindicatie: string;
  onderscheidend: string;
}) {
  return (
    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
      <h3 className="text-sm font-semibold text-cyan-900">Dienst-focus</h3>
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-cyan-700">
            Kernbelofte
          </div>
          <p className="text-gray-900">{kernBelofte}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-cyan-700">
            Prijsindicatie
          </div>
          <p className="text-gray-900">{prijsindicatie}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-cyan-700">
            Onderscheidend
          </div>
          <p className="text-gray-900">{onderscheidend}</p>
        </div>
      </div>
    </div>
  );
}
