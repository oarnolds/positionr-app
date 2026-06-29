// Synthese-modus voor JSON/schema-output (mirror van synthesize-raw.ts voor
// markdown). Volgt dezelfde route: parallel Claude + Perplexity → derde
// Claude-call merget tot één schema-valid response.

import type { AdapterArgs, AnalyzeResult } from "./analyze";
import { analyzeClaude } from "./claude";
import { analyzePerplexity } from "./perplexity";

const SYNTHESIS_INSTRUCTION = [
  "Je krijgt twee onafhankelijke analyses van hetzelfde onderwerp:",
  "RAPPORT A is van Claude (analytisch, gestructureerd).",
  "RAPPORT B is van Perplexity (web-citaties, actuele bronnen).",
  "",
  "Voeg ze samen tot één rijkere, uitgebalanceerde analyse:",
  "- Combineer de sterke punten: verse feiten/citaten uit B, diepe analyse uit A.",
  "- Verwijder duplicatie. Bij tegenstrijdigheden: kies de best onderbouwde uitspraak.",
  "- Volg EXACT hetzelfde JSON-schema als de originele prompt voorschrijft.",
  "- Geef ALLEEN de samengevoegde JSON terug, geen uitleg eromheen.",
  "",
].join("\n");

export async function analyzeBoth<T>(
  args: AdapterArgs<T>,
): Promise<AnalyzeResult<T>> {
  const [a, b] = await Promise.all([
    analyzeClaude({ prompt: args.prompt, schema: args.schema }),
    analyzePerplexity({ prompt: args.prompt, schema: args.schema }),
  ]);

  const synthesisPrompt = [
    SYNTHESIS_INSTRUCTION,
    "ORIGINELE PROMPT (voor schema-referentie):",
    "---",
    args.prompt,
    "---",
    "",
    "RAPPORT A (Claude) als JSON:",
    "---",
    JSON.stringify(a.data, null, 2),
    "---",
    "",
    "RAPPORT B (Perplexity) als JSON:",
    "---",
    JSON.stringify(b.data, null, 2),
    "---",
    "",
    "Geef nu de samengevoegde JSON.",
  ].join("\n");

  const merged = await analyzeClaude({
    prompt: synthesisPrompt,
    schema: args.schema,
  });

  return {
    data: merged.data,
    promptUsed: args.prompt,
    llmModel: "both",
    llmInputTokens: a.llmInputTokens + b.llmInputTokens + merged.llmInputTokens,
    llmOutputTokens:
      a.llmOutputTokens + b.llmOutputTokens + merged.llmOutputTokens,
    llmCostCents: a.llmCostCents + b.llmCostCents + merged.llmCostCents,
  };
}
