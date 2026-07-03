// Concurrentie-analyse in twee fases:
//   Fase 1 (discovery): Claude + web search vindt kandidaat-concurrenten
//     obv producten/diensten uit het snapshot + geografische focus.
//     → sessie-status "review", gebruiker vinkt kandidaten aan.
//   Fase 2 (diepe analyse): bevestigde concurrenten → vergelijkend
//     GenericReport in de ICP-designtaal.

import { z } from "zod";
import {
  GenericReport,
  type GenericOutput as GenericFinalOutput,
} from "@/modules/generic/schema";

export const MODULE_SLUG = "website-check-concurrenten";
export const DISCOVERY_SLUG = "website-check-concurrenten-discovery";

// ── Fase 1: discovery-output ────────────────────────────────────────────

export const CompetitorCandidate = z.object({
  naam: z.string(),
  /** Website of LinkedIn-URL; leeg als onbekend. */
  websiteUrl: z.string().catch(""),
  /** Waarom de AI dit bedrijf als concurrent ziet. */
  reden: z.string().catch(""),
  /** Marktsegment waarin dit bedrijf concurreert (bv. "E-facturering"). */
  segment: z.string().catch("Algemeen"),
});
export type CompetitorCandidate = z.infer<typeof CompetitorCandidate>;

export const DiscoveryReport = z.object({
  /** 2-3 zinnen: in welke segmenten opereert het bedrijf en hoe is gezocht. */
  samenvatting: z.string().catch(""),
  kandidaten: z.array(CompetitorCandidate).min(1),
});
export type DiscoveryReport = z.infer<typeof DiscoveryReport>;

// ── Sessie-invoer ───────────────────────────────────────────────────────

export const ConcurrentenInputSchema = z.object({
  snapshotId: z.string().uuid("Kies een markdown-bron uit je bibliotheek"),
  companyName: z.string().trim().min(1, "Bedrijfsnaam is verplicht"),
  /** Geografische focus, bv. "Nederland" of "Benelux". */
  geografie: z.string().trim().min(1, "Geografische focus is verplicht"),
  sector: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
});
export type ConcurrentenInput = z.infer<typeof ConcurrentenInputSchema>;

/** Door de gebruiker bevestigde concurrent (aangevinkt of handmatig). */
export const ConfirmedCompetitor = z.object({
  naam: z.string().trim().min(1),
  websiteUrl: z.string().trim().catch(""),
});
export type ConfirmedCompetitor = z.infer<typeof ConfirmedCompetitor>;

/** Sessie-input ná bevestiging (fase 2 gestart). */
export type ConcurrentenSessionInput = ConcurrentenInput & {
  confirmed?: ConfirmedCompetitor[];
  /**
   * ISO-timestamp waarop fase 2 startte. De stuck-detectie op de
   * sessie-pagina meet hiermee per fase — de review-tijd van de gebruiker
   * telt anders mee in de timeout en fase 2 wordt dan onterecht afgebroken.
   */
  phase2StartedAt?: string;
};

// ── Sessie-output envelope ──────────────────────────────────────────────
// status "review"  → {kind:"discovery"}
// status "approved" → generieke report/markdown-envelope (GenericReportView)

export type ConcurrentenOutput =
  | { kind: "discovery"; discovery: DiscoveryReport }
  | GenericFinalOutput;

export function parseConcurrentenOutput(
  raw: string | null,
): ConcurrentenOutput | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConcurrentenOutput;
    if (parsed.kind === "discovery") {
      return {
        kind: "discovery",
        discovery: DiscoveryReport.parse(parsed.discovery),
      };
    }
    if (parsed.kind === "report") {
      return { kind: "report", report: GenericReport.parse(parsed.report) };
    }
    if (parsed.kind === "markdown" && typeof parsed.markdown === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
