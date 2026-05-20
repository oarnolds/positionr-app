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

Geef ook:
- Een overall score (gemiddelde, 1-10)
- Een executive summary (2-3 zinnen)
- Top 3 sterke punten
- Top 3 verbeterpunten
- Top 5 concrete acties met hoogste impact (gesorteerd op prioriteit, elk met impact: hoog|middel|laag).`;
}
