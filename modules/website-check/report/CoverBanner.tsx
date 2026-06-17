import { marked } from "marked";
import { ScoreCard } from "./ScoreCard";

export function CoverBanner({
  raw,
  score,
}: {
  raw: string;
  score: string | null;
}) {
  const html = marked.parse(raw, { async: false }) as string;
  return (
    <header className="border-b border-slate-200 bg-gradient-to-b from-purple-50 to-white px-10 pb-6 pt-8">
      <div className="flex items-start justify-between gap-6">
        <div
          className="prose prose-slate max-w-none flex-1 prose-p:my-1 prose-p:text-base prose-strong:text-slate-900 prose-em:text-slate-500"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {score && <ScoreCard score={score} />}
      </div>
    </header>
  );
}
