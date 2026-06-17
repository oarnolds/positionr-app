import { parseReport } from "./parseReport";
import { CoverBanner } from "./CoverBanner";
import { StrengthsImprovements } from "./StrengthsImprovements";
import { ReportBody } from "./ReportBody";
import { ReportShell } from "./ReportShell";

export function WebsiteCheckReport({ markdown }: { markdown: string }) {
  const blocks = parseReport(markdown);

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
