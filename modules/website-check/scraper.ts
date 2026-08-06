import {
  normalizeBaseUrl,
  urlToMarkdown,
} from "@/lib/scraping/url-to-markdown";
import {
  findAnySnapshot,
  getOrCreateSnapshot,
} from "@/lib/scraping/snapshot-service";

const DEFAULT_MAX_CHARS = 6000;
// Absolute bovengrens die ALTIJD geldt, ook bij maxChars=0 ("geen cap").
// Claude 1M-token context: 1 token ≈ 3 chars Nederlands. Prompt-template +
// format-example + strictness kosten ~30K tokens; markdown-budget dus ~950K
// tokens ≈ 2.8M chars. We houden ruime marge op 2M chars.
// fourtop.nl in unlimited-modus leverde een snapshot van >3M chars op wat
// omgerekend 1.1M tokens werd → 400 "prompt is too long" van Claude.
const HARD_UPPER_CHARS = 2_000_000;

export type ScrapeWebsiteOptions = {
  /**
   * Wanneer aanwezig: gebruik de gedeelde `markdown_snapshots` cache.
   * Zonder userId valt de functie terug op een directe, ongecachte fetch
   * (gebruikt door de anonieme gratis-check flow).
   */
  userId?: string;
  /** Time-to-live van de cache in uren. Default 24. Alleen relevant met userId. */
  ttlHours?: number;
  /**
   * Wanneer true: vereist een bestaande snapshot in de markdown-bibliotheek.
   * Skipt elke fetch — gooit een fout als er geen snapshot voor deze URL bestaat.
   * Gebruikt door de "Analyseer obv markdown"-knop.
   */
  requireExistingSnapshot?: boolean;
  /**
   * Wanneer true: forceer een live scrape die NIET naar de markdown_snapshots
   * cache kijkt en de DB-rij ook NIET bijwerkt. Gebruikt door "Analyseer
   * website" om een onafhankelijk pad naast "Analyseer obv markdown" te hebben
   * (zodat de twee paden eerlijk vergelijkbaar blijven).
   */
  bypassCache?: boolean;
  /** Cap op het aantal characters dat we returnen. Default 6000. Geef 0 voor 'geen cap'. */
  maxChars?: number;
};

/**
 * Haalt een website op en retourneert de hoofd-content als markdown.
 *
 * - Met userId + requireExistingSnapshot: gebruikt UITSLUITEND de bestaande
 *   bibliotheek-snapshot (geen TTL-check, geen fetch). Throwt als afwezig.
 * - Met userId zonder require: deelt cache met andere modules via getOrCreateSnapshot.
 * - Zonder userId: directe call naar urlToMarkdown, geen DB-write.
 */
export async function scrapeWebsite(
  rawUrl: string,
  options: ScrapeWebsiteOptions = {}
): Promise<string> {
  const baseUrl = normalizeBaseUrl(rawUrl);
  const cap = options.maxChars === 0 ? Infinity : options.maxChars ?? DEFAULT_MAX_CHARS;
  const effectiveCap = Math.min(Number.isFinite(cap) ? (cap as number) : Infinity, HARD_UPPER_CHARS);
  const slice = (md: string) => {
    if (md.length <= effectiveCap) return md;
    console.warn(
      `[website-check] markdown truncated from ${md.length} to ${effectiveCap} chars (HARD_UPPER_CHARS)`,
    );
    return md.slice(0, effectiveCap);
  };

  if (options.userId && options.requireExistingSnapshot) {
    const snapshot = await findAnySnapshot(options.userId, "website", baseUrl);
    if (!snapshot) {
      throw new Error(
        "Geen markdown-snapshot gevonden voor deze URL. Maak 'm eerst aan via 'Markdown bibliotheek' op /modules."
      );
    }
    return slice(snapshot.markdown);
  }

  if (options.bypassCache) {
    // Live-pad: direct urlToMarkdown, geen DB-read, geen DB-write. Bewaart
    // het onderscheid met de bibliotheek-snapshot zodat A/B-vergelijking
    // tussen "Analyseer website" en "Analyseer obv markdown" eerlijk blijft.
    // Cap op 30 pagina's: de LLM-input wordt sowieso afgekapt op
    // DEFAULT_MAX_CHARS (6000), dus meer pagina's helpen de analyse niet
    // en kosten alleen extra tijd binnen Vercel's 300s-budget.
    const result = await urlToMarkdown(baseUrl, { maxPages: 30 });
    return slice(result.markdown);
  }

  if (options.userId) {
    const { snapshot } = await getOrCreateSnapshot({
      userId: options.userId,
      kind: "website",
      sourceUrl: baseUrl,
      ttlHours: options.ttlHours,
    });
    return slice(snapshot.markdown);
  }

  const result = await urlToMarkdown(baseUrl);
  return slice(result.markdown);
}
