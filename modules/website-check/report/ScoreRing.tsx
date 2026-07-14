export function ScoreRing({ score }: { score: number | null }) {
  const pct = score != null ? Math.max(0, Math.min(1, score / 10)) : 0;
  const deg = Math.round(pct * 360);
  return (
    <div
      className="flex h-[74px] w-[74px] flex-none items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(#fff ${deg}deg, rgba(255,255,255,.25) 0)`,
      }}
    >
      <div className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white">
        <span className="text-xl font-extrabold leading-none">
          {score != null ? score.toString().replace(".", ",") : "—"}
        </span>
        <span className="text-[9px] opacity-80">/10</span>
      </div>
    </div>
  );
}
