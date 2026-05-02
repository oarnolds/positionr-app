import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;

// Sonnet 4.6 prijzen per miljoen tokens ($USD)
const PRICE = {
  input: 3.0,
  cacheWrite: 3.75,
  cacheRead: 0.3,
  output: 15.0,
} as const;

export type AnalyzeResult<T> = {
  data: T;
  promptUsed: string;
  llmModel: string;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCostCents: number;
};

export async function analyzeWithCachedSystem<T>(args: {
  system: string;
  user: string;
  schema: ZodType<T>;
}): Promise<AnalyzeResult<T>> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: args.system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: args.user }],
  });

  const block = response.content[0];
  const text = block?.type === "text" ? block.text : "";
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returnde geen geldige JSON: ${text.slice(0, 200)}`);
  }

  const data = args.schema.parse(parsed);

  const u = response.usage;
  const inputRegular = u.input_tokens ?? 0;
  const inputCacheWrite =
    (u as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0;
  const inputCacheRead =
    (u as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0;
  const output = u.output_tokens ?? 0;

  const totalInput = inputRegular + inputCacheWrite + inputCacheRead;

  // Kostencalculatie: prijs/MTok × tokens, omgerekend naar centen
  const costCents = Math.round(
    (inputRegular * PRICE.input +
      inputCacheWrite * PRICE.cacheWrite +
      inputCacheRead * PRICE.cacheRead +
      output * PRICE.output) /
      10_000
  );

  return {
    data,
    promptUsed: `[system]\n${args.system}\n\n[user]\n${args.user}`,
    llmModel: MODEL,
    llmInputTokens: totalInput,
    llmOutputTokens: output,
    llmCostCents: costCents,
  };
}
