import { randomUUID } from "node:crypto";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import {
  describeImageUrls,
  type DescriptionMap,
  type UrlImageInput,
} from "./image-description";
import { discoverSitemapUrls } from "./sitemap";

const FETCH_TIMEOUT_MS = 12_000;
// Default-caps voor een rijke bibliotheek-snapshot. Met `unlimited: true`
// worden alle drie de caps in feite uitgezet (zie urlToMarkdown).
const MAX_CHARS_PER_PAGE = 50_000;
const MAX_CHARS_TOTAL = 1_000_000;
const USER_AGENT = "PositionrBot/1.0 (+https://app.positionr.nl)";
const MAX_IMAGES_PER_PAGE = 25;
const DEFAULT_MAX_PAGES = 200;

const DEFAULT_PATHS = [
  "",
  "/diensten",
  "/services",
  "/oplossingen",
  "/wat-we-doen",
  "/producten",
  "/over-ons",
  "/about",
  "/werkwijze",
  "/aanpak",
  "/proces",
  "/cases",
  "/klantcases",
  "/klanten",
  "/referenties",
  "/portfolio",
  "/blog",
  "/nieuws",
  "/kennis",
  "/contact",
  "/contact-us",
];

/** Selectors voor cookie-/consent-banners en chat-widgets. extractMainHtml
 *  verwijdert deze vóór de main-content wordt gepakt; voorkomt dat
 *  "Wij gebruiken cookies om..."-tekst in de markdown belandt. */
const NOISE_SELECTORS = [
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="consent" i]',
  '[class*="consent" i]',
  '[id*="onetrust" i]',
  '[class*="onetrust" i]',
  '[id*="cookiebot" i]',
  '[class*="cookiebot" i]',
  '[class*="gdpr" i]',
  '[aria-label*="cookie" i]',
  '[aria-label*="consent" i]',
  '[role="dialog"][aria-modal="true"]',
  '#hs-eu-cookie-confirmation',
  '#osano-cm-window',
  '.cc-window',
  '[id*="chat-widget" i]',
  '[class*="chat-widget" i]',
  '[class*="intercom" i]',
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
  /** Override-paden (relatieve segmenten). Skipt sitemap-discovery. */
  paths?: string[];
  /** Alleen de homepage proberen (overschrijft paths en sitemap). */
  singlePage?: boolean;
  /**
   * Wanneer true (default): afbeeldingen worden opgehaald en door Claude vision
   * beschreven, daarna in de markdown ingevoegd. Wanneer false: img-tags worden
   * gewoon weggegooid (sneller, gratis).
   */
  includeImages?: boolean;
  /**
   * Wanneer true (default): probeer sitemap.xml te lezen voor een complete
   * paginalijst. Valt terug op DEFAULT_PATHS als geen sitemap gevonden wordt.
   */
  useSitemap?: boolean;
  /** Max aantal pagina's om op te halen (default 200). */
  maxPages?: number;
  /**
   * Wanneer true: schakel alle character-caps uit (per pagina én totaal) en
   * maxPages naar 10.000 zodat álles wat in de sitemap zit meekomt. Bedoeld
   * voor de "Alle pagina's meenemen"-checkbox in de Maak markdown UI.
   * Kan minutenlang duren en flink wat vision-tokens vreten.
   */
  unlimited?: boolean;
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

function extractMainHtml($: cheerio.CheerioAPI): string {
  $("script, style, noscript, iframe, svg, nav, footer, aside, header").remove();
  $(NOISE_SELECTORS.join(",")).remove();

  const textLength = (el: ReturnType<typeof $>): number =>
    el.text().replace(/\s+/g, " ").trim().length;

  // Niet de eerste matchende kandidaat pakken maar de tekst-rijkste:
  // themes zonder <main> hebben vaak losse <article>-teaser-kaartjes
  // (blog-widgets) die anders de hele pagina verdringen — zie de
  // biqql.com-case waar 96% van de sectorpagina's zo verloren ging.
  // <article> telt alleen mee als er precies één op de pagina staat;
  // meerdere articles zijn vrijwel altijd teaser-kaartjes.
  const candidates = ["main", "[role=main]", "#content", ".content", "article"];
  let best: { html: string; textLen: number } | null = null;
  for (const sel of candidates) {
    const all = $(sel);
    if (!all.length) continue;
    if (sel === "article" && all.length !== 1) continue;
    const el = all.first();
    const html = el.html()?.trim();
    if (!html) continue;
    const textLen = textLength(el);
    if (!best || textLen > best.textLen) best = { html, textLen };
  }

  // Vangnet: dekt zelfs de beste kandidaat minder dan de helft van de
  // (al opgeschoonde) body-tekst, dan is het vermoedelijk een fragment —
  // ontbrekende inhoud is voor de analyse schadelijker dan wat extra ruis.
  const bodyTextLen = textLength($("body"));
  if (best && best.textLen >= bodyTextLen / 2) return best.html;
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

/** Eén retry na 1500ms voor 429-responses (W3 Total Cache, Cloudflare etc.). */
async function fetchHtmlWithRetry(url: string): Promise<string> {
  try {
    return await fetchHtml(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/HTTP 429/.test(msg)) {
      await new Promise((r) => setTimeout(r, 1500));
      return fetchHtml(url);
    }
    throw err;
  }
}

const FETCH_CONCURRENCY = 5;

/** Werker-pool-stijl mapper die maximaal `limit` taken parallel uitvoert.
 *  Behoudt input-order in het results-array, zodat downstream-code dezelfde
 *  zip-met-urls-loop kan gebruiken als met Promise.allSettled. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function resolveImageUrl(src: string, pageUrl: string): string | null {
  try {
    if (src.startsWith("data:")) return null;
    return new URL(src, pageUrl).toString();
  } catch {
    return null;
  }
}

function shouldSkipImage(
  attrs: { width?: string; height?: string; ariaHidden?: string },
  src: string
): boolean {
  if (src.endsWith(".svg") || src.includes(".svg?")) return true; // Claude vision ondersteunt geen SVG
  const w = parseInt(attrs.width ?? "", 10);
  const h = parseInt(attrs.height ?? "", 10);
  if (!Number.isNaN(w) && w < 50) return true;
  if (!Number.isNaN(h) && h < 50) return true;
  if (attrs.ariaHidden === "true") return true;
  return false;
}

/**
 * Vervangt elke <img> door een tekst-placeholder in de HTML, en geeft de
 * verzameling images terug zodat de caller ze kan beschrijven en de
 * placeholders weer kan vervangen.
 */
function extractImages(
  $: cheerio.CheerioAPI,
  pageUrl: string
): { images: UrlImageInput[]; placeholderByUrl: Map<string, string> } {
  const placeholderByUrl = new Map<string, string>();
  const images: UrlImageInput[] = [];

  $("img").each((_, el) => {
    if (images.length >= MAX_IMAGES_PER_PAGE) {
      $(el).remove();
      return;
    }
    const $el = $(el);
    const rawSrc = $el.attr("src") ?? $el.attr("data-src") ?? "";
    if (!rawSrc) {
      $el.remove();
      return;
    }
    const resolved = resolveImageUrl(rawSrc, pageUrl);
    if (
      !resolved ||
      shouldSkipImage(
        {
          width: $el.attr("width"),
          height: $el.attr("height"),
          ariaHidden: $el.attr("aria-hidden"),
        },
        resolved
      )
    ) {
      $el.remove();
      return;
    }
    let placeholder = placeholderByUrl.get(resolved);
    if (!placeholder) {
      // Alleen alfanumerieke tekens — turndown escapt `_`, `*`, `[` etc.
      // tot `\_`, waardoor de inject-stap z'n eigen placeholder niet meer
      // herkent. `IMGPH...` overleeft turndown ongeschonden.
      placeholder = `IMGPH${randomUUID().replace(/-/g, "")}`;
      placeholderByUrl.set(resolved, placeholder);
      images.push({
        key: resolved,
        url: resolved,
        alt: $el.attr("alt") ?? undefined,
      });
    }
    $el.replaceWith(` ${placeholder} `);
  });

  return { images, placeholderByUrl };
}

function injectDescriptions(
  markdown: string,
  placeholderByUrl: Map<string, string>,
  descriptions: DescriptionMap
): string {
  let result = markdown;
  for (const [url, placeholder] of placeholderByUrl) {
    const desc = descriptions.get(url);
    const replacement = desc ? desc : "";
    // Vervang ALLE voorkomens (zelfde logo kan op meerdere posities staan).
    result = result.split(placeholder).join(replacement);
  }
  // Schoonmaken: meerdere lege regels samenvoegen.
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

async function pageToMarkdown(
  url: string,
  turndown: TurndownService,
  includeImages: boolean
): Promise<{
  markdown: string;
  title: string;
  metaDescription: string;
  images: UrlImageInput[];
  placeholderByUrl: Map<string, string>;
} | null> {
  const html = await fetchHtmlWithRetry(url);
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ?? "";

  const mainHtml = extractMainHtml($);
  if (!mainHtml.trim()) return null;

  const main$ = cheerio.load(mainHtml, null, false);
  let images: UrlImageInput[] = [];
  let placeholderByUrl = new Map<string, string>();

  if (includeImages) {
    const extracted = extractImages(main$, url);
    images = extracted.images;
    placeholderByUrl = extracted.placeholderByUrl;
  } else {
    main$("img").remove();
  }

  const processedHtml = main$.html();
  const md = turndown
    .turndown(processedHtml)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!md) return null;

  return {
    markdown: md,
    title,
    metaDescription,
    images,
    placeholderByUrl,
  };
}

async function resolveTargetUrls(
  baseUrl: string,
  options: UrlToMarkdownOptions
): Promise<string[]> {
  if (options.singlePage) return [baseUrl];
  if (options.paths) return options.paths.map((p) => baseUrl + p);

  const maxPages = options.unlimited
    ? 10_000
    : options.maxPages ?? DEFAULT_MAX_PAGES;
  if (options.useSitemap !== false) {
    const sitemapUrls = await discoverSitemapUrls(baseUrl, { maxUrls: maxPages });
    if (sitemapUrls.length > 0) {
      const homepage = baseUrl;
      const set = new Set<string>([homepage, ...sitemapUrls]);
      return Array.from(set).slice(0, maxPages);
    }
  }
  return DEFAULT_PATHS.map((p) => baseUrl + p).slice(0, maxPages);
}

export async function urlToMarkdown(
  rawUrl: string,
  options: UrlToMarkdownOptions = {}
): Promise<UrlMarkdownResult> {
  const baseUrl = normalizeBaseUrl(rawUrl);
  const urls = await resolveTargetUrls(baseUrl, options);
  const turndown = createTurndown();
  const includeImages = options.includeImages !== false;
  // Caps optioneel uitschakelen voor "alle pagina's"-modus.
  const perPageCap = options.unlimited ? Infinity : MAX_CHARS_PER_PAGE;
  const totalCap = options.unlimited ? Infinity : MAX_CHARS_TOTAL;

  // Concurrency-limit voorkomt HTTP 429 rate-limiting bij sites met
  // W3 Total Cache / Cloudflare / vergelijkbare front-ends. Met 50 parallelle
  // requests werden bij nleyes.com ~70% van de pagina's geblokkeerd.
  const settled = await mapWithConcurrency(urls, FETCH_CONCURRENCY, (u) =>
    pageToMarkdown(u, turndown, includeImages),
  );

  // Verzamel alle unique images uit alle pagina's voor één enkele vision-batch
  // (dedup over pagina's heen — hetzelfde logo komt op meerdere pagina's voor).
  const allImagesByUrl = new Map<string, UrlImageInput>();
  for (const r of settled) {
    if (r.status !== "fulfilled" || !r.value) continue;
    for (const img of r.value.images) {
      if (!allImagesByUrl.has(img.url)) allImagesByUrl.set(img.url, img);
    }
  }
  const descriptions = includeImages
    ? await describeImageUrls(Array.from(allImagesByUrl.values()))
    : (new Map() as DescriptionMap);

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
    const { markdown, title, metaDescription, placeholderByUrl } = r.value;
    const withImages = injectDescriptions(markdown, placeholderByUrl, descriptions);
    const finalMd = Number.isFinite(perPageCap)
      ? withImages.slice(0, perPageCap as number)
      : withImages;
    if (i === 0) {
      firstTitle = title;
      firstMetaDescription = metaDescription;
    } else if (!firstTitle && title) {
      firstTitle = title;
    }
    pages.push({ url, status: "ok", charCount: finalMd.length });
    // Sectie-format met expliciete "=== PAGINA: ===" marker + titel.
    // Een markdown-heading blijft op zijn plek in finalMd (uit het HTML→MD-
    // proces) zodat de RAG-chunker per-pagina nog steeds boundaries vindt.
    const titleLine = title ? `Titel: ${title}\n\n` : "";
    sections.push(`=== PAGINA: ${url} ===\n${titleLine}${finalMd}`);
  });

  if (sections.length === 0) {
    throw new Error(`Geen enkele pagina van ${baseUrl} kon worden opgehaald.`);
  }

  // Frontmatter: gevonden + ontbrekende pagina's. Geeft de analyse-prompt
  // expliciet zicht op wat wel/niet beschikbaar was zodat 'ie eerlijk kan
  // zeggen "contactpagina niet meegescraped" i.p.v. te gokken.
  const okPages = pages.filter((p) => p.status === "ok");
  const failedPages = pages.filter((p) => p.status !== "ok");
  const scrapeDate = new Date().toISOString().slice(0, 10);
  const frontmatterLines = [
    "---",
    `website_url: ${baseUrl}`,
    `scrape_datum: ${scrapeDate}`,
    `titel: ${firstTitle || "(onbekend)"}`,
    `aantal_paginas: ${okPages.length}`,
    "gevonden_paginas:",
    ...okPages.map((p) => `  - ${p.url}`),
    ...(failedPages.length
      ? [
          "ontbrekende_paginas:",
          ...failedPages.map((p) => {
            const reason = p.errorMessage ?? (p.status === "empty" ? "lege pagina" : "onbekend");
            return `  - ${p.url} (${reason})`;
          }),
        ]
      : []),
    "---",
    "",
  ];
  const frontmatter = frontmatterLines.join("\n");

  const joined = frontmatter + sections.join("\n\n");
  const markdown = Number.isFinite(totalCap)
    ? joined.slice(0, totalCap as number)
    : joined;

  return {
    baseUrl,
    title: firstTitle,
    metaDescription: firstMetaDescription,
    markdown,
    pages,
  };
}
