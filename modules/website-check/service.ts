import { randomBytes } from "node:crypto";
import { analyzeClaudeRaw, type ClaudeRawResult } from "@/lib/ai/claude-raw";
import { getModulePrompt, substitutePlaceholders } from "@/lib/modules/prompts";
import { globalPlaceholders } from "@/lib/modules/global-placeholders";
import { getFormatExample } from "@/lib/modules/format-examples";
import { scrapeWebsite } from "./scraper";
import { MODULE_SLUG } from "./index";

export type ServiceDeps = {
  scrape: (url: string, options?: { userId?: string }) => Promise<string>;
  fetchPrompt: typeof getModulePrompt;
  fetchFormatExample: typeof getFormatExample;
  analyze: (args: { prompt: string }) => Promise<ClaudeRawResult>;
  updateSession: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

function generateShareSlug(): string {
  return randomBytes(8).toString("hex");
}

export const defaultDeps: ServiceDeps = {
  scrape: scrapeWebsite,
  fetchPrompt: getModulePrompt,
  fetchFormatExample: getFormatExample,
  analyze: analyzeClaudeRaw,
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

export async function createWebsiteCheckSession(input: {
  userId: string;
  websiteUrl: string;
  companyName: string;
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
      input: { websiteUrl: input.websiteUrl, companyName: input.companyName },
      shareSlug,
    })
    .returning({ id: sessions.id });
  return { sessionId: row.id, shareSlug };
}

export async function runAnalysis(
  args: { sessionId: string; userId: string; websiteUrl: string; companyName: string },
  deps: ServiceDeps = defaultDeps,
): Promise<void> {
  try {
    const scraped = await deps.scrape(args.websiteUrl, { userId: args.userId });
    const { prompt: template } = await deps.fetchPrompt(MODULE_SLUG);
    const formatTemplate = await deps.fetchFormatExample(MODULE_SLUG);
    if (!formatTemplate) {
      throw new Error("Geen format-template voor website-check gevonden in DB");
    }

    const promptHeader = substitutePlaceholders(template, {
      ...globalPlaceholders(),
      websiteUrl: args.websiteUrl,
      companyName: args.companyName || "Onbekend",
      scrapedContent: scraped || "(Kon website niet laden)",
    });

    const prompt = `${promptHeader}\n\n---\nFORMAT-TEMPLATE (volg deze structuur exact, vervang placeholders door inhoud op basis van de geschraapte data; behoud markdown-structuur, koppen en tabellen):\n\n${formatTemplate}\n\n---\nSchrijf nu de gevulde versie van bovenstaand format. Geef alleen de markdown terug, geen JSON, geen uitleg eromheen.`;

    const result = await deps.analyze({ prompt });

    await deps.updateSession(args.sessionId, {
      status: "approved",
      output: result.markdown,
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
