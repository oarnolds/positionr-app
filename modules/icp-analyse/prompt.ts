/**
 * ICP-prompt-templates.
 *
 * Architectuur (na refactor):
 *  - FALLBACK_PROMPT_SCAN: hardcoded prompt voor de producten-scan-stap
 *    (niet admin-bewerkbaar — het is puur een interne extractie-stap).
 *  - FALLBACK_PROMPT_PARENT: gedeelde basis-prompt voor zowel Snelle als
 *    Volledige analyse. Admin-bewerkbaar via slug `icp-analyse`.
 *  - FALLBACK_PROMPT_PHASE1: extensie voor de Snelle-analyse-modus.
 *    Admin-bewerkbaar via slug `icp-analyse-phase1`.
 *  - FALLBACK_PROMPT_FINAL: extensie voor de Volledige-analyse-modus.
 *    Admin-bewerkbaar via slug `icp-analyse-final`.
 *
 * Runtime-formule:
 *  - SCAN: alleen FALLBACK_PROMPT_SCAN (hardcoded).
 *  - PHASE1 (Snel): parent + "\n\n" + phase1-sub → placeholders.
 *  - FINAL (Volledig): parent + "\n\n" + final-sub → placeholders.
 */
import type { Phase1Output, WebformAnswers } from "./schema";

// ── SCAN (hardcoded, niet admin-bewerkbaar) ─────────────────────────────────
// Placeholders: {websiteUrl}, {scrapedContent}

export const FALLBACK_PROMPT_SCAN = `Je bent een expert in B2B marketing. Extraheer alle producten en diensten van de website. Antwoord altijd in het Nederlands. Geef alleen geldige JSON terug.

Output-formaat (STRIKT):
{
  "producten": [
    { "naam": string, "beschrijving": string (max 100 woorden), "prominentie": "hoog" | "middel" | "laag" }
  ]
}

Prominentie bepaal je op basis van hoe prominent het op de website staat:
- "hoog" = expliciet als hoofdaanbod gepresenteerd, herhaaldelijk genoemd
- "middel" = duidelijk aanwezig, maar onderdeel van breder aanbod
- "laag" = zijdelings genoemd, niet de focus

Geef ALLEEN het JSON-object terug, geen toelichting.

Analyseer de volgende websitecontent en extraheer alle producten en diensten die dit bedrijf aanbiedt.

WEBSITECONTENT ({websiteUrl}):
"""
{scrapedContent}
"""

Geef het JSON-object met de "producten"-array.`;

// ── PARENT (Ideale klant analyse) — gedeelde basis voor Snel + Volledig ─────
// Bevat persona, algemene principes en stijl-regels die voor beide modi gelden.
// Geen placeholders — die zitten in de sub-extensies.

export const FALLBACK_PROMPT_PARENT = `Je bent een expert in B2B marketing en ICP-analyse (Ideal Customer Profile). Je analyseert gegevens om een gestructureerd profiel van de ideale klant op te bouwen.

# Algemene principes
- Antwoord altijd in het Nederlands.
- Geef ALLEEN het JSON-object terug. Geen markdown-fences, geen toelichting.
- Specifiek > generiek. "MKB-accountantskantoren met 10-50 fte" is beter dan "zakelijke dienstverlening".
- Outside-in: schrijf vanuit het perspectief van de prospect.
- Concreet > abstract.
- Pijnpunten zijn PROBLEMEN, geen wensen.
- Trigger events zijn gebeurtenissen met een tijd-element.
- Wees eerlijk over wat ontbreekt — vul niet zomaar in.`;

// ── PHASE 1 extensie (Snelle analyse) ───────────────────────────────────────
// Placeholders: {websiteUrl}, {scrapedContent}

export const FALLBACK_PROMPT_PHASE1 = `# Modus: Snelle analyse op basis van website-content

# Output-velden (verplicht)
- **diensten**: array van { naam, prominentie ("hoog"|"middel"|"laag"), beschrijving }
- **primaire_doelgroep**: { sector, subsector, bedrijfsgrootte, functietitels (array), geografische_focus }
- **pijnpunten**: array van strings (concrete problemen)
- **usp**: string (waardepropositie zoals te lezen uit de website)
- **klantvoorbeelden**: array van strings (genoemde klantnamen)
- **trigger_events**: array van strings (events die kopen veroorzaken)
- **tone_of_voice**: string (korte typering)
- **betrouwbaarheid_score**: number 0-100 (hoeveel info beschikbaar was)
- **ontbrekende_informatie**: array van strings (wat AI niet kon vinden — eerlijk!)
- **icp_inschatting**:
  - industrieen: array van strings
  - bedrijfsgrootte: array van strings
  - kernprocessen: array van strings (sales/HR/finance/operations)
  - dmu: array van { rol, invloed: "beslisser"|"beïnvloeder"|"gebruiker" }
  - samenvatting: string

Analyseer de volgende websitecontent en extraheer informatie om het Ideal Customer Profile (ICP) te bepalen.

WEBSITECONTENT ({websiteUrl}):
"""
{scrapedContent}
"""

Schat de betrouwbaarheid_score (0-100) op basis van hoeveel informatie beschikbaar was. Vermeld onder "ontbrekende_informatie" wat de AI niet kon afleiden. Voeg ook een 'icp_inschatting' toe als eerste inschatting van het ICP.`;

// ── FINAL extensie (Volledige analyse) ──────────────────────────────────────
// Placeholders: {companyName}, {context}
// `{context}` bevat alle dynamische input (modus-blok, Phase 1, webform-data,
// positionering) als één pre-geformatteerd blok dat de runtime samenstelt.

export const FALLBACK_PROMPT_FINAL = `# Modus: Volledige analyse — verfijnd ICP-profiel

# Output-shape (verplicht)
\`\`\`
{
  "heroTekst": string (positionering 2-3 zinnen, outside-in: begin met doelgroep + winst),
  "firmografisch": {
    "sector": string,
    "subsector": string,
    "bedrijfsgrootte": string[] (bijv ["50-250 FTE", "250+ FTE"]),
    "contactfunctie": string,
    "beslisser": string,
    "contractwaarde": string,
    "vindkanalen": string[]
  },
  "pijnpuntenTriggers": {
    "pijnpunt": string (HET primaire pijnpunt — kies één scherp),
    "triggers": string[]
  },
  "usp": string,
  "dienstFocus": {
    "dienst": string,
    "contractwaarde": string,
    "icpMatch": string (waarom dit past bij dit ICP)
  },
  "negatieveIcp": {
    "dealbreakers": string[],
    "disqualificatievraag": string (één scherpe ja/nee-vraag)
  },
  "marketingVertaalslag": {
    "kanalen": [{ "kanaal": string, "prioriteit": "hoog"|"middel"|"laag", "reden": string }],
    "kernboodschap": {
      "bewustwording": string,
      "overweging": string,
      "beslissing": string
    },
    "contentAanbevelingen": {
      "artikel": string,
      "linkedin": string,
      "email": string
    }
  },
  "volgendStappen": string[] (3-5 concrete acties),
  "positionering": "verticaal" | "horizontaal"
}
\`\`\`

Genereer een volledig ICP (Ideal Customer Profile) voor {companyName}.

{context}

Genereer een volledig ICP-profiel in het Nederlands. Geef ALLEEN geldige JSON terug.`;

/**
 * Bouwt het `{context}`-blok voor de FINAL-template op uit runtime-data.
 * Dit blijft in code omdat het opmaak + conditionals bevat die niet door admin
 * worden bewerkt (alleen instructies en output-shape zijn admin-bewerkbaar).
 */
export function buildFinalContext(args: {
  phase1: Phase1Output;
  answers: WebformAnswers;
  analysisMode?: "snel" | "volledig";
}): string {
  const { phase1, answers, analysisMode = "volledig" } = args;

  const sectorStr = answers.sectoren
    .map((s) => `${s.hoofdsector} > ${s.subsector}`)
    .join(", ");

  const isVerticaal =
    answers.sectoren.length === 1 ||
    (answers.sectoren.length <= 2 &&
      answers.sectoren.every(
        (s) => s.hoofdsector === answers.sectoren[0]?.hoofdsector,
      ));

  const modeBlok =
    analysisMode === "volledig"
      ? `# Modus: VOLLEDIG (gebruiker heeft vragenlijst ingevuld)

BELANGRIJK: de webform-antwoorden hieronder zijn DOOR DE GEBRUIKER zelf ingevuld en zijn AUTORITATIEF. Waar webform-antwoorden conflicteren met Phase 1 (die op website-analyse berust), VOLG JE DE WEBFORM-ANTWOORDEN. Phase 1 is alleen aanvulling voor velden die de gebruiker leeg liet of niet expliciet noemt.

Maak het profiel SCHERPER en SPECIFIEKER dan de Phase 1-inschatting — gebruik de zekerheid uit de webform-antwoorden.`
      : `# Modus: SNEL (geen webform-input — gebruik Phase 1 als basis)

De webform-antwoorden hieronder zijn LEEG (Snel-modus). Werk volledig op basis van Phase 1. Wees expliciet over wat afgeleid is en wat onzeker is.`;

  return `${modeBlok}

# FASE 1 ANALYSE (uit website-scan):
${JSON.stringify(phase1, null, 2)}

# WEBFORM ANTWOORDEN${analysisMode === "snel" ? " (LEEG — Snel-modus)" : ""}:
- Sectoren: ${sectorStr || "(leeg)"}
- Bedrijfsgrootte: ${answers.bedrijfsgrootte.join(", ") || "(leeg)"}
- Contactfunctie: ${answers.contactfunctie || "(leeg)"}
- Beslisser: ${answers.zelfdePersoon ? answers.contactfunctie : answers.beslisser || "(leeg)"}
- Primair pijnpunt: ${answers.pijnpunt || "(leeg)"}
- Trigger events: ${answers.triggers.join(", ") || "(leeg)"}
- Strategische dienst: ${answers.strategischeDienst}
- Contractwaarde: ${answers.contractwaarde || "(leeg)"}
- Ideale kenmerken: ${answers.idealeKenmerken.join(", ") || "(leeg)"}
- Dealbreakers: ${answers.dealbreakers.join(", ") || "(leeg)"}
- Vindkanalen (op prioriteit): ${
    answers.vindkanalen
      .map((v) => `${v.prioriteit}. ${v.kanaal}`)
      .join(" · ") || "(leeg)"
  }
- USP (door gebruiker): ${answers.usp || "(leeg)"}
- Eigen beschrijving: ${answers.eigenBeschrijving || "(leeg)"}
- Positionering (afgeleid uit sectoren): ${isVerticaal ? "verticaal" : "horizontaal"}`;
}
