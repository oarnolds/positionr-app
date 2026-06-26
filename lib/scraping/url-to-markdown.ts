import { randomUUID } from "node:crypto";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import {
  describeImageUrls,
  type DescriptionMap,
  type UrlImageInput,
} from "./image-description";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_CHARS_PER_PAGE = 8_000;
const MAX_CHARS_TOTAL = 24_000;
const USER_AGENT = "PositionrBot/1.0 (+https://app.positionr.nl)";
const MAX_IMAGES_PER_PAGE = 25;

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
  /**
   * Wanneer true (default): afbeeldingen worden opgehaald en door Claude vision
   * beschreven, daarna in de markdown ingevoegd. Wanneer false: img-tags worden
   * gewoon weggegooid (sneller, gratis).
   */
  includeImages?: boolean;
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
      placeholder = `__IMG_PH_${randomUUID().replace(/-/g, "")}__`;
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
  const html = await fetchHtml(url);
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

export async function urlToMarkdown(
  rawUrl: string,
  options: UrlToMarkdownOptions = {}
): Promise<UrlMarkdownResult> {
  const baseUrl = normalizeBaseUrl(rawUrl);
  const paths = options.singlePage ? [""] : options.paths ?? DEFAULT_PATHS;
  const urls = paths.map((p) => baseUrl + p);
  const turndown = createTurndown();
  const includeImages = options.includeImages !== false;

  const settled = await Promise.allSettled(
    urls.map((u) => pageToMarkdown(u, turndown, includeImages))
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
    const finalMd = withImages.slice(0, MAX_CHARS_PER_PAGE);
    if (i === 0) {
      firstTitle = title;
      firstMetaDescription = metaDescription;
    } else if (!firstTitle && title) {
      firstTitle = title;
    }
    pages.push({ url, status: "ok", charCount: finalMd.length });
    sections.push(`# ${url}\n\n${finalMd}`);
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
