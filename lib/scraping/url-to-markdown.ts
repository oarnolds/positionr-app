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
// Hard cap op unieke images over de HELE scrape, óók in unlimited-modus.
// Boven ~150 leveren extra images vrijwel geen analyse-signaal op (veel
// dubbele logo's, decoratieve elementen); wél ~8s Vision-tijd per 8 images.
// Bij fourtop.nl leverde de scrape 488 unieke images op = 61 Vision-batches
// = veel meer dan het 180s serverless-budget zonder deze cap.
const MAX_UNIQUE_IMAGES_TOTAL = 150;

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

/**
 * Herkent pagina's die er verouderd/gearchiveerd uitzien aan hun URL-pad
 * (segmenten of -suffixen als "oud", "old", "archief", "archive"). Die
 * worden niet mee-gescraped — verouderde content vervuilt de analysebron —
 * maar wel in de frontmatter genoteerd: dat ze nog live staan is een
 * mogelijk technisch verbeterpunt voor de klant.
 */
export function isLegacyUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /(^|[/\-_])(oud|old|archief|archive)([/\-_]|$)/i.test(path);
  } catch {
    return false;
  }
}

/**
 * Herkent sub-pagina's van een blog/nieuws-sectie aan hun URL-pad:
 *   /blog/ergens  → true (sub-pagina, SKIP)
 *   /blog          → false (index-pagina, KEEP)
 *
 * De MD-snapshot is bedoeld voor een algemene indruk van de bedrijfsopzet
 * en actualiteit. Individuele blogposts verdunnen de analysebron (en tellen
 * fors op in Vision-kosten + Claude-tokenbudget) zonder veel signaal toe te
 * voegen. Index-pagina's zelf blijven staan: die laten zien of het bedrijf
 * überhaupt actief publiceert en waar het over gaat.
 *
 * Case-studies, kennisbank-artikelen en publicaties (cases/klantcases/kennis)
 * worden BEWUST NIET geskipt — die zijn juist waardevol voor B2B-positionering.
 */
export function isBlogSubpage(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /^\/(blog|nieuws|news|artikelen|articles|posts|post|insights|updates)\/[^/]/i.test(
      path,
    );
  } catch {
    return false;
  }
}

export type MenuLink = { label: string; href: string };

// Kandidaat-selectors voor het PRIMAIRE menu, op prioriteit. Footer-navs en
// breadcrumbs worden apart uitgefilterd (daar staan juist achtergrond-links).
const MENU_SELECTORS = [
  "header nav",
  'nav[aria-label*="primair" i]',
  'nav[aria-label*="hoofd" i]',
  'nav[aria-label*="primary" i]',
  'nav[aria-label*="main" i]',
  "#primary-menu",
  "#site-navigation",
  ".main-navigation",
  "header [role=navigation]",
  "nav",
];

function menuLinksFrom(
  $: cheerio.CheerioAPI,
  $container: ReturnType<cheerio.CheerioAPI>,
  baseUrl: string,
): MenuLink[] {
  let baseOrigin: string;
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    return [];
  }
  const norm = (o: string) => o.replace(/^(https?:\/\/)www\./i, "$1");
  const out: MenuLink[] = [];
  const seen = new Set<string>();
  $container
    .find("a[href]")
    .toArray()
    .forEach((a) => {
      const $a = $(a);
      const href = ($a.attr("href") ?? "").trim();
      const label = $a.text().replace(/\s+/g, " ").trim();
      if (!label || !href || href.startsWith("#")) return;
      if (/^(javascript:|mailto:|tel:)/i.test(href)) return;
      let u: URL;
      try {
        u = new URL(href, `${baseOrigin}/`);
      } catch {
        return;
      }
      if (norm(u.origin) !== norm(baseOrigin)) return;
      const path = u.pathname + (u.search || "");
      const key = `${label.toLowerCase()}|${path}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ label, href: path });
    });
  return out.slice(0, 40);
}

/**
 * Isoleert het PRIMAIRE hoofdmenu uit de homepage-HTML (draaien vóór
 * extractMainHtml de <nav> verwijdert). Slaat footer-navs en breadcrumbs
 * bewust over. Levert een lege lijst als er geen betrouwbaar menu (≥2 links)
 * te vinden is — dan gokken we liever niet.
 */
export function extractPrimaryMenu(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): MenuLink[] {
  for (const sel of MENU_SELECTORS) {
    let chosen: ReturnType<cheerio.CheerioAPI> | null = null;
    for (const el of $(sel).toArray()) {
      const $el = $(el);
      if ($el.closest("footer").length) continue;
      const meta = `${$el.attr("aria-label") ?? ""} ${$el.attr("class") ?? ""} ${$el.attr("id") ?? ""}`;
      if (/breadcrumb/i.test(meta)) continue;
      chosen = $el;
      break;
    }
    if (!chosen) continue;
    const links = menuLinksFrom($, chosen, baseUrl);
    if (links.length >= 2) return links;
  }
  return [];
}

// Selector voor CTA-buttons die B2B-sites vaak IN header zetten maar BUITEN <nav>
// (Contact / Afspraak / Demo / Offerte). Extraheren gebeurt vóór extractMainHtml
// de <header> weggooit. Dedupe op href.
const HEADER_CTA_SELECTOR = [
  'header a[class*="btn" i]',
  'header a[class*="button" i]',
  'header a[class*="cta" i]',
  'header a[role="button"]',
].join(",");

/**
 * Extraheert CTA-knoppen uit de <header> die géén onderdeel zijn van de reguliere
 * <nav>-lijst. Deze staan bij veel B2B-sites (bv. fourtop.nl) als button-styled
 * links naast het menu, wat extractPrimaryMenu overslaat omdat die alleen binnen
 * <nav> zoekt. Dedupe op href — desktop/sticky/mobile variants leveren vaak
 * duplicaten op.
 */
export function extractHeaderCtas(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): MenuLink[] {
  let baseOrigin: string;
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    return [];
  }
  const norm = (o: string) => o.replace(/^(https?:\/\/)www\./i, "$1");
  const out: MenuLink[] = [];
  const seenHrefs = new Set<string>();
  $(HEADER_CTA_SELECTOR)
    .toArray()
    .forEach((a) => {
      const $a = $(a);
      // Skip als 'ie in footer/nav zit (nav-links pakken we via extractPrimaryMenu)
      if ($a.closest("footer, nav").length) return;
      const href = ($a.attr("href") ?? "").trim();
      const label = $a.text().replace(/\s+/g, " ").trim();
      if (!label || !href || href.startsWith("#")) return;
      if (/^(javascript:|mailto:|tel:)/i.test(href)) return;
      let u: URL;
      try {
        u = new URL(href, `${baseOrigin}/`);
      } catch {
        return;
      }
      if (norm(u.origin) !== norm(baseOrigin)) return;
      const path = u.pathname + (u.search || "");
      if (seenHrefs.has(path)) return;
      seenHrefs.add(path);
      out.push({ label, href: path });
    });
  return out;
}

// ── Contact-informatie extractie ────────────────────────────────────
// Verzamelt alle tel:/mailto: links, <address> tags, en JSON-LD LocalBusiness/
// Organization data vóór header/footer weg wordt gestript. Aggregatie per
// pagina, over alle pagina's samengevoegd in urlToMarkdown.
//
// KRITIEK ONDERSCHEID: visible vs sourceOnly.
// - visible: gevonden in normale, gerenderde DOM (incl. JSON-LD, dat is
//   site-owner-authoritative machine-readable data). Analyse MAG hierover
//   claimen "staat op de website".
// - sourceOnly: gevonden in <template>/hidden containers OF op placeholder-
//   domeinen. Analyse mag hierover melden "we vonden dit in de bron, mogelijk
//   template-leak" maar mag NIET beweren dat het op de webpagina staat.
// Voorkomt false positives waarbij BOEM's `hey@company.com`-template als
// echt zichtbaar contact-adres in de analyse belandt.

export type ContactBucket = {
  emails: string[];
  telephones: string[];
  addresses: string[];
  openingHours: string[];
  /** Social-links uit JSON-LD sameAs. */
  socialLinks: string[];
};

export type ContactInfo = {
  /** Bedrijfsnaam uit JSON-LD (indien aanwezig). */
  name?: string;
  /** Contact-info uit de gerenderde DOM — betrouwbaar, mag geciteerd. */
  visible: ContactBucket;
  /** In HTML-source gevonden maar in hidden container / template / met
   *  placeholder-domein. Niet beweren dat dit op de pagina staat. */
  sourceOnly: ContactBucket;
};

function emptyBucket(): ContactBucket {
  return {
    emails: [],
    telephones: [],
    addresses: [],
    openingHours: [],
    socialLinks: [],
  };
}

function emptyContactInfo(): ContactInfo {
  return { visible: emptyBucket(), sourceOnly: emptyBucket() };
}

// Bekende placeholder-/dummy-domeinen. Emails hier gaan altijd naar sourceOnly,
// ook als ze in de zichtbare DOM staan — dat is bijna altijd een template die
// niet correct is ingevuld door de site-eigenaar (of demo-content).
const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "company.com",
  "yourcompany.com",
  "yourdomain.com",
  "domain.com",
  "mydomain.com",
  "yoursite.com",
  "mysite.com",
  "test.com",
  "dummy.com",
  "sample.com",
  "placeholder.com",
  "email.com",
]);

// Bekende placeholder-telefoonnummers (klassieke test-nummers). Alleen
// eenvoudige patronen — niet elke +1-nummer is placeholder, dus behouden we
// alleen de meest overduidelijke.
const PLACEHOLDER_TEL_PATTERNS: RegExp[] = [
  /^\+?1234567890$/,
  /^\+?0000000000$/,
  /^\+?1111111111$/,
  /^\+?5555555555$/,
  /^\+?123-?456-?7890$/,
];

function isPlaceholderEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  return PLACEHOLDER_EMAIL_DOMAINS.has(domain);
}

function isPlaceholderTel(tel: string): boolean {
  const clean = tel.replace(/[\s()]/g, "");
  return PLACEHOLDER_TEL_PATTERNS.some((re) => re.test(clean));
}

// Common CSS-hidden classes over frameworks heen: Bootstrap (d-none, invisible),
// Tailwind (hidden), WordPress (screen-reader-text), Bootstrap/A11y (sr-only,
// visually-hidden). Regex is bewust WORD-BOUNDED zodat "sidebar-visible" niet
// per ongeluk matcht op "-visible".
const HIDDEN_CLASS_RE =
  /(^|\s)(hidden|sr-only|visually-hidden|d-none|is-hidden|screen-reader-text|invisible)(\s|$)/i;

const HIDDEN_ANCESTOR_TAGS = new Set([
  "template",
  "script",
  "style",
  "noscript",
]);

/**
 * Traverseert ancestors handmatig (cheerio's `.parents(selector)` heeft
 * quirks met <template>) om te bepalen of dit element in een hidden container
 * zit. Checkt: tagname, `hidden` attr, inline `display:none`/`visibility:hidden`,
 * en common CSS-hidden classes.
 *
 * JSON-LD <script> is uitgesloten: deze functie wordt alleen aangeroepen
 * voor mailto/tel/address elementen, niet voor JSON-LD extractie.
 */
function isInHiddenContainer(
  $: cheerio.CheerioAPI,
  el: unknown,
): boolean {
  let cur: ReturnType<cheerio.CheerioAPI> = $(el as never);
  while (cur.length > 0) {
    const node = cur[0];
    const tagName =
      node && "tagName" in node
        ? String((node as { tagName?: string }).tagName ?? "").toLowerCase()
        : "";
    if (HIDDEN_ANCESTOR_TAGS.has(tagName)) return true;
    // `hidden` attribuut (HTML5 native)
    if (cur.attr("hidden") !== undefined) return true;
    const style = (cur.attr("style") ?? "").toLowerCase();
    if (/display\s*:\s*none/.test(style)) return true;
    if (/visibility\s*:\s*hidden/.test(style)) return true;
    const cls = cur.attr("class") ?? "";
    if (cls && HIDDEN_CLASS_RE.test(cls)) return true;
    const parent = cur.parent();
    if (parent.length === 0 || parent[0] === cur[0]) break;
    cur = parent;
  }
  return false;
}

function formatSchemaAddress(a: unknown): string | undefined {
  if (!a) return undefined;
  if (typeof a === "string") return a.trim() || undefined;
  if (typeof a !== "object") return undefined;
  const o = a as Record<string, unknown>;
  const line1 = typeof o.streetAddress === "string" ? o.streetAddress : undefined;
  const postal = typeof o.postalCode === "string" ? o.postalCode : undefined;
  const city = typeof o.addressLocality === "string" ? o.addressLocality : undefined;
  const region = typeof o.addressRegion === "string" ? o.addressRegion : undefined;
  const country = typeof o.addressCountry === "string" ? o.addressCountry : undefined;
  const parts = [
    line1,
    postal || city ? [postal, city].filter(Boolean).join(" ") : undefined,
    region,
    country,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : undefined;
}

/** Ingest JSON-LD entity data — gaat ALTIJD naar visible-bucket (JSON-LD is
 *  site-owner-authoritative, machine-readable data die zoekmachines gebruiken). */
function ingestSchemaEntity(entity: unknown, info: ContactInfo): void {
  if (!entity || typeof entity !== "object") return;
  const e = entity as Record<string, unknown>;
  if (Array.isArray(e["@graph"])) {
    for (const sub of e["@graph"]) ingestSchemaEntity(sub, info);
    return;
  }
  const typeRaw = e["@type"];
  const types = Array.isArray(typeRaw)
    ? typeRaw.map((t) => String(t))
    : typeRaw
      ? [String(typeRaw)]
      : [];
  const isBusinessLike = types.some((t) =>
    /^(LocalBusiness|Organization|Store|Restaurant|ProfessionalService|Corporation)/i.test(t),
  );
  if (!isBusinessLike) return;

  const v = info.visible;
  if (!info.name && typeof e.name === "string") info.name = e.name.trim();
  if (typeof e.telephone === "string" && !v.telephones.includes(e.telephone))
    v.telephones.push(e.telephone);
  if (typeof e.email === "string" && !v.emails.includes(e.email))
    v.emails.push(e.email);
  const addr = formatSchemaAddress(e.address);
  if (addr && !v.addresses.includes(addr)) v.addresses.push(addr);
  if (Array.isArray(e.openingHours)) {
    for (const h of e.openingHours) {
      if (typeof h === "string" && !v.openingHours.includes(h))
        v.openingHours.push(h);
    }
  } else if (typeof e.openingHours === "string") {
    if (!v.openingHours.includes(e.openingHours))
      v.openingHours.push(e.openingHours);
  }
  if (Array.isArray(e.sameAs)) {
    for (const u of e.sameAs) {
      if (typeof u === "string" && !v.socialLinks.includes(u))
        v.socialLinks.push(u);
    }
  }
}

/** Dedupe-append helper. */
function pushUnique(arr: string[], v: string): void {
  if (v && !arr.includes(v)) arr.push(v);
}

/**
 * Extraheert contact-info uit ÉÉN pagina's HTML. Splitst per bevinding in:
 *  - visible: normale zichtbare DOM + JSON-LD (site-owner-authoritative)
 *  - sourceOnly: hidden containers, templates, of placeholder-domeinen
 *
 * Combineert vier bronnen: mailto:/tel: links, <address> tags en JSON-LD
 * LocalBusiness/Organization. Moet gedraaid worden VOOR extractMainHtml,
 * want die strip <header>, <footer>, <script> en <address> vaak weg.
 * Faalt zacht: kapotte JSON-LD → skip dat blok.
 */
export function extractContactInfo($: cheerio.CheerioAPI): ContactInfo {
  const info = emptyContactInfo();

  // Pre-pass: <template> en <noscript> content isolatie. cheerio's parser
  // plaatst deze content in speciale contexten (DocumentFragment resp. text-
  // node afhankelijk van parser), waardoor onze parent-traversal ze niet als
  // "in hidden container" herkent. We extraheren de raw content en parsen 'm
  // apart, alles daaruit → sourceOnly. Vervolgens strippen we de containers
  // uit de hoofdboom zodat ze niet meer meedoen.
  $("template, noscript").each((_, container) => {
    const raw = $(container).html() ?? "";
    if (!raw.trim()) return;
    const $c = cheerio.load(raw, null, false);
    $c('a[href^="mailto:" i]').each((_, el) => {
      const email = ($c(el).attr("href") ?? "")
        .replace(/^mailto:/i, "")
        .split("?")[0]
        .trim();
      if (email) pushUnique(info.sourceOnly.emails, email);
    });
    $c('a[href^="tel:" i]').each((_, el) => {
      const tel = ($c(el).attr("href") ?? "").replace(/^tel:/i, "").trim();
      if (tel) pushUnique(info.sourceOnly.telephones, tel);
    });
    $c("address").each((_, el) => {
      const text = $c(el).text().replace(/\s+/g, " ").trim();
      if (text) pushUnique(info.sourceOnly.addresses, text);
    });
  });
  $("template, noscript").remove();

  $('a[href^="mailto:" i]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const email = href.replace(/^mailto:/i, "").split("?")[0].trim();
    if (!email) return;
    // Placeholder-domeinen ALTIJD naar sourceOnly (ook als visible).
    const bucket =
      isInHiddenContainer($, el) || isPlaceholderEmail(email)
        ? info.sourceOnly
        : info.visible;
    pushUnique(bucket.emails, email);
  });

  $('a[href^="tel:" i]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const tel = href.replace(/^tel:/i, "").trim();
    if (!tel) return;
    const bucket =
      isInHiddenContainer($, el) || isPlaceholderTel(tel)
        ? info.sourceOnly
        : info.visible;
    pushUnique(bucket.telephones, tel);
  });

  $("address").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    const bucket = isInHiddenContainer($, el) ? info.sourceOnly : info.visible;
    pushUnique(bucket.addresses, text);
  });

  // JSON-LD → visible (site-owner-authoritative, machine-readable). Zit in
  // <script>-tag maar dat is de bedoelde vorm voor structured data.
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (Array.isArray(parsed)) {
      for (const entity of parsed) ingestSchemaEntity(entity, info);
    } else {
      ingestSchemaEntity(parsed, info);
    }
  });

  return info;
}

/** Merge één bucket (visible of sourceOnly) uit meerdere pagina's, dedup. */
function mergeBucket(items: ContactBucket[]): ContactBucket {
  const merged = emptyBucket();
  for (const item of items) {
    for (const e of item.emails) pushUnique(merged.emails, e);
    for (const t of item.telephones) pushUnique(merged.telephones, t);
    for (const a of item.addresses) pushUnique(merged.addresses, a);
    for (const h of item.openingHours) pushUnique(merged.openingHours, h);
    for (const s of item.socialLinks) pushUnique(merged.socialLinks, s);
  }
  return merged;
}

/**
 * Merge contact-info van meerdere pagina's tot één beeld. Visible en
 * sourceOnly worden apart gededupliceerd. Scalar `name`: eerste niet-lege wint
 * (typisch de homepage-organisatie).
 */
export function mergeContactInfo(items: ContactInfo[]): ContactInfo {
  const merged = emptyContactInfo();
  for (const item of items) if (!merged.name && item.name) merged.name = item.name;
  merged.visible = mergeBucket(items.map((i) => i.visible));
  merged.sourceOnly = mergeBucket(items.map((i) => i.sourceOnly));
  return merged;
}

/** Rendert een ContactBucket als YAML-regels met de gegeven indent. */
function bucketToYaml(b: ContactBucket, indent: string): string[] {
  const lines: string[] = [];
  const push = (label: string, values: string[]) => {
    if (!values.length) return;
    lines.push(`${indent}${label}:`);
    for (const v of values) lines.push(`${indent}  - ${v}`);
  };
  push("emails", b.emails);
  push("telefoons", b.telephones);
  push("adressen", b.addresses);
  push("openingstijden", b.openingHours);
  push("social", b.socialLinks);
  return lines;
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
  includeImages: boolean,
  menuBaseUrl: string | null = null
): Promise<{
  markdown: string;
  title: string;
  metaDescription: string;
  images: UrlImageInput[];
  placeholderByUrl: Map<string, string>;
  menu: MenuLink[];
  menuCtas: MenuLink[];
  contactInfo: ContactInfo;
} | null> {
  const html = await fetchHtmlWithRetry(url);
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ?? "";

  // Menu + CTA's extraheren vóór extractMainHtml de <header>/<nav> weggooit
  // (alleen homepage — sub-pagina's hebben typisch hetzelfde menu).
  const menu = menuBaseUrl ? extractPrimaryMenu($, menuBaseUrl) : [];
  const menuCtas = menuBaseUrl ? extractHeaderCtas($, menuBaseUrl) : [];
  // Contact-info wordt WEL op elke pagina geëxtraheerd (contact-pagina zelf
  // heeft meer info dan homepage; footer verschilt soms per pagina).
  const contactInfo = extractContactInfo($);

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
    menu,
    menuCtas,
    contactInfo,
  };
}

async function resolveTargetUrls(
  baseUrl: string,
  options: UrlToMarkdownOptions
): Promise<{
  urls: string[];
  skippedLegacyUrls: string[];
  skippedBlogUrls: string[];
}> {
  // Expliciet opgegeven doelen (single page of vaste paden) respecteren we
  // altijd, ook als de URL er "oud" of "blog-sub" uitziet — dat is bewuste
  // gebruikersintentie.
  if (options.singlePage)
    return { urls: [baseUrl], skippedLegacyUrls: [], skippedBlogUrls: [] };
  if (options.paths) {
    return {
      urls: options.paths.map((p) => baseUrl + p),
      skippedLegacyUrls: [],
      skippedBlogUrls: [],
    };
  }

  const maxPages = options.unlimited
    ? 10_000
    : options.maxPages ?? DEFAULT_MAX_PAGES;
  if (options.useSitemap !== false) {
    const sitemapUrls = await discoverSitemapUrls(baseUrl, { maxUrls: maxPages });
    if (sitemapUrls.length > 0) {
      const homepage = baseUrl;
      const all = Array.from(new Set<string>([homepage, ...sitemapUrls]));
      const skippedLegacyUrls = all.filter(isLegacyUrl);
      const skippedBlogUrls = all.filter(
        (u) => !isLegacyUrl(u) && isBlogSubpage(u),
      );
      const urls = all
        .filter((u) => !isLegacyUrl(u) && !isBlogSubpage(u))
        .slice(0, maxPages);
      return { urls, skippedLegacyUrls, skippedBlogUrls };
    }
  }
  return {
    urls: DEFAULT_PATHS.map((p) => baseUrl + p).slice(0, maxPages),
    skippedLegacyUrls: [],
    skippedBlogUrls: [],
  };
}

export async function urlToMarkdown(
  rawUrl: string,
  options: UrlToMarkdownOptions = {}
): Promise<UrlMarkdownResult> {
  const baseUrl = normalizeBaseUrl(rawUrl);

  const resolveStart = Date.now();
  const { urls, skippedLegacyUrls, skippedBlogUrls } = await resolveTargetUrls(
    baseUrl,
    options,
  );
  console.log(
    `[md-timing] resolveTargetUrls done in ${Date.now() - resolveStart}ms (urls=${urls.length}, skippedLegacy=${skippedLegacyUrls.length}, skippedBlog=${skippedBlogUrls.length})`,
  );

  const turndown = createTurndown();
  const includeImages = options.includeImages !== false;
  // Caps optioneel uitschakelen voor "alle pagina's"-modus.
  const perPageCap = options.unlimited ? Infinity : MAX_CHARS_PER_PAGE;
  const totalCap = options.unlimited ? Infinity : MAX_CHARS_TOTAL;

  // Concurrency-limit voorkomt HTTP 429 rate-limiting bij sites met
  // W3 Total Cache / Cloudflare / vergelijkbare front-ends. Met 50 parallelle
  // requests werden bij nleyes.com ~70% van de pagina's geblokkeerd.
  // Homepage (index 0) krijgt menuBaseUrl mee zodat we het hoofdmenu extraheren.
  const targets = urls.map((u, i) => ({ url: u, isHome: i === 0 }));
  const fetchStart = Date.now();
  const settled = await mapWithConcurrency(targets, FETCH_CONCURRENCY, (t) =>
    pageToMarkdown(t.url, turndown, includeImages, t.isHome ? baseUrl : null),
  );
  const okCount = settled.filter((r) => r.status === "fulfilled" && r.value).length;
  const failCount = settled.filter((r) => r.status === "rejected").length;
  const emptyCount = settled.filter((r) => r.status === "fulfilled" && !r.value).length;
  console.log(
    `[md-timing] page fetches done in ${Date.now() - fetchStart}ms (ok=${okCount}, failed=${failCount}, empty=${emptyCount}, concurrency=${FETCH_CONCURRENCY})`,
  );

  // Verzamel alle unique images uit alle pagina's voor één enkele vision-batch
  // (dedup over pagina's heen — hetzelfde logo komt op meerdere pagina's voor).
  // Stopt zodra MAX_UNIQUE_IMAGES_TOTAL bereikt is; images uit latere pagina's
  // worden weggelaten (early pages meestal representatiever dan tag-/detail-pagina's).
  const allImagesByUrl = new Map<string, UrlImageInput>();
  let imagesTruncated = false;
  outer: for (const r of settled) {
    if (r.status !== "fulfilled" || !r.value) continue;
    for (const img of r.value.images) {
      if (allImagesByUrl.has(img.url)) continue;
      if (allImagesByUrl.size >= MAX_UNIQUE_IMAGES_TOTAL) {
        imagesTruncated = true;
        break outer;
      }
      allImagesByUrl.set(img.url, img);
    }
  }
  console.log(
    `[md-timing] collected ${allImagesByUrl.size} unique images across pages (includeImages=${includeImages}, cap=${MAX_UNIQUE_IMAGES_TOTAL}${imagesTruncated ? ", TRUNCATED" : ""})`,
  );
  const describeStart = Date.now();
  const describeResult = includeImages
    ? await describeImageUrls(Array.from(allImagesByUrl.values()))
    : {
        descriptions: new Map() as DescriptionMap,
        usage: { inputTokens: 0, outputTokens: 0 },
        costCents: 0,
        batchesOk: 0,
        batchesFailed: 0,
      };
  const descriptions = describeResult.descriptions;
  console.log(
    `[md-timing] describeImageUrls done in ${Date.now() - describeStart}ms (descriptions=${descriptions.size}, batchesOk=${describeResult.batchesOk}, batchesFailed=${describeResult.batchesFailed}, costCents=${describeResult.costCents})`,
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
  const homeResult = settled[0];
  const primaryMenu: MenuLink[] =
    homeResult && homeResult.status === "fulfilled" && homeResult.value
      ? homeResult.value.menu
      : [];
  const headerCtas: MenuLink[] =
    homeResult && homeResult.status === "fulfilled" && homeResult.value
      ? homeResult.value.menuCtas
      : [];
  // Contact-info aggregatie over ALLE pagina's — contact/afspraak-pagina heeft
  // vaak rijkere info dan de homepage. mergeContactInfo dedupliceert.
  const mergedContactInfo = mergeContactInfo(
    settled
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => (r as PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof pageToMarkdown>>>>).value.contactInfo),
  );
  const bucketHas = (b: ContactBucket): boolean =>
    b.emails.length > 0 ||
    b.telephones.length > 0 ||
    b.addresses.length > 0 ||
    b.openingHours.length > 0 ||
    b.socialLinks.length > 0;
  const hasVisibleContact =
    !!mergedContactInfo.name || bucketHas(mergedContactInfo.visible);
  const hasSourceOnlyContact = bucketHas(mergedContactInfo.sourceOnly);
  const hasContactInfo = hasVisibleContact || hasSourceOnlyContact;

  const frontmatterLines = [
    "---",
    `website_url: ${baseUrl}`,
    `scrape_datum: ${scrapeDate}`,
    `titel: ${firstTitle || "(onbekend)"}`,
    ...(primaryMenu.length
      ? [
          "# hoofdmenu = de primaire navigatie van de homepage (wat een bezoeker in het menu ziet).",
          "hoofdmenu:",
          ...primaryMenu.map((m) => `  - ${m.label} -> ${m.href}`),
        ]
      : [
          "# hoofdmenu: kon niet betrouwbaar uit de homepage-navigatie worden bepaald.",
        ]),
    ...(headerCtas.length
      ? [
          "# menu_cta = call-to-action-knoppen in de header (buiten het reguliere <nav>).",
          "# Dit zijn de primaire acties die het bedrijf de bezoeker aanbiedt.",
          "menu_cta:",
          ...headerCtas.map((c) => `  - ${c.label} -> ${c.href}`),
        ]
      : []),
    ...(hasContactInfo
      ? [
          "# contact_gegevens = geaggregeerde contact-info uit tel:/mailto:/<address>/JSON-LD",
          "# over alle gescraped pagina's.",
          "# ONDERSCHEID:",
          "#   zichtbaar        = staat in de gerenderde DOM + JSON-LD (site-owner-",
          "#                      authoritative). MAG geciteerd worden als \"op de website\".",
          "#   alleen_in_source = gevonden in HTML-source binnen hidden/template containers",
          "#                      of op placeholder-domeinen (example.com, company.com etc.).",
          "#                      NIET beweren dat dit op de webpagina staat; wél meldbaar",
          "#                      als tech/marketing-hygiëne-signaal (bv. template niet",
          "#                      correct ingevuld door de site-eigenaar).",
          "contact_gegevens:",
          ...(mergedContactInfo.name ? [`  naam: ${mergedContactInfo.name}`] : []),
          ...(hasVisibleContact
            ? [
                "  zichtbaar:",
                ...bucketToYaml(mergedContactInfo.visible, "    "),
              ]
            : []),
          ...(hasSourceOnlyContact
            ? [
                "  alleen_in_source:",
                ...bucketToYaml(mergedContactInfo.sourceOnly, "    "),
              ]
            : []),
        ]
      : []),
    `aantal_paginas: ${okPages.length}`,
    "# gevonden_paginas = ALLE opgehaalde pagina's (o.a. uit de sitemap); dit is NIET het",
    "# hoofdmenu en bevat vaak pagina's die niet in de navigatie staan (detail-/detacherings-/tag-pagina's).",
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
    ...(skippedLegacyUrls.length
      ? [
          "# Onderstaande URL's uit de sitemap zien er verouderd uit (oud/old/archief)",
          "# en zijn bewust NIET mee-gescraped. Dat ze nog live staan is een mogelijk",
          "# technisch verbeterpunt: verouderde pagina's schaden de vindbaarheid.",
          "verouderde_paginas_gevonden:",
          ...skippedLegacyUrls.map((u) => `  - ${u}`),
        ]
      : []),
    ...(skippedBlogUrls.length
      ? [
          "# Onderstaande URL's zijn blog-/nieuws-/artikel-sub-pagina's en zijn",
          "# bewust NIET mee-gescraped. De index-pagina zelf (bv. /blog) is wél",
          "# meegenomen zodat je weet dát het bedrijf publiceert. Individuele posts",
          "# verdunnen de analysebron zonder veel positionering-signaal.",
          `# Aantal genegeerde blog-sub-pagina's: ${skippedBlogUrls.length}`,
          "blog_subpaginas_genegeerd:",
          ...skippedBlogUrls.slice(0, 20).map((u) => `  - ${u}`),
          ...(skippedBlogUrls.length > 20
            ? [`  # ... en nog ${skippedBlogUrls.length - 20} meer`]
            : []),
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

/**
 * Lichtgewicht variant van urlToMarkdown: fetcht pages, verzamelt unique
 * images (met dezelfde cap MAX_UNIQUE_IMAGES_TOTAL en dedup-volgorde), maar
 * doet géén image-descriptions of markdown-assembly. Bedoeld voor tools die
 * alleen de image-set willen (bv. de model-vergelijk-pagina).
 */
export async function collectUniqueImages(
  rawUrl: string,
  options: UrlToMarkdownOptions = {},
): Promise<{ baseUrl: string; images: UrlImageInput[]; truncated: boolean }> {
  const baseUrl = normalizeBaseUrl(rawUrl);
  const { urls } = await resolveTargetUrls(baseUrl, options);
  const turndown = createTurndown();
  const targets = urls.map((u, i) => ({ url: u, isHome: i === 0 }));
  const settled = await mapWithConcurrency(targets, FETCH_CONCURRENCY, (t) =>
    pageToMarkdown(t.url, turndown, true, t.isHome ? baseUrl : null),
  );

  const allImagesByUrl = new Map<string, UrlImageInput>();
  let truncated = false;
  outer: for (const r of settled) {
    if (r.status !== "fulfilled" || !r.value) continue;
    for (const img of r.value.images) {
      if (allImagesByUrl.has(img.url)) continue;
      if (allImagesByUrl.size >= MAX_UNIQUE_IMAGES_TOTAL) {
        truncated = true;
        break outer;
      }
      allImagesByUrl.set(img.url, img);
    }
  }
  return {
    baseUrl,
    images: Array.from(allImagesByUrl.values()),
    truncated,
  };
}
