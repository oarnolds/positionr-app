import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => {
  // Class-based mock zodat `new Anthropic({apiKey})` werkt
  class FakeAnthropic {
    messages = { create: mockCreate };
    constructor(_opts: unknown) {}
  }
  return { default: FakeAnthropic };
});

const schema = z.object({ score: z.number() });

describe("analyzeClaude (single-message)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key-1234567890abcdef";
    mockCreate.mockReset();
  });

  it("stuurt single user-message + parseert JSON-response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"score": 7}' }],
      usage: { input_tokens: 100, output_tokens: 50 },
      model: "claude-sonnet-4-6",
    });
    const { analyzeClaude } = await import("./claude");
    const result = await analyzeClaude({ prompt: "test prompt", schema });
    expect(result.data).toEqual({ score: 7 });
    expect(result.llmInputTokens).toBe(100);
    expect(result.llmOutputTokens).toBe(50);
    expect(result.promptUsed).toBe("test prompt");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "test prompt" }],
      }),
    );
  });

  it("strip markdown-fences uit JSON-content", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '```json\n{"score": 9}\n```' }],
      usage: { input_tokens: 80, output_tokens: 20 },
      model: "claude-sonnet-4-6",
    });
    const { analyzeClaude } = await import("./claude");
    const result = await analyzeClaude({ prompt: "x", schema });
    expect(result.data).toEqual({ score: 9 });
  });

  it("gooit error bij ongeldig JSON in response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "geen JSON" }],
      usage: { input_tokens: 50, output_tokens: 10 },
      model: "claude-sonnet-4-6",
    });
    const { analyzeClaude } = await import("./claude");
    await expect(analyzeClaude({ prompt: "x", schema })).rejects.toThrow(
      /geen geldige JSON/,
    );
  });

  it("gooit error als response niet aan schema voldoet", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"score": "niet een nummer"}' }],
      usage: { input_tokens: 50, output_tokens: 10 },
      model: "claude-sonnet-4-6",
    });
    const { analyzeClaude } = await import("./claude");
    await expect(analyzeClaude({ prompt: "x", schema })).rejects.toThrow();
  });
});
