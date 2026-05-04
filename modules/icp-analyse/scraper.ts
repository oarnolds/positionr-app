import * as cheerio from "cheerio";
import type { WebsiteSnapshot } from "./schema";

const PAGES_TO_TRY = [
  "",
  "/diensten",
  "/services",
  "/over-ons",
  "/about",
  "/cases",
  "/referenties",
];

const MAX_CHARS_PER_PAGE = 3000;
const MAX_CHARS_TOTAL = 15_000;

function normalizeBaseUrl(url: string): string {
  let n = url.trim();
  if (!/^https?:\/\//i.test(n)) n = `https://${n}`;
  return n.replace(/\/$/, "");
}

async function scrapeOnePage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Positionr/1.0 (+https://app.positionr.nl)",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();
    if (text.length < 100) return null; // skip vrijwel-lege pagina's
    return text.slice(0, MAX_CHARS_PER_PAGE);
  } catch {
    return null;
  }
}

async function fetchHomepageMetadata(baseUrl: string): Promise<{
  title: string;
  metaDescription: string;
  heroText: string;
}> {
  try {
    const res = await fetch(baseUrl, {
      headers: { "User-Agent": "Positionr/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { title: "", metaDescription: "", heroText: "" };
    const html = await res.text();
    const $ = cheerio.load(html);
    return {
      title: $("title").text().trim(),
      metaDescription:
        $('meta[name="description"]').attr("content")?.trim() ?? "",
      heroText: $("h1, h2")
        .slice(0, 3)
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean)
        .join(" | "),
    };
  } catch {
    return { title: "", metaDescription: "", heroText: "" };
  }
}

export async function scrapeForIcp(url: string): Promise<WebsiteSnapshot> {
  const base = normalizeBaseUrl(url);
  const urls = PAGES_TO_TRY.map((p) => base + p);

  const results = await Promise.allSettled(urls.map(scrapeOnePage));
  const pages = results
    .map((r, i) =>
      r.status === "fulfilled" && r.value
        ? { url: urls[i], text: r.value }
        : null
    )
    .filter((x): x is { url: string; text: string } => x !== null);

  if (pages.length === 0) {
    throw new Error(
      `Geen enkele pagina van ${base} kon worden opgehaald. Check URL.`
    );
  }

  const combined = pages
    .map((p) => `=== ${p.url} ===\n${p.text}`)
    .join("\n\n")
    .slice(0, MAX_CHARS_TOTAL);

  const homepageHtml = await fetchHomepageMetadata(base);

  return {
    url: base,
    title: homepageHtml.title,
    metaDescription: homepageHtml.metaDescription,
    heroText: homepageHtml.heroText,
    bodyExcerpt: combined,
    scrapedAt: new Date().toISOString(),
  };
}
