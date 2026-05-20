const MAX_CHARS = 6000;
const FETCH_TIMEOUT_MS = 12_000;

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function scrapeWebsite(rawUrl: string): Promise<string> {
  const url = normalizeUrl(rawUrl);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PositionrBot/1.0 (+https://positionr.nl)" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Fetch faalde: HTTP ${res.status}`);
    const html = await res.text();
    const text = htmlToText(html);
    if (!text) throw new Error("Geen bruikbare tekst gevonden");
    return text.slice(0, MAX_CHARS);
  } finally {
    clearTimeout(t);
  }
}
