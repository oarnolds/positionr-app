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

// De TOON van de geschreven toelichting schuift mee met de stand; de cijfers
// zelf blijven op één vaste maatstaf (NEUTRAL_SCORING). De numerieke strengheid
// wordt deterministisch verrekend via strictnessScoreOffset — niet door het
// model — zodat de stappen voorspelbaar ~0,5 op het totaalcijfer zijn.
const LEVEL_TONE: Record<StrictnessLevel, string> = {
  1: "welwillend en bemoedigend",
  2: "mild en constructief",
  3: "neutraal en evenwichtig",
  4: "kritisch en zakelijk",
  5: "streng en veeleisend",
};

// Cijferverschuiving per stand t.o.v. neutraal (stand 3 = 0). Wordt in code op
// de onderdeelcijfers toegepast; het gemiddelde schuift zo mee. Elke stap
// scheelt 0,5 op het totaalcijfer.
const SCORE_OFFSETS: Record<StrictnessLevel, number> = {
  1: 1,
  2: 0.5,
  3: 0,
  4: -0.5,
  5: -1,
};

const NEUTRAL_SCORING =
  "Beoordeel de cijfers zelf op een vaste, eerlijke maatstaf, ongeacht de toon: een gemiddelde, degelijke website komt rond een 6 à 7 uit. Geef een 8 of hoger alleen bij uitmuntend, aantoonbaar bewezen werk, en een cijfer onder de 5 bij duidelijke gebreken.";

const SHARED_GUARDRAIL =
  "Twee vaste regels bij het beoordelen: (1) gerichte vaktaal of branchebeeld die de juiste koper aanspreekt en de verkeerde afschrikt is een plus, geen minpunt; (2) content die niet geladen kon worden (zoals de contactpagina of klantcases) krijgt een voorzichtige score, geen afstraffing.";

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

/**
 * Cijferverschuiving (t.o.v. neutraal) die in code op de onderdeelcijfers wordt
 * toegepast. Stand 3 = 0; elke stap = 0,5 op het totaalcijfer.
 */
export function strictnessScoreOffset(value: number): number {
  return SCORE_OFFSETS[clampStrictness(value)];
}

/**
 * Prompt-injectie: stuurt de TOON van de toelichting en zet de cijfers op één
 * vaste maatstaf. De numerieke strengheid gaat via strictnessScoreOffset, dus
 * het model hoeft de cijfers niet zelf te verschuiven.
 */
export function strictnessInstruction(value: number): string {
  const level = clampStrictness(value);
  return [
    `Schrijf de toelichting bij elk onderdeel in een ${LEVEL_TONE[level]} toon.`,
    NEUTRAL_SCORING,
    SHARED_GUARDRAIL,
  ].join("\n\n");
}
