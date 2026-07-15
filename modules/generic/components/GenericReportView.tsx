// Rendert een GenericReport in de ICP-designtaal: gradient-hero bovenaan,
// accent-kaarten per sectie, "half"-secties paarsgewijs in een grid.

import {
  Star,
  Compass,
  Zap,
  TrendingUp,
  XCircle,
  Megaphone,
  AlertCircle,
} from "lucide-react";
import { Section, Fact, Chip } from "@/lib/modules/report-sections";
import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";
import type { GenericReport, ReportSectie } from "../schema";
import type { ReportAccent } from "@/lib/modules/report-sections";
import type { KnowledgeBlock } from "@/lib/knowledge/matching/types";
import { SectionPair } from "@/lib/modules/SectionPair";

// De LLM kiest accenten, geen iconen — iconen hangen deterministisch aan
// het accent zodat de stijl consistent blijft met FinalIcpView.
const ACCENT_ICONS: Record<ReportAccent, React.ReactNode> = {
  purple: <Star className="h-4 w-4" />,
  blue: <Compass className="h-4 w-4" />,
  amber: <Zap className="h-4 w-4" />,
  green: <TrendingUp className="h-4 w-4" />,
  red: <XCircle className="h-4 w-4" />,
  indigo: <Megaphone className="h-4 w-4" />,
  teal: <AlertCircle className="h-4 w-4" />,
};

function SectieCard({ sectie }: { sectie: ReportSectie }) {
  return (
    <Section
      accent={sectie.accent}
      icon={ACCENT_ICONS[sectie.accent]}
      title={sectie.eyebrow ? undefined : sectie.titel}
      eyebrow={sectie.eyebrow}
    >
      <div className="space-y-3">
        {sectie.feiten && sectie.feiten.length > 0 ? (
          <dl className="space-y-2 text-sm">
            {sectie.feiten.map((f, i) => (
              <Fact key={i} label={f.label} value={f.waarde} />
            ))}
          </dl>
        ) : null}
        {sectie.inhoud && sectie.inhoud.trim() ? (
          <MarkdownBlock markdown={sectie.inhoud} variant="bare" />
        ) : null}
        {sectie.chips && sectie.chips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {sectie.chips.map((c, i) => (
              <Chip key={i} accent={sectie.accent}>
                {c}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
    </Section>
  );
}

export function GenericReportView({
  moduleName,
  report,
  blocks = [],
}: {
  moduleName: string;
  report: GenericReport;
  blocks?: KnowledgeBlock[];
}) {
  return (
    <div className="space-y-5">
      {/* Hero-banner */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700 p-6 text-white shadow-md">
        <p className="text-xs uppercase tracking-wide opacity-80">
          {moduleName}
        </p>
        <p className="mt-1 text-base leading-relaxed">{report.heroTekst}</p>
      </div>

      {(() => {
        const blockByKey = new Map(blocks.map((b) => [b.sectionKey, b]));
        const rows: React.ReactNode[] = [];
        let i = 0;
        while (i < report.secties.length) {
          const key = `sectie-${i}`;
          const block = blockByKey.get(key);
          if (block) {
            rows.push(
              <SectionPair key={key} block={block}>
                <SectieCard sectie={report.secties[i]} />
              </SectionPair>,
            );
            i += 1;
            continue;
          }
          const cur = report.secties[i];
          const next = report.secties[i + 1];
          const nextMatched = blockByKey.has(`sectie-${i + 1}`);
          if (cur.layout === "half" && next?.layout === "half" && !nextMatched) {
            rows.push(
              <div key={key} className="grid gap-5 md:grid-cols-2">
                <SectieCard sectie={cur} />
                <SectieCard sectie={next} />
              </div>,
            );
            i += 2;
          } else {
            rows.push(<SectieCard key={key} sectie={cur} />);
            i += 1;
          }
        }
        return rows;
      })()}

      {report.volgendeStappen && report.volgendeStappen.length > 0 ? (
        <Section
          accent="teal"
          icon={ACCENT_ICONS.teal}
          title="Volgende stappen"
        >
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-800">
            {report.volgendeStappen.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Section>
      ) : null}
    </div>
  );
}
