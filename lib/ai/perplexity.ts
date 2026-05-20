// lib/ai/perplexity.ts
//
// Perplexity sonar-pro adapter. Volgt dezelfde interface als analyzeClaude
// zodat de analyze()-router beide kan aanspreken.

import type { AdapterArgs, AnalyzeResult } from "./analyze";
import { calculateCostCents, PRICING } from "./pricing";

const API_URL = "https://api.perplexity.ai/chat/completions";

export async function analyzePerplexity<T>(
  args: AdapterArgs<T>,
): Promise<AnalyzeResult<T>> {
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

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Perplexity response heeft geen content");

  const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Perplexity response geen geldige JSON: ${content.slice(0, 200)}`,
    );
  }
  const data = args.schema.parse(parsed);

  const inputTokens = payload.usage.prompt_tokens;
  const outputTokens = payload.usage.completion_tokens;

  return {
    data,
    promptUsed: args.prompt,
    llmModel: payload.model,
    llmInputTokens: inputTokens,
    llmOutputTokens: outputTokens,
    llmCostCents: calculateCostCents("perplexity", inputTokens, outputTokens),
  };
}
