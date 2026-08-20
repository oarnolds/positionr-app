import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { siteContent } from "@/lib/db/schema";
import { CONTENT_META, type ContentKey } from "./registry";

/**
 * Haalt één content-waarde op. Valt terug op default uit CONTENT_META
 * als de key niet in `site_content` staat.
 */
export async function getContent(key: ContentKey): Promise<string> {
  const rows = await db
    .select({ value: siteContent.value })
    .from(siteContent)
    .where(eq(siteContent.key, key))
    .limit(1);
  return rows[0]?.value ?? CONTENT_META[key].default;
}

/**
 * Haalt meerdere content-waarden in één query op. Elke key krijgt of de
 * DB-waarde of de default terug. Efficiënt voor page-render (1 query
 * voor de hele pagina i.p.v. per-sectie).
 */
export async function getContentBatch<K extends ContentKey>(
  keys: readonly K[],
): Promise<Record<K, string>> {
  if (keys.length === 0) return {} as Record<K, string>;
  const rows = await db
    .select({ key: siteContent.key, value: siteContent.value })
    .from(siteContent)
    .where(inArray(siteContent.key, keys as unknown as string[]));
  const dbMap = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<K, string>;
  for (const k of keys) {
    out[k] = dbMap.get(k) ?? CONTENT_META[k].default;
  }
  return out;
}
