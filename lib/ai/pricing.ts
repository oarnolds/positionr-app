// lib/ai/pricing.ts
//
// Tarieven per maart 2026 (peildatum spec). Update hier wanneer providers
// hun prijzen aanpassen. Eenheid: USD per miljoen tokens.

/** Daadwerkelijke call-providers (1 LLM-call). */
export type Provider = "claude" | "perplexity";

/**
 * Wat een module in de admin-editor kan kiezen. "both" = synthese-modus:
 * parallel Claude + Perplexity → derde Claude-call merget tot één rapport.
 * Geen eigen pricing-entry — kosten zijn de som van de drie onderliggende calls.
 */
export type ConfigProvider = Provider | "both";

export const PRICING: Record<
  Provider,
  { inputPerMTokUsd: number; outputPerMTokUsd: number; model: string }
> = {
  claude: {
    // TIJDELIJKE TEST: draait op Opus 5 om rapport-kwaliteit te vergelijken
    // met Sonnet 4.6. Direct na de test terug naar Sonnet — Opus is 67%
    // duurder per analyse ($2.75 vs $1.65). Zie commit-message voor context.
    inputPerMTokUsd: 5,
    outputPerMTokUsd: 25,
    model: "claude-opus-5",
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

// ---------------------------------------------------------------------------
// Per-model pricing (voor de /modules/markdown/vergelijk tool)
//
// PRICING hierboven is per *provider* ("claude", "perplexity") — handig voor
// de bestaande synthese-flow, maar niet bruikbaar zodra we specifiek per
// Claude-model (Haiku vs. Sonnet vs. Opus vs. Fable) de kosten willen
// vergelijken. Vandaar deze losse MODEL_PRICING map, gekeyed op het exacte
// model-ID string zoals we die aan de Claude API meegeven.
//
// Bronnen (peildatum 2026-08-07):
// - Haiku 4.5, Sonnet 4.6, Opus 5: https://platform.claude.com/docs/en/about-claude/pricing
// - Fable 5: geverifieerd op dezelfde pricing-pagina — $10 / MTok input,
//   $50 / MTok output (bevestigd, geen schatting).
// ---------------------------------------------------------------------------

export const MODEL_PRICING: Record<
  string,
  { inputPerMTokUsd: number; outputPerMTokUsd: number }
> = {
  "claude-haiku-4-5-20251001": { inputPerMTokUsd: 1, outputPerMTokUsd: 5 },
  "claude-sonnet-4-6": { inputPerMTokUsd: 3, outputPerMTokUsd: 15 },
  "claude-opus-5": { inputPerMTokUsd: 5, outputPerMTokUsd: 25 },
  // Fable 5: bevestigd via platform.claude.com/docs/en/about-claude/pricing
  "claude-fable-5": { inputPerMTokUsd: 10, outputPerMTokUsd: 50 },
};

/**
 * Bereken kosten in dollarcent voor een specifiek Claude-model (afgerond op
 * gehele cent). Onbekend model-ID → fallback op de Sonnet-tarieven uit
 * PRICING.claude, zodat een typo of nieuw modelnaam niet crasht maar wel
 * een redelijke schatting geeft.
 */
export function calculateModelCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICING[model] ?? PRICING.claude;
  const usd =
    (inputTokens / 1_000_000) * p.inputPerMTokUsd +
    (outputTokens / 1_000_000) * p.outputPerMTokUsd;
  return Math.round(usd * 100);
}
