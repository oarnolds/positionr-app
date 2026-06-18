import { test, expect, vi, afterEach } from "vitest";
import { scrapeWebsite } from "./scraper";

afterEach(() => vi.restoreAllMocks());

test("scrapeWebsite (zonder userId): succesvol → markdown (≤6000 tekens)", async () => {
  const big =
    "<html><body><main><h1>Titel</h1><p>" +
    "a".repeat(20000) +
    "</p></main></body></html>";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => big,
    })
  );
  const t = await scrapeWebsite("https://datapas.nl");
  expect(t.length).toBeLessThanOrEqual(6000);
  expect(t).toContain("# Titel");
});

test("scrapeWebsite (zonder userId): alle pagina's falen → throws", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "",
    })
  );
  await expect(scrapeWebsite("https://x.nl")).rejects.toThrow();
});
