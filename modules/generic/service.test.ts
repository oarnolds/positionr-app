import { test, expect, vi } from "vitest";
import {
  runGenericAnalysis,
  toGenericOutput,
  truncateForPerplexity,
  type ServiceDeps,
} from "./service";
import { GenericInputSchema } from "./schema";
import { buildGenericPrompt, JSON_CONTRACT } from "./prompt";

const USER_ID = "user-test-1";
const SNAPSHOT_ID = "3f9f6f6a-4c1e-4b3a-9b1e-1a2b3c4d5e6f";

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
    snapshotId: SNAPSHOT_ID,
    companyName: "Datapas B.V.",
    sector: "IT",
    description: "Data-dienstverlener",
    competitors: "",
    ...overrides,
  });
}

function makeDeps(
  llmResponse: string,
  provider: "claude" | "perplexity" = "claude",
): {
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
    fetchSnapshot: vi.fn().mockResolvedValue({
      markdown: "# Website content",
      sourceUrl: "https://datapas.nl",
    }),
    fetchPrompt: vi.fn().mockResolvedValue({
      prompt: "Analyseer {companyName} ({sector}) op {websiteUrl}.",
      provider,
    }),
    fetchFormatExample: vi.fn().mockResolvedValue("1. Scorecard — blue"),
    pickAnalyzer: vi.fn().mockReturnValue(analyze),
    updateSession: vi.fn().mockResolvedValue(undefined),
  };
  return { deps, analyze };
}

test("runGenericAnalysis: geldige JSON → report-envelope + approved", async () => {
  const { deps, analyze } = makeDeps(VALID_REPORT_JSON);
  await runGenericAnalysis(
    {
      sessionId: "s1",
      userId: USER_ID,
      moduleSlug: "propositie-analyse",
      input: makeInput(),
    },
    deps,
  );

  expect(deps.fetchSnapshot).toHaveBeenCalledWith(SNAPSHOT_ID, USER_ID);
  expect(deps.fetchPrompt).toHaveBeenCalledWith("propositie-analyse");
  // sourceUrl van het snapshot wordt als {websiteUrl} gesubstitueerd
  const sentPrompt = analyze.mock.calls[0][0].prompt as string;
  expect(sentPrompt).toContain("https://datapas.nl");
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

test("runGenericAnalysis: ontbrekend snapshot → failed met errorMessage", async () => {
  const { deps } = makeDeps(VALID_REPORT_JSON);
  deps.fetchSnapshot = vi
    .fn()
    .mockRejectedValue(new Error("Markdown-snapshot niet gevonden"));
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
  expect(patch.errorMessage).toContain("niet gevonden");
});

test("runGenericAnalysis: perplexity-provider → content binnen byte-budget", async () => {
  const { deps, analyze } = makeDeps(VALID_REPORT_JSON, "perplexity");
  // 200KB aan content — ruim boven het 80KB-budget
  deps.fetchSnapshot = vi.fn().mockResolvedValue({
    markdown: "x".repeat(200_000),
    sourceUrl: "https://datapas.nl",
  });
  await runGenericAnalysis(
    {
      sessionId: "s1",
      userId: USER_ID,
      moduleSlug: "website-check-concurrenten",
      input: makeInput(),
    },
    deps,
  );

  const sentPrompt = analyze.mock.calls[0][0].prompt as string;
  expect(new TextEncoder().encode(sentPrompt).length).toBeLessThan(100_000);
  expect(sentPrompt).toContain("afgekapt");
});

test("truncateForPerplexity: korte content blijft ongemoeid", () => {
  const result = truncateForPerplexity("korte tekst", (c) => c);
  expect(result).toBe("korte tekst");
});

test("truncateForPerplexity: kapt niet midden in een multi-byte teken", () => {
  // é = 2 bytes in UTF-8; een lange reeks forceert een knip op de grens
  const content = "é".repeat(60_000); // 120KB
  const result = truncateForPerplexity(content, (c) => c);
  // Decoderen zonder replacement chars bewijst een schone UTF-8-grens
  expect(result).not.toContain("�");
  expect(new TextEncoder().encode(result).length).toBeLessThan(85_000);
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
