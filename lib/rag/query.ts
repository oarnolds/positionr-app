import Anthropic from "@anthropic-ai/sdk";
import { embedText } from "@/lib/ai/embeddings";
import { createServiceClient } from "@/lib/supabase/service";
import { PRICING } from "@/lib/ai/pricing";

type MatchRow = {
  id: string;
  snapshot_id: string;
  chunk_index: number;
  content: string;
  source_kind: "website" | "pdf" | "docx";
  source_url: string;
  source_filename: string | null;
  heading_path: string[];
  similarity: number;
};

export type RagMatch = {
  snapshotId: string;
  chunkIndex: number;
  content: string;
  sourceKind: "website" | "pdf" | "docx";
  sourceUrl: string;
  sourceFilename: string | null;
  headingPath: string[];
  similarity: number;
};

export type RagAnswer = {
  question: string;
  answer: string;
  matches: RagMatch[];
};

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ontbreekt");
  _client = new Anthropic({ apiKey });
  return _client;
}

/** Vind de top-K meest relevante chunks uit de gebruiker's bibliotheek. */
export async function findRelevantChunks(
  userId: string,
  question: string,
  topK: number = 6
): Promise<RagMatch[]> {
  const embedding = await embedText(question);
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("match_snapshot_chunks", {
    query_embedding: embedding as unknown as string,
    match_count: topK,
    filter_user_id: userId,
  });
  if (error) throw new Error(`match_snapshot_chunks faalde: ${error.message}`);
  const rows = (data ?? []) as MatchRow[];
  return rows.map((r) => ({
    snapshotId: r.snapshot_id,
    chunkIndex: r.chunk_index,
    content: r.content,
    sourceKind: r.source_kind,
    sourceUrl: r.source_url,
    sourceFilename: r.source_filename,
    headingPath: r.heading_path,
    similarity: r.similarity,
  }));
}

function formatContext(matches: RagMatch[]): string {
  return matches
    .map((m, i) => {
      const source =
        m.sourceFilename ?? (m.sourceUrl || `bron ${i + 1}`);
      const heading = m.headingPath.length
        ? ` › ${m.headingPath.join(" › ")}`
        : "";
      return `[Bron ${i + 1}: ${source}${heading}]\n${m.content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Stelt een vraag aan de gebruikers markdown-bibliotheek via RAG:
 * embed → similarity search → Claude beantwoordt met alleen de retrieved
 * context als kennisbron.
 */
export async function answerFromLibrary(
  userId: string,
  question: string,
  options: { topK?: number } = {}
): Promise<RagAnswer> {
  const matches = await findRelevantChunks(userId, question, options.topK ?? 6);
  if (matches.length === 0) {
    return {
      question,
      answer:
        "Geen relevante content gevonden in je bibliotheek. Voeg eerst snapshots toe via 'Markdown bibliotheek' op /modules.",
      matches: [],
    };
  }

  const context = formatContext(matches);
  const prompt = `Je beantwoordt een vraag op basis van de onderstaande fragmenten uit de bibliotheek van de gebruiker. Belangrijke regels:

- Gebruik UITSLUITEND informatie uit de fragmenten. Verzin niets.
- Verwijs naar bronnen met [Bron N] inline waar je een claim doet.
- Als de fragmenten geen antwoord bevatten, zeg dat eerlijk in één zin.
- Antwoord in het Nederlands, beknopt en concreet.

VRAAG: ${question}

FRAGMENTEN:
${context}

Geef nu het antwoord:`;

  const response = await getClient().messages.create({
    model: PRICING.claude.model,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  const answer = block?.type === "text" ? block.text.trim() : "";

  return { question, answer, matches };
}
