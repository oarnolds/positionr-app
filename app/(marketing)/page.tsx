import { getContentBatch } from "@/lib/content/get";

import {
  HERO_KEYS,
  PAINPOINTS_KEYS,
  HOWITWORKS_KEYS,
  FOUNDATIONS_KEYS,
} from "./_home/keys";
import { Hero } from "./_home/hero";
import { PainPoints } from "./_home/pain-points";
import { HowItWorks } from "./_home/how-it-works";
import { Foundations } from "./_home/foundations";
import { Founders } from "./_home/founders";
import { AgencyComparison } from "./_home/agency-comparison";
import { PlansTeaser } from "./_home/plans-teaser";
import { Faq } from "./_home/faq";
import { FinalCta } from "./_home/final-cta";
import { HomeFooter } from "./_home/footer";

// Groeit per sectie-refactor tot alle homepage-sections uit content lezen.
const ACTIVE_KEYS = [
  ...HERO_KEYS,
  ...PAINPOINTS_KEYS,
  ...HOWITWORKS_KEYS,
  ...FOUNDATIONS_KEYS,
] as const;

export default async function HomePage() {
  const content = await getContentBatch(ACTIVE_KEYS);
  return (
    <div className="bg-cream text-ink-high">
      <Hero content={content} />
      <PainPoints content={content} />
      <HowItWorks content={content} />
      <Foundations content={content} />
      <Founders />
      <AgencyComparison />
      <PlansTeaser />
      <Faq />
      <FinalCta />
      <HomeFooter />
    </div>
  );
}
