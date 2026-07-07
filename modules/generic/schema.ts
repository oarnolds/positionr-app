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
  /** Bibliotheek-snapshot dat als bron dient (website, PDF of Word). */
  snapshotId: z.string().uuid("Kies een markdown-bron uit je bibliotheek"),
  companyName: z.string().trim().min(1, "Bedrijfsnaam is verplicht"),
  sector: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
  /** Eén concurrent (naam of URL) per regel. */
  competitors: z.string().trim().optional().default(""),
});
export type GenericInput = z.infer<typeof GenericInputSchema>;

/** Per-module opties voor de generieke runner. */
export type GenericModuleConfig = {
  /**
   * Wanneer true toont het startformulier naast de bibliotheek-select ook
   * "specifieke URL" (single-page scrape) en "PDF/Word-upload" als bron.
   * Beide worden eerst een bibliotheek-snapshot, daarna draait de analyse
   * gewoon op dat snapshot.
   */
  extraSources?: boolean;
};

/**
 * Welke module-slugs op de generieke runner draaien. Een slug activeren =
 * hier toevoegen + registry op "active" met href `/modules/<slug>`.
 * (website-check-concurrenten heeft een eigen twee-fasen-flow in
 * modules/concurrenten + app/(app)/modules/website-check-concurrenten.)
 */
export const GENERIC_MODULES: Record<string, GenericModuleConfig> = {
  "propositie-analyse": {},
  "klantcase-analyse": { extraSources: true },
};

export function isGenericModule(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(GENERIC_MODULES, slug);
}

export function moduleAllowsExtraSources(slug: string): boolean {
  return GENERIC_MODULES[slug]?.extraSources === true;
}

// ── Bronkeuze op het startformulier ──────────────────────────────────────

export const SOURCE_TYPES = ["library", "url", "file"] as const;
export type GenericSourceType = (typeof SOURCE_TYPES)[number];

/** Onbekende of ontbrekende waarden vallen terug op de bibliotheek-select. */
export function parseSourceType(raw: unknown): GenericSourceType {
  const value = String(raw ?? "");
  return (SOURCE_TYPES as readonly string[]).includes(value)
    ? (value as GenericSourceType)
    : "library";
}
