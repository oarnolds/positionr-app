// lib/modules/prompts.ts
//
// Module-prompt helpers: substitutie + DB-fetch met fallback.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules } from "@/lib/db/schema";
import { FALLBACK_PROMPTS } from "./fallback-prompts";
import type { ConfigProvider } from "@/lib/ai/pricing";

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

/**
 * Fetch de actieve prompt + provider voor een module uit de DB.
 * Valt terug op FALLBACK_PROMPTS als het DB-veld leeg is (defense-in-depth).
 * Gooit een Error als de module niet in de DB staat of geen fallback heeft.
 */
export async function getModulePrompt(
  slug: string,
): Promise<{ prompt: string; provider: ConfigProvider }> {
  const [row] = await db
    .select({ defaultPrompt: modules.defaultPrompt, provider: modules.provider })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);

  if (!row) throw new Error(`Module ${slug} niet in DB`);

  if (!row.defaultPrompt || row.defaultPrompt.length === 0) {
    const fallback = FALLBACK_PROMPTS[slug];
    if (!fallback) throw new Error(`Geen fallback prompt voor module ${slug}`);
    return { prompt: fallback, provider: row.provider as ConfigProvider };
  }

  return { prompt: row.defaultPrompt, provider: row.provider as ConfigProvider };
}
