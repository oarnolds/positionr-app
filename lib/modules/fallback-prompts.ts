// lib/modules/fallback-prompts.ts
//
// Single source-of-truth voor de FALLBACK_PROMPT per module — gebruikt door:
//  1. Seed-script (initiële DB-populatie)
//  2. Reset-knop in admin-editor (terug naar default)
//  3. Defense-in-depth fallback in getModulePrompt (als DB-veld leeg is)
//
// Voor 'soon' modules: simpele placeholders. Voor actieve modules: import
// van de echte FALLBACK_PROMPT uit modules/<slug>/prompt.ts.

const SOON_PLACEHOLDER = (name: string) =>
  `[Placeholder prompt voor ${name} — vul aan via de admin-editor zodra deze module gebouwd wordt.]`;

export const FALLBACK_PROMPTS: Record<string, string> = {
  // ACTIVE — wordt in Task 6 overschreven met echte import (website-check)
  "website-check": SOON_PLACEHOLDER("Website Check"),
  "icp-analyse": SOON_PLACEHOLDER("ICP Analyse"),

  // SOON
  "website-check-concurrenten": SOON_PLACEHOLDER("Website Check + Concurrenten"),
  "flyercheck": SOON_PLACEHOLDER("Flyer/Salespresentatie Checker"),
  "marktonderzoek": SOON_PLACEHOLDER("Marktonderzoek"),
  "linkedin-analyse": SOON_PLACEHOLDER("LinkedIn Analyse"),
  "linkedin-concurrentie": SOON_PLACEHOLDER("LinkedIn Analyse + Concurrentie"),
  "propositie-analyse": SOON_PLACEHOLDER("Propositie Analyse"),
  "klantcase-analyse": SOON_PLACEHOLDER("Klantcase Analyse"),
  "linkedin-concurrentie-kwartaal": SOON_PLACEHOLDER(
    "LinkedIn Concurrentie Kwartaal",
  ),
  "gap-analyse": SOON_PLACEHOLDER("Gap Analyse"),
};
