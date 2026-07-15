import type { GenericOutput } from "@/modules/generic/schema";
import type { MatchableSection } from "../types";

export function genericSections(output: GenericOutput): MatchableSection[] {
  if (output.kind !== "report") return [];
  return output.report.secties.map((s, i) => {
    const feiten = (s.feiten ?? [])
      .map((f) => `${f.label}: ${f.waarde}`)
      .join("; ");
    const chips = (s.chips ?? []).join(", ");
    const tekst = [s.inhoud, feiten, chips].filter((x) => x && x.trim()).join("\n");
    return {
      key: `sectie-${i}`,
      titel: s.eyebrow || s.titel || `Sectie ${i + 1}`,
      tekst,
    };
  });
}
