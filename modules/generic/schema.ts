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

// ── Bronkeuze op het startformulier ──────────────────────────────────────

export const SOURCE_TYPES = ["library", "url", "file"] as const;
export type GenericSourceType = (typeof SOURCE_TYPES)[number];

/** Per-module opties voor de generieke runner. */
export type GenericModuleConfig = {
  /**
   * Toegestane bronnen op het startformulier. URL- en file-bronnen worden
   * eerst een bibliotheek-snapshot, daarna draait de analyse gewoon op dat
   * snapshot. Default (undefined): alleen de bibliotheek-select.
   */
  sourceTypes?: GenericSourceType[];
  /** Label boven het URL-veld (default "Specifieke URL"). */
  urlLabel?: string;
  /** Placeholder in het URL-veld. */
  urlPlaceholder?: string;
  /** Wanneer gezet: de opgegeven URL moet hierop matchen. */
  urlPattern?: RegExp;
  /** Foutmelding wanneer urlPattern niet matcht. */
  urlPatternError?: string;
  /** Extra, module-specifieke hint boven het upload-veld. */
  fileHint?: string;
  /** Label van het sector-veld (default "Sector"). */
  sectorLabel?: string;
  /** Placeholder van het sector-veld (default "bijv. IT-dienstverlening"). */
  sectorPlaceholder?: string;
};

/**
 * Welke module-slugs op de generieke runner draaien. Een slug activeren =
 * hier toevoegen + registry op "active" met href `/modules/<slug>`.
 * (website-check-concurrenten heeft een eigen twee-fasen-flow in
 * modules/concurrenten + app/(app)/modules/website-check-concurrenten.)
 */
export const GENERIC_MODULES: Record<string, GenericModuleConfig> = {
  "propositie-analyse": {},
  "klantcase-analyse": { sourceTypes: ["library", "url", "file"] },
  // Flyercheck draait op een geüploade flyer/salespresentatie (PDF/Word).
  flyercheck: { sourceTypes: ["library", "url", "file"] },
  // LinkedIn-analyse: óf de bedrijfspagina-URL (LinkedIn serveert crawlers een
  // publieke gastversie met bedrijfsinfo + recente posts, dus de single-page-
  // scrape werkt), óf een geüploade Analytics-export (volgers per branche +
  // impressies — de enige bron voor gemeten bereik binnen een doelgroep).
  "linkedin-analyse": {
    sourceTypes: ["url", "file"],
    urlLabel: "LinkedIn-bedrijfspagina (openbare pagina, niet je admin-weergave)",
    urlPlaceholder: "bijv. https://www.linkedin.com/company/jouw-bedrijf",
    urlPattern: /linkedin\.com\/company\/[^/?#]+/i,
    urlPatternError:
      "Vul de URL van een LinkedIn-bedrijfspagina in (linkedin.com/company/<naam>)",
    fileHint:
      "Upload je LinkedIn Analytics-export (.xlsx) — in LinkedIn: bedrijfspagina → Analytics → Volgers of Content → knop Exporteren. Vul hieronder bij Doelgroep je focus in (bijv. maak- & procesindustrie) voor een bereik-analyse binnen die groep.",
    sectorLabel: "Doelgroep of sector",
    sectorPlaceholder: "bijv. maak- & procesindustrie",
  },
  // Markttrends draait op het website-snapshot + sector; provider perplexity
  // haalt de actuele trends van het web.
  "markttrends-rapport": {},
};

export function isGenericModule(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(GENERIC_MODULES, slug);
}

/** Toegestane bronnen voor een module; default alleen de bibliotheek. */
export function moduleSourceTypes(slug: string): GenericSourceType[] {
  return GENERIC_MODULES[slug]?.sourceTypes ?? ["library"];
}

/** Onbekende of ontbrekende waarden vallen terug op de bibliotheek-select. */
export function parseSourceType(raw: unknown): GenericSourceType {
  const value = String(raw ?? "");
  return (SOURCE_TYPES as readonly string[]).includes(value)
    ? (value as GenericSourceType)
    : "library";
}
