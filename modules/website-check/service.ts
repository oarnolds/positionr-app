import { randomBytes } from "node:crypto";
import { analyzeClaudeRaw, type ClaudeRawResult } from "@/lib/ai/claude-raw";
import { analyzePerplexityRaw } from "@/lib/ai/perplexity-raw";
import { analyzeBothRaw } from "@/lib/ai/synthesize-raw";
import { getModulePrompt, substitutePlaceholders } from "@/lib/modules/prompts";
import { globalPlaceholders } from "@/lib/modules/global-placeholders";
import { getFormatExample } from "@/lib/modules/format-examples";
import { buildKnowledgeBlocks } from "@/lib/knowledge/matching";
import { websiteCheckSections } from "@/lib/knowledge/matching/adapters/website-check";
import type { KnowledgeBlock } from "@/lib/knowledge/matching/types";
import { scrapeWebsite } from "./scraper";
import { MODULE_SLUG } from "./index";
import type { ConfigProvider } from "@/lib/ai/pricing";

export type ScrapeOptions = {
  userId?: string;
  /** True = gebruik de bestaande markdown-bibliotheek-snapshot, geen verse scrape. */
  requireExistingSnapshot?: boolean;
  /** True = forceer live scrape zonder DB-read/write. */
  bypassCache?: boolean;
  /** 0 = geen cap, undefined = default 6000. */
  maxChars?: number;
};

export type ServiceDeps = {
  scrape: (url: string, options?: ScrapeOptions) => Promise<string>;
  fetchPrompt: typeof getModulePrompt;
  fetchFormatExample: typeof getFormatExample;
  /** Kies de juiste raw-adapter o.b.v. de provider die admin op de module gezet heeft. */
  pickAnalyzer: (
    provider: ConfigProvider,
  ) => (args: { prompt: string }) => Promise<ClaudeRawResult>;
  updateSession: (id: string, patch: Record<string, unknown>) => Promise<void>;
  buildBlocks: (markdown: string) => Promise<KnowledgeBlock[]>;
};

function defaultPickAnalyzer(
  provider: ConfigProvider,
): (args: { prompt: string }) => Promise<ClaudeRawResult> {
  if (provider === "perplexity") return analyzePerplexityRaw;
  if (provider === "both") return analyzeBothRaw;
  return analyzeClaudeRaw;
}

function generateShareSlug(): string {
  return randomBytes(8).toString("hex");
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
  buildBlocks: (markdown) => buildKnowledgeBlocks(websiteCheckSections(markdown)),
};

export async function createWebsiteCheckSession(input: {
  userId: string;
  websiteUrl: string;
  companyName: string;
  /** "scrape" (default) of "markdown" — bepaalt of we vers scrapen of de bibliotheek-snapshot gebruiken. */
  analysisMode?: "scrape" | "markdown";
}): Promise<{ sessionId: string; shareSlug: string }> {
  const { db } = await import("@/lib/db/client");
  const { sessions } = await import("@/lib/db/schema");
  const shareSlug = generateShareSlug();
  const [row] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      moduleSlug: MODULE_SLUG,
      status: "running",
      input: {
        websiteUrl: input.websiteUrl,
        companyName: input.companyName,
        analysisMode: input.analysisMode ?? "scrape",
      },
      shareSlug,
    })
    .returning({ id: sessions.id });
  return { sessionId: row.id, shareSlug };
}

export async function runAnalysis(
  args: {
    sessionId: string;
    userId: string;
    websiteUrl: string;
    companyName: string;
    /** True = gebruik bestaande markdown-snapshot, geen verse scrape, geen cap. */
    useExistingMarkdown?: boolean;
    /** True = forceer live scrape, geen cache-read of DB-write. */
    bypassCache?: boolean;
  },
  deps: ServiceDeps = defaultDeps,
): Promise<void> {
  try {
    const scraped = await deps.scrape(args.websiteUrl, {
      userId: args.userId,
      requireExistingSnapshot: args.useExistingMarkdown,
      bypassCache: args.bypassCache,
      maxChars: args.useExistingMarkdown ? 0 : undefined,
    });
    const { prompt: template, provider } = await deps.fetchPrompt(MODULE_SLUG);
    const formatTemplate = await deps.fetchFormatExample(MODULE_SLUG);
    if (!formatTemplate) {
      throw new Error("Geen format-template voor website-check gevonden in DB");
    }

    // Perplexity sonar-pro heeft een 100KB-per-message limit op user-content.
    // We cappen scraped op bytes (niet chars) — Nederlandse tekst inflate't
    // door UTF-8 met ~5-10%, dus een char-cap is onbetrouwbaar. Geldt zodra
    // Perplexity in de keten zit; Claude alleen kan zonder cap.
    // Conservatieve grens (80KB ipv 95KB): Perplexity lijkt soms extra
    // metadata/tokens mee te tellen, dus extra margin = robuustheid.
    const PERPLEXITY_BUDGET_BYTES = 80_000;
    const TRUNC_MARKER =
      "\n\n[… content afgekapt om binnen Perplexity API-limit van 100KB te blijven]";

    function buildPrompt(scrapedContent: string): string {
      const header = substitutePlaceholders(template, {
        ...globalPlaceholders(),
        websiteUrl: args.websiteUrl,
        companyName: args.companyName || "Onbekend",
        scrapedContent: scrapedContent || "(Kon website niet laden)",
      });
      return `${header}\n\n---\nFORMAT-TEMPLATE (volg deze structuur exact, vervang placeholders door inhoud op basis van de geschraapte data; behoud markdown-structuur, koppen en tabellen):\n\n${formatTemplate}\n\n---\nSchrijf nu de gevulde versie van bovenstaand format. Geef alleen de markdown terug, geen JSON, geen uitleg eromheen.`;
    }

    let effectiveScraped = scraped ?? "";
    if (provider === "perplexity" || provider === "both") {
      const encoder = new TextEncoder();
      const overheadBytes = encoder.encode(buildPrompt("")).length;
      const markerBytes = encoder.encode(TRUNC_MARKER).length;
      const scrapedBudgetBytes = PERPLEXITY_BUDGET_BYTES - overheadBytes;

      if (encoder.encode(effectiveScraped).length > scrapedBudgetBytes) {
        // Truncate op bytes: bouw incrementeel tot we onder het budget zitten.
        const targetBytes = scrapedBudgetBytes - markerBytes;
        const encoded = encoder.encode(effectiveScraped);
        let cutBytes = Math.min(targetBytes, encoded.length);
        // UTF-8 byte-grens vinden: zorg dat we niet midden in een multi-byte
        // sequence afkappen (continuation bytes beginnen met 10xxxxxx = 0x80-0xBF).
        while (cutBytes > 0 && (encoded[cutBytes] & 0xc0) === 0x80) cutBytes--;
        effectiveScraped = new TextDecoder().decode(encoded.slice(0, cutBytes)) + TRUNC_MARKER;
      }
    }

    const prompt = buildPrompt(effectiveScraped);

    if (provider === "perplexity" || provider === "both") {
      const finalBytes = new TextEncoder().encode(prompt).length;
      // Logt naar Vercel runtime-logs (zichtbaar in get_runtime_logs)
      // zodat we kunnen verifiëren dat we ruim onder de 100KB blijven.
      console.log(
        `[website-check] Perplexity prompt bytes=${finalBytes} provider=${provider}`,
      );
    }

    const analyzer = deps.pickAnalyzer(provider);
    const result = await analyzer({ prompt });
    const knowledgeBlocks = await deps.buildBlocks(result.markdown);

    await deps.updateSession(args.sessionId, {
      status: "approved",
      output: result.markdown,
      promptUsed: result.promptUsed,
      llmModel: result.llmModel,
      llmInputTokens: result.llmInputTokens,
      llmOutputTokens: result.llmOutputTokens,
      llmCostCents: result.llmCostCents,
      completedAt: new Date(),
      knowledgeBlocks,
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
