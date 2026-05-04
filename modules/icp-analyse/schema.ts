import { z } from "zod";

// ── Prominentie ──────────────────────────────────────────────────────────────

export const Prominentie = z.enum(["hoog", "middel", "laag"]);
export type Prominentie = z.infer<typeof Prominentie>;

// ── Scanned products (LLM scan-website output) ───────────────────────────────

export const ScannedProduct = z.object({
  naam: z.string(),
  beschrijving: z.string(),
  prominentie: Prominentie,
});
export type ScannedProduct = z.infer<typeof ScannedProduct>;

export const ScannedProducts = z.object({
  producten: z.array(ScannedProduct),
});

// ── Phase 1 output (initiële website-analyse) ────────────────────────────────

export const Phase1Output = z.object({
  diensten: z.array(
    z.object({
      naam: z.string(),
      prominentie: Prominentie,
      beschrijving: z.string(),
    })
  ),
  primaire_doelgroep: z.object({
    sector: z.string(),
    subsector: z.string(),
    bedrijfsgrootte: z.string(),
    functietitels: z.array(z.string()),
    geografische_focus: z.string(),
  }),
  pijnpunten: z.array(z.string()),
  usp: z.string(),
  klantvoorbeelden: z.array(z.string()),
  trigger_events: z.array(z.string()),
  tone_of_voice: z.string(),
  betrouwbaarheid_score: z.number().min(0).max(100),
  ontbrekende_informatie: z.array(z.string()),
  icp_inschatting: z.object({
    industrieen: z.array(z.string()),
    bedrijfsgrootte: z.array(z.string()),
    kernprocessen: z.array(z.string()),
    dmu: z.array(
      z.object({
        rol: z.string(),
        invloed: z.enum(["beslisser", "beïnvloeder", "gebruiker"]),
      })
    ),
    samenvatting: z.string(),
  }),
});
export type Phase1Output = z.infer<typeof Phase1Output>;

// ── Webform answers (Phase 2) ────────────────────────────────────────────────

export const WebformAnswers = z.object({
  sectoren: z.array(
    z.object({ hoofdsector: z.string(), subsector: z.string() })
  ),
  bedrijfsgrootte: z.array(z.string()),
  contactfunctie: z.string(),
  beslisser: z.string(),
  zelfdePersoon: z.boolean(),
  pijnpunt: z.string(),
  triggers: z.array(z.string()),
  strategischeDienst: z.string(),
  contractwaarde: z.string(),
  idealeKenmerken: z.array(z.string()),
  dealbreakers: z.array(z.string()),
  vindkanalen: z.array(
    z.object({ kanaal: z.string(), prioriteit: z.number() })
  ),
  usp: z.string(),
  eigenBeschrijving: z.string().optional().default(""),
});
export type WebformAnswers = z.infer<typeof WebformAnswers>;

// ── Final ICP (Phase 3 — definitief profiel) ─────────────────────────────────

export const FinalIcp = z.object({
  heroTekst: z.string(),
  firmografisch: z.object({
    sector: z.string(),
    subsector: z.string(),
    bedrijfsgrootte: z.array(z.string()),
    contactfunctie: z.string(),
    beslisser: z.string(),
    contractwaarde: z.string(),
    vindkanalen: z.array(z.string()),
  }),
  pijnpuntenTriggers: z.object({
    pijnpunt: z.string(),
    triggers: z.array(z.string()),
  }),
  usp: z.string(),
  dienstFocus: z.object({
    dienst: z.string(),
    contractwaarde: z.string(),
    icpMatch: z.string(),
  }),
  negatieveIcp: z.object({
    dealbreakers: z.array(z.string()),
    disqualificatievraag: z.string(),
  }),
  marketingVertaalslag: z.object({
    kanalen: z.array(
      z.object({
        kanaal: z.string(),
        prioriteit: z.string(),
        reden: z.string(),
      })
    ),
    kernboodschap: z.object({
      bewustwording: z.string(),
      overweging: z.string(),
      beslissing: z.string(),
    }),
    contentAanbevelingen: z.object({
      artikel: z.string(),
      linkedin: z.string(),
      email: z.string(),
    }),
  }),
  volgendStappen: z.array(z.string()),
  positionering: z.enum(["verticaal", "horizontaal"]),
});
export type FinalIcp = z.infer<typeof FinalIcp>;

// ── Website snapshot (scrape result, ongewijzigd t.o.v. v1) ──────────────────

export type WebsiteSnapshot = {
  url: string;
  title: string;
  metaDescription: string;
  heroText: string;
  bodyExcerpt: string;
  scrapedAt: string;
};

// ── Cross-module fact entry (clients.facts.icp[]) ────────────────────────────

export type ICPFactEntry = {
  productId: string;
  productName: string;
  sessionId: string;
  finalIcp: FinalIcp;
  runAt: string;
  analysisMode: "snel" | "volledig";
};
