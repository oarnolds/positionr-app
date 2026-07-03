import { test, expect, vi } from "vitest";
import { runGenericAnalysis, toGenericOutput, type ServiceDeps } from "./service";
import { GenericInputSchema } from "./schema";
import { buildGenericPrompt, JSON_CONTRACT } from "./prompt";

const USER_ID = "user-test-1";

const VALID_REPORT_JSON = JSON.stringify({
  heroTekst: "Sterke propositie met ruimte voor scherpte.",
  secties: [
    {
      titel: "Scorecard",
      accent: "blue",
      layout: "half",
      inhoud: "",
      feiten: [{ label: "Duidelijkheid", waarde: "7/10" }],
    },
    {
      titel: "Kern",
      accent: "purple",
      layout: "half",
      inhoud: "De kern is **helder**.",
      chips: ["B2B", "SaaS"],
    },
  ],
  volgendeStappen: ["Herschrijf de hero"],
});

function makeInput(overrides: Record<string, unknown> = {}) {
  return GenericInputSchema.parse({
    websiteUrl: "https://datapas.nl",
    companyName: "Datapas B.V.",
    sector: "IT",
    description: "Data-dienstverlener",
    competitors: "",
    analysisMode: "scrape",
    ...overrides,
  });
}

function makeDeps(llmResponse: string): {
  deps: ServiceDeps;
  analyze: ReturnType<typeof vi.fn>;
} {
  const analyze = vi.fn().mockResolvedValue({
    markdown: llmResponse,
    promptUsed: "...",
    llmModel: "claude-sonnet-4-6",
    llmInputTokens: 100,
    llmOutputTokens: 50,
    llmCostCents: 1,
  });
  const deps: ServiceDeps = {
    scrape: vi.fn().mockResolvedValue("# Website content"),
    fetchPrompt: vi.fn().mockResolvedValue({
      prompt: "Analyseer {companyName} ({sector}) op {websiteUrl}.",
      provider: "claude" as const,
    }),
    fetchFormatExample: vi.fn().mockResolvedValue("1. Scorecard — blue"),
    pickAnalyzer: vi.fn().mockReturnValue(analyze),
    updateSession: vi.fn().mockResolvedValue(undefined),
  };
  return { deps, analyze };
}

test("runGenericAnalysis: geldige JSON → report-envelope + approved", async () => {
  const { deps } = makeDeps(VALID_REPORT_JSON);
  await runGenericAnalysis(
    {
      sessionId: "s1",
      userId: USER_ID,
      moduleSlug: "propositie-analyse",
      input: makeInput(),
    },
    deps,
  );

  expect(deps.fetchPrompt).toHaveBeenCalledWith("propositie-analyse");
  const patch = (deps.updateSession as ReturnType<typeof vi.fn>).mock
    .calls[0][1];
  expect(patch.status).toBe("approved");
  const output = JSON.parse(patch.output);
  expect(output.kind).toBe("report");
  expect(output.report.secties).toHaveLength(2);
});

test("runGenericAnalysis: ongeldige JSON → markdown-fallback, geen failure", async () => {
  const { deps } = makeDeps("# Gewoon een markdown-rapport\n\nZonder JSON.");
  await runGenericAnalysis(
    {
      sessionId: "s1",
      userId: USER_ID,
      moduleSlug: "propositie-analyse",
      input: makeInput(),
    },
    deps,
  );

  const patch = (deps.updateSession as ReturnType<typeof vi.fn>).mock
    .calls[0][1];
  expect(patch.status).toBe("approved");
  const output = JSON.parse(patch.output);
  expect(output.kind).toBe("markdown");
  expect(output.markdown).toContain("Gewoon een markdown-rapport");
});

test("runGenericAnalysis: markdown-modus → requireExistingSnapshot + geen cap", async () => {
  const { deps } = makeDeps(VALID_REPORT_JSON);
  await runGenericAnalysis(
    {
      sessionId: "s1",
      userId: USER_ID,
      moduleSlug: "klantcase-analyse",
      input: makeInput({ analysisMode: "markdown" }),
    },
    deps,
  );

  expect(deps.scrape).toHaveBeenCalledWith(
    "https://datapas.nl",
    expect.objectContaining({
      userId: USER_ID,
      requireExistingSnapshot: true,
      maxChars: 0,
    }),
  );
});

test("runGenericAnalysis: scrape-fout → failed met errorMessage", async () => {
  const { deps } = makeDeps(VALID_REPORT_JSON);
  deps.scrape = vi.fn().mockRejectedValue(new Error("Site onbereikbaar"));
  await runGenericAnalysis(
    {
      sessionId: "s1",
      userId: USER_ID,
      moduleSlug: "propositie-analyse",
      input: makeInput(),
    },
    deps,
  );

  const patch = (deps.updateSession as ReturnType<typeof vi.fn>).mock
    .calls[0][1];
  expect(patch.status).toBe("failed");
  expect(patch.errorMessage).toBe("Site onbereikbaar");
});

test("toGenericOutput: JSON in markdown-fences wordt geparsed", () => {
  const fenced = "```json\n" + VALID_REPORT_JSON + "\n```";
  const output = toGenericOutput(fenced);
  expect(output.kind).toBe("report");
});

test("toGenericOutput: onbekend accent degradeert naar default ipv failure", () => {
  const drifted = JSON.stringify({
    heroTekst: "x",
    secties: [{ titel: "A", accent: "magenta", layout: "diagonaal", inhoud: "y" }],
  });
  const output = toGenericOutput(drifted);
  expect(output.kind).toBe("report");
  if (output.kind === "report") {
    expect(output.report.secties[0].accent).toBe("blue");
    expect(output.report.secties[0].layout).toBe("volledig");
  }
});

test("buildGenericPrompt: substitueert placeholders + voegt content-blok en contract toe", () => {
  const prompt = buildGenericPrompt({
    template: "Analyseer {companyName} ({sector}) op {websiteUrl}.",
    formatExample: "1. Scorecard — blue",
    values: {
      websiteUrl: "https://datapas.nl",
      companyName: "Datapas",
      sector: "IT",
      description: "",
      competitors: "",
      scrapedContent: "# Content",
    },
  });
  expect(prompt).toContain("Analyseer Datapas (IT) op https://datapas.nl.");
  // Template zonder {scrapedContent} → content-blok automatisch toegevoegd
  expect(prompt).toContain("WEBSITE-CONTENT");
  expect(prompt).toContain("LAYOUT-INSTRUCTIE");
  expect(prompt).toContain(JSON_CONTRACT);
});

test("buildGenericPrompt: template mét {scrapedContent} krijgt geen extra content-blok", () => {
  const prompt = buildGenericPrompt({
    template: "Analyseer:\n{scrapedContent}",
    formatExample: null,
    values: {
      websiteUrl: "https://datapas.nl",
      companyName: "Datapas",
      sector: "",
      description: "",
      competitors: "",
      scrapedContent: "# Content",
    },
  });
  expect(prompt).toContain("# Content");
  expect(prompt).not.toContain("WEBSITE-CONTENT");
  // Het contract zelf noemt "LAYOUT-INSTRUCTIE" — check specifiek op de blok-header.
  expect(prompt).not.toContain("LAYOUT-INSTRUCTIE (bepaalt");
});

test("buildGenericPrompt: {competitors} wordt gesubstitueerd", () => {
  const prompt = buildGenericPrompt({
    template: "Vergelijk met:\n{competitors}",
    formatExample: null,
    values: {
      websiteUrl: "https://datapas.nl",
      companyName: "Datapas",
      sector: "",
      description: "",
      competitors: "https://concurrent1.nl\nhttps://concurrent2.nl",
      scrapedContent: "",
    },
  });
  expect(prompt).toContain("https://concurrent1.nl");
  expect(prompt).toContain("https://concurrent2.nl");
});
