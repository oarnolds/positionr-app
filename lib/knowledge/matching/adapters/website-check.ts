import { parseReport } from "@/modules/website-check/report/parseReport";
import type { MatchableSection } from "../types";

export function websiteCheckSections(markdown: string): MatchableSection[] {
  const { onderdelen } = parseReport(markdown);
  return onderdelen.map((o) => ({
    key: o.slug,
    titel: o.titel,
    tekst: [o.watWeZien, o.waaromDitTelt, o.watJeKuntDoen.join(" ")]
      .filter((x) => x && x.trim())
      .join("\n"),
  }));
}
