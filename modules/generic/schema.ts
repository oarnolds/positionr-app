// Generiek rapport-contract voor prompt-gedreven modules.
//
// De admin-prompt + layout-instructie bepalen de INHOUD en OPBOUW
// (welke secties, titels, volgorde); dit schema dwingt de VORM af zodat
// GenericReportView elk rapport in de ICP-designtaal kan renderen.
// `.catch()` op stijlvelden: format-drift van de LLM (onbekend accent,
// rare layout-waarde) degradeert naar een default in plaats van een failure.

import { z } from "zod";

export const REPORT_ACCENT_VALUES = [
  "purple",
  "blue",
  "amber",
  "green",
  "red",
  "indigo",
  "teal",
] as const;

export const ReportSectie = z.object({
  titel: z.string().default(""),
  /** Korte uppercase-kop in plaats van titel (zoals "WAAROM KIEZEN KLANTEN VOOR ONS?"). */
  eyebrow: z.string().optional(),
  accent: z.enum(REPORT_ACCENT_VALUES).catch("blue"),
  /** "half" = twee-koloms grid op desktop; "volledig" = volle breedte. */
  layout: z.enum(["volledig", "half"]).catch("volledig"),
  /** Vrije markdown-inhoud binnen de kaart. */
  inhoud: z.string().catch(""),
  /** Label/waarde-rijen (zoals het firmografisch profiel in ICP). */
  feiten: z
    .array(z.object({ label: z.string(), waarde: z.string() }))
    .optional(),
  /** Korte tags als pills (zoals trigger-events in ICP). */
  chips: z.array(z.string()).optional(),
});
export type ReportSectie = z.infer<typeof ReportSectie>;

export const GenericReport = z.object({
  heroTekst: z.string().default(""),
  secties: z.array(ReportSectie).min(1),
  volgendeStappen: z.array(z.string()).optional(),
});
export type GenericReport = z.infer<typeof GenericReport>;

// ── Sessie-output envelope ───────────────────────────────────────────────
// sessions.output bevat JSON: {kind:"report"} bij geldig contract,
// {kind:"markdown"} als vangnet wanneer de LLM geen geldige JSON leverde.

export type GenericOutput =
  | { kind: "report"; report: GenericReport }
  | { kind: "markdown"; markdown: string };

export function parseGenericOutput(raw: string | null): GenericOutput | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GenericOutput;
    if (parsed.kind === "report") {
      return { kind: "report", report: GenericReport.parse(parsed.report) };
    }
    if (parsed.kind === "markdown" && typeof parsed.markdown === "string") {
      return parsed;
    }
    return null;
  } catch {
    // Oudere of handmatig gezette output: toon als markdown.
    return { kind: "markdown", markdown: raw };
  }
}

// ── Module-invoer ────────────────────────────────────────────────────────

export const GenericInputSchema = z.object({
  websiteUrl: z.string().trim().min(3, "URL is verplicht"),
  companyName: z.string().trim().min(1, "Bedrijfsnaam is verplicht"),
  sector: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
  /** Eén concurrent (naam of URL) per regel. */
  competitors: z.string().trim().optional().default(""),
  analysisMode: z.enum(["scrape", "markdown"]).default("scrape"),
});
export type GenericInput = z.infer<typeof GenericInputSchema>;

/**
 * Welke module-slugs op de generieke runner draaien, plus per-slug
 * invoer-opties. Een slug activeren = hier toevoegen + registry op
 * "active" met href `/modules/<slug>`.
 */
export const GENERIC_MODULES: Record<string, { needsCompetitors: boolean }> = {
  "propositie-analyse": { needsCompetitors: false },
  "klantcase-analyse": { needsCompetitors: false },
  "website-check-concurrenten": { needsCompetitors: true },
};

export function isGenericModule(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(GENERIC_MODULES, slug);
}
