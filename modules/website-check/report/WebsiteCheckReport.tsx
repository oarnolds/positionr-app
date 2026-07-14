import { parseReport } from "./parseReport";
import { CoverBanner } from "./CoverBanner";
import { StrengthsImprovements } from "./StrengthsImprovements";
import { ReportBody } from "./ReportBody";
import { ReportShell } from "./ReportShell";
import { ScoreRing } from "./ScoreRing";
import { ScoresOverview } from "./ScoresOverview";
import { OnderdeelCard } from "./OnderdeelCard";
import { ActiesCard } from "./ActiesCard";

export function WebsiteCheckReport({ markdown }: { markdown: string }) {
  const blocks = parseReport(markdown);

  // Fallback: geen parsebare onderdelen (oude sessie of format-drift) →
  // de bestaande document-render.
  if (blocks.onderdelen.length === 0) {
    return (
      <ReportShell>
        {blocks.cover && (
          <CoverBanner raw={blocks.cover.raw} score={blocks.cover.score} />
        )}
        {blocks.strengths && blocks.improvements && (
          <StrengthsImprovements
            strengths={blocks.strengths}
            improvements={blocks.improvements}
          />
        )}
        <ReportBody markdown={blocks.bodyMarkdown} />
      </ReportShell>
    );
  }

  const scoreNum = blocks.cover?.score
    ? Number(blocks.cover.score.replace(",", "."))
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 p-6 text-white shadow-md">
        <ScoreRing score={scoreNum} />
        <div>
          <h1 className="text-lg font-extrabold">Website-analyse</h1>
          {blocks.samenvatting && (
            <p className="mt-1 text-sm leading-relaxed opacity-90">
              {blocks.samenvatting}
            </p>
          )}
        </div>
      </div>

      {blocks.strengths && blocks.improvements && (
        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/60 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              Sterke punten
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-950">
              {blocks.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border-l-4 border-amber-500 bg-amber-50/60 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Grootste verbeterpunten
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-950">
              {blocks.improvements.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <ScoresOverview onderdelen={blocks.onderdelen} />

      {blocks.onderdelen.map((o) => (
        <OnderdeelCard key={o.slug} onderdeel={o} />
      ))}

      {blocks.acties.length > 0 && <ActiesCard acties={blocks.acties} />}
    </div>
  );
}
