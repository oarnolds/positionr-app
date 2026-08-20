import { Hero } from "./_home/hero";
import { HowItWorks } from "./_home/how-it-works";
import { Foundations } from "./_home/foundations";
import { AgencyComparison } from "./_home/agency-comparison";
import { PlansTeaser } from "./_home/plans-teaser";
import { Faq } from "./_home/faq";
import { FinalCta } from "./_home/final-cta";
import { HomeFooter } from "./_home/footer";

export default function HomePage() {
  return (
    <div className="bg-cream text-ink-high">
      <Hero />
      <HowItWorks />
      <Foundations />
      <AgencyComparison />
      <PlansTeaser />
      <Faq />
      <FinalCta />
      <HomeFooter />
    </div>
  );
}
