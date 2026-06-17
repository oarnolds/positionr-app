import { describe, it, expect, vi } from "vitest";
import { runFreeCheck } from "./freeCheck";

describe("runFreeCheck", () => {
  it("schrijft completed met markdown-resultaat bij succes", async () => {
    const updateLead = vi.fn();
    await runFreeCheck(
      { leadId: "lead-1", websiteUrl: "https://example.com" },
      {
        scrape: async () => "<html>...</html>",
        fetchPrompt: async () => ({
          prompt: "Analyseer {websiteUrl} {scrapedContent} {companyName}",
          provider: "claude",
        }),
        fetchFormatExample: async () => "# Voorbeeld\n\n[KLANTNAAM]",
        analyze: async () => ({
          markdown: "# Resultaat\n\nAnalyse van example.com",
          llmModel: "claude-sonnet-4-6",
          llmInputTokens: 100,
          llmOutputTokens: 50,
          llmCostCents: 1,
          promptUsed: "Analyseer https://example.com",
        }),
        updateLead,
      },
    );
    expect(updateLead).toHaveBeenCalledTimes(1);
    expect(updateLead.mock.calls[0][0]).toBe("lead-1");
    expect(updateLead.mock.calls[0][1]).toMatchObject({
      status: "completed",
      result: { markdown: "# Resultaat\n\nAnalyse van example.com" },
    });
    expect(updateLead.mock.calls[0][1].completedAt).toBeInstanceOf(Date);
  });

  it("schrijft failed met errorMessage bij scrape-fout", async () => {
    const updateLead = vi.fn();
    await runFreeCheck(
      { leadId: "lead-1", websiteUrl: "https://example.com" },
      {
        scrape: async () => {
          throw new Error("scrape kapot");
        },
        fetchPrompt: async () => ({ prompt: "", provider: "claude" }),
        fetchFormatExample: async () => "# Voorbeeld",
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

  it("schrijft failed als format-template ontbreekt", async () => {
    const updateLead = vi.fn();
    await runFreeCheck(
      { leadId: "lead-2", websiteUrl: "https://example.com" },
      {
        scrape: async () => "<html>...</html>",
        fetchPrompt: async () => ({
          prompt: "Analyseer {websiteUrl}",
          provider: "claude",
        }),
        fetchFormatExample: async () => null,
        analyze: async () => {
          throw new Error("zou niet moeten worden aangeroepen");
        },
        updateLead,
      },
    );
    expect(updateLead).toHaveBeenCalledTimes(1);
    expect(updateLead.mock.calls[0][1]).toMatchObject({
      status: "failed",
      errorMessage: expect.stringContaining("format-template"),
    });
  });
});
