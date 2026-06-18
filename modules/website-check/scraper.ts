import {
  normalizeBaseUrl,
  urlToMarkdown,
} from "@/lib/scraping/url-to-markdown";
import { getOrCreateSnapshot } from "@/lib/scraping/snapshot-service";

const MAX_CHARS = 6000;

export type ScrapeWebsiteOptions = {
  /**
   * Wanneer aanwezig: gebruik de gedeelde `markdown_snapshots` cache.
   * Zonder userId valt de functie terug op een directe, ongecachte fetch
   * (gebruikt door de anonieme gratis-check flow).
   */
  userId?: string;
  /** Time-to-live van de cache in uren. Default 24. Alleen relevant met userId. */
  ttlHours?: number;
};

/**
 * Haalt een website op en retourneert de hoofd-content als markdown (max 6000 chars).
 *
 * - Met userId: deelt cache met andere modules (icp-analyse, …) via markdown_snapshots.
 * - Zonder userId: directe call naar urlToMarkdown, geen DB-write.
 */
export async function scrapeWebsite(
  rawUrl: string,
  options: ScrapeWebsiteOptions = {}
): Promise<string> {
  const baseUrl = normalizeBaseUrl(rawUrl);

  if (options.userId) {
    const { snapshot } = await getOrCreateSnapshot({
      userId: options.userId,
      kind: "website",
      sourceUrl: baseUrl,
      ttlHours: options.ttlHours,
    });
    return snapshot.markdown.slice(0, MAX_CHARS);
  }

  const result = await urlToMarkdown(baseUrl);
  return result.markdown.slice(0, MAX_CHARS);
}
