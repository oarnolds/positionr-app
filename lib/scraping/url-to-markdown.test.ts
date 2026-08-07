import { test, expect, vi, afterEach } from "vitest";
import * as cheerio from "cheerio";
import {
  extractContactInfo,
  extractHeaderCtas,
  extractPrimaryMenu,
  isBlogSubpage,
  isLegacyUrl,
  mergeContactInfo,
  normalizeBaseUrl,
  urlToMarkdown,
} from "./url-to-markdown";

afterEach(() => vi.restoreAllMocks());

test("extractPrimaryMenu: pakt het header-hoofdmenu, negeert footer en breadcrumb", () => {
  const html = `
    <header><a href="/"><img alt="logo"></a>
      <nav aria-label="Hoofdmenu"><ul>
        <li><a href="/oplossingen/">Oplossingen</a></li>
        <li><a href="/over-nleyes/">Over NLeyes</a></li>
        <li><a href="/contact-us/">Contact</a></li>
      </ul></nav>
    </header>
    <nav aria-label="breadcrumb"><a href="/">Home</a><a href="/oplossingen/">Oplossingen</a></nav>
    <footer><nav>
      <a href="/professionals/">Professionals</a>
      <a href="/privacy-policy/">Privacy</a>
    </nav></footer>`;
  const menu = extractPrimaryMenu(cheerio.load(html), "https://nleyes.com");
  expect(menu.map((m) => m.href)).toEqual([
    "/oplossingen/",
    "/over-nleyes/",
    "/contact-us/",
  ]);
  expect(menu.some((m) => m.href.includes("professionals"))).toBe(false);
});

test("extractPrimaryMenu: valt terug op #primary-menu zonder header-nav", () => {
  const html = `<div><nav id="primary-menu"><a href="/a/">A</a><a href="/b/">B</a></nav></div>`;
  expect(
    extractPrimaryMenu(cheerio.load(html), "https://x.nl").map((m) => m.label),
  ).toEqual(["A", "B"]);
});

test("extractPrimaryMenu: negeert externe links en anchors, dedupliceert", () => {
  const html = `<header><nav>
    <a href="/a/">A</a>
    <a href="https://twitter.com/x">Twitter</a>
    <a href="/b/">B</a>
    <a href="/a/">A</a>
    <a href="#top">Top</a>
  </nav></header>`;
  expect(extractPrimaryMenu(cheerio.load(html), "https://x.nl")).toEqual([
    { label: "A", href: "/a/" },
    { label: "B", href: "/b/" },
  ]);
});

test("extractPrimaryMenu: lege lijst als alleen een footer-menu bestaat", () => {
  const html = `<footer><nav><a href="/a/">A</a><a href="/b/">B</a></nav></footer>`;
  expect(extractPrimaryMenu(cheerio.load(html), "https://x.nl")).toEqual([]);
});

test("extractHeaderCtas: pakt button-styled links uit header (buiten nav)", () => {
  // Fourtop-achtig patroon: CTA-buttons als <a class="btn ..."> in header
  const html = `
    <header>
      <nav>
        <a href="/diensten">Diensten</a>
        <a href="/over-ons">Over ons</a>
      </nav>
      <a href="/contact" class="btn btn--fill btn--pill">Contact</a>
      <a href="/afspraak" class="btn btn--accent">Afspraak</a>
      <a href="/demo" role="button">Demo</a>
    </header>
    <footer>
      <a href="/andere-cta" class="btn">Voettekst-CTA</a>
    </footer>`;
  const ctas = extractHeaderCtas(cheerio.load(html), "https://x.nl");
  expect(ctas.map((c) => c.href)).toEqual(["/contact", "/afspraak", "/demo"]);
  // Voettekst-CTA in <footer> mag NIET meekomen
  expect(ctas.some((c) => c.href === "/andere-cta")).toBe(false);
});

test("extractHeaderCtas: dedupe op href (bv. desktop + mobile duplicaten)", () => {
  const html = `
    <header>
      <a href="/contact" class="btn btn--static">Contact</a>
      <a href="/contact" class="btn btn--sticky">Contact</a>
      <a href="/contact" class="btn btn--mobile">Contact</a>
    </header>`;
  const ctas = extractHeaderCtas(cheerio.load(html), "https://x.nl");
  expect(ctas).toHaveLength(1);
  expect(ctas[0].href).toBe("/contact");
});

test("extractHeaderCtas: cross-origin en tel:/mailto: worden overgeslagen", () => {
  const html = `
    <header>
      <a href="/goed" class="btn">Goed</a>
      <a href="tel:0612345678" class="btn">Bel</a>
      <a href="mailto:info@x.nl" class="btn">Mail</a>
      <a href="https://andersite.nl/ergens" class="btn">Extern</a>
    </header>`;
  const ctas = extractHeaderCtas(cheerio.load(html), "https://x.nl");
  expect(ctas.map((c) => c.href)).toEqual(["/goed"]);
});

test("extractContactInfo: haalt zichtbare tel:/mailto:/address uit HTML", () => {
  const html = `
    <html><body>
      <header>
        <a href="mailto:info@x.nl">info@x.nl</a>
        <a href="tel:+31201234567">020 123 4567</a>
      </header>
      <footer>
        <address>Kerkstraat 1, 1234 AB Amsterdam</address>
        <a href="mailto:servicedesk@x.nl">Servicedesk</a>
      </footer>
    </body></html>`;
  const info = extractContactInfo(cheerio.load(html));
  expect(info.visible.emails.sort()).toEqual(["info@x.nl", "servicedesk@x.nl"]);
  expect(info.visible.telephones).toEqual(["+31201234567"]);
  expect(info.visible.addresses).toEqual(["Kerkstraat 1, 1234 AB Amsterdam"]);
  expect(info.sourceOnly.emails).toEqual([]);
});

test("extractContactInfo: parseert JSON-LD LocalBusiness (naar visible: site-owner-authoritative)", () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "Voorbeeld B.V.",
        "telephone": "+31 20 555 0000",
        "email": "hallo@voorbeeld.nl",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Herengracht 100",
          "postalCode": "1015 BS",
          "addressLocality": "Amsterdam",
          "addressCountry": "NL"
        },
        "openingHours": ["Mo-Fr 09:00-17:00", "Sa 10:00-14:00"],
        "sameAs": ["https://linkedin.com/company/voorbeeld", "https://twitter.com/voorbeeld"]
      }
      </script>
    </head><body></body></html>`;
  const info = extractContactInfo(cheerio.load(html));
  expect(info.name).toBe("Voorbeeld B.V.");
  expect(info.visible.telephones).toContain("+31 20 555 0000");
  expect(info.visible.emails).toContain("hallo@voorbeeld.nl");
  expect(info.visible.addresses[0]).toContain("Herengracht 100");
  expect(info.visible.addresses[0]).toContain("1015 BS Amsterdam");
  expect(info.visible.openingHours).toEqual(["Mo-Fr 09:00-17:00", "Sa 10:00-14:00"]);
  expect(info.visible.socialLinks).toEqual([
    "https://linkedin.com/company/voorbeeld",
    "https://twitter.com/voorbeeld",
  ]);
});

test("extractContactInfo: JSON-LD binnen @graph structuur", () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", "name": "x.nl" },
          { "@type": "Organization", "name": "X BV", "telephone": "+31 6 1234 5678" }
        ]
      }
      </script>
    </head><body></body></html>`;
  const info = extractContactInfo(cheerio.load(html));
  expect(info.name).toBe("X BV");
  expect(info.visible.telephones).toContain("+31 6 1234 5678");
});

test("extractContactInfo: kapotte JSON-LD faalt zacht (geen throw)", () => {
  const html = `
    <html><head>
      <script type="application/ld+json">{ dit is geen json </script>
      <script type="application/ld+json">{ "@type": "Organization", "name": "Wel Ok" }</script>
    </head><body>
      <a href="mailto:x@y.nl">x@y.nl</a>
    </body></html>`;
  const info = extractContactInfo(cheerio.load(html));
  expect(info.name).toBe("Wel Ok");
  expect(info.visible.emails).toContain("x@y.nl");
});

test("extractContactInfo: emails in <template> gaan naar sourceOnly", () => {
  const html = `
    <html><body>
      <a href="mailto:echt@x.nl">Echt</a>
      <template>
        <a href="mailto:template@x.nl">Placeholder</a>
      </template>
      <script>
        // dummy in JS-string
        const email = "in-script@x.nl";
      </script>
      <noscript>
        <a href="mailto:noscript@x.nl">Voor no-JS</a>
      </noscript>
    </body></html>`;
  const info = extractContactInfo(cheerio.load(html));
  expect(info.visible.emails).toEqual(["echt@x.nl"]);
  expect(info.sourceOnly.emails.sort()).toEqual(
    ["noscript@x.nl", "template@x.nl"].sort(),
  );
  // Script-tag inhoud (non-JSON-LD) wordt niet als link herkend door cheerio,
  // dus geen extra sourceOnly-entry uit de JS-string.
});

test("extractContactInfo: hidden attribute + display:none + CSS-hidden classes → sourceOnly", () => {
  const html = `
    <html><body>
      <a href="mailto:echt@x.nl">Echt</a>
      <div hidden><a href="mailto:hidden-attr@x.nl">X</a></div>
      <div style="display: none"><a href="mailto:display-none@x.nl">X</a></div>
      <div style="visibility:hidden"><a href="mailto:vis-hidden@x.nl">X</a></div>
      <div class="sr-only"><a href="mailto:sr@x.nl">X</a></div>
      <div class="d-none"><a href="mailto:dnone@x.nl">X</a></div>
      <div class="visually-hidden"><a href="mailto:vh@x.nl">X</a></div>
    </body></html>`;
  const info = extractContactInfo(cheerio.load(html));
  expect(info.visible.emails).toEqual(["echt@x.nl"]);
  expect(info.sourceOnly.emails.sort()).toEqual(
    [
      "dnone@x.nl",
      "display-none@x.nl",
      "hidden-attr@x.nl",
      "sr@x.nl",
      "vh@x.nl",
      "vis-hidden@x.nl",
    ].sort(),
  );
});

test("extractContactInfo: placeholder-domeinen gaan ALTIJD naar sourceOnly, ook als visible", () => {
  const html = `
    <html><body>
      <a href="mailto:info@fourtop.nl">Echt</a>
      <a href="mailto:hey@company.com">Placeholder-visible</a>
      <a href="mailto:test@example.com">Placeholder-visible</a>
      <a href="mailto:hi@yourdomain.com">Placeholder-visible</a>
      <a href="tel:+1234567890">Fake tel visible</a>
      <a href="tel:+31201234567">Echt tel visible</a>
    </body></html>`;
  const info = extractContactInfo(cheerio.load(html));
  expect(info.visible.emails).toEqual(["info@fourtop.nl"]);
  expect(info.sourceOnly.emails.sort()).toEqual(
    ["hey@company.com", "hi@yourdomain.com", "test@example.com"].sort(),
  );
  expect(info.visible.telephones).toEqual(["+31201234567"]);
  expect(info.sourceOnly.telephones).toEqual(["+1234567890"]);
});

test("mergeContactInfo: dedupliceert visible EN sourceOnly buckets afzonderlijk", () => {
  const a = {
    name: "Eerste",
    visible: {
      emails: ["a@x.nl", "b@x.nl"],
      telephones: ["020-1234567"],
      addresses: ["Straat 1"],
      openingHours: [],
      socialLinks: [],
    },
    sourceOnly: {
      emails: ["hey@company.com"],
      telephones: [],
      addresses: [],
      openingHours: [],
      socialLinks: [],
    },
  };
  const b = {
    name: "Tweede",
    visible: {
      emails: ["b@x.nl", "c@x.nl"],
      telephones: [],
      addresses: ["Straat 2"],
      openingHours: ["Mo-Fr 9-17"],
      socialLinks: ["https://linkedin.com/x"],
    },
    sourceOnly: {
      emails: ["hey@company.com", "info@example.com"], // dedup + nieuwe
      telephones: [],
      addresses: [],
      openingHours: [],
      socialLinks: [],
    },
  };
  const merged = mergeContactInfo([a, b]);
  expect(merged.name).toBe("Eerste");
  expect(merged.visible.emails.sort()).toEqual(["a@x.nl", "b@x.nl", "c@x.nl"]);
  expect(merged.visible.addresses).toEqual(["Straat 1", "Straat 2"]);
  expect(merged.visible.openingHours).toEqual(["Mo-Fr 9-17"]);
  expect(merged.sourceOnly.emails.sort()).toEqual(
    ["hey@company.com", "info@example.com"].sort(),
  );
});

test("isBlogSubpage: herkent blog/nieuws/artikel sub-pagina's, laat index-pagina staan", () => {
  // SKIP: sub-pagina's (heeft content na het blog-segment)
  expect(isBlogSubpage("https://x.nl/blog/mijn-post")).toBe(true);
  expect(isBlogSubpage("https://x.nl/blog/2024/how-to")).toBe(true);
  expect(isBlogSubpage("https://x.nl/nieuws/laatste-update")).toBe(true);
  expect(isBlogSubpage("https://x.nl/news/latest")).toBe(true);
  expect(isBlogSubpage("https://x.nl/artikelen/analyse-2024")).toBe(true);
  expect(isBlogSubpage("https://x.nl/articles/some-article")).toBe(true);
  expect(isBlogSubpage("https://x.nl/posts/post-title")).toBe(true);
  expect(isBlogSubpage("https://x.nl/post/single-post")).toBe(true);
  expect(isBlogSubpage("https://x.nl/insights/mijn-inzicht")).toBe(true);
  expect(isBlogSubpage("https://x.nl/updates/nieuwe-feature")).toBe(true);
  expect(isBlogSubpage("https://x.nl/BLOG/uppercase-should-match")).toBe(true);
  // KEEP: index-pagina's zelf (voor actualiteit-check)
  expect(isBlogSubpage("https://x.nl/blog")).toBe(false);
  expect(isBlogSubpage("https://x.nl/blog/")).toBe(false);
  expect(isBlogSubpage("https://x.nl/nieuws")).toBe(false);
  expect(isBlogSubpage("https://x.nl/artikelen/")).toBe(false);
  // KEEP: geen false positives op woorden die 'blog'/'nieuws' bevatten
  expect(isBlogSubpage("https://x.nl/products/blog-integrations")).toBe(false);
  expect(isBlogSubpage("https://x.nl/blogger-tools")).toBe(false);
  expect(isBlogSubpage("https://x.nl/blogs/something")).toBe(false); // plural niet in lijst
  // KEEP: cases + kennis blijven staan (waardevol voor B2B-analyse)
  expect(isBlogSubpage("https://x.nl/cases/klant-a")).toBe(false);
  expect(isBlogSubpage("https://x.nl/klantcases/project")).toBe(false);
  expect(isBlogSubpage("https://x.nl/kennis/artikel")).toBe(false);
  // Onzin-input degradeert netjes
  expect(isBlogSubpage("niet-eens-een-url")).toBe(false);
});

test("isLegacyUrl: herkent oud/old/archief-markers in het pad", () => {
  expect(isLegacyUrl("https://x.nl/diensten-oud/")).toBe(true);
  expect(isLegacyUrl("https://x.nl/oud/diensten")).toBe(true);
  expect(isLegacyUrl("https://x.nl/old-site")).toBe(true);
  expect(isLegacyUrl("https://x.nl/archief/2019")).toBe(true);
  expect(isLegacyUrl("https://x.nl/nieuws-archive/")).toBe(true);
  // Geen false positives op woorden die 'oud' bevatten:
  expect(isLegacyUrl("https://x.nl/goud-verkopen")).toBe(false);
  expect(isLegacyUrl("https://x.nl/oude-meesters")).toBe(false);
  expect(isLegacyUrl("https://x.nl/inhoud")).toBe(false);
  expect(isLegacyUrl("https://x.nl/diensten")).toBe(false);
  expect(isLegacyUrl("niet-eens-een-url")).toBe(false);
});

test("urlToMarkdown: verouderde pagina's uit sitemap worden niet gescraped maar wél genoteerd", async () => {
  const sitemap = `<?xml version="1.0"?>
    <urlset>
      <url><loc>https://x.nl/diensten</loc></url>
      <url><loc>https://x.nl/diensten-oud/</loc></url>
    </urlset>`;
  const page = `<html><body><main><h2>Diensten</h2><p>Actuele inhoud</p></main></body></html>`;
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes("sitemap"))
      return { ok: true, status: 200, text: async () => sitemap };
    return { ok: true, status: 200, text: async () => page };
  });
  vi.stubGlobal("fetch", fetchMock);

  const r = await urlToMarkdown("https://x.nl", { includeImages: false });

  // De oude pagina is nooit opgehaald…
  const fetchedUrls = fetchMock.mock.calls.map((c) => String(c[0]));
  expect(fetchedUrls.some((u) => u.includes("diensten-oud"))).toBe(false);
  expect(r.pages.some((p) => p.url.includes("diensten-oud"))).toBe(false);
  // …maar staat wél vermeld in de frontmatter als gevonden verouderde pagina.
  expect(r.markdown).toContain("verouderde_paginas_gevonden:");
  expect(r.markdown).toContain("https://x.nl/diensten-oud/");
});

test("normalizeBaseUrl: voegt https toe en strip trailing slash", () => {
  expect(normalizeBaseUrl("datapas.nl/")).toBe("https://datapas.nl");
  expect(normalizeBaseUrl("https://x.nl/")).toBe("https://x.nl");
  expect(normalizeBaseUrl("http://x.nl")).toBe("http://x.nl");
});

test("urlToMarkdown: kop + paragraaf → ATX-headings markdown", async () => {
  const html = `
    <html><head><title>Datapas</title>
      <meta name="description" content="Wij doen data" />
    </head><body>
      <nav>NAVSTRIP</nav>
      <main>
        <h1>Hallo</h1>
        <p>Wij maken het werk van datateams makkelijker.</p>
      </main>
      <footer>Copy</footer>
    </body></html>`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, text: async () => html }))
  );
  const r = await urlToMarkdown("https://datapas.nl", { singlePage: true });
  expect(r.baseUrl).toBe("https://datapas.nl");
  expect(r.title).toBe("Datapas");
  expect(r.metaDescription).toBe("Wij doen data");
  expect(r.markdown).toContain("# Hallo");
  expect(r.markdown).toContain("Wij maken het werk van datateams");
  expect(r.markdown).not.toContain("NAVSTRIP");
  expect(r.markdown).not.toContain("Copy");
  expect(r.pages).toHaveLength(1);
  expect(r.pages[0]?.status).toBe("ok");
});

test("urlToMarkdown: meerdere paden — failed pages worden gerapporteerd, ok pages gecombineerd", async () => {
  const ok = `<html><body><main><h2>Diensten</h2><p>Wij doen X</p></main></body></html>`;
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/diensten")) return { ok: true, status: 200, text: async () => ok };
    return { ok: false, status: 404, text: async () => "" };
  });
  vi.stubGlobal("fetch", fetchMock);

  const r = await urlToMarkdown("https://datapas.nl", {
    paths: ["", "/diensten", "/bestaat-niet"],
  });
  expect(r.markdown).toContain("## Diensten");
  const statuses = r.pages.map((p) => p.status);
  expect(statuses.filter((s) => s === "ok")).toHaveLength(1);
  expect(statuses.filter((s) => s === "failed")).toHaveLength(2);
});

test("urlToMarkdown: alle pagina's falen → throws", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 500, text: async () => "" }))
  );
  await expect(urlToMarkdown("https://x.nl", { singlePage: true })).rejects.toThrow();
});

test("urlToMarkdown: teaser-<article>s verdringen #content niet (BIQQL-case)", async () => {
  // Nagebouwd naar biqql.com/industrie-en-logistiek/: geen <main>, de echte
  // inhoud zit in #content, en een "recente blogs"-widget levert meerdere
  // <article>-teaser-kaartjes. De oude first-match-logica pakte alleen de
  // eerste teaser en gooide 96% van de pagina weg.
  const html = `
    <html><body>
      <div id="content">
        <section>
          <h1>Industrie en logistiek</h1>
          <p>Echte pagina-inhoud over procesautomatisering in de industrie.</p>
          <p>${"Meer diepgaande inhoud over logistieke processen. ".repeat(20)}</p>
        </section>
        <section class="recente-blogs">
          <article><h3>Blog teaser een</h3><p>Korte teaser.</p></article>
          <article><h3>Blog teaser twee</h3><p>Nog een teaser.</p></article>
          <article><h3>Blog teaser drie</h3><p>Laatste teaser.</p></article>
        </section>
      </div>
    </body></html>`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, text: async () => html }))
  );
  const r = await urlToMarkdown("https://x.nl", { singlePage: true });
  expect(r.markdown).toContain("# Industrie en logistiek");
  expect(r.markdown).toContain("Echte pagina-inhoud over procesautomatisering");
});

test("urlToMarkdown: één enkele <article> blijft de hoofdinhoud", async () => {
  // Blogpost-pagina's zonder <main> wikkelen hun inhoud vaak in precies één
  // <article>; die moet als container vertrouwd blijven zodat sidebar-divs
  // eromheen niet meekomen.
  const html = `
    <html><body>
      <div class="sidebar-junk"><p>Zoeken</p></div>
      <article>
        <h1>Blogpost</h1>
        <p>${"De volledige blogtekst met alle inhoud. ".repeat(10)}</p>
      </article>
    </body></html>`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, text: async () => html }))
  );
  const r = await urlToMarkdown("https://x.nl", { singlePage: true });
  expect(r.markdown).toContain("# Blogpost");
  expect(r.markdown).toContain("De volledige blogtekst");
  expect(r.markdown).not.toContain("Zoeken");
});

test("urlToMarkdown: fallback naar <body> als <main> ontbreekt", async () => {
  const html = `<html><body><h1>Geen main</h1><p>Maar wel content</p></body></html>`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, text: async () => html }))
  );
  const r = await urlToMarkdown("https://x.nl", { singlePage: true });
  expect(r.markdown).toContain("# Geen main");
  expect(r.markdown).toContain("Maar wel content");
});
