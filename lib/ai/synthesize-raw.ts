// Synthese-modus voor RAW markdown-output:
//   1) parallel Claude + Perplexity met dezelfde prompt
//   2) derde Claude-call merget beide rapportages tot één rijkere versie
//
// Returnt dezelfde shape als analyzeClaudeRaw zodat upstream-services
// niets hoeven te weten over de drie onderliggende calls. Tokens en kosten
// zijn gesommeerd over alle drie de calls; llmModel = "both".

import { analyzeClaudeRaw, type ClaudeRawResult } from "./claude-raw";
import { analyzePerplexityRaw } from "./perplexity-raw";

const SYNTHESIS_HEADER = [
  "Je krijgt twee onafhankelijke rapportages over hetzelfde onderwerp:",
  "RAPPORT A is geschreven door Claude (analytisch, gestructureerd).",
  "RAPPORT B is geschreven door Perplexity (web-citaties, actuele bronnen).",
  "",
  "Voeg ze samen tot één rijkere, uitgebalanceerde rapportage. Regels:",
  "- Combineer de sterke punten van beide: behoud verse feiten/citaten uit B,",
  "  behoud diepe analyse en structuur uit A.",
  "- Verwijder duplicatie. Bij tegenstrijdigheden: kies de best onderbouwde",
  "  uitspraak of zeg expliciet dat de bronnen verschillen.",
  "- Volg exact het format en de markdown-structuur die in de originele prompt",
  "  is voorgeschreven (onder 'FORMAT-TEMPLATE').",
  "- Geef ALLEEN de gevulde markdown terug. Geen meta-uitleg, geen 'Hier is",
  "  de synthese', geen JSON.",
  "",
].join("\n");

export async function analyzeBothRaw(args: {
  prompt: string;
}): Promise<ClaudeRawResult> {
  const [claudeResult, perplexityResult] = await Promise.all([
    analyzeClaudeRaw({ prompt: args.prompt }),
    analyzePerplexityRaw({ prompt: args.prompt }),
  ]);

  const synthesisPrompt = [
    SYNTHESIS_HEADER,
    "ORIGINELE PROMPT (voor format-referentie):",
    "---",
    args.prompt,
    "---",
    "",
    "RAPPORT A (Claude):",
    "---",
    claudeResult.markdown,
    "---",
    "",
    "RAPPORT B (Perplexity):",
    "---",
    perplexityResult.markdown,
    "---",
    "",
    "Schrijf nu de samengevoegde rapportage.",
  ].join("\n");

  const synthesisResult = await analyzeClaudeRaw({ prompt: synthesisPrompt });

  return {
    markdown: synthesisResult.markdown,
    promptUsed: args.prompt,
    llmModel: "both",
    llmInputTokens:
      claudeResult.llmInputTokens +
      perplexityResult.llmInputTokens +
      synthesisResult.llmInputTokens,
    llmOutputTokens:
      claudeResult.llmOutputTokens +
      perplexityResult.llmOutputTokens +
      synthesisResult.llmOutputTokens,
    llmCostCents:
      claudeResult.llmCostCents +
      perplexityResult.llmCostCents +
      synthesisResult.llmCostCents,
  };
}
