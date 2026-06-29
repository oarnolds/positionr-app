import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT = "PositionrBot/1.0 (+https://app.positionr.nl)";

const SITEMAP_CANDIDATES = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap-index.xml",
];

async function fetchText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml,*/*" },
        redirect: "follow",
      });
      if (!res.ok) return null;
      return await res.text();
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}

function parseSitemapXml(xml: string): { urls: string[]; nestedSitemaps: string[] } {
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls: string[] = [];
  const nestedSitemaps: string[] = [];

  $("urlset > url > loc").each((_, el) => {
    const text = $(el).text().trim();
    if (text) urls.push(text);
  });
  $("sitemapindex > sitemap > loc").each((_, el) => {
    const text = $(el).text().trim();
    if (text) nestedSitemaps.push(text);
  });

  return { urls, nestedSitemaps };
}

function sameOrigin(url: string, baseOrigin: string): boolean {
  try {
    return new URL(url).origin === baseOrigin;
  } catch {
    return false;
  }
}

/**
 * Probeert de sitemap(s) van een site te vinden en levert een set absolute
 * URLs op same-origin. Volgt sitemap-indexes 1 niveau diep. Returnt een lege
 * lijst als geen sitemap te vinden of bruikbaar is.
 */
export async function discoverSitemapUrls(
  baseUrl: string,
  options: { maxUrls?: number } = {}
): Promise<string[]> {
  const maxUrls = options.maxUrls ?? 200;
  const baseOrigin = new URL(baseUrl).origin;

  let sitemapXml: string | null = null;
  for (const candidate of SITEMAP_CANDIDATES) {
    sitemapXml = await fetchText(baseOrigin + candidate);
    if (sitemapXml) break;
  }
  if (!sitemapXml) return [];

  const collected = new Set<string>();
  const initial = parseSitemapXml(sitemapXml);

  for (const u of initial.urls) {
    if (sameOrigin(u, baseOrigin)) collected.add(u);
    if (collected.size >= maxUrls) return Array.from(collected);
  }

  for (const childUrl of initial.nestedSitemaps.slice(0, 5)) {
    if (collected.size >= maxUrls) break;
    if (!sameOrigin(childUrl, baseOrigin)) continue;
    const childXml = await fetchText(childUrl);
    if (!childXml) continue;
    const child = parseSitemapXml(childXml);
    for (const u of child.urls) {
      if (sameOrigin(u, baseOrigin)) collected.add(u);
      if (collected.size >= maxUrls) break;
    }
  }

  return Array.from(collected);
}
