// Generieke runner-service — naar het model van website-check:
// sessie aanmaken → op de achtergrond scrapen (of markdown-snapshot lezen)
// → prompt bouwen → raw-LLM-call → JSON parsen/valideren → sessie updaten.
//
// Het vangnet: we gebruiken bewust de RAW-adapters (één call, provider-
// agnostisch) en parsen zelf. Levert de LLM geen geldig contract, dan slaan
// we de output op als markdown en rendert de resultaatpagina het rapport in
// de klassieke markdown-stijl — een run faalt nooit puur op het formaat.

import { analyzeClaudeRaw, type ClaudeRawResult } from "@/lib/ai/claude-raw";
import { analyzePerplexityRaw } from "@/lib/ai/perplexity-raw";
import { analyzeBothRaw } from "@/lib/ai/synthesize-raw";
import { extractAndParseJson } from "@/lib/ai/claude";
import { getModulePrompt } from "@/lib/modules/prompts";
import { getFormatExample } from "@/lib/modules/format-examples";
// Herbruikt de website-check-scraper: die kent scrape-cache én
// markdown-bibliotheek-modus. Verhuist naar lib/ zodra een derde consument opduikt.
import { scrapeWebsite } from "@/modules/website-check/scraper";
import type { ConfigProvider } from "@/lib/ai/pricing";
import { buildGenericPrompt } from "./prompt";
import {
  GenericReport,
  isGenericModule,
  type GenericInput,
  type GenericOutput,
} from "./schema";

export type ServiceDeps = {
  scrape: typeof scrapeWebsite;
  fetchPrompt: typeof getModulePrompt;
  fetchFormatExample: typeof getFormatExample;
  pickAnalyzer: (
    provider: ConfigProvider,
  ) => (args: { prompt: string }) => Promise<ClaudeRawResult>;
  updateSession: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

function defaultPickAnalyzer(
  provider: ConfigProvider,
): (args: { prompt: string }) => Promise<ClaudeRawResult> {
  if (provider === "perplexity") return analyzePerplexityRaw;
  if (provider === "both") return analyzeBothRaw;
  return analyzeClaudeRaw;
}

export const defaultDeps: ServiceDeps = {
  scrape: scrapeWebsite,
  fetchPrompt: getModulePrompt,
  fetchFormatExample: getFormatExample,
  pickAnalyzer: defaultPickAnalyzer,
  updateSession: async (id, patch) => {
    const { eq, and } = await import("drizzle-orm");
    const { db } = await import("@/lib/db/client");
    const { sessions } = await import("@/lib/db/schema");
    await db
      .update(sessions)
      .set(patch)
      .where(and(eq(sessions.id, id), eq(sessions.status, "running")));
  },
};

export async function createGenericSession(args: {
  userId: string;
  moduleSlug: string;
  input: GenericInput;
}): Promise<string> {
  if (!isGenericModule(args.moduleSlug)) {
    throw new Error(`Module ${args.moduleSlug} draait niet op de generieke runner`);
  }
  const { db } = await import("@/lib/db/client");
  const { sessions } = await import("@/lib/db/schema");
  const [row] = await db
    .insert(sessions)
    .values({
      userId: args.userId,
      moduleSlug: args.moduleSlug,
      status: "running",
      input: args.input as unknown as Record<string, unknown>,
    })
    .returning({ id: sessions.id });
  return row.id;
}

/**
 * Probeer de LLM-output als GenericReport te parsen.
 * Retourneert de report-envelope, of de markdown-envelope als vangnet.
 */
export function toGenericOutput(rawMarkdown: string): GenericOutput {
  try {
    const parsed = extractAndParseJson(rawMarkdown);
    return { kind: "report", report: GenericReport.parse(parsed) };
  } catch {
    return { kind: "markdown", markdown: rawMarkdown };
  }
}

export async function runGenericAnalysis(
  args: {
    sessionId: string;
    userId: string;
    moduleSlug: string;
    input: GenericInput;
  },
  deps: ServiceDeps = defaultDeps,
): Promise<void> {
  try {
    const useMarkdown = args.input.analysisMode === "markdown";
    const scraped = await deps.scrape(args.input.websiteUrl, {
      userId: args.userId,
      requireExistingSnapshot: useMarkdown,
      maxChars: useMarkdown ? 0 : undefined,
    });

    const { prompt: template, provider } = await deps.fetchPrompt(
      args.moduleSlug,
    );
    const formatExample = await deps.fetchFormatExample(args.moduleSlug);

    const prompt = buildGenericPrompt({
      template,
      formatExample,
      values: {
        websiteUrl: args.input.websiteUrl,
        companyName: args.input.companyName,
        sector: args.input.sector,
        description: args.input.description,
        competitors: args.input.competitors,
        scrapedContent: scraped ?? "",
      },
    });

    const analyzer = deps.pickAnalyzer(provider);
    const result = await analyzer({ prompt });
    const output = toGenericOutput(result.markdown);

    await deps.updateSession(args.sessionId, {
      status: "approved",
      output: JSON.stringify(output),
      promptUsed: result.promptUsed,
      llmModel: result.llmModel,
      llmInputTokens: result.llmInputTokens,
      llmOutputTokens: result.llmOutputTokens,
      llmCostCents: result.llmCostCents,
      completedAt: new Date(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await deps.updateSession(args.sessionId, {
      status: "failed",
      errorMessage: msg,
      completedAt: new Date(),
    });
  }
}
