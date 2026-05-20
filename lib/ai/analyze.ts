// lib/ai/analyze.ts
//
// Provider-agnostic entrypoint. Routes naar Claude of Perplexity op basis van
// het meegegeven provider-veld. Beide adapters returnen dezelfde shape zodat
// upstream-services niets hoeven te weten over de provider.

import type { z } from "zod";
import type { Provider } from "./pricing";
import { analyzeClaude } from "./claude";
import { analyzePerplexity } from "./perplexity";

export type AnalyzeArgs<T> = {
  provider: Provider;
  prompt: string;
  schema: z.ZodType<T>;
};

export type AnalyzeResult<T> = {
  data: T;
  llmModel: string;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCostCents: number;
  promptUsed: string;
};

export type AdapterArgs<T> = {
  prompt: string;
  schema: z.ZodType<T>;
};

export async function analyze<T>(
  args: AnalyzeArgs<T>,
): Promise<AnalyzeResult<T>> {
  const { provider, prompt, schema } = args;
  if (provider === "claude") return analyzeClaude({ prompt, schema });
  if (provider === "perplexity") return analyzePerplexity({ prompt, schema });
  throw new Error(`Onbekende provider: ${provider}`);
}
