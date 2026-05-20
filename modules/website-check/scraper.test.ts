import { test, expect, vi, afterEach } from "vitest";
import { scrapeWebsite, normalizeUrl, htmlToText } from "./scraper";

afterEach(() => vi.restoreAllMocks());

test("normalizeUrl: voegt https:// toe als schema ontbreekt", () => {
  expect(normalizeUrl("datapas.nl")).toBe("https://datapas.nl");
  expect(normalizeUrl("http://x.nl")).toBe("http://x.nl");
  expect(normalizeUrl("https://x.nl")).toBe("https://x.nl");
});

test("htmlToText: strip scripts/styles/nav, behoudt zichtbare tekst", () => {
  const html = `
    <html><head><style>p{color:red}</style></head>
    <body><nav>menu</nav><script>var x=1</script>
    <h1>Hallo</h1><p>wereld</p></body></html>`;
  const t = htmlToText(html);
  expect(t).toContain("Hallo");
  expect(t).toContain("wereld");
  expect(t).not.toContain("menu");
  expect(t).not.toContain("color:red");
  expect(t).not.toContain("var x=1");
});

test("scrapeWebsite: succesvol → tekst (≤6000 tekens)", async () => {
  const big = "<p>" + "a".repeat(20000) + "</p>";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => big,
  }));
  const t = await scrapeWebsite("https://datapas.nl");
  expect(t.length).toBeLessThanOrEqual(6000);
});

test("scrapeWebsite: gooit bij HTTP-fout", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status: 503,
    text: async () => "",
  }));
  await expect(scrapeWebsite("https://x.nl")).rejects.toThrow(/503/);
});
