import type { Phase1Output, WebformAnswers, WebsiteSnapshot } from "./schema";

// ── Scan website voor producten/diensten ────────────────────────────────────

export function buildScanProductsSystemPrompt(): string {
  return `Je bent een expert in B2B marketing. Extraheer alle producten en diensten van de
website. Antwoord altijd in het Nederlands. Geef alleen geldige JSON terug.

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

Geef ALLEEN het JSON-object terug, geen toelichting.`;
}

export function buildScanProductsUserPrompt(snapshot: WebsiteSnapshot): string {
  return `Analyseer de volgende websitecontent en extraheer alle producten en diensten die
dit bedrijf aanbiedt.

WEBSITECONTENT (${snapshot.url}):
"""
${snapshot.bodyExcerpt}
"""

Geef het JSON-object met de "producten"-array.`;
}

// ── Phase 1: initiële website-analyse ───────────────────────────────────────

export function buildPhase1SystemPrompt(): string {
  return `Je bent een expert in B2B marketing en ICP-analyse. Je analyseert websitecontent
en extraheert gestructureerde informatie over de ideale klant. Antwoord altijd in het
Nederlands. Geef alleen geldige JSON terug.

# Output-velden

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
  - industrieen: array van strings (waarschijnlijke sectoren)
  - bedrijfsgrootte: array van strings (passende groottes)
  - kernprocessen: array van strings (sales/HR/finance/operations)
  - dmu: array van { rol, invloed: "beslisser"|"beïnvloeder"|"gebruiker" }
  - samenvatting: string (kort: ideale klant)

# Schrijf-principes
- Specifiek > generiek: "MKB-accountantskantoren met 10-50 fte" beter dan "zakelijke dienstverlening"
- Pijnpunten zijn PROBLEMEN, geen wensen
- Wees eerlijk over wat ontbreekt — vul niet zomaar in

Geef ALLEEN het JSON-object. Geen markdown-fences, geen toelichting.`;
}

export function buildPhase1UserPrompt(snapshot: WebsiteSnapshot): string {
  return `Analyseer de volgende websitecontent en extraheer informatie om het Ideal Customer
Profile (ICP) te bepalen.

WEBSITECONTENT (${snapshot.url}):
"""
${snapshot.bodyExcerpt}
"""

Geef een gestructureerde JSON-output. Schat de betrouwbaarheid_score (0-100) op basis van
hoeveel informatie beschikbaar was. Vermeld onder "ontbrekende_informatie" wat de AI niet
kon afleiden.

Voeg ook een 'icp_inschatting' toe: een eerste inschatting van het Ideal Customer Profile
op basis van alle geanalyseerde informatie.

Geef ALLEEN geldige JSON terug, geen andere tekst.`;
}

// ── Final ICP (Phase 3) ─────────────────────────────────────────────────────

export function buildFinalIcpSystemPrompt(): string {
  return `Je bent een expert B2B-marketingstrateeg. Genereer een volledig ICP-profiel met
concrete, actionable inzichten. Alle teksten in het Nederlands. Geef alleen geldige JSON
terug.

# Output-shape

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
    "triggers": string[] (events die kopen veroorzaken)
  },
  "usp": string,
  "dienstFocus": {
    "dienst": string (naam strategische dienst/product),
    "contractwaarde": string,
    "icpMatch": string (waarom dit past bij dit ICP)
  },
  "negatieveIcp": {
    "dealbreakers": string[] (wanneer is het GEEN match?),
    "disqualificatievraag": string (één vraag die snel disqualificeert)
  },
  "marketingVertaalslag": {
    "kanalen": [{ "kanaal": string, "prioriteit": string ("hoog"|"middel"|"laag"), "reden": string }],
    "kernboodschap": {
      "bewustwording": string (boodschap voor awareness-fase),
      "overweging": string (boodschap voor consideration-fase),
      "beslissing": string (boodschap voor decision-fase)
    },
    "contentAanbevelingen": {
      "artikel": string (concreet artikel-onderwerp),
      "linkedin": string (LinkedIn-postsuggestie),
      "email": string (cold-email-onderwerp + opening)
    }
  },
  "volgendStappen": string[] (3-5 concrete acties),
  "positionering": "verticaal" | "horizontaal"
}
\`\`\`

# Principes
- Outside-in: schrijf vanuit perspectief van prospect
- Concreet > abstract
- Disqualificatievraag is één scherpe ja/nee-vraag
- Triggers zijn events met tijd-element

Geef ALLEEN het JSON-object. Geen markdown-fences, geen toelichting.`;
}

export function buildFinalIcpUserPrompt(args: {
  phase1: Phase1Output;
  answers: WebformAnswers;
  companyName: string;
  analysisMode?: "snel" | "volledig";
}): string {
  const { phase1, answers, companyName, analysisMode = "volledig" } = args;

  const sectorStr = answers.sectoren
    .map((s) => `${s.hoofdsector} > ${s.subsector}`)
    .join(", ");

  const isVerticaal =
    answers.sectoren.length === 1 ||
    (answers.sectoren.length <= 2 &&
      answers.sectoren.every(
        (s) => s.hoofdsector === answers.sectoren[0]?.hoofdsector
      ));

  const modeBlok =
    analysisMode === "volledig"
      ? `# Modus: VOLLEDIG (gebruiker heeft vragenlijst ingevuld)

BELANGRIJK: de webform-antwoorden hieronder zijn DOOR DE GEBRUIKER zelf ingevuld
en zijn AUTORITATIEF. Waar webform-antwoorden conflicteren met Phase 1 (die op
website-analyse berust), VOLG JE DE WEBFORM-ANTWOORDEN. Phase 1 is alleen aanvulling
voor velden die de gebruiker leeg liet of niet expliciet noemt (zoals tone_of_voice,
ontbrekende DMU-rollen, klantvoorbeelden).

Maak het profiel SCHERPER en SPECIFIEKER dan de Phase 1-inschatting — gebruik de
zekerheid uit de webform-antwoorden.`
      : `# Modus: SNEL (geen webform-input — gebruik Phase 1 als basis)

De webform-antwoorden hieronder zijn LEEG (Snel-modus). Werk volledig op basis van
Phase 1. Wees expliciet over wat afgeleid is en wat onzeker is.`;

  return `Genereer een volledig ICP (Ideal Customer Profile) voor ${companyName}.

${modeBlok}

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
- Positionering (afgeleid uit sectoren): ${isVerticaal ? "verticaal" : "horizontaal"}

Genereer een volledig ICP-profiel in het Nederlands. Geef ALLEEN geldige JSON terug.`;
}
