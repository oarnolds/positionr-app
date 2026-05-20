import { test, expect, vi } from "vitest";
import { runAnalysis, type ServiceDeps } from "./service";
import { WebsiteCheckOutputSchema, type WebsiteCheckOutput } from "./schema";

const mkOutput = (): WebsiteCheckOutput => ({
  companyName: "Datapas B.V.",
  websiteUrl: "https://datapas.nl",
  overallScore: 7,
  executiveSummary: "ok",
  onderdelen: Array.from({ length: 11 }, () => ({
    naam: "x", score: 7, toelichting: "y", verbeterpunten: [],
  })),
  sterkePunten: ["a","b","c"], verbeterpunten: ["x","y","z"],
  topActies: [{ actie: "fix", impact: "hoog", toelichting: "nu" }],
});

function makeDeps(): ServiceDeps & { _state: { updates: { id: string; patch: Record<string, unknown> }[] } } {
  const state = { updates: [] as { id: string; patch: Record<string, unknown> }[] };
  return {
    _state: state,
    scrape: vi.fn().mockResolvedValue("scraped text"),
    fetchPrompt: vi.fn().mockResolvedValue({
      prompt:
        "Analyseer {websiteUrl} van {companyName}. Inhoud:\n{scrapedContent}",
      provider: "claude" as const,
    }),
    analyze: vi.fn().mockResolvedValue({
      data: mkOutput(),
      promptUsed: "p", llmModel: "claude-sonnet-4-6",
      llmInputTokens: 100, llmOutputTokens: 50, llmCostCents: 1,
    }),
    updateSession: vi.fn(async (id, patch) => { state.updates.push({ id, patch }); }),
  };
}

test("runAnalysis: scrape + fetchPrompt + substitute + analyze + updateSession", async () => {
  const deps = makeDeps();
  await runAnalysis(
    { sessionId: "s1", websiteUrl: "https://datapas.nl", companyName: "Datapas B.V." },
    deps,
  );

  expect(deps.scrape).toHaveBeenCalledWith("https://datapas.nl");
  expect(deps.fetchPrompt).toHaveBeenCalledWith("website-check");
  expect(deps.analyze).toHaveBeenCalledWith({
    provider: "claude",
    prompt: expect.stringContaining(
      "Analyseer https://datapas.nl van Datapas B.V.",
    ),
    schema: WebsiteCheckOutputSchema,
  });

  expect(deps._state.updates).toHaveLength(1);
  const patch = deps._state.updates[0].patch;
  expect(patch.status).toBe("approved");
  expect(patch.output).toBeDefined();
  expect(patch.llmModel).toBe("claude-sonnet-4-6");
  expect(patch.llmInputTokens).toBe(100);
  expect(patch.completedAt).toBeInstanceOf(Date);
});

test("runAnalysis: scrape-fout → status=failed + errorMessage", async () => {
  const deps = makeDeps();
  deps.scrape = vi.fn().mockRejectedValue(new Error("boom"));
  await runAnalysis(
    { sessionId: "s1", websiteUrl: "https://x.nl", companyName: "X" },
    deps,
  );
  const patch = deps._state.updates[0].patch;
  expect(patch.status).toBe("failed");
  expect(patch.errorMessage).toMatch(/boom/);
});

test("runAnalysis: fetchPrompt-fout → status=failed", async () => {
  const deps = makeDeps();
  deps.fetchPrompt = vi.fn().mockRejectedValue(new Error("DB onbereikbaar"));
  await runAnalysis(
    { sessionId: "s2", websiteUrl: "https://x.nl", companyName: "X" },
    deps,
  );
  const patch = deps._state.updates[0].patch;
  expect(patch.status).toBe("failed");
  expect(patch.errorMessage).toMatch(/DB onbereikbaar/);
});

test("runAnalysis: substitueert placeholders met fallback voor lege waarden", async () => {
  const deps = makeDeps();
  await runAnalysis(
    { sessionId: "s3", websiteUrl: "https://x.nl", companyName: "" },
    deps,
  );
  // companyName "" → wordt "Onbekend"
  const analyzeArgs = (deps.analyze as ReturnType<typeof vi.fn>).mock.calls[0][0];
  expect(analyzeArgs.prompt).toContain("van Onbekend");
});
