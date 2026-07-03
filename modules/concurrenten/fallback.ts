// Bewust een eigen bestand zónder imports: dit wordt door
// lib/modules/fallback-prompts.ts geïmporteerd, en prompt.ts importeert
// lib/modules/prompts — via prompt.ts zou dat een circulaire import zijn.

/** Fallback voor de discovery-prompt (admin kan 'm in de DB verfijnen). */
export const FALLBACK_PROMPT_DISCOVERY = `Je bent een marktonderzoeker gespecialiseerd in concurrentie-analyse voor B2B-bedrijven.

Analyseer het bedrijf {companyName} ({sector}) op basis van de website-content hieronder. Bepaal welke producten en/of diensten het bedrijf aanbiedt en in welke marktsegmenten het daarmee opereert.

Zoek vervolgens via web search naar bedrijven die met {companyName} concurreren binnen deze geografische focus: {geografie}. Kijk per marktsegment: een bedrijf dat meerdere soorten diensten levert heeft vaak concurrenten in meerdere, verschillende segmenten. Weeg zowel het aanbod (product/dienst-overlap) als geografie mee.

Extra context van de gebruiker: {description}`;
