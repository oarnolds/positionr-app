// Perplexity sonar-pro adapter voor RAW markdown-output.
// Spiegelt analyzeClaudeRaw zodat website-check (en andere template-driven
// modules) Perplexity kunnen aanspreken zonder JSON/schema-laag.

import { calculateCostCents, PRICING } from "./pricing";
import type { ClaudeRawResult } from "./claude-raw";

const API_URL = "https://api.perplexity.ai/chat/completions";
const MAX_TOKENS = 8000;

export async function analyzePerplexityRaw(args: {
  prompt: string;
}): Promise<ClaudeRawResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY ontbreekt in env");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PRICING.perplexity.model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: args.prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Perplexity API ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
    model: string;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Perplexity retourneerde lege output");

  const inputTokens = payload.usage.prompt_tokens;
  const outputTokens = payload.usage.completion_tokens;

  return {
    markdown: content,
    promptUsed: args.prompt,
    llmModel: payload.model,
    llmInputTokens: inputTokens,
    llmOutputTokens: outputTokens,
    llmCostCents: calculateCostCents("perplexity", inputTokens, outputTokens),
  };
}
