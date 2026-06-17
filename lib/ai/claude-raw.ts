import Anthropic from "@anthropic-ai/sdk";
import { calculateCostCents, PRICING } from "./pricing";

const MAX_TOKENS = 8000;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 20) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt of is ongeldig in .env.local");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export type ClaudeRawResult = {
  markdown: string;
  promptUsed: string;
  llmModel: string;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCostCents: number;
};

/**
 * Single-message Claude call die raw text retourneert.
 * Geen JSON-parse, geen Zod-schema. Bedoeld voor template-driven modules
 * waar de AI markdown-output produceert.
 */
export async function analyzeClaudeRaw(args: {
  prompt: string;
}): Promise<ClaudeRawResult> {
  const response = await getClient().messages.create({
    model: PRICING.claude.model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: args.prompt }],
  });

  const block = response.content[0];
  const text = block?.type === "text" ? block.text : "";

  if (!text.trim()) {
    throw new Error("Claude retourneerde lege output");
  }

  const inputTokens = response.usage.input_tokens ?? 0;
  const outputTokens = response.usage.output_tokens ?? 0;

  return {
    markdown: text.trim(),
    promptUsed: args.prompt,
    llmModel: PRICING.claude.model,
    llmInputTokens: inputTokens,
    llmOutputTokens: outputTokens,
    llmCostCents: calculateCostCents("claude", inputTokens, outputTokens),
  };
}
