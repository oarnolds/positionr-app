import { analyze, type AnalyzeArgs } from "@/lib/ai/analyze";
import { getModulePrompt, substitutePlaceholders } from "@/lib/modules/prompts";
import { scrapeWebsite } from "./scraper";
import {
  WebsiteCheckOutputSchema,
  type WebsiteCheckOutput,
} from "./schema";
import { MODULE_SLUG } from "./index";

export type FreeCheckDeps = {
  scrape: (url: string) => Promise<string>;
  fetchPrompt: typeof getModulePrompt;
  analyze: (
    args: AnalyzeArgs<WebsiteCheckOutput>,
  ) => ReturnType<typeof analyze<WebsiteCheckOutput>>;
  updateLead: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

export const defaultFreeCheckDeps: FreeCheckDeps = {
  scrape: scrapeWebsite,
  fetchPrompt: getModulePrompt,
  analyze: (args) => analyze<WebsiteCheckOutput>(args),
  updateLead: async (id, patch) => {
    const { eq, and } = await import("drizzle-orm");
    const { db } = await import("@/lib/db/client");
    const { leads } = await import("@/lib/db/schema");
    // WHERE-guard op status='running' voorkomt dat een late achtergrond-update
    // een al-afgehandelde lead overschrijft.
    await db
      .update(leads)
      .set(patch)
      .where(and(eq(leads.id, id), eq(leads.status, "running")));
  },
};

export async function runFreeCheck(
  args: { leadId: string; websiteUrl: string },
  deps: FreeCheckDeps = defaultFreeCheckDeps,
): Promise<void> {
  try {
    const scraped = await deps.scrape(args.websiteUrl);
    const { prompt: template, provider } = await deps.fetchPrompt(MODULE_SLUG);
    const prompt = substitutePlaceholders(template, {
      websiteUrl: args.websiteUrl,
      companyName: "Onbekend",
      scrapedContent: scraped || "(Kon website niet laden)",
    });
    const result = await deps.analyze({
      provider,
      prompt,
      schema: WebsiteCheckOutputSchema,
    });
    await deps.updateLead(args.leadId, {
      status: "completed",
      result: result.data,
      completedAt: new Date(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await deps.updateLead(args.leadId, {
      status: "failed",
      errorMessage: msg,
      completedAt: new Date(),
    });
  }
}
