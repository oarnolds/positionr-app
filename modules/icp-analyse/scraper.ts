import * as cheerio from "cheerio";
import type { WebsiteSnapshot } from "./schema";

export async function scrapeForIcp(url: string): Promise<WebsiteSnapshot> {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  let res: Response;
  try {
    res = await fetch(normalized, {
      headers: { "User-Agent": "Positionr/1.0 (+https://app.positionr.nl)" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new Error(`Kon ${normalized} niet ophalen: ${(e as Error).message}`);
  }

  if (!res.ok) {
    throw new Error(`${normalized} gaf HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $("title").text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ?? "";

  const heroText = $("h1, h2")
    .slice(0, 3)
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join(" | ");

  // Strip scripts/styles, neem body, comprimeer whitespace, limit
  $("script, style, noscript").remove();
  const bodyExcerpt = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  return {
    url: normalized,
    title,
    metaDescription,
    heroText,
    bodyExcerpt,
    scrapedAt: new Date().toISOString(),
  };
}
