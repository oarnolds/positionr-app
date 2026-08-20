/**
 * Content-registry voor bewerkbare marketing-copy.
 *
 * Elk stuk tekst op de homepage heeft een typed `ContentKey`. `CONTENT_META`
 * bevat per key of het `plain` of `rich` (HTML) is, plus de default-tekst
 * die getoond wordt als de key niet in `site_content` staat.
 *
 * Rules:
 *  - Defaults moeten 1-op-1 matchen met de vorige hardcoded strings —
 *    elke drift = zichtbare tekstverandering voor bezoekers.
 *  - Nieuwe copy toevoegen: voeg key toe aan `ContentKey` union + entry
 *    in `CONTENT_META` + verwijs in de betreffende sectie.
 *  - Rich = TipTap-editor bij inline-edit + HTML-render via
 *    dangerouslySetInnerHTML (sanitized bij save).
 */

export type ContentKind = "plain" | "rich";

export type ContentKey =
  // Hero
  | "homepage.hero.chip"
  | "homepage.hero.title"
  | "homepage.hero.subtitle"
  | "homepage.hero.cta_primary_label"
  | "homepage.hero.cta_secondary_label"
  | "homepage.hero.micro_copy"
  // PainPoints
  | "homepage.painpoints.eyebrow"
  | "homepage.painpoints.title"
  | "homepage.painpoints.intro"
  | "homepage.painpoints.q.1"
  | "homepage.painpoints.q.2"
  | "homepage.painpoints.q.3"
  | "homepage.painpoints.q.4"
  | "homepage.painpoints.q.5"
  | "homepage.painpoints.q.6"
  | "homepage.painpoints.q.7"
  | "homepage.painpoints.q.8"
  | "homepage.painpoints.q.9"
  // HowItWorks
  | "homepage.howitworks.eyebrow"
  | "homepage.howitworks.title"
  | "homepage.howitworks.step.1.title"
  | "homepage.howitworks.step.1.body"
  | "homepage.howitworks.step.2.title"
  | "homepage.howitworks.step.2.body"
  | "homepage.howitworks.step.3.title"
  | "homepage.howitworks.step.3.body"
  // Foundations
  | "homepage.foundations.eyebrow"
  | "homepage.foundations.title"
  | "homepage.foundations.intro"
  | "homepage.foundations.card.cialdini.label"
  | "homepage.foundations.card.cialdini.title"
  | "homepage.foundations.card.cialdini.body"
  | "homepage.foundations.card.ritson.label"
  | "homepage.foundations.card.ritson.title"
  | "homepage.foundations.card.ritson.body"
  | "homepage.foundations.card.kotler.label"
  | "homepage.foundations.card.kotler.title"
  | "homepage.foundations.card.kotler.body"
  // Founders
  | "homepage.founders.eyebrow"
  | "homepage.founders.title"
  | "homepage.founders.intro"
  | "homepage.founders.olivier.name"
  | "homepage.founders.olivier.role"
  | "homepage.founders.olivier.years"
  | "homepage.founders.olivier.intro"
  | "homepage.founders.martijn.name"
  | "homepage.founders.martijn.role"
  | "homepage.founders.martijn.years"
  | "homepage.founders.martijn.intro"
  // AgencyComparison
  | "homepage.agency.eyebrow"
  | "homepage.agency.title"
  | "homepage.agency.tijd.left"
  | "homepage.agency.tijd.right"
  | "homepage.agency.prijs.left"
  | "homepage.agency.prijs.right"
  | "homepage.agency.controle.left"
  | "homepage.agency.controle.right"
  // PlansTeaser
  | "homepage.plans.eyebrow"
  | "homepage.plans.title"
  | "homepage.plans.intro"
  | "homepage.plans.cta_label"
  | "homepage.plans.all_features_link"
  // FAQ
  | "homepage.faq.title"
  | "homepage.faq.q.1"
  | "homepage.faq.a.1"
  | "homepage.faq.q.2"
  | "homepage.faq.a.2"
  | "homepage.faq.q.3"
  | "homepage.faq.a.3"
  | "homepage.faq.q.4"
  | "homepage.faq.a.4"
  | "homepage.faq.q.5"
  | "homepage.faq.a.5"
  | "homepage.faq.q.6"
  | "homepage.faq.a.6"
  // FinalCta
  | "homepage.finalcta.title"
  | "homepage.finalcta.subtitle"
  | "homepage.finalcta.cta_primary_label"
  | "homepage.finalcta.cta_secondary_label"
  | "homepage.finalcta.micro_copy";

export const CONTENT_META: Record<
  ContentKey,
  { kind: ContentKind; default: string }
> = {
  // Hero
  "homepage.hero.chip": {
    kind: "plain",
    default: "Marketinganalyse voor MKB",
  },
  "homepage.hero.title": {
    kind: "plain",
    default: "De second opinion voor je marketingbeslissingen.",
  },
  "homepage.hero.subtitle": {
    kind: "plain",
    default:
      "Wat een bureau in dagen doet, krijg jij in minuten. Zonder consultancy-uren, met een advies waar je meteen mee aan de slag kan.",
  },
  "homepage.hero.cta_primary_label": {
    kind: "plain",
    default: "Probeer de gratis Website Check",
  },
  "homepage.hero.cta_secondary_label": {
    kind: "plain",
    default: "Bekijk de pakketten →",
  },
  "homepage.hero.micro_copy": {
    kind: "plain",
    default: "Geen credit card. Klaar in ± 2 minuten.",
  },

  // PainPoints
  "homepage.painpoints.eyebrow": { kind: "plain", default: "Herken je dit?" },
  "homepage.painpoints.title": {
    kind: "plain",
    default: "Deze vragen krijgen wij dagelijks van ondernemers.",
  },
  "homepage.painpoints.intro": {
    kind: "plain",
    default:
      "Loop je hier zelf tegenaan? Positionr geeft je in minuten een gefundeerd antwoord. Geen weken wachten op een bureau, geen buikgevoel.",
  },
  "homepage.painpoints.q.1": {
    kind: "plain",
    default: "Bereiken we de juiste doelgroep?",
  },
  "homepage.painpoints.q.2": {
    kind: "plain",
    default: "Waarom converteert onze website niet?",
  },
  "homepage.painpoints.q.3": {
    kind: "plain",
    default: "Wat doen concurrenten beter?",
  },
  "homepage.painpoints.q.4": {
    kind: "plain",
    default: "Hoe meet ik marketing-ROI?",
  },
  "homepage.painpoints.q.5": {
    kind: "plain",
    default: "Welke kanalen werken écht?",
  },
  "homepage.painpoints.q.6": {
    kind: "plain",
    default: "Wat is onze USP eigenlijk?",
  },
  "homepage.painpoints.q.7": {
    kind: "plain",
    default: "Hoe stuur ik mijn marketeer aan?",
  },
  "homepage.painpoints.q.8": {
    kind: "plain",
    default: "Investeren in SEO of SEA?",
  },
  "homepage.painpoints.q.9": {
    kind: "plain",
    default: "Hoe krijg ik grip op marketing?",
  },

  // HowItWorks
  "homepage.howitworks.eyebrow": { kind: "plain", default: "Zo werkt het." },
  "homepage.howitworks.title": {
    kind: "plain",
    default: "Zo kom je in drie stappen bij een concreet antwoord.",
  },
  "homepage.howitworks.step.1.title": {
    kind: "plain",
    default: "Stel je vraag of upload je URL",
  },
  "homepage.howitworks.step.1.body": {
    kind: "plain",
    default:
      "Kies een module (Website Check, ICP-analyse, Concurrentieanalyse) en geef ons je bedrijf. Meer heb je niet nodig.",
  },
  "homepage.howitworks.step.2.title": {
    kind: "plain",
    default: "Onze AI analyseert je situatie",
  },
  "homepage.howitworks.step.2.body": {
    kind: "plain",
    default:
      "In ± 2 minuten leggen we jouw input naast de raamwerken van Cialdini, Ritson en Kotler. Je ziet stap voor stap hoe we tot een advies komen.",
  },
  "homepage.howitworks.step.3.title": {
    kind: "plain",
    default: "Krijg concrete, geprioriteerde acties",
  },
  "homepage.howitworks.step.3.body": {
    kind: "plain",
    default:
      "Geen 40-pagina rapport dat op de plank belandt. Vijf acties met impact-score, direct toepasbaar deze week.",
  },

  // Foundations
  "homepage.foundations.eyebrow": { kind: "plain", default: "De basis." },
  "homepage.foundations.title": {
    kind: "plain",
    default: "Geen buikgevoel, maar 60 jaar marketingwetenschap.",
  },
  "homepage.foundations.intro": {
    kind: "plain",
    default:
      "Elke aanbeveling leunt op raamwerken die op universiteiten en bij de sterkste bureaus dagelijks in de praktijk zitten. Wij vertalen ze naar jouw situatie.",
  },
  "homepage.foundations.card.cialdini.label": {
    kind: "plain",
    default: "Cialdini",
  },
  "homepage.foundations.card.cialdini.title": {
    kind: "plain",
    default: "Waarom mensen 'ja' zeggen.",
  },
  "homepage.foundations.card.cialdini.body": {
    kind: "plain",
    default:
      "Zes principes van invloed (reciprociteit, sociale bewijskracht, autoriteit, sympathie, schaarste, commitment), gebruikt om je propositie en CTA's te toetsen.",
  },
  "homepage.foundations.card.ritson.label": {
    kind: "plain",
    default: "Mark Ritson",
  },
  "homepage.foundations.card.ritson.title": {
    kind: "plain",
    default: "Diagnose vóór creatie.",
  },
  "homepage.foundations.card.ritson.body": {
    kind: "plain",
    default:
      "Wij kijken eerst naar je categorie, doelgroep en positionering. Pas daarna naar tactiek. Zo werken de sterkste adverteerders ook.",
  },
  "homepage.foundations.card.kotler.label": {
    kind: "plain",
    default: "Philip Kotler",
  },
  "homepage.foundations.card.kotler.title": {
    kind: "plain",
    default: "De vier P's, up-to-date.",
  },
  "homepage.foundations.card.kotler.body": {
    kind: "plain",
    default:
      "Product, prijs, plaats, promotie, met de aanvullingen uit Kotler's latere werk over CX en H2H (human-to-human).",
  },

  // Founders
  "homepage.founders.eyebrow": {
    kind: "plain",
    default: "Achter Positionr.",
  },
  "homepage.founders.title": {
    kind: "plain",
    default: "De ervaring die AI niet kan namaken.",
  },
  "homepage.founders.intro": {
    kind: "plain",
    default:
      "Positionr is geen zwarte doos vol algoritmes. Elke module is gebouwd door twee marketeers die dertig jaar aan cases, missers en succesvolle keuzes hebben gecodificeerd. Wat je terugkrijgt is hún manier van denken, niet die van de machine.",
  },
  "homepage.founders.olivier.name": {
    kind: "plain",
    default: "Olivier Arnolds",
  },
  "homepage.founders.olivier.role": {
    kind: "plain",
    default: "Oprichter · Product & marketing",
  },
  "homepage.founders.olivier.years": {
    kind: "plain",
    default: "30+ jaar in B2B-marketing en sales",
  },
  "homepage.founders.olivier.intro": {
    kind: "plain",
    default:
      "Uit Amsterdam. Bouwt aan Positionr vanuit 30+ jaar ervaring in B2B-sales, marketing en business development. In elke module zit de manier waarop ik zelf een marketingvraag zou aanpakken: minder theorie, meer bruikbare stappen.",
  },
  "homepage.founders.martijn.name": {
    kind: "plain",
    default: "Martijn de Haas",
  },
  "homepage.founders.martijn.role": {
    kind: "plain",
    default: "Oprichter · Strategie",
  },
  "homepage.founders.martijn.years": {
    kind: "plain",
    default: "TU Delft · eigenaar De Haas BCD",
  },
  "homepage.founders.martijn.intro": {
    kind: "plain",
    default:
      "Strateeg met een achtergrond aan de TU Delft en jaren ervaring bij een multinational. Runt sinds jaren zijn eigen strategie-praktijk (De Haas BCD) en helpt organisaties van MKB tot overheid ambitie om te zetten in scherpe keuzes. In Positionr zit dezelfde manier van denken.",
  },

  // AgencyComparison
  "homepage.agency.eyebrow": {
    kind: "plain",
    default: "Wat het verschil maakt.",
  },
  "homepage.agency.title": {
    kind: "plain",
    default: "Bureau of Positionr: dit weegt anders.",
  },
  "homepage.agency.tijd.left": {
    kind: "plain",
    default: "Bureau: dagen tot weken.",
  },
  "homepage.agency.tijd.right": {
    kind: "plain",
    default: "Positionr: minuten.",
  },
  "homepage.agency.prijs.left": {
    kind: "plain",
    default: "Bureau: € 5.000 – € 30.000+.",
  },
  "homepage.agency.prijs.right": {
    kind: "plain",
    default: "Positionr: één jaarbedrag.",
  },
  "homepage.agency.controle.left": {
    kind: "plain",
    default: "Bureau: extern advies.",
  },
  "homepage.agency.controle.right": {
    kind: "plain",
    default: "Positionr: in eigen handen.",
  },

  // PlansTeaser
  "homepage.plans.eyebrow": { kind: "plain", default: "Pakketten." },
  "homepage.plans.title": {
    kind: "plain",
    default: "Eén jaarbedrag, alle modules in je pakket.",
  },
  "homepage.plans.intro": {
    kind: "plain",
    default:
      "Geen uurtarieven, geen consultancy-add-ons. Een fractie van wat één bureau-traject kost.",
  },
  "homepage.plans.cta_label": { kind: "plain", default: "Kies dit pakket" },
  "homepage.plans.all_features_link": {
    kind: "plain",
    default: "Bekijk alle features en modules per pakket →",
  },

  // FAQ — antwoorden zijn rich (worden TipTap in PR-C2)
  "homepage.faq.title": {
    kind: "plain",
    default: "Wat vragen mensen ons vaak?",
  },
  "homepage.faq.q.1": {
    kind: "plain",
    default: "Kan ik dit ook zonder marketing-achtergrond gebruiken?",
  },
  "homepage.faq.a.1": {
    kind: "rich",
    default:
      "<p>Ja. De rapportages leggen uit wat je ziet en welke acties je kunt nemen. Je hoeft geen marketing-jargon te kennen. We schrijven voor ondernemers, niet voor marketeers.</p>",
  },
  "homepage.faq.q.2": {
    kind: "plain",
    default: "Wat gebeurt er met mijn data?",
  },
  "homepage.faq.a.2": {
    kind: "rich",
    default:
      "<p>Je data blijft van jou. Analyses staan in je eigen account, we verkopen niets aan derden en verwijderen alles bij opzegging.</p>",
  },
  "homepage.faq.q.3": {
    kind: "plain",
    default: "Werkt dit ook voor mijn sector?",
  },
  "homepage.faq.a.3": {
    kind: "rich",
    default:
      "<p>Positionr is gebouwd voor B2B-MKB in zakelijke dienstverlening, technologie en financiële dienstverlening. Buiten die sectoren werkt het ook, maar de raamwerken zijn dáár het beste getest.</p>",
  },
  "homepage.faq.q.4": { kind: "plain", default: "Kan ik opzeggen?" },
  "homepage.faq.a.4": {
    kind: "rich",
    default:
      "<p>Je koopt een jaar toegang. Aan het einde loopt de licentie vanzelf af. Geen automatische verlenging, geen kleine lettertjes.</p>",
  },
  "homepage.faq.q.5": {
    kind: "plain",
    default: "Hoe verhoudt Positionr zich tot mijn huidige bureau?",
  },
  "homepage.faq.a.5": {
    kind: "rich",
    default:
      "<p>Positionr vervangt je bureau niet noodzakelijk. Het geeft je een onafhankelijke second opinion en helpt bepalen waarop je bureau moet focussen.</p>",
  },
  "homepage.faq.q.6": {
    kind: "plain",
    default: "Wat als ik meer hulp nodig heb dan de tool geeft?",
  },
  "homepage.faq.a.6": {
    kind: "rich",
    default:
      "<p>Neem contact op. We denken graag mee, of verwijzen je naar een specialist uit ons netwerk als dat beter past.</p>",
  },

  // FinalCta
  "homepage.finalcta.title": {
    kind: "plain",
    default: "Klaar om zelf grip te krijgen?",
  },
  "homepage.finalcta.subtitle": {
    kind: "plain",
    default: "Begin met een gratis Website Check. Geen account, ± 2 minuten.",
  },
  "homepage.finalcta.cta_primary_label": {
    kind: "plain",
    default: "Doe de gratis check →",
  },
  "homepage.finalcta.cta_secondary_label": {
    kind: "plain",
    default: "Of bekijk eerst de pakketten",
  },
  "homepage.finalcta.micro_copy": {
    kind: "plain",
    default:
      "In de meeste gevallen heb je binnen 5 minuten een rapport in handen.",
  },
};

/** Alle content-keys voor de homepage — voor `getContentBatch`. */
export const HOMEPAGE_KEYS = Object.keys(CONTENT_META) as ContentKey[];
