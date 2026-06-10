import type { WebsiteCheckOutput } from "./schema";

/**
 * Fallback dummy WebsiteCheckOutput voor de admin-preview-tab,
 * gebruikt wanneer er nog geen echte sessie met output in de DB staat.
 *
 * Bevat alle 7 sectie-types (banner, samenvatting, onderdelen,
 * sterke/verbeterpunten, top-acties) zodat layout-tweaks
 * meteen visueel zichtbaar zijn.
 */
export const WEBSITE_CHECK_PREVIEW_FIXTURE: WebsiteCheckOutput = {
  companyName: "Voorbeeld B.V.",
  websiteUrl: "https://voorbeeld.nl",
  overallScore: 6.4,
  executiveSummary:
    "Een degelijke website met een duidelijke propositie, maar de conversie-elementen kunnen sterker en de uitleg over de doelgroep is te algemeen.",
  onderdelen: [
    {
      naam: "Eerste indruk",
      score: 7.5,
      toelichting: "Helder design, snelle laadtijd.",
      verbeterpunten: ["Headline kan scherper"],
    },
    {
      naam: "Propositie",
      score: 5.8,
      toelichting: "Wat je doet staat er, voor wie minder duidelijk.",
      verbeterpunten: ["Doelgroep expliciet noemen", "Concreet voorbeeld toevoegen"],
    },
    {
      naam: "Doelgroep & USP's",
      score: 6.0,
      toelichting: "USP's blijven generiek.",
      verbeterpunten: ["Concretere klantvoorbeelden"],
    },
    {
      naam: "Content",
      score: 6.5,
      toelichting: "Goed leesbaar.",
      verbeterpunten: [],
    },
    {
      naam: "Call to actions",
      score: 5.5,
      toelichting: "Te veel keuze, te weinig hiërarchie.",
      verbeterpunten: ["Primaire CTA boven de vouw"],
    },
    {
      naam: "Social proof",
      score: 7.0,
      toelichting: "Logo's aanwezig, recensies missen.",
      verbeterpunten: ["Recensies toevoegen"],
    },
    {
      naam: "Visueel ontwerp",
      score: 7.8,
      toelichting: "Modern en strak.",
      verbeterpunten: [],
    },
    {
      naam: "Mobiel",
      score: 6.2,
      toelichting: "Werkt maar voelt traag.",
      verbeterpunten: ["Beelden optimaliseren"],
    },
    {
      naam: "Snelheid",
      score: 5.5,
      toelichting: "Laadt rond de 3 seconden.",
      verbeterpunten: ["Lazy-loading inschakelen"],
    },
    {
      naam: "SEO basis",
      score: 6.0,
      toelichting: "Title en meta aanwezig.",
      verbeterpunten: ["H1-structuur verbeteren"],
    },
    {
      naam: "Vertrouwen",
      score: 7.2,
      toelichting: "Contactgegevens duidelijk.",
      verbeterpunten: [],
    },
  ],
  sterkePunten: [
    "Strakke visuele identiteit",
    "Logo's van bekende klanten boven de vouw",
    "Duidelijke contactgegevens en KvK-info",
  ],
  verbeterpunten: [
    "Doelgroep en USP's te generiek",
    "Te veel CTA's zonder duidelijke hiërarchie",
    "Mobiele laadsnelheid laat te wensen over",
  ],
  topActies: [
    {
      impact: "hoog",
      actie: "Maak één primaire CTA boven de vouw",
      toelichting: "Eén actie laten zien geeft conversie-lift.",
    },
    {
      impact: "hoog",
      actie: "Voeg drie concrete klantcases toe",
      toelichting: "Geeft direct vertrouwen en propositie-bewijs.",
    },
    {
      impact: "middel",
      actie: "Mobiele beelden comprimeren",
      toelichting: "Verlaagt laadtijd met ~30%.",
    },
    {
      impact: "middel",
      actie: "Recensies of testimonials toevoegen",
      toelichting: "Social proof versterken.",
    },
    {
      impact: "laag",
      actie: "H1-structuur opschonen",
      toelichting: "Helpt SEO en accessibility.",
    },
  ],
};
