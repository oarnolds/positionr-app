import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { z } from "zod";

const schema = z.object({ score: z.number() });
const originalFetch = global.fetch;

describe("analyzePerplexity", () => {
  beforeEach(() => {
    process.env.PERPLEXITY_API_KEY = "pplx-test-key";
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("stuurt prompt via fetch + parseert JSON-response", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"score": 8}' } }],
        usage: { prompt_tokens: 120, completion_tokens: 30 },
        model: "sonar-pro",
      }),
    });
    const { analyzePerplexity } = await import("./perplexity");
    const result = await analyzePerplexity({ prompt: "hi", schema });
    expect(result.data).toEqual({ score: 8 });
    expect(result.llmModel).toBe("sonar-pro");
    expect(result.llmInputTokens).toBe(120);
    expect(result.llmOutputTokens).toBe(30);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.perplexity.ai/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer pplx-test-key",
        }),
      }),
    );
  });

  it("strip markdown-fences uit JSON-content", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n{"score": 5}\n```' } }],
        usage: { prompt_tokens: 50, completion_tokens: 10 },
        model: "sonar-pro",
      }),
    });
    const { analyzePerplexity } = await import("./perplexity");
    const result = await analyzePerplexity({ prompt: "x", schema });
    expect(result.data).toEqual({ score: 5 });
  });

  it("gooit error bij non-200 response", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });
    const { analyzePerplexity } = await import("./perplexity");
    await expect(analyzePerplexity({ prompt: "x", schema })).rejects.toThrow(
      /401/,
    );
  });

  it("gooit error bij ongeldig JSON in content", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "geen JSON" } }],
        usage: { prompt_tokens: 50, completion_tokens: 10 },
        model: "sonar-pro",
      }),
    });
    const { analyzePerplexity } = await import("./perplexity");
    await expect(analyzePerplexity({ prompt: "x", schema })).rejects.toThrow();
  });

  it("gooit error als PERPLEXITY_API_KEY ontbreekt", async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const { analyzePerplexity } = await import("./perplexity");
    await expect(analyzePerplexity({ prompt: "x", schema })).rejects.toThrow(
      /PERPLEXITY_API_KEY/,
    );
  });
});
