import { test, expect, vi, afterEach } from "vitest";
import { isLegacyUrl, normalizeBaseUrl, urlToMarkdown } from "./url-to-markdown";

afterEach(() => vi.restoreAllMocks());

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
      <nav>menu</nav>
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
  expect(r.markdown).not.toContain("menu");
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
