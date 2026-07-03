// Twee-fasen-service voor de concurrentie-analyse.
// Sessie-verloop: running (discovery) → review (kandidaten bevestigen)
//   → running (diepe analyse) → approved.
// Beide fases draaien standaard op Claude + web search; kiest de admin
// perplexity als provider, dan zoekt die native.

import { analyzeClaudeSearchRaw } from "@/lib/ai/claude-search-raw";
import { analyzePerplexityRaw } from "@/lib/ai/perplexity-raw";
import { analyzeBothRaw } from "@/lib/ai/synthesize-raw";
import type { ClaudeRawResult } from "@/lib/ai/claude-raw";
import { extractAndParseJson } from "@/lib/ai/claude";
import { getModulePrompt } from "@/lib/modules/prompts";
import { getFormatExample } from "@/lib/modules/format-examples";
import type { ConfigProvider } from "@/lib/ai/pricing";
import { buildGenericPrompt } from "@/modules/generic/prompt";
import { toGenericOutput } from "@/modules/generic/service";
import { buildDiscoveryPrompt, formatConfirmedCompetitors } from "./prompt";
import {
  MODULE_SLUG,
  DISCOVERY_SLUG,
  DiscoveryReport,
  type ConcurrentenInput,
  type ConcurrentenSessionInput,
  type ConfirmedCompetitor,
} from "./schema";

export type SnapshotSource = { markdown: string; sourceUrl: string };

// Input-caps: grote snapshots (100k+ tekens) gaan bij élke zoekronde opnieuw
// mee in de prompt en drukken de analyse door Vercel's 300s-budget heen.
// Het aanbod (producten/diensten) staat vooraan in het snapshot; voor de
// vergelijking in fase 2 is iets meer eigen content nuttig.
const DISCOVERY_CONTENT_CAP = 20_000;
const DEEP_CONTENT_CAP = 30_000;

function capContent(markdown: string, cap: number): string {
  if (markdown.length <= cap) return markdown;
  return `${markdown.slice(0, cap)}\n\n[… website-content ingekort tot ${cap.toLocaleString("nl-NL")} tekens]`;
}

export type ServiceDeps = {
  fetchSnapshot: (snapshotId: string, userId: string) => Promise<SnapshotSource>;
  fetchPrompt: typeof getModulePrompt;
  fetchFormatExample: typeof getFormatExample;
  pickAnalyzer: (
    provider: ConfigProvider,
  ) => (args: { prompt: string }) => Promise<ClaudeRawResult>;
  updateSession: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

/** Zoek-varianten: claude → Claude mét web search. */
function defaultPickAnalyzer(
  provider: ConfigProvider,
): (args: { prompt: string }) => Promise<ClaudeRawResult> {
  if (provider === "perplexity") return analyzePerplexityRaw;
  if (provider === "both") return analyzeBothRaw;
  return analyzeClaudeSearchRaw;
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

export async function createConcurrentenSession(args: {
  userId: string;
  input: ConcurrentenInput;
}): Promise<string> {
  const { db } = await import("@/lib/db/client");
  const { sessions } = await import("@/lib/db/schema");
  const [row] = await db
    .insert(sessions)
    .values({
      userId: args.userId,
      moduleSlug: MODULE_SLUG,
      status: "running",
      input: args.input as unknown as Record<string, unknown>,
    })
    .returning({ id: sessions.id });
  return row.id;
}

/**
 * Fase 1: discovery. Zoekt kandidaat-concurrenten en zet de sessie op
 * "review". Ongeldige JSON = failed (de review-UI heeft structuur nodig).
 */
export async function runDiscovery(
  args: { sessionId: string; userId: string; input: ConcurrentenInput },
  deps: ServiceDeps = defaultDeps,
): Promise<void> {
  try {
    const snapshot = await deps.fetchSnapshot(
      args.input.snapshotId,
      args.userId,
    );
    const { prompt: template, provider } = await deps.fetchPrompt(
      DISCOVERY_SLUG,
    );

    const prompt = buildDiscoveryPrompt({
      template,
      input: args.input,
      scrapedContent: capContent(snapshot.markdown, DISCOVERY_CONTENT_CAP),
    });

    const analyzer = deps.pickAnalyzer(provider);
    const result = await analyzer({ prompt });

    let discovery: DiscoveryReport;
    try {
      discovery = DiscoveryReport.parse(extractAndParseJson(result.markdown));
    } catch {
      throw new Error(
        "De AI leverde geen bruikbare kandidatenlijst — probeer opnieuw.",
      );
    }

    await deps.updateSession(args.sessionId, {
      status: "review",
      output: JSON.stringify({ kind: "discovery", discovery }),
      promptUsed: result.promptUsed,
      llmModel: result.llmModel,
      llmInputTokens: result.llmInputTokens,
      llmOutputTokens: result.llmOutputTokens,
      llmCostCents: result.llmCostCents,
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

/**
 * Fase 2: diepe, vergelijkende analyse op de bevestigde concurrenten.
 * Hergebruikt het generieke sectie-contract → GenericReportView.
 * Telemetrie wordt bij die van fase 1 opgeteld.
 */
export async function runDeepAnalysis(
  args: {
    sessionId: string;
    userId: string;
    input: ConcurrentenSessionInput;
    confirmed: ConfirmedCompetitor[];
    phase1: {
      promptUsed: string | null;
      llmInputTokens: number;
      llmOutputTokens: number;
      llmCostCents: number;
    };
  },
  deps: ServiceDeps = defaultDeps,
): Promise<void> {
  try {
    const snapshot = await deps.fetchSnapshot(
      args.input.snapshotId,
      args.userId,
    );
    const { prompt: template, provider } = await deps.fetchPrompt(MODULE_SLUG);
    const formatExample = await deps.fetchFormatExample(MODULE_SLUG);

    const competitorsBlock = formatConfirmedCompetitors(args.confirmed);
    // Defensief: mist de admin-prompt de {competitors}-placeholder, plak de
    // bevestigde lijst er dan expliciet achteraan — anders analyseert fase 2
    // stilletjes zonder de door de gebruiker gekozen concurrenten.
    const effectiveTemplate = template.includes("{competitors}")
      ? template
      : `${template}\n\n---\nDOOR DE GEBRUIKER BEVESTIGDE CONCURRENTEN (analyseer precies deze):\n{competitors}`;

    const prompt = buildGenericPrompt({
      template: effectiveTemplate,
      formatExample,
      values: {
        websiteUrl: snapshot.sourceUrl,
        companyName: args.input.companyName,
        sector: args.input.sector ?? "",
        description: args.input.description ?? "",
        competitors: competitorsBlock,
        scrapedContent: capContent(snapshot.markdown, DEEP_CONTENT_CAP),
      },
    });

    const analyzer = deps.pickAnalyzer(provider);
    const result = await analyzer({ prompt });
    const output = toGenericOutput(result.markdown);

    await deps.updateSession(args.sessionId, {
      status: "approved",
      output: JSON.stringify(output),
      promptUsed: `${args.phase1.promptUsed ?? ""}\n\n=== DIEPE ANALYSE ===\n${result.promptUsed}`,
      llmModel: result.llmModel,
      llmInputTokens: args.phase1.llmInputTokens + result.llmInputTokens,
      llmOutputTokens: args.phase1.llmOutputTokens + result.llmOutputTokens,
      llmCostCents: args.phase1.llmCostCents + result.llmCostCents,
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
