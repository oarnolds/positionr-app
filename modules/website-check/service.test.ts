import { test, it, expect, vi, describe } from "vitest";
import { runAnalysis, type ServiceDeps } from "./service";

const USER_ID = "user-test-1";

function makeDeps(): ServiceDeps {
  return {
    scrape: vi.fn().mockResolvedValue("scraped content"),
    fetchPrompt: vi.fn().mockResolvedValue({
      prompt: "Analyseer {websiteUrl} van {companyName}. Inhoud:\n{scrapedContent}",
      provider: "claude" as const,
    }),
    fetchFormatExample: vi.fn().mockResolvedValue("# Voorbeeld\n\n[KLANTNAAM]"),
    analyze: vi.fn().mockResolvedValue({
      markdown: "# Resultaat\n\nVolledige analyse hier",
      promptUsed: "...",
      llmModel: "claude-sonnet-4-6",
      llmInputTokens: 100,
      llmOutputTokens: 50,
      llmCostCents: 1,
    }),
    updateSession: vi.fn().mockResolvedValue(undefined),
  };
}

test("runAnalysis: scrape + fetchPrompt + fetchFormatExample + analyze + updateSession", async () => {
  const deps = makeDeps();
  await runAnalysis(
    { sessionId: "s1", userId: USER_ID, websiteUrl: "https://datapas.nl", companyName: "Datapas B.V." },
    deps,
  );

  expect(deps.scrape).toHaveBeenCalledWith("https://datapas.nl", { userId: USER_ID });
  expect(deps.fetchPrompt).toHaveBeenCalledWith("website-check");
  expect(deps.fetchFormatExample).toHaveBeenCalledWith("website-check");
  expect(deps.analyze).toHaveBeenCalledWith({
    prompt: expect.stringContaining("FORMAT-TEMPLATE"),
  });

  expect(deps.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({
    status: "approved",
    output: "# Resultaat\n\nVolledige analyse hier",
    llmModel: "claude-sonnet-4-6",
    llmInputTokens: 100,
  }));
});

test("runAnalysis: completedAt is a Date on success", async () => {
  const deps = makeDeps();
  await runAnalysis(
    { sessionId: "s1", userId: USER_ID, websiteUrl: "https://datapas.nl", companyName: "Datapas B.V." },
    deps,
  );
  const patch = (deps.updateSession as ReturnType<typeof vi.fn>).mock.calls[0][1];
  expect(patch.completedAt).toBeInstanceOf(Date);
});

test("runAnalysis: scrape-fout → status=failed + errorMessage", async () => {
  const deps = makeDeps();
  deps.scrape = vi.fn().mockRejectedValue(new Error("boom"));
  await runAnalysis(
    { sessionId: "s1", userId: USER_ID, websiteUrl: "https://x.nl", companyName: "X" },
    deps,
  );
  expect(deps.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({
    status: "failed",
    errorMessage: expect.stringContaining("boom"),
  }));
});

test("runAnalysis: fetchPrompt-fout → status=failed", async () => {
  const deps = makeDeps();
  deps.fetchPrompt = vi.fn().mockRejectedValue(new Error("DB onbereikbaar"));
  await runAnalysis(
    { sessionId: "s2", userId: USER_ID, websiteUrl: "https://x.nl", companyName: "X" },
    deps,
  );
  expect(deps.updateSession).toHaveBeenCalledWith("s2", expect.objectContaining({
    status: "failed",
    errorMessage: expect.stringContaining("DB onbereikbaar"),
  }));
});

test("runAnalysis: substitueert placeholders met fallback voor lege companyName", async () => {
  const deps = makeDeps();
  await runAnalysis(
    { sessionId: "s3", userId: USER_ID, websiteUrl: "https://x.nl", companyName: "" },
    deps,
  );
  const analyzeArgs = (deps.analyze as ReturnType<typeof vi.fn>).mock.calls[0][0];
  expect(analyzeArgs.prompt).toContain("Onbekend");
});

describe("runAnalysis: ontbrekend format-template", () => {
  it("fail-path als er geen format-template in de DB staat", async () => {
    const deps = makeDeps();
    deps.fetchFormatExample = vi.fn().mockResolvedValue(null);
    await runAnalysis(
      { sessionId: "s2", userId: USER_ID, websiteUrl: "https://y.nl", companyName: "Y" },
      deps,
    );
    expect(deps.updateSession).toHaveBeenCalledWith("s2", expect.objectContaining({
      status: "failed",
      errorMessage: expect.stringContaining("format-template"),
    }));
  });
});
