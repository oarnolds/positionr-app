import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_CHARS_PER_PAGE = 8_000;
const MAX_CHARS_TOTAL = 24_000;
const USER_AGENT = "PositionrBot/1.0 (+https://app.positionr.nl)";

const DEFAULT_PATHS = [
  "",
  "/diensten",
  "/services",
  "/over-ons",
  "/about",
  "/cases",
  "/referenties",
];

export type PageResult = {
  url: string;
  status: "ok" | "failed" | "empty";
  charCount: number;
  errorMessage?: string;
};

export type UrlMarkdownResult = {
  baseUrl: string;
  title: string;
  metaDescription: string;
  markdown: string;
  pages: PageResult[];
};

export type UrlToMarkdownOptions = {
  /** Extra paden bovenop de homepage. Default: een handvol veelvoorkomende NL/EN paden. */
  paths?: string[];
  /** Alleen de homepage proberen (overschrijft paths). */
  singlePage?: boolean;
};

export function normalizeBaseUrl(url: string): string {
  let n = url.trim();
  if (!/^https?:\/\//i.test(n)) n = `https://${n}`;
  return n.replace(/\/$/, "");
}

function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  td.use(gfm);
  td.remove(["script", "style", "noscript", "iframe"]);
  return td;
}

/**
 * Isoleer de "main content" uit een HTML-document. Probeert in volgorde:
 *   <main>, <article>, .content/#content, anders <body> minus nav/footer/aside.
 */
function extractMainHtml($: cheerio.CheerioAPI): string {
  $("script, style, noscript, iframe, svg, nav, footer, aside, header").remove();

  const candidates = ["main", "article", "[role=main]", "#content", ".content"];
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length && el.html()?.trim()) {
      return el.html() ?? "";
    }
  }
  return $("body").html() ?? "";
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function pageToMarkdown(
  url: string,
  turndown: TurndownService
): Promise<{ markdown: string; title: string; metaDescription: string } | null> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ?? "";

  const mainHtml = extractMainHtml($);
  if (!mainHtml.trim()) return null;

  const md = turndown
    .turndown(mainHtml)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!md) return null;

  return {
    markdown: md.slice(0, MAX_CHARS_PER_PAGE),
    title,
    metaDescription,
  };
}

/**
 * Fetcht een URL (en optioneel een handvol gerelateerde subpaths) en converteert
 * de hoofd-content naar markdown. Pure functie — geen DB, geen caching.
 */
export async function urlToMarkdown(
  rawUrl: string,
  options: UrlToMarkdownOptions = {}
): Promise<UrlMarkdownResult> {
  const baseUrl = normalizeBaseUrl(rawUrl);
  const paths = options.singlePage ? [""] : options.paths ?? DEFAULT_PATHS;
  const urls = paths.map((p) => baseUrl + p);
  const turndown = createTurndown();

  const settled = await Promise.allSettled(
    urls.map((u) => pageToMarkdown(u, turndown))
  );

  const pages: PageResult[] = [];
  const sections: string[] = [];
  let firstTitle = "";
  let firstMetaDescription = "";

  settled.forEach((r, i) => {
    const url = urls[i];
    if (r.status === "rejected") {
      pages.push({
        url,
        status: "failed",
        charCount: 0,
        errorMessage: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
      return;
    }
    if (!r.value) {
      pages.push({ url, status: "empty", charCount: 0 });
      return;
    }
    const { markdown, title, metaDescription } = r.value;
    if (i === 0) {
      firstTitle = title;
      firstMetaDescription = metaDescription;
    } else if (!firstTitle && title) {
      firstTitle = title;
    }
    pages.push({ url, status: "ok", charCount: markdown.length });
    sections.push(`# ${url}\n\n${markdown}`);
  });

  if (sections.length === 0) {
    throw new Error(`Geen enkele pagina van ${baseUrl} kon worden opgehaald.`);
  }

  const markdown = sections.join("\n\n---\n\n").slice(0, MAX_CHARS_TOTAL);

  return {
    baseUrl,
    title: firstTitle,
    metaDescription: firstMetaDescription,
    markdown,
    pages,
  };
}
