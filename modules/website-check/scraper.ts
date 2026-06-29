import {
  normalizeBaseUrl,
  urlToMarkdown,
} from "@/lib/scraping/url-to-markdown";
import {
  findAnySnapshot,
  getOrCreateSnapshot,
} from "@/lib/scraping/snapshot-service";

const DEFAULT_MAX_CHARS = 6000;

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
  const slice = (md: string) => (Number.isFinite(cap) ? md.slice(0, cap as number) : md);

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
    const result = await urlToMarkdown(baseUrl);
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
