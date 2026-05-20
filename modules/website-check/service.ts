import { randomBytes } from "node:crypto";
import { analyzeWithCachedSystem, type AnalyzeResult } from "@/lib/ai/claude";
import { scrapeWebsite } from "./scraper";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import {
  WebsiteCheckOutputSchema,
  type WebsiteCheckOutput,
} from "./schema";
import { MODULE_SLUG } from "./index";

export type ServiceDeps = {
  scrape: (url: string) => Promise<string>;
  analyze: (args: { system: string; user: string }) => Promise<AnalyzeResult<WebsiteCheckOutput>>;
  updateSession: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

function generateShareSlug(): string {
  return randomBytes(8).toString("hex");
}

export const defaultDeps: ServiceDeps = {
  scrape: scrapeWebsite,
  analyze: ({ system, user }) =>
    analyzeWithCachedSystem({ system, user, schema: WebsiteCheckOutputSchema }),
  updateSession: async (id, patch) => {
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/lib/db/client");
    const { sessions } = await import("@/lib/db/schema");
    await db.update(sessions).set(patch).where(eq(sessions.id, id));
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
    const scraped = await deps.scrape(args.websiteUrl);
    const user = buildUserPrompt({
      companyName: args.companyName,
      websiteUrl: args.websiteUrl,
      scrapedContent: scraped,
    });
    const result = await deps.analyze({ system: SYSTEM_PROMPT, user });
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
