/**
 * Per-sectie arrays van content-keys. Aparte file (geen "use client") zodat
 * server-components deze kunnen importeren; de client-side sectie-files
 * mogen alleen JSX-components exporteren.
 *
 * Elke SECTION_KEYS-array groeit mee als een sectie meer content krijgt.
 * page.tsx importeert alle SECTION_KEYS voor de content-batch-fetch.
 */

import type { ContentKey } from "@/lib/content/registry";

export const HERO_KEYS = [
  "homepage.hero.chip",
  "homepage.hero.title",
  "homepage.hero.subtitle",
  "homepage.hero.cta_primary_label",
  "homepage.hero.cta_secondary_label",
  "homepage.hero.micro_copy",
] as const satisfies readonly ContentKey[];

export const PAINPOINTS_KEYS = [
  "homepage.painpoints.eyebrow",
  "homepage.painpoints.title",
  "homepage.painpoints.intro",
  "homepage.painpoints.q.1",
  "homepage.painpoints.q.2",
  "homepage.painpoints.q.3",
  "homepage.painpoints.q.4",
  "homepage.painpoints.q.5",
  "homepage.painpoints.q.6",
  "homepage.painpoints.q.7",
  "homepage.painpoints.q.8",
  "homepage.painpoints.q.9",
] as const satisfies readonly ContentKey[];

export const HOWITWORKS_KEYS = [
  "homepage.howitworks.eyebrow",
  "homepage.howitworks.title",
  "homepage.howitworks.step.1.title",
  "homepage.howitworks.step.1.body",
  "homepage.howitworks.step.2.title",
  "homepage.howitworks.step.2.body",
  "homepage.howitworks.step.3.title",
  "homepage.howitworks.step.3.body",
] as const satisfies readonly ContentKey[];

export const FOUNDATIONS_KEYS = [
  "homepage.foundations.eyebrow",
  "homepage.foundations.title",
  "homepage.foundations.intro",
  "homepage.foundations.card.cialdini.label",
  "homepage.foundations.card.cialdini.title",
  "homepage.foundations.card.cialdini.body",
  "homepage.foundations.card.ritson.label",
  "homepage.foundations.card.ritson.title",
  "homepage.foundations.card.ritson.body",
  "homepage.foundations.card.kotler.label",
  "homepage.foundations.card.kotler.title",
  "homepage.foundations.card.kotler.body",
] as const satisfies readonly ContentKey[];

export type HeroKey = (typeof HERO_KEYS)[number];
export type PainPointsKey = (typeof PAINPOINTS_KEYS)[number];
export type HowItWorksKey = (typeof HOWITWORKS_KEYS)[number];
export type FoundationsKey = (typeof FOUNDATIONS_KEYS)[number];
