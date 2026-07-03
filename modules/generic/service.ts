// Generieke runner-service: sessie aanmaken → op de achtergrond het gekozen
// markdown-snapshot uit de bibliotheek lezen → prompt bouwen → raw-LLM-call
// → JSON parsen/valideren → sessie updaten.
//
// Live scraping is bewust uit dit proces gehaald (besluit juli 2026): alle
// analyses draaien op een door de gebruiker gekozen bibliotheek-snapshot.
// De markdown-conversie zelf gebeurt in de Markdown-bibliotheek op /modules.
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
import type { ConfigProvider } from "@/lib/ai/pricing";
import { buildGenericPrompt } from "./prompt";
import {
  GenericReport,
  isGenericModule,
  type GenericInput,
  type GenericOutput,
} from "./schema";

export type SnapshotSource = {
  markdown: string;
  sourceUrl: string;
};

export type ServiceDeps = {
  /** Laadt het gekozen bibliotheek-snapshot (elke kind: website/pdf/docx). */
  fetchSnapshot: (snapshotId: string, userId: string) => Promise<SnapshotSource>;
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

async function defaultFetchSnapshot(
  snapshotId: string,
  userId: string,
): Promise<SnapshotSource> {
  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("@/lib/db/client");
  const { markdownSnapshots } = await import("@/lib/db/schema");
  const [snapshot] = await db
    .select({
      markdown: markdownSnapshots.markdown,
      sourceUrl: markdownSnapshots.sourceUrl,
    })
    .from(markdownSnapshots)
    .where(
      and(
        eq(markdownSnapshots.id, snapshotId),
        eq(markdownSnapshots.userId, userId),
      ),
    )
    .limit(1);
  if (!snapshot) {
    throw new Error(
      "Markdown-snapshot niet gevonden. Maak 'm eerst aan via 'Markdown bibliotheek' op /modules.",
    );
  }
  return snapshot;
}

export const defaultDeps: ServiceDeps = {
  fetchSnapshot: defaultFetchSnapshot,
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

// Perplexity sonar-pro heeft een 100KB-per-message limit op user-content.
// Cap op bytes (niet chars): Nederlandse tekst inflate't door UTF-8 met
// ~5-10%. Conservatieve grens voor extra marge (zelfde aanpak als
// website-check).
const PERPLEXITY_BUDGET_BYTES = 80_000;
const TRUNC_MARKER =
  "\n\n[… content afgekapt om binnen Perplexity API-limit van 100KB te blijven]";

export function truncateForPerplexity(
  content: string,
  buildPrompt: (content: string) => string,
): string {
  const encoder = new TextEncoder();
  const overheadBytes = encoder.encode(buildPrompt("")).length;
  const markerBytes = encoder.encode(TRUNC_MARKER).length;
  const budgetBytes = PERPLEXITY_BUDGET_BYTES - overheadBytes;

  const encoded = encoder.encode(content);
  if (encoded.length <= budgetBytes) return content;

  let cutBytes = Math.max(0, Math.min(budgetBytes - markerBytes, encoded.length));
  // UTF-8 byte-grens vinden: niet midden in een multi-byte sequence afkappen
  // (continuation bytes beginnen met 10xxxxxx = 0x80-0xBF).
  while (cutBytes > 0 && (encoded[cutBytes] & 0xc0) === 0x80) cutBytes--;
  return new TextDecoder().decode(encoded.slice(0, cutBytes)) + TRUNC_MARKER;
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
    const snapshot = await deps.fetchSnapshot(
      args.input.snapshotId,
      args.userId,
    );

    const { prompt: template, provider } = await deps.fetchPrompt(
      args.moduleSlug,
    );
    const formatExample = await deps.fetchFormatExample(args.moduleSlug);

    const build = (scrapedContent: string) =>
      buildGenericPrompt({
        template,
        formatExample,
        values: {
          websiteUrl: snapshot.sourceUrl,
          companyName: args.input.companyName,
          sector: args.input.sector,
          description: args.input.description,
          competitors: args.input.competitors,
          scrapedContent,
        },
      });

    const content =
      provider === "perplexity" || provider === "both"
        ? truncateForPerplexity(snapshot.markdown, build)
        : snapshot.markdown;
    const prompt = build(content);

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
