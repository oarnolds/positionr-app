/**
 * Verwijdert em-dashes (—) en en-dashes (–) uit gegenereerde tekst. Harde
 * garantie (vgl. humanizer §14): een liggend streepje hoort nooit in
 * klantgerichte B1-tekst. Een prompt-instructie alleen is niet betrouwbaar
 * genoeg, dus dit is de deterministische vangnet-laag die op alle
 * gegenereerde kaart- en brug-tekst draait.
 *
 * Gewone koppelstreepjes (-) blijven staan ("outside-in", "low-code").
 */
export function stripDashes(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ") // em/en-dash (met omringende spaties) → komma
    .replace(/,\s*,/g, ", ") // dubbele komma opruimen
    .replace(/,\s*([.!?;:])/g, "$1") // komma vlak vóór ander leesteken weg
    .replace(/\s+([,.!?;:])/g, "$1") // spatie vlak vóór leesteken weg
    .replace(/^\s*,\s*/, "") // leidende komma weg
    .replace(/ {2,}/g, " ") // dubbele spatie
    .trim();
}
