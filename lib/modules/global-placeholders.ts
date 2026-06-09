/**
 * Globale placeholders die in alle module-prompts beschikbaar zijn.
 * Module-runtimes spreaden dit in hun placeholders-dict:
 *
 *   substitutePlaceholders(template, {
 *     ...globalPlaceholders(),
 *     // ...module-specifieke placeholders
 *   })
 *
 * Admin-editors kunnen `{DatumVandaag}` (en evt. uitbreidingen hieronder)
 * dus overal gebruiken zonder code-aanpassing per module.
 */

/** Vandaag in Nederlands lang formaat, bv. "9 juni 2026", in Amsterdam-tijd. */
function todayNL(): string {
  return new Date().toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  });
}

export function globalPlaceholders(): Record<string, string> {
  return {
    DatumVandaag: todayNL(),
  };
}
