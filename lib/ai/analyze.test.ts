import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// vi.hoisted zorgt dat de mocks naast vi.mock omhooggetild worden, zodat
// het mock-factory ze kan refereren zonder ReferenceError.
const { claudeMock, perplexityMock } = vi.hoisted(() => ({
  claudeMock: vi.fn(),
  perplexityMock: vi.fn(),
}));

vi.mock("./claude", () => ({ analyzeClaude: claudeMock }));
vi.mock("./perplexity", () => ({ analyzePerplexity: perplexityMock }));

import { analyze } from "./analyze";

const schema = z.object({ ok: z.boolean() });

const fakeResult = {
  data: { ok: true },
  llmModel: "test-model",
  llmInputTokens: 100,
  llmOutputTokens: 50,
  llmCostCents: 1,
  promptUsed: "test-prompt",
};

describe("analyze (router)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claudeMock.mockResolvedValue({ ...fakeResult, llmModel: "claude-sonnet-4-6" });
    perplexityMock.mockResolvedValue({ ...fakeResult, llmModel: "sonar-pro" });
  });

  it("routeert claude → analyzeClaude", async () => {
    const result = await analyze({ provider: "claude", prompt: "hi", schema });
    expect(claudeMock).toHaveBeenCalledWith({ prompt: "hi", schema });
    expect(perplexityMock).not.toHaveBeenCalled();
    expect(result.llmModel).toBe("claude-sonnet-4-6");
  });

  it("routeert perplexity → analyzePerplexity", async () => {
    const result = await analyze({
      provider: "perplexity",
      prompt: "hi",
      schema,
    });
    expect(perplexityMock).toHaveBeenCalledWith({ prompt: "hi", schema });
    expect(claudeMock).not.toHaveBeenCalled();
    expect(result.llmModel).toBe("sonar-pro");
  });
});
