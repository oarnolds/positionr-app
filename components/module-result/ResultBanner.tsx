export function ResultBanner({
  bedrijfsnaam,
  product,
  samenvatting,
  sectorPositie,
  scoreLabel,
  score,
  gradient = "from-cyan-500 to-cyan-700",
}: {
  bedrijfsnaam: string;
  product: string;
  samenvatting: string;
  sectorPositie: string;
  scoreLabel: string;
  score: number;
  gradient?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-gradient-to-r ${gradient} p-6 text-white shadow-md`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide opacity-80">
            {bedrijfsnaam}
          </p>
          <h2 className="text-2xl font-bold">{product}</h2>
          <p className="mt-2 text-sm opacity-90">{samenvatting}</p>
          <span className="mt-3 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs">
            {sectorPositie}
          </span>
        </div>
        <div className="rounded-xl bg-white/20 px-4 py-3 text-center">
          <div className="text-3xl font-bold">{score}</div>
          <div className="text-xs opacity-80">{scoreLabel}</div>
        </div>
      </div>
    </div>
  );
}
