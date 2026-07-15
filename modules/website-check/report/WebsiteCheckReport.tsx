import { parseReport } from "./parseReport";
import { CoverBanner } from "./CoverBanner";
import { StrengthsImprovements } from "./StrengthsImprovements";
import { ReportBody } from "./ReportBody";
import { ReportShell } from "./ReportShell";
import { ScoreRing } from "./ScoreRing";
import { ScoresOverview } from "./ScoresOverview";
import { OnderdeelCard } from "./OnderdeelCard";
import { ActiesCard } from "./ActiesCard";
import type { KnowledgeBlock } from "@/lib/knowledge/matching/types";
import { SectionPair } from "@/lib/modules/SectionPair";

export function WebsiteCheckReport({
  markdown,
  blocks = [],
}: {
  markdown: string;
  blocks?: KnowledgeBlock[];
}) {
  const parsed = parseReport(markdown);

  // Fallback: geen parsebare onderdelen (oude sessie of format-drift) →
  // de bestaande document-render.
  if (parsed.onderdelen.length === 0) {
    return (
      <ReportShell>
        {parsed.cover && (
          <CoverBanner raw={parsed.cover.raw} score={parsed.cover.score} />
        )}
        {parsed.strengths && parsed.improvements && (
          <StrengthsImprovements
            strengths={parsed.strengths}
            improvements={parsed.improvements}
          />
        )}
        <ReportBody markdown={parsed.bodyMarkdown} />
      </ReportShell>
    );
  }

  // In code herberekende totaalscore (gemiddelde van de onderdeelscores) heeft
  // voorrang op het getal dat het LLM in de cover schreef. Terugval op de
  // cover-score voor oude sessies zonder parsebare onderdelen.
  const scoreNum =
    parsed.totaalScore ??
    (parsed.cover?.score ? Number(parsed.cover.score.replace(",", ".")) : null);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 p-6 text-white shadow-md">
        <ScoreRing score={scoreNum} />
        <div>
          <h1 className="text-lg font-extrabold">Website-analyse</h1>
          {parsed.samenvatting && (
            <p className="mt-1 text-sm leading-relaxed opacity-90">
              {parsed.samenvatting}
            </p>
          )}
        </div>
      </div>

      {parsed.strengths && parsed.improvements && (
        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/60 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              Sterke punten
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-950">
              {parsed.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border-l-4 border-amber-500 bg-amber-50/60 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Grootste verbeterpunten
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-950">
              {parsed.improvements.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <ScoresOverview onderdelen={parsed.onderdelen} />

      {(() => {
        const blockByKey = new Map(blocks.map((b) => [b.sectionKey, b]));
        return parsed.onderdelen.map((o) => {
          const block = blockByKey.get(o.slug);
          return block ? (
            <SectionPair key={o.slug} block={block}>
              <OnderdeelCard onderdeel={o} />
            </SectionPair>
          ) : (
            <OnderdeelCard key={o.slug} onderdeel={o} />
          );
        });
      })()}

      {parsed.acties.length > 0 && <ActiesCard acties={parsed.acties} />}
    </div>
  );
}
