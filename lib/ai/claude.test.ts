import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { extractAndParseJson } from "./claude";

describe("extractAndParseJson", () => {
  it("parseert kale JSON", () => {
    expect(extractAndParseJson('{"score": 7}')).toEqual({ score: 7 });
  });

  it("strip markdown-fences", () => {
    expect(extractAndParseJson('```json\n{"score": 7}\n```')).toEqual({
      score: 7,
    });
  });

  it("ignoreert leading-text vóór de eerste {", () => {
    expect(
      extractAndParseJson('Hier is mijn antwoord:\n{"score": 7}'),
    ).toEqual({ score: 7 });
  });

  it("ignoreert trailing-text na de laatste }", () => {
    expect(
      extractAndParseJson('{"score": 7}\n\nDat is mijn analyse.'),
    ).toEqual({ score: 7 });
  });

  it("handelt geneste objecten (last } moet de outer closing zijn)", () => {
    expect(
      extractAndParseJson('{"x": {"y": 1, "z": [2, 3]}, "w": 4}'),
    ).toEqual({ x: { y: 1, z: [2, 3] }, w: 4 });
  });

  it("gooit op echte garbage", () => {
    expect(() => extractAndParseJson("totaal niks bruikbaars")).toThrow();
  });
});

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
