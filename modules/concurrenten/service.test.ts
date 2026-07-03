import { test, expect, vi } from "vitest";
import { runDiscovery, runDeepAnalysis, type ServiceDeps } from "./service";
import {
  ConcurrentenInputSchema,
  parseConcurrentenOutput,
} from "./schema";
import {
  buildDiscoveryPrompt,
  formatConfirmedCompetitors,
  DISCOVERY_JSON_CONTRACT,
} from "./prompt";

const USER_ID = "user-test-1";
const SNAPSHOT_ID = "3f9f6f6a-4c1e-4b3a-9b1e-1a2b3c4d5e6f";

const VALID_DISCOVERY_JSON = JSON.stringify({
  samenvatting: "Actief in e-facturering en low-code.",
  kandidaten: [
    {
      naam: "Dynatos",
      websiteUrl: "https://dynatos.com",
      reden: "Zelfde P2P/e-facturatie-aanbod",
      segment: "E-facturering",
    },
    {
      naam: "EsperantoXL",
      websiteUrl: "",
      reden: "Low-code implementatiepartner",
      segment: "Low-code",
    },
  ],
});

const VALID_REPORT_JSON = JSON.stringify({
  heroTekst: "Sterke niche-positie met twee directe bedreigingen.",
  secties: [
    { titel: "Overzicht", accent: "blue", layout: "volledig", inhoud: "| a | b |" },
  ],
});

function makeInput() {
  return ConcurrentenInputSchema.parse({
    snapshotId: SNAPSHOT_ID,
    companyName: "NLeyes",
    geografie: "Nederland",
    sector: "IT",
    description: "",
  });
}

function makeDeps(llmResponse: string): {
  deps: ServiceDeps;
  analyze: ReturnType<typeof vi.fn>;
} {
  const analyze = vi.fn().mockResolvedValue({
    markdown: llmResponse,
    promptUsed: "fase-prompt",
    llmModel: "claude-sonnet-4-6 + web_search",
    llmInputTokens: 100,
    llmOutputTokens: 50,
    llmCostCents: 2,
  });
  const deps: ServiceDeps = {
    fetchSnapshot: vi.fn().mockResolvedValue({
      markdown: "# NLeyes\nGEM-platform en Peppol e-facturering",
      sourceUrl: "https://nleyes.com",
    }),
    fetchPrompt: vi.fn().mockResolvedValue({
      prompt: "Zoek concurrenten van {companyName} in {geografie}.",
      provider: "claude" as const,
    }),
    fetchFormatExample: vi.fn().mockResolvedValue("1. Overzicht — blue"),
    pickAnalyzer: vi.fn().mockReturnValue(analyze),
    updateSession: vi.fn().mockResolvedValue(undefined),
  };
  return { deps, analyze };
}

test("runDiscovery: geldige JSON → status review + discovery-envelope", async () => {
  const { deps } = makeDeps(VALID_DISCOVERY_JSON);
  await runDiscovery(
    { sessionId: "s1", userId: USER_ID, input: makeInput() },
    deps,
  );

  expect(deps.fetchPrompt).toHaveBeenCalledWith(
    "website-check-concurrenten-discovery",
  );
  const patch = (deps.updateSession as ReturnType<typeof vi.fn>).mock
    .calls[0][1];
  expect(patch.status).toBe("review");
  const output = JSON.parse(patch.output);
  expect(output.kind).toBe("discovery");
  expect(output.discovery.kandidaten).toHaveLength(2);
  // Review is een tussenstap — completedAt hoort er nog niet te zijn.
  expect(patch.completedAt).toBeUndefined();
});

test("runDiscovery: ongeldige JSON → failed (review-UI heeft structuur nodig)", async () => {
  const { deps } = makeDeps("Hier zijn wat concurrenten: Dynatos, ...");
  await runDiscovery(
    { sessionId: "s1", userId: USER_ID, input: makeInput() },
    deps,
  );

  const patch = (deps.updateSession as ReturnType<typeof vi.fn>).mock
    .calls[0][1];
  expect(patch.status).toBe("failed");
  expect(patch.errorMessage).toContain("probeer opnieuw");
});

test("runDeepAnalysis: bevestigde concurrenten in prompt + telemetrie opgeteld", async () => {
  const { deps, analyze } = makeDeps(VALID_REPORT_JSON);
  await runDeepAnalysis(
    {
      sessionId: "s1",
      userId: USER_ID,
      input: makeInput(),
      confirmed: [
        { naam: "Dynatos", websiteUrl: "https://dynatos.com" },
        { naam: "Handmatige BV", websiteUrl: "" },
      ],
      phase1: {
        promptUsed: "discovery-prompt",
        llmInputTokens: 200,
        llmOutputTokens: 80,
        llmCostCents: 3,
      },
    },
    deps,
  );

  expect(deps.fetchPrompt).toHaveBeenCalledWith("website-check-concurrenten");
  const sentPrompt = analyze.mock.calls[0][0].prompt as string;
  expect(sentPrompt).toContain("Dynatos (https://dynatos.com)");
  expect(sentPrompt).toContain("Handmatige BV");

  const patch = (deps.updateSession as ReturnType<typeof vi.fn>).mock
    .calls[0][1];
  expect(patch.status).toBe("approved");
  expect(patch.llmInputTokens).toBe(300); // 200 + 100
  expect(patch.llmOutputTokens).toBe(130); // 80 + 50
  expect(patch.llmCostCents).toBe(5); // 3 + 2
  expect(patch.promptUsed).toContain("discovery-prompt");
  expect(patch.promptUsed).toContain("=== DIEPE ANALYSE ===");
  const output = JSON.parse(patch.output);
  expect(output.kind).toBe("report");
});

test("buildDiscoveryPrompt: placeholders + content-blok + contract", () => {
  const prompt = buildDiscoveryPrompt({
    template: "Zoek concurrenten van {companyName} in {geografie}.",
    input: makeInput(),
    scrapedContent: "# Content",
  });
  expect(prompt).toContain("Zoek concurrenten van NLeyes in Nederland.");
  expect(prompt).toContain("WEBSITE-CONTENT");
  expect(prompt).toContain(DISCOVERY_JSON_CONTRACT);
});

test("formatConfirmedCompetitors: met en zonder URL", () => {
  const formatted = formatConfirmedCompetitors([
    { naam: "A", websiteUrl: "https://a.nl" },
    { naam: "B", websiteUrl: "" },
  ]);
  expect(formatted).toBe("- A (https://a.nl)\n- B");
});

test("parseConcurrentenOutput: discovery en report round-trip", () => {
  const discovery = parseConcurrentenOutput(
    JSON.stringify({
      kind: "discovery",
      discovery: JSON.parse(VALID_DISCOVERY_JSON),
    }),
  );
  expect(discovery?.kind).toBe("discovery");

  const report = parseConcurrentenOutput(
    JSON.stringify({ kind: "report", report: JSON.parse(VALID_REPORT_JSON) }),
  );
  expect(report?.kind).toBe("report");

  expect(parseConcurrentenOutput("geen json")).toBeNull();
});
