export function ScoreCard({ score }: { score: string }) {
  return (
    <div className="flex-shrink-0 rounded-md border border-purple-200 bg-purple-100 px-5 py-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-700">
        Totaalscore
      </div>
      <div className="mt-1 text-3xl font-medium leading-none text-purple-900">
        {score}
      </div>
      <div className="mt-0.5 text-[10px] text-purple-700">/ 10</div>
    </div>
  );
}
