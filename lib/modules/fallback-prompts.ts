// lib/modules/fallback-prompts.ts
//
// Single source-of-truth voor de FALLBACK_PROMPT per module — gebruikt door:
//  1. Seed-script (initiële DB-populatie)
//  2. Reset-knop in admin-editor (terug naar default)
//  3. Defense-in-depth fallback in getModulePrompt (als DB-veld leeg is)
//
// Voor 'soon' modules: simpele placeholders. Voor actieve modules: import
// van de echte FALLBACK_PROMPT uit modules/<slug>/prompt.ts.

import { FALLBACK_PROMPT as websiteCheckFallback } from "@/modules/website-check/prompt";
import {
  FALLBACK_PROMPT_SCAN,
  FALLBACK_PROMPT_PHASE1,
  FALLBACK_PROMPT_FINAL,
} from "@/modules/icp-analyse/prompt";

const SOON_PLACEHOLDER = (name: string) =>
  `[Placeholder prompt voor ${name} — vul aan via de admin-editor zodra deze module gebouwd wordt.]`;

export const FALLBACK_PROMPTS: Record<string, string> = {
  // ── Active top-level ──────────────────────────────────────────────
  "website-check": websiteCheckFallback,
  "icp-analyse": SOON_PLACEHOLDER(
    "ICP Analyse — gebruikt sub-prompts (zie icp-analyse-scan/phase1/final)",
  ),

  // ── ICP sub-prompts (active, runtime gebruikt deze) ───────────────
  "icp-analyse-scan": FALLBACK_PROMPT_SCAN,
  "icp-analyse-phase1": FALLBACK_PROMPT_PHASE1,
  "icp-analyse-final": FALLBACK_PROMPT_FINAL,

  // ── Fundament — soon ──────────────────────────────────────────────
  "linkedin-analyse": SOON_PLACEHOLDER("LinkedIn analyse"),
  "markttrends-rapport": SOON_PLACEHOLDER("Markttrends rapport"),
  flyercheck: SOON_PLACEHOLDER("Flyer/Salespresentatie analyse"),
  "klantcase-analyse": SOON_PLACEHOLDER("Klantcase analyse"),
  "propositie-analyse": SOON_PLACEHOLDER("Propositie analyse"),

  // ── Groei — soon ──────────────────────────────────────────────────
  "website-check-concurrenten": SOON_PLACEHOLDER("Website analyse + concurrenten"),
  "linkedin-concurrentie": SOON_PLACEHOLDER("LinkedIn analyse + concurrentie"),
  "markttrends-benefits": SOON_PLACEHOLDER("Markttrends met benefits"),
  "features-naar-benefits": SOON_PLACEHOLDER("Features naar benefits"),
  "concurrentie-analyse": SOON_PLACEHOLDER("Concurrentie analyse"),
  "doelgroep-persona": SOON_PLACEHOLDER("Doelgroep & buying persona"),
  "propositie-positionering": SOON_PLACEHOLDER("Propositie en positionering"),

  // ── Strategie — soon ──────────────────────────────────────────────
  marketingstrategie: SOON_PLACEHOLDER("Marketingstrategie"),
  salestriggervragen: SOON_PLACEHOLDER("Salestriggervragen"),
  "telemarketing-script": SOON_PLACEHOLDER("Template telemarketing-script"),
  kwartaalplan: SOON_PLACEHOLDER("Kwartaalplan Marketing & Sales"),
  "seo-quickscan": SOON_PLACEHOLDER("SEO quick scan"),
  "sea-quickscan": SOON_PLACEHOLDER("SEA quick scan"),
  "content-kalender": SOON_PLACEHOLDER("Content kalender"),
};
