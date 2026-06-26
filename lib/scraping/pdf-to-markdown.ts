import Anthropic from "@anthropic-ai/sdk";
import { calculateCostCents, PRICING } from "@/lib/ai/pricing";

const MAX_TOKENS = 16_000;

const SYSTEM_PROMPT = `Je krijgt een PDF-document. Converteer de inhoud naar schone, goed gestructureerde markdown.

Regels:
- Gebruik ATX-headings (# H1, ## H2, ### H3) voor de logische hiërarchie
- Behoud lijsten, tabellen en citaten (gebruik markdown-syntax)
- Strip overbodige metadata: paginanummers, herhalende kop/voettekst

Afbeeldingen — beschrijf zinvol, niet decoratief:
- LOGO's (van het eigen bedrijf of klanten/partners): noem ALTIJD het bedrijfsnaam als je 'm herkent. Formaat: [Logo: Philips] of [Logo: onbekend bedrijf in tech-sector]. Als er meerdere logo's in een "trusted by" of "onze klanten"-blok staan, somt ze allemaal op: [Klantlogo's: Philips, KLM, ING, Microsoft].
- FOTO's: één zin scene-beschrijving. Formaat: [Foto: team van 6 mensen aan vergadertafel met laptops].
- DIAGRAMMEN/SCHEMA's: extraheer de tekst en relaties. Formaat: [Diagram: 3-staps proces — Onderzoek → Ontwerp → Levering, met pijlen tussen elke stap].
- GRAFIEKEN: extraheer titel, assen en hoofdtrend. Formaat: [Grafiek: omzet 2020-2024, lineaire groei van €1M naar €4M].
- Decoratieve elementen (banners, lijnen, achtergrond-iconen): SKIP — niet noemen.

Behoud de oorspronkelijke leesvolgorde. Geef ALLEEN de markdown terug, geen uitleg eromheen, geen \`\`\`markdown-fences.`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 20) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt of is ongeldig");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export type PdfMarkdownResult = {
  markdown: string;
  llmModel: string;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCostCents: number;
};

/**
 * Converteert een PDF (buffer) naar schone markdown via Claude's
 * document-content-block. Goed voor zowel digitale PDFs als scanned PDFs
 * (Claude doet OCR-achtige extractie van scanned content).
 */
export async function pdfToMarkdown(
  buffer: Buffer
): Promise<PdfMarkdownResult> {
  const base64 = buffer.toString("base64");

  const response = await getClient().messages.create({
    model: PRICING.claude.model,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          { type: "text", text: SYSTEM_PROMPT },
        ],
      },
    ],
  });

  const block = response.content[0];
  const text = block?.type === "text" ? block.text : "";
  if (!text.trim()) {
    throw new Error("Claude retourneerde lege markdown voor PDF");
  }

  const inputTokens = response.usage.input_tokens ?? 0;
  const outputTokens = response.usage.output_tokens ?? 0;

  return {
    markdown: text.trim(),
    llmModel: PRICING.claude.model,
    llmInputTokens: inputTokens,
    llmOutputTokens: outputTokens,
    llmCostCents: calculateCostCents("claude", inputTokens, outputTokens),
  };
}
