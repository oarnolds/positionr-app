import mammoth from "mammoth";

export type DocxMarkdownResult = {
  markdown: string;
  /** Waarschuwingen van mammoth (bv. niet-ondersteunde elementen). */
  warnings: string[];
};

/**
 * Converteert een .docx (buffer) naar markdown via mammoth.
 * Snelle, lokale conversie — geen kosten, geen externe API.
 * Werkt alleen voor .docx (OOXML), niet voor het legacy .doc-formaat.
 */
export async function docxToMarkdown(
  buffer: Buffer
): Promise<DocxMarkdownResult> {
  const result = await mammoth.convertToMarkdown({ buffer });
  const md = result.value.trim();
  if (!md) {
    throw new Error("DOCX bevat geen tekst (of is beschadigd)");
  }
  return {
    markdown: md,
    warnings: result.messages.map((m) => m.message),
  };
}
