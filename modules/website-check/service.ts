import { randomBytes } from "node:crypto";
import { analyze, type AnalyzeArgs } from "@/lib/ai/analyze";
import { getModulePrompt, substitutePlaceholders } from "@/lib/modules/prompts";
import { scrapeWebsite } from "./scraper";
import {
  WebsiteCheckOutputSchema,
  type WebsiteCheckOutput,
} from "./schema";
import { MODULE_SLUG } from "./index";

export type ServiceDeps = {
  scrape: (url: string) => Promise<string>;
  fetchPrompt: typeof getModulePrompt;
  analyze: (
    args: AnalyzeArgs<WebsiteCheckOutput>,
  ) => ReturnType<typeof analyze<WebsiteCheckOutput>>;
  updateSession: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

function generateShareSlug(): string {
  return randomBytes(8).toString("hex");
}

export const defaultDeps: ServiceDeps = {
  scrape: scrapeWebsite,
  fetchPrompt: getModulePrompt,
  analyze: (args) => analyze<WebsiteCheckOutput>(args),
  updateSession: async (id, patch) => {
    const { eq, and } = await import("drizzle-orm");
    const { db } = await import("@/lib/db/client");
    const { sessions } = await import("@/lib/db/schema");
    // WHERE-guard op status='running' voorkomt dat een late achtergrond-update
    // een sessie overschrijft die ondertussen door de gebruiker is geannuleerd
    // of door auto-fail op timeout is gezet.
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
  args: { sessionId: string; websiteUrl: string; companyName: string },
  deps: ServiceDeps = defaultDeps,
): Promise<void> {
  try {
    // 1. Scrape de website (zelfde als voorheen)
    const scraped = await deps.scrape(args.websiteUrl);

    // 2. Haal de actieve prompt + provider uit de DB (met code-fallback)
    const { prompt: template, provider } = await deps.fetchPrompt(MODULE_SLUG);

    // 3. Substitueer placeholders met runtime-waarden
    const prompt = substitutePlaceholders(template, {
      websiteUrl: args.websiteUrl,
      companyName: args.companyName || "Onbekend",
      scrapedContent: scraped || "(Kon website niet laden)",
    });

    // 4. Provider-agnostic analyze (routeert naar Claude of Perplexity)
    const result = await deps.analyze({
      provider,
      prompt,
      schema: WebsiteCheckOutputSchema,
    });

    // 5. Sessie afronden
    await deps.updateSession(args.sessionId, {
      status: "approved",
      output: result.data,
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
