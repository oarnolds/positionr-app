// lib/modules/strictness.ts
//
// Globale beoordelingsstrengheid voor scorende modules (nu alleen
// website-check). De 1-5 waarde staat op de modules-rij; hier leeft de
// betekenis: labels + de kalibratie-instructie die bij het genereren in de
// prompt wordt geprikt. Bewust NIET in de bewerkbare prompt, zodat de dial
// altijd werkt, ook als de prompt-tekst wijzigt.

export const MIN_STRICTNESS = 1;
export const MAX_STRICTNESS = 5;
export const DEFAULT_STRICTNESS = 3;

export type StrictnessLevel = 1 | 2 | 3 | 4 | 5;

export const STRICTNESS_LABELS: Record<StrictnessLevel, string> = {
  1: "Mild",
  2: "Iets milder",
  3: "Evenwichtig",
  4: "Streng",
  5: "Zeer streng",
};

const LEVEL_INSTRUCTIONS: Record<StrictnessLevel, string> = {
  1: "Beoordeel welwillend en bemoedigend. Waardeer nadrukkelijk wat er goed is en geef de website het voordeel van de twijfel. Geef alleen een cijfer onder de 4 als een onderdeel echt ontbreekt. Formuleer verbeterpunten als aanmoediging, niet als kritiek.",
  2: "Beoordeel mild. Leg de nadruk op wat werkt en benoem gebreken zacht en constructief. Wees eerder gul dan streng met de cijfers.",
  3: "Beoordeel evenwichtig. Benoem sterke en zwakke punten eerlijk, zonder te vleien en zonder af te kraken. Een gemiddelde website krijgt gemiddelde cijfers.",
  4: "Beoordeel streng. Leg de lat hoog: een cijfer van 8 of hoger moet verdiend zijn met concreet, zichtbaar bewijs. Wees kritisch op vage beloftes, ontbrekend bewijs en onduidelijke taal. Een gemiddelde website krijgt eerder een matig cijfer.",
  5: "Beoordeel zeer streng, als een veeleisende expert. Geef een 8 of hoger alleen bij uitmuntende, aantoonbaar bewezen uitvoering. Twijfel telt in het nadeel van het cijfer. Benoem elk gemis scherp, maar blijf respectvol en zakelijk.",
};

const SHARED_GUARDRAIL =
  "Deze twee regels gelden ongeacht de gekozen strengheid: (1) gerichte vaktaal of branchebeeld die de juiste koper aanspreekt en de verkeerde afschrikt is een plus, geen minpunt; (2) content die niet geladen kon worden (zoals de contactpagina of klantcases) krijgt een voorzichtige score, geen afstraffing. Strengheid scherpt alleen het oordeel over wat wél zichtbaar is.";

/** Rondt af naar heel getal en klemt in [1,5]. NaN/oneindig → default 3. */
export function clampStrictness(value: number): StrictnessLevel {
  if (!Number.isFinite(value)) return DEFAULT_STRICTNESS;
  const rounded = Math.round(value);
  const clamped = Math.min(MAX_STRICTNESS, Math.max(MIN_STRICTNESS, rounded));
  return clamped as StrictnessLevel;
}

/** Kort label voor de admin-UI, bv. "Evenwichtig". */
export function strictnessLabel(value: number): string {
  return STRICTNESS_LABELS[clampStrictness(value)];
}

/** Niveau-instructie + gedeelde grens, klaar om in de prompt te prikken. */
export function strictnessInstruction(value: number): string {
  const level = clampStrictness(value);
  return `${LEVEL_INSTRUCTIONS[level]}\n\n${SHARED_GUARDRAIL}`;
}
