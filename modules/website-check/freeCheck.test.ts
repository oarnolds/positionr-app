import { describe, it, expect, vi } from "vitest";
import { runFreeCheck } from "./freeCheck";
import type { WebsiteCheckOutput } from "./schema";

const OUTPUT: WebsiteCheckOutput = {
  companyName: "Acme",
  websiteUrl: "https://example.com",
  overallScore: 7,
  executiveSummary: "ok",
  onderdelen: [],
  sterkePunten: [],
  verbeterpunten: [],
  topActies: [],
};

describe("runFreeCheck", () => {
  it("schrijft completed met resultaat bij succes", async () => {
    const updateLead = vi.fn();
    await runFreeCheck(
      { leadId: "lead-1", websiteUrl: "https://example.com" },
      {
        scrape: async () => "<html>...</html>",
        fetchPrompt: async () => ({
          prompt: "Analyseer {websiteUrl} {scrapedContent} {companyName}",
          provider: "claude",
        }),
        analyze: async () => ({
          data: OUTPUT,
          llmModel: "test",
          llmInputTokens: 1,
          llmOutputTokens: 1,
          llmCostCents: 0,
          promptUsed: "Analyseer https://example.com",
        }),
        updateLead,
      },
    );
    expect(updateLead).toHaveBeenCalledTimes(1);
    expect(updateLead.mock.calls[0][0]).toBe("lead-1");
    expect(updateLead.mock.calls[0][1]).toMatchObject({
      status: "completed",
      result: OUTPUT,
    });
    expect(updateLead.mock.calls[0][1].completedAt).toBeInstanceOf(Date);
  });

  it("schrijft failed met errorMessage bij fout", async () => {
    const updateLead = vi.fn();
    await runFreeCheck(
      { leadId: "lead-1", websiteUrl: "https://example.com" },
      {
        scrape: async () => {
          throw new Error("scrape kapot");
        },
        fetchPrompt: async () => ({ prompt: "", provider: "claude" }),
        analyze: async () => {
          throw new Error("zou niet moeten gebeuren");
        },
        updateLead,
      },
    );
    expect(updateLead).toHaveBeenCalledTimes(1);
    expect(updateLead.mock.calls[0][1]).toMatchObject({
      status: "failed",
      errorMessage: "scrape kapot",
    });
  });
});
