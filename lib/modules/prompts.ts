// lib/modules/prompts.ts
//
// Module-prompt helpers: substitutie + DB-fetch met fallback.

/**
 * Vervang `{naam}`-placeholders in `template` door waarden uit `values`.
 * Missende variabelen blijven als `{naam}` in de output staan zodat admin
 * direct ziet welke placeholder ontbreekt in een test-run.
 */
export function substitutePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : `{${key}}`,
  );
}
