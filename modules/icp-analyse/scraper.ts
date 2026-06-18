import type { WebsiteSnapshot } from "./schema";
import { getOrCreateSnapshot } from "@/lib/scraping/snapshot-service";

const MAX_BODY_CHARS = 15_000;

/**
 * Extraheert de eerste handvol koppen uit een markdown-string als "hero text".
 * Vroeger werd dit uit `<h1>`/`<h2>` van de homepage gehaald; nu komt het uit
 * de markdown van de gedeelde snapshot (zelfde semantiek, andere bron).
 */
function extractHeroFromMarkdown(markdown: string): string {
  const lines = markdown.split("\n");
  const headings: string[] = [];
  for (const line of lines) {
    const m = /^#{1,3}\s+(.+)$/.exec(line.trim());
    if (m) {
      const text = m[1].trim();
      if (text.startsWith("http")) continue;
      if (headings.includes(text)) continue;
      headings.push(text);
      if (headings.length >= 3) break;
    }
  }
  return headings.join(" | ");
}

/**
 * Bouwt een ICP-snapshot uit de gedeelde markdown-cache. De cache wordt per
 * (userId, kind, sourceUrl) bijgehouden en gedeeld met andere modules
 * (bv. website-check) zodat dezelfde URL niet meermaals gescraped wordt.
 */
export async function scrapeForIcp(
  url: string,
  userId: string
): Promise<WebsiteSnapshot> {
  const { snapshot } = await getOrCreateSnapshot({
    userId,
    kind: "website",
    sourceUrl: url,
  });

  return {
    url: snapshot.sourceUrl,
    title: snapshot.title ?? "",
    metaDescription: snapshot.metaDescription ?? "",
    heroText: extractHeroFromMarkdown(snapshot.markdown),
    bodyExcerpt: snapshot.markdown.slice(0, MAX_BODY_CHARS),
    scrapedAt: snapshot.fetchedAt.toISOString(),
  };
}
