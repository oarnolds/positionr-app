import Anthropic from "@anthropic-ai/sdk";
import { calculateCostCents, PRICING } from "./pricing";
import type { ClaudeRawResult } from "./claude-raw";

const MAX_TOKENS = 8000;
// Begrens het aantal zoekopdrachten per analyse — elke search kost extra
// bovenop de tokens. 8 is ruim voor een concurrent-discovery over 2-3
// marktsegmenten.
const MAX_SEARCHES = 8;
// pause_turn-vervolgen: server-side tool-loops kunnen pauzeren; we hervatten
// max dit aantal keer voordat we de output nemen zoals die is.
const MAX_CONTINUATIONS = 5;

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

/**
 * Claude-call mét server-side web search (web_search_20260209).
 * Claude zoekt zelf het web af tijdens de analyse — gebruikt voor
 * concurrent-discovery waar actuele marktinformatie essentieel is.
 * Retourneert dezelfde shape als analyzeClaudeRaw zodat consumers
 * uitwisselbaar blijven.
 */
export async function analyzeClaudeSearchRaw(args: {
  prompt: string;
}): Promise<ClaudeRawResult> {
  const client = getClient();
  const tools: Anthropic.Messages.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES },
  ];

  let messages: Anthropic.MessageParam[] = [
    { role: "user", content: args.prompt },
  ];
  let totalInput = 0;
  let totalOutput = 0;

  let response = await client.messages.create({
    model: PRICING.claude.model,
    max_tokens: MAX_TOKENS,
    tools,
    messages,
  });
  totalInput += response.usage.input_tokens ?? 0;
  totalOutput += response.usage.output_tokens ?? 0;

  // Server-side zoek-loops kunnen pauzeren (stop_reason "pause_turn").
  // Assistant-content terugsturen laat de server hervatten waar hij was.
  let continuations = 0;
  while (response.stop_reason === "pause_turn" && continuations < MAX_CONTINUATIONS) {
    continuations++;
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await client.messages.create({
      model: PRICING.claude.model,
      max_tokens: MAX_TOKENS,
      tools,
      messages,
    });
    totalInput += response.usage.input_tokens ?? 0;
    totalOutput += response.usage.output_tokens ?? 0;
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Claude (web search) retourneerde lege output");
  }

  return {
    markdown: text,
    promptUsed: args.prompt,
    llmModel: `${PRICING.claude.model} + web_search`,
    llmInputTokens: totalInput,
    llmOutputTokens: totalOutput,
    llmCostCents: calculateCostCents("claude", totalInput, totalOutput),
  };
}
