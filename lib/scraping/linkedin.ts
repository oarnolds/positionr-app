// LinkedIn-specifieke helpers voor de linkedin-analyse-module.

/**
 * Normaliseert een LinkedIn-bedrijfspagina-URL naar de publieke gastpagina.
 * Strip alles ná de company-handle (/admin/dashboard, /posts, query, hash,
 * trailing slash). Zo wordt een uit de browser geplakte admin-URL —
 * bijv. .../company/104954097/admin/dashboard, die een inlogscherm oplevert —
 * teruggebracht tot .../company/104954097, de publiek scrape-bare pagina.
 * Niet-company-URL's komen ongewijzigd terug.
 */
export function normalizeLinkedInCompanyUrl(raw: string): string {
  const trimmed = raw.trim();
  const match = /^(https?:\/\/[^/]+\/company\/[^/?#]+)/i.exec(trimmed);
  return match ? match[1] : trimmed;
}

/**
 * Herkent of een gescrapete pagina in werkelijkheid het LinkedIn-inlogscherm
 * (authwall) is in plaats van de bedrijfspagina. Gebeurt bij admin-/login-
 * URL's én wanneer LinkedIn geautomatiseerde toegang blokkeert.
 */
export function isLinkedInAuthwall(opts: {
  title?: string | null;
  markdown: string;
}): boolean {
  const title = (opts.title ?? "").toLowerCase();
  const md = opts.markdown.toLowerCase();
  if (/linkedin login|sign in \| linkedin|log in \| linkedin/.test(title)) {
    return true;
  }
  return md.includes("stay updated on your professional world");
}
