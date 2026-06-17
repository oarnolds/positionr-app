import { analyzeClaudeRaw, type ClaudeRawResult } from "@/lib/ai/claude-raw";
import { getModulePrompt, substitutePlaceholders } from "@/lib/modules/prompts";
import { globalPlaceholders } from "@/lib/modules/global-placeholders";
import { getFormatExample } from "@/lib/modules/format-examples";
import { scrapeWebsite } from "./scraper";
import { MODULE_SLUG } from "./index";

export type FreeCheckDeps = {
  scrape: (url: string) => Promise<string>;
  fetchPrompt: typeof getModulePrompt;
  fetchFormatExample: typeof getFormatExample;
  analyze: (args: { prompt: string }) => Promise<ClaudeRawResult>;
  updateLead: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

export const defaultFreeCheckDeps: FreeCheckDeps = {
  scrape: scrapeWebsite,
  fetchPrompt: getModulePrompt,
  fetchFormatExample: getFormatExample,
  analyze: analyzeClaudeRaw,
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
    const { prompt: template } = await deps.fetchPrompt(MODULE_SLUG);
    const formatTemplate = await deps.fetchFormatExample(MODULE_SLUG);
    if (!formatTemplate) {
      throw new Error("Geen format-template voor website-check gevonden in DB");
    }

    const promptHeader = substitutePlaceholders(template, {
      ...globalPlaceholders(),
      websiteUrl: args.websiteUrl,
      companyName: "Onbekend",
      scrapedContent: scraped || "(Kon website niet laden)",
    });

    const prompt = `${promptHeader}\n\n---\nFORMAT-TEMPLATE (volg deze structuur exact, vervang placeholders door inhoud op basis van de geschraapte data; behoud markdown-structuur, koppen en tabellen):\n\n${formatTemplate}\n\n---\nSchrijf nu de gevulde versie van bovenstaand format. Geef alleen de markdown terug, geen JSON, geen uitleg eromheen.`;

    const result = await deps.analyze({ prompt });

    await deps.updateLead(args.leadId, {
      status: "completed",
      result: { markdown: result.markdown },
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
