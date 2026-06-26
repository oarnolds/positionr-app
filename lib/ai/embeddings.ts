const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
const DIM = 1536;
const MAX_BATCH = 96; // OpenAI ondersteunt 2048, maar kleiner voorkomt timeouts
const MAX_CHARS_PER_INPUT = 30_000; // ~7.5k tokens, ruim binnen 8k context

export const EMBEDDING_DIM = DIM;
export const EMBEDDING_MODEL = MODEL;

type OpenAIEmbeddingResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

/**
 * Genereert embeddings voor een set teksten via OpenAI's
 * text-embedding-3-small. Returnt de embeddings in dezelfde volgorde als input.
 * Gooit als de OPENAI_API_KEY ontbreekt of de API faalt.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.length < 20) {
    throw new Error("OPENAI_API_KEY ontbreekt of is ongeldig in .env.local");
  }

  const truncated = texts.map((t) =>
    t.length > MAX_CHARS_PER_INPUT ? t.slice(0, MAX_CHARS_PER_INPUT) : t
  );

  const all: number[][] = Array.from({ length: texts.length }, () => []);
  for (let i = 0; i < truncated.length; i += MAX_BATCH) {
    const batch = truncated.slice(i, i + MAX_BATCH);
    const res = await fetch(OPENAI_EMBED_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: batch, model: MODEL }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI embeddings faalde (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as OpenAIEmbeddingResponse;
    json.data.forEach((d, j) => {
      all[i + (d.index ?? j)] = d.embedding;
    });
  }
  return all;
}

/** Convenience voor één tekst. */
export async function embedText(text: string): Promise<number[]> {
  const [emb] = await embedTexts([text]);
  return emb;
}
