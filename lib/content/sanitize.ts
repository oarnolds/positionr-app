import sanitizeHtml from "sanitize-html";

/**
 * Sanitizer voor `rich` content-velden. Wordt server-side aangeroepen
 * bij elke save van een rich content-key (bv. FAQ-antwoorden).
 *
 * Whitelist:
 *  - Structuur: p, br, ul, ol, li
 *  - Nadruk:    strong, em
 *  - Links:     a (met href, target, rel; alleen http(s)/mailto)
 *
 * Alles anders wordt stripped: script, iframe, style, event-handlers,
 * javascript:-hrefs, data:-URI's, form-elementen, etc.
 */
export function sanitizeRich(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "a", "ul", "ol", "li"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
    // Standaard laat sanitize-html de bekende event-attributes al vallen,
    // maar we zetten geen wildcard-attribute-allow om zeker te zijn.
  });
}
