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

/**
 * Groepeer secties: opeenvolgende "half"-secties worden per twee in een
 * grid geplaatst; een oneven rest of "volledig"-sectie krijgt volle breedte.
 */
function groupSections(secties: ReportSectie[]): ReportSectie[][] {
  const groups: ReportSectie[][] = [];
  let i = 0;
  while (i < secties.length) {
    const current = secties[i];
    const next = secties[i + 1];
    if (current.layout === "half" && next?.layout === "half") {
      groups.push([current, next]);
      i += 2;
    } else {
      groups.push([current]);
      i += 1;
    }
  }
  return groups;
}

export function GenericReportView({
  moduleName,
  report,
}: {
  moduleName: string;
  report: GenericReport;
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

      {groupSections(report.secties).map((group, gi) =>
        group.length === 2 ? (
          <div key={gi} className="grid gap-5 md:grid-cols-2">
            <SectieCard sectie={group[0]} />
            <SectieCard sectie={group[1]} />
          </div>
        ) : (
          <SectieCard key={gi} sectie={group[0]} />
        ),
      )}

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
