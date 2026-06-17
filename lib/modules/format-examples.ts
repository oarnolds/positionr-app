import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules } from "@/lib/db/schema";

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Leest het format-template (markdown) voor een module uit de DB.
 * Returnt null als de slug ongeldig is, de module niet bestaat, of
 * `format_example` op die rij null is.
 */
export async function getFormatExample(slug: string): Promise<string | null> {
  if (!SLUG_RE.test(slug)) return null;
  const rows = await db
    .select({ formatExample: modules.formatExample })
    .from(modules)
    .where(eq(modules.slug, slug));
  if (rows.length === 0) return null;
  return rows[0].formatExample ?? null;
}
