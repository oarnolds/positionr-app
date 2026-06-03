/**
 * Monochrome rij van bedrijfsnamen als sociale bewijsvoering onder de hero.
 * De namen die hier staan zijn (nog) géén klanten — zie commit-historie. Ze
 * functioneren als plaatshouder tot we echte logo's hebben.
 */

const companies = ["Datapas", "Biqql", "Solitee"];

export function TrustBand() {
  return (
    <section className="border-y border-slate-100 bg-slate-50/60 py-8">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-slate-500">
          Gebruikt door teams van
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-lg font-semibold text-slate-400">
          {companies.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
