export const ONDERDELEN = [
  "Waardepropositie",
  "Klantvoordelen",
  "Diensten/Features",
  "Proces",
  "Bewijsvoering",
  "Klantcases",
  "CTA's",
  "Content",
  "Schrijfstijl",
  "Actualiteit",
  "Contactpagina",
] as const;

const ONDERDEEL_DETAILS: Record<(typeof ONDERDELEN)[number], string> = {
  Waardepropositie: "Is deze direct duidelijk, onderscheidend en relevant?",
  Klantvoordelen: "Zijn de voordelen concreet, resultaatgericht en overtuigend?",
  "Diensten/Features": "Is helder uitgelegd wat het bedrijf doet en hoe het werkt?",
  Proces: "Is het stappenplan duidelijk en logisch?",
  Bewijsvoering: "Kwaliteit en zichtbaarheid van cases, referenties en testimonials.",
  Klantcases: "Beschrijven ze: klant, uitdaging, oplossing, resultaten?",
  "CTA's": "Zichtbaarheid, duidelijkheid en conversiekracht.",
  Content: "Aanwezigheid en relevantie van blogs, nieuws, whitepapers.",
  Schrijfstijl: "Inside-out of outside-in (klantgericht)?",
  Actualiteit: "Kloppen data, visuals en content nog?",
  Contactpagina: "Vindbaarheid, volledigheid en gebruiksgemak.",
};

export const SYSTEM_PROMPT = `Je bent een expert in B2B website analyse en conversie-optimalisatie.
Analyseer de opgegeven websitecontent grondig en geef een gestructureerde beoordeling.
Antwoord ALTIJD in het Nederlands. Geef alleen geldige JSON terug (geen markdown, geen uitleg eromheen).`;

export function buildUserPrompt(args: {
  companyName: string;
  websiteUrl: string;
  scrapedContent: string;
}): string {
  const lijst = ONDERDELEN.map(
    (n, i) => `${i + 1}. ${n} – ${ONDERDEEL_DETAILS[n]}`
  ).join("\n");
  return `Analyseer de volgende B2B-website en geef een gestructureerde beoordeling.

BEDRIJF: ${args.companyName || "Onbekend"}
WEBSITE URL: ${args.websiteUrl}

WEBSITE CONTENT:
${args.scrapedContent || "(Kon website niet laden)"}

Beoordeel de volgende 11 onderdelen elk met een score van 1-10 en een korte toelichting:
${lijst}

Geef je antwoord in EXACT deze JSON-structuur (alle velden verplicht, geen extra velden, geen markdown-fences):
{
  "companyName": "${args.companyName || "Onbekend"}",
  "websiteUrl": "${args.websiteUrl}",
  "overallScore": <getal 1-10, gemiddelde van de onderdeelscores>,
  "executiveSummary": "<2-3 zinnen samenvatting>",
  "onderdelen": [
    { "naam": "Waardepropositie", "score": <1-10>, "toelichting": "<korte uitleg>", "verbeterpunten": ["<punt>", "..."] },
    { "naam": "Klantvoordelen", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Diensten/Features", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Proces", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Bewijsvoering", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Klantcases", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "CTA's", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Content", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Schrijfstijl", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Actualiteit", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Contactpagina", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] }
  ],
  "sterkePunten": ["<punt 1>", "<punt 2>", "<punt 3>"],
  "verbeterpunten": ["<punt 1>", "<punt 2>", "<punt 3>"],
  "topActies": [
    { "actie": "<actie 1>", "impact": "hoog", "toelichting": "..." },
    { "actie": "<actie 2>", "impact": "<hoog|middel|laag>", "toelichting": "..." },
    { "actie": "<actie 3>", "impact": "<hoog|middel|laag>", "toelichting": "..." },
    { "actie": "<actie 4>", "impact": "<hoog|middel|laag>", "toelichting": "..." },
    { "actie": "<actie 5>", "impact": "<hoog|middel|laag>", "toelichting": "..." }
  ]
}

Belangrijk:
- companyName en websiteUrl: gebruik EXACT de waarden hierboven.
- Exact 11 onderdelen in de bovengenoemde volgorde; "naam" letterlijk overnemen.
- Scores zijn getallen 1-10 (decimalen mogen). Vul "verbeterpunten" als een array van korte strings (mag leeg zijn als er geen zijn).
- Exact 5 acties, gesorteerd op prioriteit (hoogste impact eerst). Impact altijd "hoog", "middel" of "laag".
- Geen extra velden, geen markdown-fences (\`\`\`), geen uitleg buiten de JSON.`;
}
