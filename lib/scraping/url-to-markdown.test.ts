import { test, expect, vi, afterEach } from "vitest";
import { normalizeBaseUrl, urlToMarkdown } from "./url-to-markdown";

afterEach(() => vi.restoreAllMocks());

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
