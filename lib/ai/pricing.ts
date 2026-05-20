// lib/ai/pricing.ts
//
// Tarieven per maart 2026 (peildatum spec). Update hier wanneer providers
// hun prijzen aanpassen. Eenheid: USD per miljoen tokens.

export type Provider = "claude" | "perplexity";

export const PRICING: Record<
  Provider,
  { inputPerMTokUsd: number; outputPerMTokUsd: number; model: string }
> = {
  claude: {
    inputPerMTokUsd: 3,
    outputPerMTokUsd: 15,
    model: "claude-sonnet-4-6",
  },
  perplexity: {
    inputPerMTokUsd: 3,
    outputPerMTokUsd: 15,
    model: "sonar-pro",
  },
};

/**
 * Bereken kosten in dollarcent (afgerond op gehele cent).
 * 1 cent = $0.01 = 1/100 USD.
 */
export function calculateCostCents(
  provider: Provider,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[provider];
  const usd =
    (inputTokens / 1_000_000) * p.inputPerMTokUsd +
    (outputTokens / 1_000_000) * p.outputPerMTokUsd;
  return Math.round(usd * 100);
}
